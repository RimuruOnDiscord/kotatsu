import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  AnimeMedia,
  AnimeEpisode,
  NextAiringEpisode,
  fetchAnimeDetails,
  fetchAnimeEpisodes,
  fetchImdbTrailer,
  resolvePlayableTrailerUrl,
  buildYouTubeEmbedUrl,
  prefetchAnimeStream,
  NEXUS_TOP_10_ART,
} from '../lib/api';
import {
  getWatchlistItemStatus,
  setWatchlistItem,
  WatchlistStatus,
  getContinueWatching,
} from '../lib/storage';
import { DetailHeroBackdrop } from '../components/DetailHeroBackdrop';
import {
  EpisodesSection,
  CharactersSection,
  KeepBingringSection,
} from '../components/ContentSections';
import { PlayIcon, VolumeIcon, ClockIcon } from '../components/icons';
import { TrimmedLogo } from '../components/TrimmedLogo';

export const AnimeDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [anime, setAnime] = useState<AnimeMedia | null>(null);
  const [trailerUrl, setTrailerUrl] = useState<string | null>(null);
  const [isPlayingTrailer, setIsPlayingTrailer] = useState(false);
  const [loadingTrailer, setLoadingTrailer] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isDetailsVisible, setIsDetailsVisible] = useState(false);

  const [episodes, setEpisodes] = useState<AnimeEpisode[]>([]);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [totalChunks, setTotalChunks] = useState(1);
  const [currentChunk, setCurrentChunk] = useState(1);
  const [nextAiring, setNextAiring] = useState<NextAiringEpisode | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  const [watchlistStatus, setWatchlistStatus] = useState<WatchlistStatus | null>(null);

  // Sync watchlist status if modified across other tabs/components
  useEffect(() => {
    if (!id) return;
    const sync = () => setWatchlistStatus(getWatchlistItemStatus(id));
    window.addEventListener('bingr-storage-update', sync);
    return () => window.removeEventListener('bingr-storage-update', sync);
  }, [id]);

  // Pause main hero trailer if user hovers a Keep Watching card trailer
  useEffect(() => {
    const onPauseMain = () => setIsPlayingTrailer(false);
    window.addEventListener('bingr:pause-main-trailer', onPauseMain);
    return () => window.removeEventListener('bingr:pause-main-trailer', onPauseMain);
  }, []);

  // Load anime details
  useEffect(() => {
    if (!id) return;
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    let cancelled = false;
    setLoading(true);
    setTrailerUrl(null);
    setIsPlayingTrailer(false);
    setCurrentChunk(1);
    setWatchlistStatus(getWatchlistItemStatus(id));

    (async () => {
      try {
        const data = await fetchAnimeDetails(id);
        if (cancelled) return;
        setAnime(data);

        // Determine starting season:
        // 1. Explicit ?season= query parameter in URL (e.g., trying to open a specific season directly)
        const requestedSeasonParam = searchParams.get('season');
        const paramSeasonNum = requestedSeasonParam ? parseInt(requestedSeasonParam, 10) : null;
        const paramSeasonExists = paramSeasonNum && data.seasons?.some((s) => s.season === paramSeasonNum);

        // 2. Check if user is currently watching this anime franchise
        const allFranchiseIds = new Set<string>();
        allFranchiseIds.add(String(id));
        if (data.id) allFranchiseIds.add(String(data.id));
        if (data.seasons) {
          for (const s of data.seasons) {
            if (s.anilistId) allFranchiseIds.add(String(s.anilistId));
          }
        }
        const cwItem = getContinueWatching().find((c) => allFranchiseIds.has(String(c.id)));

        let targetSeason = 1;
        if (paramSeasonExists && paramSeasonNum) {
          // Explicit URL season request
          targetSeason = paramSeasonNum;
        } else if (cwItem) {
          // User is currently watching: open to the season they are currently at
          if (cwItem.season && data.seasons?.some((s) => s.season === cwItem.season)) {
            targetSeason = cwItem.season;
          } else if (data.seasons) {
            const matchedSeasonByAnilistId = data.seasons.find(
              (s) => String(s.anilistId) === String(cwItem.id)
            );
            if (matchedSeasonByAnilistId) {
              targetSeason = matchedSeasonByAnilistId.season;
            }
          }
        } else {
          // General anime without active progress: always start at Season 1
          targetSeason = 1;
        }

        setSelectedSeason(targetSeason);
        document.title = `${data.title} — Kotatsu`;

        // Pre-warm the 1080p stream for the active season's resume episode (or Episode 1)
        const targetSeasonObj = data.seasons?.find((s) => s.season === targetSeason);
        const targetAnilistId = targetSeasonObj?.anilistId || id;
        const targetEp = (targetSeason === cwItem?.season ? cwItem?.episode : 1) || 1;
        prefetchAnimeStream(targetAnilistId, targetEp, 'sub');
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const hasTrailer = Boolean(
    anime?.trailer?.id ||
    (anime?.id && NEXUS_TOP_10_ART[Number(anime.id)]?.trailerId) ||
    anime?.imdb_id
  );

  const handleToggleTrailer = async () => {
    if (!anime) return;
    if (isPlayingTrailer) {
      setIsPlayingTrailer(false);
      return;
    }

    if (trailerUrl) {
      setIsPlayingTrailer(true);
      return;
    }

    setLoadingTrailer(true);
    try {
      // 1. Curated Top 10 pre-downloaded trailer ID
      const topArt = NEXUS_TOP_10_ART[Number(anime.id)];
      if (topArt?.trailerId) {
        const url = await resolvePlayableTrailerUrl(topArt.trailerId);
        if (url) {
          setTrailerUrl(url);
          setIsPlayingTrailer(true);
          return;
        }
      }

      // 2. Direct trailer from AniList
      if (anime.trailer?.id) {
        const url = await resolvePlayableTrailerUrl(String(anime.trailer.id));
        if (url) {
          setTrailerUrl(url);
          setIsPlayingTrailer(true);
          return;
        }
      }

      // 3. Fallback to IMDb trailer
      if (anime.imdb_id) {
        const url = await fetchImdbTrailer(anime.imdb_id);
        if (url) {
          setTrailerUrl(url);
          setIsPlayingTrailer(true);
          return;
        }
      }
    } catch (err) {
      console.warn('[AnimeDetails] trailer playback error:', err);
    } finally {
      setLoadingTrailer(false);
    }
  };

  const handleTrailerError = () => {
    if (!anime) {
      setIsPlayingTrailer(false);
      return;
    }
    const topArt = NEXUS_TOP_10_ART[Number(anime.id)];
    const videoId = topArt?.trailerId || anime.trailer?.id;
    if (videoId && trailerUrl && !trailerUrl.includes('youtube') && !trailerUrl.includes('youtu.be')) {
      const ytUrl = buildYouTubeEmbedUrl(videoId);
      if (ytUrl) {
        setTrailerUrl(ytUrl);
        return;
      }
    }
    setIsPlayingTrailer(false);
  };

  const activeSeasonObj = anime?.seasons?.find((s) => s.season === selectedSeason);
  const activeSeasonAnilistId = activeSeasonObj?.anilistId || id;

  // Load episodes by selected season + chunk
  useEffect(() => {
    if (!activeSeasonAnilistId) return;
    let cancelled = false;
    setLoadingEpisodes(true);

    (async () => {
      try {
        const epRes = await fetchAnimeEpisodes(activeSeasonAnilistId, currentChunk);
        if (cancelled) return;
        setEpisodes(epRes.episodes || []);
        setTotalChunks(epRes.totalChunks || 1);
        setNextAiring(epRes.nextAiringEpisode || null);
      } catch {
        if (!cancelled) setEpisodes([]);
      } finally {
        if (!cancelled) setLoadingEpisodes(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeSeasonAnilistId, currentChunk]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="relative w-full h-[70vh] lg:h-[85vh] min-h-[500px] flex flex-col justify-end px-4 pb-12 md:pl-[100px] lg:pl-[140px] md:pb-24">
          <div className="max-w-2xl space-y-4">
            <div className="h-14 w-72 bg-white/5 rounded-xl animate-pulse" />
            <div className="h-5 w-64 bg-white/5 rounded animate-pulse" />
            <div className="h-20 w-full bg-white/5 rounded-xl animate-pulse" />
            <div className="flex items-center gap-4 pt-2">
              <div className="w-14 h-14 rounded-full bg-white/10 animate-pulse" />
              <div className="w-12 h-12 rounded-full bg-white/5 animate-pulse" />
              <div className="w-12 h-12 rounded-full bg-white/5 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!anime) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p>Could not load anime details.</p>
      </div>
    );
  }

  const bgImage = anime.backdrop_original || anime.backdrop || anime.poster || '';
  const title = anime.title || '';
  const year = anime.year ? String(anime.year) : '';
  const isMovie = anime.format === 'MOVIE';

  // Metadata tags matching Home HeroSlider: Rating • Year • Format • Genre 1 • Genre 2
  const detailMetaTags: React.ReactNode[] = [];
  if (anime.rating && Number(anime.rating) > 0) {
    detailMetaTags.push(
      <span key="rating" className="inline-flex items-center text-white font-semibold">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="white"
          className="mr-1"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        <span>{Number(anime.rating).toFixed(1)}</span>
      </span>
    );
  }
  if (year) {
    detailMetaTags.push(
      <Link
        key="year"
        to={`/explore?year=${encodeURIComponent(year)}`}
        onClick={(e) => e.stopPropagation()}
        className="hover:text-white hover:underline underline-offset-4 transition-colors cursor-pointer"
      >
        {year}
      </Link>
    );
  }
  const formatText = isMovie ? 'Movie' : anime.format || 'TV';
  if (formatText) {
    detailMetaTags.push(
      <Link
        key="format"
        to={`/explore?format=${encodeURIComponent(formatText)}`}
        onClick={(e) => e.stopPropagation()}
        className="hover:text-white hover:underline underline-offset-4 transition-colors cursor-pointer"
      >
        {formatText}
      </Link>
    );
  }
  (anime.genres || []).slice(0, 2).forEach((genre) => {
    detailMetaTags.push(
      <Link
        key={`genre-${genre}`}
        to={`/explore?genre=${encodeURIComponent(genre)}`}
        onClick={(e) => e.stopPropagation()}
        className="hover:text-white hover:underline underline-offset-4 transition-colors cursor-pointer"
      >
        {genre}
      </Link>
    );
  });

  const watchAnilistId = activeSeasonAnilistId || anime.id;
  const allFranchiseIds = new Set<string>();
  if (id) allFranchiseIds.add(String(id));
  if (anime.id) allFranchiseIds.add(String(anime.id));
  if (anime.seasons) {
    for (const s of anime.seasons) {
      if (s.anilistId) allFranchiseIds.add(String(s.anilistId));
    }
  }

  const continueList = getContinueWatching();
  const savedProgress =
    continueList.find(
      (entry) =>
        allFranchiseIds.has(String(entry.id)) &&
        entry.season === selectedSeason
    ) ||
    continueList.find(
      (entry) => String(entry.id) === String(watchAnilistId)
    );
  const resumeEp = savedProgress ? savedProgress.episode : null;
  const watchCtaText = resumeEp ? 'Resume' : 'Watch Now';
  const watchSubText = isMovie ? 'MOVIE' : resumeEp ? `E${resumeEp}` : 'ANIME';
  const watchUrl = isMovie
    ? `/watch/anime/${watchAnilistId}/1/1`
    : `/watch/anime/${watchAnilistId}/1/${resumeEp || 1}`;

  const isReleased = !(
    anime.status &&
    ['Rumored', 'Planned', 'In Production', 'Post Production', 'Upcoming', 'NOT_YET_RELEASED'].includes(
      anime.status
    )
  );

  const handleToggleWatchlist = () => {
    if (!anime) return;
    if (watchlistStatus) {
      setWatchlistItem(anime, null);
      setWatchlistStatus(null);
      toast(`Removed "${title}" from Watchlist`);
    } else {
      setWatchlistItem(anime, 'watchlist');
      setWatchlistStatus('watchlist');
      toast(`Added "${title}" to Watchlist`);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-x-hidden selection:bg-white/30">
      {/* Top Hero Section */}
      <div className="relative w-full h-[62vh] md:h-[68vh] lg:h-[72vh] min-h-[480px]">
        <DetailHeroBackdrop
          trailerUrl={trailerUrl}
          isPlayingTrailer={isPlayingTrailer}
          isMuted={isMuted}
          isDetailsVisible={isDetailsVisible}
          bgImage={bgImage}
          title={title}
          className="h-[62vh] md:h-[68vh] lg:h-[72vh] min-h-[480px]"
          onTrailerEnded={() => setIsPlayingTrailer(false)}
          onTrailerError={handleTrailerError}
        />

        {/* Hero Foreground Overlay */}
        <div className="absolute inset-0 z-10 flex flex-col justify-end px-4 pb-4 md:pl-[100px] lg:pl-[140px] md:pb-7 pointer-events-none">
          <div
            className="max-w-2xl animate-slide-up pointer-events-auto group"
            onClick={() => setIsDetailsVisible((v) => !v)}
          >
              {/* Title / ClearLogo */}
              <div className="opacity-100">
                {anime.logo ? (
                  <TrimmedLogo
                    src={anime.logo}
                    alt={title}
                    className="max-h-[55px] md:max-h-[110px] max-w-[240px] md:max-w-[380px] w-auto h-auto object-contain object-left block mb-3 md:mb-4"
                  />
                ) : (
                  <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-3 text-white">
                    {title}
                  </h1>
                )}
              </div>

              {/* Metadata Line */}
              <div
                className={`overflow-hidden transition-all duration-1000 ease-in-out ${
                  trailerUrl && isPlayingTrailer && !isDetailsVisible
                    ? 'max-h-0 opacity-0 group-hover:max-h-[500px] group-hover:opacity-100'
                    : 'max-h-[500px] opacity-100'
                }`}
              >
                {/* Metadata Line matching Home HeroSlider: Rating • Year • Format • Genres */}
                <div className="flex items-center flex-wrap text-[13px] md:text-[14px] font-medium text-white/85 mb-3 select-none">
                  {detailMetaTags.map((tag, idx) => (
                    <React.Fragment key={idx}>
                      {idx > 0 && (
                        <span className="mx-2 text-white/30 text-[11px] leading-none select-none">&bull;</span>
                      )}
                      {tag}
                    </React.Fragment>
                  ))}
                </div>

                {/* Description / Overview matching Home HeroSlider */}
                {anime.overview && (
                  <p className="text-[13px] md:text-[14px] lg:text-[15px] text-white/70 leading-[1.5] max-w-xl mb-4 line-clamp-2 md:line-clamp-3 select-text">
                    {anime.overview.replace(/<[^>]*>/g, '').trim()}
                  </p>
                )}
              </div>

              {/* Action Buttons Row: Unified High-End Streaming Controls */}
              <div
                className="flex items-center flex-wrap gap-2.5 md:gap-3 mt-1 select-none"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Primary Action: Solid White Pill Button */}
                {isReleased ? (
                  <Link
                    to={watchUrl}
                    className="h-12 md:h-[50px] px-6 rounded-full bg-[#f9f9f9] hover:bg-white text-black font-bold text-[14px] md:text-[15px] flex items-center gap-2.5 transition-all duration-300 hover:scale-105 active:scale-95 shadow-[0_4px_20px_rgba(255,255,255,0.15)] group"
                    aria-label={watchCtaText}
                  >
                    <PlayIcon className="w-4 h-4 md:w-5 md:h-5 fill-current transition-transform duration-300 group-hover:scale-110" />
                    <span>
                      {resumeEp ? `Resume EP ${resumeEp}` : isMovie ? 'Watch Movie' : 'Watch Now'}
                    </span>
                  </Link>
                ) : (
                  <div className="h-12 md:h-[50px] px-6 rounded-full bg-white/10 border border-white/15 text-white/70 font-semibold text-[14px] flex items-center gap-2.5 backdrop-blur-sm cursor-not-allowed">
                    <ClockIcon className="w-5 h-5 opacity-70" />
                    <span>Releasing Soon</span>
                  </div>
                )}

                {/* Secondary Action: Play Trailer Pill Button (Matches See More outline properties) */}
                {hasTrailer && (
                  <button
                    type="button"
                    onClick={handleToggleTrailer}
                    disabled={loadingTrailer}
                    className={`h-12 md:h-[50px] px-5 rounded-full border backdrop-blur-md font-semibold text-[13.5px] md:text-[14.5px] flex items-center gap-2 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer group ${
                      isPlayingTrailer
                        ? 'bg-transparent border-white/10 text-white hover:bg-white/10 hover:border-white/40'
                        : 'border-white/20 bg-transparent text-[#f9f9f9] hover:bg-white/10 hover:border-white/40'
                    }`}
                    aria-label={isPlayingTrailer ? 'Stop trailer' : 'Play trailer'}
                    title={isPlayingTrailer ? 'Stop Trailer' : 'Play Trailer'}
                  >
                    {loadingTrailer ? (
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : isPlayingTrailer ? (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="text-white group-hover:scale-110 transition-transform"
                      >
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                      </svg>
                    ) : (
                      <PlayIcon className="w-4 h-4 fill-current transition-transform duration-300 group-hover:scale-110" />
                    )}
                    <span>
                      {isPlayingTrailer ? 'Stop Trailer' : 'Play Trailer'}
                    </span>
                  </button>
                )}

                {/* Tertiary Action: Circular Watchlist Button (Direct toggle without menu) */}
                <button
                  type="button"
                  aria-pressed={Boolean(watchlistStatus)}
                  aria-label={watchlistStatus ? 'Remove from watchlist' : 'Add to watchlist'}
                  onClick={handleToggleWatchlist}
                  className={`flex items-center justify-center w-12 h-12 md:w-[50px] md:h-[50px] rounded-full border backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer ${
                    watchlistStatus
                      ? 'bg-white text-black border-white shadow-lg'
                      : 'border-white/20 bg-transparent text-[#f9f9f9] hover:bg-white/10 hover:border-white/40'
                  }`}
                  title={watchlistStatus ? 'In Watchlist (Click to remove)' : 'Add to Watchlist'}
                >
                  {watchlistStatus ? (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

        {/* Bottom-Right Trailer Controls (Active during playback: Mute & Stop controls matching left action buttons) */}
        <div className="absolute right-4 md:right-12 lg:right-16 bottom-4 md:bottom-7 z-[60] flex items-center gap-2.5 md:gap-3 pointer-events-auto">
          {hasTrailer && isPlayingTrailer && (
            <>
              <button
                type="button"
                onClick={() => setIsMuted((m) => !m)}
                className="w-12 h-12 md:w-[50px] md:h-[50px] flex items-center justify-center rounded-full border border-white/20 bg-transparent backdrop-blur-md text-[#f9f9f9] hover:bg-white/10 hover:border-white/40 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer shadow-[0_6px_24px_rgba(0,0,0,0.7)]"
                aria-label={isMuted ? 'Unmute trailer' : 'Mute trailer'}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                <VolumeIcon isMuted={isMuted} className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleToggleTrailer}
                disabled={loadingTrailer}
                className="w-12 h-12 md:w-[50px] md:h-[50px] flex items-center justify-center rounded-full border border-white/20 bg-transparent backdrop-blur-md text-[#f9f9f9] hover:bg-white/10 hover:border-white/40 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer shadow-[0_6px_24px_rgba(0,0,0,0.7)]"
                aria-label="Stop trailer"
                title="Stop Trailer"
              >
                <PlayIcon playing={true} className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content Below Hero */}
      <main className="relative z-10 pl-4 pr-4 md:pl-[100px] lg:pl-[140px] md:pr-12 pt-0 md:pt-1 pb-24 overflow-hidden">
        <div className="z-[1] w-full pb-4 lg:pb-20">
          {!isMovie ? (
            <div className="w-full mb-8">
              <EpisodesSection
                animeId={watchAnilistId}
                animeTitle={activeSeasonObj?.fullTitle || anime.title}
                backdrop={anime.backdrop}
                poster={anime.poster}
                seasons={anime.seasons}
                selectedSeason={selectedSeason}
                onSeasonChange={(s) => {
                  setSelectedSeason(s);
                  setCurrentChunk(1);
                }}
                episodes={episodes}
                totalChunks={totalChunks}
                currentChunk={currentChunk}
                onChunkChange={setCurrentChunk}
                loadingEpisodes={loadingEpisodes}
                nextAiringEpisode={nextAiring}
              />
            </div>
          ) : (
            anime.overview && (
              <div className="w-full mb-8">
                <div className="p-6 rounded-2xl bg-[#0d0d0d]/90 border border-white/[0.08] backdrop-blur-md">
                  <h3 className="text-lg font-bold text-white mb-2">Synopsis</h3>
                  <p className="text-white/75 text-[14.5px] leading-relaxed">
                    {anime.overview}
                  </p>
                </div>
              </div>
            )
          )}

          <CharactersSection cast={anime.cast} label="Characters" />

          <KeepBingringSection items={anime.similars} />
        </div>
      </main>
    </div>
  );
};
