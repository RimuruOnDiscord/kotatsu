import React, { useState, memo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { AnimeMedia } from '../lib/api';

interface AnimeInfoSidebarProps {
  anime: AnimeMedia;
  totalEpisodes?: number;
}

export const AnimeInfoSidebar: React.FC<AnimeInfoSidebarProps> = memo(({
  anime,
  totalEpisodes,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Format release/aired date (e.g. "Oct 20, 2026" or "Sep 13, 2022")
  const formatAiredDate = (): string => {
    if (anime.start_date?.year) {
      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      const m = anime.start_date.month ? monthNames[anime.start_date.month - 1] : null;
      const d = anime.start_date.day;
      const y = anime.start_date.year;
      if (m && d) return `${m} ${d}, ${y}`;
      if (m) return `${m} ${y}`;
      return String(y);
    }
    if (anime.year) return String(anime.year);
    return 'TBD';
  };

  // Status with clean casing (e.g. "Not yet released", "Finished")
  const formatStatus = (raw?: string | null): string => {
    if (!raw) return 'Finished';
    if (raw === 'NOT_YET_RELEASED') return 'Not yet released';
    if (raw === 'RELEASING') return 'Currently Releasing';
    if (raw === 'FINISHED') return 'Finished';
    return raw
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Season name (e.g. "Fall")
  const seasonName = (() => {
    if (anime.season_name) {
      return anime.season_name.charAt(0).toUpperCase() + anime.season_name.slice(1).toLowerCase();
    }
    return null;
  })();

  // Synonyms / Also known as (filter duplicates & original title)
  const synonymsList = (anime.synonyms || [])
    .filter((s) => s && s.trim() !== '' && s !== anime.title && s !== anime.title_native)
    .slice(0, 3);

  const episodeCount =
    anime.episodes ||
    (totalEpisodes && totalEpisodes > 0 ? totalEpisodes : null) ||
    '10';

  // Popularity / Views count
  const viewsCount = anime.popularity
    ? anime.popularity.toLocaleString()
    : '143,393';

  // Watch on external links
  const officialLink =
    anime.siteUrl ||
    anime.externalLinks?.find((l) => l.site?.toLowerCase().includes('official'))?.url;
  const netflixLink = anime.externalLinks?.find((l) => l.site?.toLowerCase().includes('netflix'))?.url;
  const crunchyrollLink = anime.externalLinks?.find((l) => l.site?.toLowerCase().includes('crunchyroll'))?.url;

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(label);
      toast.success(`Copied ${label}`);
      setTimeout(() => setCopiedKey(null), 2000);
    }).catch(() => {});
  };

  return (
    <aside
      aria-label="Anime Information"
      className="w-full rounded-2xl bg-transparent p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col justify-between select-none max-h-[36rem] lg:max-h-[44rem] overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      {/* 1. KEY METADATA 2-COLUMN COMPACT GRID */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 pb-4 border-b border-white/[0.07]">
        {/* Format */}
        <div className="block">
          <span className="block text-[11px] font-semibold text-white/45 uppercase tracking-wider">
            Format
          </span>
          <Link
            to={`/category/${encodeURIComponent(anime.format || (anime.type === 'movie' ? 'Movie' : 'TV'))}`}
            className="inline-block text-[14.5px] font-bold text-white hover:underline underline-offset-4 decoration-white/50 transition-colors mt-0.5"
            title="Filter by format"
          >
            {anime.format || (anime.type === 'movie' ? 'Movie' : 'TV')}
          </Link>
        </div>

        {/* Episodes */}
        <div className="block">
          <span className="block text-[11px] font-semibold text-white/45 uppercase tracking-wider">
            Episodes
          </span>
          <span className="block text-[14.5px] font-bold text-white tabular-nums mt-0.5">
            {episodeCount} {anime.duration ? <span className="text-white/45 text-xs font-normal">({anime.duration}m)</span> : ''}
          </span>
        </div>

        {/* Aired */}
        <div className="block">
          <span className="block text-[11px] font-semibold text-white/45 uppercase tracking-wider">
            Aired
          </span>
          <span className="block text-[14.5px] font-bold text-white mt-0.5">
            {formatAiredDate()}
          </span>
        </div>

        {/* Views */}
        <div className="block">
          <span className="block text-[11px] font-semibold text-white/45 uppercase tracking-wider">
            Views
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-white/60 shrink-0"
            >
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span className="text-[14.5px] font-bold text-white tabular-nums">
              {viewsCount}
            </span>
          </div>
        </div>

        {/* Season */}
        {seasonName ? (
          <div className="block">
            <span className="block text-[11px] font-semibold text-white/45 uppercase tracking-wider">
              Season
            </span>
            <Link
              to={`/search?q=${encodeURIComponent(seasonName)}`}
              className="inline-block text-[14.5px] font-bold text-white hover:underline underline-offset-4 decoration-white/50 transition-colors mt-0.5"
              title="Browse season anime"
            >
              {seasonName}
            </Link>
          </div>
        ) : (
          <div className="block">
            <span className="block text-[11px] font-semibold text-white/45 uppercase tracking-wider">
              Season
            </span>
            <span className="block text-[14.5px] font-bold text-white mt-0.5">
              {anime.year || 'TBD'}
            </span>
          </div>
        )}

        {/* Status */}
        <div className="block">
          <span className="block text-[11px] font-semibold text-white/45 uppercase tracking-wider">
            Status
          </span>
          <span className="block text-[14.5px] font-bold text-white mt-0.5">
            {formatStatus(anime.status)}
          </span>
        </div>
      </div>

      {/* 3. NATIVE JAPANESE TITLE (Clickable to copy) */}
      {anime.title_native && (
        <div className="py-3 border-b border-white/[0.07]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-white/45 uppercase tracking-wider">
              Native
            </span>
            <AnimatePresence>
              {copiedKey === 'native' ? (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="text-[10.5px] font-bold text-emerald-400 flex items-center gap-1"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Copied
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>
          <motion.button
            type="button"
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleCopy(anime.title_native!, 'native')}
            className="w-full text-left group/native flex items-center justify-between gap-2 cursor-pointer"
            title="Click to copy native Japanese title"
          >
            <span className="text-[14px] font-bold text-white group-hover/native:text-white/90 truncate leading-snug">
              {anime.title_native}
            </span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-white/30 group-hover/native:text-white/80 transition-colors shrink-0"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </motion.button>
        </div>
      )}

      {/* 5. ALSO KNOWN AS (Clickable to copy or search) */}
      {synonymsList.length > 0 && (
        <div className="pt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-white/45 uppercase tracking-wider">
              Also known as
            </span>
            <AnimatePresence>
              {copiedKey && copiedKey.startsWith('syn-') ? (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="text-[10.5px] font-bold text-emerald-400 flex items-center gap-1"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Copied
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>
          <div className="space-y-1 mt-1">
            {synonymsList.map((syn, idx) => (
              <motion.button
                key={syn}
                type="button"
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleCopy(syn, `syn-${idx}`)}
                className="w-full text-left group/syn flex items-center justify-between gap-2 cursor-pointer text-white/70 hover:text-white transition-colors"
                title="Click to copy alternate title"
              >
                <span className="text-[12.5px] font-medium truncate leading-snug">
                  {syn}
                </span>
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white/25 group-hover/syn:text-white/75 transition-colors shrink-0"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
});

AnimeInfoSidebar.displayName = 'AnimeInfoSidebar';
