import { Router, type IRouter } from "express";

const router: IRouter = Router();

let spotifyToken: string | null = null;
let spotifyTokenExpiry = 0;

const SPOTIFY_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
].join(" ");

function getSpotifyClientConfig() {
  const clientId = process.env.SPOTIFY_CLIENT_ID || process.env.VITE_SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || process.env.VITE_SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Spotify credentials are not configured.");
  }

  return { clientId, clientSecret };
}

function getSpotifyRedirectUri(req: any) {
  return process.env.SPOTIFY_REDIRECT_URI || `${req.protocol}://${req.get("host")}/api/music/spotify/callback`;
}

function parseCookies(cookieHeader?: string) {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const item of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = item.trim().split("=");
    if (!rawKey) continue;
    cookies[rawKey] = decodeURIComponent(rawValue.join("=") || "");
  }
  return cookies;
}

function makeCookie(name: string, value: string, maxAgeSeconds: number) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax; HttpOnly`;
}

async function exchangeSpotifyCode(code: string, redirectUri: string) {
  const { clientId, clientSecret } = getSpotifyClientConfig();
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(`Spotify code exchange failed: ${response.status} ${await response.text()}`);
  }

  return response.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
}

async function refreshSpotifyUserToken(refreshToken: string) {
  const { clientId, clientSecret } = getSpotifyClientConfig();
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`Spotify refresh failed: ${response.status} ${await response.text()}`);
  }

  return response.json() as Promise<{ access_token: string; refresh_token?: string; expires_in: number }>;
}

async function getSpotifyUserAccessToken(req: any, res: any) {
  const cookies = parseCookies(req.headers.cookie);
  const refreshToken = cookies.spotify_refresh_token;
  const currentToken = cookies.spotify_access_token;
  const expiresAt = Number(cookies.spotify_access_expires_at || "0");

  if (currentToken && expiresAt - 30_000 > Date.now()) {
    return currentToken;
  }

  if (!refreshToken) {
    res.status(401).json({ message: "Spotify account is not connected." });
    return null;
  }

  const refreshed = await refreshSpotifyUserToken(refreshToken);
  const nextRefreshToken = refreshed.refresh_token || refreshToken;
  const expiresAtMs = Date.now() + refreshed.expires_in * 1000;

  res.append("Set-Cookie", makeCookie("spotify_access_token", refreshed.access_token, refreshed.expires_in));
  res.append("Set-Cookie", makeCookie("spotify_refresh_token", nextRefreshToken, 60 * 60 * 24 * 30));
  res.append("Set-Cookie", makeCookie("spotify_access_expires_at", String(expiresAtMs), refreshed.expires_in));

  return refreshed.access_token;
}

function formatMsToMinSec(ms: number) {
  if (!ms) return "3:00";
  const totalSecs = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSecs / 60);
  const seconds = totalSecs % 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

async function getSpotifyToken() {
  const { clientId, clientSecret } = getSpotifyClientConfig();

  if (spotifyToken && Date.now() < spotifyTokenExpiry) {
    return spotifyToken;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error(`Spotify token request failed: ${response.status}`);
  }

  const data = await response.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new Error("Spotify token response did not include access_token.");
  }

  spotifyToken = data.access_token;
  spotifyTokenExpiry = Date.now() + ((data.expires_in ?? 3600) - 60) * 1000;
  return spotifyToken;
}

router.get("/music/spotify/login", (req, res) => {
  try {
    const { clientId } = getSpotifyClientConfig();
    const returnTo = typeof req.query.returnTo === "string" ? req.query.returnTo : "/member?tab=music";
    const state = Buffer.from(JSON.stringify({ returnTo })).toString("base64url");
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: getSpotifyRedirectUri(req),
      scope: SPOTIFY_SCOPES,
      state,
      show_dialog: "false",
    });

    res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : "Spotify login failed." });
  }
});

router.get("/music/spotify/callback", async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";

  if (!code) {
    res.status(400).send("Missing Spotify authorization code.");
    return;
  }

  try {
    const tokens = await exchangeSpotifyCode(code, getSpotifyRedirectUri(req));
    const expiresAtMs = Date.now() + tokens.expires_in * 1000;
    const cookies = [
      makeCookie("spotify_access_token", tokens.access_token, tokens.expires_in),
      makeCookie("spotify_refresh_token", tokens.refresh_token, 60 * 60 * 24 * 30),
      makeCookie("spotify_access_expires_at", String(expiresAtMs), tokens.expires_in),
    ];

    res.setHeader("Set-Cookie", cookies);

    let returnTo = "/member?tab=music";
    try {
      const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
      if (typeof parsed.returnTo === "string" && parsed.returnTo.startsWith("/")) {
        returnTo = parsed.returnTo;
      }
    } catch {}

    res.redirect(returnTo);
  } catch (error) {
    req.log?.error({ err: error }, "Spotify callback failed");
    res.status(500).send(error instanceof Error ? error.message : "Spotify callback failed.");
  }
});

router.get("/music/spotify/token", async (req, res) => {
  try {
    const accessToken = await getSpotifyUserAccessToken(req, res);
    if (!accessToken) return;
    res.json({ accessToken });
  } catch (error) {
    req.log?.error({ err: error }, "Spotify token failed");
    res.status(401).json({ message: error instanceof Error ? error.message : "Spotify token failed." });
  }
});

router.post("/music/spotify/play", async (req, res) => {
  const deviceId = typeof req.body?.deviceId === "string" ? req.body.deviceId : "";
  const uri = typeof req.body?.uri === "string" ? req.body.uri : "";

  if (!deviceId || !uri) {
    res.status(400).json({ message: "deviceId and uri are required." });
    return;
  }

  try {
    const accessToken = await getSpotifyUserAccessToken(req, res);
    if (!accessToken) return;

    const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris: [uri] }),
    });

    if (!response.ok && response.status !== 204) {
      res.status(response.status).json({ message: `Spotify playback failed: ${response.status}`, detail: await response.text() });
      return;
    }

    res.json({ ok: true });
  } catch (error) {
    req.log?.error({ err: error }, "Spotify playback failed");
    res.status(500).json({ message: error instanceof Error ? error.message : "Spotify playback failed." });
  }
});

router.get("/music/spotify/search", async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const market = typeof req.query.market === "string" ? req.query.market.trim().toUpperCase() : "ID";

  if (!query) {
    res.json({ tracks: [] });
    return;
  }

  try {
    const token = await getSpotifyToken();
    const queryCandidates = [
      query,
      query.includes(":") ? `"${query.replaceAll("\"", "")}"` : null,
      query.replace(/[:]+/g, " ").replace(/\s+/g, " ").trim(),
    ].filter((value, index, values): value is string =>
      Boolean(value) && values.indexOf(value) === index
    );

    let data: { tracks?: { items?: any[] } } | null = null;
    let lastStatus = 500;
    let lastError = "";

    for (const candidate of queryCandidates) {
      const params = new URLSearchParams({
        q: candidate,
        type: "track",
        market,
      });

      const response = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      lastStatus = response.status;
      if (!response.ok) {
        lastError = await response.text();
        continue;
      }

      data = await response.json() as { tracks?: { items?: any[] } };
      break;
    }

    if (!data) {
      res.status(lastStatus).json({ message: `Spotify search failed: ${lastStatus}`, detail: lastError });
      return;
    }

    const normalizedQuery = query.toLowerCase();
    const tracks = (data.tracks?.items || []).map((item) => ({
      id: item.id,
      title: item.name,
      artist: item.artists?.map((artist: any) => artist.name).join(", ") || "Unknown",
      file: "",
      previewUrl: item.preview_url,
      cover: item.album?.images?.[0]?.url || "/village.png",
      duration: formatMsToMinSec(item.duration_ms),
      type: `Spotify - ${item.album?.name || "Album"}`,
      isSpotify: true,
      spotifyUrl: item.external_urls?.spotify,
      spotifyUri: item.uri || `spotify:track:${item.id}`,
      spotifyEmbedUrl: `https://open.spotify.com/embed/track/${item.id}`,
    })).sort((a, b) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      const aExact = aTitle === normalizedQuery ? 1 : 0;
      const bExact = bTitle === normalizedQuery ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      const aStarts = aTitle.startsWith(normalizedQuery) ? 1 : 0;
      const bStarts = bTitle.startsWith(normalizedQuery) ? 1 : 0;
      if (aStarts !== bStarts) return bStarts - aStarts;
      return 0;
    });

    res.json({ tracks });
  } catch (error) {
    req.log?.error({ err: error }, "Spotify search failed");
    res.status(500).json({ message: error instanceof Error ? error.message : "Spotify search failed." });
  }
});

export default router;
