import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useGetMe, useUpdateMe, useListAnnouncements, useListDevelopments, useGetMySettings, useUpdateMySettings, useListTickets, useCreateTicket, useUpdateTicket, useListTicketMessages, useSendTicketMessage, getListTicketMessagesQueryOptions, useListForms, useGetForm, useSubmitVote, useSubmitForm, useGetMyFormResponse, customFetch, useListCredits, useListTicketReasons } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function Member() {
  const { data: user, isLoading: userLoading } = useGetMe();
  const { user: clerkUser } = useUser();
  const { data: announcements, isLoading: announcementsLoading } = useListAnnouncements();
  const { data: developments, isLoading: developmentsLoading } = useListDevelopments();
  const updateMe = useUpdateMe();
  const { data: settings } = useGetMySettings();
  const updateSettings = useUpdateMySettings();
  const { data: tickets = [], isLoading: ticketsLoading } = useListTickets();
  const { data: ticketReasons = [], isLoading: ticketReasonsLoading } = useListTicketReasons();
  const createTicket = useCreateTicket();
  const updateTicket = useUpdateTicket();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [ticketReason, setTicketReason] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [selectedTicketChat, setSelectedTicketChat] = useState<any | null>(null);

  useEffect(() => {
    if (!ticketReason && ticketReasons.length > 0) {
      setTicketReason(ticketReasons[0].label);
    }
  }, [ticketReason, ticketReasons]);

  const handleUpdatePrivacy = async (value: string) => {
    try {
      await updateSettings.mutateAsync({ data: { messagePrivacy: value as any } });
      await queryClient.invalidateQueries({ queryKey: ["/api/me/settings"] });
      toast({ title: "Privacy settings updated", description: "Your messaging privacy has been updated." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update privacy settings.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleCreateTicket = async () => {
    if (ticketDescription.trim().length < 5) {
      toast({ title: "Error", description: "Deskripsi minimal 5 karakter.", variant: "destructive" });
      return;
    }
    if (!ticketReason) {
      toast({ title: "Error", description: "Pilih alasan tiket dulu.", variant: "destructive" });
      return;
    }
    setSubmittingTicket(true);
    try {
      await createTicket.mutateAsync({
        data: {
          reason: ticketReason,
          description: ticketDescription.trim(),
        },
      });
      toast({ title: "Success", description: "Tiket berhasil dibuat." });
      setTicketDescription("");
      setTicketReason(ticketReasons[0]?.label ?? "");
      setTicketDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal membuat tiket.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSubmittingTicket(false);
    }
  };

  const handleCloseTicket = async (ticketId: number) => {
    try {
      await updateTicket.mutateAsync({
        id: ticketId,
        data: { status: "closed" },
      });
      toast({ title: "Success", description: "Tiket berhasil ditutup." });
      await queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menutup tiket.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [username, setUsername] = useState("");
  const [youtubeLiveUrl, setYoutubeLiveUrl] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any | null>(null);

  const handleSaveProfile = async () => {
    if (!displayName.trim() && bio === "" && !username.trim() && youtubeLiveUrl === "") {
      toast({ title: "Nothing to save", description: "Fill in at least one field to update." });
      return;
    }
    setSavingProfile(true);
    try {
      const apiUpdates: { displayName?: string; bio?: string; username?: string; youtubeLiveUrl?: string } = {};
      if (displayName.trim()) apiUpdates.displayName = displayName.trim();
      if (bio !== "") apiUpdates.bio = bio;
      if (username.trim()) apiUpdates.username = username.trim();
      if (youtubeLiveUrl !== "") apiUpdates.youtubeLiveUrl = youtubeLiveUrl.trim();

      if (Object.keys(apiUpdates).length > 0) {
        await updateMe.mutateAsync({ data: apiUpdates });
        await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      }

      toast({ title: "Profile updated", description: "Your profile has been saved." });
      setDisplayName("");
      setBio("");
      setUsername("");
      setYoutubeLiveUrl("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update profile.";
      toast({ title: "Error", description: msg, variant: "destructive" });
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
            <h1 className="text-3xl font-bold text-foreground">
              Welcome back, {user?.displayName || user?.username} <span className="text-xl text-primary">{user?.userTag}</span>
            </h1>
            <p className="text-muted-foreground">Your player portal.</p>
          </div>
          {["admin", "staff", "dev"].includes(user?.role ?? "") && (
            <Link href="/admin" className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/80 transition-colors">
              Admin Arcadia
            </Link>
          )}
        </div>

        <Tabs defaultValue="announcements" className="space-y-8">
          <TabsList className="bg-card border border-border flex-wrap h-auto gap-y-1">
            <TabsTrigger value="announcements">Town Crier</TabsTrigger>
            <TabsTrigger value="developments">The Forge</TabsTrigger>
            <TabsTrigger value="tickets">Tiket Bantuan</TabsTrigger>
            <TabsTrigger value="forms">🗳️ Voting & Formulir</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="credits">🛡️ Credits</TabsTrigger>
          </TabsList>

          <TabsContent value="announcements" className="space-y-4">
            {announcementsLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : announcements?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">The town is quiet today.</div>
            ) : (
              announcements?.map((ann) => (
                <Card 
                  key={ann.id} 
                  className="bg-card border-border hover:border-primary/40 hover:shadow-lg transition-all duration-300 cursor-pointer hover:scale-[1.01] active:scale-[0.99] group"
                  onClick={() => setSelectedAnnouncement(ann)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl text-primary flex items-center justify-between group-hover:text-amber-400 transition-colors">
                      <span>{ann.title}</span>
                      <span className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                        {ann.type.toUpperCase()}
                      </span>
                    </CardTitle>
                    <div className="text-xs text-muted-foreground">
                      By {ann.authorName} â€¢ {format(new Date(ann.createdAt), 'MMM d, yyyy')}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap line-clamp-3 text-muted-foreground group-hover:text-foreground/90 transition-colors">{ann.content}</p>
                    {ann.content.length > 200 && (
                      <span className="text-xs text-primary/80 group-hover:text-primary font-semibold mt-2 inline-block">
                        Read details...
                      </span>
                    )}
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

          <TabsContent value="tickets" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Tiket Bantuan</h2>
                <p className="text-sm text-muted-foreground">Kirim atau kelola tiket bantuan moderator Anda.</p>
              </div>
              <Button onClick={() => setTicketDialogOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
                + Buat Tiket
              </Button>
            </div>

            {ticketsLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : tickets.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground border border-border rounded-xl bg-card/20">
                Belum ada tiket bantuan. Butuh bantuan? Silakan klik tombol di atas.
              </div>
            ) : (
              <div className="space-y-4">
                {tickets.map((t) => (
                  <Card key={t.id} className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start gap-4 flex-wrap">
                        <div className="space-y-1">
                          <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <span>#{t.id} - {t.reason}</span>
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            Dibuat pada: {format(new Date(t.createdAt), "dd MMM yyyy, HH:mm")}
                          </p>
                        </div>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                          t.status === "open"
                            ? "bg-yellow-900/40 text-yellow-300 border-yellow-800/40"
                            : t.status === "in_progress"
                            ? "bg-blue-900/40 text-blue-300 border-blue-800/40"
                            : t.status === "resolved"
                            ? "bg-green-900/40 text-green-300 border-green-800/40"
                            : "bg-gray-700/40 text-gray-400 border-gray-600/40"
                        }`}>
                          {t.status === "open" && "Terbuka"}
                          {t.status === "in_progress" && "Sedang Ditangani"}
                          {t.status === "resolved" && "Selesai"}
                          {t.status === "closed" && "Ditutup"}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-foreground/90 whitespace-pre-wrap">{t.description}</p>
                      
                      <div className="flex justify-between items-center gap-4 flex-wrap pt-2 border-t border-border/40 text-xs text-muted-foreground">
                        <div>
                          {t.adminId ? (
                            <span>Ditangani oleh: <strong className="text-foreground">{t.adminDisplayName || t.adminUsername}</strong></span>
                          ) : (
                            <span className="italic text-yellow-500/90">Menunggu respon moderator...</span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" className="h-7 px-3 text-[11px]" onClick={() => setSelectedTicketChat(t)}>
                            Detail & Balas
                          </Button>
                          {t.status !== "closed" && t.status !== "resolved" && (
                            <Button size="sm" variant="outline" className="h-7 px-2 border-destructive/40 text-destructive hover:bg-destructive/10 text-[11px]" onClick={() => handleCloseTicket(t.id)}>
                              Tutup Tiket
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* â”€â”€ Voting & Formulir Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <TabsContent value="forms" className="space-y-4">
            <FormsTab />
          </TabsContent>

          <TabsContent value="profile" className="space-y-6 max-w-xl">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-primary">Edit Profile</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Handle: <span className="text-foreground font-medium">@{user?.username}</span>
                  {user?.userTag && <> <span className="text-primary font-medium">{user.userTag}</span></>}
                  {user?.displayName && <> Â· Display name: <span className="text-foreground font-medium">{user.displayName}</span></>}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Handle</Label>
                  <Input
                    id="username"
                    placeholder={user?.username ?? ""}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-input border-border"
                  />
                  <p className="text-xs text-muted-foreground">Handle publik. Nama yang sama boleh dipakai karena dibedakan oleh tagar.</p>
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
                <div className="space-y-2">
                  <Label htmlFor="youtubeLiveUrl">YouTube Live Banner</Label>
                  <Input
                    id="youtubeLiveUrl"
                    placeholder={user?.youtubeLiveUrl ?? "https://www.youtube.com/watch?v=..."}
                    value={youtubeLiveUrl}
                    onChange={(e) => setYoutubeLiveUrl(e.target.value)}
                    className="bg-input border-border"
                  />
                  <p className="text-xs text-muted-foreground">Link YouTube ini akan tampil sebagai banner di profile publik. Kosongkan lalu save untuk menghapus.</p>
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

            <Card className="bg-card border-border mt-6">
              <CardHeader>
                <CardTitle className="text-primary">Messaging Privacy</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Control who can start a direct message conversation with you.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="messagePrivacy">Who can send you messages?</Label>
                  <Select
                    value={settings?.messagePrivacy ?? "friends_only"}
                    onValueChange={handleUpdatePrivacy}
                  >
                    <SelectTrigger id="messagePrivacy" className="bg-input border-border w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border border-border">
                      <SelectItem value="everyone">Everyone</SelectItem>
                      <SelectItem value="following_only">People I Follow</SelectItem>
                      <SelectItem value="friends_only">Mutual Friends (Followers who follow back)</SelectItem>
                      <SelectItem value="nobody">Nobody</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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

          <TabsContent value="credits" className="space-y-4">
            <CreditsTab />
          </TabsContent>
        </Tabs>
      </div>

      {/* Announcement Detail Modal */}
      <Dialog open={selectedAnnouncement !== null} onOpenChange={() => setSelectedAnnouncement(null)}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedAnnouncement && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 bg-primary/20 text-primary border border-primary/20 rounded">
                    {selectedAnnouncement.type}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(selectedAnnouncement.createdAt), 'MMMM d, yyyy')}
                  </span>
                </div>
                <DialogTitle className="text-2xl font-black text-foreground leading-tight">
                  {selectedAnnouncement.title}
                </DialogTitle>
                <div className="text-xs text-muted-foreground mt-1">
                  By <span className="text-foreground font-semibold">{selectedAnnouncement.authorName}</span>
                </div>
              </DialogHeader>
              <div className="border-t border-border/60 my-4 pt-4">
                <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  {selectedAnnouncement.content}
                </p>
              </div>
              <DialogFooter>
                <Button onClick={() => setSelectedAnnouncement(null)} className="bg-secondary text-secondary-foreground hover:bg-secondary/80 font-bold">
                  Close Announcement
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Ticket Create Dialog */}
      <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-primary">Buat Tiket Bantuan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="reason">Alasan Tiket</Label>
              <Select
                value={ticketReason}
                onValueChange={setTicketReason}
              >
                <SelectTrigger id="reason" className="bg-input border-border w-full">
                  <SelectValue placeholder={ticketReasonsLoading ? "Loading..." : "Pilih alasan"} />
                </SelectTrigger>
                <SelectContent className="bg-card border border-border">
                  {ticketReasons.map((reason) => (
                    <SelectItem key={reason.id} value={reason.label}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {ticketReasons.length === 0 && (
                <p className="text-[10px] text-destructive">Belum ada alasan tiket aktif. Hubungi admin.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Deskripsi Kejadian / Bantuan</Label>
              <Textarea
                id="description"
                placeholder="Tuliskan kronologi atau detail bantuan yang Anda butuhkan..."
                value={ticketDescription}
                onChange={(e) => setTicketDescription(e.target.value)}
                className="bg-input border-border resize-none"
                rows={4}
              />
              <p className="text-[10px] text-muted-foreground">Minimal 5 karakter.</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-border" onClick={() => setTicketDialogOpen(false)}>Batal</Button>
            <Button onClick={handleCreateTicket} disabled={submittingTicket || !ticketReason || ticketDescription.trim().length < 5} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {submittingTicket ? "Mengirim..." : "Kirim Tiket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticket Chat Dialog */}
      <Dialog open={selectedTicketChat !== null} onOpenChange={(open) => { if (!open) setSelectedTicketChat(null); }}>
        <DialogContent className="bg-card border-border max-w-lg flex flex-col h-[80vh] p-0 overflow-hidden">
          {selectedTicketChat && (
            <TicketChatContent ticket={selectedTicketChat} onClose={() => setSelectedTicketChat(null)} />
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

interface TicketChatContentProps {
  ticket: any;
  onClose: () => void;
}

function TicketChatContent({ ticket, onClose }: TicketChatContentProps) {
  const { data: messages = [], isLoading } = useListTicketMessages(ticket.id, {
    query: {
      ...getListTicketMessagesQueryOptions(ticket.id),
      refetchInterval: 3000,
    }
  });
  const sendMessage = useSendTicketMessage();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [replyText, setReplyText] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    try {
      await sendMessage.mutateAsync({
        id: ticket.id,
        data: { content: replyText.trim() },
      });
      setReplyText("");
      await queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticket.id}/messages`] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengirim pesan.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  return (
    <>
      <DialogHeader className="px-5 pt-5 pb-3 border-b border-border bg-card/85">
        <div className="flex justify-between items-start gap-4 flex-wrap">
          <div>
            <DialogTitle className="text-primary font-bold">
              #{ticket.id} - {ticket.reason}
            </DialogTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Dibuat pada: {format(new Date(ticket.createdAt), "dd MMM yyyy, HH:mm")}
            </p>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
            ticket.status === "open"
              ? "bg-yellow-900/40 text-yellow-300 border-yellow-800/40"
              : ticket.status === "in_progress"
              ? "bg-blue-900/40 text-blue-300 border-blue-800/40"
              : ticket.status === "resolved"
              ? "bg-green-900/40 text-green-300 border-green-800/40"
              : "bg-gray-700/40 text-gray-400 border-gray-600/40"
          }`}>
            {ticket.status === "open" && "Terbuka"}
            {ticket.status === "in_progress" && "Diproses"}
            {ticket.status === "resolved" && "Selesai"}
            {ticket.status === "closed" && "Ditutup"}
          </span>
        </div>
      </DialogHeader>

      <ScrollArea className="flex-1 p-4 bg-muted/20">
        <div className="space-y-4">
          {/* Main Description */}
          <div className="bg-card border border-border p-3.5 rounded-xl">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Deskripsi Awal</p>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
          </div>

          <div className="border-t border-border/40 my-4" />

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-3/4 rounded-2xl" />
              <Skeleton className="h-10 w-2/3 rounded-2xl ml-auto" />
              <Skeleton className="h-10 w-1/2 rounded-2xl" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground bg-card/10 border border-dashed border-border rounded-lg">
              Belum ada percakapan. Hubungi moderator dengan mengirim pesan di bawah.
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg: any) => {
                const isCreator = msg.senderId === ticket.creatorId;

                return (
                  <div key={msg.id} className={`flex gap-2.5 ${isCreator ? "flex-row-reverse" : ""}`}>
                    <Avatar className="w-6 h-6 shrink-0 mt-0.5">
                      <AvatarImage src={msg.senderAvatarUrl ?? undefined} />
                      <AvatarFallback className="text-[9px] bg-muted">{getInitials(msg.senderDisplayName || msg.senderUsername)}</AvatarFallback>
                    </Avatar>
                    <div className={`max-w-[75%] flex flex-col gap-0.5 ${isCreator ? "items-end" : "items-start"}`}>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span className="font-semibold text-foreground/80">{msg.senderDisplayName || msg.senderUsername}</span>
                        <span>{format(new Date(msg.createdAt), "HH:mm")}</span>
                      </div>
                      <div className={`rounded-xl px-3 py-2 text-xs leading-relaxed ${
                        isCreator
                          ? "bg-primary text-primary-foreground rounded-tr-none"
                          : "bg-card border border-border rounded-tl-none"
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-border bg-card/70 backdrop-blur-md">
        <div className="flex gap-2">
          <Input
            placeholder={ticket.status === "closed" || ticket.status === "resolved" ? "Tiket sudah ditutup..." : "Ketik pesan balasan..."}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            disabled={ticket.status === "closed" || ticket.status === "resolved"}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendReply();
              }
            }}
            className="bg-background"
          />
          <Button
            onClick={handleSendReply}
            disabled={!replyText.trim() || ticket.status === "closed" || ticket.status === "resolved" || sendMessage.isPending}
            className="bg-primary text-primary-foreground font-semibold px-4"
          >
            Kirim
          </Button>
        </div>
      </div>
    </>
  );
}


// â”€â”€ FormsTab: Voting & Formulir for Members â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function FormsTab() {
  const { data: forms = [], isLoading } = useListForms();
  const [selectedForm, setSelectedForm] = useState<any | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-28 bg-card border border-border rounded-xl animate-pulse" />
        <div className="h-28 bg-card border border-border rounded-xl animate-pulse" />
      </div>
    );
  }

  if (forms.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <div className="text-4xl mb-3">🗳️</div>
        <p className="text-sm">Belum ada voting atau formulir aktif saat ini.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4">
        {forms.map((form: any) => (
          <div
            key={form.id}
            className="bg-card border border-border rounded-xl p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
            onClick={() => setSelectedForm(form)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${form.type === "poll" ? "bg-violet-900/40 text-violet-300 border-violet-800/40" : "bg-blue-900/40 text-blue-300 border-blue-800/40"}`}>
                    {form.type === "poll" ? "🗳️ VOTING" : "📋 FORMULIR"}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${form.status === "open" ? "bg-green-900/40 text-green-300 border-green-800/40" : "bg-gray-700/40 text-gray-400 border-gray-600/40"}`}>
                    {form.status === "open" ? "Buka" : "Tutup"}
                  </span>
                </div>
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">{form.title}</h3>
                {form.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{form.description}</p>}
                <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                  <span>👥 {form.responseCount} respons</span>
                  {form.deadline && <span>⏰ Tutup: {format(new Date(form.deadline), "d MMM yyyy")}</span>}
                </div>
              </div>
              <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0">→</div>
            </div>
          </div>
        ))}
      </div>
      <Dialog open={selectedForm !== null} onOpenChange={(open) => { if (!open) setSelectedForm(null); }}>
        <DialogContent className="bg-card border-border max-w-lg flex flex-col max-h-[85vh] p-0 overflow-hidden">
          {selectedForm && <FormDetailContent form={selectedForm} onClose={() => setSelectedForm(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function FormDetailContent({ form, onClose }: { form: any; onClose: () => void }) {
  const { data: detail, isLoading } = useGetForm(form.id);
  const { data: myResp } = useGetMyFormResponse(form.id);
  const submitVote = useSubmitVote();
  const submitForm = useSubmitForm();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [formAnswers, setFormAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const hasResponded = myResp?.hasResponded ?? false;
  const myResponse = myResp?.response ?? null;

  const handleVote = async () => {
    if (!selectedOption) return;
    setSubmitting(true);
    try {
      await submitVote.mutateAsync({ id: form.id, data: { optionId: selectedOption } });
      await queryClient.invalidateQueries({ queryKey: [`/api/forms/${form.id}/my-response`] });
      await queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      toast({ title: "Vote berhasil!", description: "Suara kamu sudah dicatat." });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Gagal vote.", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const handleSubmitForm = async () => {
    if (!detail) return;
    for (const f of (detail.fields ?? []).filter((f: any) => f.required)) {
      if (!formAnswers[f.id]?.trim()) {
        toast({ title: "Lengkapi form", description: `Field "${f.label}" wajib diisi.`, variant: "destructive" });
        return;
      }
    }
    setSubmitting(true);
    try {
      const answers = (detail.fields ?? []).map((f: any) => ({ fieldId: f.id, value: formAnswers[f.id] ?? "" }));
      await submitForm.mutateAsync({ id: form.id, data: { answers } });
      await queryClient.invalidateQueries({ queryKey: [`/api/forms/${form.id}/my-response`] });
      await queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      toast({ title: "Formulir terkirim!", description: "Jawaban kamu sudah dicatat." });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Gagal submit.", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const totalVotes = (detail?.options ?? []).reduce((s: number, o: any) => s + (o.voteCount ?? 0), 0);

  return (
    <>
      <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${form.type === "poll" ? "bg-violet-900/40 text-violet-300 border-violet-800/40" : "bg-blue-900/40 text-blue-300 border-blue-800/40"}`}>
            {form.type === "poll" ? "🗳️ VOTING" : "📋 FORMULIR"}
          </span>
          {hasResponded && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold border bg-green-900/40 text-green-300 border-green-800/40">✓ Sudah Diisi</span>
          )}
        </div>
        <DialogTitle className="text-primary font-bold text-base">{form.title}</DialogTitle>
        {form.description && <p className="text-xs text-muted-foreground mt-1">{form.description}</p>}
      </DialogHeader>
      <ScrollArea className="flex-1 p-5">
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-10 bg-muted rounded-lg animate-pulse" />
            <div className="h-10 bg-muted rounded-lg animate-pulse" />
          </div>
        ) : form.type === "poll" ? (
          <div className="space-y-3">
            {hasResponded ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-3">Hasil Voting ({totalVotes} suara)</p>
                {(detail?.options ?? []).map((opt: any) => {
                  const pct = totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 100) : 0;
                  const isMyVote = myResponse?.selectedOptionId === opt.id;
                  return (
                    <div key={opt.id} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className={`font-medium ${isMyVote ? "text-primary" : "text-foreground"}`}>{isMyVote ? "✓ " : ""}{opt.label}</span>
                        <span className="text-muted-foreground">{opt.voteCount} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${isMyVote ? "bg-primary" : "bg-muted-foreground/40"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-3">Pilih satu opsi:</p>
                {(detail?.options ?? []).map((opt: any) => (
                  <button key={opt.id} type="button" onClick={() => setSelectedOption(opt.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${selectedOption === opt.id ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border bg-background hover:border-primary/50"}`}>
                    <span className={`inline-block w-4 h-4 rounded-full border-2 mr-2 align-middle transition-all ${selectedOption === opt.id ? "border-primary bg-primary" : "border-muted-foreground"}`} />
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {hasResponded ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">✅</div>
                <p className="text-sm font-semibold text-foreground">Formulir sudah diisi!</p>
                <p className="text-xs text-muted-foreground mt-1">Terima kasih sudah mengisi formulir ini.</p>
                {(myResponse?.answers ?? []).length > 0 && (
                  <div className="mt-4 space-y-2 text-left">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Jawaban kamu:</p>
                    {(myResponse?.answers ?? []).map((ans: any, i: number) => (
                      <div key={i} className="bg-muted/30 rounded-lg p-2.5 text-xs">
                        <p className="text-muted-foreground font-medium mb-0.5">{ans.fieldLabel}</p>
                        <p className="text-foreground">{ans.value || "(kosong)"}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              (detail?.fields ?? []).map((field: any) => (
                <div key={field.id} className="space-y-1.5">
                  <Label className="text-sm font-medium">{field.label}{field.required && <span className="text-destructive ml-1">*</span>}</Label>
                  {field.fieldType === "textarea" ? (
                    <Textarea placeholder="Jawaban kamu..." value={formAnswers[field.id] ?? ""} onChange={(e) => setFormAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))} className="bg-background border-border resize-none" rows={3} />
                  ) : field.fieldType === "radio" || field.fieldType === "select" ? (
                    <div className="space-y-1.5">
                      {(() => {
                        let opts: string[] = [];
                        try { opts = JSON.parse(field.options ?? "[]"); } catch { /* empty */ }
                        return opts.map((opt: string) => (
                          <button key={opt} type="button" onClick={() => setFormAnswers((prev) => ({ ...prev, [field.id]: opt }))}
                            className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all ${formAnswers[field.id] === opt ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border hover:border-primary/50"}`}>
                            {opt}
                          </button>
                        ));
                      })()}
                    </div>
                  ) : (
                    <Input placeholder="Jawaban kamu..." value={formAnswers[field.id] ?? ""} onChange={(e) => setFormAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))} className="bg-background border-border" />
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </ScrollArea>
      {!hasResponded && form.status === "open" && (
        <div className="p-4 border-t border-border shrink-0">
          {form.type === "poll" ? (
            <Button className="w-full bg-primary text-primary-foreground font-semibold" disabled={!selectedOption || submitting} onClick={handleVote}>
              {submitting ? "Mengirim..." : "🗳️ Vote Sekarang"}
            </Button>
          ) : (
            <Button className="w-full bg-primary text-primary-foreground font-semibold" disabled={submitting} onClick={handleSubmitForm}>
              {submitting ? "Mengirim..." : "📋 Kirim Jawaban"}
            </Button>
          )}
        </div>
      )}
      {form.status === "closed" && (
        <div className="p-3 border-t border-border text-center text-xs text-muted-foreground shrink-0">
          {form.type === "poll" ? "Voting sudah ditutup." : "Formulir sudah ditutup."}
        </div>
      )}
    </>
  );
}

function CreditsTab() {
  const { data: credits = [], isLoading } = useListCredits();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 pt-4">
        <Skeleton className="h-[280px] rounded-xl" />
        <Skeleton className="h-[280px] rounded-xl" />
        <Skeleton className="h-[280px] rounded-xl" />
      </div>
    );
  }

  if (credits.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl bg-card/20">
        <div className="text-4xl mb-3">🛡️</div>
        <p className="text-sm">Belum ada tim atau kontributor yang terdaftar di Arcadia Credits.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-10 pt-6">
      {credits.map((credit: any) => (
        <div key={credit.id} className="relative group overflow-visible aspect-[4/5] w-full transition-all duration-300 hover:scale-[1.03]">
          {/* Card Background (inset by 18px to align perfectly inside the straight rectangle frame) */}
          <div className="absolute inset-[18px] rounded-xl bg-[#0c0a09] bg-[radial-gradient(circle_at_50%_30%,_rgba(61,48,37,0.55)_0%,_rgba(12,10,9,0.95)_100%)] border border-[#3e3024]/80 shadow-[inset_0_4px_20px_rgba(0,0,0,0.9),_0_12px_24px_-8px_rgba(0,0,0,0.8)] z-0 overflow-hidden">
            {credit.backgroundUrl && (
              <img 
                src={credit.backgroundUrl} 
                alt="" 
                className="absolute inset-0 w-full h-full object-cover opacity-45 group-hover:opacity-65 transition-opacity duration-300"
              />
            )}
          </div>
          
          {/* Subtle cross-hatch texture pattern inside the background */}
          <div className="absolute inset-[19px] rounded-xl pointer-events-none opacity-[0.035] bg-[repeating-linear-gradient(45deg,_#d97706_0px,_#d97706_1px,_transparent_1px,_transparent_8px),_repeating-linear-gradient(-45deg,_#d97706_0px,_#d97706_1px,_transparent_1px,_transparent_8px)] z-0" />

          {/* Border Frame */}
          <img src={`/frames/${credit.borderType}.png`} alt="" className="absolute inset-0 w-full h-full object-fill pointer-events-none z-10 filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]" />
          
          {/* Content */}
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-between py-8 px-8 text-center">
            <div className="flex flex-col items-center gap-3">
              <Avatar className="w-20 h-20 border-2 border-primary/25 shadow-md mt-2">
                <AvatarImage src={credit.avatarUrl || undefined} className="object-cover" />
                <AvatarFallback className="text-2xl bg-muted font-bold">{getInitials(credit.name)}</AvatarFallback>
              </Avatar>
              
              <div className="space-y-1">
                <h3 className="font-bold text-lg text-foreground leading-snug tracking-tight line-clamp-1">{credit.name}</h3>
                <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-full font-bold tracking-wider uppercase">
                  {credit.role}
                </span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground/90 line-clamp-3 leading-relaxed px-4 mb-2">
              {credit.description || "Tidak ada deskripsi."}
            </p>

            <div className="h-1" />
          </div>
        </div>
      ))}
    </div>
  );
}

