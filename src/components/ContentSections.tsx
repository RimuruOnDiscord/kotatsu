import React, { useState, useEffect, useRef, memo } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AnimeMedia,
  AnimeEpisode,
  AnimeSeasonItem,
  NextAiringEpisode,
  fetchAnimeDetails,
  fetchImdbTrailer,
  fetchEpisodeThumbnail,
  getNexusPosterForAnime,
  getNexusBannerForAnime,
  fetchNexusArtForAnime,
  NEXUS_TOP_10_ART,
} from '../lib/api';
import {
  ContinueWatchingEntry,
  removeContinueWatching,
  getEpisodeThumbnail,
  cacheEpisodeThumbnail,
  updateContinueWatchingThumbnail,
} from '../lib/storage';
import { LazyImage } from './LazyImage';
import { PlayIcon, ClockIcon, VolumeIcon } from './icons';
import { AnimatedSelect } from './AnimatedSelect';
import { PosterCard } from './PosterCard';

/* -------------------------------------------------------------------------- */
/* 1. TRENDING RIGHT NOW (1 - 10 Alfa Slab One Numbered Row)                  */
/* -------------------------------------------------------------------------- */
export const TrendingRow: React.FC<{
  title?: string;
  items: AnimeMedia[];
  exploreUrl?: string;
}> = memo(({
  title = 'Trending Right Now',
  items,
  exploreUrl = '/explore?sort=TRENDING_DESC',
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const uniqueItems = items.filter(
    (item, idx, self) => idx === self.findIndex((t) => t.id === item.id)
  );
  const top10 = uniqueItems.slice(0, 10);

  const updateScrollButtons = () => {
    const el = rowRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateScrollButtons();
    window.addEventListener('resize', updateScrollButtons);
    return () => window.removeEventListener('resize', updateScrollButtons);
  }, [top10.length]);

  if (!top10.length) return null;

  const scrollRow = (dir: 'left' | 'right') => {
    const el = rowRef.current;
    if (!el) return;
    const { scrollLeft, clientWidth } = el;
    el.scrollTo({
      left: dir === 'left' ? scrollLeft - clientWidth * 0.75 : scrollLeft + clientWidth * 0.75,
      behavior: 'smooth',
    });
  };

  return (
    <div className="mb-8 md:mb-10 px-4 sm:px-6 md:pl-28 lg:pl-32 md:pr-12 relative group/trending select-none">
      <div className="mb-2.5 md:mb-4 flex items-center justify-between">
        <Link
          to={exploreUrl}
          className="group/title inline-flex items-center gap-2 text-[16px] sm:text-[18px] md:text-[20px] font-bold text-[#e1e6f0] hover:text-white tracking-wide transition-colors"
        >
          <span>{title}</span>
          <span className="text-xs sm:text-sm text-white/40 group-hover/title:text-white group-hover/title:translate-x-0.5 transition-all">
            &#10095;
          </span>
        </Link>
        <Link
          to={exploreUrl}
          className="text-xs sm:text-sm font-bold text-[#8f98a2] hover:text-white transition-colors flex items-center gap-1"
        >
          View All <span>&#10095;</span>
        </Link>
      </div>

      <div className="relative">
        {canScrollLeft && (
          <button
            onClick={() => scrollRow('left')}
            aria-label="Scroll left"
            className="hidden md:flex absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-black via-black/85 to-transparent z-30 items-center justify-center opacity-0 group-hover/trending:opacity-100 transition-opacity duration-300 text-white hover:scale-110"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}

        <div
          ref={rowRef}
          onScroll={updateScrollButtons}
          className="flex items-center gap-6 sm:gap-8 md:gap-10 overflow-x-auto overflow-y-hidden no-scrollbar py-4 scroll-smooth"
        >
          {top10.map((item, idx) => {
            const isMovie = item.format === 'MOVIE';
            const displayPoster = getNexusPosterForAnime(item.title, item.id) || item.poster;
            return (
              <Link
                key={item.id}
                to={`/anime/${item.id}`}
                className="group relative flex items-center shrink-0 pl-8 sm:pl-10 md:pl-14"
              >
                <span
                  style={{
                    fontFamily: "'Alfa Slab One', cursive",
                    WebkitTextStroke: '2px rgba(255,255,255,0.22)',
                  }}
                  className="absolute left-0 top-1/2 -translate-y-1/2 text-[76px] sm:text-[96px] md:text-[120px] leading-none text-transparent bg-clip-text bg-gradient-to-b from-white/40 via-white/20 to-white/5 select-none pointer-events-none z-10 group-hover:from-white/65 transition-all duration-300"
                >
                  {idx + 1}
                </span>

                <div className={`relative w-[115px] sm:w-[135px] md:w-[165px] lg:w-[180px] aspect-[2/3] rounded-xl overflow-hidden bg-[#0d0d0d] transition-transform duration-300 ease-out group-hover:scale-105 group-hover:shadow-[0_12px_28px_rgba(0,0,0,0.85)] z-20 ${idx === 0 ? 'origin-left' : 'origin-center'}`}>
                  <LazyImage
                    src={displayPoster}
                    alt={item.title}
                    className="w-full h-full"
                    imgClassName="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2.5 z-20">
                    <h3 className="text-white font-bold text-xs sm:text-sm leading-tight line-clamp-2 mb-0.5">
                      {item.title}
                    </h3>
                    {(item.year || isMovie) && (
                      <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-white/65 font-semibold">
                        {item.year && <span>{item.year}</span>}
                        {item.year && isMovie && <span>•</span>}
                        {isMovie && <span>Movie</span>}
                      </div>
                    )}
                  </div>

                  {/* Non-flickering Solid Gray Outline Overlay */}
                  <div className="pointer-events-none absolute inset-0 z-30 rounded-xl border-2 border-[#18181b] group-hover:border-[#6b7280] transition-colors duration-200" />
                </div>
              </Link>
            );
          })}
        </div>

        {canScrollRight && (
          <button
            onClick={() => scrollRow('right')}
            aria-label="Scroll right"
            className="hidden md:flex absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-black via-black/85 to-transparent z-30 items-center justify-center opacity-0 group-hover/trending:opacity-100 transition-opacity duration-300 text-white hover:scale-110"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
});

TrendingRow.displayName = 'TrendingRow';

/* -------------------------------------------------------------------------- */
/* 2. CONTINUE WATCHING ROW                                                   */
/* -------------------------------------------------------------------------- */
export const ContinueWatchingRow: React.FC<{
  items: ContinueWatchingEntry[];
  onRemove?: (id: string | number) => void;
}> = memo(({ items, onRemove }) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollButtons = () => {
    const el = rowRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateScrollButtons();
    window.addEventListener('resize', updateScrollButtons);
    return () => window.removeEventListener('resize', updateScrollButtons);
  }, [items?.length]);

  const scrollRow = (dir: 'left' | 'right') => {
    const el = rowRef.current;
    if (!el) return;
    const { scrollLeft, clientWidth } = el;
    el.scrollTo({
      left: dir === 'left' ? scrollLeft - clientWidth * 0.75 : scrollLeft + clientWidth * 0.75,
      behavior: 'smooth',
    });
  };

  const [dynamicThumbs, setDynamicThumbs] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    items.forEach((entry) => {
      const cached = getEpisodeThumbnail(entry.id, entry.episode);
      if (cached) initial[`${entry.id}-${entry.episode}`] = cached;
    });
    return initial;
  });

  // Automatically fetch and cache real episode stills for any continue-watching item lacking a thumbnail
  useEffect(() => {
    items.forEach((entry) => {
      const key = `${entry.id}-${entry.episode}`;
      if (entry.still) {
        cacheEpisodeThumbnail(entry.id, entry.episode, entry.still);
        return;
      }
      const cached = getEpisodeThumbnail(entry.id, entry.episode);
      if (cached) {
        setDynamicThumbs((prev) => (prev[key] === cached ? prev : { ...prev, [key]: cached }));
        return;
      }
      fetchEpisodeThumbnail(entry.id, entry.episode)
        .then((stillUrl) => {
          if (stillUrl) {
            cacheEpisodeThumbnail(entry.id, entry.episode, stillUrl);
            updateContinueWatchingThumbnail(entry.id, stillUrl);
            setDynamicThumbs((prev) => ({ ...prev, [key]: stillUrl }));
          }
        })
        .catch(() => {});
    });
  }, [items]);

  if (!items || items.length === 0) return null;

  return (
    <div className="mb-7 md:mb-9 px-4 sm:px-6 md:pl-28 lg:pl-32 md:pr-12 relative group/continue select-none">
      <div className="mb-2.5 md:mb-3 flex items-center justify-between">
        <Link
          to="/space"
          className="group/title inline-flex items-center gap-2 text-[16px] sm:text-[18px] md:text-[20px] font-bold text-[#e1e6f0] hover:text-white tracking-wide transition-colors"
        >
          <span>Continue Watching</span>
          <span className="text-xs sm:text-sm text-white/40 group-hover/title:text-white group-hover/title:translate-x-0.5 transition-all">
            &#10095;
          </span>
        </Link>
        <Link
          to="/space"
          className="text-xs sm:text-sm font-bold text-[#8f98a2] hover:text-white transition-colors flex items-center gap-1"
        >
          View All <span>&#10095;</span>
        </Link>
      </div>

      <div className="relative">
        {canScrollLeft && (
          <button
            onClick={() => scrollRow('left')}
            aria-label="Scroll left"
            className="hidden md:flex absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-black via-black/85 to-transparent z-30 items-center justify-center opacity-0 group-hover/continue:opacity-100 transition-opacity duration-300 text-white hover:scale-110"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}

        <div
          ref={rowRef}
          onScroll={updateScrollButtons}
          className="card-shift-row flex items-center gap-3.5 sm:gap-4 overflow-x-auto overflow-y-hidden no-scrollbar py-3.5 scroll-smooth"
        >
        {items.map((entry, idx) => {
          const key = `${entry.id}-${entry.episode}`;
          const episodeThumbnail =
            entry.still || dynamicThumbs[key] || entry.backdrop || entry.poster;

          return (
            <div
              key={entry.id}
              className={`card-shift-item group relative w-[220px] sm:w-[260px] md:w-[300px] shrink-0 ${
                idx === 0 ? 'origin-left' : 'origin-center'
              }`}
            >
              <Link
                to={`/watch/anime/${entry.id}/${entry.season || 1}/${entry.episode || 1}`}
                className={`block relative aspect-video rounded-xl overflow-hidden bg-[#0d0d0d] transition-transform duration-300 ease-out group-hover:scale-105 group-hover:shadow-[0_12px_28px_rgba(0,0,0,0.85)] z-20 ${
                  idx === 0 ? 'origin-left' : 'origin-center'
                }`}
              >
                <LazyImage
                  src={episodeThumbnail}
                  alt={entry.title}
                  className="w-full h-full"
                  imgClassName="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent z-10" />

                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2 z-20">
                  <div className="min-w-0">
                    <p className="text-white font-bold text-xs sm:text-sm truncate">
                      {entry.title}
                    </p>
                    <p className="text-[11px] text-gray-300 font-semibold truncate">
                      EP {entry.episode} {entry.episodeTitle ? `• ${entry.episodeTitle}` : ''}
                    </p>
                  </div>
                </div>

                <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20 z-20 overflow-hidden">
                  <div
                    className="h-full bg-white transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(5, entry.progress || 15))}%` }}
                  />
                </div>

                {/* Non-flickering Solid Gray Outline Overlay (Identical to Posters) */}
                <div className="pointer-events-none absolute inset-0 z-30 rounded-xl border-2 border-[#18181b] group-hover:border-[#6b7280] transition-colors duration-200" />
              </Link>
            </div>
          );
        })}
        </div>

        {canScrollRight && (
          <button
            onClick={() => scrollRow('right')}
            aria-label="Scroll right"
            className="hidden md:flex absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-black via-black/85 to-transparent z-30 items-center justify-center opacity-0 group-hover/continue:opacity-100 transition-opacity duration-300 text-white hover:scale-110"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
});

ContinueWatchingRow.displayName = 'ContinueWatchingRow';

/* -------------------------------------------------------------------------- */
/* 3. CAUGHT BINGING ("Since you Binged ...") LANDSCAPE TRAILER CARDS          */
/* -------------------------------------------------------------------------- */
const CaughtBingingCard: React.FC<{ item: AnimeMedia; isFirst?: boolean }> = ({ item, isFirst }) => {
  const [hovered, setHovered] = useState(false);
  const [trailerUrl, setTrailerUrl] = useState<string | null>(null);
  const [nexusArt, setNexusArt] = useState<string | null>(() =>
    getNexusBannerForAnime(item.title, item.id) || getNexusPosterForAnime(item.title, item.id)
  );
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cached = getNexusBannerForAnime(item.title, item.id);
    if (cached) {
      setNexusArt(cached);
      return;
    }
    fetchNexusArtForAnime(item.title, item.id)
      .then((art) => {
        if (!cancelled && (art.banner || art.poster)) {
          setNexusArt(art.banner || art.poster);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [item.id, item.title]);

  const handleMouseEnter = () => {
    hoverTimer.current = setTimeout(async () => {
      setHovered(true);
      if (trailerUrl === null) {
        try {
          const details = await fetchAnimeDetails(item.id);
          if (details.imdb_id) {
            const url = await fetchImdbTrailer(details.imdb_id);
            if (url) setTrailerUrl(url);
          }
        } catch {
          // ignore
        }
      }
    }, 500);
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHovered(false);
  };

  const displayBackdrop =
    NEXUS_TOP_10_ART[Number(item.id)]?.backdrop ||
    nexusArt ||
    getNexusBannerForAnime(item.title, item.id) ||
    getNexusPosterForAnime(item.title, item.id) ||
    item.backdrop ||
    item.poster;

  return (
    <Link
      to={`/anime/${item.id}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`group relative w-[250px] sm:w-[290px] md:w-[340px] aspect-video rounded-xl overflow-hidden bg-[#0d0d0d] shrink-0 transition-transform duration-300 hover:scale-[1.03] shadow-lg ${
        isFirst ? 'origin-left' : 'origin-center'
      }`}
    >
      <LazyImage
        src={displayBackdrop}
        alt={item.title}
        className="w-full h-full"
        imgClassName="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
      />
      {hovered && trailerUrl && (
        <video
          src={trailerUrl}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover scale-110 z-10 pointer-events-none"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent z-20 flex flex-col justify-end p-3.5">
        <h3 className="text-white font-bold text-sm sm:text-base leading-snug line-clamp-1">
          {item.title}
        </h3>
        <div className="flex items-center gap-2 text-[11px] text-[#8f98a2] font-semibold mt-0.5">
          {item.year && <span>{item.year}</span>}
          {item.year && item.genres?.[0] && <span>•</span>}
          {item.genres?.[0] && <span className="text-gray-300">{item.genres[0]}</span>}
        </div>
      </div>

      {/* Non-flickering Solid Gray Outline Overlay */}
      <div className="pointer-events-none absolute inset-0 z-30 rounded-xl border-2 border-[#18181b] group-hover:border-[#6b7280] transition-colors duration-200" />
    </Link>
  );
};

export const CaughtBingingRow: React.FC<{
  sourceTitle: string;
  items: AnimeMedia[];
  exploreUrl?: string;
}> = memo(({ sourceTitle, items, exploreUrl = '/explore' }) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollButtons = () => {
    const el = rowRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateScrollButtons();
    window.addEventListener('resize', updateScrollButtons);
    return () => window.removeEventListener('resize', updateScrollButtons);
  }, [items?.length]);

  if (!items || items.length === 0) return null;

  const scrollRow = (dir: 'left' | 'right') => {
    const el = rowRef.current;
    if (!el) return;
    const { scrollLeft, clientWidth } = el;
    el.scrollTo({
      left: dir === 'left' ? scrollLeft - clientWidth * 0.75 : scrollLeft + clientWidth * 0.75,
      behavior: 'smooth',
    });
  };

  return (
    <div className="mb-8 md:mb-10 px-4 sm:px-6 md:pl-28 lg:pl-32 md:pr-12 relative group/caught select-none">
      <div className="mb-3 flex items-end justify-between gap-3">
        <Link to={exploreUrl} className="group/title flex items-center gap-3">
          <div className="w-1 h-7 rounded-full bg-white" />
          <div>
            <p className="text-[10px] sm:text-[11px] uppercase tracking-widest text-white/50 font-extrabold">
              Because You Watched
            </p>
            <h2 className="text-[16px] sm:text-[18px] md:text-[20px] font-bold text-[#e1e6f0] group-hover/title:text-white tracking-wide flex items-center gap-2 transition-colors">
              <span>
                Since you watched <span className="text-white">{sourceTitle}</span>
              </span>
              <span className="text-xs sm:text-sm text-white/40 group-hover/title:text-white group-hover/title:translate-x-0.5 transition-all">
                &#10095;
              </span>
            </h2>
          </div>
        </Link>
        <Link
          to={exploreUrl}
          className="text-xs sm:text-sm font-bold text-[#8f98a2] hover:text-white transition-colors flex items-center gap-1 shrink-0"
        >
          View All <span>&#10095;</span>
        </Link>
      </div>

      <div className="relative">
        {canScrollLeft && (
          <button
            onClick={() => scrollRow('left')}
            aria-label="Scroll left"
            className="hidden md:flex absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-black via-black/85 to-transparent z-30 items-center justify-center opacity-0 group-hover/caught:opacity-100 transition-opacity duration-300 text-white hover:scale-110"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}

        <div
          ref={rowRef}
          onScroll={updateScrollButtons}
          className="card-shift-row flex items-center gap-2.5 sm:gap-3.5 md:gap-4 overflow-x-auto overflow-y-hidden no-scrollbar py-3 scroll-smooth"
        >
          {items.slice(0, 16).map((item) => (
            <PosterCard key={item.id} item={item} />
          ))}
        </div>

        {canScrollRight && (
          <button
            onClick={() => scrollRow('right')}
            aria-label="Scroll right"
            className="hidden md:flex absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-black via-black/85 to-transparent z-30 items-center justify-center opacity-0 group-hover/caught:opacity-100 transition-opacity duration-300 text-white hover:scale-110"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
});

CaughtBingingRow.displayName = 'CaughtBingingRow';

/* -------------------------------------------------------------------------- */
/* 4. EPISODES SECTION (Exact Bingr ContentSections-CbYc6qMO.js Layout)        */
/* -------------------------------------------------------------------------- */
interface EpisodesSectionProps {
  animeId: string | number;
  animeTitle: string;
  backdrop?: string | null;
  poster?: string | null;
  seasons?: AnimeSeasonItem[];
  selectedSeason?: number;
  onSeasonChange?: (season: number) => void;
  episodes: AnimeEpisode[];
  totalChunks: number;
  currentChunk: number;
  onChunkChange: (chunk: number) => void;
  loadingEpisodes: boolean;
  nextAiringEpisode?: NextAiringEpisode | null;
  externalDownloadTriggerEp?: number | null;
  onClearExternalDownloadTrigger?: () => void;
}

const CONTROL_GLASS_STYLE: React.CSSProperties = {
  background: 'linear-gradient(rgba(255, 255, 255, 0.035) 0%, rgba(255, 255, 255, 0.01) 100%)',
  boxShadow:
    'rgba(255, 255, 255, 0.05) 0px 1px 0px inset, rgba(0, 0, 0, 0.55) 0px 6px 14px -6px',
};

export const EpisodesSection: React.FC<EpisodesSectionProps> = ({
  animeId,
  animeTitle,
  backdrop,
  poster,
  seasons,
  selectedSeason = 1,
  onSeasonChange,
  episodes,
  totalChunks,
  currentChunk,
  onChunkChange,
  loadingEpisodes,
  nextAiringEpisode,
  externalDownloadTriggerEp,
  onClearExternalDownloadTrigger,
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bingr_episode_view_mode');
      if (saved === 'list' || saved === 'grid') return saved;
    }
    return 'list';
  });
  const [sortDesc, setSortDesc] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [expandedMobileEp, setExpandedMobileEp] = useState<number | null>(null);
  const [downloadEp, setDownloadEp] = useState<AnimeEpisode | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);

  const changeViewMode = (mode: 'list' | 'grid') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('bingr_episode_view_mode', mode);
    }
  };

  // Light-dismiss fallback for browsers that do not yet support closedby="any"
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleFallbackClick = (event: MouseEvent) => {
      if (!('closedBy' in HTMLDialogElement.prototype)) {
        const rect = dialog.getBoundingClientRect();
        const isInDialog =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (!isInDialog) {
          dialog.close();
        }
      }
    };

    dialog.addEventListener('click', handleFallbackClick);
    return () => dialog.removeEventListener('click', handleFallbackClick);
  }, []);

  useEffect(() => {
    if (externalDownloadTriggerEp != null) {
      const target =
        episodes.find((e) => e.episode === externalDownloadTriggerEp) ||
        episodes[0] || {
          episode: externalDownloadTriggerEp,
          title: `Episode ${externalDownloadTriggerEp}`,
        };
      setDownloadEp(target);
      if (dialogRef.current && !dialogRef.current.open) {
        dialogRef.current.showModal();
      }
      onClearExternalDownloadTrigger?.();
    }
  }, [externalDownloadTriggerEp, episodes, onClearExternalDownloadTrigger]);

  const openDownloadModal = (ep: AnimeEpisode, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDownloadEp(ep);
    if (dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    }
  };

  const filteredEpisodes = [...episodes]
    .filter((ep) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        String(ep.episode).includes(q) ||
        (ep.title && ep.title.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => (sortDesc ? b.episode - a.episode : a.episode - b.episode));

  const hasMultipleSeasons = Boolean(seasons && seasons.length > 1);
  const seasonOptions =
    seasons && seasons.length > 0
      ? seasons
      : [{ season: 1, name: 'Season 1' }];

  const chunkOptions = Array.from({ length: Math.max(1, totalChunks) }, (_, idx) => ({
    value: String(idx + 1),
    label: `Episodes ${idx * 100 + 1}-${(idx + 1) * 100}`,
  }));

  return (
    <div id="episodes-section" className="mt-3 md:mt-5">
      <div className="flex items-center justify-between gap-4 mb-5">
        <h2 className="heading-trail text-xl md:text-2xl font-semibold text-white min-w-0 truncate">
          Episodes
        </h2>
      </div>

      {/* Controls Bar (Animated Dropdown + Search + Sort + View Switcher) */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {hasMultipleSeasons ? (
          <>
            <AnimatedSelect
              value={String(selectedSeason)}
              onChange={(val) => onSeasonChange?.(Number(val))}
              options={seasonOptions.map((s) => ({
                value: String(s.season),
                label: s.name || `Season ${s.season}`,
              }))}
              ariaLabel="Select season"
              triggerClassName="min-w-[155px] max-w-[260px]"
            />
            {totalChunks > 1 && (
              <AnimatedSelect
                value={String(currentChunk)}
                onChange={(val) => onChunkChange(Number(val))}
                options={chunkOptions}
                ariaLabel="Select episode range"
                triggerClassName="min-w-[140px] max-w-[220px]"
              />
            )}
          </>
        ) : totalChunks > 1 ? (
          <AnimatedSelect
            value={String(currentChunk)}
            onChange={(val) => onChunkChange(Number(val))}
            options={chunkOptions}
            ariaLabel="Select episode range"
            triggerClassName="min-w-[140px] max-w-[240px]"
          />
        ) : (
          <AnimatedSelect
            value="1"
            onChange={() => {}}
            options={[{ value: '1', label: seasonOptions[0]?.name || 'Season 1' }]}
            ariaLabel="Select season"
            triggerClassName="min-w-[140px] max-w-[240px]"
          />
        )}

        {/* Animated Search Episode Input */}
        <motion.div
          animate={{ scale: searchFocused ? 1.015 : 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
          className="relative flex-1 min-w-[180px] max-w-xs"
        >
          <motion.svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{
              scale: searchFocused || searchQuery ? 1.12 : 1,
              rotate: searchFocused ? -8 : 0,
            }}
            transition={{ type: 'spring', stiffness: 360, damping: 22 }}
            className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none transition-colors duration-200 ${
              searchFocused || searchQuery ? 'text-white' : 'text-white/50'
            }`}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </motion.svg>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search episode..."
            style={CONTROL_GLASS_STYLE}
            className="h-9 rounded-[12px] border border-white/[0.07] hover:border-white/20 text-[12.5px] font-medium text-white transition-all duration-200 w-full pl-9 pr-8 placeholder:text-white/50 outline-none focus:border-white/40 focus:bg-white/[0.06]"
          />
          <AnimatePresence>
            {searchQuery && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.15 }}
                onClick={() => setSearchQuery('')}
                aria-label="Clear episode search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white/15 hover:bg-white/30 text-white/80 hover:text-white flex items-center justify-center text-[10px]"
              >
                ✕
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Animated Sort Toggle Button */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.91 }}
          onClick={() => setSortDesc((prev) => !prev)}
          style={CONTROL_GLASS_STYLE}
          className={`h-9 rounded-[12px] border text-[12.5px] font-medium transition-colors duration-200 w-9 flex items-center justify-center cursor-pointer ${
            sortDesc
              ? 'border-white/30 text-white bg-white/[0.09]'
              : 'border-white/[0.07] text-white/50 hover:text-white hover:border-white/25'
          }`}
          title={sortDesc ? 'Sorted Descending (Newest First)' : 'Sorted Ascending (Oldest First)'}
        >
          <motion.svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{ rotate: sortDesc ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 20 }}
            className="w-4 h-4"
          >
            <path d="m3 16 4 4 4-4" />
            <path d="M7 20V4" />
            <path d="M20 8h-5" />
            <path d="M15 10V6.5a2.5 2.5 0 0 1 5 0V10" />
            <path d="M15 14h5l-5 6h5" />
          </motion.svg>
        </motion.button>

        {/* Animated List / Grid View Switcher */}
        <div
          style={CONTROL_GLASS_STYLE}
          className="relative flex items-center p-1 rounded-[12px] border border-white/[0.07] hover:border-white/20 transition-colors duration-200"
        >
          <motion.div
            layout
            transition={{ type: 'spring', stiffness: 460, damping: 32 }}
            className="absolute top-1 bottom-1 w-9 bg-white/[0.14] rounded-[8px]"
            style={{ left: viewMode === 'list' ? '4px' : '40px' }}
          />
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => changeViewMode('list')}
            className={`relative z-10 h-7 w-9 flex items-center justify-center transition-colors duration-200 cursor-pointer ${
              viewMode === 'list' ? 'text-white drop-shadow-md' : 'text-white/40 hover:text-white/75'
            }`}
            aria-label="List view"
          >
            <motion.svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              animate={{ scale: viewMode === 'list' ? 1.06 : 0.94 }}
              transition={{ type: 'spring', stiffness: 380, damping: 24 }}
            >
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </motion.svg>
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => changeViewMode('grid')}
            className={`relative z-10 h-7 w-9 flex items-center justify-center transition-colors duration-200 cursor-pointer ${
              viewMode === 'grid' ? 'text-white drop-shadow-md' : 'text-white/40 hover:text-white/75'
            }`}
            aria-label="Grid view"
          >
            <motion.svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              animate={{ scale: viewMode === 'grid' ? 1.06 : 0.94 }}
              transition={{ type: 'spring', stiffness: 380, damping: 24 }}
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </motion.svg>
          </motion.button>
        </div>
      </div>

      {/* Next Airing Episode Banner */}
      {nextAiringEpisode && (
        <div className="flex items-center gap-3 p-3 mb-4 bg-white/[0.03] hover:bg-white/[0.05] transition-colors rounded-[12px] border border-white/[0.08]">
          <div className="flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
          </div>
          <div className="text-[13.5px] text-white/90 font-medium truncate">
            Episode {nextAiringEpisode.episode} in{' '}
            {(() => {
              const diff = nextAiringEpisode.airingAt * 1000 - Date.now();
              if (diff <= 0) return 'shortly';
              const d = Math.floor(diff / (1000 * 60 * 60 * 24));
              const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
              const m = Math.floor((diff / (1000 * 60)) % 60);
              return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
            })()}{' '}
            <span className="text-white/30 mx-1.5">•</span>{' '}
            <span className="text-white/50">
              {new Date(nextAiringEpisode.airingAt * 1000).toLocaleString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>
      )}

      {/* Episodes List or Grid */}
      {loadingEpisodes ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 rounded-[14px] bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : filteredEpisodes.length === 0 ? (
        <div className="flex justify-center p-8 text-white/50 text-sm">No episodes found.</div>
      ) : (
        <AnimatePresence mode="wait">
          {viewMode === 'list' ? (
            <motion.div
              key={`list-${sortDesc}-${selectedSeason}-${currentChunk}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative"
            >
              <div className="flex flex-col gap-2 max-h-[32rem] lg:max-h-[40rem] overflow-auto pr-1 custom-scrollbar">
                {filteredEpisodes.map((ep) => {
                  const runtimeLabel = ep.runtime ? `${ep.runtime} min` : '24 min';
                  const desc = ep.overview || 'No description available.';
                  const thumb = ep.still || backdrop || poster;

                  return (
                    <div
                      key={ep.episode}
                      className="group relative w-full rounded-[14px] border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/30 transition-all duration-200"
                    >
                      <div
                        className="flex items-center gap-3 md:gap-4 p-2 md:p-3 cursor-pointer md:cursor-default"
                        onClick={() =>
                          setExpandedMobileEp(expandedMobileEp === ep.episode ? null : ep.episode)
                        }
                      >
                        {/* Mobile Compact Row */}
                        <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0 md:hidden">
                          <div className="relative flex-shrink-0 w-28 aspect-video rounded-[8px] overflow-hidden bg-white/[0.04] border border-white/[0.05]">
                            {thumb && (
                              <LazyImage
                                src={thumb}
                                alt={ep.title}
                                className="w-full h-full"
                                imgClassName="object-cover w-full h-full"
                              />
                            )}
                            <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-white bg-black/80 backdrop-blur-sm rounded border border-white/[0.06]">
                              {ep.episode}
                            </span>
                          </div>
                          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                            <h4 className="font-medium text-white text-[13.5px] leading-snug line-clamp-1">
                              {ep.title}
                            </h4>
                            <span className="text-white/50 text-[11px] tabular-nums">
                              {runtimeLabel}
                            </span>
                          </div>
                        </div>

                        {/* Desktop Row */}
                        <Link
                          to={`/watch/anime/${animeId}/${currentChunk}/${ep.episode}`}
                          className="hidden md:flex items-center gap-4 flex-1 min-w-0"
                        >
                          <div className="relative flex-shrink-0 w-40 aspect-video rounded-[10px] overflow-hidden bg-white/[0.04] border border-white/[0.05]">
                            {thumb && (
                              <LazyImage
                                src={thumb}
                                alt={ep.title}
                                className="w-full h-full"
                                imgClassName="object-cover w-full h-full group-hover:scale-[1.04] transition-transform duration-500 ease-out"
                              />
                            )}
                            <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-white bg-black/80 backdrop-blur-sm rounded border border-white/[0.06]">
                              {ep.episode}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1 min-w-0 flex-1 py-1">
                            <h4 className="font-medium text-white text-[15px] leading-snug line-clamp-1 transition-colors duration-200 group-hover:text-white/80">
                              {ep.title}
                            </h4>
                            <span className="text-white/50 text-[11.5px] tabular-nums">
                              {runtimeLabel}
                            </span>
                            <p className="text-white/50 text-[13px] leading-relaxed line-clamp-2">
                              {desc}
                            </p>
                          </div>
                        </Link>
                      </div>

                      {/* Mobile Expandable Drawer */}
                      <div
                        className={`md:hidden overflow-hidden transition-all duration-300 ease-out ${
                          expandedMobileEp === ep.episode ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'
                        }`}
                      >
                        <div className="px-3 pb-3 pt-1">
                          <h4 className="font-medium text-white text-[15px] leading-snug mb-2">
                            <span className="tabular-nums">{ep.episode}.</span> {ep.title}
                          </h4>
                          <p className="text-white/50 text-[13px] leading-relaxed mb-3 max-h-[140px] overflow-y-auto pr-1">
                            {desc}
                          </p>
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/watch/anime/${animeId}/${currentChunk}/${ep.episode}`}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-black text-[12px] font-medium hover:bg-gray-200 transition-all"
                            >
                              Play
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            /* Horizontal Grid View (Exact match to ContentSections-CbYc6qMO.js) */
            <motion.div
              key={`grid-${sortDesc}-${selectedSeason}-${currentChunk}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="group/grid relative"
            >
              <button
                aria-label="scroll left"
                onClick={() =>
                  gridScrollRef.current?.scrollBy({
                    left: -gridScrollRef.current.clientWidth * 0.8,
                    behavior: 'smooth',
                  })
                }
                className="absolute left-0 top-0 z-20 hidden h-full w-14 items-center justify-center bg-gradient-to-r from-black/80 to-transparent text-3xl text-white opacity-0 group-hover/grid:opacity-100 transition-opacity duration-200 md:flex"
              >
                ‹
              </button>

              <div
                ref={gridScrollRef}
                className="flex gap-3 overflow-x-auto no-scrollbar pb-1"
              >
                {filteredEpisodes.map((ep) => {
                  const thumb = ep.still || backdrop || poster;
                  const desc = ep.overview || 'No description available.';
                  const runtimeLabel = ep.runtime ? `${ep.runtime}m` : '24m';

                  return (
                    <Link
                      key={ep.episode}
                      to={`/watch/anime/${animeId}/${currentChunk}/${ep.episode}`}
                      className="w-[min(21.5rem,calc(100%-2.25rem))] sm:w-[320px] md:w-[380px] xl:w-[420px] flex-shrink-0"
                    >
                      <div className="group relative w-full overflow-hidden rounded-[16px] border border-white/[0.06] bg-white/[0.03]">
                        <div className="relative aspect-video block">
                          {thumb && (
                            <LazyImage
                              src={thumb}
                              alt={ep.title}
                              className="absolute inset-0 h-full w-full"
                              imgClassName="h-full w-full object-cover brightness-[0.72] transition-transform duration-700 ease-out group-hover:scale-[1.05]"
                            />
                          )}
                          <div
                            className="absolute inset-0"
                            style={{
                              background:
                                'linear-gradient(to top, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.62) 40%, rgba(0,0,0,0.28) 68%, rgba(0,0,0,0.12) 100%)',
                            }}
                          />
                          <div className="absolute inset-x-0 bottom-0 flex flex-col p-3.5 md:p-4">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">
                              Episode {ep.episode}
                            </span>
                            <h4 className="mt-0.5 text-[15px] font-semibold leading-snug text-white line-clamp-1 md:text-[17px]">
                              {ep.title}
                            </h4>
                            <p className="mt-1.5 text-[13px] leading-relaxed text-white/70 line-clamp-2">
                              {desc}
                            </p>
                            <div className="mt-2.5 flex items-center gap-2 text-[12.5px] text-white/80">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="11"
                                height="11"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                className="text-white"
                              >
                                <polygon points="5 3 19 12 5 21 5 3" />
                              </svg>
                              <span className="tabular-nums">{runtimeLabel}</span>
                              {ep.rating && Number(ep.rating) > 0 && (
                                <span className="ml-auto inline-flex items-center gap-1 text-white/80">
                                  ★ {Number(ep.rating).toFixed(1)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              <button
                aria-label="scroll right"
                onClick={() =>
                  gridScrollRef.current?.scrollBy({
                    left: gridScrollRef.current.clientWidth * 0.8,
                    behavior: 'smooth',
                  })
                }
                className="absolute right-0 top-0 z-20 hidden h-full w-14 items-center justify-center bg-gradient-to-l from-black/80 to-transparent text-3xl text-white opacity-0 group-hover/grid:opacity-100 transition-opacity duration-200 md:flex"
              >
                ›
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Native <dialog> Download Modal */}
      <dialog
        ref={dialogRef}
        {...({ closedby: 'any' } as any)}
        className="m-auto rounded-2xl bg-[#141414] text-white border border-white/10 p-0 w-[92%] max-w-md shadow-2xl backdrop:bg-black/80 backdrop:backdrop-blur-sm"
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Download Options</h3>
          <button
            onClick={() => dialogRef.current?.close()}
            className="text-white/50 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
        <div className="p-5">
          <p className="text-xs text-white/60 mb-4">
            {animeTitle} — Episode {downloadEp?.episode || 1} ({downloadEp?.title || 'Simulcast'})
          </p>
          <div className="flex flex-col gap-3">
            {[
              { label: '1080p Full HD (Sub)', server: 'Anivexa • AniZone HLS', mode: 'sub' },
              { label: '1080p Full HD (English Dub)', server: 'Anivexa • AniWaves HD', mode: 'dub' },
              { label: '720p HD (Multi-Audio)', server: 'Anivexa • AniKoto', mode: 'sub' },
            ].map((opt, idx) => (
              <Link
                key={idx}
                to={`/watch/anime/${animeId}/1/${downloadEp?.episode || 1}?mode=${opt.mode}`}
                onClick={() => dialogRef.current?.close()}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all group/dl text-left w-full"
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-semibold text-white group-hover/dl:text-[#4ade80] transition-colors text-sm">
                    {opt.label}
                  </span>
                  <span className="text-xs text-white/50 mt-0.5">{opt.server}</span>
                </div>
                <div className="shrink-0 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover/dl:bg-[#4ade80]/20 group-hover/dl:text-[#4ade80] transition-colors">
                  ↓
                </div>
              </Link>
            ))}
          </div>
        </div>
      </dialog>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 5. CHARACTERS / ACTORS SECTION (Exact 2:3 Portrait Cards from Screenshot)  */
/* -------------------------------------------------------------------------- */
export const CharactersSection: React.FC<{
  cast?: Array<{
    id: number | string;
    name: string;
    character?: string;
    profile?: string | null;
    photo?: string | null;
  }>;
  label?: string;
}> = ({ cast, label = 'Characters' }) => {
  const rowRef = useRef<HTMLDivElement>(null);

  if (!cast || cast.length === 0) return null;

  return (
    <div className="mt-14 select-none">
      <div className="flex items-center justify-between gap-4 mb-5">
        <h2 className="heading-trail text-xl md:text-2xl font-semibold text-white min-w-0 truncate">
          {label}
        </h2>
      </div>

      <div className="group/cast relative">
        <button
          aria-label="scroll left"
          onClick={() =>
            rowRef.current?.scrollBy({
              left: -rowRef.current.clientWidth * 0.8,
              behavior: 'smooth',
            })
          }
          className="absolute left-0 top-0 z-20 hidden h-full w-14 items-center justify-center bg-gradient-to-r from-black/80 to-transparent text-3xl text-white opacity-0 group-hover/cast:opacity-100 transition-opacity duration-200 md:flex"
        >
          ‹
        </button>

        <div
          ref={rowRef}
          role="group"
          aria-label={label}
          className="flex gap-3 overflow-x-auto no-scrollbar pb-1"
        >
          {cast.slice(0, 20).map((person, idx) => {
            const img = person.photo || person.profile;
            return (
              <div
                key={`${person.id}-${idx}`}
                className="group shrink-0 w-[112px] sm:w-[128px] md:w-[140px]"
              >
                <article>
                  <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[12px] border border-white/[0.06] bg-white/[0.04] transition-colors duration-200 group-hover:border-white/40">
                    {img ? (
                      <LazyImage
                        src={img}
                        alt={person.name}
                        className="absolute inset-0 h-full w-full"
                        imgClassName="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                      />
                    ) : (
                      <span
                        className="absolute inset-0 flex items-center justify-center text-white/25"
                        aria-hidden="true"
                      >
                        <ClockIcon className="h-8 w-8" />
                      </span>
                    )}
                  </div>
                  <div className="mt-2 min-w-0">
                    <p className="text-[13px] md:text-sm font-medium leading-tight text-white line-clamp-1 transition-colors duration-200 group-hover:text-white/80">
                      {person.name}
                    </p>
                    {person.character && (
                      <p className="mt-0.5 text-xs leading-snug text-white/50 line-clamp-1">
                        {person.character}
                      </p>
                    )}
                  </div>
                </article>
              </div>
            );
          })}
        </div>

        <button
          aria-label="scroll right"
          onClick={() =>
            rowRef.current?.scrollBy({
              left: rowRef.current.clientWidth * 0.8,
              behavior: 'smooth',
            })
          }
          className="absolute right-0 top-0 z-20 hidden h-full w-14 items-center justify-center bg-gradient-to-l from-black/80 to-transparent text-3xl text-white opacity-0 group-hover/cast:opacity-100 transition-opacity duration-200 md:flex"
        >
          ›
        </button>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 6. KEEP BINGRING (Exact 16:9 Landscape Cards from ContentSections)         */
/* -------------------------------------------------------------------------- */
const KeepBingringCard: React.FC<{ item: AnimeMedia }> = ({ item }) => {
  const [hovered, setHovered] = useState(false);
  const [muted, setMuted] = useState(true);
  const [trailerUrl, setTrailerUrl] = useState<string | null>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onEnter = () => {
    timerRef.current = setTimeout(async () => {
      setHovered(true);
      try {
        const details = await fetchAnimeDetails(item.id);
        if (details.imdb_id) {
          const url = await fetchImdbTrailer(details.imdb_id);
          if (url) setTrailerUrl(url);
        }
      } catch {
        // ignore
      }
    }, 1200);
  };

  const onLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setHovered(false);
    setVideoPlaying(false);
  };

  return (
    <Link
      to={`/anime/${item.id}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="group flex flex-col gap-2 w-full transition-all duration-200"
    >
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-white/5 border-2 border-[#18181b] group-hover:border-[#6b7280] transition-colors duration-200 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        {hovered && trailerUrl && (
          <video
            src={trailerUrl}
            autoPlay
            muted={muted}
            loop
            playsInline
            onPlay={() => {
              setVideoPlaying(true);
              window.dispatchEvent(new Event('bingr:pause-main-trailer'));
            }}
            onPlaying={() => setVideoPlaying(true)}
            className={`absolute inset-0 w-full h-full object-cover z-10 pointer-events-none transition-opacity duration-300 ${
              videoPlaying ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        <LazyImage
          src={item.logo_backdrop || item.backdrop || item.poster}
          alt={item.title}
          className="w-full h-full absolute inset-0 z-0"
          imgClassName="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />

        {(!hovered || !videoPlaying) && (
          <>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-60 z-0" />
            <div className="absolute bottom-1.5 left-1.5 right-1.5 sm:bottom-2 sm:left-2 sm:right-2 flex items-end justify-between gap-2 z-10">
              {item.rating && Number(item.rating) > 0 ? (
                <div className="flex items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[11px] font-bold text-white bg-black/60 px-1 sm:px-1.5 py-0.5 rounded backdrop-blur-md border border-white/10">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-2.5 h-2.5 sm:w-[10px] sm:h-[10px] text-white"
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  {item.rating}
                </div>
              ) : (
                <div />
              )}

              <div className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/10 border border-white/20 text-white opacity-0 transform translate-y-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0 backdrop-blur-md">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="sm:w-[14px] sm:h-[14px]"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
            </div>
          </>
        )}

        {hovered && trailerUrl && videoPlaying && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMuted((m) => !m);
            }}
            className="absolute bottom-2 right-2 z-20 w-7 h-7 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white hover:bg-black/80 hover:scale-110 transition-all pointer-events-auto"
          >
            <VolumeIcon isMuted={muted} className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex flex-col px-0.5">
        <h3 className="text-[12px] sm:text-[14px] font-medium text-white/90 leading-snug truncate transition-colors duration-200 group-hover:text-white">
          {item.title}
        </h3>
        <div className="flex items-center gap-1 sm:gap-1.5 mt-1 text-[9px] sm:text-[11px] text-white/50 leading-none truncate font-medium">
          {item.year && <span>{item.year}</span>}
          {item.year && <span className="w-1 h-1 rounded-full bg-white/20" />}
          <span className="uppercase tracking-wider">Anime</span>
        </div>
      </div>
    </Link>
  );
};

export const KeepBingringSection: React.FC<{ items?: AnimeMedia[] }> = ({ items }) => {
  if (!items || items.length === 0) return null;

  return (
    <div id="you-may-like" className="mt-14 w-full h-full select-none">
      <h2 className="heading-trail text-xl md:text-2xl font-semibold text-white min-w-0 truncate mb-6">
        More Like This
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3 sm:gap-4 md:gap-5 lg:gap-6">
        {items.map((item) => (
          <KeepBingringCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
};
