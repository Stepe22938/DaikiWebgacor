import { useState } from "react";
import { Layout } from "@/components/layout";
import { Redirect } from "wouter";
import {
  useGetMe,
  useListDevelopments,
  useCreateDevelopment,
  useUpdateDevelopment,
  useDeleteDevelopment,
  useListAnnouncements,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  useDeleteAnnouncement,
  useListUsers,
  useUpdateUserRole,
  useAdminCreateFollow,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type DevStatus = "planned" | "in_progress" | "completed" | "paused";
type AnnType = "update" | "event" | "maintenance" | "general";

interface DevForm {
  title: string;
  description: string;
  category: string;
  status: DevStatus;
  progress: string;
  order: string;
}

interface AnnForm {
  title: string;
  content: string;
  type: AnnType;
  pinned: boolean;
}

const emptyDev: DevForm = { title: "", description: "", category: "", status: "planned", progress: "", order: "" };
const emptyAnn: AnnForm = { title: "", content: "", type: "general", pinned: false };

const STATUS_LABELS: Record<DevStatus, string> = {
  planned: "Planned",
  in_progress: "In Progress",
  completed: "Completed",
  paused: "Paused",
};

const STATUS_COLORS: Record<DevStatus, string> = {
  planned: "bg-blue-900/40 text-blue-300",
  in_progress: "bg-yellow-900/40 text-yellow-300",
  completed: "bg-green-900/40 text-green-300",
  paused: "bg-gray-700/40 text-gray-400",
};

export default function Admin() {
  const { data: user, isLoading } = useGetMe();
  const { data: devs, isLoading: devsLoading } = useListDevelopments();
  const { data: anns, isLoading: annsLoading } = useListAnnouncements();
  const { data: users, isLoading: usersLoading } = useListUsers();
  const createDev = useCreateDevelopment();
  const updateDev = useUpdateDevelopment();
  const deleteDev = useDeleteDevelopment();
  const createAnn = useCreateAnnouncement();
  const updateAnn = useUpdateAnnouncement();
  const deleteAnn = useDeleteAnnouncement();
  const updateRole = useUpdateUserRole();
  const adminFollow = useAdminCreateFollow();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [devForm, setDevForm] = useState<DevForm>(emptyDev);
  const [editingDevId, setEditingDevId] = useState<number | null>(null);
  const [devDialogOpen, setDevDialogOpen] = useState(false);
  const [deletingDevId, setDeletingDevId] = useState<number | null>(null);

  const [annForm, setAnnForm] = useState<AnnForm>(emptyAnn);
  const [editingAnnId, setEditingAnnId] = useState<number | null>(null);
  const [annDialogOpen, setAnnDialogOpen] = useState(false);
  const [deletingAnnId, setDeletingAnnId] = useState<number | null>(null);

  const [botFollowerId, setBotFollowerId] = useState("");
  const [botFollowingId, setBotFollowingId] = useState("");
  const [savingBotFollow, setSavingBotFollow] = useState(false);

  if (isLoading) return <Layout><div className="p-8 text-muted-foreground">Loading...</div></Layout>;
  if (user?.role !== "admin") return <Redirect to="/member" />;

  const invalidate = (...keys: string[]) =>
    keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));

  // ─── Developments ────────────────────────────────────────────────────────────
  const openNewDev = () => { setDevForm(emptyDev); setEditingDevId(null); setDevDialogOpen(true); };
  const openEditDev = (dev: NonNullable<typeof devs>[number]) => {
    setDevForm({
      title: dev.title,
      description: dev.description,
      category: dev.category,
      status: dev.status as DevStatus,
      progress: dev.progress != null ? String(dev.progress) : "",
      order: String(dev.order),
    });
    setEditingDevId(dev.id);
    setDevDialogOpen(true);
  };

  const handleSaveDev = async () => {
    if (!devForm.title.trim()) { toast({ title: "Error", description: "Title is required.", variant: "destructive" }); return; }
    try {
      const payload = {
        title: devForm.title.trim(),
        description: devForm.description.trim(),
        category: devForm.category.trim() || "General",
        status: devForm.status,
        ...(devForm.progress !== "" && { progress: parseInt(devForm.progress) }),
        ...(devForm.order !== "" && { order: parseInt(devForm.order) }),
      };
      if (editingDevId !== null) {
        await updateDev.mutateAsync({ id: editingDevId, data: payload });
        toast({ title: "Updated", description: "Development item updated." });
      } else {
        await createDev.mutateAsync({ data: payload });
        toast({ title: "Created", description: "Development item created." });
      }
      setDevDialogOpen(false);
      invalidate("/api/developments");
    } catch {
      toast({ title: "Error", description: "Failed to save development.", variant: "destructive" });
    }
  };

  const handleDeleteDev = async (id: number) => {
    try {
      await deleteDev.mutateAsync({ id });
      toast({ title: "Deleted", description: "Development item removed." });
      invalidate("/api/developments");
      setDeletingDevId(null);
    } catch {
      toast({ title: "Error", description: "Failed to delete.", variant: "destructive" });
    }
  };

  // ─── Announcements ────────────────────────────────────────────────────────────
  const openNewAnn = () => { setAnnForm(emptyAnn); setEditingAnnId(null); setAnnDialogOpen(true); };
  const openEditAnn = (ann: NonNullable<typeof anns>[number]) => {
    setAnnForm({ title: ann.title, content: ann.content, type: ann.type as AnnType, pinned: ann.pinned });
    setEditingAnnId(ann.id);
    setAnnDialogOpen(true);
  };

  const handleSaveAnn = async () => {
    if (!annForm.title.trim()) { toast({ title: "Error", description: "Title is required.", variant: "destructive" }); return; }
    try {
      const payload = { title: annForm.title.trim(), content: annForm.content.trim(), type: annForm.type, pinned: annForm.pinned };
      if (editingAnnId !== null) {
        await updateAnn.mutateAsync({ id: editingAnnId, data: payload });
        toast({ title: "Updated", description: "Announcement updated." });
      } else {
        await createAnn.mutateAsync({ data: payload });
        toast({ title: "Created", description: "Announcement posted." });
      }
      setAnnDialogOpen(false);
      invalidate("/api/announcements");
    } catch {
      toast({ title: "Error", description: "Failed to save announcement.", variant: "destructive" });
    }
  };

  const handleDeleteAnn = async (id: number) => {
    try {
      await deleteAnn.mutateAsync({ id });
      toast({ title: "Deleted", description: "Announcement removed." });
      invalidate("/api/announcements");
      setDeletingAnnId(null);
    } catch {
      toast({ title: "Error", description: "Failed to delete.", variant: "destructive" });
    }
  };

  // ─── Bot Follow ───────────────────────────────────────────────────────────────
  const handleBotFollow = async () => {
    const fId = parseInt(botFollowerId);
    const tId = parseInt(botFollowingId);
    if (isNaN(fId) || isNaN(tId)) { toast({ title: "Error", description: "Select both accounts.", variant: "destructive" }); return; }
    setSavingBotFollow(true);
    try {
      await adminFollow.mutateAsync({ data: { followerId: fId, followingId: tId } });
      toast({ title: "Done", description: "Follow relationship created." });
      invalidate("/api/members");
      setBotFollowerId("");
      setBotFollowingId("");
    } catch (err: unknown) {
      const msg = err instanceof Error && err.message.includes("409") ? "Already following." : "Failed to create follow.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSavingBotFollow(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8 pb-4 border-b border-border">
          <h1 className="text-3xl font-bold text-primary">Admin Citadel</h1>
          <p className="text-muted-foreground mt-1">Manage the realm from here.</p>
        </div>

        <Tabs defaultValue="developments" className="space-y-6">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="developments">⚒ The Forge</TabsTrigger>
            <TabsTrigger value="announcements">📣 Town Crier</TabsTrigger>
            <TabsTrigger value="users">👥 Scribes</TabsTrigger>
          </TabsList>

          {/* ── DEVELOPMENTS ─────────────────────────────────────────────────── */}
          <TabsContent value="developments" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-foreground">Server Projects</h2>
              <Button onClick={openNewDev} className="bg-primary text-primary-foreground hover:bg-primary/90">
                + New Project
              </Button>
            </div>

            {devsLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : devs?.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground border border-border rounded-xl">No projects yet.</div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {devs?.map((dev) => (
                  <Card key={dev.id} className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-start justify-between gap-2">
                        <span className="text-base font-semibold">{dev.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[dev.status as DevStatus]}`}>
                          {STATUS_LABELS[dev.status as DevStatus]}
                        </span>
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">{dev.category}</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground line-clamp-2">{dev.description}</p>
                      {dev.progress != null && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Progress</span><span>{dev.progress}%</span>
                          </div>
                          <Progress value={dev.progress} className="h-2" />
                        </div>
                      )}
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" className="flex-1 border-border" onClick={() => openEditDev(dev)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10" onClick={() => setDeletingDevId(dev.id)}>
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── ANNOUNCEMENTS ─────────────────────────────────────────────────── */}
          <TabsContent value="announcements" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-foreground">Announcements</h2>
              <Button onClick={openNewAnn} className="bg-primary text-primary-foreground hover:bg-primary/90">
                + New Announcement
              </Button>
            </div>

            {annsLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : anns?.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground border border-border rounded-xl">No announcements yet.</div>
            ) : (
              <div className="space-y-3">
                {anns?.map((ann) => (
                  <Card key={ann.id} className="bg-card border-border">
                    <CardContent className="p-4 flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-foreground">{ann.title}</span>
                          {ann.pinned && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">📌 Pinned</span>}
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full uppercase">{ann.type}</span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{ann.content}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" className="border-border" onClick={() => openEditAnn(ann)}>Edit</Button>
                        <Button size="sm" variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10" onClick={() => setDeletingAnnId(ann.id)}>Delete</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── USERS ────────────────────────────────────────────────────────── */}
          <TabsContent value="users" className="space-y-8">
            {/* User list + role management */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Members</h2>
              {usersLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <div className="space-y-3">
                  {users?.map((u) => (
                    <Card key={u.id} className="bg-card border-border">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-primary shrink-0">
                          {(u.displayName || u.username).charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground truncate">{u.displayName || u.username}</div>
                          <div className="text-xs text-muted-foreground">@{u.username} · ID: {u.id}</div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`text-xs px-2 py-1 rounded-full ${u.role === "admin" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                            {u.role}
                          </span>
                          <Select
                            value={u.role}
                            onValueChange={async (role) => {
                              try {
                                await updateRole.mutateAsync({ id: u.id, data: { role: role as "member" | "admin" } });
                                toast({ title: "Role updated", description: `${u.username} is now ${role}.` });
                                invalidate("/api/users");
                              } catch {
                                toast({ title: "Error", description: "Failed to update role.", variant: "destructive" });
                              }
                            }}
                          >
                            <SelectTrigger className="w-28 h-8 text-xs bg-card border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="member">Member</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Bot follow section */}
            <Card className="bg-card border-border border-dashed">
              <CardHeader>
                <CardTitle className="text-primary text-lg">🤖 Bot Follow</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Force a follow relationship between any two accounts. Use this to set bot accounts as followers.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Follower (Bot Account)</Label>
                    <Select value={botFollowerId} onValueChange={setBotFollowerId}>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Select follower…" />
                      </SelectTrigger>
                      <SelectContent>
                        {users?.map((u) => (
                          <SelectItem key={u.id} value={String(u.id)}>
                            {u.displayName || u.username} (ID:{u.id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Target (Who Gets Followed)</Label>
                    <Select value={botFollowingId} onValueChange={setBotFollowingId}>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Select target…" />
                      </SelectTrigger>
                      <SelectContent>
                        {users?.map((u) => (
                          <SelectItem key={u.id} value={String(u.id)}>
                            {u.displayName || u.username} (ID:{u.id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={handleBotFollow}
                  disabled={savingBotFollow || !botFollowerId || !botFollowingId}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {savingBotFollow ? "Creating…" : "Create Follow"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Development Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={devDialogOpen} onOpenChange={setDevDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-primary">{editingDevId ? "Edit Project" : "New Project"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={devForm.title} onChange={(e) => setDevForm({ ...devForm, title: e.target.value })} placeholder="Project name" className="bg-input border-border" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={devForm.description} onChange={(e) => setDevForm({ ...devForm, description: e.target.value })} placeholder="What is this about?" className="bg-input border-border resize-none" rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={devForm.category} onChange={(e) => setDevForm({ ...devForm, category: e.target.value })} placeholder="e.g. Gameplay, Economy, World" className="bg-input border-border" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={devForm.status} onValueChange={(v) => setDevForm({ ...devForm, status: v as DevStatus })}>
                  <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Progress % (0–100)</Label>
                <Input type="number" min={0} max={100} value={devForm.progress} onChange={(e) => setDevForm({ ...devForm, progress: e.target.value })} placeholder="e.g. 75" className="bg-input border-border" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Order (sort position)</Label>
              <Input type="number" value={devForm.order} onChange={(e) => setDevForm({ ...devForm, order: e.target.value })} placeholder="e.g. 1" className="bg-input border-border" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-border" onClick={() => setDevDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveDev} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {editingDevId ? "Save Changes" : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Announcement Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={annDialogOpen} onOpenChange={setAnnDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-primary">{editingAnnId ? "Edit Announcement" : "New Announcement"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={annForm.title} onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })} placeholder="Announcement title" className="bg-input border-border" />
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea value={annForm.content} onChange={(e) => setAnnForm({ ...annForm, content: e.target.value })} placeholder="Announcement body…" className="bg-input border-border resize-none" rows={5} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={annForm.type} onValueChange={(v) => setAnnForm({ ...annForm, type: v as AnnType })}>
                  <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="update">Update</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pin to top?</Label>
                <Select value={annForm.pinned ? "yes" : "no"} onValueChange={(v) => setAnnForm({ ...annForm, pinned: v === "yes" })}>
                  <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="yes">📌 Yes, pin it</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-border" onClick={() => setAnnDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveAnn} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {editingAnnId ? "Save Changes" : "Post Announcement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm dialogs ─────────────────────────────────────────── */}
      <Dialog open={deletingDevId !== null} onOpenChange={() => setDeletingDevId(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle>Delete project?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-border" onClick={() => setDeletingDevId(null)}>Cancel</Button>
            <Button className="bg-destructive hover:bg-destructive/90 text-white" onClick={() => deletingDevId && handleDeleteDev(deletingDevId)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deletingAnnId !== null} onOpenChange={() => setDeletingAnnId(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle>Delete announcement?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-border" onClick={() => setDeletingAnnId(null)}>Cancel</Button>
            <Button className="bg-destructive hover:bg-destructive/90 text-white" onClick={() => deletingAnnId && handleDeleteAnn(deletingAnnId)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
