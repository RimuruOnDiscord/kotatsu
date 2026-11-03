import React, { useRef, useState, useEffect, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import { AnimeMedia } from '../lib/api';
import { PosterCard } from './PosterCard';

interface TrayRowProps {
  title: string;
  items: AnimeMedia[];
  isAiRow?: boolean;
  exploreUrl?: string;
}

export const TrayRow: React.FC<TrayRowProps> = memo(({
  title,
  items,
  exploreUrl = '/explore',
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollButtons = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollButtons();
    window.addEventListener('resize', updateScrollButtons);
    return () => window.removeEventListener('resize', updateScrollButtons);
  }, [updateScrollButtons, items?.length]);

  if (!items || items.length === 0) return null;

  const scrollRow = (dir: 'left' | 'right') => {
    const el = rowRef.current;
    if (!el) return;
    const { scrollLeft, clientWidth } = el;
    const target = dir === 'left' ? scrollLeft - clientWidth * 0.75 : scrollLeft + clientWidth * 0.75;
    el.scrollTo({ left: target, behavior: 'smooth' });
  };

  return (
    <div className="mb-6 md:mb-8 px-4 sm:px-6 md:pl-28 lg:pl-32 md:pr-12 relative group/row select-none">
      <div className="mb-2.5 md:mb-3 flex items-center justify-between">
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
            className="hidden md:flex absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-black via-black/85 to-transparent z-30 items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 text-white hover:scale-110"
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
          {items.map((item) => (
            <PosterCard key={item.id} item={item} />
          ))}
        </div>

        {canScrollRight && (
          <button
            onClick={() => scrollRow('right')}
            aria-label="Scroll right"
            className="hidden md:flex absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-black via-black/85 to-transparent z-30 items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 text-white hover:scale-110"
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

TrayRow.displayName = 'TrayRow';
