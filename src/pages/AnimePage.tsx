import React, { useState, useEffect } from 'react';
import {
  AnimeMedia,
  fetchTrendingAnime,
  fetchDiscoverAnime,
  fetchTop10CuratedAnime,
} from '../lib/api';
import { HeroSlider } from '../components/HeroSlider';
import { TrayRow } from '../components/TrayRow';
import { TrendingRow } from '../components/ContentSections';
import { CategoryTray, GenreTray } from '../components/CategoryTray';

interface AnimePageProps {
  mode?: 'all' | 'series' | 'movies';
}

export const AnimePage: React.FC<AnimePageProps> = ({ mode = 'all' }) => {
  const [heroItems, setHeroItems] = useState<AnimeMedia[]>([]);
  const [popular, setPopular] = useState<AnimeMedia[]>([]);
  const [topRated, setTopRated] = useState<AnimeMedia[]>([]);
  const [action, setAction] = useState<AnimeMedia[]>([]);
  const [fantasy, setFantasy] = useState<AnimeMedia[]>([]);
  const [romance, setRomance] = useState<AnimeMedia[]>([]);
  const [scifi, setScifi] = useState<AnimeMedia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const formatFilter = mode === 'series' ? 'TV' : mode === 'movies' ? 'MOVIE' : undefined;

    (async () => {
      try {
        const [trendRes, popRes, scoreRes, actRes, fanRes, romRes, sciRes] = await Promise.all([
          mode === 'movies'
            ? fetchDiscoverAnime({ format: 'MOVIE', sort: 'TRENDING_DESC', page: 1 })
            : fetchTop10CuratedAnime().then((results) => ({ results, total_pages: 1 })),
          fetchDiscoverAnime({ format: formatFilter, sort: 'POPULARITY_DESC', page: 1 }),
          fetchDiscoverAnime({ format: formatFilter, sort: 'SCORE_DESC', page: 1 }),
          fetchDiscoverAnime({ format: formatFilter, genre: 'Action', sort: 'POPULARITY_DESC', page: 1 }),
          fetchDiscoverAnime({ format: formatFilter, genre: 'Fantasy', sort: 'POPULARITY_DESC', page: 1 }),
          fetchDiscoverAnime({ format: formatFilter, genre: 'Romance', sort: 'POPULARITY_DESC', page: 1 }),
          fetchDiscoverAnime({ format: formatFilter, genre: 'Sci-Fi', sort: 'POPULARITY_DESC', page: 1 }),
        ]);

        if (cancelled) return;
        setHeroItems(trendRes.results.length ? trendRes.results : popRes.results);
        setPopular(popRes.results);
        setTopRated(scoreRes.results);
        setAction(actRes.results);
        setFantasy(fanRes.results);
        setRomance(romRes.results);
        setScifi(sciRes.results);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mode]);

  const titlePrefix =
    mode === 'series' ? 'Anime Series' : mode === 'movies' ? 'Anime Movies' : 'Anime';

  if (loading && !heroItems.length) {
    return (
      <div className="min-h-screen bg-black">
        <div className="w-full h-[55vh] md:h-[85vh] bg-[#0d0d0d] animate-pulse mb-8" />
      </div>
    );
  }

  const formatParam = mode === 'series' ? 'format=TV&' : mode === 'movies' ? 'format=MOVIE&' : '';

  return (
    <div className="min-h-screen bg-black pb-12 overflow-x-hidden">
      <HeroSlider items={heroItems} />

      <div className="relative z-20 -mt-4 sm:-mt-6 md:-mt-12 space-y-2">
        <TrendingRow
          title={`Top 10 ${titlePrefix} Today`}
          items={heroItems}
          exploreUrl={`/explore?${formatParam}sort=TRENDING_DESC`}
        />
        <TrayRow
          title={`Popular ${titlePrefix}`}
          items={popular}
          exploreUrl={`/explore?${formatParam}sort=POPULARITY_DESC`}
        />
        <TrayRow
          title={`Critically Acclaimed ${titlePrefix}`}
          items={topRated}
          exploreUrl={`/explore?${formatParam}sort=SCORE_DESC`}
        />
        <CategoryTray title="Iconic Anime Studios" />
        <TrayRow
          title={`Action & Shonen ${titlePrefix}`}
          items={action}
          exploreUrl={`/explore?${formatParam}genre=Action`}
        />
        <TrayRow
          title={`Fantasy & Isekai ${titlePrefix}`}
          items={fantasy}
          exploreUrl={`/explore?${formatParam}genre=Fantasy`}
        />
        <TrayRow
          title={`Sci-Fi & Mecha ${titlePrefix}`}
          items={scifi}
          exploreUrl={`/explore?${formatParam}genre=Sci-Fi`}
        />
      </div>
    </div>
  );
};
