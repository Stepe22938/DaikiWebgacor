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
      <div className="relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/15 via-background to-background pointer-events-none" />
        
        {/* Animated grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />

        <div className="container mx-auto px-4 py-20 md:py-28 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary font-medium tracking-wide animate-pulse">
              <Sparkles className="w-3.5 h-3.5" />
              Season II: Rise of the Guilds
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight text-foreground leading-none">
              {heroTitle.includes("Arcadia") ? (
                <>
                  {heroTitle.split("Arcadia")[0]}
                  <span className="bg-gradient-to-r from-primary via-amber-400 to-yellow-500 bg-clip-text text-transparent drop-shadow-sm">Arcadia</span>
                  {heroTitle.split("Arcadia")[1]}
                </>
              ) : (
                heroTitle
              )}
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {heroSubtitle}
            </p>

            {/* Premium Connection & Action Widget */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6 max-w-md mx-auto">
              <div className="w-full flex items-center justify-between gap-2 bg-card/60 backdrop-blur-md border border-border/80 rounded-xl px-4 py-2.5 shadow-lg group hover:border-primary/50 transition-all">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <div className="text-left">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Server IP</p>
                    <p className="text-sm font-mono font-semibold text-foreground tracking-wide">{serverIP}</p>
                  </div>
                </div>
                
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={handleCopyIP} 
                  className="h-8 px-3 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all rounded-lg"
                >
                  {copied ? (
                    <span className="flex items-center gap-1 text-emerald-400 text-xs">
                      <Check className="w-3.5 h-3.5" /> Copied
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-semibold">
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </span>
                  )}
                </Button>
              </div>

              <Button size="lg" asChild className="w-full sm:w-auto h-[48px] text-base font-bold bg-primary text-primary-foreground hover:bg-primary/95 hover:scale-[1.02] active:scale-[0.98] transition-all rounded-xl shadow-lg shadow-primary/20">
                <Link href="/sign-up">Begin Journey <ChevronRight className="w-4 h-4 ml-1" /></Link>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground/80">
              Compatible with Java Edition <span className="text-foreground font-semibold">{mcVersion}</span> • Recommended Client: Vanilla / Fabric
            </p>

            {/* Dynamic Server Metrics */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-12 border-t border-border/60 mt-16 max-w-3xl mx-auto">
                <div className="p-4 rounded-xl bg-card/20 backdrop-blur-sm border border-border/40 hover:border-primary/20 transition-all">
                  <div className="text-3xl font-extrabold text-primary">{stats.totalMembers}</div>
                  <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider mt-1">Active Citizens</div>
                </div>
                <div className="p-4 rounded-xl bg-card/20 backdrop-blur-sm border border-border/40 hover:border-primary/20 transition-all">
                  <div className="text-3xl font-extrabold text-primary">{stats.totalDevelopments}</div>
                  <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider mt-1">Unique Features</div>
                </div>
                <div className="p-4 rounded-xl bg-card/20 backdrop-blur-sm border border-border/40 hover:border-primary/20 transition-all">
                  <div className="text-3xl font-extrabold text-primary">{stats.completedDevelopments}</div>
                  <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider mt-1">Completed Items</div>
                </div>
                <div className="p-4 rounded-xl bg-card/20 backdrop-blur-sm border border-border/40 hover:border-primary/20 transition-all">
                  <div className="text-3xl font-extrabold text-primary">{stats.totalAnnouncements}</div>
                  <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider mt-1">Lore Releases</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Server Visual Gallery */}
      <div className="border-y border-border/60 bg-card/10 backdrop-blur-sm py-20">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight flex items-center justify-center gap-3">
              <span>{galleryTitle}</span>
              {(user?.role === "admin" || user?.role === "dev_website") && (
                <Link href="/admin?tab=gallery" className="inline-flex items-center justify-center p-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-all hover:scale-105 active:scale-95" title="Edit Gallery Section">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </Link>
              )}
            </h2>
            <p className="text-muted-foreground">{gallerySubtitle}</p>
          </div>

          <div className="grid lg:grid-cols-5 gap-8 items-center">
            {/* Gallery Navigation and Text */}
            <div className="lg:col-span-2 space-y-6">
              {galleryImages.map((img: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setActiveGallery(idx)}
                  className={`w-full text-left p-5 rounded-xl border transition-all duration-300 ${
                    activeGalleryIndex === idx
                      ? "bg-primary/10 border-primary text-foreground shadow-md shadow-primary/5"
                      : "bg-transparent border-transparent hover:bg-card/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${activeGalleryIndex === idx ? "bg-primary" : "bg-muted-foreground/40"}`} />
                    {img.title}
                  </h3>
                  <p className="text-xs mt-1.5 leading-relaxed opacity-85">
                    {img.description}
                  </p>
                </button>
              ))}
            </div>

            {/* Display Viewport */}
            <div className="lg:col-span-3">
              <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-border/80 shadow-2xl bg-card">
                {galleryImages[activeGalleryIndex] && (
                  <img
                    src={galleryImages[activeGalleryIndex].src}
                    alt={galleryImages[activeGalleryIndex].title}
                    className="w-full h-full object-cover animate-fade-in transition-all duration-500"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-6 left-6 right-6">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded bg-primary/80 backdrop-blur-sm text-primary-foreground uppercase tracking-wider">
                    In-Game Screenshot
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Showcase Features Portfolio Section */}
      <div className="container mx-auto px-4 py-24 max-w-6xl">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">Everything You Need For Immersive Play</h2>
          <p className="text-muted-foreground">We run on custom-designed software integrations and custom configurations to bring features unmatched elsewhere.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-card/40 border-border/60 hover:border-primary/30 hover:shadow-xl transition-all">
            <CardHeader className="space-y-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Shield className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg font-bold">Kingdoms & Lore</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Create a town, forge a guild, register political factions, and engage in land claims, castle sieges, and live seasonal lore.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-border/60 hover:border-primary/30 hover:shadow-xl transition-all">
            <CardHeader className="space-y-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Coins className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg font-bold">Dynamic Economy</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A fully player-run market with item trading, custom bank accounts, shop rentals, trade treaties, and gold-backed currency.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-border/60 hover:border-primary/30 hover:shadow-xl transition-all">
            <CardHeader className="space-y-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Gamepad2 className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg font-bold">Custom Mechanics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Unlock RPG level gains, special character stats, crafting recipes, custom block models, and magic attributes.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-border/60 hover:border-primary/30 hover:shadow-xl transition-all">
            <CardHeader className="space-y-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <MessageSquare className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg font-bold">Integrated Comms</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Start audio calls, video calls, direct messages, and team groups directly on this dashboard. Seamlessly connect.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs Deep-Dive: Specs, Joining, Roadmap */}
      <div className="bg-card/30 border-t border-border/60 py-20">
        <div className="container mx-auto px-4 max-w-5xl">
          <Tabs defaultValue="join-guide" className="space-y-8">
            <div className="flex justify-center">
              <TabsList className="bg-[#1a1512] border border-border/80 p-1 rounded-xl">
                <TabsTrigger value="join-guide" className="px-5 py-2 rounded-lg font-bold text-sm">How to Connect</TabsTrigger>
                <TabsTrigger value="roadmap" className="px-5 py-2 rounded-lg font-bold text-sm">Roadmap & Forge</TabsTrigger>
                <TabsTrigger value="specs" className="px-5 py-2 rounded-lg font-bold text-sm">Server Specs</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="join-guide">
              <Card className="bg-card/40 border-border">
                <CardHeader>
                  <CardTitle className="text-xl text-primary font-extrabold">Join Arcadia in 3 Easy Steps</CardTitle>
                  <CardDescription>Setup is quick and we welcome all Java Edition users.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">1</div>
                      <h4 className="font-bold text-foreground text-sm">Launch Java Edition</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">Open your Minecraft Launcher and start the game on version 1.20.4 or higher (or 1.21.x).</p>
                    </div>
                    <div className="space-y-2">
                      <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">2</div>
                      <h4 className="font-bold text-foreground text-sm">Add Server</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">Go to Multiplayer &gt; Add Server. Paste the server address: <span className="font-mono text-primary bg-primary/5 px-1 py-0.5 rounded">play.arcadiamc.net</span>.</p>
                    </div>
                    <div className="space-y-2">
                      <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">3</div>
                      <h4 className="font-bold text-foreground text-sm">Create Character</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">Spawn in, select your class, fill in your profile, and begin building your legacy in the realm.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="roadmap">
              <Card className="bg-card/40 border-border">
                <CardHeader>
                  <CardTitle className="text-xl text-primary font-extrabold flex items-center justify-between">
                    <span>Active Forge Developments</span>
                    <Link href="/sign-up" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                      See full backlog <ChevronRight className="w-3 h-3" />
                    </Link>
                  </CardTitle>
                  <CardDescription>Track items currently in active development or completed by our coders.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {developments?.slice(0, 4).map((dev) => (
                      <div key={dev.id} className="p-4 rounded-lg bg-card/60 border border-border/80 flex flex-col justify-between space-y-3">
                        <div className="flex justify-between items-start">
                          <h5 className="font-bold text-sm text-foreground">{dev.title}</h5>
                          <span className="text-[10px] px-2 py-0.5 bg-muted text-muted-foreground font-semibold rounded-full uppercase tracking-wider">
                            {dev.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{dev.description}</p>
                        {dev.progress !== null && dev.progress !== undefined && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>Progress</span>
                              <span>{dev.progress}%</span>
                            </div>
                            <Progress value={dev.progress} className="h-1.5" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="specs">
              <Card className="bg-card/40 border-border">
                <CardHeader>
                  <CardTitle className="text-xl text-primary font-extrabold flex items-center gap-2">
                    <Activity className="w-5 h-5" /> Server Architecture Specs
                  </CardTitle>
                  <CardDescription>We host on premium hardware to guarantee lag-free gameplay and massive render distance.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="p-3 bg-card/80 border border-border rounded-lg">
                      <Terminal className="w-5 h-5 mx-auto text-primary mb-1" />
                      <div className="text-xs font-bold">CPU</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{specsCpu}</div>
                    </div>
                    <div className="p-3 bg-card/80 border border-border rounded-lg">
                      <Users className="w-5 h-5 mx-auto text-primary mb-1" />
                      <div className="text-xs font-bold">Memory</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{specsMemory}</div>
                    </div>
                    <div className="p-3 bg-card/80 border border-border rounded-lg">
                      <Layers className="w-5 h-5 mx-auto text-primary mb-1" />
                      <div className="text-xs font-bold">Storage</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{specsStorage}</div>
                    </div>
                    <div className="p-3 bg-card/80 border border-border rounded-lg">
                      <Server className="w-5 h-5 mx-auto text-primary mb-1" />
                      <div className="text-xs font-bold">Location</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{specsLocation}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
