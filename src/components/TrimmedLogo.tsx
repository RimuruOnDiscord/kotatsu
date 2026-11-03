import React, { useState, useEffect } from 'react';

const trimmedCache = new Map<string, string>();
const invalidLogoCache = new Set<string>();

function trimTransparentCanvas(img: HTMLImageElement): { dataUrl: string | null; isOpaqueBox: boolean } {
  try {
    const origW = img.naturalWidth;
    const origH = img.naturalHeight;
    if (!origW || !origH) return { dataUrl: null, isOpaqueBox: true };

    // Cap processing dimensions to max 640x320 for instant, non-blocking trimming
    // (display max-width is 420px, so 640px is razor sharp for Retina/HiDPI screens)
    const scale = Math.min(1, 640 / origW, 320 / origH);
    const w = Math.max(1, Math.round(origW * scale));
    const h = Math.max(1, Math.round(origH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { dataUrl: null, isOpaqueBox: false };

    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    // Check perimeter points (4 corners + 4 edge midpoints) to detect solid rectangular box icons
    const samplePoints: Array<[number, number]> = [
      [2, 2],
      [w - 3, 2],
      [2, h - 3],
      [w - 3, h - 3],
      [Math.floor(w / 2), 2],
      [Math.floor(w / 2), h - 3],
      [2, Math.floor(h / 2)],
      [w - 3, Math.floor(h / 2)],
    ];

    let opaquePerimeterCount = 0;
    for (const [sx, sy] of samplePoints) {
      const cx = Math.max(0, Math.min(w - 1, sx));
      const cy = Math.max(0, Math.min(h - 1, sy));
      const a = data[(cy * w + cx) * 4 + 3];
      if (a > 200) opaquePerimeterCount++;
    }

    // Real ClearLogos have transparent backgrounds around their perimeter.
    if (opaquePerimeterCount >= 6) {
      return { dataUrl: null, isOpaqueBox: true };
    }

    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < h; y++) {
      const rowOffset = y * w * 4;
      for (let x = 0; x < w; x++) {
        const alpha = data[rowOffset + x * 4 + 3];
        if (alpha > 12) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) return { dataUrl: null, isOpaqueBox: true };

    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;

    // If image already fills >96% of its canvas, no need to re-encode
    if (cropW >= w * 0.96 && cropH >= h * 0.96 && minX <= 4 && minY <= 4) {
      return { dataUrl: null, isOpaqueBox: false };
    }

    const out = document.createElement('canvas');
    out.width = cropW;
    out.height = cropH;
    const outCtx = out.getContext('2d');
    if (!outCtx) return { dataUrl: null, isOpaqueBox: false };

    outCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
    return { dataUrl: out.toDataURL('image/png'), isOpaqueBox: false };
  } catch {
    return { dataUrl: null, isOpaqueBox: false };
  }
}

interface TrimmedLogoProps {
  src: string;
  alt: string;
  className?: string;
}

export const TrimmedLogo: React.FC<TrimmedLogoProps> = ({ src, alt, className = '' }) => {
  const [displaySrc, setDisplaySrc] = useState<string>(() => trimmedCache.get(src) || src);
  const [ready, setReady] = useState<boolean>(() => trimmedCache.has(src));
  const [invalid, setInvalid] = useState<boolean>(() => invalidLogoCache.has(src));

  useEffect(() => {
    if (!src) {
      setInvalid(true);
      return;
    }
    if (invalidLogoCache.has(src)) {
      setInvalid(true);
      return;
    }
    const cached = trimmedCache.get(src);
    if (cached) {
      setInvalid(false);
      setDisplaySrc(cached);
      setReady(true);
      return;
    }

    let cancelled = false;
    setReady(false);
    setInvalid(false);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    const proxiedUrl = src.startsWith('http')
      ? `/img-proxy?url=${encodeURIComponent(src)}`
      : src;

    img.onload = () => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        const { dataUrl, isOpaqueBox } = trimTransparentCanvas(img);
        if (isOpaqueBox) {
          invalidLogoCache.add(src);
          setInvalid(true);
          return;
        }
        const finalSrc = dataUrl || src;
        trimmedCache.set(src, finalSrc);
        setDisplaySrc(finalSrc);
        setReady(true);
      });
    };

    img.onerror = () => {
      if (cancelled) return;
      invalidLogoCache.add(src);
      setInvalid(true);
    };

    img.src = proxiedUrl;

    return () => {
      cancelled = true;
    };
  }, [src]);

  if (invalid) {
    return (
      <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black leading-[1.1] tracking-tight text-white mb-4">
        {alt}
      </h2>
    );
  }

  return (
    <img
      src={displaySrc}
      alt={alt}
      decoding="async"
      className={`${className} transition-opacity duration-200 ${ready ? 'opacity-100' : 'opacity-0'}`}
    />
  );
};
