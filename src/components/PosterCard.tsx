import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { AnimeMedia, getNexusPosterForAnime } from '../lib/api';
import { LazyImage } from './LazyImage';

interface PosterCardProps {
  item: AnimeMedia;
  className?: string;
}

export const PosterCard: React.FC<PosterCardProps> = memo(({
  item,
  className = 'w-[120px] sm:w-[140px] md:w-[170px] lg:w-[190px] shrink-0',
}) => {
  const isMovie = item.format === 'MOVIE';
  const displayPoster = getNexusPosterForAnime(item.title, item.id) || item.poster;

  return (
    <Link to={`/anime/${item.id}`} className={`card-shift-item group relative block select-none first:origin-left ${className}`}>
      <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-[#0d0d0d] origin-center group-first:origin-left transform-gpu transition-transform duration-250 ease-out group-hover:scale-105 group-hover:shadow-[0_12px_28px_rgba(0,0,0,0.85)] group-hover:z-30">
        {displayPoster ? (
          <LazyImage
            src={displayPoster}
            alt={item.title}
            className="w-full h-full"
            imgClassName="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-3 text-center text-xs text-gray-500 font-medium">
            {item.title}
          </div>
        )}

        {/* Bottom Metadata Overlay (Title + Year, no rating or play button) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-2.5 sm:p-3 z-20 pointer-events-none">
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
});

PosterCard.displayName = 'PosterCard';
