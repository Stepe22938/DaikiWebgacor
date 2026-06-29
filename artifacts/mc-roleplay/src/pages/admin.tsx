import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Redirect, Link, useLocation } from "wouter";
import { useClerk } from "@clerk/react";
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
  useListTicketMessages,
  useSendTicketMessage,
  getListTicketMessagesQueryOptions,
  useListForms,
  useCreateForm,
  useUpdateForm,
  useDeleteForm,
  useListFormResponses,
  useGetAdminGachaSettings,
  useUpdateAdminGachaSettings,
  useAdminCreateCosmetic,
  useAdminUpdateCosmetic,
  useAdminDeleteCosmetic,
  useAdminAdjustWallet,
  useGetGachaBoard,
  useAdminListConversations,
  useAdminUpdateConversation,
} from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  LayoutGrid,
  Hammer,
  Megaphone,
  Ticket,
  Users,
  ShieldAlert,
  Settings,
  LogOut,
  Search,
  Bell,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Plus,
  Activity,
  Menu,
  MessageSquare,
  Home,
  ClipboardList,
  User,
  Coins,
  TrendingUp,
  Wallet,
  Dices,
  Zap,
  BadgeCheck,
  Trophy,
  Gavel,
  Gift,
  Trash2,
  Pencil,
  Crown,
  CheckCircle2,
  XCircle,
  Video,
  ShoppingBag,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { format } from "date-fns";
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
type UserRole = "member" | "admin" | "staff" | "dev" | "dev_website" | "bot" | "ai";
type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

interface DevForm { title: string; description: string; category: string; status: DevStatus; progress: string; order: string; }
interface AnnForm { title: string; content: string; type: AnnType; pinned: boolean; imageUrl: string; }
interface UserEditForm { username: string; displayName: string; bio: string; role: UserRole; isVerified: boolean; }
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
interface ManualGrantForm {
  userId: string;
  grantTier: string;
  grantPackageSku: string;
  targetConversationId: string;
  applyBoostCount: string;
}

const emptyDev: DevForm = { title: "", description: "", category: "", status: "planned", progress: "", order: "" };
const emptyAnn: AnnForm = { title: "", content: "", type: "general", pinned: false, imageUrl: "" };
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
const emptyManualGrant: ManualGrantForm = {
  userId: "",
  grantTier: "",
  grantPackageSku: "",
  targetConversationId: "",
  applyBoostCount: "0",
};

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function getFieldChoices(optionsStr: string | null | undefined): string[] {
  if (!optionsStr) return [""];
  try {
    const parsed = JSON.parse(optionsStr);
    if (Array.isArray(parsed)) return parsed.length > 0 ? parsed : [""];
    return [String(parsed)];
  } catch {
    const split = optionsStr.split(",").map(o => o.trim());
    return split.length > 0 ? split : [""];
  }
}

const STATUS_COLORS: Record<DevStatus, string> = {
  planned: "bg-blue-900/40 text-blue-300",
  in_progress: "bg-yellow-900/40 text-yellow-300",
  completed: "bg-green-900/40 text-green-300",
  paused: "bg-gray-700/40 text-gray-400",
};
const STATUS_LABELS: Record<DevStatus, string> = { planned: "Planned", in_progress: "In Progress", completed: "Completed", paused: "Paused" };
const ROLE_LABELS: Record<UserRole, string> = {
  member: "Member",
  admin: "Admin",
  staff: "Staff",
  dev: "Dev",
  dev_website: "Dev Website",
  bot: "Bot",
  ai: "AI Assistant",
};

const ROLE_BADGE_CLASSES: Record<UserRole, string> = {
  member: "bg-muted text-muted-foreground",
  admin: "bg-primary/20 text-primary",
  staff: "bg-sky-500/15 text-sky-300",
  dev: "bg-emerald-500/15 text-emerald-300",
  dev_website: "bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30",
  bot: "bg-gray-500/15 text-gray-300",
  ai: "bg-purple-500/15 text-purple-300 border border-purple-500/30",
};

export default function Admin() {
  const { data: user, isLoading } = useGetMe();
  const role = user?.role;
  const canManageAdmin = role === "admin" || role === "dev_website";
  const canManageAnnouncements = role === "admin" || role === "staff" || role === "dev_website";
  const canManageTickets = role === "admin" || role === "dev" || role === "dev_website";
  const canManagePayments = role === "admin" || role === "dev_website";
  const canManageDevWebsiteRole = role === "dev_website";
  const isDevWebsite = role === "dev_website";
  const canQueryAdmin = role === "admin" || isDevWebsite;
  const { data: devs, isLoading: devsLoading } = useListDevelopments();
  const { data: anns, isLoading: annsLoading } = useListAnnouncements();
  const { data: users, isLoading: usersLoading } = useListUsers({
    query: { enabled: canQueryAdmin } as any,
  });
  const { data: tickets = [], isLoading: ticketsLoading } = useListTickets();
  const { data: paymentTickets = [], isLoading: paymentTicketsLoading } = useQuery({
    queryKey: ["/api/admin/payments"],
    queryFn: () => customFetch<any[]>("/api/admin/payments"),
    enabled: canManagePayments,
  });
  const { data: paymentMembershipData } = useQuery({
    queryKey: ["/api/me/membership", "admin-preview"],
    queryFn: () => customFetch<any>("/api/me/membership"),
    enabled: canManagePayments,
  });
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
  const paymentActionMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: any }) => customFetch(`/api/admin/payments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
  });
  const manualGrantMutation = useMutation({
    mutationFn: async (body: any) => customFetch("/api/admin/membership-grants", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
  });
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
  const [userEditForm, setUserEditForm] = useState<UserEditForm>({ username: "", displayName: "", bio: "", role: "member", isVerified: false });
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
  const [selectedTicketChat, setSelectedTicketChat] = useState<any | null>(null);
  const [manualGrantForm, setManualGrantForm] = useState<ManualGrantForm>(emptyManualGrant);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [uploadingAnnImage, setUploadingAnnImage] = useState(false);
  const annImageInputRef = useRef<HTMLInputElement>(null);

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

  // Groups admin
  const [groupSearch, setGroupSearch] = useState("");
  const { data: adminGroups, isLoading: adminGroupsLoading } = useAdminListConversations({
    query: { enabled: canQueryAdmin } as any,
  });
  const adminUpdateConv = useAdminUpdateConversation();

  // Gacha & Wallet Sub-tab State
  const [gachaSubTab, setGachaSubTab] = useState<"settings" | "registry" | "wallets" | "quests" | "shop">("settings");

  // Gacha Settings Hooks & Mutation
  const { data: adminGachaSettings, isLoading: adminGachaSettingsLoading } = useGetAdminGachaSettings({
    query: { enabled: canManageAdmin } as any,
  });
  const updateGachaSettings = useUpdateAdminGachaSettings();

  // Cosmetics Pool Hooks & Mutation
  const { data: gachaBoard, isLoading: gachaBoardLoading } = useGetGachaBoard({
    query: { enabled: canManageAdmin } as any,
  });
  const createCosmetic = useAdminCreateCosmetic();
  const updateCosmetic = useAdminUpdateCosmetic();
  const deleteCosmetic = useAdminDeleteCosmetic();

  // Wallet Audit Hook
  const adjustWallet = useAdminAdjustWallet();

  // Gacha settings state
  const [gachaSettingsForm, setGachaSettingsForm] = useState({
    spinCost1: 9,
    spinCost10: 79,
    spinCost25: 195,
    spinCost50: 390,
    duplicateRefund: 100,
    rateS: 1.5,
    rateA: 8.0,
    rateB: 25.0,
    rateC: 60.0,
  });
  const [hasInitializedGachaSettings, setHasInitializedGachaSettings] = useState(false);

  useEffect(() => {
    if (adminGachaSettings && !hasInitializedGachaSettings) {
      setGachaSettingsForm({
        spinCost1: adminGachaSettings.spinCost1 ?? 9,
        spinCost10: adminGachaSettings.spinCost10 ?? 79,
        spinCost25: adminGachaSettings.spinCost25 ?? 195,
        spinCost50: adminGachaSettings.spinCost50 ?? 390,
        duplicateRefund: adminGachaSettings.duplicateRefund ?? 100,
        rateS: adminGachaSettings.rateS ?? 1.5,
        rateA: adminGachaSettings.rateA ?? 8.0,
        rateB: adminGachaSettings.rateB ?? 25.0,
        rateC: adminGachaSettings.rateC ?? 60.0,
      });
      setHasInitializedGachaSettings(true);
    }
  }, [adminGachaSettings, hasInitializedGachaSettings]);

  // Cosmetic Registry Form State
  const emptyCosmetic: { name: string; type: "badge" | "border" | "background" | "premium" | "premium_plus"; rarity: "S" | "A" | "B" | "C" | "D"; value: string; description: string; price: number; isGacha: boolean; isShop: boolean } = {
    name: "",
    type: "border",
    rarity: "S",
    value: "",
    description: "",
    price: 0,
    isGacha: true,
    isShop: false,
  };
  const [cosmeticForm, setCosmeticForm] = useState(emptyCosmetic);
  const [editingCosmeticId, setEditingCosmeticId] = useState<number | null>(null);
  const [cosmeticDialogOpen, setCosmeticDialogOpen] = useState(false);
  const [deletingCosmeticId, setDeletingCosmeticId] = useState<number | null>(null);

  // User wallet auditor state
  const [walletTargetUser, setWalletTargetUser] = useState<any | null>(null);
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [walletAdjustmentAmount, setWalletAdjustmentAmount] = useState("");
  const [walletAdjustmentReason, setWalletAdjustmentReason] = useState("");



  const openNewCosmetic = () => {
    setCosmeticForm(emptyCosmetic);
    setEditingCosmeticId(null);
    setCosmeticDialogOpen(true);
  };

  const openNewShopItem = () => {
    setCosmeticForm({
      ...emptyCosmetic,
      isGacha: false,
      isShop: true,
    });
    setEditingCosmeticId(null);
    setCosmeticDialogOpen(true);
  };

  const openEditCosmetic = (c: any) => {
    setCosmeticForm({
      name: c.name,
      type: c.type,
      rarity: c.rarity,
      value: c.value,
      description: c.description ?? "",
      price: c.price ?? 0,
      isGacha: c.isGacha ?? true,
      isShop: c.isShop ?? false,
    });
    setEditingCosmeticId(c.id);
    setCosmeticDialogOpen(true);
  };

  const handleSaveCosmetic = async () => {
    if (!cosmeticForm.name.trim()) {
      toast({ title: "Error", description: "Name is required.", variant: "destructive" });
      return;
    }
    if (!cosmeticForm.value.trim()) {
      toast({ title: "Error", description: "Value is required.", variant: "destructive" });
      return;
    }

    try {
      const payload = {
        name: cosmeticForm.name.trim(),
        type: cosmeticForm.type,
        rarity: cosmeticForm.rarity,
        value: cosmeticForm.value.trim(),
        description: cosmeticForm.description.trim() || undefined,
        price: cosmeticForm.price,
        isGacha: cosmeticForm.isGacha,
        isShop: cosmeticForm.isShop,
      };

      if (editingCosmeticId !== null) {
        await updateCosmetic.mutateAsync({ id: editingCosmeticId, data: payload });
        toast({ title: "Success", description: "Cosmetic item updated." });
      } else {
        await createCosmetic.mutateAsync({ data: payload });
        toast({ title: "Success", description: "Cosmetic item added to registry." });
      }
      setCosmeticDialogOpen(false);
      invalidate("/api/gacha/board");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save cosmetic.", variant: "destructive" });
    }
  };

  const handleDeleteCosmetic = async (id: number) => {
    try {
      await deleteCosmetic.mutateAsync({ id });
      toast({ title: "Deleted", description: "Cosmetic item removed from system." });
      invalidate("/api/gacha/board");
      setDeletingCosmeticId(null);
    } catch {
      toast({ title: "Error", description: "Failed to delete cosmetic.", variant: "destructive" });
    }
  };

  const handleSaveWalletAdjustment = async () => {
    if (!walletTargetUser) return;
    const amountNum = parseInt(walletAdjustmentAmount, 10);
    if (isNaN(amountNum) || amountNum === 0) {
      toast({ title: "Error", description: "Please enter a valid non-zero diamond amount.", variant: "destructive" });
      return;
    }

    try {
      await adjustWallet.mutateAsync({
        id: walletTargetUser.id,
        data: {
          amount: amountNum,
          reason: walletAdjustmentReason.trim() || undefined,
        },
      });
      toast({ title: "Wallet Adjusted", description: `Adjusted balance of ${walletTargetUser.displayName || walletTargetUser.username} by ${amountNum} diamonds.` });
      setWalletDialogOpen(false);
      invalidate("/api/users", "/api/gacha/board", "/api/wallet/transactions");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to adjust wallet balance.", variant: "destructive" });
    }
  };

  // Forms & Voting state
  const { data: forms = [], isLoading: formsLoading } = useListForms();
  const createFormMutation = useCreateForm();
  const updateFormMutation = useUpdateForm();
  const deleteFormMutation = useDeleteForm();
  const [formsDialogOpen, setFormsDialogOpen] = useState(false);
  const [deletingFormId, setDeletingFormId] = useState<number | null>(null);
  const [selectedFormResponses, setSelectedFormResponses] = useState<any | null>(null);
  const [editingFormId, setEditingFormId] = useState<number | null>(null);

  // Form creation input fields state
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formType, setFormType] = useState<"poll" | "form">("poll");
  const [formDeadline, setFormDeadline] = useState("");
  const [pollOptions, setPollOptions] = useState<Array<{ id?: number; label: string }>>([
    { label: "" },
    { label: "" }
  ]);
  const [formFields, setFormFields] = useState<Array<{ id?: number; label: string; fieldType: "text" | "textarea" | "radio" | "select"; options: string; required: boolean }>>([
    { label: "", fieldType: "text", options: "", required: false }
  ]);

  const handleOpenEditForm = async (form: any) => {
    try {
      const detail = await customFetch<any>(`/api/forms/${form.id}`);
      setEditingFormId(form.id);
      setFormTitle(detail.title);
      setFormDescription(detail.description || "");
      setFormType(detail.type);
      setFormDeadline(detail.deadline ? detail.deadline.split("T")[0] : "");
      if (detail.type === "poll") {
        setPollOptions(detail.options.map((o: any) => ({ id: o.id, label: o.label })));
      } else {
        setFormFields(detail.fields.map((f: any) => ({
          id: f.id,
          label: f.label,
          fieldType: f.fieldType,
          options: f.options || "",
          required: f.required
        })));
      }
      setFormsDialogOpen(true);
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to fetch form details.", variant: "destructive" });
    }
  };

  const handleSaveForm = async () => {
    if (!formTitle.trim()) {
      toast({ title: "Error", description: "Title is required.", variant: "destructive" });
      return;
    }
    
    try {
      const payload: any = {
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        deadline: formDeadline ? new Date(formDeadline).toISOString() : null,
      };

      if (formType === "poll") {
        const filteredOptions = pollOptions.map(o => ({ id: o.id, label: o.label.trim() })).filter(o => o.label.length > 0);
        if (filteredOptions.length < 2) {
          toast({ title: "Error", description: "At least 2 non-empty options are required for a poll.", variant: "destructive" });
          return;
        }
        payload.options = filteredOptions.map((o, idx) => ({ id: o.id, label: o.label, order: idx }));
      } else {
        const filteredFields = formFields.filter(f => f.label.trim().length > 0);
        if (filteredFields.length < 1) {
          toast({ title: "Error", description: "At least 1 field is required for a form.", variant: "destructive" });
          return;
        }
        payload.fields = filteredFields.map((f, idx) => ({
          id: f.id,
          label: f.label.trim(),
          fieldType: f.fieldType,
          options: (f.options || "")
            .split(",")
            .map(o => o.trim())
            .filter(Boolean)
            .join(", ") || undefined,
          required: f.required,
          order: idx
        }));
      }

      if (editingFormId) {
        await updateFormMutation.mutateAsync({ id: editingFormId, data: payload });
        toast({ title: "Form updated", description: "Poll or form successfully updated!" });
      } else {
        payload.type = formType;
        await createFormMutation.mutateAsync({ data: payload });
        toast({ title: "Form created", description: "New poll or form successfully launched!" });
      }
      setFormsDialogOpen(false);
      invalidate("/api/forms");
      if (editingFormId) {
        invalidate(`/api/forms/${editingFormId}`);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save form.", variant: "destructive" });
    }
  };

  const handleDeleteForm = async (id: number) => {
    try {
      await deleteFormMutation.mutateAsync({ id });
      toast({ title: "Deleted", description: "Form successfully deleted." });
      setDeletingFormId(null);
      invalidate("/api/forms");
    } catch {
      toast({ title: "Error", description: "Failed to delete form.", variant: "destructive" });
    }
  };

  // System Settings State & Query
  // Read from the admin-only endpoint so SayaBayar credentials are available
  // to the form (the public /api/settings strips them).
  const { data: currentSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ["/api/admin/settings"],
    queryFn: () => customFetch<any>("/api/admin/settings"),
  });

  const saveSettings = useMutation({
    mutationFn: (data: any) =>
      customFetch<any>("/api/settings", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({ title: "Settings saved", description: "Homepage configurations updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
    onError: (err: any) => {
      const msg = err?.message || err?.error || "Failed to save settings.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const handleSaveSettings = () => {
    if ((settingsForm.premiumPrice ?? 0) < 1000) {
      toast({ title: "Harga tidak valid", description: "Premium Plan Price minimal Rp 1.000.", variant: "destructive" });
      return;
    }
    if ((settingsForm.premiumPlusPrice ?? 0) < 1000) {
      toast({ title: "Harga tidak valid", description: "Premium+ Plan Price minimal Rp 1.000.", variant: "destructive" });
      return;
    }
    if ((settingsForm.giftPremiumPrice ?? 0) < 1000) {
      toast({ title: "Harga tidak valid", description: "Gift Premium Price minimal Rp 1.000.", variant: "destructive" });
      return;
    }
    if ((settingsForm.giftPremiumPlusPrice ?? 0) < 1000) {
      toast({ title: "Harga tidak valid", description: "Gift Premium+ Price minimal Rp 1.000.", variant: "destructive" });
      return;
    }
    if ((settingsForm.diamondPackRupiah ?? 0) < 1) {
      toast({ title: "Rate tidak valid", description: "Rupiah untuk tukar diamond minimal Rp 1.", variant: "destructive" });
      return;
    }
    if ((settingsForm.diamondPackDiamonds ?? 0) < 1) {
      toast({ title: "Rate tidak valid", description: "Jumlah diamond hasil tukar minimal 1.", variant: "destructive" });
      return;
    }
    saveSettings.mutate(settingsForm);
  };

  const [settingsForm, setSettingsForm] = useState({
    realmName: "",
    realmLogoUrl: "",
    heroTitle: "",
    heroSubtitle: "",
    serverIP: "",
    mcVersion: "",
    specsCpu: "",
    specsMemory: "",
    specsStorage: "",
    specsLocation: "",
    sayabayarApiKey: "",
    sayabayarWebhookSecret: "",
    premiumPrice: 25000,
    premiumPlusPrice: 50000,
    giftPremiumPrice: 25000,
    giftPremiumPlusPrice: 50000,
    diamondPackRupiah: 17000,
    diamondPackDiamonds: 100,
  });

  useEffect(() => {
    if (!currentSettings) return;
    setSettingsForm({
      realmName: currentSettings.realmName || "Arcadia Guild",
      realmLogoUrl: currentSettings.realmLogoUrl || "",
      heroTitle: currentSettings.heroTitle || "",
      heroSubtitle: currentSettings.heroSubtitle || "",
      serverIP: currentSettings.serverIP || "",
      mcVersion: currentSettings.mcVersion || "",
      specsCpu: currentSettings.specsCpu || "",
      specsMemory: currentSettings.specsMemory || "",
      specsStorage: currentSettings.specsStorage || "",
      specsLocation: currentSettings.specsLocation || "",
      sayabayarApiKey: currentSettings.sayabayarApiKey || "",
      sayabayarWebhookSecret: currentSettings.sayabayarWebhookSecret || "",
      premiumPrice: currentSettings.premiumPrice ?? 25000,
      premiumPlusPrice: currentSettings.premiumPlusPrice ?? 50000,
      giftPremiumPrice: currentSettings.giftPremiumPrice ?? 25000,
      giftPremiumPlusPrice: currentSettings.giftPremiumPlusPrice ?? 50000,
      diamondPackRupiah: currentSettings.diamondPackRupiah ?? 17000,
      diamondPackDiamonds: currentSettings.diamondPackDiamonds ?? 100,
    });
  }, [currentSettings]);

  // ── Boost Packages Management ───────────────────────────────────────────────
  const { data: boostPackagesAdmin, isLoading: boostPkgLoading } = useQuery({
    queryKey: ["/api/admin/boost-packages"],
    queryFn: () => customFetch<any[]>("/api/admin/boost-packages"),
  });

  const emptyPkg = { sku: "", displayName: "", description: "", boostCount: 1, priceIdr: 25000, discountPriceIdr: "", durationDays: 30, active: true };
  const [pkgForm, setPkgForm] = useState(emptyPkg);
  const [editingPkgId, setEditingPkgId] = useState<number | null>(null);
  const [pkgDialogOpen, setPkgDialogOpen] = useState(false);

  const createPkg = useMutation({
    mutationFn: (data: any) => customFetch<any>("/api/admin/boost-packages", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: "Paket dibuat" }); queryClient.invalidateQueries({ queryKey: ["/api/admin/boost-packages"] }); setPkgDialogOpen(false); setPkgForm(emptyPkg); },
    onError: (err: any) => toast({ title: "Error", description: err?.message || "Gagal membuat paket", variant: "destructive" }),
  });
  const updatePkg = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => customFetch<any>(`/api/admin/boost-packages/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: "Paket diperbarui" }); queryClient.invalidateQueries({ queryKey: ["/api/admin/boost-packages"] }); queryClient.invalidateQueries({ queryKey: ["/api/me/membership"] }); setPkgDialogOpen(false); setPkgForm(emptyPkg); setEditingPkgId(null); },
    onError: (err: any) => toast({ title: "Error", description: err?.message || "Gagal update paket", variant: "destructive" }),
  });
  const deletePkg = useMutation({
    mutationFn: (id: number) => customFetch<any>(`/api/admin/boost-packages/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Paket dihapus" }); queryClient.invalidateQueries({ queryKey: ["/api/admin/boost-packages"] }); },
    onError: (err: any) => toast({ title: "Error", description: err?.message || "Gagal hapus paket", variant: "destructive" }),
  });

  const handleSavePkg = () => {
    if (!pkgForm.sku.trim() || !pkgForm.displayName.trim()) {
      toast({ title: "SKU dan nama wajib diisi", variant: "destructive" }); return;
    }
    if (pkgForm.priceIdr < 1000) {
      toast({ title: "Harga minimal Rp 1.000", variant: "destructive" }); return;
    }
    const discountVal = pkgForm.discountPriceIdr === "" || pkgForm.discountPriceIdr === null ? null : Number(pkgForm.discountPriceIdr);
    if (discountVal !== null && discountVal < 1000) {
      toast({ title: "Harga diskon minimal Rp 1.000", variant: "destructive" }); return;
    }
    const payload = {
      sku: pkgForm.sku.trim(),
      displayName: pkgForm.displayName.trim(),
      description: pkgForm.description.trim() || null,
      boostCount: Number(pkgForm.boostCount),
      priceIdr: Number(pkgForm.priceIdr),
      discountPriceIdr: discountVal,
      durationDays: Number(pkgForm.durationDays),
      active: pkgForm.active,
    };
    if (editingPkgId !== null) {
      updatePkg.mutate({ id: editingPkgId, data: payload });
    } else {
      createPkg.mutate(payload);
    }
  };

  const realmName = currentSettings?.realmName || "Arcadia Guild";
  const realmLogoUrl = currentSettings?.realmLogoUrl || "";

  const defaultTab = role === "staff" ? "announcements" : role === "dev" ? "tickets" : "developments";

  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState(defaultTab === "developments" ? "dashboard" : defaultTab);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Quests management state
  const { data: adminQuests, isLoading: adminQuestsLoading, refetch: refetchAdminQuests } = useQuery<any[]>({
    queryKey: ["/api/quests", "admin"],
    queryFn: () => customFetch<any[]>("/api/quests"),
    enabled: activeTab === "gacha",
  });

  const [localQuests, setLocalQuests] = useState<any[]>([]);
  useEffect(() => {
    if (adminQuests) {
      setLocalQuests(adminQuests);
    }
  }, [adminQuests]);

  const saveQuestsMutation = useMutation({
    mutationFn: (questsArray: any[]) => customFetch<any>("/api/admin/quests", {
      method: "POST",
      body: JSON.stringify(questsArray),
      headers: { "Content-Type": "application/json" }
    }),
    onSuccess: () => {
      toast({ title: "Misi Disimpan!", description: "Daftar misi berhasil diperbarui di database." });
      queryClient.invalidateQueries({ queryKey: ["/api/quests"] });
      refetchAdminQuests();
    },
    onError: (err: any) => {
      toast({ title: "Gagal Menyimpan", description: err?.message || "Terjadi kesalahan.", variant: "destructive" });
    }
  });

  // Quest Dialog Form State
  const emptyQuestForm = {
    title: "",
    desc: "",
    target: 1,
    reward: 100,
    type: "chat" as "chat" | "search" | "dm" | "video",
    videoUrl: "",
    duration: 15,
  };
  const [questForm, setQuestForm] = useState(emptyQuestForm);
  const [editingQuestId, setEditingQuestId] = useState<number | null>(null);
  const [questDialogOpen, setQuestDialogOpen] = useState(false);

  const handleSaveQuest = () => {
    if (!questForm.title.trim()) {
      toast({ title: "Error", description: "Title is required.", variant: "destructive" });
      return;
    }

    let newQuests: any[];
    if (editingQuestId !== null) {
      newQuests = localQuests.map((q) => 
        q.id === editingQuestId 
          ? { ...q, title: questForm.title.trim(), desc: questForm.desc.trim(), target: questForm.target, reward: questForm.reward, type: questForm.type, videoUrl: questForm.type === "video" ? questForm.videoUrl.trim() : "", duration: questForm.type === "video" ? questForm.duration : undefined }
          : q
      );
      toast({ title: "Misi Diperbarui" });
    } else {
      const nextId = Math.max(...localQuests.map((q) => q.id), 0) + 1;
      newQuests = [
        ...localQuests,
        { id: nextId, title: questForm.title.trim(), desc: questForm.desc.trim(), target: questForm.target, reward: questForm.reward, type: questForm.type, videoUrl: questForm.type === "video" ? questForm.videoUrl.trim() : "", duration: questForm.type === "video" ? questForm.duration : undefined, claimed: false }
      ];
      toast({ title: "Misi Ditambahkan" });
    }

    setLocalQuests(newQuests);
    saveQuestsMutation.mutate(newQuests);
    setQuestDialogOpen(false);
  };

  const handleDeleteQuest = (id: number) => {
    if (confirm("Hapus misi ini?")) {
      const newQuests = localQuests.filter((q) => q.id !== id);
      setLocalQuests(newQuests);
      saveQuestsMutation.mutate(newQuests);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && ["dashboard", "developments", "announcements", "tickets", "payments", "forms", "users", "credits", "settings", "gacha", "groups"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [window.location.search]);

  const { signOut } = useClerk();

  if (isLoading) return <div className="p-8 text-slate-500 font-bold bg-[#f8f7fa] min-h-screen flex items-center justify-center">Loading Admin Portal...</div>;
  if (!canManageAdmin && !canManageAnnouncements && !canManageTickets) return <Redirect to="/member" />;

  const handleTabChange = (tabName: string) => {
    setActiveTab(tabName);
    setLocation(`/admin?tab=${tabName}`);
  };

  const handleTabChangeMobile = (tabName: string) => {
    setActiveTab(tabName);
    setLocation(`/admin?tab=${tabName}`);
    setMobileSidebarOpen(false);
  };

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
    setAnnForm({ title: ann.title, content: ann.content, type: ann.type as AnnType, pinned: ann.pinned, imageUrl: (ann as any).imageUrl ?? "" });
    setEditingAnnId(ann.id); setAnnDialogOpen(true);
  };
  const handleSaveAnn = async () => {
    if (!annForm.title.trim()) { toast({ title: "Error", description: "Title is required.", variant: "destructive" }); return; }
    try {
      const payload: any = { title: annForm.title.trim(), content: annForm.content.trim(), type: annForm.type, pinned: annForm.pinned };
      if (annForm.imageUrl) payload.imageUrl = annForm.imageUrl;
      else payload.imageUrl = null;
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
    setUserEditForm({ username: u.username, displayName: u.displayName ?? "", bio: u.bio ?? "", role: u.role as UserRole, isVerified: (u as any).isVerified ?? false });
    setEditingUserId(u.id); setUserEditDialogOpen(true);
  };
  const handleSaveUser = async () => {
    if (!editingUserId) return;
    setSavingUser(true);
    try {
      const body: Record<string, any> = {};
      if (userEditForm.username.trim()) body.username = userEditForm.username.trim();
      if (userEditForm.displayName !== undefined) body.displayName = userEditForm.displayName;
      if (userEditForm.bio !== undefined) body.bio = userEditForm.bio;
      body.role = userEditForm.role;
      body.isVerified = userEditForm.isVerified;
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

  const handlePaymentDecision = async (ticket: any, paymentStatus: "paid" | "rejected") => {
    try {
      await paymentActionMutation.mutateAsync({
        id: ticket.id,
        body: {
          paymentStatus,
          grantTier: ticket.requestedTier ?? undefined,
          grantPackageSku: ticket.requestedPackageSku ?? undefined,
          targetConversationId: ticket.requestedConversationId ?? undefined,
        },
      });
      toast({
        title: paymentStatus === "paid" ? "Payment approved" : "Payment rejected",
        description: paymentStatus === "paid"
          ? "Tier / boost berhasil digrant sesuai ticket."
          : "Ticket pembayaran ditolak.",
      });
      invalidate("/api/admin/payments", "/api/tickets", "/api/me/membership");
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to process payment.", variant: "destructive" });
    }
  };

  const handleManualGrant = async () => {
    if (!manualGrantForm.userId || (!manualGrantForm.grantTier && !manualGrantForm.grantPackageSku)) {
      toast({ title: "Error", description: "Pilih user dan grant dulu.", variant: "destructive" });
      return;
    }

    try {
      await manualGrantMutation.mutateAsync({
        userId: Number(manualGrantForm.userId),
        grantTier: manualGrantForm.grantTier || undefined,
        grantPackageSku: manualGrantForm.grantPackageSku || undefined,
        targetConversationId: manualGrantForm.targetConversationId ? Number(manualGrantForm.targetConversationId) : undefined,
        applyBoostCount: manualGrantForm.applyBoostCount ? Number(manualGrantForm.applyBoostCount) : 0,
      });
      toast({ title: "Manual grant berhasil", description: "Premium / boost sudah dikasih ke user target." });
      setManualGrantForm(emptyManualGrant);
      invalidate("/api/admin/payments", "/api/me/membership", "/api/users");
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to grant membership.", variant: "destructive" });
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

  const handleAnnImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Error", description: "Only image files are allowed.", variant: "destructive" });
      return;
    }
    setUploadingAnnImage(true);
    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": file.type, "x-file-name": file.name },
        body: file,
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setAnnForm((prev) => ({ ...prev, imageUrl: data.url }));
      toast({ title: "Success", description: "Image uploaded." });
    } catch {
      toast({ title: "Error", description: "Failed to upload image.", variant: "destructive" });
    } finally {
      setUploadingAnnImage(false);
      if (annImageInputRef.current) annImageInputRef.current.value = "";
    }
  };

  // We can calculate actual stats counts:
  const activeCitizens = users?.length || 0;
  const activeProjects = devs?.length || 0;
  const openTicketsCount = tickets?.filter(t => t.status === "open" || t.status === "in_progress").length || 0;
  const totalAnnouncements = anns?.length || 0;

  // Recharts Development status counts:
  const statusCounts = devs ? {
    planned: devs.filter(d => d.status === "planned").length,
    in_progress: devs.filter(d => d.status === "in_progress").length,
    completed: devs.filter(d => d.status === "completed").length,
    paused: devs.filter(d => d.status === "paused").length,
  } : { planned: 0, in_progress: 0, completed: 0, paused: 0 };

  const statusChartData = [
    { name: "Planned", count: statusCounts.planned, color: "#818cf8" },
    { name: "In Progress", count: statusCounts.in_progress, color: "#fbbf24" },
    { name: "Completed", count: statusCounts.completed, color: "#34d399" },
    { name: "Paused", count: statusCounts.paused, color: "#9ca3af" },
  ];

  // Recharts Ticket trends (by date):
  const ticketsByDate = [...tickets]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .reduce((acc: any[], ticket) => {
      const dateStr = format(new Date(ticket.createdAt), "dd MMM");
      const existing = acc.find(item => item.date === dateStr);
      if (existing) {
        existing.tickets += 1;
      } else {
        acc.push({ date: dateStr, tickets: 1 });
      }
      return acc;
    }, []);

  const lineChartData = ticketsByDate.length > 0 ? ticketsByDate : [
    { date: "01 Jun", tickets: 1 },
    { date: "02 Jun", tickets: 2 },
    { date: "03 Jun", tickets: 1 },
    { date: "04 Jun", tickets: 3 },
    { date: "05 Jun", tickets: 2 },
    { date: "06 Jun", tickets: 5 },
    { date: "07 Jun", tickets: 4 },
  ];

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
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Admin Portal</span>
            </div>
          </Link>

          {/* Sidebar Links */}
          <div className="p-4 space-y-6">
            <div className="space-y-1.5">
              <span className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest block">General</span>
              <nav className="space-y-1">
                <button
                  onClick={() => handleTabChange("dashboard")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "dashboard"
                      ? "bg-violet-50 text-[#6366f1]"
                      : "text-slate-500 hover:bg-slate-55 hover:text-slate-900"
                  }`}
                >
                  <LayoutGrid className="w-4.5 h-4.5" /> Dashboard
                </button>
                {canManageAdmin && (
                  <button
                    onClick={() => handleTabChange("developments")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === "developments"
                        ? "bg-violet-50 text-[#6366f1]"
                        : "text-slate-500 hover:bg-slate-55 hover:text-slate-900"
                    }`}
                  >
                    <Hammer className="w-4.5 h-4.5" /> The Forge
                  </button>
                )}
                {canManageAnnouncements && (
                  <button
                    onClick={() => handleTabChange("announcements")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === "announcements"
                        ? "bg-violet-50 text-[#6366f1]"
                        : "text-slate-500 hover:bg-slate-55 hover:text-slate-900"
                    }`}
                  >
                    <Megaphone className="w-4.5 h-4.5" /> Town Crier
                  </button>
                )}
                {canManageTickets && (
                  <button
                    onClick={() => handleTabChange("tickets")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === "tickets"
                        ? "bg-violet-50 text-[#6366f1]"
                        : "text-slate-500 hover:bg-slate-55 hover:text-slate-900"
                    }`}
                  >
                    <Ticket className="w-4.5 h-4.5" /> Tickets
                  </button>
                )}
                {canManagePayments && (
                  <button
                    onClick={() => handleTabChange("payments")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === "payments"
                        ? "bg-violet-50 text-[#6366f1]"
                        : "text-slate-500 hover:bg-slate-55 hover:text-slate-900"
                    }`}
                  >
                    <Wallet className="w-4.5 h-4.5" /> Payments
                  </button>
                )}
                {canManageAdmin && (
                  <button
                    onClick={() => handleTabChange("forms")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === "forms"
                        ? "bg-violet-50 text-[#6366f1]"
                        : "text-slate-500 hover:bg-slate-55 hover:text-slate-900"
                    }`}
                  >
                    <ClipboardList className="w-4.5 h-4.5" /> Voting & Forms
                  </button>
                )}
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

            {canManageAdmin && (
              <div className="space-y-1.5">
                <span className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest block">Tools</span>
                <nav className="space-y-1">
                  <button
                    onClick={() => handleTabChange("users")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === "users"
                        ? "bg-violet-50 text-[#6366f1]"
                        : "text-slate-500 hover:bg-slate-55 hover:text-slate-900"
                    }`}
                  >
                    <Users className="w-4.5 h-4.5" /> Scribes
                  </button>
                  <button
                    onClick={() => handleTabChange("credits")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === "credits"
                        ? "bg-violet-50 text-[#6366f1]"
                        : "text-slate-500 hover:bg-slate-55 hover:text-slate-900"
                    }`}
                  >
                    <ShieldAlert className="w-4.5 h-4.5" /> Arcadia Credits
                  </button>
                  <button
                    onClick={() => handleTabChange("gacha")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === "gacha"
                        ? "bg-violet-50 text-[#6366f1]"
                        : "text-slate-500 hover:bg-slate-55 hover:text-slate-900"
                    }`}
                  >
                    <Coins className="w-4.5 h-4.5" /> Gacha & Wallet
                  </button>
                  <button
                    onClick={() => handleTabChange("groups")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === "groups"
                        ? "bg-violet-50 text-[#6366f1]"
                        : "text-slate-500 hover:bg-slate-55 hover:text-slate-900"
                    }`}
                  >
                    <Users className="w-4.5 h-4.5" /> Groups
                  </button>
                  <button
                    onClick={() => handleTabChange("settings")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === "settings"
                        ? "bg-violet-50 text-[#6366f1]"
                        : "text-slate-500 hover:bg-slate-55 hover:text-slate-900"
                    }`}
                  >
                    <Settings className="w-4.5 h-4.5" /> Realm Settings
                  </button>
                </nav>
              </div>
            )}
          </div>
        </div>

        {/* User Account / Profile Details Bottom Sidebar */}
        <div className="p-4 border-t border-[#eae8f5] space-y-3">
          <div className="flex items-center gap-3 px-2 py-1">
            <Avatar className="h-9 w-9 border border-[#eae8f5]">
              <AvatarImage src={user?.avatarUrl || undefined} />
              <AvatarFallback className="text-xs bg-slate-100 font-extrabold text-[#6366f1]">
                {getInitials(user?.displayName || user?.username)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#110e3d] truncate">{user?.displayName || user?.username}</p>
              <p className="text-[10px] text-slate-400 font-bold capitalize">{user?.role?.replace('_', ' ') || "Admin"}</p>
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
                    <span className="text-[10px] text-slate-400 font-bold">Admin Portal</span>
                  </div>
                </Link>
                <Button variant="ghost" size="sm" onClick={() => setMobileSidebarOpen(false)} className="text-slate-400 hover:text-[#110e3d]">✕</Button>
              </div>

              <nav className="space-y-1">
                <button
                  onClick={() => handleTabChangeMobile("dashboard")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "dashboard" ? "bg-violet-50 text-[#6366f1]" : "text-slate-500 hover:bg-slate-55"
                  }`}
                >
                  <LayoutGrid className="w-4.5 h-4.5" /> Dashboard
                </button>
                {canManageAdmin && (
                  <button
                    onClick={() => handleTabChangeMobile("developments")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === "developments" ? "bg-violet-50 text-[#6366f1]" : "text-slate-500 hover:bg-slate-55"
                    }`}
                  >
                    <Hammer className="w-4.5 h-4.5" /> The Forge
                  </button>
                )}
                {canManageAnnouncements && (
                  <button
                    onClick={() => handleTabChangeMobile("announcements")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === "announcements" ? "bg-violet-50 text-[#6366f1]" : "text-slate-500 hover:bg-slate-55"
                    }`}
                  >
                    <Megaphone className="w-4.5 h-4.5" /> Town Crier
                  </button>
                )}
                {canManageTickets && (
                  <button
                    onClick={() => handleTabChangeMobile("tickets")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === "tickets" ? "bg-violet-50 text-[#6366f1]" : "text-slate-500 hover:bg-slate-55"
                    }`}
                  >
                    <Ticket className="w-4.5 h-4.5" /> Tickets
                  </button>
                )}
                {canManagePayments && (
                  <button
                    onClick={() => handleTabChangeMobile("payments")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === "payments" ? "bg-violet-50 text-[#6366f1]" : "text-slate-500 hover:bg-slate-55"
                    }`}
                  >
                    <Wallet className="w-4.5 h-4.5" /> Payments
                  </button>
                )}
                {canManageAdmin && (
                  <button
                    onClick={() => handleTabChangeMobile("forms")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === "forms" ? "bg-violet-50 text-[#6366f1]" : "text-slate-500 hover:bg-slate-55"
                    }`}
                  >
                    <ClipboardList className="w-4.5 h-4.5" /> Voting & Forms
                  </button>
                )}

                <div className="border-t border-[#eae8f5] my-2 pt-2" />
                <span className="px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Social & Portal</span>
                <Link
                  href="/member"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all"
                >
                  <User className="w-4.5 h-4.5" /> Member Area
                </Link>
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
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all"
                >
                  <Users className="w-4.5 h-4.5" /> Guilds
                </Link>

                {canManageAdmin && (
                  <>
                    <div className="border-t border-[#eae8f5] my-2 pt-2" />
                    <button
                      onClick={() => handleTabChangeMobile("users")}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        activeTab === "users" ? "bg-violet-50 text-[#6366f1]" : "text-slate-500 hover:bg-slate-55"
                      }`}
                    >
                      <Users className="w-4.5 h-4.5" /> Scribes
                    </button>
                    <button
                      onClick={() => handleTabChangeMobile("credits")}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        activeTab === "credits" ? "bg-violet-50 text-[#6366f1]" : "text-slate-500 hover:bg-slate-55"
                      }`}
                    >
                      <ShieldAlert className="w-4.5 h-4.5" /> Credits
                    </button>
                    <button
                      onClick={() => handleTabChangeMobile("gacha")}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        activeTab === "gacha" ? "bg-violet-50 text-[#6366f1]" : "text-slate-500 hover:bg-slate-55"
                      }`}
                    >
                      <Coins className="w-4.5 h-4.5" /> Gacha & Wallet
                    </button>
                    <button
                      onClick={() => handleTabChangeMobile("groups")}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        activeTab === "groups" ? "bg-violet-50 text-[#6366f1]" : "text-slate-500 hover:bg-slate-55"
                      }`}
                    >
                      <Users className="w-4.5 h-4.5" /> Groups
                    </button>
                    <button
                      onClick={() => handleTabChangeMobile("settings")}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        activeTab === "settings" ? "bg-violet-50 text-[#6366f1]" : "text-slate-500 hover:bg-slate-55"
                      }`}
                    >
                      <Settings className="w-4.5 h-4.5" /> Settings
                    </button>
                  </>
                )}
              </nav>
            </div>

            <div className="p-2 border-t border-[#eae8f5]">
              <Button
                variant="ghost"
                onClick={() => signOut({ redirectUrl: "/" })}
                className="w-full justify-start gap-3 text-slate-500 hover:text-[#ef4444]"
              >
                <LogOut className="w-4.5 h-4.5 text-[#ef4444]" /> Log out
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Content Area ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar navigation */}
        <header className="h-16 bg-white border-b border-[#eae8f5] px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm shadow-slate-100/40">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setMobileSidebarOpen(true)} className="md:hidden text-slate-500">
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 capitalize">
              <span>Pages</span> <span className="text-slate-300">/</span> <span className="text-[#6366f1] font-extrabold">{activeTab.replace('_', ' ')}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Search Box */}
            <div className="relative max-w-xs hidden sm:block">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search resources, users..."
                className="pl-9 bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 w-60 focus-visible:ring-1 focus-visible:ring-[#6366f1]"
              />
            </div>

            {/* Server Online/Status Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl text-[10px] text-emerald-600 font-bold shrink-0 shadow-sm shadow-emerald-500/5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Server Online
            </div>
          </div>
        </header>

        {/* Panel Main View Area */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-6xl w-full mx-auto space-y-6">
          
          {/* TAB: DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="space-y-6 animate-fade-in">
              {/* Premium Feature Banner */}
              <div className="relative rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-6 md:p-8 text-white shadow-xl shadow-indigo-600/10 overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 border border-violet-500/20">
                <div className="absolute right-[-10%] top-[-20%] w-[35%] h-[150%] bg-white/5 skew-x-12 blur-sm pointer-events-none" />
                <div className="space-y-2 max-w-xl">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-[10px] font-bold tracking-wide uppercase">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Premium Console Mode
                  </div>
                  <h3 className="text-xl md:text-2xl font-black leading-tight tracking-tight">Unlock Forge Architect Tools</h3>
                  <p className="text-xs text-violet-100/90 leading-relaxed font-medium">
                    Monitor live server developments, audit town crier notifications, resolve member support tickets, and calibrate database settings in real-time.
                  </p>
                </div>
                <Button onClick={() => handleTabChange("settings")} className="bg-white text-[#6366f1] hover:bg-violet-55 font-black px-6 py-2.5 rounded-xl shrink-0 transition-all shadow-md active:scale-95 text-xs border border-violet-100/15">
                  Realm Settings
                </Button>
              </div>

              {/* Metrics Overview Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-white border-[#eae8f5] shadow-sm shadow-[#5a567a]/5 rounded-2xl p-5 relative overflow-hidden">
                  <div className="absolute right-[-10%] top-[-10%] opacity-[0.03] text-indigo-950 font-black text-7xl select-none">M</div>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Active Citizens</span>
                      <h4 className="text-2xl font-black text-[#110e3d]">{activeCitizens}</h4>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-[#6366f1] font-bold">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-[10px] text-emerald-600 font-bold mt-3 flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5" /> +12% from last week
                  </div>
                </Card>

                <Card className="bg-white border-[#eae8f5] shadow-sm shadow-[#5a567a]/5 rounded-2xl p-5 relative overflow-hidden">
                  <div className="absolute right-[-10%] top-[-10%] opacity-[0.03] text-indigo-950 font-black text-7xl select-none">P</div>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Active Projects</span>
                      <h4 className="text-2xl font-black text-[#110e3d]">{activeProjects}</h4>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-[#d97706] font-bold">
                      <Hammer className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-[10px] text-emerald-600 font-bold mt-3 flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5" /> +2 new items added
                  </div>
                </Card>

                <Card className="bg-white border-[#eae8f5] shadow-sm shadow-[#5a567a]/5 rounded-2xl p-5 relative overflow-hidden">
                  <div className="absolute right-[-10%] top-[-10%] opacity-[0.03] text-indigo-950 font-black text-7xl select-none">T</div>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Open Tickets</span>
                      <h4 className="text-2xl font-black text-[#110e3d]">{openTicketsCount}</h4>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-[#dc2626] font-bold">
                      <Ticket className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-[10px] text-red-600 font-bold mt-3 flex items-center gap-1">
                    <ArrowDownRight className="w-3.5 h-3.5" /> -4 resolved today
                  </div>
                </Card>

                <Card className="bg-white border-[#eae8f5] shadow-sm shadow-[#5a567a]/5 rounded-2xl p-5 relative overflow-hidden">
                  <div className="absolute right-[-10%] top-[-10%] opacity-[0.03] text-indigo-950 font-black text-7xl select-none">A</div>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Lore Releases</span>
                      <h4 className="text-2xl font-black text-[#110e3d]">{totalAnnouncements}</h4>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-[#059669] font-bold">
                      <Megaphone className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-[10px] text-emerald-600 font-bold mt-3 flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5" /> +1 release active
                  </div>
                </Card>
              </div>

              {/* Recharts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Developments Bar Chart */}
                <Card className="bg-white border-[#eae8f5] shadow-sm shadow-[#5a567a]/5 rounded-2xl p-6">
                  <div className="mb-4">
                    <h5 className="font-extrabold text-sm text-[#110e3d]">The Forge Statistics</h5>
                    <p className="text-[10px] text-slate-400 font-bold">Development projects count by active status state.</p>
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={statusChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: '1px solid #eae8f5', fontSize: '11px' }} />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#6366f1" barSize={35}>
                        {statusChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                {/* Tickets Curve Line Chart */}
                <Card className="bg-white border-[#eae8f5] shadow-sm shadow-[#5a567a]/5 rounded-2xl p-6">
                  <div className="mb-4">
                    <h5 className="font-extrabold text-sm text-[#110e3d]">Support Tickets Trend</h5>
                    <p className="text-[10px] text-slate-400 font-bold">Total support volume curve plotted over timeline.</p>
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={lineChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #eae8f5', fontSize: '11px' }} />
                      <Line type="monotone" dataKey="tickets" stroke="#6366f1" strokeWidth={3} activeDot={{ r: 6 }} dot={{ stroke: '#6366f1', strokeWidth: 2, r: 3, fill: '#fff' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </div>

              {/* Latest announcements log summary */}
              <Card className="bg-white border-[#eae8f5] shadow-sm shadow-[#5a567a]/5 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-[#eae8f5] flex items-center justify-between">
                  <div>
                    <h5 className="font-extrabold text-sm text-[#110e3d]">Recent Lore Releases</h5>
                    <p className="text-[10px] text-slate-400 font-bold">Latest crier releases and town announcements.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleTabChange("announcements")} className="border-[#eae8f5] text-[#6366f1] hover:bg-slate-55 text-xs font-bold rounded-xl h-8">View all</Button>
                </div>
                <div className="divide-y divide-[#eae8f5] bg-white">
                  {anns?.slice(0, 3).map((ann) => (
                    <div key={ann.id} className="p-4 hover:bg-slate-50/50 transition-colors flex justify-between items-center gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-[#110e3d] truncate">{ann.title}</span>
                          <span className="text-[9px] font-black uppercase bg-[#6366f1]/10 text-[#6366f1] px-2 py-0.5 rounded-full shrink-0">{ann.type}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate mt-1">{ann.content}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold shrink-0">{format(new Date(ann.createdAt), 'dd MMM yyyy')}</span>
                    </div>
                  ))}
                  {(!anns || anns.length === 0) && (
                    <div className="p-6 text-center text-xs text-slate-400">No announcements posted yet.</div>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* TAB: DEVELOPMENTS */}
          {activeTab === "developments" && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-[#110e3d]">Server Projects</h2>
                  <p className="text-xs text-slate-400 font-bold mt-1">Manage active implementations in the Forge.</p>
                </div>
                <Button onClick={openNewDev} className="bg-[#6366f1] text-white hover:bg-violet-600 rounded-xl font-bold text-xs shadow-md shadow-violet-500/10 px-5 py-2.5 h-10">+ New Project</Button>
              </div>
              
              {devsLoading ? <Skeleton className="h-48 w-full rounded-2xl" /> : devs?.length === 0 ? (
                <div className="text-center py-16 text-slate-400 bg-white border border-[#eae8f5] rounded-2xl">No projects in the Forge yet.</div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {devs?.map((dev) => (
                    <Card key={dev.id} className="bg-white border-[#eae8f5] shadow-sm shadow-[#5a567a]/3 rounded-2xl hover:border-violet-300 transition-all p-5 space-y-4 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <span className="text-sm font-bold text-[#110e3d] line-clamp-1">{dev.title}</span>
                          <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full shrink-0 ${
                            dev.status === "completed" 
                              ? "bg-emerald-100 text-emerald-700"
                              : dev.status === "in_progress"
                              ? "bg-amber-100 text-amber-700"
                              : dev.status === "paused"
                              ? "bg-slate-100 text-slate-500"
                              : "bg-blue-100 text-blue-700"
                          }`}>{STATUS_LABELS[dev.status as DevStatus]}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-extrabold leading-none">{dev.category}</p>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed font-medium">{dev.description}</p>
                        
                        {dev.progress != null && (
                          <div className="space-y-1.5 pt-2">
                            <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                              <span>Progress</span>
                              <span>{dev.progress}%</span>
                            </div>
                            <Progress value={dev.progress} className="h-1.5 bg-slate-100" />
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-slate-50">
                        <Button size="sm" variant="outline" className="flex-1 border-[#eae8f5] text-slate-600 hover:bg-slate-55 text-xs font-bold rounded-xl h-8" onClick={() => openEditDev(dev)}>Edit</Button>
                        <Button size="sm" variant="outline" className="border-red-100 text-red-500 hover:bg-red-55 hover:border-red-200 text-xs font-bold rounded-xl h-8" onClick={() => setDeletingDevId(dev.id)}>Delete</Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: ANNOUNCEMENTS */}
          {activeTab === "announcements" && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-[#110e3d]">Announcements</h2>
                  <p className="text-xs text-slate-400 font-bold mt-1">Post and broadcast realm lore.</p>
                </div>
                <Button onClick={openNewAnn} className="bg-[#6366f1] text-white hover:bg-violet-600 rounded-xl font-bold text-xs shadow-md shadow-violet-500/10 px-5 py-2.5 h-10">+ New Announcement</Button>
              </div>

              {annsLoading ? <Skeleton className="h-32 w-full rounded-2xl" /> : anns?.length === 0 ? (
                <div className="text-center py-16 text-slate-400 bg-white border border-[#eae8f5] rounded-2xl">No announcements posted yet.</div>
              ) : (
                <div className="space-y-3">
                  {anns?.map((ann) => (
                    <Card key={ann.id} className="bg-white border-[#eae8f5] shadow-sm shadow-[#5a567a]/3 rounded-2xl hover:border-violet-300 transition-all p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-extrabold text-sm text-[#110e3d] truncate">{ann.title}</span>
                          {ann.pinned && <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full shadow-sm">📌 Pinned</span>}
                          <span className="text-[9px] font-black bg-[#6366f1]/10 text-[#6366f1] px-2.5 py-0.5 rounded-full uppercase tracking-wider">{ann.type}</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 font-medium">{ann.content}</p>
                        <p className="text-[9px] text-slate-400 font-bold">By {ann.authorName} • {format(new Date(ann.createdAt), 'dd MMM yyyy, HH:mm')}</p>
                      </div>
                      <div className="flex gap-2 shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-0 border-slate-50">
                        <Button size="sm" variant="outline" className="flex-1 sm:flex-initial border-[#eae8f5] text-slate-600 hover:bg-slate-55 text-xs font-bold rounded-xl h-8 px-4" onClick={() => openEditAnn(ann)}>Edit</Button>
                        <Button size="sm" variant="outline" className="flex-1 sm:flex-initial border-red-100 text-red-500 hover:bg-red-55 hover:border-red-200 text-xs font-bold rounded-xl h-8 px-4" onClick={() => setDeletingAnnId(ann.id)}>Delete</Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: TICKETS */}
          {activeTab === "tickets" && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-extrabold text-[#110e3d]">Support Tickets</h2>
                  <p className="text-xs text-slate-400 font-bold mt-1">Audit and update player tickets.</p>
                </div>
                <span className="text-xs bg-slate-200 text-slate-600 font-bold px-3 py-1 rounded-xl shrink-0">{tickets.length} tickets total</span>
              </div>

              {ticketsLoading ? <Skeleton className="h-48 w-full rounded-2xl" /> : tickets.length === 0 ? (
                <div className="text-center py-16 text-slate-400 bg-white border border-[#eae8f5] rounded-2xl">No support tickets found in database.</div>
              ) : (
                <div className="space-y-3">
                  {tickets.map((ticket) => (
                    <Card key={ticket.id} className="bg-white border-[#eae8f5] shadow-sm shadow-[#5a567a]/3 rounded-2xl p-5 flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-extrabold text-sm text-[#110e3d]">#{ticket.id} - {ticket.reason}</span>
                          <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                            ticket.status === "open"
                              ? "bg-red-100 text-red-700"
                              : ticket.status === "in_progress"
                              ? "bg-blue-100 text-blue-700"
                              : ticket.status === "resolved"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}>{ticket.status.replace("_", " ")}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold">
                          By <strong className="text-slate-600 font-extrabold">{ticket.creatorDisplayName || ticket.creatorUsername}</strong> • Created {format(new Date(ticket.createdAt), 'dd MMM yyyy, HH:mm')}
                        </p>
                        <p className="text-xs text-slate-500 whitespace-pre-wrap leading-relaxed font-medium">{ticket.description}</p>
                        {ticket.adminDisplayName || ticket.adminUsername ? (
                          <div className="flex items-center gap-1.5 text-[9px] bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 w-max text-slate-500 font-bold">
                            <span className="w-1.5 h-1.5 bg-[#6366f1] rounded-full" /> Assigned Handler: {ticket.adminDisplayName || ticket.adminUsername}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[9px] bg-amber-50 border border-amber-100 rounded-lg px-2 py-1 w-max text-amber-600 font-bold animate-pulse">
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" /> Awaiting moderator response...
                          </div>
                        )}
                        <div className="pt-2 flex items-center gap-2">
                          <Button
                            size="sm"
                            className="h-8 rounded-xl bg-slate-50 hover:bg-slate-100 border border-[#eae8f5] text-[#110e3d] text-[10px] font-extrabold px-3.5 transition-all shadow-sm"
                            onClick={() => setSelectedTicketChat(ticket)}
                          >
                            💬 Detail & Reply
                          </Button>
                        </div>
                      </div>
                      
                      <div className="shrink-0 w-full md:w-44 pt-2 md:pt-0 border-t md:border-0 border-slate-50 flex flex-col gap-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Update Status</span>
                        <Select value={ticket.status} onValueChange={(value) => handleUpdateTicketStatus(ticket.id, value as TicketStatus)}>
                          <SelectTrigger className="w-full bg-[#f8f7fa] border-[#eae8f5] rounded-xl text-xs h-9 text-[#1e1b4b] font-bold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white border border-[#eae8f5] text-slate-700">
                            <SelectItem value="open" className="text-red-500">Open</SelectItem>
                            <SelectItem value="in_progress" className="text-blue-500">In Progress</SelectItem>
                            <SelectItem value="resolved" className="text-emerald-500">Resolved</SelectItem>
                            <SelectItem value="closed" className="text-slate-500">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {canManageAdmin && (
                <Card className="bg-white border-[#eae8f5] shadow-sm shadow-[#5a567a]/5 rounded-2xl overflow-hidden">
                  <div className="p-6 border-b border-[#eae8f5] flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <h4 className="font-extrabold text-sm text-[#110e3d]">Ticket Settings Options</h4>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">Configure options shown to players when registering a new support ticket.</p>
                    </div>
                    <Button onClick={openNewTicketReason} className="bg-[#6366f1] text-white hover:bg-violet-600 rounded-xl font-bold text-xs h-9 shadow-md shadow-violet-500/5 px-4">
                      + Add Reason
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-[#f8f7fa]">
                        <TableRow className="border-[#eae8f5]">
                          <TableHead className="text-xs font-black text-[#110e3d]">Reason</TableHead>
                          <TableHead className="text-xs font-black text-[#110e3d]">Description</TableHead>
                          <TableHead className="w-24 text-xs font-black text-[#110e3d]">Order</TableHead>
                          <TableHead className="w-24 text-xs font-black text-[#110e3d]">Status</TableHead>
                          <TableHead className="text-right w-40 text-xs font-black text-[#110e3d]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ticketReasons.map((reason) => (
                          <TableRow key={reason.id} className="border-[#eae8f5] hover:bg-slate-50/50">
                            <TableCell className="font-bold text-xs text-[#110e3d]">{reason.label}</TableCell>
                            <TableCell className="text-xs text-slate-500 font-medium">{reason.description || "-"}</TableCell>
                            <TableCell className="text-xs text-slate-500 font-bold">{reason.order}</TableCell>
                            <TableCell>
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${reason.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                                {reason.isActive ? "Active" : "Hidden"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1.5">
                                <Button size="sm" variant="outline" className="border-[#eae8f5] text-slate-600 hover:bg-slate-55 text-[10px] font-bold rounded-xl h-7 px-3.5" onClick={() => openEditTicketReason(reason)}>Edit</Button>
                                <Button size="sm" variant="outline" className="border-red-100 text-red-500 hover:bg-red-55 hover:border-red-200 text-[10px] font-bold rounded-xl h-7 px-3.5" onClick={() => setDeletingTicketReasonId(reason.id)}>Delete</Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              )}
            </div>
          )}

          {activeTab === "payments" && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-extrabold text-[#110e3d]">Payments</h2>
                  <p className="text-xs text-slate-400 font-bold mt-1">Verifikasi pembayaran, grant premium, dan tempel boost ke group.</p>
                </div>
                <span className="text-xs bg-slate-200 text-slate-600 font-bold px-3 py-1 rounded-xl shrink-0">{paymentTickets.length} payment tickets</span>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <Card className="bg-white border-[#eae8f5] shadow-sm shadow-[#5a567a]/5 rounded-2xl overflow-hidden">
                  <div className="p-6 border-b border-[#eae8f5]">
                    <h4 className="font-extrabold text-sm text-[#110e3d]">Payment Queue</h4>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">Ticket pembayaran dari member akan muncul di sini.</p>
                  </div>
                  <div className="p-5 space-y-3">
                    {paymentTicketsLoading ? <Skeleton className="h-48 w-full rounded-2xl" /> : paymentTickets.length === 0 ? (
                      <div className="text-center py-16 text-slate-400 bg-slate-50 border border-[#eae8f5] rounded-2xl">Belum ada payment ticket.</div>
                    ) : (
                      paymentTickets.map((ticket: any) => (
                        <div key={ticket.id} className="rounded-2xl border border-[#eae8f5] p-5 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h5 className="text-sm font-extrabold text-[#110e3d]">#{ticket.id} - {ticket.creatorDisplayName || ticket.creatorUsername}</h5>
                              <p className="text-[10px] text-slate-400 font-bold mt-1">
                                {ticket.requestedTier ? `Tier ${ticket.requestedTier}` : ticket.requestedPackageSku}
                                {ticket.requestedConversationName ? ` • Group ${ticket.requestedConversationName}` : ""}
                              </p>
                            </div>
                            <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                              ticket.paymentStatus === "paid" ? "bg-emerald-100 text-emerald-700" :
                              ticket.paymentStatus === "rejected" ? "bg-red-100 text-red-700" :
                              "bg-amber-100 text-amber-700"
                            }`}>
                              {ticket.paymentStatus ?? "pending_review"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 whitespace-pre-wrap leading-relaxed font-medium">{ticket.description}</p>
                          {ticket.adminNotes && (
                            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600">
                              Admin note: {ticket.adminNotes}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              disabled={paymentActionMutation.isPending || !!ticket.grantedAt}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-xl h-8 px-3.5"
                              onClick={() => handlePaymentDecision(ticket, "paid")}
                            >
                              {ticket.grantedAt ? "Already Granted" : "Approve & Grant"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={paymentActionMutation.isPending}
                              className="border-red-100 text-red-500 hover:bg-red-50 text-[10px] font-bold rounded-xl h-8 px-3.5"
                              onClick={() => handlePaymentDecision(ticket, "rejected")}
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>

                <Card className="bg-white border-[#eae8f5] shadow-sm shadow-[#5a567a]/5 rounded-2xl overflow-hidden">
                  <div className="p-6 border-b border-[#eae8f5]">
                    <h4 className="font-extrabold text-sm text-[#110e3d]">Manual Premium / Boost Grant</h4>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">Admin bisa kasih premium atau boost langsung tanpa nunggu ticket.</p>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target User ID</Label>
                      <Input value={manualGrantForm.userId} onChange={(e) => setManualGrantForm({ ...manualGrantForm, userId: e.target.value })} placeholder="Contoh: 12" className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Grant Tier</Label>
                        <Select value={manualGrantForm.grantTier || "none"} onValueChange={(v) => setManualGrantForm({ ...manualGrantForm, grantTier: v === "none" ? "" : v })}>
                          <SelectTrigger className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-[#1e1b4b] font-bold"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-white border border-[#eae8f5] text-slate-700">
                            <SelectItem value="none">No Tier</SelectItem>
                            <SelectItem value="premium">Premium</SelectItem>
                            <SelectItem value="premium_plus">Premium+</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Boost Package</Label>
                        <Select value={manualGrantForm.grantPackageSku || "none"} onValueChange={(v) => setManualGrantForm({ ...manualGrantForm, grantPackageSku: v === "none" ? "" : v })}>
                          <SelectTrigger className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-[#1e1b4b] font-bold"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-white border border-[#eae8f5] text-slate-700">
                            <SelectItem value="none">No Boost</SelectItem>
                            {(paymentMembershipData?.packages ?? []).map((pkg: any) => (
                              <SelectItem key={pkg.sku} value={pkg.sku}>{pkg.displayName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Group ID</Label>
                        <Input value={manualGrantForm.targetConversationId} onChange={(e) => setManualGrantForm({ ...manualGrantForm, targetConversationId: e.target.value })} placeholder="Opsional, misal 55" className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Apply Boost Count</Label>
                        <Input value={manualGrantForm.applyBoostCount} onChange={(e) => setManualGrantForm({ ...manualGrantForm, applyBoostCount: e.target.value })} type="number" placeholder="0" className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800" />
                      </div>
                    </div>
                    <Button
                      onClick={handleManualGrant}
                      disabled={manualGrantMutation.isPending}
                      className="bg-[#6366f1] text-white hover:bg-violet-600 rounded-xl font-bold text-xs h-10 px-4 shadow-md shadow-violet-500/5"
                    >
                      {manualGrantMutation.isPending ? "Granting..." : "Grant Manual"}
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* TAB: USERS (SCRIBES) */}
          {activeTab === "users" && (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h2 className="text-xl font-extrabold text-[#110e3d]">Server Members (Scribes)</h2>
                    <p className="text-xs text-slate-400 font-bold mt-1">Audit, register, and update roles of server players.</p>
                  </div>
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <Input value={userDirSearch} onChange={(e) => setUserDirSearch(e.target.value)} placeholder="Search name, handle, ID…" className="pl-9 bg-white border-[#eae8f5] rounded-xl text-xs h-9 focus-visible:ring-1 focus-visible:ring-[#6366f1]" />
                  </div>
                </div>

                {usersLoading ? <Skeleton className="h-48 w-full rounded-2xl" /> : (
                  <Card className="bg-white border-[#eae8f5] shadow-sm shadow-[#5a567a]/5 rounded-2xl overflow-hidden">
                    <Table>
                      <TableHeader className="bg-[#f8f7fa]">
                        <TableRow className="border-[#eae8f5]">
                          <TableHead className="text-xs font-black text-[#110e3d]">User Profile</TableHead>
                          <TableHead className="text-xs font-black text-[#110e3d]">Minecraft Tag / Handle</TableHead>
                          <TableHead className="w-24 text-xs font-black text-[#110e3d]">UID</TableHead>
                          <TableHead className="text-xs font-black text-[#110e3d]">Role Type</TableHead>
                          <TableHead className="text-right text-xs font-black text-[#110e3d]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users?.filter(u => {
                          const q = userDirSearch.toLowerCase();
                          return !q || u.username.toLowerCase().includes(q) || u.userTag.toLowerCase().includes(q) || (u.displayName && u.displayName.toLowerCase().includes(q)) || String(u.id).includes(q);
                        }).map((u) => (
                          <TableRow key={u.id} className="border-[#eae8f5] hover:bg-slate-50/50">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center font-black text-[#6366f1] text-xs shrink-0 overflow-hidden border border-[#eae8f5]">
                                  {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="w-full h-full object-cover animate-fade-in" /> : (u.displayName || u.username).charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-extrabold text-xs text-[#110e3d] truncate flex items-center gap-1">
                                    {u.displayName || u.username}
                                    {(u as any).isVerified && (
                                      <BadgeCheck className="w-3 h-3 text-blue-500 fill-blue-100 shrink-0" />
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-bold truncate">@{u.username}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold text-xs text-slate-600">
                              <span className="text-[#6366f1] font-bold">{u.userTag}</span>
                            </TableCell>
                            <TableCell className="text-xs text-slate-400 font-bold">#{u.id}</TableCell>
                            <TableCell>
                              <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                                u.role === "admin" || u.role === "dev_website"
                                  ? "bg-violet-100 text-[#6366f1]"
                                  : u.role === "staff"
                                  ? "bg-sky-100 text-sky-700"
                                  : u.role === "dev"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}>
                                {ROLE_LABELS[u.role as UserRole] || u.role}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-3">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-[#eae8f5] text-slate-600 hover:bg-slate-55 text-[10px] font-bold rounded-xl h-8 px-3.5"
                                  onClick={() => openEditUser(u)}
                                  disabled={u.role === "dev_website" && !canManageDevWebsiteRole}
                                >
                                  Edit User
                                </Button>
                                <Select value={u.role} onValueChange={async (role) => {
                                  try { await updateRole.mutateAsync({ id: u.id, data: { role: role as UserRole } }); toast({ title: "Role updated" }); invalidate("/api/users"); }
                                  catch { toast({ title: "Error", description: "Failed to update role.", variant: "destructive" }); }
                                }} disabled={u.role === "dev_website" && !canManageDevWebsiteRole}>
                                  <SelectTrigger className="w-32 h-8 text-[11px] bg-slate-50 border-[#eae8f5] rounded-xl text-[#1e1b4b] font-bold"><SelectValue /></SelectTrigger>
                                  <SelectContent className="bg-white border border-[#eae8f5] text-slate-700">
                                    <SelectItem value="member">Member</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="staff">Staff</SelectItem>
                                    <SelectItem value="dev">Dev</SelectItem>
                                    {canManageDevWebsiteRole && <SelectItem value="dev_website">Dev Website</SelectItem>}
                                  </SelectContent>
                                </Select>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                )}
              </div>

              {/* Bot Controller */}
              <div className="grid md:grid-cols-2 gap-6 pt-4">
                {/* Single bot follow */}
                <Card className="bg-white border-[#eae8f5] shadow-sm shadow-[#5a567a]/5 rounded-2xl p-6 space-y-4">
                  <div>
                    <h4 className="font-extrabold text-sm text-[#110e3d]">🤖 Single Bot Follower</h4>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">Force an account to follow another member.</p>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1.5 relative">
                      <Label className="text-xs font-bold text-slate-600">Follower Account</Label>
                      <div className="relative">
                        <Input value={showSingleFollower ? singleSearch : (users?.find(u => String(u.id) === botFollowerId)?.displayName || users?.find(u => String(u.id) === botFollowerId)?.username || "")} onFocus={() => { setShowSingleFollower(true); setSingleSearch(""); }} readOnly={!showSingleFollower} onChange={(e) => { setSingleSearch(e.target.value); setShowSingleFollower(true); }} placeholder={botFollowerId ? "Click to change…" : "Type to search…"} className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800" />
                        {showSingleFollower && (
                          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-[#eae8f5] rounded-xl shadow-xl overflow-hidden">
                            <ScrollArea className="h-44">
                              <div className="p-1">
                                {(users?.filter(u => { const q = singleSearch.toLowerCase(); return !q || u.username.toLowerCase().includes(q) || u.userTag.toLowerCase().includes(q) || (u.displayName && u.displayName.toLowerCase().includes(q)) || String(u.id).includes(q); }) || []).length === 0 ? (
                                  <div className="px-3 py-2 text-xs text-slate-400">No members found</div>
                                ) : (
                                  users?.filter(u => { const q = singleSearch.toLowerCase(); return !q || u.username.toLowerCase().includes(q) || u.userTag.toLowerCase().includes(q) || (u.displayName && u.displayName.toLowerCase().includes(q)) || String(u.id).includes(q); }).map(u => (
                                    <button key={u.id} onClick={() => { setBotFollowerId(String(u.id)); setShowSingleFollower(false); setSingleSearch(""); }} className="w-full text-left px-3 py-2 text-xs hover:bg-[#f8f7fa] rounded-lg flex items-center gap-2 font-bold text-slate-600">
                                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[#6366f1] text-[10px] shrink-0 border border-[#eae8f5]">{(u.displayName || u.username).charAt(0).toUpperCase()}</div>
                                      <div className="truncate">{u.displayName || u.username} <span className="text-[#6366f1]">{u.userTag}</span></div>
                                    </button>
                                  ))
                                )}
                              </div>
                            </ScrollArea>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 relative">
                      <Label className="text-xs font-bold text-slate-600">Target (gets followed)</Label>
                      <div className="relative">
                        <Input value={showSingleTarget ? (users?.find(u => String(u.id) === botFollowingId)?.displayName || users?.find(u => String(u.id) === botFollowingId)?.username || "") : singleSearch} onFocus={() => { setShowSingleTarget(true); setSingleSearch(""); }} readOnly={!showSingleTarget} onChange={(e) => { setSingleSearch(e.target.value); setShowSingleTarget(true); }} placeholder={botFollowingId ? "Click to change…" : "Type to search…"} className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800" />
                        {showSingleTarget && (
                          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-[#eae8f5] rounded-xl shadow-xl overflow-hidden">
                            <ScrollArea className="h-44">
                              <div className="p-1">
                                {(users?.filter(u => { const q = singleSearch.toLowerCase(); return !q || u.username.toLowerCase().includes(q) || u.userTag.toLowerCase().includes(q) || (u.displayName && u.displayName.toLowerCase().includes(q)) || String(u.id).includes(q); }) || []).length === 0 ? (
                                  <div className="px-3 py-2 text-xs text-slate-400">No members found</div>
                                ) : (
                                  users?.filter(u => { const q = singleSearch.toLowerCase(); return !q || u.username.toLowerCase().includes(q) || u.userTag.toLowerCase().includes(q) || (u.displayName && u.displayName.toLowerCase().includes(q)) || String(u.id).includes(q); }).map(u => (
                                    <button key={u.id} onClick={() => { setBotFollowingId(String(u.id)); setShowSingleTarget(false); setSingleSearch(""); }} className="w-full text-left px-3 py-2 text-xs hover:bg-[#f8f7fa] rounded-lg flex items-center gap-2 font-bold text-slate-600">
                                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[#6366f1] text-[10px] shrink-0 border border-[#eae8f5]">{(u.displayName || u.username).charAt(0).toUpperCase()}</div>
                                      <div className="truncate">{u.displayName || u.username} <span className="text-[#6366f1]">{u.userTag}</span></div>
                                    </button>
                                  ))
                                )}
                              </div>
                            </ScrollArea>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button onClick={handleSingleFollow} disabled={!botFollowerId || !botFollowingId} className="w-full bg-[#6366f1] text-white hover:bg-violet-600 rounded-xl font-bold text-xs shadow-md shadow-violet-500/5 h-10 mt-2">Create Follow</Button>
                </Card>

                {/* Bulk bot follow */}
                <Card className="bg-white border-[#eae8f5] shadow-sm shadow-[#5a567a]/5 rounded-2xl p-6 space-y-4">
                  <div>
                    <h4 className="font-extrabold text-sm text-[#110e3d]">⚡ Bulk Bot Followers</h4>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">Generate N bot accounts that all follow a target member.</p>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1.5 relative">
                      <Label className="text-xs font-bold text-slate-600">Target User (receives followers)</Label>
                      <div className="relative">
                        <Input value={showBulkTarget ? bulkSearch : (users?.find(u => String(u.id) === bulkTargetId)?.displayName || users?.find(u => String(u.id) === bulkTargetId)?.username || "")} onFocus={() => { setShowBulkTarget(true); setBulkSearch(""); }} readOnly={!showBulkTarget} onChange={(e) => { setBulkSearch(e.target.value); setShowBulkTarget(true); }} placeholder={bulkTargetId ? "Click to change…" : "Type to search…"} className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800" />
                        {showBulkTarget && (
                          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-[#eae8f5] rounded-xl shadow-xl overflow-hidden">
                            <ScrollArea className="h-44">
                              <div className="p-1">
                                {(users?.filter(u => { const q = bulkSearch.toLowerCase(); return !q || u.username.toLowerCase().includes(q) || u.userTag.toLowerCase().includes(q) || (u.displayName && u.displayName.toLowerCase().includes(q)) || String(u.id).includes(q); }) || []).length === 0 ? (
                                  <div className="px-3 py-2 text-xs text-slate-400">No members found</div>
                                ) : (
                                  users?.filter(u => { const q = bulkSearch.toLowerCase(); return !q || u.username.toLowerCase().includes(q) || u.userTag.toLowerCase().includes(q) || (u.displayName && u.displayName.toLowerCase().includes(q)) || String(u.id).includes(q); }).map(u => (
                                    <button key={u.id} onClick={() => { setBulkTargetId(String(u.id)); setShowBulkTarget(false); setBulkSearch(""); }} className="w-full text-left px-3 py-2 text-xs hover:bg-[#f8f7fa] rounded-lg flex items-center gap-2 font-bold text-slate-600">
                                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[#6366f1] text-[10px] shrink-0 border border-[#eae8f5]">{(u.displayName || u.username).charAt(0).toUpperCase()}</div>
                                      <div className="truncate">{u.displayName || u.username} <span className="text-[#6366f1]">{u.userTag}</span></div>
                                    </button>
                                  ))
                                )}
                              </div>
                            </ScrollArea>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-600">Number of Followers (Max 10k)</Label>
                      <Input type="number" min={1} max={10000} value={bulkCount} onChange={(e) => setBulkCount(e.target.value)} placeholder="e.g. 500" className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800" />
                    </div>
                  </div>
                  <Button onClick={handleBulkFollow} disabled={bulkLoading || !bulkTargetId} className="w-full bg-[#6366f1] text-white hover:bg-violet-600 rounded-xl font-bold text-xs shadow-md shadow-violet-500/5 h-10 mt-2">
                    {bulkLoading ? "Generating accounts... (Please wait)" : `Generate ${bulkCount || "N"} Followers`}
                  </Button>
                </Card>
              </div>
            </div>
          )}

          {/* TAB: VOTING & FORMS */}
          {activeTab === "forms" && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-[#110e3d]">Voting & Forms</h2>
                  <p className="text-xs text-slate-400 font-bold mt-1">Manage, open, close, and view results of realm polls and surveys.</p>
                </div>
                <Button 
                  onClick={() => {
                    setFormTitle("");
                    setFormDescription("");
                    setFormType("poll");
                    setFormDeadline("");
                    setPollOptions([{ label: "" }, { label: "" }]);
                    setFormFields([{ label: "", fieldType: "text", options: "", required: false }]);
                    setEditingFormId(null);
                    setFormsDialogOpen(true);
                  }}
                  className="bg-[#6366f1] text-white hover:bg-violet-600 rounded-xl font-bold text-xs shadow-md shadow-violet-500/10 px-5 py-2.5 h-10"
                >
                  + New Poll/Form
                </Button>
              </div>

              {formsLoading ? (
                <Skeleton className="h-32 w-full rounded-2xl" />
              ) : forms?.length === 0 ? (
                <div className="text-center py-16 text-slate-400 bg-white border border-[#eae8f5] rounded-2xl">
                  No forms or polls created yet. Click "+ New Poll/Form" to start.
                </div>
              ) : (
                <div className="grid gap-6">
                  {forms?.map((f: any) => (
                    <Card key={f.id} className="bg-white border-[#eae8f5] shadow-sm rounded-2xl">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start gap-4 flex-wrap">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[9px] px-2 py-0.5 rounded-lg font-black uppercase tracking-wider border ${f.type === "poll" ? "bg-violet-50 text-[#6366f1] border-violet-100" : "bg-blue-50 text-blue-600 border-blue-100"}`}>
                                {f.type === "poll" ? "🗳️ Voting/Poll" : "📋 Form"}
                              </span>
                              <span className={`text-[9px] px-2 py-0.5 rounded-lg font-black uppercase tracking-wider border ${f.status === "open" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-500 border-slate-100"}`}>
                                {f.status === "open" ? "Open" : "Closed"}
                              </span>
                            </div>
                            <CardTitle className="text-sm font-extrabold text-[#110e3d] mt-1.5">
                              {f.title}
                            </CardTitle>
                            <p className="text-[10px] text-slate-400 font-bold">
                              Created by: @{f.createdByUsername || "Unknown"} • {format(new Date(f.createdAt), "dd MMM yyyy")}
                              {f.deadline && ` • Deadline: ${format(new Date(f.deadline), "dd MMM yyyy")}`}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-[#eae8f5] text-[#110e3d] text-[10px] font-extrabold px-3.5"
                              onClick={() => setSelectedFormResponses(f)}
                            >
                              View Responses ({f.responseCount})
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-lg border-slate-200 text-[#1e1b4b] hover:bg-slate-50 text-[10px] font-extrabold px-3.5"
                              onClick={() => handleOpenEditForm(f)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-lg border-slate-200 text-[#1e1b4b] hover:bg-slate-50 text-[10px] font-extrabold px-3.5"
                              onClick={async () => {
                                try {
                                  await updateFormMutation.mutateAsync({
                                    id: f.id,
                                    data: { status: f.status === "open" ? "closed" : "open" }
                                  });
                                  toast({ title: "Status updated", description: `Form is now ${f.status === "open" ? "closed" : "opened"}.` });
                                  invalidate("/api/forms");
                                } catch {
                                  toast({ title: "Error", description: "Failed to update form status.", variant: "destructive" });
                                }
                              }}
                            >
                              {f.status === "open" ? "Close" : "Open"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-lg border-red-100 text-red-500 hover:bg-red-50 text-[10px] font-extrabold px-3.5"
                              onClick={() => setDeletingFormId(f.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      {f.description && (
                        <CardContent className="pt-1 pb-4">
                          <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                            {f.description}
                          </p>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: ARCADIA CREDITS */}
          {activeTab === "credits" && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-[#110e3d]">Arcadia Credits</h2>
                  <p className="text-xs text-slate-400 font-bold mt-1">Configure credit cards for the contributors page.</p>
                </div>
                <Button onClick={openNewCredit} className="bg-[#6366f1] text-white hover:bg-violet-600 rounded-xl font-bold text-xs shadow-md shadow-violet-500/10 px-5 py-2.5 h-10">+ New Credit</Button>
              </div>
              
              {creditsLoading ? <Skeleton className="h-48 w-full rounded-2xl" /> : credits?.length === 0 ? (
                <div className="text-center py-16 text-slate-400 bg-white border border-[#eae8f5] rounded-2xl">No credits added yet.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 pt-4">
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
                      
                      {/* Subtle pattern overlay */}
                      <div className="absolute inset-[19px] rounded-xl pointer-events-none opacity-[0.035] bg-[repeating-linear-gradient(45deg,_#d97706_0px,_#d97706_1px,_transparent_1px,_transparent_8px),_repeating-linear-gradient(-45deg,_#d97706_0px,_#d97706_1px,_transparent_1px,_transparent_8px)] z-0" />

                      {/* Border Frame */}
                      <img src={`/frames/${credit.borderType}.png`} alt="" className="absolute inset-0 w-full h-full object-fill pointer-events-none z-10 filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]" />
                      
                      {/* Content */}
                      <div className="absolute inset-0 z-20 flex flex-col items-center justify-between py-8 px-8 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Avatar className="w-18 h-18 border-2 border-amber-500/20 shadow-md mt-2">
                            <AvatarImage src={credit.avatarUrl || undefined} className="object-cover" />
                            <AvatarFallback className="text-xl bg-slate-900 text-amber-500 font-bold">{getInitials(credit.name)}</AvatarFallback>
                          </Avatar>
                          
                          <div className="space-y-1">
                            <h3 className="font-extrabold text-sm text-amber-100 leading-snug tracking-tight line-clamp-1">{credit.name}</h3>
                            <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-black tracking-wider uppercase">
                              {credit.role}
                            </span>
                          </div>
                        </div>

                        <p className="text-[10px] text-zinc-400 line-clamp-3 leading-relaxed px-4 font-semibold">
                          {credit.description || "No biography added."}
                        </p>

                        <div className="flex gap-2 w-full px-2 z-30">
                          <Button size="sm" variant="outline" className="flex-1 bg-white/5 hover:bg-white/10 border-zinc-800 text-zinc-300 text-[10px] font-bold h-8 rounded-lg" onClick={() => openEditCredit(credit)}>Edit</Button>
                          <Button size="sm" className="flex-1 bg-red-600/80 hover:bg-red-600 border-none text-white text-[10px] font-bold h-8 rounded-lg" onClick={() => setDeletingCreditId(credit.id)}>Delete</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: REALM SETTINGS */}
          {activeTab === "settings" && (
            <div className="space-y-6 animate-fade-in max-w-2xl">
              <Card className="bg-white border-[#eae8f5] shadow-sm shadow-[#5a567a]/5 rounded-2xl overflow-hidden p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-extrabold text-[#110e3d]">⚙️ Realm Configurations</h2>
                  <p className="text-xs text-slate-400 font-bold mt-1">Calibrate system-wide information shown on the server homepage.</p>
                </div>
                
                {settingsLoading ? (
                  <Skeleton className="h-48 w-full rounded-2xl" />
                ) : (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-600">Realm Name</Label>
                        <Input
                          value={settingsForm.realmName}
                          onChange={(e) => setSettingsForm({ ...settingsForm, realmName: e.target.value })}
                          placeholder="Arcadia Guild"
                          className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-600">Realm Logo URL</Label>
                        <Input
                          value={settingsForm.realmLogoUrl}
                          onChange={(e) => setSettingsForm({ ...settingsForm, realmLogoUrl: e.target.value })}
                          placeholder="/logo.svg or https://..."
                          className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-600">Homepage Hero Title</Label>
                      <Input
                        value={settingsForm.heroTitle}
                        onChange={(e) => setSettingsForm({ ...settingsForm, heroTitle: e.target.value })}
                        placeholder="Forge Your Legend in Arcadia"
                        className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-600">Hero Subtitle / Lore</Label>
                      <Textarea
                        value={settingsForm.heroSubtitle}
                        onChange={(e) => setSettingsForm({ ...settingsForm, heroSubtitle: e.target.value })}
                        placeholder="Lore introduction details..."
                        className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs resize-none text-slate-800"
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-600">Minecraft Server IP Address</Label>
                        <Input
                          value={settingsForm.serverIP}
                          onChange={(e) => setSettingsForm({ ...settingsForm, serverIP: e.target.value })}
                          placeholder="play.arcadiamc.net"
                          className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-600">Minecraft Client Versions</Label>
                        <Input
                          value={settingsForm.mcVersion}
                          onChange={(e) => setSettingsForm({ ...settingsForm, mcVersion: e.target.value })}
                          placeholder="1.20.x - 1.21.x"
                          className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800"
                        />
                      </div>
                    </div>

                    <div className="border-t border-[#eae8f5] pt-4 mt-6 space-y-4">
                      <h3 className="font-extrabold text-xs text-[#110e3d] uppercase tracking-wider">Host Server Architecture Specs</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-600">Processor / CPU</Label>
                          <Input
                            value={settingsForm.specsCpu}
                            onChange={(e) => setSettingsForm({ ...settingsForm, specsCpu: e.target.value })}
                            placeholder="Intel Xeon E-2388G"
                            className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-600">System Memory (RAM)</Label>
                          <Input
                            value={settingsForm.specsMemory}
                            onChange={(e) => setSettingsForm({ ...settingsForm, specsMemory: e.target.value })}
                            placeholder="32 GB DDR4 ECC"
                            className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-600">Storage PCIe</Label>
                          <Input
                            value={settingsForm.specsStorage}
                            onChange={(e) => setSettingsForm({ ...settingsForm, specsStorage: e.target.value })}
                            placeholder="NVMe PCIe Gen 4 SSD"
                            className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-600">VPS Hosting Location</Label>
                          <Input
                            value={settingsForm.specsLocation}
                            onChange={(e) => setSettingsForm({ ...settingsForm, specsLocation: e.target.value })}
                            placeholder="Debian VPS Port 5433"
                            className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-[#eae8f5] pt-4 mt-6 space-y-4">
                      <h3 className="font-extrabold text-xs text-[#110e3d] uppercase tracking-wider">SayaBayar & Pricing Settings</h3>
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-600">SayaBayar API Key</Label>
                          <Input
                            type="password"
                            value={settingsForm.sayabayarApiKey}
                            onChange={(e) => setSettingsForm({ ...settingsForm, sayabayarApiKey: e.target.value })}
                            placeholder="Enter your sayabayar.com API key..."
                            className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-600">SayaBayar Webhook Secret</Label>
                          <Input
                            type="password"
                            value={settingsForm.sayabayarWebhookSecret}
                            onChange={(e) => setSettingsForm({ ...settingsForm, sayabayarWebhookSecret: e.target.value })}
                            placeholder="Enter your sayabayar.com Webhook Secret..."
                            className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-600">Premium Plan Price (IDR)</Label>
                            <Input
                              type="number"
                              min={1000}
                              value={settingsForm.premiumPrice}
                              onChange={(e) => setSettingsForm({ ...settingsForm, premiumPrice: parseInt(e.target.value) || 0 })}
                              placeholder="25000"
                              className={`bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800 ${(settingsForm.premiumPrice ?? 0) < 1000 && (settingsForm.premiumPrice ?? 0) > 0 ? 'border-red-400 ring-1 ring-red-400' : ''}`}
                            />
                            {(settingsForm.premiumPrice ?? 0) > 0 && (settingsForm.premiumPrice ?? 0) < 1000 && (
                              <p className="text-red-500 text-[10px] font-semibold mt-0.5">Minimal Rp 1.000</p>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-600">Premium+ Plan Price (IDR)</Label>
                            <Input
                              type="number"
                              min={1000}
                              value={settingsForm.premiumPlusPrice}
                              onChange={(e) => setSettingsForm({ ...settingsForm, premiumPlusPrice: parseInt(e.target.value) || 0 })}
                              placeholder="50000"
                              className={`bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800 ${(settingsForm.premiumPlusPrice ?? 0) < 1000 && (settingsForm.premiumPlusPrice ?? 0) > 0 ? 'border-red-400 ring-1 ring-red-400' : ''}`}
                            />
                            {(settingsForm.premiumPlusPrice ?? 0) > 0 && (settingsForm.premiumPlusPrice ?? 0) < 1000 && (
                              <p className="text-red-500 text-[10px] font-semibold mt-0.5">Minimal Rp 1.000</p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-600">Gift Premium Price (IDR)</Label>
                            <Input
                              type="number"
                              min={1000}
                              value={settingsForm.giftPremiumPrice}
                              onChange={(e) => setSettingsForm({ ...settingsForm, giftPremiumPrice: parseInt(e.target.value) || 0 })}
                              placeholder="25000"
                              className={`bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800 ${(settingsForm.giftPremiumPrice ?? 0) < 1000 && (settingsForm.giftPremiumPrice ?? 0) > 0 ? 'border-red-400 ring-1 ring-red-400' : ''}`}
                            />
                            {(settingsForm.giftPremiumPrice ?? 0) > 0 && (settingsForm.giftPremiumPrice ?? 0) < 1000 && (
                              <p className="text-red-500 text-[10px] font-semibold mt-0.5">Minimal Rp 1.000</p>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-600">Gift Premium+ Price (IDR)</Label>
                            <Input
                              type="number"
                              min={1000}
                              value={settingsForm.giftPremiumPlusPrice}
                              onChange={(e) => setSettingsForm({ ...settingsForm, giftPremiumPlusPrice: parseInt(e.target.value) || 0 })}
                              placeholder="50000"
                              className={`bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800 ${(settingsForm.giftPremiumPlusPrice ?? 0) < 1000 && (settingsForm.giftPremiumPlusPrice ?? 0) > 0 ? 'border-red-400 ring-1 ring-red-400' : ''}`}
                            />
                            {(settingsForm.giftPremiumPlusPrice ?? 0) > 0 && (settingsForm.giftPremiumPlusPrice ?? 0) < 1000 && (
                              <p className="text-red-500 text-[10px] font-semibold mt-0.5">Minimal Rp 1.000</p>
                            )}
                          </div>
                        </div>

                        {/* Diamond Conversion Rate */}
                        <div className="pt-2 mt-2 border-t border-[#eae8f5]">
                          <Label className="text-xs font-bold text-slate-600 flex items-center gap-1.5 mb-1">
                            💎 Rate Tukar Saldo → Diamond
                          </Label>
                          <p className="text-[11px] text-slate-400 mb-2">
                            Tentukan: berapa Rupiah ditukar jadi berapa diamond. Contoh: Rp 17.000 → 100 diamond.
                          </p>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-bold text-slate-600">Rupiah (IDR)</Label>
                              <Input
                                type="number"
                                min={1}
                                value={settingsForm.diamondPackRupiah}
                                onChange={(e) => setSettingsForm({ ...settingsForm, diamondPackRupiah: parseInt(e.target.value) || 0 })}
                                placeholder="17000"
                                className={`bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800 ${(settingsForm.diamondPackRupiah ?? 0) < 1 ? 'border-red-400 ring-1 ring-red-400' : ''}`}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-bold text-slate-600">Diamond yang didapat</Label>
                              <Input
                                type="number"
                                min={1}
                                value={settingsForm.diamondPackDiamonds}
                                onChange={(e) => setSettingsForm({ ...settingsForm, diamondPackDiamonds: parseInt(e.target.value) || 0 })}
                                placeholder="100"
                                className={`bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800 ${(settingsForm.diamondPackDiamonds ?? 0) < 1 ? 'border-red-400 ring-1 ring-red-400' : ''}`}
                              />
                            </div>
                          </div>
                          {(settingsForm.diamondPackRupiah ?? 0) >= 1 && (settingsForm.diamondPackDiamonds ?? 0) >= 1 && (
                            <p className="text-[11px] text-emerald-600 font-semibold mt-1.5">
                              Preview: Rp {Number(settingsForm.diamondPackRupiah).toLocaleString("id-ID")} = {Number(settingsForm.diamondPackDiamonds).toLocaleString("id-ID")} 💎
                              {" "}(≈ Rp {Math.round((settingsForm.diamondPackRupiah || 0) / (settingsForm.diamondPackDiamonds || 1)).toLocaleString("id-ID")} / diamond)
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={handleSaveSettings}
                      disabled={saveSettings.isPending}
                      className="w-full bg-[#6366f1] text-white hover:bg-violet-600 rounded-xl font-bold text-xs h-10 shadow-md shadow-violet-500/5 mt-4"
                    >
                      {saveSettings.isPending ? "Calibrating systems..." : "Save Realm Configurations"}
                    </Button>
                  </div>
                )}
              </Card>

              {/* BOOST PACKAGES MANAGEMENT CARD */}
              <Card className="bg-white border-[#eae8f5] shadow-sm shadow-[#5a567a]/5 rounded-2xl overflow-hidden p-6 space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-extrabold text-[#110e3d] flex items-center gap-2">
                      <Zap className="w-4 h-4 text-violet-500" /> Boost Packages
                    </h2>
                    <p className="text-xs text-slate-400 font-bold mt-0.5">Kelola paket boost yang tersedia untuk dibeli member. Set diskon langsung dari sini.</p>
                  </div>
                  <Button
                    onClick={() => { setPkgForm(emptyPkg); setEditingPkgId(null); setPkgDialogOpen(true); }}
                    className="h-9 shrink-0 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-black px-4 shadow-sm active:scale-95 transition-all"
                  >
                    + Tambah Paket
                  </Button>
                </div>

                {boostPkgLoading ? (
                  <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}</div>
                ) : !boostPackagesAdmin || boostPackagesAdmin.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-[#eae8f5] p-8 text-center">
                    <Zap className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-400">Belum ada paket boost. Klik "+ Tambah Paket" untuk mulai.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {boostPackagesAdmin.map((pkg: any) => (
                      <div key={pkg.id} className="flex items-center gap-3 rounded-2xl border-2 border-[#eae8f5] bg-slate-50/50 p-4">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${pkg.active ? "bg-gradient-to-br from-violet-500 to-indigo-600" : "bg-slate-200"}`}>
                          <Zap className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-extrabold text-[#110e3d]">{pkg.displayName}</p>
                            {!pkg.active && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-black uppercase text-slate-500">NONAKTIF</span>}
                            {pkg.discountPriceIdr && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-black uppercase text-green-700">DISKON</span>}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 flex-wrap mt-0.5">
                            <span>{pkg.boostCount} boost · {pkg.durationDays}h</span>
                            {pkg.discountPriceIdr ? (
                              <><span className="text-green-600 font-black">Rp {pkg.discountPriceIdr.toLocaleString("id-ID")}</span><span className="line-through">Rp {pkg.priceIdr.toLocaleString("id-ID")}</span></>
                            ) : (
                              <span className="font-black text-violet-600">Rp {pkg.priceIdr.toLocaleString("id-ID")}</span>
                            )}
                            <span className="text-slate-300">·</span>
                            <span className="font-mono text-slate-400">{pkg.sku}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            onClick={() => { setPkgForm({ sku: pkg.sku, displayName: pkg.displayName, description: pkg.description || "", boostCount: pkg.boostCount, priceIdr: pkg.priceIdr, discountPriceIdr: pkg.discountPriceIdr ?? "", durationDays: pkg.durationDays, active: pkg.active }); setEditingPkgId(pkg.id); setPkgDialogOpen(true); }}
                            variant="outline" size="sm"
                            className="h-8 rounded-xl text-xs font-bold border-[#eae8f5] hover:bg-violet-50 hover:border-violet-300"
                          >Edit</Button>
                          <Button
                            onClick={() => { if (confirm(`Hapus paket "${pkg.displayName}"?`)) deletePkg.mutate(pkg.id); }}
                            disabled={deletePkg.isPending}
                            variant="outline" size="sm"
                            className="h-8 rounded-xl text-xs font-bold border-red-200 text-red-500 hover:bg-red-50"
                          >Hapus</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add/Edit Package Dialog */}
                {pkgDialogOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) { setPkgDialogOpen(false); setPkgForm(emptyPkg); setEditingPkgId(null); } }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-extrabold text-[#110e3d]">{editingPkgId !== null ? "Edit Paket Boost" : "Tambah Paket Boost"}</h3>
                        <button onClick={() => { setPkgDialogOpen(false); setPkgForm(emptyPkg); setEditingPkgId(null); }} className="text-slate-400 hover:text-slate-700 text-lg font-bold leading-none">✕</button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">SKU *</Label>
                          <Input value={pkgForm.sku} onChange={e => setPkgForm({...pkgForm, sku: e.target.value})} placeholder="boost-1x-30d" disabled={editingPkgId !== null} className="h-9 rounded-xl border-[#eae8f5] bg-slate-50 text-xs text-slate-800 disabled:text-slate-500" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nama Paket *</Label>
                          <Input value={pkgForm.displayName} onChange={e => setPkgForm({...pkgForm, displayName: e.target.value})} placeholder="1x Boost 30 Hari" className="h-9 rounded-xl border-[#eae8f5] bg-slate-50 text-xs text-slate-800" />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Deskripsi (Opsional)</Label>
                        <Input value={pkgForm.description} onChange={e => setPkgForm({...pkgForm, description: e.target.value})} placeholder="Boost 1 slot selama 30 hari" className="h-9 rounded-xl border-[#eae8f5] bg-slate-50 text-xs text-slate-800" />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Jumlah Boost</Label>
                          <Input type="number" min={1} value={pkgForm.boostCount} onChange={e => setPkgForm({...pkgForm, boostCount: parseInt(e.target.value) || 1})} className="h-9 rounded-xl border-[#eae8f5] bg-slate-50 text-xs text-slate-800" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Durasi (Hari)</Label>
                          <Input type="number" min={1} value={pkgForm.durationDays} onChange={e => setPkgForm({...pkgForm, durationDays: parseInt(e.target.value) || 30})} className="h-9 rounded-xl border-[#eae8f5] bg-slate-50 text-xs text-slate-800" />
                        </div>
                        <div className="space-y-1 flex flex-col">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</Label>
                          <button
                            type="button"
                            onClick={() => setPkgForm({...pkgForm, active: !pkgForm.active})}
                            className={`h-9 rounded-xl text-xs font-black flex-1 transition-all ${pkgForm.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}
                          >{pkgForm.active ? "Aktif" : "Nonaktif"}</button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Harga Normal (IDR) *</Label>
                          <Input type="number" min={1000} value={pkgForm.priceIdr} onChange={e => setPkgForm({...pkgForm, priceIdr: parseInt(e.target.value) || 0})} className={`h-9 rounded-xl border-[#eae8f5] bg-slate-50 text-xs text-slate-800 ${pkgForm.priceIdr > 0 && pkgForm.priceIdr < 1000 ? "border-red-400" : ""}`} />
                          {pkgForm.priceIdr > 0 && pkgForm.priceIdr < 1000 && <p className="text-red-500 text-[9px] font-bold">Min Rp 1.000</p>}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Harga Diskon (IDR)</Label>
                          <Input type="number" min={1000} value={pkgForm.discountPriceIdr} onChange={e => setPkgForm({...pkgForm, discountPriceIdr: e.target.value})} placeholder="Kosongkan = no diskon" className="h-9 rounded-xl border-[#eae8f5] bg-slate-50 text-xs text-slate-800" />
                          {pkgForm.discountPriceIdr && Number(pkgForm.discountPriceIdr) > 0 && Number(pkgForm.discountPriceIdr) < 1000 && <p className="text-red-500 text-[9px] font-bold">Min Rp 1.000</p>}
                          {pkgForm.discountPriceIdr && Number(pkgForm.discountPriceIdr) >= pkgForm.priceIdr && Number(pkgForm.discountPriceIdr) > 0 && <p className="text-orange-500 text-[9px] font-bold">Diskon harus lebih kecil dari harga normal</p>}
                        </div>
                      </div>

                      {pkgForm.discountPriceIdr && Number(pkgForm.discountPriceIdr) >= 1000 && pkgForm.priceIdr >= 1000 && Number(pkgForm.discountPriceIdr) < pkgForm.priceIdr && (
                        <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-2 text-xs font-bold text-green-700">
                          💸 Diskon {Math.round((1 - Number(pkgForm.discountPriceIdr) / pkgForm.priceIdr) * 100)}% · Hemat Rp {(pkgForm.priceIdr - Number(pkgForm.discountPriceIdr)).toLocaleString("id-ID")}
                        </div>
                      )}

                      <Button
                        onClick={handleSavePkg}
                        disabled={createPkg.isPending || updatePkg.isPending}
                        className="w-full h-10 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-black"
                      >
                        {(createPkg.isPending || updatePkg.isPending) ? "Menyimpan..." : editingPkgId !== null ? "Simpan Perubahan" : "Buat Paket"}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* TAB: GACHA & WALLET CONFIG */}
          {activeTab === "gacha" && (
            <div className="space-y-6 animate-fade-in">
              {/* Premium Header */}
              <div className="relative rounded-2xl bg-gradient-to-r from-pink-600 via-[#8b5cf6] to-violet-600 p-6 md:p-8 text-white shadow-xl shadow-purple-600/10 overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 border border-purple-500/20">
                <div className="absolute right-[-10%] top-[-20%] w-[35%] h-[150%] bg-white/5 skew-x-12 blur-sm pointer-events-none" />
                <div className="space-y-2 max-w-xl">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-[10px] font-bold tracking-wide uppercase">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" /> Gacha Royale & Diamonds Console
                  </div>
                  <h3 className="text-xl md:text-2xl font-black leading-tight tracking-tight">Cyber-Neon Economy Calibrator</h3>
                  <p className="text-xs text-purple-100/90 leading-relaxed font-medium">
                    Adjust spin rates, modify pool cosmetics (borders, badges, and backdrops), and audit user wallet accounts directly with immediate database updates.
                  </p>
                </div>
              </div>

              {/* Sub-tab Navigation */}
              <div className="flex border-b border-[#eae8f5] gap-2">
                <button
                  onClick={() => setGachaSubTab("settings")}
                  className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
                    gachaSubTab === "settings"
                      ? "border-[#6366f1] text-[#6366f1]"
                      : "border-transparent text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <Settings className="w-4 h-4" /> Rates & Costs
                </button>
                <button
                  onClick={() => setGachaSubTab("registry")}
                  className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
                    gachaSubTab === "registry"
                      ? "border-[#6366f1] text-[#6366f1]"
                      : "border-transparent text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <Dices className="w-4 h-4" /> Cosmetics Pool Registry
                </button>
                <button
                  onClick={() => setGachaSubTab("wallets")}
                  className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
                    gachaSubTab === "wallets"
                      ? "border-[#6366f1] text-[#6366f1]"
                      : "border-transparent text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <Wallet className="w-4 h-4" /> Member Wallet Auditor
                </button>
                <button
                  onClick={() => setGachaSubTab("quests" as any)}
                  className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
                    gachaSubTab === "quests"
                      ? "border-[#6366f1] text-[#6366f1]"
                      : "border-transparent text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <Trophy className="w-4 h-4" /> Quest Manager
                </button>
                <button
                  onClick={() => setGachaSubTab("shop")}
                  className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
                    gachaSubTab === "shop"
                      ? "border-[#6366f1] text-[#6366f1]"
                      : "border-transparent text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" /> Shop Manager
                </button>
              </div>

              {/* Gacha Settings Inner Tab */}
              {gachaSubTab === "settings" && (
                <div className="grid md:grid-cols-3 gap-6 items-start">
                  {/* Costs Form */}
                  <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl p-6 md:col-span-2 space-y-6">
                    <div>
                      <h4 className="font-extrabold text-sm text-[#110e3d]">💎 Spin Package Prices</h4>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">Configure costs in diamonds for gacha spin packages.</p>
                    </div>

                    {adminGachaSettingsLoading ? (
                      <div className="space-y-4">
                        <Skeleton className="h-9 w-full rounded-xl" />
                        <Skeleton className="h-9 w-full rounded-xl" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-600">1x Spin Cost (Diamonds)</Label>
                            <Input
                              type="number"
                              min={1}
                              value={gachaSettingsForm.spinCost1}
                              onChange={(e) => setGachaSettingsForm({ ...gachaSettingsForm, spinCost1: parseInt(e.target.value) || 0 })}
                              className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-600">10x Spin Cost (Diamonds)</Label>
                            <Input
                              type="number"
                              min={1}
                              value={gachaSettingsForm.spinCost10}
                              onChange={(e) => setGachaSettingsForm({ ...gachaSettingsForm, spinCost10: parseInt(e.target.value) || 0 })}
                              className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-600">25x Spin Cost (Diamonds)</Label>
                            <Input
                              type="number"
                              min={1}
                              value={gachaSettingsForm.spinCost25}
                              onChange={(e) => setGachaSettingsForm({ ...gachaSettingsForm, spinCost25: parseInt(e.target.value) || 0 })}
                              className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-600">50x Spin Cost (Diamonds)</Label>
                            <Input
                              type="number"
                              min={1}
                              value={gachaSettingsForm.spinCost50}
                              onChange={(e) => setGachaSettingsForm({ ...gachaSettingsForm, spinCost50: parseInt(e.target.value) || 0 })}
                              className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5 pt-2 border-t border-slate-100">
                          <Label className="text-xs font-bold text-slate-600">Duplicate Refund Rate (Diamonds)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={gachaSettingsForm.duplicateRefund}
                            onChange={(e) => setGachaSettingsForm({ ...gachaSettingsForm, duplicateRefund: parseInt(e.target.value) || 0 })}
                            className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800"
                          />
                          <p className="text-[9px] text-slate-400 font-semibold leading-relaxed">Amount credited when a user rolls a cosmetic item they already own.</p>
                        </div>
                      </div>
                    )}
                  </Card>

                  {/* Rates Card */}
                  <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl p-6 space-y-6">
                    <div>
                      <h4 className="font-extrabold text-sm text-[#110e3d]">🎲 Rarity Tier Odds</h4>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">Calibrate roll distribution rates (out of 100%).</p>
                    </div>

                    {adminGachaSettingsLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-6 w-full rounded" />
                        <Skeleton className="h-6 w-full rounded" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-bold text-slate-600">
                              <span>S Tier Threshold (%)</span>
                              <span className="text-red-500 font-extrabold">Rate: {gachaSettingsForm.rateS}%</span>
                            </div>
                            <Input
                              type="number"
                              step="0.1"
                              min={0}
                              max={100}
                              value={gachaSettingsForm.rateS}
                              onChange={(e) => setGachaSettingsForm({ ...gachaSettingsForm, rateS: parseFloat(e.target.value) || 0 })}
                              className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-8 text-slate-850"
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-bold text-slate-600">
                              <span>A Tier Threshold (%)</span>
                              <span className="text-purple-500 font-extrabold">Rate: {Math.max(0, gachaSettingsForm.rateA - gachaSettingsForm.rateS).toFixed(1)}%</span>
                            </div>
                            <Input
                              type="number"
                              step="0.1"
                              min={0}
                              max={100}
                              value={gachaSettingsForm.rateA}
                              onChange={(e) => setGachaSettingsForm({ ...gachaSettingsForm, rateA: parseFloat(e.target.value) || 0 })}
                              className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-8 text-slate-850"
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-bold text-slate-600">
                              <span>B Tier Threshold (%)</span>
                              <span className="text-blue-500 font-extrabold">Rate: {Math.max(0, gachaSettingsForm.rateB - gachaSettingsForm.rateA).toFixed(1)}%</span>
                            </div>
                            <Input
                              type="number"
                              step="0.1"
                              min={0}
                              max={100}
                              value={gachaSettingsForm.rateB}
                              onChange={(e) => setGachaSettingsForm({ ...gachaSettingsForm, rateB: parseFloat(e.target.value) || 0 })}
                              className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-8 text-slate-855"
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-bold text-slate-600">
                              <span>C Tier Threshold (%)</span>
                              <span className="text-green-500 font-extrabold">Rate: {Math.max(0, gachaSettingsForm.rateC - gachaSettingsForm.rateB).toFixed(1)}%</span>
                            </div>
                            <Input
                              type="number"
                              step="0.1"
                              min={0}
                              max={100}
                              value={gachaSettingsForm.rateC}
                              onChange={(e) => setGachaSettingsForm({ ...gachaSettingsForm, rateC: parseFloat(e.target.value) || 0 })}
                              className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-8 text-slate-860"
                            />
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs font-bold text-slate-500">
                            <span>D Tier (Remainder)</span>
                            <span className="text-slate-600 font-extrabold">{Math.max(0, 100 - gachaSettingsForm.rateC).toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>

                  {/* Actions Row */}
                  <div className="md:col-span-3 flex justify-end">
                    <Button
                      onClick={async () => {
                        try {
                          await updateGachaSettings.mutateAsync({ data: gachaSettingsForm });
                          toast({ title: "Calibrated", description: "Gacha pricing and odds updated successfully." });
                          invalidate("/api/admin/gacha/settings", "/api/gacha/board");
                        } catch (err: any) {
                          toast({ title: "Error", description: err.message || "Failed to update gacha settings.", variant: "destructive" });
                        }
                      }}
                      disabled={updateGachaSettings.isPending}
                      className="bg-[#6366f1] text-white hover:bg-violet-600 font-black rounded-xl text-xs h-10 px-8 transition-all shadow-md active:scale-95 shadow-violet-500/10"
                    >
                      {updateGachaSettings.isPending ? "Applying configs..." : "Apply Gacha Configurations"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Cosmetics Registry Tab */}
              {gachaSubTab === "registry" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center flex-wrap gap-4">
                    <div>
                      <h4 className="font-extrabold text-sm text-[#110e3d]">Cosmetics Registry</h4>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">Maintain the pool of equipped cosmetics in the Gacha Royale system.</p>
                    </div>
                    <Button onClick={openNewCosmetic} className="bg-[#6366f1] text-white hover:bg-violet-600 rounded-xl font-bold text-xs h-9 px-4 shadow-md shadow-violet-500/5">
                      + Register Cosmetic
                    </Button>
                  </div>

                  {gachaBoardLoading ? (
                    <Skeleton className="h-48 w-full rounded-2xl" />
                  ) : !gachaBoard?.cosmetics || gachaBoard.cosmetics.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 bg-white border border-[#eae8f5] rounded-2xl">
                      No cosmetics in registry. Click "+ Register Cosmetic" to seed.
                    </div>
                  ) : (
                    <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-[#f8f7fa]">
                            <TableRow className="border-[#eae8f5]">
                              <TableHead className="text-xs font-black text-[#110e3d] w-16">Preview</TableHead>
                              <TableHead className="text-xs font-black text-[#110e3d]">Name</TableHead>
                              <TableHead className="text-xs font-black text-[#110e3d] w-32">Type</TableHead>
                              <TableHead className="text-xs font-black text-[#110e3d] w-24">Rarity</TableHead>
                              <TableHead className="text-xs font-black text-[#110e3d] max-w-xs">Value / CSS Class</TableHead>
                              <TableHead className="text-right text-xs font-black text-[#110e3d] w-40">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {gachaBoard.cosmetics.filter((c: any) => c.isGacha).map((cosmetic: any) => (
                              <TableRow key={cosmetic.id} className="border-[#eae8f5] hover:bg-slate-50/50">
                                <TableCell className="py-2.5">
                                  {cosmetic.type === "border" ? (
                                    <div className="relative p-1 inline-block">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-slate-900 border border-slate-700 overflow-hidden ${cosmetic.value}`}>
                                        <span className="text-[7px] text-slate-500 font-bold uppercase select-none">Pvw</span>
                                      </div>
                                    </div>
                                  ) : cosmetic.type === "badge" ? (
                                    <span className={`text-[9px] px-2 py-0.5 rounded font-black select-none ${cosmetic.value}`}>
                                      Tag
                                    </span>
                                  ) : (
                                    <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-100 bg-slate-50 shadow-sm">
                                      <img src={cosmetic.value} alt="" className="w-full h-full object-cover animate-fade-in" onError={(e) => { (e.target as any).src = "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=100"; }} />
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="font-extrabold text-xs text-[#110e3d]">{cosmetic.name}</TableCell>
                                <TableCell className="text-xs text-slate-500 font-bold capitalize">{cosmetic.type}</TableCell>
                                <TableCell>
                                  <div className="flex flex-col gap-1">
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full w-fit ${
                                      cosmetic.rarity === "S"
                                        ? "bg-gradient-to-r from-red-500 to-amber-500 text-white shadow-sm"
                                        : cosmetic.rarity === "A"
                                        ? "bg-purple-100 text-purple-700"
                                        : cosmetic.rarity === "B"
                                        ? "bg-blue-100 text-blue-700"
                                        : cosmetic.rarity === "C"
                                        ? "bg-green-100 text-green-700"
                                        : "bg-slate-100 text-slate-600"
                                    }`}>
                                      {cosmetic.rarity} Tier
                                    </span>
                                    <span className="text-[10px] font-extrabold text-emerald-600">
                                      {cosmetic.price > 0 ? `${cosmetic.price} 🪙` : "Gacha Only"}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs text-slate-500 font-mono truncate max-w-[180px]" title={cosmetic.value}>
                                  {cosmetic.value}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1.5">
                                    <Button size="sm" variant="outline" className="border-[#eae8f5] text-slate-600 hover:bg-slate-55 text-[10px] font-bold rounded-xl h-7 px-3" onClick={() => openEditCosmetic(cosmetic)}>Edit</Button>
                                    <Button size="sm" variant="outline" className="border-red-100 text-red-500 hover:bg-red-55 hover:border-red-200 text-[10px] font-bold rounded-xl h-7 px-3" onClick={() => setDeletingCosmeticId(cosmetic.id)}>Delete</Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* Shop Manager Tab */}
              {gachaSubTab === "shop" && (
                <div className="space-y-4 animate-in fade-in-50 duration-200">
                  <div className="flex justify-between items-center flex-wrap gap-4">
                    <div>
                      <h4 className="font-extrabold text-sm text-[#110e3d]">Shop Manager</h4>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">Maintain the list of items available in the Token Shop.</p>
                    </div>
                    <Button onClick={openNewShopItem} className="bg-[#6366f1] text-white hover:bg-violet-600 rounded-xl font-bold text-xs h-9 px-4 shadow-md shadow-violet-500/5">
                      + Register Shop Item
                    </Button>
                  </div>

                  {gachaBoardLoading ? (
                    <Skeleton className="h-48 w-full rounded-2xl" />
                  ) : !gachaBoard?.cosmetics || gachaBoard.cosmetics.filter((c: any) => c.isShop).length === 0 ? (
                    <div className="text-center py-16 text-slate-400 bg-white border border-[#eae8f5] rounded-2xl">
                      No shop items registered. Click "+ Register Shop Item" to add.
                    </div>
                  ) : (
                    <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-[#f8f7fa]">
                            <TableRow className="border-[#eae8f5]">
                              <TableHead className="text-xs font-black text-[#110e3d] w-16">Preview</TableHead>
                              <TableHead className="text-xs font-black text-[#110e3d]">Name</TableHead>
                              <TableHead className="text-xs font-black text-[#110e3d] w-32">Type</TableHead>
                              <TableHead className="text-xs font-black text-[#110e3d] w-24">Rarity</TableHead>
                              <TableHead className="text-xs font-black text-[#110e3d] max-w-xs">Value / CSS Class</TableHead>
                              <TableHead className="text-right text-xs font-black text-[#110e3d] w-40">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {gachaBoard.cosmetics.filter((c: any) => c.isShop).map((cosmetic: any) => (
                              <TableRow key={cosmetic.id} className="border-[#eae8f5] hover:bg-slate-50/50">
                                <TableCell className="py-2.5">
                                  {cosmetic.type === "border" ? (
                                    <div className="relative p-1 inline-block">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-slate-900 border border-slate-700 overflow-hidden ${cosmetic.value}`}>
                                        <span className="text-[7px] text-slate-500 font-bold uppercase select-none">Pvw</span>
                                      </div>
                                    </div>
                                  ) : cosmetic.type === "badge" ? (
                                    <span className={`text-[9px] px-2 py-0.5 rounded font-black select-none ${cosmetic.value}`}>
                                      Tag
                                    </span>
                                  ) : (cosmetic.type === "premium" || cosmetic.type === "premium_plus") ? (
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[9px] border ${
                                      cosmetic.type === "premium_plus"
                                        ? "bg-pink-500/15 border-pink-200 text-pink-500"
                                        : "bg-amber-500/15 border-amber-200 text-amber-500"
                                    }`}>
                                      👑 {cosmetic.value}d
                                    </div>
                                  ) : (
                                    <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-100 bg-slate-50 shadow-sm">
                                      <img src={cosmetic.value} alt="" className="w-full h-full object-cover animate-fade-in" onError={(e) => { (e.target as any).src = "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=100"; }} />
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="font-extrabold text-xs text-[#110e3d]">{cosmetic.name}</TableCell>
                                <TableCell className="text-xs text-slate-500 font-bold capitalize">{cosmetic.type}</TableCell>
                                <TableCell>
                                  <div className="flex flex-col gap-1">
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full w-fit ${
                                      cosmetic.rarity === "S"
                                        ? "bg-gradient-to-r from-red-500 to-amber-500 text-white shadow-sm"
                                        : cosmetic.rarity === "A"
                                        ? "bg-purple-100 text-purple-700"
                                        : cosmetic.rarity === "B"
                                        ? "bg-blue-100 text-blue-700"
                                        : cosmetic.rarity === "C"
                                        ? "bg-green-100 text-green-700"
                                        : "bg-slate-100 text-slate-600"
                                    }`}>
                                      {cosmetic.rarity} Tier
                                    </span>
                                    <span className="text-[10px] font-extrabold text-emerald-600">
                                      {cosmetic.price} 🪙
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs text-slate-500 font-mono truncate max-w-[180px]" title={cosmetic.value}>
                                  {cosmetic.value}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1.5">
                                    <Button size="sm" variant="outline" className="border-[#eae8f5] text-slate-600 hover:bg-slate-55 text-[10px] font-bold rounded-xl h-7 px-3" onClick={() => openEditCosmetic(cosmetic)}>Edit</Button>
                                    <Button size="sm" variant="outline" className="border-red-100 text-red-500 hover:bg-red-55 hover:border-red-200 text-[10px] font-bold rounded-xl h-7 px-3" onClick={() => setDeletingCosmeticId(cosmetic.id)}>Delete</Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* Auditor & Wallets Tab */}
              {gachaSubTab === "wallets" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center flex-wrap gap-4">
                    <div>
                      <h4 className="font-extrabold text-sm text-[#110e3d]">Member Wallet Auditor</h4>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">Monitor and adjust players' diamond balances manually.</p>
                    </div>
                    <div className="relative flex-1 max-w-xs">
                      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        value={userDirSearch}
                        onChange={(e) => setUserDirSearch(e.target.value)}
                        placeholder="Search player name, tag, or UID…"
                        className="pl-9 bg-white border-[#eae8f5] rounded-xl text-xs h-9 focus-visible:ring-1 focus-visible:ring-[#6366f1]"
                      />
                    </div>
                  </div>

                  {usersLoading ? (
                    <Skeleton className="h-48 w-full rounded-2xl" />
                  ) : (
                    <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl overflow-hidden">
                      <Table>
                        <TableHeader className="bg-[#f8f7fa]">
                          <TableRow className="border-[#eae8f5]">
                            <TableHead className="text-xs font-black text-[#110e3d]">Player Profile</TableHead>
                            <TableHead className="text-xs font-black text-[#110e3d] w-24">UID</TableHead>
                            <TableHead className="text-xs font-black text-[#110e3d]">Role</TableHead>
                            <TableHead className="text-xs font-black text-[#110e3d] w-40">Wallet Balance</TableHead>
                            <TableHead className="text-right text-xs font-black text-[#110e3d] w-40">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users
                            ?.filter((u) => {
                              const q = userDirSearch.toLowerCase();
                              return (
                                !q ||
                                u.username.toLowerCase().includes(q) ||
                                u.userTag.toLowerCase().includes(q) ||
                                (u.displayName && u.displayName.toLowerCase().includes(q)) ||
                                String(u.id).includes(q)
                              );
                            })
                            .map((u) => (
                              <TableRow key={u.id} className="border-[#eae8f5] hover:bg-slate-50/50">
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center font-black text-[#6366f1] text-xs shrink-0 overflow-hidden border border-[#eae8f5]">
                                      {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" /> : (u.displayName || u.username).charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-extrabold text-xs text-[#110e3d] truncate">
                                        {u.displayName || u.username}
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-bold truncate">@{u.username}</div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs text-slate-400 font-bold">#{u.id}</TableCell>
                                <TableCell>
                                  <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${ROLE_BADGE_CLASSES[u.role as UserRole] || "bg-muted text-muted-foreground"}`}>
                                    {ROLE_LABELS[u.role as UserRole] || u.role}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700">
                                    <span className="text-sky-500 font-black">💎</span>
                                    <span>{u.diamonds?.toLocaleString() ?? 0}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-[#eae8f5] text-slate-600 hover:bg-slate-55 text-[10px] font-bold rounded-xl h-8 px-3.5"
                                    onClick={() => {
                                      setWalletTargetUser(u);
                                      setWalletAdjustmentAmount("");
                                      setWalletAdjustmentReason("");
                                      setWalletDialogOpen(true);
                                    }}
                                  >
                                    Adjust Wallet
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </Card>
                  )}
                </div>
              )}

              {/* Quest Manager Tab */}
              {gachaSubTab === "quests" && (
                <div className="space-y-4 animate-in fade-in-50 duration-200">
                  <div className="flex justify-between items-center flex-wrap gap-4">
                    <div>
                      <h4 className="font-extrabold text-sm text-[#110e3d]">Quest Manager</h4>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">Kelola daftar misi harian, target pencapaian, dan hadiah Token untuk pengguna.</p>
                    </div>
                    <Button 
                      onClick={() => {
                        setQuestForm(emptyQuestForm);
                        setEditingQuestId(null);
                        setQuestDialogOpen(true);
                      }}
                      className="bg-[#6366f1] text-white hover:bg-violet-600 rounded-xl font-bold text-xs h-9 px-4 shadow-md shadow-violet-500/5"
                    >
                      + Tambah Misi
                    </Button>
                  </div>

                  {adminQuestsLoading ? (
                    <Skeleton className="h-48 w-full rounded-2xl" />
                  ) : localQuests.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 bg-white border border-[#eae8f5] rounded-2xl">
                      Belum ada misi yang terdaftar. Klik "+ Tambah Misi" untuk membuat misi baru.
                    </div>
                  ) : (
                    <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-[#f8f7fa]">
                            <TableRow className="border-[#eae8f5]">
                              <TableHead className="text-xs font-black text-[#110e3d] w-12">ID</TableHead>
                              <TableHead className="text-xs font-black text-[#110e3d]">Judul Misi</TableHead>
                              <TableHead className="text-xs font-black text-[#110e3d]">Tipe</TableHead>
                              <TableHead className="text-xs font-black text-[#110e3d] w-24 text-center">Target</TableHead>
                              <TableHead className="text-xs font-black text-[#110e3d] w-24 text-center">Hadiah</TableHead>
                              <TableHead className="text-xs font-black text-[#110e3d] max-w-xs">Video URL (Misi Video)</TableHead>
                              <TableHead className="text-right text-xs font-black text-[#110e3d] w-40">Aksi</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {localQuests.map((q: any) => (
                              <TableRow key={q.id} className="border-[#eae8f5] hover:bg-slate-50/50">
                                <TableCell className="text-xs text-slate-400 font-bold">#{q.id}</TableCell>
                                <TableCell>
                                  <div>
                                    <span className="font-extrabold text-xs text-[#110e3d]">{q.title}</span>
                                    <p className="text-[10px] text-slate-400 font-semibold">{q.desc}</p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                    q.type === "chat" ? "bg-blue-100 text-blue-700" :
                                    q.type === "search" ? "bg-purple-100 text-purple-700" :
                                    q.type === "dm" ? "bg-amber-100 text-amber-700" :
                                    "bg-rose-100 text-rose-700"
                                  }`}>
                                    {q.type === "chat" ? "Kirim Pesan" :
                                     q.type === "search" ? "Cari Obrolan" :
                                     q.type === "dm" ? "Mulai DM" :
                                     "Nonton Video"}
                                  </span>
                                </TableCell>
                                <TableCell className="text-xs text-slate-600 font-bold text-center">{q.target}</TableCell>
                                <TableCell className="text-xs text-emerald-600 font-black text-center">{q.reward} 🪙</TableCell>
                                <TableCell className="text-xs text-slate-400 font-mono truncate max-w-[200px]" title={q.videoUrl}>
                                  {q.videoUrl ? (
                                    <span>{q.videoUrl} <span className="text-rose-500 font-bold">({q.duration || 15}s)</span></span>
                                  ) : (
                                    <span className="text-slate-300 italic">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1.5">
                                    <Button 
                                      size="sm" 
                                      variant="outline" 
                                      className="border-[#eae8f5] text-slate-600 hover:bg-slate-55 text-[10px] font-bold rounded-xl h-7 px-3"
                                      onClick={() => {
                                        setQuestForm({
                                          title: q.title,
                                          desc: q.desc || "",
                                          target: q.target,
                                          reward: q.reward,
                                          type: q.type,
                                          videoUrl: q.videoUrl || "",
                                          duration: q.duration || 15,
                                        });
                                        setEditingQuestId(q.id);
                                        setQuestDialogOpen(true);
                                      }}
                                    >
                                      Edit
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="outline" 
                                      className="border-red-100 text-red-500 hover:bg-red-55 hover:border-red-200 text-[10px] font-bold rounded-xl h-7 px-3"
                                      onClick={() => handleDeleteQuest(q.id)}
                                    >
                                      Hapus
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </Card>
                  )}
                </div>
              )}


            </div>
          )}

          {/* TAB: GROUPS & COMMUNITIES */}
          {activeTab === "groups" && canManageAdmin && (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h2 className="text-xl font-extrabold text-[#110e3d]">Groups & Communities</h2>
                    <p className="text-xs text-slate-400 font-bold mt-1">Audit and verify server group conversations.</p>
                  </div>
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      value={groupSearch}
                      onChange={(e) => setGroupSearch(e.target.value)}
                      placeholder="Search group name or invite code…"
                      className="pl-9 bg-white border-[#eae8f5] rounded-xl text-xs h-9 focus-visible:ring-1 focus-visible:ring-[#6366f1]"
                    />
                  </div>
                </div>

                {adminGroupsLoading ? (
                  <Skeleton className="h-48 w-full rounded-2xl" />
                ) : (
                  <Card className="bg-white border-[#eae8f5] shadow-sm shadow-[#5a567a]/5 rounded-2xl overflow-hidden">
                    <Table>
                      <TableHeader className="bg-[#f8f7fa]">
                        <TableRow className="border-[#eae8f5]">
                          <TableHead className="text-xs font-black text-[#110e3d]">Group</TableHead>
                          <TableHead className="text-xs font-black text-[#110e3d]">Invite Code</TableHead>
                          <TableHead className="w-24 text-xs font-black text-[#110e3d]">UID</TableHead>
                          <TableHead className="w-20 text-xs font-black text-[#110e3d]">Members</TableHead>
                          <TableHead className="text-right text-xs font-black text-[#110e3d] w-36">Verified</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adminGroups
                          ?.filter((g) => {
                            const q = groupSearch.toLowerCase();
                            return (
                              !q ||
                              (g.name && g.name.toLowerCase().includes(q)) ||
                              (g.inviteCode && g.inviteCode.toLowerCase().includes(q)) ||
                              String(g.id).includes(q)
                            );
                          })
                          .map((g) => (
                            <TableRow key={g.id} className="border-[#eae8f5] hover:bg-slate-50/50">
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center font-black text-[#6366f1] text-xs shrink-0 overflow-hidden border border-[#eae8f5]">
                                    {g.iconUrl ? (
                                      <img src={g.iconUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      (g.name || "G").charAt(0).toUpperCase()
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-extrabold text-xs text-[#110e3d] truncate flex items-center gap-1">
                                      {g.name || <span className="text-slate-400 italic">Unnamed Group</span>}
                                      {g.isVerified && (
                                        <BadgeCheck className="w-3 h-3 text-blue-500 fill-blue-100 shrink-0" />
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-bold">{g.memberCount} anggota</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-slate-500 font-mono">
                                {g.inviteCode ? (
                                  <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold">/join/{g.inviteCode}</span>
                                ) : (
                                  <span className="text-slate-300 text-[10px]">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-slate-400 font-bold">#{g.id}</TableCell>
                              <TableCell className="text-xs text-slate-600 font-bold">{g.memberCount}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {g.isVerified && (
                                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">Verified</span>
                                  )}
                                  <Switch
                                    id={`group-verified-${g.id}`}
                                    checked={!!g.isVerified}
                                    onCheckedChange={async (checked) => {
                                      try {
                                        await adminUpdateConv.mutateAsync({ id: g.id, data: { isVerified: checked } });
                                        toast({
                                          title: checked ? "Grup diverifikasi" : "Verifikasi dicabut",
                                          description: `${g.name || "Grup"} telah ${checked ? "mendapatkan" : "kehilangan"} centang biru.`,
                                        });
                                        queryClient.invalidateQueries({ queryKey: ["/api/admin/conversations"] });
                                      } catch {
                                        toast({ title: "Gagal", description: "Terjadi kesalahan. Coba lagi.", variant: "destructive" });
                                      }
                                    }}
                                    className="data-[state=checked]:bg-blue-500"
                                    disabled={adminUpdateConv.isPending}
                                  />
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        {adminGroups?.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-xs text-slate-400 py-8">Belum ada grup yang ditemukan.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </Card>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Dialog Modals ── */}
      {/* Dev Dialog */}
      <Dialog open={devDialogOpen} onOpenChange={setDevDialogOpen}>
        <DialogContent className="bg-white border-[#eae8f5] max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6">
          <DialogHeader><DialogTitle className="text-[#110e3d] font-extrabold text-base">{editingDevId ? "Edit Forge Project" : "New Forge Project"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-600">Project Title *</Label><Input value={devForm.title} onChange={(e) => setDevForm({ ...devForm, title: e.target.value })} placeholder="Project name" className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800" /></div>
            <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-600">Description</Label><Textarea value={devForm.description} onChange={(e) => setDevForm({ ...devForm, description: e.target.value })} placeholder="What is this about?" className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs resize-none text-slate-800" rows={3} /></div>
            <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-600">Category</Label><Input value={devForm.category} onChange={(e) => setDevForm({ ...devForm, category: e.target.value })} placeholder="e.g. Gameplay, Economy" className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">Status</Label>
                <Select value={devForm.status} onValueChange={(v) => setDevForm({ ...devForm, status: v as DevStatus })}>
                  <SelectTrigger className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-[#1e1b4b] font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white border border-[#eae8f5] text-slate-700"><SelectItem value="planned">Planned</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="paused">Paused</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-600">Progress % (0–100)</Label><Input type="number" min={0} max={100} value={devForm.progress} onChange={(e) => setDevForm({ ...devForm, progress: e.target.value })} placeholder="e.g. 75" className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800" /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-600">Sort Order</Label><Input type="number" value={devForm.order} onChange={(e) => setDevForm({ ...devForm, order: e.target.value })} placeholder="e.g. 1" className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800" /></div>
          </div>
          <DialogFooter className="gap-2 pt-4 border-t border-slate-50">
            <Button variant="outline" className="border-[#eae8f5] text-slate-600 hover:bg-slate-55 text-xs font-bold rounded-xl h-9 px-5" onClick={() => setDevDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveDev} className="bg-[#6366f1] text-white hover:bg-violet-600 text-xs font-bold rounded-xl h-9 px-5 shadow-md shadow-violet-500/5">{editingDevId ? "Save Changes" : "Create Project"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ann Dialog */}
      <Dialog open={annDialogOpen} onOpenChange={setAnnDialogOpen}>
        <DialogContent className="bg-white border-[#eae8f5] max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6">
          <DialogHeader><DialogTitle className="text-[#110e3d] font-extrabold text-base">{editingAnnId ? "Edit Announcement" : "New Announcement"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-600">Title *</Label><Input value={annForm.title} onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })} placeholder="Announcement title" className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800" /></div>
            <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-600">Content Body</Label><Textarea value={annForm.content} onChange={(e) => setAnnForm({ ...annForm, content: e.target.value })} placeholder="Announcement body…" className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs resize-none text-slate-800" rows={5} /></div>
            {/* Image Upload */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-600">Gambar (opsional)</Label>
              <input
                ref={annImageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAnnImageUpload}
              />
              {annForm.imageUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-[#eae8f5] bg-slate-50">
                  <img
                    src={annForm.imageUrl}
                    alt="Preview"
                    className="w-full max-h-40 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setAnnForm((prev) => ({ ...prev, imageUrl: "" }))}
                    className="absolute top-2 right-2 bg-white/80 hover:bg-white text-slate-600 hover:text-red-500 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow transition-all"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={uploadingAnnImage}
                  onClick={() => annImageInputRef.current?.click()}
                  className="w-full h-24 rounded-xl border-2 border-dashed border-[#eae8f5] bg-slate-50 hover:bg-violet-50 hover:border-violet-300 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer text-slate-400 hover:text-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadingAnnImage ? (
                    <><div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" /><span className="text-xs font-medium">Uploading...</span></>
                  ) : (
                    <><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><span className="text-xs font-medium">Klik untuk upload gambar</span></>
                  )}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">Type</Label>
                <Select value={annForm.type} onValueChange={(v) => setAnnForm({ ...annForm, type: v as AnnType })}>
                  <SelectTrigger className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-[#1e1b4b] font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white border border-[#eae8f5] text-slate-700"><SelectItem value="update">Update</SelectItem><SelectItem value="event">Event</SelectItem><SelectItem value="maintenance">Maintenance</SelectItem><SelectItem value="general">General</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">Pin to top?</Label>
                <Select value={annForm.pinned ? "yes" : "no"} onValueChange={(v) => setAnnForm({ ...annForm, pinned: v === "yes" })}>
                  <SelectTrigger className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-[#1e1b4b] font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white border border-[#eae8f5] text-slate-700"><SelectItem value="no">No</SelectItem><SelectItem value="yes">📌 Pin to top</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4 border-t border-slate-50">
            <Button variant="outline" className="border-[#eae8f5] text-slate-600 hover:bg-slate-55 text-xs font-bold rounded-xl h-9 px-5" onClick={() => setAnnDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveAnn} className="bg-[#6366f1] text-white hover:bg-violet-600 text-xs font-bold rounded-xl h-9 px-5 shadow-md shadow-violet-500/5">{editingAnnId ? "Save Changes" : "Post Announcement"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticket Reason Dialog */}
      <Dialog open={ticketReasonDialogOpen} onOpenChange={setTicketReasonDialogOpen}>
        <DialogContent className="bg-white border-[#eae8f5] max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6">
          <DialogHeader><DialogTitle className="text-[#110e3d] font-extrabold text-base">{editingTicketReasonId ? "Edit Ticket Option" : "New Ticket Option"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Reason Label *</Label>
              <Input value={ticketReasonForm.label} onChange={(e) => setTicketReasonForm({ ...ticketReasonForm, label: e.target.value })} placeholder="Minecraft Account / Player Report" className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Description</Label>
              <Textarea value={ticketReasonForm.description} onChange={(e) => setTicketReasonForm({ ...ticketReasonForm, description: e.target.value })} placeholder="Short prompt shown to user..." className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs resize-none text-slate-800" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">State</Label>
                <Select value={ticketReasonForm.isActive ? "active" : "hidden"} onValueChange={(v) => setTicketReasonForm({ ...ticketReasonForm, isActive: v === "active" })}>
                  <SelectTrigger className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-[#1e1b4b] font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white border border-[#eae8f5] text-slate-700">
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="hidden">Hidden</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">Sort Order</Label>
                <Input type="number" value={ticketReasonForm.order} onChange={(e) => setTicketReasonForm({ ...ticketReasonForm, order: e.target.value })} placeholder="0" className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800" />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4 border-t border-slate-50">
            <Button variant="outline" className="border-[#eae8f5] text-slate-600 hover:bg-slate-55 text-xs font-bold rounded-xl h-9 px-5" onClick={() => setTicketReasonDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTicketReason} className="bg-[#6366f1] text-white hover:bg-violet-600 text-xs font-bold rounded-xl h-9 px-5 shadow-md shadow-violet-500/5">{editingTicketReasonId ? "Save Changes" : "Create Option"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Edit Dialog */}
      <Dialog open={userEditDialogOpen} onOpenChange={setUserEditDialogOpen}>
        <DialogContent className="bg-white border-[#eae8f5] max-w-md rounded-2xl p-6">
          <DialogHeader><DialogTitle className="text-[#110e3d] font-extrabold text-base">Edit Server User</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-600">Username</Label><Input value={userEditForm.username} onChange={(e) => setUserEditForm({ ...userEditForm, username: e.target.value })} className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800" /></div>
            <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-600">Display Name</Label><Input value={userEditForm.displayName} onChange={(e) => setUserEditForm({ ...userEditForm, displayName: e.target.value })} placeholder="Optional name" className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800" /></div>
            <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-600">User Bio</Label><Textarea value={userEditForm.bio} onChange={(e) => setUserEditForm({ ...userEditForm, bio: e.target.value })} placeholder="Tell us who they are..." className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs resize-none text-slate-800" rows={3} /></div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">System Role</Label>
              <Select value={userEditForm.role} onValueChange={(v) => setUserEditForm({ ...userEditForm, role: v as UserRole })}>
                <SelectTrigger className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-[#1e1b4b] font-bold"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white border border-[#eae8f5] text-slate-700">
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="dev">Dev</SelectItem>
                  {canManageDevWebsiteRole && <SelectItem value="dev_website">Dev Website</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <BadgeCheck className="w-4 h-4 text-blue-500" />
                <div>
                  <p className="text-xs font-bold text-blue-800">Verified Account</p>
                  <p className="text-[10px] text-blue-500">Tampilkan centang biru pada profil user</p>
                </div>
              </div>
              <Switch
                checked={userEditForm.isVerified}
                onCheckedChange={(v) => setUserEditForm({ ...userEditForm, isVerified: v })}
                className="data-[state=checked]:bg-blue-500"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4 border-t border-slate-50">
            <Button variant="outline" className="border-[#eae8f5] text-slate-600 hover:bg-slate-55 text-xs font-bold rounded-xl h-9 px-5" onClick={() => setUserEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveUser} disabled={savingUser} className="bg-[#6366f1] text-white hover:bg-violet-600 text-xs font-bold rounded-xl h-9 px-5 shadow-md shadow-violet-500/5">{savingUser ? "Saving User…" : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credit Dialog */}
      <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
        <DialogContent className="bg-white border-[#eae8f5] max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6">
          <DialogHeader><DialogTitle className="text-[#110e3d] font-extrabold text-base">{editingCreditId ? "Edit Credit Card" : "New Credit Card"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Name *</Label>
              <Input value={creditForm.name} onChange={(e) => setCreditForm({ ...creditForm, name: e.target.value })} placeholder="Person/Team name" className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Role Title *</Label>
              <Input value={creditForm.role} onChange={(e) => setCreditForm({ ...creditForm, role: e.target.value })} placeholder="e.g. Founder, Architect" className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800" />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Avatar Photo Link</Label>
              <div className="flex gap-2 items-center">
                <Input value={creditForm.avatarUrl} onChange={(e) => setCreditForm({ ...creditForm, avatarUrl: e.target.value })} placeholder="Image URL or upload file..." className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 flex-1" />
                <input type="file" ref={avatarInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/*" />
                <Button variant="outline" className="border-[#eae8f5] text-xs font-bold shrink-0 rounded-xl h-9 px-4" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar}>
                  {uploadingAvatar ? "..." : "Upload"}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Card Background (Optional)</Label>
              <div className="flex gap-2 items-center">
                <Input value={creditForm.backgroundUrl} onChange={(e) => setCreditForm({ ...creditForm, backgroundUrl: e.target.value })} placeholder="Background URL or upload file..." className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 flex-1" />
                <input type="file" ref={backgroundInputRef} onChange={handleBackgroundUpload} className="hidden" accept="image/*" />
                <Button variant="outline" className="border-[#eae8f5] text-xs font-bold shrink-0 rounded-xl h-9 px-4" onClick={() => backgroundInputRef.current?.click()} disabled={uploadingBackground}>
                  {uploadingBackground ? "..." : "Upload"}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Biography / Description</Label>
              <Textarea value={creditForm.description} onChange={(e) => setCreditForm({ ...creditForm, description: e.target.value })} placeholder="Biography details..." className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs resize-none text-slate-800" rows={3} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Border Style Card Frame *</Label>
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
                      className={`relative flex flex-col items-center justify-between p-2 rounded-xl border transition-all aspect-[3/4] overflow-hidden ${
                        isSelected 
                          ? "border-[#6366f1] bg-violet-50/50 shadow-md shadow-[#6366f1]/10" 
                          : "border-[#eae8f5] bg-slate-50 hover:border-violet-200"
                      }`}
                    >
                      <div className="relative w-full flex-1 flex items-center justify-center min-h-[50px]">
                        <img 
                          src={`/frames/${frameName}.png`} 
                          alt="" 
                          className="absolute inset-0 w-full h-full object-contain pointer-events-none" 
                        />
                        <div className="text-[9px] font-black text-slate-400 z-10 bg-white/80 border border-slate-100 px-1.5 rounded-md">
                          {frameNum}
                        </div>
                      </div>
                      <span className="text-[9px] font-bold mt-1 text-slate-700 truncate w-full text-center">
                        {labels[i]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-600">Sort Order</Label><Input type="number" value={creditForm.order} onChange={(e) => setCreditForm({ ...creditForm, order: e.target.value })} placeholder="e.g. 1" className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800" /></div>
          </div>
          <DialogFooter className="gap-2 pt-4 border-t border-slate-50">
            <Button variant="outline" className="border-[#eae8f5] text-slate-600 hover:bg-slate-55 text-xs font-bold rounded-xl h-9 px-5" onClick={() => setCreditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveCredit} className="bg-[#6366f1] text-white hover:bg-violet-600 text-xs font-bold rounded-xl h-9 px-5 shadow-md shadow-violet-500/5">{editingCreditId ? "Save Changes" : "Create Card"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quest Dialog */}
      <Dialog open={questDialogOpen} onOpenChange={setQuestDialogOpen}>
        <DialogContent className="bg-white border-[#eae8f5] max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-[#110e3d] font-extrabold text-base">
              {editingQuestId !== null ? "Edit Misi/Quest" : "Tambah Misi/Quest"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Judul Misi *</Label>
              <Input 
                value={questForm.title} 
                onChange={(e) => setQuestForm({ ...questForm, title: e.target.value })} 
                placeholder="Contoh: Chatter Pro" 
                className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800" 
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Deskripsi Misi</Label>
              <Textarea 
                value={questForm.desc} 
                onChange={(e) => setQuestForm({ ...questForm, desc: e.target.value })} 
                placeholder="Contoh: Kirim 10 pesan di chat apa saja." 
                className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs resize-none text-slate-800" 
                rows={3} 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">Target Progres</Label>
                <Input 
                  type="number" 
                  min={1} 
                  value={questForm.target} 
                  onChange={(e) => setQuestForm({ ...questForm, target: parseInt(e.target.value) || 1 })} 
                  className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800" 
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">Hadiah (Token 🪙)</Label>
                <Input 
                  type="number" 
                  min={1} 
                  value={questForm.reward} 
                  onChange={(e) => setQuestForm({ ...questForm, reward: parseInt(e.target.value) || 1 })} 
                  className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800" 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Tipe Misi</Label>
              <Select 
                value={questForm.type} 
                onValueChange={(v) => setQuestForm({ ...questForm, type: v as any })}
              >
                <SelectTrigger className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-[#1e1b4b] font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border border-[#eae8f5] text-slate-700">
                  <SelectItem value="chat">💬 Kirim Pesan</SelectItem>
                  <SelectItem value="search">🔍 Cari Obrolan / Teman</SelectItem>
                  <SelectItem value="dm">➕ Mulai DM Baru</SelectItem>
                  <SelectItem value="video">🎥 Tonton Video (YouTube / Twitch / TikTok)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {questForm.type === "video" && (
              <div className="grid grid-cols-3 gap-3 animate-in fade-in-50 duration-200">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">Video URL *</Label>
                  <Input 
                    value={questForm.videoUrl} 
                    onChange={(e) => setQuestForm({ ...questForm, videoUrl: e.target.value })} 
                    placeholder="Contoh: https://www.youtube.com/watch?v=dQw4w9WgXcQ" 
                    className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800" 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">Durasi (detik) *</Label>
                  <Input 
                    type="number"
                    min={5}
                    value={questForm.duration} 
                    onChange={(e) => setQuestForm({ ...questForm, duration: parseInt(e.target.value) || 15 })} 
                    className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800" 
                  />
                </div>
                <p className="col-span-3 text-[10px] text-slate-400 font-semibold leading-relaxed">
                  Bisa menggunakan link YouTube/Twitch/TikTok biasa. Sistem akan mengonversinya secara otomatis.
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 pt-4 border-t border-slate-50">
            <Button 
              variant="outline" 
              className="border-[#eae8f5] text-slate-600 hover:bg-slate-55 text-xs font-bold rounded-xl h-9 px-5" 
              onClick={() => setQuestDialogOpen(false)}
            >
              Batal
            </Button>
            <Button 
              onClick={handleSaveQuest} 
              className="bg-[#6366f1] text-white hover:bg-violet-600 text-xs font-bold rounded-xl h-9 px-5 shadow-md shadow-violet-500/5"
            >
              Simpan Misi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete project confirm dialog */}
      <Dialog open={deletingDevId !== null} onOpenChange={() => setDeletingDevId(null)}>
        <DialogContent className="bg-white border-[#eae8f5] max-w-sm rounded-2xl p-6">
          <DialogHeader><DialogTitle className="text-[#110e3d] font-extrabold text-base">Delete Project?</DialogTitle></DialogHeader>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">This action cannot be undone. This project will be deleted from the database.</p>
          <DialogFooter className="gap-2 pt-4 border-t border-slate-50">
            <Button variant="outline" className="border-[#eae8f5] text-slate-600 hover:bg-slate-55 text-xs font-bold rounded-xl h-9 px-4" onClick={() => setDeletingDevId(null)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl h-9 px-4" onClick={() => deletingDevId && handleDeleteDev(deletingDevId)}>Delete Project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete announcement confirm dialog */}
      <Dialog open={deletingAnnId !== null} onOpenChange={() => setDeletingAnnId(null)}>
        <DialogContent className="bg-white border-[#eae8f5] max-w-sm rounded-2xl p-6">
          <DialogHeader><DialogTitle className="text-[#110e3d] font-extrabold text-base">Delete Announcement?</DialogTitle></DialogHeader>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">This action cannot be undone. This post will be deleted from the database.</p>
          <DialogFooter className="gap-2 pt-4 border-t border-slate-50">
            <Button variant="outline" className="border-[#eae8f5] text-slate-600 hover:bg-slate-55 text-xs font-bold rounded-xl h-9 px-4" onClick={() => setDeletingAnnId(null)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl h-9 px-4" onClick={() => deletingAnnId && handleDeleteAnn(deletingAnnId)}>Delete Post</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete ticket option confirm dialog */}
      <Dialog open={deletingTicketReasonId !== null} onOpenChange={() => setDeletingTicketReasonId(null)}>
        <DialogContent className="bg-white border-[#eae8f5] max-w-sm rounded-2xl p-6">
          <DialogHeader><DialogTitle className="text-[#110e3d] font-extrabold text-base">Delete Ticket Option?</DialogTitle></DialogHeader>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">This option will no longer be visible when members create tickets. This is permanent.</p>
          <DialogFooter className="gap-2 pt-4 border-t border-slate-50">
            <Button variant="outline" className="border-[#eae8f5] text-slate-600 hover:bg-slate-55 text-xs font-bold rounded-xl h-9 px-4" onClick={() => setDeletingTicketReasonId(null)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl h-9 px-4" onClick={() => deletingTicketReasonId && handleDeleteTicketReason(deletingTicketReasonId)}>Delete Option</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete credit contributor confirm dialog */}
      <Dialog open={deletingCreditId !== null} onOpenChange={() => setDeletingCreditId(null)}>
        <DialogContent className="bg-white border-[#eae8f5] max-w-sm rounded-2xl p-6">
          <DialogHeader><DialogTitle className="text-[#110e3d] font-extrabold text-base">Delete Credit Card?</DialogTitle></DialogHeader>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">This card will be deleted from the contributors page.</p>
          <DialogFooter className="gap-2 pt-4 border-t border-slate-50">
            <Button variant="outline" className="border-[#eae8f5] text-slate-600 hover:bg-slate-55 text-xs font-bold rounded-xl h-9 px-4" onClick={() => setDeletingCreditId(null)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl h-9 px-4" onClick={() => deletingCreditId && handleDeleteCredit(deletingCreditId)}>Delete Card</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticket Chat Dialog */}
      <Dialog open={selectedTicketChat !== null} onOpenChange={(open) => { if (!open) setSelectedTicketChat(null); }}>
        <DialogContent className="bg-white border-[#eae8f5] max-w-lg flex flex-col h-[80vh] p-0 overflow-hidden rounded-2xl">
          {selectedTicketChat && (
            <TicketChatContent ticket={selectedTicketChat} onClose={() => setSelectedTicketChat(null)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Create Poll/Form Dialog */}
      <Dialog open={formsDialogOpen} onOpenChange={setFormsDialogOpen}>
        <DialogContent className="bg-white border-[#eae8f5] max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-[#110e3d] font-extrabold text-base">{editingFormId ? "Edit Poll or Form" : "Create Poll or Form"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Title *</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Choose Next Season Theme / Developer Application"
                className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Description</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Details or rules of the vote/form..."
                className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs resize-none text-slate-800"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">Type</Label>
                <Select value={formType} onValueChange={(v) => setFormType(v as "poll" | "form")} disabled={!!editingFormId}>
                  <SelectTrigger className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-[#1e1b4b] font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white border border-[#eae8f5] text-slate-700">
                    <SelectItem value="poll">🗳️ Voting/Poll</SelectItem>
                    <SelectItem value="form">📋 Survey/Form</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">Deadline (Optional)</Label>
                <Input
                  type="date"
                  value={formDeadline}
                  onChange={(e) => setFormDeadline(e.target.value)}
                  className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-700 font-bold"
                />
              </div>
            </div>

            {/* Poll Configuration options list */}
            {formType === "poll" && (
              <div className="space-y-2.5 border-t border-slate-100 pt-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-extrabold text-xs text-[#110e3d] uppercase tracking-wider">Poll Choices</h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-violet-600 hover:text-indigo-800 text-[10px] font-bold h-7"
                    onClick={() => setPollOptions([...pollOptions, { label: "" }])}
                  >
                    + Add Choice
                  </Button>
                </div>
                <div className="space-y-2">
                  {pollOptions.map((opt, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        value={opt.label}
                        onChange={(e) => {
                          const copy = [...pollOptions];
                          copy[idx] = { ...copy[idx], label: e.target.value };
                          setPollOptions(copy);
                        }}
                        placeholder={`Choice #${idx + 1}`}
                        className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 flex-1 text-slate-800"
                      />
                      {pollOptions.length > 2 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:bg-red-50 hover:text-red-700 text-xs shrink-0 rounded-lg w-7 h-7 p-0"
                          onClick={() => {
                            const copy = [...pollOptions];
                            copy.splice(idx, 1);
                            setPollOptions(copy);
                          }}
                        >
                          ✕
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Form Fields configuration list */}
            {formType === "form" && (
              <div className="space-y-3.5 border-t border-slate-100 pt-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-extrabold text-xs text-[#110e3d] uppercase tracking-wider">Form Questions</h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-violet-600 hover:text-indigo-800 text-[10px] font-bold h-7"
                    onClick={() => setFormFields([...formFields, { label: "", fieldType: "text", options: "", required: false }])}
                  >
                    + Add Question
                  </Button>
                </div>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {formFields.map((field, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-xl relative space-y-2">
                      <div className="absolute top-2 right-2 flex items-center gap-2">
                        {formFields.length > 1 && (
                          <button
                            type="button"
                            className="text-red-400 hover:text-red-600 text-xs"
                            onClick={() => {
                              const copy = [...formFields];
                              copy.splice(idx, 1);
                              setFormFields(copy);
                            }}
                          >
                            ✕ Remove
                          </button>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-slate-500">Question / Field Name *</Label>
                        <Input
                          value={field.label}
                          onChange={(e) => {
                            const copy = [...formFields];
                            copy[idx].label = e.target.value;
                            setFormFields(copy);
                          }}
                          placeholder="e.g. Why do you want to join staff?"
                          className="bg-white border-[#eae8f5] rounded-xl text-xs h-8 text-slate-800"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px] font-bold text-slate-500">Response Type</Label>
                          <Select
                            value={field.fieldType}
                            onValueChange={(v) => {
                              const copy = [...formFields];
                              copy[idx].fieldType = v as any;
                              setFormFields(copy);
                            }}
                          >
                            <SelectTrigger className="bg-white border-[#eae8f5] rounded-xl text-[11px] h-8 text-slate-700 font-semibold"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-white border border-slate-100 text-slate-700">
                              <SelectItem value="text">Short Answer (Text)</SelectItem>
                              <SelectItem value="textarea">Paragraph (Textarea)</SelectItem>
                              <SelectItem value="radio">Multiple Choice (Radio)</SelectItem>
                              <SelectItem value="select">Dropdown Menu (Select)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-1.5 pl-2 pt-4">
                          <input
                            type="checkbox"
                            id={`req-${idx}`}
                            checked={field.required}
                            onChange={(e) => {
                              const copy = [...formFields];
                              copy[idx].required = e.target.checked;
                              setFormFields(copy);
                            }}
                            className="w-3.5 h-3.5 text-violet-600 border-slate-300 rounded focus:ring-violet-500"
                          />
                          <Label htmlFor={`req-${idx}`} className="text-[10px] font-bold text-slate-600 cursor-pointer">Required?</Label>
                        </div>
                      </div>
                      {(field.fieldType === "radio" || field.fieldType === "select") && (
                        <div className="space-y-2.5">
                          <div className="flex justify-between items-center">
                            <Label className="text-[10px] font-bold text-slate-500">Choices / Options *</Label>
                            <Button
                              size="sm"
                              variant="ghost"
                              type="button"
                              className="text-violet-600 hover:text-indigo-800 text-[10px] font-bold h-7 px-1"
                              onClick={() => {
                                const choices = getFieldChoices(field.options);
                                const updatedChoices = [...choices, ""];
                                const copy = [...formFields];
                                copy[idx].options = updatedChoices.join(", ");
                                setFormFields(copy);
                              }}
                            >
                              + Add Option
                            </Button>
                          </div>
                          <div className="space-y-2">
                            {getFieldChoices(field.options).map((choiceVal, choiceIdx, arr) => (
                              <div key={choiceIdx} className="flex gap-2 items-center">
                                <Input
                                  value={choiceVal}
                                  onChange={(e) => {
                                    const choices = [...arr];
                                    choices[choiceIdx] = e.target.value;
                                    const copy = [...formFields];
                                    copy[idx].options = choices.join(", ");
                                    setFormFields(copy);
                                  }}
                                  placeholder={`Option #${choiceIdx + 1}`}
                                  className="bg-white border-[#eae8f5] rounded-xl text-xs h-8 flex-1 text-slate-800"
                                />
                                {arr.length > 1 && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    type="button"
                                    className="text-red-500 hover:bg-red-50 hover:text-red-700 text-xs shrink-0 rounded-lg w-7 h-7 p-0"
                                    onClick={() => {
                                      const choices = [...arr];
                                      choices.splice(choiceIdx, 1);
                                      const copy = [...formFields];
                                      copy[idx].options = choices.join(", ");
                                      setFormFields(copy);
                                    }}
                                  >
                                    ✕
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 pt-4 border-t border-slate-50">
            <Button variant="outline" className="border-[#eae8f5] text-slate-600 hover:bg-slate-55 text-xs font-bold rounded-xl h-9 px-5" onClick={() => setFormsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveForm} className="bg-[#6366f1] text-white hover:bg-violet-600 text-xs font-bold rounded-xl h-9 px-5 shadow-md shadow-violet-500/5">{editingFormId ? "Save Changes" : "Launch Form"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Form confirm dialog */}
      <Dialog open={deletingFormId !== null} onOpenChange={() => setDeletingFormId(null)}>
        <DialogContent className="bg-white border-[#eae8f5] max-w-sm rounded-2xl p-6">
          <DialogHeader><DialogTitle className="text-[#110e3d] font-extrabold text-base">Delete Form?</DialogTitle></DialogHeader>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">This action cannot be undone. All responses and data associated with this form will be deleted.</p>
          <DialogFooter className="gap-2 pt-4 border-t border-slate-50">
            <Button variant="outline" className="border-[#eae8f5] text-slate-600 hover:bg-slate-55 text-xs font-bold rounded-xl h-9 px-4" onClick={() => setDeletingFormId(null)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl h-9 px-4" onClick={() => deletingFormId && handleDeleteForm(deletingFormId)}>Delete Form</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form Responses Dialog */}
      <Dialog open={selectedFormResponses !== null} onOpenChange={(open) => { if (!open) setSelectedFormResponses(null); }}>
        <DialogContent className="bg-white border-[#eae8f5] max-w-lg flex flex-col max-h-[80vh] p-0 overflow-hidden rounded-2xl">
          {selectedFormResponses && (
            <FormResponsesContent form={selectedFormResponses} onClose={() => setSelectedFormResponses(null)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Cosmetic Registry Dialog (Create/Edit) */}
      <Dialog open={cosmeticDialogOpen} onOpenChange={setCosmeticDialogOpen}>
        <DialogContent className="bg-white border-[#eae8f5] max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-[#110e3d] font-extrabold text-base">
              {editingCosmeticId ? "Edit Cosmetic reward" : "Register New Cosmetic Reward"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Cosmetic Item Name *</Label>
              <Input
                value={cosmeticForm.name}
                onChange={(e) => setCosmeticForm({ ...cosmeticForm, name: e.target.value })}
                placeholder="e.g. Golden Aura, Rich Citizen"
                className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">Type</Label>
                <Select
                  value={cosmeticForm.type}
                  onValueChange={(v: any) => setCosmeticForm({ ...cosmeticForm, type: v })}
                >
                  <SelectTrigger className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-[#1e1b4b] font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-[#eae8f5] text-slate-700">
                    <SelectItem value="border">Avatar Border</SelectItem>
                    <SelectItem value="badge">Profile Badge</SelectItem>
                    <SelectItem value="background">Member Backdrop Card</SelectItem>
                    <SelectItem value="premium">Premium Membership Days</SelectItem>
                    <SelectItem value="premium_plus">Premium+ Membership Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">Gacha Odds Rarity Tier</Label>
                <Select
                  value={cosmeticForm.rarity}
                  onValueChange={(v: any) => setCosmeticForm({ ...cosmeticForm, rarity: v })}
                >
                  <SelectTrigger className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-[#1e1b4b] font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-[#eae8f5] text-slate-700">
                    <SelectItem value="S">S Tier (Legendary Gold)</SelectItem>
                    <SelectItem value="A">A Tier (Purple Epic)</SelectItem>
                    <SelectItem value="B">B Tier (Blue Rare)</SelectItem>
                    <SelectItem value="C">C Tier (Green Uncommon)</SelectItem>
                    <SelectItem value="D">D Tier (Grey Common)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">Harga Token (🪙)</Label>
                <Input
                  type="number"
                  min={0}
                  value={cosmeticForm.price}
                  onChange={(e) => setCosmeticForm({ ...cosmeticForm, price: parseInt(e.target.value) || 0 })}
                  className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800"
                />
              </div>
              <div className="space-y-3 flex flex-col justify-center">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">Tampilkan di Gacha</span>
                  <Switch
                    checked={cosmeticForm.isGacha}
                    onCheckedChange={(checked) => setCosmeticForm({ ...cosmeticForm, isGacha: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">Tampilkan di Toko (Shop)</span>
                  <Switch
                    checked={cosmeticForm.isShop}
                    onCheckedChange={(checked) => setCosmeticForm({ ...cosmeticForm, isShop: checked })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Value (CSS class or Image URL) *</Label>
              <Input
                value={cosmeticForm.value}
                onChange={(e) => setCosmeticForm({ ...cosmeticForm, value: e.target.value })}
                placeholder={
                  cosmeticForm.type === "border"
                    ? "e.g. gacha-border-golden-aura"
                    : cosmeticForm.type === "background"
                    ? "e.g. https://images.unsplash.com/..."
                    : (cosmeticForm.type === "premium" || cosmeticForm.type === "premium_plus")
                    ? "Jumlah hari langganan (misal: 30)"
                    : "e.g. bg-gradient-to-r from-red-500 to-amber-500 text-white"
                }
                className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800 font-mono"
              />
              <p className="text-[9px] text-slate-400 font-semibold leading-relaxed">
                {cosmeticForm.type === "border" && "This key will trigger the specific CSS glow animations around avatar elements in message chats and menus."}
                {cosmeticForm.type === "background" && "Must be a direct valid Image URL path to render behind player profile layouts."}
                {cosmeticForm.type === "badge" && "Standard TailwindCSS utility classes defining gradients, font styling, and border details."}
                {(cosmeticForm.type === "premium" || cosmeticForm.type === "premium_plus") && "Masukkan jumlah hari durasi Premium/Premium+ yang akan didapatkan saat dibeli (contoh: 7, 30, 90)."}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Description</Label>
              <Textarea
                value={cosmeticForm.description}
                onChange={(e) => setCosmeticForm({ ...cosmeticForm, description: e.target.value })}
                placeholder="Give details about how this reward is earned or its special properties..."
                className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs resize-none text-slate-800"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4 border-t border-slate-50">
            <Button variant="outline" className="border-[#eae8f5] text-slate-600 hover:bg-slate-55 text-xs font-bold rounded-xl h-9 px-5" onClick={() => setCosmeticDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveCosmetic} className="bg-[#6366f1] text-white hover:bg-violet-600 text-xs font-bold rounded-xl h-9 px-5 shadow-md shadow-violet-500/5">
              {editingCosmeticId ? "Save Changes" : "Register Cosmetic"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Cosmetic confirmation dialog */}
      <Dialog open={deletingCosmeticId !== null} onOpenChange={() => setDeletingCosmeticId(null)}>
        <DialogContent className="bg-white border-[#eae8f5] max-w-sm rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-[#110e3d] font-extrabold text-base">Unregister Cosmetic Reward?</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">
            Are you sure you want to delete this cosmetic item? This will permanently remove it from the active Gacha Royale spin pool registry.
          </p>
          <DialogFooter className="gap-2 pt-4 border-t border-slate-50">
            <Button variant="outline" className="border-[#eae8f5] text-slate-600 hover:bg-slate-55 text-xs font-bold rounded-xl h-9 px-4" onClick={() => setDeletingCosmeticId(null)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl h-9 px-4" onClick={() => deletingCosmeticId && handleDeleteCosmetic(deletingCosmeticId)}>Delete Cosmetic</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Wallet balance dialog */}
      <Dialog open={walletDialogOpen} onOpenChange={setWalletDialogOpen}>
        <DialogContent className="bg-white border-[#eae8f5] max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-[#110e3d] font-extrabold text-base">
              Calibrate Wallet: {walletTargetUser?.displayName || walletTargetUser?.username}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 p-3 bg-slate-50 border border-[#eae8f5] rounded-xl shadow-sm">
              <Avatar className="w-10 h-10 border border-[#eae8f5]">
                <AvatarImage src={walletTargetUser?.avatarUrl || undefined} />
                <AvatarFallback className="text-xs font-bold bg-[#6366f1] text-white">
                  {walletTargetUser ? getInitials(walletTargetUser.displayName || walletTargetUser.username) : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-[#110e3d] truncate">{walletTargetUser?.displayName || walletTargetUser?.username}</p>
                <p className="text-[10px] text-slate-400 font-bold">Current Balance: <span className="text-sky-500">💎 {walletTargetUser?.diamonds?.toLocaleString() ?? 0}</span></p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Adjustment Amount (Diamonds) *</Label>
              <Input
                type="number"
                value={walletAdjustmentAmount}
                onChange={(e) => setWalletAdjustmentAmount(e.target.value)}
                placeholder="e.g. 1000 to credit, -500 to debit"
                className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800"
              />
              <p className="text-[9px] text-slate-400 font-semibold leading-relaxed">
                Use positive integers to add diamond credits to their wallet balance, or negative numbers to subtract/charge diamonds.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Audit / Adjust Reason</Label>
              <Input
                value={walletAdjustmentReason}
                onChange={(e) => setWalletAdjustmentReason(e.target.value)}
                placeholder="e.g. Reward for roleplay event winner, Refund for duplicate glitch"
                className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-4 border-t border-slate-50">
            <Button variant="outline" className="border-[#eae8f5] text-slate-600 hover:bg-slate-55 text-xs font-bold rounded-xl h-9 px-5" onClick={() => setWalletDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveWalletAdjustment} className="bg-[#6366f1] text-white hover:bg-violet-600 text-xs font-bold rounded-xl h-9 px-5 shadow-md shadow-violet-500/5">
              Confirm Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </div>
  );
}

function FormResponsesContent({ form, onClose }: { form: any; onClose: () => void }) {
  const { data: result, isLoading } = useListFormResponses(form.id);
  const totalVotes = result?.pollResults?.reduce((sum: number, opt: any) => sum + opt.count, 0) || 0;

  return (
    <>
      <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-100 bg-white shrink-0">
        <DialogTitle className="text-[#110e3d] font-extrabold text-base">
          Responses: {form.title}
        </DialogTitle>
        <p className="text-[10px] text-slate-400 font-bold mt-0.5">
          Type: {form.type === "poll" ? "🗳️ Voting/Poll" : "📋 Form Survey"} • Total Submissions: {form.responseCount}
        </p>
      </DialogHeader>

      <ScrollArea className="flex-1 p-5 bg-slate-50/50 max-h-[60vh] overflow-y-auto">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ) : form.type === "poll" ? (
          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Vote Distribution</h4>
            {(result?.pollResults ?? []).map((opt: any) => {
              const pct = totalVotes > 0 ? Math.round((opt.count / totalVotes) * 100) : 0;
              return (
                <div key={opt.optionId} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>{opt.label}</span>
                    <span>{opt.count} votes ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-[#6366f1]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            
            <div className="border-t border-slate-100 pt-4 mt-6">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2.5">Voters Log</h4>
              {(result?.responses ?? []).length === 0 ? (
                <p className="text-xs text-slate-400 font-semibold italic">No votes cast yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 bg-white border border-[#eae8f5] rounded-xl overflow-hidden shadow-sm">
                  {(result?.responses ?? []).map((resp: any) => (
                    <div key={resp.id} className="flex justify-between items-center p-3 text-xs">
                      <div>
                        <span className="font-extrabold text-[#110e3d]">{resp.displayName || resp.username}</span>
                        <span className="text-slate-400 font-bold ml-1.5">@{resp.username}</span>
                        {resp.mcUsername && <span className="text-emerald-500 font-bold ml-1.5 font-mono">🎮 {resp.mcUsername}</span>}
                      </div>
                      <span className="bg-violet-50 text-[#6366f1] border border-violet-100 font-bold px-2.5 py-0.5 rounded-lg text-[10px]">
                        {resp.selectedOptionLabel}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Submissions Feed</h4>
            {(result?.responses ?? []).length === 0 ? (
              <p className="text-xs text-slate-400 font-semibold italic">No submissions yet.</p>
            ) : (
              <div className="space-y-3">
                {(result?.responses ?? []).map((resp: any) => (
                  <div key={resp.id} className="bg-white border border-[#eae8f5] rounded-xl p-4 shadow-sm space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-50 pb-2.5">
                      <div>
                        <span className="font-extrabold text-sm text-[#110e3d]">{resp.displayName || resp.username}</span>
                        <span className="text-slate-400 font-bold text-xs ml-1.5">@{resp.username}</span>
                        {resp.mcUsername && <span className="text-emerald-500 font-bold text-xs ml-1.5 font-mono">🎮 {resp.mcUsername}</span>}
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold">
                        {format(new Date(resp.createdAt), "dd MMM HH:mm")}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {resp.answers?.map((ans: any, idx: number) => (
                        <div key={idx} className="text-xs">
                          <p className="text-slate-400 font-bold mb-0.5">{ans.fieldLabel}</p>
                          <p className="text-slate-700 font-semibold whitespace-pre-wrap leading-relaxed">{ans.value || "(blank)"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t border-slate-100 bg-white shrink-0 flex justify-end">
        <Button onClick={onClose} className="bg-slate-100 hover:bg-slate-200 border border-[#eae8f5] text-slate-700 text-xs font-bold rounded-xl h-9 px-4">
          Close Responses
        </Button>
      </div>
    </>
  );
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
      const msg = err instanceof Error ? err.message : "Failed to send message.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  return (
    <>
      <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-100 bg-white">
        <div className="flex justify-between items-start gap-4 flex-wrap">
          <div>
            <DialogTitle className="text-[#110e3d] font-extrabold text-base">
              #{ticket.id} - {ticket.reason}
            </DialogTitle>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
              Created: {format(new Date(ticket.createdAt), "dd MMM yyyy, HH:mm")}
            </p>
          </div>
          <span className={`text-[9px] px-2 py-0.5 rounded-lg font-black uppercase tracking-wider border ${
            ticket.status === "open"
              ? "bg-red-50 text-red-700 border-red-100"
              : ticket.status === "in_progress"
              ? "bg-blue-50 text-blue-700 border-blue-100"
              : ticket.status === "resolved"
              ? "bg-emerald-50 text-emerald-600 border-emerald-100"
              : "bg-slate-50 text-slate-500 border-slate-100"
          }`}>
            {ticket.status === "open" && "Open"}
            {ticket.status === "in_progress" && "In Progress"}
            {ticket.status === "resolved" && "Resolved"}
            {ticket.status === "closed" && "Closed"}
          </span>
        </div>
      </DialogHeader>

      <ScrollArea className="flex-1 p-4 bg-slate-50/50">
        <div className="space-y-4">
          {/* Main Description */}
          <div className="bg-white border border-[#eae8f5] p-3.5 rounded-xl shadow-sm">
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Original Description</p>
            <p className="text-xs text-slate-600 font-semibold whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
          </div>

          <div className="border-t border-slate-100 my-4" />

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-3/4 rounded-2xl" />
              <Skeleton className="h-10 w-2/3 rounded-2xl ml-auto" />
              <Skeleton className="h-10 w-1/2 rounded-2xl" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-[11px] text-slate-400 font-bold bg-white/50 border border-dashed border-[#eae8f5] rounded-xl">
              No chat history. Message the user below.
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg: any) => {
                const isCreator = msg.senderId === ticket.creatorId;

                return (
                  <div key={msg.id} className={`flex gap-2.5 ${isCreator ? "" : "flex-row-reverse"}`}>
                    <Avatar className="w-6 h-6 shrink-0 mt-0.5 border border-slate-100">
                      <AvatarImage src={msg.senderAvatarUrl ?? undefined} />
                      <AvatarFallback className="text-[9px] bg-slate-100 font-bold text-[#6366f1]">{getInitials(msg.senderDisplayName || msg.senderUsername)}</AvatarFallback>
                    </Avatar>
                    <div className={`max-w-[75%] flex flex-col gap-0.5 ${isCreator ? "items-start" : "items-end"}`}>
                      <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold">
                        <span className="text-slate-600">{msg.senderDisplayName || msg.senderUsername}</span>
                        <span>{format(new Date(msg.createdAt), "HH:mm")}</span>
                      </div>
                      <div className={`rounded-xl px-3 py-2 text-xs leading-relaxed font-semibold shadow-sm ${
                        isCreator
                          ? "bg-white border border-[#eae8f5] text-slate-700 rounded-tl-none"
                          : "bg-[#6366f1] text-white rounded-tr-none"
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

      <div className="p-3 border-t border-slate-100 bg-white">
        <div className="flex gap-2">
          <Input
            placeholder={ticket.status === "closed" || ticket.status === "resolved" ? "Ticket closed..." : "Type a message..."}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            disabled={ticket.status === "closed" || ticket.status === "resolved"}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendReply();
              }
            }}
            className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-700 font-semibold"
          />
          <Button
            onClick={handleSendReply}
            disabled={!replyText.trim() || ticket.status === "closed" || ticket.status === "resolved" || sendMessage.isPending}
            className="bg-[#6366f1] text-white hover:bg-indigo-700 font-extrabold text-xs px-4 rounded-xl shadow-md shadow-violet-500/5 h-9"
          >
            Send
          </Button>
        </div>
      </div>
    </>
  );
}
