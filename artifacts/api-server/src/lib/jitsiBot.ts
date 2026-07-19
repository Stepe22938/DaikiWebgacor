/**
 * Jitsi AI Bot — joins Jitsi rooms as "Zaidan AI" and plays music.
 * Uses puppeteer-core + system Chrome (headless).
 */
// @ts-nocheck — browser-context code mixed with Node code
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";

const execFileAsync = promisify(execFile);

// ---------- yt-dlp path resolution (same logic as music.ts) ----------
function getYtDlpCommand(): string {
  if (process.platform !== "win32") {
    const venvPath = path.resolve(process.cwd(), ".venv/bin/yt-dlp");
    if (fs.existsSync(venvPath)) return venvPath;
    return "yt-dlp";
  }
  const possiblePaths = [
    path.resolve(process.cwd(), "yt-dlp.exe"),
    path.resolve(import.meta.dirname, "yt-dlp.exe"),
    path.resolve(import.meta.dirname, "../yt-dlp.exe"),
    path.resolve(import.meta.dirname, "../../yt-dlp.exe"),
    path.resolve(import.meta.dirname, "../../../yt-dlp.exe"),
    path.resolve(import.meta.dirname, "../../../../yt-dlp.exe"),
  ];
  return possiblePaths.find((p) => fs.existsSync(p)) || "yt-dlp.exe";
}

async function resolveAudioUrl(searchQuery: string): Promise<string | null> {
  try {
    const ytDlpCmd = getYtDlpCommand();
    const { stdout } = await execFileAsync(
      ytDlpCmd,
      ["-g", "-f", "140/bestaudio[ext=m4a]/bestaudio", "--no-playlist", `ytsearch1:${searchQuery}`],
      { timeout: 45_000, maxBuffer: 1024 * 512 }
    );
    const url = stdout.split(/\r?\n/).find((line: string) => line.startsWith("http"));
    return url || null;
  } catch (err) {
    console.error("[JitsiBot] yt-dlp resolve failed:", err);
    return null;
  }
}

// ---------- Chrome path ----------
function getChromePath(): string {
  if (process.platform === "win32") {
    const candidates = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      path.join(process.env.LOCALAPPDATA || "", "Google\\Chrome\\Application\\chrome.exe"),
    ];
    return candidates.find((p) => fs.existsSync(p)) || "chrome.exe";
  }
  if (process.platform === "darwin") return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  return "google-chrome";
}

// ---------- Bot session (one per room) ----------
interface BotSession {
  browser: Browser;
  page: Page;
  roomName: string;
  conversationId: number;
  joinedAt: Date;
  playing: boolean;
  inactivityTimer: ReturnType<typeof setTimeout> | null;
}

const JITSI_DOMAIN = "jitsi.sixtopia.net";
const INACTIVITY_MS = 5 * 60 * 1000; // 5 minutes

// Browser-context init code (runs inside the page, not Node)
const BROWSER_INIT_SCRIPT = `
  window.__jitsiBotAudioUrl = null;
  window.__jitsiBotAudioElement = null;
  window.__jitsiBotReady = false;

  const origGetUserMedia = navigator.mediaDevices && navigator.mediaDevices.getUserMedia
    ? navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    : null;

  if (navigator.mediaDevices) {
    navigator.mediaDevices.getUserMedia = async function(constraints) {
      const audioEl = window.__jitsiBotAudioElement;
      if (audioEl && audioEl.srcObject) {
        const audioStream = audioEl.srcObject;
        const audioTracks = audioStream.getAudioTracks();
        if (audioTracks.length > 0 && constraints.audio) {
          const stream = new MediaStream(audioTracks);
          if (constraints.video) {
            const canvas = document.createElement("canvas");
            canvas.width = 640;
            canvas.height = 480;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.fillStyle = "#1a1a2e";
              ctx.fillRect(0, 0, 640, 480);
              ctx.fillStyle = "#fff";
              ctx.font = "bold 32px sans-serif";
              ctx.textAlign = "center";
              ctx.fillText("Zaidan AI", 320, 260);
            }
            const videoTrack = canvas.captureStream(1).getVideoTracks()[0];
            stream.addTrack(videoTrack);
          }
          console.log("[JitsiBot] Returning music audio stream as microphone");
          return stream;
        }
      }
      if (origGetUserMedia) return origGetUserMedia(constraints);
      throw new Error("No media devices available");
    };
  }
`;

// Browser-context play script template
function buildPlayScript(url: string): string {
  return `
    (async () => {
      const prev = window.__jitsiBotAudioElement;
      if (prev) { prev.pause(); prev.srcObject = null; }

      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.src = ${JSON.stringify(url)};
      audio.volume = 1.0;

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaElementSource(audio);
      const destination = audioCtx.createMediaStreamDestination();
      source.connect(destination);
      source.connect(audioCtx.destination);

      window.__jitsiBotAudioElement = audio;
      audio.srcObject = destination.stream;
      window.__jitsiBotAudioUrl = ${JSON.stringify(url)};

      await audio.play().catch(() => console.log("[JitsiBot] Autoplay blocked"));
      audio.onended = () => {
        console.log("[JitsiBot] Audio playback ended");
        window.__jitsiBotPlaying = false;
      };
      window.__jitsiBotPlaying = true;
      return "ok";
    })()
  `;
}

class JitsiBotManager {
  private sessions = new Map<number, BotSession>(); // keyed by conversationId

  /** Get or create session for a conversation */
  async joinRoom(conversationId: number, roomName: string): Promise<{ ok: boolean; already: boolean }> {
    const existing = this.sessions.get(conversationId);
    if (existing) {
      this.resetInactivityTimer(conversationId);
      return { ok: true, already: true };
    }

    const chromePath = getChromePath();
    console.log(`[JitsiBot] Launching Chrome from ${chromePath}`);

    const browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--use-fake-ui-for-media-stream",
        "--autoplay-policy=no-user-gesture-required",
        "--disable-features=MediaStreamTrackUseEchoCanceller",
        "--window-size=1280,720",
      ],
      defaultViewport: { width: 1280, height: 720 },
    });

    const page = await browser.newPage();

    // Inject getUserMedia override BEFORE Jitsi loads
    await page.evaluateOnNewDocument(BROWSER_INIT_SCRIPT);

    // Build Jitsi URL with auto-join params
    const jitsiUrl = `https://${JITSI_DOMAIN}/${roomName}#config.prejoinPageEnabled=false&config.disableDeepLinking=true&config.startAudioOnly=true&config.startWithVideoMuted=true&userInfo.displayName=Zaidan%20AI&config.disableProfile=true`;

    console.log(`[JitsiBot] Navigating to ${jitsiUrl}`);
    await page.goto(jitsiUrl, { waitUntil: "networkidle2", timeout: 30_000 });

    // Wait for Jitsi to connect
    await new Promise((r) => setTimeout(r, 5_000));

    // Try clicking "Join" or dismiss any dialogs
    try {
      await page.evaluate(() => {
        const joinBtn = document.querySelector('[data-testid="prejoin.joinMeeting"]') as any;
        if (joinBtn) joinBtn.click();
      });
    } catch { /* ignore */ }

    // Wait for meeting to start
    await new Promise((r) => setTimeout(r, 3_000));

    console.log(`[JitsiBot] Joined room ${roomName} for conversation ${conversationId}`);

    const session: BotSession = {
      browser,
      page,
      roomName,
      conversationId,
      joinedAt: new Date(),
      playing: false,
      inactivityTimer: null,
    };

    this.sessions.set(conversationId, session);
    this.resetInactivityTimer(conversationId);

    return { ok: true, already: false };
  }

  /** Play music in a room */
  async playMusic(conversationId: number, title: string, artist: string): Promise<{ ok: boolean; error?: string }> {
    const session = this.sessions.get(conversationId);
    if (!session) return { ok: false, error: "Bot not in room" };

    this.resetInactivityTimer(conversationId);

    // Resolve the YouTube audio URL
    console.log(`[JitsiBot] Resolving audio for: ${artist} - ${title}`);
    const audioUrl = await resolveAudioUrl(`${artist} - ${title}`);
    if (!audioUrl) return { ok: false, error: "Could not resolve audio URL" };

    console.log(`[JitsiBot] Playing audio in room: ${audioUrl.slice(0, 80)}...`);
    session.playing = true;

    try {
      // Inject and play audio inside the Jitsi page
      const result = await session.page.evaluate(buildPlayScript(audioUrl));
      console.log(`[JitsiBot] Audio playing: ${artist} - ${title}`);
      return { ok: true };
    } catch (err: any) {
      console.error("[JitsiBot] Play error:", err);
      session.playing = false;
      return { ok: false, error: err.message };
    }
  }

  /** Leave a room */
  async leaveRoom(conversationId: number): Promise<void> {
    const session = this.sessions.get(conversationId);
    if (!session) return;

    if (session.inactivityTimer) clearTimeout(session.inactivityTimer);

    try {
      await session.page.close();
      await session.browser.close();
    } catch (err) {
      console.error("[JitsiBot] Cleanup error:", err);
    }

    this.sessions.delete(conversationId);
    console.log(`[JitsiBot] Left room for conversation ${conversationId}`);
  }

  /** Check if bot is in a room */
  isInRoom(conversationId: number): boolean {
    return this.sessions.has(conversationId);
  }

  /** Get all active sessions */
  getActiveRooms(): { conversationId: number; roomName: string; joinedAt: Date; playing: boolean }[] {
    return Array.from(this.sessions.values()).map((s) => ({
      conversationId: s.conversationId,
      roomName: s.roomName,
      joinedAt: s.joinedAt,
      playing: s.playing,
    }));
  }

  private resetInactivityTimer(conversationId: number) {
    const session = this.sessions.get(conversationId);
    if (!session) return;

    if (session.inactivityTimer) clearTimeout(session.inactivityTimer);
    session.inactivityTimer = setTimeout(() => {
      console.log(`[JitsiBot] Inactivity timeout for conversation ${conversationId}, leaving...`);
      this.leaveRoom(conversationId);
    }, INACTIVITY_MS);
  }
}

// Singleton
export const jitsiBot = new JitsiBotManager();

/** Helper: slugify text (same as frontend) */
export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "conv";
}

/** Build the Jitsi room name for a conversation+channel */
export function buildJitsiRoomName(conversationName: string, channelName?: string | null, conversationId?: number): string {
  if (channelName) {
    return `${slugify(conversationName)}-${slugify(channelName)}`;
  }
  return `arcadia-studio-dm-${slugify(conversationName)}-${String(conversationId || 0).padStart(3, "0")}`;
}
