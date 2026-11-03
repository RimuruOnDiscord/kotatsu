import React, { useEffect, useRef, useCallback } from 'react';

interface DetailHeroBackdropProps {
  trailerUrl?: string | null;
  isPlayingTrailer?: boolean;
  isMuted?: boolean;
  isDetailsVisible?: boolean;
  bgImage?: string | null;
  title: string;
  className?: string;
  onTrailerEnded?: () => void;
  onTrailerError?: () => void;
  isFixed?: boolean;
}

export const DetailHeroBackdrop: React.FC<DetailHeroBackdropProps> = ({
  trailerUrl,
  isPlayingTrailer = false,
  isMuted = true,
  isDetailsVisible = true,
  bgImage,
  title,
  className = 'h-[58vh] md:h-[63vh] lg:h-[66vh] min-h-[430px]',
  onTrailerEnded,
  onTrailerError,
  isFixed = true,
}) => {
  const showVideo = Boolean(trailerUrl && isPlayingTrailer);
  const rootRef = useRef<HTMLDivElement>(null);
  const gradRef = useRef<HTMLDivElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);
  const ytIframeRef = useRef<HTMLIFrameElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlayingTrailer) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlayingTrailer]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      if (!isMuted) {
        videoRef.current.volume = 0.15;
      }
    }
  }, [isMuted]);

  const configurePlayer = useCallback(() => {
    if (ytIframeRef.current?.contentWindow) {
      try {
        const win = ytIframeRef.current.contentWindow;
        win.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [15] }), '*');
        win.postMessage(JSON.stringify({ event: 'command', func: 'setPlaybackQuality', args: ['hd1080'] }), '*');
        win.postMessage(JSON.stringify({ event: 'command', func: 'setPlaybackQualityRange', args: ['hd1080', 'highres'] }), '*');
        const cmd = isMuted ? 'mute' : 'unMute';
        win.postMessage(JSON.stringify({ event: 'command', func: cmd, args: [] }), '*');
        if (isPlayingTrailer) {
          win.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
        } else {
          win.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*');
        }
      } catch {
        // ignore
      }
    }
  }, [isMuted, isPlayingTrailer]);

  const handleIframeLoad = useCallback(() => {
    configurePlayer();
    setTimeout(configurePlayer, 300);
    setTimeout(configurePlayer, 800);
    setTimeout(configurePlayer, 1500);
  }, [configurePlayer]);

  useEffect(() => {
    configurePlayer();
  }, [isMuted, isPlayingTrailer, configurePlayer]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data?.event === 'onReady') {
          configurePlayer();
        }
        if (data?.event === 'infoDelivery' && data?.info?.playerState === 0) {
          if (!onTrailerEnded && ytIframeRef.current?.contentWindow) {
            ytIframeRef.current.contentWindow.postMessage(
              JSON.stringify({ event: 'command', func: 'seekTo', args: [0, true] }),
              '*'
            );
            ytIframeRef.current.contentWindow.postMessage(
              JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
              '*'
            );
          } else {
            onTrailerEnded?.();
          }
        }
        if (data?.event === 'infoDelivery' && data?.info?.playerState === 2 && isPlayingTrailer) {
          ytIframeRef.current?.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func: 'mute', args: [] }),
            '*'
          );
          ytIframeRef.current?.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
            '*'
          );
        }
      } catch {}
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [configurePlayer, isPlayingTrailer, onTrailerEnded]);

  const updateScrollStyles = useCallback(() => {
    if (typeof window === 'undefined') return;
    const root = rootRef.current;
    const grad = gradRef.current;
    const dim = dimRef.current;
    if (!root) return;

    if (showVideo) {
      root.style.visibility = 'visible';
      root.style.opacity = '1';
      if (dim) dim.style.opacity = '0';
      return;
    }

    const scrollY = window.scrollY;
    const ratio = Math.min(Math.max(scrollY / 400, 0), 1);

    if (scrollY >= 450) {
      root.style.visibility = 'hidden';
      root.style.opacity = '0';
      if (dim) dim.style.opacity = '1';
      return;
    }

    root.style.visibility = 'visible';
    root.style.opacity = '1';
    if (grad && dim) {
      const baseH = window.innerWidth < 650 ? 140 : 190;
      const targetH = baseH + ratio * (Math.max(root.clientHeight || 500, 650) - baseH);
      grad.style.height = `${targetH}px`;
      dim.style.opacity = `${ratio}`;
    }
  }, [showVideo]);


  useEffect(() => {
    if (showVideo) {
      updateScrollStyles();
      return;
    }
    let ticking = false;
    const onScrollOrResize = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateScrollStyles();
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });
    updateScrollStyles();
    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [showVideo, updateScrollStyles]);

  const initialScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
  const hiddenByScroll = !showVideo && initialScrollY >= 450;
  const initialRatio = showVideo ? 0 : Math.min(Math.max(initialScrollY / 400, 0), 1);
  const initialGradH = 190 + initialRatio * 400;

  return (
    <div
      ref={rootRef}
      style={{
        visibility: hiddenByScroll ? 'hidden' : 'visible',
        opacity: hiddenByScroll ? 0 : 1,
      }}
      className={`${
        showVideo || !isFixed ? 'absolute inset-0' : `fixed inset-x-0 top-0 w-full ${className}`
      } z-0 overflow-hidden pointer-events-none bg-black`}
    >
      {/* Anime Banner Image (always in DOM so there is zero black flash when toggling) */}
      {bgImage && (
        <img
          src={bgImage}
          alt={title}
          fetchPriority="high"
          decoding="async"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center md:object-right-top opacity-90 transition-opacity duration-700"
        />
      )}

      {/* Active Trailer Video or YouTube Iframe */}
      {showVideo && trailerUrl && (
        <>
          {trailerUrl.includes('youtube') || trailerUrl.includes('youtu.be') ? (
            <iframe
              ref={ytIframeRef}
              src={trailerUrl}
              title={`${title} Trailer`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[105vw] h-[59vw] min-w-full min-h-full pointer-events-none border-0 opacity-90 transition-opacity duration-1000"
              onLoad={handleIframeLoad}
            />
          ) : (
            <video
              ref={videoRef}
              src={trailerUrl}
              autoPlay
              muted={isMuted}
              loop={!onTrailerEnded}
              playsInline
              controls={false}
              disablePictureInPicture
              disableRemotePlayback
              controlsList="nodownload nofullscreen noremoteplayback"
              className="absolute inset-0 w-full h-full object-cover object-center opacity-90 transition-opacity duration-1000 transform scale-[1.12] pointer-events-none"
              onEnded={onTrailerEnded}
              onError={() => {
                if (onTrailerError) onTrailerError();
                else onTrailerEnded?.();
              }}
            />
          )}
          {/* Transparent pointer shield preventing clicks/taps from pausing YouTube */}
          <div className="absolute inset-0 z-[5] pointer-events-auto cursor-default" />
        </>
      )}

      {/* Left gradient mask */}
      <div
        className={`absolute inset-0 z-40 bg-gradient-to-r from-black via-black/50 to-transparent w-[50%] md:w-[65%] pointer-events-none transition-opacity duration-1000 ${
          showVideo && !isDetailsVisible ? 'opacity-0' : 'opacity-100'
        }`}
      />

      {showVideo ? (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 md:via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black to-transparent pointer-events-none" />
        </>
      ) : (
        <>
          <div
            ref={gradRef}
            className="absolute inset-x-0 bottom-0 pointer-events-none will-change-[height] z-20"
            style={{
              height: `${initialGradH}px`,
              background:
                'linear-gradient(to top, #000000 0%, rgba(0,0,0,0.92) 40%, rgba(0,0,0,0.5) 75%, transparent 100%)',
            }}
          />
          <div
            ref={dimRef}
            className="absolute inset-0 bg-black pointer-events-none will-change-[opacity] z-30"
            style={{ opacity: initialRatio }}
          />
        </>
      )}
    </div>
  );
};
