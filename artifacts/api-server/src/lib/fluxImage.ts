import fs from "node:fs";
import path from "node:path";

function cleanImagePrompt(message: string) {
  return message
    .replace(/@zaidan\s*ai/gi, "")
    .replace(/@zaidanai/gi, "")
    .replace(/@ai/gi, "")
    .replace(/\b(tolong|please|pls|dong|coba|nih|ya|yah)\b/gi, "")
    .replace(/\b(buatkan|buatin|buat|bikin|generate|create|gambar(?:kan)?|draw|desain|design|foto|image|picture|ilustrasi)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isImageGenerationRequest(message: string) {
  const lower = message.toLowerCase();
  const hasImageWord = /\b(gambar|image|foto|picture|wallpaper|poster|logo|ilustrasi|art|draw|drawing)\b/.test(lower);
  const hasGenerateWord = /\b(buat|buatin|buatkan|bikin|generate|create|desain|design|draw|gambarkan)\b/.test(lower);
  const hasVisualStyle = /\b(douyin|tiktok|anime|realistis|realistic|cinematic|wallpaper|poster|logo|avatar|karakter|character|style|aesthetic|keren|hd|4k|render)\b/.test(lower);
  const hasVisualSubject = /\b(kota|city|orang|manusia|cewek|cowok|kucing|anjing|mobil|motor|rumah|castle|kastil|naga|dragon|minecraft|pemandangan|landscape|gunung|pantai|ruangan|outfit|baju|skin)\b/.test(lower);
  return (hasImageWord && hasGenerateWord) || (hasGenerateWord && hasVisualSubject) || (hasVisualStyle && hasVisualSubject);
}

export function shouldAutoGenerateImageInAiDm(message: string) {
  const lower = message.toLowerCase();
  if (isImageGenerationRequest(message)) return true;
  if (/[?？]$/.test(lower)) return false;
  if (/^(halo|hai|hi|hello|p|test|tes|makasih|thanks|ok|oke)\b/.test(lower.trim())) return false;

  const hasVisualStyle = /\b(douyin|tiktok|anime|realistis|realistic|cinematic|wallpaper|poster|logo|avatar|karakter|character|style|aesthetic|hd|4k|render)\b/.test(lower);
  const hasVisualSubject = /\b(kota|city|orang|manusia|cewek|cowok|kucing|anjing|mobil|motor|rumah|castle|kastil|naga|dragon|minecraft|pemandangan|landscape|gunung|pantai|ruangan|outfit|baju|skin)\b/.test(lower);
  return hasVisualStyle && hasVisualSubject;
}

export function buildFluxImageUrl(message: string) {
  const prompt = cleanImagePrompt(message) || message.replace(/@zaidan\s*ai|@zaidanai|@ai/gi, "").trim();
  const baseUrl = (process.env.FLUX_IMAGE_BASE_URL || "https://image.pollinations.ai/prompt").replace(/\/+$/, "");
  const width = process.env.FLUX_IMAGE_WIDTH || "1024";
  const height = process.env.FLUX_IMAGE_HEIGHT || "1024";
  const seed = Math.floor(Math.random() * 1_000_000_000).toString();
  const url = new URL(`${baseUrl}/${encodeURIComponent(prompt)}`);

  url.searchParams.set("model", process.env.FLUX_IMAGE_MODEL || "flux");
  url.searchParams.set("width", width);
  url.searchParams.set("height", height);
  url.searchParams.set("seed", seed);
  url.searchParams.set("nologo", "true");

  return {
    prompt,
    imageUrl: url.toString(),
  };
}

function getUploadDir() {
  const isBundled = import.meta.dirname.endsWith("dist");
  const relativePath = isBundled
    ? "../../mc-roleplay/public/uploads"
    : "../../../mc-roleplay/public/uploads";
  return path.resolve(import.meta.dirname, relativePath);
}

function getExtension(contentType: string | null) {
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("webp")) return "webp";
  return "jpg";
}

export async function generateFluxImage(message: string) {
  const primary = buildFluxImageUrl(message);
  const candidates = [
    primary.imageUrl,
    primary.imageUrl.replace(/[?&]model=flux&?/, "?").replace("?&", "?"),
  ];
  let lastError = "";

  for (const imageUrl of Array.from(new Set(candidates))) {
    const res = await fetch(imageUrl);
    const contentType = res.headers.get("content-type");
    const bytes = Buffer.from(await res.arrayBuffer());

    if (res.ok && contentType?.startsWith("image/")) {
      const uploadDir = getUploadDir();
      await fs.promises.mkdir(uploadDir, { recursive: true });
      const fileName = `ai-flux-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${getExtension(contentType)}`;
      await fs.promises.writeFile(path.join(uploadDir, fileName), bytes);
      return {
        prompt: primary.prompt,
        imageUrl: `/uploads/${fileName}`,
      };
    }

    const text = bytes.toString("utf8").slice(0, 240);
    lastError = `${res.status} ${contentType ?? "unknown"} ${text}`;
  }

  throw new Error(`Flux AI image failed: ${lastError}`);
}
