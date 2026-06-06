import { useState } from "react";
import { Layout } from "@/components/layout";
import {
  useListMembers,
  useGetMyFollowing,
  useGetMyFollowers,
  useFollowUser,
  useUnfollowUser,
} from "@workspace/api-client-react";
import { useGetMe } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Link } from "wouter";

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

function UserCard({ user, onFollowToggle }: { user: PublicUser; onFollowToggle: (user: PublicUser) => void }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 flex items-center gap-4">
        <Link href={`/profile/${user.id}`} className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-xl font-bold text-primary shrink-0 overflow-hidden hover:ring-2 hover:ring-primary/70 transition">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
          ) : (
            (user.displayName || user.username).charAt(0).toUpperCase()
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/profile/${user.id}`} className="block font-semibold text-foreground truncate hover:text-primary transition-colors">
            {user.displayName || user.username}
          </Link>
          <Link href={`/profile/${user.id}`} className="block text-xs text-muted-foreground hover:text-primary transition-colors">
            @{user.username} <span className="text-primary font-medium">{user.userTag}</span>
          </Link>
          {user.bio && (
            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{user.bio}</div>
          )}
          <div className="text-xs text-muted-foreground mt-1">
            <span>{user.followerCount} followers</span>
            <span className="mx-1">·</span>
            <span>{user.followingCount} following</span>
            <span className="mx-1">·</span>
            <span>Joined {format(new Date(user.createdAt), "MMM yyyy")}</span>
          </div>
        </div>
        <Button
          variant={user.isFollowing ? "outline" : "default"}
          size="sm"
          onClick={() => onFollowToggle(user)}
          className={user.isFollowing
            ? "border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
          }
        >
          {user.isFollowing ? "Unfollow" : "Follow"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Friends() {
  const { data: me } = useGetMe();
  const { data: members, isLoading: membersLoading } = useListMembers();
  const { data: following, isLoading: followingLoading } = useGetMyFollowing();
  const { data: followers, isLoading: followersLoading } = useGetMyFollowers();
  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

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

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8 pb-4 border-b border-border">
          <h1 className="text-3xl font-bold text-foreground">Player Guild</h1>
          <p className="text-muted-foreground mt-1">
            Find other adventurers and follow their journey.
            {me && (
              <span className="ml-2 text-primary font-medium">
                {following?.length ?? 0} following · {followers?.length ?? 0} followers
              </span>
            )}
          </p>
        </div>

        <Tabs defaultValue="explore" className="space-y-6">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="explore">Explore</TabsTrigger>
            <TabsTrigger value="following">Following ({following?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="followers">Followers ({followers?.length ?? 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="explore" className="space-y-4">
            <Input
              placeholder="Search players by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-input border-border"
            />
            {membersLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
            ) : filteredMembers?.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                {search ? "No players found." : "No other players yet. Spread the word!"}
              </div>
            ) : (
              filteredMembers?.map((user) => (
                <UserCard key={user.id} user={user} onFollowToggle={handleFollowToggle} />
              ))
            )}
          </TabsContent>

          <TabsContent value="following" className="space-y-4">
            {followingLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
            ) : following?.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                You're not following anyone yet. Go explore players!
              </div>
            ) : (
              following?.map((user) => (
                <UserCard key={user.id} user={user} onFollowToggle={handleFollowToggle} />
              ))
            )}
          </TabsContent>

          <TabsContent value="followers" className="space-y-4">
            {followersLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
            ) : followers?.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                No one is following you yet. Keep adventuring!
              </div>
            ) : (
              followers?.map((user) => (
                <UserCard key={user.id} user={user} onFollowToggle={handleFollowToggle} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
