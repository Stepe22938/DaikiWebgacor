import { Router } from "express";
import dns from "dns";
import { Agent, setGlobalDispatcher } from "undici";

// Configure DNS-over-HTTPS (DoH) resolver
const resolveDoh = async (hostname: string): Promise<string | null> => {
  try {
    const res = await fetch(`https://1.1.1.1/dns-query?name=${encodeURIComponent(hostname)}&type=A`, {
      headers: { "accept": "application/dns-json" }
    });
    if (res.ok) {
      const data: any = await res.json();
      if (data.Answer && data.Answer.length > 0) {
        // Find the first type 1 (A record) answer
        const aRecord = data.Answer.find((ans: any) => ans.type === 1);
        if (aRecord && aRecord.data) {
          return aRecord.data;
        }
      }
    }
  } catch (e) {
    console.error(`[Manga DoH Error] Failed resolving ${hostname}:`, e);
  }
  return null;
};

// Create custom agent that resolves DNS via DoH
const customDnsAgent = new Agent({
  connect: {
    lookup: (hostname, options, callback) => {
      resolveDoh(hostname).then((ip) => {
        if (ip) {
          console.log(`[Manga DNS DoH] Resolved ${hostname} to ${ip} (options: ${JSON.stringify(options)})`);
          if (options.all) {
            return callback(null, [{ address: ip, family: 4 }]);
          } else {
            return callback(null, ip, 4);
          }
        }
        dns.lookup(hostname, options, (lookupErr, address, family) => {
          callback(lookupErr, address, family);
        });
      });
    }
  }
});

// Set global dispatcher so native fetch uses our DNS agent
setGlobalDispatcher(customDnsAgent);

const mangaRouter = Router();

// Proxy API requests to api.mangadex.org
mangaRouter.get("/manga/api/*path", async (req: any, res: any) => {
  const pathParam = req.params.path;
  const path = Array.isArray(pathParam) ? pathParam.join("/") : pathParam;
  // Use req.originalUrl to preserve raw query string with proper encoding (e.g. %5B%5D for [])
  const originalUrl = req.originalUrl;
  const queryStart = originalUrl.indexOf("?");
  const query = queryStart !== -1 ? originalUrl.slice(queryStart + 1) : "";
  const targetUrl = `https://api.mangadex.org/${path}${query ? "?" + query : ""}`;
  
  console.log(`[Manga Proxy API] Requesting: ${targetUrl}`);
  
  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "ArcadiaManga/1.0 (contact: info@arcadiamc.net)",
        "Accept": "application/json"
      }
    });
    
    console.log(`[Manga Proxy API] Response status: ${response.status}`);
    
    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Manga Proxy API] Error details: ${errText}`);
      return res.status(response.status).json({ error: `MangaDex API error: ${response.statusText}`, details: errText });
    }
    
    const data = await response.json();
    res.set("Cache-Control", "no-store"); // Always serve fresh from MangaDex
    res.json(data);
  } catch (error: any) {
    console.error(`[Manga Proxy API] Error:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Proxy CDN image requests to uploads.mangadex.org
mangaRouter.get("/manga/cdn/*path", async (req: any, res: any) => {
  const pathParam = req.params.path;
  const path = Array.isArray(pathParam) ? pathParam.join("/") : pathParam;
  const targetUrl = `https://uploads.mangadex.org/${path}`;
  
  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "ArcadiaManga/1.0 (contact: info@arcadiamc.net)"
      }
    });
    
    if (!response.ok) {
      return res.status(response.status).send(`Failed to fetch CDN image: ${response.statusText}`);
    }
    
    const contentType = response.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400"); // images cached 1 day
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).send("Error proxying CDN image");
  }
});

// ─── Multi-source Rating Aggregator ───────────────────────────────────────────
// Aggregates rating from MangaDex Statistics, AniList GraphQL, and Kitsu REST API
// Returns combined weighted score (MangaDex×3, AniList×2, Kitsu×1) on a 0–10 scale
mangaRouter.get("/manga/score/:mangaId", async (req: any, res: any) => {
  const { mangaId } = req.params;
  const title = req.query.title as string | undefined;

  interface RatingSource {
    source: string;
    score: number;      // raw score from the source
    maxScore: number;   // max possible score for that source
    normalized: number; // converted to 0–10 scale
    url: string;        // link to the manga on that platform
  }

  const results: RatingSource[] = [];

  await Promise.allSettled([
    // ── Source 1: MangaDex Statistics ─────────────────────────────────────────
    // Uses Bayesian average (accounts for number of raters), native 0–10 scale
    (async () => {
      try {
        const r = await fetch(
          `https://api.mangadex.org/statistics/manga/${mangaId}`,
          { headers: { "User-Agent": "ArcadiaManga/1.0", "Accept": "application/json" } }
        );
        if (!r.ok) return;
        const d = await r.json();
        const bayesian: number = d?.statistics?.[mangaId]?.rating?.bayesian;
        if (bayesian && bayesian > 0) {
          results.push({
            source: "MangaDex",
            score: Math.round(bayesian * 10) / 10,
            maxScore: 10,
            normalized: Math.round(bayesian * 10) / 10,
            url: `https://mangadex.org/title/${mangaId}`
          });
        }
      } catch (e) {
        console.error("[Score] MangaDex error:", e);
      }
    })(),

    // ── Source 2: AniList GraphQL ──────────────────────────────────────────────
    // Free public API, score is 0–100, normalized to 0–10
    title ? (async () => {
      try {
        const query = `query($s:String){Media(search:$s,type:MANGA){averageScore siteUrl}}`;
        const r = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ query, variables: { s: title } })
        });
        if (!r.ok) return;
        const d = await r.json();
        const score: number = d?.data?.Media?.averageScore;
        const siteUrl: string = d?.data?.Media?.siteUrl || "https://anilist.co";
        if (score && score > 0) {
          results.push({
            source: "AniList",
            score,
            maxScore: 100,
            normalized: Math.round((score / 10) * 10) / 10,
            url: siteUrl
          });
        }
      } catch (e) {
        console.error("[Score] AniList error:", e);
      }
    })() : Promise.resolve(),

    // ── Source 3: Kitsu REST API ───────────────────────────────────────────────
    // Free public API, averageRating is 0–100, normalized to 0–10
    title ? (async () => {
      try {
        const r = await fetch(
          `https://kitsu.io/api/edge/manga?filter[text]=${encodeURIComponent(title)}&page[limit]=1`,
          { headers: { "Accept": "application/vnd.api+json" } }
        );
        if (!r.ok) return;
        const d = await r.json();
        const avg: string = d?.data?.[0]?.attributes?.averageRating;
        const slug: string = d?.data?.[0]?.attributes?.slug || "";
        if (avg && parseFloat(avg) > 0) {
          const score = parseFloat(avg);
          results.push({
            source: "Kitsu",
            score,
            maxScore: 100,
            normalized: Math.round((score / 10) * 10) / 10,
            url: `https://kitsu.io/manga/${slug}`
          });
        }
      } catch (e) {
        console.error("[Score] Kitsu error:", e);
      }
    })() : Promise.resolve(),
  ]);

  // ── Weighted Average ─────────────────────────────────────────────────────────
  // MangaDex = weight 3 (most reliable for manga specifically)
  // AniList  = weight 2 (large community, well-maintained)
  // Kitsu    = weight 1 (smaller but credible)
  const weights: Record<string, number> = { MangaDex: 3, AniList: 2, Kitsu: 1 };
  let weightedSum = 0;
  let totalWeight = 0;
  for (const r of results) {
    const w = weights[r.source] ?? 1;
    weightedSum += r.normalized * w;
    totalWeight += w;
  }

  const combined = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : null;

  // Human-readable verdict
  const label =
    combined === null    ? "N/A"
    : combined >= 9.0   ? "Masterpiece"
    : combined >= 8.0   ? "Great"
    : combined >= 7.0   ? "Good"
    : combined >= 6.0   ? "Average"
    : combined >= 5.0   ? "Below Average"
    : "Poor";

  // Cache 1 hour (scores don't change rapidly)
  res.set("Cache-Control", "public, max-age=3600");
  res.json({ sources: results, combined, label, totalSources: results.length });
});

export default mangaRouter;
