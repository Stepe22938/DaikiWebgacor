import { useState } from "react";
import {
  useListMembers,
  useGetMyFollowing,
  useGetMyFollowers,
  useFollowUser,
  useUnfollowUser,
  useGetMe,
  useGetMyFriends,
  customFetch,
} from "@workspace/api-client-react";
import { useClerk, useUser } from "@clerk/react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
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
  QrCode,
  Pin,
  PinOff,
  Ban,
  UserX,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type PublicUser = {
  id: number;
  username: string;
  userTag: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  createdAt: string;
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
  equippedBorder?: string | null;
  equippedBadge?: string | null;
  equippedBackground?: string | null;
  pinnedAt?: string | null;
};

type BlockedUser = {
  id: number;
  userId: number;
  username: string;
  userTag: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  blockedAt: string;
};

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function getCosmeticBadgeName(value: string | null | undefined) {
  if (!value) return "";
  if (value.includes("bg-gradient-to-r from-red-500")) return "Gacha God 👑";
  if (value.includes("from-indigo-605") || value.includes("from-indigo-600")) return "Arcadia Emperor 🏰";
  if (value.includes("bg-sky-500")) return "Rich Citizen 💎";
  if (value.includes("bg-teal-700")) return "Server Helper 🛠️";
  if (value.includes("bg-indigo-500")) return "Guild Veteran ⚔️";
  if (value.includes("bg-amber-700")) return "Bounty Hunter 🏹";
  if (value.includes("bg-emerald-500")) return "Active Player 🏃";
  if (value.includes("bg-cyan-500")) return "Chatterbox 💬";
  if (value.includes("bg-slate-450") || value.includes("bg-slate-400")) return "Rookie Player 🥚";
  if (value.includes("bg-slate-300")) return "Newbie 🍃";
  return "Custom Tag";
}

function UserCard({ user, onFollowToggle }: { user: PublicUser; onFollowToggle: (user: PublicUser) => void }) {
  return (
    <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl overflow-hidden hover:border-violet-200 transition-all">
      <CardContent className="p-4 flex items-center gap-4">
        <Link 
          href={`/profile/${user.id}`} 
          className={`w-12 h-12 rounded-full bg-violet-50 flex items-center justify-center text-xl font-bold text-[#6366f1] shrink-0 overflow-hidden hover:ring-2 hover:ring-violet-500/25 transition ${user.equippedBorder || ""}`}
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover rounded-full" />
          ) : (
            getInitials(user.displayName || user.username)
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link href={`/profile/${user.id}`} className="font-extrabold text-sm text-[#110e3d] truncate hover:text-[#6366f1] transition-colors">
              {user.displayName || user.username}
            </Link>
            {user.equippedBadge && (
              <span className={`rounded px-1.5 py-0.2 text-[9px] font-black uppercase border tracking-wider shrink-0 ${user.equippedBadge}`}>
                {getCosmeticBadgeName(user.equippedBadge)}
              </span>
            )}
          </div>
          <Link href={`/profile/${user.id}`} className="block text-xs text-slate-400 font-bold hover:text-[#6366f1] transition-colors">
            @{user.username} <span className="text-[#6366f1] font-semibold">{user.userTag}</span>
          </Link>
          {user.bio && (
            <div className="text-xs text-slate-500 font-semibold mt-1 line-clamp-2 leading-relaxed">{user.bio}</div>
          )}
          <div className="text-[10px] text-slate-400 font-bold mt-1.5 flex items-center gap-1.5 flex-wrap">
            <span>{user.followerCount} followers</span>
            <span>·</span>
            <span>{user.followingCount} following</span>
            <span>·</span>
            <span>Joined {format(new Date(user.createdAt), "MMM yyyy")}</span>
          </div>
        </div>
        <Button
          variant={user.isFollowing ? "outline" : "default"}
          size="sm"
          onClick={() => onFollowToggle(user)}
          className={user.isFollowing
            ? "border-[#eae8f5] text-slate-500 hover:bg-red-50 hover:text-[#ef4444] hover:border-red-200 rounded-xl font-bold text-xs"
            : "bg-[#6366f1] text-white hover:bg-violet-700 rounded-xl font-bold text-xs shadow-md shadow-violet-500/10"
          }
        >
          {user.isFollowing ? "Unfollow" : "Follow"}
        </Button>
      </CardContent>
    </Card>
  );
}

function FriendCard({
  user,
  onPin,
  onBlock,
  pinLoading,
}: {
  user: PublicUser;
  onPin: (user: PublicUser) => void;
  onBlock: (user: PublicUser) => void;
  pinLoading?: boolean;
}) {
  const isPinned = !!user.pinnedAt;
  return (
    <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl overflow-hidden hover:border-violet-200 transition-all">
      <CardContent className="p-4 flex items-center gap-4">
        {isPinned && (
          <div className="absolute top-2 right-2 text-violet-400" title="Disematkan">
            <Pin className="w-3 h-3 fill-violet-400" />
          </div>
        )}
        <Link
          href={`/profile/${user.id}`}
          className={`w-12 h-12 rounded-full bg-violet-50 flex items-center justify-center text-xl font-bold text-[#6366f1] shrink-0 overflow-hidden hover:ring-2 hover:ring-violet-500/25 transition ${user.equippedBorder || ""}`}
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover rounded-full" />
          ) : (
            getInitials(user.displayName || user.username)
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link href={`/profile/${user.id}`} className="font-extrabold text-sm text-[#110e3d] truncate hover:text-[#6366f1] transition-colors">
              {user.displayName || user.username}
            </Link>
            {isPinned && <Pin className="w-3 h-3 text-violet-400 fill-violet-400 shrink-0" />}
            {user.equippedBadge && (
              <span className={`rounded px-1.5 py-0.2 text-[9px] font-black uppercase border tracking-wider shrink-0 ${user.equippedBadge}`}>
                {getCosmeticBadgeName(user.equippedBadge)}
              </span>
            )}
          </div>
          <Link href={`/profile/${user.id}`} className="block text-xs text-slate-400 font-bold hover:text-[#6366f1] transition-colors">
            @{user.username} <span className="text-[#6366f1] font-semibold">{user.userTag}</span>
          </Link>
          {user.bio && (
            <div className="text-xs text-slate-500 font-semibold mt-1 line-clamp-1 leading-relaxed">{user.bio}</div>
          )}
          <div className="text-[10px] text-slate-400 font-bold mt-1 flex items-center gap-1.5 flex-wrap">
            <span>{user.followerCount} followers</span>
            <span>·</span>
            <span>Joined {format(new Date(user.createdAt), "MMM yyyy")}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPin(user)}
            disabled={pinLoading}
            className={`h-7 px-2.5 rounded-lg text-[10px] font-bold flex items-center gap-1 border-[#eae8f5] transition-all ${
              isPinned ? "text-violet-600 bg-violet-50 border-violet-200 hover:bg-violet-100" : "text-slate-400 hover:text-violet-600 hover:bg-violet-50 hover:border-violet-200"
            }`}
          >
            {isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
            {isPinned ? "Unpin" : "Pin"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onBlock(user)}
            className="h-7 px-2.5 rounded-lg text-[10px] font-bold flex items-center gap-1 border-[#eae8f5] text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200 transition-all"
          >
            <Ban className="w-3 h-3" /> Blokir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Friends() {
  const { data: me, isLoading: meLoading } = useGetMe();
  const { user: clerkUser } = useUser();
  const { data: members, isLoading: membersLoading } = useListMembers();
  const { data: following, isLoading: followingLoading } = useGetMyFollowing();
  const { data: followers, isLoading: followersLoading } = useGetMyFollowers();
  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();
  const queryClient = useQueryClient();
  const { data: realmSettings = {} } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: () => customFetch<any>("/api/settings"),
  });
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showFriendQr, setShowFriendQr] = useState(false);
  const [friendQrUrl, setFriendQrUrl] = useState("");
  const [blockConfirmUser, setBlockConfirmUser] = useState<PublicUser | null>(null);
  const [pinLoading, setPinLoading] = useState<number | null>(null);
  const [blockedExpanded, setBlockedExpanded] = useState(false);

  const { data: friends = [], isLoading: friendsLoading, refetch: refetchFriends } = useGetMyFriends();
  const { data: blockedUsers = [], refetch: refetchBlocks } = useQuery<BlockedUser[]>({
    queryKey: ["/api/me/blocks"],
    queryFn: () => customFetch<BlockedUser[]>("/api/me/blocks"),
  });
  const { signOut } = useClerk();
  const realmName = realmSettings.realmName || "Arcadia Guild";
  const realmLogoUrl = realmSettings.realmLogoUrl || "";
  const selfDisplayName =
    me?.displayName?.trim() ||
    me?.username?.trim() ||
    clerkUser?.fullName?.trim() ||
    clerkUser?.username?.trim() ||
    clerkUser?.primaryEmailAddress?.emailAddress?.split("@")[0]?.trim() ||
    "Player";
  const selfAvatarUrl = me?.avatarUrl || clerkUser?.imageUrl || undefined;

  const handleCopyIP = () => {
    navigator.clipboard.writeText("play.arcadiamc.net");
    setCopied(true);
    toast({ title: "Copied!", description: "IP copied to clipboard: play.arcadiamc.net" });
    setTimeout(() => setCopied(false), 2000);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/members"] });
    queryClient.invalidateQueries({ queryKey: ["/api/me/following"] });
    queryClient.invalidateQueries({ queryKey: ["/api/me/followers"] });
    queryClient.invalidateQueries({ queryKey: ["/api/me/friends"] });
  };

  const handlePin = async (user: PublicUser) => {
    const isPinned = !!user.pinnedAt;
    setPinLoading(user.id);
    try {
      if (isPinned) {
        await customFetch(`/api/follows/${user.id}/pin`, { method: "DELETE" });
        toast({ title: "Unpin", description: `${user.displayName || user.username} dilepas dari sematan.` });
      } else {
        await customFetch(`/api/follows/${user.id}/pin`, { method: "POST" });
        toast({ title: "Disematkan!", description: `${user.displayName || user.username} disematkan di atas.` });
      }
      refetchFriends();
    } catch {
      toast({ title: "Error", description: "Gagal memperbarui sematan.", variant: "destructive" });
    } finally {
      setPinLoading(null);
    }
  };

  const handleBlock = async (user: PublicUser) => {
    try {
      await customFetch(`/api/blocks/${user.id}`, { method: "POST" });
      toast({ title: "Diblokir", description: `${user.displayName || user.username} telah diblokir. Pesan mereka tidak akan terlihat.` });
      refetchFriends();
      refetchBlocks();
    } catch {
      toast({ title: "Error", description: "Gagal memblokir pengguna.", variant: "destructive" });
    }
    setBlockConfirmUser(null);
  };

  const handleUnblock = async (userId: number, name: string) => {
    try {
      await customFetch(`/api/blocks/${userId}`, { method: "DELETE" });
      toast({ title: "Blokir dibatalkan", description: `${name} sudah tidak diblokir.` });
      refetchBlocks();
      refetchFriends();
    } catch {
      toast({ title: "Error", description: "Gagal membatalkan blokir.", variant: "destructive" });
    }
  };

  const handleFollowToggle = async (user: PublicUser) => {
    try {
      if (user.isFollowing) {
        await unfollowUser.mutateAsync({ userId: user.id });
        toast({ title: "Unfollowed", description: `You unfollowed ${user.displayName || user.username}.` });
      } else {
        await followUser.mutateAsync({ data: { userId: user.id } });
        toast({ title: "Following", description: `You are now following ${user.displayName || user.username}.` });
      }
      invalidate();
    } catch {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    }
  };

  const filteredMembers = members?.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.userTag.toLowerCase().includes(q) ||
      (u.displayName ?? "").toLowerCase().includes(q)
    );
  });

  if (meLoading) {
    return (
      <div className="p-8 text-slate-500 font-bold bg-[#f4f3f8] min-h-screen flex items-center justify-center">
        Loading Guild Portal...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f3f8] text-[#1e1b4b] flex font-sans antialiased">
      {/* ── Left Sidebar (Desktop) ────────────────────────────────────────── */}
      <aside className="w-64 bg-white border-r border-[#eae8f5] flex flex-col justify-between shrink-0 hidden md:flex">
        <div className="flex flex-col">
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
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all"
                >
                  <LayoutGrid className="w-4.5 h-4.5" /> Dashboard
                </Link>
                <Link
                  href="/member?tab=announcements"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all"
                >
                  <Megaphone className="w-4.5 h-4.5" /> Town Crier
                </Link>
                <Link
                  href="/member?tab=developments"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all"
                >
                  <Hammer className="w-4.5 h-4.5" /> The Forge
                </Link>
                <Link
                  href="/member?tab=tickets"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all"
                >
                  <Ticket className="w-4.5 h-4.5" /> Support Tickets
                </Link>
                <Link
                  href="/member?tab=forms"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all"
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
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all"
                >
                  <Home className="w-4.5 h-4.5" /> Home Page
                </Link>
                <Link
                  href="/member?tab=messages"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all"
                >
                  <MessageSquare className="w-4.5 h-4.5" /> Messages
                </Link>
                <Link
                  href="/friends"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold bg-violet-50 text-[#6366f1] transition-all"
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
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all"
                >
                  <User className="w-4.5 h-4.5" /> My Profile
                </Link>
                <Link
                  href="/member?tab=credits"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all"
                >
                  <ShieldAlert className="w-4.5 h-4.5" /> Arcadia Credits
                </Link>
              </nav>
            </div>
          </div>
        </div>

        {/* User Account Details Bottom Sidebar */}
        <div className="p-4 border-t border-[#eae8f5] space-y-3">
          <div className="flex items-center gap-3 px-2 py-1">
            <div className={`rounded-full shrink-0 flex items-center justify-center p-0.5 overflow-visible ${me?.equippedBorder ? me.equippedBorder : "border border-[#eae8f5]"}`}>
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={selfAvatarUrl} />
                <AvatarFallback className="text-xs bg-slate-100 font-extrabold text-[#6366f1]">
                  {getInitials(selfDisplayName)}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#110e3d] truncate">{selfDisplayName}</p>
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
                    href="/member?tab=messages"
                    onClick={() => setMobileSidebarOpen(false)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all"
                  >
                    <MessageSquare className="w-4.5 h-4.5" /> Messages
                  </Link>
                  <Link
                    href="/friends"
                    onClick={() => setMobileSidebarOpen(false)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold bg-violet-50 text-[#6366f1] transition-all"
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
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-[#eae8f5] px-6 flex items-center justify-between shrink-0">
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
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
              <span>Guild Portal</span>
              <span>/</span>
              <span className="text-[#110e3d]">Player Guild</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Copy IP Widget */}
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

        {/* Content Container */}
        <div className="flex-1 p-6 md:p-8 max-w-4xl w-full mx-auto space-y-6">
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-[#110e3d]">Player Guild</h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
              Find other adventurers and follow their journey
              {me && (
                <span className="ml-2 text-[#6366f1] font-semibold">
                  ({following?.length ?? 0} following · {followers?.length ?? 0} followers)
                </span>
              )}
            </p>
          </div>

          {me && (
            <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl overflow-hidden p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-xs font-black text-[#110e3d] uppercase tracking-wider flex items-center gap-1.5">
                  🤝 Share Your Invite Link
                </h3>
                <p className="text-xs font-bold text-slate-400">Let others scan your barcode or visit your link to instantly add you as a friend!</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <code className="text-[10px] font-mono bg-slate-50 text-slate-600 px-2.5 py-1 rounded-lg border border-slate-100 max-w-xs truncate">
                    {window.location.origin}/add-friend/{me.username}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/add-friend/${me.username}`);
                      toast({ title: "Copied!", description: "Add friend link copied to clipboard." });
                    }}
                    className="h-7 px-2.5 text-[10px] font-bold rounded-lg border-[#eae8f5] text-slate-500 hover:text-slate-700 hover:bg-slate-50 flex items-center gap-1 cursor-pointer h-7"
                  >
                    <Copy className="w-3 h-3" /> Copy Link
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFriendQrUrl(`${window.location.origin}/add-friend/${me.username}`);
                      setShowFriendQr(true);
                    }}
                    className="h-7 px-2.5 text-[10px] font-bold rounded-lg border-[#eae8f5] text-slate-500 hover:text-slate-700 hover:bg-slate-50 flex items-center gap-1 cursor-pointer h-7"
                  >
                    <QrCode className="w-3 h-3" /> Show QR
                  </Button>
                </div>
              </div>
            </Card>
          )}

          <Tabs defaultValue="explore" className="space-y-6">
            <TabsList className="bg-white border border-[#eae8f5] p-1 rounded-xl shadow-sm h-11 flex flex-wrap gap-0.5">
              <TabsTrigger value="explore" className="rounded-lg text-xs font-bold text-slate-500 data-[state=active]:bg-violet-50 data-[state=active]:text-[#6366f1]">Explore</TabsTrigger>
              <TabsTrigger value="friends" className="rounded-lg text-xs font-bold text-slate-500 data-[state=active]:bg-violet-50 data-[state=active]:text-[#6366f1]">Teman ({friends.length})</TabsTrigger>
              <TabsTrigger value="following" className="rounded-lg text-xs font-bold text-slate-500 data-[state=active]:bg-violet-50 data-[state=active]:text-[#6366f1]">Following ({following?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="followers" className="rounded-lg text-xs font-bold text-slate-500 data-[state=active]:bg-violet-50 data-[state=active]:text-[#6366f1]">Followers ({followers?.length ?? 0})</TabsTrigger>
            </TabsList>

            <TabsContent value="explore" className="space-y-4 outline-none">
              <Input
                placeholder="Search players by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-white border-[#eae8f5] focus-visible:ring-violet-500 rounded-xl text-slate-700 font-semibold"
              />
              {membersLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
                </div>
              ) : filteredMembers?.length === 0 ? (
                <div className="text-center py-16 bg-white border border-[#eae8f5] rounded-2xl text-slate-400 font-bold text-sm">
                  {search ? "No players found." : "No other players yet. Spread the word!"}
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredMembers?.map((user) => (
                    <UserCard key={user.id} user={user} onFollowToggle={handleFollowToggle} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="friends" className="space-y-4 outline-none">
              {friendsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
                </div>
              ) : friends.length === 0 ? (
                <div className="text-center py-16 bg-white border border-[#eae8f5] rounded-2xl text-slate-400 font-bold text-sm">
                  Belum ada teman. Follow seseorang dan minta mereka follow balik!
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Pinned friends */}
                  {friends.filter(f => !!f.pinnedAt).length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <Pin className="w-3 h-3 text-violet-400 fill-violet-400" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Disematkan</span>
                      </div>
                      <div className="grid gap-3">
                        {friends.filter(f => !!f.pinnedAt).map(user => (
                          <div key={user.id} className="relative">
                            <FriendCard
                              user={user as PublicUser}
                              onPin={handlePin}
                              onBlock={setBlockConfirmUser}
                              pinLoading={pinLoading === user.id}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Unpinned friends */}
                  {friends.filter(f => !f.pinnedAt).length > 0 && (
                    <div className="space-y-2">
                      {friends.filter(f => !!f.pinnedAt).length > 0 && (
                        <div className="flex items-center gap-2 px-1">
                          <Users className="w-3 h-3 text-slate-400" />
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Semua Teman</span>
                        </div>
                      )}
                      <div className="grid gap-3">
                        {friends.filter(f => !f.pinnedAt).map(user => (
                          <div key={user.id} className="relative">
                            <FriendCard
                              user={user as PublicUser}
                              onPin={handlePin}
                              onBlock={setBlockConfirmUser}
                              pinLoading={pinLoading === user.id}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Blocked section (collapsible) */}
                  {blockedUsers.length > 0 && (
                    <div className="border border-red-100 bg-red-50/40 rounded-2xl overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-50 transition-colors"
                        onClick={() => setBlockedExpanded(v => !v)}
                      >
                        <span className="flex items-center gap-2"><Ban className="w-3.5 h-3.5" /> Diblokir ({blockedUsers.length})</span>
                        {blockedExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      {blockedExpanded && (
                        <div className="px-4 pb-4 space-y-2">
                          {blockedUsers.map(bu => (
                            <div key={bu.id} className="flex items-center gap-3 bg-white border border-red-100 rounded-xl px-3 py-2.5">
                              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                                {bu.avatarUrl
                                  ? <img src={bu.avatarUrl} alt={bu.username} className="w-full h-full object-cover" />
                                  : <UserX className="w-4 h-4 text-slate-400" />
                                }
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-600 truncate">{bu.displayName || bu.username}</p>
                                <p className="text-[10px] text-slate-400">@{bu.username}{bu.userTag}</p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUnblock(bu.userId, bu.displayName || bu.username)}
                                className="h-7 px-2.5 rounded-lg text-[10px] font-bold border-red-200 text-red-500 hover:bg-red-50 transition-all"
                              >
                                Batal Blokir
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="following" className="space-y-4 outline-none">
              {followingLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
                </div>
              ) : following?.length === 0 ? (
                <div className="text-center py-16 bg-white border border-[#eae8f5] rounded-2xl text-slate-400 font-bold text-sm">
                  You're not following anyone yet. Go explore players!
                </div>
              ) : (
                <div className="grid gap-4">
                  {following?.map((user) => (
                    <UserCard key={user.id} user={user} onFollowToggle={handleFollowToggle} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="followers" className="space-y-4 outline-none">
              {followersLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
                </div>
              ) : followers?.length === 0 ? (
                <div className="text-center py-16 bg-white border border-[#eae8f5] rounded-2xl text-slate-400 font-bold text-sm">
                  No one is following you yet. Keep adventuring!
                </div>
              ) : (
                <div className="grid gap-4">
                  {followers?.map((user) => (
                    <UserCard key={user.id} user={user} onFollowToggle={handleFollowToggle} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Block Confirmation Dialog */}
      <AlertDialog open={!!blockConfirmUser} onOpenChange={(open) => { if (!open) setBlockConfirmUser(null); }}>
        <AlertDialogContent className="max-w-sm rounded-2xl bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-black text-[#110e3d] flex items-center gap-2">
              <Ban className="w-4 h-4 text-red-500" /> Blokir Pengguna?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500 font-semibold">
              Kamu tidak akan melihat pesan dari <strong>{blockConfirmUser?.displayName || blockConfirmUser?.username}</strong>.
              Mereka tidak akan dikeluarkan dari grup bersama, tapi pesannya akan tersembunyi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl text-xs font-bold border-[#eae8f5]">Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => blockConfirmUser && handleBlock(blockConfirmUser)}
              className="bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold"
            >
              Ya, Blokir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* QR Code Dialog */}
      <Dialog open={showFriendQr} onOpenChange={setShowFriendQr}>
        <DialogContent className="max-w-xs bg-white border border-[#eae8f5] rounded-3xl p-5 text-center flex flex-col items-center">
          <DialogHeader className="w-full">
            <DialogTitle className="text-sm font-extrabold text-[#110e3d]">
              📱 My Add Friend QR Code
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 font-bold">
              Let other players scan this code to follow you!
            </DialogDescription>
          </DialogHeader>

          {friendQrUrl && (
            <div className="mt-4 p-4 bg-white rounded-3xl border border-violet-100 shadow-xl flex items-center justify-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=6366f1&data=${encodeURIComponent(friendQrUrl)}`}
                alt="My QR Code"
                className="w-44 h-44"
              />
            </div>
          )}

          <div className="mt-4 w-full flex gap-2">
            <Button
              onClick={() => {
                if (friendQrUrl) {
                  navigator.clipboard.writeText(friendQrUrl);
                  toast({ title: "Copied!", description: "Add friend link copied." });
                }
              }}
              className="flex-1 bg-[#6366f1] text-white hover:bg-violet-700 rounded-xl text-xs font-bold h-9"
            >
              Copy Link
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowFriendQr(false)}
              className="flex-1 rounded-xl border-[#eae8f5] text-slate-500 hover:text-slate-700 text-xs font-bold h-9"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
