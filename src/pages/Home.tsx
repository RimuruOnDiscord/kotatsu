import React, { useState, useEffect, useRef, memo } from 'react';
import {
  AnimeMedia,
  fetchTrendingAnime,
  fetchDiscoverAnime,
  fetchRecommendationsForAnime,
  fetchTop10CuratedAnime,
} from '../lib/api';
import {
  getContinueWatching,
  getWatchlist,
  ContinueWatchingEntry,
  isKidsMode,
} from '../lib/storage';
import { HeroSlider } from '../components/HeroSlider';
import { TrayRow } from '../components/TrayRow';
import {
  TrendingRow,
  ContinueWatchingRow,
  CaughtBingingRow,
} from '../components/ContentSections';
import { CategoryTray } from '../components/CategoryTray';

interface LazyGenreSectionProps {
  title: string;
  genre: string;
  sort?: 'POPULARITY_DESC' | 'SCORE_DESC' | 'TRENDING_DESC';
}

const LazyGenreSection: React.FC<LazyGenreSectionProps> = memo(({
  title,
  genre,
  sort = 'POPULARITY_DESC',
}) => {
  const [items, setItems] = useState<AnimeMedia[]>([]);
  const [triggered, setTriggered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !triggered) {
          setTriggered(true);
          observer.disconnect();
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [triggered]);

  useEffect(() => {
    if (!triggered) return;
    fetchDiscoverAnime({ genre, sort, page: 1 })
      .then((res) => setItems(res.results))
      .catch(() => {});
  }, [triggered, genre, sort]);

  return (
    <div ref={ref} className="min-h-[120px]">
      {items.length > 0 && (
        <TrayRow
          title={title}
          items={items}
          exploreUrl={`/explore?genre=${encodeURIComponent(genre)}`}
        />
      )}
    </div>
  );
});

LazyGenreSection.displayName = 'LazyGenreSection';

export const Home: React.FC = () => {
  const [top10, setTop10] = useState<AnimeMedia[]>([]);
  const [trending, setTrending] = useState<AnimeMedia[]>([]);
  const [popular, setPopular] = useState<AnimeMedia[]>([]);
  const [topRated, setTopRated] = useState<AnimeMedia[]>([]);
  const [recommended, setRecommended] = useState<AnimeMedia[]>([]);
  const [caughtItems, setCaughtItems] = useState<AnimeMedia[]>([]);
  const [caughtTitle, setCaughtTitle] = useState<string>('Jujutsu Kaisen');
  const [caughtGenre, setCaughtGenre] = useState<string | undefined>(undefined);
  const [continueList, setContinueList] = useState<ContinueWatchingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStorage = () => {
    setContinueList(getContinueWatching());
  };

  useEffect(() => {
    loadStorage();
    window.addEventListener('bingr-storage-update', loadStorage);
    return () => window.removeEventListener('bingr-storage-update', loadStorage);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const kids = isKidsMode();

    (async () => {
      try {
        const [curatedRes, trendRes, popRes, scoreRes, recRes] = await Promise.all([
          fetchTop10CuratedAnime(),
          fetchTrendingAnime(1),
          fetchDiscoverAnime({
            sort: 'POPULARITY_DESC',
            genre: kids ? 'Comedy' : undefined,
            page: 1,
          }),
          fetchDiscoverAnime({
            sort: 'SCORE_DESC',
            genre: kids ? 'Adventure' : undefined,
            page: 1,
          }),
          fetchDiscoverAnime({
            sort: 'TRENDING_DESC',
            genre: kids ? 'Slice of Life' : 'Fantasy',
            page: 1,
          }),
        ]);

        if (cancelled) return;
        setTop10(curatedRes);
        setTrending(trendRes.results);
        setPopular(popRes.results);
        setTopRated(scoreRes.results);
        setRecommended(recRes.results);

        // Determine "Since you watched" seed from Continue Watching or Watchlist or top trending
        const cw = getContinueWatching();
        const wl = getWatchlist();
        const seedEntry = cw[0] || wl[0] || trendRes.results[0];
        const seedId = seedEntry?.id || 113415;
        const seedTitle = seedEntry?.title || 'Jujutsu Kaisen';
        setCaughtTitle(seedTitle);

        const recData = await fetchRecommendationsForAnime(seedId, seedTitle);
        if (!cancelled) {
          setCaughtTitle(recData.sourceTitle || seedTitle);
          setCaughtGenre(recData.sourceGenre);
          setCaughtItems(recData.items.slice(0, 12));
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
  }, []);

  // Re-sync "Since you watched" if Continue Watching changes
  useEffect(() => {
    const topCw = continueList[0];
    if (!topCw) return;
    let cancelled = false;
    fetchRecommendationsForAnime(topCw.id, topCw.title)
      .then((recData) => {
        if (!cancelled && recData.items.length > 0) {
          setCaughtTitle(recData.sourceTitle || topCw.title);
          setCaughtGenre(recData.sourceGenre);
          setCaughtItems(recData.items.slice(0, 12));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [continueList[0]?.id]);

  if (loading && !trending.length) {
    return (
      <div className="min-h-screen bg-black">
        <div className="w-full h-[55vh] md:h-[85vh] bg-[#0d0d0d] animate-pulse mb-8" />
        <div className="px-4 sm:px-6 md:px-12 md:pl-28 space-y-8">
          {[1, 2, 3].map((row) => (
            <div key={row}>
              <div className="h-6 w-48 bg-[#121212] rounded mb-4 animate-pulse" />
              <div className="flex gap-4 overflow-hidden">
                {[1, 2, 3, 4, 5, 6].map((card) => (
                  <div
                    key={card}
                    className="w-[140px] md:w-[180px] aspect-[2/3] rounded-lg bg-[#121212] shrink-0 animate-pulse"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-12 overflow-x-hidden">
      <HeroSlider items={top10.length ? top10 : (trending.length ? trending : popular)} />

      <div className="relative z-20 -mt-2 sm:-mt-4 md:-mt-6 space-y-2">
        <ContinueWatchingRow
          items={continueList}
          onRemove={() => setContinueList(getContinueWatching())}
        />

        <TrendingRow
          title="Top 10 Anime Today"
          items={top10.length ? top10 : trending}
          exploreUrl="/explore?sort=TRENDING_DESC"
        />

        <TrayRow
          title="Recommended For You"
          items={recommended}
          isAiRow
          exploreUrl="/explore?genre=Fantasy&sort=TRENDING_DESC"
        />

        <CaughtBingingRow
          sourceTitle={caughtTitle}
          items={caughtItems}
          exploreUrl={
            caughtGenre
              ? `/explore?genre=${encodeURIComponent(caughtGenre)}`
              : '/explore?sort=TRENDING_DESC'
          }
        />

        <TrayRow
          title="Most Popular Anime"
          items={popular}
          exploreUrl="/explore?sort=POPULARITY_DESC"
        />

        <CategoryTray title="Studios & Publishers" />

        <TrayRow
          title="All-Time Highest Rated"
          items={topRated}
          exploreUrl="/explore?sort=SCORE_DESC"
        />

        <LazyGenreSection title="Action & Shonen Hits" genre="Action" />
        <LazyGenreSection title="Supernatural & Occult" genre="Supernatural" />
        <LazyGenreSection title="Romance & Heartfelt Drama" genre="Romance" />
        <LazyGenreSection title="Sci-Fi & Cyberpunk" genre="Sci-Fi" />
        <LazyGenreSection title="Comedy & Feel-Good" genre="Comedy" />
        <LazyGenreSection title="Psychological Thrillers" genre="Psychological" />
        <LazyGenreSection title="Sports & Tournament Arcs" genre="Sports" />
      </div>
    </div>
  );
};
