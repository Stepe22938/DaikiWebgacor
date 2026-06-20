export type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiChatCompletionOptions = {
  messages: AiChatMessage[];
  model?: string | null;
  maxTokens?: number;
};

export type AiChatCompletionResult = {
  content: string;
  model: string;
  modelLabel: string;
  provider: string;
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function getModelLabel(model: string) {
  return model.includes("/") ? model.split("/").pop() || model : model;
}

function getChatCompletionsUrl(baseUrl: string) {
  const normalized = trimTrailingSlash(baseUrl);
  return normalized.endsWith("/chat/completions")
    ? normalized
    : `${normalized}/chat/completions`;
}

function getObscuraWorksCandidateUrls(baseUrl: string) {
  const normalized = trimTrailingSlash(baseUrl);
  const origin = (() => {
    try {
      return new URL(normalized).origin;
    } catch {
      return normalized;
    }
  })();

  return Array.from(new Set([
    getChatCompletionsUrl(normalized),
    `${origin}/chat/completions`,
    `${origin}/v1/chat/completions`,
    `${origin}/api/v1/chat/completions`,
    `${origin}/openai/v1/chat/completions`,
    `${origin}/openai/chat/completions`,
  ]));
}

function getProviderConfig(requestedModel?: string | null) {
  const provider = process.env.AI_PROVIDER || "obscuraworks";

  const baseUrl =
    process.env.AI_BASE_URL ||
    process.env.OBSCURAWORKS_BASE_URL ||
    "https://api.obscuraworks.org/v1";

  const apiKey =
    process.env.AI_API_KEY ||
    process.env.OBSCURAWORKS_API_KEY;

  const model =
    requestedModel?.trim() ||
    process.env.AI_MODEL ||
    process.env.OBSCURAWORKS_MODEL ||
    "gpt-4o";

  if (!apiKey || apiKey.includes("isi_api_key")) {
    throw new Error("ObscuraWorks API key is missing. Set OBSCURAWORKS_API_KEY in .env.");
  }

  return {
    provider,
    baseUrl: trimTrailingSlash(baseUrl),
    apiKey,
    model,
  };
}

function messagesToPrompt(messages: AiChatMessage[]) {
  return messages
    .map((message) => {
      if (message.role === "system") return `System:\n${message.content}`;
      if (message.role === "assistant") return `Assistant:\n${message.content}`;
      return `User:\n${message.content}`;
    })
    .join("\n\n");
}

async function createObscuraWorksCompletion(config: ReturnType<typeof getProviderConfig>, options: AiChatCompletionOptions) {
  let errors: string[] = [];

  // Try 1: ObscuraWorks custom GET endpoint
  try {
    const origin = (() => {
      try {
        return new URL(config.baseUrl).origin;
      } catch {
        return config.baseUrl;
      }
    })();
    const url = new URL(`${origin}/api/ai/groq`);
    url.searchParams.set("prompt", messagesToPrompt(options.messages));
    url.searchParams.set("model", config.model);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "x-api-key": config.apiKey,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (res.ok) {
      const payload = (await res.json().catch(async () => ({ error: await res.text() }))) as {
        status?: boolean;
        data?: string;
        error?: string | null;
        message?: string;
      };

      if (payload.status !== false && payload.data) {
        return {
          content: (payload.data ?? "").trim(),
          model: config.model,
          modelLabel: getModelLabel(config.model),
          provider: config.provider,
        };
      } else {
        errors.push(`GET error: ${payload.error || payload.message || "Unknown error"}`);
      }
    } else {
      errors.push(`GET status ${res.status}`);
    }
  } catch (err: any) {
    errors.push(`GET fetch failed: ${err.message || err}`);
  }

  // Try 2: Standard OpenAI-compatible POST /chat/completions (fallback)
  console.log("[AI] ObscuraWorks GET failed, trying OpenAI-compat POST...");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
    "x-api-key": config.apiKey,
  };

  const body: Record<string, unknown> = {
    model: config.model,
    messages: options.messages,
    max_tokens: options.maxTokens ?? 1024,
  };

  const candidateUrls = getObscuraWorksCandidateUrls(config.baseUrl);
  for (const candidateUrl of candidateUrls) {
    try {
      const res = await fetch(candidateUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const rawContent = data.choices?.[0]?.message?.content ?? "";
        if (rawContent.trim()) {
          return {
            content: rawContent.trim(),
            model: config.model,
            modelLabel: getModelLabel(config.model),
            provider: config.provider,
          };
        } else {
          errors.push(`POST ${candidateUrl} returned empty response`);
        }
      } else {
        errors.push(`POST ${candidateUrl} status ${res.status}`);
      }
    } catch (err: any) {
      errors.push(`POST ${candidateUrl} failed: ${err.message || err}`);
      continue;
    }
  }

  throw new Error(`ObscuraWorks failed: ${errors.join(" | ")}`);
}

export async function createAiChatCompletion(options: AiChatCompletionOptions): Promise<AiChatCompletionResult> {
  const config = getProviderConfig(options.model);

  // Try primary provider (ObscuraWorks)
  if (config.provider === "obscuraworks") {
    return await createObscuraWorksCompletion(config, options);
  }

  // Final fallback: generic OpenAI-compat with AI_BASE_URL/AI_API_KEY
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  const body: Record<string, unknown> = { model: config.model, messages: options.messages };
  if (typeof options.maxTokens === "number") body.max_tokens = options.maxTokens;
  const urls = [getChatCompletionsUrl(config.baseUrl)];
  type CompletionsData = { choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }> };
  let data: CompletionsData | null = null;
  let lastError = "";
  for (const url of urls) {
    try {
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
      if (res.ok) { data = (await res.json()) as CompletionsData; break; }
      lastError = `${config.provider} API error (${res.status}) at ${url}`;
      if (res.status !== 404) break;
    } catch { continue; }
  }
  if (data) {
    const rawContent = data.choices?.[0]?.message?.content;
    const content = Array.isArray(rawContent) ? rawContent.map((p) => p.text ?? "").join("").trim() : (rawContent ?? "").trim();
    if (content) return { content, model: config.model, modelLabel: getModelLabel(config.model), provider: config.provider };
  }
  throw new Error(lastError || `${config.provider} API error: no response`);
}

