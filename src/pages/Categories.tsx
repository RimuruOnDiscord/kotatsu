import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ANIME_STUDIOS,
  ANIME_GENRES,
  AnimeMedia,
  CategoryCollection,
  fetchDiscoverAnime,
  fetchSearchAnime,
} from '../lib/api';
import { PosterCard } from '../components/PosterCard';
import { CategoriesIcon } from '../components/icons';
import { StudioLogo, GenreIcon } from '../components/StudioLogos';
import { getGenreTheme } from '../components/CategoryTray';

const CollectionCard: React.FC<{ item: CategoryCollection; linkPrefix: string }> = ({
  item,
  linkPrefix,
}) =>
  item.type === 'studio' ? (
    <Link
      to={`${linkPrefix}/${encodeURIComponent(item.slug)}`}
      className="group relative aspect-[16/9] rounded-2xl overflow-hidden bg-[#0a0a0a] hover:bg-[#111111] border-2 border-[#18181b] hover:border-[#6b7280] transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_14px_35px_rgba(0,0,0,0.85)]"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />
      <div className="absolute inset-0 p-5 flex flex-col items-center justify-center text-center z-10">
        <StudioLogo
          slug={item.slug}
          name={item.name}
          className="text-white/90 group-hover:text-white group-hover:scale-105 transition-all duration-300"
        />
        {item.description && (
          <p className="text-[11px] sm:text-xs text-[#8f98a2] line-clamp-2 mt-3 font-medium max-w-xs">
            {item.description}
          </p>
        )}
      </div>
    </Link>
  ) : (() => {
    const theme = getGenreTheme(item.slug || item.filterGenre || item.name);
    return (
      <Link
        to={`${linkPrefix}/${encodeURIComponent(item.slug)}`}
        className="group relative aspect-[16/9] rounded-2xl overflow-hidden bg-[#0a0a0a] hover:bg-[#111111] border-2 border-[#18181b] hover:border-[#6b7280] transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_14px_35px_rgba(0,0,0,0.85)] p-5 flex flex-col justify-between"
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at 90% 10%, ${theme.accent} 0%, rgba(0,0,0,0) 65%), radial-gradient(circle at 14% 18%, ${theme.iconBg} 0%, rgba(0,0,0,0) 45%)`,
          }}
        />
        <div className="relative z-10 flex items-center justify-between">
          <div
            className="w-9 h-9 rounded-xl backdrop-blur-md flex items-center justify-center transition-all duration-300 group-hover:scale-105 shadow-sm"
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
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-white/30 group-hover:text-white/80 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300"
          >
            <path d="M7 17L17 7" />
            <path d="M7 7h10v10" />
          </svg>
        </div>
        <div className="relative z-10 text-left">
          <h3 className="text-base sm:text-lg font-bold text-white/95 group-hover:text-white tracking-tight leading-snug">
            {item.name}
          </h3>
          {item.description && (
            <p className="text-[11px] sm:text-xs text-white/45 group-hover:text-white/60 line-clamp-2 mt-1 font-medium transition-colors">
              {item.description}
            </p>
          )}
        </div>
      </Link>
    );
  })();

export const Categories: React.FC = () => {
  return (
    <div className="min-h-screen bg-black pt-8 sm:pt-12 pb-24 px-4 sm:px-6 md:px-12 md:pl-28 select-none">
      <div className="max-w-7xl mx-auto space-y-12">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-white">
            <CategoriesIcon active />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Anime Studios & Categories
            </h1>
            <p className="text-xs sm:text-sm text-[#8f98a2]">
              Explore legendary Japanese animation studios and curated anime genres
            </p>
          </div>
        </div>

        {/* Studios Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-white">
              Animation Studios & Publishers
            </h2>
            <Link
              to="/categories/all/studios"
              className="text-xs sm:text-sm font-bold text-[#8f98a2] hover:text-white transition-colors"
            >
              View All &#10095;
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {ANIME_STUDIOS.map((st) => (
              <CollectionCard key={st.id} item={st} linkPrefix="/studio" />
            ))}
          </div>
        </section>

        {/* Genres Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-white">Anime Genres</h2>
            <Link
              to="/categories/all/genres"
              className="text-xs sm:text-sm font-bold text-[#8f98a2] hover:text-white transition-colors"
            >
              View All &#10095;
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {ANIME_GENRES.map((gn) => (
              <CollectionCard key={gn.id} item={gn} linkPrefix="/genre" />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export const CategoryGrid: React.FC = () => {
  const { type } = useParams<{ type: string }>();
  const isStudios = type === 'studios';
  const list = isStudios ? ANIME_STUDIOS : ANIME_GENRES;

  return (
    <div className="min-h-screen bg-black pt-8 sm:pt-12 pb-24 px-4 sm:px-6 md:px-12 md:pl-28 select-none">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link
            to="/categories"
            className="text-xs font-bold text-[#8f98a2] hover:text-white inline-flex items-center gap-1.5 mb-2"
          >
            &#10094; Back to Categories
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            {isStudios ? 'All Animation Studios' : 'All Anime Genres'}
          </h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {list.map((item) => (
            <CollectionCard
              key={item.id}
              item={item}
              linkPrefix={isStudios ? '/studio' : '/genre'}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export const CategoryDetail: React.FC<{ mode: 'studio' | 'genre' }> = ({ mode }) => {
  const { name } = useParams<{ name: string }>();
  const decoded = decodeURIComponent(name || '');

  const meta =
    mode === 'studio'
      ? ANIME_STUDIOS.find(
          (s) => s.slug.toLowerCase() === decoded.toLowerCase() || s.name.toLowerCase() === decoded.toLowerCase()
        )
      : ANIME_GENRES.find(
          (g) => g.slug.toLowerCase() === decoded.toLowerCase() || g.name.toLowerCase() === decoded.toLowerCase()
        );

  const [items, setItems] = useState<AnimeMedia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        if (mode === 'genre') {
          const genreParam = meta?.filterGenre || decoded;
          const [p1, p2] = await Promise.all([
            fetchDiscoverAnime({ genre: genreParam, sort: 'POPULARITY_DESC', page: 1 }),
            fetchDiscoverAnime({ genre: genreParam, sort: 'SCORE_DESC', page: 1 }),
          ]);
          if (cancelled) return;
          const seen = new Set<string | number>();
          const merged: AnimeMedia[] = [];
          for (const it of [...p1.results, ...p2.results]) {
            if (!seen.has(it.id)) {
              seen.add(it.id);
              merged.push(it);
            }
          }
          setItems(merged);
        } else {
          // Studio lookup: combine studio keyword search + genre/format discovery
          const [searchRes, discRes] = await Promise.all([
            fetchSearchAnime(meta?.name || decoded, 1),
            fetchDiscoverAnime({
              genre: meta?.filterGenre || 'Action',
              format: (meta?.filterFormat as any) || undefined,
              sort: 'POPULARITY_DESC',
              page: 1,
            }),
          ]);
          if (cancelled) return;
          const seen = new Set<string | number>();
          const merged: AnimeMedia[] = [];
          for (const it of [...searchRes.results, ...discRes.results]) {
            if (!seen.has(it.id)) {
              seen.add(it.id);
              merged.push(it);
            }
          }
          setItems(merged);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [decoded, mode, meta]);

  return (
    <div className="min-h-screen bg-black pb-24 select-none">
      {/* Studio / Genre Hero Banner */}
      <div className="relative h-[34vh] sm:h-[42vh] w-full overflow-hidden bg-[#0d0d0d] mb-8">
        {meta?.backdrop && (
          <img
            src={meta.backdrop}
            alt={meta.name}
            fetchPriority="high"
            decoding="async"
            className="w-full h-full object-cover opacity-45"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end pb-8 px-4 sm:px-6 md:px-12 md:pl-28 max-w-7xl">
          <Link
            to="/categories"
            className="text-xs font-bold text-[#8f98a2] hover:text-white inline-flex items-center gap-1.5 mb-2 w-fit"
          >
            &#10094; Categories
          </Link>
          <h1
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            className="text-4xl sm:text-6xl md:text-7xl tracking-wider text-white leading-none"
          >
            {meta?.name || decoded}
          </h1>
          {meta?.description && (
            <p className="text-xs sm:text-sm text-[#8f98a2] max-w-2xl mt-2 font-medium">
              {meta.description}
            </p>
          )}
        </div>
      </div>

      <div className="px-4 sm:px-6 md:px-12 md:pl-28 max-w-7xl">
        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 sm:gap-4">
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-lg bg-[#0d0d0d] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 sm:gap-4">
            {items.map((item) => (
              <PosterCard key={item.id} item={item} className="w-full" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
