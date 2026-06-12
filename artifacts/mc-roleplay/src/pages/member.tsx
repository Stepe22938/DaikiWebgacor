import { useState, useRef, useEffect } from "react";
import { useGetMe, useUpdateMe, useListAnnouncements, useListDevelopments, useGetMySettings, useUpdateMySettings, useListTickets, useCreateTicket, useUpdateTicket, useListTicketMessages, useSendTicketMessage, getListTicketMessagesQueryOptions, useListForms, useGetForm, useSubmitVote, useSubmitForm, useGetMyFormResponse, customFetch, useListCredits, useListTicketReasons, useListSwitchableUsers, useGetGachaBoard, useClaimDiamonds, useSpinGacha, useListOwnedCosmetics, useEquipCosmetic, useListWalletTransactions } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUser, useClerk, UserProfile } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Settings,
  Wallet,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  Cell
} from "recharts";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Member() {
  const { data: user, isLoading: userLoading } = useGetMe();
  const { user: clerkUser } = useUser();
  const { data: announcements, isLoading: announcementsLoading } = useListAnnouncements();
  const { data: developments, isLoading: developmentsLoading } = useListDevelopments();
  const updateMe = useUpdateMe();
  const { data: settings } = useGetMySettings();
  const { data: realmSettings = {} } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: () => customFetch<any>("/api/settings"),
  });
  const updateSettings = useUpdateMySettings();
  const { data: tickets = [], isLoading: ticketsLoading } = useListTickets();
  const { data: ticketReasons = [], isLoading: ticketReasonsLoading } = useListTicketReasons();
  const createTicket = useCreateTicket();
  const updateTicket = useUpdateTicket();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const realmName = realmSettings.realmName || "Arcadia Guild";
  const realmLogoUrl = realmSettings.realmLogoUrl || "";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && ["dashboard", "announcements", "developments", "tickets", "forms", "profile", "credits", "settings", "gacha", "wallet"].includes(tab)) {
      setActiveTab(tab);
    } else if (!tab) {
      setActiveTab("dashboard");
    }
  }, [window.location.search]);

  const handleTabChange = (tabName: string) => {
    setActiveTab(tabName);
    setLocation(`/member?tab=${tabName}`);
  };

  const handleTabChangeMobile = (tabName: string) => {
    setActiveTab(tabName);
    setLocation(`/member?tab=${tabName}`);
    setMobileSidebarOpen(false);
  };

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

  const handleCopyIP = () => {
    navigator.clipboard.writeText("play.arcadiamc.net");
    setCopied(true);
    toast({ title: "Copied!", description: "IP copied to clipboard: play.arcadiamc.net" });
    setTimeout(() => setCopied(false), 2000);
  };

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

  const { signOut } = useClerk();

  if (userLoading) {
    return (
      <div className="p-8 text-slate-500 font-bold bg-[#f4f3f8] min-h-screen flex items-center justify-center">
        Loading Guild Portal...
      </div>
    );
  }

  // Calculate actual counts for member dashboard widgets:
  const activeRoadmapCount = developments ? developments.filter(d => d.status === "planned" || d.status === "in_progress").length : 0;
  const myOpenTicketsCount = tickets ? tickets.filter(t => t.status === "open" || t.status === "in_progress").length : 0;
  const announcementsCount = announcements ? announcements.length : 0;

  // Chart data calculations
  const devStatusCounts = developments ? {
    planned: developments.filter(d => d.status === "planned").length,
    in_progress: developments.filter(d => d.status === "in_progress").length,
    completed: developments.filter(d => d.status === "completed").length,
    paused: developments.filter(d => d.status === "paused").length,
  } : { planned: 0, in_progress: 0, completed: 0, paused: 0 };

  const devChartData = [
    { name: "Planned", count: devStatusCounts.planned, color: "#818cf8" },
    { name: "In Progress", count: devStatusCounts.in_progress, color: "#fbbf24" },
    { name: "Completed", count: devStatusCounts.completed, color: "#34d399" },
    { name: "Paused", count: devStatusCounts.paused, color: "#9ca3af" },
  ];

  const recentAnnouncements = announcements ? announcements.slice(0, 2) : [];

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
                <button
                  onClick={() => handleTabChange("dashboard")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "dashboard"
                      ? "bg-violet-50 text-[#6366f1]"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <LayoutGrid className="w-4.5 h-4.5" /> Dashboard
                </button>
                <button
                  onClick={() => handleTabChange("announcements")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "announcements"
                      ? "bg-violet-50 text-[#6366f1]"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Megaphone className="w-4.5 h-4.5" /> Town Crier
                </button>
                <button
                  onClick={() => handleTabChange("developments")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "developments"
                      ? "bg-violet-50 text-[#6366f1]"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Hammer className="w-4.5 h-4.5" /> The Forge
                </button>
                <button
                  onClick={() => handleTabChange("tickets")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "tickets"
                      ? "bg-violet-50 text-[#6366f1]"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Ticket className="w-4.5 h-4.5" /> Support Tickets
                </button>
                <button
                  onClick={() => handleTabChange("forms")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "forms"
                      ? "bg-violet-50 text-[#6366f1]"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <ClipboardList className="w-4.5 h-4.5" /> Voting & Forms
                </button>
                <button
                  onClick={() => handleTabChange("gacha")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "gacha"
                      ? "bg-violet-50 text-[#6366f1]"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Sparkles className="w-4.5 h-4.5 text-amber-500" /> Gacha Royale
                </button>
                <button
                  onClick={() => handleTabChange("wallet")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "wallet"
                      ? "bg-violet-50 text-[#6366f1]"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Wallet className="w-4.5 h-4.5 text-emerald-500" /> My Wallet
                </button>
              </nav>
            </div>

            <div className="space-y-1.5">
              <span className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest block">Social</span>
              <nav className="space-y-1">
                <Link
                  href="/"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                >
                  <Home className="w-4.5 h-4.5" /> Home Page
                </Link>
                <Link
                  href="/messages"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                >
                  <MessageSquare className="w-4.5 h-4.5" /> Messages
                </Link>
                <Link
                  href="/friends"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                >
                  <Users className="w-4.5 h-4.5" /> Guilds
                </Link>
              </nav>
            </div>

            {user?.role && ["admin", "staff", "dev", "dev_website"].includes(user.role) && (
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

            <div className="space-y-1.5">
              <span className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest block">Account</span>
              <nav className="space-y-1">
                <button
                  onClick={() => handleTabChange("profile")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "profile"
                      ? "bg-violet-50 text-[#6366f1]"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <User className="w-4.5 h-4.5" /> My Profile
                </button>
                <button
                  onClick={() => handleTabChange("settings")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "settings"
                      ? "bg-violet-50 text-[#6366f1]"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Settings className="w-4.5 h-4.5" /> Account Settings
                </button>
                <button
                  onClick={() => handleTabChange("credits")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "credits"
                      ? "bg-violet-50 text-[#6366f1]"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <ShieldAlert className="w-4.5 h-4.5" /> Arcadia Credits
                </button>
              </nav>
            </div>
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
              <p className="text-[10px] text-slate-400 font-bold capitalize">{user?.role?.replace('_', ' ') || "Member"}</p>
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
                <button
                  onClick={() => handleTabChangeMobile("dashboard")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "dashboard" ? "bg-violet-50 text-[#6366f1]" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <LayoutGrid className="w-4.5 h-4.5" /> Dashboard
                </button>
                <button
                  onClick={() => handleTabChangeMobile("announcements")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "announcements" ? "bg-violet-50 text-[#6366f1]" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <Megaphone className="w-4.5 h-4.5" /> Town Crier
                </button>
                <button
                  onClick={() => handleTabChangeMobile("developments")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "developments" ? "bg-violet-50 text-[#6366f1]" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <Hammer className="w-4.5 h-4.5" /> The Forge
                </button>
                <button
                  onClick={() => handleTabChangeMobile("tickets")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "tickets" ? "bg-violet-50 text-[#6366f1]" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <Ticket className="w-4.5 h-4.5" /> Support Tickets
                </button>
                <button
                  onClick={() => handleTabChangeMobile("forms")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "forms" ? "bg-violet-50 text-[#6366f1]" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <ClipboardList className="w-4.5 h-4.5" /> Voting & Forms
                </button>
                <button
                  onClick={() => handleTabChangeMobile("gacha")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "gacha" ? "bg-violet-50 text-[#6366f1]" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <Sparkles className="w-4.5 h-4.5 text-amber-500" /> Gacha Royale
                </button>
                <button
                  onClick={() => handleTabChangeMobile("wallet")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "wallet" ? "bg-violet-50 text-[#6366f1]" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <Wallet className="w-4.5 h-4.5 text-emerald-500" /> My Wallet
                </button>

                <div className="py-2 border-t border-[#eae8f5] my-2">
                  <span className="px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Social</span>
                  <Link
                    href="/"
                    onClick={() => setMobileSidebarOpen(false)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  >
                    <Home className="w-4.5 h-4.5" /> Home Page
                  </Link>
                  <Link
                    href="/messages"
                    onClick={() => setMobileSidebarOpen(false)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  >
                    <MessageSquare className="w-4.5 h-4.5" /> Messages
                  </Link>
                  <Link
                    href="/friends"
                    onClick={() => setMobileSidebarOpen(false)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  >
                    <Users className="w-4.5 h-4.5" /> Guilds
                  </Link>
                </div>

                {user?.role && ["admin", "staff", "dev", "dev_website"].includes(user.role) && (
                  <div className="py-2 border-t border-[#eae8f5] my-2">
                    <span className="px-3 text-[9px] font-black text-amber-600 uppercase tracking-widest block mb-1">Management</span>
                    <Link
                      href="/admin"
                      onClick={() => setMobileSidebarOpen(false)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-amber-600 hover:bg-amber-50 hover:text-amber-700 border border-amber-200/30 bg-amber-50/10"
                    >
                      <ShieldAlert className="w-4.5 h-4.5 text-amber-500" /> Admin Portal
                    </Link>
                  </div>
                )}

                <div className="py-2 border-t border-[#eae8f5] my-2">
                  <span className="px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Account</span>
                  <button
                    onClick={() => handleTabChangeMobile("profile")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === "profile" ? "bg-violet-50 text-[#6366f1]" : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <User className="w-4.5 h-4.5" /> My Profile
                  </button>
                  <button
                    onClick={() => handleTabChangeMobile("settings")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === "settings" ? "bg-violet-50 text-[#6366f1]" : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <Settings className="w-4.5 h-4.5" /> Account Settings
                  </button>
                  <button
                    onClick={() => handleTabChangeMobile("credits")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === "credits" ? "bg-violet-50 text-[#6366f1]" : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <ShieldAlert className="w-4.5 h-4.5" /> Arcadia Credits
                  </button>
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
              <span className="text-[#110e3d] capitalize">
                {activeTab === "dashboard" ? "Dashboard" : activeTab === "announcements" ? "Town Crier" : activeTab === "developments" ? "The Forge" : activeTab === "tickets" ? "Support Tickets" : activeTab === "forms" ? "Voting & Forms" : activeTab === "profile" ? "My Profile" : activeTab === "settings" ? "Account Settings" : activeTab === "gacha" ? "Gacha Royale" : activeTab === "wallet" ? "My Wallet" : "Arcadia Credits"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Copy server IP widget */}
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
            {["admin", "staff", "dev", "dev_website"].includes(user?.role ?? "") && (
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
        <div className="flex-1 p-6 md:p-8 max-w-6xl w-full mx-auto space-y-6">
          {/* Dashboard Tab Overview */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              {/* Premium Welcome Banner */}
              <div className="relative rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-6 md:p-8 text-white overflow-hidden shadow-lg shadow-indigo-500/10">
                <div className="absolute right-0 top-0 w-1/3 h-full opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white to-transparent" />
                <div className="relative z-10 space-y-2 max-w-xl">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-xs font-bold backdrop-blur-sm">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300 animate-bounce" /> Season II: Rise of the Guilds
                  </div>
                  <h1 className="text-2xl md:text-3xl font-black tracking-tight">Rise of the Guilds is Live!</h1>
                  <p className="text-xs md:text-sm text-indigo-100 font-semibold leading-relaxed">
                    Connect to <strong className="text-white">play.arcadiamc.net</strong> to build your town, forge your legacy, and climb the guild ranks. Let's write history together!
                  </p>
                </div>
              </div>

              {/* Overview Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Guild Citizen</span>
                      <h3 className="text-base font-extrabold text-[#110e3d] mt-1 truncate max-w-[150px]">{user?.displayName || user?.username}</h3>
                      <span className="text-[10px] text-[#6366f1] font-bold mt-0.5 block">{user?.userTag || "@citizen"}</span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-[#6366f1]">
                      <User className="w-5 h-5" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Forge Items</span>
                      <h3 className="text-2xl font-black text-[#110e3d] mt-1">{activeRoadmapCount}</h3>
                      <span className="text-[10px] text-slate-400 font-bold mt-0.5 block">Active Roadmap Updates</span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
                      <Hammer className="w-5 h-5" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Tickets</span>
                      <h3 className="text-2xl font-black text-[#110e3d] mt-1">{myOpenTicketsCount}</h3>
                      <span className="text-[10px] text-slate-400 font-bold mt-0.5 block">My Help Desk Requests</span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                      <Ticket className="w-5 h-5" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Announcements</span>
                      <h3 className="text-2xl font-black text-[#110e3d] mt-1">{announcementsCount}</h3>
                      <span className="text-[10px] text-slate-400 font-bold mt-0.5 block">Total Town Crier Posts</span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">
                      <Megaphone className="w-5 h-5" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Interactive charts and mini Announcement feed */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Forge status graph */}
                <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-sm font-extrabold text-[#110e3d] flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#6366f1]" /> Development Activity
                    </CardTitle>
                    <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Distribution of features in The Forge roadmap</p>
                  </CardHeader>
                  <CardContent className="pt-2">
                    {developmentsLoading ? (
                      <div className="h-[200px] flex items-center justify-center"><Skeleton className="h-full w-full rounded-xl" /></div>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={devChartData}>
                          <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={25} />
                          <Tooltip
                            contentStyle={{ background: "#ffffff", border: "1px solid #eae8f5", borderRadius: "12px", fontSize: "11px" }}
                            labelStyle={{ fontWeight: "bold", color: "#110e3d" }}
                            cursor={{ fill: "#f1f0f7" }}
                          />
                          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                            {devChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Latest Announcements */}
                <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-extrabold text-[#110e3d] flex items-center gap-2">
                        <Megaphone className="w-4 h-4 text-[#6366f1]" /> Latest from Town Crier
                      </CardTitle>
                      <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Latest announcements and events</p>
                    </div>
                    <button
                      onClick={() => setActiveTab("announcements")}
                      className="text-xs font-bold text-[#6366f1] hover:text-indigo-700 transition-colors"
                    >
                      View all
                    </button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {announcementsLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-14 w-full rounded-xl" />
                        <Skeleton className="h-14 w-full rounded-xl" />
                      </div>
                    ) : recentAnnouncements.length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-400 font-semibold">The town crier is silent today.</div>
                    ) : (
                      recentAnnouncements.map((ann) => (
                        <div
                          key={ann.id}
                          onClick={() => setSelectedAnnouncement(ann)}
                          className="p-3 bg-slate-50 border border-[#eae8f5] rounded-xl hover:border-violet-200 hover:bg-violet-50/20 transition-all cursor-pointer group"
                        >
                          <div className="flex justify-between items-start">
                            <h4 className="text-xs font-extrabold text-[#110e3d] truncate group-hover:text-[#6366f1] transition-colors">{ann.title}</h4>
                            <span className="text-[9px] font-bold text-slate-400 uppercase shrink-0 ml-2">
                              {format(new Date(ann.createdAt), 'MMM d')}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-semibold line-clamp-2 mt-1 leading-relaxed">
                            {ann.content}
                          </p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Announcements / Town Crier Tab */}
          {activeTab === "announcements" && (
            <div className="space-y-4">
              <div className="flex flex-col">
                <h2 className="text-lg font-black text-[#110e3d]">Town Crier</h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Hear the news of the realm</p>
              </div>

              <div className="space-y-4">
                {announcementsLoading ? (
                  <Skeleton className="h-32 w-full rounded-2xl" />
                ) : announcements?.length === 0 ? (
                  <div className="text-center py-16 bg-white border border-[#eae8f5] rounded-2xl text-slate-400 font-bold text-sm">
                    No announcements available at this time.
                  </div>
                ) : (
                  announcements?.map((ann) => (
                    <Card
                      key={ann.id}
                      className="bg-white border-[#eae8f5] hover:border-violet-300 hover:shadow-md transition-all duration-300 cursor-pointer group rounded-2xl"
                      onClick={() => setSelectedAnnouncement(ann)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <CardTitle className="text-sm font-extrabold text-[#110e3d] group-hover:text-[#6366f1] transition-colors">
                              {ann.title}
                            </CardTitle>
                            <span className="text-[10px] text-slate-400 font-bold mt-1 block">
                              By {ann.authorName} • {format(new Date(ann.createdAt), 'MMMM d, yyyy')}
                            </span>
                          </div>
                          <span className="text-[9px] font-black tracking-wider uppercase bg-violet-50 text-[#6366f1] border border-violet-100 px-2 py-0.5 rounded-lg">
                            {ann.type}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {ann.imageUrl && (
                          <div className="mb-3 rounded-xl overflow-hidden border border-[#eae8f5]">
                            <img
                              src={ann.imageUrl}
                              alt={ann.title}
                              className="w-full max-h-48 object-cover"
                            />
                          </div>
                        )}
                        <p className="text-xs text-slate-500 font-semibold line-clamp-3 leading-relaxed whitespace-pre-wrap">
                          {ann.content}
                        </p>
                        {ann.content.length > 200 && (
                          <span className="text-[10px] font-extrabold text-[#6366f1] mt-2.5 inline-block group-hover:underline">
                            Read details...
                          </span>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Developments / The Forge Tab */}
          {activeTab === "developments" && (
            <div className="space-y-4">
              <div className="flex flex-col">
                <h2 className="text-lg font-black text-[#110e3d]">The Forge</h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Track real-time server development and roadmap items</p>
              </div>

              {developmentsLoading ? (
                <Skeleton className="h-48 w-full rounded-2xl" />
              ) : developments?.length === 0 ? (
                <div className="text-center py-16 bg-white border border-[#eae8f5] rounded-2xl text-slate-400 font-bold text-sm">
                  The Forge is resting. No active projects currently.
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2">
                  {developments?.map((dev) => (
                    <Card key={dev.id} className="bg-white border-[#eae8f5] shadow-sm rounded-2xl flex flex-col justify-between">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start gap-4">
                          <CardTitle className="text-sm font-extrabold text-[#110e3d]">
                            {dev.title}
                          </CardTitle>
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border ${
                            dev.status === "completed" 
                              ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                              : dev.status === "in_progress" 
                              ? "bg-amber-50 text-amber-500 border-amber-100" 
                              : dev.status === "planned" 
                              ? "bg-blue-50 text-blue-500 border-blue-100" 
                              : "bg-slate-50 text-slate-500 border-slate-100"
                          }`}>
                            {dev.status.replace('_', ' ')}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold mt-1 block">Category: {dev.category || "General"}</span>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col justify-between pt-1">
                        <p className="text-xs text-slate-500 font-semibold leading-relaxed mb-4">{dev.description}</p>
                        {dev.progress !== null && dev.progress !== undefined && (
                          <div className="space-y-1.5 mt-auto pt-2 border-t border-slate-50">
                            <div className="flex justify-between text-[10px] font-bold">
                              <span className="text-slate-400">Progress</span>
                              <span className="text-[#6366f1]">{dev.progress}%</span>
                            </div>
                            <Progress value={dev.progress} className="h-1.5 bg-slate-100" />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tickets / Help Desk Tab */}
          {activeTab === "tickets" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex flex-col">
                  <h2 className="text-lg font-black text-[#110e3d]">Support Tickets</h2>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Manage and send direct help desk tickets</p>
                </div>
                <Button 
                  onClick={() => setTicketDialogOpen(true)} 
                  className="bg-[#6366f1] hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl transition-all shadow-md shadow-violet-500/10"
                >
                  + Create Ticket
                </Button>
              </div>

              {ticketsLoading ? (
                <Skeleton className="h-32 w-full rounded-2xl" />
              ) : tickets.length === 0 ? (
                <div className="text-center py-16 bg-white border border-[#eae8f5] rounded-2xl text-slate-400 font-bold text-sm">
                  You have not created any support tickets. If you need help, click "+ Create Ticket".
                </div>
              ) : (
                <div className="space-y-4">
                  {tickets.map((t) => (
                    <Card key={t.id} className="bg-white border-[#eae8f5] shadow-sm rounded-2xl">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start gap-4 flex-wrap">
                          <div className="space-y-0.5">
                            <CardTitle className="text-sm font-extrabold text-[#110e3d]">
                              #{t.id} - {t.reason}
                            </CardTitle>
                            <p className="text-[10px] text-slate-400 font-bold">
                              Created: {format(new Date(t.createdAt), "dd MMM yyyy, HH:mm")}
                            </p>
                          </div>
                          <span className={`text-[9px] px-2 py-0.5 rounded-lg font-black uppercase tracking-wider border ${
                            t.status === "open"
                              ? "bg-amber-50 text-amber-600 border-amber-100"
                              : t.status === "in_progress"
                              ? "bg-blue-50 text-blue-600 border-blue-100"
                              : t.status === "resolved"
                              ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                              : "bg-slate-50 text-slate-500 border-slate-100"
                          }`}>
                            {t.status === "open" && "Open"}
                            {t.status === "in_progress" && "In Progress"}
                            {t.status === "resolved" && "Resolved"}
                            {t.status === "closed" && "Closed"}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4 pt-1">
                        <p className="text-xs text-slate-500 font-semibold whitespace-pre-wrap leading-relaxed">
                          {t.description}
                        </p>
                        
                        <div className="flex justify-between items-center gap-4 flex-wrap pt-3 border-t border-slate-50 text-[10px] font-bold">
                          <div className="text-slate-400">
                            {t.adminId ? (
                              <span>Assigned Moderator: <span className="text-slate-700">{t.adminDisplayName || t.adminUsername}</span></span>
                            ) : (
                              <span className="italic text-amber-500/90 animate-pulse">Awaiting moderator response...</span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-[#eae8f5] text-[#110e3d] text-[10px] font-extrabold px-3.5"
                              onClick={() => setSelectedTicketChat(t)}
                            >
                              Detail & Reply
                            </Button>
                            {t.status !== "closed" && t.status !== "resolved" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-lg border-red-100 text-red-500 hover:bg-red-50 text-[10px] font-extrabold px-3.5"
                                onClick={() => handleCloseTicket(t.id)}
                              >
                                Close Ticket
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Voting & Forms Tab */}
          {activeTab === "forms" && (
            <div className="space-y-4">
              <div className="flex flex-col">
                <h2 className="text-lg font-black text-[#110e3d]">Voting & Forums</h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Cast votes or fill forms deployed by the realm lords</p>
              </div>
              <FormsTab />
            </div>
          )}

          {/* Player Profile Tab */}
          {activeTab === "profile" && (
            <div className="space-y-6 max-w-2xl">
              {/* Edit Profile Form */}
              <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-sm font-extrabold text-[#110e3d]">Edit Profile Settings</CardTitle>
                  <p className="text-[11px] text-slate-400 font-semibold mt-1">
                    Handle: <span className="text-slate-800 font-bold">@{user?.username}</span>
                    {user?.userTag && <> <span className="text-[#6366f1] font-bold">{user.userTag}</span></>}
                    {user?.displayName && <> · Display Name: <span className="text-slate-800 font-bold">{user.displayName}</span></>}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="username" className="text-xs font-bold text-slate-600">Handle / Nickname</Label>
                    <Input
                      id="username"
                      placeholder={user?.username ?? ""}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9"
                    />
                    <p className="text-[10px] text-slate-400 font-semibold">Public handle. Multiple users can share the same display name.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="displayName" className="text-xs font-bold text-slate-600">Display Name</Label>
                    <Input
                      id="displayName"
                      placeholder={user?.displayName ?? "Your screen name"}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bio" className="text-xs font-bold text-slate-600">Short Bio</Label>
                    <Textarea
                      id="bio"
                      placeholder={user?.bio ?? "Tell the realm who you are..."}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs min-h-[80px] resize-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="youtubeLiveUrl" className="text-xs font-bold text-slate-600">YouTube Live Banner URL</Label>
                    <Input
                      id="youtubeLiveUrl"
                      placeholder={user?.youtubeLiveUrl ?? "https://www.youtube.com/watch?v=..."}
                      value={youtubeLiveUrl}
                      onChange={(e) => setYoutubeLiveUrl(e.target.value)}
                      className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9"
                    />
                    <p className="text-[10px] text-slate-400 font-semibold">Displays as a header backdrop card in public views. Keep empty to clear.</p>
                  </div>
                  <Button
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="bg-[#6366f1] hover:bg-indigo-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-violet-500/10"
                  >
                    {savingProfile ? "Saving Profile..." : "Save Changes"}
                  </Button>
                </CardContent>
              </Card>

              {/* Message Privacy Dropdown */}
              <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-sm font-extrabold text-[#110e3d]">Direct Message Privacy</CardTitle>
                  <p className="text-[11px] text-slate-400 font-semibold mt-1">Control who can initiate a direct conversation with you</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="messagePrivacy" className="text-xs font-bold text-slate-600">Allowed Sender Scope</Label>
                    <Select
                      value={settings?.messagePrivacy ?? "friends_only"}
                      onValueChange={handleUpdatePrivacy}
                    >
                      <SelectTrigger id="messagePrivacy" className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 w-full text-[#1e1b4b] font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-[#eae8f5] rounded-xl text-slate-700">
                        <SelectItem value="everyone">Everyone</SelectItem>
                        <SelectItem value="following_only">People I Follow</SelectItem>
                        <SelectItem value="friends_only">Mutual Followers (Friends)</SelectItem>
                        <SelectItem value="nobody">Nobody</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Change Password Card */}
              <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-sm font-extrabold text-[#110e3d]">Change Account Password</CardTitle>
                  <p className="text-[11px] text-slate-400 font-semibold mt-1">Keep current password blank if signed in via Google/Discord</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="currentPassword" className="text-xs font-bold text-slate-600">Current Password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      placeholder="••••••••"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="newPassword" className="text-xs font-bold text-slate-600">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="Min. 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword" className="text-xs font-bold text-slate-600">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Repeat new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9"
                    />
                  </div>
                  <Button
                    onClick={handleChangePassword}
                    disabled={savingPassword || !newPassword}
                    className="bg-[#6366f1] hover:bg-indigo-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-violet-500/10"
                  >
                    {savingPassword ? "Updating..." : "Change Password"}
                  </Button>
                </CardContent>
              </Card>

              {/* Cosmetics Equipment Card */}
              <ProfileCosmeticsInventory />
            </div>
          )}

          {/* Account Settings Tab */}
          {activeTab === "settings" && (
            <div className="space-y-6 max-w-4xl">
              <div className="flex flex-col">
                <h2 className="text-lg font-black text-[#110e3d]">Account Settings</h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Manage your email, two-factor authentication, and connected accounts</p>
              </div>
              <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl overflow-hidden p-1 sm:p-4 md:p-6">
                <UserProfile 
                  routing="hash" 
                  appearance={{
                    elements: {
                      rootBox: "w-full",
                      cardBox: "w-full shadow-none border-0 bg-transparent max-w-none flex",
                      card: "shadow-none border-0 bg-transparent w-full",
                      navbar: "hidden md:flex bg-slate-50/50 border-r border-[#eae8f5] p-4 rounded-l-xl shrink-0",
                      pageScrollable: "p-4 sm:p-6 md:p-8 w-full",
                      profileSectionTitleText: "!text-slate-800 font-bold",
                      profileSectionSubtitleText: "!text-slate-500 text-xs",
                      headerTitle: "!text-[#110e3d] font-extrabold",
                      headerSubtitle: "!text-slate-500",
                      formButtonPrimary: "bg-[#6366f1] hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl",
                      navbarButton: "text-slate-500 hover:text-slate-900 hover:bg-slate-100 font-bold text-xs rounded-lg px-3 py-2",
                      navbarButtonActive: "text-[#6366f1] bg-violet-50/80 hover:text-[#6366f1] hover:bg-violet-50 font-bold",
                      profileSection: "border-b border-[#eae8f5] pb-6 mb-6 last:border-0",
                      userPreview: "bg-slate-50 border border-[#eae8f5] p-4 rounded-xl",
                      userPreviewTextContainer: "ml-3",
                      userPreviewTitle: "!text-[#110e3d] font-extrabold",
                      userPreviewSubtitle: "!text-slate-400 font-bold",
                      formFieldLabel: "!text-slate-700 font-bold text-xs",
                      formFieldInput: "!bg-slate-50 !border-[#eae8f5] !text-[#1e1b4b] rounded-xl text-xs h-9",
                      dividerText: "!text-slate-400",
                      dividerLine: "!bg-slate-200",
                      identityPreviewEditButton: "!text-[#6366f1] hover:underline",
                      formFieldSuccessText: "!text-emerald-600",
                      alertText: "!text-red-500",
                      alert: "!bg-red-50 !border-red-200",
                      otpCodeFieldInput: "!bg-slate-50 !border-[#eae8f5] !text-[#1e1b4b]",
                      navbarTitle: "!text-[#110e3d] !font-extrabold",
                      navbarSubtitle: "!text-slate-400",
                      breadcrumbsItem: "!text-slate-500",
                      breadcrumbsItemActive: "!text-[#110e3d] !font-bold",
                      breadcrumbsSeparator: "!text-slate-300",
                      accordionTriggerButton: "!text-slate-700",
                      accordionContent: "!text-slate-600",
                    },
                    variables: {
                      colorPrimary: "#6366f1",
                      colorBackground: "#ffffff",
                      colorText: "#1e1b4b",
                      colorTextSecondary: "#64748b",
                      colorForeground: "#1e1b4b",
                      colorMutedForeground: "#64748b",
                      colorInput: "#f8fafc",
                      colorInputForeground: "#1e1b4b",
                      colorNeutral: "#cbd5e1",
                      borderRadius: "0.75rem",
                    }
                  }}
                >
                  <UserProfile.Page label="account" />
                  <UserProfile.Page label="security" />
                  <UserProfile.Page
                    label="Switch Account"
                    url="switch"
                    labelIcon={<Users className="w-4.5 h-4.5" />}
                  >
                    <div className="space-y-4 pt-1">
                      <div className="flex flex-col mb-4">
                        <h3 className="text-base font-extrabold text-[#110e3d]">Switch Account</h3>
                        <p className="text-xs text-slate-400 font-semibold mt-0.5">Keep multiple active sessions and quickly toggle characters</p>
                      </div>
                      <DevSwitchAccountCard />
                    </div>
                  </UserProfile.Page>
                </UserProfile>
              </Card>
            </div>
          )}

          {/* Contributor Credits Tab */}
          {activeTab === "credits" && (
            <div className="space-y-4">
              <div className="flex flex-col">
                <h2 className="text-lg font-black text-[#110e3d]">Arcadia Credits</h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Meet the creators and developers who forged this realm</p>
              </div>
              <CreditsTab />
            </div>
          )}

          {/* Gacha Royale Tab */}
          {activeTab === "gacha" && (
            <div className="space-y-4">
              <GachaTab />
            </div>
          )}

          {/* My Wallet Tab */}
          {activeTab === "wallet" && (
            <div className="space-y-4">
              <div className="flex flex-col">
                <h2 className="text-lg font-black text-[#110e3d]">My Wallet</h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Manage your diamonds and view transaction logs</p>
              </div>
              <WalletTab />
            </div>
          )}
        </div>
      </main>

      {/* ── Dialog Modals ────────────────────────────────────────────────── */}

      {/* Announcement Detail Modal */}
      <Dialog open={selectedAnnouncement !== null} onOpenChange={() => setSelectedAnnouncement(null)}>
        <DialogContent className="bg-white border-[#eae8f5] max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6">
          {selectedAnnouncement && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                  <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 bg-violet-50 text-[#6366f1] border border-violet-100 rounded-lg">
                    {selectedAnnouncement.type}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">
                    {format(new Date(selectedAnnouncement.createdAt), 'MMMM d, yyyy')}
                  </span>
                </div>
                <DialogTitle className="text-lg font-extrabold text-[#110e3d] leading-tight">
                  {selectedAnnouncement.title}
                </DialogTitle>
                <div className="text-[10px] text-slate-400 font-bold mt-1.5">
                  By <span className="text-slate-700">{selectedAnnouncement.authorName}</span>
                </div>
              </DialogHeader>
              <div className="border-t border-slate-50 my-4 pt-4 space-y-4">
                {selectedAnnouncement.imageUrl && (
                  <div className="rounded-xl overflow-hidden border border-[#eae8f5]">
                    <img
                      src={selectedAnnouncement.imageUrl}
                      alt={selectedAnnouncement.title}
                      className="w-full max-h-72 object-cover"
                    />
                  </div>
                )}
                <p className="text-xs text-slate-500 font-semibold whitespace-pre-wrap leading-relaxed">
                  {selectedAnnouncement.content}
                </p>
              </div>
              <DialogFooter>
                <Button onClick={() => setSelectedAnnouncement(null)} className="bg-slate-100 hover:bg-slate-200 border border-[#eae8f5] text-slate-700 text-xs font-bold rounded-xl h-9 px-4">
                  Close Announcement
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Ticket Create Dialog */}
      <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
        <DialogContent className="bg-white border-[#eae8f5] max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-[#110e3d] font-extrabold text-base">Create Support Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="reason" className="text-xs font-bold text-slate-600">Ticket Category</Label>
              <Select
                value={ticketReason}
                onValueChange={setTicketReason}
              >
                <SelectTrigger id="reason" className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 w-full text-[#1e1b4b] font-bold">
                  <SelectValue placeholder={ticketReasonsLoading ? "Loading categories..." : "Select reason"} />
                </SelectTrigger>
                <SelectContent className="bg-white border-[#eae8f5] rounded-xl text-slate-700">
                  {ticketReasons.map((reason) => (
                    <SelectItem key={reason.id} value={reason.label}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {ticketReasons.length === 0 && (
                <p className="text-[10px] text-red-500 font-bold">No active support categories. Contact admin.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs font-bold text-slate-600">Description / Details</Label>
              <Textarea
                id="description"
                placeholder="Explain the issues you are facing, or detail what assistance is required..."
                value={ticketDescription}
                onChange={(e) => setTicketDescription(e.target.value)}
                className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs min-h-[100px] resize-none"
              />
              <p className="text-[10px] text-slate-400 font-semibold">Minimum 5 characters.</p>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4 border-t border-slate-50">
            <Button variant="outline" className="border-[#eae8f5] text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl h-9 px-4" onClick={() => setTicketDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateTicket} 
              disabled={submittingTicket || !ticketReason || ticketDescription.trim().length < 5} 
              className="bg-[#6366f1] text-white hover:bg-indigo-700 text-xs font-bold rounded-xl h-9 px-4 shadow-md shadow-violet-500/5"
            >
              {submittingTicket ? "Submitting..." : "Submit Ticket"}
            </Button>
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
    </div>
  );
}

function DevSwitchAccountCard() {
  const clerk = useClerk();
  const { data: currentUser } = useGetMe();
  const activeSwitchClerkId = typeof window !== "undefined" ? localStorage.getItem("switch_clerk_id") : null;
  const canUseDevSwitch = currentUser?.role === "dev_website";
  const { data: users = [], isLoading: isUsersLoading } = useListSwitchableUsers({
    query: { enabled: Boolean(canUseDevSwitch) } as any,
  });
  const [selectedClerkId, setSelectedClerkId] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sessions = clerk.client?.sessions || [];
  const activeSessionId = clerk.session?.id;
  const activeSwitchUser = users.find((u) => u.clerkId === activeSwitchClerkId);

  useEffect(() => {
    if (activeSwitchClerkId) {
      setSelectedClerkId(activeSwitchClerkId);
      return;
    }
    if (!selectedClerkId && currentUser?.clerkId) {
      setSelectedClerkId(currentUser.clerkId);
    }
  }, [activeSwitchClerkId, currentUser?.clerkId, selectedClerkId]);

  const reloadWithFreshCache = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    window.location.reload();
  };

  const handleSwitchClerkSession = async (sessionId: string) => {
    try {
      toast({ title: "Switching account...", description: "Mohon tunggu sebentar." });
      await clerk.setActive({ session: sessionId });
      localStorage.removeItem("switch_clerk_id");
      await reloadWithFreshCache();
    } catch (err: any) {
      toast({ title: "Failed to switch", description: err.message, variant: "destructive" });
    }
  };

  const handleSignOutSession = async (sessionId: string) => {
    try {
      const sessionToRevoke = sessions.find((s) => s.id === sessionId);
      if (sessionToRevoke) {
        await clerk.signOut({ sessionId });
        toast({ title: "Logged out", description: "Akun berhasil dihapus dari daftar." });
        if (activeSessionId === sessionId) {
          localStorage.removeItem("switch_clerk_id");
        }
        await reloadWithFreshCache();
      }
    } catch (err: any) {
      toast({ title: "Failed to sign out", description: err.message, variant: "destructive" });
    }
  };

  const handleAddAccount = async () => {
    const signInUrl = `${window.location.origin}${basePath}/sign-in`;
    localStorage.removeItem("switch_clerk_id");
    toast({ title: "Login akun lain", description: "Membuka sign-in flow bawaan Clerk." });
    window.location.href = signInUrl;
  };

  const handleSwitchMock = (clerkId: string) => {
    if (!clerkId) return;
    localStorage.setItem("switch_clerk_id", clerkId);
    toast({ title: "Account Switched (Mock)", description: "Reloading database session..." });
    window.setTimeout(() => void reloadWithFreshCache(), 500);
  };

  const handleRevertMock = () => {
    localStorage.removeItem("switch_clerk_id");
    toast({ title: "Session Reverted", description: "Reloading original Clerk account..." });
    window.setTimeout(() => void reloadWithFreshCache(), 500);
  };

  const isLoading = isUsersLoading;

  if (isLoading) return <Skeleton className="h-48 w-full rounded-2xl" />;

  return (
    <Card className="bg-white border-2 border-amber-500/30 shadow-md shadow-amber-500/5 rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-amber-600 font-extrabold text-sm flex items-center gap-2">
            <span>🛠️ Switch Account (Roblox Style)</span>
          </CardTitle>
          {activeSwitchClerkId && (
            <span className="text-[9px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-lg font-bold uppercase tracking-wider">
              Bypassed
            </span>
          )}
        </div>
        <p className="text-[10px] text-slate-400 font-semibold mt-1">
          Keep multiple credentials active and switch roles quickly. Mock bypass is enabled for Dev Website.
        </p>
        {activeSwitchClerkId && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/30 px-3 py-2 text-xs text-amber-800 font-semibold">
            Bypassed as: <strong>{activeSwitchUser?.displayName || activeSwitchUser?.username || currentUser?.displayName || currentUser?.username}</strong>
            {activeSwitchUser?.userTag && <span className="ml-1 text-[#6366f1]">{activeSwitchUser.userTag}</span>}
            <Button variant="link" onClick={handleRevertMock} className="ml-2 h-auto p-0 text-xs font-extrabold text-amber-600 hover:text-amber-700">
              Revert
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="sessions" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-50 border border-[#eae8f5] mb-4 h-9 p-0.5 rounded-xl">
            <TabsTrigger value="sessions" className="text-[11px] py-1 font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-800">Saved Accounts ({sessions.length})</TabsTrigger>
            <TabsTrigger value="bypass" className="text-[11px] py-1 font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-800" disabled={!canUseDevSwitch && !activeSwitchClerkId}>Dev Quick Switch</TabsTrigger>
          </TabsList>

          {/* Clerk Native Sessions Switcher (Roblox-style) */}
          <TabsContent value="sessions" className="space-y-3">
            <div className="divide-y divide-slate-100 rounded-xl border border-[#eae8f5] bg-slate-50/30 max-h-[220px] overflow-y-auto">
              {sessions.map((sess) => {
                const u = sess.user;
                if (!u) return null;
                const dbUser =
                  users.find((candidate) => candidate.clerkId === u.id) ??
                  (currentUser?.clerkId === u.id ? currentUser : undefined);
                const sessionDisplayName = dbUser?.displayName || dbUser?.username || u.fullName || u.username || "Player";
                const sessionUsername =
                  dbUser?.username ||
                  u.username ||
                  u.primaryEmailAddress?.emailAddress?.split("@")[0] ||
                  "player";
                const sessionTag = dbUser?.userTag;
                const isActive = sess.id === activeSessionId && !activeSwitchClerkId;
                return (
                  <div key={sess.id} className={`flex items-center justify-between p-3 transition-all ${isActive ? "bg-amber-50/20" : "hover:bg-slate-50/50"}`}>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-[#eae8f5]">
                        <AvatarImage src={u.imageUrl} />
                        <AvatarFallback className="text-[10px] font-bold">
                          {getInitials(sessionDisplayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <span className="truncate">{sessionDisplayName}</span>
                          {sessionTag && <span className="shrink-0 text-[10px] font-bold text-[#6366f1]">{sessionTag}</span>}
                          {isActive && (
                            <span className="text-[8px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.2 rounded font-bold uppercase tracking-wider">
                              Active
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-slate-400 font-semibold truncate">
                          @{sessionUsername}
                          {u.primaryEmailAddress?.emailAddress && (
                            <span className="text-slate-400/70"> · {u.primaryEmailAddress.emailAddress}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!isActive && (
                        <Button
                          size="sm"
                          onClick={() => handleSwitchClerkSession(sess.id)}
                          className="h-7 px-2.5 text-[10px] bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg"
                        >
                          Switch
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSignOutSession(sess.id)}
                        className="h-7 px-2 text-[10px] text-red-500 hover:bg-red-50 font-bold rounded-lg"
                      >
                        Log Out
                      </Button>
                    </div>
                  </div>
                );
              })}
              {sessions.length === 0 && (
                <div className="text-center py-6 text-xs text-slate-400 font-semibold">
                  No saved sessions.
                </div>
              )}
            </div>

            <Button
              onClick={() => void handleAddAccount()}
              className="w-full bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl h-9 shadow-sm"
            >
              ➕ Add Account (Sign In to Another Account)
            </Button>
            <p className="text-[9px] text-slate-400 font-semibold text-center leading-relaxed">
              *Ensure multi-sessions are enabled in your Clerk dashboard configuration.
            </p>
          </TabsContent>

          {/* Dev Mock Bypass Switcher */}
          <TabsContent value="bypass" className="space-y-4">
            {!canUseDevSwitch && activeSwitchClerkId ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/20 p-3 text-xs text-amber-800 font-semibold">
                You are in bypass mode. Click <strong>Revert</strong> to return to your original Clerk credentials.
              </div>
            ) : !canUseDevSwitch ? (
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs text-slate-450 font-semibold">
                Bypass switch is only accessible to Dev Website roles.
              </div>
            ) : (
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <div className="flex-1">
                <Select
                  value={selectedClerkId || (currentUser?.clerkId ?? "")}
                  onValueChange={setSelectedClerkId}
                >
                  <SelectTrigger className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 w-full text-[#1e1b4b] font-bold">
                    <SelectValue placeholder="Choose database record..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-[#eae8f5] rounded-xl text-slate-700">
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.clerkId}>
                        <div className="flex items-center gap-2">
                          <Avatar className="w-5 h-5 border border-slate-100">
                            <AvatarImage src={u.avatarUrl ?? undefined} />
                            <AvatarFallback className="text-[8px] font-bold bg-slate-100 text-slate-600">
                              {getInitials(u.displayName || u.username)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-bold text-xs text-slate-800">
                            {u.displayName || u.username}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold font-mono">
                            @{u.username}
                          </span>
                          <span className="text-[9px] bg-violet-50 text-[#6366f1] border border-violet-100 px-1.5 py-0.2 rounded-lg font-bold uppercase">
                            {u.role}
                          </span>
                          {u.mcUsername && (
                            <span className="text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.2 rounded-lg font-bold font-mono">
                              🎮 {u.mcUsername}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleSwitchMock(selectedClerkId)}
                  disabled={!selectedClerkId || selectedClerkId === activeSwitchClerkId || (!activeSwitchClerkId && selectedClerkId === currentUser?.clerkId)}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl h-9"
                >
                  Bypass Switch
                </Button>
                {activeSwitchClerkId && (
                  <Button
                    variant="outline"
                    onClick={handleRevertMock}
                    className="border-red-100 text-red-500 hover:bg-red-50 text-xs font-bold rounded-xl h-9"
                  >
                    Revert Original
                  </Button>
                )}
              </div>
            </div>
            )}

            {activeSwitchClerkId && (
              <p className="text-[9px] text-amber-700 bg-amber-50/20 border border-amber-200 rounded-xl p-2.5 leading-relaxed font-semibold">
                <strong>Warning:</strong> You are actively mimicking the account <strong>{currentUser?.displayName || currentUser?.username}</strong>. The entire Arcadia platform will resolve your API queries under this mock identity.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
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
              ? "bg-amber-50 text-amber-600 border-amber-100"
              : ticket.status === "in_progress"
              ? "bg-blue-50 text-blue-600 border-blue-100"
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
              No chat history. Message the moderator below.
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg: any) => {
                const isCreator = msg.senderId === ticket.creatorId;

                return (
                  <div key={msg.id} className={`flex gap-2.5 ${isCreator ? "flex-row-reverse" : ""}`}>
                    <Avatar className="w-6 h-6 shrink-0 mt-0.5 border border-slate-100">
                      <AvatarImage src={msg.senderAvatarUrl ?? undefined} />
                      <AvatarFallback className="text-[9px] bg-slate-100 font-bold text-[#6366f1]">{getInitials(msg.senderDisplayName || msg.senderUsername)}</AvatarFallback>
                    </Avatar>
                    <div className={`max-w-[75%] flex flex-col gap-0.5 ${isCreator ? "items-end" : "items-start"}`}>
                      <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold">
                        <span className="text-slate-600">{msg.senderDisplayName || msg.senderUsername}</span>
                        <span>{format(new Date(msg.createdAt), "HH:mm")}</span>
                      </div>
                      <div className={`rounded-xl px-3 py-2 text-xs leading-relaxed font-semibold shadow-sm ${
                        isCreator
                          ? "bg-[#6366f1] text-white rounded-tr-none"
                          : "bg-white border border-[#eae8f5] text-slate-700 rounded-tl-none"
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
            className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9"
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

function FormsTab() {
  const { data: forms = [], isLoading } = useListForms();
  const [selectedForm, setSelectedForm] = useState<any | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 bg-white border border-[#eae8f5] rounded-2xl animate-pulse" />
        <Skeleton className="h-28 bg-white border border-[#eae8f5] rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (forms.length === 0) {
    return (
      <div className="text-center py-16 bg-white border border-[#eae8f5] rounded-2xl text-slate-400 font-bold text-sm">
        <div className="text-4xl mb-3">🗳️</div>
        <p>No active voting options or forms at this time.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4">
        {forms.map((form: any) => (
          <div
            key={form.id}
            className="bg-white border border-[#eae8f5] rounded-2xl p-5 hover:border-violet-300 hover:shadow-md transition-all cursor-pointer group"
            onClick={() => setSelectedForm(form)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className={`text-[9px] px-2 py-0.5 rounded-lg font-black uppercase tracking-wider border ${form.type === "poll" ? "bg-violet-50 text-[#6366f1] border-violet-100" : "bg-blue-50 text-blue-600 border-blue-100"}`}>
                    {form.type === "poll" ? "🗳️ Voting" : "📋 Form"}
                  </span>
                  <span className={`text-[9px] px-2 py-0.5 rounded-lg font-black uppercase tracking-wider border ${form.status === "open" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-500 border-slate-100"}`}>
                    {form.status === "open" ? "Open" : "Closed"}
                  </span>
                </div>
                <h3 className="font-extrabold text-sm text-[#110e3d] group-hover:text-[#6366f1] transition-colors truncate">{form.title}</h3>
                {form.description && <p className="text-[11px] text-slate-400 font-semibold mt-1 line-clamp-2 leading-relaxed">{form.description}</p>}
                <div className="flex items-center gap-3 mt-3 text-[10px] text-slate-400 font-bold">
                  <span>👥 {form.responseCount} responses</span>
                  {form.deadline && <span>⏰ Deadline: {format(new Date(form.deadline), "d MMM yyyy")}</span>}
                </div>
              </div>
              <div className="text-[#6366f1] opacity-0 group-hover:opacity-100 transition-all transform translate-x-1 group-hover:translate-x-0 shrink-0 font-bold">→</div>
            </div>
          </div>
        ))}
      </div>
      <Dialog open={selectedForm !== null} onOpenChange={(open) => { if (!open) setSelectedForm(null); }}>
        <DialogContent className="bg-white border-[#eae8f5] max-w-lg flex flex-col max-h-[85vh] p-0 overflow-hidden rounded-2xl">
          {selectedForm && <FormDetailContent form={selectedForm} onClose={() => setSelectedForm(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function FormDetailContent({ form, onClose }: { form: any; onClose: () => void }) {
  const { data: detail, isLoading } = useGetForm(form.id, {
    query: {
      queryKey: [`/api/forms/${form.id}`] as const,
      staleTime: 0,
      refetchOnMount: "always",
    }
  });
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
      toast({ title: "Vote success!", description: "Your vote has been recorded." });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to vote.", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const handleSubmitForm = async () => {
    if (!detail) return;
    for (const f of (detail.fields ?? []).filter((f: any) => f.required)) {
      if (!formAnswers[f.id]?.trim()) {
        toast({ title: "Validation Error", description: `Field "${f.label}" is required.`, variant: "destructive" });
        return;
      }
    }
    setSubmitting(true);
    try {
      const answers = (detail.fields ?? []).map((f: any) => ({ fieldId: f.id, value: formAnswers[f.id] ?? "" }));
      await submitForm.mutateAsync({ id: form.id, data: { answers } });
      await queryClient.invalidateQueries({ queryKey: [`/api/forms/${form.id}/my-response`] });
      await queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      toast({ title: "Form submitted!", description: "Your answers have been saved." });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to submit.", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const totalVotes = (detail?.options ?? []).reduce((s: number, o: any) => s + (o.voteCount ?? 0), 0);

  return (
    <>
      <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-100 bg-white shrink-0">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span className={`text-[9px] px-2 py-0.5 rounded-lg font-black border ${form.type === "poll" ? "bg-violet-50 text-[#6366f1] border-violet-100" : "bg-blue-50 text-blue-600 border-blue-100"}`}>
            {form.type === "poll" ? "🗳️ Voting" : "📋 Form"}
          </span>
          {hasResponded && (
            <span className="text-[9px] px-2 py-0.5 rounded-lg font-black border bg-emerald-50 text-emerald-600 border-emerald-100">✓ Submitted</span>
          )}
        </div>
        <DialogTitle className="text-[#110e3d] font-extrabold text-base">{form.title}</DialogTitle>
        {form.description && <p className="text-[11px] text-slate-400 font-semibold mt-1">{form.description}</p>}
      </DialogHeader>
      <ScrollArea className="flex-1 p-5 bg-slate-50/20">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ) : form.type === "poll" ? (
          <div className="space-y-3">
            {hasResponded ? (
              <div className="space-y-3">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-2">Voting Results ({totalVotes} votes)</p>
                {(detail?.options ?? []).map((opt: any) => {
                  const pct = totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 100) : 0;
                  const isMyVote = myResponse?.selectedOptionId === opt.id;
                  return (
                    <div key={opt.id} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className={`${isMyVote ? "text-[#6366f1]" : "text-slate-700"}`}>{isMyVote ? "✓ " : ""}{opt.label}</span>
                        <span className="text-slate-400">{opt.voteCount} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${isMyVote ? "bg-[#6366f1]" : "bg-slate-300"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-400 font-bold mb-3">Select one option:</p>
                {(detail?.options ?? []).map((opt: any) => (
                  <button key={opt.id} type="button" onClick={() => setSelectedOption(opt.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-xs font-bold transition-all ${selectedOption === opt.id ? "border-[#6366f1] bg-violet-50/50 text-[#6366f1]" : "border-[#eae8f5] bg-white hover:border-[#6366f1]/50 text-slate-600"}`}>
                    <span className={`inline-block w-4.5 h-4.5 rounded-full border-2 mr-2.5 align-middle transition-all ${selectedOption === opt.id ? "border-[#6366f1] bg-[#6366f1]" : "border-slate-300"}`} />
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
                <p className="text-sm font-extrabold text-[#110e3d]">Form submitted successfully!</p>
                <p className="text-xs text-slate-400 font-bold mt-1">Thank you for filling this form.</p>
                {(myResponse?.answers ?? []).length > 0 && (
                  <div className="mt-4 space-y-2 text-left">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Your responses:</p>
                    {(myResponse?.answers ?? []).map((ans: any, i: number) => (
                      <div key={i} className="bg-white border border-[#eae8f5] rounded-xl p-3 text-xs font-semibold shadow-sm">
                        <p className="text-slate-400 font-bold mb-1">{ans.fieldLabel}</p>
                        <p className="text-slate-700">{ans.value || "(blank)"}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              (detail?.fields ?? []).map((field: any) => {
                const type = field.fieldType || field.field_type;
                return (
                  <div key={field.id} className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600">{field.label}{field.required && <span className="text-red-500 ml-1">*</span>}</Label>
                    {type === "textarea" ? (
                      <Textarea placeholder="Your answer..." value={formAnswers[field.id] ?? ""} onChange={(e) => setFormAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))} className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs min-h-[85px] resize-none" />
                    ) : type === "radio" || type === "select" ? (
                      <div className="space-y-1.5">
                        {(() => {
                          let opts: string[] = [];
                          if (field.options) {
                            try {
                              const parsed = JSON.parse(field.options);
                              opts = Array.isArray(parsed) ? parsed : [String(parsed)];
                            } catch {
                              opts = field.options.split(",").map((o: string) => o.trim()).filter(Boolean);
                            }
                          }
                          return opts.map((opt: string) => (
                            <button key={opt} type="button" onClick={() => setFormAnswers((prev) => ({ ...prev, [field.id]: opt }))}
                              className={`w-full text-left px-3 py-2 rounded-xl border text-xs font-bold transition-all ${formAnswers[field.id] === opt ? "border-[#6366f1] bg-violet-50/50 text-[#6366f1]" : "border-[#eae8f5] bg-white hover:border-[#6366f1]/50 text-slate-550"}`}>
                              {opt}
                            </button>
                          ));
                        })()}
                      </div>
                    ) : (
                      <Input placeholder="Your answer..." value={formAnswers[field.id] ?? ""} onChange={(e) => setFormAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))} className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </ScrollArea>
      {!hasResponded && form.status === "open" && (
        <div className="p-4 border-t border-slate-100 bg-white shrink-0">
          {form.type === "poll" ? (
            <Button className="w-full bg-[#6366f1] text-white hover:bg-indigo-700 font-extrabold text-xs h-9 rounded-xl shadow-md shadow-violet-500/5" disabled={!selectedOption || submitting} onClick={handleVote}>
              {submitting ? "Submitting..." : "🗳️ Cast Vote"}
            </Button>
          ) : (
            <Button className="w-full bg-[#6366f1] text-white hover:bg-indigo-700 font-extrabold text-xs h-9 rounded-xl shadow-md shadow-violet-500/5" disabled={submitting} onClick={handleSubmitForm}>
              {submitting ? "Submitting..." : "📋 Submit Answers"}
            </Button>
          )}
        </div>
      )}
      {form.status === "closed" && (
        <div className="p-3 border-t border-slate-100 text-center text-[10px] text-slate-400 font-bold bg-white shrink-0">
          {form.type === "poll" ? "Voting is closed." : "Form is closed."}
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
        <Skeleton className="h-[280px] rounded-2xl" />
        <Skeleton className="h-[280px] rounded-2xl" />
        <Skeleton className="h-[280px] rounded-2xl" />
      </div>
    );
  }

  if (credits.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400 font-bold border border-dashed border-[#eae8f5] rounded-2xl bg-white">
        <div className="text-4xl mb-3">🛡️</div>
        <p className="text-xs">No team contributors registered in Arcadia Credits.</p>
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
                <h3 className="font-bold text-lg text-white leading-snug tracking-tight line-clamp-1">{credit.name}</h3>
                <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full font-bold tracking-wider uppercase">
                  {credit.role}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300/95 line-clamp-3 leading-relaxed px-4 mb-2">
              {credit.description || "Tidak ada deskripsi."}
            </p>

            <div className="h-1" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProfileCosmeticsInventory() {
  const { data: ownedCosmetics = [], isLoading, refetch } = useListOwnedCosmetics();
  const { data: user, refetch: refetchMe } = useGetMe();
  const equipCosmetic = useEquipCosmetic();
  const { toast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState<"badge" | "border" | "background">("badge");
  const queryClient = useQueryClient();

  if (isLoading) {
    return (
      <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl p-6">
        <Skeleton className="h-32 w-full rounded-xl" />
      </Card>
    );
  }

  const items = ownedCosmetics.filter(c => c.type === activeSubTab);

  const handleEquip = async (id: number, currentStatus: boolean) => {
    try {
      await equipCosmetic.mutateAsync({
        id,
        data: { equip: !currentStatus }
      });
      toast({
        title: currentStatus ? "Cosmetic unequipped" : "Cosmetic equipped!",
        description: currentStatus ? "Item has been unequipped." : "Your profile style has been updated."
      });
      await refetch();
      await refetchMe();
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/members"] });
    } catch (err: any) {
      toast({
        title: "Action failed",
        description: err.message || "Failed to update cosmetic state.",
        variant: "destructive"
      });
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "S": return "bg-red-500 text-white border-red-300";
      case "A": return "bg-pink-500 text-white border-pink-300";
      case "B": return "bg-purple-500 text-white border-purple-300";
      case "C": return "bg-blue-500 text-white border-blue-300";
      default: return "bg-slate-400 text-white border-slate-300";
    }
  };

  return (
    <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl">
      <CardHeader>
        <CardTitle className="text-sm font-extrabold text-[#110e3d] flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-500" /> Cosmetics Inventory
        </CardTitle>
        <p className="text-[11px] text-slate-400 font-semibold mt-1">
          Equip custom borders, badges, or backgrounds won from Gacha Royale
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeSubTab} onValueChange={(val) => setActiveSubTab(val as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-slate-50 border border-[#eae8f5] h-9 p-0.5 rounded-xl">
            <TabsTrigger value="badge" className="text-[11px] py-1 font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-800">Badges</TabsTrigger>
            <TabsTrigger value="border" className="text-[11px] py-1 font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-800">Borders</TabsTrigger>
            <TabsTrigger value="background" className="text-[11px] py-1 font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-800">Backgrounds</TabsTrigger>
          </TabsList>

          <TabsContent value={activeSubTab} className="mt-4">
            {items.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 font-semibold border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                You don't own any {activeSubTab} cosmetics yet.
                <button
                  type="button"
                  onClick={() => {
                    const params = new URLSearchParams(window.location.search);
                    params.set("tab", "gacha");
                    window.location.search = params.toString();
                  }}
                  className="block mx-auto mt-2 text-xs font-bold text-violet-600 hover:text-violet-700"
                >
                  Spin Gacha Royale to get some!
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {items.map((item) => (
                  <div key={item.id} className={`p-3 border rounded-xl flex items-center justify-between transition-all ${item.isEquipped ? "border-violet-300 bg-violet-50/10 shadow-sm" : "border-slate-100 bg-white"}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded border ${getRarityColor(item.rarity)}`}>
                          Tier {item.rarity}
                        </span>
                        <h4 className="text-xs font-bold text-slate-800 truncate">{item.name}</h4>
                      </div>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1 truncate">{item.description}</p>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleEquip(item.id, item.isEquipped)}
                      disabled={equipCosmetic.isPending}
                      className={`h-7 px-3 text-[10px] font-bold rounded-lg shrink-0 ml-3 ${
                        item.isEquipped
                          ? "bg-slate-200 hover:bg-slate-300 text-slate-700"
                          : "bg-violet-600 hover:bg-violet-700 text-white"
                      }`}
                    >
                      {item.isEquipped ? "Unequip" : "Equip"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function GachaTab() {
  const { data: board, isLoading, refetch } = useGetGachaBoard();
  const { data: user, refetch: refetchMe } = useGetMe();
  const claimDiamonds = useClaimDiamonds();
  const spinGacha = useSpinGacha();
  const equipCosmetic = useEquipCosmetic();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [spinResults, setSpinResults] = useState<any[] | null>(null);
  const [resultsModalOpen, setResultsModalOpen] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinCount, setSpinCount] = useState<1 | 10 | 25 | 50>(1);
  const [bulkOption, setBulkOption] = useState<10 | 25 | 50>(10);
  const [bulkDropdownOpen, setBulkDropdownOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<"S" | "A" | "B" | "C" | "D">("S");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [previewHadiahOpen, setPreviewHadiahOpen] = useState(false);
  
  // Equip won items state
  const [shouldEquipWon, setShouldEquipWon] = useState(true);
  const [skipAnimation, setSkipAnimation] = useState(false);
  const [crateExploded, setCrateExploded] = useState(false);
  const [flyingDiamonds, setFlyingDiamonds] = useState<boolean>(false);

  // Audio Context helper
  const playSound = (type: "charge" | "explosion" | "reveal" | "click" | "rare") => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      if (type === "click") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === "charge") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(100, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 2.0);
        
        filter.type = "lowpass";
        filter.Q.setValueAtTime(5, ctx.currentTime);
        filter.frequency.setValueAtTime(150, ctx.currentTime);
        filter.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 2.0);
        
        gain.gain.setValueAtTime(0.01, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 1.8);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 2.0);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(ctx.currentTime + 2.0);
      } else if (type === "explosion") {
        const bufferSize = ctx.sampleRate * 1.5;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(800, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 1.2);
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.4);
        
        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();
        subOsc.type = "sine";
        subOsc.frequency.setValueAtTime(120, ctx.currentTime);
        subOsc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.5);
        subGain.gain.setValueAtTime(0.4, ctx.currentTime);
        subGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        
        subOsc.connect(subGain);
        subGain.connect(ctx.destination);
        
        noise.start();
        noise.stop(ctx.currentTime + 1.5);
        
        subOsc.start();
        subOsc.stop(ctx.currentTime + 0.6);
      } else if (type === "reveal") {
        const now = ctx.currentTime;
        const notes = [440, 554.37, 659.25, 880];
        notes.forEach((freq, index) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.0, now + index * 0.08);
          gain.gain.linearRampToValueAtTime(0.08, now + index * 0.08 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + index * 0.08);
          osc.stop(now + index * 0.08 + 0.5);
        });
      } else if (type === "rare") {
        const now = ctx.currentTime;
        const chords = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
        chords.forEach((freq, index) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.value = freq;
          osc.detune.value = (Math.random() - 0.5) * 15;
          
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.05, now + 0.1 + index * 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5 + index * 0.05);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 2.0);
        });
      }
    } catch (e) {
      console.error("Audio Context Error", e);
    }
  };

  useEffect(() => {
    if (board && board.cosmetics.length > 0 && !selectedItem) {
      const sTiers = board.cosmetics.filter((c: any) => c.rarity === "S");
      if (sTiers.length > 0) setSelectedItem(sTiers[0]);
      else setSelectedItem(board.cosmetics[0]);
    }
  }, [board, selectedItem]);

  if (isLoading || !board) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[350px] w-full rounded-2xl animate-pulse" />
      </div>
    );
  }

  const handleClaimDiamonds = async () => {
    playSound("click");
    try {
      const res = await claimDiamonds.mutateAsync();
      if (res && res.diamonds !== undefined) {
        queryClient.setQueryData(["/api/gacha/board"], (old: any) => {
          if (!old) return old;
          return { ...old, diamonds: res.diamonds };
        });
        queryClient.setQueryData(["/api/me"], (old: any) => {
          if (!old) return old;
          return { ...old, diamonds: res.diamonds };
        });
      }
      toast({
        title: "Diamonds claimed! 💎",
        description: "You've received +1,000 Diamonds for testing."
      });
      await refetch();
      await refetchMe();
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
    } catch (err: any) {
      toast({
        title: "Claim failed",
        description: err.message || "Failed to claim test diamonds.",
        variant: "destructive"
      });
    }
  };

  const handleSpin = async (count: 1 | 10 | 25 | 50) => {
    playSound("click");
    let cost = 9;
    if (count === 10) cost = 79;
    else if (count === 25) cost = 195;
    else if (count === 50) cost = 390;

    if ((board.diamonds ?? 0) < cost) {
      toast({
        title: "Insufficient Diamonds",
        description: `Spinning ${count}x costs ${cost} 💎, but you only have ${board.diamonds} 💎. Claim free diamonds first!`,
        variant: "destructive"
      });
      return;
    }

    setSpinCount(count);
    setIsSpinning(true);
    setSkipAnimation(false);
    setCrateExploded(false);
    setFlyingDiamonds(false);
    
    playSound("charge");

    // Optimistic balance deduction: subtract cost immediately!
    queryClient.setQueryData(["/api/gacha/board"], (old: any) => {
      if (!old) return old;
      return { ...old, diamonds: Math.max(0, (old.diamonds ?? 0) - cost) };
    });
    queryClient.setQueryData(["/api/me"], (old: any) => {
      if (!old) return old;
      return { ...old, diamonds: Math.max(0, (old.diamonds ?? 0) - cost) };
    });

    let spinResponse: any = null;
    let apiError: any = null;
    
    const apiPromise = spinGacha.mutateAsync({ data: { count } })
      .then(res => { spinResponse = res; })
      .catch(err => { apiError = err; });

    const animationTimeout = setTimeout(() => {
      triggerExplosion(apiPromise, () => spinResponse, () => apiError);
    }, 2500);

    (window as any).skipGachaAnim = () => {
      clearTimeout(animationTimeout);
      triggerExplosion(apiPromise, () => spinResponse, () => apiError);
    };
  };

  const triggerExplosion = async (apiPromise: Promise<void>, getResponse: () => any, getError: () => any) => {
    setSkipAnimation(true);
    await apiPromise;
    const err = getError();
    const res = getResponse();

    if (err) {
      toast({
        title: "Spin failed",
        description: err.message || "Failed to roll gacha.",
        variant: "destructive"
      });
      setIsSpinning(false);
      // Restore the diamonds if the spin API fails by refetching actual backend data
      refetch();
      refetchMe();
      return;
    }

    setCrateExploded(true);
    playSound("explosion");

    setTimeout(() => {
      const hasRare = res.results?.some((r: any) => r.cosmetic.rarity === "S" || r.cosmetic.rarity === "A");
      if (hasRare) {
        playSound("rare");
      } else {
        playSound("reveal");
      }
    }, 100);

    setTimeout(async () => {
      setSpinResults(res.results ?? []);
      setResultsModalOpen(true);
      setIsSpinning(false);
      
      if (shouldEquipWon && res.results) {
        const newUnlocks = res.results.filter((r: any) => !r.isDuplicate);
        if (newUnlocks.length > 0) {
          const rarityWeight = { S: 5, A: 4, B: 3, C: 2, D: 1 };
          newUnlocks.sort((x: any, y: any) => 
            (rarityWeight[y.cosmetic.rarity as keyof typeof rarityWeight] || 0) - 
            (rarityWeight[x.cosmetic.rarity as keyof typeof rarityWeight] || 0)
          );
          
          const itemToEquip = newUnlocks[0].cosmetic;
          try {
            await equipCosmetic.mutateAsync({ id: itemToEquip.id, data: { equip: true } });
          } catch (e) {
            console.error("Failed to auto-equip item:", e);
          }
        }
      }

      if (res && res.diamonds !== undefined) {
        queryClient.setQueryData(["/api/gacha/board"], (old: any) => {
          if (!old) return old;
          return { ...old, diamonds: res.diamonds };
        });
        queryClient.setQueryData(["/api/me"], (old: any) => {
          if (!old) return old;
          return { ...old, diamonds: res.diamonds };
        });
      }
      await refetch();
      await refetchMe();
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/cosmetics"] });
      
      if (res.refunded > 0) {
        setFlyingDiamonds(true);
        setTimeout(() => setFlyingDiamonds(false), 2000);
      }
    }, 600);
  };

  const tiers = {
    S: board.cosmetics.filter((c: any) => c.rarity === "S"),
    A: board.cosmetics.filter((c: any) => c.rarity === "A"),
    B: board.cosmetics.filter((c: any) => c.rarity === "B"),
    C: board.cosmetics.filter((c: any) => c.rarity === "C"),
    D: board.cosmetics.filter((c: any) => c.rarity === "D"),
  };

  const ownedIds = new Set(board.ownedCosmeticIds || []);

  const getTierBadgeStyle = (tier: string) => {
    switch (tier) {
      case "S": return "bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 text-white font-extrabold shadow-sm animate-pulse";
      case "A": return "bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold";
      case "B": return "bg-purple-500 text-white font-bold";
      case "C": return "bg-blue-500 text-white font-semibold";
      default: return "bg-slate-400 text-white font-medium";
    }
  };

  const getRarityLabel = (tier: string) => {
    switch (tier) {
      case "S": return "S-Tier (1.5%)";
      case "A": return "A-Tier (6.5%)";
      case "B": return "B-Tier (17%)";
      case "C": return "C-Tier (35%)";
      default: return "D-Tier (40%)";
    }
  };

  const renderCosmeticPreview = (item: any, size: "sm" | "lg" = "lg") => {
    const isLg = size === "lg";
    if (item.type === "border") {
      return (
        <div className={`relative flex items-center justify-center rounded-full ${isLg ? "w-24 h-24 p-2" : "w-12 h-12 p-1"}`}>
          <div className={`w-full h-full rounded-full bg-slate-900 border-2 flex items-center justify-center overflow-hidden border-slate-700 ${item.value}`}>
            <span className={`${isLg ? "text-[10px]" : "text-[6px]"} font-black text-purple-305/80 uppercase tracking-widest select-none`}>
              Border
            </span>
          </div>
        </div>
      );
    }
    
    if (item.type === "badge") {
      return (
        <div className="flex flex-col items-center justify-center py-2">
          <span className={`px-4 py-1 rounded-lg border text-center font-black uppercase tracking-wider select-none ${isLg ? "text-xs px-5 py-2 shadow-lg" : "text-[8px] px-2 py-0.5"} ${item.value}`}>
            {item.name}
          </span>
        </div>
      );
    }
    
    if (item.type === "background") {
      return (
        <div className={`relative overflow-hidden rounded-xl border border-purple-500/20 bg-slate-950 shadow-inner flex flex-col justify-end items-center ${isLg ? "w-36 h-20" : "w-20 h-11"}`}>
          <img src={item.value} alt="" className="absolute inset-0 w-full h-full object-cover opacity-65" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent animate-pulse" />
          <span className={`relative z-10 font-black text-slate-350 uppercase tracking-widest select-none ${isLg ? "text-[9px] mb-2" : "text-[5px] mb-1"}`}>
            BG CARD
          </span>
        </div>
      );
    }

    return (
      <div className={`rounded-xl bg-purple-950/40 border border-purple-500/10 flex items-center justify-center shadow-inner select-none ${isLg ? "w-16 h-16 text-3xl" : "w-10 h-10 text-xl"}`}>
        🎁
      </div>
    );
  };

  const isTierFullyOwned = (tierKey: keyof typeof tiers) => {
    const list = tiers[tierKey];
    if (list.length === 0) return false;
    return list.every((item: any) => ownedIds.has(item.id));
  };

  const renderTierCard = (tierKey: "S" | "A" | "B" | "C" | "D") => {
    const tierList = tiers[tierKey];
    const ownedCount = tierList.filter(c => ownedIds.has(c.id)).length;
    const totalCount = tierList.length;
    const isOwned = totalCount > 0 && ownedCount === totalCount;
    const isActive = selectedTier === tierKey;

    const previewItem = selectedItem && selectedItem.rarity === tierKey ? selectedItem : tierList[0];

    let theme = {
      border: "border-slate-800",
      bg: "bg-slate-900/40",
      text: "text-slate-400",
      badge: "bg-slate-800 text-slate-400 border-slate-700",
      glow: "",
      accentColor: "slate",
      hover: "hover:border-slate-700 hover:bg-slate-900/60"
    };

    if (tierKey === "S") {
      theme = {
        border: isActive ? "border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]" : "border-amber-500/30",
        bg: isActive ? "bg-amber-950/20" : "bg-[#161208]/80",
        text: "text-amber-400 font-extrabold",
        badge: "bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 text-slate-950 border-amber-350 font-black",
        glow: "shadow-[inset_0_0_15px_rgba(245,158,11,0.1)]",
        accentColor: "amber",
        hover: "hover:border-amber-400 hover:bg-amber-950/10"
      };
    } else if (tierKey === "A") {
      theme = {
        border: isActive ? "border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.5)]" : "border-pink-500/30",
        bg: isActive ? "bg-pink-950/20" : "bg-[#180a12]/80",
        text: "text-pink-400 font-extrabold",
        badge: "bg-gradient-to-r from-pink-500 to-rose-500 text-white border-pink-400 font-bold",
        glow: "shadow-[inset_0_0_15px_rgba(236,72,153,0.1)]",
        accentColor: "pink",
        hover: "hover:border-pink-400 hover:bg-pink-950/10"
      };
    } else if (tierKey === "B") {
      theme = {
        border: isActive ? "border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]" : "border-purple-500/30",
        bg: isActive ? "bg-purple-950/20" : "bg-[#100818]/80",
        text: "text-purple-400 font-extrabold",
        badge: "bg-gradient-to-r from-purple-500 to-violet-600 text-white border-purple-400 font-bold",
        glow: "shadow-[inset_0_0_15px_rgba(168,85,247,0.1)]",
        accentColor: "purple",
        hover: "hover:border-purple-400 hover:bg-purple-950/10"
      };
    } else if (tierKey === "C") {
      theme = {
        border: isActive ? "border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.5)]" : "border-cyan-500/30",
        bg: isActive ? "bg-cyan-950/20" : "bg-[#08121a]/80",
        text: "text-cyan-400 font-extrabold",
        badge: "bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 border-cyan-400 font-bold",
        glow: "shadow-[inset_0_0_15px_rgba(6,182,212,0.1)]",
        accentColor: "cyan",
        hover: "hover:border-cyan-400 hover:bg-cyan-950/10"
      };
    } else if (tierKey === "D") {
      theme = {
        border: isActive ? "border-slate-400 shadow-[0_0_15px_rgba(148,163,184,0.4)]" : "border-slate-500/20",
        bg: isActive ? "bg-slate-800/20" : "bg-slate-900/60",
        text: "text-slate-350 font-extrabold",
        badge: "bg-slate-700 text-slate-200 border-slate-650 font-medium",
        glow: "",
        accentColor: "slate",
        hover: "hover:border-slate-400 hover:bg-slate-800/30"
      };
    }

    return (
      <button
        type="button"
        onClick={() => {
          playSound("click");
          setSelectedTier(tierKey);
          if (previewItem) {
            setSelectedItem(previewItem);
          }
        }}
        className={`relative w-full rounded-xl p-3 border text-left transition-all flex items-center justify-between overflow-hidden select-none cursor-pointer group ${theme.border} ${theme.bg} ${theme.hover} ${theme.glow} ${
          isOwned ? "opacity-90" : ""
        }`}
      >
        <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-current opacity-5 pointer-events-none" />

        <div className="flex items-center gap-3 relative z-10">
          <div className={`px-3 py-1 rounded text-[10px] font-black border uppercase tracking-wider ${theme.badge} -skew-x-12`}>
            <span className="inline-block skew-x-12">{tierKey} TIER</span>
          </div>

          <div className="flex flex-col">
            <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider leading-none">DIMILIKI</span>
            <span className={`text-xs font-black tracking-tight mt-0.5 ${theme.text}`}>
              {ownedCount} / {totalCount}
            </span>
          </div>
        </div>

        {previewItem && (
          <div className="flex items-center gap-2 relative z-10 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-black/60 border border-purple-500/15 flex items-center justify-center p-0.5 relative group-hover:scale-105 transition-transform">
              {renderCosmeticPreview(previewItem, "sm")}
              {ownedIds.has(previewItem.id) && (
                <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black border border-slate-900">
                  ✓
                </span>
              )}
            </div>
          </div>
        )}

        {isOwned && (
          <div className="absolute top-1 right-1 border border-emerald-500/40 text-emerald-400 bg-emerald-950/80 font-black text-[7px] tracking-wider px-1 py-0.2 rounded uppercase -skew-x-6">
            FULL OWNED
          </div>
        )}
      </button>
    );
  };

  const totalRewards = board.cosmetics.length;
  const ownedRewards = board.ownedCosmeticIds.length;
  const remainingRewards = totalRewards - ownedRewards;

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-fade-in-card {
          opacity: 0;
          animation: fadeIn 0.3s ease-out forwards;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes gacha-float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(2deg); }
        }
        @keyframes gacha-shake {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          10% { transform: translate(-3px, -2px) rotate(-1deg); }
          20% { transform: translate(3px, 2px) rotate(1deg); }
          30% { transform: translate(-3px, 1px) rotate(-1deg); }
          40% { transform: translate(2px, -1px) rotate(1deg); }
          50% { transform: translate(-1px, 2px) rotate(0deg); }
          60% { transform: translate(3px, 1px) rotate(1deg); }
          70% { transform: translate(-2px, -1px) rotate(-1deg); }
          80% { transform: translate(1px, 2px) rotate(1deg); }
          90% { transform: translate(-1px, -2px) rotate(-1deg); }
        }
        @keyframes gacha-spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes diamond-fly {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          10% { transform: translate(-20px, 30px) scale(1.2); }
          100% { transform: translate(var(--target-x), var(--target-y)) scale(0.6); opacity: 0; }
        }
        .animate-gacha-float {
          animation: gacha-float 3s ease-in-out infinite;
        }
        .animate-gacha-shake {
          animation: gacha-shake 0.3s linear infinite;
        }
        .animate-spin-slow {
          animation: gacha-spin-slow 20s linear infinite;
        }
        .preview-glow-ring {
          box-shadow: 0 0 30px 5px rgba(6, 182, 212, 0.4), inset 0 0 15px rgba(6, 182, 212, 0.3);
        }
        .cyber-slant-bg {
          clip-path: polygon(0 0, 100% 0, 96% 100%, 0 100%);
        }
        .stamp-dimiliki {
          box-shadow: 0 0 10px rgba(245, 158, 11, 0.4);
          text-shadow: 0 2px 4px rgba(0,0,0,0.8);
        }
        .flying-diamond-particle {
          animation: diamond-fly 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }
        .diagonal-neon-banner {
          clip-path: polygon(0 0, 92% 0, 100% 100%, 0 100%);
          background: linear-gradient(135deg, rgba(236,72,153,0.95) 0%, rgba(168,85,247,0.95) 70%, rgba(168,85,247,0) 100%);
          text-shadow: 0 0 8px rgba(236, 72, 153, 0.8);
          box-shadow: 0 0 20px rgba(168, 85, 247, 0.4);
        }
      `}</style>

      {/* FLYING DIAMONDS PARTICLE OVERLAY */}
      {flyingDiamonds && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {Array.from({ length: 12 }).map((_, i) => {
            const startX = window.innerWidth / 2 + (Math.random() - 0.5) * 200;
            const startY = window.innerHeight / 2 + (Math.random() - 0.5) * 200;
            const targetX = window.innerWidth - startX - 80;
            const targetY = 40 - startY;
            return (
              <div
                key={i}
                className="absolute text-lg text-amber-300 font-bold flying-diamond-particle"
                style={{
                  left: `${startX}px`,
                  top: `${startY}px`,
                  "--target-x": `${targetX}px`,
                  "--target-y": `${targetY}px`,
                  animationDelay: `${i * 0.08}s`
                } as any}
              >
                💎
              </div>
            );
          })}
        </div>
      )}

      {/* HEADER BANNER */}
      <div className="relative rounded-2xl bg-gradient-to-br from-[#1b1528] via-[#100b1a] to-[#07040d] p-6 md:p-8 text-white overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-purple-500/20">
        <div className="absolute right-0 top-0 w-1/3 h-full opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-purple-500 to-transparent pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          <div className="space-y-4 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black tracking-widest uppercase border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                ⚡ RUSH BOARD EVENT
              </div>
              
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-black tracking-widest uppercase border border-rose-500/30">
                ⏳ ENDS IN: 7d 6h
              </div>

              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-black tracking-widest uppercase border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)] animate-pulse">
                BOARD SELANJUTNYA &gt;&gt;
              </div>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-purple-400 uppercase flex items-center gap-3 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] transform -skew-x-6">
              RUSH BOARD
            </h1>
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 max-w-xl">
              <div className="diagonal-neon-banner text-white px-5 py-2 uppercase font-black tracking-wider text-[11px] select-none flex items-center shrink-0 min-w-[260px]">
                {remainingRewards} / {totalRewards} HADIAH TERSISA &gt;&gt;
              </div>

              <Button
                onClick={() => setPreviewHadiahOpen(true)}
                className="bg-purple-900/40 hover:bg-purple-900/60 border border-purple-500/30 text-xs font-black text-purple-200 px-4 py-2 rounded-xl transition-all self-start sm:self-auto"
              >
                PREVIEW POOL
              </Button>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-4 bg-purple-950/40 border border-purple-500/30 rounded-2xl p-4 backdrop-blur-md self-start md:self-auto min-w-[225px] justify-between shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-purple-300 uppercase tracking-widest leading-none">Your Diamonds</span>
              <span className="text-2xl font-black text-amber-300 mt-1 flex items-center gap-1.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                {board.diamonds ?? 0} <span className="text-xl">💎</span>
              </span>
            </div>

            <Button
              onClick={handleClaimDiamonds}
              disabled={claimDiamonds.isPending}
              className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-900 font-black text-xs px-4 py-2.5 rounded-xl h-auto shadow-lg shadow-amber-500/35 border-t border-white/20 active:scale-95 transition-transform"
            >
              {claimDiamonds.isPending ? "..." : "+ 1,000 💎"}
            </Button>
          </div>
        </div>
      </div>

      {/* DUAL PANE DASHBOARD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* LEFT PANEL - TIERS LIST & SUB-GRID POOL */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div className="flex-grow bg-[#0f0a1a]/90 border border-purple-500/20 shadow-2xl rounded-2xl p-5 backdrop-blur-md relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none rounded-full" />
            
            <div>
              <h2 className="text-xs font-black text-purple-300 uppercase tracking-widest mb-4 border-b border-purple-500/10 pb-2 flex items-center justify-between">
                <span>RUSH BOARD TIER MAP</span>
                <span className="text-[10px] text-purple-400 font-extrabold">CLICK TIER TO SEE POOL</span>
              </h2>
              
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="col-span-2">
                  {renderTierCard("S")}
                </div>
                <div className="col-span-1">
                  {renderTierCard("A")}
                </div>
                <div className="col-span-1">
                  {renderTierCard("B")}
                </div>
                <div className="col-span-1">
                  {renderTierCard("C")}
                </div>
                <div className="col-span-1">
                  {renderTierCard("D")}
                </div>
              </div>
            </div>

            {/* NEON SUB-GRID OF REWARDS POOL */}
            <div className="bg-[#0b0713]/90 border border-purple-500/15 rounded-xl p-4 min-h-[260px] mt-2">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-400">
                  {selectedTier}-Tier Items Pool ({tiers[selectedTier].length} items)
                </span>
                <span className="text-[9px] text-purple-200/40">Select item to preview details</span>
              </div>

              {tiers[selectedTier].length === 0 ? (
                <div className="flex items-center justify-center min-h-[200px] text-slate-500 text-xs font-bold">
                  No items in this tier.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {tiers[selectedTier].map((item: any) => {
                    const isOwned = ownedIds.has(item.id);
                    const isSelected = selectedItem?.id === item.id;
                    
                    let rarityBorder = "border-purple-500/10 bg-purple-950/10 hover:border-purple-500/40";
                    if (isSelected) {
                      if (selectedTier === "S") rarityBorder = "border-amber-500 bg-amber-500/10 shadow-[0_0_10px_rgba(245,158,11,0.2)]";
                      else if (selectedTier === "A") rarityBorder = "border-pink-500 bg-pink-500/10 shadow-[0_0_10px_rgba(236,72,153,0.2)]";
                      else if (selectedTier === "B") rarityBorder = "border-purple-500 bg-purple-500/10 shadow-[0_0_10px_rgba(168,85,247,0.2)]";
                      else if (selectedTier === "C") rarityBorder = "border-cyan-500 bg-cyan-500/10 shadow-[0_0_10px_rgba(6,182,212,0.2)]";
                      else rarityBorder = "border-slate-400 bg-slate-450/10 shadow-[0_0_10px_rgba(148,163,184,0.2)]";
                    }

                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          playSound("click");
                          setSelectedItem(item);
                        }}
                        className={`relative rounded-xl p-3 border flex flex-col justify-between items-center text-center cursor-pointer transition-all aspect-square select-none ${rarityBorder}`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-black/40 flex items-center justify-center border border-purple-500/5 text-lg relative">
                          {item.type === "badge" ? "🛡️" : item.type === "border" ? "🖼️" : "🖼️"}
                          {isOwned && (
                            <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black border border-[#0b0713]">
                              ✓
                            </span>
                          )}
                        </div>

                        <div className="w-full mt-2 min-w-0">
                          <p className="text-[10px] font-black text-slate-100 truncate w-full leading-tight">
                            {item.name}
                          </p>
                          <span className="text-[8px] font-bold text-purple-300/60 uppercase block mt-0.5">
                            {item.type}
                          </span>
                        </div>

                        {!isOwned && (
                          <span className="absolute top-1 right-1 text-[8px] opacity-40">🔒</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* SPIN CONTROLS PANEL */}
          <div className="bg-[#0f0a1a]/95 border border-purple-500/20 shadow-2xl rounded-2xl p-5 relative overflow-visible">
            <div className="flex justify-between items-center mb-4">
              <div className="flex flex-col">
                <span className="text-xs font-black text-purple-300 uppercase tracking-widest">SUMMON CONTROLS</span>
                <span className="text-[10px] text-slate-400 font-semibold mt-0.5">Discounts increase with bulk tiers</span>
              </div>
              
              <div className="flex items-center gap-2 text-[10px] text-purple-300 font-black">
                <input
                  type="checkbox"
                  id="auto-equip-check"
                  checked={shouldEquipWon}
                  onChange={(e) => setShouldEquipWon(e.target.checked)}
                  className="rounded border-purple-500 text-purple-600 bg-[#06040a] focus:ring-0 cursor-pointer"
                />
                <label htmlFor="auto-equip-check" className="cursor-pointer select-none">
                  Auto-Equip Won Items
                </label>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-4 relative overflow-visible">
              <div className="col-span-5">
                <button
                  type="button"
                  onClick={() => handleSpin(1)}
                  disabled={isSpinning}
                  className="w-full py-4 rounded-xl bg-gradient-to-br from-cyan-600 to-purple-800 hover:from-cyan-500 hover:to-purple-700 text-white border border-cyan-400/30 shadow-[0_4px_15px_rgba(6,182,212,0.25)] flex flex-col items-center justify-center cursor-pointer active:scale-[0.97] transition-all disabled:opacity-50 select-none group -skew-x-12"
                >
                  <span className="text-xs font-black uppercase italic tracking-wider group-hover:scale-105 transition-transform skew-x-12">
                    1 SPIN
                  </span>
                  <span className="text-xs font-black text-cyan-300 mt-1.5 flex items-center gap-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] skew-x-12">
                    9 <span className="text-[10px]">💎</span>
                  </span>
                </button>
              </div>

              <div className="col-span-7 flex relative overflow-visible">
                <button
                  type="button"
                  onClick={() => handleSpin(bulkOption)}
                  disabled={isSpinning}
                  className="flex-1 py-4 rounded-l-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 border-t border-b border-l border-amber-400/20 shadow-[0_4px_20px_rgba(245,158,11,0.25)] flex flex-col items-center justify-center cursor-pointer active:scale-[0.98] transition-all disabled:opacity-50 select-none group -skew-x-12"
                >
                  <span className="text-xs font-black uppercase italic tracking-wider group-hover:scale-105 transition-transform skew-x-12">
                    {bulkOption} SPIN
                  </span>
                  <span className="text-xs font-black text-slate-950 mt-1.5 flex items-center gap-1 skew-x-12">
                    {bulkOption === 10 ? 79 : bulkOption === 25 ? 195 : 390} <span className="text-[10px]">💎</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playSound("click");
                    setBulkDropdownOpen(!bulkDropdownOpen);
                  }}
                  disabled={isSpinning}
                  className="px-3 rounded-r-xl bg-amber-500 hover:bg-amber-400 border-l border-amber-955/20 border-t border-b border-r border-amber-400/20 text-slate-950 flex items-center justify-center cursor-pointer disabled:opacity-50 select-none -skew-x-12"
                >
                  <span className={`text-[10px] skew-x-12 transition-transform duration-200 ${bulkDropdownOpen ? "rotate-180" : ""}`}>▼</span>
                </button>

                {bulkDropdownOpen && (
                  <div className="absolute right-0 bottom-full mb-3 bg-[#120a22] border-2 border-amber-500/40 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.9)] z-50 overflow-hidden w-56 py-1 divide-y divide-purple-500/10">
                    {[10, 25, 50].map((option: any) => {
                      let cost = 79;
                      if (option === 25) cost = 195;
                      else if (option === 50) cost = 390;
                      
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            playSound("click");
                            setBulkOption(option);
                            setBulkDropdownOpen(false);
                          }}
                          className={`w-full px-4 py-3.5 text-left text-xs font-black flex items-center justify-between hover:bg-purple-950/60 transition-colors ${
                            bulkOption === option ? "text-amber-400" : "text-purple-200"
                          }`}
                        >
                          <span>{option} SPINS Option</span>
                          <span className="text-amber-400 font-extrabold">{cost} 💎</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL - PREVIEW STAND */}
        <div className="lg:col-span-5 flex flex-col h-full min-h-[460px]">
          <div className="flex-grow bg-gradient-to-b from-[#1b1528] to-[#07040d] border border-purple-500/20 shadow-2xl rounded-2xl overflow-hidden backdrop-blur-md relative flex flex-col justify-between">
            
            {/* Cyber Grid Background */}
            <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none z-0" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(168,85,247,0.15)_0%,_transparent_70%)] pointer-events-none z-0" />

            <div className="p-4 border-b border-purple-500/10 bg-black/40 flex items-center justify-between relative z-10">
              <span className="text-[10px] font-black text-purple-300 uppercase tracking-widest">
                ❖ COSMETIC PREVIEW SHOWCASE
              </span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
            </div>

            {/* Avatar stand display */}
            <div className="flex-grow flex flex-col items-center justify-center p-6 relative z-10 min-h-[300px]">
              
              {selectedItem && selectedItem.type === "background" ? (
                <div className="absolute inset-0 z-0">
                  <img
                    src={selectedItem.value}
                    alt=""
                    className="w-full h-full object-cover opacity-50"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#07040d] via-transparent to-[#07040d]/40" />
                </div>
              ) : user?.equippedBackground ? (
                <div className="absolute inset-0 z-0">
                  <img
                    src={user.equippedBackground}
                    alt=""
                    className="w-full h-full object-cover opacity-35"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#07040d] via-transparent to-[#07040d]/40" />
                </div>
              ) : null}

              {/* Hologram/Cyber Stand lines */}
              <div className="absolute bottom-20 w-48 h-12 rounded-full border-2 border-cyan-500/30 bg-cyan-500/5 rotate-[-5deg] preview-glow-ring animate-pulse pointer-events-none" />
              <div className="absolute bottom-24 w-40 h-8 rounded-full border border-purple-500/20 bg-purple-500/5 rotate-[-5deg] pointer-events-none" />

              <div className="absolute bottom-0 w-2 h-20 bg-gradient-to-t from-cyan-500/0 via-cyan-500/20 to-cyan-500/0 blur-sm pointer-events-none" />

              <div className="relative animate-gacha-float flex flex-col items-center z-10">
                <div className={`w-36 h-36 rounded-full flex items-center justify-center bg-black/80 p-1.5 border-2 border-purple-500/20 shadow-[0_0_30px_rgba(168,85,247,0.3)] overflow-visible relative transition-all duration-300 ${
                  selectedItem && selectedItem.type === "border" ? selectedItem.value : (user?.equippedBorder || "")
                }`}>
                  <Avatar className="w-full h-full rounded-full">
                    <AvatarImage src={user?.avatarUrl || undefined} />
                    <AvatarFallback className="text-3xl bg-purple-900/60 font-black text-purple-200">
                      {getInitials(user?.displayName || user?.username)}
                    </AvatarFallback>
                  </Avatar>

                  {selectedItem && selectedItem.type === "badge" ? (
                    <span className={`absolute -bottom-2 -right-2 text-[10px] px-2.5 py-1 rounded border border-purple-300 font-black uppercase tracking-wider ${selectedItem.value} shadow-md`}>
                      {selectedItem.name}
                    </span>
                  ) : user?.equippedBadge ? (
                    <span className={`absolute -bottom-2 -right-2 text-[10px] px-2.5 py-1 rounded border border-purple-300 font-black uppercase tracking-wider ${user.equippedBadge} shadow-md`}>
                      {(() => {
                        const match = board.cosmetics.find(c => c.value === user.equippedBadge);
                        return match ? match.name : "Active Badge";
                      })()}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Bottom floating details & yellow-accented tag pill */}
            <div className="p-5 bg-black/60 border-t border-purple-500/10 backdrop-blur-md relative z-10 flex flex-col items-center">
              {selectedItem ? (
                <div className="w-full flex flex-col items-center space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 border-2 border-yellow-500 bg-yellow-500/10 rounded-full shadow-[0_0_15px_rgba(234,179,8,0.2)] -skew-x-12">
                    <span className="text-[11px] font-black text-yellow-400 uppercase tracking-widest skew-x-12">
                      {selectedItem.name}
                    </span>
                  </div>

                  <div className="text-center space-y-1">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded border ${getTierBadgeStyle(selectedItem.rarity)}`}>
                        Tier {selectedItem.rarity}
                      </span>
                      <span className="text-[9px] font-extrabold text-slate-450 uppercase tracking-wider">
                        {selectedItem.type}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-350 max-w-xs mx-auto leading-relaxed">
                      {selectedItem.description || "Kosmetik eksklusif dari gacha royale."}
                    </p>
                  </div>

                  <div className="w-full pt-2 flex justify-center">
                    {ownedIds.has(selectedItem.id) ? (
                      (() => {
                        const isEquipped = (selectedItem.type === "badge" && user?.equippedBadge === selectedItem.value) ||
                                           (selectedItem.type === "border" && user?.equippedBorder === selectedItem.value) ||
                                           (selectedItem.type === "background" && user?.equippedBackground === selectedItem.value);
                        
                        return (
                          <Button
                            onClick={async () => {
                              playSound("click");
                              try {
                                await equipCosmetic.mutateAsync({ id: selectedItem.id, data: { equip: !isEquipped } });
                                toast({
                                  title: isEquipped ? "Cosmetic unequipped!" : "Cosmetic equipped!",
                                  description: "Inventory configuration updated successfully."
                                });
                                await refetchMe();
                              } catch (e) {
                                toast({ title: "Failed to equip", variant: "destructive" });
                              }
                            }}
                            disabled={equipCosmetic.isPending}
                            className={`w-full py-5 text-xs font-black rounded-xl uppercase tracking-widest transition-all -skew-x-12 ${
                              isEquipped
                                ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                                : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black shadow-md shadow-emerald-500/20"
                            }`}
                          >
                            <span className="inline-block skew-x-12">
                              {isEquipped ? "UNEQUIP COSMETIC" : "EQUIP COSMETIC"}
                            </span>
                          </Button>
                        );
                      })()
                    ) : (
                      <div className="w-full text-center py-2 px-4 bg-slate-950/60 border border-purple-500/10 rounded-xl text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        🔒 SPIN GACHA UNTUK MEMBUKA ITEM INI
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-xs text-slate-500 font-black">
                  NO COSMETIC SELECTED FOR PREVIEW
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* FULLSCREEN CRATE OPENING ANIMATION OVERLAY */}
      {isSpinning && (
        <div className="fixed inset-0 bg-black/95 z-[99] flex flex-col items-center justify-center p-4">
          <div className="absolute w-80 h-80 rounded-full border border-purple-500/10 blur-[10px] animate-spin-slow pointer-events-none" />
          <div className="absolute w-64 h-64 rounded-full border border-cyan-500/5 blur-[5px] animate-spin pointer-events-none" style={{ animationDirection: "reverse", animationDuration: "12s" }} />

          <div className="relative flex flex-col items-center">
            <div className="absolute -top-64 w-32 h-[500px] bg-gradient-to-b from-purple-500/0 via-purple-500/5 to-purple-500/20 blur-xl pointer-events-none" style={{ clipPath: "polygon(40% 0, 60% 0, 100% 100%, 0 100%)" }} />

            <div className="absolute bottom-[-20px] w-48 h-12 rounded-full bg-purple-500/10 blur-[2px] border-2 border-purple-500/20 rotate-[-5deg] preview-glow-ring pointer-events-none" />

            <div className={`w-36 h-36 flex items-center justify-center relative ${
              crateExploded ? "scale-150 opacity-0 transition-all duration-300" : "animate-gacha-float"
            }`}>
              <div className={`${crateExploded ? "" : "animate-gacha-shake"} relative w-full h-full flex items-center justify-center`}>
                <div className="w-24 h-24 bg-gradient-to-br from-[#29184d] to-[#120726] border-2 border-purple-400 rounded-xl relative shadow-[0_0_40px_rgba(168,85,247,0.5),_inset_0_0_15px_rgba(168,85,247,0.3)] overflow-visible">
                  <div className="absolute inset-2 bg-gradient-to-tr from-purple-500 to-cyan-500 opacity-40 blur-sm rounded-lg animate-pulse" />
                  
                  <div className="absolute top-0 left-4 right-4 h-1 bg-cyan-400 shadow-[0_0_5px_#22d3ee] rounded-full" />
                  <div className="absolute bottom-0 left-4 right-4 h-1 bg-cyan-400 shadow-[0_0_5px_#22d3ee] rounded-full" />
                  
                  <div className="absolute -top-1 -left-1 w-3.5 h-3.5 border-t-2 border-l-2 border-cyan-400" />
                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 border-t-2 border-r-2 border-cyan-400" />
                  <div className="absolute -bottom-1 -left-1 w-3.5 h-3.5 border-b-2 border-l-2 border-cyan-400" />
                  <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 border-b-2 border-r-2 border-cyan-400" />
                  
                  <div className="absolute inset-0 m-auto w-6 h-6 rounded bg-[#0b0417] border border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.4)] flex items-center justify-center text-[10px] text-cyan-400 font-black animate-pulse">
                    ❖
                  </div>
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-transparent via-cyan-400/20 to-transparent blur-md transform scale-125 animate-pulse pointer-events-none" />
              </div>
            </div>
          </div>

          <p className="mt-16 text-sm font-black text-purple-300 tracking-widest uppercase animate-pulse drop-shadow-[0_2px_5px_rgba(168,85,247,0.5)]">
            Summoning items from the cosmic void...
          </p>

          <button
            onClick={() => {
              if ((window as any).skipGachaAnim) {
                (window as any).skipGachaAnim();
              }
            }}
            className="absolute bottom-12 px-6 py-2 border border-purple-500/30 bg-purple-950/20 hover:bg-purple-950/50 hover:border-purple-500/50 text-[10px] font-black uppercase text-purple-200 tracking-widest rounded-full cursor-pointer transition-all active:scale-95"
          >
            Tekan untuk lewati
          </button>
        </div>
      )}

      {/* RUSH REWARDS DETAIL PREVIEW MODAL */}
      <Dialog open={previewHadiahOpen} onOpenChange={(open) => { playSound("click"); if (!open) setPreviewHadiahOpen(false); }}>
        <DialogContent className="bg-[#120a22] border-purple-500/30 text-white max-w-md flex flex-col p-6 rounded-2xl shadow-2xl z-[100]">
          <DialogHeader className="pb-4 border-b border-purple-500/10">
            <DialogTitle className="text-base font-black text-white italic tracking-wide flex items-center gap-2">
              📋 PREVIEW HADIAH
            </DialogTitle>
            <p className="text-[10px] text-purple-300 font-bold uppercase tracking-wider mt-1">
              Board NO. 780608
            </p>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {(Object.keys(tiers) as Array<keyof typeof tiers>).map((tierKey) => {
              const tierList = tiers[tierKey];
              const ownedCount = tierList.filter(c => ownedIds.has(c.id)).length;
              const percent = tierList.length > 0 ? (ownedCount / tierList.length) * 100 : 0;
              
              let barColor = "bg-slate-400";
              if (tierKey === "S") barColor = "bg-gradient-to-r from-amber-500 to-yellow-500";
              else if (tierKey === "A") barColor = "bg-gradient-to-r from-pink-500 to-rose-500";
              else if (tierKey === "B") barColor = "bg-gradient-to-r from-purple-500 to-indigo-500";
              else if (tierKey === "C") barColor = "bg-gradient-to-r from-blue-500 to-sky-500";

              return (
                <div key={tierKey} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-black uppercase tracking-wide">
                    <span className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.2 rounded text-[9px] border leading-none ${getTierBadgeStyle(tierKey)}`}>
                        {tierKey}
                      </span>
                      <span className="text-purple-200">TIER</span>
                    </span>
                    <span className="text-purple-300/80">
                      {ownedCount} / {tierList.length}
                    </span>
                  </div>

                  <div className="h-3 bg-purple-950/60 rounded-full border border-purple-500/10 overflow-hidden p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="pt-2 border-t border-purple-500/10">
            <Button
              onClick={() => setPreviewHadiahOpen(false)}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-xs py-2 rounded-xl border border-white/5 active:scale-95"
            >
              YA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONGRATULATIONS (SELAMAT) REVEAL MODAL */}
      <Dialog open={resultsModalOpen} onOpenChange={(open) => { playSound("click"); if (!open) setResultsModalOpen(false); }}>
        <DialogContent className="bg-[#0b0614] border-purple-500/30 text-white max-w-2xl flex flex-col max-h-[85vh] p-0 overflow-hidden rounded-2xl shadow-2xl z-[100]">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-purple-500/15 bg-black/40">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-black text-white italic tracking-wider flex items-center gap-2">
                🌟 Spin Results ({spinCount}x)
              </DialogTitle>
              <span className="text-[10px] bg-purple-950 border border-purple-500/30 text-amber-300 px-3 py-1 rounded-full font-black">
                Balance: {board.diamonds} 💎
              </span>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 p-6 bg-[radial-gradient(circle_at_center,_#1c102a_0%,_#09050d_100%)]">
            {spinCount === 1 ? (
              (() => {
                const res = spinResults?.[0];
                if (!res) return null;
                const item = res.cosmetic;
                const isDup = res.isDuplicate;
                
                let rarityGlow = "shadow-[0_0_40px_rgba(148,163,184,0.3)] border-slate-400";
                if (item.rarity === "S") rarityGlow = "shadow-[0_0_50px_rgba(245,158,11,0.5)] border-amber-500";
                else if (item.rarity === "A") rarityGlow = "shadow-[0_0_45px_rgba(236,72,153,0.4)] border-pink-500";
                else if (item.rarity === "B") rarityGlow = "shadow-[0_0_40px_rgba(168,85,247,0.4)] border-purple-500";
                else if (item.rarity === "C") rarityGlow = "shadow-[0_0_35px_rgba(59,130,246,0.3)] border-blue-500";

                return (
                  <div className="flex flex-col items-center py-6 relative">
                    <div className="absolute w-[450px] h-[450px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(168,85,247,0.1)_0%,_transparent_70%)] animate-spin-slow pointer-events-none z-0" />
                    
                    <h3 className="text-3xl font-black text-amber-400 italic tracking-widest text-center uppercase drop-shadow-[0_3px_6px_rgba(0,0,0,0.8)] mb-6 z-10">
                      SELAMAT
                    </h3>

                    <div className={`w-52 rounded-2xl bg-black/80 border-2 p-5 flex flex-col items-center justify-between text-center min-h-[260px] relative z-10 ${rarityGlow}`}>
                      <span className={`text-[9px] font-black px-2.5 py-0.5 rounded border ${getTierBadgeStyle(item.rarity)}`}>
                        Tier {item.rarity}
                      </span>

                      <div className="mt-4 flex items-center justify-center">
                        {renderCosmeticPreview(item, "lg")}
                      </div>

                      <div className="mt-4 w-full">
                        <h4 className="text-sm font-black text-slate-100 uppercase tracking-wide">
                          {item.name}
                        </h4>
                        <p className="text-[9px] text-purple-300 font-bold uppercase block mt-0.5">
                          {item.type}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-2 px-2 leading-relaxed">
                          {item.description || "Kosmetik eksklusif dari gacha royale."}
                        </p>
                      </div>

                      <div className="mt-4 w-full">
                        {isDup ? (
                          <div className="py-1.5 px-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex flex-col items-center">
                            <span className="text-[8px] font-black text-amber-400 uppercase tracking-wider leading-none">Duplicate</span>
                            <span className="text-xs font-black text-amber-300 mt-1 flex items-center gap-0.5">
                              +100 💎 Refunded
                            </span>
                          </div>
                        ) : (
                          <div className="py-1.5 px-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-[10px] font-black uppercase tracking-widest animate-bounce">
                            🎉 UNLOCKED!
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="space-y-6">
                <h3 className="text-2xl font-black text-amber-400 italic tracking-widest text-center uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  SELAMAT
                </h3>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3.5">
                  {spinResults?.map((res, i) => {
                    const item = res.cosmetic;
                    const isDup = res.isDuplicate;
                    const rarityColor = getTierBadgeStyle(item.rarity);
                    
                    let cardGlow = "border-purple-500/10 bg-black/60 hover:border-purple-500/30";
                    if (item.rarity === "S") cardGlow = "border-amber-500/50 bg-[#140c02] shadow-[0_0_10px_rgba(245,158,11,0.2)]";
                    else if (item.rarity === "A") cardGlow = "border-pink-500/50 bg-[#140610] shadow-[0_0_10px_rgba(236,72,153,0.2)]";
                    
                    return (
                      <div
                        key={i}
                        className={`p-3 rounded-xl border flex flex-col justify-between items-center text-center relative overflow-hidden transition-all select-none hover:scale-[1.03] duration-200 animate-fade-in-card ${cardGlow}`}
                        style={{
                          animationDelay: `${i * 0.08}s`
                        }}
                      >
                        {item.rarity === "S" && (
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(251,191,36,0.1)_0%,_transparent_100%)] animate-pulse" />
                        )}

                        <div className="space-y-1.5 w-full relative z-10 flex flex-col items-center">
                          <span className={`text-[8px] font-black px-1.5 py-0.2 rounded border leading-none ${rarityColor}`}>
                            Tier {item.rarity}
                          </span>
                          
                          <div className="mt-2 flex items-center justify-center min-h-[56px]">
                            {renderCosmeticPreview(item, "sm")}
                          </div>

                          <h4 className="text-[10px] font-black text-slate-100 truncate w-full mt-1.5 leading-tight">
                            {item.name}
                          </h4>
                          <span className="text-[7px] text-purple-300/60 font-bold uppercase tracking-wider">
                            {item.type}
                          </span>
                        </div>

                        <div className="mt-3 w-full relative z-10">
                          {isDup ? (
                            <div className="py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center">
                              <span className="text-[7px] font-black text-amber-300 mt-1 flex items-center gap-0.5 justify-center leading-none">
                                +100 💎
                              </span>
                            </div>
                          ) : (
                            <div className="py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-[8px] font-black tracking-wider text-center leading-none">
                              🎉 UNLOCKED
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="px-6 py-4 border-t border-purple-500/15 bg-black/40 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1.5">
              <span>{shouldEquipWon ? "✓ Auto-Equipped highest tier item." : "Items stored in Inventory."}</span>
            </div>

            <div className="flex gap-3 w-full sm:w-auto shrink-0 justify-end">
              <Button
                onClick={() => {
                  playSound("click");
                  setResultsModalOpen(false);
                  handleSpin(spinCount);
                }}
                className="w-full sm:w-auto bg-[#1b122b] hover:bg-[#251b3b] border border-purple-500/30 text-purple-300 font-black text-xs px-5 py-2.5 rounded-xl transition-all"
              >
                SPIN LAGI ({spinCount}x)
              </Button>

              <Button
                onClick={() => {
                  playSound("click");
                  setResultsModalOpen(false);
                }}
                className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-xs px-6 py-2.5 rounded-xl border border-white/5 active:scale-95 transition-all"
              >
                YA
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WalletTab() {
  const { data: me } = useGetMe();
  const { data: transactions = [], isLoading } = useListWalletTransactions();
  const claimDiamonds = useClaimDiamonds();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleClaim = async () => {
    try {
      const res = await claimDiamonds.mutateAsync();
      if (res && res.diamonds !== undefined) {
        queryClient.setQueryData(["/api/gacha/board"], (old: any) => {
          if (!old) return old;
          return { ...old, diamonds: res.diamonds };
        });
        queryClient.setQueryData(["/api/me"], (old: any) => {
          if (!old) return old;
          return { ...old, diamonds: res.diamonds };
        });
      }
      toast({
        title: "Diamonds claimed! 💎",
        description: "You've received +1,000 Diamonds for testing.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gacha/board"] });
    } catch (err: any) {
      toast({
        title: "Claim Failed",
        description: err.message || "Failed to claim test diamonds.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-500 font-bold bg-[#f4f3f8] min-h-[300px] flex items-center justify-center">
        Loading Wallet Data...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* WALLET NEON CARD */}
      <div className="bg-gradient-to-br from-[#120726] to-[#080214] border border-purple-500/30 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-2xl">
                <Wallet className="w-8 h-8 text-purple-400" />
              </div>
              <div>
                <h3 className="text-xs font-black text-purple-300 uppercase tracking-widest">Arcadia Wallet</h3>
                <p className="text-lg font-bold text-white leading-none mt-0.5">{me?.displayName || me?.username}</p>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-black text-purple-300 uppercase tracking-widest block">Available Balance</span>
              <div className="text-4xl md:text-5xl font-black text-amber-300 flex items-center gap-2 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                {me?.diamonds ?? 0} <span className="text-3xl">💎</span>
              </div>
            </div>
          </div>

          <Button
            onClick={handleClaim}
            disabled={claimDiamonds.isPending}
            className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-900 font-black text-xs px-6 py-3.5 rounded-xl h-auto shadow-lg shadow-amber-500/25 border-t border-white/20 active:scale-95 transition-transform shrink-0 self-start md:self-auto"
          >
            {claimDiamonds.isPending ? "Claiming..." : "CLAIM FREE 1,000 💎"}
          </Button>
        </div>
      </div>

      {/* TRANSACTION HISTORY */}
      <div className="bg-white border border-[#eae8f5] shadow-sm rounded-2xl p-5">
        <h3 className="text-sm font-extrabold text-[#110e3d] uppercase tracking-wider mb-4 pb-2 border-b border-[#eae8f5] flex items-center gap-2">
          <span>📜</span> Transaction History
        </h3>

        {transactions.length === 0 ? (
          <div className="text-center py-12 text-slate-400 font-bold border border-dashed border-[#eae8f5] rounded-xl bg-slate-50">
            <p className="text-xs">No transactions logged yet. Spin Gacha or claim free diamonds to start!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#eae8f5] text-[10px] uppercase text-slate-400 font-black">
                  <th className="py-2.5">Date</th>
                  <th className="py-2.5">Type</th>
                  <th className="py-2.5">Description</th>
                  <th className="py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eae8f5]/50">
                {transactions.map((t: any) => {
                  const isCredit = t.amount > 0;
                  return (
                    <tr key={t.id} className="text-xs font-semibold text-slate-600">
                      <td className="py-3 text-slate-400">{format(new Date(t.createdAt), "MMM d, yyyy HH:mm")}</td>
                      <td className="py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                          t.type === "claim_free" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                          t.type === "spin_cost" ? "bg-red-50 text-red-600 border border-red-100" :
                          t.type === "duplicate_refund" ? "bg-amber-50 text-amber-600 border border-amber-100" :
                          "bg-purple-50 text-purple-600 border border-purple-100"
                        }`}>
                          {t.type.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3 text-[#110e3d]">{t.description}</td>
                      <td className={`py-3 text-right font-black ${isCredit ? "text-emerald-500" : "text-red-500"}`}>
                        {isCredit ? "+" : ""}{t.amount} 💎
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
