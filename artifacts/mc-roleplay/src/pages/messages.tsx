import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/layout";
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
} from "@workspace/api-client-react";
import type { ConversationSummary, Message } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Phone, Video } from "lucide-react";
import { Link } from "wouter";

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
  member: "bg-muted text-muted-foreground",
  admin: "bg-primary/20 text-primary",
  staff: "bg-sky-500/15 text-sky-300",
  dev: "bg-emerald-500/15 text-emerald-300",
  dev_website: "bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30",
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

        // Fail-safe to hide loading spinner after 5 seconds if conference joined event doesn't fire
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
    <div className="relative flex-1 w-full min-h-[500px] flex flex-col bg-card overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-card gap-4 z-10">
          <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <div className="text-center space-y-1">
            <p className="text-sm font-bold text-foreground">Menghubungkan ke Saluran Suara...</p>
            <p className="text-xs text-muted-foreground animate-pulse">Sedang menyinkronkan data audio & profil</p>
          </div>
        </div>
      )}
      <div ref={containerRef} className="flex-1 w-full h-full min-h-[500px]" />
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
    return "Hari Ini";
  } else if (isYesterday) {
    return "Kemarin";
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
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
        selected
          ? "bg-primary/20 text-primary"
          : "hover:bg-card/60 text-foreground"
      }`}
    >
      <Avatar className="w-9 h-9 shrink-0">
        <AvatarImage src={avatar ?? undefined} />
        <AvatarFallback className="bg-muted text-xs">{getInitials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-medium text-sm truncate">{name}</span>
            {conv.type === "dm" && conv.otherUserRole && conv.otherUserRole !== "member" && (
              <Badge className={`text-[8px] px-1 py-0 h-3 leading-none shrink-0 font-medium rounded ${ROLE_BADGE_CLASSES[conv.otherUserRole] ?? ""}`}>
                {ROLE_LABELS[conv.otherUserRole] ?? conv.otherUserRole}
              </Badge>
            )}
          </div>
          {conv.type === "group" && (
            <Badge variant="secondary" className="text-[10px] shrink-0">
              Group
            </Badge>
          )}
        </div>
        {conv.lastMessageContent && (
          <p className="text-xs text-muted-foreground truncate">{conv.lastMessageContent}</p>
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
        <Avatar className="w-7 h-7 shrink-0 mt-1">
          <AvatarImage src={msg.senderAvatarUrl ?? undefined} />
          <AvatarFallback className="text-[10px]">{getInitials(name)}</AvatarFallback>
        </Avatar>
        <div
          className={`max-w-[70%] flex flex-col gap-0.5 ${isOwn ? "items-end" : "items-start"}`}
        >
          <div className={`flex items-center gap-2 ${isOwn ? "flex-row-reverse" : ""}`}>
            {(!isOwn || (msg.senderRole && msg.senderRole !== "member")) && (
              <div className={`flex items-center gap-1.5 ${isOwn ? "flex-row-reverse" : ""}`}>
                {!isOwn && <span className="text-xs text-muted-foreground">{name}</span>}
                {msg.senderRole && msg.senderRole !== "member" && (
                  <Badge className={`text-[9px] px-1.5 py-0 h-4 leading-none shrink-0 font-medium rounded ${ROLE_BADGE_CLASSES[msg.senderRole] ?? ""}`}>
                    {ROLE_LABELS[msg.senderRole] ?? msg.senderRole}
                  </Badge>
                )}
              </div>
            )}
            <span className="text-[10px] text-muted-foreground">
              {format(new Date(msg.createdAt), "HH:mm")}
            </span>
            {isOwn && onDelete && (
              <button
                onClick={onDelete}
                className="text-[10px] text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              >
                delete
              </button>
            )}
          </div>
          <div
            className={`rounded-2xl px-3 py-1.5 text-sm leading-relaxed ${
              isOwn
                ? "bg-primary text-primary-foreground rounded-tr-sm"
                : "bg-card border border-border rounded-tl-sm"
            }`}
          >
            {msg.imageUrl && (
              <div 
                className="mb-2 max-w-sm rounded overflow-hidden cursor-zoom-in hover:brightness-90 transition-all duration-200"
                onClick={() => setIsZoomed(true)}
              >
                <img
                  src={msg.imageUrl}
                  alt="Chat attachment"
                  className="w-full h-auto object-cover max-h-60 rounded-lg border border-border/40"
                />
              </div>
            )}
            {msg.content}
          </div>
        </div>
      </div>

      <Dialog open={isZoomed} onOpenChange={setIsZoomed}>
        <DialogContent className="max-w-4xl p-1 bg-transparent border-0 shadow-none flex items-center justify-center">
          <div className="relative max-h-[90vh] max-w-full overflow-hidden rounded-lg">
            <img
              src={msg.imageUrl ?? undefined}
              alt="Zoomed attachment"
              className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-2xl border border-border/20"
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
    <Layout>
      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-4 h-[calc(100vh-12rem)]">
          <div className="w-72 flex flex-col gap-2 shrink-0">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-base text-foreground">Messages</h2>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() => setShowNewDm(true)}
                >
                  + DM
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() => setShowNewGroup(true)}
                >
                  + Group
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 pr-1">
              {convsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                    <Skeleton className="w-9 h-9 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-3 w-28 mb-1" />
                      <Skeleton className="h-2 w-20" />
                    </div>
                  </div>
                ))
              ) : conversations.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-8">
                  No conversations yet.
                  <br />
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
            </ScrollArea>
          </div>

          <div className="flex-1 flex flex-col rounded-xl border border-border bg-card/40 overflow-hidden">
            {selectedConv === null ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                Select a conversation to start chatting
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/60">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage
                        src={
                          selectedConv.type === "dm"
                            ? (selectedConv.otherAvatarUrl ?? undefined)
                            : (selectedConv.iconUrl ?? undefined)
                        }
                      />
                      <AvatarFallback className="text-xs">{getInitials(selectedName)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-sm">{selectedName}</p>
                      {selectedConv.type === "group" && (
                        <p className="text-xs text-muted-foreground">
                          {selectedConv.memberCount} members
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {selectedConv.type === "dm" && selectedConv.otherUserId && (
                      <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
                        <Link href={`/profile/${selectedConv.otherUserId}`}>Profile</Link>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        setCallType("voice");
                        setShowCall(true);
                      }}
                      title="Voice Call"
                    >
                      📞 Call
                    </Button>
                    {selectedConv.type === "group" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => setShowMembers(true)}
                      >
                        Members
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                      onClick={handleLeaveOrDelete}
                    >
                      {selectedConv.type === "group" && selectedConv.ownerId === me?.id
                        ? "Delete"
                        : "Leave"}
                    </Button>
                  </div>
                </div>

                <ScrollArea className="flex-1 px-4 py-3">
                  {msgsLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className={`flex gap-2 mb-3 ${i % 3 === 0 ? "flex-row-reverse" : ""}`}
                      >
                        <Skeleton className="w-7 h-7 rounded-full shrink-0" />
                        <Skeleton
                          className={`h-8 rounded-2xl ${i % 3 === 0 ? "w-32" : "w-48"}`}
                        />
                      </div>
                    ))
                  ) : messages.length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm py-8">
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
                          <div key={msg.id} className="flex flex-col gap-3 mb-3">
                            {showDivider && (
                              <div className="flex items-center justify-center my-4">
                                <div className="bg-muted text-muted-foreground text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider border border-border/40">
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

                <div className="px-4 py-3 border-t border-border bg-card/60">
                  {attachedImageUrl && (
                    <div className="relative mb-2 inline-block rounded-lg overflow-hidden border border-border bg-muted max-w-[120px] aspect-video">
                      <img src={attachedImageUrl} alt="Attachment preview" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setAttachedImageUrl(null)}
                        className="absolute top-1 right-1 bg-background/80 hover:bg-background text-foreground hover:text-destructive rounded-full w-5 h-5 flex items-center justify-center text-xs transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
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
                      className="hover:scale-105 transition-transform shrink-0"
                    >
                      {uploading ? (
                        <span className="animate-spin text-xs">⏳</span>
                      ) : (
                        <span className="text-lg">📷</span>
                      )}
                    </Button>
                    <Input
                      placeholder="Type a message…"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      className="bg-background"
                    />
                    <Button
                      onClick={handleSend}
                      disabled={(!messageText.trim() && !attachedImageUrl) || sendMessage.isPending || uploading}
                      className="bg-primary text-primary-foreground"
                    >
                      Send
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showNewDm} onOpenChange={setShowNewDm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Direct Message</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Search friends…"
            value={dmSearch}
            onChange={(e) => setDmSearch(e.target.value)}
            className="mb-3"
          />
          <ScrollArea className="h-64">
            {friends.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-6">
                No mutual friends yet. Follow someone and have them follow you back!
              </p>
            ) : filteredFriends.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-4">No results</p>
            ) : (
              filteredFriends.map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleStartDm(f.id)}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/40 text-left"
                >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={f.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {getInitials(f.displayName ?? f.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{f.displayName ?? f.username}</p>
                    <p className="text-xs text-muted-foreground">@{f.username} <span className="text-primary font-medium">{f.userTag}</span></p>
                  </div>
                </button>
              ))
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewGroup} onOpenChange={setShowNewGroup}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Group Chat</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="mb-3"
          />
          <p className="text-xs text-muted-foreground mb-2">Add members from your friends:</p>
          <ScrollArea className="h-48 mb-3">
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
                  className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-colors ${
                    checked ? "bg-primary/20" : "hover:bg-muted/40"
                  }`}
                >
                  <Avatar className="w-7 h-7">
                    <AvatarImage src={f.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {getInitials(f.displayName ?? f.username)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{f.displayName ?? f.username} <span className="text-xs text-primary">{f.userTag}</span></span>
                  {checked && <span className="ml-auto text-primary text-xs">✓</span>}
                </button>
              );
            })}
          </ScrollArea>
          <Button
            onClick={handleCreateGroup}
            disabled={!groupName.trim() || createGroup.isPending}
            className="w-full bg-primary text-primary-foreground"
          >
            Create Group
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={showMembers} onOpenChange={setShowMembers}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Group Members</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-48 mb-3">
            {members.map((m) => (
              <div key={m.userId} className="flex items-center gap-3 px-2 py-2">
                <Avatar className="w-7 h-7">
                  <AvatarImage src={m.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {getInitials(m.displayName ?? m.username)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm">{m.displayName ?? m.username}</p>
                  {selectedConv?.ownerId === m.userId && (
                    <p className="text-[10px] text-muted-foreground">Owner</p>
                  )}
                </div>
                {selectedConv?.ownerId === me?.id && m.userId !== me?.id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive"
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
          </ScrollArea>
          {selectedConv?.ownerId === me?.id && (
            <>
              <p className="text-xs text-muted-foreground mb-2">Add friends:</p>
              <Input
                placeholder="Search friends…"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="mb-2"
              />
              <ScrollArea className="h-36">
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
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/40 text-left"
                  >
                    <Avatar className="w-7 h-7">
                      <AvatarImage src={f.avatarUrl ?? undefined} />
                      <AvatarFallback className="text-[10px]">
                        {getInitials(f.displayName ?? f.username)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{f.displayName ?? f.username} <span className="text-xs text-primary">{f.userTag}</span></span>
                    <span className="ml-auto text-xs text-primary">+ Add</span>
                  </button>
                ))}
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
        <DialogContent className={`${callType ? "max-w-3xl h-[80vh]" : "max-w-md"} flex flex-col p-0 gap-0 overflow-hidden bg-card border-border transition-all duration-300`}>
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border bg-card/85">
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              {callType === "voice" ? "🎙️ Voice Call" : callType === "video" ? "📹 Video Call" : "📞 Establish Call Connection"}
              <span className="text-xs text-muted-foreground font-normal">— {selectedName}</span>
            </DialogTitle>
          </DialogHeader>

          {showCall && selectedId && (
            <>
              {!callType ? (
                <div className="p-6 space-y-6 text-center">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Choose your call mode. You will connect securely via the Arcadia Studio communications network.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setCallType("voice")}
                      className="flex flex-col items-center justify-center p-5 rounded-xl border border-border bg-card/60 hover:bg-primary/10 hover:border-primary text-foreground transition-all duration-200 group cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Phone className="w-6 h-6" />
                      </div>
                      <span className="font-bold text-sm">Voice Call</span>
                      <span className="text-[10px] text-muted-foreground mt-1">Audio only</span>
                    </button>

                    <button
                      onClick={() => setCallType("video")}
                      className="flex flex-col items-center justify-center p-5 rounded-xl border border-border bg-card/60 hover:bg-primary/10 hover:border-primary text-foreground transition-all duration-200 group cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Video className="w-6 h-6" />
                      </div>
                      <span className="font-bold text-sm">Video Call</span>
                      <span className="text-[10px] text-muted-foreground mt-1">Camera & Audio</span>
                    </button>
                  </div>

                  <div className="flex justify-center pt-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowCall(false)} className="text-xs text-muted-foreground hover:text-foreground">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
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
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
