import { useState } from "react";
import {
  useListMembers,
  useGetMyFollowing,
  useGetMyFollowers,
  useFollowUser,
  useUnfollowUser,
  useGetMe,
  customFetch,
} from "@workspace/api-client-react";
import { useClerk } from "@clerk/react";
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
  Home
} from "lucide-react";

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
};

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function UserCard({ user, onFollowToggle }: { user: PublicUser; onFollowToggle: (user: PublicUser) => void }) {
  return (
    <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl overflow-hidden hover:border-violet-200 transition-all">
      <CardContent className="p-4 flex items-center gap-4">
        <Link href={`/profile/${user.id}`} className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center text-xl font-bold text-[#6366f1] shrink-0 overflow-hidden hover:ring-2 hover:ring-violet-500/25 transition">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
          ) : (
            getInitials(user.displayName || user.username)
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/profile/${user.id}`} className="block font-extrabold text-sm text-[#110e3d] truncate hover:text-[#6366f1] transition-colors">
            {user.displayName || user.username}
          </Link>
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

export default function Friends() {
  const { data: me, isLoading: meLoading } = useGetMe();
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
  const { signOut } = useClerk();
  const realmName = realmSettings.realmName || "Arcadia Guild";
  const realmLogoUrl = realmSettings.realmLogoUrl || "";

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
                  href="/messages"
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
            <Avatar className="h-9 w-9 border border-[#eae8f5]">
              <AvatarImage src={me?.avatarUrl || undefined} />
              <AvatarFallback className="text-xs bg-slate-100 font-extrabold text-[#6366f1]">
                {getInitials(me?.displayName || me?.username)}
              </AvatarFallback>
            </Avatar>
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

          <Tabs defaultValue="explore" className="space-y-6">
            <TabsList className="bg-white border border-[#eae8f5] p-1 rounded-xl shadow-sm h-11">
              <TabsTrigger value="explore" className="rounded-lg text-xs font-bold text-slate-500 data-[state=active]:bg-violet-50 data-[state=active]:text-[#6366f1]">Explore</TabsTrigger>
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
    </div>
  );
}
