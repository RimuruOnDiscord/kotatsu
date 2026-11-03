import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  getWatchlist,
  getContinueWatching,
  setWatchlistItem,
  updateWatchlistStatus,
  WatchlistEntry,
  WatchlistStatus,
  ContinueWatchingEntry,
} from '../lib/storage';
import {
  getNexusPosterForAnime,
  getNexusBannerForAnime,
  fetchNexusArtForAnime,
} from '../lib/api';
import { ContinueWatchingRow } from '../components/ContentSections';
import { LazyImage } from '../components/LazyImage';
import { AnimatedSelect } from '../components/AnimatedSelect';

type TabId = 'all' | WatchlistStatus;
type SortId = 'recent' | 'oldest' | 'title' | 'rating' | 'year';
type LayoutMode = 'poster' | 'cinema';

const EASE = [0.32, 0.72, 0, 1] as const;

const STATUS_META: Record<
  WatchlistStatus,
  { label: string; short: string; dotClass: string; badgeTextClass: string }
> = {
  watchlist: {
    label: 'Saved',
    short: 'Saved',
    dotClass: 'bg-white',
    badgeTextClass: 'text-white/95',
  },
  planned: {
    label: 'Plan to Watch',
    short: 'Planned',
    dotClass: 'bg-sky-400',
    badgeTextClass: 'text-sky-200',
  },
  completed: {
    label: 'Completed',
    short: 'Done',
    dotClass: 'bg-emerald-400',
    badgeTextClass: 'text-emerald-200',
  },
};

const SORT_OPTIONS: { value: SortId; label: string }[] = [
  { value: 'recent', label: 'Recently Added' },
  { value: 'oldest', label: 'Oldest Added' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'year', label: 'Newest Release' },
];

/* -------------------------------------------------------------------------- */
/* Status icons                                                               */
/* -------------------------------------------------------------------------- */
const StatusIcon: React.FC<{ status: WatchlistStatus; className?: string }> = ({
  status,
  className = 'w-3.5 h-3.5',
}) => {
  if (status === 'watchlist') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    );
  }
  if (status === 'planned') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
};

/* -------------------------------------------------------------------------- */
/* Watchlist Card (Supports 2:3 Poster & 16:9 Cinema Landscape Modes)         */
/* -------------------------------------------------------------------------- */
const WatchlistCard: React.FC<{
  item: WatchlistEntry;
  progressEntry?: ContinueWatchingEntry;
  layoutMode: LayoutMode;
}> = ({ item, progressEntry, layoutMode }) => {
  const navigate = useNavigate();
  const [nexusArt, setNexusArt] = useState<{ poster: string | null; banner: string | null }>(() => ({
    poster: getNexusPosterForAnime(item.title, item.id),
    banner: getNexusBannerForAnime(item.title, item.id),
  }));

  useEffect(() => {
    let cancelled = false;
    const cachedPoster = getNexusPosterForAnime(item.title, item.id);
    const cachedBanner = getNexusBannerForAnime(item.title, item.id);
    if (cachedPoster && cachedBanner) {
      setNexusArt({ poster: cachedPoster, banner: cachedBanner });
      return;
    }
    fetchNexusArtForAnime(item.title, item.id)
      .then((art) => {
        if (!cancelled && (art.poster || art.banner)) {
          setNexusArt({
            poster: art.poster || cachedPoster,
            banner: art.banner || cachedBanner,
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [item.id, item.title]);

  const changeStatus = (status: WatchlistStatus) => {
    if (status === item.status) return;
    updateWatchlistStatus(item.id, status);
    toast(`Moved "${item.title}" to ${STATUS_META[status].label}`);
  };

  const remove = () => {
    setWatchlistItem(item as any, null);
    toast(`Removed "${item.title}" from Watchlist`, {
      action: {
        label: 'Undo',
        onClick: () => setWatchlistItem(item as any, item.status),
      },
    });
  };

  const playNow = () => {
    const targetEp = progressEntry?.episode || 1;
    navigate(`/watch/anime/${item.id}/1/${targetEp}`);
  };

  const displayPoster =
    nexusArt.poster ||
    getNexusPosterForAnime(item.title, item.id) ||
    item.poster ||
    item.backdrop;

  const displayBanner =
    nexusArt.banner ||
    getNexusBannerForAnime(item.title, item.id) ||
    progressEntry?.still ||
    nexusArt.poster ||
    item.backdrop ||
    item.poster;

  const targetEp = progressEntry?.episode || 1;
  const progressPct = progressEntry?.progress || 0;
  const meta = STATUS_META[item.status];

  if (layoutMode === 'cinema') {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3, ease: EASE }}
      >
        <article className="group relative select-none transition-transform duration-300 ease-out hover:-translate-y-0.5">
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-[#0b0b0e] ring-1 ring-white/[0.08] group-hover:ring-white/25 shadow-[0_12px_30px_rgba(0,0,0,0.7)] transition-all duration-300">
            {displayBanner ? (
              <LazyImage
                src={displayBanner}
                alt={item.title}
                className="w-full h-full"
                imgClassName="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center p-3 text-center text-xs text-white/40 font-medium">
                {item.title}
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10 pointer-events-none" />

            {/* Top Left: Clean status badge (fades out on hover when switcher shows) */}
            <span
              className={`pointer-events-none absolute top-3 left-3 z-20 inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-black/65 backdrop-blur-md border border-white/[0.12] text-[10.5px] font-semibold tracking-wide transition-opacity duration-200 group-hover:opacity-0 ${meta.badgeTextClass}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
              {meta.short}
            </span>

            {/* Top Right: Remove button */}
            <button
              type="button"
              onClick={remove}
              aria-label={`Remove ${item.title} from Watchlist`}
              title="Remove from Watchlist"
              className="absolute top-3 right-3 z-20 w-7 h-7 rounded-full bg-black/65 backdrop-blur-md border border-white/[0.12] text-white/70 hover:text-black hover:bg-white hover:border-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all duration-200 cursor-pointer"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            {/* Center Play Button on Hover */}
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button
                type="button"
                onClick={playNow}
                aria-label={progressEntry ? `Resume ${item.title} Episode ${targetEp}` : `Watch ${item.title}`}
                className="pointer-events-auto flex items-center gap-2 pl-3.5 pr-4 h-9 rounded-full bg-white text-black font-bold text-xs shadow-[0_8px_24px_rgba(0,0,0,0.75)] scale-95 group-hover:scale-100 hover:bg-white/90 transition-all duration-200 cursor-pointer"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.5 5.2v13.6a.85.85 0 0 0 1.3.72l10.4-6.8a.85.85 0 0 0 0-1.44L8.8 4.48a.85.85 0 0 0-1.3.72z" />
                </svg>
                <span>{progressEntry ? `EP ${targetEp}` : 'Play'}</span>
              </button>
            </div>

            {/* Bottom Info + Status Switcher */}
            <div className="absolute inset-x-0 bottom-0 z-20 p-3.5 flex items-end justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-[14.5px] font-bold text-white leading-snug line-clamp-1">
                  <Link
                    to={`/anime/${item.id}`}
                    className="focus:outline-none after:content-[''] after:absolute after:inset-0 after:z-10"
                  >
                    {item.title}
                  </Link>
                </h3>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-white/60 mt-0.5 tabular-nums">
                  {item.year && <span>{item.year}</span>}
                  {item.year && item.rating && <span className="text-white/25">·</span>}
                  {item.rating && (
                    <span className="inline-flex items-center gap-0.5 text-white/75">
                      <span className="text-amber-400">★</span>
                      {item.rating}
                    </span>
                  )}
                  {progressEntry && (
                    <>
                      {(item.year || item.rating) && <span className="text-white/25">·</span>}
                      <span className="text-white/90 font-semibold">EP {targetEp}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Compact Status Switcher on Hover */}
              <div className="relative z-20 flex items-center gap-0.5 p-0.5 rounded-lg bg-black/75 backdrop-blur-md border border-white/[0.12] opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 shrink-0">
                {(Object.keys(STATUS_META) as WatchlistStatus[]).map((s) => {
                  const active = item.status === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => changeStatus(s)}
                      title={STATUS_META[s].label}
                      aria-pressed={active}
                      className={`h-6 px-2 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                        active
                          ? 'bg-white text-black font-bold'
                          : 'text-white/65 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <StatusIcon status={s} className="w-2.5 h-2.5" />
                      <span>{STATUS_META[s].short}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Episode Progress Bar */}
            {progressPct > 0 && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-white/15 z-30">
                <div
                  className="h-full bg-white transition-all duration-300"
                  style={{ width: `${Math.max(4, Math.min(100, progressPct))}%` }}
                />
              </div>
            )}
          </div>
        </article>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.28, ease: EASE }}
    >
      <article className="group relative select-none transition-transform duration-300 ease-out hover:-translate-y-1">
        <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-[#0b0b0e] ring-1 ring-white/[0.08] group-hover:ring-white/25 shadow-[0_10px_28px_rgba(0,0,0,0.65)] transition-all duration-300">
          {displayPoster ? (
            <LazyImage
              src={displayPoster}
              alt={item.title}
              className="w-full h-full"
              imgClassName="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-3 text-center text-xs text-white/40 font-medium">
              {item.title}
            </div>
          )}

          {/* Subtle gradient scrim on hover so controls stay legible without burying the poster */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/25 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

          {/* Top-left status pill (fades out on hover when bottom status switcher appears) */}
          <span
            className={`pointer-events-none absolute top-2.5 left-2.5 z-20 inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-black/65 backdrop-blur-md border border-white/[0.12] text-[10.5px] font-semibold tracking-wide transition-opacity duration-200 group-hover:opacity-0 ${meta.badgeTextClass}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
            {meta.short}
          </span>

          {/* Top-right remove button */}
          <button
            type="button"
            onClick={remove}
            aria-label={`Remove ${item.title} from Watchlist`}
            title="Remove from Watchlist"
            className="absolute top-2.5 right-2.5 z-20 w-7 h-7 rounded-full bg-black/65 backdrop-blur-md border border-white/[0.12] text-white/75 hover:text-black hover:bg-white hover:border-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all duration-200 cursor-pointer"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          {/* Center circular Play button on hover */}
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              type="button"
              onClick={playNow}
              title={progressEntry ? `Resume Episode ${targetEp}` : 'Watch Episode 1'}
              aria-label={progressEntry ? `Resume ${item.title} Episode ${targetEp}` : `Watch ${item.title}`}
              className="pointer-events-auto w-11 h-11 rounded-full bg-white text-black hover:bg-white/90 shadow-[0_8px_24px_rgba(0,0,0,0.75)] flex items-center justify-center scale-90 group-hover:scale-100 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="translate-x-0.5">
                <path d="M7.5 5.2v13.6a.85.85 0 0 0 1.3.72l10.4-6.8a.85.85 0 0 0 0-1.44L8.8 4.48a.85.85 0 0 0-1.3.72z" />
              </svg>
            </button>
          </div>

          {/* Bottom compact status switcher on hover */}
          <div className="absolute inset-x-2 bottom-2.5 z-20 grid grid-cols-3 gap-0.5 p-0.5 rounded-lg bg-black/75 backdrop-blur-md border border-white/[0.12] opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 focus-within:opacity-100 focus-within:translate-y-0 transition-all duration-200">
            {(Object.keys(STATUS_META) as WatchlistStatus[]).map((s) => {
              const active = item.status === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => changeStatus(s)}
                  title={STATUS_META[s].label}
                  aria-label={`Mark as ${STATUS_META[s].label}`}
                  aria-pressed={active}
                  className={`h-6 rounded-[6px] text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                    active
                      ? 'bg-white text-black font-bold shadow-sm'
                      : 'text-white/65 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="truncate">{STATUS_META[s].short}</span>
                </button>
              );
            })}
          </div>

          {/* Live Episode Progress Bar at bottom of poster */}
          {progressPct > 0 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-white/15 z-30">
              <div
                className="h-full bg-white transition-all duration-300"
                style={{ width: `${Math.max(4, Math.min(100, progressPct))}%` }}
              />
            </div>
          )}
        </div>

        <div className="mt-2.5 px-0.5">
          <h3 className="text-[13.5px] sm:text-[14px] font-semibold text-white/95 leading-snug line-clamp-1 group-hover:text-white transition-colors">
            <Link
              to={`/anime/${item.id}`}
              className="focus:outline-none after:content-[''] after:absolute after:inset-0 after:z-10"
            >
              {item.title}
            </Link>
          </h3>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] font-medium text-white/45 tabular-nums">
            {item.year && <span>{item.year}</span>}
            {item.year && (progressEntry || item.rating || item.genres?.[0]) && (
              <span className="text-white/25">·</span>
            )}
            {progressEntry ? (
              <span className="text-white/75 font-semibold">
                EP {progressEntry.episode} · {progressEntry.progress}%
              </span>
            ) : item.rating ? (
              <span className="inline-flex items-center gap-0.5 text-white/65">
                <span className="text-amber-400/90 text-[10px]">★</span>
                {item.rating}
              </span>
            ) : item.genres?.[0] ? (
              <span className="text-white/55 truncate">{item.genres[0]}</span>
            ) : null}
          </div>
        </div>
      </article>
    </motion.div>
  );
};

/* -------------------------------------------------------------------------- */
/* Watchlist Page                                                             */
/* -------------------------------------------------------------------------- */
export const WatchlistPage: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>('all');
  const [sort, setSort] = useState<SortId>('recent');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => {
    const saved = localStorage.getItem('kotatsu_watchlist_layout');
    return saved === 'cinema' ? 'cinema' : 'poster';
  });
  const [query, setQuery] = useState('');
  const [list, setList] = useState<WatchlistEntry[]>(getWatchlist());
  const [continueList, setContinueList] = useState(getContinueWatching());

  useEffect(() => {
    document.title = 'Watchlist — Kotatsu';
    const sync = () => {
      setList(getWatchlist());
      setContinueList(getContinueWatching());
    };
    window.addEventListener('bingr-storage-update', sync);
    return () => window.removeEventListener('bingr-storage-update', sync);
  }, []);

  const changeLayoutMode = (mode: LayoutMode) => {
    setLayoutMode(mode);
    localStorage.setItem('kotatsu_watchlist_layout', mode);
  };

  const progressMap = useMemo(() => {
    const map = new Map<string, ContinueWatchingEntry>();
    continueList.forEach((entry) => {
      map.set(String(entry.id), entry);
    });
    return map;
  }, [continueList]);

  const counts = useMemo(
    () => ({
      all: list.length,
      watchlist: list.filter((i) => i.status === 'watchlist').length,
      planned: list.filter((i) => i.status === 'planned').length,
      completed: list.filter((i) => i.status === 'completed').length,
    }),
    [list]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = tab === 'all' ? list : list.filter((i) => i.status === tab);
    if (q) out = out.filter((i) => i.title.toLowerCase().includes(q));
    const sorted = [...out];
    switch (sort) {
      case 'oldest':
        sorted.sort((a, b) => a.addedAt - b.addedAt);
        break;
      case 'title':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'rating':
        sorted.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
        break;
      case 'year':
        sorted.sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
        break;
      default:
        sorted.sort((a, b) => b.addedAt - a.addedAt);
    }
    return sorted;
  }, [list, tab, sort, query]);

  const heroBackdrop = useMemo(() => {
    const latest = [...list].sort((a, b) => b.addedAt - a.addedAt)[0];
    if (!latest) return continueList[0]?.still || continueList[0]?.backdrop || null;
    return (
      getNexusBannerForAnime(latest.title, latest.id) ||
      (latest.backdrop && latest.backdrop !== latest.poster ? latest.backdrop : null) ||
      getNexusPosterForAnime(latest.title, latest.id) ||
      latest.poster
    );
  }, [list, continueList]);

  const handleSurpriseMe = () => {
    const pool = visible.length > 0 ? visible : list;
    if (!pool.length) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    navigate(`/anime/${pick.id}`);
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'watchlist', label: STATUS_META.watchlist.label },
    { id: 'planned', label: STATUS_META.planned.label },
    { id: 'completed', label: STATUS_META.completed.label },
  ];

  return (
    <div className="relative min-h-screen bg-black text-white select-none">
      {/* Ambient header backdrop from the most recently added title */}
      {heroBackdrop && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[380px] overflow-hidden">
          <img
            src={heroBackdrop}
            alt=""
            className="w-full h-full object-cover object-center opacity-20 blur-[3px] scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/85 to-black" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
        </div>
      )}

      <div className="relative">
        <header className="px-4 sm:px-6 md:pl-28 md:pr-12 pt-10 sm:pt-14 pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] sm:text-[34px] font-extrabold tracking-tight leading-none">
              Watchlist
            </h1>
            <p className="mt-2 text-[13px] font-medium text-white/45">
              {counts.all === 0
                ? 'Save anime to keep track of what you want to watch next.'
                : `${counts.all} ${counts.all === 1 ? 'title' : 'titles'} in your library`}
            </p>
          </div>

          {/* Quick Actions */}
          {(counts.all > 0 || continueList.length > 0) && (
            <div className="flex items-center gap-2.5">
              {continueList[0] && (
                <Link
                  to={`/watch/anime/${continueList[0].id}/1/${continueList[0].episode || 1}`}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-white text-black hover:bg-white/90 font-bold text-[12.5px] transition-transform active:scale-95 shadow-lg"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.5 5.2v13.6a.85.85 0 0 0 1.3.72l10.4-6.8a.85.85 0 0 0 0-1.44L8.8 4.48a.85.85 0 0 0-1.3.72z" />
                  </svg>
                  <span className="max-w-[180px] truncate">
                    Resume {continueList[0].title}
                  </span>
                </Link>
              )}

              {counts.all > 1 && (
                <button
                  type="button"
                  onClick={handleSurpriseMe}
                  className="inline-flex items-center gap-2 h-9 px-3.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.09] hover:border-white/20 text-white/80 hover:text-white font-semibold text-[12.5px] transition-colors cursor-pointer"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 3 21 3 21 8" />
                    <line x1="4" y1="20" x2="21" y2="3" />
                    <polyline points="21 16 21 21 16 21" />
                    <line x1="15" y1="15" x2="21" y2="21" />
                    <line x1="4" y1="4" x2="9" y2="9" />
                  </svg>
                  <span>Surprise Me</span>
                </button>
              )}
            </div>
          )}
        </header>

        {continueList.length > 0 && (
          <ContinueWatchingRow
            items={continueList}
            onRemove={() => setContinueList(getContinueWatching())}
          />
        )}

        <div className="px-4 sm:px-6 md:pl-28 md:pr-12 pb-24 md:pb-16">
          {counts.all === 0 ? (
            <div className="mt-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] py-20 px-6 text-center">
              <div className="w-13 h-13 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center mx-auto mb-4 text-white/60">
                <StatusIcon status="watchlist" className="w-5 h-5" />
              </div>
              <p className="text-[16px] font-bold text-white mb-1.5">Your Watchlist is empty</p>
              <p className="text-[13px] text-white/45 mb-6 max-w-sm mx-auto leading-relaxed">
                Bookmark any anime to save it here, then organize it into Plan to Watch or Completed.
              </p>
              <Link
                to="/explore"
                className="inline-flex items-center h-10 px-5 rounded-full bg-white text-black font-bold text-[13px] hover:bg-white/90 transition active:scale-95"
              >
                Explore Anime
              </Link>
            </div>
          ) : (
            <>
              {/* Unified Filter & View Toolbar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-7 pb-4 border-b border-white/[0.06]">
                <div className="overflow-x-auto overflow-y-hidden no-scrollbar">
                  <div className="relative inline-flex items-center p-1 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                    {tabs.map((t) => {
                      const active = tab === t.id;
                      const count = counts[t.id];
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTab(t.id)}
                          className={`relative h-8 px-3.5 text-[12.5px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                            active ? 'text-black' : 'text-white/55 hover:text-white'
                          }`}
                        >
                          {active && (
                            <motion.span
                              layoutId="watchlistTabPill"
                              transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                              className="absolute inset-0 rounded-[8px] bg-white shadow-sm"
                            />
                          )}
                          <span className="relative flex items-center gap-1.5">
                            <span>{t.label}</span>
                            {count > 0 && (
                              <span
                                className={`text-[11px] font-bold tabular-nums ${
                                  active ? 'text-black/50' : 'text-white/35'
                                }`}
                              >
                                {count}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 lg:flex-none flex items-center h-9 lg:w-[230px] rounded-xl bg-white/[0.03] border border-white/[0.08] focus-within:border-white/25 focus-within:bg-white/[0.05] transition-colors px-3 gap-2">
                    <svg width="13.5" height="13.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="text-white/40 shrink-0">
                      <circle cx="11" cy="11" r="7" />
                      <path d="m20 20-3.5-3.5" />
                    </svg>
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Filter titles..."
                      aria-label="Filter watchlist by title"
                      className="flex-1 min-w-0 bg-transparent text-[12.5px] font-medium text-white placeholder:text-white/35 focus:outline-none"
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        aria-label="Clear filter"
                        className="text-white/40 hover:text-white transition-colors cursor-pointer"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Poster Grid vs. 16:9 Cinema Backdrop Toggle */}
                  <div className="inline-flex items-center p-0.5 h-9 rounded-xl bg-white/[0.03] border border-white/[0.08] shrink-0">
                    <button
                      type="button"
                      onClick={() => changeLayoutMode('poster')}
                      title="Poster Grid"
                      aria-label="Poster Grid view"
                      className={`w-8 h-8 rounded-[9px] grid place-items-center transition-colors cursor-pointer ${
                        layoutMode === 'poster'
                          ? 'bg-white text-black shadow-sm'
                          : 'text-white/45 hover:text-white'
                      }`}
                    >
                      <svg width="13.5" height="13.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="9" rx="1.5" />
                        <rect x="14" y="3" width="7" height="9" rx="1.5" />
                        <rect x="3" y="15" width="7" height="6" rx="1.5" />
                        <rect x="14" y="15" width="7" height="6" rx="1.5" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => changeLayoutMode('cinema')}
                      title="Cinema Cards (16:9)"
                      aria-label="Cinema 16:9 Cards view"
                      className={`w-8 h-8 rounded-[9px] grid place-items-center transition-colors cursor-pointer ${
                        layoutMode === 'cinema'
                          ? 'bg-white text-black shadow-sm'
                          : 'text-white/45 hover:text-white'
                      }`}
                    >
                      <svg width="14.5" height="14.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="4" width="20" height="7" rx="1.5" />
                        <rect x="2" y="13" width="20" height="7" rx="1.5" />
                      </svg>
                    </button>
                  </div>

                  <AnimatedSelect
                    value={sort}
                    onChange={(v) => setSort(v as SortId)}
                    options={SORT_OPTIONS}
                    ariaLabel="Sort watchlist"
                    align="right"
                    triggerClassName="h-9 min-w-[152px] rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-white/20 text-[12.5px]"
                    icon={
                      <svg width="13.5" height="13.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m3 16 4 4 4-4" />
                        <path d="M7 20V4" />
                        <path d="m21 8-4-4-4 4" />
                        <path d="M17 4v16" />
                      </svg>
                    }
                  />
                </div>
              </div>

              {/* Grid */}
              {visible.length === 0 ? (
                <div className="rounded-2xl bg-white/[0.02] border border-white/[0.08] py-16 text-center">
                  <p className="text-[15px] font-bold text-white mb-1">
                    {query
                      ? `No matches for "${query}"`
                      : `Nothing in ${tabs.find((t) => t.id === tab)?.label} yet`}
                  </p>
                  <p className="text-[13px] text-white/45">
                    {query
                      ? 'Try searching for a different title.'
                      : 'Hover any card and use the status bar at the bottom to organize your list.'}
                  </p>
                </div>
              ) : (
                <motion.div
                  layout
                  className={
                    layoutMode === 'cinema'
                      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5'
                      : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-x-4 gap-y-6'
                  }
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    {visible.map((item) => (
                      <WatchlistCard
                        key={item.id}
                        item={item}
                        progressEntry={progressMap.get(String(item.id))}
                        layoutMode={layoutMode}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
