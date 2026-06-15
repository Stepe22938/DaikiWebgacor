import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useClerk } from "@clerk/react";
import {
  useFollowUser,
  useGetPublicProfileBadges,
  useGetPublicProfile,
  useGetPublicProfileFollowers,
  useGetPublicProfileFollowing,
  useGetMe,
  useListAnnouncements,
  useListDevelopments,
  useUnfollowUser,
} from "@workspace/api-client-react";
import type { Announcement, Badge, Development, PublicUser } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { format } from "date-fns";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  BellRing,
  CalendarDays,
  CheckCircle2,
  Flame,
  Home,
  ClipboardList,
  Hammer,
  LayoutGrid,
  LogOut,
  Megaphone,
  MessageSquare,
  Radio,
  ShieldCheck,
  TrendingUp,
  User,
  Users,
  Wrench,
  Ticket,
  ShieldAlert,
  Settings,
} from "lucide-react";

function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length > 1
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function getYouTubeVideoId(url: string | null | undefined) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    if (parsed.searchParams.get("v")) return parsed.searchParams.get("v");
    const parts = parsed.pathname.split("/").filter(Boolean);
    const marker = parts.findIndex((part) => ["live", "embed", "shorts"].includes(part));
    return marker >= 0 ? parts[marker + 1] ?? null : null;
  } catch {
    return null;
  }
}

function getYouTubeEmbedUrl(url: string | null | undefined) {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) return null;

  const params = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    controls: "0",
    loop: "1",
    playlist: videoId,
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    disablekb: "1",
    fs: "0",
    iv_load_policy: "3",
    showinfo: "0",
    origin: window.location.origin,
  });

  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

function getYouTubeThumbnailUrl(url: string | null | undefined) {
  const videoId = getYouTubeVideoId(url);
  return videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;
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

function YouTubeVideoBanner({ embedUrl, thumbnailUrl }: { embedUrl: string; thumbnailUrl: string | null }) {
  const [isVideoVisible, setIsVideoVisible] = useState(false);

  useEffect(() => {
    setIsVideoVisible(false);
    const timeout = window.setTimeout(() => setIsVideoVisible(true), 2600);
    return () => window.clearTimeout(timeout);
  }, [embedUrl]);

  return (
    <div className="relative aspect-[16/7] min-h-52 overflow-hidden bg-black">
      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${isVideoVisible ? "opacity-0" : "opacity-100"}`}
        />
      )}
      <iframe
        src={embedUrl}
        title="YouTube live banner"
        className={`pointer-events-none absolute left-1/2 top-1/2 h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-700 ${isVideoVisible ? "opacity-100" : "opacity-0"}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      />
    </div>
  );
}

function ProfileUserList({ users, emptyText }: { users: PublicUser[]; emptyText: string }) {
  if (users.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#d8deea] py-10 text-center text-sm font-semibold text-slate-500">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="divide-y divide-[#e9ecf5] overflow-hidden rounded-lg border border-[#e9ecf5] bg-white">
      {users.map((item) => (
        <Link
          key={item.id}
          href={`/profile/${item.id}`}
          className="flex items-center gap-3 p-3 transition-colors hover:bg-[#f5f7fb]"
        >
          <Avatar className="h-11 w-11 shrink-0">
            <AvatarImage src={item.avatarUrl ?? undefined} />
            <AvatarFallback className="bg-violet-50 text-xs font-black text-[#6d5dfc]">{getInitials(item.displayName || item.username)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-[#101828]">{item.displayName || item.username}</p>
            <p className="truncate text-xs font-semibold text-slate-500">
              @{item.username} <span className="font-black text-[#6d5dfc]">{item.userTag}</span>
            </p>
          </div>
          <div className="hidden text-right text-xs font-semibold text-slate-500 sm:block">
            <p>{item.followerCount} followers</p>
            <p>{item.followingCount} following</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

function ProfileBadges({ badges }: { badges: Badge[] }) {
  if (badges.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {badges.map((badge) => (
        <span
          key={badge.id}
          title={badge.description ?? badge.label}
          className="rounded border px-2 py-0.5 text-[11px] font-bold uppercase tracking-normal"
          style={{
            borderColor: badge.color,
            color: badge.color,
            backgroundColor: `${badge.color}22`,
          }}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}

const ROLE_LABELS: Record<PublicUser["role"], string> = {
  member: "Member",
  admin: "Admin",
  staff: "Staff",
  dev: "Developer",
  dev_website: "Dev Website",
};

const PRIVILEGED_ROLES: PublicUser["role"][] = ["admin", "staff", "dev", "dev_website"];
const DEV_ROLES: PublicUser["role"][] = ["dev", "dev_website"];
const ANNOUNCEMENT_COLORS = ["#6d5dfc", "#00a884", "#f59e0b", "#ef4444"];
const DEV_STATUS_COLORS: Record<Development["status"], string> = {
  planned: "#c4b5fd",
  in_progress: "#6d5dfc",
  completed: "#00a884",
  paused: "#f59e0b",
};

function matchesAnnouncementAuthor(announcement: Announcement, user: PublicUser) {
  if (announcement.authorId === user.id) return true;
  const authorName = announcement.authorName?.toLowerCase().trim();
  if (!authorName) return false;
  const username = user.username.toLowerCase();
  const displayName = user.displayName?.toLowerCase().trim();
  return authorName === username || authorName === displayName;
}

function getLastSixMonths() {
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: format(date, "MMM"),
      announcements: 0,
    };
  });
}

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "violet",
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: typeof Activity;
  tone?: "violet" | "green" | "amber" | "rose";
}) {
  const tones = {
    violet: "bg-violet-50 text-[#6d5dfc]",
    green: "bg-emerald-50 text-[#00a884]",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
  };

  return (
    <div className="rounded-lg border border-[#e9ecf5] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-black text-[#101828]">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-2 text-[11px] font-bold text-emerald-600">{helper}</p>
    </div>
  );
}

function ProfileSidebar() {
  const { signOut } = useClerk();
  const { data: me } = useGetMe();
  const { data: realmSettings = {} } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: () => customFetch<any>("/api/settings"),
  });
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const realmName = realmSettings.realmName || "Arcadia Guild";
  const realmLogoUrl = realmSettings.realmLogoUrl || "";
  const role = me?.role;
  const showAdminPortal = role && ["admin", "staff", "dev", "dev_website"].includes(role);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col justify-between border-r border-[#eae8f5] bg-white shadow-sm">
      <div className="flex min-h-0 flex-col">
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
        <div className="p-4 space-y-6 overflow-y-auto">
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
            <span className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest block">Social & Portal</span>
            <nav className="space-y-1">
              <Link
                href="/member"
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all"
              >
                <User className="w-4.5 h-4.5" /> Member Area
              </Link>
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
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all"
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
                href="/member?tab=settings"
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all"
              >
                <Settings className="w-4.5 h-4.5" /> Account Settings
              </Link>
              <Link
                href="/member?tab=credits"
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all"
              >
                <ShieldAlert className="w-4.5 h-4.5" /> Arcadia Credits
              </Link>
            </nav>
          </div>

          {showAdminPortal && (
            <div className="space-y-1.5">
              <span className="px-3 text-[10px] font-black text-amber-600 uppercase tracking-widest block">Management</span>
              <nav className="space-y-1">
                <Link
                  href="/admin"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-amber-600 hover:bg-amber-50 hover:text-amber-700 border border-amber-200/30 bg-amber-50/10"
                >
                  <ShieldAlert className="w-4.5 h-4.5 text-amber-500" /> Admin Portal
                </Link>
              </nav>
            </div>
          )}
        </div>
      </div>

      {/* User Account Details Bottom Sidebar */}
      <div className="p-4 border-t border-[#eae8f5] space-y-3 shrink-0 bg-white">
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
          onClick={() => signOut({ redirectUrl: basePath || "/" })}
          className="w-full justify-start gap-3 text-slate-500 hover:text-[#ef4444] hover:bg-red-50 rounded-xl py-2 px-3 text-xs font-bold h-9"
        >
          <LogOut className="w-4.5 h-4.5 text-[#ef4444]" /> Log out
        </Button>
      </div>
    </aside>
  );
}

function ProfileShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f5f7fb] text-[#101828]">
      <ProfileSidebar />
      <main className="min-h-screen pl-64">
        {children}
      </main>
    </div>
  );
}

export default function Profile() {
  const [, params] = useRoute("/profile/:id");
  const [location] = useLocation();
  const id = Number(params?.id ?? location.match(/\/profile\/(\d+)/)?.[1]) || 0;
  const { data: user, isLoading } = useGetPublicProfile(id);
  const { data: badges = [] } = useGetPublicProfileBadges(id);
  const { data: followers = [], isLoading: followersLoading } = useGetPublicProfileFollowers(id);
  const { data: following = [], isLoading: followingLoading } = useGetPublicProfileFollowing(id);
  const { data: announcements = [] } = useListAnnouncements();
  const { data: developments = [] } = useListDevelopments();
  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const embedUrl = getYouTubeEmbedUrl(user?.youtubeLiveUrl);
  const thumbnailUrl = getYouTubeThumbnailUrl(user?.youtubeLiveUrl);
  const privilegedProfile = user ? ["admin", "dev_website"].includes(user.role) : false;
  const devProfile = user ? DEV_ROLES.includes(user.role) : false;
  const authoredAnnouncements = user ? announcements.filter((announcement) => matchesAnnouncementAuthor(announcement, user)) : [];
  const pinnedAuthoredAnnouncements = authoredAnnouncements.filter((announcement) => announcement.pinned).length;
  const latestAnnouncement = authoredAnnouncements
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const announcementMonthData = getLastSixMonths().map((month) => {
    const count = authoredAnnouncements.filter((announcement) => {
      const createdAt = new Date(announcement.createdAt);
      return `${createdAt.getFullYear()}-${createdAt.getMonth()}` === month.key;
    }).length;
    return { ...month, announcements: count };
  });
  const announcementTypeData = ["update", "event", "maintenance", "general"].map((type) => ({
    name: type,
    value: authoredAnnouncements.filter((announcement) => announcement.type === type).length,
  }));
  const developmentStatusData = ["planned", "in_progress", "completed", "paused"].map((status) => ({
    name: status.replace("_", " "),
    value: developments.filter((development) => development.status === status).length,
    status: status as Development["status"],
  }));
  const activeDevelopments = developments.filter((development) => development.status === "planned" || development.status === "in_progress").length;
  const averageProgress = developments.length
    ? Math.round(developments.reduce((total, development) => total + (development.progress ?? 0), 0) / developments.length)
    : 0;
  const authorityScore = Math.min(100, authoredAnnouncements.length * 12 + pinnedAuthoredAnnouncements * 10 + badges.length * 6 + (user?.followerCount ?? 0) * 2);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/members/${id}`] });
    queryClient.invalidateQueries({ queryKey: ["/api/members"] });
    queryClient.invalidateQueries({ queryKey: ["/api/me/following"] });
    queryClient.invalidateQueries({ queryKey: ["/api/me/followers"] });
    queryClient.invalidateQueries({ queryKey: [`/api/members/${id}/followers`] });
    queryClient.invalidateQueries({ queryKey: [`/api/members/${id}/following`] });
    queryClient.invalidateQueries({ queryKey: [`/api/members/${id}/badges`] });
  };

  const toggleFollow = async () => {
    if (!user) return;
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

  if (isLoading) {
    return (
      <ProfileShell>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      </ProfileShell>
    );
  }

  if (!user) {
    return (
      <ProfileShell>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center text-slate-500">
          Profile tidak ditemukan.
        </div>
      </ProfileShell>
    );
  }

  return (
    <ProfileShell>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
              <Link href="/friends" className="hover:text-[#6d5dfc]">Player Guild</Link>
              <span>/</span>
              <span className="text-[#101828]">Profile Dashboard</span>
            </div>
            <Button
              onClick={toggleFollow}
              variant={user.isFollowing ? "outline" : "default"}
              className={user.isFollowing ? "rounded-lg border-[#e9ecf5] bg-white text-slate-600" : "rounded-lg bg-[#6d5dfc] text-white hover:bg-[#5847ea]"}
            >
              {user.isFollowing ? "Unfollow" : "Follow"}
            </Button>
          </div>

          <div className={`mt-6 grid gap-6 ${privilegedProfile ? "xl:grid-cols-[420px_minmax(0,1fr)]" : ""}`}>
          <div className="min-w-0 xl:order-2">
          <div className="overflow-hidden rounded-lg border border-[#e9ecf5] bg-white shadow-sm">
            <div className="relative min-h-64">
              {embedUrl ? (
                <YouTubeVideoBanner embedUrl={embedUrl} thumbnailUrl={thumbnailUrl} />
              ) : user.youtubeLiveUrl ? (
                <a
                  href={user.youtubeLiveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="relative flex aspect-[16/5] min-h-64 items-center justify-center overflow-hidden bg-[linear-gradient(135deg,_#281c79,_#6d5dfc_48%,_#00a884)]"
                >
                  <span className="rounded-lg bg-white px-4 py-2 text-sm font-extrabold text-[#6d5dfc] shadow-sm">
                    Open YouTube Live
                  </span>
                </a>
              ) : user.equippedBackground ? (
                <div className="aspect-[16/5] min-h-64 relative bg-black">
                  <img src={user.equippedBackground} alt="" className="absolute inset-0 h-full w-full object-cover" />
                </div>
              ) : (
                <div className="aspect-[16/5] min-h-64 bg-[linear-gradient(135deg,_#1f2937,_#6d5dfc_52%,_#00a884)]" />
              )}

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-5 sm:p-7">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex min-w-0 items-end gap-4 rounded-xl bg-white/95 p-3 pr-5 shadow-xl shadow-black/15 backdrop-blur sm:max-w-[62%]">
                    <div className={`rounded-full shrink-0 flex items-center justify-center bg-white p-1 overflow-visible ${user.equippedBorder || ""}`}>
                      <Avatar className="h-24 w-24 border-4 border-white bg-white shadow-lg">
                        <AvatarImage src={user.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-2xl font-black text-[#6d5dfc]">{getInitials(user.displayName || user.username)}</AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="min-w-0 pb-1 text-[#101828]">
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="max-w-full break-words text-3xl font-black leading-tight sm:text-4xl">{user.displayName || user.username}</h1>
                        <span className="rounded-lg bg-violet-50 px-2.5 py-1 text-[11px] font-black uppercase text-[#6d5dfc]">
                          {ROLE_LABELS[user.role]}
                        </span>
                        {user.equippedBadge && (
                          <span className={`rounded-lg px-2.5 py-1 text-[11px] font-black uppercase border tracking-wider ${user.equippedBadge}`}>
                            {getCosmeticBadgeName(user.equippedBadge)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-bold text-slate-500">
                        @{user.username} <span className="font-black text-[#6d5dfc]">{user.userTag}</span>
                      </p>
                      <ProfileBadges badges={badges} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-white/12 p-2 text-center text-white backdrop-blur">
                    <div className="px-3 py-2">
                      <p className="text-xl font-black">{user.followerCount}</p>
                      <p className="text-[10px] font-bold uppercase text-white/70">Followers</p>
                    </div>
                    <div className="px-3 py-2">
                      <p className="text-xl font-black">{user.followingCount}</p>
                      <p className="text-[10px] font-bold uppercase text-white/70">Following</p>
                    </div>
                    <div className="px-3 py-2">
                      <p className="text-xl font-black">{format(new Date(user.createdAt), "MMM")}</p>
                      <p className="text-[10px] font-bold uppercase text-white/70">Joined</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {user.bio && (
            <div className="mt-5 rounded-lg border border-[#e9ecf5] bg-white p-5 text-sm font-semibold leading-relaxed text-slate-600 shadow-sm">
              {user.bio}
            </div>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Followers" value={user.followerCount} helper="+ social reach tracked" icon={Users} />
            <StatCard label="Following" value={user.followingCount} helper="network connections" icon={Activity} tone="green" />
            <StatCard label="Badges" value={badges.length} helper="profile achievements" icon={ShieldCheck} tone="amber" />
            <StatCard label="Joined" value={format(new Date(user.createdAt), "MMM yyyy")} helper="account lifetime" icon={CalendarDays} tone="rose" />
          </div>

          <div className="mt-6 rounded-lg border border-[#e9ecf5] bg-white p-5 shadow-sm">
            <Tabs defaultValue="followers">
              <TabsList className="grid w-full grid-cols-2 rounded-lg bg-[#f5f7fb]">
                <TabsTrigger id="profile-followers" value="followers" className="text-slate-500 data-[state=active]:bg-white data-[state=active]:text-[#101828]">Followers ({followers.length})</TabsTrigger>
                <TabsTrigger id="profile-following" value="following" className="text-slate-500 data-[state=active]:bg-white data-[state=active]:text-[#101828]">Following ({following.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="followers" className="mt-4">
                {followersLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : (
                  <ProfileUserList users={followers} emptyText="Belum ada followers." />
                )}
              </TabsContent>
              <TabsContent value="following" className="mt-4">
                {followingLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : (
                  <ProfileUserList users={following} emptyText="Belum follow siapa pun." />
                )}
              </TabsContent>
            </Tabs>
          </div>
          </div>

          {privilegedProfile && (
            <aside className="space-y-5 self-start xl:sticky xl:top-6 xl:order-1">
              <div className="rounded-lg bg-[linear-gradient(135deg,_#6d5dfc,_#7c3aed_58%,_#00a884)] p-5 text-white shadow-lg shadow-violet-500/20">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/18">
                      <Flame className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-black">Staff Activity Overview</p>
                      <p className="text-xs font-semibold text-white/75">
                        Static public stats for announcements, pins, profile impact, and server roadmap visibility.
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-white px-4 py-2 text-sm font-black text-[#6d5dfc]">
                    Authority Score {authorityScore}/100
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <StatCard label="Announcements" value={authoredAnnouncements.length} helper={authoredAnnouncements.length ? "has posted announcements" : "no public announce yet"} icon={Megaphone} />
                <StatCard label="Pinned Posts" value={pinnedAuthoredAnnouncements} helper="priority broadcast count" icon={BellRing} tone="amber" />
                <StatCard label="Latest Announce" value={latestAnnouncement ? format(new Date(latestAnnouncement.createdAt), "dd MMM") : "-"} helper={latestAnnouncement ? "latest public broadcast" : "waiting for first post"} icon={Radio} tone="green" />
                <StatCard label="Roadmap Area" value={devProfile ? activeDevelopments : "View"} helper={devProfile ? "active server tasks" : "admin visibility"} icon={Wrench} tone="rose" />
              </div>

              <div className="grid gap-5">
                <div className="rounded-lg border border-[#e9ecf5] bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-[#101828]">Announcement Activity</p>
                      <p className="text-xs font-semibold text-slate-400">Posts authored by this profile over the last 6 months.</p>
                    </div>
                    <span className="rounded-lg border border-[#e9ecf5] px-3 py-1 text-[11px] font-black text-slate-500">Last 6 months</span>
                  </div>
                  <div className="mt-5 h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={announcementMonthData}>
                        <CartesianGrid vertical={false} stroke="#eef1f7" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 700 }} />
                        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                        <Tooltip cursor={{ fill: "#f4f2ff" }} />
                        <Bar dataKey="announcements" radius={[8, 8, 4, 4]} fill="#6d5dfc" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-lg border border-[#e9ecf5] bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-[#101828]">Announcement Type</p>
                      <p className="text-xs font-semibold text-slate-400">What kind of updates this profile posts.</p>
                    </div>
                    <TrendingUp className="h-5 w-5 text-[#6d5dfc]" />
                  </div>
                  <div className="mt-5 h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={announcementTypeData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={3}>
                          {announcementTypeData.map((item, index) => (
                            <Cell key={item.name} fill={ANNOUNCEMENT_COLORS[index % ANNOUNCEMENT_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {announcementTypeData.map((item, index) => (
                      <div key={item.name} className="rounded-lg bg-slate-50 px-3 py-2">
                        <p className="text-[10px] font-black uppercase text-slate-400">{item.name}</p>
                        <p className="text-lg font-black text-[#101828]" style={{ color: ANNOUNCEMENT_COLORS[index % ANNOUNCEMENT_COLORS.length] }}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-5">
                <div className="rounded-lg border border-[#e9ecf5] bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-[#101828]">Roadmap Snapshot</p>
                      <p className="text-xs font-semibold text-slate-400">Global development status visible to staff profiles.</p>
                    </div>
                    <span className="rounded-lg bg-emerald-50 px-3 py-1 text-[11px] font-black text-[#00a884]">{averageProgress}% avg</span>
                  </div>
                  <div className="mt-5 h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={developmentStatusData}>
                        <defs>
                          <linearGradient id="roadmapFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6d5dfc" stopOpacity={0.32} />
                            <stop offset="95%" stopColor="#6d5dfc" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke="#eef1f7" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 700 }} />
                        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="value" stroke="#6d5dfc" strokeWidth={3} fill="url(#roadmapFill)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-lg border border-[#e9ecf5] bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-[#101828]">Latest Staff Log</p>
                      <p className="text-xs font-semibold text-slate-400">Most recent announcement evidence for this profile.</p>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-[#00a884]" />
                  </div>
                  {latestAnnouncement ? (
                    <div className="mt-5 rounded-lg border border-[#e9ecf5] bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-[#6d5dfc] px-2 py-1 text-[10px] font-black uppercase text-white">{latestAnnouncement.type}</span>
                        {latestAnnouncement.pinned && <span className="rounded-md bg-amber-100 px-2 py-1 text-[10px] font-black uppercase text-amber-700">Pinned</span>}
                        <span className="text-[11px] font-bold text-slate-400">{format(new Date(latestAnnouncement.createdAt), "dd MMM yyyy")}</span>
                      </div>
                      <p className="mt-3 text-lg font-black text-[#101828]">{latestAnnouncement.title}</p>
                      <p className="mt-2 line-clamp-3 text-sm font-semibold leading-relaxed text-slate-500">{latestAnnouncement.content}</p>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-lg border border-dashed border-[#d8deea] bg-slate-50 p-8 text-center">
                      <p className="text-sm font-black text-[#101828]">Belum pernah announce</p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">Profile ini belum punya public announcement yang tercatat.</p>
                    </div>
                  )}
                </div>
              </div>
            </aside>
          )}
          </div>
        </div>
    </ProfileShell>
  );
}
