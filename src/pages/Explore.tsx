import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  AnimeMedia,
  fetchDiscoverAnime,
  fetchAnimeDetails,
  resolveStudioFilterName,
  resolveGenreFilterName,
  getNexusPosterForAnime,
} from '../lib/api';
import {
  getSearchHistory,
  addSearchHistory,
  removeSearchHistoryItem,
  clearSearchHistory,
  getWatchlistItemStatus,
  setWatchlistItem,
} from '../lib/storage';
import { PosterCard } from '../components/PosterCard';
import { LazyImage } from '../components/LazyImage';
import { SearchIcon } from '../components/icons';
import { AnimatedSelect } from '../components/AnimatedSelect';

const PROMPTS = [
  'Anime series, movies, OVAs and more...',
  "Search 'Jujutsu Kaisen'...",
  "Search 'Attack on Titan'...",
  'Looking for a dark fantasy?',
  'Find your next binge...',
  "Search 'Frieren: Beyond Journey's End'...",
  'What are we watching today?',
  "Search 'Solo Leveling'...",
  'In the mood for a psychological thriller?',
  "Search 'Demon Slayer'...",
  'Looking for a feel-good comedy?',
  "Search 'Hunter x Hunter'...",
  'Discover hidden gems...',
  "Search 'One Piece'...",
  "Search 'Haikyu!!'...",
];

const GENRE_OPTIONS = [
  { value: 'All', label: 'Genre' },
  { value: 'Action', label: 'Action' },
  { value: 'Adventure', label: 'Adventure' },
  { value: 'Comedy', label: 'Comedy' },
  { value: 'Drama', label: 'Drama' },
  { value: 'Fantasy', label: 'Fantasy' },
  { value: 'Horror', label: 'Horror' },
  { value: 'Mecha', label: 'Mecha' },
  { value: 'Music', label: 'Music' },
  { value: 'Mystery', label: 'Mystery' },
  { value: 'Psychological', label: 'Psychological' },
  { value: 'Romance', label: 'Romance' },
  { value: 'Sci-Fi', label: 'Sci-Fi' },
  { value: 'Slice of Life', label: 'Slice of Life' },
  { value: 'Sports', label: 'Sports' },
  { value: 'Supernatural', label: 'Supernatural' },
  { value: 'Thriller', label: 'Thriller' },
];

const FORMAT_OPTIONS = [
  { value: 'All', label: 'Format' },
  { value: 'TV', label: 'TV Series' },
  { value: 'MOVIE', label: 'Movie' },
  { value: 'OVA', label: 'OVA' },
  { value: 'ONA', label: 'ONA' },
  { value: 'SPECIAL', label: 'Special' },
];

const STATUS_OPTIONS = [
  { value: 'All', label: 'Status' },
  { value: 'RELEASING', label: 'Releasing' },
  { value: 'FINISHED', label: 'Finished' },
  { value: 'NOT_YET_RELEASED', label: 'Upcoming' },
];

const YEAR_OPTIONS = [
  { value: 'All', label: 'Year' },
  ...Array.from({ length: 37 }, (_, i) => {
    const y = String(2026 - i);
    return { value: y, label: y };
  }),
];

const EPISODE_OPTIONS = [
  { value: 'All', label: 'Episodes' },
  { value: '1-12', label: '1 - 12 Eps' },
  { value: '13-26', label: '13 - 26 Eps' },
  { value: '27-100', label: '27 - 100 Eps' },
  { value: '100+', label: '100+ Eps' },
];

const STUDIO_OPTIONS = [
  { value: 'All', label: 'Studio' },
  { value: 'MAPPA', label: 'MAPPA' },
  { value: 'ufotable', label: 'ufotable' },
  { value: 'WIT STUDIO', label: 'WIT STUDIO' },
  { value: 'MADHOUSE', label: 'MADHOUSE' },
  { value: 'bones', label: 'bones' },
  { value: 'A-1 Pictures', label: 'A-1 Pictures' },
  { value: 'CloverWorks', label: 'CloverWorks' },
  { value: 'Kyoto Animation', label: 'Kyoto Animation' },
  { value: 'Toei Animation', label: 'Toei Animation' },
  { value: 'Studio Ghibli', label: 'Studio Ghibli' },
  { value: 'Production I.G', label: 'Production I.G' },
  { value: 'Trigger', label: 'Trigger' },
  { value: 'Sunrise', label: 'Sunrise' },
  { value: 'Pierrot', label: 'Pierrot' },
  { value: 'J.C.Staff', label: 'J.C.Staff' },
  { value: 'White Fox', label: 'White Fox' },
  { value: 'David Production', label: 'David Production' },
  { value: 'Science SARU', label: 'Science SARU' },
];

const SORT_OPTIONS = [
  { value: 'POPULARITY_DESC', label: 'Popular' },
  { value: 'TRENDING_DESC', label: 'Trending' },
  { value: 'SCORE_DESC', label: 'Top Rated' },
  { value: 'START_DATE_DESC', label: 'Newest' },
];

function formatAnimeStatus(status?: string | null): string {
  if (!status) return 'Finished';
  const s = status.toUpperCase();
  if (s === 'RELEASING') return 'Releasing';
  if (s === 'FINISHED') return 'Finished';
  if (s === 'NOT_YET_RELEASED') return 'Upcoming';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function formatAnimeType(format?: string | null): string {
  if (!format) return 'TV';
  if (format === 'TV_SHORT') return 'TV';
  return format.toUpperCase();
}

/* -------------------------------------------------------------------------- */
/* DETAILED DISCOVER CARD (Matches Kotatsu Discover Card Layout)              */
/* -------------------------------------------------------------------------- */
const DiscoverDetailCard: React.FC<{ item: AnimeMedia }> = ({ item }) => {
  const [inWatchlist, setInWatchlist] = useState(() => Boolean(getWatchlistItemStatus(item.id)));

  useEffect(() => {
    const sync = () => setInWatchlist(Boolean(getWatchlistItemStatus(item.id)));
    window.addEventListener('bingr-storage-update', sync);
    return () => window.removeEventListener('bingr-storage-update', sync);
  }, [item.id]);

  const handleToggleWatchlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (inWatchlist) {
      setWatchlistItem(item, null);
      setInWatchlist(false);
      toast(`Removed "${item.title}" from Watchlist`);
    } else {
      setWatchlistItem(item, 'watchlist');
      setInWatchlist(true);
      toast(`Added "${item.title}" to Watchlist`);
    }
  };

  const studioName =
    item.studios?.[0]?.name || (item.genres?.[0] ? item.genres[0] : item.year ? String(item.year) : 'Studio');
  const statusLabel = formatAnimeStatus(item.status);
  const episodesLabel =
    item.episodes != null && item.episodes > 0
      ? String(item.episodes)
      : item.format === 'MOVIE'
      ? '1'
      : '--';

  const displayPoster = getNexusPosterForAnime(item.title, item.id) || item.poster;

  return (
    <Link
      to={`/anime/${item.id}`}
      className="group relative flex items-stretch gap-4 p-3.5 rounded-2xl bg-[#0b0b0d] border-2 border-[#18181b] hover:border-[#6b7280] hover:bg-[#101014] transition-all duration-200 shadow-[0_8px_24px_rgba(0,0,0,0.65)]"
    >
      {/* Left 2:3 Poster */}
      <div className="relative w-[104px] sm:w-[116px] aspect-[2/3] rounded-xl overflow-hidden bg-[#141417] shrink-0">
        {displayPoster ? (
          <LazyImage
            src={displayPoster}
            alt={item.title}
            className="w-full h-full"
            imgClassName="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/25 font-bold text-xl">
            {item.title?.[0] || '?'}
          </div>
        )}
      </div>

      {/* Right Details Column */}
      <div className="flex flex-col flex-1 min-w-0 justify-between py-0.5">
        <div>
          {/* Top Row: Format Badge + Bookmark Button */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08] text-[10.5px] font-bold uppercase tracking-wider text-white/80">
              {formatAnimeType(item.format)}
            </span>

            <motion.button
              type="button"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleToggleWatchlist}
              aria-label={inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
              title={inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
              className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors cursor-pointer ${
                inWatchlist
                  ? 'bg-white text-black border-white'
                  : 'bg-white/[0.05] hover:bg-white/[0.12] border-white/[0.08] text-white/65 hover:text-white'
              }`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill={inWatchlist ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </motion.button>
          </div>

          {/* Title */}
          <h3 className="text-[15px] sm:text-[16px] font-bold text-white leading-snug line-clamp-1 group-hover:text-white/90 transition-colors">
            {item.title}
          </h3>

          {/* Studio Row */}
          <div className="flex items-center gap-1.5 mt-1 text-[12px] font-medium text-white/50">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-white/40"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span className="truncate">{studioName}</span>
          </div>
        </div>

        {/* Bottom Recessed Status / Episodes Box */}
        <div className="mt-3 rounded-xl bg-[#131316] border border-white/[0.05] px-3.5 py-2 grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <p className="text-[9.5px] font-bold uppercase tracking-wider text-white/35">
              Status
            </p>
            <p className="text-[12.5px] font-bold text-white/90 truncate mt-0.5">
              {statusLabel}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[9.5px] font-bold uppercase tracking-wider text-white/35">
              Episodes
            </p>
            <p className="text-[12.5px] font-bold text-white/90 tabular-nums truncate mt-0.5">
              {episodesLabel}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
};

/* -------------------------------------------------------------------------- */
/* EXPLORE / DISCOVER PAGE                                                    */
/* -------------------------------------------------------------------------- */
export const Explore: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState(() => searchParams.get('q') || '');
  const [debouncedQuery, setDebouncedQuery] = useState(() => searchParams.get('q') || '');
  const [promptIdx, setPromptIdx] = useState(0);

  // Discover Filters initialized from URL searchParams
  const [selectedGenre, setSelectedGenre] = useState<string>(() =>
    resolveGenreFilterName(searchParams.get('genre'))
  );
  const [formatFilter, setFormatFilter] = useState<string>(
    () => searchParams.get('format') || 'All'
  );
  const [statusFilter, setStatusFilter] = useState<string>(
    () => searchParams.get('status') || 'All'
  );
  const [yearFilter, setYearFilter] = useState<string>(
    () => searchParams.get('year') || 'All'
  );
  const [episodesFilter, setEpisodesFilter] = useState<string>(
    () => searchParams.get('episodes') || 'All'
  );
  const [studioFilter, setStudioFilter] = useState<string>(() =>
    resolveStudioFilterName(searchParams.get('studio'))
  );
  const [sortFilter, setSortFilter] = useState<
    'POPULARITY_DESC' | 'TRENDING_DESC' | 'SCORE_DESC' | 'START_DATE_DESC'
  >(() => (searchParams.get('sort') as any) || 'POPULARITY_DESC');

  // Sync URL searchParams into state if user navigates with new query params
  useEffect(() => {
    const g = resolveGenreFilterName(searchParams.get('genre'));
    const st = resolveStudioFilterName(searchParams.get('studio'));
    const f = searchParams.get('format') || 'All';
    const s = searchParams.get('status') || 'All';
    const y = searchParams.get('year') || 'All';
    const ep = searchParams.get('episodes') || 'All';
    const srt = (searchParams.get('sort') as any) || 'POPULARITY_DESC';
    const qParam = searchParams.get('q');

    setSelectedGenre(g);
    setStudioFilter(st);
    setFormatFilter(f);
    setStatusFilter(s);
    setYearFilter(y);
    setEpisodesFilter(ep);
    setSortFilter(srt);
    if (qParam !== null) {
      setQuery(qParam);
      setDebouncedQuery(qParam);
    }
  }, [searchParams]);

  const updateUrlParams = (overrides: Record<string, string>) => {
    const next: Record<string, string> = {
      genre: selectedGenre,
      format: formatFilter,
      status: statusFilter,
      year: yearFilter,
      episodes: episodesFilter,
      studio: studioFilter,
      sort: sortFilter,
      ...overrides,
    };
    const params = new URLSearchParams();
    if (debouncedQuery) params.set('q', debouncedQuery);
    if (next.genre && next.genre !== 'All') params.set('genre', next.genre);
    if (next.format && next.format !== 'All') params.set('format', next.format);
    if (next.status && next.status !== 'All') params.set('status', next.status);
    if (next.year && next.year !== 'All') params.set('year', next.year);
    if (next.episodes && next.episodes !== 'All') params.set('episodes', next.episodes);
    if (next.studio && next.studio !== 'All') params.set('studio', next.studio);
    if (next.sort && next.sort !== 'POPULARITY_DESC') params.set('sort', next.sort);
    setSearchParams(params, { replace: true });
  };

  // View Mode ('card' = 3-col Detailed Cards, 'grid' = 7-col Posters)
  const [viewMode, setViewMode] = useState<'card' | 'grid'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kotatsu_explore_view_mode');
      if (saved === 'card' || saved === 'grid') return saved;
    }
    return 'card';
  });

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [items, setItems] = useState<AnimeMedia[]>([]);
  const [topDetails, setTopDetails] = useState<AnimeMedia | null>(null);
  const [topInWatchlist, setTopInWatchlist] = useState<boolean>(false);
  const [history, setHistory] = useState<string[]>(getSearchHistory());
  const [loading, setLoading] = useState<boolean>(true);
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 768
  );
  const resultsTopRef = useRef<HTMLDivElement>(null);

  const changeViewMode = (mode: 'card' | 'grid') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kotatsu_explore_view_mode', mode);
    }
  };

  useEffect(() => {
    document.title = 'Explore — Kotatsu';
    const onResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Cycle animated placeholder every 3.5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setPromptIdx((prev) => (prev + 1) % PROMPTS.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  // Debounce input query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  // Reset to page 1 when search query or any filter changes
  useEffect(() => {
    setPage(1);
  }, [
    debouncedQuery,
    selectedGenre,
    formatFilter,
    statusFilter,
    yearFilter,
    episodesFilter,
    studioFilter,
    sortFilter,
  ]);

  // Save search term after user pauses on a valid query
  useEffect(() => {
    if (debouncedQuery.length > 2) {
      const timer = setTimeout(() => {
        setHistory(addSearchHistory(debouncedQuery));
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [debouncedQuery]);

  // Fetch paginated results whenever page, debouncedQuery, or any filter changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await fetchDiscoverAnime({
          page,
          perPage: 24,
          search: debouncedQuery || undefined,
          genre: selectedGenre !== 'All' ? selectedGenre : undefined,
          format: formatFilter !== 'All' ? (formatFilter as any) : undefined,
          status: statusFilter !== 'All' ? (statusFilter as any) : undefined,
          year: yearFilter !== 'All' ? yearFilter : undefined,
          episodesRange: episodesFilter !== 'All' ? (episodesFilter as any) : undefined,
          studio: studioFilter !== 'All' ? studioFilter : undefined,
          sort: sortFilter,
          richMeta: true,
        });
        if (!cancelled) {
          setItems(res.results);
          setTotalPages(Math.max(1, res.total_pages || 1));
        }
      } catch {
        if (!cancelled) {
          setItems([]);
          setTotalPages(1);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    page,
    debouncedQuery,
    selectedGenre,
    formatFilter,
    statusFilter,
    yearFilter,
    episodesFilter,
    studioFilter,
    sortFilter,
  ]);

  const showTopResult = Boolean(isDesktop && debouncedQuery && page === 1 && items.length > 0);
  const topResult = showTopResult ? items[0] : null;
  const gridItems = showTopResult ? items.slice(1) : items;

  useEffect(() => {
    if (!topResult?.id) {
      setTopDetails(null);
      setTopInWatchlist(false);
      return;
    }
    setTopInWatchlist(Boolean(getWatchlistItemStatus(topResult.id)));
    let cancelled = false;
    fetchAnimeDetails(topResult.id)
      .then((d) => {
        if (!cancelled) setTopDetails(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [topResult?.id]);

  const handleToggleTopWatchlist = () => {
    if (!topResult) return;
    if (topInWatchlist) {
      setWatchlistItem(topResult, null);
      setTopInWatchlist(false);
      toast(`Removed "${topResult.title}" from Watchlist`);
    } else {
      setWatchlistItem(topResult, 'watchlist');
      setTopInWatchlist(true);
      toast(`Added "${topResult.title}" to Watchlist`);
    }
  };

  const handleSaveImmediate = (val: string) => {
    const trimmed = val.trim();
    if (trimmed) {
      setHistory(addSearchHistory(trimmed));
    }
  };

  const hasActiveFilters =
    selectedGenre !== 'All' ||
    formatFilter !== 'All' ||
    statusFilter !== 'All' ||
    yearFilter !== 'All' ||
    episodesFilter !== 'All' ||
    studioFilter !== 'All' ||
    sortFilter !== 'POPULARITY_DESC';

  const resetAllFilters = () => {
    setSelectedGenre('All');
    setFormatFilter('All');
    setStatusFilter('All');
    setYearFilter('All');
    setEpisodesFilter('All');
    setStudioFilter('All');
    setSortFilter('POPULARITY_DESC');
    setPage(1);
    const params = new URLSearchParams();
    if (debouncedQuery) params.set('q', debouncedQuery);
    setSearchParams(params, { replace: true });
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    setPage(nextPage);
    if (resultsTopRef.current) {
      resultsTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getPageNumbers = (): (number | 'ellipsis-start' | 'ellipsis-end')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | 'ellipsis-start' | 'ellipsis-end')[] = [1];
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);

    if (start > 2) pages.push('ellipsis-start');
    for (let p = start; p <= end; p++) {
      pages.push(p);
    }
    if (end < totalPages - 1) pages.push('ellipsis-end');
    pages.push(totalPages);
    return pages;
  };

  const topBannerImage =
    topDetails?.backdrop_original ||
    topDetails?.backdrop ||
    (topResult?.backdrop && topResult.backdrop !== topResult.poster ? topResult.backdrop : null);

  const dynamicStudioOptions = React.useMemo(() => {
    if (
      studioFilter !== 'All' &&
      !STUDIO_OPTIONS.some((s) => s.value.toLowerCase() === studioFilter.toLowerCase())
    ) {
      return [...STUDIO_OPTIONS, { value: studioFilter, label: studioFilter }];
    }
    return STUDIO_OPTIONS;
  }, [studioFilter]);

  // Each active filter becomes a clearly labelled, individually removable chip
  const activeFilterChips = React.useMemo(() => {
    const labelOf = (opts: { value: string; label: string }[], v: string) =>
      opts.find((o) => o.value === v)?.label ?? v;
    const chips: { key: string; category: string; value: string; clear: () => void }[] = [];
    const add = (key: string, category: string, value: string, reset: string, set: (v: any) => void) =>
      chips.push({
        key,
        category,
        value,
        clear: () => {
          set(reset);
          updateUrlParams({ [key]: reset });
        },
      });

    if (selectedGenre !== 'All') add('genre', 'Genre', selectedGenre, 'All', setSelectedGenre);
    if (studioFilter !== 'All') add('studio', 'Studio', studioFilter, 'All', setStudioFilter);
    if (formatFilter !== 'All')
      add('format', 'Format', labelOf(FORMAT_OPTIONS, formatFilter), 'All', setFormatFilter);
    if (statusFilter !== 'All')
      add('status', 'Status', labelOf(STATUS_OPTIONS, statusFilter), 'All', setStatusFilter);
    if (yearFilter !== 'All') add('year', 'Year', yearFilter, 'All', setYearFilter);
    if (episodesFilter !== 'All')
      add('episodes', 'Episodes', labelOf(EPISODE_OPTIONS, episodesFilter), 'All', setEpisodesFilter);
    if (sortFilter !== 'POPULARITY_DESC')
      add('sort', 'Sorted by', labelOf(SORT_OPTIONS, sortFilter), 'POPULARITY_DESC', setSortFilter);
    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGenre, studioFilter, formatFilter, statusFilter, yearFilter, episodesFilter, sortFilter, debouncedQuery]);

  const sectionHeading = React.useMemo(() => {
    if (showTopResult) return `More Results for "${debouncedQuery}"`;
    if (debouncedQuery) return `Results for "${debouncedQuery}"`;
    if (activeFilterChips.length > 0) return 'Filtered Results';
    return 'Popular Anime';
  }, [showTopResult, debouncedQuery, activeFilterChips.length]);

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-x-hidden select-none">
      <main className="px-4 sm:px-6 md:pl-28 md:pr-12 pt-10 pb-24 md:pb-16 min-h-screen max-w-[1600px]">
        {/* Full-Width Search Input Box */}
        <div className="w-full mb-4 mt-2 relative">
          <div className="flex items-center bg-[#0a0a0c] rounded-xl border-2 border-[#18181b] focus-within:border-[#6b7280] focus-within:bg-[#111114] transition-all px-4 py-2.5 md:py-3 shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
            <span className="text-white/40 mr-3 shrink-0">
              <SearchIcon className="w-6 h-6" active={Boolean(query)} />
            </span>

            <div className="relative flex-1 flex items-center h-8 overflow-hidden">
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveImmediate(query);
                }}
                aria-label="Search anime"
                className="w-full h-full bg-transparent text-[15px] md:text-[16px] font-medium text-white focus:outline-none relative z-10"
              />
              {!query && (
                <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none">
                  <AnimatePresence mode="popLayout">
                    <motion.span
                      key={promptIdx}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.4, ease: 'easeInOut' }}
                      className="text-white/40 text-[15px] md:text-[16px] font-medium whitespace-nowrap"
                    >
                      {PROMPTS[promptIdx]}
                    </motion.span>
                  </AnimatePresence>
                </div>
              )}
            </div>

            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="ml-2 text-white/40 hover:text-white/90 p-1 rounded-full hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                aria-label="Clear search"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Discover Filter Row + View Switcher */}
        <div ref={resultsTopRef} className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Animated Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              <AnimatedSelect
                value={selectedGenre}
                onChange={(val) => {
                  setSelectedGenre(val);
                  updateUrlParams({ genre: val });
                }}
                options={GENRE_OPTIONS}
                ariaLabel="Filter by genre"
                triggerClassName={`min-w-[115px] h-10 rounded-xl ${
                  selectedGenre !== 'All'
                    ? 'bg-white/[0.08] border-white/30'
                    : 'bg-[#0b0b0d] border-[#18181b] hover:border-[#6b7280]'
                }`}
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
                    <path d="M7 7h.01" />
                  </svg>
                }
              />

              <AnimatedSelect
                value={formatFilter}
                onChange={(val) => {
                  setFormatFilter(val);
                  updateUrlParams({ format: val });
                }}
                options={FORMAT_OPTIONS}
                ariaLabel="Filter by format"
                triggerClassName={`min-w-[115px] h-10 rounded-xl ${
                  formatFilter !== 'All'
                    ? 'bg-white/[0.08] border-white/30'
                    : 'bg-[#0b0b0d] border-[#18181b] hover:border-[#6b7280]'
                }`}
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
                    <polyline points="17 2 12 7 7 2" />
                  </svg>
                }
              />

              <AnimatedSelect
                value={statusFilter}
                onChange={(val) => {
                  setStatusFilter(val);
                  updateUrlParams({ status: val });
                }}
                options={STATUS_OPTIONS}
                ariaLabel="Filter by status"
                triggerClassName={`min-w-[115px] h-10 rounded-xl ${
                  statusFilter !== 'All'
                    ? 'bg-white/[0.08] border-white/30'
                    : 'bg-[#0b0b0d] border-[#18181b] hover:border-[#6b7280]'
                }`}
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                }
              />

              <AnimatedSelect
                value={yearFilter}
                onChange={(val) => {
                  setYearFilter(val);
                  updateUrlParams({ year: val });
                }}
                options={YEAR_OPTIONS}
                ariaLabel="Filter by year"
                triggerClassName={`min-w-[105px] h-10 rounded-xl ${
                  yearFilter !== 'All'
                    ? 'bg-white/[0.08] border-white/30'
                    : 'bg-[#0b0b0d] border-[#18181b] hover:border-[#6b7280]'
                }`}
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                }
              />

              <AnimatedSelect
                value={episodesFilter}
                onChange={(val) => {
                  setEpisodesFilter(val);
                  updateUrlParams({ episodes: val });
                }}
                options={EPISODE_OPTIONS}
                ariaLabel="Filter by episode count"
                triggerClassName={`min-w-[120px] h-10 rounded-xl ${
                  episodesFilter !== 'All'
                    ? 'bg-white/[0.08] border-white/30'
                    : 'bg-[#0b0b0d] border-[#18181b] hover:border-[#6b7280]'
                }`}
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                  </svg>
                }
              />

              <AnimatedSelect
                value={studioFilter}
                onChange={(val) => {
                  setStudioFilter(val);
                  updateUrlParams({ studio: val });
                }}
                options={dynamicStudioOptions}
                ariaLabel="Filter by studio"
                triggerClassName={`min-w-[120px] h-10 rounded-xl ${
                  studioFilter !== 'All'
                    ? 'bg-white/[0.08] border-white/30'
                    : 'bg-[#0b0b0d] border-[#18181b] hover:border-[#6b7280]'
                }`}
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                }
              />

              <AnimatedSelect
                value={sortFilter}
                onChange={(val) => {
                  setSortFilter(val as any);
                  updateUrlParams({ sort: val });
                }}
                options={SORT_OPTIONS}
                ariaLabel="Sort anime"
                triggerClassName={`min-w-[115px] h-10 rounded-xl ${
                  sortFilter !== 'POPULARITY_DESC'
                    ? 'bg-white/[0.08] border-white/30'
                    : 'bg-[#0b0b0d] border-[#18181b] hover:border-[#6b7280]'
                }`}
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m3 16 4 4 4-4" />
                    <path d="M7 20V4" />
                    <path d="m21 8-4-4-4 4" />
                    <path d="M17 4v16" />
                  </svg>
                }
              />

              <AnimatePresence>
                {hasActiveFilters && (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={resetAllFilters}
                    className="h-10 px-3.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.14] border border-white/[0.15] text-[12.5px] font-semibold text-white/85 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Reset</span>
                    <span className="text-xs">✕</span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* Animated View Type Switcher: [≡] Detailed Cards vs [⊞] Poster Grid */}
            <div className="relative flex items-center p-1 rounded-xl bg-[#0b0b0d] border border-[#18181b] hover:border-[#6b7280] transition-colors shrink-0">
              <motion.div
                layout
                transition={{ type: 'spring', stiffness: 460, damping: 32 }}
                className="absolute top-1 bottom-1 w-9 bg-white rounded-[8px]"
                style={{ left: viewMode === 'card' ? '4px' : '40px' }}
              />
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() => changeViewMode('card')}
                className={`relative z-10 h-8 w-9 flex items-center justify-center transition-colors duration-200 cursor-pointer ${
                  viewMode === 'card' ? 'text-black' : 'text-white/45 hover:text-white/80'
                }`}
                aria-label="Detailed card view"
                title="Detailed Card View"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() => changeViewMode('grid')}
                className={`relative z-10 h-8 w-9 flex items-center justify-center transition-colors duration-200 cursor-pointer ${
                  viewMode === 'grid' ? 'text-black' : 'text-white/45 hover:text-white/80'
                }`}
                aria-label="Poster grid view"
                title="Poster Grid View"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                </svg>
              </motion.button>
            </div>
          </div>

          {/* Recent Searches (Shown when input is empty) */}
          {!debouncedQuery && history.length > 0 && (
            <div className="mt-5 mb-2">
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-[13.5px] font-semibold text-white/55">Recent Searches</h2>
                <button
                  type="button"
                  onClick={() => {
                    clearSearchHistory();
                    setHistory([]);
                  }}
                  className="text-[12.5px] font-medium text-white/40 hover:text-white/80 transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {history.map((term) => (
                  <div
                    key={term}
                    onClick={() => setQuery(term)}
                    className="flex items-center gap-2 bg-[#0b0b0d] hover:bg-[#141418] border border-[#18181b] hover:border-[#6b7280] px-3.5 py-1.5 rounded-full cursor-pointer transition-all group"
                  >
                    <SearchIcon className="w-3.5 h-3.5 text-white/40 group-hover:text-white/80 transition-colors" />
                    <span className="text-[13px] font-medium text-white/80 group-hover:text-white transition-colors">
                      {term}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setHistory(removeSearchHistoryItem(term));
                      }}
                      className="ml-1 text-white/30 hover:text-white/90 transition-colors p-0.5 rounded-full hover:bg-white/10"
                      aria-label={`Remove ${term}`}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      >
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Results Section */}
        {loading ? (
          <div className="pb-16 pt-1">
            <div className="h-6 w-48 bg-white/5 rounded mb-6 animate-pulse" />
            {viewMode === 'card' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[192px] rounded-2xl bg-[#0b0b0d] border border-[#18181b] animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-x-3.5 gap-y-6">
                {Array.from({ length: 14 }).map((_, i) => (
                  <div key={i} className="aspect-[2/3] rounded-xl bg-[#0d0d0d] animate-pulse" />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="pb-16 pt-1">
            {/* Redesigned Full-Width Cinematic Top Result Feature (Shown on Page 1 when searching) */}
            {showTopResult && topResult && (
              <div className="mb-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/60">
                      Top Result
                    </h3>
                  </div>
                  {totalPages > 1 && (
                    <span className="text-xs font-semibold text-white/45 tabular-nums">
                      Page {page} of {totalPages}
                    </span>
                  )}
                </div>

                <div className="group/top relative overflow-hidden rounded-2xl bg-[#0b0b0d] border-2 border-[#18181b] hover:border-[#6b7280] transition-colors duration-200 p-4 sm:p-5 md:p-6 shadow-[0_14px_40px_rgba(0,0,0,0.8)]">
                  {/* Atmospheric Banner Background */}
                  {topBannerImage && (
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                      <img
                        src={topBannerImage}
                        alt=""
                        className="w-full h-full object-cover object-center opacity-25 scale-105 group-hover/top:scale-100 transition-transform duration-700 blur-[1px]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-[#0b0b0d] via-[#0b0b0d]/90 to-[#0b0b0d]/35" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0d] via-transparent to-[#0b0b0d]/50" />
                    </div>
                  )}

                  <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5 md:gap-7">
                    {/* Uncropped 2:3 Portrait Poster */}
                    <Link
                      to={`/anime/${topResult.id}`}
                      className="relative shrink-0 w-[120px] sm:w-[136px] md:w-[148px] aspect-[2/3] rounded-xl overflow-hidden bg-[#141417] border border-white/10 shadow-[0_10px_28px_rgba(0,0,0,0.85)]"
                    >
                      {(() => {
                        const topPoster = getNexusPosterForAnime(topResult.title, topResult.id) || topResult.poster;
                        return topPoster ? (
                          <LazyImage
                            src={topPoster}
                            alt={topResult.title}
                            className="w-full h-full"
                            imgClassName="w-full h-full object-cover group-hover/top:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/20 text-2xl font-bold">
                            {topResult.title[0]}
                          </div>
                        );
                      })()}
                    </Link>

                    {/* Right Details Column */}
                    <div className="flex flex-col min-w-0 flex-1">
                      {/* Top Badges Row */}
                      <div className="flex flex-wrap items-center gap-2 mb-2.5">
                        <span className="px-2.5 py-0.5 rounded-md bg-white text-black text-[10px] font-extrabold uppercase tracking-wider">
                          Best Match
                        </span>
                        <span className="px-2.5 py-0.5 rounded-md bg-white/[0.08] border border-white/[0.1] text-[10.5px] font-bold uppercase tracking-wider text-white/90">
                          {formatAnimeType(topResult.format)}
                        </span>
                        {topResult.status && (
                          <span className="px-2.5 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-[10.5px] font-semibold text-white/75">
                            {formatAnimeStatus(topResult.status)}
                          </span>
                        )}
                        {(topDetails?.episodes || topResult.episodes) && (
                          <span className="px-2.5 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-[10.5px] font-semibold text-white/75 tabular-nums">
                            {topDetails?.episodes || topResult.episodes} Episodes
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <Link to={`/anime/${topResult.id}`}>
                        <h4 className="text-[22px] sm:text-[26px] md:text-[28px] font-extrabold text-white tracking-tight leading-tight hover:text-white/85 transition-colors line-clamp-1">
                          {topResult.title}
                        </h4>
                      </Link>

                      {/* Metadata & Genres Row */}
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 mt-2 text-[13px] font-semibold text-white/65">
                        {topResult.year && <span className="text-white/85">{topResult.year}</span>}
                        {topResult.studios?.[0]?.name && (
                          <>
                            {topResult.year && <span className="text-white/30">•</span>}
                            <span className="text-white font-bold">{topResult.studios[0].name}</span>
                          </>
                        )}
                        {topResult.genres && topResult.genres.length > 0 && (
                          <>
                            {(topResult.year || topResult.studios?.[0]?.name) && (
                              <span className="text-white/30">•</span>
                            )}
                            <div className="flex flex-wrap items-center gap-1.5">
                              {topResult.genres.slice(0, 4).map((g) => (
                                <span
                                  key={g}
                                  className="px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.07] text-[11px] font-medium text-white/70"
                                >
                                  {g}
                                </span>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Overview */}
                      {(topDetails?.overview || topResult.overview) && (
                        <p className="text-[13px] sm:text-[13.5px] text-white/55 line-clamp-2 mt-3 leading-relaxed max-w-4xl">
                          {topDetails?.overview || topResult.overview}
                        </p>
                      )}

                      {/* Action Buttons */}
                      <div className="mt-5 flex flex-wrap items-center gap-3">
                        <Link
                          to={`/watch/anime/${topResult.id}/1/1`}
                          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-black font-bold text-xs sm:text-sm hover:bg-white/90 transition-all active:scale-95 shadow-[0_4px_20px_rgba(255,255,255,0.2)]"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                          Watch Now
                        </Link>

                        <Link
                          to={`/anime/${topResult.id}`}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/20 bg-transparent hover:bg-white/[0.08] text-white font-semibold text-xs sm:text-sm transition-all active:scale-95"
                        >
                          See More
                        </Link>

                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.94 }}
                          onClick={handleToggleTopWatchlist}
                          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full border text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                            topInWatchlist
                              ? 'bg-white/[0.15] border-white/40 text-white'
                              : 'bg-transparent border-white/15 hover:border-white/35 text-white/75 hover:text-white'
                          }`}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill={topInWatchlist ? 'currentColor' : 'none'}
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                          </svg>
                          <span>{topInWatchlist ? 'In Watchlist' : 'Add to List'}</span>
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Section Header for Grid/Card Results */}
            {(gridItems.length > 0 || activeFilterChips.length > 0) && (
              <div className="mb-5">
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-[18px] lg:text-[20px] font-semibold text-white/90 tracking-tight truncate">
                      {sectionHeading}
                    </h2>
                    {activeFilterChips.length > 0 && (
                      <p className="mt-0.5 text-[12.5px] font-medium text-white/40">
                        {activeFilterChips.length} filter{activeFilterChips.length > 1 ? 's' : ''} applied
                        {gridItems.length === 0 ? ' · no matches' : ''}
                      </p>
                    )}
                  </div>
                  {!showTopResult && totalPages > 1 && gridItems.length > 0 && (
                    <span className="text-xs font-semibold text-white/45 shrink-0 tabular-nums">
                      Page {page} of {totalPages}
                    </span>
                  )}
                </div>

                {activeFilterChips.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <AnimatePresence initial={false}>
                      {activeFilterChips.map((chip) => (
                        <motion.button
                          key={chip.key}
                          type="button"
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.16 }}
                          onClick={chip.clear}
                          aria-label={`Remove ${chip.category} filter: ${chip.value}`}
                          className="group/chip inline-flex items-center h-8 rounded-full border border-white/15 bg-white/[0.04] hover:border-white/35 hover:bg-white/[0.08] pl-3 pr-1.5 gap-2 transition-colors cursor-pointer"
                        >
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                            {chip.category}
                          </span>
                          <span className="text-[13px] font-semibold text-white">{chip.value}</span>
                          <span className="w-5 h-5 rounded-full flex items-center justify-center text-white/50 group-hover/chip:text-black group-hover/chip:bg-white transition-colors">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </span>
                        </motion.button>
                      ))}
                    </AnimatePresence>
                    {activeFilterChips.length > 1 && (
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="h-8 px-2 text-[12.5px] font-semibold text-white/45 hover:text-white underline-offset-4 hover:underline transition-colors cursor-pointer"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Animated View Container: Detailed Cards vs Poster Grid */}
            <AnimatePresence mode="wait">
              {viewMode === 'card' ? (
                <motion.div
                  key={`card-view-${page}-${debouncedQuery}-${selectedGenre}-${formatFilter}-${statusFilter}-${yearFilter}-${episodesFilter}-${studioFilter}-${sortFilter}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
                >
                  {gridItems.map((item) => (
                    <DiscoverDetailCard key={item.id} item={item} />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key={`grid-view-${page}-${debouncedQuery}-${selectedGenre}-${formatFilter}-${statusFilter}-${yearFilter}-${episodesFilter}-${studioFilter}-${sortFilter}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-x-3.5 gap-y-6"
                >
                  {gridItems.map((item) => (
                    <PosterCard key={item.id} item={item} className="w-full" />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Empty State */}
            {items.length === 0 && !loading && (
              <div className="pt-20 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 mb-4 opacity-20 flex items-center justify-center">
                  <SearchIcon className="w-16 h-16" />
                </div>
                <h3 className="text-xl font-semibold text-white/80 mb-2">
                  {debouncedQuery ? `Couldn't find "${debouncedQuery}"` : 'No matching anime found'}
                </h3>
                <p className="text-white/40 text-sm mb-5">
                  {debouncedQuery
                    ? 'Try searching by English or Romaji title, or check your spelling.'
                    : 'Try adjusting or resetting your active filters.'}
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="px-5 py-2.5 rounded-full bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors cursor-pointer"
                  >
                    Reset All Filters
                  </button>
                )}
              </div>
            )}

            {/* Pagination System */}
            {items.length > 0 && totalPages > 1 && (
              <div className="mt-12 flex flex-wrap items-center justify-center gap-2 select-none">
                <motion.button
                  type="button"
                  whileTap={{ scale: page > 1 ? 0.94 : 1 }}
                  disabled={page <= 1}
                  onClick={() => handlePageChange(page - 1)}
                  className={`h-10 px-4 rounded-xl border-2 text-[13px] font-semibold flex items-center gap-1.5 transition-all ${
                    page <= 1
                      ? 'bg-[#08080a] border-[#141417] text-white/25 cursor-not-allowed'
                      : 'bg-[#0b0b0d] border-[#18181b] hover:border-[#6b7280] text-white/80 hover:text-white cursor-pointer'
                  }`}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                  <span>Prev</span>
                </motion.button>

                {getPageNumbers().map((p) => {
                  if (p === 'ellipsis-start' || p === 'ellipsis-end') {
                    return (
                      <span
                        key={p}
                        className="w-9 h-10 flex items-center justify-center text-white/35 font-bold"
                      >
                        …
                      </span>
                    );
                  }
                  const active = p === page;
                  return (
                    <motion.button
                      key={p}
                      type="button"
                      whileHover={{ scale: active ? 1 : 1.05 }}
                      whileTap={{ scale: 0.93 }}
                      onClick={() => handlePageChange(p)}
                      className={`min-w-[40px] h-10 px-3 rounded-xl border-2 text-[13px] font-bold tabular-nums transition-all cursor-pointer ${
                        active
                          ? 'bg-white text-black border-white shadow-[0_4px_16px_rgba(255,255,255,0.2)]'
                          : 'bg-[#0b0b0d] border-[#18181b] hover:border-[#6b7280] text-white/75 hover:text-white'
                      }`}
                    >
                      {p}
                    </motion.button>
                  );
                })}

                <motion.button
                  type="button"
                  whileTap={{ scale: page < totalPages ? 0.94 : 1 }}
                  disabled={page >= totalPages}
                  onClick={() => handlePageChange(page + 1)}
                  className={`h-10 px-4 rounded-xl border-2 text-[13px] font-semibold flex items-center gap-1.5 transition-all ${
                    page >= totalPages
                      ? 'bg-[#08080a] border-[#141417] text-white/25 cursor-not-allowed'
                      : 'bg-[#0b0b0d] border-[#18181b] hover:border-[#6b7280] text-white/80 hover:text-white cursor-pointer'
                  }`}
                >
                  <span>Next</span>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </motion.button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
