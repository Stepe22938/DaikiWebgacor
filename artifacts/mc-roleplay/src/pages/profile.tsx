import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { Layout } from "@/components/layout";
import {
  useFollowUser,
  useGetPublicProfileBadges,
  useGetPublicProfile,
  useGetPublicProfileFollowers,
  useGetPublicProfileFollowing,
  useUnfollowUser,
} from "@workspace/api-client-react";
import type { Badge, PublicUser } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

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
      <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="divide-y divide-border rounded-lg border border-border">
      {users.map((item) => (
        <Link
          key={item.id}
          href={`/profile/${item.id}`}
          className="flex items-center gap-3 p-3 transition-colors hover:bg-card/70"
        >
          <Avatar className="h-11 w-11 shrink-0">
            <AvatarImage src={item.avatarUrl ?? undefined} />
            <AvatarFallback className="text-xs font-bold">{getInitials(item.displayName || item.username)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{item.displayName || item.username}</p>
            <p className="truncate text-xs text-muted-foreground">
              @{item.username} <span className="font-medium text-primary">{item.userTag}</span>
            </p>
          </div>
          <div className="hidden text-right text-xs text-muted-foreground sm:block">
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

export default function Profile() {
  const [, params] = useRoute("/profile/:id");
  const [location] = useLocation();
  const id = Number(params?.id ?? location.match(/\/profile\/(\d+)/)?.[1]) || 0;
  const { data: user, isLoading } = useGetPublicProfile(id);
  const { data: badges = [] } = useGetPublicProfileBadges(id);
  const { data: followers = [], isLoading: followersLoading } = useGetPublicProfileFollowers(id);
  const { data: following = [], isLoading: followingLoading } = useGetPublicProfileFollowing(id);
  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const embedUrl = getYouTubeEmbedUrl(user?.youtubeLiveUrl);
  const thumbnailUrl = getYouTubeThumbnailUrl(user?.youtubeLiveUrl);

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
      <Layout>
        <div className="container mx-auto px-4 py-8 max-w-4xl space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 max-w-3xl text-center text-muted-foreground">
          Profile tidak ditemukan.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link href="/friends" className="text-sm text-muted-foreground hover:text-primary">
          Back to Player Guild
        </Link>

        <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
          {embedUrl ? (
            <YouTubeVideoBanner embedUrl={embedUrl} thumbnailUrl={thumbnailUrl} />
          ) : user.youtubeLiveUrl ? (
            <a
              href={user.youtubeLiveUrl}
              target="_blank"
              rel="noreferrer"
              className="relative flex aspect-[16/6] min-h-48 items-center justify-center overflow-hidden bg-[linear-gradient(135deg,_#7f1d1d,_#1f1b16_55%,_#d9a05b)]"
            >
              <span className="rounded bg-background/80 px-4 py-2 text-sm font-semibold text-foreground">
                Open YouTube Live
              </span>
            </a>
          ) : (
            <div className="aspect-[16/6] min-h-48 bg-[linear-gradient(135deg,_#241b13,_#11100e_55%,_#4a3721)]" />
          )}

          <Card className="rounded-none border-0 border-t border-border bg-card">
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="-mt-14 h-24 w-24 border-4 border-card bg-muted">
                    <AvatarImage src={user.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-2xl font-bold">{getInitials(user.displayName || user.username)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 pt-2">
                    <h1 className="truncate text-3xl font-bold text-foreground">{user.displayName || user.username}</h1>
                    <p className="text-sm text-muted-foreground">
                      @{user.username} <span className="font-medium text-primary">{user.userTag}</span>
                    </p>
                    <ProfileBadges badges={badges} />
                  </div>
                </div>

                <Button
                  onClick={toggleFollow}
                  variant={user.isFollowing ? "outline" : "default"}
                  className={user.isFollowing ? "border-border" : "bg-primary text-primary-foreground hover:bg-primary/90"}
                >
                  {user.isFollowing ? "Unfollow" : "Follow"}
                </Button>
              </div>

              <div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
                <a href="#profile-followers" className="rounded-md p-2 transition-colors hover:bg-background/40">
                  <p className="text-2xl font-bold text-foreground">{user.followerCount}</p>
                  <p className="text-xs text-muted-foreground">followers</p>
                </a>
                <a href="#profile-following" className="rounded-md p-2 transition-colors hover:bg-background/40">
                  <p className="text-2xl font-bold text-foreground">{user.followingCount}</p>
                  <p className="text-xs text-muted-foreground">following</p>
                </a>
                <div className="rounded-md p-2">
                  <p className="text-sm font-semibold text-foreground">{format(new Date(user.createdAt), "MMM yyyy")}</p>
                  <p className="text-xs text-muted-foreground">joined</p>
                </div>
              </div>

              {user.bio && (
                <p className="mt-5 whitespace-pre-wrap rounded-lg border border-border bg-background/40 p-4 text-sm leading-relaxed text-foreground/90">
                  {user.bio}
                </p>
              )}

              <Tabs defaultValue="followers" className="mt-6 border-t border-border pt-5">
                <TabsList className="grid w-full grid-cols-2 bg-background/40">
                  <TabsTrigger id="profile-followers" value="followers">Followers ({followers.length})</TabsTrigger>
                  <TabsTrigger id="profile-following" value="following">Following ({following.length})</TabsTrigger>
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
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
