import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { AnimeMedia, fetchAnimeDetails, fetchImdbTrailer, resolvePlayableTrailerUrl, buildYouTubeEmbedUrl, prefetchAnimeStream, NEXUS_TOP_10_ART } from '../lib/api';
import { getWatchlistItemStatus, setWatchlistItem, WatchlistStatus } from '../lib/storage';
import { PlayIcon, VolumeIcon } from './icons';
import { TrimmedLogo } from './TrimmedLogo';

interface HeroSliderProps {
  items: AnimeMedia[];
}

export const HeroSlider: React.FC<HeroSliderProps> = memo(({ items }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [detailsMap, setDetailsMap] = useState<Record<string | number, AnimeMedia>>({});
  const [trailerUrl, setTrailerUrl] = useState<string | null>(null);
  const [loadingTrailer, setLoadingTrailer] = useState(false);
  const [muted, setMuted] = useState(true); // Must start muted so browser autoplay policy never blocks video or shows pause overlay
  const [isScrolled, setIsScrolled] = useState(() =>
    typeof window !== 'undefined' ? window.scrollY > 10 : false
  );

  const thumbContainerRef = useRef<HTMLDivElement>(null);
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const fetchingDetailsIds = useRef<Set<string | number>>(new Set());

  const slides = useMemo(() => {
    const uniqueItems = items.filter(
      (item, idx, self) => idx === self.findIndex((t) => t.id === item.id)
    );
    return uniqueItems.slice(0, 10);
  }, [items]);

  const current = slides[activeIndex];
  const currentDetails = current ? detailsMap[current.id] : undefined;

  const [watchlistStatus, setWatchlistStatus] = useState<WatchlistStatus | null>(() =>
    current ? getWatchlistItemStatus(current.id) : null
  );

  useEffect(() => {
    if (!current) return;
    setWatchlistStatus(getWatchlistItemStatus(current.id));
  }, [current?.id]);

  useEffect(() => {
    const sync = () => {
      if (current) {
        setWatchlistStatus(getWatchlistItemStatus(current.id));
      }
    };
    window.addEventListener('bingr-storage-update', sync);
    return () => window.removeEventListener('bingr-storage-update', sync);
  }, [current?.id]);

  const handleToggleWatchlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!current) return;
    if (watchlistStatus) {
      setWatchlistItem(current, null);
      setWatchlistStatus(null);
      toast(`Removed "${current.title}" from Watchlist`);
    } else {
      setWatchlistItem(current, 'watchlist');
      setWatchlistStatus('watchlist');
      toast(`Added "${current.title}" to Watchlist`);
    }
  };

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const nextSlide = useCallback(() => {
    if (!slides.length) return;
    setActiveIndex((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  // Fetch details (1080p/4K TMDB backdrop, clearlogo, genres, imdb_id) for slides without re-triggering loop
  useEffect(() => {
    if (!slides.length) return;
    const len = slides.length;
    const prioritized = [
      activeIndex,
      (activeIndex + 1) % len,
      (activeIndex + 2) % len,
      (activeIndex - 1 + len) % len,
    ];
    const rest = slides.map((_, i) => i).filter((i) => !prioritized.includes(i));
    const allOrder = [...prioritized, ...rest];

    allOrder.forEach((idx) => {
      const slide = slides[idx];
      if (!slide || fetchingDetailsIds.current.has(slide.id)) return;
      fetchingDetailsIds.current.add(slide.id);
      fetchAnimeDetails(slide.id)
        .then((det) => {
          setDetailsMap((prev) => (prev[slide.id] ? prev : { ...prev, [slide.id]: det }));
        })
        .catch(() => {
          fetchingDetailsIds.current.delete(slide.id);
        });
    });
  }, [activeIndex, slides]);

  // Reset trailer only when the active slide ID actually changes
  useEffect(() => {
    setTrailerUrl(null);
    setLoadingTrailer(false);
    if (current?.id) {
      prefetchAnimeStream(current.id, 1, 'sub', current.title);
    }
  }, [activeIndex, current?.id]);

  const ytIframeRef = useRef<HTMLIFrameElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
      if (!muted) {
        videoRef.current.volume = 0.15;
      }
    }
  }, [muted]);

  // Send command to YouTube iframe via postMessage
  const sendYtCommand = useCallback((func: string, args: any[] = []) => {
    if (ytIframeRef.current?.contentWindow) {
      try {
        ytIframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func, args }),
          '*'
        );
      } catch {
        // ignore cross-origin postMessage errors
      }
    }
  }, []);

  // Configure YouTube player: Low Volume (15%), 1080p HD, and mute/unmute state
  const configurePlayer = useCallback(() => {
    if (ytIframeRef.current?.contentWindow) {
      const win = ytIframeRef.current.contentWindow;
      try {
        win.postMessage(JSON.stringify({ event: 'listening' }), '*');
        win.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [15] }), '*');
        win.postMessage(JSON.stringify({ event: 'command', func: 'setPlaybackQuality', args: ['hd1080'] }), '*');
        win.postMessage(JSON.stringify({ event: 'command', func: 'setPlaybackQualityRange', args: ['hd1080', 'highres'] }), '*');
        const cmd = muted ? 'mute' : 'unMute';
        win.postMessage(JSON.stringify({ event: 'command', func: cmd, args: [] }), '*');
        win.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
      } catch {
        // ignore
      }
    }
  }, [muted]);

  const handleIframeLoad = useCallback(() => {
    configurePlayer();
    // Re-trigger playVideo after YouTube player scripts initialize
    setTimeout(configurePlayer, 300);
    setTimeout(configurePlayer, 800);
    setTimeout(configurePlayer, 1500);
  }, [configurePlayer]);

  useEffect(() => {
    configurePlayer();
  }, [muted, configurePlayer]);

  // Handle YouTube iframe loop & onReady without playlist controls
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data?.event === 'onReady') {
          configurePlayer();
        }
        // Player state 0 is ENDED -> loop video cleanly
        if (data?.event === 'infoDelivery' && data?.info?.playerState === 0) {
          sendYtCommand('seekTo', [0, true]);
          sendYtCommand('playVideo', []);
        }
        // If video ever gets paused (playerState === 2), immediately resume playback so no pause icon appears!
        if (data?.event === 'infoDelivery' && data?.info?.playerState === 2) {
          sendYtCommand('mute', []);
          sendYtCommand('playVideo', []);
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [configurePlayer, sendYtCommand]);

  // Browser Autoplay audio unlocking on first user interaction
  useEffect(() => {
    const unlockAudio = () => {
      if (!muted && ytIframeRef.current?.contentWindow) {
        try {
          ytIframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'setVolume', args: [15] }),
            '*'
          );
          ytIframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'unMute', args: [] }),
            '*'
          );
        } catch {}
      }
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true, passive: true });
    window.addEventListener('keydown', unlockAudio, { once: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, [muted]);

  const buildYouTubeUrl = useCallback((videoId: string) => {
    const cleanId = videoId.trim();
    // Clean, direct YouTube embed with zero UI controls, autoplay, muted start to prevent pause overlay
    return `https://www.youtube.com/embed/${cleanId}?autoplay=1&mute=1&controls=0&disablekb=1&fs=0&playsinline=1&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&enablejsapi=1&vq=hd1080`;
  }, []);

  // Autoplay trailer after 1.5s on active slide if not scrolled down
  useEffect(() => {
    if (isScrolled || !current) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const topArt = NEXUS_TOP_10_ART[Number(current?.id)];
      const tr = currentDetails?.trailer || current?.trailer;
      const videoId = topArt?.trailerId || tr?.id;
      if (videoId) {
        const url = await resolvePlayableTrailerUrl(videoId);
        if (!cancelled && url) setTrailerUrl(url);
      } else if (currentDetails?.imdb_id || current?.imdb_id) {
        fetchImdbTrailer(currentDetails?.imdb_id || current?.imdb_id).then((url) => {
          if (!cancelled && url) setTrailerUrl(url);
        }).catch(() => {});
      }
    }, 1500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeIndex, current?.id, currentDetails?.trailer?.id, currentDetails?.imdb_id, isScrolled]);

  const startTrailer = useCallback(async () => {
    // If trailer is already playing, clicking stops it
    if (trailerUrl) {
      setTrailerUrl(null);
      return;
    }

    setLoadingTrailer(true);
    try {
      // 1. Curated Top 10 pre-downloaded trailer ID
      const topArt = NEXUS_TOP_10_ART[Number(current?.id)];
      if (topArt?.trailerId) {
        const url = await resolvePlayableTrailerUrl(topArt.trailerId);
        if (url) {
          setTrailerUrl(url);
          return;
        }
      }

      // 2. Direct trailer from media or details
      const tr = currentDetails?.trailer || current?.trailer;
      if (tr?.id) {
        const url = await resolvePlayableTrailerUrl(tr.id);
        if (url) {
          setTrailerUrl(url);
          return;
        }
      }

      // 3. Fallback to IMDb trailer
      const imdbId = currentDetails?.imdb_id || current?.imdb_id;
      if (imdbId) {
        const url = await fetchImdbTrailer(imdbId);
        if (url) {
          setTrailerUrl(url);
          return;
        }
      }
    } catch (err) {
      console.warn('[HeroSlider] trailer playback error:', err);
    } finally {
      setLoadingTrailer(false);
    }
  }, [current, currentDetails, trailerUrl]);

  // Auto-advance after 8s when not scrolled and no trailer playing
  useEffect(() => {
    if (isScrolled || !slides.length || trailerUrl || loadingTrailer) return;
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined' && window.scrollY > 300) return;
      nextSlide();
    }, 8000);
    return () => clearTimeout(timer);
  }, [activeIndex, slides.length, trailerUrl, loadingTrailer, isScrolled, nextSlide]);

  // Scroll active thumbnail into view
  useEffect(() => {
    const thumb = thumbRefs.current[activeIndex];
    const container = thumbContainerRef.current;
    if (thumb && container) {
      const targetLeft = thumb.offsetLeft - container.offsetWidth / 2 + thumb.offsetWidth / 2;
      container.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
    }
  }, [activeIndex]);

  if (!slides.length || !current) {
    return (
      <div className="w-full h-[75vh] md:h-auto md:aspect-video max-h-[85vh] bg-black animate-pulse" />
    );
  }

  const detailUrl = `/anime/${current.id}`;
  const watchUrl = `/watch/anime/${current.id}/1/1`;
  const activeLogo = currentDetails?.logo ?? current.logo ?? null;
  const activeGenres = (currentDetails?.genres?.length ? currentDetails.genres : current.genres) || [];
  const currentRating =
    currentDetails?.rating ||
    current.rating ||
    (current.id ? NEXUS_TOP_10_ART[Number(current.id)]?.rating : null) ||
    null;
  const isMovie = (currentDetails?.format || current.format || '').toUpperCase() === 'MOVIE';
  const hasImdbId = Boolean(currentDetails?.imdb_id || current.imdb_id);

  // Clean, punchy description: prioritizes first sentence / concise summary to maintain balanced proportions
  const formattedOverview = useMemo(() => {
    const raw = currentDetails?.overview || current?.overview || '';
    if (!raw) return '';
    const clean = raw.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

    // Check for clean first sentence boundary (.!?)
    const firstSentenceMatch = clean.match(/^([^.!?]+[.!?])/);
    if (firstSentenceMatch) {
      const first = firstSentenceMatch[1].trim();
      // If the first sentence is nicely descriptive (between 65 and 185 chars), use it directly
      if (first.length >= 65 && first.length <= 185) {
        return first;
      }
      // If the first sentence is short (< 65 chars), try to include the second sentence if it fits under 200 chars
      if (first.length < 65) {
        const twoSentencesMatch = clean.match(/^([^.!?]+[.!?]\s+[^.!?]+[.!?])/);
        if (twoSentencesMatch && twoSentencesMatch[1].trim().length <= 200) {
          return twoSentencesMatch[1].trim();
        }
      }
    }

    // Clean word-boundary truncation near 175 characters
    const maxLen = 175;
    if (clean.length <= maxLen) return clean;
    const truncated = clean.slice(0, maxLen);
    const lastSpace = truncated.lastIndexOf(' ');
    return (lastSpace > 50 ? truncated.slice(0, lastSpace) : truncated).trim() + '...';
  }, [currentDetails?.overview, current?.overview]);

  // Metadata tags: Rating, Year, Format + max 2 Genres (clickable to filter)
  const metaTags: React.ReactNode[] = [];
  if (currentRating && Number(currentRating) > 0) {
    metaTags.push(
      <span key="rating" className="inline-flex items-center text-white font-semibold">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="white" className="mr-1">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        <span>{Number(currentRating).toFixed(1)}</span>
      </span>
    );
  }
  if (current.year) {
    metaTags.push(
      <Link
        key="year"
        to={`/explore?year=${encodeURIComponent(String(current.year))}`}
        onClick={(e) => e.stopPropagation()}
        className="hover:text-white hover:underline underline-offset-4 transition-colors cursor-pointer"
      >
        {current.year}
      </Link>
    );
  }
  const formatText = isMovie ? 'Movie' : currentDetails?.format || current.format || 'TV';
  if (formatText) {
    metaTags.push(
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
  activeGenres.slice(0, 2).forEach((genre) => {
    metaTags.push(
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

  return (
    <section
      className="relative w-full h-[75vh] md:h-[80vh] lg:h-[84vh] min-h-[550px] max-h-[800px] bg-black select-none overflow-hidden group"
      onTouchStart={(e) => {
        touchStartX.current = e.targetTouches[0].clientX;
      }}
      onTouchMove={(e) => {
        touchEndX.current = e.targetTouches[0].clientX;
      }}
      onTouchEnd={() => {
        if (!touchStartX.current || !touchEndX.current) return;
        const diff = touchStartX.current - touchEndX.current;
        if (diff > 50) setActiveIndex((prev) => (prev + 1) % slides.length);
        if (diff < -50) setActiveIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
        touchStartX.current = 0;
        touchEndX.current = 0;
      }}
    >
      {slides.map((slide, idx) => {
        const isActive = idx === activeIndex;
        const det = detailsMap[slide.id];
        const backdropSrc =
          det?.backdrop_original || det?.backdrop || slide.backdrop || slide.poster || '';

        return (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            }`}
          >
            <div className="absolute inset-0 bg-black overflow-hidden">
              {isActive && trailerUrl ? (
                <>
                  {trailerUrl.includes('youtube') || trailerUrl.includes('youtu.be') ? (
                    <iframe
                      ref={ytIframeRef}
                      src={trailerUrl}
                      title={`${slide.title} Trailer`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[105vw] h-[59vw] min-w-full min-h-full pointer-events-none border-0"
                      onLoad={handleIframeLoad}
                    />
                  ) : (
                    <video
                      ref={videoRef}
                      src={trailerUrl}
                      autoPlay
                      muted={muted}
                      loop
                      controls={false}
                      playsInline
                      disablePictureInPicture
                      disableRemotePlayback
                      controlsList="nodownload nofullscreen noremoteplayback"
                      className="w-full h-full object-cover object-center transition-opacity duration-1000 transform scale-[1.12] pointer-events-none"
                      onError={() => {
                        const topArt = NEXUS_TOP_10_ART[Number(slide?.id)];
                        const tr = det?.trailer || slide?.trailer;
                        const vid = topArt?.trailerId || tr?.id;
                        const fallbackEmbed = vid ? buildYouTubeEmbedUrl(vid) : null;
                        if (fallbackEmbed && trailerUrl !== fallbackEmbed) {
                          setTrailerUrl(fallbackEmbed);
                        } else {
                          setTrailerUrl(null);
                        }
                      }}
                    />
                  )}
                  {/* Invisible pointer shield preventing clicks/taps from pausing YouTube */}
                  <div className="absolute inset-0 z-[5] pointer-events-auto cursor-default" />
                </>
              ) : (
                <img
                  src={backdropSrc}
                  alt={slide.title}
                  fetchPriority={isActive ? 'high' : 'low'}
                  loading={isActive ? 'eager' : 'lazy'}
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-top"
                  onError={(e) => {
                    const el = e.currentTarget;
                    if (slide.backdrop && el.src !== slide.backdrop) {
                      el.src = slide.backdrop;
                    } else if (slide.poster && el.src !== slide.poster) {
                      el.src = slide.poster;
                    }
                  }}
                />
              )}

              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 md:via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black to-transparent pointer-events-none" />
            </div>
          </div>
        );
      })}

      {/* Foreground Content */}
      <div className="absolute inset-0 z-20 flex flex-col justify-end px-4 sm:px-6 pb-16 sm:pb-20 md:pb-24 lg:pb-28 md:pl-24 lg:pl-28 md:pr-12 pointer-events-none">
        <div
          key={`content-${current.id}`}
          className="w-[85%] md:max-w-2xl flex flex-col items-start text-left group/info animate-slide-up pointer-events-auto"
        >
          <div className="mb-3.5 sm:mb-4 md:mb-5 min-h-[60px] md:min-h-[80px] flex items-end justify-start w-full">
            {activeLogo ? (
              <TrimmedLogo
                src={activeLogo}
                alt={current.title}
                className="max-h-[60px] sm:max-h-[120px] md:max-h-[140px] max-w-[240px] sm:max-w-[360px] md:max-w-[420px] w-auto h-auto object-contain object-left block"
              />
            ) : (
              <h2 className="text-3xl sm:text-5xl lg:text-[64px] font-black leading-[1.1] font-display tracking-tight text-[#f9f9f9]">
                {current.title}
              </h2>
            )}
          </div>

          {/* Clean White Metadata Line: Rating, Year, Format, and max 2 Genres separated by consistent gray dots (always visible as visual anchor) */}
          <div className="flex items-center flex-wrap text-[13px] md:text-[14px] font-medium text-white/85 mb-3 select-none">
            {metaTags.map((tag, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && (
                  <span className="mx-2 text-white/30 text-[11px] leading-none select-none">&bull;</span>
                )}
                {tag}
              </React.Fragment>
            ))}
          </div>

          <div className="w-full">
            <p className="text-[13px] md:text-[14px] lg:text-[15px] text-white/70 leading-[1.5] max-w-xl mb-4 line-clamp-2 md:line-clamp-3">
              {formattedOverview}
            </p>
          </div>
        </div>

        {/* Action Buttons Row: Circular Play + Pill See More with Info Icon + Circular Watchlist Button */}
        <div key={`actions-${current.id}`} className="flex items-center gap-3 w-full mt-1 animate-slide-up pointer-events-auto">
          <Link
            to={watchUrl}
            className="w-12 h-12 md:w-14 md:h-14 shrink-0 rounded-full bg-[#f9f9f9] text-black flex items-center justify-center hover:bg-white transition active:scale-95 shadow-md"
            aria-label={`Play ${current.title}`}
          >
            <PlayIcon className="w-5 h-5 md:w-6 md:h-6 ml-0.5" />
          </Link>

          <Link
            to={detailUrl}
            className="h-12 md:h-14 inline-flex items-center justify-center gap-2.5 px-6 rounded-full border border-white/20 bg-transparent backdrop-blur-md text-[#f9f9f9] font-semibold text-[13px] md:text-[15px] hover:bg-white/10 transition active:scale-95"
            aria-label="See more"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>See More</span>
          </Link>

          <button
            type="button"
            aria-pressed={Boolean(watchlistStatus)}
            aria-label={watchlistStatus ? 'Remove from watchlist' : 'Add to watchlist'}
            onClick={handleToggleWatchlist}
            className={`w-12 h-12 md:w-14 md:h-14 shrink-0 rounded-full flex items-center justify-center border backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer ${
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

        {/* Mobile / Tablet mute button */}
        {trailerUrl && (
          <div className="lg:hidden absolute right-4 bottom-6 pointer-events-auto">
            <button
              onClick={() => setMuted((m) => !m)}
              className="w-[42px] h-[42px] flex items-center justify-center rounded-full bg-[#1a1a1a]/80 backdrop-blur-md border border-white/15 text-white transition active:scale-95"
              aria-label={muted ? 'Unmute trailer' : 'Mute trailer'}
            >
              <VolumeIcon isMuted={muted} className="w-[18px] h-[18px]" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom-Right Thumbnail Strip + Floating Play/Mute Button on top (Matches Reference UI) */}
      <div className="hidden lg:flex flex-col items-end gap-2.5 absolute right-6 md:right-12 bottom-16 sm:bottom-20 md:bottom-24 lg:bottom-26 z-[60] pointer-events-auto select-none">
        {/* Floating Circular Trailer Play / Stop Button + Mute Button on top of preview cards */}
        <div className="flex items-center gap-2 mr-1">
          {trailerUrl && (
            <button
              onClick={(e) => {
                e.preventDefault();
                setMuted((m) => !m);
              }}
              className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center border border-white/20 bg-transparent backdrop-blur-md text-[#f9f9f9] hover:bg-white/10 hover:border-white/40 transition-all hover:scale-110 active:scale-95 cursor-pointer"
              aria-label={muted ? 'Unmute trailer' : 'Mute trailer'}
              title={muted ? 'Unmute' : 'Mute'}
            >
              <VolumeIcon isMuted={muted} className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={(e) => {
              e.preventDefault();
              startTrailer();
            }}
            disabled={loadingTrailer}
            className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full border border-white/20 bg-transparent backdrop-blur-md text-[#f9f9f9] hover:bg-white/10 hover:border-white/40 transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer"
            aria-label={trailerUrl ? 'Stop trailer' : 'Play trailer'}
            title={trailerUrl ? 'Stop Trailer' : 'Play Trailer'}
          >
            {loadingTrailer ? (
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <PlayIcon playing={Boolean(trailerUrl)} className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Mini Preview Cards Row */}
        {slides.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              className="flex-shrink-0 w-6 h-10 flex items-center justify-center text-white/50 hover:text-white transition cursor-pointer active:scale-95"
              onClick={() => setActiveIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1))}
              aria-label="Previous slide"
              title="Previous slide"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>

            <div
              ref={thumbContainerRef}
              className="flex items-center gap-1.5 overflow-x-auto overflow-y-hidden scroll-smooth max-w-[392px] xl:max-w-[476px] py-2 px-1 no-scrollbar"
            >
              {slides.map((slide, idx) => {
                const det = detailsMap[slide.id];
                const thumbSrc = det?.backdrop || slide.backdrop || slide.poster || '';
                return (
                  <button
                    key={slide.id}
                    ref={(el) => {
                      thumbRefs.current[idx] = el;
                    }}
                    onClick={() => setActiveIndex(idx)}
                    aria-label={`Show ${slide.title}`}
                    className={`relative flex-shrink-0 rounded-lg overflow-hidden transition-all duration-300 ease-out outline-none w-[74px] h-[44px] cursor-pointer ${
                      activeIndex === idx
                        ? 'ring-2 ring-white opacity-100 scale-105 mx-1 z-10 shadow-lg'
                        : 'opacity-50 hover:opacity-85'
                    }`}
                  >
                    <img
                      src={thumbSrc}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const el = e.currentTarget;
                        if (slide.poster && el.src !== slide.poster) {
                          el.src = slide.poster;
                        }
                      }}
                    />
                  </button>
                );
              })}
            </div>

            <button
              className="flex-shrink-0 w-6 h-10 flex items-center justify-center text-white/50 hover:text-white transition cursor-pointer active:scale-95"
              onClick={() => setActiveIndex((prev) => (prev + 1) % slides.length)}
              aria-label="Next slide"
              title="Next slide"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </section>
  );
});

HeroSlider.displayName = 'HeroSlider';
