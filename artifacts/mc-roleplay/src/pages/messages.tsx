import { useState, useRef, useEffect, useMemo } from "react";
import {
  useCreateOrGetDm,
  useCreateGroup,
  useDeleteConversation,
  useSendMessage,
  useListConversationMembers,
  getListConversationMembersQueryOptions,
  useAddConversationMember,
  useRemoveConversationMember,
  useGetMyFriends,
  useGetMe,
  customFetch,
  useListPinnedMessages,
  usePinMessage,
  useUnpinMessage,
  useStarMessage,
  useUnstarMessage,
  useListStarredMessages,
  useReactMessage,
  useUnreactMessage,
  getListPinnedMessagesQueryOptions,
  getListStarredMessagesQueryOptions,
  useAdminUpdateConversation,
} from "@workspace/api-client-react";
import type { ConversationSummary, Message } from "@workspace/api-client-react";
import { useClerk } from "@clerk/react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { format, formatDistanceToNow } from "date-fns";

function formatDistanceToNowHelper(date: Date): string {
  try {
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (e) {
    return "";
  }
}
import { Link, useLocation } from "wouter";
import {
  Phone,
  Video,
  LayoutGrid,
  Megaphone,
  Hammer,
  Ticket,
  ClipboardList,
  User,
  ShieldAlert,
  LogOut,
  Menu,
  Sparkles,
  Activity,
  Copy,
  Check,
  CheckCheck,
  ArrowUpRight,
  MessageSquare,
  Users,
  Home,
  Download,
  File,
  SendHorizontal,
  X,
  ArrowLeft,
  MoreVertical,
  UserCircle,
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  Edit3,
  Info,
  Hash,
  Plus,
  Trash2,
  Settings,
  FolderPlus,
  Minimize2,
  Cpu,
  Key,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  ListOrdered,
  CornerUpLeft,
  Star,
  Pin,
  Forward,
  Upload,
  Clock,
  Smile,
  Search,
  Music,
  Play,
  Pause,
  ChevronDown,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  BadgeCheck,
  Gift,
  Crown,
  Archive,
  ArchiveX,
  Ban,
  ShoppingBag,
  Trophy,
  UserPlus,
  Bell,
  Radio,
  Square,
  VolumeX,
  Volume1,
  QrCode,
  Camera,
} from "lucide-react";

const JITSI_BASE = "https://jitsi.sixtopia.net/arcadia-studio-conv-";
const QUERY_TIMEOUT_MS = 10_000;

function createQuerySignal(signal?: AbortSignal, timeoutMs = QUERY_TIMEOUT_MS): AbortSignal | undefined {
  if (typeof AbortSignal === "undefined") return signal;

  const timeoutFactory = (AbortSignal as typeof AbortSignal & {
    timeout?: (ms: number) => AbortSignal;
    any?: (signals: AbortSignal[]) => AbortSignal;
  }).timeout;
  const anyFactory = (AbortSignal as typeof AbortSignal & {
    timeout?: (ms: number) => AbortSignal;
    any?: (signals: AbortSignal[]) => AbortSignal;
  }).any;

  if (timeoutFactory && anyFactory) {
    return signal ? anyFactory([signal, timeoutFactory(timeoutMs)]) : timeoutFactory(timeoutMs);
  }

  if (!signal) return undefined;
  return signal;
}

type UploadedAttachment = {
  driveFileId: string;
  url: string;
  downloadUrl: string;
  name: string;
  mimeType: string;
  size: number;
  imageUrl?: string | null;
};

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|live\/))([\w-]{11})/);
  return m ? m[1] : null;
}

function getEmbeddableUrl(url: string): string {
  if (!url) return "";
  
  // YouTube
  const ytId = extractYouTubeId(url);
  if (ytId) {
    return `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1`;
  }
  
  // Twitch
  if (url.includes("twitch.tv")) {
    const parent = window.location.hostname;
    const videoMatch = url.match(/twitch\.tv\/videos\/(\d+)/);
    if (videoMatch) {
      return `https://player.twitch.tv/?video=${videoMatch[1]}&parent=${parent}&autoplay=true&muted=true`;
    }
    const channelMatch = url.match(/twitch\.tv\/([\w_]+)/);
    if (channelMatch && channelMatch[1] !== "videos") {
      return `https://player.twitch.tv/?channel=${channelMatch[1]}&parent=${parent}&autoplay=true&muted=true`;
    }
  }
  
  // TikTok
  if (url.includes("tiktok.com")) {
    const tikTokMatch = url.match(/tiktok\.com\/@[\w.-]+\/video\/(\d+)/) || url.match(/tiktok\.com\/v\/(\d+)/);
    if (tikTokMatch) {
      return `https://www.tiktok.com/embed/v2/${tikTokMatch[1]}`;
    }
  }
  
  return url;
}

function formatFileSize(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

const STANDARD_EMOJIS = [
  { char: "💀", name: "skull" },
  { char: "🇮🇩", name: "indonesia" },
  { char: "💜", name: "purple_heart" },
  { char: "🔪", name: "knife" },
  { char: "🎉", name: "tada" },
  { char: "🍪", name: "cookie" },
  { char: "🇭🇺", name: "hungary" },
  { char: "🍦", name: "icecream" },
  { char: "🔥", name: "fire" },
  { char: "🥔", name: "potato" },
  { char: "💥", name: "boom" },
  { char: "🧩", name: "puzzle" },
  { char: "🤙", name: "call_me" },
  { char: "🏀", name: "basketball" },
  { char: "1️⃣", name: "one" },
  { char: "🔫", name: "gun" },
  { char: "🌍", name: "earth" },
  { char: "💎", name: "gem" },
  { char: "📱", name: "phone" },
  { char: "❌", name: "x" },
  { char: "⚠️", name: "warning" },
  { char: "😊", name: "smile" },
  { char: "😂", name: "joy" },
  { char: "🤣", name: "rofl" },
  { char: "😍", name: "heart_eyes" },
  { char: "😭", name: "sob" },
  { char: "🥺", name: "pleading" },
  { char: "👍", name: "thumbsup" },
  { char: "👏", name: "clap" },
  { char: "🙏", name: "pray" },
  { char: "🎉", name: "party" },
  { char: "✨", name: "sparkles" },
  { char: "❤️", name: "heart" },
  { char: "🤔", name: "thinking" },
  { char: "😎", name: "cool" },
  { char: "💩", name: "poop" },
  { char: "🤡", name: "clown" },
  { char: "👀", name: "eyes" },
  { char: "💯", name: "hundred" },
  { char: "🚀", name: "rocket" },
  { char: "🍕", name: "pizza" },
  { char: "🍔", name: "burger" },
  { char: "🍿", name: "popcorn" },
  { char: "🎮", name: "game" },
  { char: "🐱", name: "cat" },
  { char: "🐶", name: "dog" }
];

function parseMentions(text: string): (string | React.ReactNode)[] {
  const mentionRegex = /@(\w+)(?:\s*#\d+)?/g;
  const result: (string | React.ReactNode)[] = [];
  let lastIdx = 0;
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    const matchIndex = match.index;
    const fullMention = match[0];
    if (matchIndex > lastIdx) {
      result.push(text.substring(lastIdx, matchIndex));
    }
    result.push(
      <span
        key={`mention-${matchIndex}-${fullMention}`}
        className="bg-[#5865F2] text-white px-1.5 py-0.5 rounded font-extrabold text-[11px] inline-block align-middle select-all mx-0.5 shadow-sm"
      >
        {fullMention}
      </span>
    );
    lastIdx = mentionRegex.lastIndex;
  }
  if (lastIdx < text.length) {
    result.push(text.substring(lastIdx));
  }
  return result;
}

function renderMessageTextWithEmojis(content: string, customEmojis: any[] = [], currentConversationId: number | null = null) {
  if (!content) return null;
  const regex = /:([a-zA-Z0-9_]{1,40}):/g;
  const emojiParts = [];
  let lastIndex = 0;
  let match;

  const emojiMap = new Map();
  for (const e of customEmojis) {
    if (e.name) {
      const key = e.name.toLowerCase();
      if (!emojiMap.has(key) || e.conversationId === currentConversationId) {
        emojiMap.set(key, e);
      }
    }
  }

  while ((match = regex.exec(content)) !== null) {
    const matchIndex = match.index;
    const emojiName = match[1].toLowerCase();

    if (matchIndex > lastIndex) {
      emojiParts.push(content.substring(lastIndex, matchIndex));
    }

    const customEmoji = emojiMap.get(emojiName);
    if (customEmoji) {
      emojiParts.push(
        <img
          key={`emoji-${matchIndex}`}
          src={customEmoji.assetUrl}
          alt={`:${customEmoji.name}:`}
          title={`:${customEmoji.name}:`}
          className="inline-block w-5 h-5 align-middle object-contain select-all mx-0.5"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            const parent = e.currentTarget.parentNode;
            if (parent) {
              const textNode = document.createTextNode(`:${customEmoji.name}:`);
              parent.insertBefore(textNode, e.currentTarget);
            }
          }}
        />
      );
    } else {
      emojiParts.push(match[0]);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    emojiParts.push(content.substring(lastIndex));
  }

  // Now, parse mentions on all string parts in emojiParts
  const finalParts: (string | React.ReactNode)[] = [];
  for (const part of emojiParts) {
    if (typeof part === "string") {
      finalParts.push(...parseMentions(part));
    } else {
      finalParts.push(part);
    }
  }

  return finalParts.length > 0 ? finalParts : content;
}

function parseMusicCommandFromMsg(msg: any): { title: string; artist: string } | null {
  // Check imageUrl field for music command data
  if (msg.imageUrl && typeof msg.imageUrl === "string" && msg.imageUrl.startsWith("music:")) {
    try {
      return JSON.parse(msg.imageUrl.slice(6));
    } catch {
      return null;
    }
  }
  // Fallback: check content for raw tag (legacy/backward compat)
  if (msg.content) {
    const match = msg.content.match(/\[CMD:\s*PLAY_MUSIC\s+title=([^|]+)\|artist=([^\]]+)\]/i);
    if (match) return { title: match[1].trim(), artist: match[2].trim() };
  }
  return null;
}

function stripMusicCommand(content: string): string {
  if (!content) return content;
  return content.replace(/\[CMD:\s*PLAY_MUSIC\s+[^\]]*\]/gi, "").trim();
}

interface VoiceMember {
  id: number;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  voiceJoinedAt?: string | null;
}

interface ProfilePreviewUser {
  id: number;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
  roles?: Array<{ id: number; name: string; color: string }>;
  equippedBorder?: string | null;
}

interface ProfileOverview {
  user: ProfilePreviewUser & {
    bio?: string | null;
    lastSeenAt?: string | null;
    isOnline: boolean;
    equippedBadge?: string | null;
    equippedBackground?: string | null;
  };
  groupRoles: Array<{ id: number; name: string; color: string; position?: number }>;
  voiceChannel: {
    id: number;
    name: string;
    conversationId: number;
    conversationName?: string | null;
  } | null;
  mutualGroups: Array<{
    id: number;
    name?: string | null;
    iconUrl?: string | null;
    ownerId?: number | null;
  }>;
}

interface Channel {
  id: number;
  conversationId: number;
  categoryId: number | null;
  name: string;
  type: "text" | "voice" | "announce" | "forum";
  position: number;
  createdAt: string;
  members?: VoiceMember[];
}

interface ChannelCategory {
  id: number;
  conversationId: number;
  name: string;
  position: number;
}

interface Role {
  id: number;
  conversationId: number;
  name: string;
  color: string;
  position: number;
  permissions: Record<string, boolean>;
  createdAt: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "conv";
}

const ROLE_LABELS: Record<string, string> = {
  member: "Member",
  admin: "Admin",
  staff: "Staff",
  dev: "Dev",
  dev_website: "Dev Website",
  ai: "Zaidan AI",
  bot: "BOT",
};

const ROLE_BADGE_CLASSES: Record<string, string> = {
  member: "bg-slate-50 text-slate-500 border border-slate-200/50",
  admin: "bg-violet-50 text-[#6366f1] border border-violet-100",
  staff: "bg-sky-50 text-sky-600 border border-sky-100",
  dev: "bg-emerald-50 text-emerald-600 border border-emerald-100",
  dev_website: "bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-100",
  ai: "bg-blue-50 text-[#2563eb] border border-blue-100 font-extrabold tracking-wide",
  bot: "bg-blue-50 text-[#5865f2] border border-blue-100 font-black tracking-wide",
};

const ROLE_PERMISSION_OPTIONS = [
  { key: "sendMessages", label: "Send Messages" },
  { key: "postAnnouncements", label: "Post Announcements" },
  { key: "manageChannels", label: "Manage Channels / Channel Editor" },
  { key: "manageRoles", label: "Manage Roles" },
  { key: "manageMessages", label: "Manage Messages" },
  { key: "kickMembers", label: "Kick Members" },
  { key: "inviteMembers", label: "Invite Members" },
  { key: "inviteBot", label: "Invite Bots" },
] as const;

function formatVoiceDuration(joinedAt: string | null | undefined, now: number) {
  if (!joinedAt) return "00:00";

  const joinedAtMs = new Date(joinedAt).getTime();
  if (!Number.isFinite(joinedAtMs)) return "00:00";

  const totalSeconds = Math.max(0, Math.floor((now - joinedAtMs) / 1000));
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatLastSeen(lastSeenAt: string | null | undefined) {
  if (!lastSeenAt) return "No recent activity";

  const lastSeenMs = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(lastSeenMs)) return "No recent activity";

  const secondsAgo = Math.max(0, Math.floor((Date.now() - lastSeenMs) / 1000));
  if (secondsAgo < 60) return "Seen just now";
  const minutesAgo = Math.floor(secondsAgo / 60);
  if (minutesAgo < 60) return `Seen ${minutesAgo}m ago`;
  const hoursAgo = Math.floor(minutesAgo / 60);
  if (hoursAgo < 24) return `Seen ${hoursAgo}h ago`;
  return `Seen ${Math.floor(hoursAgo / 24)}d ago`;
}

function getVoiceChannelStartedAt(members: VoiceMember[] | undefined) {
  if (!members?.length) return null;

  const joinedAtTimes = members
    .map((member) => member.voiceJoinedAt ? new Date(member.voiceJoinedAt).getTime() : Number.NaN)
    .filter(Number.isFinite);

  if (!joinedAtTimes.length) return null;
  return new Date(Math.min(...joinedAtTimes)).toISOString();
}

function VoiceChannelDuration({ members, now }: { members?: VoiceMember[]; now: number }) {
  const startedAt = getVoiceChannelStartedAt(members);
  if (!startedAt) return null;

  return (
    <span className="shrink-0 font-mono text-[10px] font-black text-emerald-400 tabular-nums">
      {formatVoiceDuration(startedAt, now)}
    </span>
  );
}

function VoiceMemberRow({ member, onClick }: { member: VoiceMember; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2 text-xs text-[#949BA4] hover:text-[#DCDDDE] hover:bg-[#35373C] rounded-md px-1 py-0.5 min-w-0 text-left transition-colors"
    >
      {member.avatarUrl ? (
        <img src={member.avatarUrl} className="w-4.5 h-4.5 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-4.5 h-4.5 rounded-full bg-violet-600 flex items-center justify-center text-[9px] text-white font-extrabold shrink-0">
          {member.username[0].toUpperCase()}
        </div>
      )}
      <span className="truncate font-semibold min-w-0">{member.displayName || member.username}</span>
    </button>
  );
}

function JitsiCall({
  roomName,
  displayName,
  avatarUrl,
  audioOnly,
  onClose,
  subject,
}: {
  roomName: string;
  displayName: string;
  avatarUrl?: string | null;
  audioOnly: boolean;
  onClose?: () => void;
  subject: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let timer: any = null;
    let fallbackTimer: any = null;
    let script: HTMLScriptElement | null = null;

    const initJitsi = (domain: string) => {
      if (!containerRef.current || !active) return;
      
      if (apiRef.current) {
        apiRef.current.dispose();
      }

      try {
        const options = {
          roomName,
          width: "100%",
          height: "100%",
          parentNode: containerRef.current,
          configOverwrite: {
            subject,
            startAudioOnly: audioOnly,
            startWithVideoMuted: audioOnly,
            prejoinConfig: {
              enabled: false,
            },
            prejoinPageEnabled: false,
            disableDeepLinking: true,
            p2p: {
              enabled: true,
            },
            // Hide Jitsi's internal hangup button to prevent ending the meeting for everyone
            toolbarButtons: [
              'microphone', 'camera', 'closedcaptions', 'desktop', 'embedmeeting', 
              'fullscreen', 'fodeviceselection', 'profile', 'chat', 'recording', 
              'livestreaming', 'sharedvideo', 'shareaudio', 'settings', 'raisehand', 
              'videoquality', 'filmstrip', 'invite', 'tileview', 'select-background', 
              'mute-everyone', 'mute-video-everyone', 'security'
            ],
          },
          userInfo: {
            displayName,
            ...(avatarUrl && { avatarUrl }),
          },
        };

        apiRef.current = new (window as any).JitsiMeetExternalAPI(domain, options);
        
        apiRef.current.addEventListener("videoConferenceJoined", () => {
          if (active) {
            setLoading(false);
            setError(null);
          }
        });

        apiRef.current.addEventListener("videoConferenceLeft", () => {
          if (onClose) onClose();
        });

        apiRef.current.addEventListener("readyToClose", () => {
          if (onClose) onClose();
        });
      } catch (err) {
        console.error("Failed to initialize Jitsi Meet:", err);
        if (active) {
          setError("Gagal menginisialisasi Jitsi Meet.");
          setLoading(false);
        }
      }
    };

    const loadScript = (src: string, domain: string) => {
      if (!active) return;
      
      const scriptId = "jitsi-external-api-script";
      let existingScript = document.getElementById(scriptId) as HTMLScriptElement;
      if (existingScript) {
        existingScript.remove();
      }
      if ((window as any).JitsiMeetExternalAPI) {
        delete (window as any).JitsiMeetExternalAPI;
      }

      script = document.createElement("script");
      script.id = scriptId;
      script.src = src;
      script.async = true;
      
      script.onload = () => {
        if (active && (window as any).JitsiMeetExternalAPI) {
          clearTimeout(fallbackTimer);
          initJitsi(domain);
        }
      };

      script.onerror = () => {
        if (!active) return;
        console.warn(`Failed to load Jitsi script from ${src}, trying fallback...`);
        clearTimeout(fallbackTimer);
        
        if (domain === "jitsi.sixtopia.net") {
          setError("Server utama lambat. Menghubungkan ke server cadangan...");
          loadScript("https://meet.element.io/external_api.js", "meet.element.io");
        } else {
          setError("Gagal memuat Jitsi Meet API. Silakan periksa koneksi internet Anda.");
          setLoading(false);
        }
      };

      document.body.appendChild(script);

      // Timeout for this specific script load (6 seconds)
      fallbackTimer = setTimeout(() => {
        if (active && !((window as any).JitsiMeetExternalAPI)) {
          console.warn(`Jitsi script load timed out for ${src}`);
          if (domain === "jitsi.sixtopia.net") {
            setError("Server utama tidak merespon. Menghubungkan ke server cadangan...");
            loadScript("https://meet.element.io/external_api.js", "meet.element.io");
          } else {
            setError("Koneksi ke server Jitsi habis. Silakan coba lagi nanti.");
            setLoading(false);
          }
        }
      }, 6000);
    };

    // Start by loading the primary Jitsi server
    loadScript("https://jitsi.sixtopia.net/external_api.js", "jitsi.sixtopia.net");

    // Global backup fail-safe to ensure loading spinner is removed
    timer = setTimeout(() => {
      if (active) {
        setLoading(false);
      }
    }, 12000);

    return () => {
      active = false;
      if (apiRef.current) {
        apiRef.current.dispose();
        apiRef.current = null;
      }
      if (script) {
        script.remove();
      }
      if (timer) clearTimeout(timer);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [roomName, displayName, avatarUrl, audioOnly]);

  return (
    <div className="relative flex-1 w-full min-h-[450px] flex flex-col bg-white overflow-hidden rounded-xl">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white gap-4 z-10">
          <div className="w-12 h-12 rounded-full border-4 border-violet-100 border-t-[#6366f1] animate-spin" />
          <div className="text-center space-y-1">
            <p className="text-sm font-extrabold text-[#110e3d]">Connecting to Voice Channel...</p>
            <p className="text-xs text-slate-400 font-bold animate-pulse px-4">
              {error || "Syncing profiles & data..."}
            </p>
          </div>
        </div>
      )}
      {!loading && error && !apiRef.current && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white p-6 text-center gap-3 z-10">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
            <span className="text-xl">⚠️</span>
          </div>
          <p className="text-sm font-extrabold text-[#110e3d]">{error}</p>
          <button 
            type="button"
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all"
          >
            Coba Lagi
          </button>
        </div>
      )}
      <div ref={containerRef} className="flex-1 w-full h-full min-h-[450px]" />
    </div>
  );
}

function ZaidanAiCall({
  onClose,
  username,
}: {
  onClose: () => void;
  username: string;
}) {
  const [status, setStatus] = useState<"connecting" | "connected" | "listening" | "thinking" | "speaking">("connecting");
  const [transcript, setTranscript] = useState("");
  const [aiReply, setAiReply] = useState("");
  const [modelName, setModelName] = useState("");
  const [history, setHistory] = useState<Array<{ role: string; content: string }>>([]);
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState("");

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<any>(null);

  // Connect to Zaidan AI on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setStatus("connected");
      speak("Halo Kak! Zaidan AI di sini~ Mau ngobrol apa hari ini?");
      setHistory([{ role: "assistant", content: "Halo Kak! Zaidan AI di sini~ Mau ngobrol apa hari ini?" }]);
    }, 1500);

    timerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(timerRef.current);
      stopListening();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  async function speak(text: string) {
    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setStatus("speaking");

    try {
      // Call backend TTS endpoint for natural Indonesian female voice
      const res = await fetch("/api/conversations/zaidanai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        throw new Error("TTS failed");
      }

      // Create audio blob and play it
      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        // Wait a bit before starting to listen, so user has time to process
        setTimeout(() => {
          setStatus("connected");
        }, 300);
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        setTimeout(() => {
          setStatus("connected");
        }, 300);
      };

      await audio.play();
    } catch (err) {
      console.error("[Zaidan AI TTS] Error:", err);
      // Fallback to browser TTS if backend fails
      speakFallback(text);
    }
  }

  // Fallback to browser SpeechSynthesis if backend TTS fails
  function speakFallback(text: string) {
    const cleanText = text
      .replace(/[\u{1F600}-\u{1F9FF}]/gu, "")
      .replace(/[*_~`#]/g, "")
      .replace(/---/g, "")
      .replace(/\n+/g, ". ")
      .trim();

    if (!cleanText) {
      setStatus("connected");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "id-ID";
    utterance.rate = 0.95;
    utterance.pitch = 1.15;

    utterance.onend = () => {
      setStatus("connected");
    };
    utterance.onerror = () => {
      setStatus("connected");
    };

    window.speechSynthesis.speak(utterance);
  }

  function startListening() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Browser tidak support speech recognition. Coba Chrome ya Kak~");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "id-ID";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      setStatus("listening");
      setTranscript("");
      setError("");
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += t;
        else interimTranscript += t;
      }
      setTranscript(finalTranscript || interimTranscript);

      if (finalTranscript.trim()) {
        recognition.stop();
        sendToAi(finalTranscript.trim());
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "no-speech") {
        setStatus("connected");
      } else if (event.error === "not-allowed") {
        setError("Izin mikrofon ditolak. Cek browser settings ya Kak~");
        setStatus("connected");
      } else {
        setStatus("connected");
      }
    };

    recognition.onend = () => {
      if (status === "listening") setStatus("connected");
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopListening() {
    try { recognitionRef.current?.stop(); } catch {}
    recognitionRef.current = null;
  }

  async function sendToAi(text: string) {
    setStatus("thinking");
    stopListening();

    const newHistory = [...history, { role: "user", content: text }];
    setHistory(newHistory);
    setAiReply("");

    try {
      const res = await fetch("/api/conversations/zaidanai/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: newHistory.slice(-10) }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to reach Zaidan AI");
      }

      const data = await res.json();
      const reply = data.reply || "Maaf Kak, aku nggak bisa denger. Coba ulangi ya~";
      setAiReply(reply);
      setModelName(data.model || "");
      setHistory((h) => [...h, { role: "assistant", content: reply }]);

      // Handle music command from AI
      if (data.musicCommand) {
        localStorage.setItem("arcadia_auto_play_music", JSON.stringify(data.musicCommand));
        // Show a brief notification before redirecting
        setAiReply(`${reply}\n\n🎵 Memutar: ${data.musicCommand.title} - ${data.musicCommand.artist}`);
        setTimeout(() => {
          window.location.href = "/member?tab=music";
        }, 2000);
      }

      // Play audio from combined response (no separate TTS call needed!)
      if (data.audio) {
        playAudio(data.audio, data.audioType || "audio/mpeg");
      } else {
        // Fallback: separate TTS call
        speak(reply);
      }
    } catch (err: any) {
      console.error("[Zaidan AI Voice] Error:", err);
      setError(`Zaidan AI lagi sibuk nih Kak, coba tap mic lagi ya~ (${err.message})`);
      setStatus("connected");
    }
  }

  // Play base64 audio from combined voice response
  function playAudio(base64Audio: string, mimeType: string) {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setStatus("speaking");
    const binary = atob(base64Audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onended = () => {
      URL.revokeObjectURL(url);
      audioRef.current = null;
      setTimeout(() => setStatus("connected"), 300);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      audioRef.current = null;
      setTimeout(() => setStatus("connected"), 300);
    };

    audio.play().catch(() => {
      URL.revokeObjectURL(url);
      audioRef.current = null;
      setStatus("connected");
    });
  }

  function toggleListen() {
    if (status === "listening") {
      stopListening();
      setStatus("connected");
    } else if (status === "connected") {
      startListening();
    }
  }

  function hangUp() {
    stopListening();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    speak("Dadah Kak! Senang ngobrol sama Kakak~ Sampai jumpa lagi ya!");
    setTimeout(onClose, 2500);
  }

  const formatDuration = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const statusText = {
    connecting: "Menghubungkan...",
    connected: "Siap ngobrol",
    listening: "Akira mendengarkan... 🎙️",
    thinking: "Akira sedang berpikir...",
    speaking: "Akira sedang bicara... 🔊",
  }[status];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e]">
      {/* Animated background circles */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className={`w-80 h-80 rounded-full border border-white/10 ${status === "listening" || status === "speaking" ? "animate-ping" : ""}`} style={{ animationDuration: "3s" }} />
        <div className={`absolute w-60 h-60 rounded-full border border-white/5 ${status === "listening" || status === "speaking" ? "animate-ping" : ""}`} style={{ animationDuration: "2s", animationDelay: "0.5s" }} />
      </div>

      <div className="relative flex flex-col items-center justify-between w-full max-w-md h-full max-h-[700px] py-12 px-8">
        {/* Top: Timer */}
        <div className="text-center">
          <p className="text-white/50 text-xs font-semibold tracking-widest uppercase">Voice Call</p>
          <p className="text-white text-2xl font-bold mt-1">{formatDuration(callDuration)}</p>
        </div>

        {/* Middle: Avatar + Status */}
        <div className="flex flex-col items-center gap-5">
          <div className={`relative w-32 h-32 rounded-full bg-gradient-to-br from-blue-400 via-cyan-300 to-indigo-500 p-1 ${
            status === "speaking" ? "animate-pulse" : status === "listening" ? "ring-4 ring-green-400/50" : ""
          }`}>
            <div className="w-full h-full rounded-full overflow-hidden bg-[#1a1a2e]">
              <img
                src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=256"
                alt="Akira"
                className="w-full h-full object-cover"
              />
            </div>
            {status === "listening" && (
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
                <Mic className="w-4 h-4 text-white" />
              </div>
            )}
            {status === "speaking" && (
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shadow-lg">
                <Volume2 className="w-4 h-4 text-white" />
              </div>
            )}
          </div>

          <div className="text-center">
            <p className="text-white text-xl font-extrabold">Akira</p>
            <p className="text-white/60 text-xs font-semibold mt-1">AI Assistant • {statusText}</p>
          </div>

          {/* Big Tap to Talk button when connected */}
          {status === "connected" && (
            <button
              onClick={() => startListening()}
              className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex flex-col items-center justify-center transition-all shadow-lg shadow-green-500/30 hover:scale-105 active:scale-95 animate-pulse"
              style={{ animationDuration: "2s" }}
            >
              <Mic className="w-10 h-10 text-white mb-1" />
              <span className="text-white text-[10px] font-bold">TAP TO TALK</span>
            </button>
          )}

          {/* Transcript / Reply area */}
          <div className="w-full max-w-sm space-y-3 min-h-[120px]">
            {transcript && (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mb-1">Kakak</p>
                <p className="text-white text-sm">{transcript}</p>
              </div>
            )}
            {aiReply && (
              <div className="bg-blue-500/20 backdrop-blur-sm rounded-xl px-4 py-3 border border-blue-400/20">
                <p className="text-[10px] text-blue-300/70 font-bold uppercase tracking-wider mb-1">Zaidan AI</p>
                <p className="text-white text-sm">{aiReply}</p>
                {modelName && <p className="text-[10px] text-white/30 mt-1.5">⚡ {modelName}</p>}
              </div>
            )}
            {error && (
              <div className="bg-red-500/20 backdrop-blur-sm rounded-xl px-4 py-3 border border-red-400/20">
                <p className="text-red-300 text-xs">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom: Controls */}
        <div className="flex items-center gap-8">
          {/* Big Mic button - main control */}
          <button
            onClick={toggleListen}
            disabled={status !== "connected" && status !== "listening"}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
              status === "listening"
                ? "bg-green-500 hover:bg-green-600 ring-4 ring-green-400/50 animate-pulse"
                : status === "connected"
                ? "bg-green-500/80 hover:bg-green-500"
                : "bg-white/20"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            title={status === "listening" ? "Stop listening" : "Tap to talk"}
          >
            {status === "listening" ? <MicOff className="w-7 h-7 text-white" /> : <Mic className="w-7 h-7 text-white" />}
          </button>

          {/* Hang up button */}
          <button
            onClick={hangUp}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all shadow-lg shadow-red-500/30"
            title="Hang up"
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </button>
        </div>

        <p className="text-white/40 text-xs text-center mt-4 font-medium">
          {status === "connected" ? "👆 Tap tombol hijau untuk bicara" : status === "listening" ? "🎙️ Bicara sekarang... Akira mendengarkan" : status === "thinking" ? "⏳ Akira sedang berpikir..." : status === "speaking" ? "🔊 Akira sedang bicara..." : ""}
        </p>
      </div>
    </div>
  );
}

function formatMessageDateSeparator(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear();

  if (isToday) {
    return "Today";
  } else if (isYesterday) {
    return "Yesterday";
  } else {
    try {
      return format(d, "dd MMMM yyyy");
    } catch {
      return d.toLocaleDateString();
    }
  }
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function getMessagePreviewText(msg: { content?: string | null; imageUrl?: string | null; attachmentUrl?: string | null }) {
  if (msg.content) return msg.content;
  if (msg.imageUrl) {
    if (msg.imageUrl.startsWith("music:")) return "🎵 Music";
    if (msg.imageUrl.includes("/api/stickers/")) return "🖼️ Stiker";
    return "📷 Foto";
  }
  if (msg.attachmentUrl) return "📁 File Lampiran";
  return "Pesan";
}

function ConvItem({
  conv,
  selected,
  onClick,
  onPin,
  onUnpin,
  onArchive,
  onUnarchive,
  dark = false,
}: {
  conv: ConversationSummary;
  selected: boolean;
  onClick: () => void;
  onPin?: (id: number) => void;
  onUnpin?: (id: number) => void;
  onArchive?: (id: number) => void;
  onUnarchive?: (id: number) => void;
  dark?: boolean;
}) {
  const { data: me } = useGetMe();
  const name =
    conv.type === "dm"
      ? (conv.otherDisplayName ?? conv.otherUsername ?? "Unknown")
      : (conv.name ?? "Group");
  const avatar = conv.type === "dm" ? conv.otherAvatarUrl : conv.iconUrl;
  const isPinned = !!(conv as any).pinnedAt;
  const isArchived = !!(conv as any).archivedAt;

  const menuContent = (
    <>
      {isPinned ? (
        <ContextMenuItem
          className={`gap-2 cursor-pointer text-xs ${dark ? "focus:bg-[#35373C]" : ""}`}
          onSelect={() => onUnpin?.(conv.id)}
        >
          <Pin className="w-3.5 h-3.5" />
          Lepas Pin
        </ContextMenuItem>
      ) : (
        <ContextMenuItem
          className={`gap-2 cursor-pointer text-xs ${dark ? "focus:bg-[#35373C]" : ""}`}
          onSelect={() => onPin?.(conv.id)}
        >
          <Pin className="w-3.5 h-3.5" />
          Pin Chat
        </ContextMenuItem>
      )}
      {isArchived ? (
        <ContextMenuItem
          className={`gap-2 cursor-pointer text-xs ${dark ? "focus:bg-[#35373C]" : ""}`}
          onSelect={() => onUnarchive?.(conv.id)}
        >
          <ArchiveX className="w-3.5 h-3.5" />
          Batal Arsip
        </ContextMenuItem>
      ) : (
        <ContextMenuItem
          className={`gap-2 cursor-pointer text-xs ${dark ? "focus:bg-[#35373C]" : ""}`}
          onSelect={() => onArchive?.(conv.id)}
        >
          <Archive className="w-3.5 h-3.5" />
          Arsipkan Chat
        </ContextMenuItem>
      )}
    </>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="relative group/convitem">
          <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-3 py-3 sm:py-2.5 rounded-xl text-left transition-all ${
              selected
                ? dark ? "bg-[#404249] text-white" : "bg-violet-50 text-[#6366f1]"
                : dark ? "hover:bg-[#35373C] text-[#949BA4] hover:text-[#DCDDDE]" : "hover:bg-slate-50 text-slate-600 hover:text-slate-900"
            }`}
          >
            <div className={`rounded-full shrink-0 flex items-center justify-center p-0.5 overflow-visible ${conv.type === "dm" && (conv as any).otherUserEquippedBorder ? (conv as any).otherUserEquippedBorder : "border border-[#eae8f5]"}`}>
              <Avatar className="w-9 h-9 shrink-0">
                <AvatarImage src={avatar ?? undefined} />
                <AvatarFallback className="text-xs bg-slate-100 font-bold text-[#6366f1]">{getInitials(name)}</AvatarFallback>
              </Avatar>
            </div>
            <div className="min-w-0 flex-1 pr-5 flex flex-col justify-center">
              <div className="flex items-center justify-between gap-1 min-w-0 w-full">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  {isPinned && <Pin className={`w-2.5 h-2.5 shrink-0 flex-none ${dark ? "text-[#5865F2]" : "text-[#6366f1]"}`} />}
                  <span className={`font-bold text-xs truncate block flex-1 ${selected ? dark ? "text-white" : "text-[#6366f1]" : dark ? "text-[#DCDDDE]" : "text-[#110e3d]"}`}>{name}</span>
                  {conv.type === "dm" && (conv as any).otherUserIsVerified && (
                    <BadgeCheck className="w-3 h-3 text-blue-400 fill-blue-400/20 shrink-0 flex-none" />
                  )}
                  {conv.type === "dm" && (conv as any).otherUserIsBusinessVerified && (
                    <BadgeCheck className="w-3 h-3 text-emerald-500 fill-emerald-500/20 shrink-0 flex-none" />
                  )}
                  {conv.type === "group" && (conv as any).isVerified && (
                    <BadgeCheck className="w-3 h-3 text-blue-400 fill-blue-400/20 shrink-0 flex-none" />
                  )}
                  {conv.type === "dm" && conv.otherUserRole && conv.otherUserRole !== "member" && (
                    <Badge className={`text-[8px] px-1 py-0 h-3 leading-none shrink-0 font-medium rounded ${ROLE_BADGE_CLASSES[conv.otherUserRole] ?? ""}`}>
                      {ROLE_LABELS[conv.otherUserRole] ?? conv.otherUserRole}
                    </Badge>
                  )}
                </div>
                {conv.type === "group" && (
                  <Badge variant="secondary" className={`text-[9px] shrink-0 hover:bg-opacity-80 ${dark ? "bg-[#35373C] text-[#949BA4] border border-[#3F4147]" : "bg-violet-50 text-[#6366f1] hover:bg-violet-50 border border-violet-100"}`}>
                    Group
                  </Badge>
                )}
              </div>
              {conv.lastMessageContent && (
                <p className={`text-[10px] font-bold mt-0.5 ${dark ? "text-[#949BA4]" : "text-slate-400"} flex items-center gap-1 min-w-0 w-full`}>
                  {conv.lastMessageSenderId === me?.id && (
                    <span className={`text-[11px] font-black select-none leading-none shrink-0 ${dark ? "text-[#5865F2]" : "text-[#34b7f1]"}`}>✓✓</span>
                  )}
                  <span className="truncate block flex-1">{conv.lastMessageContent}</span>
                </p>
              )}
            </div>
          </button>
          {/* Chevron button — visible on hover, triggers dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/convitem:opacity-100 transition-opacity rounded-md p-0.5 z-10 ${dark ? "hover:bg-[#404249] text-[#949BA4] hover:text-white" : "hover:bg-slate-200 text-slate-400"}`}
                onClick={(e) => e.stopPropagation()}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className={dark ? "bg-[#18191c] border-[#3F4147] text-[#DCDDDE] min-w-[160px]" : "bg-white border-slate-200 min-w-[160px]"}
            >
              {isPinned ? (
                <DropdownMenuItem className="gap-2 cursor-pointer text-xs" onSelect={() => onUnpin?.(conv.id)}>
                  <Pin className="w-3.5 h-3.5" /> Lepas Pin
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem className="gap-2 cursor-pointer text-xs" onSelect={() => onPin?.(conv.id)}>
                  <Pin className="w-3.5 h-3.5" /> Pin Chat
                </DropdownMenuItem>
              )}
              {isArchived ? (
                <DropdownMenuItem className="gap-2 cursor-pointer text-xs" onSelect={() => onUnarchive?.(conv.id)}>
                  <ArchiveX className="w-3.5 h-3.5" /> Batal Arsip
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem className="gap-2 cursor-pointer text-xs" onSelect={() => onArchive?.(conv.id)}>
                  <Archive className="w-3.5 h-3.5" /> Arsipkan Chat
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className={dark ? "bg-[#18191c] border-[#3F4147] text-[#DCDDDE] min-w-[160px]" : "bg-white border-slate-200 min-w-[160px]"}>
        {menuContent}
      </ContextMenuContent>
    </ContextMenu>
  );
}

// Extract a premium gift code from message content that contains a redeem link
// like ".../premium?gift=gft_abc123". Returns the code or null.
function extractGiftCodeFromContent(content: string | null | undefined): string | null {
  if (!content) return null;
  const m = content.match(/[?&]gift=([a-zA-Z0-9_]+)/);
  return m ? m[1] : null;
}

// Nitro-style gift card rendered inside a chat message; the recipient can
// redeem the membership directly with one click. The buyer can't redeem
// their own gift (enforced server-side).
function GiftCardMessage({ code, isGroup }: { code: string; isGroup?: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [redeemed, setRedeemed] = useState(false);
  const redeem = useMutation({
    mutationFn: async () => customFetch<any>("/api/payments/gifts/redeem", {
      method: "POST",
      body: JSON.stringify({ code }),
      headers: { "Content-Type": "application/json" },
    }),
    onSuccess: async (res: any) => {
      setRedeemed(true);
      toast({ title: "Hadiah diterima! 🎉", description: `Membership ${res?.tier === "premium_plus" ? "Premium+" : "Premium"} sudah aktif di akunmu.` });
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/me/membership"] });
    },
    onError: (err: any) => {
      toast({ title: "Gagal redeem", description: err?.message || "Gift code tidak valid atau sudah dipakai.", variant: "destructive" });
    },
  });
  return (
    <div className={`my-1 w-[230px] max-w-full rounded-2xl overflow-hidden border ${isGroup ? "border-[#3F4147]" : "border-[#eae8f5]"}`}>
      <div className="bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 px-4 py-3 flex items-center gap-2">
        <Gift className="w-6 h-6 text-white" />
        <div className="leading-tight">
          <p className="text-white font-black text-sm">Hadiah Membership</p>
          <p className="text-white/80 text-[10px] font-bold">Premium Gift untukmu</p>
        </div>
      </div>
      <div className={`p-3 ${isGroup ? "bg-[#2B2D31]" : "bg-white"}`}>
        <Button
          onClick={() => redeem.mutate()}
          disabled={redeem.isPending || redeemed}
          className="w-full bg-[#6366f1] hover:bg-violet-700 text-white font-bold rounded-xl text-xs h-9 disabled:opacity-60"
        >
          {redeemed ? "✓ Sudah Diredeem" : redeem.isPending ? "Memproses..." : "Redeem Sekarang"}
        </Button>
      </div>
    </div>
  );
}

function MessageBubble({
  msg,
  isOwn,
  onDelete,
  onForward,
  onUserClick,
  isGroup = false,
  onReply,
  onPin,
  onStar,
  onReact,
  onBubbleClick,
  me,
  customEmojis = [],
  currentConversationId = null,
  onPlayMusic,
  isAnyOtherMemberOnline = false,
}: {
  msg: Message;
  isOwn: boolean;
  onDelete?: () => void;
  onForward?: () => void;
  onUserClick?: () => void;
  isGroup?: boolean;
  onReply?: () => void;
  onPin?: () => void;
  onStar?: () => void;
  onReact?: (emoji: string) => void;
  onBubbleClick?: (e: React.MouseEvent, msg: Message) => void;
  me: any;
  customEmojis?: any[];
  currentConversationId?: number | null;
  onPlayMusic?: (title: string, artist: string) => void;
  isAnyOtherMemberOnline?: boolean;
}) {
  const isWebhook = !!(msg as any).webhookName;
  const name = (msg as any).webhookName ?? msg.senderDisplayName ?? msg.senderUsername ?? "Unknown";
  const avatarUrl = (msg as any).webhookAvatarUrl ?? msg.senderAvatarUrl ?? undefined;
  const [isZoomed, setIsZoomed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const isMusicCommandMsg = !!msg.imageUrl && typeof msg.imageUrl === "string" && msg.imageUrl.startsWith("music:");
  const realImageUrl = isMusicCommandMsg ? null : msg.imageUrl;
  const isStickerMessage = !!realImageUrl && realImageUrl.includes("/api/stickers/");
  const isForwarded = !!(msg as any).forwardedFromMessageId;
  const isDeleted = !!(msg as any).deletedAt;
  const msgType = (msg as any).messageType ?? "text";

  if (msgType === "system_join" || msgType === "system_added") {
    return (
      <div className="flex items-center justify-center py-1.5 px-4 my-0.5">
        <div className={`flex items-center gap-2 border rounded-full px-4 py-1 text-xs italic select-none ${isGroup ? "bg-white/5 border-white/10 text-[#949BA4]" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
          <span>{msgType === "system_join" ? "🔗" : "➕"}</span>
          <span>{msg.content}</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`relative group/bubble flex flex-col max-w-full mb-1`}>
        <div className={`flex items-start gap-2 max-w-full ${isOwn ? "flex-row-reverse" : ""}`} id={`message-${msg.id}`}>
          {!isOwn && (
            <button
              type="button"
              onClick={onUserClick}
              className={`rounded-full shrink-0 flex items-center justify-center p-0.5 overflow-visible mt-0.5 cursor-pointer ${(msg as any).senderEquippedBorder ? (msg as any).senderEquippedBorder : isGroup ? "border border-[#3F4147]" : "border border-[#d7e4de]"}`}
            >
              <Avatar className="w-8 h-8 shrink-0">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback className={`text-[10px] font-bold ${isGroup ? "bg-[#2B2D31] text-[#DCDDDE]" : "bg-[#edf5f1] text-[#0b6b58]"}`}>{getInitials(name)}</AvatarFallback>
              </Avatar>
            </button>
          )}
          <div
            className={`min-w-0 flex flex-col gap-1 relative ${isOwn ? "items-end max-w-[82%] sm:max-w-[72%]" : "items-start max-w-[calc(100%-44px)] sm:max-w-[72%]"}`}
          >
            <div className={`flex items-center gap-2 px-1 ${isOwn ? "flex-row-reverse" : ""}`}>
              {(!isOwn || (msg.senderRole && msg.senderRole !== "member")) && (
                <div className={`flex items-center gap-1.5 ${isOwn ? "flex-row-reverse" : ""}`}>
                  {!isOwn && (
                    <button
                      type="button"
                      onClick={onUserClick}
                      className={`text-[11px] font-extrabold hover:underline cursor-pointer ${isGroup ? "text-[#DCDDDE]" : "text-[#075e54]"}`}
                    >
                      {name}
                    </button>
                  )}
                  {isWebhook && (
                    <Badge className="text-[8px] px-1.5 py-0 h-3.5 leading-none shrink-0 font-bold rounded bg-[#5865F2] text-white hover:bg-[#5865F2]">
                      WEBHOOK
                    </Badge>
                  )}
                  {(msg as any).senderIsVerified && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center">
                            <BadgeCheck className="w-3.5 h-3.5 text-blue-400 fill-blue-400/20 shrink-0" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">Akun Terverifikasi</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {msg.senderRole && msg.senderRole !== "member" && (
                    <Badge className={`text-[8px] px-1.5 py-0 h-3.5 leading-none shrink-0 font-medium rounded ${ROLE_BADGE_CLASSES[msg.senderRole] ?? ""}`}>
                      {ROLE_LABELS[msg.senderRole] ?? msg.senderRole}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div
              className={`relative max-w-full overflow-hidden rounded-2xl cursor-pointer ${isStickerMessage ? "px-2 py-2 bg-transparent shadow-none" : "px-3.5 py-2.5 text-[14px] leading-relaxed shadow-sm whitespace-pre-wrap [overflow-wrap:anywhere]"} ${
                isOwn
                  ? isGroup ? "bg-[#005c4b] text-white rounded-tr-[4px]" : "bg-[#dcf8c6] text-[#18251f] rounded-tr-[4px]"
                  : isGroup ? "bg-[#2B2D31] text-[#DCDDDE] rounded-tl-[4px]" : "bg-white border border-[#dfe8e3] text-[#18251f] rounded-tl-[4px]"
              }`}
              onClick={(e) => {
                if (isDeleted) return;
                const target = e.target as HTMLElement;
                if (
                  target.closest('button') || 
                  target.closest('a') || 
                  target.closest('.download-btn') ||
                  window.getSelection()?.toString()
                ) {
                  return;
                }
                if (target.tagName === 'IMG' || target.closest('.cursor-zoom-in')) {
                  setIsZoomed(true);
                  return;
                }
                e.preventDefault();
                e.stopPropagation();
                onBubbleClick?.(e, msg);
              }}
              onContextMenu={(e) => {
                if (isDeleted) return;
                e.preventDefault();
                e.stopPropagation();
                onBubbleClick?.(e, msg);
              }}
            >
              {!isDeleted && msg.replyToMessageId && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    const el = document.getElementById(`message-${msg.replyToMessageId}`);
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "center" });
                      el.classList.add("bg-yellow-500/20", "transition-all", "duration-500");
                      setTimeout(() => el.classList.remove("bg-yellow-500/20"), 2000);
                    }
                  }}
                  className={`mb-2 rounded-lg border-l-[4px] p-2 text-xs flex flex-col gap-0.5 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors select-none min-w-0 overflow-hidden ${
                    isGroup
                      ? isOwn
                        ? "bg-black/20 border-violet-400 text-slate-200"
                        : "bg-black/25 border-violet-500 text-slate-300"
                      : isOwn
                        ? "bg-[#cfe9ba] border-[#075e54] text-[#3c5046]"
                        : "bg-[#f0f5f2] border-[#075e54] text-[#4a5e55]"
                  }`}
                >
                  <span className={`font-black text-[10.5px] uppercase tracking-wide truncate ${
                    isGroup
                      ? isOwn
                        ? "text-violet-300"
                        : "text-violet-400"
                      : "text-[#075e54]"
                  }`}>
                    @{msg.replyToMessageSenderUsername || "someone"}
                  </span>
                  <span className="opacity-90 line-clamp-2 text-[11px]">
                    {msg.replyToMessageContent || "Media/Lampiran"}
                  </span>
                </div>
              )}
              {isForwarded && (
                <div className={`mb-1 text-[9px] font-black uppercase tracking-widest ${isGroup ? "text-[#8f97a3]" : "text-slate-400"}`}>
                  forwarded
                </div>
              )}
              {isDeleted && (
                <div className={`mb-1 text-[9px] font-black uppercase tracking-widest ${isGroup ? "text-[#ffb4b4]" : "text-rose-400"}`}>
                  deleted message
                </div>
              )}
              {realImageUrl && !imageFailed && (
                <div 
                  className={`${isStickerMessage ? "mb-0 max-w-[160px] sm:max-w-[180px]" : "mb-2 max-w-sm"} rounded-lg overflow-hidden cursor-zoom-in hover:brightness-95 transition-all duration-200`}
                  onClick={() => setIsZoomed(true)}
                >
                  <img
                    src={realImageUrl || undefined}
                    alt="Chat attachment"
                    className={`w-full h-auto ${isStickerMessage ? "object-contain max-h-40 border-0 drop-shadow-sm" : "object-cover max-h-64 rounded-md border border-black/5"}`}
                    onError={() => setImageFailed(true)}
                  />
                </div>
              )}
              {realImageUrl && imageFailed && (
                <a
                  href={realImageUrl!}
                  target="_blank"
                  rel="noreferrer"
                  className="mb-2 block rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100"
                >
                  Image failed to load. Open image
                </a>
              )}
              {(msg as any).attachmentUrl && (
                <div className={`mb-2 flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2 ${
                  isGroup ? "border-[#3F4147] bg-black/10" : "border-[#dfe8e3] bg-white/70"
                }`}>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    isOwn ? "bg-white/20 text-white" : isGroup ? "bg-[#35373C] text-[#DCDDDE]" : "bg-[#edf5f1] text-[#075e54]"
                  }`}>
                    <File className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black">{(msg as any).attachmentName || "Attachment"}</p>
                    <p className={`truncate text-[10px] font-semibold ${isOwn ? "text-white/70" : isGroup ? "text-[#949BA4]" : "text-slate-500"}`}>
                      {formatFileSize((msg as any).attachmentSize)}{(msg as any).attachmentMime ? ` • ${(msg as any).attachmentMime}` : ""}
                    </p>
                  </div>
                  <a
                    href={(msg as any).attachmentUrl}
                    download={(msg as any).attachmentName || true}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-2 text-[10px] font-black transition-colors ${
                      isOwn ? "bg-white/20 text-white hover:bg-white/30" : isGroup ? "bg-[#5865F2] text-white hover:bg-[#4752C4]" : "bg-[#075e54] text-white hover:bg-[#064f46]"
                    }`}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Save As Download
                  </a>
                </div>
              )}
              {msg.content && (() => {
                const musicCmd = parseMusicCommandFromMsg(msg);
                const giftCode = extractGiftCodeFromContent(msg.content);
                let displayContent = musicCmd ? stripMusicCommand(msg.content) : msg.content;
                // Hide the raw redeem URL — the gift card replaces it.
                if (giftCode) displayContent = displayContent.replace(/\S*[?&]gift=[a-zA-Z0-9_]+\S*/g, "").trim();
                return (
                  <>
                    {displayContent && <span className="block min-w-0 pb-3 pr-10 [overflow-wrap:anywhere]">{renderMessageTextWithEmojis(displayContent, customEmojis, currentConversationId)}</span>}
                    {giftCode && <GiftCardMessage code={giftCode} isGroup={isGroup} />}
                    {musicCmd && (
                      <button
                        type="button"
                        onClick={() => {
                          if (onPlayMusic) {
                            onPlayMusic(musicCmd.title, musicCmd.artist);
                          }
                        }}
                        className={`block w-full mt-1 mb-3 rounded-lg p-2.5 flex items-center gap-2.5 transition-all hover:scale-[1.02] cursor-pointer border ${
                          isGroup
                            ? "bg-[#1E1F22] border-[#3F4147] hover:bg-[#26282C]"
                            : "bg-[#edf5f1] border-[#d0e3db] hover:bg-[#e0efe8]"
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isGroup ? "bg-[#5865F2]" : "bg-[#0b6b58]"}`}>
                          <Music className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className={`text-xs font-bold truncate ${isGroup ? "text-[#DCDDDE]" : "text-[#18251f]"}`}>{musicCmd.title}</p>
                          <p className={`text-[10px] font-semibold truncate ${isGroup ? "text-[#949BA4]" : "text-[#66756f]"}`}>{musicCmd.artist}</p>
                          <p className={`text-[9px] mt-0.5 ${isGroup ? "text-[#5865F2]" : "text-[#0b6b58]"}`}>Tap to play</p>
                        </div>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isGroup ? "bg-[#5865F2]" : "bg-[#0b6b58]"}`}>
                          <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
                        </div>
                      </button>
                    )}
                  </>
                );
              })()}
              <span className={`absolute ${isStickerMessage ? "bottom-0.5 right-1.5" : "bottom-1.5 right-3"} text-[9px] font-semibold ${isGroup ? "text-[#949BA4]" : "text-[#66756f]"} flex items-center gap-1`}>
                {msg.pinned && <Pin className="w-2.5 h-2.5 rotate-45 shrink-0 text-sky-400" />}
                {msg.starred && <Star className="w-2.5 h-2.5 fill-current text-amber-400 shrink-0" />}
                <span>{format(new Date(msg.createdAt), "HH:mm")}</span>
                {isOwn && (
                  <span className={`text-[11px] font-bold select-none leading-none ${
                    (msg as any).isRead
                      ? isGroup ? "text-[#5865F2]" : "text-[#34b7f1]"
                      : "text-slate-400 dark:text-slate-500"
                  }`}>✓✓</span>
                )}
              </span>
            </div>

            {/* Reactions badges underneath bubble */}
            {msg.reactions && msg.reactions.length > 0 && (
              <div className={`flex flex-wrap gap-1.5 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
                {msg.reactions.map((react, i) => (
                  <TooltipProvider key={i}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => onReact?.(react.emoji)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold transition-all border shadow-sm cursor-pointer ${
                            react.userReacted
                              ? isGroup ? "bg-[#5865F2]/20 border-[#5865F2] text-white" : "bg-[#edf5f1] border-[#0b6b58] text-[#0b6b58]"
                              : isGroup ? "bg-[#2B2D31]/40 border-[#3F4147] text-[#DCDDDE] hover:bg-[#35373C]" : "bg-white border-[#dfe8e3] text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <span>{react.emoji}</span>
                          <span className="text-[10px] font-black">{react.count}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs max-w-[200px]">
                        <p className="font-bold">Direaksikan oleh:</p>
                        <p className="opacity-90">{react.usernames?.join(", ") || "Tidak ada username"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            )}

            {/* Premium Hover Action Menu */}
            {!isDeleted && (
              <div className={`absolute top-0 -translate-y-1/2 opacity-0 group-hover/bubble:opacity-100 transition-all duration-150 z-20 flex items-center gap-1 bg-[#1e1f22]/90 border border-slate-700/60 rounded-xl px-2 py-1 shadow-lg backdrop-blur-md ${isOwn ? "left-2" : "right-2"}`}>
                <div className="flex items-center gap-1 border-r border-slate-700/60 pr-1.5 mr-1">
                  {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => onReact?.(emoji)}
                      className="hover:scale-125 transition-transform px-0.5 text-sm cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <button
                  onClick={onReply}
                  title="Balas"
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <CornerUpLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onStar}
                  title={msg.starred ? "Hapus Bintang" : "Bintangi"}
                  className={`p-1 rounded hover:bg-white/10 transition-colors cursor-pointer ${msg.starred ? "text-yellow-400 hover:text-yellow-300" : "text-slate-400 hover:text-white"}`}
                >
                  <Star className={`w-3.5 h-3.5 ${msg.starred ? "fill-current" : ""}`} />
                </button>
                <button
                  onClick={onPin}
                  title={msg.pinned ? "Lepas Sematan" : "Sematkan"}
                  className={`p-1 rounded hover:bg-white/10 transition-colors cursor-pointer ${msg.pinned ? "text-cyan-400 hover:text-cyan-300" : "text-slate-400 hover:text-white"}`}
                >
                  <Pin className={`w-3.5 h-3.5 ${msg.pinned ? "fill-current" : ""}`} />
                </button>
                {onForward && (
                  <button
                    onClick={onForward}
                    title="Forward"
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <Forward className="w-3.5 h-3.5" />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={onDelete}
                    title="Hapus"
                    className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={isZoomed} onOpenChange={setIsZoomed}>
        <DialogContent className="max-w-4xl p-1 bg-transparent border-0 shadow-none flex items-center justify-center">
          <div className="relative max-h-[90vh] max-w-full overflow-hidden rounded-lg">
            <img
              src={realImageUrl || undefined}
              alt="Zoomed attachment"
              className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-2xl border border-[#eae8f5]"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function MessagesPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: me, isLoading: meLoading } = useGetMe();
  const [, setLocation] = useLocation();
  const { data: blockedUsers = [] } = useQuery<Array<{ userId: number }>>({
    queryKey: ["/api/me/blocks"],
    queryFn: () => customFetch<any>("/api/me/blocks"),
    staleTime: 60_000,
  });
  const blockedIdsSet = useMemo(() => new Set(blockedUsers.map(b => b.userId)), [blockedUsers]);

  const pinConvMutation = useMutation({
    mutationFn: (convId: number) => customFetch<any>(`/api/conversations/${convId}/pin`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/conversations", "messages-page"] }),
  });
  const unpinConvMutation = useMutation({
    mutationFn: (convId: number) => customFetch<any>(`/api/conversations/${convId}/pin`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/conversations", "messages-page"] }),
  });
  const archiveConvMutation = useMutation({
    mutationFn: (convId: number) => customFetch<any>(`/api/conversations/${convId}/archive`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/conversations", "messages-page"] }),
  });
  const unarchiveConvMutation = useMutation({
    mutationFn: (convId: number) => customFetch<any>(`/api/conversations/${convId}/archive`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/conversations", "messages-page"] }),
  });
  const [showArchived, setShowArchived] = useState(false);

  // Call Music Player States
  const callAudioRef = useRef<HTMLAudioElement | null>(null);
  const [showMusicPlayer, setShowMusicPlayer] = useState(false);
  const [callPlayingTrack, setCallPlayingTrack] = useState<any | null>(null);
  const [callIsPlaying, setCallIsPlaying] = useState(false);
  const [callVolume, setCallVolume] = useState(0.5);
  const [callMusicMuted, setCallMusicMuted] = useState(false);
  const [callAutoPlayMusic, setCallAutoPlayMusic] = useState(true);
  const [lastPlayedCallMsgId, setLastPlayedCallMsgId] = useState<number | null>(null);
  const [musicSearchQuery, setMusicSearchQuery] = useState("");
  const [musicTracks, setMusicTracks] = useState<any[]>([]);
  const [loadingMusicTracks, setLoadingMusicTracks] = useState(false);

  const { data: realmSettings = {} } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: () => customFetch<any>("/api/settings"),
  });
  const { data: activeStories = [], refetch: refetchStories } = useQuery<any[]>({
    queryKey: ["/api/statuses"],
    queryFn: () => customFetch<any>("/api/statuses"),
    refetchInterval: 30000,
  });
  const { signOut } = useClerk();
  const realmName = realmSettings.realmName || "Arcadia Guild";
  const realmLogoUrl = realmSettings.realmLogoUrl || "";

  // ── Gift Membership (Premium / Premium+) ────────────────────────────────────
  const [showGiftDialog, setShowGiftDialog] = useState(false);
  const giftPremiumPrice = realmSettings.giftPremiumPrice ?? realmSettings.premiumPrice ?? 25000;
  const giftPremiumPlusPrice = realmSettings.giftPremiumPlusPrice ?? realmSettings.premiumPlusPrice ?? 50000;
  const giftMutation = useMutation({
    mutationFn: async (tier: "premium" | "premium_plus") => customFetch<any>("/api/payments/gifts", {
      method: "POST",
      body: JSON.stringify({ tier }),
      headers: { "Content-Type": "application/json" },
    }),
    onSuccess: (res: any) => {
      toast({ title: "Mengarahkan ke pembayaran...", description: "Mohon tunggu sebentar ya~" });
      if (res && res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      }
    },
    onError: (err: any) => {
      toast({ title: "Gagal membeli gift", description: err?.message || "Terjadi kesalahan.", variant: "destructive" });
    },
  });
  // Gifts I bought — "active" = sudah dibayar & siap dibagikan ke orang lain.
  const { data: myGifts = [] } = useQuery<any[]>({
    queryKey: ["/api/me/gifts"],
    queryFn: () => customFetch<any[]>("/api/me/gifts"),
    enabled: showGiftDialog,
  });

  // ── Join Group via Invite Link ──────────────────────────────────────────────
  const [newGroupMode, setNewGroupMode] = useState<"create" | "join">("create");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  // Accept a full invite URL or a raw code and extract the code part.
  function extractInviteCode(raw: string): string {
    const v = raw.trim();
    if (!v) return "";
    const byPath = v.match(/(?:\/invite\/|\/join\/|inviteCode=)([a-zA-Z0-9-_]+)/);
    if (byPath) return byPath[1];
    return v.replace(/[^a-zA-Z0-9-_]/g, "");
  }
  const joinGroupMutation = useMutation({
    mutationFn: async (code: string) => customFetch<any>(`/api/invites/${encodeURIComponent(code)}/join`, {
      method: "POST",
    }),
    onSuccess: async (res: any) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setShowNewGroup(false);
      setJoinCodeInput("");
      setNewGroupMode("create");
      if (res?.conversationId) setSelectedId(res.conversationId);
      toast({ title: "Berhasil gabung!", description: "Kamu sekarang anggota grup ini." });
    },
    onError: (err: any) => {
      toast({ title: "Gagal gabung grup", description: err?.message || "Invite link tidak valid atau sudah kedaluwarsa.", variant: "destructive" });
    },
  });

  function giftRedeemUrl(code: string) {
    return `${window.location.origin}/premium?gift=${code}`;
  }

  // Generate / regenerate a random invite code for the selected group.
  // Custom (chosen) codes stay exclusive to verified groups.
  const generateInviteMutation = useMutation({
    mutationFn: async (regenerate: boolean) => customFetch<any>(`/api/conversations/${selectedId}/invite`, {
      method: "POST",
      body: JSON.stringify({ regenerate }),
      headers: { "Content-Type": "application/json" },
    }),
    onSuccess: async (res: any) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      if (res?.inviteCode) {
        const link = `${window.location.origin}/join/${res.inviteCode}`;
        navigator.clipboard.writeText(link);
        toast({ title: "Kode invite siap & disalin!", description: link });
      }
    },
    onError: (err: any) => {
      toast({ title: "Gagal membuat kode invite", description: err?.message || "Terjadi kesalahan.", variant: "destructive" });
    },
  });

  // Send a paid gift's redeem link as a message into the currently open chat
  // (works for both a group and a DM with another person).
  async function shareGiftToCurrentChat(gift: any) {
    if (!selectedId) {
      toast({ title: "Buka chat dulu", description: "Pilih group atau orang dulu untuk mengirim hadiah.", variant: "destructive" });
      return;
    }
    const tierLabel = gift.tier === "premium_plus" ? "Premium+" : "Premium";
    const content = `🎁 Aku ngirim hadiah membership ${tierLabel} buat kamu! Klik buat redeem: ${giftRedeemUrl(gift.giftCode)}`;
    try {
      if (isGroup && selectedChannelId) {
        const res = await fetch(`/api/conversations/${selectedId}/channels/${selectedChannelId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        if (!res.ok) throw new Error("Failed to send");
        await queryClient.invalidateQueries({ queryKey: ["channel-messages", selectedId, selectedChannelId] });
      } else {
        await sendMessage.mutateAsync({ id: selectedId, data: { content } });
        await queryClient.invalidateQueries({ queryKey: [`/api/conversations/${selectedId}/messages`] });
      }
      toast({ title: "Hadiah terkirim!", description: "Link redeem sudah dikirim ke chat ini." });
      setShowGiftDialog(false);
    } catch {
      toast({ title: "Gagal mengirim", description: "Tidak bisa mengirim hadiah ke chat ini.", variant: "destructive" });
    }
  }

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState<"text" | "voice" | "announce" | "forum">("text");
  const [newChannelCategoryId, setNewChannelCategoryId] = useState<number | null>(null);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [showChannelEditor, setShowChannelEditor] = useState(false);
  const [movingChannelId, setMovingChannelId] = useState<number | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showRoles, setShowRoles] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#5865F2");
  const [newRolePerms, setNewRolePerms] = useState<Record<string, boolean>>({
    sendMessages: true,
    manageChannels: false,
    manageRoles: false,
    manageMessages: false,
    kickMembers: false,
    inviteMembers: false,
    inviteBot: false,
    postAnnouncements: false,
  });
  const [messageText, setMessageText] = useState("");
  const [showNewDm, setShowNewDm] = useState(false);
  const [showAddFriendDialog, setShowAddFriendDialog] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [profilePreviewUser, setProfilePreviewUser] = useState<ProfilePreviewUser | null>(null);
  const [showCall, setShowCall] = useState(false);
  const [callType, setCallType] = useState<"voice" | "video" | null>(null);
  const [isCallMinimized, setIsCallMinimized] = useState(false);
  const [callContext, setCallContext] = useState<{
    conversationId: number;
    conversationName: string;
    channelId: number | null;
    channelName: string | null;
  } | null>(null);
  const [showEditChannelModal, setShowEditChannelModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [editChannelName, setEditChannelName] = useState("");
  const [editChannelCategoryId, setEditChannelCategoryId] = useState<number | null>(null);

  // ── Channel Webhooks (Discord-style) ────────────────────────────────────────
  const [newWebhookName, setNewWebhookName] = useState("");
  const { data: channelWebhooks = [], refetch: refetchWebhooks } = useQuery<any[]>({
    queryKey: ["/api/channels", editingChannel?.id, "webhooks"],
    queryFn: () => customFetch<any[]>(`/api/channels/${editingChannel!.id}/webhooks`),
    enabled: showEditChannelModal && !!editingChannel?.id,
  });
  const createWebhookMutation = useMutation({
    mutationFn: async () => customFetch<any>(`/api/channels/${editingChannel!.id}/webhooks`, {
      method: "POST",
      body: JSON.stringify({ name: newWebhookName.trim() }),
      headers: { "Content-Type": "application/json" },
    }),
    onSuccess: async () => {
      setNewWebhookName("");
      await refetchWebhooks();
      toast({ title: "Webhook dibuat", description: "Salin URL-nya untuk dipakai dari layanan luar." });
    },
    onError: (err: any) => {
      toast({ title: "Gagal membuat webhook", description: err?.message || "Terjadi kesalahan.", variant: "destructive" });
    },
  });
  const deleteWebhookMutation = useMutation({
    mutationFn: async (id: number) => customFetch<any>(`/api/webhooks/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await refetchWebhooks();
      toast({ title: "Webhook dihapus" });
    },
    onError: (err: any) => {
      toast({ title: "Gagal menghapus", description: err?.message || "Terjadi kesalahan.", variant: "destructive" });
    },
  });
  function webhookUrl(wh: any) {
    return `${window.location.origin}/api/webhooks/${wh.id}/${wh.token}`;
  }
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ChannelCategory | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [showAkiraCall, setShowAkiraCall] = useState(false);
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupDesc, setEditGroupDesc] = useState("");
  const [editGroupIcon, setEditGroupIcon] = useState("");
  const [editGroupBanner, setEditGroupBanner] = useState("");
  const [editGroupBgVideo, setEditGroupBgVideo] = useState("");
  const [editGroupInviteCode, setEditGroupInviteCode] = useState("");
  const [editGroupSaving, setEditGroupSaving] = useState(false);
  const [leaveGroupModalOpen, setLeaveGroupModalOpen] = useState(false);
  const [reportGroupModalOpen, setReportGroupModalOpen] = useState(false);
  const [reportGroupReason, setReportGroupReason] = useState("");
  const [reportGroupCategory, setReportGroupCategory] = useState("Spam");
  const [reportGroupSubmitting, setReportGroupSubmitting] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState<number[]>([]);
  const [dmSearch, setDmSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [globalSearchType, setGlobalSearchType] = useState<"all" | "users" | "messages">("all");

  const [activeView, setActiveView] = useState<"chat" | "shop" | "quests">("chat");
  const [questProgress, setQuestProgress] = useState<Record<number, { current: number; claimed: boolean }>>({});

  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [searchUsername, setSearchUsername] = useState("");
  const [searching, setSearching] = useState(false);
  const [addFriendQrCopied, setAddFriendQrCopied] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!showAddFriendDialog) {
      setIsScanning(false);
      setSearchUsername("");
      setScanError(null);
    }
  }, [showAddFriendDialog]);

  useEffect(() => {
    let animationFrameId: number;

    const scanLoop = () => {
      if (!videoRef.current || !isScanning) return;
      
      const video = videoRef.current;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const canvas = canvasRef.current || document.createElement("canvas");
        const context = canvas.getContext("2d");
        
        if (context) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const jsQR = (window as any).jsQR;
          
          if (jsQR) {
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "dontInvert",
            });
            
            if (code) {
              const text = code.data;
              let targetUser = text;
              if (text.includes("/add-friend/")) {
                const parts = text.split("/add-friend/");
                targetUser = parts[parts.length - 1];
              }
              
              if (targetUser) {
                toast({ title: "Player scanned!", description: `Resolving profile for ${targetUser}...` });
                setIsScanning(false);
                setShowAddFriendDialog(false);
                setLocation(`/add-friend/${encodeURIComponent(targetUser)}`);
                return;
              }
            }
          }
        }
      }
      animationFrameId = requestAnimationFrame(scanLoop);
    };

    if (isScanning) {
      const scriptId = "jsqr-cdn-script";
      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
        document.body.appendChild(script);
      }

      // Wait a tick for React to render the <video> element into the DOM
      const startCamera = () => {
        if (!videoRef.current) return;
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
          .then((stream) => {
            streamRef.current = stream;
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              videoRef.current.setAttribute("playsinline", "true");
              videoRef.current.play();
              animationFrameId = requestAnimationFrame(scanLoop);
            }
          })
          .catch((err) => {
            console.error("Camera access failed:", err);
            setScanError("Camera access denied or not available.");
            setIsScanning(false);
          });
      };

      // Use requestAnimationFrame to wait for React render cycle
      requestAnimationFrame(() => requestAnimationFrame(startCamera));
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isScanning]);

  const handleSearchAndAdd = async () => {
    if (!searchUsername.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/users/resolve/${encodeURIComponent(searchUsername.trim())}`);
      if (!res.ok) {
        throw new Error("Player not found");
      }
      const data = await res.json();
      setShowAddFriendDialog(false);
      setLocation(`/add-friend/${encodeURIComponent(data.username)}`);
    } catch (err: any) {
      toast({ title: "Player not found", description: "Username is not registered on this server.", variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  // Load progress when user changes
  useEffect(() => {
    if (!me?.id) return;
    try {
      const stored = localStorage.getItem(`arcadia-quest-progress-v2-${me.id}`);
      if (stored) {
        setQuestProgress(JSON.parse(stored));
      } else {
        setQuestProgress({});
      }
    } catch {
      setQuestProgress({});
    }
  }, [me?.id]);

  // Save progress when it changes
  useEffect(() => {
    if (!me?.id) return;
    localStorage.setItem(`arcadia-quest-progress-v2-${me.id}`, JSON.stringify(questProgress));
  }, [questProgress, me?.id]);

  const { data: dbQuests, isLoading: questsLoading } = useQuery<any[]>({
    queryKey: ["/api/quests"],
    queryFn: () => customFetch<any[]>("/api/quests"),
  });

  const quests = dbQuests?.map((q: any) => {
    const prog = questProgress[q.id] || { current: 0, claimed: false };
    return {
      ...q,
      current: prog.current,
      claimed: prog.claimed,
    };
  }) || [];

  useEffect(() => {
    if (selectedId !== null) {
      setActiveView("chat");
    }
  }, [selectedId]);

  const triggerQuestProgress = (questId: number, amount = 1) => {
    const questDef = dbQuests?.find((q: any) => q.id === questId);
    if (!questDef) return;

    setQuestProgress((prev) => {
      const prog = prev[questId] || { current: 0, claimed: false };
      if (prog.claimed) return prev;
      const nextVal = Math.min(questDef.target, prog.current + amount);
      return {
        ...prev,
        [questId]: { ...prog, current: nextVal }
      };
    });
  };

  const { data: gachaBoard } = useQuery<any>({
    queryKey: ["/api/gacha/board", "shop-tab"],
    queryFn: () => customFetch<any>("/api/gacha/board"),
    enabled: activeView === "shop",
  });

  const buyCosmeticMutation = useMutation({
    mutationFn: (cosmeticId: number) => customFetch<any>(`/api/cosmetics/${cosmeticId}/buy`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gacha/board", "shop-tab"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cosmetics", "owned"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me/membership"] });
      toast({ title: "Pembelian Berhasil!", description: "Pembelian telah berhasil diproses." });
    },
    onError: (err: any) => {
      toast({ title: "Gagal Membeli", description: err?.message || "Terjadi kesalahan.", variant: "destructive" });
    }
  });

  const claimQuestMutation = useMutation({
    mutationFn: (quest: any) => customFetch<any>("/api/quests/claim-reward", {
      method: "POST",
      body: JSON.stringify({ amount: quest.reward, title: quest.title }),
      headers: { "Content-Type": "application/json" }
    }),
    onSuccess: (res: any, quest: any) => {
      setQuestProgress((prev) => ({
        ...prev,
        [quest.id]: { ...(prev[quest.id] || { current: quest.target, claimed: false }), claimed: true }
      }));
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      toast({ title: "Hadiah Diklaim!", description: `Anda mendapatkan ${quest.reward} Tokens.` });
    },
    onError: (err: any) => {
      toast({ title: "Gagal Mengklaim", description: err?.message || "Terjadi kesalahan.", variant: "destructive" });
    }
  });

  // Video Quest Modal State
  const [showVideoQuestModal, setShowVideoQuestModal] = useState(false);
  const [activeVideoQuest, setActiveVideoQuest] = useState<any | null>(null);
  const [videoWatchTimer, setVideoWatchTimer] = useState(15);
  const [videoWatchCompleted, setVideoWatchCompleted] = useState(false);

  useEffect(() => {
    let interval: any;
    if (showVideoQuestModal && activeVideoQuest && videoWatchTimer > 0 && !videoWatchCompleted) {
      interval = setInterval(() => {
        setVideoWatchTimer((prev) => {
          if (prev <= 1) {
            setVideoWatchCompleted(true);
            triggerQuestProgress(activeVideoQuest.id);
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showVideoQuestModal, activeVideoQuest, videoWatchTimer, videoWatchCompleted]);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [pinnedModalOpen, setPinnedModalOpen] = useState(false);
  const [starredOpen, setStarredOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    msg: Message;
    x: number;
    y: number;
    isOwn: boolean;
  } | null>(null);

  // SW/Status feature states
  const [showCreateStatus, setShowCreateStatus] = useState(false);
  const [createStatusType, setCreateStatusType] = useState<"image" | "text" | "video">("image");
  const [createStatusImage, setCreateStatusImage] = useState<string | null>(null);
  const [createStatusVideo, setCreateStatusVideo] = useState<string | null>(null);
  const [createStatusCaption, setCreateStatusCaption] = useState("");
  const [createStatusBg, setCreateStatusBg] = useState("bg-gradient-to-tr from-purple-900 to-indigo-900");
  const [createStatusTextColor, setCreateStatusTextColor] = useState("text-white");
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [uploadingStatusMedia, setUploadingStatusMedia] = useState(false);

  const [activeStoriesUserIndex, setActiveStoriesUserIndex] = useState<number | null>(null);
  const [activeStoriesIndex, setActiveStoriesIndex] = useState(0);
  const [viewerPlaying, setViewerPlaying] = useState(true);
  const [viewerProgress, setViewerProgress] = useState(0);

  const storyVideoRef = useRef<HTMLVideoElement>(null);

  const [readStatuses, setReadStatuses] = useState<Set<number>>(() => {
    try {
      const stored = localStorage.getItem("viewed-status-ids");
      return stored ? new Set(JSON.parse(stored)) : new Set<number>();
    } catch {
      return new Set<number>();
    }
  });

  const markStatusAsRead = (id: number) => {
    setReadStatuses((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem("viewed-status-ids", JSON.stringify(Array.from(next)));
      } catch (e) {
        console.error("Failed to save viewed statuses:", e);
      }
      return next;
    });
  };

  const [uploading, setUploading] = useState(false);
  const [attachedImageUrl, setAttachedImageUrl] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<UploadedAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [stickerSearch, setStickerSearch] = useState("");
  const [collapsedStickerGroups, setCollapsedStickerGroups] = useState<Set<string>>(new Set());
  const [activePickerTab, setActivePickerTab] = useState<"stickers" | "emoji">("stickers");
  const [hoveredSticker, setHoveredSticker] = useState<{ name: string; groupName: string } | null>(null);
  const [recentStickers, setRecentStickers] = useState<any[]>([]);

  useEffect(() => {
    if (showStickerPicker) {
      try {
        const stored = localStorage.getItem("recently-used-stickers");
        if (stored) {
          setRecentStickers(JSON.parse(stored));
        } else {
          setRecentStickers([]);
        }
      } catch (e) {
        console.error("Failed to load recent stickers:", e);
      }
    }
  }, [showStickerPicker]);

  const activeUserStories = activeStoriesUserIndex !== null ? activeStories[activeStoriesUserIndex] : null;
  const activeStory = activeUserStories ? activeUserStories.statuses[activeStoriesIndex] : null;

  const handleNextSlide = () => {
    if (!activeUserStories) return;
    setViewerProgress(0);

    if (activeStoriesIndex < activeUserStories.statuses.length - 1) {
      setActiveStoriesIndex(activeStoriesIndex + 1);
    } else {
      if (activeStoriesUserIndex !== null && activeStoriesUserIndex < activeStories.length - 1) {
        setActiveStoriesUserIndex(activeStoriesUserIndex + 1);
        setActiveStoriesIndex(0);
      } else {
        closeStatusViewer();
      }
    }
  };

  const handlePrevSlide = () => {
    if (!activeUserStories) return;
    setViewerProgress(0);

    if (activeStoriesIndex > 0) {
      setActiveStoriesIndex(activeStoriesIndex - 1);
    } else {
      if (activeStoriesUserIndex !== null && activeStoriesUserIndex > 0) {
        const prevUserIndex = activeStoriesUserIndex - 1;
        const prevUserStories = activeStories[prevUserIndex];
        setActiveStoriesUserIndex(prevUserIndex);
        setActiveStoriesIndex(prevUserStories.statuses.length - 1);
      } else {
        setViewerProgress(0);
      }
    }
  };

  const closeStatusViewer = () => {
    setActiveStoriesUserIndex(null);
    setActiveStoriesIndex(0);
    setViewerProgress(0);
  };

  // Status auto-advancing logic
  useEffect(() => {
    if (!activeUserStories || !activeStory || !viewerPlaying) return;

    markStatusAsRead(activeStory.id);

    // Video stories: no timer — progress driven by onTimeUpdate, advance on onEnded
    if (activeStory.type === "video") return;

    const duration = 5000; // 5 seconds for image/text
    const intervalTime = 50;
    const totalSteps = duration / intervalTime;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      setViewerProgress((currentStep / totalSteps) * 100);

      if (currentStep >= totalSteps) {
        clearInterval(timer);
        handleNextSlide();
      }
    }, intervalTime);

    return () => {
      clearInterval(timer);
    };
  }, [activeStoriesUserIndex, activeStoriesIndex, viewerPlaying, activeStories.length]);

  // Sync play/pause button with the video element
  useEffect(() => {
    const vid = storyVideoRef.current;
    if (!vid) return;
    if (viewerPlaying) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  }, [viewerPlaying]);

  const handleDeleteStatus = async (statusId: number) => {
    if (!confirm("Hapus status ini?")) return;
    try {
      const res = await fetch(`/api/statuses/${statusId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Gagal menghapus status");
      
      toast({ title: "Status berhasil dihapus" });
      refetchStories();
      
      if (!activeUserStories) return;
      if (activeUserStories.statuses.length > 1) {
        if (activeStoriesIndex >= activeUserStories.statuses.length - 1) {
          setActiveStoriesIndex(activeUserStories.statuses.length - 2);
        }
      } else {
        closeStatusViewer();
      }
    } catch (err) {
      toast({ title: "Gagal menghapus status", variant: "destructive" });
    }
  };

  const handleCreateStatusSubmit = async () => {
    if (createStatusType === "image" && !createStatusImage) {
      toast({ title: "Silakan upload gambar terlebih dahulu", variant: "destructive" });
      return;
    }
    if (createStatusType === "video" && !createStatusVideo) {
      toast({ title: "Silakan upload video terlebih dahulu", variant: "destructive" });
      return;
    }
    if (createStatusType === "text" && !createStatusCaption.trim()) {
      toast({ title: "Teks status tidak boleh kosong", variant: "destructive" });
      return;
    }

    setStatusSubmitting(true);
    try {
      const mediaUrl = createStatusType === "image" ? createStatusImage
        : createStatusType === "video" ? createStatusVideo
        : null;

      const body = {
        type: createStatusType,
        mediaUrl,
        caption: createStatusCaption,
        backgroundColor: createStatusType === "text" ? createStatusBg : null,
        textColor: createStatusType === "text" ? createStatusTextColor : null,
      };

      const res = await fetch("/api/statuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to post status");
      }

      toast({ title: "Status berhasil diposting!" });
      setShowCreateStatus(false);
      setCreateStatusCaption("");
      setCreateStatusImage(null);
      setCreateStatusVideo(null);
      refetchStories();
    } catch (err: any) {
      console.error(err);
      toast({ title: err?.message || "Gagal memposting status", variant: "destructive" });
    } finally {
      setStatusSubmitting(false);
    }
  };

  const uploadStatusMedia = async (file: File, forType: "image" | "video" = "image") => {
    setUploadingStatusMedia(true);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          "x-file-name": file.name,
        },
        body: await file.arrayBuffer(),
      });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      if (forType === "video") {
        setCreateStatusVideo(url);
      } else {
        setCreateStatusImage(url);
      }
      toast({ title: "Media berhasil diupload" });
    } catch {
      toast({ title: "Gagal upload media ke server", variant: "destructive" });
    } finally {
      setUploadingStatusMedia(false);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileChannelDrawerOpen, setMobileChannelDrawerOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [activeJoinedVoiceChannel, setActiveJoinedVoiceChannel] = useState<{ conversationId: number; channelId: number; voiceJoinedAt: string } | null>(null);
  const [voiceTimerNow, setVoiceTimerNow] = useState(() => Date.now());

  // Developer & Bot States
  const [showDeveloperSettings, setShowDeveloperSettings] = useState(false);
  const [developerTab, setDeveloperTab] = useState<"list" | "create" | "tutorial">("list");
  const [botNameInput, setBotNameInput] = useState("");
  const [botCategoryInput, setBotCategoryInput] = useState("General");
  const [editingBot, setEditingBot] = useState<any | null>(null);
  const [botWebhookInput, setBotWebhookInput] = useState("");
  const [showInviteBotModal, setShowInviteBotModal] = useState(false);
  const [visibleTokens, setVisibleTokens] = useState<Record<number, boolean>>({});
  const [copiedTokenBotId, setCopiedTokenBotId] = useState<number | null>(null);

  const [showCallChat, setShowCallChat] = useState(false);
  const [callMessageText, setCallMessageText] = useState("");
  const callChatEndRef = useRef<HTMLDivElement>(null);

  // Sticker Studio & Modals States
  const [showStickerStudio, setShowStickerStudio] = useState(false);
  const [showStickerManager, setShowStickerManager] = useState(false);
  const [stickerStudioSource, setStickerStudioSource] = useState<"chat" | "manager">("chat");
  const [studioImage, setStudioImage] = useState<string | null>(null);
  const [studioImageFile, setStudioImageFile] = useState<File | null>(null);
  const [studioName, setStudioName] = useState("");

  // Emoji Studio & Modals States
  const [emojiSearch, setEmojiSearch] = useState("");
  const [hoveredEmoji, setHoveredEmoji] = useState<any | null>(null);
  const [showEmojiManager, setShowEmojiManager] = useState(false);
  const [showEmojiStudio, setShowEmojiStudio] = useState(false);
  const [emojiStudioFile, setEmojiStudioFile] = useState<File | null>(null);
  const [emojiStudioPreview, setEmojiStudioPreview] = useState<string | null>(null);
  const [emojiStudioName, setEmojiStudioName] = useState("");
  const [uploadingEmoji, setUploadingEmoji] = useState(false);
  const [studioCaption, setStudioCaption] = useState("");
  const [studioFont, setStudioFont] = useState("Impact");
  const [studioFontSize, setStudioFontSize] = useState(40);
  const [studioTextColor, setStudioTextColor] = useState("#FFFFFF");
  const [studioOutlineColor, setStudioOutlineColor] = useState("#000000");
  const [studioOutlineWidth, setStudioOutlineWidth] = useState(4);
  const [studioPosition, setStudioPosition] = useState<"top" | "middle" | "bottom">("bottom");
  const [studioSaving, setStudioSaving] = useState(false);

  // Message Delete Modal States
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [messageToDeleteId, setMessageToDeleteId] = useState<number | null>(null);
  const [messageToDeleteIsOwn, setMessageToDeleteIsOwn] = useState(false);
  const [deleteScope, setDeleteScope] = useState<"me" | "everyone">("me");

  // Message Forward Modal States
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [messageToForwardId, setMessageToForwardId] = useState<number | null>(null);
  const [forwardSearch, setForwardSearch] = useState("");
  const [forwardTargetConvId, setForwardTargetConvId] = useState<number | null>(null);
  const [forwardTargetChannelId, setForwardTargetChannelId] = useState<number | null>(null);
  const [forwarding, setForwarding] = useState(false);

  // Forum states
  const [forumActivePostId, setForumActivePostId] = useState<number | null>(null);
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [newCommentText, setNewCommentText] = useState("");
  const [forumSearchQuery, setForumSearchQuery] = useState("");
  const [forumSortOrder, setForumSortOrder] = useState<"newest" | "oldest">("newest");
  const [showGetStarted, setShowGetStarted] = useState(true);

  const { data: targetChannels } = useQuery<any[]>({
    queryKey: [`/api/conversations/${forwardTargetConvId}/channels`, "forward-target"],
    queryFn: () => customFetch<any[]>(`/api/conversations/${forwardTargetConvId}/channels`),
    enabled: !!forwardTargetConvId,
  });

  useEffect(() => {
    if (targetChannels && targetChannels.length > 0) {
      const textChannels = targetChannels.filter(c => c.type === "text" || c.type === "announce");
      if (textChannels.length > 0) {
        setForwardTargetChannelId(textChannels[0].id);
      } else {
        setForwardTargetChannelId(null);
      }
    } else {
      setForwardTargetChannelId(null);
    }
  }, [targetChannels]);

  const meReady = Boolean(me?.id);

  useEffect(() => {
    if (!me?.id) return;

    const sendHeartbeat = () => {
      void customFetch("/api/presence/heartbeat", {
        method: "POST",
      }).catch(() => undefined);
    };

    sendHeartbeat();
    const interval = window.setInterval(sendHeartbeat, 15_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") sendHeartbeat();
    };

    window.addEventListener("focus", sendHeartbeat);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", sendHeartbeat);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [me?.id]);

  useEffect(() => {
    const timer = window.setInterval(() => setVoiceTimerNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClose = () => setContextMenu(null);
    window.addEventListener("click", handleClose);
    window.addEventListener("contextmenu", handleClose);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleClose, true);
    return () => {
      window.removeEventListener("click", handleClose);
      window.removeEventListener("contextmenu", handleClose);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleClose, true);
    };
  }, [contextMenu]);

  useEffect(() => {
    // If showCall becomes false, but we have an active joined voice channel, we leave it
    if (!showCall && activeJoinedVoiceChannel) {
      const { conversationId, channelId } = activeJoinedVoiceChannel;
      fetch(`/api/conversations/${conversationId}/channels/${channelId}/leave`, {
        method: "POST",
      })
        .then(() => queryClient.invalidateQueries({ queryKey: ["channels", conversationId] }))
        .catch((e) => console.error("Error leaving voice channel:", e));
      setActiveJoinedVoiceChannel(null);
    }
  }, [showCall, activeJoinedVoiceChannel, queryClient]);

  useEffect(() => {
    // Handle beforeunload to notify backend we are leaving
    const handleUnload = () => {
      if (activeJoinedVoiceChannel) {
        const { conversationId, channelId } = activeJoinedVoiceChannel;
        fetch(`/api/conversations/${conversationId}/channels/${channelId}/leave`, {
          method: "POST",
          keepalive: true,
        }).catch(() => {});
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [activeJoinedVoiceChannel]);

  const handleJoinVoice = async (conversationId: number, channelId: number) => {
    if (selectedConv?.isSuspended) {
      toast({
        title: "Gagal bergabung ke Voice",
        description: "Grup ini ditangguhkan oleh admin.",
        variant: "destructive",
      });
      return;
    }
    const ch = channels.find((c) => c.id === channelId);
    setCallContext({
      conversationId,
      conversationName: selectedName,
      channelId,
      channelName: ch?.name ?? "Voice Channel",
    });
    try {
      const res = await fetch(`/api/conversations/${conversationId}/channels/${channelId}/join`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      setActiveJoinedVoiceChannel({
        conversationId,
        channelId,
        voiceJoinedAt: data.voiceJoinedAt ?? new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ["channels", conversationId] });
    } catch (e) {
      console.error("Failed to join voice channel on backend:", e);
    }
    setShowCall(true);
    setCallType("voice");
    setIsCallMinimized(false);
  };

  const handleHangUp = () => {
    setShowCall(false);
    setCallType(null);
    setIsCallMinimized(false);
    setCallContext(null);

    // Stop and clean up call music
    if (callAudioRef.current) {
      callAudioRef.current.pause();
      callAudioRef.current = null;
    }
    setCallPlayingTrack(null);
    setCallIsPlaying(false);
    setShowMusicPlayer(false);
  };

  const handleRestoreCall = () => {
    setIsCallMinimized(false);
    if (callContext) {
      setSelectedId(callContext.conversationId);
      if (callContext.channelId) {
        setSelectedChannelId(callContext.channelId);
      }
    }
  };

  const handleSelectChannel = (channelId: number) => {
    setSelectedChannelId(channelId);
    setMobileChannelDrawerOpen(false);
  };

  const handleOpenEditCategory = (cat: ChannelCategory) => {
    setEditingCategory(cat);
    setEditCategoryName(cat.name);
    setShowEditCategoryModal(true);
  };

  const handleOpenEditChannel = (ch: Channel) => {
    setEditingChannel(ch);
    setEditChannelName(ch.name);
    setEditChannelCategoryId(ch.categoryId);
    setShowEditChannelModal(true);
  };

  const handleSaveCategory = async () => {
    if (!editingCategory || !selectedId || !editCategoryName.trim()) return;
    try {
      const res = await fetch(`/api/conversations/${selectedId}/categories/${editingCategory.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editCategoryName.trim() }),
      });
      if (!res.ok) throw new Error();
      await queryClient.invalidateQueries({ queryKey: ["channel-categories", selectedId] });
      await queryClient.invalidateQueries({ queryKey: ["channels", selectedId] });
      setShowEditCategoryModal(false);
      setEditingCategory(null);
      toast({ title: "Category updated!" });
    } catch {
      toast({ title: "Failed to update category", variant: "destructive" });
    }
  };

  const handleDeleteCategory = async () => {
    if (!editingCategory || !selectedId) return;
    if (!confirm(`Delete category "${editingCategory.name}"? Channels inside will become uncategorized.`)) return;
    try {
      const res = await fetch(`/api/conversations/${selectedId}/categories/${editingCategory.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      await queryClient.invalidateQueries({ queryKey: ["channel-categories", selectedId] });
      await queryClient.invalidateQueries({ queryKey: ["channels", selectedId] });
      setShowEditCategoryModal(false);
      setEditingCategory(null);
      toast({ title: "Category deleted!" });
    } catch {
      toast({ title: "Failed to delete category", variant: "destructive" });
    }
  };

  const handleSaveChannel = async () => {
    if (!editingChannel || !selectedId || !editChannelName.trim()) return;
    try {
      const res = await fetch(`/api/conversations/${selectedId}/channels/${editingChannel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editChannelName.trim(),
          categoryId: editChannelCategoryId,
        }),
      });
      if (!res.ok) throw new Error();
      await queryClient.invalidateQueries({ queryKey: ["channels", selectedId] });
      setShowEditChannelModal(false);
      setEditingChannel(null);
      toast({ title: "Channel updated!" });
    } catch {
      toast({ title: "Failed to update channel", variant: "destructive" });
    }
  };

  const handleDeleteChannel = async () => {
    if (!editingChannel || !selectedId) return;
    if (!confirm(`Delete channel "${editingChannel.name}"? This action cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/conversations/${selectedId}/channels/${editingChannel.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Delete failed");
      }
      await queryClient.invalidateQueries({ queryKey: ["channels", selectedId] });
      if (selectedChannelId === editingChannel.id) {
        setSelectedChannelId(null);
      }
      setShowEditChannelModal(false);
      setEditingChannel(null);
      toast({ title: "Channel deleted!" });
    } catch (err: any) {
      toast({ title: "Failed to delete channel", description: err.message, variant: "destructive" });
    }
  };

  const prevMsgCountRef = useRef<number>(0);

  // Mention autocomplete
  const [showMention, setShowMention] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCopyIP = () => {
    navigator.clipboard.writeText("play.arcadiamc.net");
    setCopied(true);
    toast({ title: "Copied!", description: "IP copied to clipboard: play.arcadiamc.net" });
    setTimeout(() => setCopied(false), 2000);
  };

  const {
    data: conversations = [],
    isLoading: convsLoading,
    isError: convsError,
    error: conversationsError,
    refetch: refetchConversations,
  } = useQuery<ConversationSummary[]>({
    queryKey: ["/api/conversations", "messages-page"],
    queryFn: ({ signal }) =>
      customFetch<ConversationSummary[]>("/api/conversations", {
        signal: createQuerySignal(signal),
      }),
    enabled: meReady,
    refetchInterval: 5000,
    retry: 1,
  });

  const selectedConv = conversations.find((c) => c.id === selectedId) ?? null;
  const isGroup = selectedConv?.type === "group";
  const [selectedCatalogProduct, setSelectedCatalogProduct] = useState<any | null>(null);
  const [buyingProduct, setBuyingProduct] = useState(false);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState("");
  const [showSearchInput, setShowSearchInput] = useState(true);
  const [showMessageInfo, setShowMessageInfo] = useState<any | null>(null);
  const [debouncedSidebarSearchQuery, setDebouncedSidebarSearchQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSidebarSearchQuery(sidebarSearchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [sidebarSearchQuery]);

  const { data: sidebarSearchedUsers = [], isFetching: sidebarSearchingUsers } = useQuery<any[]>({
    queryKey: ["/api/users/search", "sidebar", debouncedSidebarSearchQuery],
    queryFn: () => {
      if (!debouncedSidebarSearchQuery.trim()) return Promise.resolve([]);
      return customFetch<any[]>(`/api/users/search?q=${encodeURIComponent(debouncedSidebarSearchQuery)}`);
    },
    enabled: !!debouncedSidebarSearchQuery.trim(),
  });

  const { data: sidebarSearchedMessages = [], isFetching: sidebarSearchingMessages } = useQuery<any[]>({
    queryKey: ["/api/conversations/search-messages", "sidebar", debouncedSidebarSearchQuery],
    queryFn: () => {
      if (!debouncedSidebarSearchQuery.trim()) return Promise.resolve([]);
      return customFetch<any[]>(`/api/conversations/search-messages?q=${encodeURIComponent(debouncedSidebarSearchQuery)}`);
    },
    enabled: !!debouncedSidebarSearchQuery.trim(),
  });

  const { data: myPurchases = [], refetch: refetchMyPurchases } = useQuery({
    queryKey: ["/api/business/purchases"],
    queryFn: () => customFetch<any[]>("/api/business/purchases"),
  });

  const handleBuyProduct = async (productId: number) => {
    try {
      setBuyingProduct(true);
      const data = await customFetch<{ checkoutUrl: string }>(`/api/business/products/${productId}/buy`, {
        method: "POST"
      });
      if (data && data.checkoutUrl) {
        refetchMyPurchases();
        window.open(data.checkoutUrl, "_blank");
      } else {
        throw new Error("Checkout URL tidak ditemukan.");
      }
    } catch (err: any) {
      toast({
        title: "Gagal membuat invoice",
        description: err.message || "Terjadi kesalahan saat menghubungi SayaBayar.",
        variant: "destructive"
      });
    } finally {
      setBuyingProduct(false);
    }
  };

  const [syncingOrderId, setSyncingOrderId] = useState<number | null>(null);

  const handleSyncOrder = async (orderId: number) => {
    try {
      setSyncingOrderId(orderId);
      const updatedOrder = await customFetch<any>(`/api/business/orders/${orderId}/sync`, {
        method: "POST"
      });
      refetchMyPurchases();
      if (updatedOrder.status === "completed") {
        toast({
          title: "Pembayaran terverifikasi!",
          description: "Pesanan Anda kini berstatus Sudah Dibayar."
        });
      } else {
        toast({
          title: "Belum terbayar",
          description: "Silakan selesaikan pembayaran terlebih dahulu di SayaBayar.",
        });
      }
    } catch (err: any) {
      toast({
        title: "Gagal menyinkronkan pembayaran",
        description: err.message || "Terjadi kesalahan.",
        variant: "destructive"
      });
    } finally {
      setSyncingOrderId(null);
    }
  };

  // Always attempt to fetch products for any DM contact — section renders only if products exist
  const otherUserIdForCatalog = selectedConv?.type === "dm" ? selectedConv.otherUserId : null;
  const { data: sellerCatalogProducts = [], isLoading: sellerProductsLoading } = useQuery<any[]>({
    queryKey: ["/api/business/products/seller", otherUserIdForCatalog],
    queryFn: () => {
      if (!otherUserIdForCatalog) return Promise.resolve([]);
      return customFetch<any[]>(`/api/business/products/seller/${otherUserIdForCatalog}`);
    },
    enabled: !!otherUserIdForCatalog,
    refetchInterval: 15000, // real-time: refresh every 15s
    staleTime: 10000,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const rawGroupId = params.get("group");
    if (!rawGroupId) return;

    const groupId = Number(rawGroupId);
    if (!Number.isFinite(groupId) || groupId <= 0) return;

    const targetGroup = conversations.find((conversation) => conversation.id === groupId && conversation.type === "group");
    if (!targetGroup) return;

    setSelectedId((current) => current === targetGroup.id ? current : targetGroup.id);
  }, [conversations]);

  // Auto-open the Join dialog when arriving from an invite link (/invite/:code → ?inviteCode=).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("inviteCode");
    if (!code) return;
    setNewGroupMode("join");
    setJoinCodeInput(code);
    setShowNewGroup(true);
    // Clean the param so refreshes don't re-trigger it.
    params.delete("inviteCode");
    const rest = params.toString();
    window.history.replaceState({}, document.title, `${window.location.pathname}${rest ? `?${rest}` : ""}`);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.location.pathname.startsWith("/member")) return;

    const params = new URLSearchParams(window.location.search);
    params.set("tab", "messages");

    if (selectedConv?.type === "group") {
      params.set("group", String(selectedConv.id));
    } else {
      params.delete("group");
    }

    const nextUrl = `/member?${params.toString()}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl !== currentUrl) {
      setLocation(nextUrl);
    }
  }, [selectedConv, setLocation]);

  const {
    data: messages = [],
    isLoading: msgsLoading,
    isError: dmMsgsError,
    error: dmMessagesError,
    refetch: refetchDmMessages,
  } = useQuery<Message[]>({
    queryKey: ["/api/conversations", selectedId, "messages"],
    queryFn: ({ signal }) =>
      customFetch<Message[]>(`/api/conversations/${selectedId}/messages`, {
        signal: createQuerySignal(signal),
      }),
    enabled: selectedId !== null && !isGroup,
    refetchInterval: 2000,
    retry: 1,
  });

  // Channel-scoped messages for groups
  const {
    data: channelMessages = [],
    isLoading: channelMsgsLoading,
    isError: groupMsgsError,
    error: groupMessagesError,
    refetch: refetchGroupMessages,
  } = useQuery<Message[]>({
    queryKey: ["channel-messages", selectedId, selectedChannelId],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/conversations/${selectedId}/channels/${selectedChannelId}/messages`, {
        signal: createQuerySignal(signal),
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isGroup && selectedId !== null && selectedChannelId !== null,
    refetchInterval: 2000,
    retry: 1,
  });

  // Use channel messages for groups, regular messages for DMs
  const activeMessages = isGroup ? channelMessages : messages;
  const activeMsgsLoading = isGroup ? channelMsgsLoading : msgsLoading;
  const activeMsgsError = isGroup ? groupMsgsError : dmMsgsError;
  const activeMessagesError = isGroup ? groupMessagesError : dmMessagesError;
  const refetchActiveMessages = isGroup ? refetchGroupMessages : refetchDmMessages;

  // Mark conversation as read when selected or when new messages arrive
  useEffect(() => {
    if (!selectedId) return;
    
    const markAsRead = async () => {
      try {
        await fetch(`/api/conversations/${selectedId}/read`, { method: "POST" });
      } catch (err) {
        console.error("Failed to mark conversation as read:", err);
      }
    };
    
    markAsRead();
    
    // Also mark as read every 3 seconds to keep it updated as they receive new messages
    const interval = setInterval(markAsRead, 3000);
    return () => clearInterval(interval);
  }, [selectedId, activeMessages.length]);

  const { data: friends = [] } = useQuery<any[]>({
    queryKey: ["/api/me/friends", "messages-page"],
    queryFn: ({ signal }) =>
      customFetch<any[]>("/api/me/friends", {
        signal: createQuerySignal(signal),
      }),
    enabled: meReady,
    retry: 1,
    // Poll every 30s so the Active Now section stays realtime
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  // Global Search Debounce & Queries
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(globalSearchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [globalSearchQuery]);

  const { data: searchedUsers = [], isFetching: searchingUsers } = useQuery<any[]>({
    queryKey: ["/api/users/search", debouncedSearchQuery],
    queryFn: () => {
      if (!debouncedSearchQuery.trim()) return Promise.resolve([]);
      return customFetch<any[]>(`/api/users/search?q=${encodeURIComponent(debouncedSearchQuery)}`);
    },
    enabled: !!debouncedSearchQuery.trim() && (globalSearchType === "all" || globalSearchType === "users"),
  });

  const { data: searchedMessages = [], isFetching: searchingMessages } = useQuery<any[]>({
    queryKey: ["/api/conversations/search-messages", debouncedSearchQuery],
    queryFn: () => {
      if (!debouncedSearchQuery.trim()) return Promise.resolve([]);
      return customFetch<any[]>(`/api/conversations/search-messages?q=${encodeURIComponent(debouncedSearchQuery)}`);
    },
    enabled: !!debouncedSearchQuery.trim() && (globalSearchType === "all" || globalSearchType === "messages"),
  });

  const { data: members = [] } = useListConversationMembers(selectedId ?? 0, {
    query: {
      ...getListConversationMembersQueryOptions(selectedId ?? 0),
      enabled: selectedId !== null,
    },
  });

  interface McNotification {
    id: number;
    senderName: string;
    senderAvatar?: string | null;
    content: string;
    timestamp: string;
    conversationId: number;
    isRead: boolean;
  }

  const { data: dbNotifications = [], refetch: refetchDbNotifications } = useQuery<McNotification[]>({
    queryKey: ["me-notifications"],
    queryFn: async ({ signal }) => {
      return customFetch<McNotification[]>("/api/me/notifications", { signal });
    },
    refetchInterval: 5000,
    enabled: meReady,
  });

  const clearNotificationsMutation = useMutation({
    mutationFn: async () => {
      return customFetch<any>("/api/me/notifications/clear", { method: "POST" });
    },
    onSuccess: () => {
      refetchDbNotifications();
    },
  });

  const readNotificationMutation = useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      return customFetch<any>(`/api/me/notifications/${id}/read`, { method: "POST" });
    },
    onSuccess: () => {
      refetchDbNotifications();
    },
  });

  const alertedNotificationIds = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!me || !dbNotifications || dbNotifications.length === 0) return;

    let hasNew = false;
    for (const notif of dbNotifications) {
      if (!alertedNotificationIds.current.has(notif.id)) {
        alertedNotificationIds.current.add(notif.id);
        hasNew = true;
      }
    }

    if (hasNew) {
      toast({
        title: "Kamu di-ping!",
        description: `Mention baru dari ${dbNotifications[0].senderName}`,
        className: "bg-blue-600 text-white border-blue-500",
      });

      try {
        const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-84.wav");
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch {}
    }
  }, [dbNotifications, me, toast]);

  const isAnyOtherMemberOnline = useMemo(() => {
    if (!me || !members || members.length === 0) return false;
    return members.some((m: any) => m.userId !== me.id && m.isOnline);
  }, [members, me]);

  // Fetch channels for the selected group
  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ["channels", selectedId],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/conversations/${selectedId}/channels`, {
        signal: createQuerySignal(signal),
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: selectedId !== null,
    refetchInterval: 5000,
    retry: 1,
  });

  // Fetch group boost level
  const { data: groupBoosts = null } = useQuery<any>({
    queryKey: ["group-boosts", selectedId],
    queryFn: () => customFetch<any>(`/api/conversations/${selectedId}/boosts`),
    enabled: selectedId !== null && selectedConv?.type === "group",
    refetchInterval: 10000,
  });

  const { data: profileOverview } = useQuery<ProfileOverview>({
    queryKey: ["profile-overview", profilePreviewUser?.id, selectedId],
    queryFn: () => customFetch<ProfileOverview>(`/api/users/${profilePreviewUser!.id}/overview${selectedId ? `?conversationId=${selectedId}` : ""}`),
    enabled: !!profilePreviewUser?.id,
    refetchInterval: profilePreviewUser ? 10_000 : false,
  });

  // Fetch categories for the selected group
  const { data: categories = [] } = useQuery<ChannelCategory[]>({
    queryKey: ["channel-categories", selectedId],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/conversations/${selectedId}/categories`, {
        signal: createQuerySignal(signal),
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: selectedId !== null,
    refetchInterval: 5000,
    retry: 1,
  });

  const { data: stickerLibrary } = useQuery<{ entitlements?: any; stickers?: Array<any> }>({
    queryKey: ["stickers", selectedId],
    queryFn: () => customFetch<{ entitlements?: any; stickers?: Array<any> }>("/api/stickers"),
    enabled: selectedId !== null,
    refetchInterval: 10000,
  });

  const stickerGroups = useMemo(() => {
    const stickers = stickerLibrary?.stickers ?? [];
    const query = stickerSearch.trim().toLowerCase();
    const filtered = query ? stickers.filter((s: any) => s.name.toLowerCase().includes(query)) : stickers;
    
    const groups: Record<string, { id: number | null; name: string; iconUrl: string | null; stickers: any[] }> = {};
    for (const s of filtered) {
      const convId = s.conversationId || 0;
      const groupName = s.conversationName || "Global Stickers";
      const icon = s.conversationIcon || null;
      if (!groups[convId]) {
        groups[convId] = {
          id: s.conversationId,
          name: groupName,
          iconUrl: icon,
          stickers: []
        };
      }
      groups[convId].stickers.push(s);
    }

    // Ensure currently selected conversation is represented in the list even if it has 0 stickers
    if (selectedId && !groups[selectedId] && !query) {
      groups[selectedId] = {
        id: selectedId,
        name: selectedConv?.name || "Server Pack",
        iconUrl: selectedConv?.iconUrl || null,
        stickers: []
      };
    }

    // Sort groups so that the current active server pack is always at the top of the list
    return Object.values(groups).sort((a, b) => {
      if (a.id === selectedId) return -1;
      if (b.id === selectedId) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [stickerLibrary?.stickers, stickerSearch, selectedId, selectedConv]);

  const { data: emojiLibrary, refetch: refetchEmojis } = useQuery<{ emojis?: Array<any> }>({
    queryKey: ["emojis", selectedId],
    queryFn: () => customFetch<{ emojis?: Array<any> }>("/api/emojis"),
    enabled: selectedId !== null,
    refetchInterval: 10000,
  });

  const emojiGroups = useMemo(() => {
    const customEmojis = emojiLibrary?.emojis ?? [];
    const query = emojiSearch.trim().toLowerCase();
    
    const standardFiltered = query 
      ? STANDARD_EMOJIS.filter(e => e.name.toLowerCase().includes(query) || e.char.includes(query))
      : STANDARD_EMOJIS;
      
    const groups: Array<{ id: string | number; name: string; iconUrl: string | null; isStandard: boolean; emojis: any[] }> = [];
    
    if (standardFiltered.length > 0) {
      groups.push({
        id: "standard",
        name: "Frequently Used",
        iconUrl: null,
        isStandard: true,
        emojis: standardFiltered.map(e => ({
          id: `standard-${e.name}`,
          name: e.name,
          char: e.char,
          isStandard: true
        }))
      });
    }

    const customFiltered = query 
      ? customEmojis.filter((e: any) => e.name.toLowerCase().includes(query))
      : customEmojis;

    const customGroupsRecord: Record<number, { id: number; name: string; iconUrl: string | null; isStandard: boolean; emojis: any[] }> = {};
    for (const e of customFiltered) {
      const convId = e.conversationId;
      if (!convId) continue;
      if (!customGroupsRecord[convId]) {
        customGroupsRecord[convId] = {
          id: convId,
          name: e.conversationName || "Group Emojis",
          iconUrl: e.conversationIcon || null,
          isStandard: false,
          emojis: []
        };
      }
      customGroupsRecord[convId].emojis.push({
        ...e,
        isStandard: false
      });
    }

    if (selectedId && !customGroupsRecord[selectedId] && !query) {
      customGroupsRecord[selectedId] = {
        id: selectedId,
        name: selectedConv?.name || "Server Emojis",
        iconUrl: selectedConv?.iconUrl || null,
        isStandard: false,
        emojis: []
      };
    }

    const sortedCustom = Object.values(customGroupsRecord).sort((a, b) => {
      if (a.id === selectedId) return -1;
      if (b.id === selectedId) return 1;
      return a.name.localeCompare(b.name);
    });

    groups.push(...sortedCustom);
    return groups;
  }, [emojiLibrary?.emojis, emojiSearch, selectedId, selectedConv]);

  const channelEditorSections = useMemo(() => {
    const byPosition = (a: Channel, b: Channel) => a.position - b.position || a.id - b.id;
    const messageChannels = (items: Channel[]) => items.filter((ch) => ch.type === "text" || ch.type === "announce" || ch.type === "forum").sort(byPosition);
    const voiceChannels = (items: Channel[]) => items.filter((ch) => ch.type === "voice").sort(byPosition);
    const sections: Array<{ key: string; label: string; channels: Channel[] }> = [];

    if (categories.length === 0) {
      sections.push({ key: "messages-root", label: "Text & Announce", channels: messageChannels(channels) });
      sections.push({ key: "voice-root", label: "Voice Channels", channels: voiceChannels(channels) });
      return sections.filter((section) => section.channels.length > 0);
    }

    for (const cat of categories) {
      const catChannels = channels.filter((ch) => ch.categoryId === cat.id);
      sections.push({ key: `cat-${cat.id}-messages`, label: `${cat.name} / Text & Announce`, channels: messageChannels(catChannels) });
      sections.push({ key: `cat-${cat.id}-voice`, label: `${cat.name} / Voice`, channels: voiceChannels(catChannels) });
    }

    const uncategorized = channels.filter((ch) => !ch.categoryId);
    sections.push({ key: "uncategorized-messages", label: "Uncategorized / Text & Announce", channels: messageChannels(uncategorized) });
    sections.push({ key: "uncategorized-voice", label: "Uncategorized / Voice", channels: voiceChannels(uncategorized) });

    return sections.filter((section) => section.channels.length > 0);
  }, [categories, channels]);

  const activeVoiceByUserId = useMemo(() => {
    const voiceMap = new Map<number, { channel: Channel; member: VoiceMember }>();

    for (const channel of channels) {
      if (channel.type !== "voice") continue;
      for (const member of channel.members ?? []) {
        voiceMap.set(member.id, { channel, member });
      }
    }

    return voiceMap;
  }, [channels]);

  // Fetch roles for the selected group
  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["roles", selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${selectedId}/roles`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isGroup && selectedId !== null,
  });

  // Fetch current user's permissions in the selected group
  const { data: myPerms = { isOwner: false, permissions: {} } } = useQuery<{
    isOwner: boolean;
    permissions: Record<string, boolean>;
  }>({
    queryKey: ["my-permissions", selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${selectedId}/my-permissions`);
      if (!res.ok) return { isOwner: false, permissions: {} };
      return res.json();
    },
    enabled: isGroup && selectedId !== null,
    refetchInterval: 10000,
  });

  // Fetch active bots online in the system (for sidebar categories display)
  const { data: activeBots = [] } = useQuery<any[]>({
    queryKey: ["active-bots"],
    queryFn: async () => {
      const res = await fetch("/api/bots/active");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 3000,
  });

  // Fetch my bots for Developer Settings page
  const { data: myBots = [], refetch: refetchMyBots } = useQuery<any[]>({
    queryKey: ["my-bots"],
    queryFn: async () => {
      const res = await fetch("/api/bots");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: showDeveloperSettings,
  });

  // Fetch my invitable groups for inviting my bot
  const { data: invitableGroups = [], refetch: refetchInvitableGroups } = useQuery<any[]>({
    queryKey: ["invitable-groups"],
    queryFn: async () => {
      const res = await fetch("/api/bots/my-invitable-groups");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: showDeveloperSettings,
  });

  // Fetch all bots in the system for inviting
  const { data: systemBots = [], refetch: refetchSystemBots } = useQuery<any[]>({
    queryKey: ["system-bots"],
    queryFn: async () => {
      const res = await fetch("/api/bots/system");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: showInviteBotModal,
  });

  // Fetch bots currently invited to this conversation/group
  const { data: conversationBots = [], refetch: refetchConversationBots } = useQuery<any[]>({
    queryKey: ["conversation-bots", selectedId],
    queryFn: async () => {
      if (!selectedId) return [];
      const res = await fetch(`/api/conversations/${selectedId}/bots`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: selectedId !== null && isGroup,
  });

  // Fetch messages for the call chat independently so it doesn't get messed up if selectedId changes
  const { data: callMessages = [] } = useQuery<Message[]>({
    queryKey: ["call-messages", callContext?.conversationId, callContext?.channelId],
    queryFn: async () => {
      if (!callContext?.conversationId) return [];
      if (callContext.channelId) {
        const res = await fetch(`/api/conversations/${callContext.conversationId}/channels/${callContext.channelId}/messages`);
        if (!res.ok) return [];
        return res.json();
      } else {
        const res = await fetch(`/api/conversations/${callContext.conversationId}/messages`);
        if (!res.ok) return [];
        return res.json();
      }
    },
    enabled: showCall && callContext !== null && callContext?.conversationId !== undefined,
    refetchInterval: 2000,
  });

  useEffect(() => {
    if (showCallChat && callChatEndRef.current) {
      callChatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [showCallChat, callMessages]);

  // Fetch music tracks when Music Player is open or search query changes
  useEffect(() => {
    if (!showMusicPlayer) return;
    
    setLoadingMusicTracks(true);
    const url = musicSearchQuery.trim() 
      ? `/api/music/tracks?q=${encodeURIComponent(musicSearchQuery)}`
      : "/api/music/tracks";
      
    fetch(url)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          setMusicTracks(data);
        }
      })
      .catch((err) => console.error("Failed to fetch music tracks:", err))
      .finally(() => setLoadingMusicTracks(false));
  }, [showMusicPlayer, musicSearchQuery]);

  // Auto-play music if a message with a music command is received in the call chat
  useEffect(() => {
    if (!showCall || !callAutoPlayMusic || callMessages.length === 0) return;
    const latestMsg = callMessages[callMessages.length - 1];
    if (latestMsg.imageUrl && latestMsg.imageUrl.startsWith("music:")) {
      if (latestMsg.id !== lastPlayedCallMsgId) {
        setLastPlayedCallMsgId(latestMsg.id);
        try {
          const track = JSON.parse(latestMsg.imageUrl.slice(6));
          // Only play if it's not already playing this exact track
          if (!callPlayingTrack || callPlayingTrack.id !== track.id) {
            playCallTrack(track);
            toast({
              title: "🎵 Musik Diputar",
              description: `${track.title} - ${track.artist}`,
            });
          }
        } catch (e) {
          console.error("Error parsing auto-play music:", e);
        }
      }
    }
  }, [callMessages, showCall, callAutoPlayMusic, lastPlayedCallMsgId, callPlayingTrack, callMusicMuted, callVolume, toast]);

  const playCallTrack = (track: any) => {
    if (callAudioRef.current) {
      callAudioRef.current.pause();
      callAudioRef.current.src = "";
      callAudioRef.current = null;
    }

    const playableUrl = track.file && !track.file.startsWith("/api/music/tracks/stream") 
      ? track.file 
      : `/api/music/tracks/play?title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artist)}&_=${Date.now()}`;
      
    const audio = new Audio(playableUrl);
    audio.volume = callMusicMuted ? 0 : callVolume;
    audio.loop = true;
    
    // Set state immediately to show that it is loading/playing
    setCallPlayingTrack(track);
    setCallIsPlaying(true);
    callAudioRef.current = audio;

    // Handle deferred/async play since resolving the stream via yt-dlp on the server takes a few seconds
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn("Initial play deferred, waiting for stream to resolve...", err);
        // Do NOT setCallIsPlaying(false) here, we wait for the canplay event.
      });
    }

    // Play when the audio stream has successfully resolved on the server and is ready
    audio.oncanplay = () => {
      audio.play().then(() => {
        setCallIsPlaying(true);
      }).catch((err) => {
        console.error("Failed to play on canplay:", err);
      });
    };

    audio.onerror = (e) => {
      console.error("Audio element error:", e);
      setCallIsPlaying(false);
      toast({
        title: "Gagal memutar audio",
        description: "Koneksi ke stream audio terputus atau gagal dimuat.",
        variant: "destructive",
      });
    };
  };

  const handleToggleCallPlay = () => {
    if (!callAudioRef.current) return;
    if (callIsPlaying) {
      callAudioRef.current.pause();
      setCallIsPlaying(false);
    } else {
      callAudioRef.current.play().then(() => {
        setCallIsPlaying(true);
      }).catch((err) => {
        console.error("Failed to resume playback:", err);
      });
    }
  };

  const handleStopCallPlay = () => {
    if (callAudioRef.current) {
      callAudioRef.current.pause();
      callAudioRef.current = null;
    }
    setCallPlayingTrack(null);
    setCallIsPlaying(false);
  };

  const handleCallVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setCallVolume(newVol);
    if (callAudioRef.current) {
      callAudioRef.current.volume = callMusicMuted ? 0 : newVol;
    }
  };

  const handleToggleCallMute = () => {
    const nextMute = !callMusicMuted;
    setCallMusicMuted(nextMute);
    if (callAudioRef.current) {
      callAudioRef.current.volume = nextMute ? 0 : callVolume;
    }
  };

  async function handleSendCallMusic(track: any) {
    if (!callContext?.conversationId) return;
    const callConvId = callContext.conversationId;
    const callChanId = callContext.channelId;
    
    // Play locally immediately
    playCallTrack(track);

    // Send to chat to sync for everyone
    const text = `[CMD: PLAY_MUSIC title=${track.title}|artist=${track.artist}]`;
    const musicPayload = `music:${JSON.stringify(track)}`;
    const payload = {
      content: text,
      imageUrl: musicPayload,
    };

    try {
      if (callChanId) {
        // Channel-scoped message
        const res = await fetch(`/api/conversations/${callConvId}/channels/${callChanId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to send");
        await queryClient.invalidateQueries({ queryKey: ["channel-messages", callConvId, callChanId] });
        await queryClient.invalidateQueries({ queryKey: ["call-messages", callConvId, callChanId] });
      } else {
        // DM message
        await sendMessage.mutateAsync({ id: callConvId, data: payload });
        await queryClient.invalidateQueries({ queryKey: [`/api/conversations/${callConvId}/messages`] });
        await queryClient.invalidateQueries({ queryKey: ["call-messages", callConvId, callChanId] });
      }
      toast({ title: "Musik disinkronkan!", description: `Memutar ${track.title} untuk semua orang.` });
    } catch (e) {
      console.error("Failed to send call music:", e);
      toast({ title: "Gagal memutar untuk semua", variant: "destructive" });
    }
  }

  // Group active bots by category for the channels sidebar
  const activeBotsByCategory = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const bot of activeBots) {
      const cat = bot.category || "General";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(bot);
    }
    return groups;
  }, [activeBots]);

  const openProfilePreview = (user: ProfilePreviewUser) => {
    setProfilePreviewUser(user);
  };

  const openProfileFromMember = (member: any) => {
    openProfilePreview({
      id: member.userId ?? member.id,
      username: member.username,
      displayName: member.displayName,
      avatarUrl: member.avatarUrl,
      role: member.role,
      roles: member.roles ?? [],
      equippedBorder: member.equippedBorder ?? null,
    });
  };

  const openProfileFromVoiceMember = (member: VoiceMember) => {
    const conversationMember = members.find((candidate: any) => candidate.userId === member.id);
    const equippedBorder = (conversationMember as any)?.equippedBorder ?? null;
    openProfilePreview({
      id: member.id,
      username: member.username,
      displayName: member.displayName ?? conversationMember?.displayName,
      avatarUrl: member.avatarUrl ?? conversationMember?.avatarUrl,
      role: conversationMember?.role,
      roles: conversationMember?.roles ?? [],
      equippedBorder,
    });
  };

  const openProfileFromMessage = (msg: Message) => {
    if (!msg.senderId) return;

    const conversationMember = members.find((member: any) => member.userId === msg.senderId);
    const equippedBorder = (conversationMember as any)?.equippedBorder ?? null;
    openProfilePreview({
      id: msg.senderId,
      username: msg.senderUsername ?? conversationMember?.username ?? "unknown",
      displayName: msg.senderDisplayName ?? conversationMember?.displayName,
      avatarUrl: msg.senderAvatarUrl ?? conversationMember?.avatarUrl,
      role: msg.senderRole ?? conversationMember?.role,
      roles: conversationMember?.roles ?? [],
      equippedBorder: (msg as any).senderEquippedBorder ?? equippedBorder,
    });
  };

  const handleMoveChannel = async (channel: Channel, direction: -1 | 1) => {
    if (!selectedId || movingChannelId !== null) return;

    const section = channelEditorSections.find((candidate) => candidate.channels.some((ch) => ch.id === channel.id));
    if (!section) return;

    const currentIndex = section.channels.findIndex((ch) => ch.id === channel.id);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= section.channels.length) return;

    const reordered = [...section.channels];
    [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];

    setMovingChannelId(channel.id);
    try {
      await Promise.all(reordered.map((ch, index) =>
        fetch(`/api/conversations/${selectedId}/channels/${ch.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position: index }),
        }).then((res) => {
          if (!res.ok) throw new Error("Failed to update channel position");
        })
      ));
      await queryClient.invalidateQueries({ queryKey: ["channels", selectedId] });
    } catch {
      toast({ title: "Failed to move channel", variant: "destructive" });
    } finally {
      setMovingChannelId(null);
    }
  };

  const createDm = useCreateOrGetDm();
  const createGroup = useCreateGroup();
  const deleteConv = useDeleteConversation();
  const sendMessage = useSendMessage();
  const addMember = useAddConversationMember();
  const removeMember = useRemoveConversationMember();

  const pinMutation = usePinMessage();
  const unpinMutation = useUnpinMessage();
  const starMutation = useStarMessage();
  const unstarMutation = useUnstarMessage();
  const reactMutation = useReactMessage();
  const unreactMutation = useUnreactMessage();
  const useAdminUpdateConversationMutation = useAdminUpdateConversation();

  const blockMutation = useMutation({
    mutationFn: (userId: number) =>
      customFetch<any>(`/api/blocks/${userId}`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me/blocks"] });
      toast({ title: "User blocked successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to block user", description: err.message, variant: "destructive" });
    }
  });

  const unblockMutation = useMutation({
    mutationFn: (userId: number) =>
      customFetch<any>(`/api/blocks/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me/blocks"] });
      toast({ title: "User unblocked successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to unblock user", description: err.message, variant: "destructive" });
    }
  });

  const { data: pinnedMessages = [], isLoading: pinnedLoading } = useListPinnedMessages(
    selectedId ?? 0,
    {
      query: {
        ...getListPinnedMessagesQueryOptions(selectedId ?? 0),
        enabled: !!selectedId && pinnedModalOpen,
      },
    }
  );

  // Always-enabled pinned query for banner strip (shows latest pinned message)
  const { data: activePinnedMessages = [] } = useListPinnedMessages(
    selectedId ?? 0,
    {
      query: {
        ...getListPinnedMessagesQueryOptions(selectedId ?? 0),
        enabled: !!selectedId,
        refetchInterval: 15000,
      },
    }
  );
  const latestPinnedMessage = activePinnedMessages.length > 0 ? activePinnedMessages[0] : null;

  const { data: starredMessages = [], isLoading: starredLoading } = useListStarredMessages({
    query: {
      ...getListStarredMessagesQueryOptions(),
      enabled: starredOpen,
    },
  });

  const handleTogglePin = async (message: Message) => {
    if (!selectedId) return;
    try {
      if (message.pinned) {
        await unpinMutation.mutateAsync({
          id: selectedId,
          messageId: message.id,
        });
        toast({ title: "Pesan berhasil dilepas (unpinned)" });
      } else {
        await pinMutation.mutateAsync({
          id: selectedId,
          messageId: message.id,
        });
        toast({ title: "Pesan berhasil disematkan (pinned)" });
      }
      if (selectedChannelId) {
        await queryClient.invalidateQueries({ queryKey: ["channel-messages", selectedId, selectedChannelId] });
      } else {
        await queryClient.invalidateQueries({ queryKey: [`/api/conversations/${selectedId}/messages`] });
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/conversations", selectedId, "pins"] });
    } catch (err: any) {
      toast({ title: "Gagal mengubah status sematan", description: err.message || "Anda tidak memiliki izin.", variant: "destructive" });
    }
  };

  const handleToggleStar = async (message: Message) => {
    if (!selectedId) return;
    try {
      if (message.starred) {
        await unstarMutation.mutateAsync({
          id: selectedId,
          messageId: message.id,
        });
        toast({ title: "Pesan dihapus dari bintang" });
      } else {
        await starMutation.mutateAsync({
          id: selectedId,
          messageId: message.id,
        });
        toast({ title: "Pesan berhasil dibintangi" });
      }
      if (selectedChannelId) {
        await queryClient.invalidateQueries({ queryKey: ["channel-messages", selectedId, selectedChannelId] });
      } else {
        await queryClient.invalidateQueries({ queryKey: [`/api/conversations/${selectedId}/messages`] });
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/me/starred"] });
    } catch {
      toast({ title: "Gagal memproses bintang", variant: "destructive" });
    }
  };

  const handleToggleReaction = async (messageId: number, emoji: string, userReacted: boolean) => {
    if (!selectedId) return;
    try {
      if (userReacted) {
        await unreactMutation.mutateAsync({
          id: selectedId,
          messageId,
          emoji,
        });
      } else {
        await reactMutation.mutateAsync({
          id: selectedId,
          messageId,
          data: { emoji },
        });
      }
      if (selectedChannelId) {
        await queryClient.invalidateQueries({ queryKey: ["channel-messages", selectedId, selectedChannelId] });
      } else {
        await queryClient.invalidateQueries({ queryKey: [`/api/conversations/${selectedId}/messages`] });
      }
    } catch {
      toast({ title: "Gagal memproses reaksi", variant: "destructive" });
    }
  };

  const selectedChannel = channels.find((c) => c.id === selectedChannelId) ?? null;

  // Auto-select first message channel when group is selected, or if selected channel is deleted
  useEffect(() => {
    if (isGroup && channels.length > 0) {
      const hasSelected = channels.some((c) => c.id === selectedChannelId);
      if (!hasSelected) {
        const firstMessageChannel = channels.find((c) => c.type === "text" || c.type === "announce" || c.type === "forum");
        if (firstMessageChannel) {
          setSelectedChannelId(firstMessageChannel.id);
        } else {
          setSelectedChannelId(channels[0].id);
        }
      }
    }
    if (!isGroup) setSelectedChannelId(null);
  }, [isGroup, channels, selectedChannelId]);

  useEffect(() => {
    setShowStickerPicker(false);
    setForumActivePostId(null);
    setForumSearchQuery("");
  }, [selectedId, selectedChannelId]);

  // Hide typing indicator when AI responds.
  useEffect(() => {
    if (aiTyping && activeMessages.length > 0) {
      const lastMsg = activeMessages[activeMessages.length - 1];
      const isAiMessage =
        lastMsg?.senderRole === "ai" ||
        lastMsg?.senderUsername === "zaidanai" ||
        lastMsg?.senderUsername === "akira" ||
        lastMsg?.senderUsername === "metaai";
      if (isAiMessage) {
        setAiTyping(false);
        // Invalidate channels and categories to update the layout immediately (e.g. GAMING AREA setup)
        queryClient.invalidateQueries({ queryKey: ["channels", selectedId] });
        queryClient.invalidateQueries({ queryKey: ["channel-categories", selectedId] });
        queryClient.invalidateQueries({ queryKey: [`/api/conversations/${selectedId}/members`] });
      }
    }
    prevMsgCountRef.current = activeMessages.length;
  }, [activeMessages, aiTyping, queryClient, selectedId]);

  // Auto-clear typing after 30s (safety timeout)
  useEffect(() => {
    if (!aiTyping) return;
    const timer = setTimeout(() => setAiTyping(false), 30000);
    return () => clearTimeout(timer);
  }, [aiTyping]);

  // Lock body scroll on mobile to prevent keyboard push issues
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.style.overflow = "hidden";
    html.style.height = "100%";
    body.style.overflow = "hidden";
    body.style.height = "100%";
    body.style.overscrollBehavior = "none";

    // Handle mobile keyboard visual viewport changes
    const vv = window.visualViewport;
    const rootEl = document.getElementById("root");
    if (vv && rootEl) {
      const onResize = () => {
        rootEl.style.height = `${vv.height}px`;
      };
      vv.addEventListener("resize", onResize);
      onResize();
      return () => {
        vv.removeEventListener("resize", onResize);
        html.style.overflow = "";
        html.style.height = "";
        body.style.overflow = "";
        body.style.height = "";
        body.style.overscrollBehavior = "";
        rootEl.style.height = "";
      };
    }

    return () => {
      html.style.overflow = "";
      html.style.height = "";
      body.style.overflow = "";
      body.style.height = "";
      body.style.overscrollBehavior = "";
    };
  }, []);

  const selectedName =
    selectedConv?.type === "dm"
      ? (selectedConv.otherDisplayName ?? selectedConv.otherUsername ?? "Unknown")
      : (selectedConv?.name ?? "Group");

  useEffect(() => {
    const el = messagesEndRef.current;
    if (!el) return;
    // Find the nearest scrollable ancestor (Radix ScrollArea viewport)
    const scrollParent = el.closest('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    if (scrollParent) {
      scrollParent.scrollTop = scrollParent.scrollHeight;
    } else {
      // Fallback: use block "nearest" to avoid scrolling the whole page
      el.scrollIntoView({ block: "nearest" });
    }
  }, [activeMessages.length]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/drive/upload", { method: "POST", body: formData });
      if (!response.ok) {
        const text = await response.text().catch(() => "Upload failed");
        let errMsg = "Upload failed";
        try {
          errMsg = JSON.parse(text).error || errMsg;
        } catch {}
        throw new Error(errMsg);
      }
      const data = await response.json() as UploadedAttachment;
      setAttachedFile(data);
      setAttachedImageUrl(data.imageUrl ?? null);
      toast({ title: "Uploaded", description: `${data.name} is ready to send.` });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to upload file. Please try again.";
      toast({ title: "Error", description: errMsg, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  // === MENTION AUTOCOMPLETE ===
  const mentionMembers = useMemo(() => {
    const filter = mentionFilter.toLowerCase();
    const items = [
      { userId: 0, username: "all", displayName: "All Members", avatarUrl: null as string | null | undefined, userTag: "", mentionTag: "" },
      ...members,
    ];
    if (!filter) return items.slice(0, 8);
    return items.filter((m) =>
      m.username.toLowerCase().includes(filter) ||
      ((m as any).userTag ?? "").toLowerCase().includes(filter) ||
      ((m as any).mentionTag ?? "").toLowerCase().includes(filter) ||
      (m.displayName ?? "").toLowerCase().includes(filter)
    ).slice(0, 8);
  }, [members, mentionFilter]);

  function insertMention(member: { username: string; displayName?: string | null; userTag?: string | null; mentionTag?: string | null }) {
    if (mentionStart < 0) return;
    const before = messageText.slice(0, mentionStart);
    const after = messageText.slice(mentionStart + mentionFilter.length + 1); // +1 for @
    const tag = member.mentionTag ?? member.userTag ?? "";
    const mention = `@${member.username}${member.username === "all" ? "" : tag} `;
    const newText = before + mention + after;
    setMessageText(newText);
    setShowMention(false);
    setMentionFilter("");
    setMentionStart(-1);
    // Focus textarea and set cursor position
    setTimeout(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        const pos = (before + mention).length;
        ta.setSelectionRange(pos, pos);
      }
    }, 0);
  }

  function handleMessageChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setMessageText(value);

    // Detect @ mention trigger
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex >= 0) {
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : " ";
      // Only trigger if @ is at start or after whitespace
      if (lastAtIndex === 0 || /[\s\n]/.test(charBeforeAt)) {
        const filter = textBeforeCursor.slice(lastAtIndex + 1);
        // Only show if filter doesn't contain spaces (still typing username)
        if (!filter.includes(" ") && filter.length <= 20) {
          setShowMention(true);
          setMentionFilter(filter);
          setMentionStart(lastAtIndex);
          setMentionIndex(0);
          return;
        }
      }
    }
    setShowMention(false);
  }

  function handleMentionKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showMention && mentionMembers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionMembers.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + mentionMembers.length) % mentionMembers.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mentionMembers[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowMention(false);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleCreatePost() {
    const title = newPostTitle.trim();
    const content = newPostContent.trim();
    if (!title || !content) {
      toast({ title: "Title and Content are required", variant: "destructive" });
      return;
    }
    if (selectedId === null || !selectedChannelId) return;

    try {
      const res = await fetch(`/api/conversations/${selectedId}/channels/${selectedChannelId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
        }),
      });
      if (!res.ok) throw new Error("Failed to create post");

      setNewPostTitle("");
      setNewPostContent("");
      setShowNewPostModal(false);
      
      // Invalidate queries to reload messages
      await queryClient.invalidateQueries({ queryKey: ["channel-messages", selectedId, selectedChannelId] });
      toast({ title: "Post created successfully" });
    } catch {
      toast({ title: "Failed to create post", variant: "destructive" });
    }
  }

  async function handleCreateComment() {
    const content = newCommentText.trim();
    if (!content) return;
    if (selectedId === null || !selectedChannelId || forumActivePostId === null) return;

    try {
      const res = await fetch(`/api/conversations/${selectedId}/channels/${selectedChannelId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          replyToMessageId: forumActivePostId,
        }),
      });
      if (!res.ok) throw new Error("Failed to add comment");

      setNewCommentText("");
      
      // Invalidate queries to reload messages
      await queryClient.invalidateQueries({ queryKey: ["channel-messages", selectedId, selectedChannelId] });
    } catch {
      toast({ title: "Failed to add comment", variant: "destructive" });
    }
  }

  async function handleSend() {
    const text = messageText.trim();
    if (!text && !attachedFile && !attachedImageUrl) return;
    if (selectedId === null) return;
    try {
      const payload: {
        content?: string;
        imageUrl?: string;
        attachmentDriveFileId?: string;
        attachmentUrl?: string;
        attachmentName?: string;
        attachmentMime?: string;
        attachmentSize?: number;
        replyToMessageId?: number;
      } = {};
      if (text) payload.content = text;
      if (attachedImageUrl) payload.imageUrl = attachedImageUrl;
      if (attachedFile) {
        payload.attachmentDriveFileId = attachedFile.driveFileId;
        payload.attachmentUrl = attachedFile.downloadUrl;
        payload.attachmentName = attachedFile.name;
        payload.attachmentMime = attachedFile.mimeType;
        payload.attachmentSize = attachedFile.size;
        if (attachedFile.imageUrl && !payload.imageUrl) payload.imageUrl = attachedFile.imageUrl;
      }
      if (replyToMessage) {
        payload.replyToMessageId = replyToMessage.id;
      }

      if (isGroup && selectedChannelId) {
        // Channel-scoped message for groups
        const res = await fetch(`/api/conversations/${selectedId}/channels/${selectedChannelId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to send");
        await queryClient.invalidateQueries({ queryKey: ["channel-messages", selectedId, selectedChannelId] });
      } else {
        // Regular DM message
        await sendMessage.mutateAsync({ id: selectedId, data: payload });
        await queryClient.invalidateQueries({ queryKey: [`/api/conversations/${selectedId}/messages`] });
      }
      dbQuests?.filter((q: any) => q.type === "chat")?.forEach((q: any) => triggerQuestProgress(q.id));
      setMessageText("");
      setAttachedImageUrl(null);
      setAttachedFile(null);
      setReplyToMessage(null);

      if (selectedConv) {
        const isAiDm = selectedConv.type === "dm" && (
          selectedConv.otherUsername === "zaidanai" ||
          selectedConv.otherUsername === "akira" ||
          selectedConv.otherUsername === "metaai"
        );
        const mentionsAi = text.toLowerCase().includes("@zaidan ai") ||
                           text.toLowerCase().includes("@zaidanai") ||
                           text.toLowerCase().includes("@akira") ||
                           text.toLowerCase().includes("@ai");
        if (isAiDm || mentionsAi) {
          setAiTyping(true);
        }
      }
    } catch (err: any) {
      toast({ title: "Failed to send message", description: err.message || "Please try again.", variant: "destructive" });
    }
  }

  async function handleDeleteMessage(messageId: number, isOwnMessage: boolean = true) {
    setMessageToDeleteId(messageId);
    setMessageToDeleteIsOwn(isOwnMessage);
    setDeleteScope(isOwnMessage ? "everyone" : "me");
    setDeleteModalOpen(true);
  }

  async function handleForwardMessage(messageId: number) {
    setMessageToForwardId(messageId);
    setForwardTargetConvId(null);
    setForwardTargetChannelId(null);
    setForwardSearch("");
    setForwardModalOpen(true);
  }

  async function handleSendSticker(sticker: any) {
    if (selectedId === null) return;
    try {
      let finalAssetUrl = sticker.assetUrl;

      // Automatically share/clone sticker to target group if it belongs to another group
      if (sticker.conversationId && sticker.conversationId !== selectedId) {
        const shareRes = await fetch(`/api/stickers/${sticker.id}/share`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: selectedId }),
        });
        if (!shareRes.ok) {
          const err = await shareRes.json().catch(() => ({}));
          throw new Error(err.error || "Gagal menggunakan stiker di grup ini.");
        }
        const sharedData = await shareRes.json();
        finalAssetUrl = sharedData.assetUrl;
      }

      const payload: {
        content?: string;
        imageUrl: string;
      } = {
        imageUrl: finalAssetUrl,
      };

      if (isGroup && selectedChannelId) {
        const res = await fetch(`/api/conversations/${selectedId}/channels/${selectedChannelId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to send sticker");
        await queryClient.invalidateQueries({ queryKey: ["channel-messages", selectedId, selectedChannelId] });
        await queryClient.invalidateQueries({ queryKey: [`/api/conversations/${selectedId}/messages`] });
      } else {
        await sendMessage.mutateAsync({ id: selectedId, data: payload as any });
        await queryClient.invalidateQueries({ queryKey: [`/api/conversations/${selectedId}/messages`] });
      }

      // Save to recently used stickers in localStorage
      try {
        const stored = localStorage.getItem("recently-used-stickers");
        let currentRecents: any[] = stored ? JSON.parse(stored) : [];
        currentRecents = currentRecents.filter((s: any) => s.id !== sticker.id);
        currentRecents.unshift(sticker);
        if (currentRecents.length > 12) {
          currentRecents = currentRecents.slice(0, 12);
        }
        localStorage.setItem("recently-used-stickers", JSON.stringify(currentRecents));
        setRecentStickers(currentRecents);
      } catch (e) {
        console.error("Failed to save recent sticker:", e);
      }

      setShowStickerPicker(false);
      setAttachedImageUrl(null);
      setAttachedFile(null);
      toast({ title: "Sticker sent", description: sticker.name });
    } catch (err: any) {
      toast({ title: "Failed to send sticker", description: err.message, variant: "destructive" });
    }
  }

  function handleStudioFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File terlalu besar. Maksimal 2MB.", variant: "destructive" });
      return;
    }
    setStudioImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setStudioImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function generateStickerBlob(): Promise<{ blob: Blob; mimeType: string } | null> {
    if (!studioImage) return null;
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = studioImage;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 512;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get 2d context"));
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);

        if (studioCaption.trim()) {
          const size = Math.round((studioFontSize * w) / 512);
          ctx.font = `900 ${size}px ${studioFont === "Impact" ? "Impact, sans-serif" : studioFont}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          ctx.fillStyle = studioTextColor;
          ctx.strokeStyle = studioOutlineColor;
          ctx.lineWidth = Math.round((studioOutlineWidth * w) / 512);

          let x = w / 2;
          let y = h - size - 20;
          if (studioPosition === "top") {
            y = size + 20;
          } else if (studioPosition === "middle") {
            y = h / 2;
          }

          ctx.strokeText(studioCaption.toUpperCase(), x, y);
          ctx.fillText(studioCaption.toUpperCase(), x, y);
        }

        canvas.toBlob((blob) => {
          if (blob) {
            resolve({ blob, mimeType: "image/png" });
          } else {
            reject(new Error("Failed to export canvas blob"));
          }
        }, "image/png");
      };
      img.onerror = () => {
        reject(new Error("Failed to load preview image"));
      };
    });
  }

  async function handleStudioSubmit() {
    if (!selectedId) return;
    if (!studioImage) {
      toast({ title: "Silakan pilih gambar terlebih dahulu.", variant: "destructive" });
      return;
    }
    if (!studioName.trim()) {
      toast({ title: "Nama stiker wajib diisi.", variant: "destructive" });
      return;
    }

    setStudioSaving(true);
    try {
      const stickerBlobInfo = await generateStickerBlob();
      if (!stickerBlobInfo) throw new Error("Gagal membuat stiker");

      const formData = new FormData();
      formData.append("file", stickerBlobInfo.blob, `${studioName.replace(/\s+/g, "_")}.png`);
      formData.append("name", studioName.trim());
      formData.append("conversationId", selectedId.toString());
      formData.append("scope", "local_server");
      formData.append("editorConfig", JSON.stringify({
        caption: studioCaption,
        font: studioFont,
        fontSize: studioFontSize,
        textColor: studioTextColor,
        outlineColor: studioOutlineColor,
        outlineWidth: studioOutlineWidth,
        position: studioPosition,
      }));

      const res = await fetch("/api/stickers/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengupload stiker");
      }

      toast({ title: "Stiker berhasil dibuat!", description: data.name });
      setShowStickerStudio(false);
      setStudioImage(null);
      setStudioImageFile(null);
      setStudioName("");
      setStudioCaption("");
      await queryClient.invalidateQueries({ queryKey: ["stickers", selectedId] });
      if (stickerStudioSource === "manager") {
        setShowStickerManager(true);
      }
    } catch (err: any) {
      toast({ title: "Gagal membuat stiker", description: err.message, variant: "destructive" });
    } finally {
      setStudioSaving(false);
    }
  }

  const handleCloseStickerStudio = () => {
    setShowStickerStudio(false);
    if (stickerStudioSource === "manager") {
      setShowStickerManager(true);
    }
  };

  async function handleConfirmDelete() {
    if (!selectedId || !messageToDeleteId) return;
    try {
      const response = await fetch(`/api/conversations/${selectedId}/messages/${messageToDeleteId}?scope=${encodeURIComponent(deleteScope)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete message");
      }
      await queryClient.invalidateQueries({ queryKey: [`/api/conversations/${selectedId}/messages`] });
      if (selectedChannelId) {
        await queryClient.invalidateQueries({ queryKey: ["channel-messages", selectedId, selectedChannelId] });
      }
      setDeleteModalOpen(false);
      setMessageToDeleteId(null);
      toast({ title: "Message deleted" });
    } catch (err: any) {
      toast({ title: err.message || "Failed to delete message", variant: "destructive" });
    }
  }

  async function handleConfirmForward() {
    if (!selectedId || !messageToForwardId || !forwardTargetConvId) return;
    setForwarding(true);
    try {
      const response = await fetch(`/api/conversations/${selectedId}/messages/${messageToForwardId}/forward`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetConversationId: forwardTargetConvId,
          targetChannelId: forwardTargetChannelId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal forward pesan");

      toast({ title: "Pesan berhasil di-forward!" });
      setForwardModalOpen(false);
      setMessageToForwardId(null);

      if (forwardTargetConvId === selectedId) {
        await queryClient.invalidateQueries({ queryKey: [`/api/conversations/${selectedId}/messages`] });
        if (selectedChannelId) {
          await queryClient.invalidateQueries({ queryKey: ["channel-messages", selectedId, selectedChannelId] });
        }
      }
    } catch (err: any) {
      toast({ title: "Gagal forward pesan", description: err.message, variant: "destructive" });
    } finally {
      setForwarding(false);
    }
  }

  async function handleEditStickerName(stickerId: number, nextName: string) {
    try {
      const res = await fetch(`/api/stickers/${stickerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gagal mengubah nama stiker");
      }
      toast({ title: "Nama stiker berhasil diperbarui" });
      await queryClient.invalidateQueries({ queryKey: ["stickers", selectedId] });
    } catch (err: any) {
      toast({ title: "Gagal mengubah nama stiker", description: err.message, variant: "destructive" });
    }
  }

  async function handleDeleteSticker(stickerId: number) {
    try {
      const res = await fetch(`/api/stickers/${stickerId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gagal menghapus stiker");
      }
      toast({ title: "Stiker berhasil dihapus" });
      await queryClient.invalidateQueries({ queryKey: ["stickers", selectedId] });
    } catch (err: any) {
      toast({ title: "Gagal menghapus stiker", description: err.message, variant: "destructive" });
    }
  }

  const handleSelectEmoji = (emoji: any) => {
    if (emoji.isStandard) {
      const char = emoji.char;
      setMessageText((prev) => prev + char);
    } else {
      const isLocked = emoji.conversationId !== selectedId;
      const isPremium = me?.role === "premium" || me?.role === "premium_plus" || me?.role === "dev_website" || me?.role === "admin";
      
      if (isLocked && !isPremium) {
        toast({ title: "Emoji Terkunci", description: "Beli Premium untuk menggunakan emoji kustom antar server!", variant: "destructive" });
        return;
      }
      
      const code = `:${emoji.name}:`;
      setMessageText((prev) => prev + code);
    }
    
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  const handleUploadEmoji = async () => {
    if (!emojiStudioFile || !emojiStudioName.trim() || !selectedId) return;
    setUploadingEmoji(true);
    try {
      const formData = new FormData();
      formData.append("file", emojiStudioFile);
      formData.append("name", emojiStudioName.trim());
      formData.append("conversationId", String(selectedId));

      const response = await fetch(`/api/emojis/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Gagal mengunggah emoji");
      }

      toast({ title: "Sukses!", description: "Emoji kustom berhasil ditambahkan!" });
      setShowEmojiStudio(false);
      setShowEmojiManager(true);
      setEmojiStudioFile(null);
      setEmojiStudioPreview(null);
      setEmojiStudioName("");
      void refetchEmojis();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Gagal Mengunggah", description: e.message, variant: "destructive" });
    } finally {
      setUploadingEmoji(false);
    }
  };

  const handleEditEmojiName = async (emojiId: number, nextName: string) => {
    try {
      const response = await fetch(`/api/emojis/${emojiId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Gagal mengubah nama");
      }

      toast({ title: "Sukses!", description: "Nama emoji berhasil diubah." });
      void refetchEmojis();
    } catch (e: any) {
      toast({ title: "Gagal Mengubah", description: e.message, variant: "destructive" });
    }
  };

  const handleDeleteEmoji = async (emojiId: number) => {
    try {
      const response = await fetch(`/api/emojis/${emojiId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Gagal menghapus emoji");
      }

      toast({ title: "Sukses!", description: "Emoji kustom berhasil dihapus." });
      void refetchEmojis();
    } catch (e: any) {
      toast({ title: "Gagal Menghapus", description: e.message, variant: "destructive" });
    }
  };

  async function handleSendCallMessage() {
    const text = callMessageText.trim();
    if (!text) return;
    if (!callContext?.conversationId) return;
    const callConvId = callContext.conversationId;
    const callChanId = callContext.channelId;
    try {
      const payload = { content: text };

      if (callContext.channelId) {
        // Channel-scoped message for groups
        const res = await fetch(`/api/conversations/${callConvId}/channels/${callChanId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to send");
        await queryClient.invalidateQueries({ queryKey: ["channel-messages", callConvId, callChanId] });
        await queryClient.invalidateQueries({ queryKey: ["call-messages", callConvId, callChanId] });
      } else {
        // Regular DM message
        await sendMessage.mutateAsync({ id: callConvId, data: payload });
        await queryClient.invalidateQueries({ queryKey: [`/api/conversations/${callConvId}/messages`] });
        await queryClient.invalidateQueries({ queryKey: ["call-messages", callConvId, callChanId] });
      }
      setCallMessageText("");
      
      // Auto scroll down call chat
      setTimeout(() => {
        if (callChatEndRef.current) {
          callChatEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    } catch {
      toast({ title: "Failed to send message", variant: "destructive" });
    }
  }

  async function handleStartDm(targetUserId: number) {
    try {
      const conv = await createDm.mutateAsync({ data: { targetUserId } });
      setSelectedId(conv.id);
      setShowNewDm(false);
      setDmSearch("");
      dbQuests?.filter((q: any) => q.type === "dm")?.forEach((q: any) => triggerQuestProgress(q.id));
      await queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not start DM";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  }

  async function handleCreateGroup() {
    if (!groupName.trim()) return;
    try {
      const conv = await createGroup.mutateAsync({
        data: { name: groupName.trim(), memberIds: groupMemberIds },
      });
      setSelectedId(conv.id);
      setShowNewGroup(false);
      setGroupName("");
      setGroupMemberIds([]);
      await queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    } catch {
      toast({ title: "Failed to create group", variant: "destructive" });
    }
  }

  function openEditGroup() {
    if (!selectedConv) return;
    setEditGroupName(selectedConv.name || "");
    setEditGroupDesc(selectedConv.description || "");
    setEditGroupIcon(selectedConv.iconUrl || "");
    setEditGroupBanner(selectedConv.bannerUrl || "");
    setEditGroupBgVideo((selectedConv as any).bgVideoUrl || "");
    setEditGroupInviteCode((selectedConv as any).inviteCode || "");
    setShowEditGroup(true);
  }

  async function handleSaveGroup() {
    if (!selectedId) return;
    setEditGroupSaving(true);
    try {
      const isOwner = selectedConv?.ownerId === me?.id;
      const isVerifiedGroup = !!(selectedConv as any)?.isVerified;

      const payload: Record<string, any> = {
        name: editGroupName.trim() || undefined,
        description: editGroupDesc.trim() || null,
        iconUrl: editGroupIcon.trim() || null,
        bannerUrl: editGroupBanner.trim() || null,
        bgVideoUrl: editGroupBgVideo.trim() || null,
      };

      // Only send inviteCode if owner of a verified group
      if (isOwner && isVerifiedGroup) {
        payload.inviteCode = editGroupInviteCode.trim() || null;
      }

      const res = await fetch(`/api/conversations/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to update group");
      }

      toast({ title: "Group updated!" });
      setShowEditGroup(false);
      await queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    } catch (e: any) {
      toast({ title: e?.message || "Failed to update group", variant: "destructive" });
    } finally {
      setEditGroupSaving(false);
    }
  }

  async function handleLeaveOrDelete() {
    if (!selectedId) return;
    try {
      await deleteConv.mutateAsync({ id: selectedId });
      setSelectedId(null);
      await queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    } catch {
      toast({ title: "Failed to leave conversation", variant: "destructive" });
    }
  }

  async function uploadGroupFile(file: File, setter: (url: string) => void) {
    // Instant local preview before upload
    const localPreview = URL.createObjectURL(file);
    setter(localPreview);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          "x-file-name": file.name,
        },
        body: await file.arrayBuffer(),
      });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      URL.revokeObjectURL(localPreview);
      setter(url);
      toast({ title: "Gambar berhasil diupload" });
    } catch {
      // Keep the local preview visible even if upload fails
      toast({ title: "Gambar preview aktif, tapi gagal upload ke server", variant: "destructive" });
    }
  }

  async function handleLeaveGroup() {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/conversations/${selectedId}/leave`, {
        method: "POST",
      });
      if (!res.ok) {
        // Fallback to deleteConv if dedicated endpoint not available
        await deleteConv.mutateAsync({ id: selectedId });
      }
      setSelectedId(null);
      setLeaveGroupModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({ title: "Berhasil keluar dari grup" });
    } catch {
      toast({ title: "Gagal keluar dari grup", variant: "destructive" });
    }
  }

  async function handleReportGroup() {
    if (!selectedId || !reportGroupReason.trim()) return;
    setReportGroupSubmitting(true);
    try {
      await fetch(`/api/conversations/${selectedId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: reportGroupCategory, reason: reportGroupReason.trim() }),
      });
      setReportGroupModalOpen(false);
      setReportGroupReason("");
      toast({ title: "Laporan terkirim", description: "Tim admin akan meninjau laporan Anda." });
    } catch {
      toast({ title: "Gagal mengirim laporan", variant: "destructive" });
    } finally {
      setReportGroupSubmitting(false);
    }
  }

  const metaAiFromConv = conversations.find(c => c.type === "dm" && (c.otherUsername === "zaidanai" || c.otherUsername === "akira" || c.otherUsername === "metaai"));
  const metaAiId = metaAiFromConv?.otherUserId;

  const aiFriendObj = metaAiId ? {
    id: metaAiId,
    username: "akira",
    displayName: "Akira",
    userTag: "#000",
    avatarUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128",
    role: "ai",
    equippedBorder: "bg-gradient-to-tr from-blue-500 via-cyan-400 to-indigo-500 p-[2px]",
  } : null;

  const allDmAvailable = aiFriendObj ? [aiFriendObj, ...friends] : friends;

  const filteredFriends = allDmAvailable.filter((f) => {
    const q = dmSearch.toLowerCase();
    return (
      f.username.toLowerCase().includes(q) ||
      f.userTag.toLowerCase().includes(q) ||
      (f.displayName ?? "").toLowerCase().includes(q)
    );
  });

  const filteredMembersSearch = friends.filter((f) => {
    if (members.some((m) => m.userId === f.id)) return false;
    const q = memberSearch.toLowerCase();
    return (
      f.username.toLowerCase().includes(q) ||
      f.userTag.toLowerCase().includes(q) ||
      (f.displayName ?? "").toLowerCase().includes(q)
    );
  });

  const renderForumBoardView = () => {
    const posts = activeMessages.filter(msg => !msg.replyToMessageId && msg.title);
    const filteredPosts = posts.filter(post => 
      post.title?.toLowerCase().includes(forumSearchQuery.toLowerCase()) || 
      post.content?.toLowerCase().includes(forumSearchQuery.toLowerCase())
    );
    const sortedPosts = [...filteredPosts].sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return forumSortOrder === "newest" ? timeB - timeA : timeA - timeB;
    });

    const hasWelcomingAnnouncement = posts.length > 0;
    const hasPinnedGuidelines = activePinnedMessages.length > 0;
    const hasChannelRoles = roles.length > 1;
    const hasInvitedMembers = (selectedConv?.memberCount ?? 0) > 2;

    const completedCount = 1 
      + (hasWelcomingAnnouncement ? 1 : 0)
      + (hasPinnedGuidelines ? 1 : 0)
      + (hasChannelRoles ? 1 : 0)
      + (hasInvitedMembers ? 1 : 0);

    return (
      <div className="flex-1 flex flex-col min-h-0 bg-[#1e1f22]">
        {/* Search bar & New Post */}
        <div className="flex items-center gap-3 bg-[#1e1f22] p-4 border-b border-[#3f4147]/50 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#949ba4]" />
            <Input
              placeholder="Search or create a post..."
              value={forumSearchQuery}
              onChange={(e) => setForumSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 bg-[#2b2d31] border-0 text-[#adbac7] placeholder:text-[#949ba4] focus-visible:ring-1 focus-visible:ring-[#5865f2] rounded-xl h-10 font-semibold"
            />
          </div>
          <Button
            onClick={() => setShowNewPostModal(true)}
            className="bg-[#5865f2] hover:bg-[#4752c4] text-white font-bold text-xs px-4 py-2 h-10 rounded-xl transition-all shadow-md shadow-indigo-900/10 cursor-pointer shrink-0 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> New Post
          </Button>
        </div>

        {/* Sort & Stats */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[#3f4147]/30 bg-[#2b2d31]/20 shrink-0 text-white">
          <span className="text-[10px] font-black text-[#949ba4] uppercase tracking-widest">
            {sortedPosts.length} {sortedPosts.length === 1 ? "Post" : "Posts"}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs font-bold text-[#adbac7] hover:text-white flex items-center gap-1 hover:bg-[#35373c]/50 rounded-lg py-1 px-2.5 h-8">
                Sort: {forumSortOrder === "newest" ? "Newest" : "Oldest"} <ChevronDown className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#1e1f22] border-[#3f4147] text-[#adbac7] rounded-xl">
              <DropdownMenuItem onClick={() => setForumSortOrder("newest")} className="text-xs font-bold hover:bg-[#35373c] focus:bg-[#35373c] focus:text-white cursor-pointer rounded-lg">
                Newest
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setForumSortOrder("oldest")} className="text-xs font-bold hover:bg-[#35373c] focus:bg-[#35373c] focus:text-white cursor-pointer rounded-lg">
                Oldest
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Get Started Helper Card */}
        {showGetStarted && (selectedConv?.ownerId === me?.id || myPerms?.permissions?.manageChannels) && (
          <div className="mx-6 mt-4 p-5 rounded-2xl bg-gradient-to-br from-[#2b2d31]/80 to-[#1e1f22]/80 border border-[#8b5cf6]/20 relative overflow-hidden shrink-0 shadow-lg text-white">
            <div className="absolute top-0 right-0 w-24 h-24 bg-violet-600/10 rounded-full blur-2xl pointer-events-none" />
            <button
              onClick={() => setShowGetStarted(false)}
              className="absolute top-4 right-4 text-[#949ba4] hover:text-white transition-colors cursor-pointer"
              title="Hide"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-violet-500/15 border border-violet-500/30 text-[#8b5cf6] shrink-0">
                <Calendar className="w-5 h-5 animate-pulse" />
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <h4 className="text-sm font-black text-white">Get Started in your new Forum!</h4>
                  <p className="text-xs text-[#949ba4] font-medium leading-relaxed">
                    Complete these steps to set up a thriving discussion board.
                  </p>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#8b5cf6]">
                    <span>Setup Progress ({completedCount} of 5 Completed)</span>
                    <span>{Math.round((completedCount / 5) * 100)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#1e1f22] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-violet-500 to-[#8b5cf6] rounded-full transition-all duration-500" 
                      style={{ width: `${(completedCount / 5) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-xs font-semibold text-[#adbac7]">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="line-through text-[#949ba4]">Create the forum channel</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasWelcomingAnnouncement ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-[#3f4147] shrink-0" />
                    )}
                    <span className={hasWelcomingAnnouncement ? "line-through text-[#949ba4]" : ""}>Post a welcoming announcement</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasPinnedGuidelines ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-[#3f4147] shrink-0" />
                    )}
                    <span className={hasPinnedGuidelines ? "line-through text-[#949ba4]" : ""}>Pin a guidelines thread</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasChannelRoles ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-[#3f4147] shrink-0" />
                    )}
                    <span className={hasChannelRoles ? "line-through text-[#949ba4]" : ""}>Set up channel roles</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasInvitedMembers ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-[#3f4147] shrink-0" />
                    )}
                    <span className={hasInvitedMembers ? "line-through text-[#949ba4]" : ""}>Invite members to discuss</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Posts list */}
        <ScrollArea className="flex-1 px-6 py-4 min-h-0 bg-[#1e1f22]">
          <div className="space-y-3">
            {sortedPosts.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <MessageSquare className="w-10 h-10 text-[#3f4147] mx-auto opacity-50" />
                <p className="text-sm font-extrabold text-[#949ba4]">No discussions yet</p>
                <p className="text-xs text-[#949ba4]/75 max-w-[280px] mx-auto">
                  {forumSearchQuery ? "Try searching for a different keyword." : "Be the first to start a conversation in this forum!"}
                </p>
              </div>
            ) : (
              sortedPosts.map((post) => {
                const count = activeMessages.filter(msg => msg.replyToMessageId === post.id).length;
                return (
                  <div
                    key={post.id}
                    onClick={() => setForumActivePostId(post.id)}
                    className="flex gap-4 p-4 rounded-2xl bg-[#2b2d31]/60 hover:bg-[#2b2d31] border border-[#3f4147]/30 hover:border-[#8b5cf6]/30 transition-all cursor-pointer group text-white text-left"
                  >
                    <Avatar className="w-10 h-10 shrink-0 border border-[#3f4147]">
                      <AvatarImage src={post.senderAvatarUrl ?? undefined} />
                      <AvatarFallback className="bg-slate-800 text-white font-extrabold text-xs">
                        {post.senderUsername?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-4">
                        <h4 className="text-sm font-extrabold text-white group-hover:text-violet-300 transition-colors truncate">
                          {post.title}
                        </h4>
                        <div className="flex items-center gap-1.5 text-xs text-[#949ba4] shrink-0 font-semibold">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{formatDistanceToNowHelper(new Date(post.createdAt))}</span>
                        </div>
                      </div>
                      <p className="text-xs text-violet-400 font-bold">
                        {post.senderDisplayName || post.senderUsername}
                      </p>
                      <p className="text-xs text-[#adbac7] font-medium line-clamp-2 leading-relaxed">
                        {post.content}
                      </p>
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#949ba4] bg-[#1e1f22]/60 px-2.5 py-1 rounded-full group-hover:bg-[#1e1f22] transition-colors shrink-0">
                          <MessageSquare className="w-3.5 h-3.5 opacity-80" />
                          <span>{count} {count === 1 ? "comment" : "comments"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
    );
  };

  const renderForumThreadDetailView = () => {
    const mainPost = activeMessages.find(msg => msg.id === forumActivePostId);
    if (!mainPost) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 bg-[#1e1f22] text-white">
          <p className="text-sm font-extrabold">Thread not found or deleted</p>
          <Button onClick={() => setForumActivePostId(null)} size="sm" className="bg-[#5865f2]">
            Back to Forum
          </Button>
        </div>
      );
    }

    const comments = activeMessages.filter(msg => msg.replyToMessageId === forumActivePostId);
    const postSenderRole = mainPost.senderRole || "member";
    const postRoleLabel = ROLE_LABELS[postSenderRole] || "Member";
    const postBadgeClass = ROLE_BADGE_CLASSES[postSenderRole] || "bg-slate-50 text-slate-500 border border-slate-200/50";

    return (
      <div className="flex-1 flex flex-col min-h-0 bg-[#1e1f22] text-white">
        {/* Thread Header Bar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-[#3f4147]/50 bg-[#2b2d31]/50 shrink-0">
          <Button
            onClick={() => setForumActivePostId(null)}
            variant="ghost"
            size="sm"
            className="text-xs font-black text-[#adbac7] hover:text-white hover:bg-[#35373c]/50 rounded-xl px-2.5 h-8 cursor-pointer flex items-center gap-1 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Board
          </Button>
          <div className="h-4 w-px bg-[#3f4147] shrink-0" />
          <p className="text-xs text-[#949ba4] font-bold truncate">
            Post started {formatDistanceToNowHelper(new Date(mainPost.createdAt))} by {mainPost.senderDisplayName || mainPost.senderUsername}
          </p>
        </div>

        {/* Scrollable contents: Main Post + Comments */}
        <ScrollArea className="flex-1 px-6 py-5 min-h-0">
          <div className="space-y-6">
            {/* Main Post Card */}
            <div className="p-5 rounded-2xl bg-[#2b2d31]/60 border border-[#3f4147]/40 space-y-4 text-left">
              <div className="flex items-start gap-4">
                <Avatar className="w-11 h-11 shrink-0 border border-[#3f4147]">
                  <AvatarImage src={mainPost.senderAvatarUrl ?? undefined} />
                  <AvatarFallback className="bg-slate-800 text-white font-extrabold">
                    {mainPost.senderUsername?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-extrabold text-white">
                      {mainPost.senderDisplayName || mainPost.senderUsername}
                    </span>
                    <Badge className={`text-[9px] font-black uppercase tracking-wider py-0 px-1.5 h-4.5 shrink-0 select-none ${postBadgeClass}`}>
                      {postRoleLabel}
                    </Badge>
                    <span className="text-[10px] text-[#949ba4] font-bold">
                      {format(new Date(mainPost.createdAt), "PPp")}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-white mt-2 leading-tight">
                    {mainPost.title}
                  </h3>
                </div>
              </div>
              <p className="text-sm text-[#adbac7] font-semibold leading-relaxed whitespace-pre-wrap pl-[60px]">
                {mainPost.content}
              </p>
            </div>

            {/* Comments Divider */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-[#949ba4] uppercase tracking-widest shrink-0">
                Comments ({comments.length})
              </span>
              <div className="flex-1 h-px bg-[#3f4147]/50" />
            </div>

            {/* Comments List */}
            <div className="space-y-4">
              {comments.length === 0 ? (
                <div className="text-center py-8 text-xs font-bold text-[#949ba4]">
                  No comments yet. Start the conversation!
                </div>
              ) : (
                comments.map((comment) => {
                  const commentSenderRole = comment.senderRole || "member";
                  const commentRoleLabel = ROLE_LABELS[commentSenderRole] || "Member";
                  const commentBadgeClass = ROLE_BADGE_CLASSES[commentSenderRole] || "bg-slate-50 text-slate-500 border border-slate-200/50";

                  return (
                    <div key={comment.id} className="flex gap-4 p-4 rounded-xl hover:bg-[#2b2d31]/30 transition-colors text-left">
                      <Avatar className="w-9 h-9 shrink-0 border border-[#3f4147]">
                        <AvatarImage src={comment.senderAvatarUrl ?? undefined} />
                        <AvatarFallback className="bg-slate-800 text-white font-extrabold text-xs">
                          {comment.senderUsername?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-extrabold text-white">
                            {comment.senderDisplayName || comment.senderUsername}
                          </span>
                          <Badge className={`text-[8px] font-black uppercase tracking-wider py-0 px-1 h-4.5 shrink-0 select-none ${commentBadgeClass}`}>
                            {commentRoleLabel}
                          </Badge>
                          <span className="text-[10px] text-[#949ba4] font-semibold">
                            {formatDistanceToNowHelper(new Date(comment.createdAt))}
                          </span>
                        </div>
                        <p className="text-xs text-[#adbac7] font-semibold leading-relaxed whitespace-pre-wrap">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Comment Send Box */}
        <div className="p-4 border-t border-[#3f4147]/50 bg-[#1e1f22] shrink-0">
          <div className="flex items-center gap-3 bg-[#2b2d31] rounded-2xl p-2 border border-[#3f4147]/30 focus-within:border-[#5865f2]/50 transition-colors">
            <Textarea
              rows={1}
              placeholder="Write a comment..."
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleCreateComment();
                }
              }}
              className="flex-1 min-h-10 max-h-24 resize-none border-0 bg-transparent text-white placeholder-[#949ba4] focus-visible:ring-0 rounded-xl px-3 py-2 text-xs font-semibold"
            />
            <Button
              onClick={handleCreateComment}
              disabled={!newCommentText.trim()}
              className="bg-[#5865f2] hover:bg-[#4752c4] text-white rounded-xl h-10 px-4 shrink-0 shadow-md font-bold text-xs cursor-pointer flex items-center gap-1.5"
            >
              <SendHorizontal className="h-4 w-4" /> Comment
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const isGroupView = true;

  return (
    <div className={`${embedded ? "h-full" : "min-h-screen h-[100dvh]"} bg-[#f4f3f8] text-[#1e1b4b] flex font-sans antialiased overflow-hidden overscroll-none`}>

      {/* ── Left Sidebar (Desktop) ────────────────────────────────────────── */}
      {!embedded && (<aside className="w-64 bg-white border-r border-[#eae8f5] flex flex-col justify-between shrink-0 hidden md:flex h-full">
        <div className="flex flex-col min-h-0 overflow-y-auto">
          {/* Logo Branding */}
          <Link href="/" className="p-6 border-b border-[#eae8f5] flex items-center gap-3 hover:opacity-85 transition-opacity cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white font-black shadow-lg shadow-violet-500/20 overflow-hidden">
              {realmLogoUrl ? (
                <img src={realmLogoUrl} alt={realmName} className="h-full w-full object-cover" />
              ) : (
                realmName.slice(0, 1).toUpperCase()
              )}
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-[#110e3d] leading-none">{realmName}</h2>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Player Hub</span>
            </div>
          </Link>

          {/* Sidebar Links */}
          <div className="p-4 space-y-6">
            <div className="space-y-1.5">
              <span className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest block">General</span>
              <nav className="space-y-1">
                <Link
                  href="/member?tab=dashboard"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-55 hover:text-slate-900 transition-all"
                >
                  <LayoutGrid className="w-4.5 h-4.5" /> Dashboard
                </Link>
                <Link
                  href="/member?tab=announcements"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-55 hover:text-slate-900 transition-all"
                >
                  <Megaphone className="w-4.5 h-4.5" /> Town Crier
                </Link>
                <Link
                  href="/member?tab=developments"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-55 hover:text-slate-900 transition-all"
                >
                  <Hammer className="w-4.5 h-4.5" /> The Forge
                </Link>
                <Link
                  href="/member?tab=tickets"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-55 hover:text-slate-900 transition-all"
                >
                  <Ticket className="w-4.5 h-4.5" /> Support Tickets
                </Link>
                <Link
                  href="/member?tab=forms"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-55 hover:text-slate-900 transition-all"
                >
                  <ClipboardList className="w-4.5 h-4.5" /> Voting & Forms
                </Link>
              </nav>
            </div>

            <div className="space-y-1.5">
              <span className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest block">Social</span>
              <nav className="space-y-1">
                <Link
                  href="/"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-55 hover:text-slate-900 transition-all"
                >
                  <Home className="w-4.5 h-4.5" /> Home Page
                </Link>
                <Link
                  href="/member?tab=messages"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold bg-violet-50 text-[#6366f1] transition-all"
                >
                  <MessageSquare className="w-4.5 h-4.5" /> Messages
                </Link>
                <Link
                  href="/friends"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-55 hover:text-slate-900 transition-all"
                >
                  <Users className="w-4.5 h-4.5" /> Guilds
                </Link>
              </nav>
            </div>

            <div className="space-y-1.5">
              <span className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest block">Account</span>
              <nav className="space-y-1">
                <Link
                  href="/member?tab=profile"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-55 hover:text-slate-900 transition-all"
                >
                  <User className="w-4.5 h-4.5" /> My Profile
                </Link>
                <Link
                  href="/member?tab=credits"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-55 hover:text-slate-900 transition-all"
                >
                  <ShieldAlert className="w-4.5 h-4.5" /> Arcadia Credits
                </Link>
                <button
                  onClick={() => setShowDeveloperSettings(true)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-55 hover:text-slate-900 transition-all text-left cursor-pointer"
                >
                  <Hammer className="w-4.5 h-4.5 text-[#6366f1]" /> Developer Settings
                </button>
              </nav>
            </div>
          </div>
        </div>

        {/* User Account / Profile Details Bottom Sidebar */}
        <div className="p-4 border-t border-[#eae8f5] space-y-3 shrink-0 bg-white">
          <div className="flex items-center gap-3 px-2 py-1">
            <div className={`rounded-full shrink-0 flex items-center justify-center p-0.5 overflow-visible ${me?.equippedBorder ? me.equippedBorder : "border border-[#eae8f5]"}`}>
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={me?.avatarUrl || undefined} />
                <AvatarFallback className="text-xs bg-slate-100 font-extrabold text-[#6366f1]">
                  {getInitials(me?.displayName || me?.username)}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#110e3d] truncate">{me?.displayName || me?.username}</p>
              <p className="text-[10px] text-slate-400 font-bold capitalize">{me?.role?.replace('_', ' ') || "Member"}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => signOut({ redirectUrl: "/" })}
            className="w-full justify-start gap-3 text-slate-500 hover:text-[#ef4444] hover:bg-red-50 rounded-xl py-2 px-3 text-xs font-bold h-9"
          >
            <LogOut className="w-4.5 h-4.5 text-[#ef4444]" /> Log out
          </Button>
        </div>
      </aside>)}

      {/* ── Mobile Sidebar Drawer ────────────────────────────────────────── */}
      {!embedded && mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-black/40 backdrop-blur-sm">
          <div className="w-64 bg-white flex flex-col justify-between p-4 shadow-2xl animate-slide-in">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#eae8f5]">
                <Link href="/" onClick={() => setMobileSidebarOpen(false)} className="flex items-center gap-3 hover:opacity-85 transition-opacity cursor-pointer">
                  <div className="w-9 h-9 rounded-xl bg-[#6366f1] flex items-center justify-center text-white font-black overflow-hidden">
                    {realmLogoUrl ? (
                      <img src={realmLogoUrl} alt={realmName} className="h-full w-full object-cover" />
                    ) : (
                      realmName.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h2 className="font-extrabold text-sm text-[#110e3d] leading-none">{realmName}</h2>
                    <span className="text-[10px] text-slate-400 font-bold">Player Hub</span>
                  </div>
                </Link>
                <Button variant="ghost" size="sm" onClick={() => setMobileSidebarOpen(false)} className="text-slate-400 hover:text-[#110e3d]">✕</Button>
              </div>

              <nav className="space-y-1">
                <Link
                  href="/member?tab=dashboard"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all"
                >
                  <LayoutGrid className="w-4.5 h-4.5" /> Dashboard
                </Link>
                <Link
                  href="/member?tab=announcements"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all"
                >
                  <Megaphone className="w-4.5 h-4.5" /> Town Crier
                </Link>
                <Link
                  href="/member?tab=developments"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all"
                >
                  <Hammer className="w-4.5 h-4.5" /> The Forge
                </Link>
                <Link
                  href="/member?tab=tickets"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all"
                >
                  <Ticket className="w-4.5 h-4.5" /> Support Tickets
                </Link>
                <Link
                  href="/member?tab=forms"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all"
                >
                  <ClipboardList className="w-4.5 h-4.5" /> Voting & Forms
                </Link>

                <div className="py-2 border-t border-[#eae8f5] my-2">
                  <span className="px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Social</span>
                  <Link
                    href="/"
                    onClick={() => setMobileSidebarOpen(false)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all"
                  >
                    <Home className="w-4.5 h-4.5" /> Home Page
                  </Link>
                  <Link
                    href="/member?tab=messages"
                    onClick={() => setMobileSidebarOpen(false)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold bg-violet-50 text-[#6366f1] transition-all"
                  >
                    <MessageSquare className="w-4.5 h-4.5" /> Messages
                  </Link>
                  <Link
                    href="/friends"
                    onClick={() => setMobileSidebarOpen(false)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all"
                  >
                    <Users className="w-4.5 h-4.5" /> Guilds
                  </Link>
                </div>

                <div className="py-2 border-t border-[#eae8f5] my-2">
                  <span className="px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Account</span>
                  <Link
                    href="/member?tab=profile"
                    onClick={() => setMobileSidebarOpen(false)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all"
                  >
                    <User className="w-4.5 h-4.5" /> My Profile
                  </Link>
                  <Link
                    href="/member?tab=credits"
                    onClick={() => setMobileSidebarOpen(false)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all"
                  >
                    <ShieldAlert className="w-4.5 h-4.5" /> Arcadia Credits
                  </Link>
                  <button
                    onClick={() => { setMobileSidebarOpen(false); setShowDeveloperSettings(true); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-55 hover:text-slate-900 transition-all text-left cursor-pointer"
                  >
                    <Hammer className="w-4.5 h-4.5 text-[#6366f1]" /> Developer Settings
                  </button>
                </div>
              </nav>
            </div>

            <div className="p-4 border-t border-[#eae8f5]">
              <Button
                variant="ghost"
                onClick={() => signOut({ redirectUrl: "/" })}
                className="w-full justify-start gap-3 text-[#ef4444] hover:bg-red-50 rounded-xl py-2 px-3 text-xs font-bold h-9"
              >
                <LogOut className="w-4.5 h-4.5" /> Log out
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Content Area ────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Active Call Notification Bar (when minimized) */}
        {showCall && isCallMinimized && callContext && (
          <div
            onClick={handleRestoreCall}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-2.5 flex items-center justify-between cursor-pointer hover:from-violet-700 hover:to-indigo-700 transition-all duration-200 shrink-0 shadow-md animate-in slide-in-from-top duration-300 z-40"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <Phone className="w-4.5 h-4.5 animate-bounce text-emerald-300 shrink-0" />
              <p className="text-xs font-bold truncate">
                Sedang melakukan panggilan di <span className="underline font-extrabold">{callContext.conversationName}</span>
                {callContext.channelName ? (
                  <> di voice <span className="underline font-extrabold">#{callContext.channelName}</span></>
                ) : (
                  <> (Direct Message)</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] bg-white/20 hover:bg-white/30 text-white font-extrabold px-2.5 py-1 rounded-md transition-colors mr-2">
                Click to Expand
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-full bg-red-500 hover:bg-red-600 text-white hover:text-white shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleHangUp();
                }}
                title="Hang Up"
              >
                <PhoneOff className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
        {/* Top Header Bar */}
        {!embedded && (
          <header className="h-14 md:h-16 bg-white border-b border-[#eae8f5] px-3 sm:px-4 md:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-1 text-slate-500 hover:text-slate-900"
            >
              <Menu className="w-5.5 h-5.5" />
            </Button>
            {/* Breadcrumbs */}
            <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-slate-400">
              <span>Guild Portal</span>
              <span>/</span>
              <span className="text-[#110e3d]">Messages</span>
            </div>
            <div className="sm:hidden">
              <p className="text-sm font-extrabold text-[#110e3d]">Messages</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Copy Server IP Widget */}
            <button
              onClick={handleCopyIP}
              className="hidden sm:flex items-center gap-2 border border-[#eae8f5] bg-slate-50 hover:bg-violet-50/50 hover:border-violet-200 transition-all rounded-xl py-1.5 px-3 group text-left cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 leading-none">SERVER IP</span>
                <span className="text-[10px] font-black text-slate-700 leading-tight">play.arcadiamc.net</span>
              </div>
              <div className="ml-1 text-slate-400 group-hover:text-[#6366f1] transition-colors">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </div>
            </button>

            {/* Quick Link to Admin Panel for Authorized Roles */}
            {["admin", "staff", "dev", "dev_website"].includes(me?.role ?? "") && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl transition-all shadow-md shadow-violet-500/10 cursor-pointer"
              >
                Arcadia Admin <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </header>
        )}
        {/* Content Container (Full Height chat panel layout) */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Mobile Drawer Backdrop */}
          {selectedConv && mobileChannelDrawerOpen && (
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/60 md:hidden border-0 outline-none"
              onClick={() => setMobileChannelDrawerOpen(false)}
              aria-label="Close drawer"
            />
          )}

          {/* Chat Sidebar: Two Column Discord Layout */}
          <div className={`
            ${selectedConv 
              ? (mobileChannelDrawerOpen ? "fixed inset-y-0 left-0 z-50 w-[332px] flex animate-in slide-in-from-left duration-200" : "hidden md:flex") 
              : "flex w-full"
            } md:w-[332px] border-r border-[#1f2023] bg-[#2b2d31] shrink-0 min-w-0 min-h-0 overflow-hidden
          `}>
            
            {/* Column 1: Discord Server List (w-[72px]) */}
            <div className="w-[72px] bg-[#1e1f22] flex flex-col items-center py-3 shrink-0 gap-2 select-none">
              {/* Direct Messages Icon */}
              <div className="relative group flex items-center justify-center w-full">
                {/* Active Indicator Pill */}
                <div className={`absolute left-0 w-1 bg-white rounded-r transition-all ${
                  (!selectedConv || selectedConv.type !== "group") ? "h-10" : "h-2 scale-0 group-hover:scale-100 group-hover:h-5"
                }`} />
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className={`w-12 h-12 rounded-[16px] flex items-center justify-center transition-all duration-200 cursor-pointer ${
                    (!selectedConv || selectedConv.type !== "group") ? "bg-[#5865F2] text-white" : "bg-[#313338] text-[#B5BAC1] hover:bg-[#5865F2] hover:text-white"
                  }`}
                  title="Direct Messages"
                >
                  <MessageSquare className="w-6 h-6" />
                </button>
              </div>

              {/* Divider */}
              <div className="w-8 h-[2px] bg-[#35373c] my-1 rounded" />

              {/* Group Conversations (Servers) */}
              {conversations.filter(c => c.type === "group" && !(c as any).archivedAt).map((group) => {
                const isSelected = selectedId === group.id;
                const initials = (group.name ?? "G").split(" ").map(w => w[0]).join("").substring(0, 3).toUpperCase();
                const hasUnread = (group as any).unreadCount > 0;
                const groupIcon = (group as any).iconUrl;
                return (
                  <TooltipProvider key={group.id}>
                    <Tooltip delayDuration={100}>
                      <TooltipTrigger asChild>
                        <div className="relative group flex items-center justify-center w-full">
                          {/* Active/Hover Indicator Pill */}
                          <div className={`absolute left-0 w-1 bg-white rounded-r transition-all ${
                            isSelected ? "h-10" : "h-2 scale-0 group-hover:scale-100 group-hover:h-5"
                          }`} />
                          <button
                            type="button"
                            onClick={() => setSelectedId(group.id)}
                            className={`w-12 h-12 flex items-center justify-center transition-all duration-200 overflow-hidden relative border-0 cursor-pointer ${
                              isSelected 
                                ? "rounded-[16px] bg-[#5865F2] text-white" 
                                : "rounded-[24px] hover:rounded-[16px] bg-[#313338] text-[#B5BAC1] hover:bg-[#5865F2] hover:text-white"
                            }`}
                          >
                            {groupIcon ? (
                              <img src={groupIcon} alt={group.name ?? "Group"} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-black tracking-wider">{initials}</span>
                            )}
                            {hasUnread && (
                              <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#f23f43] rounded-full border-2 border-[#1e1f22]" />
                            )}
                          </button>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="bg-[#111214] text-white border-0 font-bold text-xs">
                        {group.name ?? "Unnamed Group"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}

              {/* Divider */}
              <div className="w-8 h-[2px] bg-[#35373c] my-1 rounded" />

              {/* Add/Join Group Plus Button (Discord Style) */}
              <TooltipProvider>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => { setNewGroupMode("create"); setShowNewGroup(true); }}
                      className="w-12 h-12 rounded-[24px] hover:rounded-[16px] bg-[#313338] hover:bg-[#23a55a] text-[#23a55a] hover:text-white flex items-center justify-center transition-all duration-200 cursor-pointer border-0"
                    >
                      <Plus className="w-6 h-6" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-[#111214] text-white border-0 font-bold text-xs">
                    Tambah atau Gabung Grup
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Column 2: Messages List & Stories & User Status Footer */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#2b2d31]">
              {selectedConv?.type === "group" ? (
                /* Group Channels List View */
                <>
                  {/* Header */}
                  <div className="p-3.5 border-b border-[#1f2023] flex items-center justify-between shrink-0 bg-[#2b2d31] shadow-sm">
                    <h2 className="font-black text-[15px] text-white tracking-wide truncate max-w-[150px]" title={selectedConv.name ?? undefined}>
                      {selectedConv.name}
                    </h2>
                    <div className="flex items-center gap-1.5">
                      {(selectedConv.ownerId === me?.id || myPerms?.permissions?.manageChannels) && (
                        <>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 rounded-full text-[#B5BAC1] hover:text-white hover:bg-[#35373C]"
                                  onClick={() => setShowChannelEditor(true)}
                                >
                                  <ListOrdered className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-[#111214] text-white border-0 text-xs">Edit Channels Order</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 rounded-full text-[#B5BAC1] hover:text-white hover:bg-[#35373C]"
                                  onClick={() => setShowCreateCategory(true)}
                                >
                                  <FolderPlus className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-[#111214] text-white border-0 text-xs">Create Category</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 rounded-full text-[#B5BAC1] hover:text-white hover:bg-[#35373C]"
                                  onClick={() => { setNewChannelCategoryId(categories[0]?.id ?? null); setShowCreateChannel(true); }}
                                >
                                  <Plus className="w-4.5 h-4.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-[#111214] text-white border-0 text-xs">Create Channel</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Channels Scroll Area */}
                  <ScrollArea className="flex-1 min-h-0">
                    <div className="p-2 space-y-3">
                      {categories.length === 0 ? (
                        <>
                          {channels.filter(c => (c.type === "text" || c.type === "announce" || c.type === "forum") && !c.categoryId).map((ch) => (
                            <div key={ch.id} className="group relative flex items-center justify-between rounded-md">
                              <button onClick={() => handleSelectChannel(ch.id)}
                                className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm font-medium text-left transition-colors cursor-pointer pr-7 ${
                                  selectedChannelId === ch.id ? "bg-[#404249] text-white" : "text-[#949BA4] hover:text-[#DCDDDE] hover:bg-[#35373C]"
                                }`}>
                                {ch.type === "announce" ? (
                                  <Megaphone className="w-4 h-4 shrink-0 opacity-70" />
                                ) : ch.type === "forum" ? (
                                  <MessageSquare className="w-4 h-4 shrink-0 opacity-70" />
                                ) : (
                                  <Hash className="w-4 h-4 shrink-0 opacity-70" />
                                )}
                                <span className="truncate">{ch.name}</span>
                              </button>
                              {(selectedConv.ownerId === me?.id || myPerms?.permissions?.manageChannels) && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleOpenEditChannel(ch); }}
                                  className="absolute right-2 text-[#949BA4] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-0 bg-transparent"
                                  title="Edit Channel"
                                >
                                  <Settings className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                          {channels.filter(c => c.type === "voice" && !c.categoryId).length > 0 && (
                            <div className="pt-2 pb-1"><span className="text-[10px] font-bold text-[#949BA4] uppercase tracking-wider px-2">Voice Channels</span></div>
                          )}
                          {channels.filter(c => c.type === "voice" && !c.categoryId).map((ch) => (
                            <div key={ch.id} className="w-full">
                              <div className="group relative flex items-center justify-between rounded-md">
                                <button onClick={() => handleSelectChannel(ch.id)}
                                  className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm font-medium text-left transition-colors cursor-pointer pr-7 ${
                                    selectedChannelId === ch.id ? "bg-[#404249] text-white" : "text-[#949BA4] hover:text-[#DCDDDE] hover:bg-[#35373C]"
                                  }`}>
                                  <Volume2 className="w-4 h-4 shrink-0 opacity-70" />
                                  <span className="truncate">{ch.name}</span>
                                  <VoiceChannelDuration members={ch.members} now={voiceTimerNow} />
                                </button>
                                {(selectedConv.ownerId === me?.id || myPerms?.permissions?.manageChannels) && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleOpenEditChannel(ch); }}
                                    className="absolute right-2 text-[#949BA4] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-0 bg-transparent"
                                    title="Edit Channel"
                                  >
                                    <Settings className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              {ch.members && ch.members.length > 0 && (
                                <div className="pl-6 pr-2 py-1 space-y-1">
                                  {ch.members.map((member) => (
                                    <VoiceMemberRow key={member.id} member={member} onClick={() => openProfileFromVoiceMember(member)} />
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </>
                      ) : (
                        categories.map((cat) => {
                          const catChannels = channels.filter(c => c.categoryId === cat.id);
                          const textChannels = catChannels.filter(c => c.type === "text" || c.type === "announce" || c.type === "forum");
                          const voiceChannels = catChannels.filter(c => c.type === "voice");
                          return (
                            <div key={cat.id}>
                              <div className="flex items-center justify-between px-1 pb-1 group">
                                <span className="text-[10px] font-bold text-[#949BA4] uppercase tracking-wider">{cat.name}</span>
                                {(selectedConv.ownerId === me?.id || myPerms?.permissions?.manageChannels) && (
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => { setNewChannelCategoryId(cat.id); setShowCreateChannel(true); }}
                                      className="text-[#949BA4] hover:text-white transition-colors cursor-pointer border-0 bg-transparent"
                                      title="Create Channel"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => handleOpenEditCategory(cat)}
                                      className="text-[#949BA4] hover:text-white transition-colors cursor-pointer border-0 bg-transparent"
                                      title="Edit Category"
                                    >
                                      <Settings className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                              {textChannels.map((ch) => (
                                <div key={ch.id} className="group relative flex items-center justify-between rounded-md">
                                  <button onClick={() => handleSelectChannel(ch.id)}
                                    className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm font-medium text-left transition-colors cursor-pointer pr-7 ${
                                      selectedChannelId === ch.id ? "bg-[#404249] text-white" : "text-[#949BA4] hover:text-[#DCDDDE] hover:bg-[#35373C]"
                                    }`}>
                                    {ch.type === "announce" ? (
                                      <Megaphone className="w-4 h-4 shrink-0 opacity-70" />
                                    ) : ch.type === "forum" ? (
                                      <MessageSquare className="w-4 h-4 shrink-0 opacity-70" />
                                    ) : (
                                      <Hash className="w-4 h-4 shrink-0 opacity-70" />
                                    )}
                                    <span className="truncate">{ch.name}</span>
                                  </button>
                                  {(selectedConv.ownerId === me?.id || myPerms?.permissions?.manageChannels) && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleOpenEditChannel(ch); }}
                                      className="absolute right-2 text-[#949BA4] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-0 bg-transparent"
                                      title="Edit Channel"
                                    >
                                      <Settings className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ))}
                              {voiceChannels.map((ch) => (
                                <div key={ch.id} className="w-full">
                                  <div className="group relative flex items-center justify-between rounded-md">
                                    <button onClick={() => handleSelectChannel(ch.id)}
                                      className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm font-medium text-left transition-colors cursor-pointer pr-7 ${
                                        selectedChannelId === ch.id ? "bg-[#404249] text-white" : "text-[#949BA4] hover:text-[#DCDDDE] hover:bg-[#35373C]"
                                      }`}>
                                      <Volume2 className="w-4 h-4 shrink-0 opacity-70" />
                                      <span className="truncate">{ch.name}</span>
                                      <VoiceChannelDuration members={ch.members} now={voiceTimerNow} />
                                    </button>
                                    {(selectedConv.ownerId === me?.id || myPerms?.permissions?.manageChannels) && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleOpenEditChannel(ch); }}
                                        className="absolute right-2 text-[#949BA4] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-0 bg-transparent"
                                        title="Edit Channel"
                                      >
                                        <Settings className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>

                                  {ch.members && ch.members.length > 0 && (
                                    <div className="pl-6 pr-2 py-1 space-y-1">
                                      {ch.members.map((member) => (
                                        <VoiceMemberRow key={member.id} member={member} onClick={() => openProfileFromVoiceMember(member)} />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        })
                      )}

                      {/* Active connected bots section */}
                      {Object.keys(activeBotsByCategory).length > 0 && (
                        <div className="pt-4 border-t border-[#3F4147] mt-4 space-y-3">
                          <div className="px-1"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Bots</span></div>
                          {Object.entries(activeBotsByCategory).map(([catName, botList]) => (
                            <div key={catName} className="space-y-1">
                              <span className="text-[9px] font-black text-[#949BA4] uppercase tracking-wider px-2">🤖 {catName}</span>
                              {botList.map((bot) => (
                                <div key={bot.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-[#35373C]">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Avatar className="w-5.5 h-5.5 border border-[#3F4147] shrink-0">
                                      <AvatarImage src={bot.avatarUrl ?? undefined} />
                                      <AvatarFallback className="text-[8px] bg-slate-800 text-white font-extrabold">B</AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs font-bold text-[#DCDDDE] truncate">{bot.name}</span>
                                  </div>
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 shadow-lg shadow-emerald-500/50" />
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </>
              ) : (
                /* DM / Messages List View */
                <>
                  {/* Header */}
                  <div className="p-3.5 border-b border-[#1f2023] shrink-0 bg-[#2b2d31] shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="font-black text-[15px] text-white tracking-wide">Messages</h2>
                    </div>
                    
                    {/* Action Bar (Discord Mobile style) */}
                    <div className="flex items-center justify-between gap-2">
                      {/* Search toggle button */}
                      <button
                        type="button"
                        onClick={() => setShowSearchInput(!showSearchInput)}
                        className={`w-8.5 h-8.5 rounded-full flex items-center justify-center transition-all bg-[#1e1f22] text-[#B5BAC1] hover:text-white hover:bg-[#35373C] border-0 cursor-pointer ${
                          showSearchInput ? "text-[#5865F2] bg-[#35373C]/50" : ""
                        }`}
                      >
                        <Search className="w-4 h-4" />
                      </button>

                      {/* Chat / Inbox Notification Badge */}
                      <button
                        type="button"
                        className="w-8.5 h-8.5 rounded-full flex items-center justify-center transition-all bg-[#1e1f22] text-[#B5BAC1] hover:text-white hover:bg-[#35373C] border-0 cursor-pointer relative"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-[#2b2d31]">
                          2
                        </span>
                      </button>

                      {/* Add Friends Pill Button */}
                      <button
                        type="button"
                        onClick={() => setShowAddFriendDialog(true)}
                        className="flex-1 h-8.5 rounded-full flex items-center justify-center gap-1.5 px-3 bg-[#1e1f22] hover:bg-[#35373C] text-[#DCDDDE] hover:text-white transition-all text-xs font-bold border-0 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-[#5865F2]" />
                        Add Friends
                      </button>

                      {/* Plus Blue Button */}
                      <button
                        type="button"
                        onClick={() => setShowNewDm(true)}
                        className="w-8.5 h-8.5 rounded-full flex items-center justify-center bg-[#5865F2] hover:bg-[#4752C4] text-white transition-all border-0 cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Conditional Search Input Box */}
                  {showSearchInput && (
                    <div className="px-3.5 py-2 border-b border-[#1f2023] bg-[#2b2d31] shrink-0">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          value={sidebarSearchQuery}
                          onChange={(e) => setSidebarSearchQuery(e.target.value)}
                          placeholder="Cari pesan atau teman..."
                          className="w-full h-8.5 pl-9 pr-3.5 bg-[#1e1f22] text-[#dcddde] placeholder:text-slate-500 text-xs font-medium rounded-xl border border-[#1f2023] focus:border-[#5865F2]/50 focus:outline-none transition-all"
                        />
                      </div>
                    </div>
                  )}

                  {/* Scrollable list of chats */}
                  <ScrollArea className="flex-1 min-h-0">
                    {/* [Active Now slider removed - now between Shop and Stories] */}
                    {false && (() => {
                      // Build from DM conversations
                      const dmPartners = conversations
                        .filter((c) => c.type === "dm" && !(c as any).archivedAt)
                        .slice(0, 6)
                        .map((c) => ({
                          id: c.otherUserId,
                          displayName: c.otherDisplayName,
                          username: c.otherUsername,
                          avatarUrl: c.otherAvatarUrl,
                          lastSeenAt: (c as any).otherLastSeenAt,
                        }));

                      // Merge friends (60-min window) + dm partners
                      const recentFriends = friends.filter((f: any) => {
                        if (f.hideOnlineStatus) return false;
                        return !!f.lastSeenAt && Date.now() - new Date(f.lastSeenAt).getTime() <= 60 * 60 * 1000;
                      });

                      const seen2 = new Set<number>();
                      const onlineFriends = [...recentFriends, ...dmPartners].filter((f) => {
                        if (!f.id || seen2.has(f.id)) return false;
                        seen2.add(f.id);
                        return true;
                      });

                      if (onlineFriends.length === 0) return null;

                      const onlineCount2 = onlineFriends.filter((f) =>
                        !!f.lastSeenAt && Date.now() - new Date(f.lastSeenAt).getTime() <= 5 * 60 * 1000
                      ).length;

                      return (
                        <div className="px-3.5 py-3 border-b border-[#1f2023]/60 mb-2 shrink-0 select-none bg-[#2b2d31]/10">
                          <div className="flex items-center justify-between mb-2.5 px-1">
                            <span className="text-[10px] font-black text-[#949BA4] uppercase tracking-wider">Aktif Sekarang</span>
                            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/20 px-1.5 py-0.5 rounded border border-emerald-900/35">
                              {onlineCount2 > 0 ? `${onlineCount2} Aktif` : `${onlineFriends.length} Teman`}
                            </span>
                          </div>
                          
                          <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                            {onlineFriends.map((friend: any, index: number) => {
                              const friendStory = activeStories.find((story: any) => story.userId === friend.id);
                              const latestStatus = friendStory?.statuses[friendStory.statuses.length - 1];
                              const statusText = latestStatus?.caption || "Aktif di Arcadia";
                              const isIdle = friend.id % 3 === 0;

                              // Spotify card design (for index % 3 === 0)
                              if (index % 3 === 0) {
                                return (
                                  <div
                                    key={`active-friend-${friend.id}`}
                                    onClick={() => handleStartDm(friend.id)}
                                    className="flex items-center gap-2.5 p-2 rounded-xl bg-[#111214]/85 hover:bg-[#1e1f22] border border-[#1f2023]/60 w-[190px] shrink-0 cursor-pointer group transition-all relative"
                                  >
                                    <div className="relative shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-zinc-800">
                                      <img src="https://i.scdn.co/image/ab67616d0000b2734493390737d2f9b8c0d12e8e" alt="Spotify Art" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 justify-between">
                                        <span className="text-[10px] font-black text-white truncate block group-hover:text-indigo-400 transition-colors">
                                          {friend.displayName || friend.username}
                                        </span>
                                        <div className="w-3.5 h-3.5 rounded-full bg-[#1db954] flex items-center justify-center text-black shrink-0">
                                          <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                                            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.565.387-.86.207-2.377-1.454-5.37-1.783-8.894-1.007-.336.074-.67-.14-.744-.477-.074-.336.14-.67.477-.743 3.844-.88 7.136-.503 9.813 1.136.295.18.387.563.208.857zm1.222-2.72c-.226.367-.707.487-1.074.26-2.72-1.672-6.87-2.157-10.082-1.182-.413.125-.85-.107-.975-.522-.125-.413.107-.85.522-.975 3.678-1.117 8.25-.573 11.35 1.335.367.226.487.707.26 1.074zm.104-2.85c-.272.443-.85.584-1.294.312-3.177-1.887-8.406-2.062-11.45-1.14-.503.15-1.03-.135-1.18-.638-.15-.503.135-1.03.638-1.18 3.63-1.1 9.405-.9 13.06 1.27.442.27.584.85.312 1.294z"/>
                                          </svg>
                                        </div>
                                      </div>
                                      <span className="text-[9px] text-[#B5BAC1] font-bold block mt-0.5 truncate leading-tight">
                                        Mendengarkan Spotify
                                      </span>
                                      <span className="text-[8px] text-[#949BA4] font-semibold truncate block mt-0.5 leading-tight">
                                        Purple Rain
                                      </span>
                                    </div>
                                  </div>
                                );
                              }

                              // Premium Gaming Lightning card design (for index % 3 === 1)
                              if (index % 3 === 1) {
                                return (
                                  <div
                                    key={`active-friend-${friend.id}`}
                                    onClick={() => handleStartDm(friend.id)}
                                    className="flex items-center gap-2.5 p-2 rounded-xl bg-gradient-to-br from-[#101935] via-[#080d1a] to-[#12131a] border border-blue-500/20 hover:border-blue-400/40 w-[190px] shrink-0 cursor-pointer group transition-all relative overflow-hidden"
                                  >
                                    <div className="absolute inset-0 opacity-10 pointer-events-none flex items-center justify-center">
                                      <span className="text-blue-500 font-bold text-3xl transform rotate-12">⚡</span>
                                    </div>
                                    <div className="relative shrink-0">
                                      <Avatar className="w-8 h-8 border border-zinc-800">
                                        <AvatarImage src={friend.avatarUrl || undefined} />
                                        <AvatarFallback className="text-xs bg-zinc-800 text-white font-bold">
                                          {getInitials(friend.displayName || friend.username)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#080d1a] flex items-center justify-center">
                                        <div className="w-2.5 h-2.5 rounded-full bg-[#23a55a]" />
                                      </div>
                                    </div>
                                    <div className="min-w-0 flex-1 relative z-10">
                                      <span className="text-[10px] font-black text-white truncate block group-hover:text-indigo-400 transition-colors">
                                        {friend.displayName || friend.username}
                                      </span>
                                      <span className="text-[9px] text-blue-300 font-bold block mt-0.5 truncate leading-tight">
                                        Sedang Streaming
                                      </span>
                                      <span className="text-[8px] text-[#B5BAC1] font-semibold truncate block mt-0.5 leading-tight">
                                        {statusText}
                                      </span>
                                    </div>
                                  </div>
                                );
                              }

                              // Minecraft active card design (for index % 3 === 2)
                              return (
                                <div
                                  key={`active-friend-${friend.id}`}
                                  onClick={() => handleStartDm(friend.id)}
                                  className="flex items-center gap-2.5 p-2 rounded-xl bg-[#111214]/85 hover:bg-[#1e1f22] border border-[#1f2023]/60 w-[190px] shrink-0 cursor-pointer group transition-all relative"
                                >
                                  <div className="relative shrink-0">
                                    <div className="w-8 h-8 rounded-full p-[1.5px] bg-gradient-to-tr from-purple-500 to-indigo-500">
                                      <Avatar className="w-full h-full border border-[#111214]">
                                        <AvatarImage src={friend.avatarUrl || undefined} />
                                        <AvatarFallback className="text-xs bg-zinc-850 text-white font-bold">
                                          {getInitials(friend.displayName || friend.username)}
                                        </AvatarFallback>
                                      </Avatar>
                                    </div>
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#111214] flex items-center justify-center">
                                      <div className="w-2.5 h-2.5 rounded-full bg-[#23a55a]" />
                                    </div>
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <span className="text-[10px] font-black text-white truncate block group-hover:text-indigo-400 transition-colors font-mono">
                                      {friend.displayName || friend.username}
                                    </span>
                                    <span className="text-[9px] text-[#B5BAC1] font-bold block mt-0.5 truncate leading-tight">
                                      Minecraft
                                    </span>
                                    <span className="text-[8px] text-purple-300 font-semibold truncate block mt-0.5 leading-tight">
                                      Server Arcadia Guild
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    <div className="p-2 space-y-1">
                      {sidebarSearchQuery.trim() ? (
                        <div className="space-y-4 pt-1">
                          {/* 1. Filtering Existing Chats */}
                          {(() => {
                            const filteredConvs = conversations.filter((c) => {
                              const name = c.type === "dm"
                                ? (c.otherDisplayName || c.otherUsername || "")
                                : (c.name || "");
                              return name.toLowerCase().includes(sidebarSearchQuery.toLowerCase());
                            });
                            const activeConvs = filteredConvs.filter((c) => !(c as any).archivedAt && c.type !== "group");
                            
                            if (activeConvs.length === 0) return null;
                            
                            return (
                              <div className="space-y-1">
                                <span className="px-3 text-[9px] font-black text-[#949BA4] uppercase tracking-wider block">Percakapan</span>
                                {activeConvs.map((c) => (
                                  <ConvItem
                                    key={c.id}
                                    conv={c}
                                    selected={selectedId === c.id}
                                    dark
                                    onClick={() => {
                                      setSelectedId(c.id);
                                      setSidebarSearchQuery("");
                                    }}
                                    onPin={(id) => pinConvMutation.mutate(id)}
                                    onUnpin={(id) => unpinConvMutation.mutate(id)}
                                    onArchive={(id) => archiveConvMutation.mutate(id)}
                                    onUnarchive={(id) => unarchiveConvMutation.mutate(id)}
                                  />
                                ))}
                              </div>
                            );
                          })()}

                          {/* 2. Global Users Search Results */}
                          {sidebarSearchedUsers.length > 0 && (
                            <div className="space-y-1">
                              <span className="px-3 text-[9px] font-black text-[#949BA4] uppercase tracking-wider block">Pengguna Baru</span>
                              {sidebarSearchedUsers.map((u) => (
                                <button
                                  key={u.id}
                                  type="button"
                                  onClick={() => {
                                    handleStartDm(u.id);
                                    setSidebarSearchQuery("");
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-left transition-colors cursor-pointer border-0 bg-transparent text-[#DCDDDE] hover:bg-[#35373C]"
                                >
                                  <Avatar className="w-7 h-7 shrink-0">
                                    <AvatarImage src={u.avatarUrl ?? undefined} />
                                    <AvatarFallback className="text-[10px] bg-[#35373c] text-white font-bold">
                                      {getInitials(u.displayName ?? u.username)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-black truncate text-white">{u.displayName || u.username}</p>
                                    <p className="text-[9px] text-[#949BA4] truncate">@{u.username}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* 3. Global Messages Search Results */}
                          {sidebarSearchedMessages.length > 0 && (
                            <div className="space-y-1">
                              <span className="px-3 text-[9px] font-black text-[#949BA4] uppercase tracking-wider block">Isi Pesan</span>
                              {sidebarSearchedMessages.map((msg) => {
                                const msgDate = new Date(msg.createdAt);
                                const formattedDate = format(msgDate, "dd MMM");
                                const convLabel = msg.conversationType === "group" 
                                  ? `Grup: ${msg.conversationName}` 
                                  : `${msg.senderDisplayName || msg.senderUsername}`;
                                
                                return (
                                  <button
                                    key={msg.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedId(msg.conversationId);
                                      if (msg.conversationType === "group" && msg.channelId) {
                                        setSelectedChannelId(msg.channelId);
                                      }
                                      setSidebarSearchQuery("");
                                    }}
                                    className="w-full flex flex-col gap-1 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer border-0 bg-[#2b2d31]/40 text-[#DCDDDE] hover:bg-[#35373C]"
                                  >
                                    <div className="flex items-center justify-between w-full">
                                      <span className="text-[10px] font-black text-indigo-400 truncate max-w-[70%]">{convLabel}</span>
                                      <span className="text-[9px] text-[#949BA4] shrink-0">{formattedDate}</span>
                                    </div>
                                    <p className="text-[11px] text-[#B5BAC1] line-clamp-2 leading-snug break-all">
                                      {msg.content}
                                    </p>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* 4. No Results Case */}
                          {!sidebarSearchingUsers && !sidebarSearchingMessages && 
                           sidebarSearchedUsers.length === 0 && sidebarSearchedMessages.length === 0 &&
                           conversations.filter((c) => {
                             const name = c.type === "dm"
                               ? (c.otherDisplayName || c.otherUsername || "")
                               : (c.name || "");
                             return name.toLowerCase().includes(sidebarSearchQuery.toLowerCase());
                           }).length === 0 && (
                             <div className="text-center text-xs py-12 font-bold px-4 leading-relaxed text-[#949BA4]">
                               Tidak ada percakapan atau pesan yang cocok.
                             </div>
                           )}
                        </div>
                      ) : (
                        <>
                          {/* Shop & Quests Navigation Links */}
                          <div className="space-y-0.5 mb-2 px-1">
                            <button
                              type="button"
                              onClick={() => { setSelectedId(null); setActiveView("shop"); }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 cursor-pointer border-0 ${
                                activeView === "shop" 
                                  ? "bg-[#404249] text-white" 
                                  : "text-[#B5BAC1] hover:text-[#DCDDDE] hover:bg-[#35373C] bg-transparent"
                              }`}
                            >
                              <ShoppingBag className="w-4 h-4 shrink-0 text-amber-500" />
                              <span className="text-xs font-black tracking-wide">Shop</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => { setSelectedId(null); setActiveView("quests"); }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 cursor-pointer border-0 ${
                                activeView === "quests" 
                                  ? "bg-[#404249] text-white" 
                                  : "text-[#B5BAC1] hover:text-[#DCDDDE] hover:bg-[#35373C] bg-transparent"
                              }`}
                            >
                              <Trophy className="w-4 h-4 shrink-0 text-yellow-500" />
                              <span className="text-xs font-black tracking-wide">Quests</span>
                            </button>
                          </div>

                          {/* Divider */}
                          <div className="h-[1px] bg-[#1f2023]/60 my-1 mx-2" />

                          {/* Active Now - Online Friends Horizontal Carousel (realtime: polls every 30s) */}
                          {(() => {
                            // Use a 5-minute window for online status (robust to slight heartbeat/network delays)
                            const ONLINE_MS = 5 * 60 * 1000;
                            const onlineFriends = friends.filter((f: any) => {
                              if (f.hideOnlineStatus) return false;
                              return !!f.lastSeenAt && Date.now() - new Date(f.lastSeenAt).getTime() <= ONLINE_MS;
                            });

                            // Hide section entirely when no one is online
                            if (onlineFriends.length === 0) return null;

                            return (
                              <div className="px-2 pt-2 pb-1 mb-1">
                                <div className="flex items-center justify-between mb-2 px-1">
                                  <span className="text-[9px] font-black text-[#949BA4] uppercase tracking-wider">Aktif Sekarang</span>
                                  <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                                    {onlineFriends.length} online
                                  </span>
                                </div>

                                {/* Horizontally scrollable friend cards */}
                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none" style={{scrollbarWidth: "none", msOverflowStyle: "none"}}>
                                  {onlineFriends.map((friend: any, index: number) => {
                                    const friendStory = activeStories.find((story: any) => story.userId === friend.id);
                                    const latestStatus = friendStory?.statuses?.[friendStory.statuses.length - 1];
                                    const customStatus = latestStatus?.caption;
                                    const isOnline = true; // guaranteed by filter above
                                    const cardType = index % 3;

                                    // ── Spotify card ──────────────────────────────────
                                    if (cardType === 0) {
                                      return (
                                        <div
                                          key={friend.id}
                                          onClick={() => handleStartDm(friend.id)}
                                          className="flex items-center gap-2.5 p-2 rounded-xl bg-[#111214]/85 hover:bg-[#1e1f22] border border-[#1f2023]/60 w-[190px] shrink-0 cursor-pointer group transition-all relative active:scale-[0.98]"
                                        >
                                          <div className="relative shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-zinc-800">
                                            <img src="https://i.scdn.co/image/ab67616d0000b2734493390737d2f9b8c0d12e8e" alt="Album Art" className="w-full h-full object-cover" />
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 justify-between">
                                              <span className="text-[10px] font-black text-white truncate block group-hover:text-indigo-400 transition-colors">
                                                {friend.displayName || friend.username}
                                              </span>
                                              <div className="w-4 h-4 rounded-full bg-[#1db954] flex items-center justify-center shrink-0">
                                                <svg className="w-2.5 h-2.5 fill-black" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.565.387-.86.207-2.377-1.454-5.37-1.783-8.894-1.007-.336.074-.67-.14-.744-.477-.074-.336.14-.67.477-.743 3.844-.88 7.136-.503 9.813 1.136.295.18.387.563.208.857zm1.222-2.72c-.226.367-.707.487-1.074.26-2.72-1.672-6.87-2.157-10.082-1.182-.413.125-.85-.107-.975-.522-.125-.413.107-.85.522-.975 3.678-1.117 8.25-.573 11.35 1.335.367.226.487.707.26 1.074zm.104-2.85c-.272.443-.85.584-1.294.312-3.177-1.887-8.406-2.062-11.45-1.14-.503.15-1.03-.135-1.18-.638-.15-.503.135-1.03.638-1.18 3.63-1.1 9.405-.9 13.06 1.27.442.27.584.85.312 1.294z"/></svg>
                                              </div>
                                            </div>
                                            <span className="text-[9px] text-[#B5BAC1] font-bold block mt-0.5 truncate leading-tight">Mendengarkan Spotify</span>
                                            <span className="text-[8px] text-[#949BA4] font-semibold truncate block mt-0.5 leading-tight">Purple Rain</span>
                                          </div>
                                        </div>
                                      );
                                    }

                                    // ── Lightning / Gaming card ────────────────────────
                                    if (cardType === 1) {
                                      return (
                                        <div
                                          key={friend.id}
                                          onClick={() => handleStartDm(friend.id)}
                                          className="flex items-center gap-2.5 p-2 rounded-xl bg-gradient-to-br from-[#101935] via-[#080d1a] to-[#12131a] border border-blue-500/20 hover:border-blue-400/40 w-[190px] shrink-0 cursor-pointer group transition-all relative overflow-hidden active:scale-[0.98]"
                                        >
                                          <div className="absolute inset-0 opacity-10 pointer-events-none flex items-center justify-center">
                                            <span className="text-blue-400 font-bold text-3xl transform rotate-12 select-none">⚡</span>
                                          </div>
                                          <div className="relative shrink-0 w-10 h-10 rounded-lg bg-[#0d1b2e] border border-blue-500/30 flex items-center justify-center">
                                            <span className="text-xl select-none">⚡</span>
                                          </div>
                                          <div className="min-w-0 flex-1 relative z-10">
                                            <span className="text-[10px] font-black text-white truncate block group-hover:text-blue-300 transition-colors">
                                              {friend.displayName || friend.username}
                                            </span>
                                            <span className="text-[9px] text-blue-300 font-bold block mt-0.5 truncate leading-tight">Sedang Streaming</span>
                                            <span className="text-[8px] text-[#B5BAC1] font-semibold truncate block mt-0.5 leading-tight">{customStatus || "Live sekarang"}</span>
                                          </div>
                                        </div>
                                        );
                                      }

                                      return (
                                        <div
                                          key={friend.id}
                                          onClick={() => handleStartDm(friend.id)}
                                          className="flex items-center gap-2.5 p-2 rounded-xl bg-[#111214]/85 hover:bg-[#1e1f22] border border-[#1f2023]/60 w-[190px] shrink-0 cursor-pointer group transition-all active:scale-[0.98]"
                                        >
                                          <div className="relative shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-purple-500/40 bg-gradient-to-br from-green-700 via-emerald-800 to-green-900 flex items-center justify-center">
                                            <span className="text-xl select-none">⛏️</span>
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 justify-between">
                                              <span className="text-[10px] font-black text-white truncate block group-hover:text-purple-300 transition-colors font-mono">
                                                {friend.displayName || friend.username}
                                              </span>
                                              <div className="w-4 h-4 rounded-lg bg-[#1a1a1a] border border-purple-500/30 flex items-center justify-center shrink-0">
                                                <span className="text-[8px] select-none">🎮</span>
                                              </div>
                                            </div>
                                            <span className="text-[9px] text-purple-300 font-bold block mt-0.5 truncate leading-tight">MINECRAFT</span>
                                            <span className="text-[8px] text-[#949BA4] font-semibold truncate block mt-0.5 leading-tight">Server Arcadia Guild</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                          })()}

                          {/* Divider before Stories */}
                          <div className="h-[1px] bg-[#1f2023]/60 mb-1 mx-2" />

                          {/* Stories Horizontal Row */}
                          <div className="px-2 py-2.5 border-b border-[#1f2023] mb-2 shrink-0">
                            <div className="flex items-center justify-between mb-2 px-1">
                              <span className="text-[9px] font-black text-[#949BA4] uppercase tracking-wider">Status / Cerita</span>
                              {activeStories.length > 0 && (
                                <span className="text-[9px] font-bold text-[#5865F2] hover:underline cursor-pointer" onClick={() => {
                                  const firstUnreadUserIdx = activeStories.findIndex(u => u.statuses.some((s: any) => !readStatuses.has(s.id)));
                                  if (firstUnreadUserIdx !== -1) {
                                    setActiveStoriesUserIndex(firstUnreadUserIdx);
                                    setActiveStoriesIndex(0);
                                    setViewerPlaying(true);
                                  } else {
                                    setActiveStoriesUserIndex(0);
                                    setActiveStoriesIndex(0);
                                    setViewerPlaying(true);
                                  }
                                }}>
                                  Putar Semua
                                </span>
                              )}
                            </div>
                            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
                              {/* Add/View Own Story Circle */}
                              {(() => {
                                const ownStoryEntry = activeStories.find(u => u.userId === me?.id);
                                const hasOwnStories = ownStoryEntry && ownStoryEntry.statuses.length > 0;
                                const hasUnreadOwn = hasOwnStories && ownStoryEntry.statuses.some((s: any) => !readStatuses.has(s.id));
                                
                                return (
                                  <div className="flex flex-col items-center shrink-0 w-12 group">
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (hasOwnStories) {
                                            const idx = activeStories.findIndex(u => u.userId === me?.id);
                                            setActiveStoriesUserIndex(idx);
                                            setActiveStoriesIndex(0);
                                            setViewerPlaying(true);
                                          } else {
                                            setShowCreateStatus(true);
                                          }
                                        }}
                                        className={`relative w-10 h-10 rounded-full p-[2px] transition-transform duration-200 group-hover:scale-105 ${
                                          hasOwnStories 
                                            ? (hasUnreadOwn ? 'bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500' : 'bg-neutral-600') 
                                            : 'border border-dashed border-[#4f545c] bg-[#1e1f22]'
                                        }`}
                                      >
                                        <Avatar className="w-full h-full border border-[#2b2d31]">
                                          <AvatarImage src={me?.avatarUrl || undefined} />
                                          <AvatarFallback className="text-[9px] font-black bg-[#35373c] text-white">
                                            {me?.displayName?.substring(0, 2).toUpperCase() || me?.username?.substring(0, 2).toUpperCase() || "ME"}
                                          </AvatarFallback>
                                        </Avatar>
                                      </button>
                                      <button 
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowCreateStatus(true);
                                        }}
                                        className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#5865F2] hover:bg-[#4752C4] rounded-full flex items-center justify-center text-white border border-[#2b2d31] shadow"
                                      >
                                        <Plus className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                    <span className="text-[8px] font-bold text-[#DCDDDE] mt-1 truncate w-full text-center">
                                      Cerita Anda
                                    </span>
                                  </div>
                                );
                              })()}

                              {/* Other Users' Stories Circles */}
                              {activeStories
                                .filter(u => u.userId !== me?.id)
                                .map((u, i) => {
                                  const hasUnread = u.statuses.some((s: any) => !readStatuses.has(s.id));
                                  const actualIdxInActiveStories = activeStories.findIndex(story => story.userId === u.userId);
                                  
                                  return (
                                    <div 
                                      key={u.userId} 
                                      className="flex flex-col items-center shrink-0 w-12 cursor-pointer group"
                                      onClick={() => {
                                        setActiveStoriesUserIndex(actualIdxInActiveStories);
                                        setActiveStoriesIndex(0);
                                        setViewerPlaying(true);
                                      }}
                                    >
                                      <div className={`w-10 h-10 rounded-full p-[2px] transition-transform duration-200 group-hover:scale-105 ${
                                        hasUnread ? 'bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500' : 'bg-neutral-600'
                                      }`}>
                                        <Avatar className="w-full h-full border border-[#2b2d31]">
                                          <AvatarImage src={u.avatarUrl || undefined} />
                                          <AvatarFallback className="text-[9px] font-black bg-[#35373c] text-white">
                                            {u.displayName?.substring(0, 2).toUpperCase() || u.username?.substring(0, 2).toUpperCase()}
                                          </AvatarFallback>
                                        </Avatar>
                                      </div>
                                      <span className="text-[8px] font-bold text-[#DCDDDE] mt-1 truncate w-full text-center">
                                        {u.displayName || u.username}
                                      </span>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>




                          {meLoading || convsLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                                <Skeleton className="w-9 h-9 rounded-xl" />
                                <div className="flex-1">
                                  <Skeleton className="h-3 w-28 mb-1" />
                                  <Skeleton className="h-2.5 w-20" />
                                </div>
                              </div>
                            ))
                          ) : convsError ? (
                            <div className="px-3 py-4 space-y-3">
                              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-xs font-semibold leading-relaxed text-red-100">
                                Gagal memuat chat list.
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full rounded-xl border-[#3F4147] text-[#DCDDDE] hover:bg-[#35373C] hover:text-white"
                                onClick={() => void refetchConversations()}
                              >
                                Coba Lagi
                              </Button>
                            </div>
                          ) : conversations.length === 0 ? (
                            <div className="text-center text-xs py-12 font-bold px-4 leading-relaxed text-[#949BA4]">
                              No conversations yet.<br />
                              Start a DM with a friend!
                            </div>
                          ) : (() => {
                            const filteredConvs = conversations.filter((c) => {
                              const name = c.type === "dm"
                                ? (c.otherDisplayName || c.otherUsername || "")
                                : (c.name || "");
                              return name.toLowerCase().includes(sidebarSearchQuery.toLowerCase());
                            });
                            const activeConvs = filteredConvs.filter((c) => !(c as any).archivedAt && c.type !== "group");
                            const archivedConvs = filteredConvs.filter((c) => !!(c as any).archivedAt && c.type !== "group");
                            
                            if (filteredConvs.length === 0 && sidebarSearchQuery) {
                              return (
                                <div className="text-center text-xs py-12 font-bold px-4 leading-relaxed text-[#949BA4]">
                                  Tidak ada percakapan yang cocok.
                                </div>
                              );
                            }

                            return (
                              <>
                                {activeConvs.map((c) => (
                                  <ConvItem
                                    key={c.id}
                                    conv={c}
                                    selected={selectedId === c.id}
                                    dark
                                    onClick={() => setSelectedId(c.id)}
                                    onPin={(id) => pinConvMutation.mutate(id)}
                                    onUnpin={(id) => unpinConvMutation.mutate(id)}
                                    onArchive={(id) => archiveConvMutation.mutate(id)}
                                    onUnarchive={(id) => unarchiveConvMutation.mutate(id)}
                                  />
                                ))}
                                {archivedConvs.length > 0 && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setShowArchived((v) => !v)}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold text-[#949BA4] hover:text-[#DCDDDE] transition-colors border-0 bg-transparent cursor-pointer"
                                    >
                                      <Archive className="w-3.5 h-3.5" />
                                      Diarsipkan ({archivedConvs.length})
                                      <ChevronDown className={`w-3.5 h-3.5 ml-auto transition-transform ${showArchived ? "rotate-180" : ""}`} />
                                    </button>
                                    {showArchived && archivedConvs.map((c) => (
                                      <ConvItem
                                        key={c.id}
                                        conv={c}
                                        selected={selectedId === c.id}
                                        dark
                                        onClick={() => setSelectedId(c.id)}
                                        onPin={(id) => pinConvMutation.mutate(id)}
                                        onUnpin={(id) => unpinConvMutation.mutate(id)}
                                        onArchive={(id) => archiveConvMutation.mutate(id)}
                                        onUnarchive={(id) => unarchiveConvMutation.mutate(id)}
                                      />
                                    ))}
                                  </>
                                )}
                              </>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  </ScrollArea>
                </>
              )}

              {/* Bottom User Status Bar (Discord Style) */}
              <div className="h-[52px] bg-[#232428] px-2 flex items-center justify-between shrink-0 select-none border-t border-[#1f2023]/35">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className={`rounded-full shrink-0 flex items-center justify-center p-0.5 overflow-visible ${(me as any)?.equippedBorder ? (me as any).equippedBorder : "border border-[#2b2d31]"}`}>
                    <div className="relative w-8 h-8 rounded-full">
                      <Avatar className="w-full h-full">
                        <AvatarImage src={me?.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-[10px] bg-[#35373c] font-black text-white">{getInitials(me?.displayName || me?.username)}</AvatarFallback>
                      </Avatar>
                      {/* Online status dot */}
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#23a55a] rounded-full border-[2px] border-[#232428]" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="text-[11px] font-black text-white truncate">{me?.displayName || me?.username}</p>
                    <p className="text-[9px] text-[#949BA4] truncate" title={me?.bio ?? "Online"}>
                      {me?.bio || "Online"}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-0.5 text-[#B5BAC1] shrink-0">
                  {/* Notification Bell */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button 
                        type="button"
                        className="p-1.5 rounded-md hover:bg-[#35373c] hover:text-white transition-colors relative cursor-pointer border-0 bg-transparent text-[#B5BAC1]"
                      >
                        <Bell className="w-4 h-4" />
                        {dbNotifications.length > 0 && (
                          <div className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] bg-[#f23f43] text-white text-[8px] font-extrabold rounded-full flex items-center justify-center px-0.5 animate-pulse">
                            {dbNotifications.length}
                          </div>
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="bg-[#18191c] border-[#3F4147] text-[#DCDDDE] w-80 max-h-96 overflow-y-auto p-0 rounded-xl shadow-2xl z-50"
                    >
                      <div className="p-3 border-b border-[#3F4147] flex items-center justify-between">
                        <span className="text-[10px] font-black text-white uppercase tracking-wider">Mentions & Pings</span>
                        {dbNotifications.length > 0 && (
                          <button
                            onClick={() => {
                              clearNotificationsMutation.mutate();
                            }}
                            className="text-[10px] font-extrabold text-blue-400 hover:underline border-0 bg-transparent cursor-pointer"
                          >
                            Hapus Semua
                          </button>
                        )}
                      </div>
                      
                      {dbNotifications.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-500 font-bold">
                          Tidak ada ping atau mention baru.
                        </div>
                      ) : (
                        <div className="divide-y divide-[#3F4147]/40">
                          {dbNotifications.map((n) => (
                            <div 
                              key={`notif-${n.id}`}
                              onClick={() => {
                                setSelectedId(n.conversationId);
                                readNotificationMutation.mutate({ id: n.id });
                              }}
                              className="p-3 hover:bg-[#35373c]/30 transition-colors flex gap-3 text-xs cursor-pointer"
                            >
                              <div className="w-8 h-8 rounded-full bg-slate-800 shrink-0 overflow-hidden">
                                {n.senderAvatar ? (
                                  <img src={n.senderAvatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center font-bold bg-purple-600 text-white">
                                    {n.senderName.slice(0, 1).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-extrabold text-white">{n.senderName}</span>
                                  <span className="text-[9px] text-slate-500 font-bold">
                                    {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-slate-300 text-[11px] line-clamp-2 leading-snug font-medium break-all">
                                  {n.content}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Settings / Premium Hub Link (Dropdown Menu) */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button 
                        type="button"
                        className="p-1.5 rounded-md hover:bg-[#35373c] hover:text-white transition-colors cursor-pointer border-0 bg-transparent text-[#B5BAC1]"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="bg-[#18191c] border-[#3F4147] text-[#DCDDDE] min-w-[160px]"
                    >
                      <DropdownMenuItem className="gap-2 cursor-pointer text-xs focus:bg-[#35373c]" asChild>
                        <Link href="/member?tab=profile" className="flex items-center w-full">
                          <Settings className="w-3.5 h-3.5" />
                          User Settings
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="gap-2 cursor-pointer text-xs focus:bg-[#35373c]"
                        onSelect={() => setShowDeveloperSettings(true)}
                      >
                        <Hammer className="w-3.5 h-3.5 text-[#5865F2]" />
                        Developer Settings
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

            </div>
          </div>

          {/* Active Chat Screen Console */}
          <div className={`${(selectedConv || activeView !== "chat") ? "flex" : "hidden md:flex"} flex-1 flex-col ${isGroupView || activeView !== "chat" ? "bg-[#18191C]" : "bg-[#efe7dd]"} overflow-hidden min-h-0`}>
            {activeView === "shop" ? (
              <div className="flex-1 flex flex-col bg-[#313338] text-[#DCDDDE] overflow-hidden animate-in fade-in-50 duration-200">
                {/* Shop Header */}
                <div className="p-6 border-b border-[#1f2023] bg-[#2b2d31] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-6 h-6 text-amber-500" />
                      <h1 className="text-xl font-black text-white tracking-wide">Shop</h1>
                    </div>
                    <p className="text-xs text-[#949BA4] mt-1 font-semibold">Beli bingkai avatar, latar belakang profil, dan lencana eksklusif.</p>
                  </div>
                  <div className="bg-[#1e1f22] px-4 py-2.5 rounded-xl border border-[#3F4147]/40 flex items-center gap-2 shrink-0">
                    <span className="text-xs font-black text-[#949BA4] uppercase tracking-wider">Saldo Anda:</span>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-black text-white">{me?.diamonds ?? 0}</span>
                      <span className="text-xs">🪙</span>
                    </div>
                  </div>
                </div>

                {/* Shop Items Grid */}
                <ScrollArea className="flex-1 p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pb-8">
                    {(() => {
                      const buyableItems = (gachaBoard?.cosmetics || []).filter((c: any) => c.isShop && (c.price ?? 0) > 0);
                      if (buyableItems.length === 0) {
                        return (
                          <div className="col-span-full text-center py-16 text-[#949BA4] font-semibold bg-[#2b2d31]/30 border border-[#3F4147]/20 rounded-2xl">
                            Belum ada item yang dijual di Toko saat ini.
                          </div>
                        );
                      }
                      return buyableItems.map((c: any) => {
                        const isOwned = gachaBoard.ownedCosmeticIds?.includes(c.id);
                        const cost = c.price ?? 0;
                        const isAffordable = (me?.diamonds ?? 0) >= cost;

                        const getRarityBadgeColor = (r: string) => {
                          if (r === "S") return "bg-rose-500/20 text-rose-400 border-rose-500/40";
                          if (r === "A") return "bg-amber-500/20 text-amber-400 border-amber-500/40";
                          if (r === "B") return "bg-purple-500/20 text-purple-400 border-purple-500/40";
                          if (r === "C") return "bg-blue-500/20 text-blue-400 border-blue-500/40";
                          return "bg-slate-500/20 text-slate-400 border-slate-500/40";
                        };

                        return (
                          <div 
                            key={c.id} 
                            className="bg-[#2b2d31] rounded-2xl border border-[#1f2023]/80 p-4 flex flex-col gap-4 hover:border-[#3f4147] transition-all duration-200 shadow-lg group/card"
                          >
                            {/* Item Rarity & Type */}
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${getRarityBadgeColor(c.rarity)}`}>
                                Rarity {c.rarity}
                              </span>
                              <span className="text-[10px] font-black text-[#949BA4] uppercase tracking-wider">
                                {c.type}
                              </span>
                            </div>

                            {/* Interactive Cosmetic Preview */}
                            <div className="h-28 bg-[#1e1f22] rounded-xl flex items-center justify-center relative overflow-hidden border border-[#1f2023]/60 shadow-inner">
                              {c.type === "border" ? (
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center p-0.5 border ${c.value}`}>
                                  <Avatar className="w-full h-full">
                                    <AvatarImage src={me?.avatarUrl ?? undefined} />
                                    <AvatarFallback className="text-xs bg-slate-800 text-white font-bold">U</AvatarFallback>
                                  </Avatar>
                                </div>
                              ) : c.type === "background" ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center">
                                  <div className="absolute inset-0 bg-cover bg-center opacity-50" style={{ backgroundImage: `url(${c.value})` }} />
                                  <div className="absolute inset-0 bg-black/40 z-0" />
                                  <span className="text-[10px] font-black text-slate-300 uppercase relative z-10">Latar Belakang</span>
                                  <span className="text-xs font-bold text-white truncate max-w-full relative z-10 px-2 mt-0.5">{c.name}</span>
                                </div>
                              ) : (c.type === "premium" || c.type === "premium_plus") ? (
                                <div className="flex flex-col items-center gap-1 z-10">
                                  <span className={`text-3xl filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.35)] animate-bounce duration-1000 ${c.type === "premium_plus" ? "text-pink-500" : "text-amber-400"}`}>
                                    👑
                                  </span>
                                  <span className={`text-[10px] font-black uppercase tracking-widest mt-1 ${c.type === "premium_plus" ? "text-pink-400" : "text-amber-400"}`}>
                                    {c.value} Hari {c.type === "premium_plus" ? "Premium+" : "Premium"}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-2">
                                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase border tracking-wider ${c.value}`}>
                                    {c.name}
                                  </span>
                                  <span className="text-[9px] font-black text-[#949BA4] uppercase tracking-widest">Badge</span>
                                </div>
                              )}
                            </div>

                            {/* Name & Description */}
                            <div className="min-w-0">
                              <h3 className="text-sm font-extrabold text-white truncate">{c.name}</h3>
                              <p className="text-[10px] text-[#949BA4] font-semibold mt-1 line-clamp-2 min-h-[2.5rem]">
                                {c.description || "Tingkatkan estetika profilmu agar terlihat semakin premium."}
                              </p>
                            </div>

                            {/* Purchase Actions */}
                            <div className="mt-auto pt-2 flex items-center justify-between gap-2 border-t border-[#1f2023]/40">
                              <div className="flex items-center gap-1">
                                <span className="text-sm font-black text-white">{cost}</span>
                                <span className="text-xs">🪙</span>
                              </div>

                              {isOwned ? (
                                <Button 
                                  disabled 
                                  size="sm" 
                                  className="bg-[#23a55a]/20 text-[#23a55a] rounded-xl font-bold text-xs border border-[#23a55a]/30"
                                >
                                  Dimiliki
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  disabled={!isAffordable || buyCosmeticMutation.isPending}
                                  onClick={() => buyCosmeticMutation.mutate(c.id)}
                                  className={`rounded-xl font-bold text-xs shadow-md ${
                                    isAffordable 
                                      ? "bg-[#5865F2] hover:bg-[#4752C4] text-white shadow-indigo-900/10 cursor-pointer" 
                                      : "bg-slate-700 text-slate-500 cursor-not-allowed"
                                  }`}
                                >
                                  {buyCosmeticMutation.isPending ? "Proses..." : "Beli"}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </ScrollArea>
              </div>
            ) : activeView === "quests" ? (
              <div className="flex-1 flex flex-col bg-[#313338] text-[#DCDDDE] overflow-hidden animate-in fade-in-50 duration-200">
                {/* Quests Header */}
                <div className="p-6 border-b border-[#1f2023] bg-[#2b2d31] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <Trophy className="w-6 h-6 text-yellow-500" />
                      <h1 className="text-xl font-black text-white tracking-wide">Quests</h1>
                    </div>
                    <p className="text-xs text-[#949BA4] mt-1 font-semibold">Selesaikan misi di bawah untuk mendapatkan Token tambahan.</p>
                  </div>
                </div>

                {/* Quests List */}
                <ScrollArea className="flex-1 p-6">
                  {questsLoading ? (
                    <div className="space-y-4 max-w-3xl mx-auto">
                      <Skeleton className="h-24 w-full rounded-2xl" />
                      <Skeleton className="h-24 w-full rounded-2xl" />
                    </div>
                  ) : quests.length === 0 ? (
                    <div className="text-center py-16 text-[#949BA4] bg-[#2b2d31] border border-[#1f2023] rounded-2xl max-w-3xl mx-auto">
                      Belum ada misi yang tersedia.
                    </div>
                  ) : (
                    <div className="space-y-4 max-w-3xl mx-auto">
                      {quests.map((q: any) => {
                        const isCompleted = q.current >= q.target;
                        const progressPercent = Math.round((q.current / q.target) * 100);

                        return (
                          <div 
                            key={q.id} 
                            className="bg-[#2b2d31] rounded-2xl border border-[#1f2023]/80 p-5 flex flex-col sm:flex-row sm:items-center gap-5 hover:border-[#3f4147] transition-all duration-200 shadow-lg"
                          >
                            {/* Left: Quest Icon */}
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                              isCompleted 
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" 
                                : "bg-[#1e1f22] text-yellow-500 border border-[#1f2023]"
                            }`}>
                              {q.type === "chat" ? (
                                <MessageSquare className="w-6 h-6" />
                              ) : q.type === "search" ? (
                                <Search className="w-6 h-6" />
                              ) : q.type === "dm" ? (
                                <Plus className="w-6 h-6" />
                              ) : (
                                <Video className="w-6 h-6 text-rose-400" />
                              )}
                            </div>

                            {/* Middle: Details & Progress */}
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-extrabold text-white">{q.title}</h3>
                                {q.claimed && (
                                  <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                    Klaim Selesai
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[#949BA4] font-semibold leading-relaxed">{q.desc}</p>
                              
                              {/* Progress bar */}
                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-2 bg-[#1e1f22] rounded-full overflow-hidden border border-[#1f2023]/30">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      isCompleted ? "bg-emerald-500" : "bg-yellow-500"
                                    }`} 
                                    style={{ width: `${progressPercent}%` }} 
                                  />
                                </div>
                                <span className="text-[10px] font-black text-[#949BA4] tracking-wide shrink-0">
                                  {q.current} / {q.target}
                                </span>
                              </div>
                            </div>

                            {/* Right: Reward & Actions */}
                            <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-4 shrink-0 border-t sm:border-t-0 border-[#1f2023]/40 pt-4 sm:pt-0">
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] font-black text-[#949BA4] uppercase tracking-wider">Hadiah:</span>
                                <span className="text-xs font-black text-white">{q.reward}</span>
                                <span className="text-xs">🪙</span>
                              </div>

                              {q.claimed ? (
                                <Button 
                                  disabled 
                                  size="sm" 
                                  className="bg-slate-700 text-slate-500 rounded-xl font-bold text-xs"
                                >
                                  Selesai
                                </Button>
                              ) : isCompleted ? (
                                <Button
                                  size="sm"
                                  disabled={claimQuestMutation.isPending}
                                  onClick={() => claimQuestMutation.mutate(q)}
                                  className="bg-[#23a55a] hover:bg-[#1a7f45] text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-950/20 cursor-pointer"
                                >
                                  {claimQuestMutation.isPending ? "Klaim..." : "Klaim Hadiah"}
                                </Button>
                              ) : q.type === "video" ? (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setActiveVideoQuest(q);
                                    setVideoWatchTimer(q.duration || 15);
                                    setVideoWatchCompleted(false);
                                    setShowVideoQuestModal(true);
                                  }}
                                  className="bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-950/20 cursor-pointer animate-pulse"
                                >
                                  Mulai Nonton
                                </Button>
                              ) : (
                                <Button
                                  disabled
                                  size="sm"
                                  className="bg-slate-750 text-slate-500 rounded-xl font-bold text-xs"
                                >
                                  Belum Selesai
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            ) : selectedConv === null ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner ${isGroupView ? "bg-[#2B2D31] text-[#5865F2]" : "bg-violet-50 text-[#6366f1]"}`}>
                  <MessageSquare className="w-8 h-8" />
                </div>
                <div className="text-center space-y-1">
                  <p className={`text-sm font-extrabold ${isGroupView ? "text-[#DCDDDE]" : "text-[#110e3d]"}`}>No Conversation Selected</p>
                  <p className={`text-xs font-semibold max-w-[280px] ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>Select a friend or group from the list to start chatting.</p>
                </div>
              </div>
            ) : (
              <>
                {/* Chat Top Header Panel */}
                <div className={`h-14 sm:h-16 border-b ${isGroupView ? "border-[#1E1F22] bg-[#2B2D31]" : "border-[#d7e4de] bg-[#075e54]"} px-2 sm:px-4 md:px-6 flex items-center justify-between shrink-0 text-white`}>
                  <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden h-8 w-8 rounded-full text-white hover:bg-white/10 hover:text-white shrink-0 -ml-1"
                      onClick={() => setSelectedId(null)}
                      title="Back to chats"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                    {selectedConv.type === "group" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden h-8 w-8 rounded-full text-white hover:bg-white/10 hover:text-white shrink-0"
                        onClick={() => setMobileChannelDrawerOpen(true)}
                        title="Channels"
                      >
                        <Hash className="h-5 w-5" />
                      </Button>
                    )}
                    <button
                      onClick={() => setShowInfoPanel((p) => !p)}
                      className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity rounded-lg px-1 py-0.5"
                    >
                      <div className={`rounded-full shrink-0 flex items-center justify-center p-0.5 overflow-visible ${selectedConv.type === "dm" && (selectedConv as any).otherUserEquippedBorder ? (selectedConv as any).otherUserEquippedBorder : "border border-[#eae8f5]"}`}>
                        <Avatar className="w-8 h-8 sm:w-9 sm:h-9 shrink-0">
                          <AvatarImage
                            src={
                              selectedConv.type === "dm"
                                ? (selectedConv.otherAvatarUrl ?? undefined)
                                : (selectedConv.iconUrl ?? undefined)
                            }
                          />
                          <AvatarFallback className="text-xs bg-slate-100 font-bold text-[#6366f1]">{getInitials(selectedName)}</AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-extrabold text-[13px] sm:text-sm leading-none truncate max-w-[34vw] sm:max-w-none">{selectedName}</p>
                          {/* Verified badge in header */}
                          {selectedConv.type === "dm" && (selectedConv as any).otherUserIsVerified && (
                            <BadgeCheck className="w-4 h-4 text-blue-300 fill-blue-300/20 shrink-0" />
                          )}
                          {selectedConv.type === "dm" && (selectedConv as any).otherUserIsBusinessVerified && (
                            <BadgeCheck className="w-4 h-4 text-emerald-500 fill-emerald-500/20 shrink-0" />
                          )}
                          {selectedConv.type === "group" && (selectedConv as any).isVerified && (
                            <BadgeCheck className="w-4 h-4 text-blue-300 fill-blue-300/20 shrink-0" />
                          )}
                          {selectedConv.type === "group" && groupBoosts && groupBoosts.activeBoostCount > 0 && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-600/30 border border-violet-500/50 text-[9px] font-black text-violet-300 uppercase tracking-wide cursor-help shrink-0"
                              title={`Group Level ${groupBoosts.level} (${groupBoosts.activeBoostCount} boosts)`}
                            >
                              <Sparkles className="h-3 w-3 text-violet-400 fill-violet-400 animate-pulse" />
                              Lvl {groupBoosts.level}
                            </span>
                          )}
                          {selectedConv.type === "group" && (selectedConv.ownerId === me?.id || myPerms?.permissions?.manageChannels || myPerms?.permissions?.manageRoles) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); openEditGroup(); }}
                              className="text-[10px] text-white/60 hover:text-white transition-colors font-bold"
                              title="Edit Group"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-white/70 font-bold mt-0.5">
                          {selectedConv.type === "dm" ? "Direct Message" : selectedChannel ? `#${selectedChannel.name}` : `${selectedConv.memberCount} members`}
                        </p>
                      </div>
                    </button>
                  </div>

                  <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
                    {selectedConv.type === "dm" && selectedConv.otherUserId && (
                      <>
                        {(selectedConv as any).otherUserIsSeller && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 rounded-full text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors cursor-pointer"
                            onClick={() => setShowInfoPanel(true)}
                            title="Buka Katalog Toko"
                          >
                            <ShoppingBag className="h-5 w-5 text-emerald-500" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className={`h-9 w-9 rounded-full transition-colors ${
                            blockedUsers.some((u: any) => u.userId === selectedConv.otherUserId)
                              ? "text-red-500 hover:bg-red-500/10 hover:text-red-500"
                              : "text-white/80 hover:bg-white/10 hover:text-white"
                          }`}
                          onClick={async () => {
                            const isBlocked = blockedUsers.some((u: any) => u.userId === selectedConv.otherUserId);
                            if (isBlocked) {
                              await unblockMutation.mutateAsync(selectedConv.otherUserId!);
                            } else {
                              if (confirm(`Apakah Anda yakin ingin memblokir ${selectedName}?`)) {
                                await blockMutation.mutateAsync(selectedConv.otherUserId!);
                              }
                            }
                          }}
                          title={
                            blockedUsers.some((u: any) => u.userId === selectedConv.otherUserId)
                              ? "Unblock User"
                              : "Block User"
                          }
                          disabled={blockMutation.isPending || unblockMutation.isPending}
                        >
                          <Ban className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                        </Button>

                        <Button asChild size="icon" variant="ghost" className="hidden sm:inline-flex h-9 w-9 rounded-full text-white hover:bg-white/10 hover:text-white transition-colors" title="View Profile">
                          <Link href={`/profile/${selectedConv.otherUserId}`}><UserCircle className="h-5 w-5" /></Link>
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 sm:h-9 sm:w-9 rounded-full p-0 text-white hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                      onClick={() => setStarredOpen(true)}
                      title="Pesan Berbintang"
                    >
                      <Star className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 sm:h-9 sm:w-9 rounded-full p-0 text-white hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                      onClick={() => setPinnedModalOpen(true)}
                      title="Pesan Tersemat"
                    >
                      <Pin className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                    </Button>
                    {selectedConv.type !== "group" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 sm:h-9 sm:w-9 rounded-full p-0 text-white hover:bg-white/10 hover:text-white transition-colors"
                        onClick={() => {
                          setCallType("voice");
                          setShowCall(true);
                          setCallContext({
                            conversationId: selectedId!,
                            conversationName: selectedName,
                            channelId: null,
                            channelName: null,
                          });
                          setIsCallMinimized(false);
                        }}
                        title="Voice Call"
                      >
                        <Phone className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                      </Button>
                    )}
                    {selectedConv.type === "group" && selectedChannel?.type === "voice" && (
                      <Button
                        size="sm"
                        className="inline-flex items-center gap-1.5 bg-[#5865F2] hover:bg-[#4752C4] text-white font-extrabold text-xs px-3.5 py-1.5 rounded-xl transition-all shadow-md cursor-pointer mr-2.5"
                        onClick={() => {
                          if (selectedId && selectedChannel) {
                            handleJoinVoice(selectedId, selectedChannel.id);
                          }
                        }}
                      >
                        <Volume2 className="w-4 h-4 text-white" /> Join Voice
                      </Button>
                    )}
                    {selectedConv.type === "group" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="hidden sm:inline-flex h-8 px-3 text-xs font-bold rounded-full text-white hover:bg-white/10 hover:text-white transition-colors"
                        onClick={() => setShowMembers(true)}
                      >
                        Members
                      </Button>
                    )}
                  </div>
                </div>

                {selectedChannel?.type === "forum" ? (
                  forumActivePostId !== null
                    ? renderForumThreadDetailView()
                    : renderForumBoardView()
                ) : (
                  <>
                {/* Pinned message banner strip (WhatsApp style) */}
                {latestPinnedMessage && (
                  <div
                    className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer select-none border-b transition-colors ${
                      isGroupView
                        ? "bg-[#1f2c34] border-[#2a3942] hover:bg-[#2a3942]"
                        : "bg-[#f7f5f0] border-[#ddd8d0] hover:bg-[#ede8e3]"
                    }`}
                    onClick={() => {
                      const el = document.getElementById(`message-${latestPinnedMessage.id}`);
                      if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                        el.classList.add("bg-yellow-500/20", "transition-all", "duration-500");
                        setTimeout(() => el.classList.remove("bg-yellow-500/20"), 2000);
                      }
                    }}
                  >
                    <Pin className={`w-3.5 h-3.5 shrink-0 rotate-45 ${isGroupView ? "text-sky-400" : "text-[#075e54]"}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-[9.5px] font-black uppercase tracking-widest mb-0.5 ${isGroupView ? "text-sky-400" : "text-[#075e54]"}`}>
                        Pesan Tersemat
                      </p>
                      <p className={`text-[11.5px] truncate font-medium leading-tight ${isGroupView ? "text-[#adbac7]" : "text-[#3c5046]"}`}>
                        {getMessagePreviewText(latestPinnedMessage) || latestPinnedMessage.content || "Media"}
                      </p>
                    </div>
                    {activePinnedMessages.length > 1 && (
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${
                        isGroupView ? "bg-sky-400/15 text-sky-400" : "bg-[#075e54]/10 text-[#075e54]"
                      }`}>
                        {activePinnedMessages.length}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setPinnedModalOpen(true); }}
                      className={`text-[9px] font-black shrink-0 px-2 py-1 rounded-lg transition-colors ${
                        isGroupView ? "text-sky-400 hover:bg-sky-400/10" : "text-[#075e54] hover:bg-[#075e54]/10"
                      }`}
                    >
                      Lihat Semua
                    </button>
                  </div>
                )}

                {/* Messages Bubbles Feed */}
                <ScrollArea className={`flex-1 px-2.5 sm:px-4 md:px-6 py-3 sm:py-4 min-h-0 relative overflow-x-hidden ${isGroupView ? "bg-[#313338]" : "bg-[#efe7dd]"}`}>
                  <div
                    className="absolute inset-0 pointer-events-none bg-repeat"
                    style={{
                      backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
                      backgroundSize: "400px",
                      opacity: isGroupView ? 0 : 0.07,
                      mixBlendMode: isGroupView ? "difference" : "multiply",
                    }}
                  />
                  {activeMsgsLoading ? (
                    <div className="space-y-4">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className={`flex gap-3 items-start ${i % 3 === 0 ? "flex-row-reverse" : ""}`}
                        >
                          <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                          <Skeleton
                            className={`h-9 rounded-2xl ${i % 3 === 0 ? "w-32 rounded-tr-none" : "w-48 rounded-tl-none"}`}
                          />
                        </div>
                      ))}
                    </div>
                  ) : activeMsgsError ? (
                    <div className="flex min-h-[260px] items-center justify-center px-3">
                      <div className={`w-full max-w-md rounded-2xl border px-4 py-4 text-center shadow-sm ${isGroupView ? "border-red-500/30 bg-red-500/10 text-red-100" : "border-red-200 bg-red-50 text-red-700"}`}>
                        <p className="text-sm font-extrabold">Chat gagal dimuat</p>
                        <p className="mt-1 text-xs font-semibold leading-relaxed">
                          {activeMessagesError instanceof Error ? activeMessagesError.message : "Request timeout atau server chat lagi ngadat."}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className={`mt-3 rounded-xl ${isGroupView ? "border-[#3F4147] text-[#DCDDDE] hover:bg-[#35373C] hover:text-white" : "border-red-200 text-red-700 hover:bg-red-100"}`}
                          onClick={() => void refetchActiveMessages()}
                        >
                          Muat Ulang Chat
                        </Button>
                      </div>
                    </div>
                  ) : activeMessages.length === 0 ? (
                    <div className={`text-center text-xs py-16 font-bold ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>
                      No messages yet. Say hello!
                    </div>
                  ) : (
                    (() => {
                      let lastDateStr = "";
                      return activeMessages.map((msg) => {
                        // Hide messages from blocked users (skip system messages — they have no senderId)
                        if (msg.senderId && blockedIdsSet.has(msg.senderId)) return null;

                        const msgDate = new Date(msg.createdAt);
                        const dateKey = `${msgDate.getFullYear()}-${msgDate.getMonth()}-${msgDate.getDate()}`;
                        const showDivider = dateKey !== lastDateStr;
                        lastDateStr = dateKey;

                        return (
                          <div key={msg.id} className="flex flex-col gap-2 mb-2.5">
                            {showDivider && (
                              <div className="flex items-center justify-center my-3">
                                <div className={`${isGroupView ? "bg-[#2B2D31] text-[#949BA4]" : "bg-[#dcebe7] text-[#52635d]"} text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider shadow-sm`}>
                                  {formatMessageDateSeparator(msg.createdAt)}
                                </div>
                              </div>
                            )}
                            <MessageBubble
                              msg={msg}
                              isOwn={msg.senderId === me?.id}
                              isGroup={isGroupView}
                              onUserClick={msg.senderId ? () => openProfileFromMessage(msg) : undefined}
                              onForward={() => handleForwardMessage(msg.id)}
                              onDelete={
                                (msg.senderId === me?.id || selectedConv?.ownerId === me?.id || myPerms?.permissions?.manageMessages)
                                  ? () => handleDeleteMessage(msg.id, msg.senderId === me?.id)
                                  : undefined
                              }
                              onReply={() => setReplyToMessage(msg)}
                              onPin={() => handleTogglePin(msg)}
                              onStar={() => handleToggleStar(msg)}
                              onReact={(emoji) => handleToggleReaction(msg.id, emoji, msg.reactions?.some((r) => r.emoji === emoji && r.userReacted) ?? false)}
                              onBubbleClick={(e, m) => {
                                setContextMenu({
                                  msg: m,
                                  x: e.clientX,
                                  y: e.clientY,
                                  isOwn: m.senderId === me?.id,
                                });
                              }}
                              me={me}
                              customEmojis={emojiLibrary?.emojis}
                              currentConversationId={selectedId}
                              isAnyOtherMemberOnline={isAnyOtherMemberOnline}
                            />
                          </div>
                        );
                      });
                    })()
                  )}
                  {/* AI Typing Indicator */}
                  {aiTyping && (
                    <div className="flex items-center gap-2 my-2 px-1">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-500 via-cyan-400 to-indigo-500 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-black text-white">AI</span>
                      </div>
                      <div className={`${isGroupView ? "bg-[#2B2D31] border border-[#3F4147]" : "bg-white/80 border border-[#e2e8f0]"} rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm`}>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                      <span className={`text-[11px] font-medium ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>Zaidan AI sedang mengetik...</span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </ScrollArea>

                {/* Bottom Input Console */}
                {(() => {
                  const isOwner = selectedConv?.ownerId === me?.id;
                  const isGroup = selectedConv?.type === "group";
                  const hasSendPermission = !isGroup || isOwner || myPerms?.permissions?.sendMessages;
                  const isSuspended = (selectedConv as any)?.isSuspended;

                  if (isSuspended) {
                    return (
                      <div className={`px-2 sm:px-4 md:px-6 py-4 border-t shrink-0 flex items-center justify-center text-xs font-bold gap-2 ${isGroupView ? "border-[#3F4147] bg-[#1E1F22] text-[#ef4444]" : "border-[#fecaca] bg-[#fef2f2] text-red-700"}`}>
                        <Ban className="w-4 h-4 text-red-500 animate-pulse" />
                        Grup ini telah ditangguhkan oleh admin.
                      </div>
                    );
                  }
                  
                  const canPostAnnounce = isOwner || myPerms?.permissions?.postAnnouncements;
                  const isAnnounceChannel = selectedChannel?.type === "announce";
                  const cannotChatInAnnounce = isAnnounceChannel && !canPostAnnounce;

                  if (cannotChatInAnnounce) {
                    return (
                      <div className={`px-2 sm:px-4 md:px-6 py-4 border-t shrink-0 flex items-center justify-center text-xs font-bold gap-2 ${isGroupView ? "border-[#3F4147] bg-[#1E1F22] text-[#949BA4]" : "border-[#d8cec1] bg-[#f0e7dd] text-slate-500"}`}>
                        <Megaphone className="w-4 h-4 text-amber-500 animate-pulse" />
                        Only announcement posters can send messages in this channel.
                      </div>
                    );
                  }

                  if (!hasSendPermission) {
                    return (
                      <div className={`px-2 sm:px-4 md:px-6 py-4 border-t shrink-0 flex items-center justify-center text-xs font-bold gap-2 ${isGroupView ? "border-[#3F4147] bg-[#1E1F22] text-[#949BA4]" : "border-[#d8cec1] bg-[#f0e7dd] text-slate-500"}`}>
                        <ShieldAlert className="w-4 h-4 text-red-500 animate-pulse" />
                        You do not have permission to send messages in this group.
                      </div>
                    );
                  }

                  return (
                    <div className={`px-2 sm:px-4 md:px-6 py-2 sm:py-3 pb-3 sm:pb-4 border-t shrink-0 ${isGroupView ? "border-[#3F4147] bg-[#1E1F22]" : "border-[#d8cec1] bg-[#f0e7dd]"}`}>
                      {attachedFile && (
                        <div className={`relative mb-2 ml-12 flex max-w-[min(360px,calc(100%-3rem))] items-center gap-3 rounded-xl border px-3 py-2 shadow-sm ${isGroupView ? "border-[#3F4147] bg-[#2B2D31]" : "border-[#d7e4de] bg-white"}`}>
                          {attachedImageUrl ? (
                            <img src={attachedImageUrl} alt="Attachment preview" className="h-12 w-16 rounded-lg object-cover border border-black/5" />
                          ) : (
                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${isGroupView ? "bg-[#35373C] text-[#DCDDDE]" : "bg-[#edf5f1] text-[#075e54]"}`}>
                              <File className="h-5 w-5" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-xs font-black ${isGroupView ? "text-[#DCDDDE]" : "text-[#18251f]"}`}>{attachedFile.name}</p>
                            <p className={`truncate text-[10px] font-semibold ${isGroupView ? "text-[#949BA4]" : "text-slate-500"}`}>
                              {formatFileSize(attachedFile.size)}{attachedFile.mimeType ? ` - ${attachedFile.mimeType}` : ""}
                            </p>
                          </div>
                          <button
                            onClick={() => { setAttachedFile(null); setAttachedImageUrl(null); }}
                            className="shrink-0 rounded-full bg-black/50 hover:bg-black text-white w-6 h-6 flex items-center justify-center transition-colors"
                            type="button"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                      {replyToMessage && (
                        <div className={`flex items-center justify-between gap-3 px-4 py-2 border-b rounded-t-xl mb-1.5 animate-in slide-in-from-bottom duration-150 ${
                          isGroupView ? "bg-[#2B2D31] border-[#3F4147] text-[#DCDDDE]" : "bg-emerald-50 border-emerald-100 text-[#075e54]"
                        }`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <CornerUpLeft className="w-4 h-4 text-slate-400 shrink-0" />
                            <div className="min-w-0 text-xs">
                              <span className="font-extrabold text-[11px]">Membalas @{replyToMessage.senderUsername || "someone"}</span>
                              <p className="truncate opacity-80 mt-0.5 max-w-[250px] sm:max-w-[450px] text-[11px]">
                                {getMessagePreviewText(replyToMessage)}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => setReplyToMessage(null)}
                            className="p-1 rounded-full hover:bg-black/10 transition-colors cursor-pointer shrink-0"
                            type="button"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      <div className="flex items-end gap-2">
                        <input
                          type="file"
                          className="hidden"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className={`hover:bg-opacity-70 transition-all shrink-0 rounded-full h-11 w-11 ${isGroupView ? "text-[#949BA4]" : "text-[#54656f]"}`}
                          title="Attach file"
                        >
                          {uploading ? (
                            <span className="h-4 w-4 rounded-full border-2 border-[#075e54]/20 border-t-[#075e54] animate-spin" />
                          ) : (
                            <File className="h-5 w-5" />
                          )}
                        </Button>
                        <div className="relative shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowStickerPicker((open) => !open)}
                            className={`hover:bg-opacity-70 transition-all rounded-full h-11 w-11 ${isGroupView ? "text-[#949BA4]" : "text-[#54656f]"}`}
                            title="Open sticker picker"
                          >
                            <Sparkles className="h-5 w-5" />
                          </Button>
                          {showStickerPicker && (
                            <div className={`absolute bottom-full left-0 mb-2 w-[480px] h-[480px] rounded-2xl border shadow-2xl z-50 overflow-hidden flex ${isGroupView ? "border-[#3F4147] bg-[#2B2D31]" : "border-[#e2e8f0] bg-white text-slate-900"}`}>
                              {/* Left Sidebar */}
                              <div className={`w-[60px] flex flex-col items-center py-3 gap-2 border-r shrink-0 overflow-y-auto ${isGroupView ? "bg-[#1E1F22] border-[#3F4147]" : "bg-slate-50 border-[#e2e8f0]"}`}>
                                {activePickerTab === "stickers" ? (
                                  <>
                                    {recentStickers.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const el = document.getElementById("sticker-group-recent");
                                          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                                        }}
                                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${isGroupView ? "bg-[#2B2D31] text-[#5865F2] hover:bg-[#313338]" : "bg-white text-violet-600 hover:bg-slate-100 shadow-sm"} hover:scale-105`}
                                        title="Frequently Used"
                                      >
                                        <Clock className="w-5 h-5" />
                                      </button>
                                    )}
                                    {stickerGroups.map((group) => {
                                      const initials = group.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                                      return (
                                        <button
                                          key={group.id || 0}
                                          type="button"
                                          onClick={() => {
                                            const el = document.getElementById(`sticker-group-${group.id || 0}`);
                                            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                                          }}
                                          className="group relative w-9 h-9 rounded-full overflow-hidden flex items-center justify-center transition-all hover:rounded-xl cursor-pointer shadow-sm shrink-0 hover:scale-105"
                                          title={group.name}
                                        >
                                          {group.iconUrl ? (
                                            <img src={group.iconUrl} alt={group.name} className="w-full h-full object-cover" />
                                          ) : (
                                            <div className={`w-full h-full flex items-center justify-center text-[10px] font-black ${isGroupView ? "bg-[#313338] text-[#DCDDDE]" : "bg-slate-200 text-slate-700"}`}>
                                              {initials}
                                            </div>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </>
                                ) : (
                                  <>
                                    {emojiGroups.map((group) => {
                                      const isStandard = group.isStandard;
                                      const initials = group.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                                      const isLocked = !isStandard && group.id !== selectedId && 
                                        me?.role !== "premium" && me?.role !== "premium_plus" && me?.role !== "dev_website" && me?.role !== "admin";
                                      
                                      return (
                                        <button
                                          key={group.id}
                                          type="button"
                                          onClick={() => {
                                            const el = document.getElementById(`emoji-group-${group.id}`);
                                            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                                          }}
                                          className="group relative w-9 h-9 rounded-full overflow-hidden flex items-center justify-center transition-all hover:rounded-xl cursor-pointer shadow-sm shrink-0 hover:scale-105"
                                          title={group.name}
                                        >
                                          {isStandard ? (
                                            <div className={`w-full h-full flex items-center justify-center text-lg ${isGroupView ? "bg-[#313338] text-white" : "bg-slate-200 text-slate-700"}`}>
                                              <Clock className="w-5 h-5" />
                                            </div>
                                          ) : group.iconUrl ? (
                                            <img src={group.iconUrl} alt={group.name} className="w-full h-full object-cover" />
                                          ) : (
                                            <div className={`w-full h-full flex items-center justify-center text-[10px] font-black ${isGroupView ? "bg-[#313338] text-[#DCDDDE]" : "bg-slate-200 text-slate-700"}`}>
                                              {initials}
                                            </div>
                                          )}
                                          {isLocked && (
                                            <div className="absolute bottom-0 right-0 bg-black/70 text-amber-400 rounded-full p-0.5 border border-[#3F4147]">
                                              <svg className="w-2 h-2 fill-current" viewBox="0 0 24 24"><path d="M18,8H17V6A5,5 0 0,0 12,1A5,5 0 0,0 7,6V8H6A2,2 0 0,0 4,10V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V10A2,2 0 0,0 18,8M8.9,6C8.9,4.29 10.29,2.9 12,2.9C13.71,2.9 15.1,4.29 15.1,6V8H8.9V6M18,20H6V10H18V20Z"/></svg>
                                            </div>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </>
                                )}
                              </div>

                              {/* Right Main Panel */}
                              <div className="flex-1 flex flex-col min-w-0">
                                {/* Tabs */}
                                <div className={`flex border-b shrink-0 px-3 py-1 gap-2 ${isGroupView ? "bg-[#2B2D31] border-[#3F4147]" : "bg-white border-[#e2e8f0]"}`}>
                                  <button
                                    type="button"
                                    onClick={() => setActivePickerTab("stickers")}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                      activePickerTab === "stickers"
                                        ? isGroupView ? "bg-[#35373C] text-white" : "bg-slate-100 text-slate-900"
                                        : isGroupView ? "text-[#949BA4] hover:text-white" : "text-slate-500 hover:text-slate-900"
                                    }`}
                                  >
                                    Stickers
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setActivePickerTab("emoji")}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                      activePickerTab === "emoji"
                                        ? isGroupView ? "bg-[#35373C] text-white" : "bg-slate-100 text-slate-900"
                                        : isGroupView ? "text-[#949BA4] hover:text-white" : "text-slate-500 hover:text-slate-900"
                                    }`}
                                  >
                                    Emoji
                                  </button>
                                </div>

                                {/* Search */}
                                {(activePickerTab === "stickers" || activePickerTab === "emoji") && (
                                  <div className={`px-3 py-2 border-b shrink-0 ${isGroupView ? "border-[#3F4147]" : "border-[#e2e8f0]"}`}>
                                    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${isGroupView ? "bg-[#1E1F22]" : "bg-slate-100"}`}>
                                      <Search className={`h-3.5 w-3.5 shrink-0 ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`} />
                                      {activePickerTab === "stickers" ? (
                                        <input
                                          type="text"
                                          value={stickerSearch}
                                          onChange={(e) => setStickerSearch(e.target.value)}
                                          placeholder="Find the perfect sticker"
                                          className={`w-full bg-transparent text-xs font-medium outline-none ${isGroupView ? "text-[#DCDDDE] placeholder:text-[#949BA4]" : "text-slate-800 placeholder:text-slate-400"}`}
                                        />
                                      ) : (
                                        <input
                                          type="text"
                                          value={emojiSearch}
                                          onChange={(e) => setEmojiSearch(e.target.value)}
                                          placeholder="Search emojis"
                                          className={`w-full bg-transparent text-xs font-medium outline-none ${isGroupView ? "text-[#DCDDDE] placeholder:text-[#949BA4]" : "text-slate-800 placeholder:text-slate-400"}`}
                                        />
                                      )}
                                      {((activePickerTab === "stickers" && stickerSearch) || (activePickerTab === "emoji" && emojiSearch)) && (
                                        <button
                                          type="button"
                                          onClick={() => activePickerTab === "stickers" ? setStickerSearch("") : setEmojiSearch("")}
                                          className={`shrink-0 ${isGroupView ? "text-[#949BA4] hover:text-white" : "text-slate-400 hover:text-slate-600"}`}
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Content Grid */}
                                <div className="flex-1 overflow-y-auto min-h-0 relative">
                                  {activePickerTab === "emoji" && (
                                    <div className="space-y-4 py-2">
                                      {emojiGroups.map((group) => {
                                        const isStandard = group.isStandard;
                                        return (
                                          <div key={group.id} id={`emoji-group-${group.id}`} className={`border-b last:border-b-0 pb-3 ${isGroupView ? "border-[#3F4147]" : "border-[#e2e8f0]"}`}>
                                            <div className="flex items-center justify-between px-3 py-1.5 mb-1">
                                              <span className={`text-[10px] font-black uppercase tracking-wider truncate max-w-[200px] ${isGroupView ? "text-[#949BA4]" : "text-slate-500"}`}>
                                                {group.name}
                                              </span>
                                              {!isStandard && group.id === selectedId && selectedConv?.ownerId === me?.id && (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setShowStickerPicker(false);
                                                    setShowEmojiManager(true);
                                                  }}
                                                  className="text-[9px] font-black uppercase tracking-wider text-[#5865F2] hover:underline"
                                                >
                                                  Manage Emojis
                                                </button>
                                              )}
                                            </div>

                                            {group.emojis.length > 0 ? (
                                              <div className="grid grid-cols-8 gap-1.5 px-3">
                                                {group.emojis.map((emoji: any) => {
                                                  const isLocked = !isStandard && emoji.conversationId !== selectedId && 
                                                    me?.role !== "premium" && me?.role !== "premium_plus" && me?.role !== "dev_website" && me?.role !== "admin";
                                                  
                                                  return (
                                                    <button
                                                      key={emoji.id}
                                                      type="button"
                                                      onClick={() => handleSelectEmoji(emoji)}
                                                      onMouseEnter={() => setHoveredEmoji({
                                                        name: emoji.name,
                                                        char: emoji.char,
                                                        isStandard: emoji.isStandard,
                                                        groupName: group.name
                                                      })}
                                                      onMouseLeave={() => setHoveredEmoji(null)}
                                                      className={`aspect-square rounded-lg p-1 transition-all hover:scale-110 flex items-center justify-center relative ${isGroupView ? "hover:bg-[#404249]" : "hover:bg-slate-100"}`}
                                                      title={isStandard ? `:${emoji.name}:` : `:${emoji.name}: (Custom)`}
                                                    >
                                                      {isStandard ? (
                                                        <span className="text-xl select-none">{emoji.char}</span>
                                                      ) : (
                                                        <img src={emoji.assetUrl} alt={emoji.name} className="max-h-full max-w-full object-contain" />
                                                      )}
                                                      {isLocked && (
                                                        <div className="absolute -bottom-0.5 -right-0.5 bg-black/70 text-amber-400 rounded-full p-0.5 border border-[#3F4147]">
                                                          <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24"><path d="M18,8H17V6A5,5 0 0,0 12,1A5,5 0 0,0 7,6V8H6A2,2 0 0,0 4,10V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V10A2,2 0 0,0 18,8M8.9,6C8.9,4.29 10.29,2.9 12,2.9C13.71,2.9 15.1,4.29 15.1,6V8H8.9V6M18,20H6V10H18V20Z"/></svg>
                                                        </div>
                                                      )}
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            ) : (
                                              <div className={`mx-3 p-3 rounded-lg flex flex-col gap-2 items-center justify-center text-center border border-dashed ${isGroupView ? "border-[#3F4147] bg-[#1E1F22]/40" : "border-[#e2e8f0] bg-slate-50"}`}>
                                                <p className={`text-[11px] font-semibold ${isGroupView ? "text-[#949BA4]" : "text-slate-500"}`}>
                                                  Grup ini belum mengupload emoji kustom.
                                                </p>
                                                {!isStandard && group.id === selectedId && selectedConv?.ownerId === me?.id && (
                                                  <Button
                                                    type="button"
                                                    onClick={() => {
                                                      setShowStickerPicker(false);
                                                      setShowEmojiStudio(true);
                                                    }}
                                                    className="h-6 px-3 text-[9px] font-black uppercase tracking-wider bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-md cursor-pointer"
                                                  >
                                                    Upload Emoji
                                                  </Button>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                  {activePickerTab === "stickers" && (
                                    <>
                                      {(stickerLibrary?.stickers?.length ?? 0) === 0 ? (
                                        <div className={`p-8 text-center text-xs font-semibold h-full flex flex-col items-center justify-center gap-2 ${isGroupView ? "text-[#949BA4]" : "text-slate-50"}`}>
                                          <p>Belum ada stiker.</p>
                                          {selectedConv?.ownerId === me?.id && (
                                            <Button
                                              type="button"
                                              onClick={() => {
                                                setShowStickerPicker(false);
                                                setStickerStudioSource("chat");
                                                setShowStickerStudio(true);
                                              }}
                                              className="bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-xs px-4 py-2 mt-2 cursor-pointer"
                                            >
                                              Buat Stiker
                                            </Button>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="space-y-4 py-2">
                                          {/* Recently Used Stickers */}
                                          {recentStickers.length > 0 && !stickerSearch && (
                                            <div id="sticker-group-recent" className={`border-b pb-3 ${isGroupView ? "border-[#3F4147]" : "border-[#e2e8f0]"}`}>
                                              <div className="flex items-center gap-2 px-3 py-1.5 mb-1">
                                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                <span className={`text-[10px] font-black uppercase tracking-wider ${isGroupView ? "text-[#949BA4]" : "text-slate-500"}`}>
                                                  Frequently Used
                                                </span>
                                              </div>
                                              <div className="grid grid-cols-4 gap-2 px-3">
                                                {recentStickers.map((sticker) => (
                                                  <button
                                                    key={`recent-${sticker.id}`}
                                                    type="button"
                                                    onClick={() => handleSendSticker(sticker)}
                                                    onMouseEnter={() => setHoveredSticker({
                                                      name: sticker.name,
                                                      groupName: sticker.conversationName || "Global Stickers"
                                                    })}
                                                    onMouseLeave={() => setHoveredSticker(null)}
                                                    className={`aspect-square rounded-lg p-1.5 transition-all hover:scale-110 flex items-center justify-center ${isGroupView ? "hover:bg-[#404249]" : "hover:bg-slate-100"}`}
                                                    title={sticker.name}
                                                  >
                                                    <img src={sticker.assetUrl} alt={sticker.name} className="max-h-full max-w-full object-contain" />
                                                  </button>
                                                ))}
                                              </div>
                                            </div>
                                          )}

                                          {/* Server Stickers */}
                                          {stickerGroups.length === 0 ? (
                                            <div className={`p-8 text-center text-xs font-semibold ${isGroupView ? "text-[#949BA4]" : "text-slate-500"}`}>
                                              Tidak ada stiker yang cocok.
                                            </div>
                                          ) : (
                                            stickerGroups.map((group) => {
                                              const hasStickers = group.stickers && group.stickers.length > 0;
                                              return (
                                                <div key={group.id || 0} id={`sticker-group-${group.id || 0}`} className={`border-b last:border-b-0 pb-3 ${isGroupView ? "border-[#3F4147]" : "border-[#e2e8f0]"}`}>
                                                  <div className="flex items-center justify-between px-3 py-1.5 mb-1">
                                                    <span className={`text-[10px] font-black uppercase tracking-wider truncate max-w-[200px] ${isGroupView ? "text-[#949BA4]" : "text-slate-500"}`}>
                                                      {group.name}
                                                    </span>
                                                    {group.id === selectedId && selectedConv?.ownerId === me?.id && (
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          setShowStickerPicker(false);
                                                          setShowStickerManager(true);
                                                        }}
                                                        className="text-[9px] font-black uppercase tracking-wider text-[#5865F2] hover:underline"
                                                      >
                                                        Manage Stickers
                                                      </button>
                                                    )}
                                                  </div>

                                                  {hasStickers ? (
                                                    <div className="grid grid-cols-4 gap-2 px-3">
                                                      {group.stickers.map((sticker) => (
                                                        <button
                                                          key={sticker.id}
                                                          type="button"
                                                          onClick={() => handleSendSticker(sticker)}
                                                          onMouseEnter={() => setHoveredSticker({
                                                            name: sticker.name,
                                                            groupName: group.name
                                                          })}
                                                          onMouseLeave={() => setHoveredSticker(null)}
                                                          className={`aspect-square rounded-lg p-1.5 transition-all hover:scale-110 flex items-center justify-center ${isGroupView ? "hover:bg-[#404249]" : "hover:bg-slate-100"}`}
                                                          title={sticker.name}
                                                        >
                                                          <img src={sticker.assetUrl} alt={sticker.name} className="max-h-full max-w-full object-contain" />
                                                        </button>
                                                      ))}
                                                    </div>
                                                  ) : (
                                                    <div className={`mx-3 p-3 rounded-lg flex flex-col gap-2 items-center justify-center text-center border border-dashed ${isGroupView ? "border-[#3F4147] bg-[#1E1F22]/40" : "border-[#e2e8f0] bg-slate-50"}`}>
                                                      <p className={`text-[11px] font-semibold ${isGroupView ? "text-[#949BA4]" : "text-slate-500"}`}>
                                                        Your server is waiting for you to upload some stickers!
                                                      </p>
                                                      {group.id === selectedId && selectedConv?.ownerId === me?.id && (
                                                        <Button
                                                          type="button"
                                                          onClick={() => {
                                                            setShowStickerPicker(false);
                                                            setStickerStudioSource("chat");
                                                            setShowStickerStudio(true);
                                                          }}
                                                          className="h-6 px-3 text-[9px] font-black uppercase tracking-wider bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-md cursor-pointer"
                                                        >
                                                          Upload Sticker
                                                        </Button>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })
                                          )}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>

                                {/* Bottom detail panel */}
                                {activePickerTab === "stickers" && (
                                  <div className={`h-[56px] border-t px-3 flex items-center gap-3 shrink-0 ${isGroupView ? "bg-[#1E1F22] border-[#3F4147] text-white" : "bg-slate-50 border-[#e2e8f0] text-slate-800"}`}>
                                    {hoveredSticker ? (
                                      <>
                                        <div className={`w-8 h-8 rounded flex items-center justify-center font-bold text-lg select-none ${isGroupView ? "bg-[#2B2D31]" : "bg-white shadow-sm"}`}>
                                          🎨
                                        </div>
                                        <div className="min-w-0 flex-1 leading-tight">
                                          <p className="text-xs font-black truncate">{hoveredSticker.name}</p>
                                          <p className={`text-[9px] font-bold uppercase tracking-wider truncate ${isGroupView ? "text-[#949BA4]" : "text-slate-500"}`}>
                                            from {hoveredSticker.groupName}
                                          </p>
                                        </div>
                                      </>
                                    ) : (
                                      <div className="flex items-center gap-2 select-none opacity-50">
                                        <Smile className="w-5 h-5 animate-bounce" />
                                        <span className="text-xs font-bold">Select a sticker to send</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowGiftDialog(true)}
                          className={`hover:bg-opacity-70 transition-all shrink-0 rounded-full h-11 w-11 ${isGroupView ? "text-[#949BA4]" : "text-[#54656f]"}`}
                          title="Gift Premium / Premium+"
                        >
                          <Gift className="h-5 w-5" />
                        </Button>
                        <div className="relative flex-1">
                          {/* Mention Autocomplete Popup */}
                          {showMention && mentionMembers.length > 0 && (
                            <div className={`absolute bottom-full left-0 right-0 mb-2 rounded-xl shadow-xl border overflow-hidden z-50 ${isGroupView ? "bg-[#2B2D31] border-[#3F4147]" : "bg-white border-[#e2e8f0]"}`}>
                              {mentionMembers.map((m, idx) => (
                                <button
                                  key={m.userId || "all"}
                                  type="button"
                                  onClick={() => insertMention(m)}
                                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                    idx === mentionIndex
                                      ? isGroupView ? "bg-[#404249] text-white" : "bg-[#f0f9ff] text-[#0369a1]"
                                      : isGroupView ? "hover:bg-[#35373C] text-[#DCDDDE]" : "hover:bg-slate-50 text-[#18251f]"
                                  }`}
                                >
                                  {m.username === "all" ? (
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center">
                                      <span className="text-[10px] font-black text-white">ALL</span>
                                    </div>
                                  ) : (
                                    <img
                                      src={m.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=64"}
                                      alt={m.username}
                                      className="w-8 h-8 rounded-full object-cover"
                                    />
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-sm font-bold truncate">
                                      {m.username === "all" ? "@all" : (
                                        <>
                                          @{m.username} <span className="text-[11px] font-black text-[#8B5CF6]">{(m as any).mentionTag ?? (m as any).userTag}</span>
                                        </>
                                      )}
                                    </p>
                                    {m.username !== "all" && (m as any).mentionTag && (
                                      <p className="text-[10px] text-slate-500 truncate">Group tag {(m as any).mentionTag}</p>
                                    )}
                                    {m.displayName && m.username !== "all" && (
                                      <p className="text-[11px] text-slate-400 truncate">{m.displayName}</p>
                                    )}
                                  </div>
                                </button>
                              ))}
                              <div className={`px-4 py-1.5 border-t ${isGroupView ? "bg-[#1E1F22] border-[#3F4147]" : "bg-slate-50 border-slate-100"}`}>
                                <p className={`text-[10px] font-medium ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>
                                  ↑↓ navigate • Enter/Tab select • Esc close
                                </p>
                              </div>
                            </div>
                          )}
                          <Textarea
                            ref={textareaRef}
                            rows={1}
                            placeholder="Message"
                            value={messageText}
                            onChange={handleMessageChange}
                            onKeyDown={handleMentionKeyDown}
                            className={`min-h-11 max-h-32 resize-none border-0 focus-visible:ring-1 rounded-3xl px-4 py-3 text-[15px] font-medium shadow-sm ${isGroupView ? "bg-[#383A40] text-[#DCDDDE] placeholder:text-[#949BA4] focus-visible:ring-[#5865F2]" : "bg-white focus-visible:ring-[#25d366] text-[#18251f]"}`}
                          />
                        </div>
                        <Button
                          onClick={handleSend}
                          disabled={(!messageText.trim() && !attachedFile && !attachedImageUrl) || sendMessage.isPending || uploading}
                          className={`${isGroupView ? "bg-[#5865F2] hover:bg-[#4752C4] shadow-indigo-900/20" : "bg-[#00a884] hover:bg-[#008f72] shadow-emerald-900/10"} text-white rounded-full h-11 w-11 p-0 shrink-0 shadow-md`}
                          title="Send"
                        >
                          <SendHorizontal className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </>
        )}
      </div>

          {/* Info Panel - Slide in from right */}
          {showInfoPanel && selectedConv && (() => {
            const bgVid = selectedConv.bgVideoUrl;
            const groupYtId = bgVid ? extractYouTubeId(bgVid) : null;
            const otherYtVid = selectedConv.type === "dm" ? selectedConv.otherUserYoutubeLiveUrl : null;
            const otherYtId = otherYtVid ? extractYouTubeId(otherYtVid) : null;
            const otherBgCss = selectedConv.type === "dm" ? (selectedConv.otherUserEquippedBackground ?? null) : null;
            const avatarBorderCls = selectedConv.otherUserEquippedBorder ?? "border-2 border-white/30";

            return (
            <div className={`fixed inset-0 sm:relative sm:inset-auto z-50 sm:z-auto sm:w-80 sm:border-l flex flex-col overflow-hidden animate-in slide-in-from-right duration-200 ${isGroupView ? "bg-[#1E1F22] sm:border-[#3F4147]" : "bg-white sm:border-[#eae8f5]"}`}>

              {/* ── DM with YouTube Live Banner: animated video covers title + avatar area ── */}
              {selectedConv.type === "dm" && otherYtId ? (
                <div className={`relative w-full shrink-0 overflow-hidden border-b ${isGroupView ? "border-[#3F4147]" : "border-slate-100"}`} style={{ minHeight: 260 }}>
                  {/* Animated YouTube iframe as full background */}
                  <iframe
                    src={`https://www.youtube.com/embed/${otherYtId}?autoplay=1&mute=1&loop=1&playlist=${otherYtId}&controls=0&disablekb=1&fs=0&iv_load_policy=3&modestbranding=1&rel=0`}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ width: "177.78%", height: "177.78%", minWidth: "100%", minHeight: "100%" }}
                    allow="autoplay; encrypted-media"
                    title="user-live-banner"
                  />
                  {/* Gradient overlay — darker at top for title legibility, darker at bottom for avatar */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-black/75 pointer-events-none" />

                  {/* Title bar (Contact Info + close) overlaid on video */}
                  <div className="relative z-10 h-14 sm:h-16 px-3 sm:px-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowInfoPanel(false)}
                        className="sm:hidden text-white/80 hover:text-white transition-colors -ml-1"
                      >
                        <ArrowLeft className="h-5 w-5" />
                      </button>
                      <p className="text-white text-sm font-extrabold drop-shadow">Contact Info</p>
                    </div>
                    <button
                      onClick={() => setShowInfoPanel(false)}
                      className="hidden sm:block text-white/80 hover:text-white transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Live badge */}
                  <div className="absolute top-3 right-12 sm:right-10 flex items-center gap-1 bg-red-600/90 backdrop-blur-sm text-white text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-full z-10 shadow">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    Live
                  </div>

                  {/* User info overlaid on video */}
                  <div className="relative z-10 flex flex-col items-center pb-6 px-4">
                    {/* Avatar */}
                    <div className={`rounded-full overflow-visible w-20 h-20 shrink-0 flex items-center justify-center ${avatarBorderCls} p-1 shadow-2xl ring-2 ring-white/10`}>
                      <img
                        src={selectedConv.otherAvatarUrl ?? "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=128"}
                        alt={selectedName}
                        className="w-full h-full object-cover rounded-full"
                      />
                    </div>

                    {/* Name + badges */}
                    <div className="flex items-center justify-center gap-1.5 mt-3 flex-wrap">
                      <h2 className="text-lg font-extrabold text-center text-white drop-shadow">{selectedName}</h2>
                      {selectedConv.otherUserIsVerified && (
                        <TooltipProvider><Tooltip>
                          <TooltipTrigger asChild><BadgeCheck className="w-5 h-5 text-blue-400 fill-blue-400/20 shrink-0 drop-shadow" /></TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">Akun Terverifikasi</TooltipContent>
                        </Tooltip></TooltipProvider>
                      )}
                      {selectedConv.otherUserIsBusinessVerified && (
                        <TooltipProvider><Tooltip>
                          <TooltipTrigger asChild><BadgeCheck className="w-5 h-5 text-emerald-400 fill-emerald-400/20 shrink-0 drop-shadow" /></TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">Bisnis Terverifikasi</TooltipContent>
                        </Tooltip></TooltipProvider>
                      )}
                    </div>
                    <p className="text-xs font-bold mt-1 text-white/70 drop-shadow">@{selectedConv.otherUsername}</p>
                    {selectedConv.otherUserRole && (
                      <span className={`mt-3 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full backdrop-blur-sm ${
                        selectedConv.otherUserRole === "admin" ? "bg-red-500/30 text-red-200 border border-red-400/40"
                        : selectedConv.otherUserRole === "ai" ? "bg-blue-500/30 text-blue-200 border border-blue-400/40"
                        : "bg-white/10 text-white/60 border border-white/20"
                      }`}>{selectedConv.otherUserRole}</span>
                    )}
                  </div>
                </div>
              ) : (
                /* ── Standard panel header (no YouTube banner) ── */
                <>
                  <div className={`h-14 sm:h-16 px-3 sm:px-4 flex items-center justify-between shrink-0 ${isGroupView ? "bg-[#2B2D31]" : "bg-[#075e54]"}`}>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setShowInfoPanel(false)} className="sm:hidden text-white/80 hover:text-white transition-colors -ml-1">
                        <ArrowLeft className="h-5 w-5" />
                      </button>
                      <p className="text-white text-sm font-extrabold">
                        {selectedConv.type === "group" ? "Group Info" : "Contact Info"}
                      </p>
                    </div>
                    <button onClick={() => setShowInfoPanel(false)} className="hidden sm:block text-white/80 hover:text-white transition-colors">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </>
              )}

              <ScrollArea className="flex-1">
                {/* Banner + Avatar / Icon — only render for non-DM-with-YT cases */}
                {!(selectedConv.type === "dm" && otherYtId) && (() => {
                  const hasBanner = (selectedConv.type === "group" && (selectedConv.bannerUrl || groupYtId)) ||
                                    (selectedConv.type === "dm" && !!otherBgCss);
                  return (
                <div className={`flex flex-col items-center border-b ${isGroupView ? "border-[#3F4147]" : "border-slate-100"} ${hasBanner ? "" : "py-6 px-4"}`}>
                  {selectedConv.type === "group" && groupYtId ? (
                    <div className="w-full h-36 relative overflow-hidden bg-black">
                      <iframe
                        src={`https://www.youtube.com/embed/${groupYtId}?autoplay=1&mute=1&loop=1&playlist=${groupYtId}&controls=0&disablekb=1&fs=0&iv_load_policy=3&modestbranding=1&rel=0`}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                        style={{ width: "177.78%", height: "177.78%", minWidth: "100%", minHeight: "100%" }}
                        allow="autoplay; encrypted-media"
                        title="group-banner-video"
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/50 pointer-events-none" />
                    </div>
                  ) : selectedConv.type === "group" && selectedConv.bannerUrl ? (
                    <div className="w-full h-28 relative overflow-hidden">
                      <img src={selectedConv.bannerUrl} alt="Banner" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40" />
                    </div>
                  ) : selectedConv.type === "dm" && otherBgCss ? (
                    <div className={`w-full h-28 relative overflow-hidden ${otherBgCss}`}>
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40 pointer-events-none" />
                    </div>
                  ) : null}
                  <div className={`rounded-full overflow-hidden w-24 h-24 ${selectedConv.type === "dm" && (selectedConv as any).otherUserEquippedBorder ? (selectedConv as any).otherUserEquippedBorder + " p-1" : isGroupView ? "border-2 border-[#3F4147]" : "border-2 border-slate-100"} ${hasBanner ? "-mt-12 relative z-10 ring-4 ring-[#1E1F22]" : ""}`}>
                    <img
                      src={selectedConv.type === "dm" ? (selectedConv.otherAvatarUrl ?? "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=128") : (selectedConv.iconUrl ?? "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128")}
                      alt={selectedName}
                      className="w-full h-full object-cover rounded-full"
                    />
                  </div>
                  <div className="flex items-center justify-center gap-1.5 mt-3">
                    <h2 className={`text-lg font-extrabold text-center ${isGroupView ? "text-white" : "text-[#110e3d]"}`}>{selectedName}</h2>
                    {selectedConv.type === "dm" && (selectedConv as any).otherUserIsVerified && (
                      <TooltipProvider><Tooltip><TooltipTrigger asChild><BadgeCheck className="w-5 h-5 text-blue-400 fill-blue-400/20 shrink-0" /></TooltipTrigger><TooltipContent side="top" className="text-xs">Akun Terverifikasi</TooltipContent></Tooltip></TooltipProvider>
                    )}
                    {selectedConv.type === "dm" && (selectedConv as any).otherUserIsBusinessVerified && (
                      <TooltipProvider><Tooltip><TooltipTrigger asChild><BadgeCheck className="w-5 h-5 text-emerald-500 fill-emerald-500/20 shrink-0" /></TooltipTrigger><TooltipContent side="top" className="text-xs">Bisnis Terverifikasi</TooltipContent></Tooltip></TooltipProvider>
                    )}
                    {selectedConv.type === "group" && (selectedConv as any).isVerified && (
                      <TooltipProvider><Tooltip><TooltipTrigger asChild><BadgeCheck className="w-5 h-5 text-blue-400 fill-blue-400/20 shrink-0" /></TooltipTrigger><TooltipContent side="top" className="text-xs">Komunitas Terverifikasi</TooltipContent></Tooltip></TooltipProvider>
                    )}
                  </div>
                  <p className={`text-xs font-bold mt-1 mb-4 ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>
                    {selectedConv.type === "dm" ? `@${selectedConv.otherUsername}` : `Group • ${selectedConv.memberCount} members`}
                  </p>
                  {selectedConv.type === "dm" && (selectedConv as any).otherUserRole && (
                    <span className={`mb-4 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                      (selectedConv as any).otherUserRole === "admin"
                        ? "bg-red-50 text-red-500 border border-red-100"
                        : (selectedConv as any).otherUserRole === "ai"
                        ? "bg-blue-50 text-blue-500 border border-blue-100"
                        : "bg-slate-50 text-slate-400 border border-slate-100"
                    }`}>
                      {(selectedConv as any).otherUserRole}
                    </span>
                  )}
                </div>
                  );
                })()}

                {/* Description (Group only) */}
                {selectedConv.type === "group" && (
                  <div className={`px-5 py-4 border-b ${isGroupView ? "border-[#3F4147]" : "border-slate-100"}`}>
                    <p className={`text-[10px] font-black uppercase tracking-wider mb-2 flex items-center gap-1.5 ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>
                      <Info className="h-3 w-3" /> Description
                    </p>
                    <p className={`text-xs font-medium leading-relaxed ${isGroupView ? "text-[#DCDDDE]" : "text-slate-600"}`}>
                      {selectedConv.description || "No description yet."}
                    </p>
                  </div>
                )}

                {/* Boost Status (Group only) */}
                {selectedConv.type === "group" && groupBoosts && (
                  <div className={`px-5 py-4 border-b ${isGroupView ? "border-[#3F4147]" : "border-slate-100"}`}>
                    <p className={`text-[10px] font-black uppercase tracking-wider mb-2.5 flex items-center gap-1.5 ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>
                      <Sparkles className="h-3.5 w-3.5 text-violet-400 fill-violet-400 animate-pulse" /> Group Boost Status
                    </p>
                    <div className="bg-gradient-to-br from-[#1b1238] to-[#0d0721] border border-violet-500/30 rounded-2xl p-4 space-y-3 shadow-inner">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black text-violet-300 uppercase tracking-widest leading-none">LEVEL {groupBoosts.level}</p>
                          <p className="text-lg font-black text-white leading-none mt-1.5">{groupBoosts.activeBoostCount} Boosts</p>
                        </div>
                        <span className="rounded-full bg-violet-600/30 border border-violet-500/50 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 text-violet-300">
                          {groupBoosts.level === 3 ? "MAX" : `Level ${groupBoosts.level}`}
                        </span>
                      </div>

                      {groupBoosts.level < 3 && (() => {
                        const thresholds = [0, 2, 7, 14];
                        const currentLevel = groupBoosts.level;
                        const nextLevel = currentLevel + 1;
                        const minVal = thresholds[currentLevel];
                        const maxVal = thresholds[nextLevel];
                        const val = groupBoosts.activeBoostCount;
                        const progressPercent = Math.min(100, Math.round(((val - minVal) / (maxVal - minVal)) * 100));

                        return (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[9px] font-extrabold text-violet-300">
                              <span>Next Level: Lvl {nextLevel}</span>
                              <span>{val} / {maxVal} boosts</span>
                            </div>
                            <div className="h-1.5 w-full bg-violet-950/70 border border-violet-800/30 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                            </div>
                          </div>
                        );
                      })()}

                      <div className="border-t border-violet-500/10 pt-2.5 space-y-1">
                        <p className="text-[9px] font-black text-violet-400 uppercase tracking-widest">Active Perks</p>
                        <ul className="text-[10px] font-bold text-violet-200/90 space-y-0.5 list-disc list-inside">
                          <li>Max channels: {groupBoosts.maxChannels}</li>
                          <li>Max roles: {groupBoosts.maxRoles}</li>
                        </ul>
                      </div>

                      <div className="border-t border-violet-500/10 pt-2.5 space-y-2">
                        <p className="text-[9px] font-black text-violet-400 uppercase tracking-widest">Active Boosters</p>
                        {(!groupBoosts.assignments || groupBoosts.assignments.length === 0) &&
                         (!groupBoosts.premiumPlusBoosters || groupBoosts.premiumPlusBoosters.length === 0) ? (
                          <p className="text-[10px] font-bold text-violet-300/60 italic">Belum ada booster aktif.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 select-none">
                            {/* Manual slot assignments */}
                            {groupBoosts.assignments?.map((assignment: any) => (
                              <div key={`manual-${assignment.id}`} className="flex items-center gap-1.5 text-[10px] font-extrabold text-violet-200">
                                <span className="text-violet-400 animate-pulse">✨</span>
                                <span className="truncate flex-1" title={assignment.userDisplayName || assignment.userUsername}>
                                  {assignment.userDisplayName || assignment.userUsername || "Mystery Booster"}
                                </span>
                                <span className="text-[9px] font-semibold text-violet-400/80 shrink-0">
                                  {assignment.expiresAt ? format(new Date(assignment.expiresAt), "dd MMM") : "Slot"}
                                </span>
                              </div>
                            ))}
                            {/* Premium+ Auto Boosters */}
                            {groupBoosts.premiumPlusBoosters?.map((booster: any) => (
                              <div key={`auto-${booster.userId}`} className="flex items-center gap-1.5 text-[10px] font-extrabold text-[#ffd700]">
                                <span className="text-amber-400 animate-pulse">💎</span>
                                <span className="truncate flex-1" title={booster.userDisplayName || booster.userUsername}>
                                  {booster.userDisplayName || booster.userUsername}
                                </span>
                                <span className="text-[8px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20 shrink-0">
                                  Auto
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Members (Group only) */}
                {selectedConv.type === "group" && (
                  <div className={`px-5 py-4 border-b ${isGroupView ? "border-[#3F4147]" : "border-slate-100"}`}>
                    <p className={`text-[10px] font-black uppercase tracking-wider mb-3 ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>
                      {selectedConv.memberCount} Members
                    </p>
                    <div className="space-y-2">
                      {members.map((m) => (
                        <div key={m.userId} className={`flex items-center gap-3 px-2 py-1.5 rounded-xl transition-colors ${isGroupView ? "hover:bg-[#35373C]" : "hover:bg-slate-50"}`}>
                          <button type="button" onClick={() => openProfileFromMember(m)} className="shrink-0">
                            <Avatar className={`w-8 h-8 border ${isGroupView ? "border-[#3F4147]" : "border-slate-100"}`}>
                              <AvatarImage src={m.avatarUrl ?? undefined} />
                              <AvatarFallback className={`text-[10px] font-bold ${isGroupView ? "bg-[#2B2D31] text-[#DCDDDE]" : "bg-slate-100 text-[#6366f1]"}`}>
                                {getInitials(m.displayName ?? m.username)}
                              </AvatarFallback>
                            </Avatar>
                          </button>
                          <div className="flex-1 min-w-0">
                            <button
                              type="button"
                              onClick={() => openProfileFromMember(m)}
                              className={`block max-w-full text-xs font-bold truncate text-left hover:underline ${isGroupView ? "text-[#DCDDDE]" : "text-[#110e3d]"}`}
                            >
                              {m.displayName ?? m.username}
                            </button>
                            <p className={`text-[10px] font-medium ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>@{m.username}</p>
                          </div>
                          {selectedConv.ownerId === m.userId && (
                            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${isGroupView ? "text-amber-400 bg-amber-900/30 border border-amber-800/50" : "text-amber-500 bg-amber-50 border border-amber-100"}`}>
                              Owner
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="px-5 py-4 space-y-2">
                  {selectedConv.type === "dm" && selectedConv.otherUserId && (
                    <>
                      <Button asChild className="w-full bg-[#6366f1] text-white hover:bg-violet-700 rounded-xl text-xs font-bold">
                        <Link href={`/profile/${selectedConv.otherUserId}`}>
                          <UserCircle className="h-4 w-4 mr-2" /> View Full Profile
                        </Link>
                      </Button>
                      <Button
                        onClick={async () => {
                          const isBlocked = blockedUsers.some((u: any) => u.userId === selectedConv.otherUserId);
                          if (isBlocked) {
                            await unblockMutation.mutateAsync(selectedConv.otherUserId!);
                          } else {
                            if (confirm(`Apakah Anda yakin ingin memblokir ${selectedName}?`)) {
                              await blockMutation.mutateAsync(selectedConv.otherUserId!);
                            }
                          }
                        }}
                        disabled={blockMutation.isPending || unblockMutation.isPending}
                        className={`w-full rounded-xl text-xs font-bold transition-all ${
                          blockedUsers.some((u: any) => u.userId === selectedConv.otherUserId)
                            ? "bg-green-600 text-white hover:bg-green-750"
                            : "bg-red-600 text-white hover:bg-red-700"
                        }`}
                      >
                        <Ban className="h-4 w-4 mr-2" />
                        {blockedUsers.some((u: any) => u.userId === selectedConv.otherUserId)
                          ? "Buka Blokir User"
                          : "Blokir User"}
                      </Button>

                      {/* Produk Seller — real-time from SellerHub */}
                      {(sellerProductsLoading || sellerCatalogProducts.length > 0) && (
                        <div className={`mt-2 rounded-2xl border overflow-hidden ${
                          isGroupView ? "border-[#3F4147] bg-[#2B2D31]/50" : "border-slate-200 bg-slate-50/60"
                        }`}>
                          <div className={`px-3.5 pt-3 pb-2 flex items-center justify-between`}>
                            <div className="flex items-center gap-1.5">
                              <ShoppingBag className="h-3.5 w-3.5 text-emerald-500" />
                              <p className={`text-[10px] font-black uppercase tracking-wider ${
                                isGroupView ? "text-[#949BA4]" : "text-slate-500"
                              }`}>Produk SellerHub</p>
                            </div>
                            {sellerProductsLoading && (
                              <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                            )}
                          </div>

                          {sellerProductsLoading && sellerCatalogProducts.length === 0 ? (
                            <div className="px-3.5 pb-3 space-y-2">
                              {[1, 2].map(i => (
                                <div key={i} className="flex items-center gap-2.5 animate-pulse">
                                  <div className={`w-10 h-10 rounded-lg shrink-0 ${
                                    isGroupView ? "bg-[#3F4147]" : "bg-slate-200"
                                  }`} />
                                  <div className="flex-1 space-y-1.5">
                                    <div className={`h-2.5 rounded-full w-3/4 ${
                                      isGroupView ? "bg-[#3F4147]" : "bg-slate-200"
                                    }`} />
                                    <div className={`h-2 rounded-full w-1/2 ${
                                      isGroupView ? "bg-[#3F4147]" : "bg-slate-200"
                                    }`} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : sellerCatalogProducts.length === 0 ? (
                            <p className={`px-3.5 pb-3 text-xs font-semibold italic ${
                              isGroupView ? "text-[#949BA4]" : "text-slate-400"
                            }`}>
                              Belum ada produk aktif.
                            </p>
                          ) : (
                            <div className="px-3.5 pb-3 space-y-2 max-h-56 overflow-y-auto">
                              {sellerCatalogProducts.map((product: any) => (
                                <div
                                  key={`inf-${product.id}`}
                                  onClick={() => setSelectedCatalogProduct(product)}
                                  className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all ${
                                    isGroupView
                                      ? "bg-[#2B2D31]/60 border-[#3F4147] hover:bg-[#35373C]"
                                      : "bg-white border-slate-200/80 hover:border-violet-200 hover:bg-violet-50/30"
                                  }`}
                                >
                                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden border ${
                                    isGroupView ? "bg-[#3F4147] border-[#3F4147]" : "bg-slate-50 border-slate-100"
                                  }`}>
                                    {product.imageUrl ? (
                                      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <ShoppingBag className="w-4 h-4 text-slate-300" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1 space-y-0.5">
                                    <h4 className={`text-xs font-black truncate ${
                                      isGroupView ? "text-[#DCDDDE]" : "text-[#110e3d]"
                                    }`}>
                                      {product.name}
                                    </h4>
                                    <p className="text-[11px] font-black text-emerald-500">
                                      {new Intl.NumberFormat("id-ID", {
                                        style: "currency",
                                        currency: "IDR",
                                        maximumFractionDigits: 0
                                      }).format(product.price)}
                                    </p>
                                    {product.stock !== undefined && product.stock !== null && (
                                      <p className={`text-[9px] font-bold ${
                                        product.stock <= 3
                                          ? "text-red-400"
                                          : isGroupView ? "text-[#949BA4]" : "text-slate-400"
                                      }`}>
                                        {product.stock <= 0 ? "Habis" : `Stok: ${product.stock}`}
                                      </p>
                                    )}
                                  </div>
                                  <div className={`shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full border ${
                                    isGroupView
                                      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                      : "text-emerald-600 bg-emerald-50 border-emerald-100"
                                  }`}>
                                    Beli
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  {selectedConv.type === "group" && selectedConv.ownerId === me?.id && (
                    <Button
                      className="w-full bg-[#6366f1] text-white hover:bg-violet-700 rounded-xl text-xs font-bold"
                      onClick={() => { setShowInfoPanel(false); openEditGroup(); }}
                    >
                      <Edit3 className="h-4 w-4 mr-2" /> Edit Group
                    </Button>
                  )}
                  {selectedConv.type === "group" && selectedConv.ownerId !== me?.id && (
                    <Button
                      variant="outline"
                      className="w-full rounded-xl text-xs font-bold text-red-400 border-red-900/50 hover:bg-red-900/30 hover:text-red-300"
                      onClick={() => { setShowInfoPanel(false); setLeaveGroupModalOpen(true); }}
                    >
                      <LogOut className="h-4 w-4 mr-2" /> Keluar dari Grup
                    </Button>
                  )}
                  {selectedConv.type === "group" && (
                    <Button
                      variant="outline"
                      className="w-full rounded-xl text-xs font-bold text-orange-400 border-orange-900/40 hover:bg-orange-900/20 hover:text-orange-300"
                      onClick={() => { setShowInfoPanel(false); setReportGroupModalOpen(true); }}
                    >
                      <ShieldAlert className="h-4 w-4 mr-2" /> Laporkan Grup
                    </Button>
                  )}
                  {selectedConv.type === "group" && selectedConv.ownerId === me?.id && (
                    <Button
                      variant="outline"
                      className="w-full rounded-xl text-xs font-bold text-red-400 border-red-900/50 hover:bg-red-900/30 hover:text-red-300"
                      onClick={() => { setShowInfoPanel(false); handleLeaveOrDelete(); }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Hapus Grup
                    </Button>
                  )}
                </div>


              </ScrollArea>
            </div>
            );
          })()}
        </div>
      </main>

      {/* Gift Membership Modal */}
      <Dialog open={showGiftDialog} onOpenChange={setShowGiftDialog}>
        <DialogContent className={`max-w-md max-h-[85vh] overflow-y-auto p-6 rounded-2xl ${isGroupView ? "bg-[#313338] text-white border-[#3F4147]" : "bg-white border-[#eae8f5]"}`}>
          <DialogHeader className="mb-1">
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Gift className="w-5 h-5 text-purple-500" /> Gift Membership
            </DialogTitle>
            <DialogDescription className={`text-xs ${isGroupView ? "text-[#B5BAC1]" : "text-slate-500"}`}>
              Beli Premium atau Premium+ sebagai hadiah. Setelah pembayaran sukses, kamu akan dapat <span className="font-bold">gift code</span> yang bisa kamu bagikan (lihat di halaman Premium). Pembeli tidak bisa redeem gift-nya sendiri.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            {/* Gift Premium */}
            <div className={`rounded-2xl border p-4 flex flex-col ${isGroupView ? "border-[#3F4147] bg-[#2B2D31]" : "border-[#eae8f5] bg-slate-50"}`}>
              <div className="flex items-center gap-2 mb-1">
                <Crown className="w-4 h-4 text-amber-500" />
                <h4 className="font-extrabold text-sm">Premium</h4>
              </div>
              <p className={`text-[11px] mb-3 ${isGroupView ? "text-[#B5BAC1]" : "text-slate-500"}`}>
                Rp {Number(giftPremiumPrice).toLocaleString("id-ID")}
              </p>
              <Button
                onClick={() => giftMutation.mutate("premium")}
                disabled={giftMutation.isPending}
                className="mt-auto bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs h-9"
              >
                {giftMutation.isPending ? "Mengarahkan..." : "Beli Gift"}
              </Button>
            </div>

            {/* Gift Premium+ */}
            <div className={`rounded-2xl border p-4 flex flex-col ${isGroupView ? "border-[#3F4147] bg-[#2B2D31]" : "border-[#eae8f5] bg-slate-50"}`}>
              <div className="flex items-center gap-2 mb-1">
                <Crown className="w-4 h-4 text-purple-500" />
                <h4 className="font-extrabold text-sm">Premium+</h4>
              </div>
              <p className={`text-[11px] mb-3 ${isGroupView ? "text-[#B5BAC1]" : "text-slate-500"}`}>
                Rp {Number(giftPremiumPlusPrice).toLocaleString("id-ID")}
              </p>
              <Button
                onClick={() => giftMutation.mutate("premium_plus")}
                disabled={giftMutation.isPending}
                className="mt-auto bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs h-9"
              >
                {giftMutation.isPending ? "Mengarahkan..." : "Beli Gift"}
              </Button>
            </div>
          </div>

          {/* Gifts I've paid for and can give away */}
          {(() => {
            const activeGifts = (myGifts || []).filter((g: any) => g.status === "active");
            if (activeGifts.length === 0) return null;
            return (
              <div className={`mt-5 pt-4 border-t ${isGroupView ? "border-[#3F4147]" : "border-[#eae8f5]"}`}>
                <h4 className="text-xs font-black uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-500" /> Hadiah Siap Dibagikan
                </h4>
                <p className={`text-[11px] mb-3 ${isGroupView ? "text-[#B5BAC1]" : "text-slate-500"}`}>
                  Sudah dibayar — kasih ke group atau orang lain. Kamu sendiri tidak bisa pakai gift yang kamu beli.
                </p>
                <div className="space-y-2">
                  {activeGifts.map((g: any) => (
                    <div key={g.id} className={`rounded-xl border p-3 ${isGroupView ? "border-[#3F4147] bg-[#2B2D31]" : "border-[#eae8f5] bg-slate-50"}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Crown className={`w-4 h-4 ${g.tier === "premium_plus" ? "text-purple-500" : "text-amber-500"}`} />
                        <span className="text-xs font-extrabold">{g.tier === "premium_plus" ? "Premium+" : "Premium"}</span>
                        <code className={`ml-auto text-[10px] px-2 py-0.5 rounded ${isGroupView ? "bg-[#1E1F22] text-[#B5BAC1]" : "bg-white text-slate-500"}`}>{g.giftCode}</code>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => shareGiftToCurrentChat(g)}
                          disabled={!selectedId}
                          className="flex-1 bg-[#6366f1] hover:bg-violet-700 text-white font-bold rounded-lg text-[11px] h-8"
                          title={selectedId ? "Kirim ke chat yang sedang dibuka" : "Buka chat dulu"}
                        >
                          <SendHorizontal className="w-3.5 h-3.5 mr-1" /> Kirim ke chat ini
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => { navigator.clipboard.writeText(giftRedeemUrl(g.giftCode)); toast({ title: "Link disalin!", description: "Bagikan link ini ke orang yang mau dikasih hadiah." }); }}
                          className={`rounded-lg text-[11px] h-8 font-bold ${isGroupView ? "border-[#3F4147] text-[#DCDDDE] hover:bg-[#35373C]" : ""}`}
                        >
                          <Copy className="w-3.5 h-3.5 mr-1" /> Salin link
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Video Quest Modal */}
      <Dialog open={showVideoQuestModal} onOpenChange={setShowVideoQuestModal}>
        <DialogContent className={`max-w-xl flex flex-col p-6 rounded-2xl ${isGroupView ? "bg-[#313338] text-white border-[#3F4147]" : "bg-white border-[#eae8f5] text-slate-800"}`}>
          <DialogHeader className="mb-2 shrink-0">
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Tonton Video: {activeVideoQuest?.title}
            </DialogTitle>
            <DialogDescription className={`text-xs ${isGroupView ? "text-[#949BA4]" : "text-slate-500"}`}>
              Selesaikan misi menonton video/stream ini untuk mendapatkan reward Token.
            </DialogDescription>
          </DialogHeader>

          {/* Embedded Player */}
          {activeVideoQuest && (
            <div className="space-y-4">
              <div className="aspect-video bg-[#1e1f22] rounded-xl overflow-hidden border border-[#1f2023]/60 shadow-inner flex items-center justify-center relative">
                {activeVideoQuest.videoUrl ? (
                  <iframe 
                    width="100%" 
                    height="100%" 
                    src={getEmbeddableUrl(activeVideoQuest.videoUrl)} 
                    title="Video Player" 
                    frameBorder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                    allowFullScreen 
                    className="absolute inset-0 w-full h-full"
                  ></iframe>
                ) : (
                  <div className="text-center p-4">
                    <p className="text-xs text-rose-500 font-bold">Error: Video URL tidak valid atau tidak disediakan oleh admin.</p>
                  </div>
                )}
              </div>

              {/* Status & Countdown */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#2b2d31]/40 p-4 rounded-xl border border-[#3f4147]/20 mt-2">
                <div className="flex items-center gap-2">
                  {videoWatchCompleted ? (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">✓</span>
                  ) : (
                    <span className="animate-spin h-4 w-4 border-2 border-yellow-500 border-t-transparent rounded-full" />
                  )}
                  <p className="text-xs font-bold text-[#DCDDDE]">
                    {videoWatchCompleted 
                      ? "Misi Selesai! Kamu sekarang dapat menutup modal ini." 
                      : `Sedang Menonton... Sisa waktu: ${videoWatchTimer} detik`
                    }
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-black text-[#949BA4] uppercase tracking-wider">Hadiah:</span>
                  <span className="text-xs font-black text-white">{activeVideoQuest.reward}</span>
                  <span className="text-xs">🪙</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowVideoQuestModal(false)}
              className="rounded-xl font-bold text-xs h-9"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Starred Messages Modal */}
      <Dialog open={starredOpen} onOpenChange={setStarredOpen}>
        <DialogContent className={`max-w-md max-h-[80vh] flex flex-col p-6 rounded-2xl ${isGroupView ? "bg-[#313338] text-white border-[#3F4147]" : "bg-white border-[#eae8f5]"}`}>
          <DialogHeader className="mb-2 shrink-0">
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400 fill-current" />
              Pesan Berbintang Anda
            </DialogTitle>
            <DialogDescription className={`text-xs ${isGroupView ? "text-[#949BA4]" : "text-slate-500"}`}>
              Daftar semua pesan yang Anda tandai dengan bintang di seluruh percakapan.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-[300px] pr-1">
            {starredLoading ? (
              <div className="flex flex-col gap-3 py-4">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            ) : !starredMessages || starredMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-xs opacity-60">
                <Star className="w-10 h-10 mb-2 stroke-1" />
                Belum ada pesan berbintang.
              </div>
            ) : (
              <div className="flex flex-col gap-3.5 py-2">
                {starredMessages.map((smsg: Message) => (
                  <div key={smsg.id} className={`rounded-xl p-3.5 border transition-all ${
                    isGroupView ? "bg-[#2B2D31]/60 border-[#3F4147] hover:border-slate-500 text-[#DCDDDE]" : "bg-slate-50 border-slate-100 hover:border-slate-300 text-slate-800"
                  }`}>
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <div className="min-w-0">
                        <span className="font-extrabold text-xs block">
                          @{smsg.senderUsername || "someone"}
                        </span>
                        <span className={`text-[10px] opacity-60`}>
                          {format(new Date(smsg.createdAt), "dd MMM yyyy HH:mm")}
                        </span>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {smsg.conversationId === selectedId && (
                          <button
                            onClick={() => {
                              setStarredOpen(false);
                              const el = document.getElementById(`message-${smsg.id}`);
                              if (el) {
                                el.scrollIntoView({ behavior: "smooth", block: "center" });
                                el.classList.add("bg-yellow-500/20", "transition-all", "duration-500");
                                setTimeout(() => el.classList.remove("bg-yellow-500/20"), 2000);
                              }
                            }}
                            className={`text-[10px] font-black uppercase px-2.5 py-1 rounded bg-sky-500 hover:bg-sky-600 text-white transition-colors cursor-pointer`}
                          >
                            Lompat
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleStar(smsg)}
                          className={`text-[10px] font-black uppercase px-2.5 py-1 rounded bg-rose-500 hover:bg-rose-600 text-white transition-colors cursor-pointer`}
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                    <p className="text-xs whitespace-pre-wrap leading-relaxed line-clamp-3 [overflow-wrap:anywhere]">{smsg.content}</p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Pinned Messages Modal */}
      <Dialog open={pinnedModalOpen} onOpenChange={setPinnedModalOpen}>
        <DialogContent className={`max-w-md max-h-[80vh] flex flex-col p-6 rounded-2xl ${isGroupView ? "bg-[#313338] text-white border-[#3F4147]" : "bg-white border-[#eae8f5]"}`}>
          <DialogHeader className="mb-2 shrink-0">
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Pin className="w-5 h-5 text-cyan-400 fill-current" />
              Pesan Tersemat
            </DialogTitle>
            <DialogDescription className={`text-xs ${isGroupView ? "text-[#949BA4]" : "text-slate-500"}`}>
              Pesan penting yang disematkan di percakapan ini.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-[300px] pr-1">
            {pinnedLoading ? (
              <div className="flex flex-col gap-3 py-4">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            ) : !pinnedMessages || pinnedMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-xs opacity-60">
                <Pin className="w-10 h-10 mb-2 stroke-1" />
                Belum ada pesan yang disematkan.
              </div>
            ) : (
              <div className="flex flex-col gap-3.5 py-2">
                {pinnedMessages.map((pmsg: Message) => (
                  <div key={pmsg.id} className={`rounded-xl p-3.5 border transition-all ${
                    isGroupView ? "bg-[#2B2D31]/60 border-[#3F4147] hover:border-slate-500 text-[#DCDDDE]" : "bg-slate-50 border-slate-100 hover:border-slate-300 text-slate-800"
                  }`}>
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <div className="min-w-0">
                        <span className="font-extrabold text-xs block hover:underline cursor-pointer">
                          @{pmsg.senderUsername || "someone"}
                        </span>
                        <span className={`text-[10px] opacity-60`}>
                          {format(new Date(pmsg.createdAt), "dd MMM yyyy HH:mm")}
                        </span>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            setPinnedModalOpen(false);
                            const el = document.getElementById(`message-${pmsg.id}`);
                            if (el) {
                              el.scrollIntoView({ behavior: "smooth", block: "center" });
                              el.classList.add("bg-yellow-500/20", "transition-all", "duration-500");
                              setTimeout(() => el.classList.remove("bg-yellow-500/20"), 2000);
                            }
                          }}
                          className={`text-[10px] font-black uppercase px-2.5 py-1 rounded bg-sky-500 hover:bg-sky-600 text-white transition-colors cursor-pointer`}
                        >
                          Lompat
                        </button>
                        {(pmsg.senderId === me?.id || selectedConv?.ownerId === me?.id || myPerms?.permissions?.manageMessages) && (
                          <button
                            onClick={() => handleTogglePin(pmsg)}
                            className={`text-[10px] font-black uppercase px-2.5 py-1 rounded bg-rose-500 hover:bg-rose-600 text-white transition-colors cursor-pointer`}
                          >
                            Lepas
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs whitespace-pre-wrap leading-relaxed line-clamp-3 [overflow-wrap:anywhere]">{pmsg.content}</p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ── New Forum Post Modal ───────────────────────────────────────── */}
      <Dialog open={showNewPostModal} onOpenChange={(open) => { setShowNewPostModal(open); if (!open) { setNewPostTitle(""); setNewPostContent(""); } }}>
        <DialogContent className="max-w-lg bg-[#1E1F22] border border-[#3F4147] rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#3F4147]/50">
            <DialogTitle className="text-sm font-extrabold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#5865f2]" /> New Post
            </DialogTitle>
            <p className="text-xs text-[#949ba4] font-medium">Create a new discussion thread in <span className="text-[#5865f2] font-bold">#{selectedChannel?.name}</span></p>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-[#b0b3b8] uppercase tracking-wider">Post Title</label>
              <Input
                placeholder="What's this post about?"
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                maxLength={200}
                className="bg-[#2B2D31] border-[#3F4147] text-[#DCDDDE] placeholder:text-[#949BA4] focus-visible:ring-[#5865F2] rounded-xl font-semibold h-11"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-black text-[#b0b3b8] uppercase tracking-wider">Content</label>
              <Textarea
                placeholder="Share your thoughts, questions, or ideas..."
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                rows={5}
                maxLength={4000}
                className="bg-[#2B2D31] border-[#3F4147] text-[#DCDDDE] placeholder:text-[#949BA4] focus-visible:ring-[#5865F2] rounded-xl font-semibold resize-none"
              />
            </div>
          </div>
          <div className="px-6 pb-6 flex gap-3 justify-end">
            <Button
              variant="ghost"
              onClick={() => { setShowNewPostModal(false); setNewPostTitle(""); setNewPostContent(""); }}
              className="text-[#949ba4] hover:text-white hover:bg-[#35373c] rounded-xl font-bold text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreatePost}
              disabled={!newPostTitle.trim() || !newPostContent.trim()}
              className="bg-[#5865f2] hover:bg-[#4752c4] text-white rounded-xl px-5 font-bold text-xs cursor-pointer shadow-md shadow-indigo-900/20"
            >
              Post
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Modals ────────────────────────────────────────────────── */}
      {/* GLOBAL SEARCH MODAL */}
      <Dialog open={showGlobalSearch} onOpenChange={(open) => { setShowGlobalSearch(open); if (!open) { setGlobalSearchQuery(""); } }}>
        <DialogContent className={`max-w-lg rounded-2xl p-5 flex flex-col h-[80vh] max-h-[580px] ${isGroupView ? "bg-[#1E1F22] border border-[#3F4147] text-white animate-in zoom-in-95 duration-200" : "bg-white border border-[#eae8f5] text-slate-900 animate-in zoom-in-95 duration-200"}`}>
          <DialogHeader className="shrink-0">
            <DialogTitle className={`text-sm font-extrabold ${isGroupView ? "text-white" : "text-[#110e3d]"}`}>Cari Pengguna & Pesan</DialogTitle>
          </DialogHeader>

          {/* Search Input */}
          <div className="relative my-2 shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#949ba4]" />
            <Input
              type="text"
              placeholder="Cari username, nama tampilan, atau isi pesan..."
              value={globalSearchQuery}
              onChange={(e) => setGlobalSearchQuery(e.target.value)}
              className={`pl-10 text-xs font-semibold rounded-xl ${
                isGroupView 
                  ? "bg-[#2B2D31] border-[#3F4147] text-white focus-visible:ring-violet-500" 
                  : "bg-slate-50 border-[#eae8f5] text-slate-800 focus-visible:ring-violet-500"
              }`}
            />
            {globalSearchQuery && (
              <button
                onClick={() => setGlobalSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-200 cursor-pointer border-0 bg-transparent"
              >
                Reset
              </button>
            )}
          </div>

          {/* Tabs for Filtering */}
          <div className={`grid grid-cols-3 gap-1 p-1 mb-2 rounded-xl shrink-0 ${isGroupView ? "bg-[#2B2D31]" : "bg-slate-100"}`}>
            {(["all", "users", "messages"] as const).map((type) => {
              const label = type === "all" ? "Semua" : type === "users" ? "Pengguna" : "Pesan";
              const isActive = globalSearchType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setGlobalSearchType(type)}
                  className={`text-xs font-bold rounded-lg py-2 transition-all cursor-pointer border-0 ${
                    isActive 
                      ? isGroupView
                        ? "bg-[#1E1F22] text-white shadow-sm"
                        : "bg-white text-[#6366f1] shadow-sm"
                      : "text-slate-400 hover:text-slate-600 bg-transparent"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Search Results Area */}
          <ScrollArea className="flex-1 pr-1 min-h-0">
            {!debouncedSearchQuery.trim() ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search className={`w-8 h-8 mb-2 ${isGroupView ? "text-slate-600" : "text-slate-300"}`} />
                <p className={`text-xs font-bold ${isGroupView ? "text-slate-400" : "text-slate-400"}`}>
                  Ketik sesuatu untuk mulai mencari...
                </p>
              </div>
            ) : (searchingUsers || searchingMessages) ? (
              <div className="space-y-3 py-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-2">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-2 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (searchedUsers.length === 0 && searchedMessages.length === 0) ? (
              <div className="text-center py-16 text-xs font-semibold text-slate-400">
                Tidak ada hasil ditemukan untuk "{debouncedSearchQuery}"
              </div>
            ) : (
              <div className="space-y-4">
                {/* USERS RESULTS */}
                {(globalSearchType === "all" || globalSearchType === "users") && searchedUsers.length > 0 && (
                  <div className="space-y-1">
                    <p className={`text-[10px] font-black uppercase tracking-wider px-2 mb-1 ${isGroupView ? "text-slate-400" : "text-slate-400"}`}>
                      Pengguna ({searchedUsers.length})
                    </p>
                    {searchedUsers.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => handleStartDm(u.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                          isGroupView ? "hover:bg-[#2B2D31] text-white" : "hover:bg-slate-50 text-slate-800"
                        }`}
                      >
                        <div className={`rounded-full shrink-0 flex items-center justify-center p-0.5 overflow-visible ${u.equippedBorder ? u.equippedBorder : isGroupView ? "border border-[#3F4147]" : "border border-[#eae8f5]"}`}>
                          <Avatar className="w-8 h-8 shrink-0">
                            <AvatarImage src={u.avatarUrl ?? undefined} />
                            <AvatarFallback className={`text-xs font-bold ${isGroupView ? "bg-[#35373c] text-white" : "bg-slate-100 text-[#6366f1]"}`}>
                              {getInitials(u.displayName ?? u.username)}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-extrabold truncate ${isGroupView ? "text-[#DCDDDE]" : "text-[#110e3d]"}`}>{u.displayName ?? u.username}</p>
                          <p className={`text-[10px] font-semibold truncate ${isGroupView ? "text-slate-400" : "text-slate-400"}`}>
                            @{u.username}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${isGroupView ? "bg-[#5865F2]/20 text-[#5865F2] hover:bg-[#5865F2]/30" : "bg-violet-50 text-[#6366f1] hover:bg-violet-100"}`}>
                          Chat
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* MESSAGES RESULTS */}
                {(globalSearchType === "all" || globalSearchType === "messages") && searchedMessages.length > 0 && (
                  <div className="space-y-1">
                    <p className={`text-[10px] font-black uppercase tracking-wider px-2 mb-1 ${isGroupView ? "text-slate-400" : "text-slate-400"}`}>
                      Pesan ({searchedMessages.length})
                    </p>
                    {searchedMessages.map((msg) => {
                      const msgDate = new Date(msg.createdAt);
                      const formattedDate = format(msgDate, "dd MMM yyyy, HH:mm");
                      const convLabel = msg.conversationType === "group" 
                        ? `Grup: ${msg.conversationName}` 
                        : `DM dengan ${msg.senderDisplayName || msg.senderUsername}`;

                      return (
                        <button
                          key={msg.id}
                          onClick={() => {
                            setSelectedId(msg.conversationId);
                            if (msg.conversationType === "group" && msg.channelId) {
                              setSelectedChannelId(msg.channelId);
                            }
                            setShowGlobalSearch(false);
                          }}
                          className={`w-full flex flex-col gap-1.5 p-3 rounded-xl text-left transition-colors cursor-pointer border ${
                            isGroupView 
                              ? "bg-[#2B2D31]/30 border-[#3F4147]/50 hover:bg-[#2B2D31] hover:border-[#3F4147] text-white" 
                              : "bg-slate-50/50 border-slate-100 hover:bg-slate-50 hover:border-slate-200 text-slate-800"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar className="w-5 h-5 shrink-0">
                              <AvatarImage src={msg.senderAvatarUrl ?? undefined} />
                              <AvatarFallback className="text-[9px] font-bold">
                                {getInitials(msg.senderDisplayName ?? msg.senderUsername ?? "?")}
                              </AvatarFallback>
                            </Avatar>
                            <span className={`text-xs font-extrabold truncate ${isGroupView ? "text-[#DCDDDE]" : "text-[#110e3d]"}`}>
                              {msg.senderDisplayName || msg.senderUsername}
                            </span>
                            <span className="text-[9px] text-slate-400 font-semibold ml-auto shrink-0">
                              {formattedDate}
                            </span>
                          </div>
                          <p className={`text-xs font-medium [overflow-wrap:anywhere] line-clamp-2 ${isGroupView ? "text-slate-300" : "text-slate-600"}`}>
                            {msg.content}
                          </p>
                          <div className={`text-[9px] font-bold uppercase tracking-wide mt-1 ${isGroupView ? "text-[#5865F2]" : "text-[#6366f1]"}`}>
                            {convLabel}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewDm} onOpenChange={setShowNewDm}>
        <DialogContent className="max-w-sm bg-white border border-[#eae8f5] rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-sm font-extrabold text-[#110e3d]">New Direct Message</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Search friends…"
            value={dmSearch}
            onChange={(e) => setDmSearch(e.target.value)}
            className="mb-3 bg-white border-[#eae8f5] focus-visible:ring-violet-500 rounded-xl text-slate-700 font-semibold"
          />
          <ScrollArea className="h-64 pr-1">
            {friends.length === 0 ? (
              <p className="text-center text-slate-400 text-xs py-8 font-semibold">
                No mutual friends yet. Follow someone and have them follow you back!
              </p>
            ) : filteredFriends.length === 0 ? (
              <p className="text-center text-slate-400 text-xs py-8 font-semibold">No results</p>
            ) : (
              <div className="space-y-1">
                {filteredFriends.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => handleStartDm(f.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 text-left transition-colors"
                  >
                    <div className={`rounded-full shrink-0 flex items-center justify-center p-0.5 overflow-visible ${(f as any).equippedBorder ? (f as any).equippedBorder : "border border-[#eae8f5]"}`}>
                      <Avatar className="w-8 h-8 shrink-0">
                        <AvatarImage src={f.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-xs font-bold bg-slate-100 text-[#6366f1]">
                          {getInitials(f.displayName ?? f.username)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-extrabold text-[#110e3d] truncate">{f.displayName ?? f.username}</p>
                      <p className="text-[10px] text-slate-400 font-bold truncate">@{f.username} <span className="text-[#6366f1] font-semibold">{f.userTag}</span></p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddFriendDialog} onOpenChange={setShowAddFriendDialog}>
        <DialogContent className="max-w-md bg-white border border-[#eae8f5] rounded-3xl p-6 text-center text-slate-800">
          <DialogHeader className="w-full">
            <DialogTitle className="text-base font-extrabold text-[#110e3d] flex items-center justify-center gap-2">
              <UserPlus className="w-5 h-5 text-[#6366f1]" />
              Tambah Teman Baru
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 font-bold">
              Cari username, scan QR code mereka, atau bagikan QR milikmu!
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* 1. Search Username Box */}
            <div className="space-y-2 text-left">
              <Label className="text-xs font-black text-[#110e3d] uppercase tracking-wider">Cari Berdasarkan Username</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Masukkan username player..."
                  value={searchUsername}
                  onChange={(e) => setSearchUsername(e.target.value)}
                  className="bg-white border-[#eae8f5] focus-visible:ring-violet-500 rounded-xl text-slate-700 font-semibold"
                />
                <Button
                  onClick={handleSearchAndAdd}
                  disabled={searching || !searchUsername.trim()}
                  className="bg-[#6366f1] text-white hover:bg-violet-700 rounded-xl font-bold text-xs shrink-0"
                >
                  {searching ? "Mencari..." : "Cari & Add"}
                </Button>
              </div>
            </div>

            {/* Divider */}
            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-slate-100"></div>
              <span className="flex-shrink mx-4 text-[10px] text-slate-400 font-black uppercase tracking-widest">atau scan</span>
              <div className="flex-grow border-t border-slate-100"></div>
            </div>

            {/* 2. QR Code Display / Live Scanner */}
            {isScanning ? (
              <div className="space-y-3">
                <div className="relative aspect-square w-full max-w-[240px] mx-auto rounded-2xl overflow-hidden border-2 border-[#6366f1] bg-black flex items-center justify-center">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  
                  {/* Scanner overlay square */}
                  <div className="absolute inset-4 border-2 border-dashed border-emerald-400 rounded-xl animate-pulse pointer-events-none" />
                </div>
                {scanError && (
                  <p className="text-[10px] text-red-500 font-bold">{scanError}</p>
                )}
                <Button
                  variant="outline"
                  onClick={() => setIsScanning(false)}
                  className="w-full rounded-xl border-red-100 text-red-500 hover:bg-red-50 text-xs font-bold"
                >
                  Matikan Kamera
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Option A: Open Camera Scanner */}
                  <button
                    onClick={() => {
                      setScanError(null);
                      setIsScanning(true);
                    }}
                    className="p-4 rounded-2xl border border-violet-100 hover:border-[#6366f1] bg-slate-50/50 hover:bg-violet-50/30 transition-all text-center flex flex-col items-center justify-center gap-2 group border-0 cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-[#6366f1] group-hover:scale-110 transition-transform">
                      <Camera className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-black text-[#110e3d] uppercase tracking-wider">Scan QR Orang</span>
                    <span className="text-[10px] text-slate-400 font-bold leading-normal">Buka kamera untuk scan QR barcode player lain</span>
                  </button>

                  {/* Option B: Copy My Link & show QR */}
                  <div className="p-4 rounded-2xl border border-violet-100 bg-slate-50/50 text-center flex flex-col items-center justify-center gap-2">
                    {me && (
                      <div className="p-1.5 bg-white rounded-xl border border-violet-100 shadow-sm">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&color=6366f1&data=${encodeURIComponent(
                            `${window.location.origin}/add-friend/${me.username}`
                          )}`}
                          alt="QR Barcode Saya"
                          className="w-16 h-16"
                        />
                      </div>
                    )}
                    <span className="text-xs font-black text-[#110e3d] uppercase tracking-wider">Barcode Saya</span>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (me) {
                          navigator.clipboard.writeText(`${window.location.origin}/add-friend/${me.username}`);
                          setAddFriendQrCopied(true);
                          toast({ title: "Copied!", description: "Add friend link copied." });
                          setTimeout(() => setAddFriendQrCopied(false), 2000);
                        }
                      }}
                      className="w-full h-7 bg-[#6366f1] text-white hover:bg-violet-700 rounded-lg text-[9px] font-bold uppercase tracking-wider"
                    >
                      {addFriendQrCopied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                      {addFriendQrCopied ? "Copied" : "Copy Link"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => setShowAddFriendDialog(false)}
              className="w-full rounded-xl border-[#eae8f5] text-slate-500 hover:text-slate-700 text-xs font-bold"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewGroup} onOpenChange={(open) => { setShowNewGroup(open); if (!open) { setNewGroupMode("create"); setJoinCodeInput(""); } }}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto bg-white border border-[#eae8f5] rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-sm font-extrabold text-[#110e3d]">{newGroupMode === "join" ? "Join Group" : "New Group Chat"}</DialogTitle>
          </DialogHeader>

          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-1 p-1 mb-4 rounded-xl bg-slate-100">
            <button
              type="button"
              onClick={() => setNewGroupMode("create")}
              className={`text-xs font-bold rounded-lg py-2 transition-all ${newGroupMode === "create" ? "bg-white text-[#6366f1] shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
            >
              Buat Baru
            </button>
            <button
              type="button"
              onClick={() => setNewGroupMode("join")}
              className={`text-xs font-bold rounded-lg py-2 transition-all ${newGroupMode === "join" ? "bg-white text-[#6366f1] shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
            >
              Gabung via Link
            </button>
          </div>

          {newGroupMode === "join" ? (
            <>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Tempel invite link atau kode grup:</p>
              <Input
                placeholder="contoh: https://.../invite/ab12cd34  atau  ab12cd34"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { const c = extractInviteCode(joinCodeInput); if (c) joinGroupMutation.mutate(c); } }}
                className="mb-4 bg-white border-[#eae8f5] focus-visible:ring-violet-500 rounded-xl text-slate-700 font-semibold"
              />
              <Button
                onClick={() => { const c = extractInviteCode(joinCodeInput); if (c) joinGroupMutation.mutate(c); }}
                disabled={!extractInviteCode(joinCodeInput) || joinGroupMutation.isPending}
                className="w-full bg-[#6366f1] text-white hover:bg-violet-700 rounded-xl font-bold shadow-md shadow-violet-500/10"
              >
                {joinGroupMutation.isPending ? "Bergabung..." : "Gabung Grup"}
              </Button>
            </>
          ) : (
          <>
          <Input
            placeholder="Group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="mb-3 bg-white border-[#eae8f5] focus-visible:ring-violet-500 rounded-xl text-slate-700 font-semibold"
          />
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Add members from your friends:</p>
          <ScrollArea className="h-48 mb-4 pr-1">
            <div className="space-y-1">
              {friends.map((f) => {
                const checked = groupMemberIds.includes(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() =>
                      setGroupMemberIds((prev) =>
                        checked ? prev.filter((id) => id !== f.id) : [...prev, f.id],
                      )
                    }
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all ${
                      checked ? "bg-violet-50/70 text-[#6366f1]" : "hover:bg-slate-50 text-slate-600"
                    }`}
                  >
                    <div className={`rounded-full shrink-0 flex items-center justify-center p-0.5 overflow-visible ${(f as any).equippedBorder ? (f as any).equippedBorder : "border border-[#eae8f5]"}`}>
                      <Avatar className="w-8 h-8 shrink-0">
                        <AvatarImage src={f.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-xs font-bold bg-slate-100 text-[#6366f1]">
                          {getInitials(f.displayName ?? f.username)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <span className="text-xs font-bold flex-1 truncate">{f.displayName ?? f.username} <span className="text-[10px] text-[#6366f1] font-semibold">{f.userTag}</span></span>
                    {checked && <span className="ml-auto text-[#6366f1] text-xs font-bold">✓</span>}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
          <Button
            onClick={handleCreateGroup}
            disabled={!groupName.trim() || createGroup.isPending}
            className="w-full bg-[#6366f1] text-white hover:bg-violet-700 rounded-xl font-bold shadow-md shadow-violet-500/10"
          >
            Create Group
          </Button>
          </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Channel Dialog */}
      <Dialog open={showCreateChannel} onOpenChange={setShowCreateChannel}>
        <DialogContent className="max-w-sm bg-[#1E1F22] border border-[#3F4147] rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-sm font-extrabold text-white">Create Channel</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Channel name"
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value)}
            className="mb-3 bg-[#2B2D31] border-[#3F4147] text-[#DCDDDE] placeholder:text-[#949BA4] focus-visible:ring-[#5865F2] rounded-xl font-semibold"
          />
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={() => setNewChannelType("text")}
              className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                newChannelType === "text" ? "bg-[#5865F2] text-white" : "bg-[#2B2D31] text-[#949BA4] hover:bg-[#35373C]"
              }`}
            >
              <Hash className="w-3.5 h-3.5" /> Text
            </button>
            <button
              onClick={() => setNewChannelType("voice")}
              className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                newChannelType === "voice" ? "bg-[#5865F2] text-white" : "bg-[#2B2D31] text-[#949BA4] hover:bg-[#35373C]"
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" /> Voice
            </button>
            <button
              onClick={() => setNewChannelType("announce")}
              className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                newChannelType === "announce" ? "bg-[#5865F2] text-white" : "bg-[#2B2D31] text-[#949BA4] hover:bg-[#35373C]"
              }`}
            >
              <Megaphone className="w-3.5 h-3.5" /> Announce
            </button>
            <button
              onClick={() => setNewChannelType("forum")}
              className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                newChannelType === "forum" ? "bg-[#5865F2] text-white" : "bg-[#2B2D31] text-[#949BA4] hover:bg-[#35373C]"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" /> Forum
            </button>
          </div>
          <Button
            onClick={async () => {
              if (!newChannelName.trim() || !selectedId) return;
              try {
                const res = await fetch(`/api/conversations/${selectedId}/channels`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: newChannelName.trim(),
                    type: newChannelType,
                    categoryId: newChannelCategoryId,
                  }),
                });
                if (!res.ok) throw new Error("Failed");
                await queryClient.invalidateQueries({ queryKey: ["channels", selectedId] });
                setNewChannelName("");
                setNewChannelType("text");
                setNewChannelCategoryId(null);
                setShowCreateChannel(false);
                toast({ title: "Channel created!" });
              } catch {
                toast({ title: "Failed to create channel", variant: "destructive" });
              }
            }}
            disabled={!newChannelName.trim()}
            className="w-full bg-[#5865F2] text-white hover:bg-[#4752C4] rounded-xl font-bold shadow-md"
          >
            Create Channel
          </Button>
        </DialogContent>
      </Dialog>

      {/* Create Category Dialog */}
      <Dialog open={showCreateCategory} onOpenChange={setShowCreateCategory}>
        <DialogContent className="max-w-md bg-[#1E1F22] border border-[#3F4147] rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-sm font-extrabold text-white">Create Category</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Category name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="mb-4 bg-[#2B2D31] border-[#3F4147] text-[#DCDDDE] placeholder:text-[#949BA4] focus-visible:ring-[#5865F2] rounded-xl font-semibold"
          />
          <Button
            onClick={async () => {
              if (!newCategoryName.trim() || !selectedId) return;
              try {
                const res = await fetch(`/api/conversations/${selectedId}/categories`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: newCategoryName.trim() }),
                });
                if (!res.ok) throw new Error("Failed");
                await queryClient.invalidateQueries({ queryKey: ["channel-categories", selectedId] });
                setNewCategoryName("");
                setShowCreateCategory(false);
                toast({ title: "Category created!" });
              } catch {
                toast({ title: "Failed to create category", variant: "destructive" });
              }
            }}
            disabled={!newCategoryName.trim()}
            className="w-full bg-[#5865F2] text-white hover:bg-[#4752C4] rounded-xl font-bold shadow-md"
          >
            Create Category
          </Button>
        </DialogContent>
      </Dialog>

      {/* Roles Management Dialog */}
      <Dialog open={showRoles} onOpenChange={(open) => { setShowRoles(open); if (!open) setEditingRole(null); }}>
        <DialogContent className={`${editingRole ? "max-w-2xl" : "max-w-md"} max-h-[85vh] overflow-y-auto bg-[#1E1F22] border border-[#3F4147] rounded-2xl p-5`}>
          <DialogHeader>
            <DialogTitle className="text-sm font-extrabold text-white flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-[#5865F2]" /> Manage Roles
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-[#949BA4]">Create and manage roles with custom permissions.</DialogDescription>
          </DialogHeader>

          {!editingRole ? (
            <>
              {/* Role list */}
              <ScrollArea className="max-h-48 mb-4 pr-1">
                <div className="space-y-1.5">
                  {roles.length === 0 ? (
                    <p className="text-xs text-[#949BA4] text-center py-4">No roles created yet.</p>
                  ) : (
                    roles.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#2B2D31] border border-[#3F4147]">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                        <span className="text-xs font-bold text-[#DCDDDE] flex-1 truncate">{r.name}</span>
                        <button
                          onClick={() => {
                            setEditingRole(r);
                            setNewRoleName(r.name);
                            setNewRoleColor(r.color);
                            setNewRolePerms({
                              sendMessages: false,
                              manageChannels: false,
                              manageRoles: false,
                              manageMessages: false,
                              kickMembers: false,
                              inviteMembers: false,
                              inviteBot: false,
                              postAnnouncements: false,
                              ...(r.permissions as Record<string, boolean>),
                            });
                          }}
                          className="text-[#949BA4] hover:text-white transition-colors cursor-pointer"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            if (!selectedId || !confirm(`Delete role "${r.name}"?`)) return;
                            try {
                              await fetch(`/api/conversations/${selectedId}/roles/${r.id}`, { method: "DELETE" });
                              await queryClient.invalidateQueries({ queryKey: ["roles", selectedId] });
                              toast({ title: "Role deleted" });
                            } catch { toast({ title: "Failed", variant: "destructive" }); }
                          }}
                          className="text-[#949BA4] hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              {/* Create new role form */}
              <div className="border-t border-[#3F4147] pt-4">
                <p className="text-[10px] font-black text-[#949BA4] uppercase tracking-wider mb-2">Create New Role</p>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="Role name"
                    maxLength={50}
                    className="flex-1 px-3 py-2 text-xs rounded-xl bg-[#2B2D31] border border-[#3F4147] text-[#DCDDDE] placeholder:text-[#949BA4] focus:ring-2 focus:ring-[#5865F2] outline-none"
                  />
                  <input
                    type="color"
                    value={newRoleColor}
                    onChange={(e) => setNewRoleColor(e.target.value)}
                    className="w-10 h-9 rounded-lg border border-[#3F4147] bg-transparent cursor-pointer"
                  />
                </div>
                <Button
                  onClick={async () => {
                    if (!newRoleName.trim() || !selectedId) return;
                    try {
                      const res = await fetch(`/api/conversations/${selectedId}/roles`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name: newRoleName.trim(), color: newRoleColor, permissions: newRolePerms }),
                      });
                      if (!res.ok) throw new Error();
                      await queryClient.invalidateQueries({ queryKey: ["roles", selectedId] });
                      setNewRoleName("");
                      setNewRoleColor("#5865F2");
                      setNewRolePerms({
                        sendMessages: true,
                        manageChannels: false,
                        manageRoles: false,
                        manageMessages: false,
                        kickMembers: false,
                        inviteMembers: false,
                        inviteBot: false,
                        postAnnouncements: false,
                      });
                      toast({ title: "Role created!" });
                    } catch { toast({ title: "Failed to create role", variant: "destructive" }); }
                  }}
                  disabled={!newRoleName.trim()}
                  className="w-full bg-[#5865F2] text-white hover:bg-[#4752C4] rounded-xl text-xs font-bold"
                >
                  Create Role
                </Button>
              </div>
            </>
          ) : (
            /* Edit role form */
            <>
              <button onClick={() => setEditingRole(null)} className="text-xs text-[#949BA4] hover:text-white mb-3 flex items-center gap-1 cursor-pointer">
                <ArrowLeft className="w-3 h-3" /> Back to roles
              </button>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Column: Role Details & Permissions */}
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-black text-[#949BA4] uppercase tracking-wider mb-2">Role Settings</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        placeholder="Role name"
                        maxLength={50}
                        className="flex-1 px-3 py-2 text-xs rounded-xl bg-[#2B2D31] border border-[#3F4147] text-[#DCDDDE] focus:ring-2 focus:ring-[#5865F2] outline-none font-semibold"
                      />
                      <input
                        type="color"
                        value={newRoleColor}
                        onChange={(e) => setNewRoleColor(e.target.value)}
                        className="w-10 h-9 rounded-lg border border-[#3F4147] bg-transparent cursor-pointer"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-black text-[#949BA4] uppercase tracking-wider">Permissions</p>
                    <ScrollArea className="h-44 pr-1">
                      <div className="space-y-1">
                        {ROLE_PERMISSION_OPTIONS.map(({ key, label }) => (
                          <label key={key} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#2B2D31] cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={newRolePerms[key] ?? false}
                              onChange={(e) => setNewRolePerms(p => ({ ...p, [key]: e.target.checked }))}
                              className="accent-[#5865F2]"
                            />
                            <span className="text-xs font-semibold text-[#DCDDDE]">{label}</span>
                          </label>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                  <Button
                    onClick={async () => {
                      if (!selectedId || !editingRole) return;
                      try {
                        await fetch(`/api/conversations/${selectedId}/roles/${editingRole.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ name: newRoleName.trim(), color: newRoleColor, permissions: newRolePerms }),
                        });
                        await queryClient.invalidateQueries({ queryKey: ["roles", selectedId] });
                        setEditingRole(null);
                        toast({ title: "Role updated!" });
                      } catch { toast({ title: "Failed to update role", variant: "destructive" }); }
                    }}
                    disabled={!newRoleName.trim()}
                    className="w-full bg-[#5865F2] text-white hover:bg-[#4752C4] rounded-xl text-xs font-bold py-2 shadow-md"
                  >
                    Save Role
                  </Button>
                </div>
                {/* Right Column: Members checklist */}
                <div className="border-t md:border-t-0 md:border-l border-[#3F4147] pt-4 md:pt-0 md:pl-4 flex flex-col min-h-0">
                  <p className="text-[10px] font-black text-[#949BA4] uppercase tracking-wider mb-2">Members in Role</p>
                  <ScrollArea className="h-64 pr-1 flex-1">
                    <div className="space-y-2">
                      {members.map((m) => {
                        const hasRole = m.roles?.some((gr) => gr.id === editingRole.id) ?? false;
                        return (
                          <div key={m.userId} className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-xl bg-[#2B2D31] border border-[#3F4147] hover:border-[#5865F2]/40 transition-colors">
                            <div className="flex items-center gap-2 min-w-0">
                              <Avatar className="w-6 h-6 border border-[#3F4147]">
                                <AvatarImage src={m.avatarUrl ?? undefined} />
                                <AvatarFallback className="text-[9px] font-bold bg-[#35373C] text-[#DCDDDE]">
                                  {getInitials(m.displayName ?? m.username)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs font-bold text-[#DCDDDE] truncate">{m.displayName ?? m.username}</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={hasRole}
                              onChange={async (e) => {
                                if (!selectedId || !m.id) return;
                                const isChecking = e.target.checked;
                                try {
                                  if (isChecking) {
                                    // Assign role
                                    const res = await fetch(`/api/conversations/${selectedId}/members/${m.id}/roles`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ roleId: editingRole.id }),
                                    });
                                    if (!res.ok) throw new Error();
                                  } else {
                                    // Remove role
                                    const res = await fetch(`/api/conversations/${selectedId}/members/${m.id}/roles/${editingRole.id}`, {
                                      method: "DELETE",
                                    });
                                    if (!res.ok) throw new Error();
                                  }
                                  // Invalidate members query to update checkbox state instantly
                                  await queryClient.invalidateQueries({
                                    queryKey: [`/api/conversations/${selectedId}/members`],
                                  });
                                  toast({ title: isChecking ? "Role assigned" : "Role removed" });
                                } catch {
                                  toast({ title: "Failed to update member role", variant: "destructive" });
                                }
                              }}
                              className="accent-[#5865F2] cursor-pointer"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showMembers} onOpenChange={setShowMembers}>
        <DialogContent className={`max-w-sm rounded-2xl p-5 ${isGroupView ? "bg-[#1E1F22] border border-[#3F4147]" : "bg-white border border-[#eae8f5]"}`}>
          <DialogHeader>
            <DialogTitle className={`text-sm font-extrabold ${isGroupView ? "text-white" : "text-[#110e3d]"}`}>Group Members</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-48 mb-4 pr-1">
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.userId} className={`flex items-center gap-3 px-2 py-1.5 rounded-xl ${isGroupView ? "bg-[#2B2D31] border border-[#3F4147]" : "bg-slate-50/50 border border-slate-100"}`}>
                  <button type="button" onClick={() => openProfileFromMember(m)} className="shrink-0">
                    <Avatar className={`w-7 h-7 border ${isGroupView ? "border-[#3F4147]" : "border-[#eae8f5]"}`}>
                      <AvatarImage src={m.avatarUrl ?? undefined} />
                      <AvatarFallback className={`text-[10px] font-bold ${isGroupView ? "bg-[#35373C] text-[#DCDDDE]" : "bg-slate-100 text-[#6366f1]"}`}>
                        {getInitials(m.displayName ?? m.username)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                      <button
                        type="button"
                        onClick={() => openProfileFromMember(m)}
                        className={`text-xs font-bold truncate hover:underline cursor-pointer ${isGroupView ? "text-[#DCDDDE]" : "text-[#110e3d]"}`}
                      >
                        {m.displayName ?? m.username}
                      </button>
                      {m.role && m.role !== "member" && (
                        <Badge className={`text-[8px] px-1 py-0 h-3 leading-none shrink-0 font-medium rounded ${ROLE_BADGE_CLASSES[m.role] ?? ""}`}>
                          {ROLE_LABELS[m.role] ?? m.role}
                        </Badge>
                      )}
                      {selectedConv?.ownerId === m.userId && (
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest shrink-0">Owner</p>
                      )}
                    </div>
                    <p className={`text-[10px] font-semibold truncate ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>
                      @{m.username}<span className={isGroupView ? "text-[#5865F2]" : "text-[#6366f1]"}>{(m as any).mentionTag ?? (m as any).userTag}</span>
                    </p>
                    {m.roles && m.roles.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {m.roles.map((gr) => (
                          <Badge
                            key={gr.id}
                            className="text-[8px] px-1 py-0 h-4 font-bold rounded flex items-center gap-0.5 shrink-0"
                            style={{
                              backgroundColor: `${gr.color}20`,
                              color: gr.color,
                              border: `1px solid ${gr.color}40`,
                            }}
                          >
                            <span>{gr.name}</span>
                            {(selectedConv?.ownerId === me?.id || myPerms?.permissions?.manageRoles) && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!selectedId || !m.id) return;
                                  try {
                                    const res = await fetch(`/api/conversations/${selectedId}/members/${m.id}/roles/${gr.id}`, {
                                      method: "DELETE",
                                    });
                                    if (!res.ok) throw new Error();
                                    await queryClient.invalidateQueries({
                                      queryKey: [`/api/conversations/${selectedId}/members`],
                                    });
                                    toast({ title: "Role removed" });
                                  } catch {
                                    toast({ title: "Failed to remove role", variant: "destructive" });
                                  }
                                }}
                                className="hover:bg-black/10 rounded-full p-0.5 transition-colors cursor-pointer ml-0.5"
                              >
                                <X className="w-1.5 h-1.5" />
                              </button>
                            )}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {(selectedConv?.ownerId === me?.id || myPerms?.permissions?.manageRoles) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-[#35373C] shrink-0"
                          title="Assign Role"
                        >
                          <Plus className={`w-3.5 h-3.5 ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className={isGroupView ? "bg-[#1E1F22] border-[#3F4147] text-white" : "bg-white border-[#eae8f5] text-slate-800"}>
                        <DropdownMenuLabel className="text-[10px] font-bold text-slate-400">Add Group Role</DropdownMenuLabel>
                        <DropdownMenuSeparator className={isGroupView ? "bg-[#3F4147]" : "bg-slate-100"} />
                        {roles.filter(r => !(m.roles || []).some(gr => gr.id === r.id)).length === 0 ? (
                          <div className="px-2 py-1.5 text-[10px] text-slate-400 italic">No roles available</div>
                        ) : (
                          roles.filter(r => !(m.roles || []).some(gr => gr.id === r.id)).map((role) => (
                            <DropdownMenuItem
                              key={role.id}
                              onClick={async () => {
                                if (!selectedId || !m.id) return;
                                try {
                                  const res = await fetch(`/api/conversations/${selectedId}/members/${m.id}/roles`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ roleId: role.id }),
                                  });
                                  if (!res.ok) throw new Error();
                                  await queryClient.invalidateQueries({
                                    queryKey: [`/api/conversations/${selectedId}/members`],
                                  });
                                  toast({ title: "Role assigned" });
                                } catch {
                                  toast({ title: "Failed to assign role", variant: "destructive" });
                                }
                              }}
                              className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-[#2B2D31] px-2 py-1"
                            >
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: role.color }}
                              />
                              <span className="font-semibold">{role.name}</span>
                            </DropdownMenuItem>
                          ))
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {m.userId !== selectedConv?.ownerId && m.userId !== me?.id && (selectedConv?.ownerId === me?.id || myPerms?.permissions?.kickMembers) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[10px] text-slate-400 hover:text-[#ef4444] hover:bg-red-50 rounded-lg font-bold shrink-0"
                      onClick={async () => {
                        if (!selectedId) return;
                        await removeMember.mutateAsync({ id: selectedId, userId: m.userId });
                        await queryClient.invalidateQueries({
                          queryKey: [`/api/conversations/${selectedId}/members`],
                        });
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
          {(selectedConv?.ownerId === me?.id || myPerms?.permissions?.inviteBot) && (
            <div className="mb-4">
              <Button
                variant="outline"
                size="sm"
                className={`w-full text-xs font-bold rounded-xl py-2 px-3 flex items-center justify-center gap-2 border ${
                  isGroupView
                    ? "border-[#3F4147] text-[#DCDDDE] hover:bg-[#35373C]"
                    : "border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
                onClick={() => { setShowMembers(false); setShowInviteBotModal(true); }}
              >
                🤖 Invite Bot to Group
              </Button>
            </div>
          )}
          {(selectedConv?.ownerId === me?.id || myPerms?.permissions?.inviteMembers) && (
            <>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Add friends:</p>
              <Input
                placeholder="Search friends…"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="mb-2 bg-white border-[#eae8f5] focus-visible:ring-violet-500 rounded-xl text-slate-700 font-semibold"
              />
              <ScrollArea className="h-36 pr-1">
                <div className="space-y-1">
                  {filteredMembersSearch.map((f) => (
                    <button
                      key={f.id}
                      onClick={async () => {
                        if (!selectedId) return;
                        await addMember.mutateAsync({ id: selectedId, data: { userId: f.id } });
                        await queryClient.invalidateQueries({
                          queryKey: [`/api/conversations/${selectedId}/members`],
                        });
                      }}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-50 text-left transition-colors"
                    >
                      <Avatar className="w-7 h-7 border border-[#eae8f5]">
                        <AvatarImage src={f.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-[10px] bg-slate-100 font-bold text-[#6366f1]">
                          {getInitials(f.displayName ?? f.username)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-bold flex-1 truncate">{f.displayName ?? f.username} <span className="text-[10px] text-[#6366f1] font-semibold">{f.userTag}</span></span>
                      <span className="ml-auto text-[10px] font-extrabold text-[#6366f1]">+ Add</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog open={showEditGroup} onOpenChange={setShowEditGroup}>
        <DialogContent className={`max-w-sm max-h-[85vh] overflow-y-auto rounded-2xl p-5 ${isGroupView ? "bg-[#1E1F22] border border-[#3F4147]" : "bg-white border border-[#eae8f5]"}`}>
          <DialogHeader>
            <DialogTitle className={`text-sm font-extrabold flex items-center gap-2 ${isGroupView ? "text-white" : "text-[#110e3d]"}`}>
              <Edit3 className={`h-4 w-4 ${isGroupView ? "text-[#5865F2]" : "text-[#6366f1]"}`} /> Edit Group
            </DialogTitle>
            <DialogDescription className={`text-xs font-bold ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>Update your group name, photo, and description.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Group Icon Preview & Upload */}
            <div className="flex items-center gap-4">
              <div
                className={`w-16 h-16 rounded-2xl overflow-hidden border-2 flex items-center justify-center shrink-0 cursor-pointer relative group/icon ${isGroupView ? "border-[#3F4147] bg-[#2B2D31]" : "border-[#eae8f5] bg-slate-50"}`}
                onClick={() => {
                  if (selectedConv?.ownerId === me?.id || myPerms?.permissions?.manageChannels) {
                    const inp = document.getElementById("group-icon-file-input") as HTMLInputElement;
                    inp?.click();
                  }
                }}
                title="Klik untuk upload foto dari komputer"
              >
                {editGroupIcon ? (
                  <img src={editGroupIcon} alt="Group" className="w-full h-full object-cover" />
                ) : (
                  <span className={`text-2xl font-black ${isGroupView ? "text-[#949BA4]" : "text-slate-300"}`}>{getInitials(editGroupName || "G")}</span>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/icon:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                  <Upload className="w-5 h-5 text-white" />
                </div>
              </div>
              <input
                id="group-icon-file-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadGroupFile(file, setEditGroupIcon);
                  e.target.value = "";
                }}
              />
              <div className="flex-1">
                <label className={`text-[10px] font-black uppercase tracking-wider ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>Group Photo</label>
                <p className={`text-[10px] mt-0.5 ${isGroupView ? "text-[#5865F2]" : "text-slate-400"}`}>Klik foto untuk upload dari komputer</p>
              </div>
              {(selectedConv?.ownerId === me?.id || myPerms?.permissions?.manageChannels) && (
                <button
                  type="button"
                  onClick={() => (document.getElementById("group-icon-file-input") as HTMLInputElement)?.click()}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${isGroupView ? "border-[#3F4147] text-[#DCDDDE] hover:bg-[#35373C]" : "border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                  title="Upload dari komputer"
                >
                  <Upload className="w-3.5 h-3.5 inline mr-1" />
                  Upload
                </button>
              )}
            </div>

            {/* Group Name */}
            <div>
              <label className={`text-[10px] font-black uppercase tracking-wider ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>Group Name</label>
              <input
                type="text"
                value={editGroupName}
                onChange={(e) => setEditGroupName(e.target.value)}
                placeholder="Enter group name"
                maxLength={100}
                disabled={selectedConv?.ownerId !== me?.id && !myPerms?.permissions?.manageChannels}
                className={`w-full mt-1 px-3 py-2 text-xs rounded-xl focus:ring-2 focus:ring-[#6366f1] focus:border-transparent outline-none border ${isGroupView ? "bg-[#2B2D31] border-[#3F4147] text-[#DCDDDE] placeholder:text-[#949BA4]" : "bg-slate-50 border-slate-200"} ${selectedConv?.ownerId !== me?.id && !myPerms?.permissions?.manageChannels ? "opacity-60 cursor-not-allowed" : ""}`}
              />
            </div>

            {/* Group Description */}
            <div>
              <label className={`text-[10px] font-black uppercase tracking-wider ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>Description</label>
              <textarea
                value={editGroupDesc}
                onChange={(e) => setEditGroupDesc(e.target.value)}
                placeholder="What's this group about?"
                maxLength={500}
                rows={3}
                disabled={selectedConv?.ownerId !== me?.id && !myPerms?.permissions?.manageChannels}
                className={`w-full mt-1 px-3 py-2 text-xs rounded-xl focus:ring-2 focus:ring-[#6366f1] focus:border-transparent outline-none resize-none border ${isGroupView ? "bg-[#2B2D31] border-[#3F4147] text-[#DCDDDE] placeholder:text-[#949BA4]" : "bg-slate-50 border-slate-200"} ${selectedConv?.ownerId !== me?.id && !myPerms?.permissions?.manageChannels ? "opacity-60 cursor-not-allowed" : ""}`}
              />
              <p className="text-[10px] text-slate-300 mt-1 text-right">{editGroupDesc.length}/500</p>
            </div>

            {/* Group Banner Upload */}
            <div>
              <label className={`text-[10px] font-black uppercase tracking-wider ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>Background / Banner</label>
              {editGroupBanner && (
                <div className="mt-1 mb-2 h-20 rounded-xl overflow-hidden border border-[#3F4147] relative group/banner cursor-pointer" onClick={() => selectedConv?.ownerId === me?.id && (document.getElementById("group-banner-file-input") as HTMLInputElement)?.click()}>
                  <img src={editGroupBanner} alt="Banner Preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  {selectedConv?.ownerId === me?.id && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/banner:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                      <Upload className="w-4 h-4 text-white" />
                      <span className="text-white text-[10px] font-bold">Ganti</span>
                    </div>
                  )}
                </div>
              )}
              <input
                id="group-banner-file-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadGroupFile(file, setEditGroupBanner);
                  e.target.value = "";
                }}
              />
              {selectedConv?.ownerId === me?.id && (
                <button
                  type="button"
                  onClick={() => (document.getElementById("group-banner-file-input") as HTMLInputElement)?.click()}
                  className={`w-full mt-1 px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${isGroupView ? "border-[#3F4147] text-[#DCDDDE] hover:bg-[#35373C]" : "border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                  title="Upload dari komputer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {editGroupBanner ? "Ganti Background" : "Upload Background"}
                </button>
              )}
              <p className={`text-[10px] mt-1 ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>Hanya pemilik grup yang dapat mengubah background.</p>
            </div>

            {/* YouTube Video Background — Level 2+ only */}
            <div>
              <label className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>
                <Play className="w-3 h-3" />
                Video Background YouTube
                <span className={`ml-auto px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wide ${groupBoosts && groupBoosts.level >= 2 ? "bg-violet-600/30 border border-violet-500/50 text-violet-300" : "bg-slate-700/50 border border-slate-600/50 text-slate-400"}`}>
                  Lvl 2 Boost
                </span>
              </label>
              {groupBoosts && groupBoosts.level >= 2 ? (
                <>
                  <input
                    type="url"
                    value={editGroupBgVideo}
                    onChange={(e) => setEditGroupBgVideo(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    disabled={selectedConv?.ownerId !== me?.id}
                    className={`w-full mt-1 px-3 py-2 text-xs rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none border ${isGroupView ? "bg-[#2B2D31] border-[#3F4147] text-[#DCDDDE] placeholder:text-[#949BA4]" : "bg-slate-50 border-slate-200"} ${selectedConv?.ownerId !== me?.id ? "opacity-60 cursor-not-allowed" : ""}`}
                  />
                  {editGroupBgVideo.trim() && (
                    <button
                      type="button"
                      onClick={() => setEditGroupBgVideo("")}
                      className="mt-1 text-[10px] text-rose-400 hover:text-rose-300 font-bold"
                    >
                      Hapus video background
                    </button>
                  )}
                  <p className={`text-[10px] mt-1 ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>
                    Video akan autoplay muted di background chat. Hanya pemilik yang dapat mengubah.
                  </p>
                </>
              ) : (
                <div className={`mt-1.5 rounded-xl border px-3 py-2.5 text-[11px] font-semibold ${isGroupView ? "border-[#3F4147] bg-[#2B2D31] text-[#949BA4]" : "border-slate-200 bg-slate-50 text-slate-400"}`}>
                  🔒 Group ini belum mencapai Level 2 Boost ({groupBoosts?.activeBoostCount ?? 0}/7 boosts). Boost lebih banyak untuk membuka fitur ini.
                </div>
              )}
            </div>
          </div>

          {/* Custom Invite Link — verified group owner only */}
          {selectedConv?.ownerId === me?.id && !!(selectedConv as any)?.isVerified && (
            <div className="mt-4">
              <label className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${isGroupView ? "text-blue-400" : "text-blue-600"}`}>
                <BadgeCheck className="w-3 h-3" />
                Custom Invite Link
              </label>
              <div className={`flex items-center mt-1 rounded-xl border overflow-hidden ${isGroupView ? "bg-[#2B2D31] border-blue-500/40" : "bg-blue-50 border-blue-200"}`}>
                <span className={`px-2 text-[10px] font-bold shrink-0 select-none ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>/join/</span>
                <input
                  type="text"
                  value={editGroupInviteCode}
                  onChange={(e) => setEditGroupInviteCode(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""))}
                  placeholder={(selectedConv as any)?.inviteCode || "nama-group-kamu"}
                  maxLength={50}
                  className={`flex-1 py-2 pr-3 text-xs bg-transparent focus:outline-none ${isGroupView ? "text-[#DCDDDE] placeholder:text-[#949BA4]" : "text-slate-700 placeholder:text-slate-300"}`}
                />
              </div>
              {(() => {
                const code = (editGroupInviteCode || (selectedConv as any)?.inviteCode || "").trim();
                if (!code) return null;
                const fullLink = `${window.location.origin}/join/${code}`;
                const isSaved = code === ((selectedConv as any)?.inviteCode || "");
                return (
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(fullLink); toast({ title: "Invite link disalin!", description: isSaved ? fullLink : "Ingat Save dulu biar link-nya aktif ya." }); }}
                    className={`mt-1.5 w-full flex items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-bold transition-colors ${isGroupView ? "bg-[#5865F2] hover:bg-[#4752C4] text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
                  >
                    <Copy className="w-3.5 h-3.5" /> Salin Invite Link
                  </button>
                );
              })()}
              <p className={`text-[10px] mt-1 ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>
                Huruf kecil, angka, <span className="font-mono">-</span>, dan <span className="font-mono">_</span> saja. Kosongkan untuk kode random.
              </p>
            </div>
          )}

          {/* Invite Link (non-verified groups) — generate a random code only */}
          {(selectedConv?.ownerId === me?.id || myPerms?.permissions?.inviteMembers) && !((selectedConv as any)?.isVerified) && (
            <div className="mt-4">
              <label className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${isGroupView ? "text-[#949BA4]" : "text-slate-500"}`}>
                <Forward className="w-3 h-3" /> Invite Link
              </label>
              {(selectedConv as any)?.inviteCode ? (
                <>
                  <div className={`flex items-center mt-1 rounded-xl border overflow-hidden ${isGroupView ? "bg-[#2B2D31] border-[#3F4147]" : "bg-slate-50 border-slate-200"}`}>
                    <code className={`flex-1 px-3 py-2 text-[11px] truncate ${isGroupView ? "text-[#DCDDDE]" : "text-slate-700"}`}>
                      {`${window.location.origin}/join/${(selectedConv as any).inviteCode}`}
                    </code>
                  </div>
                  <div className="flex gap-2 mt-1.5">
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/join/${(selectedConv as any).inviteCode}`); toast({ title: "Invite link disalin!" }); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-bold transition-colors ${isGroupView ? "bg-[#5865F2] hover:bg-[#4752C4] text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
                    >
                      <Copy className="w-3.5 h-3.5" /> Salin Link
                    </button>
                    <button
                      type="button"
                      onClick={() => generateInviteMutation.mutate(true)}
                      disabled={generateInviteMutation.isPending}
                      className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold transition-colors ${isGroupView ? "border border-[#3F4147] text-[#DCDDDE] hover:bg-[#35373C]" : "border border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                      title="Buat kode baru (link lama tidak berlaku)"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Buat Ulang
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => generateInviteMutation.mutate(false)}
                  disabled={generateInviteMutation.isPending}
                  className={`mt-1 w-full flex items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-bold transition-colors ${isGroupView ? "bg-[#5865F2] hover:bg-[#4752C4] text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
                >
                  <Plus className="w-3.5 h-3.5" /> {generateInviteMutation.isPending ? "Membuat..." : "Buat Kode Invite"}
                </button>
              )}
              <p className={`text-[10px] mt-1 ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>
                Kode random otomatis. Custom invite link hanya untuk grup terverifikasi.
              </p>
            </div>
          )}

          {/* Admin-only: Verified Community Toggle */}
          {(me?.role === "admin" || me?.role === "dev_website") && selectedConv && (
            <div className={`mt-4 flex items-center justify-between rounded-xl px-3 py-2.5 border ${isGroupView ? "bg-blue-950/40 border-blue-500/30" : "bg-blue-50 border-blue-100"}`}>
              <div className="flex items-center gap-2">
                <BadgeCheck className="w-4 h-4 text-blue-400 shrink-0" />
                <div>
                  <p className={`text-xs font-bold ${isGroupView ? "text-blue-300" : "text-blue-800"}`}>Komunitas Terverifikasi</p>
                  <p className={`text-[10px] ${isGroupView ? "text-blue-400" : "text-blue-500"}`}>Admin only • Tampilkan centang biru</p>
                </div>
              </div>
              <Switch
                checked={(selectedConv as any).isVerified ?? false}
                onCheckedChange={async (v) => {
                  try {
                    await useAdminUpdateConversationMutation.mutateAsync({ id: selectedConv.id, data: { isVerified: v } });
                    queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
                    toast({ title: v ? "Group terverifikasi ✓" : "Verifikasi dicabut" });
                  } catch {
                    toast({ title: "Gagal", variant: "destructive" });
                  }
                }}
                className="data-[state=checked]:bg-blue-500"
              />
            </div>
          )}

          {/* Manage Roles Button */}
          {(selectedConv?.ownerId === me?.id || myPerms?.permissions?.manageChannels) && (
            <button
              onClick={() => { setShowEditGroup(false); setShowChannelEditor(true); }}
              className={`w-full mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${isGroupView ? "bg-[#2B2D31] border border-[#3F4147] text-[#DCDDDE] hover:bg-[#35373C]" : "bg-violet-50 border border-violet-100 text-[#6366f1] hover:bg-violet-100"}`}
            >
              <ListOrdered className={`w-4 h-4 ${isGroupView ? "text-[#5865F2]" : "text-[#6366f1]"}`} />
              Channel Editor
              <span className={`ml-auto text-[10px] ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>{channels.length} channels</span>
            </button>
          )}

          {(selectedConv?.ownerId === me?.id || myPerms?.permissions?.manageRoles) && (
            <button
              onClick={() => { setShowEditGroup(false); setShowRoles(true); }}
              className={`w-full mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${isGroupView ? "bg-[#2B2D31] border border-[#3F4147] text-[#DCDDDE] hover:bg-[#35373C]" : "bg-violet-50 border border-violet-100 text-[#6366f1] hover:bg-violet-100"}`}
            >
              <ShieldAlert className={`w-4 h-4 ${isGroupView ? "text-[#5865F2]" : "text-[#6366f1]"}`} />
              Manage Roles
              <span className={`ml-auto text-[10px] ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>{roles.length} roles</span>
            </button>
          )}

          {selectedConv?.ownerId === me?.id && (
            <button
              onClick={() => { setShowEditGroup(false); setShowStickerManager(true); }}
              className={`w-full mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${isGroupView ? "bg-[#2B2D31] border border-[#3F4147] text-[#DCDDDE] hover:bg-[#35373C]" : "bg-violet-50 border border-violet-100 text-[#6366f1] hover:bg-violet-100"}`}
            >
              <Sparkles className={`w-4 h-4 ${isGroupView ? "text-[#5865F2]" : "text-[#6366f1]"}`} />
              Manage Stickers
              <span className={`ml-auto text-[10px] ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>
                {(stickerLibrary?.stickers?.filter((s: any) => s.conversationId === selectedId)?.length ?? 0)} stickers
              </span>
            </button>
          )}

          {selectedConv?.ownerId === me?.id && (
            <button
              onClick={() => { setShowEditGroup(false); setShowEmojiManager(true); }}
              className={`w-full mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${isGroupView ? "bg-[#2B2D31] border border-[#3F4147] text-[#DCDDDE] hover:bg-[#35373C]" : "bg-violet-50 border border-violet-100 text-[#6366f1] hover:bg-violet-100"}`}
            >
              <Smile className={`w-4 h-4 ${isGroupView ? "text-[#5865F2]" : "text-[#6366f1]"}`} />
              Manage Emojis
              <span className={`ml-auto text-[10px] ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>
                {(emojiLibrary?.emojis?.filter((e: any) => e.conversationId === selectedId)?.length ?? 0)} emojis
              </span>
            </button>
          )}

          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              className={`flex-1 rounded-xl text-xs font-bold ${isGroupView ? "border-[#3F4147] text-[#DCDDDE] hover:bg-[#35373C]" : ""}`}
              onClick={() => setShowEditGroup(false)}
              disabled={editGroupSaving}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-[#6366f1] text-white hover:bg-violet-700 rounded-xl text-xs font-bold shadow-md shadow-violet-500/10"
              onClick={handleSaveGroup}
              disabled={editGroupSaving || !editGroupName.trim() || (selectedConv?.ownerId !== me?.id && !myPerms?.permissions?.manageChannels)}
            >
              {editGroupSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Leave Group Confirmation Modal */}
      <Dialog open={leaveGroupModalOpen} onOpenChange={setLeaveGroupModalOpen}>
        <DialogContent className={`max-w-sm rounded-2xl p-6 ${isGroupView ? "bg-[#1E1F22] border border-[#3F4147]" : "bg-white border border-[#eae8f5]"}`}>
          <DialogHeader>
            <DialogTitle className={`text-sm font-extrabold flex items-center gap-2 ${isGroupView ? "text-white" : "text-[#110e3d]"}`}>
              <LogOut className="h-4 w-4 text-red-400" /> Keluar dari Grup?
            </DialogTitle>
            <DialogDescription className={`text-xs ${isGroupView ? "text-[#949BA4]" : "text-slate-500"}`}>
              Anda akan keluar dari grup <span className="font-black">"{selectedName}"</span>. Anda tidak akan bisa melihat pesan grup ini lagi kecuali diundang kembali.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              className={`flex-1 rounded-xl text-xs font-bold ${isGroupView ? "border-[#3F4147] text-[#DCDDDE] hover:bg-[#35373C]" : ""}`}
              onClick={() => setLeaveGroupModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold"
              onClick={handleLeaveGroup}
            >
              Ya, Keluar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Group Modal */}
      <Dialog open={reportGroupModalOpen} onOpenChange={setReportGroupModalOpen}>
        <DialogContent className={`max-w-sm rounded-2xl p-6 ${isGroupView ? "bg-[#1E1F22] border border-[#3F4147]" : "bg-white border border-[#eae8f5]"}`}>
          <DialogHeader>
            <DialogTitle className={`text-sm font-extrabold flex items-center gap-2 ${isGroupView ? "text-white" : "text-[#110e3d]"}`}>
              <ShieldAlert className="h-4 w-4 text-orange-400" /> Laporkan Grup
            </DialogTitle>
            <DialogDescription className={`text-xs ${isGroupView ? "text-[#949BA4]" : "text-slate-500"}`}>
              Laporan Anda akan dikirim ke admin untuk ditinjau. Harap isi dengan jujur dan akurat.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-3">
            <div>
              <label className={`text-[10px] font-black uppercase tracking-wider ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>Kategori Laporan</label>
              <select
                value={reportGroupCategory}
                onChange={(e) => setReportGroupCategory(e.target.value)}
                className={`w-full mt-1 px-3 py-2 text-xs rounded-xl outline-none border ${isGroupView ? "bg-[#2B2D31] border-[#3F4147] text-[#DCDDDE]" : "bg-slate-50 border-slate-200 text-slate-700"}`}
              >
                <option value="Spam">Spam / Iklan Berlebihan</option>
                <option value="SARA">Konten SARA / Kebencian</option>
                <option value="Penipuan">Penipuan / Scam</option>
                <option value="Konten Dewasa">Konten Tidak Pantas</option>
                <option value="Harassment">Pelecehan / Bullying</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>
            <div>
              <label className={`text-[10px] font-black uppercase tracking-wider ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>Detail Laporan</label>
              <textarea
                value={reportGroupReason}
                onChange={(e) => setReportGroupReason(e.target.value)}
                placeholder="Jelaskan alasan laporan Anda secara singkat..."
                maxLength={500}
                rows={4}
                className={`w-full mt-1 px-3 py-2 text-xs rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none resize-none border ${isGroupView ? "bg-[#2B2D31] border-[#3F4147] text-[#DCDDDE] placeholder:text-[#949BA4]" : "bg-slate-50 border-slate-200"}`}
              />
              <p className={`text-[10px] mt-0.5 text-right ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>{reportGroupReason.length}/500</p>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              className={`flex-1 rounded-xl text-xs font-bold ${isGroupView ? "border-[#3F4147] text-[#DCDDDE] hover:bg-[#35373C]" : ""}`}
              onClick={() => { setReportGroupModalOpen(false); setReportGroupReason(""); }}
            >
              Batal
            </Button>
            <Button
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold"
              onClick={handleReportGroup}
              disabled={reportGroupSubmitting || !reportGroupReason.trim()}
            >
              {reportGroupSubmitting ? "Mengirim..." : "Kirim Laporan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCall && !callType} onOpenChange={(open) => {
        if (!open) {
          setShowCall(false);
          setCallType(null);
        }
      }}>
        <DialogContent className="max-w-md flex flex-col p-0 gap-0 overflow-hidden bg-white border border-[#eae8f5] rounded-2xl transition-all duration-300">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-[#eae8f5] bg-white">
            <DialogTitle className="text-sm font-extrabold text-[#110e3d] flex items-center gap-2">
              📞 Establish Call Connection
              <span className="text-xs text-slate-400 font-bold">— {selectedName}</span>
            </DialogTitle>
          </DialogHeader>

          {showCall && selectedId && (
            <div className="p-6 space-y-6 text-center">
              <div className="space-y-1">
                <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                  Choose your call mode. You will connect securely via the Arcadia Guild network.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    setCallContext({
                      conversationId: selectedId!,
                      conversationName: selectedName,
                      channelId: null,
                      channelName: null,
                    });
                    setCallType("voice");
                    setIsCallMinimized(false);
                  }}
                  className="flex flex-col items-center justify-center p-5 rounded-2xl border border-[#eae8f5] bg-white hover:bg-violet-50/50 hover:border-violet-200 text-[#110e3d] transition-all duration-200 group cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-2xl bg-violet-50 text-[#6366f1] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Phone className="w-5 h-5" />
                  </div>
                  <span className="font-extrabold text-xs">Voice Call</span>
                  <span className="text-[10px] text-slate-400 font-semibold mt-1">Audio only</span>
                </button>

                <button
                  onClick={() => {
                    setCallContext({
                      conversationId: selectedId!,
                      conversationName: selectedName,
                      channelId: null,
                      channelName: null,
                    });
                    setCallType("video");
                    setIsCallMinimized(false);
                  }}
                  className="flex flex-col items-center justify-center p-5 rounded-2xl border border-[#eae8f5] bg-white hover:bg-violet-50/50 hover:border-violet-200 text-[#110e3d] transition-all duration-200 group cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-2xl bg-violet-50 text-[#6366f1] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Video className="w-5 h-5" />
                  </div>
                  <span className="font-extrabold text-xs">Video Call</span>
                  <span className="text-[10px] text-slate-400 font-semibold mt-1">Camera & Audio</span>
                </button>
              </div>

              <div className="flex justify-center pt-2">
                <Button variant="ghost" size="sm" onClick={() => setShowCall(false)} className="text-xs font-bold text-slate-400 hover:text-[#110e3d] rounded-xl">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Persistent Call Overlay Container */}
      {showCall && callType && callContext && (
        <div
          className={`${
            isCallMinimized
              ? "hidden"
              : "fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6"
          }`}
        >
          <div className={`w-full ${(showCallChat || showMusicPlayer) ? "max-w-6xl" : "max-w-4xl"} h-[80vh] flex flex-col overflow-hidden bg-white border border-[#eae8f5] rounded-3xl shadow-2xl transition-all duration-300`}>
            {/* Call Header */}
            <div className="px-5 py-4 border-b border-[#eae8f5] bg-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {callType === "voice" ? "🎙️" : "📹"}
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-[#110e3d] flex items-center gap-1.5">
                    {callType === "voice" ? "Voice Call" : "Video Call"}
                    <span className="text-xs text-slate-400 font-bold">
                      — {callContext.conversationName}
                      {callContext.channelName ? ` (${callContext.channelName})` : ""}
                    </span>
                  </h3>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Music Button */}
                <Button
                  size="icon"
                  variant="ghost"
                  className={`h-9 w-9 rounded-full hover:bg-slate-100 ${showMusicPlayer ? "text-[#6366f1] bg-violet-50 hover:bg-violet-100" : "text-slate-500 hover:text-slate-900"}`}
                  onClick={() => {
                    setShowMusicPlayer(!showMusicPlayer);
                    if (!showMusicPlayer) {
                      setShowCallChat(false); // Close chat if music is opened
                    }
                  }}
                  title="Play Music"
                >
                  <Music className="h-5 w-5" />
                </Button>

                {/* Toggle Chat Button */}
                <Button
                  size="icon"
                  variant="ghost"
                  className={`h-9 w-9 rounded-full hover:bg-slate-100 ${showCallChat ? "text-[#6366f1] bg-violet-50 hover:bg-violet-100" : "text-slate-500 hover:text-slate-900"}`}
                  onClick={() => {
                    setShowCallChat(!showCallChat);
                    if (!showCallChat) {
                      setShowMusicPlayer(false); // Close music if chat is opened
                    }
                  }}
                  title="Toggle Chat"
                >
                  <MessageSquare className="h-5 w-5" />
                </Button>

                {/* Minimize Button */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-900"
                  onClick={() => setIsCallMinimized(true)}
                  title="Minimize Call"
                >
                  <Minimize2 className="h-5 w-5" />
                </Button>

                {/* Hang Up / Leave Button */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 rounded-full bg-red-500 hover:bg-red-600 text-white hover:text-white transition-all shadow-md shadow-red-500/10"
                  onClick={handleHangUp}
                  title="Leave Call"
                >
                  <PhoneOff className="h-4.5 w-4.5" />
                </Button>
              </div>
            </div>

            {/* Jitsi Component Container with optional side chat */}
            <div className="flex-1 flex overflow-hidden p-4 min-h-0 bg-slate-50 gap-4">
              <div className="flex-1 flex min-h-0">
                <JitsiCall
                  roomName={
                    callContext.channelId
                      ? `${slugify(callContext.conversationName)}-${slugify(callContext.channelName ?? "voice")}`
                      : `arcadia-studio-dm-${slugify(callContext.conversationName)}-${String(callContext.conversationId).padStart(3, "0")}`
                  }
                  displayName={me?.displayName ?? me?.username ?? "Anonymous"}
                  avatarUrl={me?.avatarUrl}
                  audioOnly={callType === "voice"}
                  onClose={handleHangUp}
                  subject={
                    callContext.channelId
                      ? `${callContext.conversationName} - ${callContext.channelName}`
                      : callContext.conversationName
                  }
                />
              </div>

              {/* Music Player Side Panel */}
              {showMusicPlayer && (
                <div className="w-80 bg-white border border-[#eae8f5] rounded-2xl flex flex-col min-h-0 overflow-hidden shadow-sm shrink-0">
                  {/* Music Header */}
                  <div className="px-4 py-3 border-b border-[#eae8f5] bg-slate-50 flex items-center justify-between shrink-0">
                    <span className="text-xs font-black text-[#110e3d] uppercase tracking-wider flex items-center gap-1.5">
                      <Music className="w-4 h-4 text-[#6366f1]" /> Call Music
                    </span>
                    <button 
                      onClick={() => setShowMusicPlayer(false)}
                      className="text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Music Search */}
                  <div className="p-3 border-b border-[#eae8f5] bg-white shrink-0">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <Input
                        placeholder="Cari lagu..."
                        value={musicSearchQuery}
                        onChange={(e) => setMusicSearchQuery(e.target.value)}
                        className="h-8 pl-8 text-xs rounded-lg border-slate-200"
                      />
                    </div>
                  </div>

                  {/* Tracks List */}
                  <ScrollArea className="flex-1 p-3 min-h-0 bg-slate-50/30">
                    {loadingMusicTracks ? (
                      <div className="space-y-2 py-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="flex items-center gap-2 px-1">
                            <Skeleton className="w-9 h-9 rounded-lg" />
                            <div className="flex-1 space-y-1">
                              <Skeleton className="h-3 w-24" />
                              <Skeleton className="h-2 w-16" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : musicTracks.length === 0 ? (
                      <div className="text-center text-[10px] text-slate-400 font-bold py-12">
                        Tidak ada lagu ditemukan.
                      </div>
                    ) : (
                      <div className="space-y-1 w-full min-w-0">
                        {musicTracks.map((track) => {
                          const isCurrent = callPlayingTrack?.id === track.id;
                          return (
                            <div
                              key={track.id}
                              className={`flex items-center gap-2 p-1.5 rounded-xl transition-all border w-full min-w-0 ${
                                isCurrent
                                  ? "bg-violet-50/70 border-violet-100 text-[#6366f1]"
                                  : "hover:bg-slate-50 border-transparent text-slate-700"
                                }`}
                            >
                              {track.cover ? (
                                <img src={track.cover} className="w-8 h-8 rounded-lg object-cover shrink-0 border border-slate-100" />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-violet-100 text-[#6366f1] flex items-center justify-center shrink-0">
                                  <Music className="w-3.5 h-3.5" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold truncate block w-full leading-tight">{track.title}</p>
                                <p className="text-[10px] text-slate-400 font-semibold truncate block w-full mt-0.5">{track.artist}</p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                                {/* Play locally */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isCurrent && callIsPlaying) {
                                      handleToggleCallPlay();
                                    } else {
                                      playCallTrack(track);
                                    }
                                  }}
                                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shadow-sm ${
                                    isCurrent && callIsPlaying
                                      ? "bg-violet-600 hover:bg-violet-700 text-white"
                                      : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                                  }`}
                                  title="Putar Sendiri"
                                >
                                  {isCurrent && callIsPlaying ? (
                                    <Pause className="w-3.5 h-3.5 fill-current" />
                                  ) : (
                                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                                  )}
                                </button>

                                {/* Play for Everyone */}
                                <button
                                  type="button"
                                  onClick={() => handleSendCallMusic(track)}
                                  className="w-7 h-7 rounded-full bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center transition-all shadow-sm"
                                  title="Putar untuk Semua Orang"
                                >
                                  <Radio className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>

                  {/* Now Playing Control Bar */}
                  {callPlayingTrack && (
                    <div className="p-3 border-t border-[#eae8f5] bg-white shrink-0 space-y-2.5">
                      <div className="flex items-center gap-2.5">
                        {callPlayingTrack.cover ? (
                          <img src={callPlayingTrack.cover} className="w-10 h-10 rounded-lg object-cover shrink-0 border border-slate-100" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-violet-100 text-[#6366f1] flex items-center justify-center shrink-0">
                            <Music className="w-5 h-5" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] bg-violet-50 text-[#6366f1] px-1 rounded font-extrabold uppercase tracking-wider scale-90 origin-left">Now Playing</span>
                          </div>
                          <p className="text-xs font-black truncate leading-tight text-[#110e3d]">{callPlayingTrack.title}</p>
                          <p className="text-[10px] text-slate-400 font-semibold truncate mt-0.5">{callPlayingTrack.artist}</p>
                        </div>
                        
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-900"
                            onClick={handleToggleCallPlay}
                          >
                            {callIsPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 rounded-full hover:bg-slate-100 text-slate-500 hover:text-red-600"
                            onClick={handleStopCallPlay}
                            title="Stop Music"
                          >
                            <Square className="h-3.5 w-3.5 fill-current" />
                          </Button>
                        </div>
                      </div>

                      {/* Volume and AutoPlay Controls */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 gap-4">
                        {/* Volume Slider */}
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <button type="button" onClick={handleToggleCallMute} className="text-slate-400 hover:text-slate-600 shrink-0">
                            {callMusicMuted || callVolume === 0 ? (
                              <VolumeX className="w-3.5 h-3.5" />
                            ) : callVolume < 0.5 ? (
                              <Volume1 className="w-3.5 h-3.5" />
                            ) : (
                              <Volume2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={callMusicMuted ? 0 : callVolume}
                            onChange={handleCallVolumeChange}
                            className="w-20 accent-violet-600 h-1 rounded-lg cursor-pointer bg-slate-200"
                          />
                        </div>

                        {/* Auto Play Toggle */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-bold text-slate-400" title="Putar otomatis lagu yang dikirim orang lain">Auto-sync</span>
                          <Switch
                            checked={callAutoPlayMusic}
                            onCheckedChange={setCallAutoPlayMusic}
                            className="scale-75 data-[state=checked]:bg-[#6366f1]"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {showCallChat && (
                <div className="w-80 bg-white border border-[#eae8f5] rounded-2xl flex flex-col min-h-0 overflow-hidden shadow-sm shrink-0">
                  {/* Chat Header */}
                  <div className="px-4 py-3 border-b border-[#eae8f5] bg-slate-50 flex items-center justify-between shrink-0">
                    <span className="text-xs font-black text-[#110e3d] uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-[#6366f1]" /> Call Chat
                    </span>
                    <button 
                      onClick={() => setShowCallChat(false)}
                      className="text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Messages List */}
                  <ScrollArea className="flex-1 p-3 min-h-0 bg-slate-50/30">
                    <div className="space-y-3">
                      {callMessages.length === 0 ? (
                        <div className="text-center text-[10px] text-slate-400 font-bold py-12">
                          No messages yet. Send a message to start chatting!
                        </div>
                      ) : (
                        callMessages.map((msg) => {
                          const isOwn = msg.senderId === me?.id;
                          const name = msg.senderDisplayName ?? msg.senderUsername ?? "Unknown";
                          return (
                            <div key={msg.id} className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
                              <span className="text-[9px] text-slate-400 font-bold mb-0.5 px-1">{name}</span>
                              <div className={`max-w-[85%] rounded-xl px-3 py-1.5 text-xs ${
                                isOwn 
                                  ? "bg-[#6366f1] text-white rounded-tr-none" 
                                  : "bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/50"
                              }`}>
                                <p className="break-all whitespace-pre-wrap">{renderMessageTextWithEmojis(msg.content, emojiLibrary?.emojis, selectedId)}</p>
                                {msg.imageUrl && !msg.imageUrl.startsWith("music:") && (
                                  <img src={msg.imageUrl} alt="attached" className="rounded-lg max-w-full mt-1.5 object-cover" />
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={callChatEndRef} />
                    </div>
                  </ScrollArea>

                  {/* Input Form */}
                  <div className="p-3 border-t border-[#eae8f5] bg-white shrink-0">
                    {(() => {
                      const isCallConvGroup = selectedConv?.id === callContext?.conversationId && selectedConv?.type === "group";
                      const isCallGroupOwner = selectedConv?.id === callContext?.conversationId && selectedConv?.ownerId === me?.id;
                      const hasCallSendPermission = !isCallConvGroup || isCallGroupOwner || myPerms?.permissions?.sendMessages;
                      const isCallSuspended = (selectedConv as any)?.isSuspended;

                      if (isCallSuspended) {
                        return (
                          <div className="text-center text-[10px] text-red-500 font-bold py-2">
                            Grup ini ditangguhkan oleh admin.
                          </div>
                        );
                      }

                      if (!hasCallSendPermission) {
                        return (
                          <div className="text-center text-[10px] text-red-500 font-bold py-2">
                            You do not have permission to send messages.
                          </div>
                        );
                      }

                      return (
                        <form 
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleSendCallMessage();
                          }}
                          className="flex gap-2"
                        >
                          <Input
                            placeholder="Type a message..."
                            value={callMessageText}
                            onChange={(e) => setCallMessageText(e.target.value)}
                            className="h-8 rounded-lg text-xs"
                          />
                          <Button 
                            type="submit" 
                            size="icon" 
                            className="h-8 w-8 bg-[#6366f1] hover:bg-indigo-700 text-white shrink-0 rounded-lg"
                            disabled={!callMessageText.trim()}
                          >
                            <SendHorizontal className="h-4 w-4" />
                          </Button>
                        </form>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Zaidan AI Voice Call Overlay */}
      {showAkiraCall && (
        <ZaidanAiCall
          onClose={() => setShowAkiraCall(false)}
          username={me?.username ?? "user"}
        />
      )}

      {/* User Profile Preview */}
      <Dialog open={profilePreviewUser !== null} onOpenChange={(open) => { if (!open) setProfilePreviewUser(null); }}>
        {profilePreviewUser && (() => {
          const overviewUser = profileOverview?.user;
          const localVoiceInfo = activeVoiceByUserId.get(profilePreviewUser.id);
          const voiceChannel = profileOverview?.voiceChannel ?? (localVoiceInfo ? {
            id: localVoiceInfo.channel.id,
            name: localVoiceInfo.channel.name,
            conversationId: localVoiceInfo.channel.conversationId,
            conversationName: selectedConv?.name ?? null,
          } : null);
          const isOnline = overviewUser?.isOnline ?? false;
          const displayName = overviewUser?.displayName || profilePreviewUser.displayName || profilePreviewUser.username;
          const username = overviewUser?.username || profilePreviewUser.username;
          const avatarUrl = overviewUser?.avatarUrl ?? profilePreviewUser.avatarUrl;
          const role = overviewUser?.role ?? profilePreviewUser.role;
          const bio = overviewUser?.bio?.trim();
          const equippedBorder = overviewUser?.equippedBorder ?? profilePreviewUser.equippedBorder;
          const groupRoles = profileOverview?.groupRoles?.length ? profileOverview.groupRoles : (profilePreviewUser.roles ?? []);
          const mutualGroups = profileOverview?.mutualGroups ?? [];
          return (
            <DialogContent className="max-w-sm overflow-hidden rounded-2xl border border-[#3F4147] bg-[#1E1F22] p-0 text-white shadow-2xl">
              <div className="h-24 bg-gradient-to-br from-[#5865F2] via-[#7C3AED] to-[#111827]" />
              <div className="px-5 pb-5">
                <div className="-mt-10 flex items-end justify-between">
                  <div className={`rounded-full p-1 ${equippedBorder ?? "bg-[#1E1F22]"}`}>
                    <div className="relative">
                      <Avatar className="h-20 w-20 border-4 border-[#1E1F22]">
                        <AvatarImage src={avatarUrl ?? undefined} />
                        <AvatarFallback className="bg-[#2B2D31] text-xl font-black text-[#DCDDDE]">
                          {getInitials(displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className={`absolute bottom-2 right-2 h-5 w-5 rounded-full border-4 border-[#1E1F22] ${isOnline ? "bg-emerald-500" : "bg-zinc-500"}`} />
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <h3 className="text-xl font-black leading-tight text-white">
                    {displayName}
                    {((overviewUser as any)?.isVerified || (profilePreviewUser as any)?.isVerified) && (
                      <BadgeCheck className="w-5 h-5 text-blue-400 fill-blue-400/20 shrink-0 inline-block align-middle ml-1.5" />
                    )}
                    {((overviewUser as any)?.isBusinessVerified || (profilePreviewUser as any)?.isBusinessVerified) && (
                      <BadgeCheck className="w-5 h-5 text-emerald-500 fill-emerald-500/20 shrink-0 inline-block align-middle ml-1.5" />
                    )}
                  </h3>
                  <p className="text-xs font-bold text-[#B5BAC1]">@{username}</p>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {role && role !== "member" && (
                    <Badge className={`h-5 rounded-md px-2 text-[10px] font-bold ${ROLE_BADGE_CLASSES[role] ?? ""}`}>
                      {ROLE_LABELS[role] ?? role}
                    </Badge>
                  )}
                </div>

                {groupRoles.length > 0 && (
                  <div className="mt-2 rounded-lg border border-[#3F4147] bg-[#2B2D31] px-3 py-2">
                    <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-[#B5BAC1]">Group Roles</p>
                    <div className="flex flex-wrap gap-1.5">
                      {groupRoles.map((role) => (
                        <span
                          key={`group-role-${role.id}`}
                          className="rounded-md border px-2 py-0.5 text-[10px] font-bold"
                          style={{
                            backgroundColor: `${role.color}22`,
                            color: role.color,
                            borderColor: `${role.color}55`,
                          }}
                        >
                          {role.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 rounded-xl border border-[#3F4147] bg-[#2B2D31] p-3">
                  <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-[#B5BAC1]">Bio</p>
                  <p className={`whitespace-pre-wrap text-xs font-semibold leading-relaxed ${bio ? "text-[#DCDDDE]" : "text-[#949BA4]"}`}>
                    {bio || "No bio yet."}
                  </p>
                </div>

                <div className="mt-4 rounded-xl border border-[#3F4147] bg-[#2B2D31] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#B5BAC1]">
                      {isOnline ? "Online" : "Offline"}
                    </span>
                    <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? "bg-emerald-500 shadow-md shadow-emerald-500/40" : "bg-zinc-500"}`} />
                  </div>
                  <p className="mb-3 text-[11px] font-semibold text-[#949BA4]">
                    {isOnline ? "Currently browsing Arcadia" : formatLastSeen(overviewUser?.lastSeenAt)}
                  </p>

                  {voiceChannel ? (
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#B5BAC1]">In voice</p>
                        <div className="mt-2 flex items-center gap-2">
                          <Volume2 className="h-4 w-4 shrink-0 text-[#B5BAC1]" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-extrabold text-[#DCDDDE]">{voiceChannel.name}</p>
                            <p className="text-[11px] font-semibold text-[#949BA4]">
                              in {voiceChannel.conversationName ?? "this group"}
                            </p>
                          </div>
                        </div>
                      </div>
                      <Button
                        className="h-9 w-full rounded-lg bg-[#5865F2] text-xs font-bold text-white hover:bg-[#4752C4]"
                        onClick={() => {
                          setProfilePreviewUser(null);
                          setSelectedId(voiceChannel.conversationId);
                          setSelectedChannelId(voiceChannel.id);
                        }}
                      >
                        Open Voice
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs font-semibold text-[#949BA4]">Not connected to a voice channel.</p>
                  )}
                </div>

                <div className="mt-3 rounded-xl border border-[#3F4147] bg-[#2B2D31] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#B5BAC1]">Mutual Groups</p>
                    <span className="text-[10px] font-black text-[#949BA4]">{mutualGroups.length}</span>
                  </div>
                  {mutualGroups.length > 0 ? (
                    <div className="space-y-1.5">
                      {mutualGroups.slice(0, 4).map((group) => (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => {
                            setProfilePreviewUser(null);
                            setSelectedId(group.id);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-[#35373C]"
                        >
                          <Avatar className="h-6 w-6 border border-[#3F4147]">
                            <AvatarImage src={group.iconUrl ?? undefined} />
                            <AvatarFallback className="bg-[#35373C] text-[9px] font-black text-[#DCDDDE]">
                              {getInitials(group.name ?? "Group")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="min-w-0 flex-1 truncate text-xs font-bold text-[#DCDDDE]">
                            {group.name ?? "Unnamed Group"}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs font-semibold text-[#949BA4]">No shared groups.</p>
                  )}
                </div>
              </div>
            </DialogContent>
          );
        })()}
      </Dialog>

      {/* Channel Editor Dialog */}
      <Dialog open={showChannelEditor} onOpenChange={setShowChannelEditor}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-[#1E1F22] border border-[#3F4147] rounded-2xl p-5 text-white">
          <DialogHeader>
            <DialogTitle className="text-sm font-extrabold text-white flex items-center gap-2">
              <ListOrdered className="w-4 h-4 text-[#5865F2]" /> Channel Editor
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-2 mt-2">
            <div className="space-y-4">
              {channelEditorSections.length === 0 ? (
                <div className="rounded-xl border border-[#3F4147] bg-[#2B2D31] px-4 py-8 text-center text-xs font-bold text-[#949BA4]">
                  No channels
                </div>
              ) : (
                channelEditorSections.map((section) => (
                  <div key={section.key} className="space-y-1.5">
                    <div className="px-1 text-[10px] font-black text-[#949BA4] uppercase tracking-widest">
                      {section.label}
                    </div>
                    <div className="space-y-1">
                      {section.channels.map((ch, index) => {
                        const isMoving = movingChannelId === ch.id;
                        const isFirst = index === 0;
                        const isLast = index === section.channels.length - 1;
                        return (
                          <div
                            key={ch.id}
                            className="flex items-center gap-2 rounded-lg border border-[#3F4147] bg-[#2B2D31] px-2 py-2"
                          >
                            {ch.type === "voice" ? (
                              <Volume2 className="w-4 h-4 shrink-0 text-[#949BA4]" />
                            ) : ch.type === "announce" ? (
                              <Megaphone className="w-4 h-4 shrink-0 text-[#949BA4]" />
                            ) : (
                              <Hash className="w-4 h-4 shrink-0 text-[#949BA4]" />
                            )}
                            <span className="min-w-0 flex-1 truncate text-xs font-bold text-[#DCDDDE]">
                              {ch.name}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                size="icon"
                                variant="ghost"
                                disabled={isFirst || movingChannelId !== null}
                                onClick={() => handleMoveChannel(ch, -1)}
                                title="Move Up"
                                className="h-7 w-7 rounded-md text-[#DCDDDE] hover:bg-[#35373C] hover:text-white disabled:opacity-30"
                              >
                                <ArrowUp className={`w-3.5 h-3.5 ${isMoving ? "animate-pulse" : ""}`} />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                disabled={isLast || movingChannelId !== null}
                                onClick={() => handleMoveChannel(ch, 1)}
                                title="Move Down"
                                className="h-7 w-7 rounded-md text-[#DCDDDE] hover:bg-[#35373C] hover:text-white disabled:opacity-30"
                              >
                                <ArrowDown className={`w-3.5 h-3.5 ${isMoving ? "animate-pulse" : ""}`} />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="flex justify-end pt-3">
            <Button
              className="bg-[#5865F2] hover:bg-[#4752C4] font-bold text-xs rounded-xl"
              onClick={() => setShowChannelEditor(false)}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Channel Dialog */}
      <Dialog open={showEditChannelModal} onOpenChange={(open) => { setShowEditChannelModal(open); if (!open) setNewWebhookName(""); }}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto bg-[#1E1F22] border border-[#3F4147] rounded-2xl p-5 text-white">
          <DialogHeader>
            <DialogTitle className="text-sm font-extrabold text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#5865F2]" /> Edit Channel
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-[10px] font-black text-[#949BA4] uppercase tracking-wider block mb-1.5">Channel Name</label>
              <Input
                placeholder="Channel name"
                value={editChannelName}
                onChange={(e) => setEditChannelName(e.target.value)}
                className="bg-[#2B2D31] border-[#3F4147] text-[#DCDDDE] placeholder:text-[#949BA4] focus-visible:ring-[#5865F2] rounded-xl font-semibold text-xs animate-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-[#949BA4] uppercase tracking-wider block mb-1.5">Category</label>
              <select
                value={editChannelCategoryId ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditChannelCategoryId(val ? parseInt(val, 10) : null);
                }}
                className="w-full bg-[#2B2D31] border border-[#3F4147] text-[#DCDDDE] rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-[#5865F2] outline-none"
              >
                <option value="">Uncategorized</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2 mt-5">
            <Button
              variant="outline"
              className="flex-1 rounded-xl text-xs font-bold border-[#3F4147] text-[#DCDDDE] hover:bg-[#35373C] hover:text-white"
              onClick={() => { setShowEditChannelModal(false); setEditingChannel(null); }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveChannel}
              disabled={!editChannelName.trim()}
              className="flex-1 bg-[#5865F2] text-white hover:bg-[#4752C4] rounded-xl font-bold text-xs"
            >
              Save Changes
            </Button>
          </div>

          {/* Webhooks */}
          <div className="border-t border-[#3F4147] mt-4 pt-4">
            <label className="text-[10px] font-black text-[#949BA4] uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Activity className="w-3.5 h-3.5 text-[#5865F2]" /> Webhooks
            </label>
            <p className="text-[10px] text-[#949BA4] mb-3 leading-relaxed">
              Kirim pesan ke channel ini dari layanan luar. POST ke URL webhook dengan body JSON <code className="text-[#DCDDDE]">{`{ "content": "...", "username": "...", "avatar_url": "..." }`}</code>.
            </p>

            {channelWebhooks.length > 0 && (
              <div className="space-y-2 mb-3">
                {channelWebhooks.map((wh: any) => (
                  <div key={wh.id} className="rounded-xl border border-[#3F4147] bg-[#2B2D31] p-2.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold text-[#DCDDDE] truncate flex-1">{wh.name}</span>
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(webhookUrl(wh)); toast({ title: "URL webhook disalin!" }); }}
                        className="text-[10px] font-bold text-[#5865F2] hover:underline flex items-center gap-1 shrink-0"
                      >
                        <Copy className="w-3 h-3" /> Salin URL
                      </button>
                      <button
                        type="button"
                        onClick={() => { if (confirm(`Hapus webhook "${wh.name}"?`)) deleteWebhookMutation.mutate(wh.id); }}
                        className="text-[10px] font-bold text-[#da373c] hover:underline flex items-center gap-1 shrink-0"
                      >
                        <Trash2 className="w-3 h-3" /> Hapus
                      </button>
                    </div>
                    <code className="block text-[9px] text-[#949BA4] bg-[#1E1F22] rounded px-2 py-1 truncate">{webhookUrl(wh)}</code>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                placeholder="Nama webhook (cth: GitHub Bot)"
                value={newWebhookName}
                onChange={(e) => setNewWebhookName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newWebhookName.trim()) createWebhookMutation.mutate(); }}
                className="bg-[#2B2D31] border-[#3F4147] text-[#DCDDDE] placeholder:text-[#949BA4] focus-visible:ring-[#5865F2] rounded-xl font-semibold text-xs animate-none"
              />
              <Button
                onClick={() => createWebhookMutation.mutate()}
                disabled={!newWebhookName.trim() || createWebhookMutation.isPending}
                className="bg-[#5865F2] text-white hover:bg-[#4752C4] rounded-xl font-bold text-xs shrink-0"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Buat
              </Button>
            </div>
          </div>

          <div className="border-t border-[#3F4147] mt-4 pt-4">
            <Button
              variant="destructive"
              className="w-full rounded-xl text-xs font-bold bg-[#da373c] hover:bg-[#a92b2f] text-white"
              onClick={handleDeleteChannel}
            >
              Delete Channel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={showEditCategoryModal} onOpenChange={setShowEditCategoryModal}>
        <DialogContent className="max-w-sm bg-[#1E1F22] border border-[#3F4147] rounded-2xl p-5 text-white">
          <DialogHeader>
            <DialogTitle className="text-sm font-extrabold text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#5865F2]" /> Edit Category
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-[10px] font-black text-[#949BA4] uppercase tracking-wider block mb-1.5">Category Name</label>
              <Input
                placeholder="Category name"
                value={editCategoryName}
                onChange={(e) => setEditCategoryName(e.target.value)}
                className="bg-[#2B2D31] border-[#3F4147] text-[#DCDDDE] placeholder:text-[#949BA4] focus-visible:ring-[#5865F2] rounded-xl font-semibold text-xs animate-none"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-5">
            <Button
              variant="outline"
              className="flex-1 rounded-xl text-xs font-bold border-[#3F4147] text-[#DCDDDE] hover:bg-[#35373C] hover:text-white"
              onClick={() => { setShowEditCategoryModal(false); setEditingCategory(null); }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveCategory}
              disabled={!editCategoryName.trim()}
              className="flex-1 bg-[#5865F2] text-white hover:bg-[#4752C4] rounded-xl font-bold text-xs"
            >
              Save Changes
            </Button>
          </div>

          <div className="border-t border-[#3F4147] mt-4 pt-4">
            <Button
              variant="destructive"
              className="w-full rounded-xl text-xs font-bold bg-[#da373c] hover:bg-[#a92b2f] text-white"
              onClick={handleDeleteCategory}
            >
              Delete Category
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Developer & Bot Settings Dialog */}
      <Dialog open={showDeveloperSettings} onOpenChange={setShowDeveloperSettings}>
        <DialogContent className="max-w-3xl bg-[#1E1F22] border border-[#3F4147] rounded-2xl p-6 text-white flex flex-col h-[85vh] max-h-[750px]">
          <DialogHeader className="border-b border-[#3F4147] pb-3 shrink-0">
            <DialogTitle className="text-lg font-black flex items-center gap-2 text-white">
              <Cpu className="w-5 h-5 text-[#5865F2]" /> Developer Console & Bot Settings
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-[#949BA4]">
              Build custom bots, configure webhooks, and migrate Discord/Telegram bots to your server.
            </DialogDescription>
          </DialogHeader>

          {/* Tabs Navigation */}
          <div className="flex gap-2 border-b border-[#3F4147] py-2 shrink-0">
            <button
              onClick={() => setDeveloperTab("list")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                developerTab === "list" ? "bg-[#5865F2] text-white" : "text-[#949BA4] hover:text-white hover:bg-[#35373C]"
              }`}
            >
              My Bots ({myBots.length})
            </button>
            <button
              onClick={() => setDeveloperTab("create")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                developerTab === "create" ? "bg-[#5865F2] text-white" : "text-[#949BA4] hover:text-white hover:bg-[#35373C]"
              }`}
            >
              Create Bot
            </button>
            <button
              onClick={() => setDeveloperTab("tutorial")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                developerTab === "tutorial" ? "bg-[#5865F2] text-white" : "text-[#949BA4] hover:text-white hover:bg-[#35373C]"
              }`}
            >
              📖 SDK & Migration Tutorial
            </button>
          </div>

          {/* Tabs Content */}
          <div className="flex-1 min-h-0 overflow-y-auto pt-4 pr-1">
            {developerTab === "list" && (
              <div className="space-y-4">
                {myBots.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 space-y-2">
                    <p className="text-sm font-bold">No bots created yet.</p>
                    <p className="text-xs">Head over to the "Create Bot" tab to register your first bot!</p>
                  </div>
                ) : (
                  myBots.map((bot: any) => (
                    <div key={bot.id} className="bg-[#2B2D31] border border-[#3F4147] rounded-xl p-4 space-y-4 shadow-md">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10 border border-[#3F4147]">
                            <AvatarImage src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(bot.name)}`} />
                            <AvatarFallback className="bg-slate-800 text-white font-extrabold text-xs">B</AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                              {bot.name}
                              <span className="text-[9px] bg-[#5865F2]/20 text-[#5865F2] px-1 py-0 h-3.5 flex items-center rounded border border-[#5865F2]/40 font-black">BOT</span>
                            </h4>
                            <p className="text-[10px] text-slate-400 font-bold capitalize">Category: {bot.category}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${bot.status === "online" ? "bg-emerald-500 shadow-emerald-500/50 shadow-md" : "bg-zinc-500"}`} />
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{bot.status}</span>
                        </div>
                      </div>

                      {/* Bot Token */}
                      <div className="space-y-1.5 bg-[#1E1F22] rounded-xl p-3 border border-[#3F4147]">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <Key className="w-3.5 h-3.5 text-amber-400" /> Bot Token (Keep Private)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type={visibleTokens[bot.id] ? "text" : "password"}
                            readOnly
                            value={bot.token}
                            className="flex-1 px-3 py-1.5 text-xs bg-[#2B2D31] border border-[#3F4147] text-[#DCDDDE] rounded-lg outline-none font-mono font-semibold"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setVisibleTokens(prev => ({ ...prev, [bot.id]: !prev[bot.id] }))}
                            className="text-xs text-[#DCDDDE] hover:bg-[#35373C] px-2 h-8"
                          >
                            {visibleTokens[bot.id] ? "Hide" : "Show"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              navigator.clipboard.writeText(bot.token);
                              setCopiedTokenBotId(bot.id);
                              toast({ title: "Token Copied!", description: "Keep it secure!" });
                              setTimeout(() => setCopiedTokenBotId(null), 2000);
                            }}
                            className="text-xs text-[#DCDDDE] hover:bg-[#35373C] px-2 h-8 flex items-center gap-1.5"
                          >
                            {copiedTokenBotId === bot.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            Copy
                          </Button>
                        </div>
                      </div>

                      {/* Webhook Configuration */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Webhook Event Endpoint URL
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="http://your-bot-server.com/webhooks/events"
                            defaultValue={bot.webhookUrl || ""}
                            onChange={(e) => {
                              setEditingBot(bot);
                              setBotWebhookInput(e.target.value);
                            }}
                            className="flex-1 px-3 py-2 text-xs bg-[#1E1F22] border border-[#3F4147] text-[#DCDDDE] rounded-xl outline-none focus:ring-1 focus:ring-[#5865F2] font-semibold"
                          />
                          <Button
                            onClick={async () => {
                              const targetBot = editingBot?.id === bot.id ? editingBot : bot;
                              const url = editingBot?.id === bot.id ? botWebhookInput : bot.webhookUrl;
                              try {
                                const res = await fetch(`/api/bots/${targetBot.id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ webhookUrl: url }),
                                });
                                if (!res.ok) throw new Error();
                                await refetchMyBots();
                                toast({ title: "Webhook updated!" });
                              } catch {
                                toast({ title: "Failed to update webhook", variant: "destructive" });
                              }
                            }}
                            className="bg-[#5865F2] text-white hover:bg-[#4752C4] text-xs font-bold rounded-xl h-9 px-4 shrink-0"
                          >
                            Save Webhook
                          </Button>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-normal font-medium">
                          Whenever a message is sent in group chats this bot is invited to, we will send an HTTP POST event with message content to this URL.
                        </p>
                      </div>

                      {/* Bot Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#3F4147]/50">
                        <div className="flex items-center gap-2">
                          {/* Chat with Bot Button */}
                          <Button
                            size="sm"
                            onClick={async () => {
                              try {
                                const res = await fetch("/api/conversations/dm", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ targetUserId: bot.userId }),
                                });
                                if (!res.ok) {
                                  const errData = await res.json().catch(() => ({}));
                                  throw new Error(errData.error || "Failed to start chat");
                                }
                                const conv = await res.json();
                                setSelectedId(conv.id);
                                setShowDeveloperSettings(false);
                                toast({ title: `Chatting with ${bot.name}!` });
                              } catch (err: any) {
                                toast({ title: "Failed to start chat", description: err.message, variant: "destructive" });
                              }
                            }}
                            className="bg-[#5865F2] text-white hover:bg-[#4752C4] text-[10px] font-black rounded-xl h-8 px-3.5 flex items-center gap-1.5 cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> Chat with Bot
                          </Button>

                          {/* Add to Group Dropdown */}
                          {invitableGroups.length > 0 && (
                            <div className="relative">
                              <select
                                value=""
                                onChange={async (e) => {
                                  const val = e.target.value;
                                  if (!val) return;
                                  const groupId = parseInt(val, 10);
                                  const groupName = invitableGroups.find(g => g.id === groupId)?.name || "Group";
                                  try {
                                    const res = await fetch(`/api/conversations/${groupId}/bots`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ botId: bot.id }),
                                    });
                                    if (!res.ok) throw new Error();
                                    toast({ title: `Added ${bot.name} to ${groupName}!` });
                                    await refetchConversationBots();
                                    await queryClient.invalidateQueries({ queryKey: [`/api/conversations/${groupId}/members`] });
                                  } catch {
                                    toast({ title: "Failed to invite bot", variant: "destructive" });
                                  }
                                }}
                                className="bg-[#1E1F22] border border-[#3F4147] text-[#DCDDDE] rounded-xl px-3 py-1.5 text-[10px] font-bold outline-none cursor-pointer hover:border-[#5865F2] transition-colors"
                              >
                                <option value="">➕ Add to Group...</option>
                                {invitableGroups.map((g: any) => (
                                  <option key={g.id} value={g.id}>
                                    {g.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        {/* Delete Bot */}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={async () => {
                            if (!confirm(`Are you sure you want to delete bot "${bot.name}"? This action is permanent.`)) return;
                            try {
                              const res = await fetch(`/api/bots/${bot.id}`, { method: "DELETE" });
                              if (!res.ok) throw new Error();
                              await refetchMyBots();
                              toast({ title: "Bot deleted!" });
                            } catch {
                              toast({ title: "Failed to delete bot", variant: "destructive" });
                            }
                          }}
                          className="bg-[#da373c] text-white hover:bg-[#a92b2f] text-[10px] font-bold rounded-xl py-1 px-3 h-8 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete Bot
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {developerTab === "create" && (
              <div className="max-w-md mx-auto bg-[#2B2D31] border border-[#3F4147] rounded-xl p-5 space-y-4 my-4">
                <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-[#5865F2]" /> Register New Bot Account
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Bot Name</label>
                    <Input
                      placeholder="My Awesome Bot"
                      value={botNameInput}
                      onChange={(e) => setBotNameInput(e.target.value)}
                      className="bg-[#1E1F22] border-[#3F4147] text-[#DCDDDE] rounded-xl text-xs font-semibold focus-visible:ring-[#5865F2]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Category</label>
                    <select
                      value={botCategoryInput}
                      onChange={(e) => setBotCategoryInput(e.target.value)}
                      className="w-full bg-[#1E1F22] border border-[#3F4147] text-[#DCDDDE] rounded-xl px-3 py-2 text-xs font-semibold focus:ring-1 focus:ring-[#5865F2] outline-none"
                    >
                      <option value="General">General</option>
                      <option value="Moderation">Moderation</option>
                      <option value="Utility">Utility</option>
                      <option value="Games">Games</option>
                      <option value="Fun">Fun</option>
                    </select>
                  </div>
                  <Button
                    onClick={async () => {
                      if (!botNameInput.trim()) return;
                      try {
                        const res = await fetch("/api/bots", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ name: botNameInput, category: botCategoryInput }),
                        });
                        if (!res.ok) throw new Error();
                        setBotNameInput("");
                        setBotCategoryInput("General");
                        setDeveloperTab("list");
                        await refetchMyBots();
                        toast({ title: "Bot registered successfully!" });
                      } catch {
                        toast({ title: "Failed to register bot", variant: "destructive" });
                      }
                    }}
                    disabled={!botNameInput.trim()}
                    className="w-full bg-[#5865F2] text-white hover:bg-[#4752C4] font-bold text-xs rounded-xl h-10 mt-2 shadow-md shadow-[#5865F2]/20"
                  >
                    Register Bot
                  </Button>
                </div>
              </div>
            )}

            {developerTab === "tutorial" && (
              <div className="space-y-6 text-slate-300 text-xs leading-relaxed font-semibold">
                <div className="space-y-2">
                  <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                    🚀 Pointing Existing Bots (Migration)
                  </h3>
                  <p>
                    You can point any bot (like Discord or Telegram bots) to this platform by changing its **API base URL** without modifying its logic.
                  </p>
                </div>

                <div className="space-y-3 border-l-2 border-[#5865F2] pl-3">
                  <h4 className="text-white font-extrabold text-xs">👾 Discord Bot (Discord.js / Python Discord)</h4>
                  <p>
                    Instead of hitting `https://discord.com/api/v10`, point the API library base URL to your server's endpoint:
                  </p>
                  <pre className="bg-[#1E1F22] rounded-xl p-3 border border-[#3F4147] text-[11px] font-mono text-emerald-400 overflow-x-auto">
{`// Discord.js client configuration example
const client = new Client({
  // Set rest options to point api to your workspace server
  rest: {
    api: "http://${window.location.host}/api/v10",
  }
});

client.login("YOUR_BOT_TOKEN");`}
                  </pre>
                  <p>
                    To send messages, use standard Discord channel posting. The channel ID maps to the **Conversation ID** (visible in your address bar or logs) or **Channel ID** of groups.
                  </p>
                </div>

                <div className="space-y-3 border-l-2 border-emerald-500 pl-3">
                  <h4 className="text-white font-extrabold text-xs">✈️ Telegram Bot (Telegram Bot API)</h4>
                  <p>
                    Send messages by directing POST requests to your local endpoint using the Telegram URL layout:
                  </p>
                  <pre className="bg-[#1E1F22] rounded-xl p-3 border border-[#3F4147] text-[11px] font-mono text-emerald-400 overflow-x-auto">
{`// Telegram base API replacement
// Request POST: http://${window.location.host}/api/bot/telegram/bot{YOUR_BOT_TOKEN}/sendMessage
// Request Body JSON:
{
  "chat_id": 123, // Use your Conversation ID
  "text": "Hello from migrated Telegram Bot!"
}`}
                  </pre>
                </div>

                <div className="space-y-3 border-l-2 border-amber-500 pl-3">
                  <h4 className="text-white font-extrabold text-xs">🔗 Heartbeat & Custom Webhooks (Generic Bots)</h4>
                  <p>
                    For custom scripts, write a simple script that sends heartbeats to stay online and listens for webhook payloads.
                  </p>
                  <p className="font-extrabold text-white text-[11px] mt-2">1. Heartbeat Connection Ping (Interval: 15 seconds):</p>
                  <pre className="bg-[#1E1F22] rounded-xl p-3 border border-[#3F4147] text-[11px] font-mono text-emerald-400 overflow-x-auto">
{`// Keep bot online by pinging
setInterval(() => {
  fetch("http://${window.location.host}/api/bots/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "YOUR_BOT_TOKEN" })
  }).then(res => res.json())
    .then(data => console.log("Bot status:", data.status));
}, 15000);`}
                  </pre>
                  <p className="font-extrabold text-white text-[11px] mt-2">2. Webhook Event format (Received on your server):</p>
                  <pre className="bg-[#1E1F22] rounded-xl p-3 border border-[#3F4147] text-[11px] font-mono text-emerald-400 overflow-x-auto">
{`// Payload sent to your webhook URL
{
  "event": "MESSAGE_CREATE",
  "bot": { "id": 1, "name": "Helper" },
  "message": {
    "conversationId": 12,
    "channelId": null,
    "content": "Hello bot!",
    "sender": { "id": 4, "username": "Zaidan", "role": "member" }
  }
}`}
                  </pre>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-[#3F4147] pt-4 shrink-0 flex justify-end">
            <Button
              className="bg-[#5865F2] hover:bg-[#4752C4] font-bold text-xs rounded-xl"
              onClick={() => setShowDeveloperSettings(false)}
            >
              Close Console
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite Bot to Group Dialog */}
      <Dialog open={showInviteBotModal} onOpenChange={setShowInviteBotModal}>
        <DialogContent className="max-w-md bg-[#1E1F22] border border-[#3F4147] rounded-2xl p-5 text-white">
          <DialogHeader className="pb-3 border-b border-[#3F4147]">
            <DialogTitle className="text-sm font-black flex items-center gap-2">
              🤖 Invite Bot to Group
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 font-bold">
              Select an available bot to invite to this group conversation.
            </DialogDescription>
          </DialogHeader>

          {/* Invited bots list first */}
          {conversationBots.length > 0 && (
            <div className="py-2 border-b border-[#3F4147]">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Invited Bots in this Group</p>
              <div className="space-y-1.5">
                {conversationBots.map((bot) => (
                  <div key={bot.id} className="flex items-center justify-between bg-[#2B2D31] border border-[#3F4147] px-3 py-1.5 rounded-xl">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="w-6 h-6 border border-[#3F4147]">
                        <AvatarImage src={bot.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-[9px] bg-slate-800 text-white font-extrabold">B</AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-bold text-[#DCDDDE] truncate">{bot.name}</span>
                    </div>
                    {(selectedConv?.ownerId === me?.id || myPerms?.permissions?.kickMembers) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[10px] text-slate-400 hover:text-[#ef4444] hover:bg-red-50/10 rounded-lg font-bold"
                        onClick={async () => {
                          if (!selectedId) return;
                          try {
                            const res = await fetch(`/api/conversations/${selectedId}/bots/${bot.id}`, { method: "DELETE" });
                            if (!res.ok) throw new Error();
                            await refetchConversationBots();
                            await queryClient.invalidateQueries({ queryKey: [`/api/conversations/${selectedId}/members`] });
                            toast({ title: "Bot removed!" });
                          } catch {
                            toast({ title: "Failed to remove bot", variant: "destructive" });
                          }
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available bots checklist */}
          <div className="py-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Available System Bots</p>
            <ScrollArea className="h-44 pr-1">
              <div className="space-y-1.5">
                {systemBots.filter(bot => !conversationBots.some(cb => cb.id === bot.id)).length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-8">No other available bots.</p>
                ) : (
                  systemBots.filter(bot => !conversationBots.some(cb => cb.id === bot.id)).map((bot) => (
                    <button
                      key={bot.id}
                      onClick={async () => {
                        if (!selectedId) return;
                        try {
                          const res = await fetch(`/api/conversations/${selectedId}/bots`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ botId: bot.id }),
                          });
                          if (!res.ok) throw new Error();
                          await refetchConversationBots();
                          await queryClient.invalidateQueries({ queryKey: [`/api/conversations/${selectedId}/members`] });
                          toast({ title: "Bot invited successfully!" });
                        } catch {
                          toast({ title: "Failed to invite bot", variant: "destructive" });
                        }
                      }}
                      className="w-full flex items-center justify-between bg-[#2B2D31] border border-[#3F4147] hover:border-[#5865F2] px-3 py-2 rounded-xl text-left transition-all group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="w-7 h-7 border border-[#3F4147]">
                          <AvatarImage src={bot.avatarUrl ?? undefined} />
                          <AvatarFallback className="text-[9px] bg-slate-800 text-white font-extrabold">B</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-xs font-bold text-[#DCDDDE] truncate group-hover:text-white">{bot.name}</p>
                          <p className="text-[9px] text-slate-400 font-bold capitalize">{bot.category}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-black text-[#5865F2] group-hover:text-white transition-colors">+ Invite</span>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#3F4147]">
            <Button
              className="bg-[#5865F2] hover:bg-[#4752C4] font-bold text-xs rounded-xl"
              onClick={() => setShowInviteBotModal(false)}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* STICKER STUDIO MODAL */}
      <Dialog open={showStickerStudio} onOpenChange={(open) => {
        if (!open) {
          handleCloseStickerStudio();
        }
      }}>
        <DialogContent className={`max-w-2xl rounded-2xl p-5 ${isGroupView ? "bg-[#1E1F22] border border-[#3F4147] text-white animate-in zoom-in-95 duration-200" : "bg-white border border-[#eae8f5] text-slate-900 animate-in zoom-in-95 duration-200"}`}>
          <DialogHeader>
            <DialogTitle className="text-md font-black uppercase tracking-wider">Sticker Studio</DialogTitle>
            <DialogDescription className={`text-xs ${isGroupView ? "text-slate-400" : "text-slate-500"}`}>
              Unggah gambar dari PC dan tambahkan teks kustom untuk dijadikan stiker grup.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-3">
            {/* PREVIEW CONTAINER */}
            <div className="flex flex-col items-center justify-center gap-3">
              <div className={`relative w-full aspect-square max-w-[280px] rounded-2xl border flex items-center justify-center overflow-hidden shadow-inner ${isGroupView ? "bg-[#2B2D31] border-[#3F4147]" : "bg-slate-50 border-slate-200"}`}>
                {studioImage ? (
                  <div className="relative w-full h-full flex items-center justify-center p-2">
                    <img src={studioImage} alt="Preview" className="w-full h-full object-contain" />
                    {studioCaption.trim() && (
                      <div
                        style={{
                          position: "absolute",
                          left: 10,
                          right: 10,
                          textAlign: "center",
                          fontFamily: studioFont === "Impact" ? "Impact, sans-serif" : studioFont,
                          fontSize: `${studioFontSize / 2.2}px`,
                          color: studioTextColor,
                          textShadow: `
                            -1px -1px 0 ${studioOutlineColor},  
                             1px -1px 0 ${studioOutlineColor},
                            -1px  1px 0 ${studioOutlineColor},
                             1px  1px 0 ${studioOutlineColor},
                            -2px -2px 0 ${studioOutlineColor},
                             2px -2px 0 ${studioOutlineColor},
                            -2px  2px 0 ${studioOutlineColor},
                             2px  2px 0 ${studioOutlineColor}
                          `,
                          fontWeight: "black",
                          textTransform: "uppercase",
                          pointerEvents: "none",
                          wordBreak: "break-word",
                          ...(studioPosition === "top"
                            ? { top: "15px" }
                            : studioPosition === "middle"
                            ? { top: "50%", transform: "translateY(-50%)" }
                            : { bottom: "15px" }),
                        }}
                      >
                        {studioCaption}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className={`text-xs font-bold ${isGroupView ? "text-slate-500" : "text-slate-400"}`}>
                    Pilih gambar untuk memulai
                  </span>
                )}
              </div>
            </div>

            {/* CONTROLS */}
            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
              <div>
                <Label className="text-xs font-black uppercase tracking-wider opacity-70">Pilih Gambar (Maks 2MB)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleStudioFileChange}
                  className={`mt-1 text-xs cursor-pointer ${isGroupView ? "bg-[#2B2D31] border-[#3F4147]" : "bg-slate-50"}`}
                />
              </div>

              <div>
                <Label className="text-xs font-black uppercase tracking-wider opacity-70">Nama Sticker (Maks 40 karakter)</Label>
                <Input
                  type="text"
                  maxLength={40}
                  placeholder="Contoh: ngakak-guling"
                  value={studioName}
                  onChange={(e) => setStudioName(e.target.value)}
                  className={`mt-1 text-xs ${isGroupView ? "bg-[#2B2D31] border-[#3F4147]" : "bg-slate-50"}`}
                />
              </div>

              <div>
                <Label className="text-xs font-black uppercase tracking-wider opacity-70">Caption Text (Opsional)</Label>
                <Input
                  type="text"
                  placeholder="Ketik teks di sini..."
                  value={studioCaption}
                  onChange={(e) => setStudioCaption(e.target.value)}
                  className={`mt-1 text-xs ${isGroupView ? "bg-[#2B2D31] border-[#3F4147]" : "bg-slate-50"}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-black uppercase tracking-wider opacity-70">Font Family</Label>
                  <select
                    value={studioFont}
                    onChange={(e) => setStudioFont(e.target.value)}
                    className={`w-full mt-1 border rounded-xl px-2.5 py-1.5 text-xs outline-none ${isGroupView ? "bg-[#2B2D31] border-[#3F4147] text-white" : "bg-slate-50 text-slate-800"}`}
                  >
                    <option value="Impact">Impact (Meme)</option>
                    <option value="Arial">Arial</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Comic Sans MS">Comic Sans</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-black uppercase tracking-wider opacity-70">Posisi Teks</Label>
                  <select
                    value={studioPosition}
                    onChange={(e) => setStudioPosition(e.target.value as any)}
                    className={`w-full mt-1 border rounded-xl px-2.5 py-1.5 text-xs outline-none ${isGroupView ? "bg-[#2B2D31] border-[#3F4147] text-white" : "bg-slate-50 text-slate-800"}`}
                  >
                    <option value="top">Atas (Top)</option>
                    <option value="middle">Tengah (Middle)</option>
                    <option value="bottom">Bawah (Bottom)</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-black uppercase tracking-wider opacity-70">
                  <span>Ukuran Font</span>
                  <span>{studioFontSize}px</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={80}
                  value={studioFontSize}
                  onChange={(e) => setStudioFontSize(Number(e.target.value))}
                  className="w-full mt-1 accent-violet-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-black uppercase tracking-wider opacity-70">Warna Teks</Label>
                  <div className="flex gap-2 items-center mt-1">
                    <input
                      type="color"
                      value={studioTextColor}
                      onChange={(e) => setStudioTextColor(e.target.value)}
                      className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer"
                    />
                    <span className="text-[10px] font-mono opacity-80">{studioTextColor}</span>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-black uppercase tracking-wider opacity-70">Warna Outline</Label>
                  <div className="flex gap-2 items-center mt-1">
                    <input
                      type="color"
                      value={studioOutlineColor}
                      onChange={(e) => setStudioOutlineColor(e.target.value)}
                      className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer"
                    />
                    <span className="text-[10px] font-mono opacity-80">{studioOutlineColor}</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-black uppercase tracking-wider opacity-70">
                  <span>Tebal Outline</span>
                  <span>{studioOutlineWidth}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={studioOutlineWidth}
                  onChange={(e) => setStudioOutlineWidth(Number(e.target.value))}
                  className="w-full mt-1 accent-violet-600"
                />
              </div>
            </div>
          </div>

          <div className={`flex justify-end gap-2 pt-3 border-t ${isGroupView ? "border-[#3F4147]" : "border-slate-100"}`}>
            <Button
              variant="ghost"
              onClick={handleCloseStickerStudio}
              className={`rounded-xl text-xs font-bold ${isGroupView ? "hover:bg-[#2B2D31]" : ""}`}
            >
              Batal
            </Button>
            <Button
              onClick={handleStudioSubmit}
              disabled={studioSaving || !studioImage}
              className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold px-4"
            >
              {studioSaving ? "Membuat..." : "Simpan & Upload"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DELETE MESSAGE CONFIRM MODAL */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className={`max-w-sm rounded-2xl p-5 ${isGroupView ? "bg-[#1E1F22] border border-[#3F4147] text-white animate-in zoom-in-95 duration-200" : "bg-white border border-[#eae8f5] text-slate-900 animate-in zoom-in-95 duration-200"}`}>
          <DialogHeader>
            <DialogTitle className="text-md font-black uppercase tracking-wider">Hapus Pesan?</DialogTitle>
            <DialogDescription className={`text-xs ${isGroupView ? "text-slate-400" : "text-slate-500"}`}>
              Pilih cakupan penghapusan pesan ini. Tindakan ini tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <button
              onClick={() => setDeleteScope("me")}
              className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                deleteScope === "me"
                  ? "border-[#5865F2] bg-[#5865F2]/10"
                  : isGroupView ? "border-[#3F4147] hover:border-slate-500" : "border-slate-200 hover:border-slate-400"
              }`}
            >
              <div>
                <p className="text-xs font-bold">Hapus untuk Saya</p>
                <p className={`text-[10px] mt-0.5 ${isGroupView ? "text-slate-400" : "text-slate-500"}`}>
                  Pesan akan hilang dari chat Anda saja.
                </p>
              </div>
              <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${deleteScope === "me" ? "border-[#5865F2] bg-[#5865F2]" : "border-slate-400"}`}>
                {deleteScope === "me" && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
              </span>
            </button>

            {(messageToDeleteIsOwn || selectedConv?.ownerId === me?.id || myPerms?.permissions?.manageMessages) && (
              <button
                onClick={() => setDeleteScope("everyone")}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  deleteScope === "everyone"
                    ? "border-[#f43f5e] bg-[#f43f5e]/10"
                    : isGroupView ? "border-[#3F4147] hover:border-slate-500" : "border-slate-200 hover:border-slate-400"
                }`}
              >
                <div>
                  <p className="text-xs font-bold text-rose-500">Hapus untuk Semua Orang</p>
                  <p className={`text-[10px] mt-0.5 ${isGroupView ? "text-slate-400" : "text-slate-500"}`}>
                    Pesan akan terhapus untuk semua anggota grup.
                  </p>
                </div>
                <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${deleteScope === "everyone" ? "border-[#f43f5e] bg-[#f43f5e]" : "border-slate-400"}`}>
                  {deleteScope === "everyone" && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
              </button>
            )}
          </div>

          <div className={`flex justify-end gap-2 pt-3 border-t ${isGroupView ? "border-[#3F4147]" : "border-slate-100"}`}>
            <Button
              variant="ghost"
              onClick={() => { setDeleteModalOpen(false); setMessageToDeleteId(null); }}
              className={`rounded-xl text-xs font-bold ${isGroupView ? "hover:bg-[#2B2D31]" : ""}`}
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirmDelete}
              className={`rounded-xl text-xs font-bold px-4 ${deleteScope === "everyone" ? "bg-rose-600 hover:bg-rose-700 text-white" : "bg-slate-700 hover:bg-slate-800 text-white"}`}
            >
              Hapus
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* FORWARD MESSAGE MODAL */}
      <Dialog open={forwardModalOpen} onOpenChange={setForwardModalOpen}>
        <DialogContent className={`max-w-md rounded-2xl p-5 flex flex-col h-[80vh] max-h-[520px] ${isGroupView ? "bg-[#1E1F22] border border-[#3F4147] text-white animate-in zoom-in-95 duration-200" : "bg-white border border-[#eae8f5] text-slate-900 animate-in zoom-in-95 duration-200"}`}>
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-md font-black uppercase tracking-wider">Forward Pesan</DialogTitle>
            <DialogDescription className={`text-xs ${isGroupView ? "text-slate-400" : "text-slate-500"}`}>
              Pilih kontak atau grup untuk meneruskan pesan ini.
            </DialogDescription>
          </DialogHeader>

          {/* SEARCH INPUT */}
          <div className="my-2 shrink-0">
            <Input
              type="text"
              placeholder="Cari chat atau grup..."
              value={forwardSearch}
              onChange={(e) => setForwardSearch(e.target.value)}
              className={`text-xs ${isGroupView ? "bg-[#2B2D31] border-[#3F4147]" : "bg-slate-50"}`}
            />
          </div>

          {/* CONVERSATION LIST */}
          <ScrollArea className="flex-1 my-2 pr-1">
            <div className="space-y-1.5">
              {conversations &&
                conversations
                  .filter((c) => {
                    const cName = c.type === "dm" ? (c.otherDisplayName || c.otherUsername) : c.name;
                    return (cName || "").toLowerCase().includes(forwardSearch.toLowerCase());
                  })
                  .map((conv) => {
                    const cName = conv.type === "dm" ? (conv.otherDisplayName || conv.otherUsername) : conv.name;
                    const isSelected = forwardTargetConvId === conv.id;
                    return (
                      <button
                        key={conv.id}
                        type="button"
                        onClick={() => {
                          setForwardTargetConvId(conv.id);
                          setForwardTargetChannelId(null);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all border text-left cursor-pointer ${
                          isSelected
                            ? "border-[#5865F2] bg-[#5865F2]/10"
                            : isGroupView
                            ? "border-transparent bg-[#2B2D31] hover:bg-[#35373C] text-slate-200"
                            : "border-transparent bg-slate-50 hover:bg-slate-100 text-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar className="w-7 h-7 shrink-0">
                            <AvatarImage src={(conv.type === "dm" ? conv.otherAvatarUrl : conv.iconUrl) || undefined} />
                            <AvatarFallback className="text-[10px] font-bold">
                              {getInitials(cName || "?")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate text-[#DCDDDE]">{cName}</p>
                            <p className={`text-[9px] font-medium capitalize ${isGroupView ? "text-slate-400" : "text-slate-500"}`}>
                              {conv.type === "dm" ? "Chat Pribadi" : `Grup • ${conv.memberCount} Anggota`}
                            </p>
                          </div>
                        </div>
                        <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? "border-[#5865F2] bg-[#5865F2]" : "border-slate-400"}`}>
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </span>
                      </button>
                    );
                  })}
            </div>
          </ScrollArea>

          {/* CHANNEL SELECT FOR GROUPS */}
          {forwardTargetConvId && (() => {
            const selectedConversation = conversations?.find((c) => c.id === forwardTargetConvId);
            const isTargetGroup = selectedConversation?.type === "group";
            if (!isTargetGroup) return null;

            const textChannels = targetChannels?.filter((ch) => ch.type === "text" || ch.type === "announce" || ch.type === "forum") || [];

            return (
              <div className={`mt-2 p-3 rounded-xl border shrink-0 ${isGroupView ? "bg-[#2B2D31] border-[#3F4147]" : "bg-slate-50 border-slate-200"}`}>
                <Label className="text-[10px] font-black uppercase tracking-wider opacity-80 block mb-1.5">
                  Pilih Saluran (Channel)
                </Label>
                {textChannels.length === 0 ? (
                  <p className="text-[10px] text-amber-500 font-bold">Tidak ada channel teks.</p>
                ) : (
                  <select
                    value={forwardTargetChannelId || ""}
                    onChange={(e) => setForwardTargetChannelId(Number(e.target.value) || null)}
                    className={`w-full border rounded-xl px-2.5 py-1.5 text-xs outline-none ${isGroupView ? "bg-[#1E1F22] border-[#3F4147] text-white" : "bg-white text-slate-800"}`}
                  >
                    {textChannels.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        #{ch.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })()}

          {/* ACTION BUTTONS */}
          <div className={`flex justify-end gap-2 pt-3 border-t shrink-0 ${isGroupView ? "border-[#3F4147]" : "border-slate-100"}`}>
            <Button
              variant="ghost"
              onClick={() => { setForwardModalOpen(false); setMessageToForwardId(null); }}
              className={`rounded-xl text-xs font-bold ${isGroupView ? "hover:bg-[#2B2D31]" : ""}`}
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirmForward}
              disabled={forwarding || !forwardTargetConvId}
              className="bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-xl text-xs font-bold px-4"
            >
              {forwarding ? "Mengirim..." : "Forward"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* BUYER PRODUCT DETAIL DIALOG */}
      <Dialog open={selectedCatalogProduct !== null} onOpenChange={() => setSelectedCatalogProduct(null)}>
        <DialogContent className="bg-white border-[#eae8f5] max-w-lg rounded-2xl p-0 overflow-hidden text-slate-800">
          {selectedCatalogProduct && (
            <div className="flex flex-col">
              {/* Product Image */}
              <div className="relative w-full h-56 bg-slate-50 flex items-center justify-center border-b border-slate-100">
                {selectedCatalogProduct.imageUrl ? (
                  <img src={selectedCatalogProduct.imageUrl} alt={selectedCatalogProduct.name} className="w-full h-full object-cover" />
                ) : (
                  <ShoppingBag className="w-14 h-14 text-slate-300" />
                )}
                <button
                  onClick={() => setSelectedCatalogProduct(null)}
                  className="absolute top-4 right-4 w-7 h-7 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white border-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Product Info */}
              <div className="p-5 space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base font-black text-[#110e3d]">{selectedCatalogProduct.name}</h3>
                  <p className="text-lg font-black text-emerald-600">
                    {new Intl.NumberFormat("id-ID", {
                      style: "currency",
                      currency: "IDR",
                      maximumFractionDigits: 0
                    }).format(selectedCatalogProduct.price)}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Deskripsi Produk</span>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    {selectedCatalogProduct.description || "Tidak ada deskripsi produk."}
                  </p>
                </div>

                {/* Payment Instructions */}
                <div className="space-y-3.5 pt-2">
                  {(() => {
                    const activePurchase = myPurchases.find(
                      (p: any) => p.productId === selectedCatalogProduct.id && p.status !== "delivered"
                    );

                    return (
                      <>
                        {activePurchase && (
                          <div className={`rounded-xl p-3.5 border ${
                            activePurchase.status === "completed"
                              ? "bg-emerald-55 border-emerald-100 text-emerald-800"
                              : "bg-amber-55 border-amber-100 text-amber-800"
                          }`}>
                            <h4 className="text-xs font-black flex items-center gap-1.5">
                              {activePurchase.status === "completed" ? "🟢 Status: Pembayaran Sukses" : "🟡 Status: Menunggu Pembayaran"}
                            </h4>
                            <p className="text-[10px] font-bold mt-1 opacity-90 leading-normal">
                              {activePurchase.status === "completed"
                                ? "Pesanan Anda sedang diproses oleh seller. Silakan hubungi seller untuk pengiriman."
                                : "Pembelian Anda sedang diproses. Silakan selesaikan pembayaran di SayaBayar menggunakan tombol di bawah."}
                            </p>
                          </div>
                        )}

                        <div className="rounded-xl bg-violet-50 border border-violet-100 p-3.5 space-y-1.5">
                          <h4 className="text-xs font-black text-violet-800 flex items-center gap-1">
                            💳 Cara Pembelian
                          </h4>
                          <ol className="text-[10px] text-violet-700/80 font-bold list-decimal list-inside space-y-1 leading-normal">
                            <li>Klik tombol <b>Beli Sekarang</b> untuk diarahkan ke sayabayar.com.</li>
                            <li>Selesaikan pembayaran dengan deskripsi invoice yang terisi otomatis.</li>
                            <li>Ambil screenshot bukti transfer/pembayaran berhasil.</li>
                            <li>Kirim bukti tersebut di ruang obrolan ini kepada seller.</li>
                          </ol>
                        </div>

                        {activePurchase?.status === "completed" ? (
                          <Button
                            disabled
                            className="w-full rounded-xl bg-emerald-100/50 text-emerald-800 border border-emerald-200 font-black text-xs h-11 cursor-not-allowed"
                          >
                            Sudah Dibayar & Sedang Diproses
                          </Button>
                        ) : activePurchase?.status === "pending" ? (
                          <div className="flex flex-col gap-2 w-full">
                            <a
                              href={activePurchase.paymentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full flex items-center justify-center rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs h-11 shadow-lg shadow-amber-500/10 transition-colors"
                            >
                              Lanjutkan Pembayaran
                            </a>
                            <Button
                              onClick={() => handleSyncOrder(activePurchase.id)}
                              disabled={syncingOrderId === activePurchase.id}
                              className="w-full rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-black text-xs h-11 cursor-pointer"
                            >
                              {syncingOrderId === activePurchase.id ? "Memverifikasi..." : "Cek Status Pembayaran"}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            onClick={() => handleBuyProduct(selectedCatalogProduct.id)}
                            disabled={buyingProduct}
                            className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-black text-xs h-11 shadow-lg shadow-violet-500/10 transition-colors"
                          >
                            {buyingProduct ? "Membuat Invoice..." : "Beli Sekarang"}
                          </Button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* STICKER MANAGER MODAL */}
      <Dialog open={showStickerManager} onOpenChange={setShowStickerManager}>
        <DialogContent className={`max-w-md rounded-2xl p-5 flex flex-col h-[75vh] max-h-[500px] ${isGroupView ? "bg-[#1E1F22] border border-[#3F4147] text-white animate-in zoom-in-95 duration-200" : "bg-white border border-[#eae8f5] text-slate-900 animate-in zoom-in-95 duration-200"}`}>
          <DialogHeader className="shrink-0">
            <div className="flex justify-between items-center pr-6">
              <DialogTitle className="text-md font-black uppercase tracking-wider">Manage Stickers</DialogTitle>
              <Button
                type="button"
                onClick={() => {
                  setStickerStudioSource("manager");
                  setShowStickerManager(false);
                  setShowStickerStudio(true);
                }}
                className="h-7 px-3 text-[10px] font-black uppercase tracking-wider bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-xl cursor-pointer shrink-0"
              >
                + Buat Sticker
              </Button>
            </div>
            <DialogDescription className={`text-xs ${isGroupView ? "text-slate-400" : "text-slate-500"}`}>
              Daftar stiker yang telah dibuat untuk grup ini. Anda dapat mengedit nama atau menghapusnya.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 my-3 pr-1">
            {(() => {
              const localStickers = stickerLibrary?.stickers?.filter((s: any) => s.conversationId === selectedId) || [];
              if (localStickers.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <div className={`text-center text-xs font-semibold ${isGroupView ? "text-slate-500" : "text-slate-400"}`}>
                      Belum ada stiker lokal untuk grup ini.
                    </div>
                    <Button
                      type="button"
                      onClick={() => {
                        setStickerStudioSource("manager");
                        setShowStickerManager(false);
                        setShowStickerStudio(true);
                      }}
                      className="bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-xl text-xs font-bold px-4 py-2 cursor-pointer transition-all hover:scale-105"
                    >
                      Buat Stiker Pertama
                    </Button>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {localStickers.map((sticker: any) => (
                    <div
                      key={sticker.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border ${
                        isGroupView ? "bg-[#2B2D31] border-[#3F4147]" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center shrink-0 ${isGroupView ? "bg-[#1E1F22]" : "bg-white border"}`}>
                        <img src={sticker.assetUrl} alt={sticker.name} className="w-10 h-10 object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate text-[#DCDDDE]">{sticker.name}</p>
                        {sticker.editorConfig?.caption && (
                          <p className={`text-[10px] truncate ${isGroupView ? "text-slate-400" : "text-slate-500"}`}>
                            Caption: "{sticker.editorConfig.caption}"
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            const newName = window.prompt("Edit nama stiker:", sticker.name);
                            if (newName === null) return;
                            const trimmed = newName.trim();
                            if (!trimmed) return;
                            handleEditStickerName(sticker.id, trimmed);
                          }}
                          className={`h-8 w-8 rounded-full ${isGroupView ? "hover:bg-slate-800" : ""}`}
                          title="Edit nama"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#5865F2]" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (window.confirm(`Hapus stiker "${sticker.name}" dari grup ini?`)) {
                              handleDeleteSticker(sticker.id);
                            }
                          }}
                          className={`h-8 w-8 rounded-full text-rose-500 hover:text-rose-600 ${isGroupView ? "hover:bg-slate-800" : "hover:bg-rose-50"}`}
                          title="Hapus stiker"
                        >
                          <X className="w-3.5 h-3.5 text-rose-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </ScrollArea>

          <div className={`flex justify-end pt-3 border-t shrink-0 ${isGroupView ? "border-[#3F4147]" : "border-slate-100"}`}>
            <Button
              className="bg-[#6366f1] text-white hover:bg-violet-700 rounded-xl text-xs font-bold px-4 cursor-pointer"
              onClick={() => {
                setShowStickerManager(false);
                setShowEditGroup(true); // Open settings back up
              }}
            >
              Kembali
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* EMOJI MANAGER MODAL */}
      <Dialog open={showEmojiManager} onOpenChange={setShowEmojiManager}>
        <DialogContent className={`max-w-md rounded-2xl p-5 flex flex-col h-[75vh] max-h-[500px] ${isGroupView ? "bg-[#1E1F22] border border-[#3F4147] text-white animate-in zoom-in-95 duration-200" : "bg-white border border-[#eae8f5] text-slate-900 animate-in zoom-in-95 duration-200"}`}>
          <DialogHeader className="shrink-0">
            <div className="flex justify-between items-center pr-6">
              <DialogTitle className="text-md font-black uppercase tracking-wider">Manage Emojis</DialogTitle>
              <Button
                type="button"
                onClick={() => {
                  setShowEmojiManager(false);
                  setShowEmojiStudio(true);
                }}
                className="h-7 px-3 text-[10px] font-black uppercase tracking-wider bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-xl cursor-pointer shrink-0"
              >
                + Buat Emoji
              </Button>
            </div>
            <DialogDescription className={`text-xs ${isGroupView ? "text-slate-400" : "text-slate-500"}`}>
              Daftar emoji kustom untuk grup ini. Pembuat grup dapat mengubah nama shortcode atau menghapusnya.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 my-3 pr-1">
            {(() => {
              const localEmojis = emojiLibrary?.emojis?.filter((e: any) => e.conversationId === selectedId) || [];
              if (localEmojis.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <div className={`text-center text-xs font-semibold ${isGroupView ? "text-slate-500" : "text-slate-400"}`}>
                      Belum ada emoji kustom untuk grup ini.
                    </div>
                    <Button
                      type="button"
                      onClick={() => {
                        setShowEmojiManager(false);
                        setShowEmojiStudio(true);
                      }}
                      className="bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-xl text-xs font-bold px-4 py-2 cursor-pointer transition-all hover:scale-105"
                    >
                      Buat Emoji Pertama
                    </Button>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {localEmojis.map((emoji: any) => (
                    <div
                      key={emoji.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border ${
                        isGroupView ? "bg-[#2B2D31] border-[#3F4147]" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center shrink-0 ${isGroupView ? "bg-[#1E1F22]" : "bg-white border"}`}>
                        <img src={emoji.assetUrl} alt={emoji.name} className="w-8 h-8 object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate text-[#DCDDDE]">:{emoji.name}:</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            const newName = window.prompt("Edit nama emoji (hanya huruf/angka/underscore):", emoji.name);
                            if (newName === null) return;
                            const trimmed = newName.trim().replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
                            if (!trimmed) return;
                            handleEditEmojiName(emoji.id, trimmed);
                          }}
                          className={`h-8 w-8 rounded-full ${isGroupView ? "hover:bg-slate-800" : ""}`}
                          title="Edit nama"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#5865F2]" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (window.confirm(`Hapus emoji ":${emoji.name}:" dari grup ini?`)) {
                              handleDeleteEmoji(emoji.id);
                            }
                          }}
                          className={`h-8 w-8 rounded-full text-rose-500 hover:text-rose-600 ${isGroupView ? "hover:bg-slate-800" : "hover:bg-rose-50"}`}
                          title="Hapus emoji"
                        >
                          <X className="w-3.5 h-3.5 text-rose-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </ScrollArea>

          <div className={`flex justify-end pt-3 border-t shrink-0 ${isGroupView ? "border-[#3F4147]" : "border-slate-100"}`}>
            <Button
              className="bg-[#6366f1] text-white hover:bg-violet-700 rounded-xl text-xs font-bold px-4 cursor-pointer"
              onClick={() => {
                setShowEmojiManager(false);
                setShowEditGroup(true); // Open settings back up
              }}
            >
              Kembali
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* EMOJI STUDIO MODAL */}
      <Dialog open={showEmojiStudio} onOpenChange={(open) => {
        if (!open) {
          setShowEmojiStudio(false);
        }
      }}>
        <DialogContent className={`max-w-md rounded-2xl p-5 ${isGroupView ? "bg-[#1E1F22] border border-[#3F4147] text-white animate-in zoom-in-95 duration-200" : "bg-white border border-[#eae8f5] text-slate-900 animate-in zoom-in-95 duration-200"}`}>
          <DialogHeader>
            <DialogTitle className="text-md font-black uppercase tracking-wider">Emoji Studio</DialogTitle>
            <DialogDescription className={`text-xs ${isGroupView ? "text-slate-400" : "text-slate-500"}`}>
              Unggah gambar kustom untuk dijadikan emoji grup. Rekomendasi rasio gambar kotak (1:1), maksimal file 2MB.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-3">
            {/* PREVIEW CONTAINER */}
            <div className="flex flex-col items-center justify-center gap-3">
              <div className={`relative w-24 h-24 rounded-2xl border flex items-center justify-center overflow-hidden shadow-inner ${isGroupView ? "bg-[#2B2D31] border-[#3F4147]" : "bg-slate-50 border-slate-200"}`}>
                {emojiStudioPreview ? (
                  <img src={emojiStudioPreview} alt="Preview" className="w-16 h-16 object-contain" />
                ) : (
                  <span className={`text-[10px] font-bold text-center px-2 ${isGroupView ? "text-slate-500" : "text-slate-400"}`}>
                    Pilih Gambar
                  </span>
                )}
              </div>
            </div>

            {/* CONTROLS */}
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-black uppercase tracking-wider opacity-70">Pilih Gambar (Maks 2MB)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setEmojiStudioFile(file);
                      setEmojiStudioPreview(URL.createObjectURL(file));
                      const baseName = file.name.split(".")[0].replace(/[^a-zA-Z0-9_]/g, "").toLowerCase().slice(0, 40);
                      setEmojiStudioName(baseName);
                    }
                  }}
                  className={`mt-1 text-xs cursor-pointer ${isGroupView ? "bg-[#2B2D31] border-[#3F4147]" : "bg-slate-50"}`}
                />
              </div>

              <div>
                <Label className="text-xs font-black uppercase tracking-wider opacity-70">Nama Shortcode Emoji (Hanya huruf/angka/underscore)</Label>
                <div className="flex items-center mt-1">
                  <span className={`text-xs font-bold px-2 py-2.5 rounded-l-xl border-y border-l ${isGroupView ? "bg-[#1E1F22] border-[#3F4147] text-slate-400" : "bg-slate-100 border-slate-200 text-slate-500"}`}>
                    :
                  </span>
                  <Input
                    type="text"
                    maxLength={40}
                    placeholder="pepe"
                    value={emojiStudioName}
                    onChange={(e) => setEmojiStudioName(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())}
                    className={`text-xs rounded-l-none ${isGroupView ? "bg-[#2B2D31] border-[#3F4147]" : "bg-slate-50"}`}
                  />
                  <span className={`text-xs font-bold px-2 py-2.5 rounded-r-xl border-y border-r ${isGroupView ? "bg-[#1E1F22] border-[#3F4147] text-slate-400" : "bg-slate-100 border-slate-200 text-slate-500"}`}>
                    :
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className={`flex justify-end gap-3 pt-3 border-t ${isGroupView ? "border-[#3F4147]" : "border-slate-100"}`}>
            <Button
              variant="outline"
              onClick={() => {
                setShowEmojiStudio(false);
                setShowEmojiManager(true);
              }}
              className={`rounded-xl text-xs font-bold ${isGroupView ? "border-[#3F4147] text-[#DCDDDE] hover:bg-[#35373C]" : ""}`}
              disabled={uploadingEmoji}
            >
              Kembali
            </Button>
            <Button
              onClick={handleUploadEmoji}
              disabled={uploadingEmoji || !emojiStudioFile || !emojiStudioName.trim()}
              className="bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-xl text-xs font-bold px-4 cursor-pointer"
            >
              {uploadingEmoji ? "Mengunggah..." : "Upload Emoji"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Message Info Dialog */}
      <Dialog open={!!showMessageInfo} onOpenChange={(open) => { if (!open) setShowMessageInfo(null); }}>
        <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden bg-[#111b21] border border-[#222d34] text-white flex flex-col h-[80vh] max-h-[580px] gap-0 animate-in zoom-in-95 duration-200">
          {showMessageInfo && (() => {
            const msg = showMessageInfo;
            const isOwn = msg.senderId === me?.id;
            const conversation = conversations.find(c => c.id === msg.conversationId);
            const isGroup = conversation?.type === "group";
            
            // Get all other members in this conversation
            const otherMembers = members.filter((m: any) => m.id !== msg.senderId);
            
            const msgReadBy = (msg as any).readBy || [];
            const msgReadDetails = (msg as any).readDetails || [];
            
            const readMembers = otherMembers
              .filter((m: any) => msgReadBy.includes(m.id))
              .map((m: any) => {
                const detail = msgReadDetails.find((d: any) => d.userId === m.id);
                return {
                  ...m,
                  readTime: detail?.readAt ? format(new Date(detail.readAt), "HH:mm") : "Baru saja"
                };
              });
              
            const deliveredMembers = otherMembers
              .filter((m: any) => !msgReadBy.includes(m.id))
              .map((m: any) => {
                return {
                  ...m,
                  deliveredTime: format(new Date(msg.createdAt), "HH:mm")
                };
              });

            return (
              <>
                <DialogHeader className="px-5 py-4 flex flex-row items-center gap-3 shrink-0 border-b border-[#222d34] bg-[#202c33] space-y-0">
                  <button
                    type="button"
                    onClick={() => setShowMessageInfo(null)}
                    className="text-[#aebac1] hover:text-white transition-colors cursor-pointer border-0 bg-transparent p-1 -ml-1 rounded-full"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <DialogTitle className="text-base font-bold text-[#e9edef] select-none">Info pesan</DialogTitle>
                </DialogHeader>

                <div className="flex-1 flex flex-col min-h-0">
                  {/* Message Preview Bubble */}
                  <div 
                    className="p-6 flex bg-[#0b141a] relative overflow-hidden shrink-0 border-b border-[#222d34]/40"
                    style={{
                      backgroundImage: `url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')`,
                      backgroundSize: "cover",
                      backgroundBlendMode: "overlay",
                      backgroundColor: "#0b141a",
                      justifyContent: isOwn ? "flex-end" : "flex-start"
                    }}
                  >
                    <div 
                      className={`max-w-[85%] text-[#e9edef] rounded-xl px-3.5 py-2 shadow relative ${
                        isOwn 
                          ? "bg-[#005c4b] rounded-tr-none" 
                          : "bg-[#202c33] rounded-tl-none"
                      }`}
                    >
                      {msg.imageUrl && (
                        <img src={msg.imageUrl} alt="" className="rounded-lg max-h-40 object-cover mb-1.5" />
                      )}
                      {msg.content && <p className="text-sm whitespace-pre-wrap pr-12 break-all">{msg.content}</p>}
                      <div className="absolute bottom-1 right-2 flex items-center gap-1">
                        <span className="text-[9px] text-[#8696a0] font-medium">
                          {format(new Date(msg.createdAt), "HH:mm")}
                        </span>
                        <CheckCheck className={`w-3.5 h-3.5 ${isOwn && (msg as any).isRead ? "text-[#53bdeb]" : "text-[#8696a0]"}`} />
                      </div>
                    </div>
                  </div>

                  {/* Read / Delivered Status Lists */}
                  <div className="flex-1 overflow-y-auto bg-[#111b21] p-5 space-y-6">
                    {/* Read Section */}
                    {readMembers.length > 0 ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-[#53bdeb] font-bold text-xs uppercase tracking-wider border-b border-[#222d34] pb-2">
                          <CheckCheck className="w-4 h-4 text-[#53bdeb]" />
                          <span>Dibaca Oleh</span>
                        </div>
                        <div className="space-y-3">
                          {readMembers.map((m) => (
                            <div key={m.id} className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Avatar className="w-9 h-9 border border-[#222d34]">
                                  <AvatarImage src={m.avatarUrl ?? undefined} />
                                  <AvatarFallback className="text-[10px] bg-[#2a3942] text-[#d1d7db] font-bold">
                                    {getInitials(m.displayName ?? m.username)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-xs font-bold text-[#e9edef]">{m.displayName || m.username}</p>
                                  <p className="text-[10px] text-[#8696a0]">@{m.username}</p>
                                </div>
                              </div>
                              <span className="text-[10px] text-[#8696a0] font-medium">
                                {m.readTime}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-[#53bdeb] font-bold text-xs uppercase tracking-wider border-b border-[#222d34] pb-2">
                          <CheckCheck className="w-4 h-4 text-[#53bdeb]" />
                          <span>Dibaca Oleh</span>
                        </div>
                        <div className="text-center py-6 text-xs text-[#8696a0]">
                          Belum dibaca oleh siapa pun.
                        </div>
                      </div>
                    )}

                    {/* Delivered Section */}
                    {deliveredMembers.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-[#8696a0] font-bold text-xs uppercase tracking-wider border-b border-[#222d34] pb-2">
                          <CheckCheck className="w-4 h-4 text-[#8696a0]" />
                          <span>Terkirim Ke</span>
                        </div>
                        <div className="space-y-3">
                          {deliveredMembers.map((m) => (
                            <div key={m.id} className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Avatar className="w-9 h-9 border border-[#222d34]">
                                  <AvatarImage src={m.avatarUrl ?? undefined} />
                                  <AvatarFallback className="text-[10px] bg-[#2a3942] text-[#d1d7db] font-bold">
                                    {getInitials(m.displayName ?? m.username)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-xs font-bold text-[#e9edef]">{m.displayName || m.username}</p>
                                  <p className="text-[10px] text-[#8696a0]">@{m.username}</p>
                                </div>
                              </div>
                              <span className="text-[10px] text-[#8696a0] font-medium">
                                {m.deliveredTime}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {contextMenu && (() => {
        const menuWidth = 240;
        const menuHeight = 350;
        let left = contextMenu.x;
        let top = contextMenu.y;

        if (left + menuWidth > window.innerWidth) {
          left = window.innerWidth - menuWidth - 16;
        }
        if (top + menuHeight > window.innerHeight) {
          top = window.innerHeight - menuHeight - 16;
        }
        if (left < 16) left = 16;
        if (top < 16) top = 16;

        const msg = contextMenu.msg;
        const isOwn = contextMenu.isOwn;

        return (
          <div
            style={{ left: `${left}px`, top: `${top}px` }}
            className="fixed z-50 w-[240px] bg-[#233138] border border-[#374248] rounded-xl shadow-2xl flex flex-col overflow-hidden text-[#d1d7db] text-[13px] animate-in fade-in zoom-in-95 duration-100 select-none cursor-default font-sans"
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* Reactions Row */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#2f3b43]">
              <div className="flex items-center gap-1.5 w-full justify-around">
                {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      const userReacted = msg.reactions?.some((r) => r.emoji === emoji && r.userReacted) ?? false;
                      handleToggleReaction(msg.id, emoji, userReacted);
                      setContextMenu(null);
                    }}
                    className="hover:scale-130 transition-transform text-lg cursor-pointer p-0.5 active:scale-95 duration-75 text-white"
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  onClick={() => {
                    handleToggleReaction(msg.id, "🔥", msg.reactions?.some((r) => r.emoji === "🔥" && r.userReacted) ?? false);
                    setContextMenu(null);
                  }}
                  className="w-6 h-6 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors text-slate-400 hover:text-white cursor-pointer active:scale-95 text-xs font-bold"
                  title="More reactions"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Vertical Menu Items */}
            <div className="flex flex-col py-1">
              <button
                onClick={() => {
                  setShowMessageInfo(msg);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#182229] transition-colors text-left text-[#d1d7db] cursor-pointer"
              >
                <Info className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Info Pesan</span>
              </button>

              <button
                onClick={() => {
                  setReplyToMessage(msg);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#182229] transition-colors text-left text-[#d1d7db] cursor-pointer"
              >
                <CornerUpLeft className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Balas</span>
              </button>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(msg.content ?? "");
                  toast({ title: "Pesan disalin" });
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#182229] transition-colors text-left text-[#d1d7db] cursor-pointer"
              >
                <Copy className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Salin</span>
              </button>

              <button
                onClick={() => {
                  handleForwardMessage(msg.id);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#182229] transition-colors text-left text-[#d1d7db] cursor-pointer"
              >
                <Forward className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Teruskan</span>
              </button>

              <button
                onClick={() => {
                  handleTogglePin(msg);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#182229] transition-colors text-left text-[#d1d7db] cursor-pointer"
              >
                <Pin className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{msg.pinned ? "Lepas Sematan" : "Sematkan"}</span>
              </button>

              <button
                onClick={async () => {
                  const aiConv = conversations.find(
                    (c) => c.type === "dm" && (c.otherUsername === "zaidanai" || c.otherUsername === "zaidan_ai" || c.otherDisplayName?.toLowerCase().includes("zaidan ai"))
                  );
                  if (aiConv) {
                    setSelectedId(aiConv.id);
                    setSelectedChannelId(null);
                  } else {
                    const aiFriend = friends.find((f) => f.username === "zaidanai" || f.username === "zaidan_ai");
                    if (aiFriend) {
                      try {
                        const newConv = await createDm.mutateAsync({ data: { targetUserId: aiFriend.id } });
                        setSelectedId(newConv.id);
                        setSelectedChannelId(null);
                        await queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
                      } catch {
                        toast({ title: "Gagal memulai chat dengan Zaidan AI", variant: "destructive" });
                      }
                    } else {
                      toast({ title: "Zaidan AI tidak ditemukan di daftar teman", variant: "destructive" });
                    }
                  }

                  setMessageText((prev) => {
                    const quote = `"${msg.content || getMessagePreviewText(msg)}"\n\n`;
                    return quote + prev;
                  });
                  setContextMenu(null);
                  toast({ title: "Tanya Zaidan AI", description: "Navigasi langsung ke chat Zaidan AI & pesan dikutip" });
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#182229] transition-colors text-left text-[#d1d7db] cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Tanya Zaidan AI</span>
              </button>

              <button
                onClick={() => {
                  handleToggleStar(msg);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#182229] transition-colors text-left text-[#d1d7db] cursor-pointer"
              >
                <Star className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{msg.starred ? "Hapus Bintang" : "Bintangi"}</span>
              </button>

              <button
                onClick={() => {
                  toast({ title: "Seleksi Multi-Pesan", description: "Fitur seleksi multi-pesan sedang dikembangkan" });
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#182229] transition-colors text-left text-[#d1d7db] cursor-pointer"
              >
                <Check className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Pilih</span>
              </button>

              {(msg.senderId === me?.id || selectedConv?.ownerId === me?.id || myPerms?.permissions?.manageMessages) && (
                <button
                  onClick={() => {
                    handleDeleteMessage(msg.id, msg.senderId === me?.id);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-rose-950/20 hover:text-rose-400 transition-colors text-left text-rose-500 font-medium cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>Hapus</span>
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Create Status Dialog */}
      <Dialog open={showCreateStatus} onOpenChange={setShowCreateStatus}>
        <DialogContent className="max-w-md bg-[#1E1F22] border border-[#3F4147] rounded-2xl p-5 text-white">
          <DialogHeader>
            <DialogTitle className="text-sm font-black uppercase tracking-wider text-white">Buat Status Baru</DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Status terhapus otomatis setelah 24 jam. Sisa: {11 - (activeStories.find((u: any) => u.userId === me?.id)?.statuses?.length ?? 0)}/11
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 mb-4 mt-2">
            <Button
              size="sm"
              variant={createStatusType === "image" ? "default" : "outline"}
              onClick={() => setCreateStatusType("image")}
              className={`flex-1 rounded-xl text-xs font-bold ${createStatusType === "image" ? "bg-[#5865F2] hover:bg-[#4752C4]" : "border-[#3F4147] text-slate-300 hover:bg-[#2B2D31]"}`}
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" /> Gambar
            </Button>
            <Button
              size="sm"
              variant={createStatusType === "video" ? "default" : "outline"}
              onClick={() => setCreateStatusType("video")}
              className={`flex-1 rounded-xl text-xs font-bold ${createStatusType === "video" ? "bg-[#5865F2] hover:bg-[#4752C4]" : "border-[#3F4147] text-slate-300 hover:bg-[#2B2D31]"}`}
            >
              <Video className="w-3.5 h-3.5 mr-1.5" /> Video
            </Button>
            <Button
              size="sm"
              variant={createStatusType === "text" ? "default" : "outline"}
              onClick={() => setCreateStatusType("text")}
              className={`flex-1 rounded-xl text-xs font-bold ${createStatusType === "text" ? "bg-[#5865F2] hover:bg-[#4752C4]" : "border-[#3F4147] text-slate-300 hover:bg-[#2B2D31]"}`}
            >
              <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Teks
            </Button>
          </div>

          {createStatusType === "image" ? (
            <div className="space-y-4">
              <div className="border border-dashed border-[#4f545c] rounded-xl p-6 bg-[#2B2D31] flex flex-col items-center justify-center min-h-[180px]">
                {createStatusImage ? (
                  <div className="relative w-full max-h-[160px] rounded-lg overflow-hidden flex items-center justify-center bg-black">
                    <img src={createStatusImage} alt="Status Preview" className="max-h-[160px] object-contain" />
                    <button
                      type="button"
                      onClick={() => setCreateStatusImage(null)}
                      className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 w-6 h-6 rounded-full flex items-center justify-center text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Upload className="w-8 h-8 text-slate-400 mb-2" />
                    <span className="text-xs text-slate-300 font-bold mb-1">Unggah gambar status</span>
                    <span className="text-[10px] text-slate-500 mb-3">Maksimal file 10MB</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id="status-media-file-input"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadStatusMedia(file, "image");
                      }}
                    />
                    <Button
                      size="sm"
                      onClick={() => document.getElementById("status-media-file-input")?.click()}
                      disabled={uploadingStatusMedia}
                      className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold"
                    >
                      {uploadingStatusMedia ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                      Pilih File
                    </Button>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-300">Keterangan Gambar (Opsional)</Label>
                <Input
                  type="text"
                  placeholder="Tambahkan keterangan..."
                  value={createStatusCaption}
                  onChange={(e) => setCreateStatusCaption(e.target.value)}
                  className="bg-[#2B2D31] border-[#3F4147] text-xs rounded-xl mt-1.5 text-white"
                  maxLength={100}
                />
              </div>
            </div>
          ) : createStatusType === "video" ? (
            <div className="space-y-4">
              <div className="border border-dashed border-[#4f545c] rounded-xl p-6 bg-[#2B2D31] flex flex-col items-center justify-center min-h-[180px]">
                {createStatusVideo ? (
                  <div className="relative w-full max-h-[160px] rounded-lg overflow-hidden flex items-center justify-center bg-black">
                    <video src={createStatusVideo} className="max-h-[160px] object-contain" controls />
                    <button
                      type="button"
                      onClick={() => setCreateStatusVideo(null)}
                      className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 w-6 h-6 rounded-full flex items-center justify-center text-white z-10"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Video className="w-8 h-8 text-slate-400 mb-2" />
                    <span className="text-xs text-slate-300 font-bold mb-1">Unggah video status</span>
                    <span className="text-[10px] text-slate-500 mb-3">Maksimal file 100MB</span>
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      id="status-video-file-input"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadStatusMedia(file, "video");
                      }}
                    />
                    <Button
                      size="sm"
                      onClick={() => document.getElementById("status-video-file-input")?.click()}
                      disabled={uploadingStatusMedia}
                      className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold"
                    >
                      {uploadingStatusMedia ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                      Pilih Video
                    </Button>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-300">Keterangan Video (Opsional)</Label>
                <Input
                  type="text"
                  placeholder="Tambahkan keterangan..."
                  value={createStatusCaption}
                  onChange={(e) => setCreateStatusCaption(e.target.value)}
                  className="bg-[#2B2D31] border-[#3F4147] text-xs rounded-xl mt-1.5 text-white"
                  maxLength={100}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Text Preview with background selection */}
              <div className={`rounded-xl p-6 min-h-[180px] flex items-center justify-center text-center select-none shadow-inner border border-white/5 transition-all ${createStatusBg}`}>
                <textarea
                  placeholder="Ketik sesuatu..."
                  value={createStatusCaption}
                  onChange={(e) => setCreateStatusCaption(e.target.value)}
                  className={`w-full bg-transparent border-0 outline-none focus:ring-0 resize-none text-center text-sm font-bold placeholder:opacity-50 ${createStatusTextColor}`}
                  maxLength={150}
                  rows={4}
                />
              </div>

              {/* Background Options */}
              <div>
                <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Pilih Latar Belakang</Label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    "bg-slate-900",
                    "bg-gradient-to-tr from-purple-900 to-indigo-900",
                    "bg-gradient-to-tr from-rose-700 via-pink-600 to-amber-500",
                    "bg-gradient-to-tr from-blue-600 to-cyan-500",
                    "bg-gradient-to-tr from-emerald-600 to-teal-500",
                    "bg-black",
                  ].map((bg) => (
                    <button
                      key={bg}
                      type="button"
                      onClick={() => setCreateStatusBg(bg)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${bg} ${createStatusBg === bg ? "border-white scale-110" : "border-[#3F4147] hover:scale-105"}`}
                    />
                  ))}
                </div>
              </div>

              {/* Text Color Options */}
              <div>
                <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Pilih Warna Teks</Label>
                <div className="flex gap-2">
                  {[
                    { class: "text-white", bg: "bg-white" },
                    { class: "text-amber-300", bg: "bg-amber-300" },
                    { class: "text-cyan-200", bg: "bg-cyan-200" },
                    { class: "text-fuchsia-200", bg: "bg-fuchsia-200" },
                  ].map((color) => (
                    <button
                      key={color.class}
                      type="button"
                      onClick={() => setCreateStatusTextColor(color.class)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${color.bg} ${createStatusTextColor === color.class ? "border-white scale-110" : "border-[#3F4147] hover:scale-105"}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-[#3F4147] mt-5">
            <Button
              variant="outline"
              onClick={() => { setShowCreateStatus(false); setCreateStatusVideo(null); }}
              className="rounded-xl border-[#3F4147] text-slate-300 hover:bg-[#2B2D31] text-xs font-bold"
              disabled={statusSubmitting}
            >
              Batal
            </Button>
            <Button
              onClick={handleCreateStatusSubmit}
              disabled={
                statusSubmitting || uploadingStatusMedia ||
                (createStatusType === "image" ? !createStatusImage
                  : createStatusType === "video" ? !createStatusVideo
                  : !createStatusCaption.trim())
              }
              className="bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-xl text-xs font-bold px-4 cursor-pointer"
            >
              {statusSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              Posting Status
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Immersive Status Viewer Overlay Dialog */}
      {activeUserStories && activeStory && (
        <Dialog open={activeStoriesUserIndex !== null} onOpenChange={(open) => { if (!open) closeStatusViewer(); }}>
          <DialogContent className="max-w-md h-[90vh] md:h-[750px] bg-black border-0 p-0 text-white flex flex-col justify-between overflow-hidden outline-none rounded-none md:rounded-3xl shadow-2xl select-none animate-in fade-in duration-200">
            {/* Top Navigation Progress Indicators */}
            <div className="absolute top-3 left-0 right-0 z-30 px-3 flex gap-1">
              {activeUserStories.statuses.map((s: any, idx: number) => {
                let fillWidth = "0%";
                if (idx < activeStoriesIndex) fillWidth = "100%";
                else if (idx === activeStoriesIndex) fillWidth = `${viewerProgress}%`;

                return (
                  <div key={s.id} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-white transition-all duration-50 ease-linear rounded-full" 
                      style={{ width: fillWidth }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Viewer Header Information */}
            <div className="absolute top-7 left-0 right-0 z-30 px-3 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent pt-1 pb-4">
              <div className="flex items-center gap-2">
                <Avatar className="w-8 h-8 border border-white/20">
                  <AvatarImage src={activeUserStories.avatarUrl || undefined} />
                  <AvatarFallback className="text-[10px] font-bold bg-[#35373c] text-white">
                    {activeUserStories.displayName?.substring(0, 2).toUpperCase() || activeUserStories.username?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white shadow-sm leading-tight">
                    {activeUserStories.displayName || activeUserStories.username}
                  </span>
                  <span className="text-[9px] text-white/70 leading-none">
                    {formatDistanceToNowHelper(new Date(activeStory.createdAt))}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {activeUserStories.userId === me?.id && (
                  <button
                    type="button"
                    onClick={() => handleDeleteStatus(activeStory.id)}
                    className="p-1.5 hover:bg-white/15 rounded-full text-rose-400 transition-colors cursor-pointer"
                    title="Hapus status ini"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                
                {viewerPlaying ? (
                  <button 
                    type="button"
                    onClick={() => setViewerPlaying(false)}
                    className="p-1.5 hover:bg-white/15 rounded-full text-white transition-colors cursor-pointer"
                  >
                    <Pause className="w-4 h-4" />
                  </button>
                ) : (
                  <button 
                    type="button"
                    onClick={() => setViewerPlaying(true)}
                    className="p-1.5 hover:bg-white/15 rounded-full text-white transition-colors cursor-pointer"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={closeStatusViewer}
                  className="p-1.5 hover:bg-white/15 rounded-full text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Immersive Left/Right Navigation Areas (Invisible overlay triggers) */}
            <div className="absolute inset-0 z-20 flex">
              <button 
                type="button"
                className="w-1/3 h-full cursor-pointer outline-none focus:outline-none" 
                onClick={handlePrevSlide}
                aria-label="Previous story"
              />
              <button 
                type="button"
                className="w-1/3 h-full cursor-pointer outline-none focus:outline-none" 
                onMouseDown={() => setViewerPlaying(false)}
                onMouseUp={() => setViewerPlaying(true)}
                onTouchStart={() => setViewerPlaying(false)}
                onTouchEnd={() => setViewerPlaying(true)}
                aria-label="Hold to pause"
              />
              <button 
                type="button"
                className="w-1/3 h-full cursor-pointer outline-none focus:outline-none" 
                onClick={handleNextSlide}
                aria-label="Next story"
              />
            </div>

            {/* Left and Right Chevron Arrows (Desktop Only) */}
            <div className="absolute inset-y-0 left-2 z-30 flex items-center pointer-events-none opacity-0 hover:opacity-100 transition-opacity">
              <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); handlePrevSlide(); }}
                className="p-2 bg-black/40 hover:bg-black/60 rounded-full text-white pointer-events-auto cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
            <div className="absolute inset-y-0 right-2 z-30 flex items-center pointer-events-none opacity-0 hover:opacity-100 transition-opacity">
              <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); handleNextSlide(); }}
                className="p-2 bg-black/40 hover:bg-black/60 rounded-full text-white pointer-events-auto cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Main Immersive Slide Viewport */}
            <div className="flex-1 w-full h-full flex items-center justify-center relative bg-black">
              {activeStory.type === "image" ? (
                <div className="w-full h-full flex flex-col justify-center items-center relative">
                  <img
                    src={activeStory.mediaUrl}
                    alt="Status media"
                    className="w-full h-full object-contain max-h-[90%]"
                  />
                  {activeStory.caption && (
                    <div className="absolute bottom-6 left-4 right-4 bg-black/65 backdrop-blur px-4 py-3 rounded-2xl text-center z-10 border border-white/5 shadow-lg max-h-[120px] overflow-y-auto">
                      <p className="text-sm font-semibold text-white leading-relaxed">{activeStory.caption}</p>
                    </div>
                  )}
                </div>
              ) : activeStory.type === "video" ? (
                <div className="w-full h-full flex flex-col justify-center items-center relative">
                  <video
                    key={activeStory.mediaUrl}
                    ref={storyVideoRef}
                    src={activeStory.mediaUrl}
                    className="w-full h-full object-contain max-h-[90%]"
                    autoPlay
                    playsInline
                    onTimeUpdate={(e) => {
                      const vid = e.currentTarget;
                      if (vid.duration) {
                        setViewerProgress((vid.currentTime / vid.duration) * 100);
                      }
                    }}
                    onEnded={() => {
                      setViewerProgress(100);
                      handleNextSlide();
                    }}
                  />
                  {activeStory.caption && (
                    <div className="absolute bottom-6 left-4 right-4 bg-black/65 backdrop-blur px-4 py-3 rounded-2xl text-center z-10 border border-white/5 shadow-lg max-h-[120px] overflow-y-auto">
                      <p className="text-sm font-semibold text-white leading-relaxed">{activeStory.caption}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className={`w-full h-full flex items-center justify-center px-8 text-center select-text ${activeStory.backgroundColor || "bg-slate-900"}`}>
                  <p className={`text-lg md:text-xl font-extrabold leading-relaxed drop-shadow-md break-words max-w-[90%] whitespace-pre-wrap ${activeStory.textColor || "text-white"}`}>
                    {activeStory.caption}
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
