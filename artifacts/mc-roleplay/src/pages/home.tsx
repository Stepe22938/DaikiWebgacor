import { useState } from "react";
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
  Sparkles
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

  const serverIP = settings.serverIP || "play.arcadiamc.net";
  const heroTitle = settings.heroTitle || "Forge Your Legend in Arcadia";
  const heroSubtitle = settings.heroSubtitle || "Step into an immersive, highly customized Minecraft roleplay and RPG experience. Build nations, command economies, and fight dungeons alongside fellow adventurers.";
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
      {/* HERO SECTION: Deep Premium Dark RPG Theme */}
      <div className="relative overflow-hidden bg-[#070709] text-white border-b border-zinc-900/80 min-h-[85vh] flex items-center justify-center">
        {/* Background visual art components */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(99,102,241,0.15)_0%,_transparent_65%)] pointer-events-none" />
        <div className="absolute top-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-violet-600/10 blur-[150px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none" />
        
        {/* Sleek retro sci-fi cyber tech lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:30px_30px] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_transparent_20%,#070709_80%)] pointer-events-none" />

        <div className="container mx-auto px-4 py-20 md:py-28 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-6 md:space-y-8">
            {/* Season Badge with subtle breathing glow */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-violet-500/20 text-[10px] sm:text-xs text-violet-200 font-bold tracking-widest uppercase animate-pulse shadow-[0_0_20px_rgba(139,92,246,0.15)]">
              <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
              Season II: Rise of the Guilds
            </div>

            {/* Main Title - Responsive & Highly Styled */}
            <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight text-white leading-[1.05] break-words px-2 select-none">
              {heroTitle.includes("Arcadia") ? (
                <>
                  {heroTitle.split("Arcadia")[0]}
                  <span className="bg-gradient-to-r from-[#818cf8] via-[#c084fc] to-[#fbbf24] bg-clip-text text-transparent drop-shadow-[0_2px_15px_rgba(129,140,248,0.25)]">Arcadia</span>
                  {heroTitle.split("Arcadia")[1]}
                </>
              ) : (
                heroTitle
              )}
            </h1>

            {/* Subtext description */}
            <p className="text-xs sm:text-sm md:text-base text-zinc-400 max-w-2xl mx-auto leading-relaxed font-semibold px-4">
              {heroSubtitle}
            </p>

            {/* RPG Style Launcher Connection Panel */}
            <div className="pt-4 max-w-lg mx-auto space-y-4 px-4">
              <div className="flex flex-col sm:flex-row items-center gap-3 bg-zinc-950/70 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-2.5 shadow-2xl transition-all duration-300 hover:border-violet-500/40">
                {/* Server Status Indicators & Info */}
                <div className="flex items-center gap-3 flex-1 px-3 py-2 sm:py-0 w-full justify-between sm:justify-start">
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    <div className="text-left">
                      <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">SERVER IP ADDRESS</p>
                      <p className="text-sm font-mono font-bold text-zinc-200 tracking-wide">{serverIP}</p>
                    </div>
                  </div>

                  {stats && (
                    <div className="sm:ml-auto text-right text-[10px] text-zinc-400 font-extrabold bg-zinc-900/80 border border-zinc-800 px-2.5 py-1 rounded-lg">
                      <span className="text-emerald-400 font-black">{stats.totalMembers + 14}</span> Online
                    </div>
                  )}
                </div>

                {/* Interactive Copy Trigger Button */}
                <Button 
                  size="sm" 
                  onClick={handleCopyIP} 
                  className={`w-full sm:w-auto h-10 px-4 font-black transition-all rounded-xl select-none flex items-center justify-center gap-1.5 ${
                    copied 
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20" 
                      : "bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white"
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" /> Copy IP
                    </>
                  )}
                </Button>
              </div>

              {/* Launcher Play Button */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button size="lg" asChild className="w-full h-12 text-sm font-extrabold bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 hover:scale-[1.02] active:scale-[0.98] transition-all rounded-xl shadow-xl shadow-indigo-600/10 border border-violet-400/20">
                  <Link href="/sign-up" className="flex items-center justify-center gap-1.5">
                    Begin Journey <ChevronRight className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Version check with mini specs bullet */}
            <p className="text-[10px] sm:text-xs text-zinc-500 tracking-wide">
              Compatible with Java <span className="text-zinc-300 font-bold">{mcVersion}</span> • Requires launcher log-in to connect
            </p>
          </div>
        </div>
      </div>

      {/* BODY SECTIONS: Premium Light Theme with Clean Lavender Hues */}
      <div className="bg-[#f7f6f9] text-[#1e1b4b] relative pb-16">
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e4e2f0_1px,transparent_1px),linear-gradient(to_bottom,#e4e2f0_1px,transparent_1px)] bg-[size:40px_40px] opacity-[0.22] pointer-events-none" />

        {/* 1. Dynamic Server Metrics Section - Premium Overlapping Design */}
        {stats && (
          <div className="relative z-20 -mt-10 max-w-4xl mx-auto px-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 sm:p-6 rounded-2xl bg-white/95 backdrop-blur-md border border-white/60 shadow-lg shadow-[#5a567a]/4 hover:translate-y-[-4px] hover:border-violet-300 transition-all duration-300 flex flex-col justify-between">
                <div className="text-2xl sm:text-3xl font-black text-[#6366f1]">{stats.totalMembers}</div>
                <div className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-black tracking-widest mt-2">Active Citizens</div>
              </div>
              <div className="p-5 sm:p-6 rounded-2xl bg-white/95 backdrop-blur-md border border-white/60 shadow-lg shadow-[#5a567a]/4 hover:translate-y-[-4px] hover:border-violet-300 transition-all duration-300 flex flex-col justify-between">
                <div className="text-2xl sm:text-3xl font-black text-[#6366f1]">{stats.totalDevelopments}</div>
                <div className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-black tracking-widest mt-2">Unique Features</div>
              </div>
              <div className="p-5 sm:p-6 rounded-2xl bg-white/95 backdrop-blur-md border border-white/60 shadow-lg shadow-[#5a567a]/4 hover:translate-y-[-4px] hover:border-violet-300 transition-all duration-300 flex flex-col justify-between">
                <div className="text-2xl sm:text-3xl font-black text-[#6366f1]">{stats.completedDevelopments}</div>
                <div className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-black tracking-widest mt-2">Completed Items</div>
              </div>
              <div className="p-5 sm:p-6 rounded-2xl bg-white/95 backdrop-blur-md border border-white/60 shadow-lg shadow-[#5a567a]/4 hover:translate-y-[-4px] hover:border-violet-300 transition-all duration-300 flex flex-col justify-between">
                <div className="text-2xl sm:text-3xl font-black text-[#6366f1]">{stats.totalAnnouncements}</div>
                <div className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-black tracking-widest mt-2">Lore Releases</div>
              </div>
            </div>
          </div>
        )}
        {/* 2. Interactive Server Visual Gallery */}
        <div className="py-20 md:py-28 max-w-6xl mx-auto px-4 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16 space-y-3">
            <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-violet-100 text-[#6366f1] font-bold text-[10px] uppercase tracking-widest">
              Gallery
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#110e3d] tracking-tight flex items-center justify-center gap-3">
              <span>{galleryTitle}</span>
              {(user?.role === "admin" || user?.role === "dev_website") && (
                <Link href="/admin?tab=gallery" className="inline-flex items-center justify-center p-1.5 rounded-lg bg-violet-100 border border-violet-200 text-[#6366f1] hover:bg-violet-200 transition-all hover:scale-105 active:scale-95" title="Edit Gallery Section">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </Link>
              )}
            </h2>
            <p className="text-slate-500 font-medium text-xs sm:text-sm md:text-base">{gallerySubtitle}</p>
          </div>

          {/* DESKTOP GALLERY GRID */}
          <div className="hidden lg:grid grid-cols-5 gap-8 items-center">
            {/* Gallery Navigation and Text */}
            <div className="col-span-2 space-y-4">
              {galleryImages.map((img: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setActiveGallery(idx)}
                  className={`w-full text-left p-5 rounded-2xl border transition-all duration-300 ${
                    activeGalleryIndex === idx
                      ? "bg-white border-[#6366f1] text-[#110e3d] shadow-lg shadow-[#5a567a]/8 translate-x-2"
                      : "bg-white/50 border-[#eae8f5] hover:bg-white text-slate-500 hover:text-[#110e3d]"
                  }`}
                >
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${activeGalleryIndex === idx ? "bg-[#6366f1]" : "bg-slate-300"}`} />
                    {img.title}
                  </h3>
                  <p className="text-xs mt-2 leading-relaxed font-medium opacity-85">
                    {img.description}
                  </p>
                </button>
              ))}
            </div>

            {/* Display Viewport */}
            <div className="col-span-3">
              <div className="relative aspect-video w-full rounded-2xl overflow-hidden border-4 border-white shadow-2xl shadow-[#5a567a]/15 bg-white">
                {galleryImages[activeGalleryIndex] && (
                  <img
                    src={galleryImages[activeGalleryIndex].src}
                    alt={galleryImages[activeGalleryIndex].title}
                    className="w-full h-full object-cover animate-fade-in transition-all duration-500"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
                  <span className="text-[10px] font-extrabold px-3 py-1 rounded bg-[#6366f1] text-white uppercase tracking-wider shadow-md">
                    In-Game Live Capture
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* MOBILE CAROUSEL VIEWPORT */}
          <div className="block lg:hidden space-y-5">
            <div className="relative aspect-[4/3] sm:aspect-video w-full rounded-2xl overflow-hidden border-2 border-white shadow-lg bg-white">
              {galleryImages[activeGalleryIndex] && (
                <img
                  src={galleryImages[activeGalleryIndex].src}
                  alt={galleryImages[activeGalleryIndex].title}
                  className="w-full h-full object-cover transition-all duration-300"
                />
              )}
              
              {/* Carousel Navigation Chevron Overlays */}
              <button 
                onClick={() => {
                  const prevIdx = activeGalleryIndex === 0 ? galleryImages.length - 1 : activeGalleryIndex - 1;
                  setActiveGallery(prevIdx);
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/60 active:scale-95 transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={() => {
                  const nextIdx = activeGalleryIndex === galleryImages.length - 1 ? 0 : activeGalleryIndex + 1;
                  setActiveGallery(nextIdx);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/60 active:scale-95 transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-md px-2 py-0.5 rounded text-[8px] font-bold text-white uppercase tracking-widest">
                Slide {activeGalleryIndex + 1} of {galleryImages.length}
              </div>
            </div>

            {/* Active text summary container */}
            <div className="bg-white p-5 rounded-2xl border border-[#eae8f5] shadow-md shadow-[#5a567a]/3 text-center space-y-2">
              <h3 className="font-extrabold text-base text-[#110e3d]">
                {galleryImages[activeGalleryIndex]?.title}
              </h3>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                {galleryImages[activeGalleryIndex]?.description}
              </p>
              
              {/* Interactive slider dots indicators */}
              <div className="flex justify-center gap-1.5 pt-2">
                {galleryImages.map((_: any, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setActiveGallery(idx)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      activeGalleryIndex === idx ? "w-5 bg-[#6366f1]" : "w-1.5 bg-slate-300"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>        {/* 3. Showcase Features Section */}
        <div className="py-20 md:py-28 bg-white border-y border-[#eae8f5]">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
              <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-violet-100 text-[#6366f1] font-bold text-[10px] uppercase tracking-widest">
                Features
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-[#110e3d] tracking-tight">Everything You Need For Immersive Play</h2>
              <p className="text-slate-500 font-medium text-xs sm:text-sm md:text-base">We run on custom-designed software integrations and custom configurations to bring features unmatched elsewhere.</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-[#f7f6f9] border-[#eae8f5] hover:border-[#6366f1]/50 hover:bg-white hover:shadow-2xl hover:shadow-indigo-500/5 hover:-translate-y-1.5 transition-all duration-300 rounded-2xl group">
                <CardHeader className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-violet-100/50 group-hover:bg-[#6366f1] group-hover:text-white flex items-center justify-center text-[#6366f1] transition-all duration-300">
                    <Shield className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-base sm:text-lg font-extrabold text-[#110e3d]">Kingdoms & Lore</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                    Create a town, forge a guild, register political factions, and engage in land claims, castle sieges, and live seasonal lore.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-[#f7f6f9] border-[#eae8f5] hover:border-[#6366f1]/50 hover:bg-white hover:shadow-2xl hover:shadow-indigo-500/5 hover:-translate-y-1.5 transition-all duration-300 rounded-2xl group">
                <CardHeader className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-violet-100/50 group-hover:bg-[#6366f1] group-hover:text-white flex items-center justify-center text-[#6366f1] transition-all duration-300">
                    <Coins className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-base sm:text-lg font-extrabold text-[#110e3d]">Dynamic Economy</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                    A fully player-run market with item trading, custom bank accounts, shop rentals, trade treaties, and gold-backed currency.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-[#f7f6f9] border-[#eae8f5] hover:border-[#6366f1]/50 hover:bg-white hover:shadow-2xl hover:shadow-indigo-500/5 hover:-translate-y-1.5 transition-all duration-300 rounded-2xl group">
                <CardHeader className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-violet-100/50 group-hover:bg-[#6366f1] group-hover:text-white flex items-center justify-center text-[#6366f1] transition-all duration-300">
                    <Gamepad2 className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-base sm:text-lg font-extrabold text-[#110e3d]">Custom Mechanics</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                    Unlock RPG level gains, special character stats, crafting recipes, custom block models, and magic attributes.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-[#f7f6f9] border-[#eae8f5] hover:border-[#6366f1]/50 hover:bg-white hover:shadow-2xl hover:shadow-indigo-500/5 hover:-translate-y-1.5 transition-all duration-300 rounded-2xl group">
                <CardHeader className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-violet-100/50 group-hover:bg-[#6366f1] group-hover:text-white flex items-center justify-center text-[#6366f1] transition-all duration-300">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-base sm:text-lg font-extrabold text-[#110e3d]">Integrated Comms</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                    Start audio calls, video calls, direct messages, and team groups directly on this dashboard. Seamlessly connect.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* 4. Tabs Deep-Dive: Specs, Joining, Roadmap */}
        <div className="py-20 md:py-28 max-w-5xl mx-auto px-4 relative z-10">
          <Tabs defaultValue="join-guide" className="space-y-8">
            {/* Scrollable Tabs Trigger Bar on Mobile */}
            <div className="flex justify-start md:justify-center overflow-x-auto scrollbar-none pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
              <TabsList className="bg-[#eae8f5] border border-[#d3d0e2] p-1 rounded-2xl flex whitespace-nowrap">
                <TabsTrigger value="join-guide" className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-slate-600 data-[state=active]:bg-white data-[state=active]:text-[#6366f1] data-[state=active]:shadow-md transition-all">How to Connect</TabsTrigger>
                <TabsTrigger value="roadmap" className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-slate-600 data-[state=active]:bg-white data-[state=active]:text-[#6366f1] data-[state=active]:shadow-md transition-all">Roadmap & Forge</TabsTrigger>
                <TabsTrigger value="specs" className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-slate-600 data-[state=active]:bg-white data-[state=active]:text-[#6366f1] data-[state=active]:shadow-md transition-all">Server Specs</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="join-guide" className="outline-none focus:ring-0">
              <Card className="bg-white border-[#eae8f5] shadow-xl shadow-[#5a567a]/4 rounded-2xl p-6 md:p-8">
                <div className="pb-6">
                  <CardTitle className="text-xl sm:text-2xl text-[#110e3d] font-black">Join Arcadia in 3 Easy Steps</CardTitle>
                  <CardDescription className="text-slate-500 font-semibold text-xs sm:text-sm mt-1">Setup is quick and we welcome all Java Edition users.</CardDescription>
                </div>
                
                {/* Desktop connection layout */}
                <div className="hidden md:grid grid-cols-3 gap-8">
                  <div className="space-y-3 p-5 rounded-2xl bg-[#f7f6f9] border border-slate-100 hover:border-violet-200 transition-all duration-300">
                    <div className="w-8 h-8 rounded-full bg-violet-100 text-[#6366f1] flex items-center justify-center font-extrabold text-sm">1</div>
                    <h4 className="font-extrabold text-[#110e3d] text-sm">Launch Java Edition</h4>
                    <p className="text-xs text-slate-500 font-semibold leading-relaxed">Open your Minecraft Launcher and start the game on version 1.20.4 or higher (or 1.21.x).</p>
                  </div>
                  <div className="space-y-3 p-5 rounded-2xl bg-[#f7f6f9] border border-slate-100 hover:border-violet-200 transition-all duration-300">
                    <div className="w-8 h-8 rounded-full bg-violet-100 text-[#6366f1] flex items-center justify-center font-extrabold text-sm">2</div>
                    <h4 className="font-extrabold text-[#110e3d] text-sm">Add Server Address</h4>
                    <p className="text-xs text-slate-500 font-semibold leading-relaxed">Go to Multiplayer &gt; Add Server. Paste the server address: <span className="font-mono text-[#6366f1] bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded font-black">{serverIP}</span>.</p>
                  </div>
                  <div className="space-y-3 p-5 rounded-2xl bg-[#f7f6f9] border border-slate-100 hover:border-violet-200 transition-all duration-300">
                    <div className="w-8 h-8 rounded-full bg-violet-100 text-[#6366f1] flex items-center justify-center font-extrabold text-sm">3</div>
                    <h4 className="font-extrabold text-[#110e3d] text-sm">Create Character</h4>
                    <p className="text-xs text-slate-500 font-semibold leading-relaxed">Spawn in, select your class, fill in your profile, and begin building your legacy in the realm.</p>
                  </div>
                </div>

                {/* Mobile connection layout (Vertical timeline style) */}
                <div className="md:hidden space-y-6 relative before:absolute before:left-7 before:top-4 before:bottom-4 before:w-[2px] before:bg-violet-100">
                  <div className="flex gap-4 relative">
                    <div className="w-6.5 h-6.5 rounded-full bg-[#6366f1] text-white flex items-center justify-center font-black text-xs shrink-0 z-10 shadow-md">1</div>
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-[#110e3d] text-sm">Launch Java Edition</h4>
                      <p className="text-xs text-slate-500 font-semibold leading-relaxed">Open your Minecraft Launcher and start the game on version 1.20.4 or higher (or 1.21.x).</p>
                    </div>
                  </div>
                  <div className="flex gap-4 relative">
                    <div className="w-6.5 h-6.5 rounded-full bg-[#6366f1] text-white flex items-center justify-center font-black text-xs shrink-0 z-10 shadow-md">2</div>
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-[#110e3d] text-sm">Add Server Address</h4>
                      <p className="text-xs text-slate-500 font-semibold leading-relaxed">Go to Multiplayer &gt; Add Server. Paste the server address: <span className="font-mono text-[#6366f1] bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded font-black break-all">{serverIP}</span>.</p>
                    </div>
                  </div>
                  <div className="flex gap-4 relative">
                    <div className="w-6.5 h-6.5 rounded-full bg-[#6366f1] text-white flex items-center justify-center font-black text-xs shrink-0 z-10 shadow-md">3</div>
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-[#110e3d] text-sm">Create Character</h4>
                      <p className="text-xs text-slate-500 font-semibold leading-relaxed">Spawn in, select your class, fill in your profile, and begin building your legacy in the realm.</p>
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="roadmap" className="outline-none focus:ring-0">
              <Card className="bg-white border-[#eae8f5] shadow-xl shadow-[#5a567a]/4 rounded-2xl p-6 md:p-8">
                <div className="pb-6 flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <CardTitle className="text-xl sm:text-2xl text-[#110e3d] font-black">Active Forge Developments</CardTitle>
                    <CardDescription className="text-slate-500 font-semibold text-xs sm:text-sm mt-1">Track items currently in active development or completed by our coders.</CardDescription>
                  </div>
                  <Link href="/sign-up" className="text-xs text-[#6366f1] hover:underline transition-all flex items-center gap-1 font-bold">
                    See full backlog <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {developments?.slice(0, 4).map((dev) => (
                    <div key={dev.id} className="p-5 rounded-2xl bg-[#f7f6f9] border border-slate-100 hover:border-violet-200 transition-all flex flex-col justify-between space-y-4">
                      <div className="flex justify-between items-start gap-4">
                        <h5 className="font-extrabold text-sm text-[#110e3d] line-clamp-1">{dev.title}</h5>
                        <span className={`text-[9px] px-2.5 py-0.5 font-black rounded-full uppercase tracking-wider shrink-0 ${
                          dev.status === "completed" 
                            ? "bg-emerald-100 text-emerald-700"
                            : dev.status === "in_progress"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {dev.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-semibold line-clamp-2 leading-relaxed">{dev.description}</p>
                      {dev.progress !== null && dev.progress !== undefined && (
                        <div className="space-y-1.5 pt-2">
                          <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                            <span>Progress</span>
                            <span>{dev.progress}%</span>
                          </div>
                          <Progress value={dev.progress} className="h-1.5 bg-slate-200" />
                        </div>
                      )}
                    </div>
                  ))}
                  {(!developments || developments.length === 0) && (
                    <div className="col-span-2 text-center py-8 text-xs text-slate-400 font-bold">No roadmap items listed yet.</div>
                  )}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="specs" className="outline-none focus:ring-0">
              <Card className="bg-white border-[#eae8f5] shadow-xl shadow-[#5a567a]/4 rounded-2xl p-6 md:p-8">
                <div className="pb-6">
                  <CardTitle className="text-xl sm:text-2xl text-[#110e3d] font-black flex items-center gap-2">
                    <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-[#6366f1]" /> Server Architecture Specs
                  </CardTitle>
                  <CardDescription className="text-slate-500 font-semibold text-xs sm:text-sm mt-1">We host on premium hardware to guarantee lag-free gameplay and massive render distance.</CardDescription>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="p-5 bg-[#f7f6f9] border border-slate-100 rounded-2xl hover:border-violet-200 hover:bg-white hover:shadow-lg hover:shadow-[#5a567a]/4 transition-all duration-300">
                    <Terminal className="w-6 h-6 mx-auto text-[#6366f1] mb-3" />
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CPU</div>
                    <div className="text-xs font-extrabold text-[#110e3d] mt-2 line-clamp-2 leading-snug">{specsCpu}</div>
                  </div>
                  <div className="p-5 bg-[#f7f6f9] border border-slate-100 rounded-2xl hover:border-violet-200 hover:bg-white hover:shadow-lg hover:shadow-[#5a567a]/4 transition-all duration-300">
                    <Users className="w-6 h-6 mx-auto text-[#6366f1] mb-3" />
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Memory</div>
                    <div className="text-xs font-extrabold text-[#110e3d] mt-2 line-clamp-2 leading-snug">{specsMemory}</div>
                  </div>
                  <div className="p-5 bg-[#f7f6f9] border border-slate-100 rounded-2xl hover:border-violet-200 hover:bg-white hover:shadow-lg hover:shadow-[#5a567a]/4 transition-all duration-300">
                    <Layers className="w-6 h-6 mx-auto text-[#6366f1] mb-3" />
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Storage</div>
                    <div className="text-xs font-extrabold text-[#110e3d] mt-2 line-clamp-2 leading-snug">{specsStorage}</div>
                  </div>
                  <div className="p-5 bg-[#f7f6f9] border border-slate-100 rounded-2xl hover:border-violet-200 hover:bg-white hover:shadow-lg hover:shadow-[#5a567a]/4 transition-all duration-300">
                    <Server className="w-6 h-6 mx-auto text-[#6366f1] mb-3" />
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</div>
                    <div className="text-xs font-extrabold text-[#110e3d] mt-2 line-clamp-2 leading-snug">{specsLocation}</div>
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
