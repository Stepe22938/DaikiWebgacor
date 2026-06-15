import { Router, type IRouter } from "express";
import { db, musicTable } from "@workspace/db";
import { eq, ilike, or, gte, desc } from "drizzle-orm";
import { getAuth } from "../lib/auth";
import { usersTable } from "@workspace/db";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Readable } from "node:stream";

const router: IRouter = Router();
const execFileAsync = promisify(execFile);

// ─── Stream Cache for Audio Proxying ─────────────────────────────────────────
const streamCache = new Map<string, { url: string; expires: number; key?: string }>();

// ─── Spotify Token Cache ─────────────────────────────────────────────────────
let spotifyTokenCache: { token: string; expiresAt: number } | null = null;

async function getSpotifyAccessToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (spotifyTokenCache && Date.now() < spotifyTokenCache.expiresAt - 60_000) {
    return spotifyTokenCache.token;
  }

  try {
    const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token: string; expires_in: number };
    spotifyTokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    return spotifyTokenCache.token;
  } catch {
    return null;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getMusicDir(): string {
  const isBundled = import.meta.dirname.endsWith("dist");
  const rel = isBundled
    ? "../../mc-roleplay/public/music"
    : "../../../mc-roleplay/public/music";
  const dir = path.resolve(import.meta.dirname, rel);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getCoversDir(): string {
  const isBundled = import.meta.dirname.endsWith("dist");
  const rel = isBundled
    ? "../../mc-roleplay/public/covers"
    : "../../../mc-roleplay/public/covers";
  const dir = path.resolve(import.meta.dirname, rel);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function getDbUser(clerkId: string) {
  return db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) });
}

function requireAdmin(req: any, res: any): Promise<boolean> {
  return new Promise(async (resolve) => {
    const auth = getAuth(req);
    if (!auth.userId) {
      res.status(401).json({ message: "Unauthorized" });
      return resolve(false);
    }
    const user = await getDbUser(auth.userId);
    if (!user || user.role !== "admin") {
      res.status(403).json({ message: "Admin only." });
      return resolve(false);
    }
    resolve(true);
  });
}

function formatMsToMinSec(ms: number) {
  if (!ms) return "0:00";
  const totalSecs = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSecs / 60);
  const seconds = totalSecs % 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

// ─── Multer setup ────────────────────────────────────────────────────────────

const audioStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, getMusicDir()),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".mp3";
    const name = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`;
    cb(null, name);
  },
});
const coverStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, getCoversDir()),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    const name = `cover-${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`;
    cb(null, name);
  },
});

const uploadAudio = multer({ storage: audioStorage, limits: { fileSize: 50 * 1024 * 1024 } });
const uploadCover = multer({ storage: coverStorage, limits: { fileSize: 5 * 1024 * 1024 } });

// ─── Public Routes ───────────────────────────────────────────────────────────

/** GET /api/music/tracks — list all or search tracks */
router.get("/music/tracks", async (req, res): Promise<void> => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const type = typeof req.query.type === "string" ? req.query.type.trim() : "";
  
  const token = await getSpotifyAccessToken();
  if (!token) {
    res.status(503).json({ message: "Spotify API tidak tersedia. Set SPOTIFY_CLIENT_ID dan SPOTIFY_CLIENT_SECRET di .env" });
    return;
  }

  try {
    let spotifyQuery = query || type || "Global Charts";
    if (spotifyQuery === "All Tracks") {
      spotifyQuery = "Global Top Hits";
    }

    const limit = 10;
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(spotifyQuery)}&type=track&limit=${limit}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) {
      const err = await resp.text();
      res.status(resp.status).json({ message: "Spotify search gagal", detail: err });
      return;
    }
    const data = (await resp.json()) as {
      tracks?: {
        items: Array<{
          id: string;
          name: string;
          artists: Array<{ name: string }>;
          album: { name: string; images: Array<{ url: string }> };
          duration_ms: number;
          external_urls: { spotify: string };
          preview_url: string | null;
        }>;
      };
    };

    const items = data.tracks?.items || [];
    const results = items.map((t) => ({
      id: t.id,
      title: t.name,
      artist: t.artists.map((a) => a.name).join(", "),
      album: t.album.name,
      cover: t.album.images[0]?.url || "/village.png",
      duration: formatMsToMinSec(t.duration_ms),
      file: "",
      type: type || "Global Charts",
      createdAt: new Date().toISOString(),
    }));

    res.json(results);
  } catch (error: any) {
    req.log?.error({ err: error }, "Spotify search failed");
    res.status(500).json({ message: "Spotify search gagal.", detail: error?.message || String(error) });
  }
});

/** GET /api/music/tracks/new-releases — tracks added in last 7 days OR type="Rilis Hari Ini" */
router.get("/music/tracks/new-releases", async (req, res): Promise<void> => {
  const token = await getSpotifyAccessToken();
  if (!token) {
    res.status(503).json({ message: "Spotify API tidak tersedia." });
    return;
  }

  try {
    const url = `https://api.spotify.com/v1/search?q=tag:new&type=track&limit=10`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    let data;
    if (!resp.ok) {
      const fallbackUrl = `https://api.spotify.com/v1/search?q=New%20Releases&type=track&limit=10`;
      const fallbackResp = await fetch(fallbackUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (!fallbackResp.ok) {
        res.status(fallbackResp.status).json({ message: "Spotify search failed" });
        return;
      }
      data = await fallbackResp.json();
    } else {
      data = await resp.json();
    }

    const items = (data as any).tracks?.items || [];
    const results = items.map((t: any) => ({
      id: t.id,
      title: t.name,
      artist: t.artists.map((a: any) => a.name).join(", "),
      album: t.album.name,
      cover: t.album.images[0]?.url || "/village.png",
      duration: formatMsToMinSec(t.duration_ms),
      file: "",
      type: "Rilis Hari Ini",
      createdAt: new Date().toISOString(),
    }));

    res.json(results);
  } catch (error: any) {
    res.status(500).json({ message: "Failed to fetch new releases from Spotify.", detail: error?.message || String(error) });
  }
});

/** GET /api/music/categories — distinct types in DB */
router.get("/music/categories", async (req, res) => {
  res.json([
    "Global Charts",
    "Rilis Hari Ini",
    "Lofi & Chill",
    "Pop Hits",
    "Synthwave Hits",
    "Lobby Favorites",
    "Combat & Adventure",
    "Tavern Classics",
    "Hip Hop",
    "EDM",
    "R&B",
    "Indie",
    "K-Pop",
    "OST"
  ]);
});

// ─── Admin Routes ─────────────────────────────────────────────────────────────

/** POST /api/music/admin/track — add a new track manually */
router.post("/music/admin/track", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  const { title, artist, album, file, cover, duration, type, releaseDate } = req.body ?? {};
  if (!title || !artist || !file || !cover || !duration) {
    res.status(400).json({ message: "title, artist, file, cover, duration are required." });
    return;
  }

  try {
    const [track] = await db
      .insert(musicTable)
      .values({
        title: String(title),
        artist: String(artist),
        album: String(album || ""),
        file: String(file),
        cover: String(cover),
        duration: String(duration),
        type: String(type || "Global Charts"),
        releaseDate: String(releaseDate || ""),
      })
      .returning();
    res.status(201).json(track);
  } catch (error) {
    req.log?.error({ err: error }, "Failed to add track");
    res.status(500).json({ message: "Failed to add track." });
  }
});

/** PUT /api/music/admin/track/:id — update track metadata */
router.put("/music/admin/track/:id", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid track id." }); return; }

  const { title, artist, album, file, cover, duration, type, releaseDate } = req.body ?? {};

  const updates: Record<string, string> = {};
  if (title !== undefined) updates.title = String(title);
  if (artist !== undefined) updates.artist = String(artist);
  if (album !== undefined) updates.album = String(album);
  if (file !== undefined) updates.file = String(file);
  if (cover !== undefined) updates.cover = String(cover);
  if (duration !== undefined) updates.duration = String(duration);
  if (type !== undefined) updates.type = String(type);
  if (releaseDate !== undefined) updates.releaseDate = String(releaseDate);

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ message: "No fields to update." });
    return;
  }

  try {
    const [updated] = await db
      .update(musicTable)
      .set(updates)
      .where(eq(musicTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ message: "Track not found." }); return; }
    res.json(updated);
  } catch (error) {
    req.log?.error({ err: error }, "Failed to update track");
    res.status(500).json({ message: "Failed to update track." });
  }
});

/** DELETE /api/music/admin/track/:id — delete track from DB + file */
router.delete("/music/admin/track/:id", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid track id." }); return; }

  try {
    const [track] = await db
      .delete(musicTable)
      .where(eq(musicTable.id, id))
      .returning();

    if (!track) { res.status(404).json({ message: "Track not found." }); return; }

    // Try to delete local file (only if it's a relative /music/ path)
    if (track.file && track.file.startsWith("/music/")) {
      const filename = path.basename(track.file);
      const filePath = path.join(getMusicDir(), filename);
      try { fs.unlinkSync(filePath); } catch {}
    }
    if (track.cover && track.cover.startsWith("/covers/")) {
      const filename = path.basename(track.cover);
      const filePath = path.join(getCoversDir(), filename);
      try { fs.unlinkSync(filePath); } catch {}
    }

    res.json({ ok: true, deleted: track });
  } catch (error) {
    req.log?.error({ err: error }, "Failed to delete track");
    res.status(500).json({ message: "Failed to delete track." });
  }
});

/** POST /api/music/admin/upload-audio — upload audio file directly */
router.post(
  "/music/admin/upload-audio",
  (req, res, next) => {
    requireAdmin(req, res).then((ok) => { if (ok) next(); });
  },
  uploadAudio.single("audio"),
  (req: any, res: any) => {
    if (!req.file) {
      res.status(400).json({ message: "No audio file provided." });
      return;
    }
    res.json({ url: `/music/${req.file.filename}`, filename: req.file.filename });
  }
);

/** POST /api/music/admin/upload-cover — upload cover image */
router.post(
  "/music/admin/upload-cover",
  (req, res, next) => {
    requireAdmin(req, res).then((ok) => { if (ok) next(); });
  },
  uploadCover.single("cover"),
  (req: any, res: any) => {
    if (!req.file) {
      res.status(400).json({ message: "No cover file provided." });
      return;
    }
    res.json({ url: `/covers/${req.file.filename}`, filename: req.file.filename });
  }
);

/** POST /api/music/admin/download — download audio from URL via yt-dlp */
router.post("/music/admin/download", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  const { url, title, artist, album, cover, type, releaseDate } = req.body ?? {};
  if (!url || !title || !artist) {
    res.status(400).json({ message: "url, title, artist are required." });
    return;
  }

  const musicDir = getMusicDir();
  const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.mp3`;
  const outputPath = path.join(musicDir, filename);

  try {
    // Try yt-dlp first, fallback to youtube-dl
    const ytDlpCmd = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
    await execFileAsync(ytDlpCmd, [
      "-x",
      "--audio-format", "mp3",
      "--audio-quality", "0",
      "--no-playlist",
      "-o", outputPath,
      String(url),
    ], { timeout: 300_000 });

    // Get duration from file
    let duration = "3:00";
    try {
      const { stdout } = await execFileAsync("ffprobe", [
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        outputPath,
      ]);
      const secs = parseFloat(stdout.trim());
      if (!isNaN(secs)) duration = formatMsToMinSec(secs * 1000);
    } catch {}

    const [track] = await db
      .insert(musicTable)
      .values({
        title: String(title),
        artist: String(artist),
        album: String(album || ""),
        file: `/music/${filename}`,
        cover: String(cover || "/village.png"),
        duration,
        type: String(type || "Global Charts"),
        releaseDate: String(releaseDate || ""),
      })
      .returning();

    res.status(201).json({ ok: true, track });
  } catch (error: any) {
    // Clean up failed file
    try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch {}
    req.log?.error({ err: error }, "Download failed");
    res.status(500).json({
      message: "Download failed. Pastikan yt-dlp terinstall di server.",
      detail: error?.message || String(error),
    });
  }
});

// ─── Spotify Routes ────────────────────────────────────────────────────────────

/** GET /api/music/spotify/login — catch old OAuth redirect and send back to music tab */
router.get("/music/spotify/login", (req, res) => {
  const returnTo = typeof req.query.returnTo === "string" ? req.query.returnTo : "/member?tab=music";
  const referer = req.headers.referer || req.headers.origin || "";
  let redirectUrl = returnTo;
  if (referer) {
    try {
      const origin = new URL(referer).origin;
      redirectUrl = `${origin}${returnTo.startsWith("/") ? returnTo : "/" + returnTo}`;
    } catch {
      redirectUrl = returnTo;
    }
  }
  res.redirect(302, redirectUrl);
});

/** GET /api/music/spotify/callback — catch old OAuth callback and send back to music tab */
router.get("/music/spotify/callback", (req, res) => {
  const returnTo = typeof req.query.returnTo === "string" ? req.query.returnTo : "/member?tab=music";
  const referer = req.headers.referer || req.headers.origin || "";
  let redirectUrl = returnTo;
  if (referer) {
    try {
      const origin = new URL(referer).origin;
      redirectUrl = `${origin}${returnTo.startsWith("/") ? returnTo : "/" + returnTo}`;
    } catch {
      redirectUrl = returnTo;
    }
  }
  res.redirect(302, redirectUrl);
});

/** GET /api/music/spotify/search — search Spotify tracks */
router.get("/music/spotify/search", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) { res.status(400).json({ message: "Query parameter 'q' is required." }); return; }

  const token = await getSpotifyAccessToken();
  if (!token) {
    res.status(503).json({ message: "Spotify API tidak tersedia. Set SPOTIFY_CLIENT_ID dan SPOTIFY_CLIENT_SECRET di .env" });
    return;
  }

  try {
    const limit = Number(req.query.limit) || 10;
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=${Math.min(limit, 10)}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) {
      const err = await resp.text();
      res.status(resp.status).json({ message: "Spotify search gagal", detail: err });
      return;
    }
    const data = (await resp.json()) as {
      tracks: {
        items: Array<{
          id: string;
          name: string;
          artists: Array<{ name: string }>;
          album: { name: string; images: Array<{ url: string }> };
          duration_ms: number;
          external_urls: { spotify: string };
          preview_url: string | null;
        }>;
      };
    };

    const results = data.tracks.items.map((t) => ({
      spotifyId: t.id,
      title: t.name,
      artist: t.artists.map((a) => a.name).join(", "),
      album: t.album.name,
      cover: t.album.images[0]?.url || "",
      durationMs: t.duration_ms,
      duration: formatMsToMinSec(t.duration_ms),
      spotifyUrl: t.external_urls.spotify,
      previewUrl: t.preview_url,
    }));

    res.json(results);
  } catch (error: any) {
    req.log?.error({ err: error }, "Spotify search failed");
    res.status(500).json({ message: "Spotify search gagal.", detail: error?.message || String(error) });
  }
});

/** POST /api/music/spotify/download — download Spotify track audio via yt-dlp and save to DB */
router.post("/music/spotify/download", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  const { spotifyId, title, artist, album, cover, durationMs, type, releaseDate } = req.body ?? {};
  if (!title || !artist) {
    res.status(400).json({ message: "title dan artist wajib diisi." });
    return;
  }

  const musicDir = getMusicDir();
  const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.mp3`;
  const outputPath = path.join(musicDir, filename);

  // Build YouTube search query from Spotify metadata
  const ytSearchQuery = `${String(artist)} - ${String(title)} (audio)`;

  try {
    const ytDlpCmd = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";

    // If spotifyId is provided, try downloading from Spotify URL first (yt-dlp supports some Spotify URLs)
    // Otherwise, search YouTube using the track metadata
    const searchUrl = spotifyId
      ? `ytsearch1:${ytSearchQuery}`
      : `ytsearch1:${ytSearchQuery}`;

    await execFileAsync(ytDlpCmd, [
      "-x",
      "--audio-format", "mp3",
      "--audio-quality", "0",
      "--no-playlist",
      "-o", outputPath,
      searchUrl,
    ], { timeout: 300_000 });

    // Get actual duration from downloaded file
    let duration = durationMs ? formatMsToMinSec(Number(durationMs)) : "3:00";
    try {
      const { stdout } = await execFileAsync("ffprobe", [
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        outputPath,
      ]);
      const secs = parseFloat(stdout.trim());
      if (!isNaN(secs)) duration = formatMsToMinSec(secs * 1000);
    } catch {}

    // Download cover art from Spotify if it's a URL
    let coverPath = String(cover || "/village.png");
    if (coverPath.startsWith("http")) {
      try {
        const coverResp = await fetch(coverPath);
        if (coverResp.ok) {
          const coversDir = getCoversDir();
          const coverFilename = `cover-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.jpg`;
          const coverFilePath = path.join(coversDir, coverFilename);
          const buffer = Buffer.from(await coverResp.arrayBuffer());
          fs.writeFileSync(coverFilePath, buffer);
          coverPath = `/covers/${coverFilename}`;
        }
      } catch {
        // Keep the original URL if download fails
      }
    }

    const [track] = await db
      .insert(musicTable)
      .values({
        title: String(title),
        artist: String(artist),
        album: String(album || ""),
        file: `/music/${filename}`,
        cover: coverPath,
        duration,
        type: String(type || "Global Charts"),
        releaseDate: String(releaseDate || ""),
      })
      .returning();

    res.status(201).json({ ok: true, track });
  } catch (error: any) {
    // Clean up failed file
    try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch {}
    req.log?.error({ err: error }, "Spotify download failed");
    res.status(500).json({
      message: "Download gagal. Pastikan yt-dlp terinstall di server.",
      detail: error?.message || String(error),
    });
  }
});

/** POST /api/music/spotify/download-url — download audio from any URL (YouTube/SoundCloud/etc) and save to DB */
router.post("/music/spotify/download-url", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  const { url, title, artist, album, cover, type, releaseDate } = req.body ?? {};
  if (!url || !title || !artist) {
    res.status(400).json({ message: "url, title, dan artist wajib diisi." });
    return;
  }

  const musicDir = getMusicDir();
  const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.mp3`;
  const outputPath = path.join(musicDir, filename);

  try {
    const ytDlpCmd = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
    await execFileAsync(ytDlpCmd, [
      "-x",
      "--audio-format", "mp3",
      "--audio-quality", "0",
      "--no-playlist",
      "-o", outputPath,
      String(url),
    ], { timeout: 300_000 });

    let duration = "3:00";
    try {
      const { stdout } = await execFileAsync("ffprobe", [
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        outputPath,
      ]);
      const secs = parseFloat(stdout.trim());
      if (!isNaN(secs)) duration = formatMsToMinSec(secs * 1000);
    } catch {}

    // Download cover art if it's a URL
    let coverPath = String(cover || "/village.png");
    if (coverPath.startsWith("http")) {
      try {
        const coverResp = await fetch(coverPath);
        if (coverResp.ok) {
          const coversDir = getCoversDir();
          const coverFilename = `cover-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.jpg`;
          const coverFilePath = path.join(coversDir, coverFilename);
          const buffer = Buffer.from(await coverResp.arrayBuffer());
          fs.writeFileSync(coverFilePath, buffer);
          coverPath = `/covers/${coverFilename}`;
        }
      } catch {}
    }

    const [track] = await db
      .insert(musicTable)
      .values({
        title: String(title),
        artist: String(artist),
        album: String(album || ""),
        file: `/music/${filename}`,
        cover: coverPath,
        duration,
        type: String(type || "Global Charts"),
        releaseDate: String(releaseDate || ""),
      })
      .returning();

    res.status(201).json({ ok: true, track });
  } catch (error: any) {
    try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch {}
    req.log?.error({ err: error }, "Download failed");
    res.status(500).json({
      message: "Download gagal. Pastikan yt-dlp terinstall di server.",
      detail: error?.message || String(error),
    });
  }
});

/** GET /api/music/tracks/resolve — resolve a Spotify track to a cached stream URL */
router.get("/music/tracks/resolve", async (req, res): Promise<void> => {
  const title = typeof req.query.title === "string" ? req.query.title.trim() : "";
  const artist = typeof req.query.artist === "string" ? req.query.artist.trim() : "";

  if (!title || !artist) {
    res.status(400).json({ message: "title and artist are required." });
    return;
  }

  const cacheKey = `resolve:${artist} - ${title}`;
  // Look up if we already resolved it recently
  const cachedEntry = Array.from(streamCache.entries()).find(([_, entry]) => entry.key === cacheKey);
  
  if (cachedEntry && Date.now() < cachedEntry[1].expires) {
    res.json({ streamUrl: `/api/music/tracks/stream?cacheId=${cachedEntry[0]}` });
    return;
  }

  try {
    const possiblePaths = [
      path.resolve(import.meta.dirname, "yt-dlp.exe"),
      path.resolve(import.meta.dirname, "../yt-dlp.exe"),
      path.resolve(import.meta.dirname, "../../yt-dlp.exe"),
      path.resolve(import.meta.dirname, "../../../yt-dlp.exe"),
      path.resolve(import.meta.dirname, "../../../../yt-dlp.exe"),
    ];
    let ytDlpCmd = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        ytDlpCmd = p;
        break;
      }
    }

    const ytSearchQuery = `${artist} - ${title}`;
    const { stdout } = await execFileAsync(ytDlpCmd, [
      "-g",
      "-f", "ba[ext=m4a]",
      `ytsearch1:${ytSearchQuery}`
    ], { timeout: 30_000 });

    const youtubeStreamUrl = stdout.trim();
    if (!youtubeStreamUrl.startsWith("http")) {
      res.status(500).json({ message: "Gagal mencari stream audio." });
      return;
    }

    const cacheId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    streamCache.set(cacheId, {
      url: youtubeStreamUrl,
      expires: Date.now() + 30 * 60 * 1000,
      key: cacheKey,
    });

    res.json({ streamUrl: `/api/music/tracks/stream?cacheId=${cacheId}` });
  } catch (error: any) {
    req.log?.error({ err: error }, "Stream URL resolution failed");
    res.status(500).json({ message: "Gagal memuat stream audio." });
  }
});

/** GET /api/music/tracks/stream — stream from cacheId */
router.get("/music/tracks/stream", async (req, res): Promise<void> => {
  const cacheId = typeof req.query.cacheId === "string" ? req.query.cacheId.trim() : "";

  if (!cacheId) {
    res.status(400).send("cacheId is required.");
    return;
  }

  const cached = streamCache.get(cacheId);
  if (!cached || Date.now() > cached.expires) {
    res.status(404).send("Stream expired or not found. Please resolve again.");
    return;
  }

  const youtubeStreamUrl = cached.url;

  const headers: Record<string, string> = {};
  if (req.headers.range) {
    headers["Range"] = req.headers.range;
  }

  try {
    const fetchResp = await fetch(youtubeStreamUrl, {
      headers: {
        ...headers,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    res.writeHead(fetchResp.status || 200, {
      "Content-Type": fetchResp.headers.get("content-type") || "audio/mp4",
      "Content-Length": fetchResp.headers.get("content-length") || "",
      "Content-Range": fetchResp.headers.get("content-range") || "",
      "Accept-Ranges": "bytes",
    });

    if (fetchResp.body) {
      Readable.fromWeb(fetchResp.body as any).pipe(res);
    } else {
      res.end();
    }
  } catch (err: any) {
    req.log?.error({ err }, "Proxy stream failed");
    if (!res.headersSent) {
      res.status(500).end();
    }
  }
});

export default router;
