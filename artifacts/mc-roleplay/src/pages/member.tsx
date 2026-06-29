import { useState, useRef, useEffect } from "react";
import { useGetMe, useUpdateMe, useListAnnouncements, useListDevelopments, useGetMySettings, useUpdateMySettings, useListTickets, useCreateTicket, useUpdateTicket, useListTicketMessages, useSendTicketMessage, getListTicketMessagesQueryOptions, useListForms, useGetForm, useSubmitVote, useSubmitForm, useGetMyFormResponse, customFetch, useListCredits, useListTicketReasons, useListSwitchableUsers, useGetGachaBoard, useSpinGacha, useListOwnedCosmetics, useEquipCosmetic, useListWalletTransactions } from "@workspace/api-client-react";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Music,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Repeat,
  Shuffle,
  Library,
  Search,
  Heart,
  ListMusic,
  Volume1,
  Clock,
  Crown,
  Zap,
  Plus,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  Gem,
  Gift,
  ImageIcon,
  Lock,
  Shield,
  Trophy,
  X,
  Store,
  Trash2,
  Pencil,
  ShoppingBag,
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

import MessagesPage from "./messages";
import FriendsTab from "./friends";
import ProfileTab from "./profile";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

declare global {
  interface Window {
    Spotify?: any;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

function SellerHub({
  agreed1, setAgreed1,
  agreed2, setAgreed2,
  agreed3, setAgreed3,
  subTab, setSubTab,
  searchQuery, setSearchQuery,
  productModalOpen, setProductModalOpen,
  editingProduct, setEditingProduct,
  prodName, setProdName,
  prodDesc, setProdDesc,
  prodPrice, setProdPrice,
  prodImg, setProdImg,
  prodActive, setProdActive,
  selectedProduct, setSelectedProduct,
  bizName, setBizName,
  bizDesc, setBizDesc,
  bizAutoReply, setBizAutoReply,
  hideOnline, setHideOnline
}: any) {
  const { data: me, refetch: refetchMe } = useGetMe();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [buyingProduct, setBuyingProduct] = useState(false);

  const { data: myPurchases = [], refetch: refetchMyPurchases } = useQuery({
    queryKey: ["/api/business/purchases"],
    queryFn: () => customFetch<any[]>("/api/business/purchases"),
  });

  const handleBuyProduct = async (productId: number) => {
    try {
      setBuyingProduct(true);
      const data = await customFetch<{ checkoutUrl: string }>(`/api/business/products/${productId}/buy`, {
        method: "POST"
      });
      if (data && data.checkoutUrl) {
        refetchMyPurchases();
        window.open(data.checkoutUrl, "_blank");
      } else {
        throw new Error("Checkout URL tidak ditemukan.");
      }
    } catch (err: any) {
      toast({
        title: "Gagal membuat invoice",
        description: err.message || "Terjadi kesalahan saat menghubungi SayaBayar.",
        variant: "destructive"
      });
    } finally {
      setBuyingProduct(false);
    }
  };

  const [orderStatusFilter, setOrderStatusFilter] = useState<"completed" | "pending" | "delivered">("completed");

  const { data: myOrders = [], isLoading: myOrdersLoading, refetch: refetchMyOrders } = useQuery({
    queryKey: ["/api/business/orders"],
    queryFn: () => customFetch<any[]>("/api/business/orders"),
    enabled: subTab === "orders" || subTab === "myshop"
  });

  const deliverOrderMutation = useMutation({
    mutationFn: (id: number) => customFetch<any>(`/api/business/orders/${id}/deliver`, { method: "POST" }),
    onSuccess: () => {
      refetchMyOrders();
      toast({ title: "Pesanan berhasil ditandai sebagai dikirim!" });
    }
  });

  const [syncingOrderId, setSyncingOrderId] = useState<number | null>(null);

  const handleSyncOrder = async (orderId: number) => {
    try {
      setSyncingOrderId(orderId);
      const updatedOrder = await customFetch<any>(`/api/business/orders/${orderId}/sync`, {
        method: "POST"
      });
      refetchMyOrders();
      if (updatedOrder.status === "completed") {
        toast({
          title: "Pembayaran terverifikasi!",
          description: "Pesanan kini berstatus Sudah Dibayar dan masuk ke tab Perlu Dikirim."
        });
      } else {
        toast({
          title: "Belum terbayar",
          description: "Pembeli belum menyelesaikan pembayaran di SayaBayar.",
        });
      }
    } catch (err: any) {
      toast({
        title: "Gagal menyinkronkan pembayaran",
        description: err.message || "Terjadi kesalahan.",
        variant: "destructive"
      });
    } finally {
      setSyncingOrderId(null);
    }
  };

  // Queries
  const { data: marketplaceProducts = [], isLoading: marketLoading } = useQuery({
    queryKey: ["/api/business/products"],
    queryFn: () => customFetch<any[]>("/api/business/products")
  });

  const { data: myProducts = [], isLoading: myProductsLoading, refetch: refetchMyProducts } = useQuery({
    queryKey: ["/api/business/my-products"],
    queryFn: () => customFetch<any[]>("/api/business/my-products"),
    enabled: subTab === "myshop"
  });

  // Mutations
  const saveProfileMutation = useMutation({
    mutationFn: (payload: any) => customFetch<any>("/api/business/profile", {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
    onSuccess: () => {
      refetchMe();
      toast({ title: "Profil Bisnis berhasil disimpan!" });
    },
    onError: (err: any) => {
      toast({ title: "Gagal menyimpan profil", description: err.message, variant: "destructive" });
    }
  });

  const saveProductMutation = useMutation({
    mutationFn: (payload: any) => {
      const url = editingProduct ? `/api/business/products/${editingProduct.id}` : "/api/business/products";
      const method = editingProduct ? "PATCH" : "POST";
      return customFetch<any>(url, {
        method,
        body: JSON.stringify(payload)
      });
    },
    onSuccess: () => {
      refetchMyProducts();
      queryClient.invalidateQueries({ queryKey: ["/api/business/products"] });
      setProductModalOpen(false);
      setEditingProduct(null);
      toast({ title: editingProduct ? "Produk berhasil diperbarui!" : "Produk baru berhasil dibuat!" });
    },
    onError: (err: any) => {
      toast({ title: "Gagal menyimpan produk", description: err.message, variant: "destructive" });
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id: number) => customFetch<any>(`/api/business/products/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      refetchMyProducts();
      queryClient.invalidateQueries({ queryKey: ["/api/business/products"] });
      toast({ title: "Produk berhasil dihapus!" });
    }
  });

  const toggleProductActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => customFetch<any>(`/api/business/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive })
    }),
    onSuccess: () => {
      refetchMyProducts();
      queryClient.invalidateQueries({ queryKey: ["/api/business/products"] });
    }
  });

  const requestVerificationMutation = useMutation({
    mutationFn: async () => {
      return new Promise((resolve) => setTimeout(resolve, 1000));
    },
    onSuccess: () => {
      toast({
        title: "Pengajuan Terkirim!",
        description: "Admin kami akan memverifikasi bisnis Anda dalam 24 jam."
      });
    }
  });

  const [, setLocation] = useLocation();
  const handleStartChatWithSeller = async (sellerUserId: number, sellerName: string) => {
    try {
      const conv = await customFetch<any>("/api/conversations/dm", {
        method: "POST",
        body: JSON.stringify({ targetUserId: sellerUserId })
      });
      setSelectedProduct(null);
      setLocation(`/member?tab=messages&convId=${conv.id}`);
      toast({ title: `Membuka obrolan dengan ${sellerName}` });
    } catch (err) {
      toast({ title: "Gagal memulai obrolan", variant: "destructive" });
    }
  };

  const handleOpenProductModal = (product?: any) => {
    if (product) {
      setEditingProduct(product);
      setProdName(product.name);
      setProdDesc(product.description || "");
      setProdPrice(product.price.toString());
      setProdImg(product.imageUrl || "");
      setProdActive(product.isActive);
    } else {
      setEditingProduct(null);
      setProdName("");
      setProdDesc("");
      setProdPrice("");
      setProdImg("");
      setProdActive(true);
    }
    setProductModalOpen(true);
  };

  const handleSaveProduct = () => {
    saveProductMutation.mutate({
      name: prodName,
      description: prodDesc,
      price: prodPrice,
      imageUrl: prodImg,
      isActive: prodActive
    });
  };

  const filteredProducts = marketplaceProducts.filter((p: any) => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.seller.businessName && p.seller.businessName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(price);
  };

  const allAgreed = agreed1 && agreed2 && agreed3;

  const becomeSellerMutation = useMutation({
    mutationFn: () => customFetch<any>("/api/business/become-seller", {
      method: "POST"
    }),
    onSuccess: () => {
      refetchMe();
      toast({
        title: "Toko Aktif!",
        description: "Selamat! Anda sekarang resmi menjadi Seller di Arcadia."
      });
    },
    onError: (err: any) => {
      toast({ title: "Pendaftaran gagal", description: err.message, variant: "destructive" });
    }
  });

  if (me && !(me as any).isSeller) {
    return (
      <div className="max-w-xl mx-auto bg-[#13121f] border border-zinc-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 my-4 text-white">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-emerald-950/40 border border-emerald-900/30 flex items-center justify-center mx-auto text-emerald-400">
            <Store className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-white">Mulai Jualan di Arcadia</h2>
          <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">
            WhatsApp Business Seller Agreement
          </p>
        </div>

        <div className="rounded-xl bg-zinc-950/40 border border-zinc-800/60 p-4 space-y-3.5">
          <p className="text-xs text-zinc-400 font-medium leading-relaxed">
            Untuk mengaktifkan fitur toko dan mulai menjual produk Anda di Marketplace Arcadia, silakan baca dan setujui ketentuan prosedur berikut:
          </p>

          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreed1}
                onChange={(e) => setAgreed1(e.target.checked)}
                className="mt-1 w-4.5 h-4.5 rounded border-zinc-700 bg-zinc-900/80 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="text-xs text-zinc-300 font-bold leading-normal">
                Saya bersedia melayani seluruh pembeli dengan jujur, ramah, dan sopan.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreed2}
                onChange={(e) => setAgreed2(e.target.checked)}
                className="mt-1 w-4.5 h-4.5 rounded border-zinc-700 bg-zinc-900/80 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="text-xs text-zinc-300 font-bold leading-normal">
                Saya setuju bahwa transaksi pembayaran wajib diarahkan ke platform <span className="text-violet-400 hover:underline">sayabayar.com</span> dengan deskripsi invoice yang sesuai.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreed3}
                onChange={(e) => setAgreed3(e.target.checked)}
                className="mt-1 w-4.5 h-4.5 rounded border-zinc-700 bg-zinc-900/80 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="text-xs text-zinc-300 font-bold leading-normal">
                Saya bersedia memproses pesanan dan menyerahkan barang segera setelah pembeli mengirimkan tangkapan layar (screenshot) bukti pembayaran yang sah.
              </span>
            </label>
          </div>
        </div>

        <Button
          onClick={() => becomeSellerMutation.mutate()}
          disabled={!allAgreed || becomeSellerMutation.isPending}
          className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm h-11 shadow-lg shadow-emerald-500/10 transition-all disabled:opacity-50"
        >
          {becomeSellerMutation.isPending ? "Mengaktifkan..." : "Aktifkan Akun Seller"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
        <div className="flex flex-col">
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Store className="w-5.5 h-5.5 text-emerald-500" /> Toko Saya
          </h2>
          <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider mt-0.5">
            WhatsApp Business Center
          </p>
        </div>
      </div>

      {/* MY SHOP CONTENT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Business Settings Pane */}
          <div className="lg:col-span-1 space-y-5">
            <div className="bg-[#1e1f22]/60 rounded-2xl border border-zinc-800/80 p-5 shadow-xl space-y-4">
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                ⚙️ Profil Bisnis
              </h3>

              {/* Verification Status Banner */}
              {me && (me as any).isBusinessVerified ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 flex items-start gap-2.5">
                  <BadgeCheck className="w-5 h-5 text-emerald-400 fill-emerald-400/10 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-black text-emerald-400">Bisnis Terverifikasi</h4>
                    <p className="text-[10px] text-emerald-300/80 font-bold mt-0.5 leading-normal">
                      Akun bisnis Anda telah mendapatkan lencana centang hijau resmi!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 flex flex-col gap-2">
                  <div className="flex items-start gap-2.5">
                    <Store className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-black text-amber-400">Belum Terverifikasi</h4>
                      <p className="text-[10px] text-amber-300/80 font-bold mt-0.5 leading-normal">
                        Ajukan verifikasi untuk membangun reputasi dan mendapatkan lencana centang hijau.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => requestVerificationMutation.mutate()}
                    className="w-full text-xs font-black border-amber-900/30 text-amber-400 hover:bg-amber-950/20 hover:text-amber-300"
                  >
                    Ajukan Verifikasi Bisnis
                  </Button>
                </div>
              )}

              <div className="space-y-3.5 pt-2">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-zinc-400">Nama Bisnis</Label>
                  <Input
                    placeholder="Contoh: Toko Diamond Zaidan"
                    value={bizName}
                    onChange={(e) => setBizName(e.target.value)}
                    className="rounded-xl border-zinc-800 text-xs font-semibold text-white bg-zinc-950/40 focus-visible:ring-violet-500"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-zinc-400">Deskripsi Bisnis</Label>
                  <Textarea
                    placeholder="Jelaskan apa yang Anda jual..."
                    value={bizDesc}
                    onChange={(e) => setBizDesc(e.target.value)}
                    rows={3}
                    className="rounded-xl border-zinc-800 text-xs font-semibold text-white bg-zinc-950/40 focus-visible:ring-violet-500 resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-zinc-400">Balas Otomatis Bot</Label>
                    <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/20 px-1.5 py-0.5 rounded border border-emerald-900/30">Bot Active</span>
                  </div>
                  <Textarea
                    placeholder="Contoh: Halo! Terima kasih telah menghubungi kami. Silakan beri tahu produk apa yang Anda minati..."
                    value={bizAutoReply}
                    onChange={(e) => setBizAutoReply(e.target.value)}
                    rows={3}
                    className="rounded-xl border-zinc-800 text-xs font-semibold text-white bg-zinc-950/40 focus-visible:ring-violet-500 resize-none"
                  />
                  <p className="text-[9px] text-zinc-500 font-bold leading-normal">
                    Pesan ini akan otomatis dikirimkan dari akun Anda sebagai balasan bot pertama di DM jika Anda menerima pesan baru.
                  </p>
                </div>

                {/* Hide Online Toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-800/85 bg-zinc-950/20">
                  <div className="space-y-0.5 pr-2">
                    <Label className="text-xs font-bold text-white">Sembunyikan Online</Label>
                    <p className="text-[9px] text-zinc-500 font-bold leading-normal">
                      Sembunyikan kehadiran aktif Anda agar selalu terlihat offline di chat.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHideOnline(!hideOnline)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${hideOnline ? "bg-emerald-500" : "bg-zinc-750"}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${hideOnline ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>

                <Button
                  onClick={() => saveProfileMutation.mutate({
                    businessName: bizName,
                    businessDescription: bizDesc,
                    businessAutoReply: bizAutoReply,
                    hideOnlineStatus: hideOnline
                  })}
                  disabled={saveProfileMutation.isPending}
                  className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-black text-xs h-10 shadow-md shadow-violet-500/10"
                >
                  {saveProfileMutation.isPending ? "Menyimpan..." : "Simpan Pengaturan"}
                </Button>
              </div>
            </div>
          </div>          {/* Product & Order Management Pane */}
          <div className="lg:col-span-2 space-y-4">
            {/* Tab Switcher */}
            <div className="flex items-center gap-1 bg-[#1e1f22]/80 p-1 rounded-xl border border-zinc-800/80 w-fit">
              <button
                type="button"
                onClick={() => setSubTab("myshop")}
                className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all ${
                  subTab === "myshop"
                    ? "bg-[#2b2d31] text-[#6366f1] shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                📦 Kelola Produk
              </button>
              <button
                type="button"
                onClick={() => setSubTab("orders")}
                className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  subTab === "orders"
                    ? "bg-[#2b2d31] text-[#6366f1] shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                📋 Pesanan Masuk
                {myOrders.filter((o: any) => o.status === "completed").length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </button>
            </div>

            {subTab === "myshop" ? (
              <div className="bg-[#1e1f22]/60 rounded-2xl border border-zinc-800/80 p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                    📦 Produk Saya ({myProducts.length})
                  </h3>
                  <Button
                    size="sm"
                    onClick={() => handleOpenProductModal()}
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-wider h-8"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Produk
                  </Button>
                </div>

                {myProductsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="w-full h-16 rounded-xl bg-zinc-800/50" />
                    ))}
                  </div>
                ) : myProducts.length === 0 ? (
                  <div className="border border-dashed border-zinc-800 rounded-2xl p-12 text-center space-y-2">
                    <ShoppingBag className="w-8 h-8 text-zinc-700 mx-auto" />
                    <p className="text-xs text-zinc-500 font-bold">Anda belum mengunggah produk apapun.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {myProducts.map((product: any) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-zinc-800/60 bg-zinc-900/10 hover:border-zinc-700/80 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-lg bg-zinc-950/50 border border-zinc-800/80 flex items-center justify-center shrink-0 overflow-hidden">
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <ShoppingBag className="w-5 h-5 text-zinc-700" />
                            )}
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <h4 className="text-xs font-black text-white truncate">{product.name}</h4>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-emerald-400">{formatPrice(product.price)}</span>
                              <span className={`text-[9px] font-black uppercase px-1.5 py-0.25 rounded ${product.isActive ? "bg-emerald-950/30 text-emerald-400 border border-emerald-900/50" : "bg-zinc-800/50 text-zinc-400 border border-zinc-750"}`}>
                                {product.isActive ? "Aktif" : "Draft"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Toggle Active Status */}
                          <button
                            type="button"
                            onClick={() => toggleProductActiveMutation.mutate({ id: product.id, isActive: !product.isActive })}
                            className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${product.isActive ? "bg-emerald-500" : "bg-zinc-750"}`}
                          >
                            <span className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${product.isActive ? "translate-x-4.5" : "translate-x-0"}`} />
                          </button>

                          {/* Edit Button */}
                          <button
                            onClick={() => handleOpenProductModal(product)}
                            className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => {
                              if (confirm("Apakah Anda yakin ingin menghapus produk ini?")) {
                                deleteProductMutation.mutate(product.id);
                              }
                            }}
                            className="p-1.5 hover:bg-red-950/20 text-zinc-500 hover:text-red-400 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[#1e1f22]/60 rounded-2xl border border-zinc-800/80 p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 flex-wrap gap-2">
                  <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                    📋 Pesanan Masuk
                  </h3>
                  
                  {/* Status Filter Tabs */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setOrderStatusFilter("completed")}
                      className={`text-xs font-bold pb-1 border-b-2 transition-all ${
                        orderStatusFilter === "completed"
                          ? "border-emerald-500 text-emerald-400"
                          : "border-transparent text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      Perlu Dikirim ({myOrders.filter((o: any) => o.status === "completed").length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderStatusFilter("pending")}
                      className={`text-xs font-bold pb-1 border-b-2 transition-all ${
                        orderStatusFilter === "pending"
                          ? "border-amber-500 text-amber-400"
                          : "border-transparent text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      Pending ({myOrders.filter((o: any) => o.status === "pending").length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderStatusFilter("delivered")}
                      className={`text-xs font-bold pb-1 border-b-2 transition-all ${
                        orderStatusFilter === "delivered"
                          ? "border-zinc-500 text-zinc-400"
                          : "border-transparent text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      Selesai ({myOrders.filter((o: any) => o.status === "delivered").length})
                    </button>
                  </div>
                </div>

                {myOrdersLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="w-full h-16 rounded-xl bg-zinc-800/50" />
                    ))}
                  </div>
                ) : myOrders.filter((o: any) => o.status === orderStatusFilter).length === 0 ? (
                  <div className="border border-dashed border-zinc-800 rounded-2xl p-12 text-center space-y-2">
                    <ClipboardList className="w-8 h-8 text-zinc-700 mx-auto" />
                    <p className="text-xs text-zinc-500 font-bold">
                      {orderStatusFilter === "completed"
                        ? "Tidak ada pesanan yang perlu dikirim saat ini."
                        : orderStatusFilter === "pending"
                        ? "Tidak ada pesanan pending (menunggu pembayaran)."
                        : "Belum ada pesanan yang selesai dikirim."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myOrders
                      .filter((o: any) => o.status === orderStatusFilter)
                      .map((order: any) => (
                        <div
                          key={order.id}
                          className="p-4 rounded-xl border border-zinc-800/60 bg-zinc-900/10 space-y-3.5"
                        >
                          {/* Top Row: Product and Price */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-lg bg-zinc-950/50 border border-zinc-800/80 flex items-center justify-center shrink-0 overflow-hidden">
                                {order.product?.imageUrl ? (
                                  <img src={order.product.imageUrl} alt={order.product.name} className="w-full h-full object-cover" />
                                ) : (
                                  <ShoppingBag className="w-4 h-4 text-zinc-700" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-xs font-black text-white truncate">{order.product?.name || "Produk Dihapus"}</h4>
                                <p className="text-[10px] text-zinc-500 font-bold">
                                  Dipesan pada: {new Date(order.createdAt).toLocaleString("id-ID", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit"
                                  })}
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-xs font-black text-emerald-400 block">{formatPrice(order.price)}</span>
                              <span className={`text-[9px] font-black uppercase tracking-wider block mt-0.5 ${
                                order.status === "completed"
                                  ? "text-emerald-400"
                                  : order.status === "pending"
                                  ? "text-amber-450"
                                  : "text-zinc-500"
                              }`}>
                                {order.status === "completed"
                                  ? "🟢 Sudah Bayar"
                                  : order.status === "pending"
                                  ? "🟡 Menunggu Bayar"
                                  : "✅ Selesai Dikirim"}
                              </span>
                            </div>
                          </div>

                          {/* Middle Row: Buyer Profile */}
                          <div className="flex items-center gap-2.5 bg-zinc-950/20 rounded-xl p-2.5 border border-zinc-800/40">
                            <Avatar className="w-7 h-7 border border-zinc-850">
                              <AvatarImage src={order.buyer?.avatarUrl} />
                              <AvatarFallback className="text-[9px] font-bold bg-zinc-900 text-zinc-400">
                                {order.buyer?.displayName ? order.buyer.displayName[0] : "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-extrabold text-zinc-200 truncate">
                                {order.buyer?.displayName || order.buyer?.username}
                              </p>
                              <p className="text-[9px] font-bold text-zinc-500 truncate">@{order.buyer?.username}</p>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 pt-0.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStartChatWithSeller(order.buyer.id, order.buyer.displayName || order.buyer.username)}
                              className="flex-1 text-[10px] font-black uppercase tracking-wider border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white h-8.5 rounded-lg"
                            >
                              <MessageSquare className="w-3.5 h-3.5 mr-1 text-[#6366f1]" /> Hubungi Pembeli
                            </Button>

                            {order.status === "completed" && (
                              <Button
                                size="sm"
                                onClick={() => deliverOrderMutation.mutate(order.id)}
                                disabled={deliverOrderMutation.isPending}
                                className="flex-1 text-[10px] font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white h-8.5 rounded-lg cursor-pointer"
                              >
                                {deliverOrderMutation.isPending ? (
                                  "Memproses..."
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Tandai Dikirim
                                  </>
                                )}
                              </Button>
                            )}

                            {order.status === "pending" && (
                              <Button
                                size="sm"
                                onClick={() => handleSyncOrder(order.id)}
                                disabled={syncingOrderId === order.id}
                                className="flex-1 text-[10px] font-black uppercase tracking-wider bg-amber-600 hover:bg-amber-700 text-white h-8.5 rounded-lg cursor-pointer"
                              >
                                {syncingOrderId === order.id ? (
                                  "Sinkronisasi..."
                                ) : (
                                  <>
                                    <Activity className="w-3.5 h-3.5 mr-1 animate-spin" /> Sinkronkan Bayar
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div> </div>

      {/* BUYER PRODUCT DETAIL MODAL */}
      <Dialog open={selectedProduct !== null} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="bg-[#1E1F22] border-[#3F4147] text-white max-w-lg rounded-2xl p-0 overflow-hidden">
          {selectedProduct && (
            <div className="flex flex-col">
              {/* Product Image Panel */}
              <div className="relative w-full h-56 bg-zinc-950/50 flex items-center justify-center border-b border-zinc-800/80">
                {selectedProduct.imageUrl ? (
                  <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-cover" />
                ) : (
                  <ShoppingBag className="w-14 h-14 text-zinc-755" />
                )}
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="absolute top-4 right-4 w-7 h-7 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white border-none cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Product Info */}
              <div className="p-5 space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base font-black text-white">{selectedProduct.name}</h3>
                  <p className="text-lg font-black text-emerald-400">{formatPrice(selectedProduct.price)}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-black text-zinc-550 uppercase tracking-wider">Deskripsi Produk</span>
                  <p className="text-xs text-zinc-355 leading-relaxed font-medium">
                    {selectedProduct.description || "Tidak ada deskripsi produk."}
                  </p>
                </div>

                {/* Seller Details Card */}
                <div className="p-3.5 rounded-xl border border-zinc-800/60 bg-zinc-950/30 space-y-2">
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Informasi Penjual</span>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="w-9 h-9 shrink-0 border border-zinc-800/80">
                        <AvatarImage src={selectedProduct.seller.avatarUrl} />
                        <AvatarFallback className="text-xs font-black bg-zinc-850 text-zinc-400">
                          {selectedProduct.seller.username.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <h4 className="text-xs font-black text-white truncate">
                            {selectedProduct.seller.businessName || selectedProduct.seller.displayName || selectedProduct.seller.username}
                          </h4>
                          {selectedProduct.seller.isBusinessVerified && (
                            <BadgeCheck className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500/20 shrink-0" />
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-500 font-bold truncate">@{selectedProduct.seller.username}</p>
                      </div>
                    </div>

                    {me?.id !== selectedProduct.seller.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStartChatWithSeller(selectedProduct.seller.id, selectedProduct.seller.businessName || selectedProduct.seller.username)}
                        className="text-[10px] font-black h-8 px-3 rounded-lg border-zinc-800 hover:bg-zinc-800 hover:text-white text-zinc-300"
                      >
                        <MessageSquare className="w-3.5 h-3.5 mr-1" /> Chat Seller
                      </Button>
                    )}
                  </div>
                </div>

                {/* Payment & Instructions */}
                {me?.id !== selectedProduct.seller.id ? (
                  <div className="space-y-3.5 pt-2">
                    {(() => {
                      const activePurchase = myPurchases.find(
                        (p: any) => p.productId === selectedProduct.id && p.status !== "delivered"
                      );

                      return (
                        <>
                          {activePurchase && (
                            <div className={`rounded-xl p-3.5 border ${
                              activePurchase.status === "completed"
                                ? "bg-emerald-950/20 border-emerald-900/30 text-emerald-400"
                                : "bg-amber-950/20 border-amber-900/30 text-amber-400"
                            }`}>
                              <h4 className="text-xs font-black flex items-center gap-1.5">
                                {activePurchase.status === "completed" ? "🟢 Status: Pembayaran Sukses" : "🟡 Status: Menunggu Pembayaran"}
                              </h4>
                              <p className="text-[10px] font-bold mt-1 opacity-90 leading-normal">
                                {activePurchase.status === "completed"
                                  ? "Pesanan Anda sedang diproses oleh seller. Silakan hubungi seller untuk pengiriman."
                                  : "Pembelian Anda sedang diproses. Silakan selesaikan pembayaran di SayaBayar menggunakan tombol di bawah."}
                              </p>
                            </div>
                          )}

                          <div className="rounded-xl bg-violet-950/20 border border-violet-900/30 p-3.5 space-y-1.5">
                            <h4 className="text-xs font-black text-violet-400 flex items-center gap-1">
                              💳 Cara Pembelian
                            </h4>
                            <ol className="text-[10px] text-violet-300/80 font-bold list-decimal list-inside space-y-1 leading-normal">
                              <li>Klik tombol <b>Beli Sekarang</b> untuk diarahkan ke sayabayar.com.</li>
                              <li>Selesaikan pembayaran dengan deskripsi invoice yang terisi otomatis.</li>
                              <li>Ambil screenshot bukti transfer/pembayaran berhasil.</li>
                              <li>Kirim bukti tersebut ke seller via tombol <b>Chat Seller</b> di atas.</li>
                            </ol>
                          </div>

                          {activePurchase?.status === "completed" ? (
                            <Button
                              disabled
                              className="w-full rounded-xl bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 font-black text-xs h-11 cursor-not-allowed"
                            >
                              Sudah Dibayar & Sedang Diproses
                            </Button>
                          ) : activePurchase?.status === "pending" ? (
                            <a
                              href={activePurchase.paymentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full flex items-center justify-center rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs h-11 shadow-lg shadow-amber-500/10 transition-colors"
                            >
                              Lanjutkan Pembayaran
                            </a>
                          ) : (
                            <Button
                              onClick={() => handleBuyProduct(selectedProduct.id)}
                              disabled={buyingProduct}
                              className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-black text-xs h-11 shadow-lg shadow-violet-500/10 transition-colors"
                            >
                              {buyingProduct ? "Membuat Invoice..." : "Beli Sekarang"}
                            </Button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <p className="text-[10px] text-center text-zinc-500 font-bold pt-2">
                    Ini adalah produk milik Anda sendiri.
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* SELLER CREATE/EDIT PRODUCT MODAL */}
      <Dialog open={productModalOpen} onOpenChange={setProductModalOpen}>
        <DialogContent className="bg-[#1E1F22] border-[#3F4147] text-white max-w-md rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-white">
              {editingProduct ? "Edit Produk" : "Tambah Produk Baru"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-zinc-400">Nama Produk</Label>
              <Input
                placeholder="Contoh: 1,000 Diamonds"
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
                className="rounded-xl border-zinc-800 text-xs font-semibold text-white bg-zinc-950/40 focus-visible:ring-violet-500"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-zinc-400">Harga (Rupiah)</Label>
              <Input
                type="number"
                placeholder="Contoh: 50000"
                value={prodPrice}
                onChange={(e) => setProdPrice(e.target.value)}
                className="rounded-xl border-zinc-800 text-xs font-semibold text-white bg-zinc-950/40 focus-visible:ring-violet-500"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-zinc-400">Deskripsi</Label>
              <Textarea
                placeholder="Spesifikasi produk, bonus, dll..."
                value={prodDesc}
                onChange={(e) => setProdDesc(e.target.value)}
                rows={3}
                className="rounded-xl border-zinc-800 text-xs font-semibold text-white bg-zinc-950/40 focus-visible:ring-violet-500 resize-none"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-zinc-400">URL Gambar (Opsional)</Label>
              <Input
                placeholder="https://example.com/image.png"
                value={prodImg}
                onChange={(e) => setProdImg(e.target.value)}
                className="rounded-xl border-zinc-800 text-xs font-semibold text-white bg-zinc-950/40 focus-visible:ring-violet-500"
              />
            </div>

            {/* Active Switch */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-800/60 bg-zinc-950/20">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-white">Tampilkan di Marketplace</Label>
                <p className="text-[9px] text-zinc-500 font-bold leading-normal">
                  Jika dinonaktifkan, produk hanya disimpan sebagai draf.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProdActive(!prodActive)}
                className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${prodActive ? "bg-emerald-500" : "bg-zinc-750"}`}
              >
                <span className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${prodActive ? "translate-x-4.5" : "translate-x-0"}`} />
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => setProductModalOpen(false)}
              className="rounded-xl text-xs font-bold text-zinc-400 hover:bg-zinc-800 hover:text-white"
            >
              Batal
            </Button>
            <Button
              onClick={handleSaveProduct}
              disabled={saveProductMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold px-4"
            >
              {saveProductMutation.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Member() {
  const {
    data: user,
    isLoading: userLoading,
    error: userError,
    refetch: refetchUser,
  } = useGetMe();
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
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Lifted SellerHub states to survive Clerk settings panel remounts
  const [sellerSubTab, setSellerSubTab] = useState<"marketplace" | "myshop">("marketplace");
  const [sellerSearchQuery, setSellerSearchQuery] = useState("");
  const [sellerProductModalOpen, setSellerProductModalOpen] = useState(false);
  const [sellerEditingProduct, setSellerEditingProduct] = useState<any | null>(null);
  const [sellerProdName, setSellerProdName] = useState("");
  const [sellerProdDesc, setSellerProdDesc] = useState("");
  const [sellerProdPrice, setSellerProdPrice] = useState("");
  const [sellerProdImg, setSellerProdImg] = useState("");
  const [sellerProdActive, setSellerProdActive] = useState(true);
  const [sellerSelectedProduct, setSellerSelectedProduct] = useState<any | null>(null);
  const [sellerBizName, setSellerBizName] = useState("");
  const [sellerBizDesc, setSellerBizDesc] = useState("");
  const [sellerBizAutoReply, setSellerBizAutoReply] = useState("");
  const [sellerHideOnline, setSellerHideOnline] = useState(false);
  const [sellerAgreed1, setSellerAgreed1] = useState(false);
  const [sellerAgreed2, setSellerAgreed2] = useState(false);
  const [sellerAgreed3, setSellerAgreed3] = useState(false);

  useEffect(() => {
    if (user) {
      setSellerBizName((user as any).businessName || "");
      setSellerBizDesc((user as any).businessDescription || "");
      setSellerBizAutoReply((user as any).businessAutoReply || "");
      setSellerHideOnline(!!(user as any).hideOnlineStatus);
    }
  }, [user]);
  const realmName = realmSettings.realmName || "Arcadia Guild";
  const realmLogoUrl = realmSettings.realmLogoUrl || "";
  const selfDisplayName =
    user?.displayName?.trim() ||
    user?.username?.trim() ||
    clerkUser?.fullName?.trim() ||
    clerkUser?.username?.trim() ||
    clerkUser?.primaryEmailAddress?.emailAddress?.split("@")[0]?.trim() ||
    "Player";
  const selfAvatarUrl = user?.avatarUrl || clerkUser?.imageUrl || undefined;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && ["dashboard", "announcements", "developments", "tickets", "forms", "profile", "profile_edit", "credits", "settings", "gacha", "wallet", "membership", "music", "messages", "seller", "guilds"].includes(tab)) {
      setActiveTab(tab);
      if (tab === "profile") {
        const idParam = params.get("id");
        setProfileUserId(idParam ? Number(idParam) : (user?.id ?? null));
      }
    } else if (!tab) {
      setActiveTab("dashboard");
    }
  }, [window.location.search, user]);

  useEffect(() => {
    if (activeTab !== "settings") return;

    const observer = new MutationObserver(() => {
      const emailInput = document.querySelector('input[type="email"], input[name="emailAddress"]');
      if (emailInput) {
        const form = emailInput.closest('form, .cl-form');
        if (form && !form.querySelector('.email-cooldown-warning')) {
          const warning = document.createElement('div');
          warning.className = 'email-cooldown-warning bg-amber-950/20 border border-amber-900/30 border-l-4 border-l-amber-500 p-3 rounded-r-lg mb-4 shadow-sm text-xs text-amber-200 font-bold leading-relaxed';
          warning.innerHTML = '⚠️ <strong>Keamanan Akun:</strong> Tunggu 7 hari setelah pembuatan akun, atau setelah ganti akun gmail untuk dapat mengubah email kembali demi keamanan akun Anda.';
          form.insertBefore(warning, form.firstChild);
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [activeTab]);

  const handleTabChange = (tabName: string) => {
    setActiveTab(tabName);
    if (tabName === "profile") {
      setProfileUserId(user?.id ?? null);
      setLocation(`/member?tab=profile`);
    } else {
      setLocation(`/member?tab=${tabName}`);
    }
    window.location.hash = "";
  };

  const handleTabChangeMobile = (tabName: string) => {
    setActiveTab(tabName);
    if (tabName === "profile") {
      setProfileUserId(user?.id ?? null);
      setLocation(`/member?tab=profile`);
    } else {
      setLocation(`/member?tab=${tabName}`);
    }
    window.location.hash = "";
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

    const containsHtml = (str: string) => /<[^>]+>/.test(str);
    if (containsHtml(displayName) || containsHtml(bio) || containsHtml(username) || containsHtml(youtubeLiveUrl)) {
      toast({ title: "Validation Error", description: "HTML tags are not allowed in profile fields.", variant: "destructive" });
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

  if (userError || !user) {
    const errorMessage =
      userError instanceof Error
        ? userError.message
        : "Koneksi ke server API gagal. Cek backend port 5000 dan DATABASE_URL.";

    return (
      <div className="bg-[#f4f3f8] min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-xl rounded-3xl border border-red-200 bg-white p-8 shadow-xl shadow-red-100/60">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-black text-[#110e3d]">Guild Portal gagal dimuat</h1>
              <p className="text-sm font-semibold text-slate-500">
                Frontend hidup, tapi data member dari backend belum kebaca.
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              onClick={() => {
                void refetchUser();
              }}
              className="bg-[#6366f1] hover:bg-[#5558e8] text-white"
            >
              Coba Lagi
            </Button>
            <Link href="/" className="inline-flex">
              <Button variant="outline" className="font-bold">
                Kembali ke Home
              </Button>
            </Link>
          </div>
        </div>
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
    <div className={`${activeTab === "messages" ? "h-[100dvh] overflow-hidden overscroll-none" : "min-h-screen"} bg-[#f4f3f8] text-[#1e1b4b] flex font-sans antialiased`}>
      {/* â”€â”€ Left Sidebar (Desktop) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
                <button
                  onClick={() => handleTabChange("seller")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "seller"
                      ? "bg-violet-50 text-[#6366f1]"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Store className="w-4.5 h-4.5 text-emerald-500" /> Seller Hub
                </button>
                <button
                  onClick={() => handleTabChange("membership")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "membership"
                      ? "bg-violet-50 text-[#6366f1]"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Activity className="w-4.5 h-4.5 text-cyan-500" /> Membership & Boost
                </button>
                <button
                  onClick={() => handleTabChange("music")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "music"
                      ? "bg-violet-50 text-[#6366f1]"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Music className="w-4.5 h-4.5 text-pink-500" /> Music Player
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
                <button
                  onClick={() => handleTabChange("messages")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "messages"
                      ? "bg-violet-50 text-[#6366f1]"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <MessageSquare className="w-4.5 h-4.5" /> Messages
                </button>
                <button
                  onClick={() => handleTabChange("guilds")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "guilds"
                      ? "bg-violet-50 text-[#6366f1]"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Users className="w-4.5 h-4.5 text-indigo-500" /> Guilds
                </button>
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

            {user && (
              <div className="space-y-1.5">
                <span className="px-3 text-[10px] font-black text-purple-600 uppercase tracking-widest block">Premium</span>
                <nav className="space-y-1">
                  <Link
                    href="/premium"
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-purple-600 hover:bg-purple-50 border border-purple-200/30 bg-purple-50/10"
                  >
                    <Crown className="w-4.5 h-4.5 text-purple-500" /> Premium Area
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
                    activeTab === "profile" || activeTab === "profile_edit"
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
              <AvatarImage src={selfAvatarUrl} />
              <AvatarFallback className="text-xs bg-slate-100 font-extrabold text-[#6366f1]">
                {getInitials(selfDisplayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#110e3d] truncate">{selfDisplayName}</p>
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

      {/* â”€â”€ Mobile Sidebar Drawer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
                <Button variant="ghost" size="sm" onClick={() => setMobileSidebarOpen(false)} className="text-slate-400 hover:text-[#110e3d]">âœ•</Button>
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
                <button
                  onClick={() => handleTabChangeMobile("seller")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "seller" ? "bg-violet-50 text-[#6366f1]" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <Store className="w-4.5 h-4.5 text-emerald-500" /> Seller Hub
                </button>
                <button
                  onClick={() => handleTabChangeMobile("membership")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "membership" ? "bg-violet-50 text-[#6366f1]" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <Activity className="w-4.5 h-4.5 text-cyan-500" /> Membership & Boost
                </button>
                <button
                  onClick={() => handleTabChangeMobile("music")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "music" ? "bg-violet-50 text-[#6366f1]" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <Music className="w-4.5 h-4.5 text-pink-500" /> Music Player
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
                  <button
                    onClick={() => handleTabChangeMobile("messages")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === "messages"
                        ? "bg-violet-50 text-[#6366f1]"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <MessageSquare className="w-4.5 h-4.5" /> Messages
                  </button>
                  <button
                    onClick={() => handleTabChangeMobile("guilds")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === "guilds"
                        ? "bg-violet-50 text-[#6366f1]"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Users className="w-4.5 h-4.5 text-indigo-500" /> Guilds
                  </button>
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

                {user && (
                  <div className="py-2 border-t border-[#eae8f5] my-2">
                    <span className="px-3 text-[9px] font-black text-purple-600 uppercase tracking-widest block mb-1">Premium</span>
                    <Link
                      href="/premium"
                      onClick={() => setMobileSidebarOpen(false)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-purple-600 hover:bg-purple-50 border border-purple-200/30 bg-purple-50/10"
                    >
                      <Crown className="w-4.5 h-4.5 text-purple-500" /> Premium Area
                    </Link>
                  </div>
                )}

                <div className="py-2 border-t border-[#eae8f5] my-2">
                  <span className="px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Account</span>
                  <button
                    onClick={() => handleTabChangeMobile("profile")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === "profile" || activeTab === "profile_edit" ? "bg-violet-50 text-[#6366f1]" : "text-slate-500 hover:bg-slate-50"
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

      {/* â”€â”€ Main Content Area â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <main className={`flex-1 flex flex-col min-w-0 ${activeTab === "messages" ? "overflow-hidden" : "overflow-y-auto"} ${activeTab === "seller" ? "bg-[#09090b]" : ""}`}>
        {/* Top Header Bar */}
        <header className={`h-16 border-b px-6 flex items-center justify-between shrink-0 ${activeTab === "seller" ? "bg-[#0c0c0e] border-zinc-800/80" : "bg-white border-[#eae8f5]"}`}>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileSidebarOpen(true)}
              className={`md:hidden p-1 ${activeTab === "seller" ? "text-zinc-400 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}
            >
              <Menu className="w-5.5 h-5.5" />
            </Button>
            {/* Breadcrumbs */}
            <div className={`flex items-center gap-2 text-xs font-bold ${activeTab === "seller" ? "text-zinc-500" : "text-slate-400"}`}>
              <span>Guild Portal</span>
              <span>/</span>
              <span className={`capitalize ${activeTab === "seller" ? "text-white font-black" : "text-[#110e3d]"}`}>
                {activeTab === "dashboard" ? "Dashboard" : activeTab === "announcements" ? "Town Crier" : activeTab === "developments" ? "The Forge" : activeTab === "tickets" ? "Support Tickets" : activeTab === "forms" ? "Voting & Forms" : activeTab === "profile" ? "My Profile" : activeTab === "settings" ? "Account Settings" : activeTab === "gacha" ? "Gacha Royale" : activeTab === "wallet" ? "My Wallet" : activeTab === "membership" ? "Membership & Boost" : activeTab === "music" ? "Music Player" : activeTab === "messages" ? "Messages" : activeTab === "seller" ? "Toko Saya" : "Arcadia Credits"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Copy server IP widget */}
            <button
              onClick={handleCopyIP}
              className={`hidden sm:flex items-center gap-2 border transition-all rounded-xl py-1.5 px-3 group text-left cursor-pointer ${
                activeTab === "seller"
                  ? "border-zinc-800 bg-zinc-900/40 hover:bg-zinc-850/50 hover:border-zinc-750"
                  : "border-[#eae8f5] bg-slate-50 hover:bg-violet-50/50 hover:border-violet-200"
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-zinc-500 leading-none">SERVER IP</span>
                <span className={`text-[10px] font-black leading-tight ${activeTab === "seller" ? "text-zinc-200" : "text-slate-700"}`}>play.arcadiamc.net</span>
              </div>
              <div className={`ml-1 transition-colors ${activeTab === "seller" ? "text-zinc-500 group-hover:text-emerald-450" : "text-slate-400 group-hover:text-[#6366f1]"}`}>
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

        {/* Messages Tab - Full height chat layout */}
        {activeTab === "messages" && (
          <div className="flex-1 min-h-0 overflow-hidden px-4 md:px-6 pb-4 md:pb-6 pt-0">
            <div className="h-full min-h-0 rounded-2xl border border-[#eae8f5] shadow-sm bg-white overflow-hidden">
              <MessagesPage embedded />
            </div>
          </div>
        )}

        {/* Content Container */}
        {activeTab !== "messages" && (
        <div className={`flex-1 p-6 md:p-8 max-w-6xl w-full mx-auto space-y-6 overflow-y-auto ${activeTab === "seller" ? "bg-[#09090b]" : ""}`}>
          {/* Guilds (Friends) Tab */}
          {activeTab === "guilds" && (
            <FriendsTab embedded={true} />
          )}

          {/* Profile Tab */}
          {activeTab === "profile" && profileUserId !== null && (
            <ProfileTab id={profileUserId} embedded={true} />
          )}

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
                              By {ann.authorName} â€¢ {format(new Date(ann.createdAt), 'MMMM d, yyyy')}
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
          {activeTab === "profile_edit" && (
            <div className="space-y-6 max-w-2xl">
              {/* Edit Profile Form */}
              <Card className="bg-white border-[#eae8f5] shadow-sm rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-sm font-extrabold text-[#110e3d]">Edit Profile Settings</CardTitle>
                  <p className="text-[11px] text-slate-400 font-semibold mt-1">
                    Handle: <span className="text-slate-800 font-bold">@{user?.username}</span>
                    {user?.userTag && <> <span className="text-[#6366f1] font-bold">{user.userTag}</span></>}
                    {user?.displayName && <> Â· Display Name: <span className="text-slate-800 font-bold">{user.displayName}</span></>}
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
                      placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
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
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Settings className="h-5 w-5 text-[#a78bfa]" /> Account Settings
                </h2>
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider mt-0.5">Manage your email, two-factor authentication, and connected accounts</p>
              </div>

              {/* Email Change Security Warning */}
              <div className="bg-amber-950/20 border border-amber-900/30 border-l-4 border-l-amber-500 p-4 rounded-r-xl shadow-sm">
                <div className="flex gap-3">
                  <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider">Perhatian Keamanan Akun</h4>
                    <p className="text-xs text-amber-200/90 font-bold mt-1 leading-relaxed">
                      Tunggu 7 hari setelah pembuatan akun, atau setelah ganti akun gmail untuk dapat mengubah email kembali demi keamanan akun Anda.
                    </p>
                  </div>
                </div>
              </div>

              {/* Email Addresses List (for 2 or more emails) */}
              {clerkUser && clerkUser.emailAddresses.length > 1 && (
                <div className="bg-[#0f0e17]/80 border border-zinc-800/80 p-5 rounded-2xl shadow-xl">
                  <h3 className="text-xs font-black text-white uppercase tracking-wider mb-3">Daftar Email Anda</h3>
                  <div className="space-y-2">
                    {clerkUser.emailAddresses.map((email) => (
                      <div key={email.id} className="flex items-center justify-between bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/60">
                        <span className="text-xs font-bold text-zinc-300">{email.emailAddress}</span>
                        <div className="flex items-center gap-2">
                          {email.id === clerkUser.primaryEmailAddressId ? (
                            <span className="text-[10px] bg-violet-950/40 text-[#a78bfa] border border-violet-900/50 px-2 py-0.5 rounded-md font-black uppercase tracking-wide">Primary</span>
                          ) : (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-red-400 hover:bg-red-950/30 hover:text-red-300 rounded-lg transition-colors"
                              onClick={async () => {
                                if (confirm(`Apakah Anda yakin ingin menghapus email ${email.emailAddress}?`)) {
                                  try {
                                    await email.destroy();
                                    toast({ title: "Email berhasil dihapus" });
                                  } catch (err: any) {
                                    toast({ title: "Gagal menghapus email", description: err.message, variant: "destructive" });
                                  }
                                }
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* WhatsApp Bisnis Seller Status Card */}
              <Card className="bg-[#0f0e17]/80 backdrop-blur-xl border border-zinc-800/80 shadow-2xl shadow-black/50 rounded-3xl overflow-hidden p-6 transition-all duration-300 hover:border-violet-500/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-white flex items-center gap-1.5 uppercase tracking-wider">
                      <Store className="w-5 h-5 text-emerald-500" /> Akun Toko & Seller Hub
                    </h3>
                    <p className="text-xs text-zinc-500 font-medium">
                      {user && (user as any).isSeller 
                        ? "Akun seller Anda aktif. Anda dapat mengunggah produk dan mengelola toko Anda."
                        : "Aktifkan akun seller Anda untuk mulai menjual produk dan mengaktifkan fitur WhatsApp Bisnis."}
                    </p>
                  </div>

                  <div>
                    {user && (user as any).isSeller ? (
                      <Button
                        onClick={() => handleTabChange("seller")}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-500/10 uppercase tracking-wider"
                      >
                        Buka Seller Hub
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleTabChange("seller")}
                        className="bg-[#6366f1] hover:bg-indigo-700 text-white font-black text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-violet-500/10 uppercase tracking-wider"
                      >
                        Daftar Jadi Seller
                      </Button>
                    )}
                  </div>
                </div>
              </Card>

              <Card className="bg-[#0f0e17]/80 backdrop-blur-xl border border-zinc-800/80 shadow-2xl shadow-black/50 rounded-3xl overflow-hidden p-1 sm:p-4 md:p-6 transition-all duration-300 hover:border-violet-500/20">
                <UserProfile 
                  routing="hash" 
                  appearance={{
                    elements: {
                      rootBox: "w-full",
                      cardBox: "w-full shadow-none border-0 bg-transparent max-w-none flex",
                      card: "shadow-none border-0 bg-transparent w-full",
                      navbar: "hidden md:flex bg-[#09090b] border-r border-zinc-800/80 p-6 rounded-l-2xl shrink-0 gap-1.5",
                      pageScrollable: "p-4 sm:p-6 md:p-8 w-full !bg-[#0f0e17]",
                      profileSectionTitleText: "!text-white !font-black !text-xs uppercase !tracking-wider",
                      profileSectionSubtitleText: "!text-zinc-500 !text-[11px] !font-bold",
                      headerTitle: "!text-white !font-black !text-base uppercase !tracking-wider",
                      headerSubtitle: "!text-zinc-500 !text-xs !font-bold",
                      formButtonPrimary: "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black text-[10px] rounded-xl py-3 px-5 shadow-lg shadow-violet-950/50 hover:shadow-violet-900/50 transition-all duration-200 uppercase tracking-widest",
                      navbarButton: "text-zinc-400 hover:text-white hover:bg-zinc-800/50 font-black text-[11px] rounded-xl px-4 py-3.5 transition-all duration-200 uppercase tracking-wider",
                      navbarButtonActive: "text-[#a78bfa] bg-violet-950/30 hover:bg-violet-950/30 font-black shadow-sm border-l-4 border-[#a78bfa] rounded-l-none",
                      profileSection: "border-b border-zinc-800/80 pb-8 mb-8 last:border-0",
                      userPreview: "bg-zinc-900/50 border border-zinc-800/60 p-6 rounded-2xl shadow-inner",
                      userPreviewTextContainer: "ml-4",
                      userPreviewTitle: "!text-white !font-black !text-sm",
                      userPreviewSubtitle: "!text-zinc-500 !font-bold !text-xs",
                      formFieldLabel: "!text-zinc-300 !font-black !text-xs uppercase !tracking-wider",
                      formFieldInput: "!bg-zinc-950/50 !border-zinc-800 focus:!border-violet-500 focus:!ring-2 focus:!ring-violet-950/50 !text-white rounded-xl text-xs h-10 transition-all duration-200",
                      dividerText: "!text-zinc-600 !font-bold !text-[10px] uppercase",
                      dividerLine: "!bg-zinc-800/85",
                      identityPreviewEditButton: "!text-[#a78bfa] hover:!text-violet-350 !font-black !text-xs transition-colors",
                      formFieldSuccessText: "!text-emerald-400 !font-bold",
                      alertText: "!text-red-400 !font-bold",
                      alert: "!bg-red-950/20 !border-red-900/30 rounded-2xl p-4",
                      otpCodeFieldInput: "!bg-zinc-950 !border-zinc-800 !text-white rounded-xl h-10",
                      navbarTitle: "!text-white !font-black !text-xs uppercase !tracking-wider",
                      navbarSubtitle: "!text-zinc-500 !text-[10px]",
                      breadcrumbsItem: "!text-zinc-500 !font-bold !text-xs",
                      breadcrumbsItemActive: "!text-white !font-black !text-xs",
                      breadcrumbsSeparator: "!text-zinc-700",
                      accordionTriggerButton: "!text-zinc-200 !font-bold",
                      accordionContent: "!text-zinc-400",
                    },
                    variables: {
                      colorPrimary: "#a78bfa",
                      colorBackground: "#0f0e17",
                      colorText: "#f4f4f5",
                      colorTextSecondary: "#a1a1aa",
                      colorForeground: "#f4f4f5",
                      colorMutedForeground: "#71717a",
                      colorInput: "#18181b",
                      colorInputForeground: "#f4f4f5",
                      colorNeutral: "#27272a",
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
                        <h3 className="text-base font-extrabold text-white">Switch Account</h3>
                        <p className="text-xs text-zinc-500 font-semibold mt-0.5">Keep multiple active sessions and quickly toggle characters</p>
                      </div>
                      <DevSwitchAccountCard />
                    </div>
                  </UserProfile.Page>
                  <UserProfile.Page
                    label={user && (user as any).isSeller ? "Seller Hub" : "Jadi Seller"}
                    url="seller"
                    labelIcon={<Store className="w-4.5 h-4.5" />}
                  >
                    <div className="space-y-4 pt-1">
                      <div className="flex flex-col mb-4">
                        <h3 className="text-base font-extrabold text-white">
                          {user && (user as any).isSeller ? "Seller Hub" : "Jadi Seller"}
                        </h3>
                        <p className="text-xs text-zinc-500 font-semibold mt-0.5">
                          {user && (user as any).isSeller
                            ? "Status toko Anda: Aktif"
                            : "Daftar sebagai penjual resmi untuk mulai menjual produk di Arcadia."}
                        </p>
                      </div>
                      {user && (user as any).isSeller ? (
                        <div className="rounded-xl bg-zinc-950/40 border border-zinc-800/60 p-6 text-center space-y-4">
                          <div className="w-12 h-12 rounded-full bg-emerald-950/50 border border-emerald-900/30 flex items-center justify-center mx-auto text-emerald-400">
                            <Check className="w-6 h-6 animate-pulse" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-sm font-extrabold text-white">Akun Seller Anda Sudah Aktif</h4>
                            <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto">
                              Anda sudah terdaftar sebagai seller resmi di Arcadia. Silakan kelola produk, harga, dan fitur bisnis lainnya melalui halaman utama Seller Hub.
                            </p>
                          </div>
                          <Button
                            onClick={() => handleTabChange("seller")}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-all duration-200"
                          >
                            Buka Seller Hub
                          </Button>
                        </div>
                      ) : (
                        <SellerHub
                          agreed1={sellerAgreed1} setAgreed1={setSellerAgreed1}
                          agreed2={sellerAgreed2} setAgreed2={setSellerAgreed2}
                          agreed3={sellerAgreed3} setAgreed3={setSellerAgreed3}
                          subTab={sellerSubTab} setSubTab={setSellerSubTab}
                          searchQuery={sellerSearchQuery} setSearchQuery={setSellerSearchQuery}
                          productModalOpen={sellerProductModalOpen} setProductModalOpen={setSellerProductModalOpen}
                          editingProduct={sellerEditingProduct} setEditingProduct={setSellerEditingProduct}
                          prodName={sellerProdName} setProdName={setSellerProdName}
                          prodDesc={sellerProdDesc} setProdDesc={setSellerProdDesc}
                          prodPrice={sellerProdPrice} setProdPrice={setSellerProdPrice}
                          prodImg={sellerProdImg} setProdImg={setSellerProdImg}
                          prodActive={sellerProdActive} setProdActive={setSellerProdActive}
                          selectedProduct={sellerSelectedProduct} setSelectedProduct={setSellerSelectedProduct}
                          bizName={sellerBizName} setBizName={setSellerBizName}
                          bizDesc={sellerBizDesc} setBizDesc={setSellerBizDesc}
                          bizAutoReply={sellerBizAutoReply} setBizAutoReply={setSellerBizAutoReply}
                          hideOnline={sellerHideOnline} setHideOnline={setSellerHideOnline}
                        />
                      )}
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

          {activeTab === "membership" && (
            <div className="space-y-4">
              <div className="flex flex-col">
                <h2 className="text-lg font-black text-[#110e3d]">Membership & Boost</h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Tier aktif, batas upload, boost aktif, dan shared storage</p>
              </div>
              <MembershipTab />
            </div>
          )}

          {/* Music Player Tab */}
          {activeTab === "music" && (
            <div className="space-y-4">
              <div className="flex flex-col">
                <h2 className="text-lg font-black text-[#110e3d]">Music Player</h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Stream high-quality RPG background soundtracks</p>
              </div>
              <MusicTab />
            </div>
          )}

          {/* Seller Hub Tab */}
          {activeTab === "seller" && (
            <SellerHub
              agreed1={sellerAgreed1} setAgreed1={setSellerAgreed1}
              agreed2={sellerAgreed2} setAgreed2={setSellerAgreed2}
              agreed3={sellerAgreed3} setAgreed3={setSellerAgreed3}
              subTab={sellerSubTab} setSubTab={setSellerSubTab}
              searchQuery={sellerSearchQuery} setSearchQuery={setSellerSearchQuery}
              productModalOpen={sellerProductModalOpen} setProductModalOpen={setSellerProductModalOpen}
              editingProduct={sellerEditingProduct} setEditingProduct={setSellerEditingProduct}
              prodName={sellerProdName} setProdName={setSellerProdName}
              prodDesc={sellerProdDesc} setProdDesc={setSellerProdDesc}
              prodPrice={sellerProdPrice} setProdPrice={setSellerProdPrice}
              prodImg={sellerProdImg} setProdImg={setSellerProdImg}
              prodActive={sellerProdActive} setProdActive={setSellerProdActive}
              selectedProduct={sellerSelectedProduct} setSelectedProduct={setSellerSelectedProduct}
              bizName={sellerBizName} setBizName={setSellerBizName}
              bizDesc={sellerBizDesc} setBizDesc={setSellerBizDesc}
              bizAutoReply={sellerBizAutoReply} setBizAutoReply={setSellerBizAutoReply}
              hideOnline={sellerHideOnline} setHideOnline={setSellerHideOnline}
            />
          )}
        </div>
        )}
      </main>

      {/* â”€â”€ Dialog Modals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}

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
  const normalizedSwitchClerkId = activeSwitchClerkId?.trim().toLowerCase() ?? null;
  const isBlockedSwitch = normalizedSwitchClerkId === "local_dev_user" || normalizedSwitchClerkId === "localdev";
  const canUseDevSwitch = currentUser?.role === "dev_website";
  const { data: users = [], isLoading: isUsersLoading } = useListSwitchableUsers({
    query: { enabled: Boolean(canUseDevSwitch) } as any,
  });
  const [selectedClerkId, setSelectedClerkId] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sessions = clerk.client?.sessions || [];
  const activeSessionId = clerk.session?.id;
  const switchableUsers = users.filter((u) => !["local_dev_user", "localdev"].includes(u.clerkId.trim().toLowerCase()));
  const activeSwitchUser = switchableUsers.find((u) => u.clerkId === activeSwitchClerkId);

  useEffect(() => {
    if (isBlockedSwitch) {
      localStorage.removeItem("switch_clerk_id");
      setSelectedClerkId(currentUser?.clerkId ?? "");
      void reloadWithFreshCache();
      return;
    }
    if (activeSwitchClerkId) {
      setSelectedClerkId(activeSwitchClerkId);
      return;
    }
    if (!selectedClerkId && currentUser?.clerkId) {
      setSelectedClerkId(currentUser.clerkId);
    }
  }, [activeSwitchClerkId, currentUser?.clerkId, selectedClerkId, isBlockedSwitch]);

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
            <span>ðŸ› ï¸ Switch Account (Roblox Style)</span>
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
                            <span className="text-slate-400/70"> Â· {u.primaryEmailAddress.emailAddress}</span>
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
              âž• Add Account (Sign In to Another Account)
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
                      {switchableUsers.map((u) => (
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
                              ðŸŽ® {u.mcUsername}
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
        <div className="text-4xl mb-3">ðŸ—³ï¸</div>
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
                    {form.type === "poll" ? "ðŸ—³ï¸ Voting" : "📋 Form"}
                  </span>
                  <span className={`text-[9px] px-2 py-0.5 rounded-lg font-black uppercase tracking-wider border ${form.status === "open" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-500 border-slate-100"}`}>
                    {form.status === "open" ? "Open" : "Closed"}
                  </span>
                </div>
                <h3 className="font-extrabold text-sm text-[#110e3d] group-hover:text-[#6366f1] transition-colors truncate">{form.title}</h3>
                {form.description && <p className="text-[11px] text-slate-400 font-semibold mt-1 line-clamp-2 leading-relaxed">{form.description}</p>}
                <div className="flex items-center gap-3 mt-3 text-[10px] text-slate-400 font-bold">
                  <span>ðŸ‘¥ {form.responseCount} responses</span>
                  {form.deadline && <span>â° Deadline: {format(new Date(form.deadline), "d MMM yyyy")}</span>}
                </div>
              </div>
              <div className="text-[#6366f1] opacity-0 group-hover:opacity-100 transition-all transform translate-x-1 group-hover:translate-x-0 shrink-0 font-bold">â†’</div>
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
            {form.type === "poll" ? "ðŸ—³ï¸ Voting" : "📋 Form"}
          </span>
          {hasResponded && (
            <span className="text-[9px] px-2 py-0.5 rounded-lg font-black border bg-emerald-50 text-emerald-600 border-emerald-100">âœ“ Submitted</span>
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
                        <span className={`${isMyVote ? "text-[#6366f1]" : "text-slate-700"}`}>{isMyVote ? "âœ“ " : ""}{opt.label}</span>
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
                <div className="text-4xl mb-2">âœ…</div>
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
              {submitting ? "Submitting..." : "ðŸ—³ï¸ Cast Vote"}
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
        <div className="text-4xl mb-3">ðŸ›¡ï¸</div>
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
  const gachaCosmetics = (board?.cosmetics || []).filter((c: any) => c.isGacha);
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
    if (board && gachaCosmetics.length > 0 && !selectedItem) {
      const sTiers = gachaCosmetics.filter((c: any) => c.rarity === "S");
      if (sTiers.length > 0) setSelectedItem(sTiers[0]);
      else setSelectedItem(gachaCosmetics[0]);
    }
  }, [board, selectedItem, gachaCosmetics]);

  if (isLoading || !board) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[350px] w-full rounded-2xl animate-pulse" />
      </div>
    );
  }

  const handleSpin = async (count: 1 | 10 | 25 | 50) => {
    playSound("click");
    let cost = 9;
    if (count === 10) cost = 79;
    else if (count === 25) cost = 195;
    else if (count === 50) cost = 390;

    if ((board.diamonds ?? 0) < cost) {
      toast({
        title: "Insufficient Diamonds",
        description: `Spinning ${count}x costs ${cost} Diamonds, but you only have ${board.diamonds}. Top up wallet or convert saldo to diamonds first.`,
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
      console.log('[gacha] res.results length:', res?.results?.length, 'full res:', res);
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
    S: gachaCosmetics.filter((c: any) => c.rarity === "S"),
    A: gachaCosmetics.filter((c: any) => c.rarity === "A"),
    B: gachaCosmetics.filter((c: any) => c.rarity === "B"),
    C: gachaCosmetics.filter((c: any) => c.rarity === "C"),
    D: gachaCosmetics.filter((c: any) => c.rarity === "D"),
  };

  const ownedIds = new Set(board.ownedCosmeticIds || []);
  const fallbackBackgrounds = ["/lobby.png", "/village.png", "/dungeon.png"];

  const getFallbackBackground = (seed: string | number = 0) => {
    const numericSeed = String(seed)
      .split("")
      .reduce((total, char) => total + char.charCodeAt(0), 0);
    return fallbackBackgrounds[numericSeed % fallbackBackgrounds.length];
  };

  const handleBackgroundError = (event: any, seed: string | number = 0) => {
    const img = event.currentTarget;
    const fallback = getFallbackBackground(seed);
    if (img.src.endsWith(fallback)) return;
    img.src = fallback;
  };

  const getBulkGuaranteeLabel = (count: 10 | 25 | 50) => {
    if (count === 50) return "Guaranteed S-Tier";
    if (count === 25) return "Guaranteed A-Tier+";
    return "Guaranteed B-Tier+";
  };

  const renderCosmeticTypeIcon = (type: string, className = "w-4 h-4") => {
    if (type === "badge") return <Shield className={className} />;
    if (type === "border") return <BadgeCheck className={className} />;
    if (type === "background") return <ImageIcon className={className} />;
    return <Gift className={className} />;
  };

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
          <img
            src={item.value || getFallbackBackground(item.id)}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-65"
            onError={(event) => handleBackgroundError(event, item.id || item.name)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent animate-pulse" />
          <span className={`relative z-10 font-black text-slate-350 uppercase tracking-widest select-none ${isLg ? "text-[9px] mb-2" : "text-[5px] mb-1"}`}>
            BG CARD
          </span>
        </div>
      );
    }

    return (
      <div className={`rounded-xl bg-purple-950/40 border border-purple-500/10 flex items-center justify-center shadow-inner select-none ${isLg ? "w-16 h-16 text-3xl" : "w-10 h-10"}`}>
        <Gift className={isLg ? "w-7 h-7 text-purple-400" : "w-4 h-4 text-purple-400"} />
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
          if (previewItem) setSelectedItem(previewItem);
        }}
        className={`relative w-full min-h-[92px] rounded-lg border p-3 text-left transition-all overflow-hidden select-none cursor-pointer group ${theme.border} ${theme.bg} ${theme.hover} ${theme.glow}`}
      >
        <div className="absolute inset-x-0 top-0 h-0.5 bg-current opacity-30" />
        <div className="relative z-10 flex h-full items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-md text-[10px] font-black border uppercase tracking-wider ${theme.badge}`}>
                {tierKey} Tier
              </span>
              {isOwned && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" /> Complete
                </span>
              )}
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/40">
              <div
                className={`h-full rounded-full ${tierKey === "S" ? "bg-amber-400" : tierKey === "A" ? "bg-pink-400" : tierKey === "B" ? "bg-purple-400" : tierKey === "C" ? "bg-cyan-400" : "bg-slate-400"}`}
                style={{ width: `${totalCount > 0 ? (ownedCount / totalCount) * 100 : 0}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                Owned
              </span>
              <span className={`text-xs font-black ${theme.text}`}>
                {ownedCount} / {totalCount}
              </span>
            </div>
          </div>

          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/35 text-purple-200 shadow-inner">
            {previewItem ? renderCosmeticTypeIcon(previewItem.type, "h-6 w-6") : <Gift className="h-6 w-6" />}
          </div>
        </div>
      </button>
    );

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
                  âœ“
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

  const totalRewards = gachaCosmetics.length;
  const ownedRewards = board.ownedCosmeticIds.filter((id: number) => gachaCosmetics.some((c: any) => c.id === id)).length;
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
                <Gem className="h-4 w-4" />
              </div>
            );
          })}
        </div>
      )}

      <div className="relative overflow-hidden rounded-xl border border-[#2a1744] bg-[#0d0915] p-5 text-white shadow-[0_18px_45px_rgba(13,9,21,0.28)]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(245,158,11,0.12),transparent_34%),linear-gradient(90deg,transparent,rgba(6,182,212,0.08))]" />
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300">
                <Zap className="h-3 w-3" /> Rush Board Event
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-rose-300">
                <Clock className="h-3 w-3" /> Ends in 7d 6h
              </span>
              <span className="inline-flex items-center rounded-md border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-300">
                Board Selanjutnya
              </span>
            </div>

            <div>
              <h1 className="text-3xl font-black italic uppercase tracking-normal text-white md:text-4xl">
                RUSH BOARD
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="min-w-[240px] rounded-md bg-gradient-to-r from-pink-500 to-purple-600 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-white shadow-[0_0_18px_rgba(217,70,239,0.26)]">
                  {remainingRewards} / {totalRewards} Hadiah Tersisa
                </div>
                <Button
                  onClick={() => setPreviewHadiahOpen(true)}
                  className="h-9 rounded-lg border border-purple-400/30 bg-purple-500/15 px-4 text-xs font-black uppercase tracking-wide text-purple-100 hover:bg-purple-500/25"
                >
                  Preview Pool
                </Button>
              </div>
            </div>
          </div>

          <div className="w-full rounded-lg border border-purple-400/30 bg-purple-950/45 p-4 shadow-[inset_0_0_22px_rgba(126,34,206,0.18)] lg:w-[280px]">
            <p className="text-[10px] font-black uppercase tracking-widest text-purple-200">Your Diamonds</p>
            <div className="mt-2 flex items-center gap-2 text-3xl font-black text-amber-300">
              {Number(board.diamonds ?? 0).toLocaleString("id-ID")} <Gem className="h-6 w-6" />
            </div>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-purple-200/60">Top up lewat Wallet</p>
          </div>
        </div>
      </div>

      {/* HEADER BANNER */}
      <div className="hidden relative rounded-2xl bg-gradient-to-br from-[#1b1528] via-[#100b1a] to-[#07040d] p-6 md:p-8 text-white overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-purple-500/20">
        <div className="absolute right-0 top-0 w-1/3 h-full opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-purple-500 to-transparent pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          <div className="space-y-4 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black tracking-widest uppercase border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                âš¡ RUSH BOARD EVENT
              </div>
              
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-black tracking-widest uppercase border border-rose-500/30">
                â³ ENDS IN: 7d 6h
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
              <span className="text-[9px] font-bold text-purple-200/60 uppercase tracking-wider mt-1">
                Top up lewat Wallet
              </span>
            </div>
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
                        className={`relative rounded-xl border cursor-pointer transition-all aspect-square select-none overflow-hidden ${rarityBorder}`}
                      >
                        {/* Background image for background cosmetics */}
                        {item.type === "background" && (
                          <>
                            <img
                              src={item.value || getFallbackBackground(item.id)}
                              alt={item.name}
                              className="absolute inset-0 w-full h-full object-cover opacity-65"
                              onError={(e: any) => handleBackgroundError(e, item.id)}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                          </>
                        )}

                        {/* Dark base for non-background items */}
                        {item.type !== "background" && (
                          <div className="absolute inset-0 bg-[#0d0920]" />
                        )}

                        {/* Center cosmetic preview */}
                        <div className="absolute inset-0 flex items-center justify-center p-3">
                          {item.type === "badge" && (
                            <span className={`text-[7px] px-2 py-1 rounded border font-black uppercase tracking-wider text-center max-w-full ${item.value}`}>
                              {item.name}
                            </span>
                          )}
                          {item.type === "border" && (
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${item.value}`}>
                              <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center">
                                <span className="text-[5px] font-bold text-slate-500 uppercase tracking-widest">BDR</span>
                              </div>
                            </div>
                          )}
                          {!["badge", "border", "background"].includes(item.type) && (
                            <Gift className="h-6 w-6 text-purple-300/50" />
                          )}
                        </div>

                        {/* Owned indicator */}
                        {isOwned && (
                          <span className="absolute top-1.5 right-1.5 rounded-full border border-black/50 bg-emerald-400 p-0.5 text-slate-950 z-10">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                          </span>
                        )}

                        {/* Bottom name bar */}
                        <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-black/60 backdrop-blur-sm">
                          <p className="text-[9px] font-black text-slate-100 truncate leading-tight">
                            {item.name}
                          </p>
                          <span className="text-[7px] font-bold text-purple-300/60 uppercase">
                            {item.type}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* SPIN CONTROLS PANEL */}
          <div className="bg-[#0f0a1a]/95 border border-purple-500/20 shadow-2xl rounded-2xl p-5 relative">
            <div className="flex justify-between items-center mb-4">
              <div className="flex flex-col">
                <span className="text-xs font-black text-purple-300 uppercase tracking-widest">SUMMON CONTROLS</span>
                <span className="text-[10px] text-slate-400 font-semibold mt-0.5">Pilih jumlah spin — bulk spin aktifkan Rush Guarantee</span>
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
                  Auto-Equip
                </label>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {([
                { count: 1 as const,  cost: 9,   label: "1x",  color: "from-cyan-600 to-purple-800 hover:from-cyan-500 hover:to-purple-700 border-cyan-400/30 text-white",          gem: "text-cyan-300",   guarantee: null        },
                { count: 10 as const, cost: 79,  label: "10x", color: "from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 border-blue-400/30 text-white",          gem: "text-blue-200",   guarantee: "B+ Lock"   },
                { count: 25 as const, cost: 195, label: "25x", color: "from-pink-600 to-rose-700 hover:from-pink-500 hover:to-rose-600 border-pink-400/30 text-white",             gem: "text-pink-200",   guarantee: "A+ Lock"   },
                { count: 50 as const, cost: 390, label: "50x", color: "from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 border-amber-400/30 text-slate-950", gem: "text-slate-700",  guarantee: "S Lock"    },
              ]).map(({ count, cost, label, color, gem, guarantee }) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => handleSpin(count)}
                  disabled={isSpinning}
                  className={`py-4 rounded-xl bg-gradient-to-br ${color} border shadow-[0_4px_14px_rgba(0,0,0,0.25)] flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-[0.96] transition-all disabled:opacity-50 select-none group`}
                >
                  <span className="text-sm font-black uppercase italic tracking-wider group-hover:scale-105 transition-transform">
                    {label}
                  </span>
                  <span className={`text-xs font-black flex items-center gap-0.5 ${gem}`}>
                    {cost} <Gem className="h-3 w-3" />
                  </span>
                  {guarantee && (
                    <span className="text-[7px] font-black uppercase tracking-wider opacity-70 mt-0.5">
                      {guarantee}
                    </span>
                  )}
                </button>
              ))}
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
              <span className="inline-flex items-center gap-2 text-[10px] font-black text-purple-200 uppercase tracking-widest">
                <Sparkles className="h-3.5 w-3.5 text-cyan-300" /> Cosmetic Preview Showcase
              </span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
            </div>

            <div className="hidden p-4 border-b border-purple-500/10 bg-black/40 flex items-center justify-between relative z-10">
              <span className="text-[10px] font-black text-purple-300 uppercase tracking-widest">
                â– COSMETIC PREVIEW SHOWCASE
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
                    src={selectedItem.value || getFallbackBackground(selectedItem.id)}
                    alt=""
                    className="w-full h-full object-cover opacity-50"
                    onError={(event) => handleBackgroundError(event, selectedItem.id || selectedItem.name)}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#07040d] via-transparent to-[#07040d]/40" />
                </div>
              ) : user?.equippedBackground ? (
                <div className="absolute inset-0 z-0">
                  <img
                    src={user.equippedBackground}
                    alt=""
                    className="w-full h-full object-cover opacity-35"
                    onError={(event) => handleBackgroundError(event, user.equippedBackground || "equipped-background")}
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
                      <div className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 bg-slate-950/60 border border-purple-500/10 rounded-xl text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        <Lock className="h-3.5 w-3.5" /> Spin gacha untuk membuka item ini
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
                    â–
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
        <DialogContent className="bg-[#0b0614] border-purple-500/30 text-white max-w-2xl flex flex-col h-[85vh] p-0 overflow-hidden rounded-2xl shadow-2xl z-[100]">
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-purple-500/15 bg-black/40">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-black text-white italic tracking-wider flex items-center gap-2">
                🌟 Spin Results ({spinCount}x)
              </DialogTitle>
              <span className="text-[10px] bg-purple-950 border border-purple-500/30 text-amber-300 px-3 py-1 rounded-full font-black">
                Balance: {board.diamonds} 💎
              </span>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto bg-[radial-gradient(circle_at_center,_#1c102a_0%,_#09050d_100%)]">
            <div className="p-6">
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
                      {res.rushGuaranteed && (
                        <span className="mt-2 text-[8px] font-black px-2 py-0.5 rounded-full border border-cyan-400/40 bg-cyan-400/10 text-cyan-200 uppercase tracking-wider">
                          Rush Guarantee
                        </span>
                      )}

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
                              +{res.refundAmount ?? 0} 💎 Refunded
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
                          {res.rushGuaranteed && (
                            <span className="text-[7px] font-black text-cyan-200 bg-cyan-400/10 border border-cyan-400/30 rounded-full px-1.5 py-0.5 uppercase leading-none">
                              Rush
                            </span>
                          )}
                          
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
                                +{res.refundAmount ?? 0} 💎
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
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 px-6 py-4 border-t border-purple-500/15 bg-black/40 flex flex-col sm:flex-row items-center justify-between gap-4">
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
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: wallet, refetch: refetchWallet } = useQuery({
    queryKey: ["/api/me/wallet"],
    queryFn: () => customFetch<any>("/api/me/wallet"),
  });
  const balanceRp = wallet?.balanceRp ?? 0;
  const diamonds = wallet?.diamonds ?? me?.diamonds ?? 0;
  const packRupiah = wallet?.diamondPackRupiah ?? 17000;
  const packDiamonds = wallet?.diamondPackDiamonds ?? 100;

  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState<number>(0);
  const [showConvert, setShowConvert] = useState(false);
  const [convertRupiah, setConvertRupiah] = useState<string>("");

  const TOPUP_PRESETS = [10000, 25000, 50000, 100000];
  const convertRupiahNum = parseInt(convertRupiah) || 0;
  const previewDiamonds = packRupiah > 0 ? Math.floor((convertRupiahNum * packDiamonds) / packRupiah) : 0;

  const topupMutation = useMutation({
    mutationFn: (amount: number) => customFetch<any>("/api/me/wallet/topup", {
      method: "POST",
      body: JSON.stringify({ amount }),
      headers: { "Content-Type": "application/json" },
    }),
    onSuccess: (res: any) => {
      toast({ title: "Mengarahkan ke pembayaran...", description: "Mohon tunggu sebentar ya~" });
      if (res?.checkoutUrl) window.location.href = res.checkoutUrl;
    },
    onError: (err: any) => {
      toast({ title: "Gagal top up", description: err?.message || "Terjadi kesalahan.", variant: "destructive" });
    },
  });

  const convertMutation = useMutation({
    mutationFn: (rupiah: number) => customFetch<any>("/api/me/wallet/convert", {
      method: "POST",
      body: JSON.stringify({ rupiah }),
      headers: { "Content-Type": "application/json" },
    }),
    onSuccess: async (res: any) => {
      toast({ title: "Tukar berhasil! 💎", description: `+${res.diamondsAdded} diamond (−${formatIdr(res.spentRp)})` });
      setShowConvert(false);
      setConvertRupiah("");
      await refetchWallet();
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gacha/board"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/transactions"] });
    },
    onError: (err: any) => {
      toast({ title: "Gagal menukar", description: err?.message || "Terjadi kesalahan.", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-500 font-bold bg-[#f4f3f8] min-h-[300px] flex items-center justify-center">
        Loading Wallet Data...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* DANA-STYLE BALANCE CARD */}
      <div className="rounded-3xl p-6 md:p-7 relative overflow-hidden shadow-lg bg-gradient-to-br from-[#1178d4] via-[#1aa0ed] to-[#2bc4f3] text-white">
        <div className="absolute -right-12 -top-12 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-16 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-white/20 rounded-xl">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-[12px] font-bold text-white leading-none">Saldo {me?.displayName || me?.username}</p>
                <p className="text-[10px] font-semibold text-white/70 mt-1">Arcadia Wallet</p>
              </div>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest bg-white/15 px-2.5 py-1 rounded-full">Rp</span>
          </div>

          <div className="mt-5">
            <span className="text-[11px] font-semibold text-white/70 block">Total Saldo</span>
            <div className="text-3xl md:text-4xl font-black mt-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.25)]">{formatIdr(balanceRp)}</div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => { setTopupAmount(0); setShowTopup(true); }}
              className="flex-1 flex items-center justify-center gap-2 bg-white text-[#1178d4] font-extrabold text-sm rounded-2xl py-3 shadow-md active:scale-95 transition-transform"
            >
              <Plus className="w-4 h-4" /> Top Up
            </button>
            <button
              onClick={() => { setConvertRupiah(""); setShowConvert(true); }}
              className="flex-1 flex items-center justify-center gap-2 bg-white/15 hover:bg-white/25 text-white font-extrabold text-sm rounded-2xl py-3 active:scale-95 transition-transform border border-white/30"
            >
              <Repeat className="w-4 h-4" /> Tukar Diamond
            </button>
          </div>
        </div>
      </div>

      {/* DIAMOND CARD */}
      <div className="rounded-2xl p-5 bg-white border border-[#eae8f5] shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 shrink-0 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-xl">💎</div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Diamond</p>
            <p className="text-xl font-black text-[#110e3d] leading-none mt-0.5">{Number(diamonds).toLocaleString("id-ID")} 💎</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-semibold text-slate-400">Rate tukar</p>
          <p className="text-xs font-bold text-[#6366f1]">Rp {Number(packRupiah).toLocaleString("id-ID")} = {Number(packDiamonds).toLocaleString("id-ID")} 💎</p>
        </div>
      </div>

      {/* TRANSACTION HISTORY */}
      <div className="bg-white border border-[#eae8f5] shadow-sm rounded-2xl p-5">
        <h3 className="text-sm font-extrabold text-[#110e3d] uppercase tracking-wider mb-4 pb-2 border-b border-[#eae8f5] flex items-center gap-2">
          <span>📜</span> Transaction History
        </h3>

        {transactions.length === 0 ? (
          <div className="text-center py-12 text-slate-400 font-bold border border-dashed border-[#eae8f5] rounded-xl bg-slate-50">
            <p className="text-xs">Belum ada transaksi. Top up saldo atau tukar diamond untuk mulai!</p>
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
                          t.type === "topup" ? "bg-sky-50 text-sky-600 border border-sky-100" :
                          t.type === "convert_receive" ? "bg-violet-50 text-violet-600 border border-violet-100" :
                          t.type === "convert_spend" ? "bg-orange-50 text-orange-600 border border-orange-100" :
                          "bg-purple-50 text-purple-600 border border-purple-100"
                        }`}>
                          {t.type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-3 text-[#110e3d]">{t.description}</td>
                      <td className={`py-3 text-right font-black ${isCredit ? "text-emerald-500" : "text-red-500"}`}>
                        {t.currency === "rp"
                          ? `${isCredit ? "+" : "−"}${formatIdr(Math.abs(t.amount))}`
                          : `${isCredit ? "+" : ""}${t.amount} 💎`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* TOP UP DIALOG */}
      <Dialog open={showTopup} onOpenChange={setShowTopup}>
        <DialogContent className="bg-white border-[#eae8f5] max-w-sm rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-[#110e3d] flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#1178d4]" /> Top Up Saldo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-1">
            <div className="grid grid-cols-2 gap-2">
              {TOPUP_PRESETS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setTopupAmount(amt)}
                  className={`rounded-xl py-3 text-sm font-extrabold border transition-all ${topupAmount === amt ? "border-[#1178d4] bg-sky-50 text-[#1178d4] ring-1 ring-[#1178d4]" : "border-[#eae8f5] text-slate-600 hover:bg-slate-50"}`}
                >
                  {formatIdr(amt)}
                </button>
              ))}
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-600">Atau nominal lain</Label>
              <Input
                type="number"
                min={1000}
                placeholder="cth: 75000"
                value={topupAmount || ""}
                onChange={(e) => setTopupAmount(parseInt(e.target.value) || 0)}
                className="mt-1 bg-slate-50 border-[#eae8f5] rounded-xl text-sm text-slate-900 font-bold placeholder:text-slate-400 placeholder:font-normal"
              />
            </div>
            <p className="text-[11px] text-slate-400">Minimal Rp 1.000. Pembayaran via SayaBayar. Saldo otomatis masuk setelah pembayaran berhasil.</p>
          </div>
          <DialogFooter className="mt-2">
            <Button
              onClick={() => topupMutation.mutate(topupAmount)}
              disabled={topupAmount < 1000 || topupMutation.isPending}
              className="w-full bg-[#1178d4] hover:bg-[#0d63b0] text-white font-bold rounded-xl"
            >
              {topupMutation.isPending ? "Mengarahkan..." : `Top Up${topupAmount >= 1000 ? ` ${formatIdr(topupAmount)}` : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONVERT DIALOG */}
      <Dialog open={showConvert} onOpenChange={setShowConvert}>
        <DialogContent className="bg-white border-[#eae8f5] max-w-sm rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-[#110e3d] flex items-center gap-2">
              <Repeat className="w-5 h-5 text-[#6366f1]" /> Tukar Saldo ke Diamond
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-1">
            <div className="rounded-xl bg-violet-50 border border-violet-100 px-3 py-2 text-xs font-bold text-violet-700">
              Rate: Rp {Number(packRupiah).toLocaleString("id-ID")} = {Number(packDiamonds).toLocaleString("id-ID")} 💎
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-600">Jumlah saldo yang ditukar (Rp)</Label>
              <Input
                type="number"
                min={0}
                placeholder="cth: 17000"
                value={convertRupiah}
                onChange={(e) => setConvertRupiah(e.target.value)}
                className="mt-1 bg-slate-50 border-[#eae8f5] rounded-xl text-sm text-slate-900 font-bold placeholder:text-slate-400 placeholder:font-normal"
              />
              <p className="text-[11px] text-slate-400 mt-1">Saldo kamu: {formatIdr(balanceRp)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-[#eae8f5] px-3 py-2.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Kamu akan dapat</span>
              <span className="text-lg font-black text-[#110e3d]">{previewDiamonds.toLocaleString("id-ID")} 💎</span>
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button
              onClick={() => convertMutation.mutate(convertRupiahNum)}
              disabled={previewDiamonds < 1 || convertRupiahNum > balanceRp || convertMutation.isPending}
              className="w-full bg-[#6366f1] hover:bg-violet-700 text-white font-bold rounded-xl"
            >
              {convertMutation.isPending ? "Menukar..." : convertRupiahNum > balanceRp ? "Saldo tidak cukup" : "Tukar Sekarang"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatIdr(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function MembershipTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: realmSettings = {} } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: () => customFetch<any>("/api/settings"),
  });

  const [selectedGroupId, setSelectedGroupId] = useState("none");
  const [requestNote, setRequestNote] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/me/membership"],
    queryFn: () => customFetch<any>("/api/me/membership"),
  });

  const paymentRequestMutation = useMutation({
    mutationFn: async (vars: {
      tier?: string;
      packageSku?: string;
      conversationId?: number;
      note?: string;
    }) => customFetch<any>("/api/payment-requests", {
      method: "POST",
      body: JSON.stringify(vars),
      headers: { "Content-Type": "application/json" },
    }),
    onSuccess: async (res: any) => {
      toast({
        title: "Redirecting to checkout...",
        description: "Mohon tunggu sebentar...",
      });
      setRequestNote("");
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

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="rounded-2xl border-[#eae8f5] shadow-sm">
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="rounded-2xl border-red-200 bg-red-50 shadow-sm">
        <CardContent className="p-5 text-sm font-bold text-red-600">
          Gagal memuat membership menu.
        </CardContent>
      </Card>
    );
  }

  const usedPercent = data.sharedStorage?.capacityBytes > 0
    ? Math.min(100, Math.round((data.sharedStorage.usedBytes / data.sharedStorage.capacityBytes) * 100))
    : 0;

  const groupOptions = Array.isArray(data.groups) ? data.groups : [];
  const rawPaymentTickets = Array.isArray(data.paymentTickets) ? data.paymentTickets : [];
  const paymentTickets = rawPaymentTickets.filter((ticket: any) => {
    if (ticket.adminNotes?.startsWith("[SayaBayar ID:") && ticket.paymentStatus !== "paid") {
      return false;
    }
    return true;
  });
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
    <div className="space-y-6">
      {/* Premium Dashboard Link Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-700 p-6 text-white shadow-md">
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <h3 className="text-lg font-black flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-300" /> Manage Premium in VIP Hub
            </h3>
            <p className="text-xs text-purple-100 font-semibold max-w-xl">
              Sekarang kamu bisa subscribe premium, atur server boost, upload sticker custom, dan pasang border/badge kosmetik langsung di halaman Premium Area.
            </p>
          </div>
          <Link
            href="/premium"
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-white text-purple-700 hover:bg-purple-50 px-5 py-2.5 text-xs font-black transition-all shadow-sm"
          >
            Buka Premium Area →
          </Link>
        </div>
      </div>

      {/* Basic Metrics Overview */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-2xl border-[#eae8f5] shadow-sm bg-white">
          <CardContent className="space-y-2 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tier Aktif</p>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <h3 className="text-lg font-black text-[#110e3d]">{data.tierLabel}</h3>
            </div>
            <p className="text-xs font-semibold text-slate-500 capitalize">
              {data.currentTier.replace("_", " ")} Membership
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#eae8f5] shadow-sm bg-white">
          <CardContent className="space-y-2 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Shared Storage</p>
            <h3 className="text-lg font-black text-[#110e3d]">{usedPercent}% used</h3>
            <p className="text-xs font-semibold text-slate-500">
              Limit upload: {formatBytesCompact(data.maxUploadBytes)}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#eae8f5] shadow-sm bg-white">
          <CardContent className="space-y-2 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Active Boosts</p>
            <h3 className="text-lg font-black text-[#110e3d]">{data.totalBoostCount} boost</h3>
            <p className="text-xs font-semibold text-slate-500">
              Base {data.baseBoostCount} + purchased {data.purchasedBoostCount}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#eae8f5] shadow-sm bg-white">
          <CardContent className="space-y-2 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Storage Usage</p>
            <div className="space-y-1">
              <Progress value={usedPercent} className="h-2 bg-slate-100" />
              <p className="text-[10px] text-slate-400 font-bold mt-1">
                {formatBytesCompact(data.sharedStorage?.usedBytes || 0)} / {formatBytesCompact(data.sharedStorage?.capacityBytes || 0)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PLANS SECTION */}
      <div className="space-y-4 pt-4 border-t border-[#eae8f5]">
        <div>
          <h3 className="text-sm font-extrabold text-[#110e3d] uppercase tracking-wider flex items-center gap-2">
            <Crown className="w-4 h-4 text-purple-600" /> VIP Membership Plans
          </h3>
          <p className="text-xs font-semibold text-slate-400">
            Pilih paket langganan bulanan atau beli Server Boost di bawah ini untuk meningkatkan level member & server.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {planCards.map((plan) => {
            const isCurrent = data.currentTier === plan.key;
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
                    {plan.key === "free" ? "Plan gratis" : paymentRequestMutation.isPending ? "Mengarahkan..." : `Pilih ${plan.title}`}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* CHECKOUT & TICKETS QUEUE SECTION */}
      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr] pt-4 border-t border-[#eae8f5]">
        <Card className="rounded-2xl border-[#eae8f5] shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-extrabold text-[#110e3d] flex items-center gap-2">
              <Zap className="w-4 h-4 text-violet-600" /> Server Boost Packages
            </CardTitle>
            <p className="text-xs font-semibold text-slate-400 mt-0.5">
              Beli server boost untuk meningkatkan fitur group. Pembayaran via SayaBayar, aktif otomatis setelah lunas.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Group Target Selector */}
            {groupOptions.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Group (Opsional)</Label>
                <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                  <SelectTrigger className="h-9 rounded-xl border-[#eae8f5] bg-slate-50 text-xs font-bold text-[#1e1b4b]">
                    <SelectValue placeholder="Pilih group target boost" />
                  </SelectTrigger>
                  <SelectContent className="border border-[#eae8f5] bg-white text-slate-700">
                    <SelectItem value="none">Nanti diatur admin</SelectItem>
                    {groupOptions.map((group: any) => (
                      <SelectItem key={group.id} value={String(group.id)}>
                        {group.name ?? `Group #${group.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Boost Package Cards */}
            {Array.isArray(data.packages) && data.packages.length > 0 ? (
              <div className="grid gap-3">
                {data.packages.map((pkg: any) => (
                  <div
                    key={pkg.sku}
                    className="group flex items-center justify-between gap-3 rounded-2xl border-2 border-[#eae8f5] bg-white p-4 hover:border-violet-300 hover:bg-violet-50/30 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-sm shadow-violet-500/30">
                        <Zap className="h-5 w-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-extrabold text-[#110e3d] truncate">{pkg.displayName}</p>
                          {pkg.discountPriceIdr && (
                            <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-green-700">DISKON</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {pkg.discountPriceIdr ? (
                            <>
                              <p className="text-xs font-black text-green-600">{formatIdr(pkg.discountPriceIdr)}</p>
                              <p className="text-[10px] font-semibold text-slate-400 line-through">{formatIdr(pkg.priceIdr)}</p>
                            </>
                          ) : (
                            <p className="text-xs font-black text-violet-600">{formatIdr(pkg.priceIdr)}</p>
                          )}
                        </div>
                        {pkg.description && (
                          <p className="text-[10px] font-semibold text-slate-400 mt-0.5 truncate">{pkg.description}</p>
                        )}
                        <p className="text-[10px] font-semibold text-slate-400">{pkg.boostCount} boost · {pkg.durationDays} hari</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        paymentRequestMutation.mutate({
                          packageSku: pkg.sku,
                          conversationId: selectedGroupId !== "none" ? Number(selectedGroupId) : undefined,
                          note: requestNote.trim() || undefined,
                        });
                      }}
                      disabled={paymentRequestMutation.isPending}
                      className="h-9 shrink-0 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-black px-4 shadow-md shadow-violet-500/20 active:scale-95 transition-all"
                    >
                      {paymentRequestMutation.isPending ? (
                        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin inline-block" />Loading</span>
                      ) : "Beli →"}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-[#eae8f5] p-8 text-center">
                <Zap className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-400">Belum ada paket boost tersedia.</p>
                <p className="text-[10px] text-slate-300 font-semibold mt-0.5">Hubungi admin untuk menambahkan paket.</p>
              </div>
            )}

            {/* Optional Note */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Catatan (Opsional)</Label>
              <Textarea
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                placeholder="Catatan tambahan untuk admin, misal: nama karakter, keperluan boost, dll."
                className="resize-none rounded-xl border-[#eae8f5] bg-slate-50 text-xs text-slate-800 focus:bg-white"
                rows={2}
              />
            </div>

          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#eae8f5] shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-extrabold text-[#110e3d] flex items-center gap-2">
              <Ticket className="w-4 h-4 text-purple-600" /> Riwayat Transaksi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-[#eae8f5] bg-slate-50 p-4 text-xs font-semibold text-slate-600">
              Daftar riwayat transaksi pembayaran langganan dan booster Anda yang berhasil diproses.
            </div>
            {paymentTickets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#eae8f5] bg-slate-50 p-4 text-center text-xs font-semibold text-slate-400">
                Belum ada riwayat transaksi.
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {paymentTickets.map((ticket: any) => (
                  <div key={ticket.id} className="rounded-xl border border-[#eae8f5] bg-white p-4 text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-extrabold text-[#110e3d]">Payment Ticket #{ticket.id}</p>
                        <p className="mt-1 font-semibold text-slate-500">
                          {ticket.requestedTier
                            ? `Tier ${ticket.requestedTier === "premium_plus" ? "Premium+" : "Premium"}`
                            : ticket.requestedPackageSku || "Server Boost"}
                        </p>
                        {ticket.note && (
                          <p className="mt-1 text-[10px] text-slate-400 truncate max-w-[200px]">Note: {ticket.note}</p>
                        )}
                        <p className="mt-1 text-[10px] text-slate-400 font-bold">
                          Requested: {format(new Date(ticket.createdAt), "dd MMM yyyy HH:mm")}
                        </p>
                        {ticket.grantedAt && (
                          <p className="mt-1 text-[10px] font-semibold text-emerald-600">
                            Granted {format(new Date(ticket.grantedAt), "dd MMM yyyy HH:mm")}
                          </p>
                        )}
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                        ticket.paymentStatus === "paid" ? "bg-emerald-100 text-emerald-700" :
                        ticket.paymentStatus === "rejected" ? "bg-red-100 text-red-700" :
                        "bg-amber-100 text-amber-700"
                      }`}>
                        {ticket.paymentStatus ?? "pending_review"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function formatBytesCompact(bytes: number) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function MusicTab() {
  const { data: me } = useGetMe();
  const { toast } = useToast();
  const isAdmin = (me as any)?.role === "admin";

  const [tracks, setTracks] = useState<any[]>([]);
  const [newReleases, setNewReleases] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTrack, setCurrentTrack] = useState<any | null>(null);
  const [audioSrc, setAudioSrc] = useState("");
  const [playingPlaylistTracks, setPlayingPlaylistTracks] = useState<any[]>([]);
  const [activePlaylist, setActivePlaylist] = useState("All Tracks");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLooping, setIsLooping] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [hoveredTrackId, setHoveredTrackId] = useState<string | number | null>(null);
  const [likedTracks, setLikedTracks] = useState<Record<string | number, boolean>>({});
  const [favoriteTracks, setFavoriteTracks] = useState<Record<string | number, any>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isStreamLoading, setIsStreamLoading] = useState(false);
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTab, setAdminTab] = useState<"add" | "download" | "spotify" | "manage">("add");
  const [adminForm, setAdminForm] = useState({ title: "", artist: "", album: "", file: "", cover: "", duration: "", type: "Global Charts", releaseDate: "" });
  const [downloadForm, setDownloadForm] = useState({ url: "", title: "", artist: "", album: "", cover: "", type: "Global Charts", releaseDate: "" });
  const [spotifySearchQuery, setSpotifySearchQuery] = useState("");
  const [spotifyResults, setSpotifyResults] = useState<any[]>([]);
  const [spotifySearching, setSpotifySearching] = useState(false);
  const [spotifyDownloadingId, setSpotifyDownloadingId] = useState<string | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminMessage, setAdminMessage] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingAutoPlayRef = useRef(false);
  const prewarmedTrackIdsRef = useRef<Set<string | number>>(new Set());

  const MUSIC_TYPES = ["Global Charts", "Rilis Hari Ini", "Lofi & Chill", "Pop Hits", "Synthwave Hits", "Lobby Favorites", "Combat & Adventure", "Tavern Classics", "Hip Hop", "EDM", "R&B", "Indie", "K-Pop", "OST"];

  const refreshTracks = () => {
    const typeQuery = activePlaylist === "All Tracks" ? "" : activePlaylist;
    fetch(`/api/music/tracks?type=${encodeURIComponent(typeQuery)}`).then(r => r.ok ? r.json() : []).then(d => { if (Array.isArray(d)) setTracks(d); });
    fetch("/api/music/tracks/new-releases").then(r => r.ok ? r.json() : []).then(d => { if (Array.isArray(d)) setNewReleases(d); });
    fetch("/api/music/categories").then(r => r.ok ? r.json() : []).then(d => { if (Array.isArray(d)) setCategories(d); });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [r2, r3] = await Promise.all([fetch("/api/music/tracks/new-releases"), fetch("/api/music/categories")]);
        const [nr, cats] = await Promise.all([r2.ok ? r2.json() : [], r3.ok ? r3.json() : []]);
        if (!cancelled) {
          setNewReleases(Array.isArray(nr) ? nr : []);
          setCategories(Array.isArray(cats) ? cats : []);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (activePlaylist === "Favorites" || activePlaylist === "Rilis Hari Ini") return;
    let cancelled = false;
    setIsLoading(true);
    const typeQuery = activePlaylist === "All Tracks" ? "" : activePlaylist;
    fetch(`/api/music/tracks?type=${encodeURIComponent(typeQuery)}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => {
        if (!cancelled && Array.isArray(d)) {
          setTracks(d);
          if (d.length > 0 && !currentTrack) setCurrentTrack(d[0]);
          setIsLoading(false);
        }
      })
      .catch(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [activePlaylist]);

  useEffect(() => {
    try {
      const s = window.localStorage.getItem("arcadia_music_favorites");
      if (s) {
        const p = JSON.parse(s);
        Object.values(p).forEach((track: any) => {
          if (track?.file?.startsWith?.("/api/music/tracks/stream")) track.file = "";
        });
        setFavoriteTracks(p);
        setLikedTracks(Object.fromEntries(Object.keys(p).map(k => [k, true])));
      }
    } catch {}
  }, []);

  const stripTransientStream = (track: any) => {
    if (!track) return track;
    const copy = { ...track };
    if (copy.file?.startsWith?.("/api/music/tracks/stream")) copy.file = "";
    return copy;
  };

  useEffect(() => {
    const sanitized = Object.fromEntries(Object.entries(favoriteTracks).map(([id, track]) => [id, stripTransientStream(track)]));
    window.localStorage.setItem("arcadia_music_favorites", JSON.stringify(sanitized));
  }, [favoriteTracks]);
  useEffect(() => { if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume; }, [volume, isMuted]);
  useEffect(() => { if (audioRef.current) audioRef.current.loop = isLooping; }, [isLooping]);

  useEffect(() => {
    if (!currentTrack?.file || !audioRef.current) return;
    setAudioSrc(currentTrack.file);
    audioRef.current.src = currentTrack.file;
    audioRef.current.load();
    if (isPlaying) audioRef.current.play().catch(() => setIsPlaying(false));
  }, [currentTrack?.file]);

  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentTrack) return;
    const c = currentTrack.cover?.startsWith("http") ? currentTrack.cover : `${window.location.origin}${currentTrack.cover || "/village.png"}`;
    navigator.mediaSession.metadata = new MediaMetadata({ title: currentTrack.title || "Unknown", artist: currentTrack.artist || "Unknown", album: currentTrack.album || currentTrack.type || "Arcadia", artwork: [{ src: c, sizes: "512x512", type: "image/png" }] });
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [currentTrack, isPlaying]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.setActionHandler("play", () => handlePlayPause());
    navigator.mediaSession.setActionHandler("pause", () => handlePlayPause());
    navigator.mediaSession.setActionHandler("previoustrack", () => handlePrevious());
    navigator.mediaSession.setActionHandler("nexttrack", () => handleNext());
    return () => { ["play", "pause", "previoustrack", "nexttrack"].forEach(a => navigator.mediaSession.setActionHandler(a as any, null)); };
  }, [currentTrack, playingPlaylistTracks, isShuffling, isLooping]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); setIsSearching(false); return; }
    setIsSearching(true);
    const t = setTimeout(async () => {
      try { const r = await fetch(`/api/music/tracks?q=${encodeURIComponent(searchQuery)}`); const d = r.ok ? await r.json() : []; setSearchResults(Array.isArray(d) ? d : []); }
      catch { setSearchResults([]); }
      setIsSearching(false);
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Auto-play music from AI command (localStorage)
  const autoPlayTriggeredRef = useRef(false);
  useEffect(() => {
    if (autoPlayTriggeredRef.current) return;
    const raw = localStorage.getItem("arcadia_auto_play_music");
    if (!raw) return;
    autoPlayTriggeredRef.current = true;
    localStorage.removeItem("arcadia_auto_play_music");
    try {
      const { title, artist } = JSON.parse(raw);
      if (!title || !artist) return;
      // Search for the track
      fetch(`/api/music/tracks?q=${encodeURIComponent(`${title} ${artist}`)}`)
        .then(r => r.ok ? r.json() : [])
        .then((results: any[]) => {
          if (!Array.isArray(results) || results.length === 0) return;
          // Find best match by title similarity
          const best = results.find((t: any) =>
            t.title?.toLowerCase().includes(title.toLowerCase()) ||
            t.artist?.toLowerCase().includes(artist.toLowerCase())
          ) || results[0];
          if (best) {
            playTrack(best, results);
          }
        })
        .catch(() => {});
    } catch {}
  }, []);

  const filteredTracks = activePlaylist === "All Tracks" ? tracks : activePlaylist === "Favorites" ? Object.values(favoriteTracks) : activePlaylist === "Rilis Hari Ini" ? newReleases : tracks.filter(t => t.type === activePlaylist);
  const displayTracks = searchQuery.trim() ? searchResults : filteredTracks;
  const visualDuration = duration || 100;
  const playlistCover = displayTracks[0]?.cover || currentTrack?.cover || "/village.png";
  const playlistTitle = searchQuery.trim() ? `Hasil Pencarian "${searchQuery}"` : activePlaylist;
  const playlistSubtext = searchQuery.trim() ? `Ditemukan ${displayTracks.length} lagu di Spotify` : `Spotify Library · ${displayTracks.length} lagu`;

  const fmt = (s: number) => { if (!s || isNaN(s)) return "0:00"; return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`; };
  const parseDuration = (value: any) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "string") return 0;
    const parts = value.split(":").map((p) => Number(p));
    if (parts.some((p) => !Number.isFinite(p))) return 0;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  };
  const getTrackDuration = (track: any) => parseDuration(track?.duration) || (Number(track?.durationMs) > 0 ? Number(track.durationMs) / 1000 : 0);
  const describeAudioError = (err: any) => {
    const mediaError = audioRef.current?.error;
    const mediaDetail = mediaError ? ` media=${mediaError.code}` : "";
    return `${err?.name || "AudioError"}${err?.message ? `: ${err.message}` : ""}${mediaDetail}`;
  };
  const getPlayableUrl = (track: any) => {
    if (track?.file && !track.file.startsWith?.("/api/music/tracks/stream")) return track.file;
    const trackDuration = getTrackDuration(track);
    const params = new URLSearchParams({
      title: String(track?.title || ""),
      artist: String(track?.artist || ""),
      _: String(Date.now()),
    });
    if (trackDuration) params.set("duration", String(Math.round(trackDuration)));
    return `/api/music/tracks/play?${params.toString()}`;
  };
  const prewarmTrack = (track: any) => {
    if (!track || track.file) return;
    if (prewarmedTrackIdsRef.current.has(track.id)) return;
    prewarmedTrackIdsRef.current.add(track.id);
    const trackDuration = getTrackDuration(track);
    const durationQuery = trackDuration ? `&duration=${encodeURIComponent(String(Math.round(trackDuration)))}` : "";
    fetch(`/api/music/tracks/resolve?title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artist)}${durationQuery}`).catch(() => {});
  };

  useEffect(() => {
    displayTracks.slice(0, 1).forEach((track) => prewarmTrack(track));
  }, [playlistTitle, displayTracks.length]);

  const playTrack = async (track: any, playlist: any[]) => {
    const playableUrl = getPlayableUrl(track);
    setCurrentTrack(track);
    setPlayingPlaylistTracks(playlist);
    setCurrentTime(0);
    setDuration(getTrackDuration(track));
    setAudioSrc(playableUrl);
    setIsStreamLoading(!track.file || track.file.startsWith?.("/api/music/tracks/stream"));
    setLoadingTrackId(track.id);
    if (audioRef.current) {
      pendingAutoPlayRef.current = true;
      audioRef.current.src = playableUrl;
      audioRef.current.muted = false;
      audioRef.current.volume = volume || 0.8;
      audioRef.current.load();
      try {
        await audioRef.current.play();
        pendingAutoPlayRef.current = false;
        setIsMuted(false);
        setIsPlaying(true);
        setIsStreamLoading(false);
        setLoadingTrackId(null);
      } catch (err: any) {
        setIsPlaying(false);
        // Keep pendingAutoPlayRef on; browsers can reject while the proxied stream is still resolving.
        console.warn("Initial audio play failed, waiting for canplay", describeAudioError(err));
      }
    } else {
      setIsPlaying(true);
    }
  };

  const handlePlayPause = async () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    const audioHasSource = Boolean(audioRef.current.currentSrc || audioRef.current.src || audioSrc);
    if (!audioHasSource && currentTrack) {
      await playTrack(currentTrack, playingPlaylistTracks.length ? playingPlaylistTracks : displayTracks);
      return;
    }

    try {
      audioRef.current.muted = false;
      audioRef.current.volume = volume || 0.8;
      await audioRef.current.play();
      pendingAutoPlayRef.current = false;
      setIsMuted(false);
      setIsPlaying(true);
    } catch (err: any) {
      if (currentTrack) {
        await playTrack(currentTrack, playingPlaylistTracks.length ? playingPlaylistTracks : displayTracks);
      } else {
        toast({ title: "Audio belum bisa diputar", description: describeAudioError(err), variant: "destructive" });
      }
    }
  };
  const handleTimeUpdate = () => { if (audioRef.current) setCurrentTime(audioRef.current.currentTime); };
  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    const audioDuration = audioRef.current.duration;
    const fallbackDuration = getTrackDuration(currentTrack);
    if (fallbackDuration && (!Number.isFinite(audioDuration) || Math.abs(audioDuration - fallbackDuration) > 20)) {
      setDuration(fallbackDuration);
      return;
    }
    setDuration(Number.isFinite(audioDuration) && audioDuration > 0 ? audioDuration : fallbackDuration);
  };
  const handleAudioError = () => {
    pendingAutoPlayRef.current = false;
    setIsPlaying(false);
    setIsStreamLoading(false);
    setLoadingTrackId(null);
    const mediaError = audioRef.current?.error;
    toast({ title: "Audio gagal diputar", description: mediaError ? `Media error code ${mediaError.code}` : "Coba klik lagu itu lagi untuk refresh stream.", variant: "destructive" });
  };
  const handleAudioWaiting = () => {
    if (currentTrack) {
      setIsStreamLoading(true);
      setLoadingTrackId(currentTrack.id);
    }
  };
  const handleAudioPlaying = () => {
    pendingAutoPlayRef.current = false;
    setIsPlaying(true);
    setIsStreamLoading(false);
    setLoadingTrackId(null);
  };
  const handleCanPlay = async () => {
    if (!pendingAutoPlayRef.current || !audioRef.current) return;
    try {
      audioRef.current.muted = false;
      audioRef.current.volume = volume || 0.8;
      await audioRef.current.play();
      pendingAutoPlayRef.current = false;
      setIsMuted(false);
      setIsPlaying(true);
      setIsStreamLoading(false);
      setLoadingTrackId(null);
    } catch (err: any) {
      pendingAutoPlayRef.current = false;
      setIsPlaying(false);
      setIsStreamLoading(false);
      setLoadingTrackId(null);
      toast({ title: "Audio belum bisa diputar", description: describeAudioError(err), variant: "destructive" });
    }
  };
  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => { const t = parseFloat(e.target.value); setCurrentTime(t); if (audioRef.current) audioRef.current.currentTime = t; };
  const handleNext = () => { if (!playingPlaylistTracks.length || !currentTrack) return; const i = playingPlaylistTracks.findIndex(t => t.id === currentTrack.id); playTrack(playingPlaylistTracks[isShuffling ? Math.floor(Math.random() * playingPlaylistTracks.length) : (i + 1) % playingPlaylistTracks.length], playingPlaylistTracks); };
  const handlePrevious = () => { if (!playingPlaylistTracks.length || !currentTrack) return; const i = playingPlaylistTracks.findIndex(t => t.id === currentTrack.id); playTrack(playingPlaylistTracks[(i - 1 + playingPlaylistTracks.length) % playingPlaylistTracks.length], playingPlaylistTracks); };
  const handleEnded = () => { if (isLooping && audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().catch(() => {}); } else { handleNext(); } };
  const toggleLike = (track: any) => { const id = track.id; setLikedTracks(p => ({ ...p, [id]: !p[id] })); setFavoriteTracks(p => { if (p[id]) { const n = { ...p }; delete n[id]; return n; } return { ...p, [id]: stripTransientStream(track) }; }); };

  const handleAdminAdd = async () => {
    if (!adminForm.title || !adminForm.artist || !adminForm.file || !adminForm.cover || !adminForm.duration) { setAdminMessage("Semua field wajib diisi."); return; }
    setAdminLoading(true); setAdminMessage("");
    try {
      const r = await fetch("/api/music/admin/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(adminForm) });
      const d = await r.json();
      if (r.ok) { setAdminMessage(`Berhasil menambahkan "${d.title}"!`); setAdminForm({ title: "", artist: "", album: "", file: "", cover: "", duration: "", type: "Global Charts", releaseDate: "" }); refreshTracks(); }
      else { setAdminMessage(`Error: ${d.message}`); }
    } catch { setAdminMessage("Gagal menghubungi server."); }
    setAdminLoading(false);
  };

  const handleAdminDownload = async () => {
    if (!downloadForm.url || !downloadForm.title || !downloadForm.artist) { setAdminMessage("URL, title, dan artist wajib diisi."); return; }
    setAdminLoading(true); setAdminMessage("Mengunduh audio... harap tunggu (bisa 1-3 menit)");
    try {
      const r = await fetch("/api/music/admin/download", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(downloadForm) });
      const d = await r.json();
      if (r.ok && d.ok) { setAdminMessage(`Berhasil download "${d.track.title}"!`); setDownloadForm({ url: "", title: "", artist: "", album: "", cover: "", type: "Global Charts", releaseDate: "" }); refreshTracks(); }
      else { setAdminMessage(`Error: ${d.message}${d.detail ? " - " + d.detail : ""}`); }
    } catch { setAdminMessage("Gagal menghubungi server."); }
    setAdminLoading(false);
  };

  const handleAdminDelete = async (track: any) => {
    if (!confirm(`Hapus "${track.title}"?`)) return;
    try {
      const r = await fetch(`/api/music/admin/track/${track.id}`, { method: "DELETE" });
      if (r.ok) { setAdminMessage(`"${track.title}" dihapus.`); refreshTracks(); if (currentTrack?.id === track.id) setCurrentTrack(null); }
      else { const d = await r.json(); setAdminMessage(`Error: ${d.message}`); }
    } catch { setAdminMessage("Gagal menghubungi server."); }
  };

  const handleSpotifySearch = async () => {
    if (!spotifySearchQuery.trim()) { setAdminMessage("Masukkan kata kunci pencarian."); return; }
    setSpotifySearching(true); setAdminMessage("Mencari di Spotify...");
    try {
      const r = await fetch(`/api/music/spotify/search?q=${encodeURIComponent(spotifySearchQuery)}&limit=10`);
      const d = await r.json();
      if (r.ok && Array.isArray(d)) { setSpotifyResults(d); setAdminMessage(`Ditemukan ${d.length} lagu di Spotify.`); }
      else { setAdminMessage(`Error: ${d.message || "Spotify search gagal."}`); setSpotifyResults([]); }
    } catch { setAdminMessage("Gagal menghubungi server."); }
    setSpotifySearching(false);
  };

  const handleSpotifyDownload = async (track: any) => {
    setSpotifyDownloadingId(track.spotifyId);
    setAdminMessage(`Mengunduh "${track.title}" dari YouTube...`);
    try {
      const r = await fetch("/api/music/spotify/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spotifyId: track.spotifyId,
          title: track.title,
          artist: track.artist,
          album: track.album,
          cover: track.cover,
          durationMs: track.durationMs,
          type: "Global Charts",
        }),
      });
      const d = await r.json();
      if (r.ok && d.ok) { setAdminMessage(`Berhasil download "${d.track.title}"!`); refreshTracks(); }
      else { setAdminMessage(`Error: ${d.message}${d.detail ? " - " + d.detail : ""}`); }
    } catch { setAdminMessage("Gagal menghubungi server."); }
    setSpotifyDownloadingId(null);
  };

  const sidebarPlaylists = [
    { name: "All Tracks", icon: <ListMusic className="w-4 h-4" /> },
    { name: "Rilis Hari Ini", icon: <Sparkles className="w-4 h-4" />, badge: newReleases.length > 0 ? newReleases.length : undefined },
    { name: "Favorites", icon: <Heart className="w-4 h-4" /> },
    ...categories.filter(c => c !== "Rilis Hari Ini").map(c => ({ name: c, icon: <Music className="w-4 h-4" /> })),
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 font-bold">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#1db954] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Memuat musik dari Spotify...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-3xl overflow-hidden bg-[#121212] border border-[#282828] text-slate-300 font-sans shadow-2xl relative">
      <audio ref={audioRef} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} onDurationChange={handleLoadedMetadata} onLoadStart={handleAudioWaiting} onWaiting={handleAudioWaiting} onPlaying={handleAudioPlaying} onCanPlay={handleCanPlay} onError={handleAudioError} onEnded={handleEnded} src={audioSrc} />

      {isAdmin && (
        <div className="px-4 pt-3 pb-3 flex items-center gap-3 border-b border-[#282828] flex-wrap">
          <button onClick={() => { setShowAdminPanel(!showAdminPanel); setAdminMessage(""); }}
            className={`px-3 py-1.5 rounded-full text-[10px] font-black tracking-wider uppercase transition-all cursor-pointer flex items-center gap-1.5 ${showAdminPanel ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" : "bg-[#282828] text-slate-400 hover:text-white border border-transparent"}`}>
            <Settings className="w-3 h-3" /> Admin Music Panel
          </button>
          {adminMessage && <span className={`text-[10px] font-bold ${adminMessage.startsWith("Berhasil") ? "text-[#1db954]" : adminMessage.startsWith("Mengunduh") ? "text-amber-400 animate-pulse" : "text-red-400"}`}>{adminMessage}</span>}
        </div>
      )}

      {isAdmin && showAdminPanel && (
        <div className="bg-[#0a0a0a] border-b border-[#282828] p-4">
          <div className="flex gap-1 mb-4 flex-wrap">
            {(["add", "download", "spotify", "manage"] as const).map(tab => (
              <button key={tab} onClick={() => { setAdminTab(tab); setAdminMessage(""); }}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all ${adminTab === tab ? (tab === "spotify" ? "bg-[#1db954] text-black" : "bg-purple-500 text-white") : "bg-[#1a1a1a] text-slate-400 hover:text-white"}`}>
                {tab === "add" ? "Tambah Manual" : tab === "download" ? "Download URL" : tab === "spotify" ? "Spotify" : "Kelola Lagu"}
              </button>
            ))}
          </div>

          {adminTab === "add" && (
            <div className="grid grid-cols-2 gap-2 max-w-2xl">
              <input placeholder="Judul *" value={adminForm.title} onChange={e => setAdminForm(f => ({ ...f, title: e.target.value }))} className="bg-[#1a1a1a] text-white text-xs px-3 py-2 rounded-lg border border-[#282828] focus:border-purple-500/50 focus:outline-none placeholder-slate-600" />
              <input placeholder="Artis *" value={adminForm.artist} onChange={e => setAdminForm(f => ({ ...f, artist: e.target.value }))} className="bg-[#1a1a1a] text-white text-xs px-3 py-2 rounded-lg border border-[#282828] focus:outline-none placeholder-slate-600" />
              <input placeholder="Album" value={adminForm.album} onChange={e => setAdminForm(f => ({ ...f, album: e.target.value }))} className="bg-[#1a1a1a] text-white text-xs px-3 py-2 rounded-lg border border-[#282828] focus:outline-none placeholder-slate-600" />
              <input placeholder="Durasi (3:30) *" value={adminForm.duration} onChange={e => setAdminForm(f => ({ ...f, duration: e.target.value }))} className="bg-[#1a1a1a] text-white text-xs px-3 py-2 rounded-lg border border-[#282828] focus:outline-none placeholder-slate-600" />
              <input placeholder="URL Audio * (https:// atau /music/file.mp3)" value={adminForm.file} onChange={e => setAdminForm(f => ({ ...f, file: e.target.value }))} className="col-span-2 bg-[#1a1a1a] text-white text-xs px-3 py-2 rounded-lg border border-[#282828] focus:border-purple-500/50 focus:outline-none placeholder-slate-600" />
              <input placeholder="URL Cover * (https:// atau /covers/file.jpg)" value={adminForm.cover} onChange={e => setAdminForm(f => ({ ...f, cover: e.target.value }))} className="col-span-2 bg-[#1a1a1a] text-white text-xs px-3 py-2 rounded-lg border border-[#282828] focus:outline-none placeholder-slate-600" />
              <select value={adminForm.type} onChange={e => setAdminForm(f => ({ ...f, type: e.target.value }))} className="bg-[#1a1a1a] text-white text-xs px-3 py-2 rounded-lg border border-[#282828] focus:outline-none">
                {MUSIC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input placeholder="Tanggal Rilis (opsional)" value={adminForm.releaseDate} onChange={e => setAdminForm(f => ({ ...f, releaseDate: e.target.value }))} className="bg-[#1a1a1a] text-white text-xs px-3 py-2 rounded-lg border border-[#282828] focus:outline-none placeholder-slate-600" />
              <button onClick={handleAdminAdd} disabled={adminLoading} className="col-span-2 mt-1 py-2.5 bg-purple-500 hover:bg-purple-400 disabled:opacity-50 text-white text-xs font-black rounded-lg transition-colors cursor-pointer">
                {adminLoading ? "Menyimpan..." : "Simpan ke Database"}
              </button>
            </div>
          )}

          {adminTab === "download" && (
            <div className="grid grid-cols-2 gap-2 max-w-2xl">
              <div className="col-span-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-[10px] text-amber-400 font-bold">
                Perlu yt-dlp di server. Audio disimpan ke /public/music/
              </div>
              <input placeholder="URL YouTube/SoundCloud *" value={downloadForm.url} onChange={e => setDownloadForm(f => ({ ...f, url: e.target.value }))} className="col-span-2 bg-[#1a1a1a] text-white text-xs px-3 py-2 rounded-lg border border-[#282828] focus:border-amber-500/50 focus:outline-none placeholder-slate-600" />
              <input placeholder="Judul *" value={downloadForm.title} onChange={e => setDownloadForm(f => ({ ...f, title: e.target.value }))} className="bg-[#1a1a1a] text-white text-xs px-3 py-2 rounded-lg border border-[#282828] focus:outline-none placeholder-slate-600" />
              <input placeholder="Artis *" value={downloadForm.artist} onChange={e => setDownloadForm(f => ({ ...f, artist: e.target.value }))} className="bg-[#1a1a1a] text-white text-xs px-3 py-2 rounded-lg border border-[#282828] focus:outline-none placeholder-slate-600" />
              <input placeholder="Album (opsional)" value={downloadForm.album} onChange={e => setDownloadForm(f => ({ ...f, album: e.target.value }))} className="bg-[#1a1a1a] text-white text-xs px-3 py-2 rounded-lg border border-[#282828] focus:outline-none placeholder-slate-600" />
              <input placeholder="URL Cover (opsional)" value={downloadForm.cover} onChange={e => setDownloadForm(f => ({ ...f, cover: e.target.value }))} className="bg-[#1a1a1a] text-white text-xs px-3 py-2 rounded-lg border border-[#282828] focus:outline-none placeholder-slate-600" />
              <select value={downloadForm.type} onChange={e => setDownloadForm(f => ({ ...f, type: e.target.value }))} className="bg-[#1a1a1a] text-white text-xs px-3 py-2 rounded-lg border border-[#282828] focus:outline-none">
                {MUSIC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input placeholder="Tanggal Rilis (opsional)" value={downloadForm.releaseDate} onChange={e => setDownloadForm(f => ({ ...f, releaseDate: e.target.value }))} className="bg-[#1a1a1a] text-white text-xs px-3 py-2 rounded-lg border border-[#282828] focus:outline-none placeholder-slate-600" />
              <button onClick={handleAdminDownload} disabled={adminLoading} className="col-span-2 mt-1 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black text-xs font-black rounded-lg transition-colors cursor-pointer">
                {adminLoading ? "Mengunduh... harap tunggu" : "Download & Simpan ke Database"}
              </button>
            </div>
          )}

          {adminTab === "spotify" && (
            <div className="max-w-2xl">
              <div className="bg-[#1db954]/10 border border-[#1db954]/20 rounded-lg px-3 py-2 text-[10px] text-[#1db954] font-bold mb-3">
                Cari lagu dari Spotify, download audio dari YouTube, simpan ke database. Perlu SPOTIFY_CLIENT_ID & SPOTIFY_CLIENT_SECRET di .env
              </div>
              <div className="flex gap-2 mb-3">
                <input
                  placeholder="Cari lagu, artis, atau album di Spotify..."
                  value={spotifySearchQuery}
                  onChange={e => setSpotifySearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSpotifySearch(); }}
                  className="flex-1 bg-[#1a1a1a] text-white text-xs px-3 py-2.5 rounded-lg border border-[#282828] focus:border-[#1db954]/50 focus:outline-none placeholder-slate-600"
                />
                <button onClick={handleSpotifySearch} disabled={spotifySearching}
                  className="px-4 py-2.5 bg-[#1db954] hover:bg-[#1ed760] disabled:opacity-50 text-black text-xs font-black rounded-lg transition-colors cursor-pointer shrink-0">
                  {spotifySearching ? "Mencari..." : "Cari"}
                </button>
              </div>

              {spotifyResults.length > 0 && (
                <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                  {spotifyResults.map((track: any) => (
                    <div key={track.spotifyId} className="flex items-center gap-3 bg-[#1a1a1a] hover:bg-[#242424] rounded-lg px-3 py-2.5 group transition-colors">
                      <img src={track.cover || "/village.png"} alt="" className="w-10 h-10 rounded object-cover bg-black shrink-0" onError={e => { (e.target as HTMLImageElement).src = "/village.png"; }} />
                      <div className="flex-1 min-w-0">
                        <span className="text-white text-xs font-bold block truncate">{track.title}</span>
                        <span className="text-slate-500 text-[10px] font-bold block truncate">{track.artist} · {track.album} · {track.duration}</span>
                      </div>
                      <button
                        onClick={() => handleSpotifyDownload(track)}
                        disabled={spotifyDownloadingId === track.spotifyId}
                        className="text-[#1db954] hover:text-[#1ed760] disabled:opacity-50 text-[10px] font-black opacity-0 group-hover:opacity-100 transition-all cursor-pointer shrink-0 px-2 py-1.5 rounded hover:bg-[#1db954]/10 border border-transparent hover:border-[#1db954]/20"
                      >
                        {spotifyDownloadingId === track.spotifyId ? "Downloading..." : "Download"}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {spotifyResults.length === 0 && !spotifySearching && spotifySearchQuery && (
                <p className="text-slate-500 text-xs py-4 text-center">Tidak ada hasil. Coba kata kunci lain.</p>
              )}
            </div>
          )}

          {adminTab === "manage" && (
            <div className="max-w-2xl max-h-72 overflow-y-auto space-y-1 pr-1">
              {tracks.length === 0 ? <p className="text-slate-500 text-xs py-4 text-center">Belum ada lagu.</p> : tracks.map(track => (
                <div key={track.id} className="flex items-center gap-3 bg-[#1a1a1a] hover:bg-[#242424] rounded-lg px-3 py-2 group transition-colors">
                  <img src={track.cover} alt="" className="w-8 h-8 rounded object-cover bg-black shrink-0" onError={e => { (e.target as HTMLImageElement).src = "/village.png"; }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-white text-xs font-bold block truncate">{track.title}</span>
                    <span className="text-slate-500 text-[10px] font-bold">{track.artist} · {track.type} · {track.duration}</span>
                  </div>
                  <button onClick={() => handleAdminDelete(track)} className="text-red-500 hover:text-red-300 text-[10px] font-black opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0 px-2 py-1 rounded hover:bg-red-500/10">
                    Hapus
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:h-[520px] min-h-[400px]">
        <aside className="w-full lg:w-60 bg-black p-3 lg:p-4 flex flex-row lg:flex-col justify-between items-center lg:items-stretch shrink-0 border-b lg:border-b-0 lg:border-r border-[#282828] text-xs overflow-x-auto gap-3 lg:gap-0 scrollbar-none">
          <div className="flex flex-row lg:flex-col items-center lg:items-stretch gap-3 lg:gap-4 w-full min-w-0">
            <div className="hidden lg:flex items-center gap-2.5 px-3 py-1 font-bold text-white text-sm shrink-0">
              <Library className="w-5 h-5 text-[#1db954]" />
              <span>Your Library</span>
            </div>
            <nav className="flex flex-row lg:flex-col gap-2 lg:space-y-1 overflow-x-auto lg:overflow-y-auto lg:max-h-80 pr-1 w-full min-w-0 scrollbar-none">
              {sidebarPlaylists.map(p => {
                const isActive = activePlaylist === p.name && !searchQuery.trim();
                const isNew = p.name === "Rilis Hari Ini";
                return (
                  <button key={p.name} onClick={() => { setActivePlaylist(p.name); setSearchQuery(""); }}
                    className={`flex items-center justify-center lg:justify-start gap-2 px-3.5 py-1.5 rounded-full lg:rounded-lg text-[10px] lg:text-[11px] font-black tracking-wide text-center lg:text-left transition-all shrink-0 ${isActive ? "bg-[#282828] text-white" : isNew ? "text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/20 lg:border-0" : "text-slate-400 hover:text-white hover:bg-[#1a1a1a]"}`}>
                    <span className={isNew && !isActive ? "text-amber-400" : ""}>{p.icon}</span>
                    <span className="truncate">{p.name}</span>
                    {(p as any).badge && <span className="bg-[#1db954] text-black text-[8px] font-black px-1.5 py-0.5 rounded-full shrink-0">{(p as any).badge}</span>}
                  </button>
                );
              })}
            </nav>
          </div>
          <div className="hidden lg:block p-3 bg-[#181818]/60 border border-white/5 rounded-xl mt-4 space-y-1">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">PLAYLIST AKTIF</span>
            <span className="text-white font-bold truncate block">{playlistTitle}</span>
            <span className="text-[9px] text-slate-600 font-bold block">{displayTracks.length} lagu</span>
          </div>
        </aside>

        <div className="flex-1 flex flex-col bg-[#121212] overflow-y-auto relative">
          <div className="p-4 bg-black/40 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between border-b border-white/5 gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Cari lagu, artis, atau album..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2 rounded-full bg-[#242424] text-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-white/20 transition-all placeholder-slate-500 border border-transparent focus:border-white/10" />
              {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold cursor-pointer">✕</button>}
            </div>
            {isSearching && <span className="text-[10px] text-[#1db954] font-bold animate-pulse shrink-0">Mencari...</span>}
            {!isSearching && searchQuery && <span className="hidden sm:flex text-[9px] font-black text-[#1db954] bg-[#1db954]/10 border border-[#1db954]/30 px-2 py-0.5 rounded-full shrink-0 items-center gap-1"><Activity className="w-2.5 h-2.5" /> Spotify API</span>}
          </div>

          <div className={`p-4 sm:p-6 flex items-center gap-4 sm:gap-6 border-b border-white/5 ${activePlaylist === "Rilis Hari Ini" ? "bg-gradient-to-b from-amber-900/30 to-[#121212]/90" : "bg-gradient-to-b from-[#3b0764]/50 to-[#121212]/90"}`}>
            <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-lg overflow-hidden shadow-2xl bg-black shrink-0">
              <img src={playlistCover} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = "/village.png"; }} />
            </div>
            <div className="space-y-1 sm:space-y-2">
              <span className={`text-[10px] font-black uppercase tracking-[0.25em] ${activePlaylist === "Rilis Hari Ini" ? "text-amber-400" : "text-[#1db954]"}`}>
                {activePlaylist === "Rilis Hari Ini" ? "NEW RELEASES" : searchQuery ? "SEARCH RESULTS" : "PLAYLIST"}
              </span>
              <h1 className="text-xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-none">{playlistTitle}</h1>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-semibold">{playlistSubtext}</p>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {displayTracks.length === 0 ? (
              <div className="text-center py-12 text-slate-500 font-bold border border-dashed border-[#282828] rounded-xl">
                {isSearching ? "Mencari..." : searchQuery.trim() ? "Tidak ada lagu yang cocok." : activePlaylist === "Favorites" ? "Belum ada favorit." : activePlaylist === "Rilis Hari Ini" ? "Belum ada rilis baru." : "Belum ada lagu di kategori ini."}
              </div>
            ) : (
              <>
                {/* Desktop Track Table */}
                <table className="hidden md:table w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#282828] text-[10px] uppercase text-slate-500 font-black tracking-wider">
                      <th className="py-2.5 w-10 text-center">#</th>
                      <th className="py-2.5">Judul</th>
                      <th className="py-2.5 hidden sm:table-cell">Kategori</th>
                      <th className="py-2.5 w-16 text-center"><Clock className="w-4 h-4 mx-auto" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayTracks.map((track, idx) => {
                      const isCur = currentTrack?.id === track.id;
                      const isHov = hoveredTrackId === track.id;
                      const isLiked = likedTracks[track.id] || false;
                      return (
                        <tr key={track.id} onMouseEnter={() => { setHoveredTrackId(track.id); prewarmTrack(track); }} onMouseLeave={() => setHoveredTrackId(null)}
                          onDoubleClick={() => playTrack(track, displayTracks)}
                          className={`group text-xs font-semibold text-slate-400 hover:bg-white/5 border-b border-[#1a1a1a]/50 transition-all cursor-pointer ${isCur ? "bg-white/[0.02]" : ""}`}>
                          <td className="py-3 text-center">
                            {loadingTrackId === track.id ? (
                              <div className="w-3.5 h-3.5 border-2 border-[#1db954] border-t-transparent rounded-full animate-spin mx-auto" />
                            ) : isHov ? (
                              <button onClick={() => isCur ? handlePlayPause() : playTrack(track, displayTracks)} className="text-white hover:scale-110 transition-transform cursor-pointer">
                                {isCur && isPlaying ? <Pause className="w-4 h-4 fill-current mx-auto" /> : <Play className="w-4 h-4 fill-current mx-auto" />}
                              </button>
                            ) : (
                              <span className={isCur ? "text-[#1db954] font-black" : ""}>
                                {isCur && isPlaying ? (
                                  <div className="flex gap-0.5 items-end justify-center h-3">
                                    <span className="w-0.5 bg-[#1db954] h-2 rounded-full animate-pulse" />
                                    <span className="w-0.5 bg-[#1db954] h-3 rounded-full animate-pulse" style={{ animationDelay: "0.15s" }} />
                                    <span className="w-0.5 bg-[#1db954] h-1.5 rounded-full animate-pulse" style={{ animationDelay: "0.3s" }} />
                                  </div>
                                ) : idx + 1}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-3">
                              <img src={track.cover} alt="" className="w-9 h-9 rounded object-cover shadow-sm bg-black shrink-0" onError={e => { (e.target as HTMLImageElement).src = "/village.png"; }} />
                              <div className="min-w-0">
                                <span className={`block truncate text-sm transition-colors ${isCur ? "text-[#1db954] font-black" : "text-white"}`}>{track.title}</span>
                                <span className="text-[10px] text-slate-500 font-bold block mt-0.5">{track.artist}{track.album ? ` · ${track.album}` : ""}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 hidden sm:table-cell">
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-white/5 text-slate-500">{track.type}</span>
                          </td>
                          <td className="py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={e => { e.stopPropagation(); toggleLike(track); }} className={`transition-colors cursor-pointer ${isLiked ? "text-[#1db954]" : "text-slate-600 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"}`}>
                                <Heart className={`w-3.5 h-3.5 ${isLiked ? "fill-current" : ""}`} />
                              </button>
                              <span className="text-[10px] text-slate-500 font-bold tracking-wider">{track.duration}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Mobile Track List */}
                <div className="md:hidden space-y-1">
                  {displayTracks.map((track, idx) => {
                    const isCur = currentTrack?.id === track.id;
                    const isLiked = likedTracks[track.id] || false;
                    return (
                      <div key={track.id} onClick={() => playTrack(track, displayTracks)}
                        className={`flex items-center justify-between p-2 rounded-xl active:bg-white/10 transition-colors ${isCur ? "bg-white/[0.04]" : ""}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`text-[11px] font-bold w-5 text-center ${isCur ? "text-[#1db954]" : "text-slate-500"}`}>
                            {loadingTrackId === track.id ? (
                              <div className="w-3.5 h-3.5 border-2 border-[#1db954] border-t-transparent rounded-full animate-spin mx-auto" />
                            ) : isCur && isPlaying ? (
                              <div className="flex gap-0.5 items-end justify-center h-3">
                                <span className="w-0.5 bg-[#1db954] h-1.5 rounded-full animate-pulse" />
                                <span className="w-0.5 bg-[#1db954] h-2.5 rounded-full animate-pulse" style={{ animationDelay: "0.15s" }} />
                                <span className="w-0.5 bg-[#1db954] h-1 rounded-full animate-pulse" style={{ animationDelay: "0.3s" }} />
                              </div>
                            ) : idx + 1}
                          </span>
                          <img src={track.cover} alt="" className="w-10 h-10 rounded-lg object-cover bg-black shrink-0 shadow-sm" onError={e => { (e.target as HTMLImageElement).src = "/village.png"; }} />
                          <div className="min-w-0">
                            <span className={`block truncate text-xs font-bold ${isCur ? "text-[#1db954]" : "text-white"}`}>{track.title}</span>
                            <span className="text-[10px] text-slate-500 font-semibold block truncate mt-0.5">{track.artist}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <button onClick={e => { e.stopPropagation(); toggleLike(track); }} className={`transition-colors p-1 text-xs ${isLiked ? "text-[#1db954]" : "text-slate-500"}`}>
                            <Heart className={`w-3.5 h-3.5 ${isLiked ? "fill-current" : ""}`} />
                          </button>
                          <span className="text-[10px] text-slate-500 font-bold pr-2">{track.duration}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <footer className="bg-[#181818] border-t border-[#282828] px-4 py-3 sm:py-3.5 flex items-center justify-between z-25 rounded-b-3xl relative">
        {/* Mobile Thin Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#282828] md:hidden">
          <div className="h-full bg-[#1db954] transition-all duration-300" style={{ width: `${((currentTime || 0) / (visualDuration || 1)) * 100}%` }} />
        </div>

        <div className="flex items-center gap-3 min-w-0 flex-1 md:flex-initial md:max-w-[30%]">
          <img src={currentTrack?.cover || "/village.png"} alt="" className="w-10 h-10 sm:w-13 sm:h-13 rounded-lg object-cover bg-black shadow-lg shrink-0" onError={e => { (e.target as HTMLImageElement).src = "/village.png"; }} />
          <div className="min-w-0">
            <span className="text-white text-xs sm:text-[13px] font-bold tracking-wide truncate block">{currentTrack?.title || "—"}</span>
            <span className="text-[9px] sm:text-[10px] text-slate-400 font-semibold truncate block mt-0.5">
              {isStreamLoading ? (
                <span className="text-amber-400 animate-pulse flex items-center gap-1">
                  <span className="w-2 h-2 border border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
                  Memuat...
                </span>
              ) : (
                currentTrack?.artist || "Pilih lagu"
              )}
            </span>
          </div>
          {currentTrack && (
            <button onClick={() => toggleLike(currentTrack)} className={`cursor-pointer transition-colors shrink-0 ${likedTracks[currentTrack.id] ? "text-[#1db954]" : "text-slate-500 hover:text-white"}`}>
              <Heart className={`w-3.5 h-3.5 ${likedTracks[currentTrack.id] ? "fill-current" : ""}`} />
            </button>
          )}
        </div>

        <div className="flex flex-col items-center gap-1.5 flex-1 md:max-w-[45%]">
          <div className="flex items-center gap-3 sm:gap-4">
            <button onClick={() => setIsShuffling(!isShuffling)} className={`hidden md:block transition-colors cursor-pointer ${isShuffling ? "text-[#1db954]" : "text-slate-500 hover:text-white"}`}><Shuffle className="w-4 h-4" /></button>
            <button onClick={handlePrevious} className="hidden md:block text-slate-300 hover:text-white transition-colors cursor-pointer"><SkipBack className="w-4.5 h-4.5 fill-current" /></button>
            <button onClick={handlePlayPause} disabled={!currentTrack} className="w-8 h-8 rounded-full bg-white hover:scale-105 transition-transform flex items-center justify-center text-black shadow-md cursor-pointer active:scale-95 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed">
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>
            <button onClick={handleNext} className="text-slate-300 hover:text-white transition-colors cursor-pointer"><SkipForward className="w-4.5 h-4.5 fill-current" /></button>
            <button onClick={() => setIsLooping(!isLooping)} className={`hidden md:block transition-colors cursor-pointer ${isLooping ? "text-[#1db954]" : "text-slate-500 hover:text-white"}`}><Repeat className="w-4 h-4" /></button>
          </div>
          <div className="hidden md:flex w-full items-center gap-3">
            <span className="text-[9px] text-slate-500 font-bold min-w-[28px] text-right">{fmt(currentTime)}</span>
            <input type="range" min={0} max={visualDuration} value={currentTime} onChange={handleScrub} className="w-full h-1 rounded bg-[#282828] accent-[#1db954] cursor-pointer"
              style={{ background: `linear-gradient(to right, rgb(29,185,84) 0%, rgb(29,185,84) ${(currentTime / (visualDuration || 1)) * 100}%, rgb(40,40,40) ${(currentTime / (visualDuration || 1)) * 100}%, rgb(40,40,40) 100%)` }} />
            <span className="text-[9px] text-slate-500 font-bold min-w-[28px]">{fmt(duration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 min-w-[100px] justify-end max-w-[25%] text-slate-400">
          <button onClick={() => setIsMuted(!isMuted)} className="hover:text-white transition-colors cursor-pointer">
            {isMuted ? <VolumeX className="w-4 h-4 text-[#1db954]" /> : volume < 0.4 ? <Volume1 className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input type="range" min={0} max={1} step={0.05} value={volume} onChange={e => { setVolume(parseFloat(e.target.value)); setIsMuted(false); }} className="w-20 sm:w-24 h-1 rounded bg-[#282828] accent-[#1db954] cursor-pointer"
            style={{ background: `linear-gradient(to right, rgb(29,185,84) 0%, rgb(29,185,84) ${volume * 100}%, rgb(40,40,40) ${volume * 100}%, rgb(40,40,40) 100%)` }} />
        </div>
      </footer>
    </div>
  );
}




