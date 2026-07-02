import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, BookOpen, Flame, History, Bookmark, BookmarkCheck, Star, 
  ChevronRight, Sparkles, ArrowLeft, ArrowRight, List, Info, RefreshCw,
  Book, ChevronLeft, Eye, EyeOff, LayoutGrid, Sliders
} from "lucide-react";

// Cache to prevent duplicate metadata queries
const apiCache = new Map<string, any>();

const GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Romance",
  "Sci-Fi", "Thriller", "Mystery", "Supernatural", "Horror", "Sports",
  "Slice of Life", "Historical", "Psychological", "Isekai", "Mecha",
  "Music", "Harem", "Martial Arts", "Wuxia", "Medical"
];

const GENRE_IDS: Record<string, string> = {
  "Action": "391b0423-d847-456f-aff0-8b0cfc03066b",
  "Adventure": "87bfd33f-82e1-4506-86b3-e0d29f86661a",
  "Comedy": "4d322814-08f5-4928-842c-f727d5f7f573",
  "Drama": "b9af3a63-f058-41d4-ae10-7b0c572f12c5",
  "Fantasy": "cdc58593-87dd-415e-bbc0-2ec27bf404cc",
  "Romance": "423e2eae-971b-42c4-b4c2-7d84124b9a96",
  "Sci-Fi": "256c8064-7c37-4f36-8e59-a1b16af930f0",
  "Thriller": "07251805-a27e-4d59-b488-f0bfbec15168",
  "Mystery": "ee968100-4191-4968-93d3-f82d72be7e46",
  "Supernatural": "eabc5b4c-6aff-42f3-b657-3e90cbd00b75",
  "Horror": "cdad7e68-1419-41d4-b51b-3bc8e9a9d182",
  "Sports": "69964a64-2f90-4d33-beeb-e3bdca8caa3a",
  "Slice of Life": "e5301a23-ebd9-49dd-a0cb-2add944c7fe9",
  "Historical": "33771934-028e-4cb3-8744-691e866a923e",
  "Psychological": "3b60b75c-a2d7-4860-ab56-05f391bb889c",
  "Isekai": "ace04997-f6bd-436e-b261-779182193d3d",
  "Mecha": "50880a9d-5440-4732-9afb-8f457127e836",
  "Music": "f42fbf9e-188a-447b-9fdc-f19dc1e4d685",
  "Harem": "aafb99c1-7f60-43fa-b75f-fc9502ce29c7",
  "Martial Arts": "799c202e-7daa-44eb-9cf7-8a3c0441531e",
  "Wuxia": "acc803a4-c374-4f6a-9b54-fb9fc33bcf4a",
  "Medical": "c8cbe35b-1b2b-395e-aa56-197b14170f40"
};

interface MangaItem {
  id: string;
  mal_id?: number;
  title: string;
  title_english?: string;
  coverImage: string;
  description: string;
  averageScore?: number;
  chaptersCount?: number;
  volumesCount?: number;
  status: string;
  genres: string[];
}

interface MangaDexChapter {
  id: string;
  chapter: string;
  title: string;
  translatedLanguage: string;
  pages: number;
  externalUrl?: string | null; // official chapter linking to external source
}

interface ReadHistoryItem {
  id: string;
  title: string;
  coverImage: string;
  chapterId: string;
  chapterNum: string;
  pageIndex: number;
  timestamp: number;
}

// Proxied fetch for MangaDex API
// Builds raw query string WITHOUT encoding brackets so MangaDex accepts array params like contentRating[]=safe
async function fetchMangaDex(path: string, queryParams: Record<string, string | string[]> = {}, retries = 3): Promise<any> {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(queryParams)) {
    if (Array.isArray(value)) {
      value.forEach(v => parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`));
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }
  // MangaDex uses bracket notation: contentRating[]=safe — don't encode the []
  const queryStr = parts.join("&").replace(/%5B%5D/gi, "[]");
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const url = `${basePath}/api/manga/api/${path}${queryStr ? "?" + queryStr : ""}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url);
    if (res.status === 429) {
      // Rate limited — wait exponentially then retry
      const delay = Math.pow(2, attempt) * 1000;
      console.warn(`[MangaDex] Rate limited, waiting ${delay}ms before retry ${attempt + 1}/${retries}`);
      await new Promise(r => setTimeout(r, delay));
      continue;
    }
    if (!res.ok) throw new Error(`MangaDex Proxy API error: ${res.status} ${res.statusText}`);
    return res.json();
  }
  throw new Error(`MangaDex API failed after ${retries} retries (rate limited)`);
}

// Proxied fetch for Chapter Page list
async function fetchChapterPages(chapterId: string) {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const url = `${basePath}/api/manga/api/at-home/server/${chapterId}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch chapter pages list");
  return res.json();
}

function mapMangaDexToMangaItem(mdManga: any): MangaItem {
  const attrs = mdManga.attributes || {};
  const title = attrs.title?.en || attrs.title?.ja || (attrs.title ? Object.values(attrs.title)[0] : "Unknown Title");
  const titleEnglish = attrs.title?.en || undefined;
  
  // Find cover art relationship
  const coverRelationship = mdManga.relationships?.find((r: any) => r.type === "cover_art");
  const fileName = coverRelationship?.attributes?.fileName;
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const coverImage = fileName 
    ? `${basePath}/api/manga/cdn/covers/${mdManga.id}/${fileName}`
    : "";
    
  // Get genres from tags
  const genres = attrs.tags
    ?.filter((t: any) => t.attributes?.group === "genre")
    ?.map((t: any) => t.attributes?.name?.en) || [];
    
  const desc = attrs.description?.en || attrs.description?.ja || (attrs.description ? Object.values(attrs.description)[0] : "") || "";
  
  return {
    id: mdManga.id,
    title: typeof title === "string" ? title : "Unknown Title",
    title_english: typeof titleEnglish === "string" ? titleEnglish : undefined,
    coverImage,
    description: typeof desc === "string" ? desc.replace(/<[^>]*>/g, "") : "",
    status: attrs.status || "ongoing",
    genres,
  };
}

export default function MangaPage({ embedded = false }: { embedded?: boolean } = {}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MangaItem[]>([]);
  const [topAiring, setTopAiring] = useState<MangaItem[]>([]);
  const [topPopular, setTopPopular] = useState<MangaItem[]>([]);
  const [selectedManga, setSelectedManga] = useState<MangaItem | null>(null);

  // Genre filtering
  const [selectedGenre, setSelectedGenre] = useState("");
  const [genreResults, setGenreResults] = useState<MangaItem[]>([]);
  const [loadingGenre, setLoadingGenre] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  // MangaDex integration states
  const [mangaDexId, setMangaDexId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<MangaDexChapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [chapterLang, setChapterLang] = useState<"en" | "id">("en");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Latest updates state (real-time from MangaDex)
  const [latestUpdates, setLatestUpdates] = useState<Array<{
    mangaId: string;
    mangaTitle: string;
    coverImage: string;
    chapterNum: string;
    chapterTitle: string;
    chapterId: string;
    updatedAt: string;
  }>>([]);
  const [loadingLatest, setLoadingLatest] = useState(false);

  // Multi-source aggregated rating state
  const [ratingData, setRatingData] = useState<{
    sources: Array<{ source: string; score: number; maxScore: number; normalized: number; url: string }>;
    combined: number | null;
    label: string;
    totalSources: number;
  } | null>(null);
  const [loadingRating, setLoadingRating] = useState(false);

  // Reader states
  const [activeChapter, setActiveChapter] = useState<MangaDexChapter | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [pagesHash, setPagesHash] = useState<string>("");
  const [loadingPages, setLoadingPages] = useState(false);
  const [readMode, setReadMode] = useState<"vertical" | "single">("vertical");
  const [singlePageIndex, setSinglePageIndex] = useState(0);

  // UI states
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [readHistory, setReadHistory] = useState<ReadHistoryItem[]>([]);
  const [bookmarks, setBookmarks] = useState<MangaItem[]>([]);

  // Load static lists, history, and bookmarks
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      setRuntimeError(event.error?.stack || event.message);
    };
    window.addEventListener("error", handleGlobalError);

    try {
      const localHistory = localStorage.getItem("daiki_manga_history");
      const localBookmarks = localStorage.getItem("daiki_manga_bookmarks");
      if (localHistory) {
        const parsed = JSON.parse(localHistory);
        if (Array.isArray(parsed)) setReadHistory(parsed);
      }
      if (localBookmarks) {
        const parsed = JSON.parse(localBookmarks);
        if (Array.isArray(parsed)) setBookmarks(parsed);
      }
    } catch (e) {
      console.error(e);
    }

    const loadDashboardData = async () => {
      setLoading(true);
      setLoadingLatest(true);
      try {
        // Fetch trending manga sorted by followedCount
        const trendingData = await fetchMangaDex("manga", {
          limit: "20",
          "includes[]": "cover_art",
          "order[followedCount]": "desc",
          "contentRating[]": ["safe", "suggestive", "erotica", "pornographic"]
        });
        let trendingMapped: MangaItem[] = [];
        if (trendingData?.data) {
          const seenTrending = new Set<string>();
          trendingMapped = trendingData.data
            .map(mapMangaDexToMangaItem)
            .filter((m: MangaItem) => {
              if (seenTrending.has(m.id)) return false;
              seenTrending.add(m.id);
              return true;
            });
          setTopAiring(trendingMapped);
        }

        // Fetch popular manga sorted by rating
        const popularData = await fetchMangaDex("manga", {
          limit: "20",
          "includes[]": "cover_art",
          "order[rating]": "desc",
          "contentRating[]": ["safe", "suggestive", "erotica", "pornographic"]
        });
        let popularMapped: MangaItem[] = [];
        if (popularData?.data) {
          const seenPopular = new Set<string>();
          popularMapped = popularData.data
            .map(mapMangaDexToMangaItem)
            .filter((m: MangaItem) => {
              if (seenPopular.has(m.id)) return false;
              seenPopular.add(m.id);
              // Do not show the same manga in both Trending and Popular rows
              return !trendingMapped.some(t => t.id === m.id);
            });
          setTopPopular(popularMapped);
        }

        // Batch fetch ratings for all dashboard items
        const allIds = Array.from(new Set([
          ...trendingMapped.map((m: MangaItem) => m.id),
          ...popularMapped.map((m: MangaItem) => m.id)
        ]));
        if (allIds.length > 0) {
          try {
            const statsRes = await fetchMangaDex("statistics/manga", {
              "manga[]": allIds
            });
            if (statsRes && statsRes.statistics) {
              if (trendingMapped.length > 0) {
                setTopAiring(trendingMapped.map((item: MangaItem) => {
                  const stats = statsRes.statistics[item.id];
                  const bayesian = stats?.rating?.bayesian;
                  return {
                    ...item,
                    averageScore: bayesian ? Math.round(bayesian * 10) : undefined
                  };
                }).filter((m: MangaItem) => m !== null));
              }
              if (popularMapped.length > 0) {
                setTopPopular(popularMapped.map((item: MangaItem) => {
                  const stats = statsRes.statistics[item.id];
                  const bayesian = stats?.rating?.bayesian;
                  return {
                    ...item,
                    averageScore: bayesian ? Math.round(bayesian * 10) : undefined
                  };
                }).filter((m: MangaItem) => m !== null));
              }
            }
          } catch (e) {
            console.error("Failed to load dashboard stats:", e);
          }
        }

        // Fetch latest chapter updates (real-time sync from MangaDex)
        // Fetch limit 96 to have a good pool of updates to deduplicate on mangaId
        const latestData = await fetchMangaDex("chapter", {
          limit: "96",
          "translatedLanguage[]": "en",
          "order[readableAt]": "desc",
          "contentRating[]": ["safe", "suggestive", "erotica", "pornographic"],
          "includes[]": ["manga", "scanlation_group"]
        });
        if (latestData?.data) {
          const uniqueMangaIds = new Set<string>();
          const uniqueUpdates: any[] = [];
          for (const ch of latestData.data) {
            const mangaRel = ch.relationships?.find((r: any) => r.type === "manga");
            if (!mangaRel) continue;
            if (!uniqueMangaIds.has(mangaRel.id)) {
              uniqueMangaIds.add(mangaRel.id);
              uniqueUpdates.push(ch);
            }
            if (uniqueUpdates.length >= 12) break; // Limit list to 12 items
          }

          // Fetch covers for these unique manga IDs in batch
          const coverMap = new Map<string, string>();
          const mangaIdsList = Array.from(uniqueMangaIds);
          if (mangaIdsList.length > 0) {
            try {
              const mangaDetailsRes = await fetchMangaDex("manga", {
                "ids[]": mangaIdsList,
                "includes[]": "cover_art",
                limit: mangaIdsList.length.toString()
              });
              if (mangaDetailsRes && mangaDetailsRes.data) {
                for (const m of mangaDetailsRes.data) {
                  const coverRel = m.relationships?.find((r: any) => r.type === "cover_art");
                  const fileName = coverRel?.attributes?.fileName;
                  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
                  const coverImage = fileName 
                    ? `${basePath}/api/manga/cdn/covers/${m.id}/${fileName}`
                    : "";
                  coverMap.set(m.id, coverImage);
                }
              }
            } catch (e) {
              console.error("Failed to load cover arts for updates:", e);
            }
          }

          const updates = uniqueUpdates
            .map((ch: any) => {
              const mangaRel = ch.relationships?.find((r: any) => r.type === "manga");
              if (!mangaRel) return null;
              const attrs = mangaRel.attributes || {};
              const title = attrs.title?.en || attrs.title?.ja || (attrs.title ? Object.values(attrs.title)[0] : "Unknown");
              const coverImage = coverMap.get(mangaRel.id) || "";
              return {
                mangaId: mangaRel.id,
                mangaTitle: typeof title === "string" ? title : "Unknown",
                coverImage,
                chapterNum: ch.attributes.chapter || "?",
                chapterTitle: ch.attributes.title || `Chapter ${ch.attributes.chapter || "?"}`,
                chapterId: ch.id,
                updatedAt: ch.attributes.readableAt || ch.attributes.createdAt
              };
            })
            .filter(Boolean);
          setLatestUpdates(updates as any);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
        setLoadingLatest(false);
      }
    };
    loadDashboardData();

    return () => window.removeEventListener("error", handleGlobalError);
  }, []);

  // Fetch aggregated rating whenever a manga is selected
  useEffect(() => {
    if (!selectedManga) {
      setRatingData(null);
      return;
    }
    const mangaId = selectedManga.id;
    const title = selectedManga.title_english || selectedManga.title;
    setLoadingRating(true);
    setRatingData(null);
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${basePath}/api/manga/score/${mangaId}?title=${encodeURIComponent(title)}`)
      .then(r => r.json())
      .then(data => setRatingData(data))
      .catch(e => console.error("[Rating] Failed:", e))
      .finally(() => setLoadingRating(false));
  }, [selectedManga?.id]);

  const saveHistory = (historyItem: ReadHistoryItem) => {
    const updated = [historyItem, ...readHistory.filter(h => h.id !== historyItem.id)].slice(0, 15);
    setReadHistory(updated);
    localStorage.setItem("daiki_manga_history", JSON.stringify(updated));
  };

  const toggleBookmark = (manga: MangaItem) => {
    let updated: MangaItem[];
    const exists = bookmarks.some(b => b.id === manga.id);
    if (exists) {
      updated = bookmarks.filter(b => b.id !== manga.id);
    } else {
      updated = [manga, ...bookmarks];
    }
    setBookmarks(updated);
    localStorage.setItem("daiki_manga_bookmarks", JSON.stringify(updated));
  };

  const handleGenreSelect = async (genre: string) => {
    setSelectedGenre(genre);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedManga(null);
    setActiveChapter(null);

    if (genre === "" || !GENRE_IDS[genre]) return;

    setLoadingGenre(true);
    try {
      const res = await fetchMangaDex("manga", {
        limit: "24",
        "includes[]": "cover_art",
        "includedTags[]": GENRE_IDS[genre],
        "contentRating[]": ["safe", "suggestive", "erotica", "pornographic"]
      });
      if (res?.data) {
        const seenGenre = new Set<string>();
        const mapped = res.data
          .map(mapMangaDexToMangaItem)
          .filter((m: MangaItem) => {
            if (seenGenre.has(m.id)) return false;
            seenGenre.add(m.id);
            return true;
          });
        setGenreResults(mapped);
        
        // Batch fetch ratings for genre results
        const ids = mapped.map((m: MangaItem) => m.id);
        if (ids.length > 0) {
          try {
            const statsRes = await fetchMangaDex("statistics/manga", {
              "manga[]": ids
            });
            if (statsRes && statsRes.statistics) {
              setGenreResults(mapped.map((item: MangaItem) => {
                const stats = statsRes.statistics[item.id];
                const bayesian = stats?.rating?.bayesian;
                return {
                  ...item,
                  averageScore: bayesian ? Math.round(bayesian * 10) : undefined
                };
              }));
            }
          } catch (e) {
            console.error("Failed to load genre statistics:", e);
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingGenre(false);
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSelectedGenre("");
    setSearching(true);
    setSearchError("");
    try {
      const results = await fetchMangaDex("manga", {
        title: searchQuery,
        limit: "24",
        "includes[]": "cover_art",
        "contentRating[]": ["safe", "suggestive", "erotica", "pornographic"]
      });
      if (results?.data) {
        const seenSearch = new Set<string>();
        const mapped = results.data
          .map(mapMangaDexToMangaItem)
          .filter((m: MangaItem) => {
            if (seenSearch.has(m.id)) return false;
            seenSearch.add(m.id);
            return true;
          });
        setSearchResults(mapped);
        if (mapped.length === 0) {
          setSearchError("Manga tidak ditemukan. Silakan gunakan keyword lain.");
        } else {
          // Batch fetch ratings for search results
          const ids = mapped.map((m: MangaItem) => m.id);
          try {
            const statsRes = await fetchMangaDex("statistics/manga", {
              "manga[]": ids
            });
            if (statsRes && statsRes.statistics) {
              setSearchResults(mapped.map((item: MangaItem) => {
                const stats = statsRes.statistics[item.id];
                const bayesian = stats?.rating?.bayesian;
                return {
                  ...item,
                  averageScore: bayesian ? Math.round(bayesian * 10) : undefined
                };
              }));
            }
          } catch (e) {
            console.error("Failed to load search statistics:", e);
          }
        }
      }
    } catch (err) {
      console.error(err);
      setSearchError("Gagal mencari manga. Silakan coba sesaat lagi.");
    } finally {
      setSearching(false);
    }
  };

  // Helper to load all chapters with pagination + dedup + retry for rate limits
  const fetchAllChapters = async (mangaId: string, lang: string, sort: "asc" | "desc") => {
    let rawChapters: any[] = [];
    const limit = 96; // MangaDex recommends ≤96 per request for reliability
    let offset = 0;
    let total = Infinity;
    
    // LANG PRIORITY ORDER: preferred lang > alternative lang (id/en) > any other lang
    // We fetch ALL languages first, then pick the best version per chapter number
    const LANG_PRIORITY = [lang, lang === "en" ? "id" : "en"];

    while (offset < total) {
      const feed = await fetchMangaDex(`manga/${mangaId}/feed`, {
        // No translatedLanguage filter — fetch ALL languages to get the best possible chapter
        limit: limit.toString(),
        offset: offset.toString(),
        "order[chapter]": "asc",
        "contentRating[]": ["safe", "suggestive", "erotica", "pornographic"],
        "includes[]": "scanlation_group"
      }, 3); // 3 retries for rate limiting
      
      if (!feed?.data || feed.data.length === 0) break;

      // Set total from first successful response
      if (total === Infinity && typeof feed.total === "number") {
        total = feed.total;
      }

      rawChapters = [...rawChapters, ...feed.data];
      offset += feed.data.length;

      // Stop if we've fetched everything
      if (offset >= total || feed.data.length === 0) break;

      // Small delay between paginated requests to avoid rate limits
      await new Promise(r => setTimeout(r, 300));
    }

    // Deduplicate: for each chapter number keep best version using priority score
    // Score system (higher = better):
    //   4 = hosted (pages > 0) + preferred language
    //   3 = hosted (pages > 0) + alt language (en/id)
    //   2 = hosted (pages > 0) + any other language
    //   1 = external + preferred language
    //   0 = external + any other language
    const getScore = (c: any): number => {
      const cLang: string = c.attributes.translatedLanguage;
      const isHosted = (c.attributes.pages || 0) > 0;
      const langRank = LANG_PRIORITY.indexOf(cLang); // 0=preferred, 1=alt, -1=other
      if (isHosted) {
        if (langRank === 0) return 4;
        if (langRank === 1) return 3;
        return 2;
      } else {
        if (langRank === 0) return 1;
        return 0;
      }
    };

    const chapterMap = new Map<string, { chapter: any; score: number }>();
    for (const c of rawChapters) {
      const num = c.attributes.chapter ?? "0";
      const score = getScore(c);
      const existing = chapterMap.get(num);
      if (!existing || score > existing.score) {
        chapterMap.set(num, { chapter: c, score });
      } else if (score === existing.score) {
        // Same priority → pick the one with more pages
        const pages = c.attributes.pages || 0;
        if (pages > (existing.chapter.attributes.pages || 0)) {
          chapterMap.set(num, { chapter: c, score });
        }
      }
    }

    // Convert to MangaDexChapter array and sort
    const deduped: MangaDexChapter[] = Array.from(chapterMap.values()).map(({ chapter: c }) => ({
      id: c.id,
      chapter: c.attributes.chapter ?? "0",
      title: c.attributes.title || `Chapter ${c.attributes.chapter ?? "?"}`,
      translatedLanguage: c.attributes.translatedLanguage,
      pages: c.attributes.pages || 0,
      externalUrl: c.attributes.externalUrl || null
    }));

    // Sort numerically
    deduped.sort((a, b) => {
      const aVal = parseFloat(a.chapter) || 0;
      const bVal = parseFloat(b.chapter) || 0;
      return sort === "asc" ? aVal - bVal : bVal - aVal;
    });

    return deduped;
  };

  // When a manga is selected, fetch its chapter list
  const handleSelectManga = async (manga: MangaItem) => {
    setSelectedManga(manga);
    setMangaDexId(manga.id);
    setChapters([]);
    setActiveChapter(null);
    setPages([]);
    window.scrollTo({ top: 0, behavior: "smooth" });

    setLoadingChapters(true);
    try {
      const allChapters = await fetchAllChapters(manga.id, "en", sortOrder);
      setChapters(allChapters);
    } catch (err) {
      console.error(err);
      setSearchError("Gagal memuat chapter manga.");
    } finally {
      setLoadingChapters(false);
    }
  };

  // Toggle chapter language feed (Indonesian / English)
  const handleLanguageChange = async (lang: "en" | "id") => {
    setChapterLang(lang);
    if (!mangaDexId) return;

    setLoadingChapters(true);
    try {
      const allChapters = await fetchAllChapters(mangaDexId, lang, sortOrder);
      setChapters(allChapters);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingChapters(false);
    }
  };

  // Toggle Sort order
  const handleSortChange = (order: "asc" | "desc") => {
    setSortOrder(order);
    const sorted = [...chapters].sort((a, b) => {
      const aVal = parseFloat(a.chapter) || 0;
      const bVal = parseFloat(b.chapter) || 0;
      return order === "asc" ? aVal - bVal : bVal - aVal;
    });
    setChapters(sorted);
  };

  // Select a chapter to read
  const handleSelectChapter = async (chapter: MangaDexChapter) => {
    setActiveChapter(chapter);
    setLoadingPages(true);
    setPages([]);
    setSinglePageIndex(0);
    window.scrollTo({ top: 0, behavior: "smooth" });

    try {
      const pageList = await fetchChapterPages(chapter.id);
      if (pageList?.chapter) {
        setPagesHash(pageList.chapter.hash);
        setPages(pageList.chapter.data);

        // Save progress to history
        if (selectedManga) {
          saveHistory({
            id: selectedManga.id,
            title: selectedManga.title,
            coverImage: selectedManga.coverImage,
            chapterId: chapter.id,
            chapterNum: chapter.chapter,
            pageIndex: 0,
            timestamp: Date.now()
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPages(false);
    }
  };

  const getPageProxyUrl = (filename: string) => {
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
    return `${basePath}/api/manga/cdn/data/${pagesHash}/${filename}`;
  };

  const isBookmarked = selectedManga && bookmarks.some(b => b.id === selectedManga.id);

  if (runtimeError) {
    const errContent = (
      <div className="bg-[#050507] text-red-500 p-8 min-h-screen font-mono text-xs overflow-auto flex flex-col justify-center items-center">
        <div className="max-w-2xl w-full border border-red-900/40 bg-red-950/10 p-6 rounded-2xl shadow-xl space-y-4">
          <h1 className="text-xl font-black text-red-400 uppercase tracking-wider">Manga System Error</h1>
          <pre className="bg-black/40 border border-zinc-900 p-4 rounded-xl text-zinc-300 overflow-x-auto whitespace-pre-wrap">{runtimeError}</pre>
          <button 
            onClick={() => {
              localStorage.removeItem("daiki_manga_history");
              localStorage.removeItem("daiki_manga_bookmarks");
              window.location.reload();
            }} 
            className="w-full py-2 bg-red-900 hover:bg-red-800 text-white rounded-xl font-sans font-bold cursor-pointer transition-colors"
          >
            Reset Settings & Reload
          </button>
        </div>
      </div>
    );
    return embedded ? errContent : <Layout>{errContent}</Layout>;
  }

  const pageContent = (
    <div className={`bg-[#050507] ${embedded ? "min-h-full" : "min-h-screen"} text-zinc-100 pb-20 relative overflow-hidden`}>
        {/* Ambient glow backgrounds */}
        <div className="absolute top-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-emerald-600/5 blur-[150px] pointer-events-none" />
        <div className="absolute top-[30%] left-[-20%] w-[50vw] h-[50vw] rounded-full bg-teal-600/5 blur-[150px] pointer-events-none" />

        {/* Search header banner */}
        <div className="border-b border-zinc-900 bg-[#07070a]/90 backdrop-blur py-6 px-4 relative z-10">
          <div className="container mx-auto max-w-6xl space-y-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-450 shadow-lg shadow-emerald-500/5">
                  <BookOpen className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-black uppercase tracking-wider text-white">Manga</h1>
                  <p className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-widest mt-0.5">Portal Baca Manga Lengkap</p>
                </div>
              </div>

              <form onSubmit={handleSearchSubmit} className="relative w-full md:max-w-md">
                <Input
                  type="text"
                  placeholder="Cari manga kesukaanmu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0d0d14]/75 border-zinc-800 focus:border-emerald-500/50 hover:border-zinc-700/80 rounded-2xl h-11 pl-4 pr-11 text-zinc-200 text-xs font-semibold focus:ring-1 focus:ring-emerald-500/20 shadow-inner"
                />
                <button
                  type="submit"
                  disabled={searching}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-emerald-400 transition-colors cursor-pointer"
                >
                  {searching ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
                  ) : (
                    <Search className="w-4.5 h-4.5" />
                  )}
                </button>
              </form>
            </div>

            {/* Genre ribbon */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1 -mx-4 px-4 sm:mx-0 sm:px-0">
              <button
                onClick={() => handleGenreSelect("")}
                className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                  selectedGenre === "" 
                    ? "bg-emerald-500 text-black font-extrabold shadow-lg shadow-emerald-500/15" 
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
                      ? "bg-emerald-500 text-black font-extrabold shadow-lg shadow-emerald-500/15" 
                      : "bg-[#0b0b10] border border-zinc-900 text-zinc-400 hover:text-white"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main content body */}
        <div className="container mx-auto max-w-6xl px-4 mt-8 relative z-20">
          
          {/* Active Reader Viewport */}
          {selectedManga && activeChapter && (
            <div className="space-y-6 animate-in fade-in duration-350">
              {/* Top navigation options bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-900 pb-4">
                <Button
                  variant="ghost"
                  onClick={() => setActiveChapter(null)}
                  className="group flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-900/60 hover:bg-zinc-900 hover:text-white text-xs font-black text-zinc-400 uppercase tracking-widest cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Detail Manga
                </Button>

                <div className="flex items-center gap-4">
                  {/* Select reading mode */}
                  <div className="flex bg-zinc-950 p-1 border border-zinc-900 rounded-lg">
                    <button
                      onClick={() => setReadMode("vertical")}
                      className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                        readMode === "vertical" ? "bg-emerald-500 text-black font-extrabold" : "text-zinc-500 hover:text-zinc-350"
                      }`}
                    >
                      Webtoon Mode
                    </button>
                    <button
                      onClick={() => setReadMode("single")}
                      className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                        readMode === "single" ? "bg-emerald-500 text-black font-extrabold" : "text-zinc-500 hover:text-zinc-350"
                      }`}
                    >
                      Single Page
                    </button>
                  </div>

                  <Badge className="bg-zinc-900 text-zinc-400 border border-zinc-850 py-1 px-3 text-[10px] uppercase font-black tracking-wider">
                    Chapter {activeChapter.chapter}
                  </Badge>
                </div>
              </div>

              {/* Loader page panel */}
              {loadingPages ? (
                <div className="aspect-[9/12] max-w-xl mx-auto rounded-3xl bg-[#0a0a0f] border border-zinc-900 flex flex-col items-center justify-center gap-4">
                  <div className="w-10 h-10 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Memuat halaman chapter...</p>
                </div>
              ) : pages.length === 0 ? (
                <div className="py-20 text-center bg-[#0a0a0f] border border-zinc-900 rounded-3xl p-8 max-w-md mx-auto">
                  <EyeOff className="w-10 h-10 text-zinc-650 mx-auto mb-4" />
                  <h3 className="text-white font-bold text-sm uppercase tracking-wide">Halaman Kosong</h3>
                  <p className="text-xs text-zinc-550 mt-1.5 leading-relaxed">Server gagal mengambil daftar halaman untuk chapter ini. Silakan coba kembali atau pilih chapter lain.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* READER WORKSPACE */}
                  {readMode === "vertical" ? (
                    /* Webtoon Mode: Vertically stacked image stream */
                    <div className="flex flex-col items-center gap-1.5 bg-[#030305] py-4 rounded-3xl border border-zinc-950 max-w-2xl mx-auto overflow-hidden shadow-2xl">
                      {pages.map((p, idx) => (
                        <div key={idx} className="w-full relative">
                          <img
                            src={getPageProxyUrl(p)}
                            alt={`Page ${idx + 1}`}
                            loading="lazy"
                            className="w-full h-auto max-w-full select-none select-none pointer-events-none"
                          />
                          <div className="absolute bottom-2 right-4 text-[9px] font-black text-white/40 font-mono bg-black/40 px-2 py-0.5 rounded-full select-none">
                            {idx + 1} / {pages.length}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Single Page Mode */
                    <div className="max-w-xl mx-auto space-y-4">
                      <div className="relative aspect-[9/12] w-full rounded-3xl overflow-hidden bg-black border border-zinc-900 shadow-2xl flex items-center justify-center">
                        <img
                          src={getPageProxyUrl(pages[singlePageIndex])}
                          alt={`Page ${singlePageIndex + 1}`}
                          className="max-h-full max-w-full object-contain select-none pointer-events-none"
                        />
                        
                        {/* Page indicator overlay */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs font-black text-white bg-black/60 backdrop-blur-md px-3.5 py-1 rounded-full font-mono">
                          Page {singlePageIndex + 1} of {pages.length}
                        </div>
                      </div>

                      {/* Navigation buttons */}
                      <div className="flex gap-4">
                        <Button
                          disabled={singlePageIndex === 0}
                          onClick={() => {
                            setSinglePageIndex(prev => prev - 1);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="flex-1 h-12 bg-zinc-900 border border-zinc-800 text-zinc-350 hover:bg-zinc-850 hover:text-white rounded-xl text-xs uppercase font-black tracking-widest gap-2 cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" /> Prev Page
                        </Button>
                        <Button
                          disabled={singlePageIndex === pages.length - 1}
                          onClick={() => {
                            setSinglePageIndex(prev => prev + 1);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="flex-1 h-12 bg-emerald-500 text-black hover:bg-emerald-400 rounded-xl text-xs uppercase font-black tracking-widest gap-2 cursor-pointer"
                        >
                          Next Page <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* End of Chapter Navigation actions */}
                  <div className="max-w-xl mx-auto border-t border-zinc-900 pt-6 flex justify-between items-center gap-4">
                    <Button
                      variant="ghost"
                      onClick={() => setActiveChapter(null)}
                      className="text-zinc-550 hover:text-white text-[10px] uppercase font-bold tracking-widest cursor-pointer"
                    >
                      Selesai Membaca
                    </Button>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={sortOrder === "desc" ? activeChapter.chapter === chapters[chapters.length - 1]?.chapter : activeChapter.chapter === chapters[0]?.chapter}
                        onClick={() => {
                          const idx = chapters.findIndex(c => c.id === activeChapter.id);
                          const nextIdx = sortOrder === "desc" ? idx + 1 : idx - 1;
                          if (chapters[nextIdx]) handleSelectChapter(chapters[nextIdx]);
                        }}
                        className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 text-zinc-400 text-[10px] font-bold uppercase py-2 px-3 rounded-lg cursor-pointer"
                      >
                        Prev Chapter
                      </Button>
                      <Button
                        size="sm"
                        disabled={sortOrder === "desc" ? activeChapter.chapter === chapters[0]?.chapter : activeChapter.chapter === chapters[chapters.length - 1]?.chapter}
                        onClick={() => {
                          const idx = chapters.findIndex(c => c.id === activeChapter.id);
                          const nextIdx = sortOrder === "desc" ? idx - 1 : idx + 1;
                          if (chapters[nextIdx]) handleSelectChapter(chapters[nextIdx]);
                        }}
                        className="bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-black uppercase py-2 px-3 rounded-lg cursor-pointer"
                      >
                        Next Chapter
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ACTIVE MANGA DETAILS FEED */}
          {selectedManga && !activeChapter && (
            <div className="space-y-6 animate-in fade-in duration-350">
              
              {/* Back navigation buttons */}
              <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                <Button
                  variant="ghost"
                  onClick={() => setSelectedManga(null)}
                  className="group flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-900/60 hover:bg-zinc-900 hover:text-white text-xs font-black text-zinc-400 uppercase tracking-widest cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Kembali
                </Button>

                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => toggleBookmark(selectedManga)}
                    className={`h-9 px-3 rounded-xl flex items-center justify-center gap-1.5 text-[10px] uppercase font-black transition-all cursor-pointer ${
                      isBookmarked
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                        : "bg-zinc-900 border border-zinc-850 text-zinc-450 hover:text-white"
                    }`}
                  >
                    {isBookmarked ? (
                      <>
                        <BookmarkCheck className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/20" /> Favorit
                      </>
                    ) : (
                      <>
                        <Bookmark className="w-3.5 h-3.5" /> Tambah Favorit
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Manga specifications grid */}
              <div className="grid lg:grid-cols-12 gap-8 items-start">
                
                {/* Left Poster Image Column */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="relative aspect-[3/4] w-full rounded-[28px] overflow-hidden border border-zinc-900 shadow-2xl bg-black">
                    <img
                      src={selectedManga.coverImage}
                      alt={selectedManga.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="bg-[#08080c]/50 border border-zinc-900 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-500 font-bold uppercase tracking-wider">Status:</span>
                      <Badge className="bg-zinc-900 border border-zinc-800 text-[9px] uppercase font-bold py-0.5 px-2">
                        {selectedManga.status}
                      </Badge>
                    </div>
                    {selectedManga.chaptersCount && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-500 font-bold uppercase tracking-wider">Chapters:</span>
                        <span className="text-zinc-200 font-semibold">{selectedManga.chaptersCount}</span>
                      </div>
                    )}
                    {selectedManga.volumesCount && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-500 font-bold uppercase tracking-wider">Volume:</span>
                        <span className="text-zinc-200 font-semibold">{selectedManga.volumesCount}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Metadata and Chapter Lists Column */}
                <div className="lg:col-span-8 space-y-6">
                  
                  {/* Detailed summary */}
                  <div className="space-y-4">
                    <h2 className="text-2xl font-black text-white leading-tight">{selectedManga.title}</h2>
                    {selectedManga.title_english && (
                      <p className="text-xs text-zinc-550 font-bold tracking-wider -mt-2">{selectedManga.title_english}</p>
                    )}

                    <div className="flex flex-wrap gap-1.5">
                      {selectedManga.genres.map(g => (
                        <Badge key={g} className="bg-zinc-950/70 border border-zinc-900 text-zinc-400 text-[9px] font-black uppercase py-0.5 px-2 rounded-md">
                          {g}
                        </Badge>
                      ))}
                    </div>

                    <p className="text-xs text-zinc-400 leading-relaxed bg-[#08080c]/30 border border-zinc-900/60 p-4 rounded-2xl">
                      {selectedManga.description || "Tidak ada sinopsis/deskripsi yang tersedia."}
                    </p>
                  </div>

                  {/* ── Multi-Source Rating Panel ─────────────────────────── */}
                  <div className="bg-[#08080c]/60 border border-zinc-900 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase tracking-widest text-zinc-300 flex items-center gap-2">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400/30" /> Rating Gabungan
                      </h3>
                      {ratingData && ratingData.totalSources > 0 && (
                        <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider">
                          dari {ratingData.totalSources} sumber
                        </span>
                      )}
                    </div>

                    {loadingRating ? (
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-zinc-900 animate-pulse" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 bg-zinc-900 rounded w-1/3 animate-pulse" />
                          <div className="h-2 bg-zinc-950 rounded w-2/3 animate-pulse" />
                          <div className="h-2 bg-zinc-950 rounded w-1/2 animate-pulse" />
                        </div>
                      </div>
                    ) : ratingData ? (
                      <div className="space-y-3">
                        {/* Combined big score */}
                        <div className="flex items-center gap-4">
                          <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center border shrink-0 ${
                            ratingData.combined === null ? "bg-zinc-900 border-zinc-800 text-zinc-600"
                            : ratingData.combined >= 8 ? "bg-emerald-950/40 border-emerald-900/60 text-emerald-400"
                            : ratingData.combined >= 6 ? "bg-amber-950/30 border-amber-900/40 text-amber-400"
                            : "bg-red-950/30 border-red-900/40 text-red-400"
                          }`}>
                            <span className="text-xl font-black leading-none">
                              {ratingData.combined ?? "?"}
                            </span>
                            <span className="text-[8px] font-bold uppercase tracking-wider opacity-70">/10</span>
                          </div>
                          <div>
                            <p className="text-sm font-black text-white">{ratingData.label}</p>
                            <p className="text-[10px] text-zinc-500 font-bold mt-0.5">Weighted avg dari semua sumber</p>
                            <div className="flex gap-1 mt-1.5">
                              {ratingData.sources.map(s => (
                                <span key={s.source} className="text-[8px] font-black uppercase tracking-wider bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">
                                  {s.source}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Per-source breakdown */}
                        {ratingData.sources.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-zinc-900">
                            {ratingData.sources.map(s => (
                              <a
                                key={s.source}
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between group hover:bg-zinc-900/40 px-2 py-1.5 rounded-lg transition-all"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black text-zinc-400 group-hover:text-white transition-colors w-20">{s.source}</span>
                                  <div className="flex-1 h-1 bg-zinc-900 rounded-full w-24 overflow-hidden">
                                    <div
                                      className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                                      style={{ width: `${(s.normalized / 10) * 100}%` }}
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-black text-zinc-200">{s.normalized}</span>
                                  <span className="text-[9px] text-zinc-600 font-bold">
                                    ({s.score}/{s.maxScore})
                                  </span>
                                  <span className="text-[8px] text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
                                </div>
                              </a>
                            ))}
                          </div>
                        )}

                        {ratingData.totalSources === 0 && (
                          <p className="text-[10px] text-zinc-600 font-bold">Rating belum tersedia untuk manga ini.</p>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {/* Chapters selection grid */}

                  <div className="bg-[#08080c]/50 border border-zinc-900 rounded-[28px] p-6 space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-900 pb-4">
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-zinc-300">Daftar Chapter</h3>
                        <p className="text-[9px] text-zinc-650 font-bold uppercase tracking-wider mt-0.5">Pilih chapter untuk mulai membaca</p>
                      </div>

                      <div className="flex gap-2">
                        {/* Chapter Language selector */}
                        <div className="flex bg-zinc-950 border border-zinc-900 p-0.5 rounded-lg">
                          <button
                            onClick={() => handleLanguageChange("en")}
                            className={`px-3 py-1 rounded text-[9px] font-black uppercase transition-all cursor-pointer ${
                              chapterLang === "en" ? "bg-zinc-900 border border-zinc-800 text-white" : "text-zinc-550 hover:text-zinc-300"
                            }`}
                          >
                            English
                          </button>
                          <button
                            onClick={() => handleLanguageChange("id")}
                            className={`px-3 py-1 rounded text-[9px] font-black uppercase transition-all cursor-pointer ${
                              chapterLang === "id" ? "bg-zinc-900 border border-zinc-800 text-white" : "text-zinc-550 hover:text-zinc-300"
                            }`}
                          >
                            Indo
                          </button>
                        </div>

                        {/* Sort Order Selector */}
                        <div className="flex bg-zinc-950 border border-zinc-900 p-0.5 rounded-lg">
                          <button
                            onClick={() => handleSortChange("asc")}
                            className={`px-2.5 py-1 rounded text-[9px] font-black uppercase transition-all cursor-pointer ${
                              sortOrder === "asc" ? "bg-zinc-900 border border-zinc-800 text-white" : "text-zinc-550 hover:text-zinc-300"
                            }`}
                          >
                            Asc
                          </button>
                          <button
                            onClick={() => handleSortChange("desc")}
                            className={`px-2.5 py-1 rounded text-[9px] font-black uppercase transition-all cursor-pointer ${
                              sortOrder === "desc" ? "bg-zinc-900 border border-zinc-800 text-white" : "text-zinc-550 hover:text-zinc-300"
                            }`}
                          >
                            Desc
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Chapter Feed grid wrapper */}
                    {loadingChapters ? (
                      <div className="py-12 text-center space-y-3">
                        <RefreshCw className="w-6 h-6 animate-spin text-emerald-500 mx-auto" />
                        <p className="text-[10px] text-zinc-550 font-bold uppercase tracking-widest">Menghubungkan ke server MangaDex...</p>
                      </div>
                    ) : chapters.length === 0 ? (
                      <div className="py-12 text-center space-y-2">
                        <EyeOff className="w-8 h-8 text-zinc-650 mx-auto mb-2" />
                        <p className="text-xs text-zinc-500 font-semibold">Tidak ada chapter dalam bahasa ini.</p>
                        <p className="text-[10px] text-zinc-650 uppercase font-black">Coba ganti bahasa ke "English"</p>
                      </div>
                    ) : (
                      <div 
                        className="flex gap-3 overflow-x-auto pb-4 w-full scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent"
                        style={{ scrollbarWidth: 'thin' }}
                      >
                        {chapters.map((chapter) => (
                          chapter.externalUrl ? (
                            // External/Official chapter — open in new tab
                            <a
                              key={chapter.id}
                              href={chapter.externalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group flex flex-col items-start p-3 bg-zinc-950 hover:bg-[#0a0a10] border border-zinc-900 hover:border-blue-500/40 rounded-xl transition-all text-left w-52 shrink-0 cursor-pointer relative overflow-hidden"
                            >
                              <div className="flex items-center gap-2 w-full">
                                <span className="text-[10px] font-mono text-blue-400 font-bold tracking-wider">Chapter {chapter.chapter}</span>
                                {chapter.translatedLanguage !== chapterLang && (
                                  <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 bg-blue-950/40 text-blue-400 border border-blue-900/50 rounded">
                                    {chapter.translatedLanguage}
                                  </span>
                                )}
                                <span className="text-[8px] font-black uppercase tracking-wider text-blue-400 bg-blue-950/40 border border-blue-900/50 px-1.5 py-0.5 rounded ml-auto">Official ↗</span>
                              </div>
                              <span className="text-xs font-bold text-zinc-300 group-hover:text-white truncate w-full mt-0.5">{chapter.title || `Chapter ${chapter.chapter}`}</span>
                              <span className="text-[9px] text-zinc-600 font-semibold uppercase tracking-wider mt-1">Buka di sumber resmi</span>
                            </a>
                          ) : (
                            // Hosted chapter — open in reader
                            <button
                              key={chapter.id}
                              onClick={() => handleSelectChapter(chapter)}
                              className="group flex flex-col items-start p-3 bg-zinc-950 hover:bg-[#0c0c12] border border-zinc-900 hover:border-emerald-500/30 rounded-xl transition-all text-left w-52 shrink-0 cursor-pointer relative overflow-hidden"
                            >
                              <div className="absolute right-2 top-2 w-1.5 h-1.5 rounded-full bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                              <div className="flex items-center gap-2 w-full">
                                <span className="text-[10px] font-mono text-emerald-500 font-bold tracking-wider">Chapter {chapter.chapter}</span>
                                {chapter.translatedLanguage !== chapterLang && (
                                  <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 bg-emerald-950/40 text-emerald-400 border border-emerald-900/50 rounded">
                                    {chapter.translatedLanguage}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs font-bold text-zinc-300 group-hover:text-white truncate w-full mt-0.5">{chapter.title || `Chapter ${chapter.chapter}`}</span>
                              <span className="text-[9px] text-zinc-600 font-semibold uppercase tracking-wider mt-1">{chapter.pages} Halaman</span>
                            </button>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SEARCH RESULTS VIEW */}
          {searchQuery && searchResults.length > 0 && !selectedManga && (
            <div className="space-y-6 mb-12">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <h2 className="text-sm font-black uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                  <Search className="w-4 h-4 text-emerald-450" /> Hasil Pencarian: "{searchQuery}"
                </h2>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                  className="text-zinc-550 hover:text-white font-extrabold text-[10px] uppercase tracking-wider h-auto p-1"
                >
                  Clear
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                {searchResults.map((manga) => (
                  <MangaCard key={manga.id} manga={manga} onClick={() => handleSelectManga(manga)} />
                ))}
              </div>
            </div>
          )}

          {searchQuery && searchResults.length === 0 && !searching && searchError && (
            <div className="text-center py-16 bg-[#0b0b10] border border-zinc-900 rounded-3xl p-8 max-w-md mx-auto mb-10 shadow-2xl">
              <Info className="w-10 h-10 text-emerald-500/80 mx-auto mb-4" />
              <p className="text-xs text-zinc-400 font-semibold">{searchError}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => { setSearchQuery(""); setSearchError(""); }} 
                className="mt-5 text-[10px] uppercase font-bold border-zinc-800 text-zinc-300 hover:text-white cursor-pointer"
              >
                Kembali ke Dashboard
              </Button>
            </div>
          )}

          {/* STATIC DASHBOARD VIEW (Visible when no manga selected or active search) */}
          {!selectedManga && !searchQuery && (
            <div className="space-y-12">
              
              {/* Genre selection results */}
              {selectedGenre && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                    <h2 className="text-sm font-black uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                      <List className="w-4 h-4 text-emerald-400" /> Genre: {selectedGenre}
                    </h2>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleGenreSelect("")}
                      className="text-zinc-550 hover:text-white font-extrabold text-[10px] uppercase tracking-wider h-auto p-1 cursor-pointer"
                    >
                      Clear
                    </Button>
                  </div>

                  {loadingGenre ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                      {Array.from({ length: 6 }).map((_, i) => <MangaSkeleton key={i} />)}
                    </div>
                  ) : genreResults.length === 0 ? (
                    <p className="text-xs text-zinc-550">Tidak ada manga di dalam kategori genre ini.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                      {genreResults.map((manga) => (
                        <MangaCard key={manga.id} manga={manga} onClick={() => handleSelectManga(manga)} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* History & Bookmarks */}
              {!selectedGenre && (
                <div className="grid md:grid-cols-12 gap-8 items-start">
                  
                  {/* Left Column: Trending/Popular grid list */}
                  <div className="md:col-span-8 space-y-10">

                    {/* Latest Updates section - Real-time from MangaDex */}
                    <div className="space-y-4">
                      <h2 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-emerald-400" /> Update Terbaru
                        <span className="ml-auto text-[9px] font-bold text-emerald-600 bg-emerald-950/30 border border-emerald-900/40 px-2 py-0.5 rounded-full">LIVE</span>
                      </h2>
                      {loadingLatest ? (
                        <div className="grid grid-cols-1 gap-2">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="h-14 bg-zinc-950 border border-zinc-900 rounded-xl animate-pulse" />
                          ))}
                        </div>
                      ) : latestUpdates.length === 0 ? (
                        <p className="text-xs text-zinc-600 font-bold">Gagal memuat update terbaru.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {latestUpdates.slice(0, 12).map((item, i) => (
                            <button
                              key={`${item.mangaId}-${item.chapterId}-${i}`}
                              onClick={() => {
                                // Load manga detail from latest update item
                                handleSelectManga({
                                  id: item.mangaId,
                                  title: item.mangaTitle,
                                  coverImage: item.coverImage,
                                  description: "",
                                  status: "ongoing",
                                  genres: []
                                });
                              }}
                              className="w-full flex items-center gap-3 p-2.5 bg-zinc-950/60 hover:bg-zinc-900/60 border border-zinc-900/60 hover:border-emerald-500/20 rounded-xl transition-all text-left cursor-pointer group"
                            >
                              {item.coverImage ? (
                                <img src={item.coverImage} alt={item.mangaTitle} className="w-9 h-12 rounded-lg object-cover bg-zinc-900 border border-zinc-900 shrink-0" />
                              ) : (
                                <div className="w-9 h-12 rounded-lg bg-zinc-900 border border-zinc-900 shrink-0 flex items-center justify-center">
                                  <BookOpen className="w-4 h-4 text-zinc-700" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-black text-zinc-200 group-hover:text-white truncate">{item.mangaTitle}</p>
                                <p className="text-[10px] text-emerald-500 font-bold mt-0.5">Chapter {item.chapterNum}</p>
                              </div>
                              <span className="text-[9px] text-zinc-600 font-bold shrink-0 hidden sm:block">
                                {new Date(item.updatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-emerald-500 transition-colors shrink-0" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Trending section */}
                    <div className="space-y-6">
                      <h2 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                        <Flame className="w-4.5 h-4.5 text-amber-500 fill-amber-500/20" /> Manga Populer Hari Ini
                      </h2>
                      
                      {loading ? (
                        <div 
                          className="flex gap-5 overflow-x-auto pb-4 w-full scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent"
                          style={{ scrollbarWidth: 'thin' }}
                        >
                          {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="w-[140px] sm:w-[170px] shrink-0">
                              <MangaSkeleton />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div 
                          className="flex gap-5 overflow-x-auto pb-4 w-full scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent"
                          style={{ scrollbarWidth: 'thin' }}
                        >
                          {topAiring.slice(0, 12).map((manga) => (
                            <div key={manga.id} className="w-[140px] sm:w-[170px] shrink-0">
                              <MangaCard manga={manga} onClick={() => handleSelectManga(manga)} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Popular All-time list */}
                    <div className="space-y-6">
                      <h2 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                        <Star className="w-4.5 h-4.5 text-emerald-450 fill-emerald-500/10" /> Pilihan Editor &amp; Terfavorit
                      </h2>

                      {loading ? (
                        <div 
                          className="flex gap-5 overflow-x-auto pb-4 w-full scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent"
                          style={{ scrollbarWidth: 'thin' }}
                        >
                          {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="w-[140px] sm:w-[170px] shrink-0">
                              <MangaSkeleton />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div 
                          className="flex gap-5 overflow-x-auto pb-4 w-full scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent"
                          style={{ scrollbarWidth: 'thin' }}
                        >
                          {topPopular.slice(0, 12).map((manga) => (
                            <div key={manga.id} className="w-[140px] sm:w-[170px] shrink-0">
                              <MangaCard manga={manga} onClick={() => handleSelectManga(manga)} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: History & Bookmarks */}
                  <div className="md:col-span-4 space-y-8">
                    
                    {/* Watch History */}
                    <div className="bg-[#08080c]/50 border border-zinc-900 rounded-3xl p-5 space-y-4">
                      <h3 className="text-xs font-black uppercase tracking-widest text-zinc-300 flex items-center gap-2">
                        <History className="w-4 h-4 text-emerald-400" /> Riwayat Baca
                      </h3>

                      {readHistory.length === 0 ? (
                        <p className="text-[10px] text-zinc-650 font-bold uppercase tracking-wider py-4">Belum ada riwayat membaca manga.</p>
                      ) : (
                        <div className="space-y-3">
                          {readHistory.map((history) => (
                            <div 
                              key={history.id}
                              className="flex items-center gap-3 p-2 bg-zinc-950/40 border border-zinc-900/50 hover:border-zinc-800 rounded-xl transition-all"
                            >
                              <img src={history.coverImage} alt={history.title} className="w-10 h-14 rounded-lg object-cover bg-zinc-900 border border-zinc-900 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <h4 className="text-xs font-black text-white truncate">{history.title}</h4>
                                <p className="text-[10px] text-emerald-500 font-bold mt-0.5">Chapter {history.chapterNum}</p>
                                <p className="text-[8px] text-zinc-600 font-semibold mt-1 uppercase tracking-wider">{new Date(history.timestamp).toLocaleDateString()}</p>
                              </div>
                              <button
                                onClick={async () => {
                                  // Restore manga details state
                                  setLoadingChapters(true);
                                  setSelectedManga({
                                    id: history.id,
                                    title: history.title,
                                    coverImage: history.coverImage,
                                    description: "",
                                    status: "",
                                    genres: []
                                  });
                                  setMangaDexId(history.id);

                                  try {
                                    const allChapters = await fetchAllChapters(history.id, chapterLang, sortOrder);
                                    setChapters(allChapters);
                                    
                                    const targetCh = allChapters.find(c => c.id === history.chapterId);
                                    if (targetCh) {
                                      handleSelectChapter(targetCh);
                                    }
                                  } catch (err) {
                                    console.error(err);
                                  } finally {
                                    setLoadingChapters(false);
                                  }
                                }}
                                className="h-7 w-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition-all"
                                title="Lanjutkan Membaca"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bookmarked Favorites */}
                    <div className="bg-[#08080c]/50 border border-zinc-900 rounded-3xl p-5 space-y-4">
                      <h3 className="text-xs font-black uppercase tracking-widest text-zinc-300 flex items-center gap-2">
                        <Bookmark className="w-4 h-4 text-emerald-450 fill-emerald-500/10" /> Koleksi Favorit
                      </h3>

                      {bookmarks.length === 0 ? (
                        <p className="text-[10px] text-zinc-650 font-bold uppercase tracking-wider py-4">Belum ada manga favorit yang disimpan.</p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {bookmarks.map((fav) => (
                            <button
                              key={fav.id}
                              onClick={() => handleSelectManga(fav)}
                              className="group relative aspect-[3/4] rounded-xl overflow-hidden border border-zinc-900 bg-zinc-950 shrink-0 cursor-pointer"
                              title={fav.title}
                            >
                              <img src={fav.coverImage} alt={fav.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-[8px] font-black text-white truncate w-full">{fav.title}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
    </div>
  );

  return embedded ? pageContent : <Layout>{pageContent}</Layout>;
}

// Internal Subcomponents for Clean Layout
function MangaCard({ manga, onClick }: { manga: MangaItem; onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className="group space-y-3 cursor-pointer select-none animate-in fade-in zoom-in-95 duration-200"
    >
      <div className="relative aspect-[3/4] w-full rounded-[20px] overflow-hidden border border-zinc-900/60 bg-zinc-950 shadow-md group-hover:shadow-emerald-550/5 group-hover:border-emerald-500/35 transition-all duration-300">
        <img
          src={manga.coverImage}
          alt={manga.title}
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          loading="lazy"
        />
        {/* Glow ambient accent */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-85 transition-opacity" />
        
        {/* Chapter numbers count or score */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 z-10">
          <Badge className="bg-emerald-500 text-black border-0 font-extrabold text-[9px] py-0.5 px-2 hover:bg-emerald-400">
            ★ {manga.averageScore ? (manga.averageScore / 10).toFixed(1) : "N/A"}
          </Badge>
          
          <Badge className="bg-zinc-950/85 backdrop-blur-md text-zinc-300 border border-zinc-800 text-[8px] font-black tracking-widest py-0.5 px-2 uppercase">
            {manga.status}
          </Badge>
        </div>
      </div>

      <div className="space-y-1 px-1">
        <h3 className="text-xs font-black text-zinc-200 group-hover:text-emerald-400 transition-colors line-clamp-1">
          {manga.title}
        </h3>
        <p className="text-[9px] text-zinc-550 font-bold uppercase tracking-widest truncate">
          {manga.genres[0] || "General"} &bull; {manga.chaptersCount ? `${manga.chaptersCount} Chs` : "Ongoing"}
        </p>
      </div>
    </div>
  );
}

function MangaSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="aspect-[3/4] w-full bg-zinc-950 border border-zinc-900 rounded-[20px]" />
      <div className="space-y-1.5 px-1">
        <div className="h-3 bg-zinc-900 rounded w-4/5" />
        <div className="h-2 bg-zinc-950 rounded w-1/2" />
      </div>
    </div>
  );
}
