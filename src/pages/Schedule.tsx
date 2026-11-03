import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { AiringScheduleEntry, fetchAiringSchedule } from '../lib/api';
import { getWatchlist, getWatchlistItemStatus, setWatchlistItem } from '../lib/storage';
import { LazyImage } from '../components/LazyImage';

/* -------------------------------------------------------------------------- */
/* Date helpers (all in the user's local timezone)                            */
/* -------------------------------------------------------------------------- */
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Monday 00:00 of the week containing `d`. */
function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // Mon = 0 ... Sun = 6
  x.setDate(x.getDate() - dow);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const weekdayShortFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const weekdayLongFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long' });
const monthDayFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

function timezoneLabel(): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
  const offsetMin = -new Date().getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${tz.replace(/_/g, ' ')} (GMT${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''})`;
}

function formatCountdown(ms: number, withSeconds = false): string {
  if (ms <= 0) return 'now';
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (withSeconds) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(1, m)}m`;
}

/* -------------------------------------------------------------------------- */
/* Live ticking clock hook                                                    */
/* -------------------------------------------------------------------------- */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/* -------------------------------------------------------------------------- */
/* Up Next Hero Card (ticks every second)                                     */
/* -------------------------------------------------------------------------- */
const UpNextCard: React.FC<{ entry: AiringScheduleEntry }> = ({ entry }) => {
  const now = useNow(1000);
  const airMs = entry.airingAt * 1000;
  const { media } = entry;
  const banner = media.backdrop && media.backdrop !== media.poster ? media.backdrop : null;

  return (
    <Link
      to={`/anime/${media.id}`}
      className="group relative block overflow-hidden rounded-2xl bg-[#0b0b0d] border-2 border-[#18181b] hover:border-[#6b7280] transition-colors duration-200 mb-8"
    >
      {banner && (
        <div className="pointer-events-none absolute inset-0">
          <img
            src={banner}
            alt=""
            className="w-full h-full object-cover opacity-30 scale-105 group-hover:scale-100 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b0b0d] via-[#0b0b0d]/85 to-[#0b0b0d]/30" />
        </div>
      )}

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-5 p-4 sm:p-5">
        <div className="flex items-center gap-4 sm:gap-5 min-w-0 flex-1">
          <div className="shrink-0 w-[72px] sm:w-[84px] aspect-[2/3] rounded-lg overflow-hidden bg-[#141417] border border-white/10">
            {media.poster && <LazyImage src={media.poster} alt={media.title} className="w-full h-full" imgClassName="w-full h-full object-cover" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-60 animate-ping" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-white" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/60">Up Next</span>
            </div>
            <h2 className="text-[18px] sm:text-[22px] font-extrabold text-white leading-tight line-clamp-1">
              {media.title}
            </h2>
            <p className="mt-1 text-[13px] font-semibold text-white/55">
              Episode {entry.episode}
              {media.totalEpisodes ? ` of ${media.totalEpisodes}` : ''}
              <span className="text-white/25 mx-2">·</span>
              {weekdayLongFmt.format(new Date(airMs))} at {timeFmt.format(new Date(airMs))}
            </p>
          </div>
        </div>

        <div className="shrink-0 sm:text-right">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/40 mb-1">Airs in</p>
          <p className="text-[28px] sm:text-[34px] font-extrabold text-white tabular-nums leading-none tracking-tight">
            {formatCountdown(airMs - now, true)}
          </p>
        </div>
      </div>
    </Link>
  );
};

/* -------------------------------------------------------------------------- */
/* Schedule Row Card                                                          */
/* -------------------------------------------------------------------------- */
const ScheduleCard: React.FC<{ entry: AiringScheduleEntry; now: number }> = ({ entry, now }) => {
  const { media } = entry;
  const navigate = useNavigate();
  const airMs = entry.airingAt * 1000;
  const aired = now >= airMs;
  const [saved, setSaved] = useState(() => Boolean(getWatchlistItemStatus(media.id)));

  useEffect(() => {
    const sync = () => setSaved(Boolean(getWatchlistItemStatus(media.id)));
    window.addEventListener('bingr-storage-update', sync);
    return () => window.removeEventListener('bingr-storage-update', sync);
  }, [media.id]);

  const toggleSaved = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (saved) {
      setWatchlistItem(media, null);
      toast(`Removed "${media.title}" from Watchlist`);
    } else {
      setWatchlistItem(media, 'watchlist');
      toast(`Added "${media.title}" to Watchlist`);
    }
    setSaved(!saved);
  };

  const isMovie = (media.format || '').toUpperCase() === 'MOVIE';
  const isFinale = media.totalEpisodes != null && entry.episode === media.totalEpisodes;
  const isPremiere = entry.episode === 1;

  return (
    <Link
      to={`/anime/${media.id}`}
      className={`group flex items-center gap-3.5 sm:gap-4 p-2.5 sm:p-3 rounded-2xl bg-[#0b0b0d] border-2 border-[#18181b] hover:border-[#6b7280] hover:bg-[#101014] transition-colors duration-200 ${
        aired ? 'opacity-70 hover:opacity-100' : ''
      }`}
    >
      <div className="relative shrink-0 w-[52px] sm:w-[60px] aspect-[2/3] rounded-lg overflow-hidden bg-[#141417]">
        {media.poster ? (
          <LazyImage
            src={media.poster}
            alt={media.title}
            className="w-full h-full"
            imgClassName="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20 font-bold">{media.title[0]}</div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-1">
          {isPremiere && (
            <span className="px-1.5 py-[1px] rounded bg-white text-black text-[9.5px] font-extrabold uppercase tracking-wider">
              Premiere
            </span>
          )}
          {isFinale && !isPremiere && (
            <span className="px-1.5 py-[1px] rounded border border-white/40 text-white text-[9.5px] font-extrabold uppercase tracking-wider">
              Finale
            </span>
          )}
          <span className="text-[12px] font-semibold text-white/50 tabular-nums">
            {isMovie ? 'Movie' : `Episode ${entry.episode}${media.totalEpisodes ? ` / ${media.totalEpisodes}` : ''}`}
          </span>
        </div>
        <h3 className="text-[14px] sm:text-[15px] font-bold text-white leading-snug line-clamp-1">{media.title}</h3>
        {media.genres && media.genres.length > 0 && (
          <p className="mt-0.5 text-[12px] font-medium text-white/35 line-clamp-1">
            {media.genres.slice(0, 3).join(' · ')}
          </p>
        )}
      </div>

      <div className="shrink-0 flex items-center gap-2">
        {aired ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigate(`/watch/anime/${media.id}/1/${entry.episode}`);
            }}
            className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white text-black text-[12px] font-bold hover:bg-white/90 transition active:scale-95 cursor-pointer"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            Watch
          </button>
        ) : (
          <span className="inline-flex items-center h-8 px-3 rounded-full border border-white/15 text-[12px] font-semibold text-white/80 tabular-nums">
            in {formatCountdown(airMs - now)}
          </span>
        )}

        <button
          type="button"
          onClick={toggleSaved}
          aria-label={saved ? 'Remove from Watchlist' : 'Add to Watchlist'}
          title={saved ? 'In Watchlist' : 'Add to Watchlist'}
          className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors cursor-pointer ${
            saved
              ? 'bg-white text-black border-white'
              : 'bg-white/[0.04] border-white/[0.1] text-white/60 hover:text-white hover:bg-white/[0.1]'
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>
    </Link>
  );
};

/* -------------------------------------------------------------------------- */
/* Schedule Page                                                              */
/* -------------------------------------------------------------------------- */
export const SchedulePage: React.FC = () => {
  const now = useNow(30 * 1000);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(() => (new Date().getDay() + 6) % 7);
  const [entries, setEntries] = useState<AiringScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [onlyWatchlist, setOnlyWatchlist] = useState(false);
  const [watchlistIds, setWatchlistIds] = useState<Set<string>>(
    () => new Set(getWatchlist().map((w) => String(w.id)))
  );

  useEffect(() => {
    document.title = 'Schedule — Kotatsu';
    const sync = () => setWatchlistIds(new Set(getWatchlist().map((w) => String(w.id))));
    window.addEventListener('bingr-storage-update', sync);
    return () => window.removeEventListener('bingr-storage-update', sync);
  }, []);

  const weekStart = useMemo(() => addDays(startOfWeek(new Date()), weekOffset * 7), [weekOffset]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const todayStart = startOfDay(new Date(now)).getTime();
  const todayIdx = days.findIndex((d) => d.getTime() === todayStart);

  // Fetch the whole week in one go (AniList airingSchedules, paginated)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    const startSec = Math.floor(weekStart.getTime() / 1000);
    const endSec = Math.floor(addDays(weekStart, 7).getTime() / 1000);
    fetchAiringSchedule(startSec, endSec)
      .then((res) => {
        if (!cancelled) setEntries(res);
      })
      .catch(() => {
        if (!cancelled) {
          setEntries([]);
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [weekStart, reloadKey]);

  const goToWeek = useCallback((offset: number) => {
    setWeekOffset(offset);
    setSelectedDay(offset === 0 ? (new Date().getDay() + 6) % 7 : 0);
  }, []);

  const visibleEntries = useMemo(
    () => (onlyWatchlist ? entries.filter((e) => watchlistIds.has(String(e.media.id))) : entries),
    [entries, onlyWatchlist, watchlistIds]
  );

  // Bucket entries by day index (0 = Monday)
  const byDay = useMemo(() => {
    const buckets: AiringScheduleEntry[][] = Array.from({ length: 7 }, () => []);
    const ws = weekStart.getTime();
    visibleEntries.forEach((e) => {
      const dayStart = startOfDay(new Date(e.airingAt * 1000)).getTime();
      const idx = Math.round((dayStart - ws) / DAY_MS);
      if (idx >= 0 && idx < 7) buckets[idx].push(e);
    });
    return buckets;
  }, [visibleEntries, weekStart]);

  // Group the selected day's entries by exact time slot
  const slots = useMemo(() => {
    const groups: { time: number; items: AiringScheduleEntry[] }[] = [];
    byDay[selectedDay].forEach((e) => {
      const last = groups[groups.length - 1];
      if (last && last.time === e.airingAt) last.items.push(e);
      else groups.push({ time: e.airingAt, items: [e] });
    });
    return groups;
  }, [byDay, selectedDay]);

  const upNext = useMemo(
    () => (weekOffset === 0 ? visibleEntries.find((e) => e.airingAt * 1000 > now) : undefined),
    [visibleEntries, now, weekOffset]
  );

  const isTodaySelected = selectedDay === todayIdx;
  const nowSlotIdx = isTodaySelected ? slots.findIndex((s) => s.time * 1000 > now) : -1;

  const weekRangeLabel = `${monthDayFmt.format(days[0])} – ${monthDayFmt.format(days[6])}`;

  const NowMarker = (
    <div className="relative flex items-center gap-3 py-1" aria-label="Current time">
      <span className="w-[56px] sm:w-[64px] shrink-0 text-right text-[11px] font-bold uppercase tracking-wider text-white tabular-nums">
        {timeFmt.format(new Date(now))}
      </span>
      <span className="relative z-10 w-2.5 h-2.5 -ml-[5px] rounded-full bg-white ring-4 ring-black shrink-0" />
      <span className="flex-1 h-px bg-white/60" />
      <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/70">Now</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white select-none">
      <main className="px-4 sm:px-6 md:pl-28 md:pr-12 pt-10 pb-24 md:pb-16 max-w-[1400px]">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-7">
          <div>
            <h1 className="text-[28px] sm:text-[34px] font-extrabold tracking-tight leading-none">Schedule</h1>
            <p className="mt-2 text-[13px] font-medium text-white/45">
              Episode release times shown in {timezoneLabel()}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {weekOffset !== 0 && (
              <button
                type="button"
                onClick={() => goToWeek(0)}
                className="h-10 px-4 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.1] text-[13px] font-semibold transition-colors cursor-pointer"
              >
                This Week
              </button>
            )}
            <div className="flex items-center h-10 rounded-xl border border-[#18181b] bg-[#0b0b0d]">
              <button
                type="button"
                onClick={() => goToWeek(weekOffset - 1)}
                aria-label="Previous week"
                className="w-10 h-full flex items-center justify-center text-white/55 hover:text-white transition-colors cursor-pointer"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <span className="min-w-[132px] text-center text-[13px] font-semibold tabular-nums">{weekRangeLabel}</span>
              <button
                type="button"
                onClick={() => goToWeek(weekOffset + 1)}
                aria-label="Next week"
                className="w-10 h-full flex items-center justify-center text-white/55 hover:text-white transition-colors cursor-pointer"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Up Next */}
        {!loading && upNext && <UpNextCard entry={upNext} />}

        {/* Day Selector */}
        <div className="overflow-x-auto overflow-y-hidden no-scrollbar -mx-1 px-1 mb-5">
          <div className="grid grid-cols-7 gap-2 min-w-[560px]">
            {days.map((d, i) => {
              const active = i === selectedDay;
              const isToday = i === todayIdx;
              const count = byDay[i].length;
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => setSelectedDay(i)}
                  className={`relative h-[76px] rounded-2xl border-2 flex flex-col items-center justify-center transition-colors duration-200 cursor-pointer ${
                    active
                      ? 'border-transparent text-black'
                      : 'border-[#18181b] bg-[#0b0b0d] text-white hover:border-[#6b7280]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="scheduleDayPill"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      className="absolute -inset-[2px] rounded-2xl bg-white"
                    />
                  )}
                  <span
                    className={`relative text-[11px] font-bold uppercase tracking-[0.12em] ${
                      active ? 'text-black/55' : 'text-white/45'
                    }`}
                  >
                    {isToday ? 'Today' : weekdayShortFmt.format(d)}
                  </span>
                  <span className="relative text-[22px] font-extrabold leading-tight tabular-nums">{d.getDate()}</span>
                  <span className={`relative text-[10.5px] font-semibold tabular-nums ${active ? 'text-black/50' : 'text-white/35'}`}>
                    {loading ? '·' : `${count} ep${count === 1 ? '' : 's'}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter Row */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="relative flex items-center p-1 rounded-xl bg-[#0b0b0d] border border-[#18181b]">
            {(['all', 'watchlist'] as const).map((key) => {
              const active = (key === 'watchlist') === onlyWatchlist;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setOnlyWatchlist(key === 'watchlist')}
                  className={`relative h-8 px-4 text-[12.5px] font-semibold transition-colors cursor-pointer ${
                    active ? 'text-black' : 'text-white/50 hover:text-white'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="scheduleFilterPill"
                      transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                      className="absolute inset-0 rounded-[8px] bg-white"
                    />
                  )}
                  <span className="relative">{key === 'all' ? 'All Anime' : 'My Watchlist'}</span>
                </button>
              );
            })}
          </div>
          {!loading && (
            <span className="text-[12.5px] font-semibold text-white/40 tabular-nums">
              {weekdayLongFmt.format(days[selectedDay])} · {byDay[selectedDay].length} episode
              {byDay[selectedDay].length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {/* Timeline */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-[56px] sm:w-[64px] h-4 rounded bg-white/5 animate-pulse" />
                <div className="flex-1 h-[96px] rounded-2xl bg-[#0b0b0d] border-2 border-[#18181b] animate-pulse" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="py-16 text-center rounded-2xl bg-[#0b0b0d] border-2 border-[#18181b]">
            <p className="text-[15px] font-bold text-white mb-1">Couldn't load the schedule</p>
            <p className="text-[13px] text-white/45 mb-5">AniList may be rate-limiting requests. Try again in a moment.</p>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="h-10 px-5 rounded-full bg-white text-black text-[13px] font-bold hover:bg-white/90 transition active:scale-95 cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : slots.length === 0 ? (
          <div className="py-16 text-center rounded-2xl bg-[#0b0b0d] border-2 border-[#18181b]">
            <p className="text-[15px] font-bold text-white mb-1">
              {onlyWatchlist ? 'Nothing from your Watchlist airs this day' : 'No episodes airing this day'}
            </p>
            <p className="text-[13px] text-white/45">
              {onlyWatchlist ? 'Switch to All Anime or pick another day.' : 'Pick another day or week.'}
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${weekOffset}-${selectedDay}-${onlyWatchlist}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative"
            >
              {/* Vertical timeline rail */}
              <div className="absolute top-2 bottom-2 left-[calc(56px+12px)] sm:left-[calc(64px+12px)] w-px bg-white/[0.08]" />

              <div className="space-y-4">
                {slots.map((slot, idx) => {
                  const aired = slot.time * 1000 <= now;
                  return (
                    <React.Fragment key={slot.time}>
                      {idx === nowSlotIdx && NowMarker}
                      <div className="flex items-start gap-3">
                        <span
                          className={`w-[56px] sm:w-[64px] shrink-0 pt-3 text-right text-[13px] font-bold tabular-nums ${
                            aired ? 'text-white/35' : 'text-white'
                          }`}
                        >
                          {timeFmt.format(new Date(slot.time * 1000))}
                        </span>
                        <span
                          className={`relative z-10 mt-[17px] w-2.5 h-2.5 -ml-[5px] rounded-full ring-4 ring-black shrink-0 ${
                            aired ? 'bg-white/25' : 'bg-black border-2 border-white'
                          }`}
                        />
                        <div className="flex-1 min-w-0 space-y-2.5 pl-1">
                          {slot.items.map((entry) => (
                            <ScheduleCard key={entry.id} entry={entry} now={now} />
                          ))}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
                {isTodaySelected && nowSlotIdx === -1 && NowMarker}
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>
    </div>
  );
};
