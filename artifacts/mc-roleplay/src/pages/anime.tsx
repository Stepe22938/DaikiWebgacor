import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, Tv, Flame, History, Bookmark, BookmarkCheck, Star, 
  Play, ChevronRight, Sparkles, ArrowLeft, ArrowRight, List, Info, RefreshCw
} from "lucide-react";

// Cache map to save query results and prevent unnecessary requests
const apiCache = new Map<string, any>();

const GENRES = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Romance", "Sci-Fi", "Thriller", "Mystery", "Supernatural"];

const GET_TRENDING = `
query {
  Page(page: 1, perPage: 24) {
    media(sort: TRENDING_DESC, type: ANIME, isAdult: false) {
      id
      idMal
      title {
        romaji
        english
      }
      coverImage {
        large
        extraLarge
      }
      description
      averageScore
      episodes
      status
      genres
      studios(isMain: true) {
        nodes {
          name
        }
      }
      seasonYear
      duration
    }
  }
}
`;

const GET_POPULAR = `
query {
  Page(page: 1, perPage: 24) {
    media(sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
      id
      idMal
      title {
        romaji
        english
      }
      coverImage {
        large
        extraLarge
      }
      description
      averageScore
      episodes
      status
      genres
      studios(isMain: true) {
        nodes {
          name
        }
      }
      seasonYear
      duration
    }
  }
}
`;

const SEARCH_ANIME = `
query ($search: String) {
  Page(page: 1, perPage: 24) {
    media(search: $search, type: ANIME, isAdult: false) {
      id
      idMal
      title {
        romaji
        english
      }
      coverImage {
        large
        extraLarge
      }
      description
      averageScore
      episodes
      status
      genres
      studios(isMain: true) {
        nodes {
          name
        }
      }
      seasonYear
      duration
    }
  }
}
`;

const GET_ANIME_DETAILS = `
query ($idMal: Int, $id: Int) {
  Media(idMal: $idMal, id: $id, type: ANIME) {
    id
    idMal
    title {
      romaji
      english
    }
    coverImage {
      large
      extraLarge
    }
    description
    averageScore
    episodes
    status
    genres
    studios(isMain: true) {
      nodes {
        name
      }
    }
    seasonYear
    duration
  }
}
`;

const GET_BY_GENRE = `
query ($genre: String) {
  Page(page: 1, perPage: 24) {
    media(genre: $genre, type: ANIME, isAdult: false, sort: POPULARITY_DESC) {
      id
      idMal
      title {
        romaji
        english
      }
      coverImage {
        large
        extraLarge
      }
      description
      averageScore
      episodes
      status
      genres
      studios(isMain: true) {
        nodes {
          name
        }
      }
      seasonYear
      duration
    }
  }
}
`;

async function fetchAniList(query: string, variables: any = {}) {
  const cacheKey = JSON.stringify({ query, variables });
  if (apiCache.has(cacheKey)) {
    return apiCache.get(cacheKey);
  }

  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      query,
      variables
    })
  });

  if (!res.ok) {
    throw new Error(`AniList GraphQL query failed with status: ${res.status}`);
  }

  const data = await res.json();
  apiCache.set(cacheKey, data);
  return data;
}

interface AnimeItem {
  mal_id: number;
  title: string;
  title_english?: string;
  images: {
    webp?: {
      large_image_url: string;
      image_url: string;
    };
  };
  synopsis: string;
  score: number;
  episodes: number | null;
  status: string;
  genres: Array<{ name: string }>;
  studios: Array<{ name: string }>;
  rating: string;
  duration: string;
  year: number | null;
}

interface WatchHistoryItem {
  mal_id: number;
  title: string;
  imageUrl: string;
  episode: number;
  timestamp: number;
  subOrDub: "sub" | "dub";
  server: string;
}

function mapAniListMediaToAnimeItem(media: any): AnimeItem {
  // Only use idMal for embeds — if null, use anilist id as fallback (may not play)
  const malId = media.idMal ?? media.id;
  return {
    mal_id: malId,
    title: media.title.romaji || media.title.english || "Unknown Anime",
    title_english: media.title.english || undefined,
    images: {
      webp: {
        large_image_url: media.coverImage.extraLarge || media.coverImage.large || "",
        image_url: media.coverImage.large || ""
      }
    },
    synopsis: media.description ? media.description.replace(/<br>/g, "\n").replace(/<[^>]+>/g, "") : "",
    score: media.averageScore ? Number((media.averageScore / 10).toFixed(1)) : 0,
    episodes: media.episodes || null,
    status: media.status ? media.status.replace(/_/g, " ") : "Finished",
    genres: media.genres ? media.genres.map((g: string) => ({ name: g })) : [],
    studios: media.studios?.nodes ? media.studios.nodes.map((s: any) => ({ name: s.name })) : [],
    rating: "PG-13 (Teen)",
    duration: media.duration ? `${media.duration} min` : "24 min",
    year: media.seasonYear || null
  };
}

export default function AnimePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AnimeItem[]>([]);
  const [topAiring, setTopAiring] = useState<AnimeItem[]>([]);
  const [topPopular, setTopPopular] = useState<AnimeItem[]>([]);
  const [selectedAnime, setSelectedAnime] = useState<AnimeItem | null>(null);

  // Genre filtering states
  const [selectedGenre, setSelectedGenre] = useState("");
  const [genreResults, setGenreResults] = useState<AnimeItem[]>([]);
  const [loadingGenre, setLoadingGenre] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  
  // Player state
  const [currentEpisode, setCurrentEpisode] = useState(1);
  const [currentServer, setCurrentServer] = useState("vidlink");
  const [subOrDub, setSubOrDub] = useState<"sub" | "dub">("sub");
  const [autoplay, setAutoplay] = useState(true);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [playerKey, setPlayerKey] = useState(0); // increment to force iframe reload

  // UI states
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>([]);
  const [bookmarks, setBookmarks] = useState<AnimeItem[]>([]);
  
  // Custom video player reference
  const playerRef = useRef<HTMLIFrameElement>(null);

  // Load static dashboard lists, watch history and bookmarks
  useEffect(() => {
    // Global error handler
    const handleGlobalError = (event: ErrorEvent) => {
      setRuntimeError(event.error?.stack || event.message);
    };
    window.addEventListener("error", handleGlobalError);

    // Load local storage items safely
    try {
      const localHistory = localStorage.getItem("daiki_anime_history");
      const localBookmarks = localStorage.getItem("daiki_anime_bookmarks");
      if (localHistory) {
        const parsed = JSON.parse(localHistory);
        if (Array.isArray(parsed)) setWatchHistory(parsed);
      }
      if (localBookmarks) {
        const parsed = JSON.parse(localBookmarks);
        if (Array.isArray(parsed)) setBookmarks(parsed);
      }
    } catch (e) {
      console.error("Failed to parse local storage items:", e);
    }

    // Fetch popular/top airing shows for dashboard using AniList
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        const airingData = await fetchAniList(GET_TRENDING);
        if (airingData?.data?.Page?.media) {
          setTopAiring(airingData.data.Page.media.map(mapAniListMediaToAnimeItem));
        }

        const popularData = await fetchAniList(GET_POPULAR);
        if (popularData?.data?.Page?.media) {
          setTopPopular(popularData.data.Page.media.map(mapAniListMediaToAnimeItem));
        }
      } catch (err) {
        console.error("Error loading dashboard anime:", err);
      } finally {
        setLoading(false);
      }
    };
    loadDashboardData();

    return () => {
      window.removeEventListener("error", handleGlobalError);
    };
  }, []);

  // Update localStorage when history changes
  const saveHistory = (item: WatchHistoryItem) => {
    const updated = [item, ...watchHistory.filter(h => h.mal_id !== item.mal_id)].slice(0, 15);
    setWatchHistory(updated);
    localStorage.setItem("daiki_anime_history", JSON.stringify(updated));
  };

  // Add or remove bookmark
  const toggleBookmark = (anime: AnimeItem) => {
    let updated: AnimeItem[];
    const exists = bookmarks.some(b => b.mal_id === anime.mal_id);
    if (exists) {
      updated = bookmarks.filter(b => b.mal_id !== anime.mal_id);
    } else {
      updated = [anime, ...bookmarks];
    }
    setBookmarks(updated);
    localStorage.setItem("daiki_anime_bookmarks", JSON.stringify(updated));
  };


  const handleGenreSelect = async (genre: string) => {
    setSelectedGenre(genre);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedAnime(null);
    
    if (genre === "") return;
    
    setLoadingGenre(true);
    try {
      const res = await fetchAniList(GET_BY_GENRE, { genre });
      if (res?.data?.Page?.media) {
        setGenreResults(res.data.Page.media.map(mapAniListMediaToAnimeItem));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingGenre(false);
    }
  };

  // Handle anime search
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setSelectedGenre("");
    setSearching(true);
    setSearchError("");
    try {
      const results = await fetchAniList(SEARCH_ANIME, { search: searchQuery });
      if (results?.data?.Page?.media) {
        const mapped = results.data.Page.media.map(mapAniListMediaToAnimeItem);
        setSearchResults(mapped);
        if (mapped.length === 0) {
          setSearchError("Tidak ada anime yang ditemukan. Coba keyword lain!");
        }
      }
    } catch (err) {
      console.error(err);
      setSearchError("Gagal melakukan pencarian. Silakan coba sesaat lagi.");
    } finally {
      setSearching(false);
    }
  };

  // Click on a show from history/lists
  const handleSelectAnime = (anime: AnimeItem, startEp = 1) => {
    setSelectedAnime(anime);
    setCurrentEpisode(startEp);
    setPlayerLoading(true);
    setPlayerKey(k => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
    
    // Check if this anime is in our watch history to restore sub/dub and server preference
    const historyEntry = watchHistory.find(h => h.mal_id === anime.mal_id);
    if (historyEntry) {
      setCurrentEpisode(startEp !== 1 ? startEp : historyEntry.episode);
      setSubOrDub(historyEntry.subOrDub);
      setCurrentServer(historyEntry.server);
    }

    // Save initial watch action in history
    saveHistory({
      mal_id: anime.mal_id,
      title: anime.title,
      imageUrl: anime.images.webp?.large_image_url || anime.images.webp?.image_url || "",
      episode: startEp !== 1 ? startEp : (historyEntry?.episode || 1),
      timestamp: Date.now(),
      subOrDub: historyEntry?.subOrDub || subOrDub,
      server: historyEntry?.server || currentServer
    });
  };

  // Change episode
  const handleEpisodeChange = (epNumber: number) => {
    if (!selectedAnime) return;
    setCurrentEpisode(epNumber);
    setPlayerLoading(true);
    setPlayerKey(k => k + 1);
    saveHistory({
      mal_id: selectedAnime.mal_id,
      title: selectedAnime.title,
      imageUrl: selectedAnime.images.webp?.large_image_url || selectedAnime.images.webp?.image_url || "",
      episode: epNumber,
      timestamp: Date.now(),
      subOrDub,
      server: currentServer
    });
  };

  // Change server or sub/dub
  const handlePlayerSettingChange = (server: string, format: "sub" | "dub") => {
    setCurrentServer(server);
    setSubOrDub(format);
    setPlayerLoading(true);
    setPlayerKey(k => k + 1);
    if (!selectedAnime) return;
    saveHistory({
      mal_id: selectedAnime.mal_id,
      title: selectedAnime.title,
      imageUrl: selectedAnime.images.webp?.large_image_url || selectedAnime.images.webp?.image_url || "",
      episode: currentEpisode,
      timestamp: Date.now(),
      subOrDub: format,
      server
    });
  };

  // Helper to build embed URL — all sources use MAL ID
  const getEmbedUrl = () => {
    if (!selectedAnime) return "";
    const malId = selectedAnime.mal_id;
    switch (currentServer) {
      case "iqiyi": {
        const q = encodeURIComponent(selectedAnime.title_english || selectedAnime.title);
        return `https://www.iq.com/search?q=${q}&type=2`;
      }
      case "embed_su":
        return `https://embed.su/embed/anime/${malId}/${currentEpisode}`;
      case "vidsrc_to":
        return `https://vidsrc.to/embed/anime/${malId}/${currentEpisode}`;
      case "anify":
        return `https://anify.tv/embed/anime?id=${malId}&episode=${currentEpisode}&audio=${subOrDub}`;
      case "vidlink":
      default:
        return `https://vidlink.pro/anime/${malId}/${currentEpisode}/${subOrDub}?primaryColor=facc15&fallback=true&autoplay=${autoplay ? "true" : "false"}`;
    }
  };

  const getIqiyiUrl = () => {
    if (!selectedAnime) return "https://www.iq.com";
    const q = encodeURIComponent((selectedAnime.title_english || selectedAnime.title) + " episode " + currentEpisode);
    return `https://www.iq.com/search?q=${q}&type=2`;
  };
  const getIqiyiSearchUrl = () => {
    if (!selectedAnime) return "https://www.iq.com";
    const q = encodeURIComponent(selectedAnime.title_english || selectedAnime.title);
    return `https://www.iq.com/search?q=${q}&type=2`;
  };

  const isBookmarked = selectedAnime && bookmarks.some(b => b.mal_id === selectedAnime.mal_id);

  // Generate episode numbers lists
  const totalEpisodes = selectedAnime?.episodes || 12;
  const hasAiringStatus = selectedAnime?.status === "RELEASING" || selectedAnime?.status === "Currently Airing";

  if (runtimeError) {
    return (
      <div className="bg-[#050507] text-red-500 p-8 min-h-screen font-mono text-xs overflow-auto flex flex-col justify-center items-center">
        <div className="max-w-2xl w-full border border-red-900/40 bg-red-950/10 p-6 rounded-2xl shadow-xl space-y-4">
          <h1 className="text-xl font-black text-red-400 uppercase tracking-wider">Runtime Error Detected</h1>
          <pre className="bg-black/40 border border-zinc-900 p-4 rounded-xl text-zinc-300 overflow-x-auto whitespace-pre-wrap">{runtimeError}</pre>
          <button 
            onClick={() => {
              localStorage.removeItem("daiki_anime_history");
              localStorage.removeItem("daiki_anime_bookmarks");
              window.location.reload();
            }} 
            className="w-full py-2 bg-red-900 hover:bg-red-800 text-white rounded-xl font-sans font-bold cursor-pointer transition-colors"
          >
            Reset LocalStorage & Reload
          </button>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="bg-[#050507] min-h-screen text-zinc-100 pb-20 relative overflow-hidden">
        {/* Glow ambient background effects */}
        <div className="absolute top-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-violet-600/5 blur-[150px] pointer-events-none" />
        <div className="absolute top-[30%] left-[-20%] w-[50vw] h-[50vw] rounded-full bg-blue-600/5 blur-[150px] pointer-events-none" />
        
        {/* Search header banner */}
        <div className="border-b border-zinc-900 bg-[#07070a]/90 backdrop-blur py-6 px-4 relative z-10">
          <div className="container mx-auto max-w-6xl space-y-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/5 animate-pulse">
                  <Tv className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-black uppercase tracking-wider text-white">Daiki Anime</h1>
                  <p className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-widest mt-0.5">Sistem Nonton Anime Premium Tanpa Iklan</p>
                </div>
              </div>
              
              <form onSubmit={handleSearchSubmit} className="relative w-full md:max-w-md">
                <Input
                  type="text"
                  placeholder="Cari judul anime kesukaanmu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0d0d14]/75 border-zinc-800 focus:border-amber-500/50 hover:border-zinc-700/80 rounded-2xl h-11 pl-4 pr-11 text-zinc-200 text-xs font-semibold focus:ring-1 focus:ring-amber-500/20 shadow-inner"
                />
                <button
                  type="submit"
                  disabled={searching}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-amber-400 transition-colors"
                >
                  {searching ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                  ) : (
                    <Search className="w-4.5 h-4.5" />
                  )}
                </button>
              </form>
            </div>

            {/* Genre Ribbon */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1 -mx-4 px-4 sm:mx-0 sm:px-0">
              <button
                onClick={() => handleGenreSelect("")}
                className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                  selectedGenre === "" 
                    ? "bg-amber-500 text-black font-extrabold shadow-lg shadow-amber-500/15" 
                    : "bg-[#0b0b10] border border-zinc-900 text-zinc-400 hover:text-white"
                }`}
              >
                Semua
              </button>
              {GENRES.map((g) => (
                <button
                  key={g}
                  onClick={() => handleGenreSelect(g)}
                  className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                    selectedGenre === g 
                      ? "bg-amber-500 text-black font-extrabold shadow-lg shadow-amber-500/15" 
                      : "bg-[#0b0b10] border border-zinc-900 text-zinc-400 hover:text-white"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* MAIN BODY AREA */}
        <div className="container mx-auto max-w-6xl px-4 mt-8 relative z-20">
          
          {/* SEARCH RESULTS VIEW */}
          {searchQuery && searchResults.length > 0 && !selectedAnime && (
            <div className="space-y-6 mb-12">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <h2 className="text-sm font-black uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                  <Search className="w-4 h-4 text-amber-400" /> Hasil Pencarian: "{searchQuery}"
                </h2>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                  className="text-zinc-500 hover:text-white font-extrabold text-[10px] uppercase tracking-wider h-auto p-1"
                >
                  Clear
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                {searchResults.map((anime) => (
                  <AnimeCard key={anime.mal_id} anime={anime} onClick={() => handleSelectAnime(anime)} />
                ))}
              </div>
            </div>
          )}

          {searchQuery && searchResults.length === 0 && !searching && searchError && (
            <div className="text-center py-16 bg-[#0b0b10] border border-zinc-900 rounded-3xl p-8 max-w-md mx-auto mb-10 shadow-2xl">
              <Info className="w-10 h-10 text-amber-500/80 mx-auto mb-4" />
              <p className="text-xs text-zinc-400 font-semibold">{searchError}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => { setSearchQuery(""); setSearchError(""); }} 
                className="mt-5 text-[10px] uppercase font-bold border-zinc-800 text-zinc-300 hover:text-white"
              >
                Kembali ke Dashboard
              </Button>
            </div>
          )}

          {/* ACTIVE STREAMING INTERFACE */}
          {selectedAnime ? (
            <div className="space-y-6 animate-in fade-in-50 duration-350">
              
              {/* Back breadcrumb bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-900 pb-4">
                <Button
                  variant="ghost"
                  onClick={() => setSelectedAnime(null)}
                  className="group flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-900/60 hover:bg-zinc-900 hover:text-white transition-all text-xs font-black text-zinc-400 uppercase tracking-widest cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Kembali
                </Button>

                <div className="flex items-center gap-2.5">
                  <Badge className="bg-zinc-900 text-zinc-400 border border-zinc-850 hover:bg-zinc-900 text-[10px] font-black uppercase tracking-wider py-1 px-2.5">
                    MAL ID: {selectedAnime.mal_id}
                  </Badge>
                  
                  <Button
                    onClick={() => toggleBookmark(selectedAnime)}
                    className={`h-9 px-3 rounded-xl flex items-center justify-center gap-1.5 text-[10px] uppercase font-black transition-all ${
                      isBookmarked
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20"
                        : "bg-zinc-900 border border-zinc-850 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {isBookmarked ? (
                      <>
                        <BookmarkCheck className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" /> Favorit
                      </>
                    ) : (
                      <>
                        <Bookmark className="w-3.5 h-3.5" /> Tambah Favorit
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Streaming layout grid */}
              <div className="grid lg:grid-cols-12 gap-8 items-start">
                
                {/* Left column: Player and info */}
                <div className="lg:col-span-8 space-y-6">
                  
                  {/* ===== VIDEO PLAYER ===== */}
                  {currentServer === "iqiyi" ? (
                    /* iQIYI mode — special card, can't embed */
                    <div className="relative aspect-video w-full rounded-[24px] overflow-hidden border border-[#00BE6E]/30 bg-gradient-to-br from-[#071209] to-[#050807] shadow-2xl flex items-center justify-center p-8">
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#00BE6E15,_transparent_70%)] pointer-events-none" />
                      <div className="relative z-10 flex flex-col items-center gap-5 text-center max-w-sm w-full">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-[#00BE6E]/15 border border-[#00BE6E]/30 flex items-center justify-center">
                            <Play className="w-6 h-6 text-[#00BE6E] fill-[#00BE6E]/40" />
                          </div>
                          <div className="text-left">
                            <p className="text-[#00BE6E] font-black text-xl tracking-tight">iQIYI</p>
                            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">iq.com</p>
                          </div>
                        </div>
                        <div>
                          <h3 className="text-white font-black text-sm uppercase tracking-wide">{selectedAnime.title}</h3>
                          <p className="text-zinc-500 text-[11px] mt-1">Episode {currentEpisode} &bull; {subOrDub === "sub" ? "Sub" : "Dub"}</p>
                        </div>
                        <a
                          href={getIqiyiUrl()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-2xl bg-[#00BE6E] hover:bg-[#00d478] text-white font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-[#00BE6E]/30 hover:-translate-y-0.5"
                        >
                          <Play className="w-4 h-4 fill-white" />
                          Tonton di iQIYI &rarr;
                        </a>
                        <a href={getIqiyiSearchUrl()} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-zinc-500 hover:text-[#00BE6E] font-bold uppercase tracking-wider transition-colors">
                          Cari "{selectedAnime.title}" di iQIYI
                        </a>
                      </div>
                    </div>
                  ) : (
                    /* Embed player */
                    <div className="relative aspect-video w-full rounded-[24px] overflow-hidden border border-zinc-900 bg-black shadow-2xl">
                      {playerLoading && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/90 gap-4">
                          <div className="w-10 h-10 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                          <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Memuat video...</p>
                        </div>
                      )}
                      <iframe
                        key={playerKey}
                        ref={playerRef}
                        src={getEmbedUrl()}
                        className="w-full h-full border-0 absolute top-0 left-0"
                        allowFullScreen
                        allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope"
                        title={`Watching ${selectedAnime.title} - Episode ${currentEpisode}`}
                        onLoad={() => setPlayerLoading(false)}
                      />
                    </div>
                  )}

                  {/* Fallback action buttons — hidden for iQIYI since it already has its own CTA */}
                  {currentServer !== "iqiyi" && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <a
                        href={getEmbedUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-amber-500/20 hover:-translate-y-0.5"
                      >
                        <Play className="w-4 h-4 fill-black" />
                        Buka di Tab Baru
                      </a>
                      <button
                        onClick={() => { setPlayerLoading(true); setPlayerKey(k => k + 1); }}
                        className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Reload Player
                      </button>
                    </div>
                  )}

                  {/* Tips alert */}
                  {currentServer !== "iqiyi" ? (
                    <div className="bg-amber-950/20 border border-amber-900/35 p-3 rounded-2xl flex items-start gap-2.5 text-[11px] text-amber-300 font-bold leading-relaxed">
                      <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-amber-400 uppercase tracking-wider block font-black mb-0.5">Jika video tidak muncul:</span>
                        Coba ganti <strong>Server Mirror</strong> di bawah. Atau klik <strong>Buka di Tab Baru</strong>.
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#00BE6E]/10 border border-[#00BE6E]/20 p-3 rounded-2xl flex items-start gap-2.5 text-[11px] text-emerald-300 font-bold leading-relaxed">
                      <Info className="w-4 h-4 text-[#00BE6E] shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[#00BE6E] uppercase tracking-wider block font-black mb-0.5">iQIYI:</span>
                        Platform streaming resmi. Konten gratis &amp; VIP tersedia. Klik tombol hijau untuk menonton.
                      </div>
                    </div>
                  )}

                  {/* Player toolbar controls */}
                  <div className="bg-[#0a0a0f] border border-zinc-900 rounded-[20px] p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-[8px] text-zinc-500 font-extrabold uppercase tracking-widest mb-1.5">SERVER MIRROR</span>
                        <div className="flex flex-wrap rounded-lg bg-zinc-950 p-1 border border-zinc-900 gap-0.5">
                          <button
                            onClick={() => handlePlayerSettingChange("vidlink", subOrDub)}
                            className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                              currentServer === "vidlink" ? "bg-amber-500 text-black font-extrabold" : "text-zinc-500 hover:text-zinc-300"
                            }`}
                          >
                            VidLink ✓
                          </button>
                          <button
                            onClick={() => handlePlayerSettingChange("embed_su", subOrDub)}
                            className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                              currentServer === "embed_su" ? "bg-amber-500 text-black font-extrabold" : "text-zinc-500 hover:text-zinc-300"
                            }`}
                          >
                            Embed.su
                          </button>
                          <button
                            onClick={() => handlePlayerSettingChange("vidsrc_to", subOrDub)}
                            className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                              currentServer === "vidsrc_to" ? "bg-amber-500 text-black font-extrabold" : "text-zinc-500 hover:text-zinc-300"
                            }`}
                          >
                            Vidsrc.to
                          </button>
                          <button
                            onClick={() => handlePlayerSettingChange("anify", subOrDub)}
                            className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                              currentServer === "anify" ? "bg-amber-500 text-black font-extrabold" : "text-zinc-500 hover:text-zinc-300"
                            }`}
                          >
                            Anify
                          </button>
                          <button
                            onClick={() => handlePlayerSettingChange("iqiyi", subOrDub)}
                            className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                              currentServer === "iqiyi"
                                ? "bg-[#00BE6E] text-white font-extrabold"
                                : "text-zinc-500 hover:text-emerald-400"
                            }`}
                          >
                            iQIYI
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-[8px] text-zinc-500 font-extrabold uppercase tracking-widest mb-1.5">FORMAT</span>
                        <div className="flex rounded-lg bg-zinc-950 p-1 border border-zinc-900">
                          <button
                            onClick={() => handlePlayerSettingChange(currentServer, "sub")}
                            className={`px-3.5 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                              subOrDub === "sub" ? "bg-zinc-900 border border-zinc-800 text-white font-extrabold" : "text-zinc-500 hover:text-zinc-300"
                            }`}
                          >
                            Sub
                          </button>
                          <button
                            onClick={() => handlePlayerSettingChange(currentServer, "dub")}
                            className={`px-3.5 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                              subOrDub === "dub" ? "bg-zinc-900 border border-zinc-800 text-white font-extrabold" : "text-zinc-500 hover:text-zinc-300"
                            }`}
                          >
                            Dub
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Navigation Buttons for Episodes */}
                    <div className="flex items-center gap-3">
                      <Button
                        size="sm"
                        disabled={currentEpisode <= 1}
                        onClick={() => handleEpisodeChange(currentEpisode - 1)}
                        className="bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 hover:text-white text-zinc-400 h-9 rounded-xl flex items-center justify-center text-[10px] uppercase font-black tracking-widest gap-1"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" /> Prev
                      </Button>

                      <div className="bg-zinc-950 border border-zinc-900 px-3.5 h-9 rounded-xl flex items-center justify-center text-xs font-black tracking-wide font-mono text-zinc-300">
                        EPISODE {currentEpisode}
                      </div>

                      <Button
                        size="sm"
                        disabled={!hasAiringStatus && currentEpisode >= totalEpisodes}
                        onClick={() => handleEpisodeChange(currentEpisode + 1)}
                        className="bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 hover:text-white text-zinc-400 h-9 rounded-xl flex items-center justify-center text-[10px] uppercase font-black tracking-widest gap-1"
                      >
                        Next <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Anime Meta Details Card */}
                  <div className="bg-[#08080c]/50 border border-zinc-900 rounded-[28px] p-6 space-y-6 shadow-2xl backdrop-blur-sm">
                    <div className="flex flex-col md:flex-row gap-6">
                      <img
                        src={selectedAnime.images.webp?.large_image_url || selectedAnime.images.webp?.image_url || ""}
                        alt={selectedAnime.title}
                        className="w-full md:w-44 aspect-[3/4] object-cover rounded-2xl border border-zinc-900 shadow-lg shrink-0"
                      />
                      
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <h2 className="text-xl sm:text-2xl font-black text-white leading-tight tracking-tight uppercase select-none">{selectedAnime.title}</h2>
                          {selectedAnime.title_english && (
                            <h3 className="text-xs text-zinc-500 font-bold uppercase tracking-wider">{selectedAnime.title_english}</h3>
                          )}
                        </div>

                        {/* Badges and rating row */}
                        <div className="flex flex-wrap gap-2.5 items-center">
                          <span className="flex items-center gap-1 text-xs font-mono font-black text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-lg">
                            <Star className="w-3.5 h-3.5 fill-amber-400/30" /> {selectedAnime.score || "N/A"}
                          </span>
                          
                          <Badge className="bg-zinc-900 text-zinc-400 border border-zinc-800 font-extrabold text-[9px] uppercase tracking-wider py-0.5 px-2">
                            {selectedAnime.status}
                          </Badge>

                          <Badge className="bg-zinc-900 text-zinc-400 border border-zinc-800 font-extrabold text-[9px] uppercase tracking-wider py-0.5 px-2">
                            {selectedAnime.rating}
                          </Badge>

                          {selectedAnime.year && (
                            <Badge className="bg-zinc-900 text-zinc-400 border border-zinc-800 font-extrabold text-[9px] uppercase tracking-wider py-0.5 px-2">
                              Year: {selectedAnime.year}
                            </Badge>
                          )}
                        </div>

                        {/* Genres */}
                        <div className="flex flex-wrap gap-1.5">
                          {selectedAnime.genres.map((g, i) => (
                            <span key={i} className="text-[10px] font-black uppercase tracking-wider bg-[#0d0d14] border border-zinc-850 px-2.5 py-1 rounded-full text-zinc-500 hover:text-zinc-300 transition-colors">
                              {g.name}
                            </span>
                          ))}
                        </div>

                        {/* Studio list */}
                        {selectedAnime.studios && selectedAnime.studios.length > 0 && (
                          <p className="text-xs text-zinc-400 font-bold">
                            <span className="text-zinc-650 uppercase text-[10px] tracking-wider block mb-0.5">STUDIO:</span>
                            {selectedAnime.studios.map(s => s.name).join(", ")}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-zinc-900 pt-5 space-y-2">
                      <span className="text-zinc-650 font-black uppercase text-[10px] tracking-wider block">SYNOPSIS:</span>
                      <p className="text-xs text-zinc-400 font-medium leading-relaxed max-w-3xl whitespace-pre-line">
                        {selectedAnime.synopsis || "Tidak ada sinopsis yang tersedia untuk anime ini."}
                      </p>
                    </div>

                  </div>

                </div>

                {/* Right column: Episodes selection grid */}
                <div className="lg:col-span-4 space-y-6">
                  
                  {/* Episode selection panel card */}
                  <Card className="bg-[#08080c]/50 border-zinc-900 shadow-2xl rounded-[28px] backdrop-blur-sm overflow-hidden flex flex-col max-h-[640px]">
                    <div className="p-5 border-b border-zinc-900 flex items-center justify-between shrink-0">
                      <h3 className="font-black text-xs text-white uppercase tracking-wider flex items-center gap-2">
                        <List className="w-4 h-4 text-amber-500" /> Daftar Episode
                      </h3>
                      <span className="text-[9px] font-extrabold px-2.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 uppercase tracking-widest font-mono">
                        {selectedAnime.episodes ? `${totalEpisodes} eps` : "Airing"}
                      </span>
                    </div>

                    <ScrollArea className="flex-1 p-5 overflow-y-auto">
                      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-4 gap-2.5 pb-2">
                        {Array.from({ length: totalEpisodes }, (_, i) => i + 1).map((ep) => {
                          const isCurrent = ep === currentEpisode;
                          return (
                            <button
                              key={ep}
                              onClick={() => handleEpisodeChange(ep)}
                              className={`h-11 font-mono text-xs rounded-xl flex items-center justify-center border font-bold transition-all hover:scale-[1.03] active:scale-[0.97] cursor-pointer ${
                                isCurrent
                                  ? "bg-amber-500 border-amber-400 text-black font-black shadow-lg shadow-amber-500/10"
                                  : "bg-[#0b0b10] border-zinc-900 text-zinc-400 hover:border-zinc-800 hover:text-white"
                              }`}
                            >
                              {ep}
                            </button>
                          );
                        })}
                        {hasAiringStatus && totalEpisodes === 0 && (
                          <p className="col-span-full text-center text-xs text-zinc-650 font-bold py-6">Belum ada episode terdaftar.</p>
                        )}
                      </div>
                    </ScrollArea>
                  </Card>

                  {/* Bookmark List sidebar preview */}
                  {bookmarks.length > 0 && (
                    <Card className="bg-[#08080c]/50 border-zinc-900 rounded-[28px] p-5 shadow-2xl backdrop-blur-sm">
                      <h3 className="font-black text-xs text-zinc-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Bookmark className="w-4 h-4 text-amber-400" /> Bookmark Anda
                      </h3>
                      <ScrollArea className="max-h-[220px]">
                        <div className="space-y-3.5 pr-2">
                          {bookmarks.map((anime) => (
                            <div
                              key={anime.mal_id}
                              onClick={() => handleSelectAnime(anime)}
                              className="flex gap-3 items-center p-2 rounded-xl bg-zinc-950/40 hover:bg-zinc-900 border border-zinc-900 hover:border-zinc-850 transition-all cursor-pointer group"
                            >
                              <img
                                src={anime.images.webp?.image_url || ""}
                                alt={anime.title}
                                className="w-10 h-14 object-cover rounded-lg border border-zinc-900 shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <h4 className="text-[11px] font-black text-zinc-300 group-hover:text-white truncate uppercase tracking-wide">{anime.title}</h4>
                                <span className="text-[9px] font-mono text-zinc-650 font-bold block mt-1">{anime.genres?.[0]?.name || "Anime"}</span>
                              </div>
                              <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-white transition-colors" />
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </Card>
                  )}

                </div>

              </div>

            </div>
          ) : (
            // DASHBOARD VIEW (Featured anime banner + scroll sections)
            <div className="space-y-12 animate-in fade-in-50 duration-350">
              
              {selectedGenre ? (
                /* Genre Results View */
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                    <h2 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" /> Genre: {selectedGenre}
                    </h2>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleGenreSelect("")}
                      className="text-zinc-500 hover:text-white font-extrabold text-[10px] uppercase tracking-wider h-auto p-1 font-mono cursor-pointer"
                    >
                      Reset Filter
                    </Button>
                  </div>
                  
                  {loadingGenre ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="animate-pulse space-y-3">
                          <div className="bg-zinc-900 aspect-[3/4] rounded-2xl border border-zinc-950" />
                          <div className="h-3 bg-zinc-900 rounded w-3/4 mx-auto" />
                          <div className="h-2 bg-zinc-900 rounded w-1/2 mx-auto" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                      {genreResults.map((anime) => (
                        <AnimeCard key={anime.mal_id} anime={anime} onClick={() => handleSelectAnime(anime)} />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* NORMAL DASHBOARD CONTENT */
                <>
                  {/* Watch History Horizontal Strip */}
                  {watchHistory.length > 0 && (
                    <div className="space-y-4">
                      <h2 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                        <History className="w-4 h-4 text-amber-400" /> Lanjutkan Menonton
                      </h2>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {watchHistory.map((item) => (
                          <div
                            key={item.mal_id}
                            onClick={async () => {
                              setLoading(true);
                              try {
                                const details = await fetchAniList(GET_ANIME_DETAILS, { idMal: item.mal_id });
                                if (details?.data?.Media) {
                                  handleSelectAnime(mapAniListMediaToAnimeItem(details.data.Media), item.episode);
                                } else {
                                  // Try search by AniList ID if MAL query failed
                                  const detailsAlt = await fetchAniList(GET_ANIME_DETAILS, { id: item.mal_id });
                                  if (detailsAlt?.data?.Media) {
                                    handleSelectAnime(mapAniListMediaToAnimeItem(detailsAlt.data.Media), item.episode);
                                  }
                                }
                              } catch (err) {
                                console.error(err);
                              } finally {
                                  setLoading(false);
                              }
                            }}
                            className="flex items-center gap-4 p-3.5 rounded-2xl bg-[#0a0a0f] hover:bg-[#0f0f15] border border-zinc-900 hover:border-zinc-800 transition-all cursor-pointer group shadow-lg"
                          >
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              className="w-12 h-16 object-cover rounded-xl border border-zinc-950 shrink-0 shadow-md"
                            />
                            <div className="min-w-0 flex-1">
                              <h3 className="text-xs font-black text-white group-hover:text-amber-400 truncate uppercase tracking-wider">{item.title}</h3>
                              <span className="text-[10px] font-extrabold text-zinc-500 block mt-1 uppercase">Episode {item.episode}</span>
                              <span className="text-[8px] font-mono text-zinc-650 block mt-0.5">
                                {new Date(item.timestamp).toLocaleDateString()}
                              </span>
                            </div>
                            <Play className="w-5 h-5 text-zinc-600 group-hover:text-amber-400 shrink-0 transition-colors" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Main Featured Hero Section */}
                  <div className="relative rounded-[32px] overflow-hidden border border-zinc-900 bg-[#07070a] min-h-[300px] flex items-center p-6 md:p-10 shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/45 to-transparent pointer-events-none z-10" />
                    <div className="absolute right-[5%] bottom-0 top-0 w-[45%] opacity-20 md:opacity-40 pointer-events-none select-none z-0">
                      <div className="absolute inset-0 bg-gradient-to-l from-[#050507] via-transparent to-transparent z-10" />
                      <img
                        src="https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=600&auto=format&fit=crop"
                        alt="Featured Poster"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    
                    <div className="relative z-20 max-w-md space-y-4">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[9px] text-amber-400 font-black uppercase tracking-[0.15em]">
                        <Sparkles className="w-3.5 h-3.5" /> Rekomendasi Teratas
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight uppercase tracking-tight">KIMETSU NO YAIBA: DEMON SLAYER</h2>
                      <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                        Ikuti kisah Tanjiro Kamado, seorang pemuda yang berjuang melawan iblis demi menyelamatkan adiknya, Nezuko, yang telah berubah menjadi iblis.
                      </p>
                      <Button
                        size="sm"
                        onClick={async () => {
                          setLoading(true);
                          try {
                            const res = await fetchAniList(GET_ANIME_DETAILS, { idMal: 38000 }); // Kimetsu no Yaiba MAL ID
                            if (res?.data?.Media) {
                              handleSelectAnime(mapAniListMediaToAnimeItem(res.data.Media));
                            }
                          } catch (err) {
                            console.error(err);
                          } finally {
                            setLoading(false);
                          }
                        }}
                        className="bg-white text-black hover:bg-zinc-200 h-10 px-5 rounded-xl text-[10px] uppercase font-black tracking-widest flex items-center gap-1.5 shadow-lg"
                      >
                        <Play className="w-3.5 h-3.5 fill-black" /> Tonton Sekarang
                      </Button>
                    </div>
                  </div>

                  {/* Bookmarks Section Grid */}
                  {bookmarks.length > 0 && (
                    <div className="space-y-4">
                      <h2 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                        <Bookmark className="w-4 h-4 text-amber-400" /> Bookmark Anime Anda
                      </h2>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                        {bookmarks.map((anime) => (
                          <AnimeCard key={anime.mal_id} anime={anime} onClick={() => handleSelectAnime(anime)} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top Airing Anime */}
                  <div className="space-y-4">
                    <h2 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                      <Flame className="w-4 h-4 text-orange-500 animate-bounce" /> Sedang Tayang Terpopuler
                    </h2>
                    
                    {loading ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="animate-pulse space-y-3">
                            <div className="bg-zinc-900 aspect-[3/4] rounded-2xl border border-zinc-950" />
                            <div className="h-3 bg-zinc-900 rounded w-3/4 mx-auto" />
                            <div className="h-2 bg-zinc-900 rounded w-1/2 mx-auto" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                        {topAiring.map((anime) => (
                          <AnimeCard key={anime.mal_id} anime={anime} onClick={() => handleSelectAnime(anime)} />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Top Popular Anime */}
                  <div className="space-y-4">
                    <h2 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" /> Anime Terpopuler Sepanjang Masa
                    </h2>
                    
                    {loading ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="animate-pulse space-y-3">
                            <div className="bg-zinc-900 aspect-[3/4] rounded-2xl border border-zinc-950" />
                            <div className="h-3 bg-zinc-900 rounded w-3/4 mx-auto" />
                            <div className="h-2 bg-zinc-900 rounded w-1/2 mx-auto" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                        {topPopular.map((anime) => (
                          <AnimeCard key={anime.mal_id} anime={anime} onClick={() => handleSelectAnime(anime)} />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

            </div>
          )}

        </div>
      </div>
    </Layout>
  );
}

// Reusable elegant AnimeCard component
function AnimeCard({ anime, onClick }: { anime: AnimeItem; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="group cursor-pointer select-none space-y-2.5 transition-all duration-300 active:scale-[0.97]"
    >
      {/* Poster Image Container */}
      <div className="relative aspect-[3/4] w-full rounded-2xl overflow-hidden border border-zinc-900 bg-zinc-950 group-hover:border-zinc-700 transition-all duration-300 shadow-lg group-hover:shadow-amber-500/5 group-hover:-translate-y-1">
        <img
          src={anime.images.webp?.large_image_url || anime.images.webp?.image_url || ""}
          alt={anime.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        
        {/* Shadow overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity" />
        
        {/* Score overlay tag */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-0.5 px-2 py-0.5 rounded bg-black/75 border border-zinc-800 text-[10px] font-black text-amber-400 font-mono">
          <Star className="w-3 h-3 fill-amber-400/20 text-amber-400" />
          {anime.score || "N/A"}
        </div>
      </div>

      {/* Info text below */}
      <div className="space-y-0.5 text-center px-1">
        <h4 className="text-[11px] font-black text-zinc-350 group-hover:text-white uppercase truncate tracking-wide transition-colors">
          {anime.title}
        </h4>
        <span className="text-[9px] font-mono text-zinc-650 font-bold block uppercase">
          {anime.genres?.[0]?.name || "Anime"}
        </span>
      </div>
    </div>
  );
}
