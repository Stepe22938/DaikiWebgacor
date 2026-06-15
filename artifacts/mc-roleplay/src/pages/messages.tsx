import { useState, useRef, useEffect, useMemo } from "react";
import {
  useListConversations,
  getListConversationsQueryOptions,
  useCreateOrGetDm,
  useCreateGroup,
  useDeleteConversation,
  useListMessages,
  getListMessagesQueryOptions,
  useSendMessage,
  useDeleteMessage,
  useListConversationMembers,
  getListConversationMembersQueryOptions,
  useAddConversationMember,
  useRemoveConversationMember,
  useGetMyFriends,
  useGetMe,
  customFetch,
} from "@workspace/api-client-react";
import type { ConversationSummary, Message } from "@workspace/api-client-react";
import { useClerk } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Link } from "wouter";
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
  ArrowUpRight,
  MessageSquare,
  Users,
  Home,
  Camera,
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
} from "lucide-react";

const JITSI_BASE = "https://jitsi.sixtopia.net/arcadia-studio-conv-";

interface Channel {
  id: number;
  conversationId: number;
  categoryId: number | null;
  name: string;
  type: "text" | "voice";
  position: number;
  createdAt: string;
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
};

const ROLE_BADGE_CLASSES: Record<string, string> = {
  member: "bg-slate-50 text-slate-500 border border-slate-200/50",
  admin: "bg-violet-50 text-[#6366f1] border border-violet-100",
  staff: "bg-sky-50 text-sky-600 border border-sky-100",
  dev: "bg-emerald-50 text-emerald-600 border border-emerald-100",
  dev_website: "bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-100",
  ai: "bg-blue-50 text-[#2563eb] border border-blue-100 font-extrabold tracking-wide",
};

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

  useEffect(() => {
    const scriptId = "jitsi-external-api-script";
    const targetSrc = "https://jitsi.sixtopia.net/external_api.js";
    let script = document.getElementById(scriptId) as HTMLScriptElement;
    let timer: any = null;
    let handleLoad: (() => void) | null = null;

    if (script && script.src !== targetSrc) {
      script.remove();
      script = null as any;
      if ((window as any).JitsiMeetExternalAPI) {
        delete (window as any).JitsiMeetExternalAPI;
      }
    }

    const initJitsi = () => {
      if (!containerRef.current) return;
      
      if (apiRef.current) {
        apiRef.current.dispose();
      }

      try {
        const domain = "jitsi.sixtopia.net";
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
          },
          userInfo: {
            displayName,
            ...(avatarUrl && { avatarUrl }),
          },
        };

        apiRef.current = new (window as any).JitsiMeetExternalAPI(domain, options);
        
        apiRef.current.addEventListener("videoConferenceJoined", () => {
          setLoading(false);
        });

        apiRef.current.addEventListener("videoConferenceLeft", () => {
          if (onClose) onClose();
        });

        apiRef.current.addEventListener("readyToClose", () => {
          if (onClose) onClose();
        });

        // Fail-safe to hide loading spinner after 5 seconds
        timer = setTimeout(() => {
          setLoading(false);
        }, 5000);
      } catch (err) {
        console.error("Failed to load Jitsi API:", err);
        setLoading(false);
      }
    };

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = targetSrc;
      script.async = true;
      script.onload = () => {
        initJitsi();
      };
      document.body.appendChild(script);
    } else {
      if ((window as any).JitsiMeetExternalAPI) {
        initJitsi();
      } else {
        handleLoad = () => {
          initJitsi();
        };
        script.addEventListener("load", handleLoad);
      }
    }

    return () => {
      if (apiRef.current) {
        apiRef.current.dispose();
        apiRef.current = null;
      }
      if (script && handleLoad) {
        script.removeEventListener("load", handleLoad);
      }
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [roomName, displayName, avatarUrl, audioOnly]);

  return (
    <div className="relative flex-1 w-full min-h-[450px] flex flex-col bg-white overflow-hidden rounded-xl">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white gap-4 z-10">
          <div className="w-12 h-12 rounded-full border-4 border-violet-100 border-t-[#6366f1] animate-spin" />
          <div className="text-center space-y-1">
            <p className="text-sm font-extrabold text-[#110e3d]">Connecting to Voice Channel...</p>
            <p className="text-xs text-slate-400 font-bold animate-pulse">Syncing profiles & data...</p>
          </div>
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

function ConvItem({
  conv,
  selected,
  onClick,
  dark = false,
}: {
  conv: ConversationSummary;
  selected: boolean;
  onClick: () => void;
  dark?: boolean;
}) {
  const name =
    conv.type === "dm"
      ? (conv.otherDisplayName ?? conv.otherUsername ?? "Unknown")
      : (conv.name ?? "Group");
  const avatar = conv.type === "dm" ? conv.otherAvatarUrl : conv.iconUrl;

  return (
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
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`font-bold text-xs truncate ${selected ? dark ? "text-white" : "text-[#6366f1]" : dark ? "text-[#DCDDDE]" : "text-[#110e3d]"}`}>{name}</span>
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
          <p className={`text-[10px] font-bold truncate mt-0.5 ${dark ? "text-[#949BA4]" : "text-slate-400"}`}>{conv.lastMessageContent}</p>
        )}
      </div>
    </button>
  );
}

function MessageBubble({
  msg,
  isOwn,
  onDelete,
  isGroup = false,
}: {
  msg: Message;
  isOwn: boolean;
  onDelete?: () => void;
  isGroup?: boolean;
}) {
  const name = msg.senderDisplayName ?? msg.senderUsername ?? "Unknown";
  const [isZoomed, setIsZoomed] = useState(false);

  return (
    <>
      <div className={`flex items-start gap-2 group ${isOwn ? "flex-row-reverse" : ""}`}>
        {!isOwn && (
        <div className={`rounded-full shrink-0 flex items-center justify-center p-0.5 overflow-visible mt-0.5 ${(msg as any).senderEquippedBorder ? (msg as any).senderEquippedBorder : isGroup ? "border border-[#3F4147]" : "border border-[#d7e4de]"}`}>
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarImage src={msg.senderAvatarUrl ?? undefined} />
            <AvatarFallback className={`text-[10px] font-bold ${isGroup ? "bg-[#2B2D31] text-[#DCDDDE]" : "bg-[#edf5f1] text-[#0b6b58]"}`}>{getInitials(name)}</AvatarFallback>
          </Avatar>
        </div>
        )}
        <div
          className={`max-w-[88%] sm:max-w-[72%] flex flex-col gap-1 ${isOwn ? "items-end" : "items-start"}`}
        >
          <div className={`flex items-center gap-2 px-1 ${isOwn ? "flex-row-reverse" : ""}`}>
            {(!isOwn || (msg.senderRole && msg.senderRole !== "member")) && (
              <div className={`flex items-center gap-1.5 ${isOwn ? "flex-row-reverse" : ""}`}>
                {!isOwn && <span className={`text-[11px] font-extrabold ${isGroup ? "text-[#DCDDDE]" : "text-[#075e54]"}`}>{name}</span>}
                {msg.senderRole && msg.senderRole !== "member" && (
                  <Badge className={`text-[8px] px-1.5 py-0 h-3.5 leading-none shrink-0 font-medium rounded ${ROLE_BADGE_CLASSES[msg.senderRole] ?? ""}`}>
                    {ROLE_LABELS[msg.senderRole] ?? msg.senderRole}
                  </Badge>
                )}
              </div>
            )}
            {isOwn && onDelete && (
              <button
                onClick={onDelete}
                className="text-[10px] font-bold text-slate-400 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                delete
              </button>
            )}
          </div>
          <div
            className={`relative rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed shadow-sm break-words whitespace-pre-wrap ${
              isOwn
                ? isGroup ? "bg-[#5865F2] text-white rounded-tr-[4px]" : "bg-[#dcf8c6] text-[#18251f] rounded-tr-[4px]"
                : isGroup ? "bg-[#2B2D31] text-[#DCDDDE] rounded-tl-[4px]" : "bg-white border border-[#dfe8e3] text-[#18251f] rounded-tl-[4px]"
            }`}
          >
            {msg.imageUrl && (
              <div 
                className="mb-2 max-w-sm rounded-lg overflow-hidden cursor-zoom-in hover:brightness-95 transition-all duration-200"
                onClick={() => setIsZoomed(true)}
              >
                <img
                  src={msg.imageUrl}
                  alt="Chat attachment"
                  className="w-full h-auto object-cover max-h-64 rounded-md border border-black/5"
                />
              </div>
            )}
            {msg.content && <span className="pr-12 inline-block">{msg.content}</span>}
            <span className={`absolute bottom-1.5 right-3 text-[10px] font-semibold ${isGroup ? "text-[#949BA4]" : "text-[#66756f]"}`}>
              {format(new Date(msg.createdAt), "HH:mm")}
            </span>
          </div>
        </div>
      </div>

      <Dialog open={isZoomed} onOpenChange={setIsZoomed}>
        <DialogContent className="max-w-4xl p-1 bg-transparent border-0 shadow-none flex items-center justify-center">
          <div className="relative max-h-[90vh] max-w-full overflow-hidden rounded-lg">
            <img
              src={msg.imageUrl ?? undefined}
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
  const { data: me } = useGetMe();
  const { data: realmSettings = {} } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: () => customFetch<any>("/api/settings"),
  });
  const { signOut } = useClerk();
  const realmName = realmSettings.realmName || "Arcadia Guild";
  const realmLogoUrl = realmSettings.realmLogoUrl || "";

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState<"text" | "voice">("text");
  const [newChannelCategoryId, setNewChannelCategoryId] = useState<number | null>(null);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
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
  });
  const [messageText, setMessageText] = useState("");
  const [showNewDm, setShowNewDm] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showCall, setShowCall] = useState(false);
  const [callType, setCallType] = useState<"voice" | "video" | null>(null);
  const [showAkiraCall, setShowAkiraCall] = useState(false);
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupDesc, setEditGroupDesc] = useState("");
  const [editGroupIcon, setEditGroupIcon] = useState("");
  const [editGroupSaving, setEditGroupSaving] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState<number[]>([]);
  const [dmSearch, setDmSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");

  const [uploading, setUploading] = useState(false);
  const [attachedImageUrl, setAttachedImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
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

  const { data: conversations = [], isLoading: convsLoading } = useListConversations({
    query: { ...getListConversationsQueryOptions(), refetchInterval: 5000 },
  });

  const selectedConv = conversations.find((c) => c.id === selectedId) ?? null;
  const isGroup = selectedConv?.type === "group";

  const { data: messages = [], isLoading: msgsLoading } = useListMessages(selectedId ?? 0, {
    query: {
      ...getListMessagesQueryOptions(selectedId ?? 0),
      enabled: selectedId !== null && !isGroup,
      refetchInterval: 2000,
    },
  });

  // Channel-scoped messages for groups
  const { data: channelMessages = [], isLoading: channelMsgsLoading } = useQuery<Message[]>({
    queryKey: ["channel-messages", selectedId, selectedChannelId],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${selectedId}/channels/${selectedChannelId}/messages`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isGroup && selectedId !== null && selectedChannelId !== null,
    refetchInterval: 2000,
  });

  // Use channel messages for groups, regular messages for DMs
  const activeMessages = isGroup ? channelMessages : messages;
  const activeMsgsLoading = isGroup ? channelMsgsLoading : msgsLoading;

  const { data: friends = [] } = useGetMyFriends();

  const { data: members = [] } = useListConversationMembers(selectedId ?? 0, {
    query: {
      ...getListConversationMembersQueryOptions(selectedId ?? 0),
      enabled: selectedId !== null,
    },
  });

  // Fetch channels for the selected group
  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ["channels", selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${selectedId}/channels`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: selectedId !== null,
    refetchInterval: 5000,
  });

  // Fetch categories for the selected group
  const { data: categories = [] } = useQuery<ChannelCategory[]>({
    queryKey: ["channel-categories", selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${selectedId}/categories`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: selectedId !== null,
    refetchInterval: 5000,
  });

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

  const createDm = useCreateOrGetDm();
  const createGroup = useCreateGroup();
  const deleteConv = useDeleteConversation();
  const sendMessage = useSendMessage();
  const deleteMessage = useDeleteMessage();
  const addMember = useAddConversationMember();
  const removeMember = useRemoveConversationMember();

  const selectedChannel = channels.find((c) => c.id === selectedChannelId) ?? null;

  // Auto-select first text channel when group is selected
  useEffect(() => {
    if (isGroup && channels.length > 0 && !selectedChannelId) {
      const firstText = channels.find((c) => c.type === "text");
      if (firstText) setSelectedChannelId(firstText.id);
    }
    if (!isGroup) setSelectedChannelId(null);
  }, [isGroup, channels, selectedChannelId]);

  // Hide typing indicator when AI responds (new message count increases while typing)
  useEffect(() => {
    if (aiTyping && activeMessages.length > prevMsgCountRef.current) {
      const lastMsg = activeMessages[activeMessages.length - 1];
      if (lastMsg && lastMsg.senderRole === "ai") {
        setAiTyping(false);
      }
    }
    prevMsgCountRef.current = activeMessages.length;
  }, [activeMessages, aiTyping]);

  // Auto-clear typing after 30s (safety timeout)
  useEffect(() => {
    if (aiTyping) {
      const timer = setTimeout(() => setAiTyping(false), 30000);
      return () => clearTimeout(timer);
    }
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

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Error", description: "Only image files are allowed.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          "x-file-name": file.name,
        },
        body: file,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "Upload failed");
        let errMsg = "Upload failed";
        try {
          errMsg = JSON.parse(text).error || errMsg;
        } catch {}
        throw new Error(errMsg);
      }
      const data = await response.json();
      setAttachedImageUrl(data.url);
      toast({ title: "Success", description: "Image uploaded successfully." });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to upload image. Please try again.";
      toast({ title: "Error", description: errMsg, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  // === MENTION AUTOCOMPLETE ===
  const mentionMembers = useMemo(() => {
    const filter = mentionFilter.toLowerCase();
    const items = [
      { userId: 0, username: "all", displayName: "All Members", avatarUrl: null as string | null | undefined },
      ...members,
    ];
    if (!filter) return items.slice(0, 8);
    return items.filter((m) =>
      m.username.toLowerCase().includes(filter) ||
      (m.displayName ?? "").toLowerCase().includes(filter)
    ).slice(0, 8);
  }, [members, mentionFilter]);

  function insertMention(member: { username: string; displayName?: string | null }) {
    if (mentionStart < 0) return;
    const before = messageText.slice(0, mentionStart);
    const after = messageText.slice(mentionStart + mentionFilter.length + 1); // +1 for @
    const mention = `@${member.username} `;
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

  async function handleSend() {
    const text = messageText.trim();
    if (!text && !attachedImageUrl) return;
    if (selectedId === null) return;
    try {
      const payload: { content?: string; imageUrl?: string } = {};
      if (text) payload.content = text;
      if (attachedImageUrl) payload.imageUrl = attachedImageUrl;

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
      setMessageText("");
      setAttachedImageUrl(null);

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
    } catch {
      toast({ title: "Failed to send message", variant: "destructive" });
    }
  }

  async function handleDeleteMessage(messageId: number) {
    if (!selectedId) return;
    try {
      await deleteMessage.mutateAsync({ id: selectedId, messageId });
      await queryClient.invalidateQueries({ queryKey: [`/api/conversations/${selectedId}/messages`] });
    } catch {
      toast({ title: "Failed to delete message", variant: "destructive" });
    }
  }

  async function handleStartDm(targetUserId: number) {
    try {
      const conv = await createDm.mutateAsync({ data: { targetUserId } });
      setSelectedId(conv.id);
      setShowNewDm(false);
      setDmSearch("");
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
    setEditGroupDesc((selectedConv as any).description || "");
    setEditGroupIcon(selectedConv.iconUrl || "");
    setShowEditGroup(true);
  }

  async function handleSaveGroup() {
    if (!selectedId) return;
    setEditGroupSaving(true);
    try {
      const res = await fetch(`/api/conversations/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editGroupName.trim() || undefined,
          description: editGroupDesc.trim() || null,
          iconUrl: editGroupIcon.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Group updated!" });
      setShowEditGroup(false);
      await queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    } catch {
      toast({ title: "Failed to update group", variant: "destructive" });
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

  const isGroupView = isGroup;

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
          {/* Chat Sidebar: Conversations List */}
          <div className={`${selectedConv ? "hidden md:flex" : "flex"} w-full md:w-80 border-r border-[#3F4147] bg-[#1E1F22] flex-col shrink-0 min-h-0`}>
            {/* Header + Create Dm/Group buttons */}
            <div className="p-3 sm:p-4 border-b border-[#3F4147] flex items-center justify-between shrink-0">
              <h2 className="font-extrabold text-lg md:text-sm text-white">Chats</h2>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 rounded-full text-xs font-bold transition-all border-[#3F4147] text-[#DCDDDE] hover:bg-[#35373C] hover:text-white"
                  onClick={() => setShowNewDm(true)}
                >
                  + DM
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 rounded-full text-xs font-bold transition-all border-[#3F4147] text-[#DCDDDE] hover:bg-[#35373C] hover:text-white"
                  onClick={() => setShowNewGroup(true)}
                >
                  + Group
                </Button>
              </div>
            </div>
            
            {/* Scrollable list of chats */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-2 space-y-1">
                {convsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                      <Skeleton className="w-9 h-9 rounded-xl" />
                      <div className="flex-1">
                        <Skeleton className="h-3 w-28 mb-1" />
                        <Skeleton className="h-2.5 w-20" />
                      </div>
                    </div>
                  ))
                ) : conversations.length === 0 ? (
                  <div className="text-center text-xs py-12 font-bold px-4 leading-relaxed text-[#949BA4]">
                    No conversations yet.<br />
                    Start a DM with a friend!
                  </div>
                ) : (
                  conversations.map((c) => (
                    <ConvItem
                      key={c.id}
                      conv={c}
                      selected={selectedId === c.id}
                      dark
                      onClick={() => setSelectedId(c.id)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Channel Sidebar (Groups only - Discord style) */}
          {isGroup && selectedConv && (
            <div className={`hidden md:flex w-56 bg-[#2B2D31] border-r border-[#1E1F22] flex-col shrink-0 min-h-0`}>
              {/* Channel header */}
              <div className="p-3 border-b border-[#1E1F22] flex items-center justify-between shrink-0">
                <h3 className="font-extrabold text-xs text-[#DCDDDE] uppercase tracking-wider">Channels</h3>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowCreateCategory(true)}
                    className="text-[#949BA4] hover:text-white transition-colors cursor-pointer"
                    title="Create Category"
                  >
                    <FolderPlus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { setNewChannelCategoryId(categories[0]?.id ?? null); setShowCreateChannel(true); }}
                    className="text-[#949BA4] hover:text-white transition-colors cursor-pointer"
                    title="Create Channel"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {/* Channel list grouped by category */}
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-2 space-y-3">
                  {categories.length === 0 ? (
                    <>
                      {channels.filter(c => c.type === "text" && !c.categoryId).map((ch) => (
                        <button key={ch.id} onClick={() => setSelectedChannelId(ch.id)}
                          className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                            selectedChannelId === ch.id ? "bg-[#404249] text-white" : "text-[#949BA4] hover:text-[#DCDDDE] hover:bg-[#35373C]"
                          }`}>
                          <Hash className="w-4 h-4 shrink-0 opacity-70" />
                          <span className="truncate">{ch.name}</span>
                        </button>
                      ))}
                      {channels.filter(c => c.type === "voice" && !c.categoryId).length > 0 && (
                        <div className="pt-2 pb-1"><span className="text-[10px] font-bold text-[#949BA4] uppercase tracking-wider px-2">Voice Channels</span></div>
                      )}
                      {channels.filter(c => c.type === "voice" && !c.categoryId).map((ch) => (
                        <button key={ch.id} onClick={() => setSelectedChannelId(ch.id)}
                          className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                            selectedChannelId === ch.id ? "bg-[#404249] text-white" : "text-[#949BA4] hover:text-[#DCDDDE] hover:bg-[#35373C]"
                          }`}>
                          <Volume2 className="w-4 h-4 shrink-0 opacity-70" />
                          <span className="truncate">{ch.name}</span>
                        </button>
                      ))}
                    </>
                  ) : (
                    categories.map((cat) => {
                      const catChannels = channels.filter(c => c.categoryId === cat.id);
                      const textChannels = catChannels.filter(c => c.type === "text");
                      const voiceChannels = catChannels.filter(c => c.type === "voice");
                      return (
                        <div key={cat.id}>
                          <div className="flex items-center justify-between px-1 pb-1">
                            <span className="text-[10px] font-bold text-[#949BA4] uppercase tracking-wider">{cat.name}</span>
                            <button
                              onClick={() => { setNewChannelCategoryId(cat.id); setShowCreateChannel(true); }}
                              className="text-[#949BA4] hover:text-white transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                              style={{ opacity: 0.6 }}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          {textChannels.map((ch) => (
                            <button key={ch.id} onClick={() => setSelectedChannelId(ch.id)}
                              className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                                selectedChannelId === ch.id ? "bg-[#404249] text-white" : "text-[#949BA4] hover:text-[#DCDDDE] hover:bg-[#35373C]"
                              }`}>
                              <Hash className="w-4 h-4 shrink-0 opacity-70" />
                              <span className="truncate">{ch.name}</span>
                            </button>
                          ))}
                          {voiceChannels.map((ch) => (
                            <button key={ch.id} onClick={() => setSelectedChannelId(ch.id)}
                              className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                                selectedChannelId === ch.id ? "bg-[#404249] text-white" : "text-[#949BA4] hover:text-[#DCDDDE] hover:bg-[#35373C]"
                              }`}>
                              <Volume2 className="w-4 h-4 shrink-0 opacity-70" />
                              <span className="truncate">{ch.name}</span>
                            </button>
                          ))}
                        </div>
                      );
                    })
                  )}
                  {/* Uncategorized channels */}
                  {channels.filter(c => !c.categoryId && categories.length > 0).length > 0 && (
                    <div>
                      <div className="px-1 pb-1"><span className="text-[10px] font-bold text-[#949BA4] uppercase tracking-wider">Uncategorized</span></div>
                      {channels.filter(c => !c.categoryId && categories.length > 0).map((ch) => (
                        <button key={ch.id} onClick={() => setSelectedChannelId(ch.id)}
                          className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                            selectedChannelId === ch.id ? "bg-[#404249] text-white" : "text-[#949BA4] hover:text-[#DCDDDE] hover:bg-[#35373C]"
                          }`}>
                          {ch.type === "voice" ? <Volume2 className="w-4 h-4 shrink-0 opacity-70" /> : <Hash className="w-4 h-4 shrink-0 opacity-70" />}
                          <span className="truncate">{ch.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Active Chat Screen Console */}
          <div className={`${selectedConv ? "flex" : "hidden md:flex"} flex-1 flex-col ${isGroupView ? "bg-[#18191C]" : "bg-[#efe7dd]"} overflow-hidden min-h-0`}>
            {selectedConv === null ? (
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
                    <button
                      onClick={() => setShowInfoPanel((p) => !p)}
                      className="flex items-center gap-2 sm:gap-3 min-w-0 hover:opacity-80 transition-opacity rounded-lg px-1 py-0.5"
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
                        <div className="flex items-center gap-1.5">
                          <p className="font-extrabold text-[13px] sm:text-sm leading-none truncate max-w-[38vw] sm:max-w-none">{selectedName}</p>
                          {selectedConv.type === "group" && selectedConv.ownerId === me?.id && (
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
                      <Button asChild size="icon" variant="ghost" className="hidden sm:inline-flex h-9 w-9 rounded-full text-white hover:bg-white/10 hover:text-white transition-colors" title="View Profile">
                        <Link href={`/profile/${selectedConv.otherUserId}`}><UserCircle className="h-5 w-5" /></Link>
                      </Button>
                    )}
                    {selectedConv.type !== "group" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 sm:h-9 sm:w-9 rounded-full p-0 text-white hover:bg-white/10 hover:text-white transition-colors"
                        onClick={() => {
                          setCallType("voice");
                          setShowCall(true);
                        }}
                        title="Voice Call"
                      >
                        <Phone className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
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
                    <Button
                      size="sm"
                      variant="ghost"
                      className="hidden sm:inline-flex h-8 px-3 text-xs font-bold text-white/75 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                      onClick={handleLeaveOrDelete}
                    >
                      {selectedConv.type === "group" && selectedConv.ownerId === me?.id
                        ? "Delete"
                        : "Leave"}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="sm:hidden h-9 w-9 rounded-full text-white hover:bg-white/10 hover:text-white"
                      onClick={selectedConv.type === "group" ? () => setShowMembers(true) : handleLeaveOrDelete}
                      title={selectedConv.type === "group" ? "Members" : "Leave"}
                    >
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                {/* Messages Bubbles Feed */}
                <ScrollArea className={`flex-1 px-2.5 sm:px-4 md:px-6 py-3 sm:py-4 min-h-0 ${isGroupView ? "bg-[#18191C]" : "bg-[#efe7dd]"}`}>
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
                  ) : activeMessages.length === 0 ? (
                    <div className={`text-center text-xs py-16 font-bold ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>
                      No messages yet. Say hello!
                    </div>
                  ) : (
                    (() => {
                      let lastDateStr = "";
                      return activeMessages.map((msg) => {
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
                              onDelete={
                                msg.senderId === me?.id
                                  ? () => handleDeleteMessage(msg.id)
                                  : undefined
                              }
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
                <div className={`px-2 sm:px-4 md:px-6 py-2 sm:py-3 pb-3 sm:pb-4 border-t shrink-0 ${isGroupView ? "border-[#3F4147] bg-[#1E1F22]" : "border-[#d8cec1] bg-[#f0e7dd]"}`}>
                  {selectedChannel?.type === "voice" ? (
                    /* Voice channel controls */
                    <div className="flex flex-col items-center gap-3 py-4">
                      <Volume2 className="w-8 h-8 text-[#5865F2]" />
                      <p className="text-sm font-bold text-[#DCDDDE]">#{selectedChannel.name}</p>
                      <p className="text-xs text-[#949BA4]">Voice Channel</p>
                      <Button
                        onClick={() => {
                          setShowCall(true);
                          setCallType("voice");
                        }}
                        className="bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-xl font-bold px-8 shadow-md"
                      >
                        Join Voice
                      </Button>
                    </div>
                  ) : (
                    <>
                  {attachedImageUrl && (
                    <div className="relative mb-2 ml-12 inline-block rounded-xl overflow-hidden border border-[#d7e4de] bg-white max-w-[132px] aspect-video group">
                      <img src={attachedImageUrl} alt="Attachment preview" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setAttachedImageUrl(null)}
                        className="absolute top-1 right-1 bg-black/60 hover:bg-black text-white rounded-full w-6 h-6 flex items-center justify-center transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className={`hover:bg-opacity-70 transition-all shrink-0 rounded-full h-11 w-11 ${isGroupView ? "text-[#949BA4]" : "text-[#54656f]"}`}
                      title="Attach image"
                    >
                      {uploading ? (
                        <span className="h-4 w-4 rounded-full border-2 border-[#075e54]/20 border-t-[#075e54] animate-spin" />
                      ) : (
                        <Camera className="h-5 w-5" />
                      )}
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
                                  {m.username === "all" ? "@all" : `@${m.username}`}
                                </p>
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
                      disabled={(!messageText.trim() && !attachedImageUrl) || sendMessage.isPending || uploading}
                      className={`${isGroupView ? "bg-[#5865F2] hover:bg-[#4752C4] shadow-indigo-900/20" : "bg-[#00a884] hover:bg-[#008f72] shadow-emerald-900/10"} text-white rounded-full h-11 w-11 p-0 shrink-0 shadow-md`}
                      title="Send"
                    >
                      <SendHorizontal className="h-5 w-5" />
                    </Button>
                  </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Info Panel - Slide in from right */}
          {showInfoPanel && selectedConv && (
            <div className={`fixed inset-0 sm:relative sm:inset-auto z-50 sm:z-auto sm:w-80 sm:border-l flex flex-col overflow-hidden animate-in slide-in-from-right duration-200 ${isGroupView ? "bg-[#1E1F22] sm:border-[#3F4147]" : "bg-white sm:border-[#eae8f5]"}`}>
              {/* Panel Header */}
              <div className={`h-14 sm:h-16 px-3 sm:px-4 flex items-center justify-between shrink-0 ${isGroupView ? "bg-[#2B2D31]" : "bg-[#075e54]"}`}>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowInfoPanel(false)}
                    className="sm:hidden text-white/80 hover:text-white transition-colors -ml-1"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <p className="text-white text-sm font-extrabold">
                    {selectedConv.type === "group" ? "Group Info" : "Contact Info"}
                  </p>
                </div>
                <button
                  onClick={() => setShowInfoPanel(false)}
                  className="hidden sm:block text-white/80 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <ScrollArea className="flex-1">
                {/* Avatar / Icon */}
                <div className={`flex flex-col items-center py-6 px-4 border-b ${isGroupView ? "border-[#3F4147]" : "border-slate-100"}`}>
                  <div className={`rounded-full overflow-hidden ${selectedConv.type === "group" ? "w-24 h-24" : "w-24 h-24"} ${selectedConv.type === "dm" && (selectedConv as any).otherUserEquippedBorder ? (selectedConv as any).otherUserEquippedBorder + " p-1" : isGroupView ? "border-2 border-[#3F4147]" : "border-2 border-slate-100"}`}>
                    <img
                      src={
                        selectedConv.type === "dm"
                          ? (selectedConv.otherAvatarUrl ?? "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=128")
                          : (selectedConv.iconUrl ?? "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128")
                      }
                      alt={selectedName}
                      className="w-full h-full object-cover rounded-full"
                    />
                  </div>
                  <h2 className={`text-lg font-extrabold mt-3 text-center ${isGroupView ? "text-white" : "text-[#110e3d]"}`}>{selectedName}</h2>
                  <p className={`text-xs font-bold mt-1 ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>
                    {selectedConv.type === "dm"
                      ? `@${selectedConv.otherUsername}`
                      : `Group • ${selectedConv.memberCount} members`
                    }
                  </p>
                  {selectedConv.type === "dm" && (selectedConv as any).otherUserRole && (
                    <span className={`mt-2 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
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

                {/* Description (Group only) */}
                {selectedConv.type === "group" && (
                  <div className={`px-5 py-4 border-b ${isGroupView ? "border-[#3F4147]" : "border-slate-100"}`}>
                    <p className={`text-[10px] font-black uppercase tracking-wider mb-2 flex items-center gap-1.5 ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>
                      <Info className="h-3 w-3" /> Description
                    </p>
                    <p className={`text-xs font-medium leading-relaxed ${isGroupView ? "text-[#DCDDDE]" : "text-slate-600"}`}>
                      {(selectedConv as any).description || "No description yet."}
                    </p>
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
                          <Avatar className={`w-8 h-8 border ${isGroupView ? "border-[#3F4147]" : "border-slate-100"}`}>
                            <AvatarImage src={m.avatarUrl ?? undefined} />
                            <AvatarFallback className={`text-[10px] font-bold ${isGroupView ? "bg-[#2B2D31] text-[#DCDDDE]" : "bg-slate-100 text-[#6366f1]"}`}>
                              {getInitials(m.displayName ?? m.username)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-bold truncate ${isGroupView ? "text-[#DCDDDE]" : "text-[#110e3d]"}`}>{m.displayName ?? m.username}</p>
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
                    <Button asChild className="w-full bg-[#6366f1] text-white hover:bg-violet-700 rounded-xl text-xs font-bold">
                      <Link href={`/profile/${selectedConv.otherUserId}`}>
                        <UserCircle className="h-4 w-4 mr-2" /> View Full Profile
                      </Link>
                    </Button>
                  )}
                  {selectedConv.type === "group" && selectedConv.ownerId === me?.id && (
                    <Button
                      className="w-full bg-[#6366f1] text-white hover:bg-violet-700 rounded-xl text-xs font-bold"
                      onClick={() => { setShowInfoPanel(false); openEditGroup(); }}
                    >
                      <Edit3 className="h-4 w-4 mr-2" /> Edit Group
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className={`w-full rounded-xl text-xs font-bold ${isGroupView ? "text-red-400 border-red-900/50 hover:bg-red-900/30 hover:text-red-300" : "text-red-500 border-red-100 hover:bg-red-50 hover:text-red-600"}`}
                    onClick={() => { setShowInfoPanel(false); handleLeaveOrDelete(); }}
                  >
                    {selectedConv.type === "group" && selectedConv.ownerId === me?.id ? "Delete Group" : "Leave Chat"}
                  </Button>
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </main>

      {/* ── Dialog Modals ────────────────────────────────────────────────── */}
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

      <Dialog open={showNewGroup} onOpenChange={setShowNewGroup}>
        <DialogContent className="max-w-sm bg-white border border-[#eae8f5] rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-sm font-extrabold text-[#110e3d]">New Group Chat</DialogTitle>
          </DialogHeader>
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
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setNewChannelType("text")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                newChannelType === "text" ? "bg-[#5865F2] text-white" : "bg-[#2B2D31] text-[#949BA4] hover:bg-[#35373C]"
              }`}
            >
              <Hash className="w-4 h-4" /> Text
            </button>
            <button
              onClick={() => setNewChannelType("voice")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                newChannelType === "voice" ? "bg-[#5865F2] text-white" : "bg-[#2B2D31] text-[#949BA4] hover:bg-[#35373C]"
              }`}
            >
              <Volume2 className="w-4 h-4" /> Voice
            </button>
          </div>
          <Button
            onClick={async () => {
              if (!newChannelName.trim() || !selectedId) return;
              try {
                const res = await fetch(`/api/conversations/${selectedId}/channels`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: newChannelName.trim(), type: newChannelType }),
                });
                if (!res.ok) throw new Error("Failed");
                await queryClient.invalidateQueries({ queryKey: ["channels", selectedId] });
                setNewChannelName("");
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

      {/* Roles Management Dialog */}
      <Dialog open={showRoles} onOpenChange={(open) => { setShowRoles(open); if (!open) setEditingRole(null); }}>
        <DialogContent className="max-w-md bg-[#1E1F22] border border-[#3F4147] rounded-2xl p-5">
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
                            setNewRolePerms(r.permissions as Record<string, boolean>);
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
                        body: JSON.stringify({ name: newRoleName.trim(), color: newRoleColor, permissions: { sendMessages: true } }),
                      });
                      if (!res.ok) throw new Error();
                      await queryClient.invalidateQueries({ queryKey: ["roles", selectedId] });
                      setNewRoleName("");
                      setNewRoleColor("#5865F2");
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
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="Role name"
                  className="flex-1 px-3 py-2 text-xs rounded-xl bg-[#2B2D31] border border-[#3F4147] text-[#DCDDDE] focus:ring-2 focus:ring-[#5865F2] outline-none"
                />
                <input
                  type="color"
                  value={newRoleColor}
                  onChange={(e) => setNewRoleColor(e.target.value)}
                  className="w-10 h-9 rounded-lg border border-[#3F4147] bg-transparent cursor-pointer"
                />
              </div>
              <div className="space-y-2 mb-4">
                <p className="text-[10px] font-black text-[#949BA4] uppercase tracking-wider">Permissions</p>
                {Object.entries(newRolePerms).map(([key, val]) => (
                  <label key={key} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[#2B2D31] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={val}
                      onChange={(e) => setNewRolePerms(p => ({ ...p, [key]: e.target.checked }))}
                      className="accent-[#5865F2]"
                    />
                    <span className="text-xs font-semibold text-[#DCDDDE] capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                  </label>
                ))}
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
                  } catch { toast({ title: "Failed", variant: "destructive" }); }
                }}
                disabled={!newRoleName.trim()}
                className="w-full bg-[#5865F2] text-white hover:bg-[#4752C4] rounded-xl text-xs font-bold"
              >
                Save Role
              </Button>
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
                  <Avatar className={`w-7 h-7 border ${isGroupView ? "border-[#3F4147]" : "border-[#eae8f5]"}`}>
                    <AvatarImage src={m.avatarUrl ?? undefined} />
                    <AvatarFallback className={`text-[10px] font-bold ${isGroupView ? "bg-[#35373C] text-[#DCDDDE]" : "bg-slate-100 text-[#6366f1]"}`}>
                      {getInitials(m.displayName ?? m.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold truncate ${isGroupView ? "text-[#DCDDDE]" : "text-[#110e3d]"}`}>{m.displayName ?? m.username}</p>
                    {selectedConv?.ownerId === m.userId && (
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Owner</p>
                    )}
                  </div>
                  {selectedConv?.ownerId === me?.id && m.userId !== me?.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[10px] text-slate-400 hover:text-[#ef4444] hover:bg-red-50 rounded-lg font-bold"
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
          {selectedConv?.ownerId === me?.id && (
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
        <DialogContent className={`max-w-sm rounded-2xl p-5 ${isGroupView ? "bg-[#1E1F22] border border-[#3F4147]" : "bg-white border border-[#eae8f5]"}`}>
          <DialogHeader>
            <DialogTitle className={`text-sm font-extrabold flex items-center gap-2 ${isGroupView ? "text-white" : "text-[#110e3d]"}`}>
              <Edit3 className={`h-4 w-4 ${isGroupView ? "text-[#5865F2]" : "text-[#6366f1]"}`} /> Edit Group
            </DialogTitle>
            <DialogDescription className={`text-xs font-bold ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>Update your group name, photo, and description.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Group Icon Preview & URL */}
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-2xl overflow-hidden border-2 flex items-center justify-center shrink-0 ${isGroupView ? "border-[#3F4147] bg-[#2B2D31]" : "border-[#eae8f5] bg-slate-50"}`}>
                {editGroupIcon ? (
                  <img src={editGroupIcon} alt="Group" className="w-full h-full object-cover" />
                ) : (
                  <span className={`text-2xl font-black ${isGroupView ? "text-[#949BA4]" : "text-slate-300"}`}>{getInitials(editGroupName || "G")}</span>
                )}
              </div>
              <div className="flex-1">
                <label className={`text-[10px] font-black uppercase tracking-wider ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>Group Photo URL</label>
                <input
                  type="text"
                  value={editGroupIcon}
                  onChange={(e) => setEditGroupIcon(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  className={`w-full mt-1 px-3 py-2 text-xs rounded-xl focus:ring-2 focus:ring-[#6366f1] focus:border-transparent outline-none border ${isGroupView ? "bg-[#2B2D31] border-[#3F4147] text-[#DCDDDE] placeholder:text-[#949BA4]" : "bg-slate-50 border-slate-200"}`}
                />
              </div>
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
                className={`w-full mt-1 px-3 py-2 text-xs rounded-xl focus:ring-2 focus:ring-[#6366f1] focus:border-transparent outline-none border ${isGroupView ? "bg-[#2B2D31] border-[#3F4147] text-[#DCDDDE] placeholder:text-[#949BA4]" : "bg-slate-50 border-slate-200"}`}
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
                className={`w-full mt-1 px-3 py-2 text-xs rounded-xl focus:ring-2 focus:ring-[#6366f1] focus:border-transparent outline-none resize-none border ${isGroupView ? "bg-[#2B2D31] border-[#3F4147] text-[#DCDDDE] placeholder:text-[#949BA4]" : "bg-slate-50 border-slate-200"}`}
              />
              <p className="text-[10px] text-slate-300 mt-1 text-right">{editGroupDesc.length}/500</p>
            </div>
          </div>

          {/* Manage Roles Button */}
          <button
            onClick={() => { setShowEditGroup(false); setShowRoles(true); }}
            className={`w-full mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${isGroupView ? "bg-[#2B2D31] border border-[#3F4147] text-[#DCDDDE] hover:bg-[#35373C]" : "bg-violet-50 border border-violet-100 text-[#6366f1] hover:bg-violet-100"}`}
          >
            <ShieldAlert className={`w-4 h-4 ${isGroupView ? "text-[#5865F2]" : "text-[#6366f1]"}`} />
            Manage Roles
            <span className={`ml-auto text-[10px] ${isGroupView ? "text-[#949BA4]" : "text-slate-400"}`}>{roles.length} roles</span>
          </button>

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
              disabled={editGroupSaving || !editGroupName.trim()}
            >
              {editGroupSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCall} onOpenChange={(open) => {
        setShowCall(open);
        if (!open) {
          setCallType(null);
        }
      }}>
        <DialogContent className={`${callType ? "max-w-3xl h-[80vh]" : "max-w-md"} flex flex-col p-0 gap-0 overflow-hidden bg-white border border-[#eae8f5] rounded-2xl transition-all duration-300`}>
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-[#eae8f5] bg-white">
            <DialogTitle className="text-sm font-extrabold text-[#110e3d] flex items-center gap-2">
              {callType === "voice" ? "🎙️ Voice Call" : callType === "video" ? "📹 Video Call" : "📞 Establish Call Connection"}
              <span className="text-xs text-slate-400 font-bold">— {selectedName}</span>
            </DialogTitle>
          </DialogHeader>

          {showCall && selectedId && (
            <>
              {!callType ? (
                <div className="p-6 space-y-6 text-center">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                      Choose your call mode. You will connect securely via the Arcadia Studio communications network.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setCallType("voice")}
                      className="flex flex-col items-center justify-center p-5 rounded-2xl border border-[#eae8f5] bg-white hover:bg-violet-50/50 hover:border-violet-200 text-[#110e3d] transition-all duration-200 group cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-violet-50 text-[#6366f1] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Phone className="w-5 h-5" />
                      </div>
                      <span className="font-extrabold text-xs">Voice Call</span>
                      <span className="text-[10px] text-slate-400 font-semibold mt-1">Audio only</span>
                    </button>

                    <button
                      onClick={() => setCallType("video")}
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
              ) : (
                <div className="flex-1 flex overflow-hidden p-4 min-h-0 bg-slate-50">
                  <JitsiCall
                    roomName={`arcadia-studio-${selectedConv?.type === "group" ? "group" : "dm"}-${slugify(selectedName)}-${String(selectedId).padStart(3, "0")}`}
                    displayName={me?.displayName ?? me?.username ?? "Anonymous"}
                    avatarUrl={me?.avatarUrl}
                    audioOnly={callType === "voice"}
                    onClose={() => {
                      setShowCall(false);
                      setCallType(null);
                    }}
                    subject={
                      selectedConv?.type === "group"
                        ? `${selectedName} #${String(selectedId).padStart(3, "0")}`
                        : selectedName
                    }
                  />
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Zaidan AI Voice Call Overlay */}
      {showAkiraCall && (
        <ZaidanAiCall
          onClose={() => setShowAkiraCall(false)}
          username={me?.username ?? "user"}
        />
      )}
    </div>
  );
}
