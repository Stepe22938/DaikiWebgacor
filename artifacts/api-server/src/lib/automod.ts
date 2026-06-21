/**
 * Zaidan AI Auto-Moderation System
 * ──────────────────────────────────
 * Scans every incoming message for:
 *  1. NSFW / adult / pornographic links
 *  2. Scam giveaway patterns (MrBeast-style "follow to get $X")
 *  3. Discord invite spam / redirect links to external communities
 *  4. Known malware / phishing domains
 *
 * When flagged → auto-deletes message + kicks user from group + sends system warning
 */

import fs from "node:fs";
import path from "node:path";
import { getDriveDownloadResponse } from "./googleDrive";
import { createAiChatCompletion, createAiVisionCompletion, type AiVisionMessage } from "./aiProvider";


// ─── PATTERN BANKS ──────────────────────────────────────────────────────────

/** Known adult / NSFW domain keywords */
const NSFW_DOMAINS = [
  "pornhub", "xvideos", "xnxx", "xhamster", "redtube", "youporn",
  "tube8", "beeg", "porn", "xxx", "onlyfans", "fapello", "erome",
  "hentai", "rule34", "nhentai", "danbooru", "gelbooru", "e621",
  "motherless", "spankbang", "thisvid", "nudostar", "coomer",
  "bdsmlr", "empflix", "drtuber", "4tube", "fux", "keezmovies",
  "slutload", "tnaflix", "txxx",
];

/** Scam giveaway keyword patterns */
const SCAM_PATTERNS = [
  /follow\s+.{0,30}(get|win|earn|claim|receive)\s+.{0,20}(\$|usd|dollar|rp|rupiah|free)/i,
  /(mr\s?beast|mrbeast)/i,
  /free\s+(nitro|robux|vbucks|v-bucks|steam|amazon|gift\s*card)/i,
  /(win|give\s*away|giveaway).{0,40}(\$\d+|free)/i,
  /click\s+.{0,20}link.{0,20}(claim|get|win|free)/i,
  /\d+\s*(follower|subscriber|sub).{0,30}(giveaway|free|win)/i,
  /earn\s+(\$|usd|rp)\s*\d+.{0,30}(day|hour|minute)/i,
  /crypto\s+(airdrop|giveaway|free)/i,
  /nft\s+(free|airdrop|giveaway|mint)/i,
  /telegram\.me.{0,30}(earn|free|bonus)/i,
  /join.{0,20}(telegram|tele|wa|whatsapp).{0,30}(\$|free|earn|bonus)/i,
  /congratulation.{0,50}winner/i,
  /you('ve)? been selected/i,
  /limited\s+offer.{0,30}(click|visit|join)/i,
];

/** Suspicious redirect / spam invite patterns */
const SPAM_PATTERNS = [
  /discord\.gg\/[a-z0-9]+/i,    // External Discord invite links
  /discordapp\.com\/invite\//i,
  /bit\.ly\//i,
  /tinyurl\.com\//i,
  /t\.co\//i,
  /rb\.gy\//i,
  /cutt\.ly\//i,
  /gg\/[a-z0-9]{5,}/i,
];

/** Domains absolutely safe to never flag (allowlist) */
const SAFE_DOMAINS = [
  "youtube.com", "youtu.be", "google.com", "github.com",
  "stackoverflow.com", "twitter.com", "x.com", "instagram.com",
  "discord.com", "roblox.com", "spotify.com", "twitch.tv",
];

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type AutomodResult =
  | { flagged: false }
  | { flagged: true; reason: string; category: "nsfw" | "scam" | "spam" | "ai_detected" };

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/gi;
  return text.match(urlRegex) ?? [];
}

function isSafeDomain(url: string): boolean {
  try {
    const hostname = new URL(url.startsWith("http") ? url : "https://" + url).hostname.toLowerCase();
    return SAFE_DOMAINS.some(safe => hostname === safe || hostname.endsWith("." + safe));
  } catch {
    return false;
  }
}

function checkNsfw(text: string, urls: string[]): boolean {
  const combined = (text + " " + urls.join(" ")).toLowerCase();
  return NSFW_DOMAINS.some(domain => combined.includes(domain));
}

function checkScam(text: string): boolean {
  return SCAM_PATTERNS.some(p => p.test(text));
}

function checkSpam(text: string, urls: string[]): boolean {
  const combined = text + " " + urls.join(" ");
  // External Discord invites (not our own server) are suspicious
  return SPAM_PATTERNS.some(p => p.test(combined));
}

function getMimeTypeFromExtension(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/png";
}

async function getImageDataUri(imageUrl: string): Promise<string | null> {
  try {
    // 1. Local Uploads
    if (imageUrl.startsWith("/uploads/")) {
      const isBundled = import.meta.dirname.endsWith("dist");
      const relativePath = isBundled
        ? "../../mc-roleplay/public/uploads"
        : "../../../mc-roleplay/public/uploads";
      const uploadDir = path.resolve(import.meta.dirname, relativePath);
      const filename = imageUrl.substring("/uploads/".length);
      const filePath = path.join(uploadDir, filename);

      const buffer = await fs.promises.readFile(filePath);
      const base64Data = buffer.toString("base64");
      const mimeType = getMimeTypeFromExtension(filename);
      return `data:${mimeType};base64,${base64Data}`;
    }

    // 2. Google Drive uploads
    const driveMatch = imageUrl.match(/\/api\/drive\/files\/([^\/]+)\/download/);
    if (driveMatch) {
      const fileId = decodeURIComponent(driveMatch[1]);
      const driveResponse = await getDriveDownloadResponse(fileId);
      if (driveResponse.ok && driveResponse.body) {
        const arrayBuffer = await driveResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Data = buffer.toString("base64");
        const mimeType = driveResponse.headers.get("content-type") || "image/png";
        return `data:${mimeType};base64,${base64Data}`;
      }
    }

    // 3. Remote URL fallback
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      const res = await fetch(imageUrl);
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Data = buffer.toString("base64");
        const mimeType = res.headers.get("content-type") || "image/png";
        return `data:${mimeType};base64,${base64Data}`;
      }
    }
  } catch (err) {
    console.error("[Automod] Failed to resolve image to base64 Data URI:", err);
  }
  return null;
}

// ─── URL SAFETY ANALYSIS UTILITIES ──────────────────────────────────────────

export type UrlAnalysisReport = {
  url: string;
  domain: string;
  dnsStatus: { blocked: boolean; reason?: string };
  urlscan?: { domainAgeDays?: number; title?: string; server?: string; status?: number } | null;
  meta?: { title?: string; description?: string; finalUrl?: string; error?: string };
};

async function checkDnsBlock(domain: string): Promise<{ blocked: boolean; reason?: string }> {
  try {
    const res = await fetch(`https://family.cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`, {
      headers: { "accept": "application/dns-json" },
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json() as any;
      const isBlocked = data.Answer?.some((ans: any) => ans.data === "0.0.0.0" || ans.data === "::");
      if (isBlocked) {
        return { blocked: true, reason: "Cloudflare Family DNS flagged/blocked this domain (NSFW/Adult content or malicious)" };
      }
    }
  } catch (err: any) {
    console.error(`[Automod] DNS block check failed for ${domain}:`, err.message);
  }
  return { blocked: false };
}

async function checkUrlscan(domain: string): Promise<UrlAnalysisReport["urlscan"] | null> {
  try {
    const res = await fetch(`https://urlscan.io/api/v1/search/?q=domain:${encodeURIComponent(domain)}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = await res.json() as any;
      if (data.results && data.results.length > 0) {
        const first = data.results[0];
        return {
          domainAgeDays: first.page?.domainAgeDays || first.page?.apexDomainAgeDays,
          title: first.page?.title,
          server: first.page?.server,
          status: Number(first.page?.status) || undefined,
        };
      }
    }
  } catch (err: any) {
    console.error(`[Automod] Urlscan check failed for ${domain}:`, err.message);
  }
  return null;
}

async function fetchPageMeta(url: string): Promise<UrlAnalysisReport["meta"]> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });

    const finalUrl = response.url;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return { finalUrl };
    }

    const text = await response.text();
    const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    const descMatch = text.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i) ||
                      text.match(/<meta[^>]+content="([^"]+)"[^>]+name="description"/i);
    const description = descMatch ? descMatch[1].trim() : undefined;

    return { title, description, finalUrl };
  } catch (err: any) {
    return { error: err.message };
  }
}

async function analyzeUrl(url: string): Promise<UrlAnalysisReport | null> {
  try {
    let cleanUrl = url;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      cleanUrl = "https://" + url;
    }
    const hostname = new URL(cleanUrl).hostname.toLowerCase();

    const dnsStatus = await checkDnsBlock(hostname);
    const urlscan = await checkUrlscan(hostname);
    const meta = await fetchPageMeta(cleanUrl);

    return {
      url,
      domain: hostname,
      dnsStatus,
      urlscan,
      meta,
    };
  } catch (err: any) {
    console.error(`[Automod] Failed to analyze url ${url}:`, err.message);
    return null;
  }
}

// ─── MAIN AUTOMOD FUNCTION ───────────────────────────────────────────────────

/**
 * Scans a message for violations.
 * Fast path: regex-based pattern matching (synchronous-ish, no API call).
 * Slow path: AI classification for borderline/ambiguous content (and all image attachments).
 */
export async function runAutomod(content: string, imageUrl?: string | null): Promise<AutomodResult> {
  if (!content && !imageUrl) return { flagged: false };

  const text = content ?? "";
  const urls = extractUrls(text);

  // Skip messages from safe domains entirely (only if there is no image)
  const allSafe = urls.length > 0 && urls.every(isSafeDomain);
  if (allSafe && !checkScam(text) && !imageUrl) return { flagged: false };

  // ── Fast pattern checks ──────────────────────────────────────────────────
  if (checkNsfw(text, urls)) {
    return { flagged: true, reason: "Konten dewasa/NSFW terdeteksi", category: "nsfw" };
  }

  if (checkScam(text)) {
    return { flagged: true, reason: "Pola scam/giveaway palsu terdeteksi", category: "scam" };
  }

  if (checkSpam(text, urls)) {
    return { flagged: true, reason: "Spam/invite link eksternal terdeteksi", category: "spam" };
  }

  // ── AI classification for borderline content / image attachments ─────────
  const hasUrl = urls.length > 0;
  const hasImage = !!imageUrl;
  const mightBeSuspicious = hasUrl || text.length > 30 || hasImage;

  if (!mightBeSuspicious) return { flagged: false };

  // Analyze URLs first if present to feed safe/malicious metadata to the AI model
  const analysisReports: UrlAnalysisReport[] = [];
  if (urls.length > 0) {
    for (const url of urls) {
      if (analysisReports.some(r => r.url === url)) continue;
      const report = await analyzeUrl(url);
      if (report) analysisReports.push(report);
    }
  }

  try {
    let aiResponseContent = "";

    // If there is an image, resolve it and analyze with vision model
    if (imageUrl) {
      const imageDataUri = await getImageDataUri(imageUrl);
      if (imageDataUri) {
        const messages: AiVisionMessage[] = [
          {
            role: "system",
            content: `You are a content moderation AI. Analyze the text content and the attached image, and reply with ONLY a JSON object:
{"flagged": boolean, "category": "nsfw"|"scam"|"spam"|"safe", "reason": "short reason in Indonesian"}

Flag the message (flagged: true) if it contains:
- NSFW / pornographic / adult content / nudity (in text or image)
- Scam giveaways (like MrBeast-style "follow to get $1000", scan QR to get free money, fake nitro/robux giveaways)
- Phishing, malware, or suspicious redirect links
- Invitations to join suspicious external communities or chats promising free stuff / money

If the message and image are safe and normal, reply with flagged: false and category: "safe".`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Message text: "${text.slice(0, 500)}"
${analysisReports.length > 0 ? `\nURL Analysis Reports:\n${JSON.stringify(analysisReports, null, 2)}` : ""}`,
              },
              {
                type: "image_url",
                image_url: {
                  url: imageDataUri,
                },
              },
            ],
          },
        ];

        const aiResult = await createAiVisionCompletion({
          messages,
          model: "gpt-4o",
          maxTokens: 150,
        });
        aiResponseContent = aiResult.content ?? "";
      }
    }

    // Fallback to text completion if no image was resolved/analyzed
    if (!aiResponseContent) {
      const aiResult = await createAiChatCompletion({
        messages: [
          {
            role: "system",
            content: `You are a content moderation AI. Analyze the following message and reply with ONLY a JSON object:
{"flagged": boolean, "category": "nsfw"|"scam"|"spam"|"safe", "reason": "short reason in Indonesian"}

Flag the message if it contains:
- Links or references to adult/pornographic content
- Scam giveaways ("follow to get money/free stuff", MrBeast-style fraud)
- Suspicious redirect links or phishing URLs
- Invitations to join external communities with suspicious promises

Do NOT flag normal conversation, news, or safe links.`,
          },
          {
            role: "user",
            content: `Message to check: "${text.slice(0, 500)}"
${analysisReports.length > 0 ? `\nURL Analysis Reports:\n${JSON.stringify(analysisReports, null, 2)}` : ""}`,
          },
        ],
        maxTokens: 120,
      });
      aiResponseContent = aiResult.content ?? "";
    }

    const raw = aiResponseContent.trim();
    // Extract JSON even if AI wraps it in markdown
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.flagged === true && parsed.category !== "safe") {
        return {
          flagged: true,
          reason: parsed.reason ?? "Konten mencurigakan terdeteksi oleh AI",
          category: parsed.category as "nsfw" | "scam" | "spam" | "ai_detected",
        };
      }
    }
  } catch (err) {
    console.error("[Automod] AI vision/classification failed:", err);
  }

  return { flagged: false };
}


// ─── SYSTEM MESSAGE TEMPLATES ────────────────────────────────────────────────

export function buildAutomodSystemMessage(
  username: string,
  category: "nsfw" | "scam" | "spam" | "ai_detected",
  reason: string,
): string {
  const emoji = {
    nsfw: "🔞",
    scam: "🚨",
    spam: "⚠️",
    ai_detected: "🤖",
  }[category];

  const action = {
    nsfw: "dikick karena mengirim konten dewasa/NSFW",
    scam: "dikick karena mengirim link scam/penipuan",
    spam: "dikick karena mengirim spam atau invite link mencurigakan",
    ai_detected: "dikick karena konten yang melanggar aturan",
  }[category];

  return `${emoji} **[AUTOMOD]** @${username} telah ${action}.\n📋 Alasan: ${reason}\n\n_Pesan mereka telah dihapus secara otomatis oleh Zaidan AI._`;
}
