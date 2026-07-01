import { Link } from "wouter";
import { useClerk, Show, useUser } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { customFetch, useGetMe, useUpdateMe } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { User, LogOut, Settings, MessageSquare, Users, Home, ChevronDown, Gamepad2, ShieldAlert, Crown, Tv } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Layout({ children }: { children: React.ReactNode }) {
  const { signOut } = useClerk();
  const { user: clerkUser } = useUser();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const { data: me } = useGetMe();
  const { data: realmSettings = {} } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: () => customFetch<any>("/api/settings"),
  });
  const updateMe = useUpdateMe();
  const queryClient = useQueryClient();
  const [mcName, setMcName] = useState("");
  const [savingMc, setSavingMc] = useState(false);
  const [errorMc, setErrorMc] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const realmName = realmSettings.realmName || "Arcadia Studio";
  const realmLogoUrl = realmSettings.realmLogoUrl || `${basePath}/logo.svg`;
  const displayName =
    me?.displayName?.trim() ||
    me?.username?.trim() ||
    clerkUser?.fullName?.trim() ||
    clerkUser?.username?.trim() ||
    clerkUser?.primaryEmailAddress?.emailAddress?.split("@")[0]?.trim() ||
    "Player";
  const avatarUrl = me?.avatarUrl || clerkUser?.imageUrl || null;
  const userTag = me?.userTag || (me?.username ? `@${me.username}` : clerkUser?.username ? `@${clerkUser.username}` : "");

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#050507] text-zinc-100">
      <header className="border-b border-zinc-900/60 bg-[#050507]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <img src={realmLogoUrl} alt={realmName} className="w-7.5 h-7.5 rounded-lg object-cover opacity-85 group-hover:opacity-100 transition-opacity" />
            <span className="font-black text-xs text-white tracking-[0.25em] uppercase transition-colors">{realmName}</span>
          </Link>

          {/* Center Navigation Menu - Morningstar Style */}
          <div className="hidden md:flex items-center gap-8 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 font-mono">
            <a
              href="/#home"
              onClick={(e) => {
                if (window.location.pathname === "/") {
                  e.preventDefault();
                  document.getElementById("home")?.scrollIntoView({ behavior: "smooth" });
                }
              }}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Home
            </a>
            <a
              href="/#gallery"
              onClick={(e) => {
                if (window.location.pathname === "/") {
                  e.preventDefault();
                  document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" });
                }
              }}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Gallery
            </a>
            <a
              href="/#features"
              onClick={(e) => {
                if (window.location.pathname === "/") {
                  e.preventDefault();
                  document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
                }
              }}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Feature
            </a>
            <a
              href="/#roadmap"
              onClick={(e) => {
                if (window.location.pathname === "/") {
                  e.preventDefault();
                  document.getElementById("roadmap")?.scrollIntoView({ behavior: "smooth" });
                }
              }}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Roadmap & Forge
            </a>
            <Link href="/anime" className="hover:text-white transition-colors cursor-pointer">
              Anime
            </Link>
          </div>
          
          <div className="relative" ref={dropdownRef}>
            <Show when="signed-out">
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)} 
                className="w-10 h-10 rounded-full border border-zinc-800/30 flex items-center justify-center hover:bg-zinc-900 transition-colors text-zinc-400 hover:text-white focus:outline-none cursor-pointer"
                aria-label="Profile menu"
              >
                <User className="w-5 h-5" />
              </button>
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-zinc-800/50 bg-[#0b0b0f]/95 backdrop-blur-md p-2 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200 z-50 flex flex-col gap-1">
                  <Link href="/sign-in" className="flex items-center gap-2 px-3 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-zinc-900 hover:text-white transition-all text-left cursor-pointer" onClick={() => setIsDropdownOpen(false)}>
                    Sign In
                  </Link>
                  <Link href="/sign-up" className="flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg bg-white text-black hover:bg-zinc-200 transition-all text-center cursor-pointer" onClick={() => setIsDropdownOpen(false)}>
                    Play Now
                  </Link>
                </div>
              )}
            </Show>
            <Show when="signed-in">
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)} 
                className="flex items-center gap-1.5 focus:outline-none group cursor-pointer"
                aria-label="User menu"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-zinc-900 relative p-0.5 overflow-visible ${me?.equippedBorder || "border-2 border-zinc-800 group-hover:border-zinc-500"}`}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-white">{getInitials(displayName)}</span>
                  )}
                </div>
                <ChevronDown className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
              </button>
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl border border-zinc-800/50 bg-[#0b0b0f]/95 backdrop-blur-md p-2 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200 z-50 divide-y divide-zinc-900 flex flex-col">
                  {/* User Info Header */}
                  <div className="px-3 py-2.5 pb-3">
                    <p className="text-sm font-bold text-white truncate">{displayName}</p>
                    <p className="text-xs text-zinc-500 truncate">{userTag}</p>
                    {me?.mcUsername && (
                      <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400">
                        <Gamepad2 className="w-3.5 h-3.5" /> {me.mcUsername}
                      </div>
                    )}
                  </div>
                  
                  {/* Portal Navigation Options */}
                  <div className="py-1.5 flex flex-col">
                    <Link href="/" className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-all cursor-pointer" onClick={() => setIsDropdownOpen(false)}>
                      <Home className="w-4.5 h-4.5" /> Home Page
                    </Link>
                    <Link href="/member" className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-all cursor-pointer" onClick={() => setIsDropdownOpen(false)}>
                      <User className="w-4.5 h-4.5" /> Player Hub
                    </Link>
                    <Link href="/anime" className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-all cursor-pointer" onClick={() => setIsDropdownOpen(false)}>
                      <Tv className="w-4.5 h-4.5" /> Nonton Anime
                    </Link>
                    <Link href="/friends" className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-all cursor-pointer" onClick={() => setIsDropdownOpen(false)}>
                      <Users className="w-4.5 h-4.5" /> Guilds
                    </Link>
                    <Link href="/member?tab=messages" className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-all cursor-pointer" onClick={() => setIsDropdownOpen(false)}>
                      <MessageSquare className="w-4.5 h-4.5" /> Messages
                    </Link>
                    <Link href="/member?tab=settings" className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-all cursor-pointer" onClick={() => setIsDropdownOpen(false)}>
                      <Settings className="w-4.5 h-4.5" /> Account Settings
                    </Link>
                    {me?.role && ["admin", "staff", "dev", "dev_website"].includes(me.role) && (
                      <Link href="/admin" className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all cursor-pointer" onClick={() => setIsDropdownOpen(false)}>
                        <ShieldAlert className="w-4.5 h-4.5" /> Admin Portal
                      </Link>
                    )}
                    {me && (
                      <Link href="/premium" className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition-all cursor-pointer" onClick={() => setIsDropdownOpen(false)}>
                        <Crown className="w-4.5 h-4.5" /> Premium Area
                      </Link>
                    )}
                  </div>
 
                  {/* Log out option */}
                  <div className="pt-1.5">
                    <button 
                      onClick={() => {
                        setIsDropdownOpen(false);
                        signOut({ redirectUrl: basePath || "/" });
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/10 rounded-lg transition-all text-left cursor-pointer"
                    >
                      <LogOut className="w-4.5 h-4.5" /> Disconnect
                    </button>
                  </div>
                </div>
              )}
            </Show>
          </div>
        </div>
      </header>
      
      <main className="flex-1">
        {children}
      </main>
      
      <footer className="border-t border-zinc-900/60 bg-[#050507] py-8">
        <div className="container mx-auto px-4 text-center text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">
          <p>{realmName} &copy; {new Date().getFullYear()}. Forged in myth.</p>
        </div>
      </footer>

      {/* Minecraft Username Prompt Overlay */}
      <Dialog open={!!(me && !me.mcUsername)} onOpenChange={() => {}}>
        <DialogContent className="bg-card border-border max-w-md [&>button]:hidden" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-primary text-center text-xl font-bold flex items-center justify-center gap-2">
              🎮 Minecraft Username
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-center">
            <p className="text-sm text-muted-foreground">
              Selamat datang di <strong>{realmName}</strong>! Silakan masukkan username Minecraft Anda terlebih dahulu untuk melanjutkan.
            </p>
            <div className="space-y-2 text-left">
              <Label htmlFor="promptMcUsername">Username Minecraft</Label>
              <Input
                id="promptMcUsername"
                placeholder="Contoh: Steve_Gacor"
                value={mcName}
                onChange={(e) => {
                  setMcName(e.target.value);
                  setErrorMc("");
                }}
                className="bg-input border-border"
              />
              {errorMc && <p className="text-xs text-destructive">{errorMc}</p>}
            </div>
            <Button
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
              onClick={async () => {
                const trimmed = mcName.trim();
                if (!trimmed) {
                  setErrorMc("Username tidak boleh kosong.");
                  return;
                }
                if (trimmed.length < 3) {
                  setErrorMc("Username minimal 3 karakter.");
                  return;
                }
                setSavingMc(true);
                try {
                  await updateMe.mutateAsync({ data: { mcUsername: trimmed } });
                  await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : "Gagal menyimpan username.";
                  setErrorMc(msg);
                } finally {
                  setSavingMc(false);
                }
              }}
              disabled={savingMc || !mcName.trim()}
            >
              {savingMc ? "Menghubungkan..." : "Hubungkan Karakter"}
            </Button>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground/90 font-medium text-xs mt-1"
              onClick={async () => {
                try {
                  await signOut();
                } catch (err) {
                  console.error("Logout failed:", err);
                }
              }}
              disabled={savingMc}
            >
              Keluar / Log Out
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}
