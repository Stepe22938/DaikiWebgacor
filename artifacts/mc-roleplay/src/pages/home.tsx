import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useGetStats, useListDevelopments, useGetMe, customFetch } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Copy, 
  Check, 
  Gamepad2, 
  Server, 
  Shield, 
  Coins, 
  Users, 
  Layers, 
  MessageSquare, 
  Terminal, 
  Activity,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  ArrowUpRight,
  ClipboardList
} from "lucide-react";

export default function Home() {
  const { data: stats } = useGetStats();
  const { data: developments } = useListDevelopments();
  const { data: user } = useGetMe();
  const { data: settings = {} } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: () => customFetch<any>("/api/settings"),
  });

  const [copied, setCopied] = useState(false);
  const [activeGallery, setActiveGallery] = useState(0);
  const [is3DReady, setIs3DReady] = useState(false);

  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.substring(1);
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }, 300);
    }

    // Load Sketchfab Viewer API script
    const script = document.createElement("script");
    script.src = "https://static.sketchfab.com/api/sketchfab-viewer-1.12.1.js";
    script.async = true;
    script.onload = () => {
      const iframe = document.getElementById("sketchfab-iframe") as HTMLIFrameElement;
      if (!iframe || !(window as any).Sketchfab) return;

      const client = new (window as any).Sketchfab("1.12.1", iframe);
      client.init("4389732e5793410bacf61bd05217fbc9", {
        success: (api: any) => {
          api.start();
          api.addEventListener("viewerready", () => {
            // Lock vertical rotation (pitch) and set zoom boundaries
            api.setCameraConstraints({
              orbit_constraint_pitch_up: 0.25,
              orbit_constraint_pitch_down: 0.25,
              orbit_constraint_zoom_min: 15,
              orbit_constraint_zoom_max: 32,
              orbit_constraint_pan: false
            }, (err: any) => {
              if (!err) {
                api.setEnableCameraConstraints(true);
                // Trigger cross-fade to hide the loading bar and show the interactive 3D model
                setIs3DReady(true);
              }
            });
          });
        },
        error: () => {
          console.error("Sketchfab API error");
        },
        camera: "4.8,-20.4,5.8,0,0,3.5",
        autostart: 1,
        preload: 1,
        ui_controls: 0,
        ui_infos: 0,
        ui_watermark: 0,
        ui_ar: 0,
        ui_help: 0,
        ui_settings: 0,
        ui_vr: 0,
        ui_fullscreen: 0,
        transparent: 1
      });
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const serverIP = settings.serverIP || "play.arcadiamc.net";
  const heroSubtitle = settings.heroSubtitle || "Studio Made A Minecraft Roleplay";
  const mcVersion = settings.mcVersion || "1.20.x - 1.21.x";
  const specsCpu = settings.specsCpu || "Intel Xeon E-2388G";
  const specsMemory = settings.specsMemory || "32 GB DDR4 ECC";
  const specsStorage = settings.specsStorage || "NVMe PCIe Gen 4 SSD";
  const specsLocation = settings.specsLocation || "Debian VPS Port 5433";
  const galleryTitle = settings.galleryTitle || "Explore the Realm of Arcadia";
  const gallerySubtitle = settings.gallerySubtitle || "Take a visual tour through our hand-crafted server landscapes, customized cities, and deadly adventure zones.";

  const handleCopyIP = () => {
    navigator.clipboard.writeText(serverIP);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fallbackGallery = [
    {
      src: "/lobby.png",
      title: "The Arcadia Spawn",
      description: "A monumental medieval hub where all journeys begin, featuring majestic towers and direct portals."
    },
    {
      src: "/village.png",
      title: "Whispering Woods Town",
      description: "A cozy, player-built trading center where guilds gather, establish shops, and share active roleplay."
    },
    {
      src: "/dungeon.png",
      title: "Underworld Crypts",
      description: "A dangerous, high-reward dungeon loaded with custom boss mechanics, puzzles, and mythic tier loot."
    }
  ];

  const galleryImages = settings.gallery && Array.isArray(settings.gallery) && settings.gallery.length > 0
    ? settings.gallery
    : fallbackGallery;

  const activeGalleryIndex = activeGallery >= galleryImages.length ? 0 : activeGallery;

  return (
    <Layout>
      {/* CSS Keyframes for Monolith Floating */}
      <style>{`
        @keyframes floatMonolith {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
      `}</style>

      {/* HERO SECTION - Minimalist Dark High-Contrast */}
      <div id="home" className="relative overflow-hidden bg-[#050507] text-white min-h-[90vh] flex items-center justify-center px-4 scroll-mt-20">
        {/* Ambient background glows */}
        <div className="absolute top-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-violet-600/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-[#6366f1]/5 blur-[120px] pointer-events-none" />
        
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff01_1px,transparent_1px),linear-gradient(to_bottom,#ffffff01_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

        <div className="container mx-auto max-w-5xl relative z-10 py-12 text-center flex flex-col items-center gap-6">
          {/* Season Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900/80 border border-zinc-800/60 text-[10px] text-zinc-400 font-black tracking-[0.2em] uppercase">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Season II: Rise of the Guilds
          </div>

          {/* 3D Stylized Crystal Shrine centerpiece (Cleaned - No Sketchfab UI) */}
          <div 
            className="select-none flex items-center justify-center w-[320px] h-[320px] sm:w-[420px] sm:h-[420px] relative overflow-hidden rounded-full border border-zinc-900/30 bg-zinc-950/10"
            style={{ animation: "floatMonolith 6s ease-in-out infinite" }}
          >
            {/* Ambient Purple Glow behind 3D model */}
            <div className="absolute w-[200px] h-[200px] rounded-full bg-violet-600/10 blur-[55px] pointer-events-none" />
            
            {/* Static Instant Placeholder Image */}
            <img
              src="/crystal-placeholder.png"
              alt="Crystal Shrine Placeholder"
              className={`absolute w-full h-full object-cover transition-opacity duration-[800ms] ease-in-out z-10 ${
                is3DReady ? "opacity-0 pointer-events-none" : "opacity-100"
              }`}
            />

            {/* Interactive 3D Model Iframe */}
            <iframe
              id="sketchfab-iframe"
              title="Stylised Crystal Shrine"
              frameBorder="0"
              allowFullScreen
              allow="autoplay; fullscreen; xr-spatial-tracking"
              className={`absolute pointer-events-auto transition-opacity duration-[800ms] ease-in-out z-20 ${
                is3DReady ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
              style={{ 
                background: "transparent",
                top: "-48px",
                left: "-48px",
                width: "calc(100% + 96px)",
                height: "calc(100% + 96px)",
              }}
            ></iframe>
          </div>

          {/* Main Title - "Welcome" or "Welcome to Arcadia" */}
          <div className="space-y-2">
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-[0.25em] text-white leading-none uppercase select-none">
              Welcome
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 max-w-xl mx-auto leading-relaxed font-semibold uppercase tracking-wider">
              {heroSubtitle}
            </p>
          </div>

          {/* Action Row */}
          <div className="max-w-xl w-full space-y-4 px-4">
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-[#0b0b0f] border border-zinc-900 rounded-2xl p-2 shadow-2xl transition-all duration-300 hover:border-zinc-800">
              {/* Server Status info */}
              <div className="flex items-center gap-3 flex-1 px-3 py-2 sm:py-0 w-full justify-between sm:justify-start">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-450 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <div className="text-left">
                    <p className="text-[8px] text-zinc-500 uppercase font-black tracking-wider">SERVER ADDRESS</p>
                    <p className="text-xs font-mono font-bold text-zinc-350 tracking-wide">{serverIP}</p>
                  </div>
                </div>

                {stats && (
                  <div className="sm:ml-auto text-[9px] text-zinc-400 font-extrabold bg-zinc-900/60 border border-zinc-800/40 px-2.5 py-1 rounded-lg">
                    <span className="text-emerald-400 font-black">{stats.totalMembers + 14}</span> Online
                  </div>
                )}
              </div>

              {/* Copy Button */}
              <Button 
                size="sm" 
                onClick={handleCopyIP} 
                className={`w-full sm:w-auto h-9 px-4 font-black transition-all rounded-xl select-none flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wider ${
                  copied 
                    ? "bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 hover:bg-emerald-500/20" 
                    : "bg-zinc-900 hover:bg-zinc-850 border border-zinc-800/60 text-zinc-300 hover:text-white"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copy IP
                  </>
                )}
              </Button>
            </div>

            {/* Play Button */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button size="lg" asChild className="w-full h-11 text-xs font-black uppercase tracking-widest bg-white text-black hover:bg-zinc-200 transition-all rounded-xl shadow-lg border border-white/10">
                <Link href={user ? "/member" : "/sign-up"} className="flex items-center justify-center gap-1.5">
                  {user ? "Open Player Hub" : "Begin Journey"} <ArrowUpRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>

          <p className="text-[10px] text-zinc-650 tracking-wider font-bold">
            COMPATIBLE WITH JAVA {mcVersion} • LAUNCHER LOG-IN REQUIRED
          </p>
        </div>
      </div>

      {/* BODY SECTIONS - 100% Dark Theme */}
      <div className="bg-[#050507] text-zinc-100 relative pb-24">
        {/* Dynamic Server Metrics Grid */}
        {stats && (
          <div className="relative z-20 -mt-8 max-w-5xl mx-auto px-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-[#0b0b0f]/80 backdrop-blur-md border border-zinc-900 shadow-xl hover:border-zinc-800 transition-colors duration-300 flex flex-col justify-between">
                <div className="text-2xl sm:text-3xl font-black text-white">{stats.totalMembers}</div>
                <div className="text-[8px] text-zinc-500 uppercase font-black tracking-widest mt-2">Active Citizens</div>
              </div>
              <div className="p-5 rounded-2xl bg-[#0b0b0f]/80 backdrop-blur-md border border-zinc-900 shadow-xl hover:border-zinc-800 transition-colors duration-300 flex flex-col justify-between">
                <div className="text-2xl sm:text-3xl font-black text-white">{stats.totalDevelopments}</div>
                <div className="text-[8px] text-zinc-500 uppercase font-black tracking-widest mt-2">Unique Features</div>
              </div>
              <div className="p-5 rounded-2xl bg-[#0b0b0f]/80 backdrop-blur-md border border-zinc-900 shadow-xl hover:border-zinc-800 transition-colors duration-300 flex flex-col justify-between">
                <div className="text-2xl sm:text-3xl font-black text-white">{stats.completedDevelopments}</div>
                <div className="text-[8px] text-zinc-500 uppercase font-black tracking-widest mt-2">Completed Items</div>
              </div>
              <div className="p-5 rounded-2xl bg-[#0b0b0f]/80 backdrop-blur-md border border-zinc-900 shadow-xl hover:border-zinc-800 transition-colors duration-300 flex flex-col justify-between">
                <div className="text-2xl sm:text-3xl font-black text-white">{stats.totalAnnouncements}</div>
                <div className="text-[8px] text-zinc-500 uppercase font-black tracking-widest mt-2">Lore Releases</div>
              </div>
            </div>
          </div>
        )}

        {/* Visual Gallery Section */}
        <div id="gallery" className="py-20 md:py-28 max-w-5xl mx-auto px-4 relative z-10 scroll-mt-20">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <div className="inline-flex items-center justify-center px-3.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 font-bold text-[9px] uppercase tracking-widest">
              Gallery
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center justify-center gap-3 uppercase">
              <span>{galleryTitle}</span>
              {(user?.role === "admin" || user?.role === "dev_website") && (
                <Link href="/admin?tab=gallery" className="inline-flex items-center justify-center p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors" title="Edit Gallery Section">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </Link>
              )}
            </h2>
            <p className="text-zinc-500 font-medium text-xs sm:text-sm">{gallerySubtitle}</p>
          </div>

          {/* DESKTOP GALLERY GRID */}
          <div className="hidden lg:grid grid-cols-5 gap-8 items-center">
            {/* Gallery Navigation and Text */}
            <div className="col-span-2 space-y-3.5">
              {galleryImages.map((img: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setActiveGallery(idx)}
                  className={`w-full text-left p-5 rounded-2xl border transition-all duration-300 ${
                    activeGalleryIndex === idx
                      ? "bg-[#0b0b0f] border-zinc-800 text-white shadow-xl translate-x-2"
                      : "bg-[#050507]/40 border-zinc-900/60 hover:bg-[#0b0b0f]/60 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${activeGalleryIndex === idx ? "bg-white" : "bg-zinc-800"}`} />
                    {img.title}
                  </h3>
                  <p className="text-xs mt-2 leading-relaxed font-medium opacity-80">
                    {img.description}
                  </p>
                </button>
              ))}
            </div>

            {/* Display Viewport */}
            <div className="col-span-3">
              <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-zinc-900 bg-[#0b0b0f] shadow-2xl">
                {galleryImages[activeGalleryIndex] && (
                  <img
                    src={galleryImages[activeGalleryIndex].src}
                    alt={galleryImages[activeGalleryIndex].title}
                    className="w-full h-full object-cover transition-all duration-500"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-4 left-4 flex items-center">
                  <span className="text-[8px] font-black px-2.5 py-1 rounded bg-zinc-900/90 border border-zinc-800/80 text-zinc-300 uppercase tracking-widest">
                    In-Game Live Capture
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* MOBILE CAROUSEL VIEWPORT */}
          <div className="block lg:hidden space-y-5">
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-zinc-900 bg-[#0b0b0f] shadow-lg">
              {galleryImages[activeGalleryIndex] && (
                <img
                  src={galleryImages[activeGalleryIndex].src}
                  alt={galleryImages[activeGalleryIndex].title}
                  className="w-full h-full object-cover"
                />
              )}
              
              <button 
                onClick={() => {
                  const prevIdx = activeGalleryIndex === 0 ? galleryImages.length - 1 : activeGalleryIndex - 1;
                  setActiveGallery(prevIdx);
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 border border-zinc-800/40 text-white flex items-center justify-center hover:bg-black/80 active:scale-95 transition-all"
              >
                <ChevronLeft className="w-4.5 h-4.5" />
              </button>
              <button 
                onClick={() => {
                  const nextIdx = activeGalleryIndex === galleryImages.length - 1 ? 0 : activeGalleryIndex + 1;
                  setActiveGallery(nextIdx);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 border border-zinc-800/40 text-white flex items-center justify-center hover:bg-black/80 active:scale-95 transition-all"
              >
                <ChevronRight className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Active text summary */}
            <div className="bg-[#0b0b0f] p-5 rounded-2xl border border-zinc-900 text-center space-y-2">
              <h3 className="font-bold text-sm text-white">
                {galleryImages[activeGalleryIndex]?.title}
              </h3>
              <p className="text-xs text-zinc-500 font-medium leading-relaxed">
                {galleryImages[activeGalleryIndex]?.description}
              </p>
              
              <div className="flex justify-center gap-1.5 pt-2">
                {galleryImages.map((_: any, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setActiveGallery(idx)}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      activeGalleryIndex === idx ? "w-4 bg-white" : "w-1 bg-zinc-800"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid Section */}
        <div id="features" className="py-20 md:py-28 border-y border-zinc-900/60 bg-[#070709] scroll-mt-20">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
              <div className="inline-flex items-center justify-center px-3.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 font-bold text-[9px] uppercase tracking-widest">
                Features
              </div>
              <h2 className="text-3xl font-extrabold text-white tracking-tight uppercase">Everything You Need For Immersive Play</h2>
              <p className="text-zinc-500 font-medium text-xs sm:text-sm">Our custom software integrations and server configurations deliver a gaming experience like no other.</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-[#0b0b0f] border-zinc-900 hover:border-zinc-800 hover:bg-[#0e0e14] transition-all duration-300 rounded-2xl group shadow-2xl">
                <CardHeader className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800/80 group-hover:bg-white group-hover:text-black flex items-center justify-center text-zinc-400 transition-all duration-350">
                    <Shield className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-sm font-extrabold text-white uppercase tracking-wider">Kingdoms & Lore</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-zinc-500 font-semibold leading-relaxed">
                    Create a town, forge a guild, register political factions, and engage in land claims, castle sieges, and live seasonal lore.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-[#0b0b0f] border-zinc-900 hover:border-zinc-800 hover:bg-[#0e0e14] transition-all duration-300 rounded-2xl group shadow-2xl">
                <CardHeader className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800/80 group-hover:bg-white group-hover:text-black flex items-center justify-center text-zinc-400 transition-all duration-350">
                    <Coins className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-sm font-extrabold text-white uppercase tracking-wider">Dynamic Economy</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-zinc-500 font-semibold leading-relaxed">
                    A fully player-run market with item trading, custom bank accounts, shop rentals, trade treaties, and gold-backed currency.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-[#0b0b0f] border-zinc-900 hover:border-zinc-800 hover:bg-[#0e0e14] transition-all duration-300 rounded-2xl group shadow-2xl">
                <CardHeader className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800/80 group-hover:bg-white group-hover:text-black flex items-center justify-center text-zinc-400 transition-all duration-350">
                    <Gamepad2 className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-sm font-extrabold text-white uppercase tracking-wider">Custom RPG</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-zinc-500 font-semibold leading-relaxed">
                    Unlock RPG level gains, special character stats, crafting recipes, custom block models, and magic attributes.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-[#0b0b0f] border-zinc-900 hover:border-zinc-800 hover:bg-[#0e0e14] transition-all duration-300 rounded-2xl group shadow-2xl">
                <CardHeader className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800/80 group-hover:bg-white group-hover:text-black flex items-center justify-center text-zinc-400 transition-all duration-350">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-sm font-extrabold text-white uppercase tracking-wider">WhatsApp Business</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-zinc-500 font-semibold leading-relaxed">
                    Start audio calls, video calls, direct messages, and trade products through your own business dashboard on the web.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Tabs Deep-Dive: Connect, Roadmap, Specs */}
        <div id="roadmap" className="py-20 md:py-28 max-w-5xl mx-auto px-4 relative z-10 scroll-mt-20">
          <Tabs defaultValue="join-guide" className="space-y-8">
            {/* Scrollable Tabs Trigger Bar */}
            <div className="flex justify-start md:justify-center overflow-x-auto scrollbar-none pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
              <TabsList className="bg-[#0b0b0f] border border-zinc-900 p-1 rounded-2xl flex whitespace-nowrap">
                <TabsTrigger value="join-guide" className="px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider text-zinc-500 data-[state=active]:bg-zinc-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all">How to Connect</TabsTrigger>
                <TabsTrigger value="roadmap" className="px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider text-zinc-500 data-[state=active]:bg-zinc-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all">Roadmap & Forge</TabsTrigger>
                <TabsTrigger value="specs" className="px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider text-zinc-500 data-[state=active]:bg-zinc-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all">Server Specs</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="join-guide" className="outline-none focus:ring-0">
              <Card className="bg-[#0b0b0f] border-zinc-900 shadow-2xl rounded-2xl p-6 md:p-8">
                <div className="pb-6">
                  <CardTitle className="text-lg sm:text-xl text-white font-black uppercase tracking-wider">Join Arcadia in 3 Easy Steps</CardTitle>
                  <CardDescription className="text-zinc-550 font-bold text-xs mt-1">Setup is quick and we welcome all Java Edition users.</CardDescription>
                </div>
                
                {/* Desktop connection layout */}
                <div className="hidden md:grid grid-cols-3 gap-8">
                  <div className="space-y-3 p-5 rounded-2xl bg-[#050507] border border-zinc-950 hover:border-zinc-800/80 transition-all duration-300">
                    <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800/60 text-white flex items-center justify-center font-extrabold text-xs">1</div>
                    <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">Launch Java Edition</h4>
                    <p className="text-xs text-zinc-500 font-semibold leading-relaxed">Open your Minecraft Launcher and start the game on version 1.20.4 or higher (or 1.21.x).</p>
                  </div>
                  <div className="space-y-3 p-5 rounded-2xl bg-[#050507] border border-zinc-950 hover:border-zinc-800/80 transition-all duration-300">
                    <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800/60 text-white flex items-center justify-center font-extrabold text-xs">2</div>
                    <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">Add Server Address</h4>
                    <p className="text-xs text-zinc-500 font-semibold leading-relaxed">Go to Multiplayer &gt; Add Server. Paste the server address: <span className="font-mono text-white bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded font-black">{serverIP}</span>.</p>
                  </div>
                  <div className="space-y-3 p-5 rounded-2xl bg-[#050507] border border-zinc-950 hover:border-zinc-800/80 transition-all duration-300">
                    <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800/60 text-white flex items-center justify-center font-extrabold text-xs">3</div>
                    <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">Create Character</h4>
                    <p className="text-xs text-zinc-500 font-semibold leading-relaxed">Spawn in, select your class, fill in your profile, and begin building your legacy in the realm.</p>
                  </div>
                </div>

                {/* Mobile connection layout */}
                <div className="md:hidden space-y-6 relative before:absolute before:left-7 before:top-4 before:bottom-4 before:w-[1px] before:bg-zinc-800">
                  <div className="flex gap-4 relative">
                    <div className="w-6.5 h-6.5 rounded-full bg-zinc-900 border border-zinc-800 text-white flex items-center justify-center font-black text-xs shrink-0 z-10">1</div>
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">Launch Java Edition</h4>
                      <p className="text-xs text-zinc-500 font-semibold leading-relaxed">Open your Minecraft Launcher and start the game on version 1.20.4 or higher (or 1.21.x).</p>
                    </div>
                  </div>
                  <div className="flex gap-4 relative">
                    <div className="w-6.5 h-6.5 rounded-full bg-zinc-900 border border-zinc-800 text-white flex items-center justify-center font-black text-xs shrink-0 z-10">2</div>
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">Add Server Address</h4>
                      <p className="text-xs text-zinc-500 font-semibold leading-relaxed">Go to Multiplayer &gt; Add Server. Paste the server address: <span className="font-mono text-white bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded font-black break-all">{serverIP}</span>.</p>
                    </div>
                  </div>
                  <div className="flex gap-4 relative">
                    <div className="w-6.5 h-6.5 rounded-full bg-zinc-900 border border-zinc-800 text-white flex items-center justify-center font-black text-xs shrink-0 z-10">3</div>
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">Create Character</h4>
                      <p className="text-xs text-zinc-500 font-semibold leading-relaxed">Spawn in, select your class, fill in your profile, and begin building your legacy in the realm.</p>
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="roadmap" className="outline-none focus:ring-0">
              <Card className="bg-[#0b0b0f] border-zinc-900 shadow-2xl rounded-2xl p-6 md:p-8">
                <div className="pb-6 flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <CardTitle className="text-lg sm:text-xl text-white font-black uppercase tracking-wider">Active Forge Developments</CardTitle>
                    <CardDescription className="text-zinc-550 font-bold text-xs mt-1">Track items currently in active development or completed by our coders.</CardDescription>
                  </div>
                  <Link href="/sign-up" className="text-[10px] text-zinc-400 hover:text-white transition-colors uppercase tracking-widest font-black flex items-center gap-1">
                    See backlog <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {developments?.slice(0, 4).map((dev) => (
                    <div key={dev.id} className="p-5 rounded-2xl bg-[#050507] border border-zinc-950 hover:border-zinc-800/80 transition-all flex flex-col justify-between space-y-4">
                      <div className="flex justify-between items-start gap-4">
                        <h5 className="font-extrabold text-xs text-white uppercase tracking-wider line-clamp-1">{dev.title}</h5>
                        <span className={`text-[8px] px-2.5 py-0.5 font-black rounded-full uppercase tracking-wider shrink-0 ${
                          dev.status === "completed" 
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : dev.status === "in_progress"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-zinc-800/80 text-zinc-400 border border-zinc-700/50"
                        }`}>
                          {dev.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 font-semibold line-clamp-2 leading-relaxed">{dev.description}</p>
                      {dev.progress !== null && dev.progress !== undefined && (
                        <div className="space-y-1.5 pt-2">
                          <div className="flex justify-between text-[9px] text-zinc-500 font-bold">
                            <span>Progress</span>
                            <span>{dev.progress}%</span>
                          </div>
                          <Progress value={dev.progress} className="h-1 bg-zinc-800" />
                        </div>
                      )}
                    </div>
                  ))}
                  {(!developments || developments.length === 0) && (
                    <div className="col-span-2 text-center py-8 text-xs text-zinc-600 font-bold">No roadmap items listed yet.</div>
                  )}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="specs" className="outline-none focus:ring-0">
              <Card className="bg-[#0b0b0f] border-zinc-900 shadow-2xl rounded-2xl p-6 md:p-8">
                <div className="pb-6">
                  <CardTitle className="text-lg sm:text-xl text-white font-black uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-5 h-5 text-white" /> Server Architecture Specs
                  </CardTitle>
                  <CardDescription className="text-zinc-550 font-bold text-xs mt-1">We host on premium hardware to guarantee lag-free gameplay and massive render distance.</CardDescription>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="p-5 bg-[#050507] border border-zinc-950 rounded-2xl hover:border-zinc-800/85 transition-all duration-300">
                    <Terminal className="w-5 h-5 mx-auto text-zinc-400 mb-3" />
                    <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">CPU</div>
                    <div className="text-xs font-extrabold text-white mt-2 line-clamp-2 leading-snug">{specsCpu}</div>
                  </div>
                  <div className="p-5 bg-[#050507] border border-zinc-950 rounded-2xl hover:border-zinc-800/85 transition-all duration-300">
                    <Users className="w-5 h-5 mx-auto text-zinc-400 mb-3" />
                    <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Memory</div>
                    <div className="text-xs font-extrabold text-white mt-2 line-clamp-2 leading-snug">{specsMemory}</div>
                  </div>
                  <div className="p-5 bg-[#050507] border border-zinc-950 rounded-2xl hover:border-zinc-800/85 transition-all duration-300">
                    <Layers className="w-5 h-5 mx-auto text-zinc-400 mb-3" />
                    <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Storage</div>
                    <div className="text-xs font-extrabold text-white mt-2 line-clamp-2 leading-snug">{specsStorage}</div>
                  </div>
                  <div className="p-5 bg-[#050507] border border-zinc-950 rounded-2xl hover:border-zinc-800/85 transition-all duration-300">
                    <Server className="w-5 h-5 mx-auto text-zinc-400 mb-3" />
                    <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Location</div>
                    <div className="text-xs font-extrabold text-white mt-2 line-clamp-2 leading-snug">{specsLocation}</div>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
