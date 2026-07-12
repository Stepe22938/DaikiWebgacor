import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useGetStats, useListDevelopments, useGetMe, customFetch } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
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
  ArrowRight
} from "lucide-react";

function RevealText({ text, delay = 0, className = "" }: { text: string; delay?: number; className?: string }) {
  const words = text.split(" ");
  return (
    <span className={className}>
      {words.map((word, wIdx) => (
        <span key={wIdx} className="inline-block overflow-hidden mr-[0.22em] pb-[0.05em] align-bottom">
          <span 
            className="reveal-word"
            style={{ animationDelay: `${delay + wIdx * 0.07}s` }}
          >
            {word}
          </span>
        </span>
      ))}
    </span>
  );
}

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
      <style>{`
        /* Global deep dark overrides */
        .home-container {
          background-color: #000000;
          color: #ffffff;
        }

        /* Floating motion animation */
        @keyframes floatOrnament {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px); }
        }
        .animate-float-ornament {
          animation: floatOrnament 8s ease-in-out infinite;
        }

        /* Letter reveal animation */
        @keyframes slideUpReveal {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .reveal-word {
          display: inline-block;
          transform: translateY(100%);
          animation: slideUpReveal 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        /* Ambient background glow points */
        .bg-glow-orange {
          background: radial-gradient(circle, rgba(237, 115, 26, 0.07) 0%, rgba(237, 115, 26, 0.01) 50%, transparent 100%);
        }
        .bg-glow-red {
          background: radial-gradient(circle, rgba(254, 0, 4, 0.06) 0%, rgba(130, 3, 5, 0.005) 60%, transparent 100%);
        }
        .bg-glow-purple {
          background: radial-gradient(circle, rgba(99, 102, 241, 0.05) 0%, rgba(99, 102, 241, 0.005) 50%, transparent 100%);
        }

        /* Interactive Premium Akis Cards */
        .akis-card {
          position: relative;
          background: rgba(10, 10, 13, 0.4);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.03);
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .akis-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 0% 0%, rgba(237, 115, 26, 0.07) 0%, rgba(254, 0, 4, 0.03) 30%, transparent 60%);
          opacity: 0;
          transition: opacity 0.5s ease;
          z-index: 0;
          pointer-events: none;
        }
        .akis-card:hover {
          border-color: rgba(237, 115, 26, 0.18);
          transform: translateY(-3px);
          box-shadow: 0 12px 30px rgba(0,0,0,0.5);
        }
        .akis-card:hover::before {
          opacity: 1;
        }
        
        .akis-tag {
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.25em;
          color: #ed731a;
        }
      `}</style>

      <div className="home-container relative overflow-x-hidden min-h-screen">
        
        {/* Ambient Lights */}
        <div className="absolute top-[5%] right-[-10%] w-[60vw] h-[60vw] bg-glow-orange pointer-events-none" />
        <div className="absolute top-[35%] left-[-15%] w-[50vw] h-[50vw] bg-glow-red pointer-events-none" />
        <div className="absolute bottom-[10%] right-[-5%] w-[45vw] h-[45vw] bg-glow-purple pointer-events-none" />
        
        {/* Hero Section */}
        <section id="home" className="relative pt-20 pb-16 md:pt-32 md:pb-24 min-h-[92vh] flex items-center justify-center">
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff01_1px,transparent_1px),linear-gradient(to_bottom,#ffffff01_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none" />
          
          <div className="container mx-auto px-4 max-w-5xl relative z-10 grid md:grid-cols-12 gap-12 items-center">
            {/* Left Column: Text Content */}
            <div className="md:col-span-7 space-y-6 text-left">
              {/* Season Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-950/60 border border-zinc-900 text-zinc-400 font-extrabold text-[9px] tracking-[0.2em] uppercase">
                <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
                Season II: Rise of the Guilds
              </div>

              {/* Title */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-none text-white text-pretty uppercase">
                <RevealText text="A server that keeps up with your" delay={0.15} /> <span className="text-[#ed731a] inline-block overflow-hidden pb-[0.05em] align-bottom"><span className="reveal-word" style={{ animationDelay: `${0.15 + 7 * 0.07}s` }}>ambition.</span></span>
              </h1>

              {/* Subtitle */}
              <p className="text-sm text-zinc-400 font-medium leading-relaxed max-w-lg text-pretty">
                <RevealText text="Arcadia is a high-performance Minecraft Roleplay server. We forge visual systems, custom currencies, guild systems, and immersive voice communications." delay={0.7} />
              </p>

              {/* Play Address Copier */}
              <div className="max-w-md space-y-3 pt-2">
                <div className="flex items-center gap-2 bg-[#09090c]/80 border border-zinc-900/60 rounded-xl p-1.5 shadow-xl">
                  <div className="flex items-center gap-2.5 flex-1 px-3.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <div>
                      <p className="text-[8px] text-zinc-500 uppercase font-black tracking-widest">SERVER IP</p>
                      <p className="text-xs font-mono font-bold text-zinc-300">{serverIP}</p>
                    </div>
                  </div>

                  <Button 
                    size="sm" 
                    onClick={handleCopyIP} 
                    className={`h-9 px-4 font-black transition-all rounded-lg text-[9px] uppercase tracking-widest ${
                      copied 
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20" 
                        : "bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/80 text-zinc-300"
                    }`}
                  >
                    {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    {copied ? "Copied" : "Copy IP"}
                  </Button>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button size="lg" asChild className="w-full h-11 text-xs font-black uppercase tracking-widest bg-white text-black hover:bg-zinc-200 transition-all rounded-lg shadow-lg border border-white/5">
                    <Link href={user ? "/member" : "/sign-up"} className="flex items-center justify-center gap-1.5">
                      {user ? "Open Player Hub" : "Begin Journey"} <ArrowUpRight className="w-4.5 h-4.5" />
                    </Link>
                  </Button>
                </div>
              </div>

              <p className="text-[9px] text-zinc-600 tracking-wider font-extrabold uppercase">
                COMPATIBLE WITH JAVA {mcVersion} • LAUNCHER REQUIRED
              </p>
            </div>

            {/* Right Column: Premium Custom Rotating Crystalline vector ornament */}
            <div className="md:col-span-5 flex items-center justify-center relative">
              <div className="animate-float-ornament w-full flex items-center justify-center">
                
                {/* 3D Spin Orbit Component */}
                <div className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center select-none pointer-events-none">
                  {/* Backdrop Glow */}
                  <div className="absolute w-56 h-56 rounded-full bg-gradient-to-tr from-[#ed731a]/10 via-[#fe0004]/5 to-transparent blur-3xl" />
                  <div className="absolute w-40 h-40 rounded-full bg-[#ed731a]/20 blur-2xl animate-pulse" />

                  {/* Outer Spinning Ring */}
                  <svg 
                    className="absolute w-full h-full animate-[spin_28s_linear_infinite] text-[#ed731a]/60" 
                    viewBox="0 0 100 100" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 6" />
                    <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="0.2" />
                    <path d="M50 2 L50 6 M50 94 L50 98 M2 50 L6 50 M94 50 L98 50" stroke="currentColor" strokeWidth="0.75" />
                  </svg>

                  {/* Middle Counter-Spinning Ring */}
                  <svg 
                    className="absolute w-[80%] h-[80%] animate-[spin_18s_linear_infinite_reverse] text-[#ff3b30]/75" 
                    viewBox="0 0 100 100" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="0.4" strokeDasharray="20 10 5 5" />
                    <circle cx="50" cy="6" r="1" fill="currentColor" />
                    <circle cx="50" cy="94" r="1" fill="currentColor" />
                    <circle cx="6" cy="50" r="1" fill="currentColor" />
                    <circle cx="94" cy="50" r="1" fill="currentColor" />
                  </svg>

                  {/* Inner Rotating Polygon / Crystalline Hexagon Monolith */}
                  <svg 
                    className="absolute w-[52%] h-[52%] animate-[spin_12s_linear_infinite] text-white/90" 
                    viewBox="0 0 100 100" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <polygon points="50,5 90,30 90,70 50,95 10,70 10,30" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
                    <polygon points="50,22 75,38 75,62 50,78 25,62 25,38" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" strokeLinejoin="round" />
                    <line x1="50" y1="5" x2="50" y2="22" stroke="currentColor" strokeWidth="0.75" />
                    <line x1="90" y1="30" x2="75" y2="38" stroke="currentColor" strokeWidth="0.75" />
                    <line x1="90" y1="70" x2="75" y2="62" stroke="currentColor" strokeWidth="0.75" />
                    <line x1="50" y1="95" x2="50" y2="78" stroke="currentColor" strokeWidth="0.75" />
                    <line x1="10" y1="70" x2="25" y2="62" stroke="currentColor" strokeWidth="0.75" />
                    <line x1="10" y1="30" x2="25" y2="38" stroke="currentColor" strokeWidth="0.75" />
                    <circle cx="50" cy="50" r="4.5" fill="#ed731a" />
                  </svg>
                </div>

              </div>
            </div>
          </div>
        </section>

        {/* Dynamic Server Metrics Grid (Floating Overlapped) */}
        {stats && (
          <div className="relative z-20 max-w-5xl mx-auto px-4 -mt-10 mb-10">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-6 rounded-2xl bg-zinc-950/40 backdrop-blur-md border border-zinc-900 shadow-xl hover:border-zinc-800 transition-colors flex flex-col justify-between h-28">
                <div className="text-2xl sm:text-3xl font-black text-white">{stats.totalMembers}</div>
                <div className="text-[8px] text-zinc-500 uppercase font-black tracking-widest mt-2">Active Citizens</div>
              </div>
              <div className="p-6 rounded-2xl bg-zinc-950/40 backdrop-blur-md border border-zinc-900 shadow-xl hover:border-zinc-800 transition-colors flex flex-col justify-between h-28">
                <div className="text-2xl sm:text-3xl font-black text-white">{stats.totalDevelopments}</div>
                <div className="text-[8px] text-zinc-500 uppercase font-black tracking-widest mt-2">Unique Features</div>
              </div>
              <div className="p-6 rounded-2xl bg-zinc-950/40 backdrop-blur-md border border-zinc-900 shadow-xl hover:border-zinc-800 transition-colors flex flex-col justify-between h-28">
                <div className="text-2xl sm:text-3xl font-black text-white">{stats.completedDevelopments}</div>
                <div className="text-[8px] text-zinc-500 uppercase font-black tracking-widest mt-2">Completed Items</div>
              </div>
              <div className="p-6 rounded-2xl bg-zinc-950/40 backdrop-blur-md border border-zinc-900 shadow-xl hover:border-zinc-800 transition-colors flex flex-col justify-between h-28">
                <div className="text-2xl sm:text-3xl font-black text-white">{stats.totalAnnouncements}</div>
                <div className="text-[8px] text-zinc-500 uppercase font-black tracking-widest mt-2">Lore Releases</div>
              </div>
            </div>
          </div>
        )}

        {/* Philosophy / About Section (Akis style) */}
        <section className="w-full max-w-5xl mx-auto px-4 py-20 md:py-28 grid md:grid-cols-12 gap-8 items-start relative z-10">
          <div className="md:col-span-12">
            <span className="akis-tag block mb-4">About the Studio</span>
          </div>
          <div className="md:col-span-6 space-y-6">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight uppercase">
              <RevealText text="An approach built on one belief." delay={0.1} />
            </h2>
            <div className="pt-2">
              <Link href="/about" className="text-xs font-bold text-zinc-400 hover:text-white transition-colors inline-flex items-center gap-1.5 group">
                Discover the studio <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
          <div className="md:col-span-6 text-zinc-400 text-sm leading-relaxed font-medium">
            <p>
              Arcadia Studio was founded on a simple idea: your digital representation and gameplay choices should reflect who you actually are. That's been our driving force since day one, and it shapes every feature, quest, and custom line of code we build.
            </p>
          </div>
        </section>

        {/* Services / Features Section (Akis style Glassmorphism grid) */}
        <section id="features" className="py-20 md:py-28 relative z-10 max-w-5xl mx-auto px-4 scroll-mt-20">
          <div className="flex flex-col items-center text-center mb-16 space-y-4">
            <span className="akis-tag">Features</span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white uppercase">
              <RevealText text="From strategy to launch" delay={0.1} />
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Feature 01 */}
            <div className="akis-card p-6 md:p-8 flex flex-col justify-between min-h-[180px]">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-zinc-650">01</span>
                <Shield className="w-5 h-5 text-[#ed731a]" />
              </div>
              <div className="mt-8 space-y-2 relative z-10">
                <h3 className="text-lg font-black text-white uppercase tracking-wider">Kingdoms & Lore</h3>
                <p className="text-xs text-zinc-400 font-semibold leading-relaxed">
                  Create a town, forge a guild, register political factions, and engage in land claims, castle sieges, and live seasonal lore.
                </p>
              </div>
            </div>

            {/* Feature 02 */}
            <div className="akis-card p-6 md:p-8 flex flex-col justify-between min-h-[180px]">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-zinc-650">02</span>
                <Coins className="w-5 h-5 text-[#ed731a]" />
              </div>
              <div className="mt-8 space-y-2 relative z-10">
                <h3 className="text-lg font-black text-white uppercase tracking-wider">Dynamic Economy</h3>
                <p className="text-xs text-zinc-400 font-semibold leading-relaxed">
                  A fully player-run market with item trading, custom bank accounts, shop rentals, trade treaties, and gold-backed currency.
                </p>
              </div>
            </div>

            {/* Feature 03 */}
            <div className="akis-card p-6 md:p-8 flex flex-col justify-between min-h-[180px]">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-zinc-650">03</span>
                <Gamepad2 className="w-5 h-5 text-[#ed731a]" />
              </div>
              <div className="mt-8 space-y-2 relative z-10">
                <h3 className="text-lg font-black text-white uppercase tracking-wider">Custom RPG</h3>
                <p className="text-xs text-zinc-400 font-semibold leading-relaxed">
                  Unlock RPG level gains, special character stats, crafting recipes, custom block models, and magic attributes.
                </p>
              </div>
            </div>

            {/* Feature 04 */}
            <div className="akis-card p-6 md:p-8 flex flex-col justify-between min-h-[180px]">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-zinc-650">04</span>
                <MessageSquare className="w-5 h-5 text-[#ed731a]" />
              </div>
              <div className="mt-8 space-y-2 relative z-10">
                <h3 className="text-lg font-black text-white uppercase tracking-wider">WhatsApp Business</h3>
                <p className="text-xs text-zinc-400 font-semibold leading-relaxed">
                  Start audio calls, video calls, direct messages, and trade products through your own business dashboard on the web.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Gallery Section */}
        <section id="gallery" className="py-20 md:py-28 max-w-5xl mx-auto px-4 relative z-10 scroll-mt-20">
          <div className="flex flex-col items-center text-center mb-16 space-y-4">
            <span className="akis-tag">Projects & Realms</span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white uppercase flex items-center gap-3">
              <span>{galleryTitle}</span>
              {(user?.role === "admin" || user?.role === "dev_website") && (
                <Link href="/admin?tab=gallery" className="inline-flex items-center justify-center p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors" title="Edit Gallery Section">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </Link>
              )}
            </h2>
            <p className="text-zinc-500 font-medium text-xs sm:text-sm max-w-xl">{gallerySubtitle}</p>
          </div>

          {/* DESKTOP GALLERY GRID */}
          <div className="hidden lg:grid grid-cols-5 gap-8 items-center">
            {/* Gallery Navigation and Text */}
            <div className="col-span-2 space-y-3">
              {galleryImages.map((img: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setActiveGallery(idx)}
                  className={`w-full text-left p-5 rounded-xl border transition-all duration-300 ${
                    activeGalleryIndex === idx
                      ? "bg-zinc-950/60 border-zinc-800 text-white shadow-xl translate-x-2"
                      : "bg-transparent border-transparent hover:bg-zinc-950/20 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${activeGalleryIndex === idx ? "bg-[#ed731a] scale-125" : "bg-zinc-800"}`} />
                    {img.title}
                  </h3>
                  <p className="text-xs mt-2 leading-relaxed font-semibold opacity-70">
                    {img.description}
                  </p>
                </button>
              ))}
            </div>

            {/* Display Viewport */}
            <div className="col-span-3">
              <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-zinc-900 bg-zinc-950 shadow-2xl">
                {galleryImages[activeGalleryIndex] && (
                  <img
                    src={galleryImages[activeGalleryIndex].src}
                    alt={galleryImages[activeGalleryIndex].title}
                    className="w-full h-full object-cover transition-all duration-500"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-4 left-4 flex items-center">
                  <span className="text-[8px] font-black px-2.5 py-1 rounded bg-zinc-950/90 border border-zinc-900 text-zinc-300 uppercase tracking-widest">
                    In-Game Live Capture
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* MOBILE GALLERY VIEWPORT */}
          <div className="block lg:hidden space-y-5">
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-zinc-900 bg-zinc-950 shadow-lg">
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
            <div className="bg-[#09090c] p-5 rounded-xl border border-zinc-900 text-center space-y-2">
              <h3 className="font-bold text-sm text-white">
                {galleryImages[activeGalleryIndex]?.title}
              </h3>
              <p className="text-xs text-zinc-500 font-semibold leading-relaxed">
                {galleryImages[activeGalleryIndex]?.description}
              </p>
              
              <div className="flex justify-center gap-1.5 pt-2">
                {galleryImages.map((_: any, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setActiveGallery(idx)}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      activeGalleryIndex === idx ? "w-4 bg-[#ed731a]" : "w-1 bg-zinc-850"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Tabs Deep-Dive: Connect, Roadmap, Specs */}
        <section id="roadmap" className="py-20 md:py-28 max-w-5xl mx-auto px-4 relative z-10 scroll-mt-20">
          <Tabs defaultValue="join-guide" className="space-y-8">
            <div className="flex justify-center overflow-x-auto pb-2">
              <TabsList className="bg-[#09090c] border border-zinc-900 p-1.5 rounded-xl flex whitespace-nowrap">
                <TabsTrigger value="join-guide" className="px-5 py-2 rounded-lg font-black text-[10px] uppercase tracking-wider text-zinc-500 data-[state=active]:bg-zinc-900 data-[state=active]:text-white transition-all">How to Connect</TabsTrigger>
                <TabsTrigger value="roadmap" className="px-5 py-2 rounded-lg font-black text-[10px] uppercase tracking-wider text-zinc-500 data-[state=active]:bg-zinc-900 data-[state=active]:text-white transition-all">Roadmap & Forge</TabsTrigger>
                <TabsTrigger value="specs" className="px-5 py-2 rounded-lg font-black text-[10px] uppercase tracking-wider text-zinc-500 data-[state=active]:bg-zinc-900 data-[state=active]:text-white transition-all">Server Specs</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="join-guide" className="outline-none">
              <Card className="bg-[#09090c]/80 border-zinc-900 shadow-2xl rounded-2xl p-6 md:p-8">
                <div className="pb-6">
                  <h3 className="text-lg text-white font-black uppercase tracking-wider">Join Arcadia in 3 Easy Steps</h3>
                  <p className="text-zinc-500 font-bold text-xs mt-1">Setup is quick and we welcome all Java Edition users.</p>
                </div>
                
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-3 p-5 rounded-xl bg-black border border-zinc-950 hover:border-zinc-800 transition-all">
                    <div className="w-8 h-8 rounded-full bg-zinc-950 border border-zinc-900 text-white flex items-center justify-center font-extrabold text-xs">1</div>
                    <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">Launch Java Edition</h4>
                    <p className="text-xs text-zinc-500 font-semibold leading-relaxed">Open your Minecraft Launcher and start the game on version 1.20.4 or higher.</p>
                  </div>
                  <div className="space-y-3 p-5 rounded-xl bg-black border border-zinc-950 hover:border-zinc-800 transition-all">
                    <div className="w-8 h-8 rounded-full bg-zinc-950 border border-zinc-900 text-white flex items-center justify-center font-extrabold text-xs">2</div>
                    <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">Add Server Address</h4>
                    <p className="text-xs text-zinc-500 font-semibold leading-relaxed">Go to Multiplayer &gt; Add Server. Paste: <span className="font-mono text-[#ed731a] bg-zinc-950 border border-zinc-900 px-1.5 py-0.5 rounded font-black">{serverIP}</span>.</p>
                  </div>
                  <div className="space-y-3 p-5 rounded-xl bg-black border border-zinc-950 hover:border-zinc-800 transition-all">
                    <div className="w-8 h-8 rounded-full bg-zinc-950 border border-zinc-900 text-white flex items-center justify-center font-extrabold text-xs">3</div>
                    <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">Create Character</h4>
                    <p className="text-xs text-zinc-500 font-semibold leading-relaxed">Spawn in, select your class, fill in your profile, and begin building your legacy in the realm.</p>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="roadmap" className="outline-none">
              <Card className="bg-[#09090c]/80 border-zinc-900 shadow-2xl rounded-2xl p-6 md:p-8">
                <div className="pb-6 flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="text-lg text-white font-black uppercase tracking-wider">Active Forge Developments</h3>
                    <p className="text-zinc-550 font-bold text-xs mt-1">Track items currently in active development or completed by our developers.</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {developments?.slice(0, 4).map((dev) => (
                    <div key={dev.id} className="p-5 rounded-xl bg-black border border-zinc-950 hover:border-zinc-800 transition-all flex flex-col justify-between space-y-4">
                      <div className="flex justify-between items-start gap-4">
                        <h5 className="font-extrabold text-xs text-white uppercase tracking-wider line-clamp-1">{dev.title}</h5>
                        <span className={`text-[8px] px-2.5 py-0.5 font-black rounded-full uppercase tracking-wider shrink-0 ${
                          dev.status === "completed" 
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : dev.status === "in_progress"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-zinc-900 text-zinc-400 border border-zinc-800"
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
                          <Progress value={dev.progress} className="h-1 bg-zinc-900" />
                        </div>
                      )}
                    </div>
                  ))}
                  {(!developments || developments.length === 0) && (
                    <div className="col-span-2 text-center py-8 text-xs text-zinc-650 font-bold">No backlog items listed yet.</div>
                  )}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="specs" className="outline-none">
              <Card className="bg-[#09090c]/80 border-zinc-900 shadow-2xl rounded-2xl p-6 md:p-8">
                <div className="pb-6">
                  <h3 className="text-lg text-white font-black uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-5 h-5 text-[#ed731a]" /> Server Architecture Specs
                  </h3>
                  <p className="text-zinc-550 font-bold text-xs mt-1">We host on premium hardware to guarantee lag-free gameplay and massive render distance.</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="p-5 bg-black border border-zinc-950 rounded-xl hover:border-zinc-800 transition-all">
                    <Terminal className="w-5 h-5 mx-auto text-[#ed731a] mb-3" />
                    <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">CPU</div>
                    <div className="text-xs font-extrabold text-white mt-2 line-clamp-2 leading-snug">{specsCpu}</div>
                  </div>
                  <div className="p-5 bg-black border border-zinc-950 rounded-xl hover:border-zinc-800 transition-all">
                    <Users className="w-5 h-5 mx-auto text-[#ed731a] mb-3" />
                    <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Memory</div>
                    <div className="text-xs font-extrabold text-white mt-2 line-clamp-2 leading-snug">{specsMemory}</div>
                  </div>
                  <div className="p-5 bg-black border border-zinc-950 rounded-xl hover:border-zinc-800 transition-all">
                    <Layers className="w-5 h-5 mx-auto text-[#ed731a] mb-3" />
                    <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Storage</div>
                    <div className="text-xs font-extrabold text-white mt-2 line-clamp-2 leading-snug">{specsStorage}</div>
                  </div>
                  <div className="p-5 bg-black border border-zinc-950 rounded-xl hover:border-zinc-800 transition-all">
                    <Server className="w-5 h-5 mx-auto text-[#ed731a] mb-3" />
                    <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Location</div>
                    <div className="text-xs font-extrabold text-white mt-2 line-clamp-2 leading-snug">{specsLocation}</div>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </Layout>
  );
}
