import React, { useState, useEffect, useRef } from 'react';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
}

// Single shared IntersectionObserver instance to prevent allocating hundreds of observers
let sharedObserver: IntersectionObserver | null = null;
const observerCallbacks = new WeakMap<Element, () => void>();

function getSharedObserver(): IntersectionObserver | null {
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return null;
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          if (entry.isIntersecting) {
            const cb = observerCallbacks.get(entry.target);
            if (cb) {
              cb();
              observerCallbacks.delete(entry.target);
            }
            sharedObserver?.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '300px' }
    );
  }
  return sharedObserver;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className = '',
  imgClassName = 'w-full h-full object-cover',
  priority = false,
  ...rest
}) => {
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(priority);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (priority || inView) return;
    const el = containerRef.current;
    if (!el) return;
    const obs = getSharedObserver();
    if (!obs) {
      setInView(true);
      return;
    }
    observerCallbacks.set(el, () => setInView(true));
    obs.observe(el);
    return () => {
      observerCallbacks.delete(el);
      obs.unobserve(el);
    };
  }, [priority, inView]);

  return (
    <div ref={containerRef} className={`relative overflow-hidden bg-[#0a0a0a] ${className}`}>
      {!loaded && <div className="absolute inset-0 bg-[#121212] animate-pulse" />}
      {inView && src && (
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          className={`${imgClassName} transition-opacity duration-300 ease-out ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
          {...rest}
        />
      )}
    </div>
  );
};
