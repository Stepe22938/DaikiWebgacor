import { useState } from "react";
import { Layout } from "@/components/layout";
import { useGetMe, useUpdateMe, useListAnnouncements, useListDevelopments } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Member() {
  const { data: user, isLoading: userLoading } = useGetMe();
  const { user: clerkUser } = useUser();
  const { data: announcements, isLoading: announcementsLoading } = useListAnnouncements();
  const { data: developments, isLoading: developmentsLoading } = useListDevelopments();
  const updateMe = useUpdateMe();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [username, setUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const updates: { displayName?: string; bio?: string; username?: string } = {};
      if (displayName.trim()) updates.displayName = displayName.trim();
      if (bio.trim() !== undefined) updates.bio = bio.trim();
      if (username.trim()) {
        updates.username = username.trim();
        await clerkUser?.update({ username: username.trim() });
      }
      if (Object.keys(updates).length > 0) {
        await updateMe.mutateAsync({ data: updates });
        await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      }
      toast({ title: "Profile updated", description: "Your profile has been saved." });
      setDisplayName("");
      setBio("");
      setUsername("");
    } catch {
      toast({ title: "Error", description: "Failed to update profile.", variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Error", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      await clerkUser?.updatePassword({ newPassword, currentPassword: currentPassword || undefined });
      toast({ title: "Password changed", description: "Your password has been updated." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to change password.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  };

  if (userLoading) {
    return (
      <Layout>
        <div className="container mx-auto p-8"><Skeleton className="h-[200px] w-full" /></div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-border">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Welcome back, {user?.displayName || user?.username}</h1>
            <p className="text-muted-foreground">Your player portal.</p>
          </div>
          {user?.role === 'admin' && (
            <Link href="/admin" className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/80 transition-colors">
              Admin Citadel
            </Link>
          )}
        </div>

        <Tabs defaultValue="announcements" className="space-y-8">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="announcements">Town Crier</TabsTrigger>
            <TabsTrigger value="developments">The Forge</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="announcements" className="space-y-4">
            {announcementsLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : announcements?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">The town is quiet today.</div>
            ) : (
              announcements?.map((ann) => (
                <Card key={ann.id} className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl text-primary flex items-center justify-between">
                      <span>{ann.title}</span>
                      <span className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">
                        {ann.type.toUpperCase()}
                      </span>
                    </CardTitle>
                    <div className="text-xs text-muted-foreground">
                      By {ann.authorName} • {format(new Date(ann.createdAt), 'MMM d, yyyy')}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{ann.content}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="developments" className="grid gap-4 md:grid-cols-2">
            {developmentsLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              developments?.map((dev) => (
                <Card key={dev.id} className="bg-card border-border flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-lg flex justify-between items-center">
                      {dev.title}
                      <span className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded">
                        {dev.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-between space-y-4">
                    <p className="text-sm text-muted-foreground">{dev.description}</p>
                    {dev.progress !== null && dev.progress !== undefined && (
                      <div className="space-y-1 mt-4">
                        <div className="flex justify-between text-xs">
                          <span>Progress</span>
                          <span>{dev.progress}%</span>
                        </div>
                        <Progress value={dev.progress} className="h-2" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="profile" className="space-y-6 max-w-xl">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-primary">Edit Profile</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Current username: <span className="text-foreground font-medium">{user?.username}</span>
                  {user?.displayName && <> · Display name: <span className="text-foreground font-medium">{user.displayName}</span></>}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder={user?.username ?? ""}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-input border-border"
                  />
                  <p className="text-xs text-muted-foreground">Unique name used to sign in and be found by others</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    placeholder={user?.displayName ?? "Optional display name"}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="bg-input border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    placeholder={user?.bio ?? "Tell the realm who you are..."}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="bg-input border-border resize-none"
                    rows={3}
                  />
                </div>
                <Button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {savingProfile ? "Saving..." : "Save Profile"}
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-primary">Change Password</CardTitle>
                <p className="text-sm text-muted-foreground">Leave current password empty if your account was created with OAuth</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    placeholder="Current password (if any)"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="bg-input border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Min. 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-input border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-input border-border"
                  />
                </div>
                <Button
                  onClick={handleChangePassword}
                  disabled={savingPassword || !newPassword}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {savingPassword ? "Updating..." : "Change Password"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
