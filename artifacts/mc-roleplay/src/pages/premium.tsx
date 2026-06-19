import { useState, useRef, useEffect } from "react";
import { useClerk } from "@clerk/react";
import { useGetMe, useUpdateMe, useListOwnedCosmetics, useEquipCosmetic, customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
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
  Music,
  Clock,
  Palette,
  Image as ImageIcon,
  Smile,
  Crown
} from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function formatBytesCompact(bytes: number) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
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

export default function Premium() {
  const { data: me, isLoading: meLoading } = useGetMe();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sticker creation states
  const [stickerName, setStickerName] = useState("");
  const [stickerGroupId, setStickerGroupId] = useState("none");
  const [stickerOverlayText, setStickerOverlayText] = useState("");
  const [stickerFontFamily, setStickerFontFamily] = useState("Inter");
  const [stickerTextColor, setStickerTextColor] = useState("#111827");
  const [uploadingSticker, setUploadingSticker] = useState(false);
  const stickerFileRef = useRef<HTMLInputElement | null>(null);

  // Cosmetics states
  const [activeCosmeticSubTab, setActiveCosmeticSubTab] = useState<"badge" | "border" | "background">("badge");

  // Realm Settings query
  const { data: realmSettings = {} } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: () => customFetch<any>("/api/settings"),
  });
  const realmName = realmSettings.realmName || "Arcadia Studio";
  const realmLogoUrl = realmSettings.realmLogoUrl || "";

  // Membership details query
  const { data: membershipData, isLoading: membershipLoading } = useQuery({
    queryKey: ["/api/me/membership"],
    queryFn: () => customFetch<any>("/api/me/membership"),
  });

  // Stickers library query
  const { data: stickerLibrary, isLoading: stickersLoading } = useQuery({
    queryKey: ["/api/stickers", "owned"],
    queryFn: () => customFetch<any>("/api/stickers?mode=owned"),
  });

  // Cosmetics query
  const { data: ownedCosmetics = [], isLoading: cosmeticsLoading } = useListOwnedCosmetics();
  const equipCosmetic = useEquipCosmetic();

  // Redirect if not authorized
  useEffect(() => {
    if (!meLoading && me) {
      const isPremium = ["premium", "premium_plus", "admin", "dev_website"].includes(me.role);
      if (!isPremium) {
        toast({
          title: "Access Restricted",
          description: "Halaman ini hanya untuk member Premium atau Premium+.",
          variant: "destructive"
        });
        setLocation("/member");
      }
    }
  }, [me, meLoading, setLocation, toast]);

  const handleCopyIP = () => {
    navigator.clipboard.writeText("play.arcadiamc.net");
    setCopied(true);
    toast({ title: "Copied!", description: "IP copied to clipboard: play.arcadiamc.net" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEquipCosmetic = async (id: number, currentStatus: boolean) => {
    try {
      await equipCosmetic.mutateAsync({
        id,
        data: { equip: !currentStatus }
      });
      toast({
        title: currentStatus ? "Cosmetic unequipped" : "Cosmetic equipped!",
        description: currentStatus ? "Item has been unequipped." : "Your profile style has been updated."
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/cosmetics", "owned"] });
    } catch (err: any) {
      toast({
        title: "Action failed",
        description: err.message || "Failed to update cosmetic state.",
        variant: "destructive"
      });
    }
  };

  const deleteStickerMutation = useMutation({
    mutationFn: async (stickerId: number) => customFetch<any>(`/api/stickers/${stickerId}`, {
      method: "DELETE",
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/stickers", "owned"] });
      toast({ title: "Sticker dihapus" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Gagal hapus sticker.", variant: "destructive" });
    },
  });

  async function handleStickerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!stickerName.trim()) {
      toast({ title: "Nama sticker wajib diisi", variant: "destructive" });
      return;
    }

    setUploadingSticker(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", stickerName.trim());
      formData.append("editorConfig", JSON.stringify({
        overlayText: stickerOverlayText.trim(),
        fontFamily: stickerFontFamily,
        textColor: stickerTextColor,
      }));
      
      const currentTier = membershipData?.currentTier || "free";
      if (currentTier === "free") {
        if (stickerGroupId === "none") throw new Error("Pilih group dulu untuk sticker lokal.");
        formData.append("conversationId", stickerGroupId);
      }

      const response = await fetch("/api/stickers/upload", { method: "POST", body: formData });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Gagal upload sticker");

      setStickerName("");
      setStickerOverlayText("");
      await queryClient.invalidateQueries({ queryKey: ["/api/stickers", "owned"] });
      toast({ title: "Sticker berhasil dibuat", description: "Sticker masuk ke library kamu." });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Gagal upload sticker.", variant: "destructive" });
    } finally {
      setUploadingSticker(false);
    }
  }

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "S": return "bg-red-500 text-white border-red-300";
      case "A": return "bg-pink-500 text-white border-pink-300";
      case "B": return "bg-purple-500 text-white border-purple-300";
      case "C": return "bg-blue-500 text-white border-blue-300";
      default: return "bg-slate-400 text-white border-slate-300";
    }
  };

  if (meLoading || membershipLoading) {
    return (
      <div className="p-8 text-slate-500 font-bold bg-[#f4f3f8] min-h-screen flex items-center justify-center">
        Loading Premium Hub...
      </div>
    );
  }

  const activeSub = membershipData?.activeSubscription;
  const tierLabel = membershipData?.tierLabel || "Regular Member";
  const currentTier = membershipData?.currentTier || "free";
  const ownedStickers = Array.isArray(stickerLibrary?.stickers) ? stickerLibrary.stickers : [];
  const groupOptions = Array.isArray(membershipData?.groups) ? membershipData.groups : [];

  // Expiration & duration calculation
  let remainingDaysStr = "Active";
  let progressPercent = 100;
  let startsAtStr = "-";
  let endsAtStr = "Lifetime";
  
  if (activeSub) {
    startsAtStr = format(new Date(activeSub.startsAt), "dd MMM yyyy");
    if (activeSub.endsAt) {
      const starts = new Date(activeSub.startsAt);
      const ends = new Date(activeSub.endsAt);
      endsAtStr = format(ends, "dd MMM yyyy");
      
      const totalDuration = Math.max(1, Math.ceil((ends.getTime() - starts.getTime()) / (1000 * 3600 * 24)));
      const remainingDays = Math.max(0, Math.ceil((ends.getTime() - Date.now()) / (1000 * 3600 * 24)));
      
      remainingDaysStr = `${remainingDays} hari tersisa`;
      progressPercent = Math.min(100, Math.round((remainingDays / totalDuration) * 100));
    }
  }

  const filteredCosmetics = ownedCosmetics.filter((c: any) => c.type === activeCosmeticSubTab);

  return (
    <div className="min-h-screen bg-[#f7f6fa] text-[#1e1b4b] flex font-sans antialiased">
      {/* ── Left Sidebar (Desktop) ────────────────────────────────────────── */}
      <aside className="w-64 bg-white border-r border-[#eae8f5] flex flex-col justify-between shrink-0 hidden md:flex">
        <div className="flex flex-col">
          {/* Logo Branding */}
          <Link href="/" className="p-6 border-b border-[#eae8f5] flex items-center gap-3 hover:opacity-85 transition-opacity cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-black shadow-lg shadow-violet-500/20 overflow-hidden">
              {realmLogoUrl ? (
                <img src={realmLogoUrl} alt={realmName} className="h-full w-full object-cover" />
              ) : (
                realmName.slice(0, 1).toUpperCase()
              )}
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-[#110e3d] leading-none">{realmName}</h2>
              <span className="text-[10px] text-purple-500 font-bold uppercase tracking-wider">Premium Hub</span>
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
                <Link
                  href="/member?tab=membership"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all"
                >
                  <Activity className="w-4.5 h-4.5 text-cyan-500" /> Membership & Boost
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
              <span className="px-3 text-[10px] font-black text-purple-600 uppercase tracking-widest block">Premium</span>
              <nav className="space-y-1">
                <Link
                  href="/premium"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold bg-purple-50 text-purple-600 border border-purple-200/30 transition-all"
                >
                  <Sparkles className="w-4.5 h-4.5 text-purple-500 animate-pulse" /> Premium Area
                </Link>
              </nav>
            </div>
          </div>
        </div>

        {/* User Account Details Bottom Sidebar */}
        <div className="p-4 border-t border-[#eae8f5] space-y-3">
          <div className="flex items-center gap-3 px-2 py-1">
            <div className={`rounded-full shrink-0 flex items-center justify-center p-0.5 overflow-visible ${me?.equippedBorder ? me.equippedBorder : "border border-[#eae8f5]"}`}>
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={me?.avatarUrl || undefined} />
                <AvatarFallback className="text-xs bg-slate-100 font-extrabold text-[#6366f1]">
                  {getInitials(me?.displayName || me?.username)}
                </AvatarFallback>
              </Avatar>
            </div>
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
                  <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center text-white font-black overflow-hidden shadow-md">
                    {realmLogoUrl ? (
                      <img src={realmLogoUrl} alt={realmName} className="h-full w-full object-cover" />
                    ) : (
                      realmName.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h2 className="font-extrabold text-sm text-[#110e3d] leading-none">{realmName}</h2>
                    <span className="text-[10px] text-purple-500 font-bold">Premium Area</span>
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
                  href="/member?tab=membership"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all"
                >
                  <Activity className="w-4.5 h-4.5 text-cyan-500" /> Membership & Boost
                </Link>
                <Link
                  href="/friends"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all"
                >
                  <Users className="w-4.5 h-4.5" /> Guilds
                </Link>
                <Link
                  href="/premium"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold bg-purple-50 text-purple-600 border border-purple-200/30 transition-all"
                >
                  <Sparkles className="w-4.5 h-4.5 text-purple-500 animate-pulse" /> Premium Area
                </Link>
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
              <span>Player Hub</span>
              <span>/</span>
              <span className="text-purple-600 font-extrabold flex items-center gap-1">
                <Crown className="w-3.5 h-3.5" /> Premium Area
              </span>
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
          </div>
        </header>

        {/* Content Container */}
        <div className="flex-1 p-6 md:p-8 max-w-5xl w-full mx-auto space-y-6">
          
          {/* VIP Header Banner */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-900 via-indigo-950 to-purple-950 p-6 md:p-8 text-white shadow-xl">
            {/* Sparkle background elements */}
            <div className="absolute top-0 right-0 -translate-y-6 translate-x-6 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 translate-y-6 -translate-x-6 w-60 h-60 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/25 text-amber-300 font-extrabold text-[10px] uppercase tracking-wider">
                  <Crown className="w-3 h-3 text-amber-400" /> VIP MEMBER PORTAL
                </div>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                  Welcome to the VIP Salon, {me?.displayName || me?.username}!
                </h1>
                <p className="text-xs text-purple-200 font-semibold max-w-xl">
                  Disini kamu bisa melakukan kustomisasi kosmetik eksklusif (Badges, Borders, Backgrounds) dan mengelola custom sticker library-mu secara eksklusif.
                </p>
              </div>
              
              {/* Active Plan badge */}
              <div className="shrink-0 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex flex-col items-center justify-center text-center max-w-[180px] w-full max-sm:max-w-none">
                <span className="text-[10px] font-black text-purple-300 uppercase tracking-widest leading-none">PLAN TIER</span>
                <span className="text-xl font-black text-white mt-1.5 flex items-center gap-1.5">
                  <Crown className="w-5 h-5 text-amber-400" /> {tierLabel}
                </span>
                <span className="text-[10px] font-bold text-emerald-400 mt-1 capitalize px-2 py-0.5 rounded-full bg-emerald-400/10 border border-emerald-400/20">
                  {currentTier.replace("_", " ")}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            {/* Left Column: Sub Duration & Cosmetics Customizer */}
            <div className="space-y-6">
              {/* Subscription Duration Card */}
              <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="pb-3 border-b border-[#f3f2f8]">
                  <CardTitle className="text-sm font-extrabold text-[#110e3d] flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-500 animate-spin-slow" /> Subscription Duration
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {activeSub ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                        <span>Aktif sejak: <span className="font-extrabold text-[#110e3d]">{startsAtStr}</span></span>
                        <span>Selesai: <span className="font-extrabold text-[#110e3d]">{endsAtStr}</span></span>
                      </div>
                      
                      {activeSub.endsAt && (
                        <div className="space-y-2">
                          <Progress value={progressPercent} className="h-2.5 bg-slate-100" />
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-purple-600 font-extrabold uppercase tracking-wide">{remainingDaysStr}</span>
                            <span className="text-slate-400 font-bold">{progressPercent}% tersisa</span>
                          </div>
                        </div>
                      )}
                      
                      {!activeSub.endsAt && (
                        <div className="rounded-xl bg-purple-50 border border-purple-100 p-3 text-xs text-purple-700 font-semibold flex items-center gap-2">
                          <Crown className="w-4 h-4 text-amber-500" /> Subscription Lifetime aktif tanpa tanggal kedaluwarsa.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-[#eae8f5] bg-slate-50 p-6 text-center text-xs text-slate-400 font-bold">
                      Kamu belum memiliki membership subscription aktif.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Cosmetics Customizer Section */}
              <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="pb-3 border-b border-[#f3f2f8]">
                  <CardTitle className="text-sm font-extrabold text-[#110e3d] flex items-center gap-2">
                    <Palette className="w-4 h-4 text-purple-500" /> Profile Cosmetics Customizer
                  </CardTitle>
                  <p className="text-[11px] text-slate-400 font-bold mt-1">
                    Gunakan border, badge, atau background profil yang kamu menangkan dari Gacha Royale.
                  </p>
                </CardHeader>
                <CardContent className="p-6">
                  <Tabs value={activeCosmeticSubTab} onValueChange={(val) => setActiveCosmeticSubTab(val as any)} className="w-full space-y-4">
                    <TabsList className="grid w-full grid-cols-3 bg-slate-50 border border-[#eae8f5] h-9 p-0.5 rounded-xl">
                      <TabsTrigger value="badge" className="text-[11px] py-1 font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-800">Badges</TabsTrigger>
                      <TabsTrigger value="border" className="text-[11px] py-1 font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-800">Borders</TabsTrigger>
                      <TabsTrigger value="background" className="text-[11px] py-1 font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-800">Backgrounds</TabsTrigger>
                    </TabsList>

                    <TabsContent value={activeCosmeticSubTab} className="mt-4 outline-none">
                      {cosmeticsLoading ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Skeleton className="h-16 w-full rounded-xl" />
                          <Skeleton className="h-16 w-full rounded-xl" />
                        </div>
                      ) : filteredCosmetics.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-[#eae8f5] bg-slate-50 p-6 text-center text-xs text-slate-400 font-bold">
                          Belum ada kosmetik {activeCosmeticSubTab} yang kamu miliki. Mainkan Gacha Royale untuk mendapatkannya!
                        </div>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {filteredCosmetics.map((cosmetic: any) => {
                            const isEquipped = cosmetic.isEquipped;
                            return (
                              <div key={cosmetic.id} className="rounded-xl border border-[#eae8f5] bg-white p-3 hover:border-violet-200 transition-all flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1 flex items-center gap-2.5">
                                  <div className={`h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center font-black text-xs shrink-0 ${getRarityColor(cosmetic.rarity)}`}>
                                    {cosmetic.rarity}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-extrabold text-[#110e3d]">{cosmetic.displayName}</p>
                                    <p className="text-[10px] text-slate-400 font-semibold truncate capitalize">{cosmetic.type}</p>
                                  </div>
                                </div>
                                <Button
                                  variant={isEquipped ? "outline" : "default"}
                                  size="sm"
                                  onClick={() => handleEquipCosmetic(cosmetic.id, isEquipped)}
                                  className={isEquipped
                                    ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 h-8 rounded-lg text-[10px] font-black"
                                    : "bg-purple-600 text-white hover:bg-purple-700 h-8 rounded-lg text-[10px] font-black"
                                  }
                                >
                                  {isEquipped ? "Unequip" : "Equip"}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Custom Stickers Section */}
            <div className="space-y-6">
              {/* Sticker Creator */}
              <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="pb-3 border-b border-[#f3f2f8]">
                  <CardTitle className="text-sm font-extrabold text-[#110e3d] flex items-center gap-2">
                    <Smile className="w-4 h-4 text-purple-500" /> Sticker Creator
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <input ref={stickerFileRef} type="file" accept="image/png,image/webp,image/jpeg,image/gif" className="hidden" onChange={handleStickerUpload} />
                  
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sticker Name</Label>
                    <Input value={stickerName} onChange={(e) => setStickerName(e.target.value.slice(0, 40))} placeholder="contoh: happy_cat" className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs text-slate-800 focus-visible:ring-purple-500" />
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-1.5 md:col-span-3">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Overlay Text</Label>
                      <Input value={stickerOverlayText} onChange={(e) => setStickerOverlayText(e.target.value.slice(0, 60))} placeholder="contoh: Halo Kak!" className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs text-slate-800 focus-visible:ring-purple-500" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Font</Label>
                      <Input value={stickerFontFamily} onChange={(e) => setStickerFontFamily(e.target.value.slice(0, 30))} placeholder="Inter" className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs text-slate-800 focus-visible:ring-purple-500" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Text Color</Label>
                      <Input value={stickerTextColor} onChange={(e) => setStickerTextColor(e.target.value.slice(0, 20))} placeholder="#111827" className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs text-slate-800 focus-visible:ring-purple-500" />
                    </div>
                  </div>
                  
                  {currentTier === "free" && (
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Group</Label>
                      <Select value={stickerGroupId} onValueChange={setStickerGroupId}>
                        <SelectTrigger className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-[#1e1b4b] font-bold">
                          <SelectValue placeholder="Pilih group target" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-[#eae8f5] text-slate-700">
                          <SelectItem value="none">Pilih group</SelectItem>
                          {groupOptions.map((group: any) => (
                            <SelectItem key={`sticker-target-${group.id}`} value={String(group.id)}>
                              {group.name ?? `Group #${group.id}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="rounded-xl border border-[#eae8f5] bg-slate-50 p-4 text-xs font-semibold text-slate-600">
                    {currentTier === "premium_plus" 
                      ? "Premium+ bisa share / reuse sticker antar group, tapi tidak upload sticker baru." 
                      : "Premium can create static global stickers across all chat rooms."}
                  </div>

                  <Button onClick={() => stickerFileRef.current?.click()} disabled={uploadingSticker || !stickerName.trim() || currentTier === "premium_plus"} className="w-full bg-purple-600 text-white hover:bg-purple-700 rounded-xl font-bold text-xs h-10 shadow-md">
                    {uploadingSticker ? "Uploading..." : currentTier === "premium_plus" ? "Premium+ share only" : "Upload Sticker"}
                  </Button>
                </CardContent>
              </Card>

              {/* Sticker Library */}
              <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="pb-3 border-b border-[#f3f2f8]">
                  <CardTitle className="text-sm font-extrabold text-[#110e3d] flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-purple-500" /> My Sticker Library
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {stickersLoading ? (
                    <div className="grid gap-3 grid-cols-2">
                      <Skeleton className="h-24 w-full rounded-xl" />
                      <Skeleton className="h-24 w-full rounded-xl" />
                    </div>
                  ) : ownedStickers.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#eae8f5] bg-slate-50 p-6 text-center text-xs text-slate-400 font-bold">
                      Belum ada sticker. Upload sticker baru di form atas.
                    </div>
                  ) : (
                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                      {ownedStickers.map((sticker: any) => (
                        <div key={sticker.id} className="rounded-xl border border-[#eae8f5] bg-white p-2.5 flex flex-col justify-between hover:border-violet-200 transition-all">
                          <div className="aspect-square overflow-hidden rounded-xl border border-[#eae8f5] bg-slate-50">
                            <img src={sticker.assetUrl} alt={sticker.name} className="h-full w-full object-contain" />
                          </div>
                          <div className="mt-2.5 space-y-1.5">
                            <div className="min-w-0">
                              <p className="truncate text-[10px] font-extrabold text-[#110e3d]">{sticker.name}</p>
                              <p className="text-[9px] font-semibold text-slate-400 truncate">
                                {sticker.scope === "global_cross_server" ? "Global" : "Local Group"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" onClick={async () => {
                                const nextName = window.prompt("Nama sticker baru (opsional)", sticker.name) ?? sticker.name;
                                try {
                                  await customFetch(`/api/stickers/${sticker.id}`, {
                                    method: "PATCH",
                                    body: JSON.stringify({
                                      name: nextName.trim(),
                                      editorConfig: sticker.editorConfig ?? {},
                                    }),
                                    headers: { "Content-Type": "application/json" },
                                  });
                                  await queryClient.invalidateQueries({ queryKey: ["/api/stickers", "owned"] });
                                  toast({ title: "Sticker updated" });
                                } catch (err: any) {
                                  toast({ title: "Error", description: err?.message || "Gagal edit sticker.", variant: "destructive" });
                                }
                              }} className="h-7 rounded-lg border-slate-200 bg-slate-50 hover:bg-slate-100 px-2 text-[9px] font-black text-slate-600">
                                Edit
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => deleteStickerMutation.mutate(sticker.id)} disabled={deleteStickerMutation.isPending} className="w-full h-7 rounded-lg border-red-100 bg-red-50 hover:bg-red-100 px-2 text-[9px] font-black text-red-600">
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
