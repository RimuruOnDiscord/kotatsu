import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimeMedia, fetchDiscoverAnime } from '../lib/api';
import { PosterCard } from '../components/PosterCard';
import { SparkIcon, ShuffleIcon } from '../components/icons';
import { AnimatedSelect } from '../components/AnimatedSelect';

const GENRE_OPTIONS = [
  'All',
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Mecha',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
];

const FORMAT_OPTIONS = [
  { value: 'All', label: 'All Formats' },
  { value: 'TV', label: 'TV Series' },
  { value: 'MOVIE', label: 'Movies' },
  { value: 'OVA', label: 'OVA' },
  { value: 'ONA', label: 'ONA' },
];

const SORT_OPTIONS = [
  { value: 'POPULARITY_DESC', label: 'Most Popular' },
  { value: 'TRENDING_DESC', label: 'Trending Now' },
  { value: 'SCORE_DESC', label: 'Highest Rated' },
  { value: 'START_DATE_DESC', label: 'Newest Releases' },
];

const YEAR_OPTIONS = [
  'All',
  '2026',
  '2025',
  '2024',
  '2023',
  '2022',
  '2021',
  '2020',
  '2019',
  '2018',
  '2017',
  '2016',
  '2015',
];

export const Discovery: React.FC = () => {
  const navigate = useNavigate();
  const [genre, setGenre] = useState('All');
  const [format, setFormat] = useState<'All' | 'TV' | 'MOVIE' | 'OVA' | 'ONA'>('All');
  const [year, setYear] = useState('All');
  const [sort, setSort] = useState<'POPULARITY_DESC' | 'SCORE_DESC' | 'START_DATE_DESC' | 'TRENDING_DESC'>('POPULARITY_DESC');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AnimeMedia[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPage(1);
  }, [genre, format, year, sort]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await fetchDiscoverAnime({
          page,
          sort,
          genre: genre === 'All' ? undefined : genre,
          format: format === 'All' ? undefined : format,
          year: year === 'All' ? undefined : year,
        });
        if (cancelled) return;
        setItems((prev) => (page === 1 ? res.results : [...prev, ...res.results]));
        setTotalPages(res.total_pages || 1);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [genre, format, year, sort, page]);

  const handleSurpriseMe = () => {
    if (!items.length) return;
    const randomItem = items[Math.floor(Math.random() * items.length)];
    if (randomItem) navigate(`/anime/${randomItem.id}`);
  };

  return (
    <div className="min-h-screen bg-black pt-8 sm:pt-12 pb-24 px-4 sm:px-6 md:px-12 md:pl-28 select-none">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-white">
              <SparkIcon active />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Finds & Anime Discovery
              </h1>
              <p className="text-xs sm:text-sm text-[#8f98a2]">
                Filter across thousands of anime series, movies, OVAs, and genres
              </p>
            </div>
          </div>

          <button
            onClick={handleSurpriseMe}
            className="self-start sm:self-auto px-5 py-2.5 rounded-xl bg-white hover:bg-gray-200 text-black font-bold text-xs sm:text-sm flex items-center gap-2 transition-all hover:scale-105"
          >
            <ShuffleIcon />
            <span>Surprise Me</span>
          </button>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 bg-[#0d0d0d] p-3.5 rounded-2xl border border-white/[0.08]">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8f98a2] mb-1.5">
              Genre
            </label>
            <AnimatedSelect
              value={genre}
              onChange={(val) => setGenre(val)}
              options={GENRE_OPTIONS.map((g) => ({
                value: g,
                label: g === 'All' ? 'All Genres' : g,
              }))}
              className="w-full"
              triggerClassName="w-full h-10"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8f98a2] mb-1.5">
              Format
            </label>
            <AnimatedSelect
              value={format}
              onChange={(val) => setFormat(val as any)}
              options={FORMAT_OPTIONS}
              className="w-full"
              triggerClassName="w-full h-10"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8f98a2] mb-1.5">
              Release Year
            </label>
            <AnimatedSelect
              value={year}
              onChange={(val) => setYear(val)}
              options={YEAR_OPTIONS.map((y) => ({
                value: y,
                label: y === 'All' ? 'All Years' : y,
              }))}
              className="w-full"
              triggerClassName="w-full h-10"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8f98a2] mb-1.5">
              Sort By
            </label>
            <AnimatedSelect
              value={sort}
              onChange={(val) => setSort(val as any)}
              options={SORT_OPTIONS}
              className="w-full"
              triggerClassName="w-full h-10"
              align="right"
            />
          </div>
        </div>

        {/* Results Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 sm:gap-4">
          {items.map((item, idx) => (
            <PosterCard key={`${item.id}-${idx}`} item={item} className="w-full" />
          ))}
        </div>

        {loading && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 sm:gap-4 mt-4">
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-lg bg-[#0d0d0d] animate-pulse" />
            ))}
          </div>
        )}

        {!loading && page < totalPages && (
          <div className="mt-10 flex justify-center">
            <button
              onClick={() => setPage((p) => p + 1)}
              className="px-8 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm border border-white/15 transition-all hover:scale-105"
            >
              Load More Anime
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
