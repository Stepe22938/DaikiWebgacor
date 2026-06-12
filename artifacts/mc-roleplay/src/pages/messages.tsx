import { useState, useRef, useEffect } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  UserCircle
} from "lucide-react";

const JITSI_BASE = "https://jitsi.sixtopia.net/arcadia-studio-conv-";

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
};

const ROLE_BADGE_CLASSES: Record<string, string> = {
  member: "bg-slate-50 text-slate-500 border border-slate-200/50",
  admin: "bg-violet-50 text-[#6366f1] border border-violet-100",
  staff: "bg-sky-50 text-sky-600 border border-sky-100",
  dev: "bg-emerald-50 text-emerald-600 border border-emerald-100",
  dev_website: "bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-100",
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
}: {
  conv: ConversationSummary;
  selected: boolean;
  onClick: () => void;
}) {
  const name =
    conv.type === "dm"
      ? (conv.otherDisplayName ?? conv.otherUsername ?? "Unknown")
      : (conv.name ?? "Group");
  const avatar = conv.type === "dm" ? conv.otherAvatarUrl : conv.iconUrl;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
        selected
          ? "bg-violet-50 text-[#6366f1]"
          : "hover:bg-slate-50 text-slate-600 hover:text-slate-900"
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
            <span className={`font-bold text-xs truncate ${selected ? "text-[#6366f1]" : "text-[#110e3d]"}`}>{name}</span>
            {conv.type === "dm" && conv.otherUserRole && conv.otherUserRole !== "member" && (
              <Badge className={`text-[8px] px-1 py-0 h-3 leading-none shrink-0 font-medium rounded ${ROLE_BADGE_CLASSES[conv.otherUserRole] ?? ""}`}>
                {ROLE_LABELS[conv.otherUserRole] ?? conv.otherUserRole}
              </Badge>
            )}
          </div>
          {conv.type === "group" && (
            <Badge variant="secondary" className="text-[9px] shrink-0 bg-violet-50 text-[#6366f1] hover:bg-violet-50 border border-violet-100">
              Group
            </Badge>
          )}
        </div>
        {conv.lastMessageContent && (
          <p className="text-[10px] text-slate-400 font-bold truncate mt-0.5">{conv.lastMessageContent}</p>
        )}
      </div>
    </button>
  );
}

function MessageBubble({
  msg,
  isOwn,
  onDelete,
}: {
  msg: Message;
  isOwn: boolean;
  onDelete?: () => void;
}) {
  const name = msg.senderDisplayName ?? msg.senderUsername ?? "Unknown";
  const [isZoomed, setIsZoomed] = useState(false);

  return (
    <>
      <div className={`flex gap-2 group ${isOwn ? "flex-row-reverse" : ""}`}>
        {!isOwn && (
        <div className={`rounded-full shrink-0 flex items-center justify-center p-0.5 overflow-visible mt-0.5 ${(msg as any).senderEquippedBorder ? (msg as any).senderEquippedBorder : "border border-[#d7e4de]"}`}>
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarImage src={msg.senderAvatarUrl ?? undefined} />
            <AvatarFallback className="text-[10px] bg-[#edf5f1] font-bold text-[#0b6b58]">{getInitials(name)}</AvatarFallback>
          </Avatar>
        </div>
        )}
        <div
          className={`max-w-[84%] sm:max-w-[72%] flex flex-col gap-1 ${isOwn ? "items-end" : "items-start"}`}
        >
          <div className={`flex items-center gap-2 px-1 ${isOwn ? "flex-row-reverse" : ""}`}>
            {(!isOwn || (msg.senderRole && msg.senderRole !== "member")) && (
              <div className={`flex items-center gap-1.5 ${isOwn ? "flex-row-reverse" : ""}`}>
                {!isOwn && <span className="text-[11px] font-extrabold text-[#075e54]">{name}</span>}
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
                ? "bg-[#dcf8c6] text-[#18251f] rounded-tr-[4px]"
                : "bg-white border border-[#dfe8e3] text-[#18251f] rounded-tl-[4px]"
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
            <span className="absolute bottom-1.5 right-3 text-[10px] font-semibold text-[#66756f]">
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

export default function MessagesPage() {
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
  const [messageText, setMessageText] = useState("");
  const [showNewDm, setShowNewDm] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showCall, setShowCall] = useState(false);
  const [callType, setCallType] = useState<"voice" | "video" | null>(null);
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

  const handleCopyIP = () => {
    navigator.clipboard.writeText("play.arcadiamc.net");
    setCopied(true);
    toast({ title: "Copied!", description: "IP copied to clipboard: play.arcadiamc.net" });
    setTimeout(() => setCopied(false), 2000);
  };

  const { data: conversations = [], isLoading: convsLoading } = useListConversations({
    query: { ...getListConversationsQueryOptions(), refetchInterval: 5000 },
  });

  const { data: messages = [], isLoading: msgsLoading } = useListMessages(selectedId ?? 0, {
    query: {
      ...getListMessagesQueryOptions(selectedId ?? 0),
      enabled: selectedId !== null,
      refetchInterval: 2000,
    },
  });

  const { data: friends = [] } = useGetMyFriends();

  const { data: members = [] } = useListConversationMembers(selectedId ?? 0, {
    query: {
      ...getListConversationMembersQueryOptions(selectedId ?? 0),
      enabled: selectedId !== null,
    },
  });

  const createDm = useCreateOrGetDm();
  const createGroup = useCreateGroup();
  const deleteConv = useDeleteConversation();
  const sendMessage = useSendMessage();
  const deleteMessage = useDeleteMessage();
  const addMember = useAddConversationMember();
  const removeMember = useRemoveConversationMember();

  const selectedConv = conversations.find((c) => c.id === selectedId) ?? null;
  const selectedName =
    selectedConv?.type === "dm"
      ? (selectedConv.otherDisplayName ?? selectedConv.otherUsername ?? "Unknown")
      : (selectedConv?.name ?? "Group");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

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

  async function handleSend() {
    const text = messageText.trim();
    if (!text && !attachedImageUrl) return;
    if (selectedId === null) return;
    try {
      const payload: { content?: string; imageUrl?: string } = {};
      if (text) payload.content = text;
      if (attachedImageUrl) payload.imageUrl = attachedImageUrl;

      await sendMessage.mutateAsync({
        id: selectedId,
        data: payload,
      });
      setMessageText("");
      setAttachedImageUrl(null);
      await queryClient.invalidateQueries({ queryKey: [`/api/conversations/${selectedId}/messages`] });
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

  const filteredFriends = friends.filter((f) => {
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

  return (
    <div className="min-h-screen bg-[#f4f3f8] text-[#1e1b4b] flex font-sans antialiased h-screen overflow-hidden">
      {/* ── Left Sidebar (Desktop) ────────────────────────────────────────── */}
      <aside className="w-64 bg-white border-r border-[#eae8f5] flex flex-col justify-between shrink-0 hidden md:flex h-full">
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
                  href="/messages"
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
      </aside>

      {/* ── Mobile Sidebar Drawer ────────────────────────────────────────── */}
      {mobileSidebarOpen && (
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
                    href="/messages"
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
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header Bar */}
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

        {/* Content Container (Full Height chat panel layout) */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Chat Sidebar: Conversations List */}
          <div className={`${selectedConv ? "hidden md:flex" : "flex"} w-full md:w-80 border-r border-[#eae8f5] bg-white flex-col shrink-0 min-h-0`}>
            {/* Header + Create Dm/Group buttons */}
            <div className="p-3 sm:p-4 border-b border-[#eae8f5] flex items-center justify-between shrink-0">
              <h2 className="font-extrabold text-lg md:text-sm text-[#110e3d]">Chats</h2>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 rounded-full text-xs font-bold border-[#d7e4de] text-[#075e54] hover:bg-[#e7f6f1] hover:text-[#075e54] transition-all"
                  onClick={() => setShowNewDm(true)}
                >
                  + DM
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 rounded-full text-xs font-bold border-[#d7e4de] text-[#075e54] hover:bg-[#e7f6f1] hover:text-[#075e54] transition-all"
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
                  <div className="text-center text-slate-400 text-xs py-12 font-bold px-4 leading-relaxed">
                    No conversations yet.<br />
                    Start a DM with a friend!
                  </div>
                ) : (
                  conversations.map((c) => (
                    <ConvItem
                      key={c.id}
                      conv={c}
                      selected={selectedId === c.id}
                      onClick={() => setSelectedId(c.id)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Active Chat Screen Console */}
          <div className={`${selectedConv ? "flex" : "hidden md:flex"} flex-1 flex-col bg-[#efe7dd] overflow-hidden min-h-0`}>
            {selectedConv === null ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
                <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center text-[#6366f1] shadow-inner">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-extrabold text-[#110e3d]">No Conversation Selected</p>
                  <p className="text-xs text-slate-400 font-semibold max-w-[280px]">Select a friend or group from the list to start chatting.</p>
                </div>
              </div>
            ) : (
              <>
                {/* Chat Top Header Panel */}
                <div className="h-16 border-b border-[#d7e4de] bg-[#075e54] px-2 sm:px-4 md:px-6 flex items-center justify-between shrink-0 text-white">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden h-9 w-9 rounded-full text-white hover:bg-white/10 hover:text-white shrink-0"
                      onClick={() => setSelectedId(null)}
                      title="Back to chats"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className={`rounded-full shrink-0 flex items-center justify-center p-0.5 overflow-visible ${selectedConv.type === "dm" && (selectedConv as any).otherUserEquippedBorder ? (selectedConv as any).otherUserEquippedBorder : "border border-[#eae8f5]"}`}>
                      <Avatar className="w-9 h-9 shrink-0">
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
                    <div className="min-w-0">
                      <p className="font-extrabold text-sm leading-none truncate max-w-[42vw] sm:max-w-none">{selectedName}</p>
                      <p className="text-[10px] text-white/70 font-bold mt-1">
                        {selectedConv.type === "dm" ? "Direct Message" : `${selectedConv.memberCount} members`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    {selectedConv.type === "dm" && selectedConv.otherUserId && (
                      <Button asChild size="icon" variant="ghost" className="h-9 w-9 rounded-full text-white hover:bg-white/10 hover:text-white transition-colors" title="View Profile">
                        <Link href={`/profile/${selectedConv.otherUserId}`}><UserCircle className="h-5 w-5" /></Link>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 w-9 rounded-full p-0 text-white hover:bg-white/10 hover:text-white transition-colors"
                      onClick={() => {
                        setCallType("voice");
                        setShowCall(true);
                      }}
                      title="Voice Call"
                    >
                      <Phone className="h-5 w-5" />
                    </Button>
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
                <ScrollArea className="flex-1 px-2.5 sm:px-4 md:px-6 py-3 sm:py-4 min-h-0 bg-[#efe7dd]">
                  {msgsLoading ? (
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
                  ) : messages.length === 0 ? (
                    <div className="text-center text-slate-400 text-xs py-16 font-bold">
                      No messages yet. Say hello!
                    </div>
                  ) : (
                    (() => {
                      let lastDateStr = "";
                      return messages.map((msg) => {
                        const msgDate = new Date(msg.createdAt);
                        const dateKey = `${msgDate.getFullYear()}-${msgDate.getMonth()}-${msgDate.getDate()}`;
                        const showDivider = dateKey !== lastDateStr;
                        lastDateStr = dateKey;

                        return (
                          <div key={msg.id} className="flex flex-col gap-2 mb-2.5">
                            {showDivider && (
                              <div className="flex items-center justify-center my-3">
                                <div className="bg-[#dcebe7] text-[#52635d] text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider shadow-sm">
                                  {formatMessageDateSeparator(msg.createdAt)}
                                </div>
                              </div>
                            )}
                            <MessageBubble
                              msg={msg}
                              isOwn={msg.senderId === me?.id}
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
                  <div ref={messagesEndRef} />
                </ScrollArea>

                {/* Bottom Input Console */}
                <div className="px-2.5 sm:px-4 md:px-6 py-2.5 sm:py-3 border-t border-[#d8cec1] bg-[#f0e7dd] shrink-0">
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
                      className="hover:bg-white/70 transition-all shrink-0 rounded-full h-11 w-11 text-[#54656f]"
                      title="Attach image"
                    >
                      {uploading ? (
                        <span className="h-4 w-4 rounded-full border-2 border-[#075e54]/20 border-t-[#075e54] animate-spin" />
                      ) : (
                        <Camera className="h-5 w-5" />
                      )}
                    </Button>
                    <Textarea
                      rows={1}
                      placeholder="Message"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      className="min-h-11 max-h-32 resize-none bg-white border-0 focus-visible:ring-1 focus-visible:ring-[#25d366] rounded-3xl px-4 py-3 text-[15px] text-[#18251f] font-medium shadow-sm"
                    />
                    <Button
                      onClick={handleSend}
                      disabled={(!messageText.trim() && !attachedImageUrl) || sendMessage.isPending || uploading}
                      className="bg-[#00a884] text-white hover:bg-[#008f72] rounded-full h-11 w-11 p-0 shrink-0 shadow-md shadow-emerald-900/10"
                      title="Send"
                    >
                      <SendHorizontal className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
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

      <Dialog open={showMembers} onOpenChange={setShowMembers}>
        <DialogContent className="max-w-sm bg-white border border-[#eae8f5] rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-sm font-extrabold text-[#110e3d]">Group Members</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-48 mb-4 pr-1">
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.userId} className="flex items-center gap-3 px-2 py-1.5 rounded-xl bg-slate-50/50 border border-slate-100">
                  <Avatar className="w-7 h-7 border border-[#eae8f5]">
                    <AvatarImage src={m.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-[10px] bg-slate-100 font-bold text-[#6366f1]">
                      {getInitials(m.displayName ?? m.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#110e3d] truncate">{m.displayName ?? m.username}</p>
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
    </div>
  );
}
