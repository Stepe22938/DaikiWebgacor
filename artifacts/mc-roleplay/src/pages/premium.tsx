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
  Crown,
  Zap
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

  // High-level navigation tab for premium users
  const [activeMainTab, setActiveMainTab] = useState<"perks" | "subscription">("perks");

  // Subscription & Boost management states
  const [requestMode, setRequestMode] = useState<"tier" | "boost">("tier");
  const [selectedTier, setSelectedTier] = useState("premium");
  const [selectedPackageSku, setSelectedPackageSku] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("none");
  const [selectedBoostGroupId, setSelectedBoostGroupId] = useState("none");
  const [selectedBoostAmount, setSelectedBoostAmount] = useState("1");
  const [requestNote, setRequestNote] = useState("");
  const [slotTargets, setSlotTargets] = useState<Record<number, string>>({});

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

  // Premium management mutations
  const paymentRequestMutation = useMutation({
    mutationFn: async (vars?: {
      tier?: string;
      packageSku?: string;
      conversationId?: number;
      note?: string;
    }) => customFetch<any>("/api/payment-requests", {
      method: "POST",
      body: JSON.stringify(
        vars || {
          tier: requestMode === "tier" ? selectedTier : undefined,
          packageSku: requestMode === "boost" ? selectedPackageSku : undefined,
          conversationId: requestMode === "boost" && selectedGroupId !== "none" ? Number(selectedGroupId) : undefined,
          note: requestNote.trim() || undefined,
        }
      ),
      headers: { "Content-Type": "application/json" },
    }),
    onSuccess: async (res: any) => {
      toast({
        title: "Redirecting to checkout...",
        description: "Mohon tunggu sebentar...",
      });
      setRequestNote("");
      setSelectedPackageSku("");
      setSelectedGroupId("none");
      await queryClient.invalidateQueries({ queryKey: ["/api/me/membership"] });
      if (res && res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      }
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Gagal membuat ticket pembayaran.", variant: "destructive" });
    },
  });

  const applyBoostMutation = useMutation({
    mutationFn: async ({ slotId, conversationId }: { slotId: number; conversationId: number }) => customFetch<any>("/api/me/membership/boosts/apply", {
      method: "POST",
      body: JSON.stringify({ slotId, conversationId }),
      headers: { "Content-Type": "application/json" },
    }),
    onSuccess: async () => {
      toast({ title: "Boost dipasang", description: "Server berhasil di-boost." });
      await queryClient.invalidateQueries({ queryKey: ["/api/me/membership"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Gagal apply boost.", variant: "destructive" });
    },
  });

  const applyBulkBoostMutation = useMutation({
    mutationFn: async ({ conversationId, boostCount }: { conversationId: number; boostCount: number }) => customFetch<any>("/api/me/membership/boosts/apply-bulk", {
      method: "POST",
      body: JSON.stringify({ conversationId, boostCount }),
      headers: { "Content-Type": "application/json" },
    }),
    onSuccess: async (payload: any) => {
      toast({ title: "Boost dipasang", description: `${payload?.appliedCount ?? selectedBoostAmount} boost berhasil ditempel ke group.` });
      await queryClient.invalidateQueries({ queryKey: ["/api/me/membership"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Gagal apply boost bulk.", variant: "destructive" });
    },
  });

  const revokeBoostMutation = useMutation({
    mutationFn: async (slotId: number) => customFetch<any>("/api/me/membership/boosts/revoke", {
      method: "POST",
      body: JSON.stringify({ slotId }),
      headers: { "Content-Type": "application/json" },
    }),
    onSuccess: async () => {
      toast({ title: "Boost dilepas", description: "Boost slot balik jadi available." });
      await queryClient.invalidateQueries({ queryKey: ["/api/me/membership"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Gagal cabut boost.", variant: "destructive" });
    },
  });

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

  const usedPercent = membershipData?.sharedStorage?.capacityBytes > 0
    ? Math.min(100, Math.round((membershipData.sharedStorage.usedBytes / membershipData.sharedStorage.capacityBytes) * 100))
    : 0;
  const rawPaymentTickets = Array.isArray(membershipData?.paymentTickets) ? membershipData.paymentTickets : [];
  const paymentTickets = rawPaymentTickets.filter((ticket: any) => {
    if (ticket.adminNotes?.startsWith("[SayaBayar ID:") && ticket.paymentStatus !== "paid") {
      return false;
    }
    return true;
  });
  const nitro = membershipData?.nitro ?? {
    stickerSyncMode: membershipData?.stickerSyncMode,
    maxStickerCount: 0,
    maxStickerFileBytes: 0,
    canUseAnimatedStickers: false,
    perks: [],
  };
  const availableBoostSlots = Array.isArray(membershipData?.ownedBoostSlots)
    ? membershipData.ownedBoostSlots.filter((slot: any) => !slot.assignment && slot.status !== "expired")
    : [];
  const activeBoostAssignments = Array.isArray(membershipData?.ownedBoostSlots)
    ? membershipData.ownedBoostSlots.filter((slot: any) => !!slot.assignment && slot.status !== "expired")
    : [];
  const selectableBoostAmounts = Array.from({
    length: Math.max(0, Math.min(3, availableBoostSlots.length)),
  }, (_, index) => String(index + 1));
  const effectiveSelectedBoostAmount = selectableBoostAmounts.includes(selectedBoostAmount)
    ? selectedBoostAmount
    : (selectableBoostAmounts[0] ?? "");
  const planCards = [
    {
      key: "free",
      title: "Member",
      price: "Rp 0",
      badge: "Free",
      features: ["Upload 200MB limit", "Sticker lokal per group", "0 boost bawaan", "Akses dasar chat dan guild"],
    },
    {
      key: "premium",
      title: "Premium",
      price: `Rp ${(realmSettings?.premiumPrice ?? 25000).toLocaleString("id-ID")}`,
      badge: "Nitro",
      features: ["Upload 500MB limit", "Sticker global cross-server", "Bisa beli & pasang boost", "Perk VIP lintas group"],
    },
    {
      key: "premium_plus",
      title: "Premium+",
      price: `Rp ${(realmSettings?.premiumPlusPrice ?? 50000).toLocaleString("id-ID")}`,
      badge: "Nitro+",
      features: ["Upload 1GB limit", "Sticker animasi global", "3 boost bawaan gratis", "Auto-boost ke semua group"],
    },
  ] as const;

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
                  {currentTier !== "free" 
                    ? "Disini kamu bisa melakukan kustomisasi kosmetik eksklusif (Badges, Borders, Backgrounds), mengelola custom sticker, serta mengatur server boost-mu."
                    : "Upgrade membership kamu sekarang untuk mendapatkan akses ke kosmetik eksklusif, server boost, global sticker, dan RPG soundtrack player."}
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

          {/* Render Sales Page for Free Users */}
          {currentTier === "free" ? (
            <div className="space-y-8">
              {/* Perks Grid */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl p-5 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                    <Smile className="w-5 h-5" />
                  </div>
                  <h3 className="font-extrabold text-sm text-[#110e3d]">Global Stickers</h3>
                  <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                    Buat dan bagikan custom sticker-mu sendiri secara global di semua room obrolan guild dan server.
                  </p>
                </Card>
                
                <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl p-5 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                    <Palette className="w-5 h-5" />
                  </div>
                  <h3 className="font-extrabold text-sm text-[#110e3d]">Cosmetics Customizer</h3>
                  <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                    Kustomisasi tampilan profilmu dengan borders, badges, dan backgrounds eksklusif yang didapatkan dari Gacha.
                  </p>
                </Card>
                
                <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl p-5 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                    <Zap className="w-5 h-5" />
                  </div>
                  <h3 className="font-extrabold text-sm text-[#110e3d]">Server Boosts</h3>
                  <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                    Boost guild / server favoritmu untuk membuka batasan slot channel, role, dan menaikkan level keaktifan server.
                  </p>
                </Card>
              </div>

              {/* Plans Section */}
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-extrabold text-[#110e3d]">Pilih Paket VIP Membership</h2>
                  <p className="text-xs font-semibold text-slate-400">
                    Pilih paket langganan bulanan di bawah ini untuk mengaktifkan VIP member portal.
                  </p>
                </div>
                <div className="grid gap-5 md:grid-cols-3">
                  {planCards.map((plan) => {
                    const isCurrent = currentTier === plan.key;
                    const isPremium = plan.key === "premium";
                    const isPremiumPlus = plan.key === "premium_plus";
                    const borderClass = isCurrent
                      ? isPremiumPlus
                        ? "border-amber-400 bg-amber-50/70"
                        : isPremium
                        ? "border-violet-400 bg-violet-50/70"
                        : "border-slate-300 bg-slate-50"
                      : "border-[#eae8f5] bg-white hover:border-slate-300";

                    return (
                      <div key={plan.key} className={`relative flex flex-col gap-4 rounded-2xl border-2 p-5 transition-all ${borderClass}`}>
                        {isCurrent && (
                          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#110e3d] px-3 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
                            Plan aktif
                          </span>
                        )}
                        <div className="flex items-center gap-3">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${isPremiumPlus ? "bg-gradient-to-br from-amber-400 to-orange-500" : isPremium ? "bg-gradient-to-br from-violet-500 to-indigo-600" : "bg-slate-100"}`}>
                            {isPremiumPlus ? <Crown className="h-4 w-4 text-white" /> : isPremium ? <Zap className="h-4 w-4 text-white" /> : <Sparkles className="h-4 w-4 text-slate-500" />}
                          </div>
                          <div>
                            <p className="text-sm font-extrabold text-[#110e3d]">{plan.title}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{plan.badge}</p>
                          </div>
                        </div>
                        <p className="text-2xl font-black text-[#110e3d]">{plan.price}<span className="text-xs font-semibold text-slate-400">/bln</span></p>
                        <ul className="flex-1 space-y-2 text-xs font-semibold text-slate-600">
                          {plan.features.map((feature) => (
                            <li key={feature} className="flex items-start gap-2">
                              <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${isPremiumPlus ? "text-amber-500" : isPremium ? "text-violet-500" : "text-slate-400"}`} />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                        {isCurrent ? (
                          <div className="rounded-xl bg-white/80 py-2 text-center text-xs font-black text-slate-500">Sedang dipakai</div>
                        ) : (
                          <Button
                            onClick={() => {
                              if (plan.key === "free") return;
                              paymentRequestMutation.mutate({ tier: plan.key });
                            }}
                            disabled={paymentRequestMutation.isPending || plan.key === "free"}
                            className={`h-10 rounded-xl text-xs font-black text-white ${isPremiumPlus ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400" : isPremium ? "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500" : "bg-slate-400"}`}
                          >
                            {plan.key === "free" ? "Plan gratis" : paymentRequestMutation.isPending ? "Mengarahkan..." : `Beli ${plan.title}`}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Billing Tickets List */}
              {paymentTickets.length > 0 && (
                <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl overflow-hidden">
                  <CardHeader className="pb-3 border-b border-[#f3f2f8]">
                    <CardTitle className="text-sm font-extrabold text-[#110e3d] flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-purple-500" /> Riwayat Upgrade
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 divide-y divide-[#eae8f5]/50 space-y-3">
                    {paymentTickets.map((ticket: any) => (
                      <div key={ticket.id} className="flex justify-between items-center text-xs pt-3 first:pt-0">
                        <div>
                          <p className="font-extrabold text-[#110e3d]">Request #{ticket.id} - {ticket.tier === 'premium_plus' ? 'Premium+' : 'Premium'}</p>
                          <p className="text-[10px] text-slate-400 font-bold">{format(new Date(ticket.createdAt), "dd MMM yyyy HH:mm")}</p>
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 rounded-lg font-black uppercase tracking-wider ${
                          ticket.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                          ticket.status === 'rejected' ? 'bg-red-50 text-red-600 border border-red-100' :
                          'bg-amber-50 text-amber-600 border border-amber-100'
                        }`}>
                          {ticket.status}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            // Premium Portal View
            <div className="space-y-6">
              {/* High-level tab buttons */}
              <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full sm:w-fit gap-2 border border-[#eae8f5]">
                <button
                  onClick={() => setActiveMainTab("perks")}
                  className={`flex-1 sm:flex-initial px-6 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                    activeMainTab === "perks"
                      ? "bg-white text-purple-600 shadow-md"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Sparkles className="w-4 h-4" /> VIP Perks & Stickers
                </button>
                <button
                  onClick={() => setActiveMainTab("subscription")}
                  className={`flex-1 sm:flex-initial px-6 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                    activeMainTab === "subscription"
                      ? "bg-white text-purple-600 shadow-md"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Zap className="w-4 h-4" /> Subscription & Boosts
                </button>
              </div>

              {/* Main Content Layout based on activeMainTab */}
              {activeMainTab === "perks" ? (
                <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                  {/* Left Column: Cosmetics Customizer */}
                  <div className="space-y-6">
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
                                          ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 h-8 rounded-lg text-[10px] font-black px-3"
                                          : "bg-purple-600 text-white hover:bg-purple-700 h-8 rounded-lg text-[10px] font-black px-3"
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

                  {/* Right Column: Stickers creator & library */}
                  <div className="space-y-6">
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
                          <Input value={stickerName} onChange={(e) => setStickerName(e.target.value.slice(0, 40))} placeholder="contoh: happy_cat" className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs text-slate-800 focus-visible:ring-purple-500 animate-none transition-none shadow-none focus:outline-none" />
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
                                  <div className="flex items-center gap-1">
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
                                    <Button variant="outline" size="sm" onClick={() => deleteStickerMutation.mutate(sticker.id)} disabled={deleteStickerMutation.isPending} className="h-7 rounded-lg border-red-100 bg-red-50 hover:bg-red-100 px-2 text-[9px] font-black text-red-600">
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
              ) : (
                // Subscription & Boost Management Tab Content
                <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                  {/* Left Column: Sub Duration, Storage, Upgrade billing */}
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

                    {/* Shared Storage Card */}
                    <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl overflow-hidden">
                      <CardHeader className="pb-3 border-b border-[#f3f2f8]">
                        <CardTitle className="text-sm font-extrabold text-[#110e3d] flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-purple-500" /> Shared Storage & Nitro Status
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 space-y-4">
                        {membershipData?.sharedStorage ? (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                                <span>{membershipData.sharedStorage.name}</span>
                                <span>{usedPercent}% used</span>
                              </div>
                              <Progress value={usedPercent} className="h-2.5" />
                              <p className="text-[10px] text-slate-400 font-semibold">
                                Used {formatBytesCompact(membershipData.sharedStorage.usedBytes || 0)} / {formatBytesCompact(membershipData.sharedStorage.capacityBytes || 0)}
                              </p>
                            </div>
                            <div className="grid gap-3 grid-cols-2">
                              <div className="rounded-xl border border-[#eae8f5] bg-slate-50 p-3 text-xs">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Max File Upload</p>
                                <p className="mt-1 font-extrabold text-[#110e3d]">{formatBytesCompact(membershipData.maxUploadBytes || 0)}</p>
                              </div>
                              <div className="rounded-xl border border-[#eae8f5] bg-slate-50 p-3 text-xs">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Verification Mode</p>
                                <p className="mt-1 font-extrabold text-[#110e3d]">{membershipData.sharedStorage.validationMode}</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <Skeleton className="h-16 w-full rounded-xl" />
                        )}
                      </CardContent>
                    </Card>

                    {/* Nitro Perks and Benefits Card */}
                    <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl overflow-hidden">
                      <CardHeader className="pb-3 border-b border-[#f3f2f8]">
                        <CardTitle className="text-sm font-extrabold text-[#110e3d]">Nitro-Style Perks</CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 space-y-3">
                        <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3 text-xs">
                          <p className="text-[9px] font-black uppercase tracking-widest text-violet-500">Sticker Sync Mode</p>
                          <p className="mt-1 font-extrabold text-[#110e3d]">
                            {nitro.stickerSyncMode === "global_cross_server" ? "Global / Cross-Server Sync" : "Lokal per Group"}
                          </p>
                          <p className="mt-1 text-[10px] font-semibold text-slate-500">
                            {nitro.canUseAnimatedStickers ? "Animated stickers are supported." : "Static stickers only."}
                          </p>
                        </div>
                        {nitro.perks?.map((perk: string) => (
                          <div key={perk} className="rounded-xl border border-[#eae8f5] bg-white p-3 text-xs font-bold text-slate-600">
                            ✨ {perk}
                          </div>
                        ))}
                        <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 text-xs">
                          <p className="text-[9px] font-black uppercase tracking-widest text-amber-600">Premium+ Auto Boost</p>
                          <p className="mt-1 font-extrabold text-[#110e3d]">
                            {currentTier === "premium_plus" ? "Active di semua group yang kamu join" : "Locked (Upgrade ke Premium+)"}
                          </p>
                          <p className="mt-1 text-[10px] font-semibold text-slate-500">
                            Setiap member Premium+ memberikan 1 boost otomatis ke semua group yang dia ikuti.
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Buy Nitro / Boost Packages Form */}
                    <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl overflow-hidden">
                      <CardHeader className="pb-3 border-b border-[#f3f2f8]">
                        <CardTitle className="text-sm font-extrabold text-[#110e3d]">Request Plans / Boost Upgrade</CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 space-y-4">
                        <div className="flex bg-slate-50 p-1 rounded-xl border border-[#eae8f5] text-xs font-bold">
                          <button
                            onClick={() => setRequestMode("tier")}
                            className={`flex-1 py-2 text-center rounded-lg ${requestMode === "tier" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}
                          >
                            VIP Plan
                          </button>
                          <button
                            onClick={() => setRequestMode("boost")}
                            className={`flex-1 py-2 text-center rounded-lg ${requestMode === "boost" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}
                          >
                            Extra Boost
                          </button>
                        </div>

                        {requestMode === "tier" ? (
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pilih VIP Tier</Label>
                            <Select value={selectedTier} onValueChange={setSelectedTier}>
                              <SelectTrigger className="h-9 rounded-xl border-[#eae8f5] bg-slate-50 text-xs font-bold text-[#1e1b4b] shadow-none">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-white border-[#eae8f5] rounded-xl text-slate-700">
                                <SelectItem value="premium">Premium (Rp 25.000/bln)</SelectItem>
                                <SelectItem value="premium_plus">Premium+ (Rp 50.000/bln)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pilih Paket Boost</Label>
                              <Select value={selectedPackageSku} onValueChange={setSelectedPackageSku}>
                                <SelectTrigger className="h-9 rounded-xl border-[#eae8f5] bg-slate-50 text-xs font-bold text-[#1e1b4b] shadow-none">
                                  <SelectValue placeholder="Pilih paket boost" />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-[#eae8f5] rounded-xl text-slate-700">
                                  <SelectItem value="boost_1">1x Boost (Rp 10.000)</SelectItem>
                                  <SelectItem value="boost_3">3x Boost (Rp 25.000)</SelectItem>
                                  <SelectItem value="boost_5">5x Boost (Rp 40.000)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Group (Opsional)</Label>
                              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                                <SelectTrigger className="h-9 rounded-xl border-[#eae8f5] bg-slate-50 text-xs font-bold text-[#1e1b4b] shadow-none">
                                  <SelectValue placeholder="Pilih group target" />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-[#eae8f5] rounded-xl text-slate-700">
                                  <SelectItem value="none">Tanpa Target (Simpan Inventory)</SelectItem>
                                  {groupOptions.map((g: any) => (
                                    <SelectItem key={`buy-boost-g-${g.id}`} value={String(g.id)}>
                                      {g.name ?? `Group #${g.id}`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Catatan Tambahan</Label>
                          <Input
                            value={requestNote}
                            onChange={(e) => setRequestNote(e.target.value.slice(0, 100))}
                            placeholder="Tulis pesan atau bukti pembayaran jika ada..."
                            className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs"
                          />
                        </div>

                        <Button
                          onClick={() => {
                            if (!selectedPackageSku) {
                              toast({ title: "Pilih paket boost dulu", variant: "destructive" });
                              return;
                            }
                            paymentRequestMutation.mutate({
                              packageSku: selectedPackageSku,
                              conversationId: selectedGroupId !== "none" ? Number(selectedGroupId) : undefined,
                              note: requestNote.trim() || undefined,
                            });
                          }}
                          disabled={paymentRequestMutation.isPending}
                          className="w-full bg-[#6366f1] text-white hover:bg-violet-600 rounded-xl font-bold text-xs h-10 shadow-md"
                        >
                          {paymentRequestMutation.isPending ? "Mengarahkan..." : "Bayar Sekarang"}
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Invoice Logs */}
                    {paymentTickets.length > 0 && (
                      <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl overflow-hidden">
                        <CardHeader className="pb-3 border-b border-[#f3f2f8]">
                          <CardTitle className="text-sm font-extrabold text-[#110e3d] flex items-center gap-2">
                            <Ticket className="w-4 h-4 text-purple-500" /> Riwayat Pembelian & Invoice
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 divide-y divide-[#eae8f5]/50 space-y-3">
                          {paymentTickets.map((ticket: any) => (
                            <div key={ticket.id} className="flex justify-between items-center text-xs pt-3 first:pt-0">
                              <div>
                                <p className="font-extrabold text-[#110e3d]">
                                  {ticket.tier ? `Upgrade Plan - ${ticket.tier === 'premium_plus' ? 'Premium+' : 'Premium'}` : `Buy Boost - Package ${ticket.packageSku}`}
                                </p>
                                <p className="text-[10px] text-slate-400 font-bold">{format(new Date(ticket.createdAt), "dd MMM yyyy HH:mm")}</p>
                              </div>
                              <span className={`text-[9px] px-2 py-0.5 rounded-lg font-black uppercase tracking-wider ${
                                ticket.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                ticket.status === 'rejected' ? 'bg-red-50 text-red-600 border border-red-100' :
                                'bg-amber-50 text-amber-600 border border-amber-100'
                              }`}>
                                {ticket.status}
                              </span>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* Right Column: Server Boost inventory, Boosted servers */}
                  <div className="space-y-6">
                    {/* Boost Inventory Panel */}
                    <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl overflow-hidden">
                      <CardHeader className="pb-3 border-b border-[#f3f2f8]">
                        <CardTitle className="text-sm font-extrabold text-[#110e3d] flex items-center gap-2">
                          <Zap className="w-4 h-4 text-purple-500" /> Your Boost Inventory
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 space-y-4">
                        <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4">
                          <div className="grid gap-3 grid-cols-1 md:grid-cols-[1fr_auto]">
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-violet-500">Pilih Group</Label>
                              <Select value={selectedBoostGroupId} onValueChange={setSelectedBoostGroupId}>
                                <SelectTrigger className="h-9 rounded-xl border-violet-200 bg-white text-xs font-bold text-[#1e1b4b] shadow-none">
                                  <SelectValue placeholder="Pilih group target" />
                                </SelectTrigger>
                                <SelectContent className="border border-[#eae8f5] bg-white text-slate-700">
                                  <SelectItem value="none">Pilih group</SelectItem>
                                  {groupOptions.map((group: any) => (
                                    <SelectItem key={`premium-boost-group-${group.id}`} value={String(group.id)}>
                                      {group.name ?? `Group #${group.id}`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-violet-500">Jumlah Boost</Label>
                              <Select value={effectiveSelectedBoostAmount} onValueChange={setSelectedBoostAmount} disabled={selectableBoostAmounts.length === 0}>
                                <SelectTrigger className="h-9 rounded-xl border-violet-200 bg-white text-xs font-bold text-[#1e1b4b] shadow-none">
                                  <SelectValue placeholder="0 Boost" />
                                </SelectTrigger>
                                <SelectContent className="border border-[#eae8f5] bg-white text-slate-700">
                                  {selectableBoostAmounts.map((amount) => (
                                    <SelectItem key={`boost-amount-${amount}`} value={amount}>
                                      {amount} Boost
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <Button
                            onClick={() => {
                              if (selectedBoostGroupId === "none") {
                                toast({ title: "Pilih group dulu", variant: "destructive" });
                                return;
                              }
                              applyBulkBoostMutation.mutate({
                                conversationId: Number(selectedBoostGroupId),
                                boostCount: Number(effectiveSelectedBoostAmount || "0"),
                              });
                            }}
                            disabled={applyBulkBoostMutation.isPending || selectableBoostAmounts.length === 0}
                            className="w-full mt-3 h-9 rounded-xl bg-[#6366f1] text-xs font-black text-white hover:bg-violet-600 shadow-sm"
                          >
                            {applyBulkBoostMutation.isPending ? "Applying Boosts..." : "Apply Boost to Group"}
                          </Button>
                          <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-violet-200/50">
                            <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-black uppercase text-violet-700 border border-violet-100">
                              Available {availableBoostSlots.length}
                            </span>
                            <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-black uppercase text-slate-600 border border-slate-100">
                              Base {membershipData?.baseBoostCount || 0}
                            </span>
                            <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-black uppercase text-emerald-700 border border-emerald-100">
                              Purchased {membershipData?.purchasedBoostCount || 0}
                            </span>
                          </div>
                        </div>

                        {/* Individual boost slots */}
                        <div className="space-y-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Available Boost Slots</p>
                          {availableBoostSlots.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-[#eae8f5] bg-slate-50 p-4 text-center text-xs font-semibold text-slate-400">
                              Belum ada boost slot yang kosong.
                            </div>
                          ) : (
                            availableBoostSlots.map((slot: any) => (
                              <div key={`available-slot-${slot.id}`} className="rounded-xl border border-[#eae8f5] bg-white p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                <div>
                                  <p className="text-xs font-extrabold text-[#110e3d]">Slot #{slot.id}</p>
                                  <p className="text-[9px] font-semibold text-slate-400">
                                    Status: Available {slot.expiresAt ? ` - expires ${format(new Date(slot.expiresAt), "dd MMM yyyy")}` : ""}
                                  </p>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                  <Select
                                    value={slotTargets[slot.id] ?? "none"}
                                    onValueChange={(val) => setSlotTargets((current) => ({ ...current, [slot.id]: val }))}
                                  >
                                    <SelectTrigger className="h-8 rounded-lg border-[#eae8f5] bg-slate-50 text-[10px] font-bold text-[#1e1b4b] w-full sm:w-28 shadow-none">
                                      <SelectValue placeholder="Pilih target" />
                                    </SelectTrigger>
                                    <SelectContent className="border border-[#eae8f5] bg-white text-slate-700">
                                      <SelectItem value="none">Pilih server</SelectItem>
                                      {groupOptions.map((g: any) => (
                                        <SelectItem key={`slot-${slot.id}-g-${g.id}`} value={String(g.id)}>
                                          {g.name ?? `Group #${g.id}`}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    onClick={() => {
                                      const target = slotTargets[slot.id];
                                      if (!target || target === "none") {
                                        toast({ title: "Pilih target server dulu", variant: "destructive" });
                                        return;
                                      }
                                      applyBoostMutation.mutate({ slotId: slot.id, conversationId: Number(target) });
                                    }}
                                    disabled={applyBoostMutation.isPending}
                                    className="h-8 bg-[#6366f1] text-white hover:bg-violet-600 rounded-lg text-[10px] font-black px-2.5"
                                  >
                                    Boost
                                  </Button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Active boosts removal */}
                        <div className="space-y-3 pt-2 border-t border-slate-50">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Active Applied Boosts</p>
                          {activeBoostAssignments.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-[#eae8f5] bg-slate-50 p-4 text-center text-xs font-semibold text-slate-400">
                              Belum ada boost yang terpasang secara manual.
                            </div>
                          ) : (
                            activeBoostAssignments.map((slot: any) => (
                              <div key={`active-slot-${slot.id}`} className="rounded-xl border border-[#eae8f5] bg-white p-3 flex justify-between items-center gap-2">
                                <div>
                                  <p className="text-xs font-extrabold text-[#110e3d] truncate max-w-[150px]">
                                    {slot.assignment?.conversationName ?? `Group #${slot.assignment?.conversationId}`}
                                  </p>
                                  <p className="text-[9px] font-semibold text-slate-400">
                                    Slot #{slot.id}{slot.expiresAt ? ` - expires ${format(new Date(slot.expiresAt), "dd MMM yyyy")}` : ""}
                                  </p>
                                </div>
                                <Button
                                  variant="outline"
                                  onClick={() => revokeBoostMutation.mutate(slot.id)}
                                  disabled={revokeBoostMutation.isPending}
                                  className="h-8 rounded-lg border-red-200 bg-red-50 px-2.5 text-[10px] font-black text-red-600 hover:bg-red-100"
                                >
                                  Remove
                                </Button>
                              </div>
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Boosted Servers Status list */}
                    <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl overflow-hidden">
                      <CardHeader className="pb-3 border-b border-[#f3f2f8]">
                        <CardTitle className="text-sm font-extrabold text-[#110e3d] flex items-center gap-2">
                          <LayoutGrid className="w-4 h-4 text-purple-500" /> Boosted Server Statuses
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 space-y-3">
                        {groupOptions.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-[#eae8f5] bg-slate-50 p-4 text-center text-xs font-semibold text-slate-400">
                            Kamu belum bergabung dengan server/group mana pun.
                          </div>
                        ) : (
                          groupOptions.map((group: any) => (
                            <div key={`boosted-server-${group.id}`} className="rounded-xl border border-[#eae8f5] bg-white p-3 space-y-2 hover:border-violet-200 transition-all">
                              <div className="flex justify-between items-start gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-extrabold text-[#110e3d]">{group.name ?? `Group #${group.id}`}</p>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[8px] font-black uppercase text-slate-500 border border-slate-200/30">Level {group.level}</span>
                                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[8px] font-black uppercase text-violet-600 border border-violet-100">Manual {group.slotAssignments ?? 0}</span>
                                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[8px] font-black uppercase text-amber-600 border border-amber-100">Auto {group.premiumPlusMemberBoostCount ?? 0}</span>
                                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[8px] font-black uppercase text-emerald-600 border border-emerald-100">Total {group.activeBoostCount}</span>
                                  </div>
                                </div>
                                <Link
                                  href={`/member?tab=messages&group=${group.id}`}
                                  className="inline-flex shrink-0 items-center rounded-lg bg-[#6366f1] px-2.5 py-1 text-[9px] font-black text-white hover:bg-violet-600 transition-colors"
                                >
                                  Open
                                </Link>
                              </div>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
