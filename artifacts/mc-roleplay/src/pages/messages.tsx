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

const JITSI_BASE = "https://meet.jit.si/arcadia-studio-conv-";

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
          <span className="font-medium text-sm truncate">{name}</span>
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
  return (
    <div className={`flex gap-2 group ${isOwn ? "flex-row-reverse" : ""}`}>
      <Avatar className="w-7 h-7 shrink-0 mt-1">
        <AvatarImage src={msg.senderAvatarUrl ?? undefined} />
        <AvatarFallback className="text-[10px]">{getInitials(name)}</AvatarFallback>
      </Avatar>
      <div
        className={`max-w-[70%] flex flex-col gap-0.5 ${isOwn ? "items-end" : "items-start"}`}
      >
        <div className="flex items-center gap-2">
          {!isOwn && <span className="text-xs text-muted-foreground">{name}</span>}
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
          {msg.content}
        </div>
      </div>
    </div>
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
  const [groupName, setGroupName] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState<number[]>([]);
  const [dmSearch, setDmSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");

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

  async function handleSend() {
    if (!messageText.trim() || selectedId === null) return;
    try {
      await sendMessage.mutateAsync({ id: selectedId, data: { content: messageText.trim() } });
      setMessageText("");
      await queryClient.invalidateQueries({ queryKey: ["listMessages", selectedId] });
    } catch {
      toast({ title: "Failed to send message", variant: "destructive" });
    }
  }

  async function handleDeleteMessage(messageId: number) {
    if (!selectedId) return;
    try {
      await deleteMessage.mutateAsync({ id: selectedId, messageId });
      await queryClient.invalidateQueries({ queryKey: ["listMessages", selectedId] });
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
      await queryClient.invalidateQueries({ queryKey: ["listConversations"] });
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
      await queryClient.invalidateQueries({ queryKey: ["listConversations"] });
    } catch {
      toast({ title: "Failed to create group", variant: "destructive" });
    }
  }

  async function handleLeaveOrDelete() {
    if (!selectedId) return;
    try {
      await deleteConv.mutateAsync({ id: selectedId });
      setSelectedId(null);
      await queryClient.invalidateQueries({ queryKey: ["listConversations"] });
    } catch {
      toast({ title: "Failed to leave conversation", variant: "destructive" });
    }
  }

  const filteredFriends = friends.filter((f) => {
    const q = dmSearch.toLowerCase();
    return (
      f.username.toLowerCase().includes(q) ||
      (f.displayName ?? "").toLowerCase().includes(q)
    );
  });

  const filteredMembersSearch = friends.filter((f) => {
    if (members.some((m) => m.userId === f.id)) return false;
    const q = memberSearch.toLowerCase();
    return (
      f.username.toLowerCase().includes(q) ||
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
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => setShowCall(true)}
                      title="Voice / Video Call"
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
                    messages.map((msg) => (
                      <div key={msg.id} className="mb-3">
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
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </ScrollArea>

                <div className="px-4 py-3 border-t border-border bg-card/60">
                  <div className="flex gap-2">
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
                      disabled={!messageText.trim() || sendMessage.isPending}
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
                    <p className="text-xs text-muted-foreground">@{f.username}</p>
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
                  <span className="text-sm">{f.displayName ?? f.username}</span>
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
                        queryKey: ["listConversationMembers", selectedId],
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
                        queryKey: ["listConversationMembers", selectedId],
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
                    <span className="text-sm">{f.displayName ?? f.username}</span>
                    <span className="ml-auto text-xs text-primary">+ Add</span>
                  </button>
                ))}
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showCall} onOpenChange={setShowCall}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 pt-4 pb-2 border-b border-border">
            <DialogTitle className="text-sm">📞 Call — {selectedName}</DialogTitle>
          </DialogHeader>
          {showCall && selectedId && (
            <iframe
              src={`${JITSI_BASE}${selectedId}`}
              allow="camera; microphone; display-capture; fullscreen"
              className="flex-1 w-full border-0"
              title="Jitsi Call"
            />
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
