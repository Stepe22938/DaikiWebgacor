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
  useAdminBulkCreateFollowers,
  useAdminUpdateUser,
  customFetch,
  useListCredits,
  useCreateCredit,
  useUpdateCredit,
  useDeleteCredit,
  useListTickets,
  useUpdateTicket,
  useListAdminTicketReasons,
  useCreateTicketReason,
  useUpdateTicketReason,
  useDeleteTicketReason,
} from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRef } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type DevStatus = "planned" | "in_progress" | "completed" | "paused";
type AnnType = "update" | "event" | "maintenance" | "general";
type UserRole = "member" | "admin" | "staff" | "dev";
type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

interface DevForm { title: string; description: string; category: string; status: DevStatus; progress: string; order: string; }
interface AnnForm { title: string; content: string; type: AnnType; pinned: boolean; }
interface UserEditForm { username: string; displayName: string; bio: string; role: UserRole; }
interface CreditForm {
  name: string;
  avatarUrl: string;
  backgroundUrl: string;
  role: string;
  description: string;
  borderType: string;
  order: string;
}
interface TicketReasonForm {
  label: string;
  description: string;
  isActive: boolean;
  order: string;
}

const emptyDev: DevForm = { title: "", description: "", category: "", status: "planned", progress: "", order: "" };
const emptyAnn: AnnForm = { title: "", content: "", type: "general", pinned: false };
const emptyCredit: CreditForm = {
  name: "",
  avatarUrl: "",
  backgroundUrl: "",
  role: "",
  description: "",
  borderType: "frame1",
  order: "0",
};
const emptyTicketReason: TicketReasonForm = {
  label: "",
  description: "",
  isActive: true,
  order: "0",
};

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

const STATUS_COLORS: Record<DevStatus, string> = {
  planned: "bg-blue-900/40 text-blue-300",
  in_progress: "bg-yellow-900/40 text-yellow-300",
  completed: "bg-green-900/40 text-green-300",
  paused: "bg-gray-700/40 text-gray-400",
};
const STATUS_LABELS: Record<DevStatus, string> = { planned: "Planned", in_progress: "In Progress", completed: "Completed", paused: "Paused" };

export default function Admin() {
  const { data: user, isLoading } = useGetMe();
  const queryRole = user?.role;
  const canQueryAdmin = queryRole === "admin";
  const { data: devs, isLoading: devsLoading } = useListDevelopments();
  const { data: anns, isLoading: annsLoading } = useListAnnouncements();
  const { data: users, isLoading: usersLoading } = useListUsers({
    query: { enabled: canQueryAdmin } as any,
  });
  const { data: tickets = [], isLoading: ticketsLoading } = useListTickets();
  const { data: ticketReasons = [], isLoading: ticketReasonsLoading } = useListAdminTicketReasons({
    query: { enabled: canQueryAdmin } as any,
  });
  const createDev = useCreateDevelopment();
  const updateDev = useUpdateDevelopment();
  const deleteDev = useDeleteDevelopment();
  const createAnn = useCreateAnnouncement();
  const updateAnn = useUpdateAnnouncement();
  const deleteAnn = useDeleteAnnouncement();
  const updateRole = useUpdateUserRole();
  const adminFollow = useAdminCreateFollow();
  const bulkFollow = useAdminBulkCreateFollowers();
  const adminUpdateUser = useAdminUpdateUser();
  const updateTicket = useUpdateTicket();
  const createTicketReason = useCreateTicketReason();
  const updateTicketReason = useUpdateTicketReason();
  const deleteTicketReason = useDeleteTicketReason();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Dev state
  const [devForm, setDevForm] = useState<DevForm>(emptyDev);
  const [editingDevId, setEditingDevId] = useState<number | null>(null);
  const [devDialogOpen, setDevDialogOpen] = useState(false);
  const [deletingDevId, setDeletingDevId] = useState<number | null>(null);

  // Ann state
  const [annForm, setAnnForm] = useState<AnnForm>(emptyAnn);
  const [editingAnnId, setEditingAnnId] = useState<number | null>(null);
  const [annDialogOpen, setAnnDialogOpen] = useState(false);
  const [deletingAnnId, setDeletingAnnId] = useState<number | null>(null);

  // User edit state
  const [userEditForm, setUserEditForm] = useState<UserEditForm>({ username: "", displayName: "", bio: "", role: "member" });
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [userEditDialogOpen, setUserEditDialogOpen] = useState(false);
  
  // Credits state
  const { data: credits, isLoading: creditsLoading } = useListCredits();
  const createCredit = useCreateCredit();
  const updateCredit = useUpdateCredit();
  const deleteCredit = useDeleteCredit();
  const [creditForm, setCreditForm] = useState<CreditForm>(emptyCredit);
  const [editingCreditId, setEditingCreditId] = useState<number | null>(null);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [deletingCreditId, setDeletingCreditId] = useState<number | null>(null);
  const [ticketReasonForm, setTicketReasonForm] = useState<TicketReasonForm>(emptyTicketReason);
  const [editingTicketReasonId, setEditingTicketReasonId] = useState<number | null>(null);
  const [ticketReasonDialogOpen, setTicketReasonDialogOpen] = useState(false);
  const [deletingTicketReasonId, setDeletingTicketReasonId] = useState<number | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const [savingUser, setSavingUser] = useState(false);

  // Bot follow state
  const [botFollowerId, setBotFollowerId] = useState("");
  const [botFollowingId, setBotFollowingId] = useState("");
  const [bulkTargetId, setBulkTargetId] = useState("");
  const [bulkCount, setBulkCount] = useState("100");
  const [bulkLoading, setBulkLoading] = useState(false);

  // Dropdown open state
  const [showBulkTarget, setShowBulkTarget] = useState(false);
  const [showSingleFollower, setShowSingleFollower] = useState(false);
  const [showSingleTarget, setShowSingleTarget] = useState(false);

  // Search state for dropdowns
  const [bulkSearch, setBulkSearch] = useState("");
  const [singleSearch, setSingleSearch] = useState("");

  // User directory
  const [userDirSearch, setUserDirSearch] = useState("");

  // System Settings State & Query
  const { data: currentSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: () => customFetch<any>("/api/settings"),
  });

  const saveSettings = useMutation({
    mutationFn: (data: any) =>
      customFetch<any>("/api/settings", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({ title: "Settings saved", description: "Homepage configurations updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    },
  });

  const [settingsForm, setSettingsForm] = useState({
    heroTitle: "",
    heroSubtitle: "",
    serverIP: "",
    mcVersion: "",
    specsCpu: "",
    specsMemory: "",
    specsStorage: "",
    specsLocation: "",
  });

  const [hasInitializedForm, setHasInitializedForm] = useState(false);
  if (currentSettings && !hasInitializedForm) {
    setSettingsForm({
      heroTitle: currentSettings.heroTitle || "",
      heroSubtitle: currentSettings.heroSubtitle || "",
      serverIP: currentSettings.serverIP || "",
      mcVersion: currentSettings.mcVersion || "",
      specsCpu: currentSettings.specsCpu || "",
      specsMemory: currentSettings.specsMemory || "",
      specsStorage: currentSettings.specsStorage || "",
      specsLocation: currentSettings.specsLocation || "",
    });
    setHasInitializedForm(true);
  }

  if (isLoading) return <Layout><div className="p-8 text-muted-foreground">Loading...</div></Layout>;
  const role = user?.role;
  const canManageAdmin = role === "admin";
  const canManageAnnouncements = role === "admin" || role === "staff";
  const canManageTickets = role === "admin" || role === "dev";
  const defaultTab = role === "staff" ? "announcements" : role === "dev" ? "tickets" : "developments";
  if (!canManageAdmin && !canManageAnnouncements && !canManageTickets) return <Redirect to="/member" />;

  const invalidate = (...keys: string[]) => keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));

  // ── Developments ──────────────────────────────────────────────────────────────
  const openNewDev = () => { setDevForm(emptyDev); setEditingDevId(null); setDevDialogOpen(true); };
  const openEditDev = (dev: NonNullable<typeof devs>[number]) => {
    setDevForm({ title: dev.title, description: dev.description, category: dev.category, status: dev.status as DevStatus, progress: dev.progress != null ? String(dev.progress) : "", order: String(dev.order) });
    setEditingDevId(dev.id); setDevDialogOpen(true);
  };
  const handleSaveDev = async () => {
    if (!devForm.title.trim()) { toast({ title: "Error", description: "Title is required.", variant: "destructive" }); return; }
    try {
      const payload = { title: devForm.title.trim(), description: devForm.description.trim(), category: devForm.category.trim() || "General", status: devForm.status, ...(devForm.progress !== "" && { progress: parseInt(devForm.progress) }), ...(devForm.order !== "" && { order: parseInt(devForm.order) }) };
      if (editingDevId !== null) { await updateDev.mutateAsync({ id: editingDevId, data: payload }); toast({ title: "Updated", description: "Project updated." }); }
      else { await createDev.mutateAsync({ data: payload }); toast({ title: "Created", description: "Project created." }); }
      setDevDialogOpen(false); invalidate("/api/developments");
    } catch { toast({ title: "Error", description: "Failed to save project.", variant: "destructive" }); }
  };
  const handleDeleteDev = async (id: number) => {
    try { await deleteDev.mutateAsync({ id }); toast({ title: "Deleted" }); invalidate("/api/developments"); setDeletingDevId(null); }
    catch { toast({ title: "Error", description: "Failed to delete.", variant: "destructive" }); }
  };

  // ── Announcements ─────────────────────────────────────────────────────────────
  const openNewAnn = () => { setAnnForm(emptyAnn); setEditingAnnId(null); setAnnDialogOpen(true); };
  const openEditAnn = (ann: NonNullable<typeof anns>[number]) => {
    setAnnForm({ title: ann.title, content: ann.content, type: ann.type as AnnType, pinned: ann.pinned });
    setEditingAnnId(ann.id); setAnnDialogOpen(true);
  };
  const handleSaveAnn = async () => {
    if (!annForm.title.trim()) { toast({ title: "Error", description: "Title is required.", variant: "destructive" }); return; }
    try {
      const payload = { title: annForm.title.trim(), content: annForm.content.trim(), type: annForm.type, pinned: annForm.pinned };
      if (editingAnnId !== null) { await updateAnn.mutateAsync({ id: editingAnnId, data: payload }); toast({ title: "Updated" }); }
      else { await createAnn.mutateAsync({ data: payload }); toast({ title: "Posted" }); }
      setAnnDialogOpen(false); invalidate("/api/announcements");
    } catch { toast({ title: "Error", description: "Failed to save.", variant: "destructive" }); }
  };
  const handleDeleteAnn = async (id: number) => {
    try { await deleteAnn.mutateAsync({ id }); toast({ title: "Deleted" }); invalidate("/api/announcements"); setDeletingAnnId(null); }
    catch { toast({ title: "Error", description: "Failed to delete.", variant: "destructive" }); }
  };

  // ── User Edit ─────────────────────────────────────────────────────────────────
  const openEditUser = (u: NonNullable<typeof users>[number]) => {
    setUserEditForm({ username: u.username, displayName: u.displayName ?? "", bio: u.bio ?? "", role: u.role as UserRole });
    setEditingUserId(u.id); setUserEditDialogOpen(true);
  };
  const handleSaveUser = async () => {
    if (!editingUserId) return;
    setSavingUser(true);
    try {
      const body: Record<string, string> = {};
      if (userEditForm.username.trim()) body.username = userEditForm.username.trim();
      if (userEditForm.displayName !== undefined) body.displayName = userEditForm.displayName;
      if (userEditForm.bio !== undefined) body.bio = userEditForm.bio;
      body.role = userEditForm.role;
      await adminUpdateUser.mutateAsync({ id: editingUserId, data: body });
      toast({ title: "User updated" });
      setUserEditDialogOpen(false);
      invalidate("/api/users");
    } catch { toast({ title: "Error", description: "Failed to update user.", variant: "destructive" }); }
    finally { setSavingUser(false); }
  };

  const handleUpdateTicketStatus = async (ticketId: number, status: TicketStatus) => {
    try {
      await updateTicket.mutateAsync({ id: ticketId, data: { status } });
      toast({ title: "Ticket updated" });
      invalidate("/api/tickets");
    } catch {
      toast({ title: "Error", description: "Failed to update ticket.", variant: "destructive" });
    }
  };

  const openNewTicketReason = () => {
    setTicketReasonForm(emptyTicketReason);
    setEditingTicketReasonId(null);
    setTicketReasonDialogOpen(true);
  };

  const openEditTicketReason = (reason: NonNullable<typeof ticketReasons>[number]) => {
    setTicketReasonForm({
      label: reason.label,
      description: reason.description ?? "",
      isActive: reason.isActive,
      order: String(reason.order),
    });
    setEditingTicketReasonId(reason.id);
    setTicketReasonDialogOpen(true);
  };

  const handleSaveTicketReason = async () => {
    if (!ticketReasonForm.label.trim()) {
      toast({ title: "Error", description: "Reason label is required.", variant: "destructive" });
      return;
    }

    const payload = {
      label: ticketReasonForm.label.trim(),
      description: ticketReasonForm.description.trim() || undefined,
      isActive: ticketReasonForm.isActive,
      order: ticketReasonForm.order ? parseInt(ticketReasonForm.order, 10) : 0,
    };

    try {
      if (editingTicketReasonId !== null) {
        await updateTicketReason.mutateAsync({ id: editingTicketReasonId, data: payload });
        toast({ title: "Updated", description: "Ticket reason updated." });
      } else {
        await createTicketReason.mutateAsync({ data: payload });
        toast({ title: "Created", description: "Ticket reason added." });
      }
      setTicketReasonDialogOpen(false);
      invalidate("/api/admin/ticket-reasons", "/api/ticket-reasons");
    } catch {
      toast({ title: "Error", description: "Failed to save ticket reason.", variant: "destructive" });
    }
  };

  const handleDeleteTicketReason = async (id: number) => {
    try {
      await deleteTicketReason.mutateAsync({ id });
      toast({ title: "Deleted", description: "Ticket reason deleted." });
      invalidate("/api/admin/ticket-reasons", "/api/ticket-reasons");
      setDeletingTicketReasonId(null);
    } catch {
      toast({ title: "Error", description: "Failed to delete ticket reason.", variant: "destructive" });
    }
  };

  // ── Bot Follow ────────────────────────────────────────────────────────────────
  const handleSingleFollow = async () => {
    const fId = parseInt(botFollowerId), tId = parseInt(botFollowingId);
    if (isNaN(fId) || isNaN(tId)) { toast({ title: "Error", description: "Select both accounts.", variant: "destructive" }); return; }
    try {
      await adminFollow.mutateAsync({ data: { followerId: fId, followingId: tId } });
      toast({ title: "Follow created" }); invalidate("/api/members"); setBotFollowerId(""); setBotFollowingId("");
    } catch { toast({ title: "Error", description: "Already following or invalid selection.", variant: "destructive" }); }
  };
  const handleBulkFollow = async () => {
    const tId = parseInt(bulkTargetId), cnt = parseInt(bulkCount);
    if (isNaN(tId)) { toast({ title: "Error", description: "Select a target user.", variant: "destructive" }); return; }
    if (isNaN(cnt) || cnt < 1 || cnt > 10000) { toast({ title: "Error", description: "Count must be 1–10000.", variant: "destructive" }); return; }
    setBulkLoading(true);
    try {
      const result = await bulkFollow.mutateAsync({ data: { targetUserId: tId, count: cnt } });
      toast({ title: "Bulk Done!", description: `Created ${result.botsCreated} bot accounts → ${result.followsCreated} follows added.` });
      invalidate("/api/members"); setBulkTargetId(""); setBulkCount("100");
    } catch { toast({ title: "Error", description: "Bulk follow failed.", variant: "destructive" }); }
    finally { setBulkLoading(false); }
  };

  // ── Credits ───────────────────────────────────────────────────────────────────
  const openNewCredit = () => {
    setCreditForm(emptyCredit);
    setEditingCreditId(null);
    setCreditDialogOpen(true);
  };
  const openEditCredit = (c: any) => {
    setCreditForm({
      name: c.name,
      avatarUrl: c.avatarUrl ?? "",
      backgroundUrl: c.backgroundUrl ?? "",
      role: c.role,
      description: c.description ?? "",
      borderType: c.borderType,
      order: String(c.order),
    });
    setEditingCreditId(c.id);
    setCreditDialogOpen(true);
  };
  const handleSaveCredit = async () => {
    if (!creditForm.name.trim()) { toast({ title: "Error", description: "Name is required.", variant: "destructive" }); return; }
    if (!creditForm.role.trim()) { toast({ title: "Error", description: "Role is required.", variant: "destructive" }); return; }
    try {
      const payload = {
        name: creditForm.name.trim(),
        avatarUrl: creditForm.avatarUrl.trim() || undefined,
        backgroundUrl: creditForm.backgroundUrl.trim() || undefined,
        role: creditForm.role.trim(),
        description: creditForm.description.trim() || undefined,
        borderType: creditForm.borderType,
        order: creditForm.order ? parseInt(creditForm.order, 10) : 0,
      };
      if (editingCreditId !== null) {
        await updateCredit.mutateAsync({ id: editingCreditId, data: payload });
        toast({ title: "Updated", description: "Credit updated." });
      } else {
        await createCredit.mutateAsync({ data: payload });
        toast({ title: "Created", description: "Credit created." });
      }
      setCreditDialogOpen(false);
      invalidate("/api/credits");
    } catch {
      toast({ title: "Error", description: "Failed to save credit.", variant: "destructive" });
    }
  };
  const handleDeleteCredit = async (id: number) => {
    try {
      await deleteCredit.mutateAsync({ id });
      toast({ title: "Deleted", description: "Credit deleted." });
      invalidate("/api/credits");
      setDeletingCreditId(null);
    } catch {
      toast({ title: "Error", description: "Failed to delete.", variant: "destructive" });
    }
  };
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Error", description: "Only image files are allowed.", variant: "destructive" });
      return;
    }
    setUploadingAvatar(true);
    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": file.type, "x-file-name": file.name },
        body: file,
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setCreditForm((prev) => ({ ...prev, avatarUrl: data.url }));
      toast({ title: "Success", description: "Avatar uploaded." });
    } catch {
      toast({ title: "Error", description: "Failed to upload avatar.", variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
    }
  };
  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Error", description: "Only image files are allowed.", variant: "destructive" });
      return;
    }
    setUploadingBackground(true);
    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": file.type, "x-file-name": file.name },
        body: file,
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setCreditForm((prev) => ({ ...prev, backgroundUrl: data.url }));
      toast({ title: "Success", description: "Background uploaded." });
    } catch {
      toast({ title: "Error", description: "Failed to upload background.", variant: "destructive" });
    } finally {
      setUploadingBackground(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8 pb-4 border-b border-border">
          <h1 className="text-3xl font-bold text-primary">Admin Arcadia</h1>
          <p className="text-muted-foreground mt-1">Manage the realm from here.</p>
        </div>

        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className="bg-card border border-border">
            {canManageAdmin && <TabsTrigger value="developments">The Forge</TabsTrigger>}
            {canManageAnnouncements && <TabsTrigger value="announcements">Town Crier</TabsTrigger>}
            {canManageTickets && <TabsTrigger value="tickets">Tickets</TabsTrigger>}
            {canManageAdmin && <TabsTrigger value="users">Scribes</TabsTrigger>}
            {canManageAdmin && <TabsTrigger value="credits">Arcadia Credits</TabsTrigger>}
            {canManageAdmin && <TabsTrigger value="settings">Realm Settings</TabsTrigger>}
          </TabsList>
          <TabsList className="hidden">
            <TabsTrigger value="developments">⚒ The Forge</TabsTrigger>
            <TabsTrigger value="announcements">📣 Town Crier</TabsTrigger>
            <TabsTrigger value="users">👥 Scribes</TabsTrigger>
            <TabsTrigger value="credits">🛡️ Arcadia Credits</TabsTrigger>
            <TabsTrigger value="settings">⚙️ Realm Settings</TabsTrigger>
          </TabsList>

          {/* ── DEVELOPMENTS ──────────────────────────────────────────────────── */}
          <TabsContent value="developments" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-foreground">Server Projects</h2>
              <Button onClick={openNewDev} className="bg-primary text-primary-foreground hover:bg-primary/90">+ New Project</Button>
            </div>
            {devsLoading ? <Skeleton className="h-48 w-full" /> : devs?.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground border border-border rounded-xl">No projects yet.</div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {devs?.map((dev) => (
                  <Card key={dev.id} className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-start justify-between gap-2">
                        <span className="text-base font-semibold">{dev.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[dev.status as DevStatus]}`}>{STATUS_LABELS[dev.status as DevStatus]}</span>
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">{dev.category}</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground line-clamp-2">{dev.description}</p>
                      {dev.progress != null && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground"><span>Progress</span><span>{dev.progress}%</span></div>
                          <Progress value={dev.progress} className="h-2" />
                        </div>
                      )}
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" className="flex-1 border-border" onClick={() => openEditDev(dev)}>Edit</Button>
                        <Button size="sm" variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10" onClick={() => setDeletingDevId(dev.id)}>Delete</Button>
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
              <Button onClick={openNewAnn} className="bg-primary text-primary-foreground hover:bg-primary/90">+ New Announcement</Button>
            </div>
            {annsLoading ? <Skeleton className="h-32 w-full" /> : anns?.length === 0 ? (
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

          {/* ── USERS ─────────────────────────────────────────────────────────── */}
          <TabsContent value="tickets" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-foreground">Support Tickets</h2>
              <span className="text-xs text-muted-foreground">{tickets.length} tickets</span>
            </div>
            {ticketsLoading ? <Skeleton className="h-48 w-full" /> : tickets.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground border border-border rounded-xl">No tickets yet.</div>
            ) : (
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <Card key={ticket.id} className="bg-card border-border">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground">#{ticket.id} - {ticket.reason}</span>
                            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full uppercase">{ticket.status.replace("_", " ")}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            By {ticket.creatorDisplayName || ticket.creatorUsername || `User ${ticket.creatorId}`}
                          </p>
                        </div>
                        <Select value={ticket.status} onValueChange={(value) => handleUpdateTicketStatus(ticket.id, value as TicketStatus)}>
                          <SelectTrigger className="w-full md:w-40 bg-input border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ticket.description}</p>
                      {ticket.adminDisplayName || ticket.adminUsername ? (
                        <p className="text-xs text-muted-foreground">Handler: {ticket.adminDisplayName || ticket.adminUsername}</p>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {canManageAdmin && (
              <Card className="bg-card border-border">
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-primary text-xl">Ticket Page Settings</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">Atur opsi alasan yang muncul saat member membuat tiket.</p>
                    </div>
                    <Button onClick={openNewTicketReason} className="bg-primary text-primary-foreground hover:bg-primary/90">
                      + Add Reason
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {ticketReasonsLoading ? <Skeleton className="h-32 w-full" /> : ticketReasons.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground border border-border rounded-lg">No ticket reasons yet.</div>
                  ) : (
                    <div className="border border-border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Reason</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="w-24">Order</TableHead>
                            <TableHead className="w-24">Status</TableHead>
                            <TableHead className="text-right w-40">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ticketReasons.map((reason) => (
                            <TableRow key={reason.id}>
                              <TableCell className="font-medium text-foreground">{reason.label}</TableCell>
                              <TableCell className="text-muted-foreground">{reason.description || "-"}</TableCell>
                              <TableCell className="text-muted-foreground">{reason.order}</TableCell>
                              <TableCell>
                                <span className={`text-xs px-2 py-1 rounded-full ${reason.isActive ? "bg-green-500/15 text-green-300" : "bg-muted text-muted-foreground"}`}>
                                  {reason.isActive ? "Active" : "Hidden"}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" variant="outline" className="border-border h-7 text-xs" onClick={() => openEditTicketReason(reason)}>Edit</Button>
                                  <Button size="sm" variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10 h-7 text-xs" onClick={() => setDeletingTicketReasonId(reason.id)}>Delete</Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="users" className="space-y-8">
            {/* Members Table */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-foreground">Members</h2>
                <div className="relative flex-1 max-w-xs">
                  <Input value={userDirSearch} onChange={(e) => setUserDirSearch(e.target.value)} placeholder="Search by name, username, ID…" className="bg-input border-border h-8 text-sm" />
                </div>
              </div>
              {usersLoading ? <Skeleton className="h-32 w-full" /> : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-48">User</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead className="w-24">ID</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users?.filter(u => {
                        const q = userDirSearch.toLowerCase();
                        return !q || u.username.toLowerCase().includes(q) || u.userTag.toLowerCase().includes(q) || (u.displayName && u.displayName.toLowerCase().includes(q)) || String(u.id).includes(q) || (u.bio && u.bio.toLowerCase().includes(q));
                      }).map((u) => (
                        <TableRow key={u.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-primary text-xs shrink-0 overflow-hidden">
                                {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" /> : (u.displayName || u.username).charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate font-medium text-foreground">
                                  {u.displayName || u.username} <span className="text-primary font-semibold">{u.userTag}</span>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            @{u.username} <span className="text-primary font-medium">{u.userTag}</span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{u.id}</TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-1 rounded-full ${u.role === "admin" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>{u.role}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button size="sm" variant="outline" className="border-border h-7 text-xs" onClick={() => openEditUser(u)}>Edit</Button>
                              <Select value={u.role} onValueChange={async (role) => {
                                try { await updateRole.mutateAsync({ id: u.id, data: { role: role as UserRole } }); toast({ title: "Role updated" }); invalidate("/api/users"); }
                                catch { toast({ title: "Error", description: "Failed to update role.", variant: "destructive" }); }
                              }}>
                                <SelectTrigger className="w-24 h-7 text-xs bg-card border-border"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="member">Member</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="staff">Staff</SelectItem>
                                  <SelectItem value="dev">Dev</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Single bot follow */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-primary text-lg">🤖 Single Bot Follow</CardTitle>
                <p className="text-sm text-muted-foreground">Force one user to follow another.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Follower search */}
                  <div className="space-y-2 relative">
                    <Label>Follower</Label>
                    <div className="relative">
                      <Input value={showSingleFollower ? singleSearch : (users?.find(u => String(u.id) === botFollowerId)?.displayName || users?.find(u => String(u.id) === botFollowerId)?.username || "")} onFocus={() => { setShowSingleFollower(true); setSingleSearch(""); }} readOnly={!showSingleFollower} onChange={(e) => { setSingleSearch(e.target.value); setShowSingleFollower(true); }} placeholder={botFollowerId ? "Click to change…" : "Type to search…"} className="bg-input border-border" />
                      {showSingleFollower && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg overflow-hidden">
                          <ScrollArea className="h-60">
                            <div className="p-1">
                              {(users?.filter(u => { const q = singleSearch.toLowerCase(); return !q || u.username.toLowerCase().includes(q) || u.userTag.toLowerCase().includes(q) || (u.displayName && u.displayName.toLowerCase().includes(q)) || String(u.id).includes(q); }) || []).length === 0 ? (
                                <div className="px-3 py-2 text-xs text-muted-foreground">No results</div>
                              ) : (
                                users?.filter(u => { const q = singleSearch.toLowerCase(); return !q || u.username.toLowerCase().includes(q) || u.userTag.toLowerCase().includes(q) || (u.displayName && u.displayName.toLowerCase().includes(q)) || String(u.id).includes(q); }).map(u => (
                                  <button key={u.id} onClick={() => { setBotFollowerId(String(u.id)); setShowSingleFollower(false); setSingleSearch(""); }} className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded-md flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center font-bold text-primary text-xs shrink-0">{(u.displayName || u.username).charAt(0).toUpperCase()}</div>
                                    <div className="truncate">{u.displayName || u.username} <span className="text-primary font-medium">{u.userTag}</span> <span className="text-xs text-muted-foreground">(ID:{u.id})</span></div>
                                  </button>
                                ))
                              )}
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                    </div>
                    {botFollowerId && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Selected: {users?.find(u => String(u.id) === botFollowerId)?.displayName || users?.find(u => String(u.id) === botFollowerId)?.username} {users?.find(u => String(u.id) === botFollowerId)?.userTag}</span>
                        <button onClick={() => setBotFollowerId("")} className="text-destructive hover:underline">Clear</button>
                      </div>
                    )}
                  </div>
                  {/* Target search */}
                  <div className="space-y-2 relative">
                    <Label>Target (gets followed)</Label>
                    <div className="relative">
                      <Input value={showSingleTarget ? (users?.find(u => String(u.id) === botFollowingId)?.displayName || users?.find(u => String(u.id) === botFollowingId)?.username || "") : singleSearch} onFocus={() => { setShowSingleTarget(true); setSingleSearch(""); }} readOnly={!showSingleTarget} onChange={(e) => { setSingleSearch(e.target.value); setShowSingleTarget(true); }} placeholder={botFollowingId ? "Click to change…" : "Type to search…"} className="bg-input border-border" />
                      {showSingleTarget && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg overflow-hidden">
                          <ScrollArea className="h-60">
                            <div className="p-1">
                              {(users?.filter(u => { const q = singleSearch.toLowerCase(); return !q || u.username.toLowerCase().includes(q) || u.userTag.toLowerCase().includes(q) || (u.displayName && u.displayName.toLowerCase().includes(q)) || String(u.id).includes(q); }) || []).length === 0 ? (
                                <div className="px-3 py-2 text-xs text-muted-foreground">No results</div>
                              ) : (
                                users?.filter(u => { const q = singleSearch.toLowerCase(); return !q || u.username.toLowerCase().includes(q) || u.userTag.toLowerCase().includes(q) || (u.displayName && u.displayName.toLowerCase().includes(q)) || String(u.id).includes(q); }).map(u => (
                                  <button key={u.id} onClick={() => { setBotFollowingId(String(u.id)); setShowSingleTarget(false); setSingleSearch(""); }} className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded-md flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center font-bold text-primary text-xs shrink-0">{(u.displayName || u.username).charAt(0).toUpperCase()}</div>
                                    <div className="truncate">{u.displayName || u.username} <span className="text-primary font-medium">{u.userTag}</span> <span className="text-xs text-muted-foreground">(ID:{u.id})</span></div>
                                  </button>
                                ))
                              )}
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                    </div>
                    {botFollowingId && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Selected: {users?.find(u => String(u.id) === botFollowingId)?.displayName || users?.find(u => String(u.id) === botFollowingId)?.username} {users?.find(u => String(u.id) === botFollowingId)?.userTag}</span>
                        <button onClick={() => setBotFollowingId("")} className="text-destructive hover:underline">Clear</button>
                      </div>
                    )}
                  </div>
                </div>
                <Button onClick={handleSingleFollow} disabled={!botFollowerId || !botFollowingId} className="bg-primary text-primary-foreground hover:bg-primary/90">Create Follow</Button>
              </CardContent>
            </Card>

            {/* Bulk bot follow */}
            <Card className="bg-card border-border border-dashed">
              <CardHeader>
                <CardTitle className="text-primary text-lg">⚡ Bulk Bot Followers</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Auto-generate N bot accounts that all follow one target user. Max 10,000 per request.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2 relative">
                    <Label>Target User (receives followers)</Label>
                    <div className="relative">
                      <Input value={showBulkTarget ? bulkSearch : (users?.find(u => String(u.id) === bulkTargetId)?.displayName || users?.find(u => String(u.id) === bulkTargetId)?.username || "")} onFocus={() => { setShowBulkTarget(true); setBulkSearch(""); }} readOnly={!showBulkTarget} onChange={(e) => { setBulkSearch(e.target.value); setShowBulkTarget(true); }} placeholder={bulkTargetId ? "Click to change…" : "Type to search…"} className="bg-input border-border" />
                      {showBulkTarget && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg overflow-hidden">
                          <ScrollArea className="h-60">
                            <div className="p-1">
                              {(users?.filter(u => { const q = bulkSearch.toLowerCase(); return !q || u.username.toLowerCase().includes(q) || u.userTag.toLowerCase().includes(q) || (u.displayName && u.displayName.toLowerCase().includes(q)) || String(u.id).includes(q); }) || []).length === 0 ? (
                                <div className="px-3 py-2 text-xs text-muted-foreground">No results</div>
                              ) : (
                                users?.filter(u => { const q = bulkSearch.toLowerCase(); return !q || u.username.toLowerCase().includes(q) || u.userTag.toLowerCase().includes(q) || (u.displayName && u.displayName.toLowerCase().includes(q)) || String(u.id).includes(q); }).map(u => (
                                  <button key={u.id} onClick={() => { setBulkTargetId(String(u.id)); setShowBulkTarget(false); setBulkSearch(""); }} className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded-md flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center font-bold text-primary text-xs shrink-0">{(u.displayName || u.username).charAt(0).toUpperCase()}</div>
                                    <div className="truncate">{u.displayName || u.username} <span className="text-primary font-medium">{u.userTag}</span> <span className="text-xs text-muted-foreground">(ID:{u.id})</span></div>
                                  </button>
                                ))
                              )}
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                    </div>
                    {bulkTargetId && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Selected: {users?.find(u => String(u.id) === bulkTargetId)?.displayName || users?.find(u => String(u.id) === bulkTargetId)?.username} {users?.find(u => String(u.id) === bulkTargetId)?.userTag}</span>
                        <button onClick={() => setBulkTargetId("")} className="text-destructive hover:underline">Clear</button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Number of Followers to Generate</Label>
                    <Input type="number" min={1} max={10000} value={bulkCount} onChange={(e) => setBulkCount(e.target.value)} placeholder="e.g. 8000" className="bg-input border-border" />
                  </div>
                </div>
                <Button onClick={handleBulkFollow} disabled={bulkLoading || !bulkTargetId} className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-[180px]">
                  {bulkLoading ? `Generating... (this may take a moment)` : `Generate ${bulkCount || "N"} Bot Followers`}
                </Button>
                <p className="text-xs text-muted-foreground">Each bot is a separate account stored in the database. Followers will appear on the user's profile.</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── ARCADIA CREDITS ─────────────────────────────────────────────────── */}
          <TabsContent value="credits" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-foreground">Arcadia Credits</h2>
              <Button onClick={openNewCredit} className="bg-primary text-primary-foreground hover:bg-primary/90">+ New Credit</Button>
            </div>
            {creditsLoading ? <Skeleton className="h-48 w-full" /> : credits?.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground border border-border rounded-xl">No credits yet.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-10 pt-6">
                {credits?.map((credit: any) => (
                  <div key={credit.id} className="relative group overflow-visible aspect-[4/5] w-full transition-all duration-300 hover:scale-[1.03]">
                    {/* Card Background */}
                    <div className="absolute inset-[18px] rounded-xl bg-[#0c0a09] bg-[radial-gradient(circle_at_50%_30%,_rgba(61,48,37,0.55)_0%,_rgba(12,10,9,0.95)_100%)] border border-[#3e3024]/80 shadow-[inset_0_4px_20px_rgba(0,0,0,0.9),_0_12px_24px_-8px_rgba(0,0,0,0.8)] z-0 overflow-hidden">
                      {credit.backgroundUrl && (
                        <img 
                          src={credit.backgroundUrl} 
                          alt="" 
                          className="absolute inset-0 w-full h-full object-cover opacity-45 group-hover:opacity-65 transition-opacity duration-300"
                        />
                      )}
                    </div>
                    
                    {/* Subtle cross-hatch texture pattern */}
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

                      <div className="flex gap-2 w-full px-2 z-30">
                        <Button size="sm" variant="outline" className="flex-1 bg-background/80 hover:bg-background border-border text-xs h-8" onClick={() => openEditCredit(credit)}>Edit</Button>
                        <Button size="sm" variant="outline" className="flex-1 bg-destructive/85 hover:bg-destructive hover:text-white border-none text-xs h-8 text-white" onClick={() => setDeletingCreditId(credit.id)}>Delete</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── SETTINGS ──────────────────────────────────────────────────────── */}
          <TabsContent value="settings" className="space-y-6 max-w-2xl">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-primary text-xl font-bold flex items-center gap-2">
                  ⚙️ Realm Settings
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Edit the header text, server IP, and system specifications shown on the homepage.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {settingsLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="heroTitle">Hero Title</Label>
                      <Input
                        id="heroTitle"
                        value={settingsForm.heroTitle}
                        onChange={(e) => setSettingsForm({ ...settingsForm, heroTitle: e.target.value })}
                        placeholder="Forge Your Legend in Arcadia"
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="heroSubtitle">Hero Subtitle</Label>
                      <Textarea
                        id="heroSubtitle"
                        value={settingsForm.heroSubtitle}
                        onChange={(e) => setSettingsForm({ ...settingsForm, heroSubtitle: e.target.value })}
                        placeholder="Immersive RPG description..."
                        className="bg-input border-border resize-none"
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="serverIP">Server IP Address</Label>
                        <Input
                          id="serverIP"
                          value={settingsForm.serverIP}
                          onChange={(e) => setSettingsForm({ ...settingsForm, serverIP: e.target.value })}
                          placeholder="play.arcadiamc.net"
                          className="bg-input border-border"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mcVersion">Minecraft Version Range</Label>
                        <Input
                          id="mcVersion"
                          value={settingsForm.mcVersion}
                          onChange={(e) => setSettingsForm({ ...settingsForm, mcVersion: e.target.value })}
                          placeholder="1.20.x - 1.21.x"
                          className="bg-input border-border"
                        />
                      </div>
                    </div>

                    <div className="border-t border-border/60 pt-4 mt-6">
                      <h3 className="font-semibold text-sm text-foreground mb-4">Server Architecture Specs</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="specsCpu">CPU Specification</Label>
                          <Input
                            id="specsCpu"
                            value={settingsForm.specsCpu}
                            onChange={(e) => setSettingsForm({ ...settingsForm, specsCpu: e.target.value })}
                            placeholder="Intel Xeon E-2388G"
                            className="bg-input border-border"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="specsMemory">Memory (RAM)</Label>
                          <Input
                            id="specsMemory"
                            value={settingsForm.specsMemory}
                            onChange={(e) => setSettingsForm({ ...settingsForm, specsMemory: e.target.value })}
                            placeholder="32 GB DDR4 ECC"
                            className="bg-input border-border"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="specsStorage">Storage</Label>
                          <Input
                            id="specsStorage"
                            value={settingsForm.specsStorage}
                            onChange={(e) => setSettingsForm({ ...settingsForm, specsStorage: e.target.value })}
                            placeholder="NVMe PCIe Gen 4 SSD"
                            className="bg-input border-border"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="specsLocation">Location / Host</Label>
                          <Input
                            id="specsLocation"
                            value={settingsForm.specsLocation}
                            onChange={(e) => setSettingsForm({ ...settingsForm, specsLocation: e.target.value })}
                            placeholder="Debian VPS Port 5433"
                            className="bg-input border-border"
                          />
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={() => saveSettings.mutate(settingsForm)}
                      disabled={saveSettings.isPending}
                      className="bg-primary text-primary-foreground hover:bg-primary/95 font-bold mt-4"
                    >
                      {saveSettings.isPending ? "Saving..." : "Save Settings"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Dev Dialog ──────────────────────────────────────────────────────────── */}
      <Dialog open={devDialogOpen} onOpenChange={setDevDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-primary">{editingDevId ? "Edit Project" : "New Project"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Title *</Label><Input value={devForm.title} onChange={(e) => setDevForm({ ...devForm, title: e.target.value })} placeholder="Project name" className="bg-input border-border" /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={devForm.description} onChange={(e) => setDevForm({ ...devForm, description: e.target.value })} placeholder="What is this about?" className="bg-input border-border resize-none" rows={3} /></div>
            <div className="space-y-2"><Label>Category</Label><Input value={devForm.category} onChange={(e) => setDevForm({ ...devForm, category: e.target.value })} placeholder="e.g. Gameplay, Economy, World" className="bg-input border-border" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={devForm.status} onValueChange={(v) => setDevForm({ ...devForm, status: v as DevStatus })}>
                  <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="planned">Planned</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="paused">Paused</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Progress % (0–100)</Label><Input type="number" min={0} max={100} value={devForm.progress} onChange={(e) => setDevForm({ ...devForm, progress: e.target.value })} placeholder="e.g. 75" className="bg-input border-border" /></div>
            </div>
            <div className="space-y-2"><Label>Sort Order</Label><Input type="number" value={devForm.order} onChange={(e) => setDevForm({ ...devForm, order: e.target.value })} placeholder="e.g. 1" className="bg-input border-border" /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-border" onClick={() => setDevDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveDev} className="bg-primary text-primary-foreground hover:bg-primary/90">{editingDevId ? "Save Changes" : "Create Project"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Ann Dialog ──────────────────────────────────────────────────────────── */}
      <Dialog open={annDialogOpen} onOpenChange={setAnnDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-primary">{editingAnnId ? "Edit Announcement" : "New Announcement"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Title *</Label><Input value={annForm.title} onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })} placeholder="Announcement title" className="bg-input border-border" /></div>
            <div className="space-y-2"><Label>Content</Label><Textarea value={annForm.content} onChange={(e) => setAnnForm({ ...annForm, content: e.target.value })} placeholder="Announcement body…" className="bg-input border-border resize-none" rows={5} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={annForm.type} onValueChange={(v) => setAnnForm({ ...annForm, type: v as AnnType })}>
                  <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="update">Update</SelectItem><SelectItem value="event">Event</SelectItem><SelectItem value="maintenance">Maintenance</SelectItem><SelectItem value="general">General</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pin to top?</Label>
                <Select value={annForm.pinned ? "yes" : "no"} onValueChange={(v) => setAnnForm({ ...annForm, pinned: v === "yes" })}>
                  <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="no">No</SelectItem><SelectItem value="yes">📌 Pin it</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-border" onClick={() => setAnnDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveAnn} className="bg-primary text-primary-foreground hover:bg-primary/90">{editingAnnId ? "Save Changes" : "Post Announcement"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── User Edit Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={ticketReasonDialogOpen} onOpenChange={setTicketReasonDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-primary">{editingTicketReasonId ? "Edit Ticket Reason" : "New Ticket Reason"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Reason Label *</Label>
              <Input value={ticketReasonForm.label} onChange={(e) => setTicketReasonForm({ ...ticketReasonForm, label: e.target.value })} placeholder="Nickname Minecraft / Instagram / YouTube" className="bg-input border-border" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={ticketReasonForm.description} onChange={(e) => setTicketReasonForm({ ...ticketReasonForm, description: e.target.value })} placeholder="Short description shown to admins..." className="bg-input border-border resize-none" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={ticketReasonForm.isActive ? "active" : "hidden"} onValueChange={(v) => setTicketReasonForm({ ...ticketReasonForm, isActive: v === "active" })}>
                  <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="hidden">Hidden</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input type="number" value={ticketReasonForm.order} onChange={(e) => setTicketReasonForm({ ...ticketReasonForm, order: e.target.value })} placeholder="0" className="bg-input border-border" />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-border" onClick={() => setTicketReasonDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTicketReason} className="bg-primary text-primary-foreground hover:bg-primary/90">{editingTicketReasonId ? "Save Changes" : "Create Reason"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={userEditDialogOpen} onOpenChange={setUserEditDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader><DialogTitle className="text-primary">Edit User</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Username</Label><Input value={userEditForm.username} onChange={(e) => setUserEditForm({ ...userEditForm, username: e.target.value })} className="bg-input border-border" /></div>
            <div className="space-y-2"><Label>Display Name</Label><Input value={userEditForm.displayName} onChange={(e) => setUserEditForm({ ...userEditForm, displayName: e.target.value })} placeholder="Optional" className="bg-input border-border" /></div>
            <div className="space-y-2"><Label>Bio</Label><Textarea value={userEditForm.bio} onChange={(e) => setUserEditForm({ ...userEditForm, bio: e.target.value })} placeholder="Optional bio" className="bg-input border-border resize-none" rows={3} /></div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={userEditForm.role} onValueChange={(v) => setUserEditForm({ ...userEditForm, role: v as UserRole })}>
                <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="member">Member</SelectItem><SelectItem value="admin">Admin</SelectItem><SelectItem value="staff">Staff</SelectItem><SelectItem value="dev">Dev</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-border" onClick={() => setUserEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveUser} disabled={savingUser} className="bg-primary text-primary-foreground hover:bg-primary/90">{savingUser ? "Saving…" : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirms ──────────────────────────────────────────────────────── */}
      <Dialog open={deletingDevId !== null} onOpenChange={() => setDeletingDevId(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle>Delete project?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This cannot be undone.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-border" onClick={() => setDeletingDevId(null)}>Cancel</Button>
            <Button className="bg-destructive hover:bg-destructive/90 text-white" onClick={() => deletingDevId && handleDeleteDev(deletingDevId)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deletingAnnId !== null} onOpenChange={() => setDeletingAnnId(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle>Delete announcement?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This cannot be undone.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-border" onClick={() => setDeletingAnnId(null)}>Cancel</Button>
            <Button className="bg-destructive hover:bg-destructive/90 text-white" onClick={() => deletingAnnId && handleDeleteAnn(deletingAnnId)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Credit Edit Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={deletingTicketReasonId !== null} onOpenChange={() => setDeletingTicketReasonId(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle>Delete ticket reason?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Alasan ini tidak akan muncul lagi untuk tiket baru setelah dihapus.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-border" onClick={() => setDeletingTicketReasonId(null)}>Cancel</Button>
            <Button className="bg-destructive hover:bg-destructive/90 text-white" onClick={() => deletingTicketReasonId && handleDeleteTicketReason(deletingTicketReasonId)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-primary">{editingCreditId ? "Edit Credit" : "New Credit"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={creditForm.name} onChange={(e) => setCreditForm({ ...creditForm, name: e.target.value })} placeholder="Person/Team name" className="bg-input border-border" />
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Input value={creditForm.role} onChange={(e) => setCreditForm({ ...creditForm, role: e.target.value })} placeholder="e.g. Founder, Developer" className="bg-input border-border" />
            </div>
            
            <div className="space-y-2">
              <Label>Avatar Photo</Label>
              <div className="flex gap-2 items-center">
                <Input value={creditForm.avatarUrl} onChange={(e) => setCreditForm({ ...creditForm, avatarUrl: e.target.value })} placeholder="Image URL or upload file..." className="bg-input border-border flex-1" />
                <input type="file" ref={avatarInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/*" />
                <Button variant="outline" className="border-border text-xs shrink-0" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar}>
                  {uploadingAvatar ? "..." : "Upload"}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Card Background Image (Opsional)</Label>
              <div className="flex gap-2 items-center">
                <Input value={creditForm.backgroundUrl} onChange={(e) => setCreditForm({ ...creditForm, backgroundUrl: e.target.value })} placeholder="Background URL or upload file..." className="bg-input border-border flex-1" />
                <input type="file" ref={backgroundInputRef} onChange={handleBackgroundUpload} className="hidden" accept="image/*" />
                <Button variant="outline" className="border-border text-xs shrink-0" onClick={() => backgroundInputRef.current?.click()} disabled={uploadingBackground}>
                  {uploadingBackground ? "..." : "Upload"}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={creditForm.description} onChange={(e) => setCreditForm({ ...creditForm, description: e.target.value })} placeholder="Short biography/description..." className="bg-input border-border resize-none" rows={3} />
            </div>

            <div className="space-y-2">
              <Label>Border Style *</Label>
              <div className="grid grid-cols-4 gap-2">
                {[...Array(8)].map((_, i) => {
                  const frameNum = i + 1;
                  const frameName = `frame${frameNum}`;
                  const labels = ["Copper", "Silver", "Gold", "Azure", "Emerald", "Sun Glow", "Amethyst", "Royal"];
                  const isSelected = creditForm.borderType === frameName;
                  return (
                    <button
                      key={frameName}
                      type="button"
                      onClick={() => setCreditForm({ ...creditForm, borderType: frameName })}
                      className={`relative flex flex-col items-center justify-between p-2 rounded-lg border transition-all aspect-[3/4] overflow-hidden ${
                        isSelected 
                          ? "border-primary bg-primary/15 shadow-[0_0_8px_rgba(217,119,6,0.4)]" 
                          : "border-border bg-card/40 hover:border-primary/50"
                      }`}
                    >
                      <div className="relative w-full flex-1 flex items-center justify-center min-h-[50px]">
                        <img 
                          src={`/frames/${frameName}.png`} 
                          alt="" 
                          className="absolute inset-0 w-full h-full object-contain pointer-events-none" 
                        />
                        <div className="text-[10px] font-bold text-muted-foreground z-10 bg-black/40 px-1 rounded">
                          {frameNum}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold mt-1 text-foreground/85 truncate w-full text-center">
                        {labels[i]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Sort Order</Label>
              <Input type="number" value={creditForm.order} onChange={(e) => setCreditForm({ ...creditForm, order: e.target.value })} placeholder="e.g. 1" className="bg-input border-border" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-border" onClick={() => setCreditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveCredit} className="bg-primary text-primary-foreground hover:bg-primary/90">{editingCreditId ? "Save Changes" : "Create Credit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Credit Delete Confirm Dialog ─────────────────────────────────────────── */}
      <Dialog open={deletingCreditId !== null} onOpenChange={() => setDeletingCreditId(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle>Delete credit?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This cannot be undone.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-border" onClick={() => setDeletingCreditId(null)}>Cancel</Button>
            <Button className="bg-destructive hover:bg-destructive/90 text-white" onClick={() => deletingCreditId && handleDeleteCredit(deletingCreditId)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
