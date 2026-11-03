import React, { useRef, useState, useEffect, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import { ANIME_STUDIOS, ANIME_GENRES, CategoryCollection } from '../lib/api';
import { StudioLogo, GenreIcon } from './StudioLogos';

interface CategoryTrayProps {
  title?: string;
  items?: CategoryCollection[];
  viewAllPath?: string;
  linkPrefix?: string;
}

export interface GenreTheme {
  accent: string;
  iconBg: string;
  iconHoverBg: string;
  iconBorder: string;
  iconColor: string;
  glowHover: string;
}

export const GENRE_THEMES: Record<string, GenreTheme> = {
  Action: {
    accent: 'rgba(244, 63, 94, 0.32)',
    iconBg: 'rgba(244, 63, 94, 0.18)',
    iconHoverBg: 'rgba(244, 63, 94, 0.30)',
    iconBorder: 'rgba(244, 63, 94, 0.38)',
    iconColor: '#fb7185',
    glowHover: 'rgba(244, 63, 94, 0.45)',
  },
  Fantasy: {
    accent: 'rgba(168, 85, 247, 0.32)',
    iconBg: 'rgba(168, 85, 247, 0.18)',
    iconHoverBg: 'rgba(168, 85, 247, 0.30)',
    iconBorder: 'rgba(168, 85, 247, 0.38)',
    iconColor: '#c084fc',
    glowHover: 'rgba(168, 85, 247, 0.45)',
  },
  Romance: {
    accent: 'rgba(244, 114, 182, 0.30)',
    iconBg: 'rgba(244, 114, 182, 0.18)',
    iconHoverBg: 'rgba(244, 114, 182, 0.30)',
    iconBorder: 'rgba(244, 114, 182, 0.38)',
    iconColor: '#f472b6',
    glowHover: 'rgba(244, 114, 182, 0.45)',
  },
  'Sci-Fi': {
    accent: 'rgba(56, 189, 248, 0.32)',
    iconBg: 'rgba(56, 189, 248, 0.18)',
    iconHoverBg: 'rgba(56, 189, 248, 0.30)',
    iconBorder: 'rgba(56, 189, 248, 0.38)',
    iconColor: '#38bdf8',
    glowHover: 'rgba(56, 189, 248, 0.45)',
  },
  Supernatural: {
    accent: 'rgba(52, 211, 153, 0.30)',
    iconBg: 'rgba(52, 211, 153, 0.18)',
    iconHoverBg: 'rgba(52, 211, 153, 0.30)',
    iconBorder: 'rgba(52, 211, 153, 0.38)',
    iconColor: '#34d399',
    glowHover: 'rgba(52, 211, 153, 0.45)',
  },
  Comedy: {
    accent: 'rgba(251, 191, 36, 0.30)',
    iconBg: 'rgba(251, 191, 36, 0.18)',
    iconHoverBg: 'rgba(251, 191, 36, 0.30)',
    iconBorder: 'rgba(251, 191, 36, 0.38)',
    iconColor: '#fbbf24',
    glowHover: 'rgba(251, 191, 36, 0.45)',
  },
  Psychological: {
    accent: 'rgba(239, 68, 68, 0.32)',
    iconBg: 'rgba(239, 68, 68, 0.18)',
    iconHoverBg: 'rgba(239, 68, 68, 0.30)',
    iconBorder: 'rgba(239, 68, 68, 0.38)',
    iconColor: '#f87171',
    glowHover: 'rgba(239, 68, 68, 0.45)',
  },
  'Slice of Life': {
    accent: 'rgba(45, 212, 191, 0.28)',
    iconBg: 'rgba(45, 212, 191, 0.18)',
    iconHoverBg: 'rgba(45, 212, 191, 0.30)',
    iconBorder: 'rgba(45, 212, 191, 0.38)',
    iconColor: '#2dd4bf',
    glowHover: 'rgba(45, 212, 191, 0.45)',
  },
  Sports: {
    accent: 'rgba(251, 146, 60, 0.32)',
    iconBg: 'rgba(251, 146, 60, 0.18)',
    iconHoverBg: 'rgba(251, 146, 60, 0.30)',
    iconBorder: 'rgba(251, 146, 60, 0.38)',
    iconColor: '#fb923c',
    glowHover: 'rgba(251, 146, 60, 0.45)',
  },
  Adventure: {
    accent: 'rgba(250, 204, 21, 0.30)',
    iconBg: 'rgba(250, 204, 21, 0.18)',
    iconHoverBg: 'rgba(250, 204, 21, 0.30)',
    iconBorder: 'rgba(250, 204, 21, 0.38)',
    iconColor: '#facc15',
    glowHover: 'rgba(250, 204, 21, 0.45)',
  },
  Mystery: {
    accent: 'rgba(129, 140, 248, 0.32)',
    iconBg: 'rgba(129, 140, 248, 0.18)',
    iconHoverBg: 'rgba(129, 140, 248, 0.30)',
    iconBorder: 'rgba(129, 140, 248, 0.38)',
    iconColor: '#818cf8',
    glowHover: 'rgba(129, 140, 248, 0.45)',
  },
  Mecha: {
    accent: 'rgba(14, 165, 233, 0.32)',
    iconBg: 'rgba(14, 165, 233, 0.18)',
    iconHoverBg: 'rgba(14, 165, 233, 0.30)',
    iconBorder: 'rgba(14, 165, 233, 0.38)',
    iconColor: '#38bdf8',
    glowHover: 'rgba(14, 165, 233, 0.45)',
  },
};

export function getGenreTheme(slugOrName?: string): GenreTheme {
  if (!slugOrName) {
    return {
      accent: 'rgba(255, 255, 255, 0.14)',
      iconBg: 'rgba(255, 255, 255, 0.10)',
      iconHoverBg: 'rgba(255, 255, 255, 0.18)',
      iconBorder: 'rgba(255, 255, 255, 0.18)',
      iconColor: '#ffffff',
      glowHover: 'rgba(255, 255, 255, 0.22)',
    };
  }
  const clean = String(slugOrName).trim();
  if (GENRE_THEMES[clean]) return GENRE_THEMES[clean];
  const foundKey = Object.keys(GENRE_THEMES).find(
    (k) => k.toLowerCase() === clean.toLowerCase()
  );
  if (foundKey) return GENRE_THEMES[foundKey];
  return {
    accent: 'rgba(255, 255, 255, 0.14)',
    iconBg: 'rgba(255, 255, 255, 0.10)',
    iconHoverBg: 'rgba(255, 255, 255, 0.18)',
    iconBorder: 'rgba(255, 255, 255, 0.18)',
    iconColor: '#ffffff',
    glowHover: 'rgba(255, 255, 255, 0.22)',
  };
}

export const CategoryTray: React.FC<CategoryTrayProps> = memo(({
  title = 'Studios & Publishers',
  items = ANIME_STUDIOS,
  viewAllPath = '/explore',
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
  }, [updateScrollButtons, items.length]);

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
    <div className="mb-8 md:mb-10 px-4 sm:px-6 md:pl-28 lg:pl-32 md:pr-12 relative group/tray select-none">
      <div className="mb-3 flex items-center justify-between">
        <Link
          to={viewAllPath}
          className="group/title inline-flex items-center gap-2 text-[16px] sm:text-[18px] md:text-[20px] font-bold text-[#e1e6f0] hover:text-white tracking-wide transition-colors"
        >
          <span>{title}</span>
          <span className="text-xs sm:text-sm text-white/40 group-hover/title:text-white group-hover/title:translate-x-0.5 transition-all">
            &#10095;
          </span>
        </Link>
        <Link
          to={viewAllPath}
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
            className="hidden md:flex absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-black via-black/85 to-transparent z-30 items-center justify-center opacity-0 group-hover/tray:opacity-100 transition-opacity duration-300 text-white hover:scale-110"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}

        <div
          ref={rowRef}
          onScroll={updateScrollButtons}
          className="card-shift-row flex items-center gap-3 sm:gap-4 overflow-x-auto overflow-y-hidden no-scrollbar py-3 scroll-smooth"
        >
          {items.map((item) =>
            item.type === 'studio' ? (
              <Link
                key={item.id}
                to={`/explore?studio=${encodeURIComponent(item.filterStudio || item.name)}`}
                className="card-shift-item group relative w-[160px] sm:w-[200px] md:w-[240px] aspect-[16/9] rounded-xl overflow-hidden bg-[#0e0e0e] hover:bg-[#151515] border-2 border-[#18181b] hover:border-[#6b7280] shrink-0 transition-transform duration-300 ease-out hover:scale-105 hover:shadow-[0_12px_30px_rgba(0,0,0,0.85)] z-20 hover:z-30 origin-center first:origin-left"
              >
                <div className="absolute inset-0 flex items-center justify-center p-4 text-center z-10">
                  <StudioLogo
                    slug={item.slug}
                    name={item.name}
                    className="text-white/90 group-hover:text-white group-hover:scale-105 transition-all duration-300"
                  />
                </div>
              </Link>
            ) : (() => {
              const theme = getGenreTheme(item.slug || item.filterGenre || item.name);
              return (
                <Link
                  key={item.id}
                  to={`/explore?genre=${encodeURIComponent(item.filterGenre || item.slug)}`}
                  className="group relative w-[205px] sm:w-[240px] md:w-[270px] h-[134px] sm:h-[146px] rounded-2xl overflow-hidden bg-[#09090b] ring-1 ring-white/[0.08] hover:ring-white/25 shrink-0 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(0,0,0,0.85)] block"
                >
                  <article className="relative w-full h-full p-4 flex flex-col justify-between">
                    {/* Ambient top-right & icon accent glow */}
                    <div
                      className="absolute inset-0 pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                      style={{
                        background: `radial-gradient(circle at 88% 14%, ${theme.accent} 0%, rgba(0,0,0,0) 65%), radial-gradient(circle at 14% 18%, ${theme.iconBg} 0%, rgba(0,0,0,0) 45%)`,
                      }}
                    />

                    <header className="relative z-10 flex items-center justify-between">
                      <div
                        className="w-9 h-9 rounded-xl backdrop-blur-md flex items-center justify-center shadow-sm transition-all duration-300 group-hover:scale-105"
                        style={{
                          backgroundColor: theme.iconBg,
                          borderColor: theme.iconBorder,
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          color: theme.iconColor,
                        }}
                      >
                        <GenreIcon slug={item.slug} className="w-4 h-4" />
                      </div>
                      <span className="w-7 h-7 rounded-full bg-white/[0.04] group-hover:bg-white border border-white/[0.08] group-hover:border-white flex items-center justify-center text-white/45 group-hover:text-black transition-all duration-300">
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="group-hover:translate-x-0.25 group-hover:-translate-y-0.25 transition-transform duration-300"
                        >
                          <path d="M7 17L17 7" />
                          <path d="M7 7h10v10" />
                        </svg>
                      </span>
                    </header>

                    <div className="relative z-10 text-left">
                      <h3 className="text-[14.5px] sm:text-[15.5px] font-bold text-white tracking-tight leading-snug line-clamp-1">
                        {item.name}
                      </h3>
                      {item.description && (
                        <p className="text-[11px] sm:text-[11.5px] leading-relaxed text-white/50 group-hover:text-white/75 line-clamp-2 mt-0.5 font-medium transition-colors duration-300">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </article>
                </Link>
              );
            })()
          )}
        </div>

        {canScrollRight && (
          <button
            onClick={() => scrollRow('right')}
            aria-label="Scroll right"
            className="hidden md:flex absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-black via-black/85 to-transparent z-30 items-center justify-center opacity-0 group-hover/tray:opacity-100 transition-opacity duration-300 text-white hover:scale-110"
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

CategoryTray.displayName = 'CategoryTray';

export const GenreTray: React.FC<{ title?: string }> = ({ title = 'Popular Genres' }) => {
  return (
    <CategoryTray
      title={title}
      items={ANIME_GENRES}
      viewAllPath="/explore"
    />
  );
};
