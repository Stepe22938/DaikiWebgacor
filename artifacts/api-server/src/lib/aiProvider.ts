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
    "https://api.obscuraworks.com/v1";

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
  const url = new URL(`${config.baseUrl}/api/ai/groq`);
  url.searchParams.set("prompt", messagesToPrompt(options.messages));
  url.searchParams.set("model", config.model);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "x-api-key": config.apiKey,
    },
  });

  const payload = (await res.json().catch(async () => ({ error: await res.text() }))) as {
    status?: boolean;
    data?: string;
    error?: string | null;
    message?: string;
  };

  if (!res.ok || payload.status === false) {
    throw new Error(`obscuraworks API error (${res.status}): ${payload.message || payload.error || "Unknown error"}`);
  }

  return {
    content: (payload.data ?? "").trim(),
    model: config.model,
    modelLabel: getModelLabel(config.model),
    provider: config.provider,
  };
}

export async function createAiChatCompletion(options: AiChatCompletionOptions): Promise<AiChatCompletionResult> {
  const config = getProviderConfig(options.model);
  if (config.provider === "obscuraworks") {
    return createObscuraWorksCompletion(config, options);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  const body: Record<string, unknown> = {
    model: config.model,
    messages: options.messages,
  };

  if (typeof options.maxTokens === "number") {
    body.max_tokens = options.maxTokens;
  }

  const urls = config.provider === "obscuraworks"
    ? getObscuraWorksCandidateUrls(config.baseUrl)
    : [getChatCompletionsUrl(config.baseUrl)];
  let data: {
    choices?: Array<{
      message?: {
        content?: string | Array<{ text?: string; type?: string }>;
      };
    }>;
  } | null = null;
  let lastError = "";

  for (const url of urls) {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (res.ok) {
      data = (await res.json()) as {
        choices?: Array<{
          message?: {
            content?: string | Array<{ text?: string; type?: string }>;
          };
        }>;
      };
      break;
    }

    const errorText = await res.text();
    lastError = `${config.provider} API error (${res.status}) at ${url}: ${errorText}`;
    if (res.status !== 404) break;
  }

  if (!data) {
    throw new Error(lastError || `${config.provider} API error: no response`);
  }
  const rawContent = data.choices?.[0]?.message?.content;
  const content = Array.isArray(rawContent)
    ? rawContent.map((part) => part.text ?? "").join("").trim()
    : (rawContent ?? "").trim();

  return {
    content,
    model: config.model,
    modelLabel: getModelLabel(config.model),
    provider: config.provider,
  };
}
