import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import Hls from 'hls.js';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AnimeMedia,
  AnimeEpisode,
  AnimeEpisodesResponse,
  SkipTimes,
  StreamSource,
  SubtitleTrack,
  AnivexaProviderId,
  fetchAnimeDetails,
  fetchAnimeEpisodes,
  fetchAnivexaStreamFromProvider,
  fetchFastestDirectStream,
  fetchSupplementalSubtitles,
  prefetchAnimeStream,
  fetchSkipTimes,
  fetchRecommendationsForAnime,
  getNexusPosterForAnime,
  getNexusBannerForAnime,
  fetchNexusArtForAnime,
} from '../lib/api';
import {
  getContinueWatching,
  saveContinueWatching,
  getEpisodeProgress,
  saveEpisodeProgress,
  getEpisodeThumbnail,
  cacheEpisodeThumbnail,
} from '../lib/storage';
import { LazyImage } from '../components/LazyImage';
import { AnimatedSelect } from '../components/AnimatedSelect';

const BUFFERING_LINES = [
  "Your anime is buffering harder than your ex's excuses.",
  "Summoning the Sakuga gods... please hold on.",
  "Charging Spirit Bomb... please raise your hands.",
  "Expanding Domain: Infinite Stream...",
  "Calibrating ODM gear & subtitles...",
  "Negotiating with the Survey Corps...",
];

const AUDIO_TRACKS = [
  { id: 'sub', label: 'Japanese (Sub)', code: 'ja' },
  { id: 'dub', label: 'English (Dub)', code: 'en' },
  { id: 'hi', label: 'Hindi (Dub)', code: 'hi' },
  { id: 'ar', label: 'Arabic (Sub)', code: 'ar' },
  { id: 'fr', label: 'French (Sub)', code: 'fr' },
  { id: 'ru', label: 'Russian (Sub)', code: 'ru' },
  { id: 'de', label: 'German (Sub)', code: 'de' },
  { id: 'es', label: 'Spanish (Sub)', code: 'es' },
];

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

const QUALITY_OPTIONS = ['Auto', '1080p', '720p', '480p', '360p'];

// Ordered by verified 1080p speed & reliability — the player races the top 1080p providers in parallel
const DIRECT_PROVIDERS: { id: AnivexaProviderId; name: string; tag: string }[] = [
  { id: 'animegg', name: 'AnimeGG', tag: 'Direct MP4' },
  { id: 'anikoto', name: 'AniKoto (1080p)', tag: 'Instant 1080p' },
  { id: 'nexus', name: 'AnimeNexus (1080p)', tag: 'Soft Subs + BD' },
  { id: 'kaa', name: 'KickAssAnime', tag: '1080p / 4K' },
  { id: 'aniwaves', name: 'AniWaves (HD)', tag: 'Fast Mirror' },
  { id: 'animenosub', name: 'AnimeNoSub', tag: 'Sub & Dub' },
  { id: 'anipm', name: 'Ani.pm', tag: 'Direct HLS' },
  { id: 'senshi', name: 'Senshi (HD)', tag: 'Multi-Audio' },
  { id: 'reanime', name: 'ReAnime', tag: 'Fast Direct' },
  { id: 'anizone', name: 'AniZone (HD)', tag: 'Mirror' },
];

const VIDEO_FITS: { id: 'contain' | 'cover' | 'fill'; label: string; desc: string }[] = [
  { id: 'contain', label: 'Contain (Fit)', desc: 'Preserves original aspect ratio' },
  { id: 'cover', label: 'Cover (Fill)', desc: 'Fills screen, crops edges' },
  { id: 'fill', label: 'Stretch', desc: 'Stretches video to fill screen' },
];

/**
 * One consistent control-bar button: identical hit area, icon box, hover + press
 * feedback. Keeps the bar visually even instead of every icon behaving differently.
 */
const ControlButton: React.FC<{
  label: string;
  onClick: () => void;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ label, onClick, active = false, className = '', children }) => (
  <motion.button
    type="button"
    whileTap={{ scale: 0.86 }}
    transition={{ type: 'spring', stiffness: 600, damping: 30 }}
    onClick={onClick}
    aria-label={label}
    title={label}
    className={`group/cb relative grid place-items-center w-10 h-10 rounded-full cursor-pointer outline-none focus:outline-none transition-colors duration-150 ${
      active ? 'text-white hover:bg-white/10' : 'text-white/80 hover:text-white hover:bg-white/10'
    } ${className}`}
  >
    {children}
  </motion.button>
);

export interface StoryboardCue {
  start: number;
  end: number;
  imageUrl: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

export interface SubtitleConfig {
  offset: number; // in seconds (-5.0 to +5.0)
  fontSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  textColor: string;
  fontFamily: 'sans' | 'rounded' | 'mono' | 'serif';
  outline: 'none' | 'subtle' | 'strong' | 'glow' | 'shadow';
  bgOpacity: number; // 0, 35, 60, 85, 100
  rounding: 'none' | 'sm' | 'md' | 'xl' | 'full';
  border: 'none' | 'subtle' | 'glow';
  animation: 'fade' | 'pop' | 'slide' | 'none';
  bottomOffset: 'low' | 'normal' | 'high';
}

const DEFAULT_SUB_CONFIG: SubtitleConfig = {
  offset: 0,
  fontSize: 'md',
  textColor: '#ffffff',
  fontFamily: 'sans',
  outline: 'subtle',
  bgOpacity: 85,
  rounding: 'md',
  border: 'subtle',
  animation: 'fade',
  bottomOffset: 'normal',
};

const SUB_PRESETS: { id: string; name: string; desc: string; config: Partial<SubtitleConfig> }[] = [
  {
    id: 'default',
    name: 'Default Glass',
    desc: 'Frosted dark box with clean white text',
    config: {
      fontSize: 'md',
      textColor: '#ffffff',
      fontFamily: 'sans',
      outline: 'subtle',
      bgOpacity: 85,
      rounding: 'md',
      border: 'subtle',
      animation: 'fade',
    },
  },
  {
    id: 'cinema',
    name: 'Cinema (Netflix)',
    desc: 'No background box, strong black text stroke',
    config: {
      fontSize: 'lg',
      textColor: '#ffffff',
      fontFamily: 'sans',
      outline: 'strong',
      bgOpacity: 0,
      rounding: 'none',
      border: 'none',
      animation: 'fade',
    },
  },
  {
    id: 'animefan',
    name: 'Fansub Yellow',
    desc: 'Vibrant yellow text with bold black stroke',
    config: {
      fontSize: 'lg',
      textColor: '#fef08a',
      fontFamily: 'sans',
      outline: 'strong',
      bgOpacity: 0,
      rounding: 'none',
      border: 'none',
      animation: 'pop',
    },
  },
  {
    id: 'pill',
    name: 'Minimal Pill',
    desc: 'Rounded pill with subtle transparent blur',
    config: {
      fontSize: 'sm',
      textColor: '#ffffff',
      fontFamily: 'rounded',
      outline: 'none',
      bgOpacity: 60,
      rounding: 'full',
      border: 'subtle',
      animation: 'slide',
    },
  },
];

function getSubtitleBoxClasses(cfg: SubtitleConfig) {
  const roundMap = {
    none: 'rounded-none',
    sm: 'rounded-md',
    md: 'rounded-[10px]',
    xl: 'rounded-2xl',
    full: 'rounded-full px-6',
  };
  const borderMap = {
    none: 'border-0',
    subtle: 'border border-white/10',
    glow: 'border border-white/30 shadow-[0_0_15px_rgba(255,255,255,0.2)]',
  };
  const paddingMap = {
    full: 'py-1.5 sm:py-2',
    none: 'px-4 py-1.5 sm:px-5 sm:py-2',
    sm: 'px-4 py-1.5 sm:px-5 sm:py-2',
    md: 'px-4 py-1.5 sm:px-5 sm:py-2',
    xl: 'px-5 py-2 sm:px-6 sm:py-2.5',
  };

  return `${roundMap[cfg.rounding] || 'rounded-[10px]'} ${borderMap[cfg.border] || 'border border-white/10'} ${paddingMap[cfg.rounding] || 'px-4 py-1.5 sm:px-5 sm:py-2'} shadow-lg`;
}

function getSubtitleBoxStyles(cfg: SubtitleConfig): React.CSSProperties {
  if (cfg.bgOpacity === 0) {
    return {
      backgroundColor: 'transparent',
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
      border: 'none',
      boxShadow: 'none',
    };
  }
  return {
    backgroundColor: `rgba(0, 0, 0, ${cfg.bgOpacity / 100})`,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  };
}

function getSubtitleTextClasses(cfg: SubtitleConfig) {
  const sizeMap = {
    xs: 'text-sm sm:text-base',
    sm: 'text-base sm:text-lg',
    md: 'text-base sm:text-lg md:text-xl',
    lg: 'text-lg sm:text-xl md:text-2xl',
    xl: 'text-xl sm:text-2xl md:text-3xl',
  };
  const fontMap = {
    sans: 'font-sans',
    rounded: 'font-sans tracking-wide',
    mono: 'font-mono tracking-tight',
    serif: 'font-serif',
  };

  return `${sizeMap[cfg.fontSize] || sizeMap.md} ${fontMap[cfg.fontFamily] || fontMap.sans}`;
}

function getSubtitleTextStyles(cfg: SubtitleConfig): React.CSSProperties {
  const outlineStyles: Record<string, string> = {
    none: 'none',
    subtle: '0 1px 3px rgba(0,0,0,0.9), 0 2px 6px rgba(0,0,0,0.8)',
    strong: '-1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000, 0 2px 5px rgba(0,0,0,0.9)',
    glow: '0 0 10px rgba(255,255,255,0.8), 0 0 20px rgba(255,255,255,0.4)',
    shadow: '2px 2px 5px rgba(0,0,0,0.9), 4px 4px 10px rgba(0,0,0,0.8)',
  };

  return {
    color: cfg.textColor || '#ffffff',
    textShadow: outlineStyles[cfg.outline] || outlineStyles.subtle,
  };
}

function getSubtitleAnimationProps(anim: SubtitleConfig['animation']) {
  switch (anim) {
    case 'pop':
      return {
        initial: { opacity: 0, scale: 0.92 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.94 },
        transition: { duration: 0.16, ease: [0.16, 1, 0.3, 1] as const },
      };
    case 'slide':
      return {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6 },
        transition: { duration: 0.16, ease: 'easeOut' as const },
      };
    case 'none':
      return {
        initial: false as const,
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0 },
      };
    case 'fade':
    default:
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.15, ease: 'easeOut' as const },
      };
  }
}

function parseTimestampToSeconds(ts: string): number {
  if (!ts) return 0;
  const clean = ts.trim().replace(',', '.');
  const parts = clean.split(':');
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const minutes = parseFloat(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return minutes * 60 + seconds;
  }
  return parseFloat(clean) || 0;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function parseAssCues(assText: string): SubtitleCue[] {
  const lines = assText.split(/\r?\n/);
  const cues: SubtitleCue[] = [];
  let inEvents = false;
  // Column positions come from the [Events] "Format:" line; default to the ASS v4+ standard order.
  let startIdx = 1;
  let endIdx = 2;
  let textIdx = 9;
  let fieldCount = 10;

  for (const rawLine of lines) {
    const line = rawLine.replace(/^\uFEFF/, '').trim();
    if (/^\[events\]/i.test(line)) {
      inEvents = true;
      continue;
    }
    if (inEvents && line.startsWith('[')) {
      inEvents = false;
      continue;
    }
    if (!inEvents) continue;

    if (/^format\s*:/i.test(line)) {
      const cols = line.slice(line.indexOf(':') + 1).split(',').map((c) => c.trim().toLowerCase());
      if (cols.includes('start') && cols.includes('end') && cols.includes('text')) {
        startIdx = cols.indexOf('start');
        endIdx = cols.indexOf('end');
        textIdx = cols.indexOf('text');
        fieldCount = cols.length;
      }
      continue;
    }
    if (!/^dialogue\s*:/i.test(line)) continue;

    const parts = line.slice(line.indexOf(':') + 1).split(',');
    if (parts.length < fieldCount) continue;

    const startSec = parseTimestampToSeconds(parts[startIdx]);
    const endSec = parseTimestampToSeconds(parts[endIdx]);
    const rawText = parts.slice(textIdx).join(',');

    // Skip vector drawing events ({\p1} m 0 0 l ...), they would render as garbage text.
    if (/\{[^}]*\\p[1-9]/.test(rawText)) continue;

    const cleanText = rawText
      .replace(/\{[^}]*\}/g, '')
      .replace(/\\[Nn]/g, '\n')
      .replace(/\\h/gi, ' ')
      .trim();

    if (!cleanText || isNaN(startSec) || isNaN(endSec)) continue;

    cues.push({
      start: startSec,
      end: endSec,
      text: cleanText,
    });
  }

  return cues;
}

function formatVttTimestamp(sec: number): string {
  const safe = Math.max(0, sec);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  const ms = Math.round((safe - Math.floor(safe)) * 1000);
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(Math.min(ms, 999), 3)}`;
}

function cuesToVttBlobUrl(cues: SubtitleCue[]): string {
  const body = cues
    .map((c) => `${formatVttTimestamp(c.start)} --> ${formatVttTimestamp(c.end)}\n${c.text}`)
    .join('\n\n');
  const blob = new Blob([`WEBVTT\n\n${body}\n`], { type: 'text/vtt' });
  return URL.createObjectURL(blob);
}

function parseVttCues(vttText: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const lines = vttText.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.includes('-->')) {
      const times = line.split('-->');
      const start = parseTimestampToSeconds(times[0].trim());
      const end = parseTimestampToSeconds(times[1].trim().split(/\s+/)[0]);
      i++;
      const textLines: string[] = [];
      // Stop at a blank line OR the next timing line (some files omit the blank separator).
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].includes('-->')) {
        textLines.push(lines[i].trim());
        i++;
      }
      const text = decodeHtmlEntities(
        textLines
          .join('\n')
          .replace(/<[^>]+>/g, '')
          .replace(/\{\\[^}]*\}/g, '')
          .trim()
      );
      if (text && !isNaN(start) && !isNaN(end)) {
        cues.push({ start, end, text });
      }
      continue;
    }
    i++;
  }
  return cues;
}

/** Decode subtitle bytes, honouring UTF-16 BOMs (common for fansub .ass/.srt files). */
function decodeSubtitleBytes(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  return new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
}

function buildSubtitleProxyUrl(url: string, referer?: string): string {
  if (url.startsWith('/') || url.startsWith('blob:') || url.startsWith('data:') || url.includes('/hls-proxy')) {
    return url;
  }
  return `/hls-proxy?url=${encodeURIComponent(url)}${referer ? `&referer=${encodeURIComponent(referer)}` : ''}`;
}

/**
 * Fetch a subtitle file through the proxy. Tries each referer candidate in turn (CDNs differ in
 * which origin they accept), and unwraps HLS subtitle playlists (.m3u8 → WebVTT segments).
 */
async function fetchSubtitleText(
  url: string,
  referers: (string | undefined)[],
  signal: AbortSignal
): Promise<{ text: string; playableUrl: string } | null> {
  const tried = new Set<string>();
  for (const ref of referers) {
    const proxied = buildSubtitleProxyUrl(url, ref);
    if (tried.has(proxied)) continue;
    tried.add(proxied);
    try {
      const res = await fetch(proxied, { signal });
      if (!res.ok) continue;
      const text = decodeSubtitleBytes(await res.arrayBuffer());
      if (!text.trim()) continue;

      if (text.trimStart().startsWith('#EXTM3U')) {
        // Subtitle playlist: the proxy has already rewritten segment URIs to /hls-proxy links.
        const segmentUrls = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith('#'));
        const segments = await Promise.all(
          segmentUrls.map((segUrl) =>
            fetch(segUrl, { signal })
              .then((r) => (r.ok ? r.arrayBuffer() : null))
              .then((b) => (b ? decodeSubtitleBytes(b) : ''))
              .catch(() => '')
          )
        );
        const merged = segments.join('\n\n');
        if (merged.trim()) return { text: merged, playableUrl: '' };
        continue;
      }

      return { text, playableUrl: proxied };
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err;
    }
  }
  return null;
}

/** Find the track the user asked for, falling back to the best English/default track. */
function rankSubtitleTracks(
  subs: SubtitleTrack[],
  selected: string,
  preferredLang: string | null
): SubtitleTrack[] {
  const isEnglish = (s: SubtitleTrack) =>
    /^en\b/i.test(s.lang || '') || /english/i.test(s.label || '');
  const isSignsOnly = (s: SubtitleTrack) => /sign|song|forced/i.test(s.label || '');

  const ordered: SubtitleTrack[] = [];
  const push = (s?: SubtitleTrack) => {
    if (s && s.url && !ordered.includes(s)) ordered.push(s);
  };

  if (selected !== 'default') {
    push(subs.find((s) => s.label === selected));
    // Label didn't exist on this source (e.g. after switching provider) → match the same language.
    if (preferredLang) push(subs.find((s) => s.lang === preferredLang && !isSignsOnly(s)));
  }
  push(subs.find((s) => s.default && isEnglish(s) && !isSignsOnly(s)));
  push(subs.find((s) => isEnglish(s) && !isSignsOnly(s)));
  push(subs.find((s) => s.default && !isSignsOnly(s)));
  subs.filter((s) => isEnglish(s)).forEach(push);
  subs.forEach(push);
  return ordered;
}

function parseStoryboardVtt(vttText: string, baseVttUrl: string): StoryboardCue[] {
  const cues: StoryboardCue[] = [];
  const lines = vttText.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.includes('-->')) {
      const times = line.split('-->');
      const start = parseTimestampToSeconds(times[0].trim());
      const end = parseTimestampToSeconds(times[1].trim().split(' ')[0]);
      i++;
      let payload = '';
      while (i < lines.length && lines[i].trim() !== '') {
        if (!payload) payload = lines[i].trim();
        i++;
      }
      if (payload && !isNaN(start) && !isNaN(end)) {
        const [rawUrlPart, hashPart] = payload.split('#xywh=');
        let resolvedUrl = rawUrlPart.trim();
        try {
          if (baseVttUrl && !resolvedUrl.startsWith('http') && !resolvedUrl.startsWith('/')) {
            resolvedUrl = new URL(resolvedUrl, baseVttUrl).href;
          }
        } catch {
          // ignore
        }
        if (
          resolvedUrl.includes('emeralddrift') ||
          resolvedUrl.includes('mgstatics') ||
          resolvedUrl.includes('nexabloom') ||
          resolvedUrl.includes('midnightvale') ||
          resolvedUrl.includes('megaplay')
        ) {
          resolvedUrl = `/hls-proxy?url=${encodeURIComponent(resolvedUrl)}&referer=${encodeURIComponent('https://megaplay.buzz/')}`;
        }

        let x: number | undefined;
        let y: number | undefined;
        let w: number | undefined;
        let h: number | undefined;
        if (hashPart) {
          const coords = hashPart.split(',').map((n) => parseFloat(n.trim()));
          if (coords.length === 4 && coords.every((n) => Number.isFinite(n))) {
            [x, y, w, h] = coords;
          }
        }
        cues.push({ start, end, imageUrl: resolvedUrl, x, y, w, h });
      }
    }
    i++;
  }
  return cues;
}

function getStoredBool(key: string, defVal: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? v === 'true' : defVal;
  } catch {
    return defVal;
  }
}

function getStoredNum(key: string, defVal: number): number {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? Number(v) : defVal;
  } catch {
    return defVal;
  }
}

function getContentAdvisory(anime?: AnimeMedia | null): { rating: string; advisory: string } {
  if (!anime) {
    return {
      rating: 'Rated R',
      advisory: 'Drug Use, Smoking Visuals, Coarse Language, Disturbing Scenes, Graphic Violence',
    };
  }
  const genres = (anime.genres || []).map((g) => g.toLowerCase());
  const isMature = anime.mature || (anime.rating && Number(anime.rating) >= 8.4);
  const isHorror = genres.includes('horror') || genres.includes('psychological');
  const isAction = genres.includes('action') || genres.includes('supernatural');

  let rating = 'TV-14';
  if (isMature && isHorror) rating = 'Rated R';
  else if (isMature) rating = 'TV-MA';
  else if (!isAction) rating = 'PG-13';

  const items = ['Drug Use', 'Smoking Visuals', 'Coarse Language', 'Disturbing Scenes', 'Graphic Violence'];
  return {
    rating,
    advisory: items.join(', '),
  };
}

// Minimalist Toggle Switch matching Kotatsu aesthetic with spring physics
const ToggleSwitch: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({
  checked,
  onChange,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={(e) => {
      e.stopPropagation();
      onChange(!checked);
    }}
    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
      checked ? 'bg-white' : 'bg-white/15'
    }`}
  >
    <motion.span
      layout
      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
      className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full shadow-sm mt-[3px] ml-[3px] ${
        checked ? 'translate-x-4 !bg-[#141519]' : 'translate-x-0 !bg-white'
      }`}
    />
  </button>
);

export const Watch: React.FC = () => {
  const params = useParams<{ id: string; season?: string; ep?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state as
    | { title?: string; poster?: string | null; backdrop?: string | null; anime?: AnimeMedia }
    | undefined;

  const animeId = params.id || '';
  const episodeNum = Number(params.ep || params.season || 1);
  const initialMode = (searchParams.get('mode') as 'sub' | 'dub') || 'sub';

  const [anime, setAnime] = useState<AnimeMedia | null>(navState?.anime || null);
  const [episodes, setEpisodes] = useState<AnimeEpisode[]>([]);
  const [recommendations, setRecommendations] = useState<AnimeMedia[]>([]);

  // Direct Streaming & Settings States
  const [audioMode, setAudioMode] = useState<string>(initialMode === 'dub' ? 'dub' : 'sub');
  const [selectedProvider, setSelectedProvider] = useState<AnivexaProviderId>(DIRECT_PROVIDERS[0].id);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [activeQuality, setActiveQuality] = useState<string>('1080p');
  const [videoFit, setVideoFit] = useState<'contain' | 'cover' | 'fill'>('contain');
  const [selectedSubtitle, setSelectedSubtitle] = useState<string>('default');

  // Subtitles parsing & live display
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [currentSubtitleText, setCurrentSubtitleText] = useState<string>('');
  const [vttTrackUrl, setVttTrackUrl] = useState<string | null>(null);
  // URL of the track actually loaded (labels can repeat, so the menu highlights by URL)
  const [loadedSubtitleUrl, setLoadedSubtitleUrl] = useState<string | null>(null);
  // Language of the user's explicit pick, so it carries over when a new source labels tracks differently
  const preferredSubLangRef = useRef<string | null>(null);

  // Persistent user preferences
  const [autoPlay, setAutoPlay] = useState<boolean>(() => getStoredBool('kotatsu_autoplay', true));
  const [autoNext, setAutoNext] = useState<boolean>(() => getStoredBool('kotatsu_autonext', true));
  const [autoSkip, setAutoSkip] = useState<boolean>(() => getStoredBool('kotatsu_autoskip', true));
  const [ambientMode, setAmbientMode] = useState<boolean>(() => getStoredBool('kotatsu_ambient', true));
  const [miniplayer, setMiniplayer] = useState<boolean>(() => getStoredBool('kotatsu_miniplayer', false));
  const [audioBoost, setAudioBoost] = useState<number>(() => getStoredNum('kotatsu_audioboost', 100));

  // Subtitles custom styling & timing preferences
  const [subConfig, setSubConfig] = useState<SubtitleConfig>(() => {
    try {
      const saved = localStorage.getItem('kotatsu_sub_config');
      if (saved) return { ...DEFAULT_SUB_CONFIG, ...JSON.parse(saved) };
    } catch {
      // ignore
    }
    return DEFAULT_SUB_CONFIG;
  });

  const updateSubConfig = (updates: Partial<SubtitleConfig>) => {
    setSubConfig((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem('kotatsu_sub_config', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Settings popover views & animation direction
  type SettingsView =
    | 'main'
    | 'more'
    | 'audio'
    | 'speed'
    | 'subtitles'
    | 'subtitles-style'
    | 'quality'
    | 'server'
    | 'fit';
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState<SettingsView>('main');
  const [menuDirection, setMenuDirection] = useState<number>(1);

  // Stream state (DIRECT ONLY)
  const [activeSource, setActiveSource] = useState<StreamSource | null>(null);
  const [loadingStream, setLoadingStream] = useState(true);
  const [streamError, setStreamError] = useState(false);
  const [activeProviderIndex, setActiveProviderIndex] = useState(0);
  const [wittyIndex, setWittyIndex] = useState(0);
  const [skipTimes, setSkipTimes] = useState<SkipTimes>({});
  const [autoSkipToast, setAutoSkipToast] = useState<{
    label: string;
    fromTime: number;
    toTime: number;
  } | null>(null);
  const [upNextDismissed, setUpNextDismissed] = useState(false);

  // Player state
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [playing, setPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiPActive, setIsPiPActive] = useState(false);

  // Controls Lock State
  const [isControlsLocked, setIsControlsLocked] = useState(false);
  const [lockToast, setLockToast] = useState<'locked' | 'unlocked' | null>(null);

  // Hold for 2x Speed State
  const [isSpeedBoosted, setIsSpeedBoosted] = useState(false);
  const speedHoldTimerRef = useRef<any>(null);
  const preBoostSpeedRef = useRef<number>(1);
  const justBoostedRef = useRef<boolean>(false);
  const spaceHoldTimerRef = useRef<any>(null);
  const spaceBoostedRef = useRef<boolean>(false);

  // Timeline scrubber hover preview & Storyboard VTT cues
  const [showHoverTime, setShowHoverTime] = useState(false);
  const [hoverTime, setHoverTime] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [storyboardCues, setStoryboardCues] = useState<StoryboardCue[]>([]);
  const scrubberBarRef = useRef<HTMLDivElement | null>(null);
  const thumbPreviewBoxRef = useRef<HTMLDivElement | null>(null);
  const timePillBoxRef = useRef<HTMLDivElement | null>(null);
  const hoverTrackFillRef = useRef<HTMLDivElement | null>(null);
  const hoverTargetPctRef = useRef<number>(0);
  const hoverCurrentPctRef = useRef<number>(0);
  const hoverSnappedRef = useRef<boolean>(false);

  const applyScrubberDomPosition = useCallback((pct: number) => {
    const barEl = scrubberBarRef.current;
    const barW = barEl ? barEl.clientWidth : 0;
    const rawX = pct * barW;

    if (thumbPreviewBoxRef.current && barW > 0) {
      const halfThumb = 100; // 200px / 2
      const clampedThumbX =
        barW > halfThumb * 2
          ? Math.max(halfThumb, Math.min(barW - halfThumb, rawX))
          : rawX;
      thumbPreviewBoxRef.current.style.transform = `translate3d(calc(${clampedThumbX.toFixed(2)}px - 50%), 0, 0)`;
    }

    if (timePillBoxRef.current && barW > 0) {
      const halfPill = 24;
      const clampedPillX =
        barW > halfPill * 2
          ? Math.max(halfPill, Math.min(barW - halfPill, rawX))
          : rawX;
      timePillBoxRef.current.style.transform = `translate3d(calc(${clampedPillX.toFixed(2)}px - 50%), 0, 0)`;
    }

    if (hoverTrackFillRef.current) {
      hoverTrackFillRef.current.style.transform = `scaleX(${Math.max(0, Math.min(1, pct)).toFixed(4)})`;
    }
  }, []);

  // 120fps GPU-composited smoothing loop for scrubber thumbnail & timestamp pill
  useEffect(() => {
    if (!showHoverTime) return;
    applyScrubberDomPosition(hoverCurrentPctRef.current);

    let lastTs = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;
      const target = hoverTargetPctRef.current;
      const cur = hoverCurrentPctRef.current;
      const diff = target - cur;

      if (Math.abs(diff) > 0.00005) {
        // Critically-damped exponential interpolation: glides smoothly with zero velocity-reset lag
        const alpha = 1 - Math.exp(-34 * dt);
        hoverCurrentPctRef.current = cur + diff * alpha;
      } else {
        hoverCurrentPctRef.current = target;
      }

      applyScrubberDomPosition(hoverCurrentPctRef.current);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [showHoverTime, applyScrubberDomPosition]);

  // Web Audio API refs for Audio Boost
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Overlays: More Like This Sheet & Right-Side Episodes Drawer
  const [showControls, setShowControls] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const [episodesSidebarOpen, setEpisodesSidebarOpen] = useState(false);
  const [sidebarSeason, setSidebarSeason] = useState<number>(
    params.season ? parseInt(params.season, 10) || 1 : 1
  );
  const [sidebarEpisodes, setSidebarEpisodes] = useState<AnimeEpisode[]>([]);
  const [loadingSidebarEpisodes, setLoadingSidebarEpisodes] = useState(false);
  const [epSearchQuery, setEpSearchQuery] = useState('');
  const [sidebarFocusIdx, setSidebarFocusIdx] = useState(0);
  const wheelAccumRef = useRef(0);
  const wheelLockRef = useRef(0);
  const touchYRef = useRef<number | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'play' | 'pause' | 'fwd' | 'rwd';
    id: number;
  } | null>(null);
  const activeEpItemRef = useRef<HTMLDivElement | null>(null);
  void activeEpItemRef;

  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoSkipRef = useRef<number>(0);
  const moreScrollRef = useRef<HTMLDivElement | null>(null);
  const [nexusArtMap, setNexusArtMap] = useState<Record<string, string>>({});
  const hasRestoredProgressRef = useRef<string>('');
  const lastProgressSaveRef = useRef<number>(0);
  const currentAttachedStreamRef = useRef<string>('');

  // Reset restored flag & stream tracking whenever anime or episode changes
  useEffect(() => {
    hasRestoredProgressRef.current = '';
    currentAttachedStreamRef.current = '';
    setCurrentTime(0);
  }, [animeId, episodeNum]);

  // Robust saved progress lookup across episode progress and continue watching entries
  const getSavedProgressTime = useCallback(
    (explicitTime?: number): number => {
      if (typeof explicitTime === 'number' && explicitTime > 2) {
        return explicitTime;
      }
      if (!animeId) return 0;
      const allFranchiseIds = new Set<string>();
      allFranchiseIds.add(String(animeId));
      if (anime?.id) allFranchiseIds.add(String(anime.id));
      if (anime?.seasons) {
        for (const s of anime.seasons) {
          if (s.anilistId) allFranchiseIds.add(String(s.anilistId));
        }
      }

      const savedEp =
        getEpisodeProgress(animeId, episodeNum) ||
        (anime?.id ? getEpisodeProgress(anime.id, episodeNum) : null);

      const savedCw = getContinueWatching().find(
        (x) => allFranchiseIds.has(String(x.id)) && Number(x.episode) === Number(episodeNum)
      );

      const savedTime = savedEp?.currentTime || savedCw?.currentTime || 0;
      const dur = savedEp?.duration || savedCw?.duration || 1440;
      if (savedTime > 3 && savedTime < dur - 15) {
        return savedTime;
      }
      return 0;
    },
    [animeId, episodeNum, anime]
  );

  // Restore saved timestamp when video metadata / manifest is ready
  const restoreSavedProgress = useCallback(
    (video: HTMLVideoElement, explicitTime?: number) => {
      if (!animeId) return;
      const key = `${animeId}-${episodeNum}`;
      const savedTime = getSavedProgressTime(explicitTime);

      if (savedTime <= 3) {
        hasRestoredProgressRef.current = key;
        return;
      }

      const applySeek = () => {
        try {
          if (Math.abs(video.currentTime - savedTime) > 2) {
            video.currentTime = savedTime;
          }
          setCurrentTime(savedTime);
          hasRestoredProgressRef.current = key;
        } catch {
          // ignore if seek not ready yet
        }
      };

      if (video.readyState >= 1) {
        applySeek();
      } else {
        setCurrentTime(savedTime);
        const onReady = () => {
          applySeek();
          video.removeEventListener('loadedmetadata', onReady);
          video.removeEventListener('loadeddata', onReady);
          video.removeEventListener('canplay', onReady);
        };
        video.addEventListener('loadedmetadata', onReady, { once: true });
        video.addEventListener('loadeddata', onReady, { once: true });
        video.addEventListener('canplay', onReady, { once: true });
      }
    },
    [animeId, episodeNum, getSavedProgressTime]
  );

  // Throttled progress persistence (saves exact currentTime, duration & % both per-episode and to Continue Watching)
  const persistProgress = useCallback(
    (t: number, d: number, force = false) => {
      if (!animeId || !Number.isFinite(t) || t < 2) return;
      const key = `${animeId}-${episodeNum}`;

      // GUARD: If we haven't finished restoring saved progress for this episode yet,
      // do NOT let initial startup 0:00-0:02 playback ticks wipe out a saved position!
      const targetSaved = getSavedProgressTime();
      if (hasRestoredProgressRef.current !== key && targetSaved > 3 && t < targetSaved - 10) {
        return;
      }
      hasRestoredProgressRef.current = key;

      const now = Date.now();
      if (!force && now - lastProgressSaveRef.current < 2500) return;
      lastProgressSaveRef.current = now;

      const validDur = Number.isFinite(d) && d > 0 ? d : 1440;
      const pct = Math.max(2, Math.min(100, Math.round((t / validDur) * 100)));
      saveEpisodeProgress(animeId, episodeNum, t, validDur);
      if (anime?.id && String(anime.id) !== String(animeId)) {
        saveEpisodeProgress(anime.id, episodeNum, t, validDur);
      }

      const currentEpObj = episodes.find((e) => e.episode === episodeNum);
      const epStill =
        currentEpObj?.still ||
        getEpisodeThumbnail(animeId, episodeNum) ||
        (anime?.id ? getEpisodeThumbnail(anime.id, episodeNum) : null) ||
        anime?.backdrop ||
        null;
      const matchedSeason = anime?.seasons?.find(
        (s) => String(s.anilistId) === String(animeId)
      );

      saveContinueWatching({
        id: anime?.id || animeId,
        type: 'anime',
        title: anime?.title || navState?.title || navState?.anime?.title || 'Anime',
        poster: anime?.poster || navState?.poster || null,
        backdrop: anime?.backdrop || navState?.backdrop || null,
        still: epStill,
        season: matchedSeason
          ? matchedSeason.season
          : params.season
            ? parseInt(params.season, 10) || 1
            : 1,
        episode: episodeNum,
        episodeTitle: currentEpObj?.title || `Episode ${episodeNum}`,
        progress: pct,
        currentTime: Math.floor(t),
        duration: Math.floor(validDur),
      });
    },
    [animeId, episodeNum, episodes, anime, navState, params.season, getSavedProgressTime]
  );

  // Flush exact progress on tab close / page unload
  useEffect(() => {
    const flush = () => {
      const v = videoRef.current;
      if (v && v.currentTime > 2) {
        persistProgress(v.currentTime, v.duration || duration || 1440, true);
      }
    };
    window.addEventListener('beforeunload', flush);
    return () => {
      flush();
      window.removeEventListener('beforeunload', flush);
    };
  }, [persistProgress, duration]);

  // Dynamically enrich recommendations with high-res 16:9 AnimeNexus artwork
  useEffect(() => {
    if (!recommendations.length) return;
    let cancelled = false;
    recommendations.slice(0, 15).forEach((item) => {
      const existing = getNexusBannerForAnime(item.title, item.id);
      if (existing) {
        setNexusArtMap((prev) =>
          prev[String(item.id)] === existing ? prev : { ...prev, [String(item.id)]: existing }
        );
        return;
      }
      fetchNexusArtForAnime(item.title, item.id)
        .then((art) => {
          if (cancelled) return;
          const best = art.banner || art.poster;
          if (best) {
            setNexusArtMap((prev) => ({ ...prev, [String(item.id)]: best }));
          }
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [recommendations]);

  // Save preferences to localStorage
  useEffect(() => {
    localStorage.setItem('kotatsu_autoplay', String(autoPlay));
  }, [autoPlay]);

  useEffect(() => {
    localStorage.setItem('kotatsu_autonext', String(autoNext));
  }, [autoNext]);

  useEffect(() => {
    localStorage.setItem('kotatsu_autoskip', String(autoSkip));
  }, [autoSkip]);

  useEffect(() => {
    localStorage.setItem('kotatsu_ambient', String(ambientMode));
  }, [ambientMode]);

  useEffect(() => {
    localStorage.setItem('kotatsu_miniplayer', String(miniplayer));
  }, [miniplayer]);

  useEffect(() => {
    localStorage.setItem('kotatsu_audioboost', String(audioBoost));
  }, [audioBoost]);

  // Rotate witty lines during loading
  useEffect(() => {
    if (!loadingStream) return;
    const t = setInterval(() => {
      setWittyIndex((i) => (i + 1) % BUFFERING_LINES.length);
    }, 2800);
    return () => clearInterval(t);
  }, [loadingStream]);

  // Fetch anime details, episodes, and recommendations
  useEffect(() => {
    if (!animeId) return;
    let cancelled = false;
    setUpNextDismissed(false);
    setStoryboardCues([]);

    (async () => {
      try {
        const chunk = Math.ceil(episodeNum / 100) || 1;
        // Details gate the stream lookup — resolve them first so playback starts ASAP.
        // Episodes & recommendations load in parallel and never block the player.
        const epPromise = fetchAnimeEpisodes(animeId, chunk).catch(
          () => ({ episodes: [] as AnimeEpisode[] }) as Pick<AnimeEpisodesResponse, 'episodes'>
        );
        fetchRecommendationsForAnime(animeId)
          .then((r) => {
            if (!cancelled) setRecommendations(r.items || []);
          })
          .catch(() => {});

        const details = await fetchAnimeDetails(animeId);
        if (cancelled) return;
        setAnime(details);

        const matchedSeason = details.seasons?.find(
          (s) => String(s.anilistId) === String(animeId)
        );
        const resolvedSeason = matchedSeason
          ? matchedSeason.season
          : params.season
            ? parseInt(params.season, 10) || 1
            : 1;
        setSidebarSeason(resolvedSeason);

        const epRes = await epPromise;
        if (cancelled) return;
        setEpisodes(epRes.episodes || []);
        setSidebarEpisodes(epRes.episodes || []);

        const currentEpObj = (epRes.episodes || []).find((e) => e.episode === episodeNum);
        const epStill = currentEpObj?.still || getEpisodeThumbnail(details.id, episodeNum) || null;

        if (epStill) {
          cacheEpisodeThumbnail(details.id, episodeNum, epStill);
        }

        const savedEp =
          getEpisodeProgress(details.id, episodeNum) ||
          getEpisodeProgress(animeId, episodeNum);
        const savedCw = getContinueWatching().find(
          (x) =>
            (String(x.id) === String(details.id) || String(x.id) === String(animeId)) &&
            Number(x.episode) === Number(episodeNum)
        );
        const resolvedTime = savedEp?.currentTime || savedCw?.currentTime || 0;
        const resolvedDur = savedEp?.duration || savedCw?.duration || 1440;
        const resolvedProg =
          savedEp?.progress ||
          savedCw?.progress ||
          (resolvedTime > 0 ? Math.round((resolvedTime / resolvedDur) * 100) : 5);

        saveContinueWatching({
          id: details.id,
          type: 'anime',
          title: details.title,
          poster: details.poster,
          backdrop: details.backdrop,
          still: epStill,
          season: matchedSeason
          ? matchedSeason.season
          : params.season
            ? parseInt(params.season, 10) || 1
            : 1,
          episode: episodeNum,
          episodeTitle: currentEpObj?.title || `Episode ${episodeNum}`,
          progress: resolvedProg,
          currentTime: resolvedTime,
          duration: resolvedDur,
        });

        if (details.idMal) {
          fetchSkipTimes(details.idMal, episodeNum).then((sk) => {
            if (!cancelled) {
              setSkipTimes((prev) => ({
                intro: sk.intro || prev.intro,
                outro: sk.outro || prev.outro,
              }));
            }
          });
        }
      } catch {
        // Details lookup is non-fatal for direct stream resolution
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [animeId, episodeNum]);

  // Build provider cascade order based on user's selected provider
  const providersOrder: AnivexaProviderId[] = [
    selectedProvider,
    ...DIRECT_PROVIDERS.map((p) => p.id).filter((p) => p !== selectedProvider),
  ];

  // Load DIRECT 1080p stream immediately at 0ms (without waiting on fetchAnimeDetails)
  useEffect(() => {
    if (!animeId) return;
    let cancelled = false;
    setLoadingStream(true);
    setStreamError(false);

    (async () => {
      try {
        const targetAudio: 'sub' | 'dub' = audioMode === 'dub' ? 'dub' : 'sub';
        const fallbackTitle = anime?.title || navState?.title || navState?.anime?.title;

        let source: StreamSource | null = null;
        const provider = providersOrder[activeProviderIndex] || DIRECT_PROVIDERS[0].id;

        source = await fetchAnivexaStreamFromProvider(
          provider,
          animeId,
          targetAudio,
          episodeNum,
          fallbackTitle
        );

        if (!source && activeProviderIndex === 0 && !cancelled) {
          source = await fetchFastestDirectStream(
            animeId,
            targetAudio,
            episodeNum,
            selectedProvider,
            fallbackTitle
          );
        }

        if (cancelled) return;

        // ONLY allow direct streams (type hls or mp4, with valid url, NOT embed)
        if (source && source.url && source.type !== 'embed') {
          setActiveSource(source);
          setLoadingStream(false);
          setStreamError(false);

          // Apply provider-supplied intro/outro timestamps immediately if AniSkip hasn't populated them yet
          if (source.intro || source.outro) {
            setSkipTimes((prev) => ({
              intro: prev.intro || source?.intro,
              outro: prev.outro || source?.outro,
            }));
          }

          // Silently prefetch next episode stream in the background
          prefetchAnimeStream(animeId, episodeNum + 1, targetAudio, fallbackTitle);
        } else {
          // If this provider returned empty or embed-only, cascade to next direct provider
          if (activeProviderIndex + 1 < providersOrder.length) {
            setActiveProviderIndex((i) => i + 1);
          } else {
            setLoadingStream(false);
            setStreamError(true);
          }
        }
      } catch {
        if (!cancelled) {
          if (activeProviderIndex + 1 < providersOrder.length) {
            setActiveProviderIndex((i) => i + 1);
          } else {
            setLoadingStream(false);
            setStreamError(true);
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [animeId, episodeNum, audioMode, selectedProvider, activeProviderIndex]);

  // Helper to get proxied stream URL for direct HLS/MP4 playback without CORS or hotlink issues
  const getPlayableStreamUrl = (source: StreamSource | null): string => {
    if (!source || !source.url) return '';
    if (source.url.startsWith('/') || source.url.includes('/hls-proxy')) return source.url;
    if (source.type === 'hls' || source.url.includes('.m3u8')) {
      // Prefer the referer the provider told us the CDN expects
      let referer = source.referer || 'https://megaplay.buzz/';
      if (!source.referer) {
        if (source.provider === 'reanime' || source.url.includes('flixcloud')) referer = 'https://flixcloud.cc/';
        else if (source.provider === 'kaa' || source.url.includes('krussdomi')) referer = 'https://krussdomi.com/';
        else if (source.provider === 'senshi' || source.url.includes('anidap')) referer = 'https://senshi.to/';
        else if (source.provider === 'anizone') referer = 'https://anizone.to/';
      }
      return `/hls-proxy?url=${encodeURIComponent(source.url)}&referer=${encodeURIComponent(referer)}`;
    }
    if (source.type === 'mp4' && (source.referer || source.provider === 'animegg' || source.url.includes('animegg'))) {
      const referer = source.referer || 'https://www.animegg.org/';
      return `/hls-proxy?url=${encodeURIComponent(source.url)}&referer=${encodeURIComponent(referer)}`;
    }
    return source.url;
  };

  // Setup HLS.js for DIRECT 1080p video playback
  useEffect(() => {
    if (!activeSource || !activeSource.url) return;
    const video = videoRef.current;
    if (!video) return;

    const streamUrl = getPlayableStreamUrl(activeSource);

    // CRITICAL FIX: If this exact media stream URL is already playing (e.g. background
    // subtitles from AniKoto or Nexus were merged into activeSource), DO NOT destroy
    // the running player or reload the video from 0:00!
    if (
      currentAttachedStreamRef.current === streamUrl &&
      (hlsRef.current || (video.src && video.src.includes(encodeURIComponent(activeSource.url))))
    ) {
      return;
    }

    // If stream URL is changing but video was already playing, carry forward current timestamp
    const resumeTime = video.currentTime > 2 ? video.currentTime : getSavedProgressTime();
    currentAttachedStreamRef.current = streamUrl;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (activeSource.type === 'mp4' || streamUrl.includes('.mp4')) {
      video.removeAttribute('crossOrigin');
      video.src = streamUrl;
      video.load();
      video.playbackRate = playbackSpeed;
      restoreSavedProgress(video, resumeTime);
      if (autoPlay) {
        video.play().catch(() => setPlaying(false));
      }
      return;
    }

    video.crossOrigin = 'anonymous';

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        startFragPrefetch: true,
        abrEwmaDefaultEstimate: 25_000_000, // 25 Mbps initial estimate so segment 0 starts at 1080p immediately
        capLevelToPlayerSize: false,
        startPosition: resumeTime > 3 ? resumeTime : -1,
      });
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        // Lock to 1080p level immediately so the user never sees a blurry 360p/480p startup segment
        const levels = data.levels || hls.levels || [];
        if (levels.length > 0 && activeQuality !== 'Auto') {
          const targetHeight = parseInt(activeQuality, 10) || 1080;
          let idx = levels.findIndex((l) => l.height === targetHeight);
          if (idx === -1) {
            idx = levels.findIndex((l) => l.height >= 1080);
          }
          if (idx === -1) {
            // Pick highest resolution available
            let maxH = -1;
            levels.forEach((l, i) => {
              if (l.height > maxH) {
                maxH = l.height;
                idx = i;
              }
            });
          }
          if (idx !== -1) {
            hls.startLevel = idx;
            hls.currentLevel = idx;
            hls.nextLevel = idx;
          }
        }
        video.playbackRate = playbackSpeed;
        restoreSavedProgress(video, resumeTime);
        if (autoPlay) {
          video.play().catch(() => setPlaying(false));
        }
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          hls.destroy();
          currentAttachedStreamRef.current = '';
          if (activeProviderIndex + 1 < providersOrder.length) {
            setActiveProviderIndex((i) => i + 1);
          } else {
            setLoadingStream(false);
            setStreamError(true);
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.playbackRate = playbackSpeed;
      restoreSavedProgress(video, resumeTime);
      if (autoPlay) {
        video.play().catch(() => setPlaying(false));
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      currentAttachedStreamRef.current = '';
    };
  }, [activeSource, autoPlay, activeProviderIndex, getSavedProgressTime, restoreSavedProgress, playbackSpeed, activeQuality]);

  // Load and parse Subtitles whenever activeSource or selectedSubtitle changes
  const [externalSubsFailed, setExternalSubsFailed] = useState(false);
  useEffect(() => {
    // Always drop the previous episode/source cues first so stale lines never linger
    setSubtitleCues([]);
    setCurrentSubtitleText('');
    setVttTrackUrl(null);
    setLoadedSubtitleUrl(null);
    setExternalSubsFailed(false);

    if (!activeSource || selectedSubtitle === 'off') return;

    const subs = activeSource.subtitles || [];
    if (!subs.length) return; // in-manifest subtitles are handled by the effect below

    const candidates = rankSubtitleTracks(subs, selectedSubtitle, preferredSubLangRef.current);
    // If the user picked a specific track, only fall back to others when it fails to load.
    const embedOrigin = (() => {
      try {
        return activeSource.embedUrl ? `${new URL(activeSource.embedUrl).origin}/` : undefined;
      } catch {
        return undefined;
      }
    })();

    const controller = new AbortController();
    let createdBlobUrl: string | null = null;

    (async () => {
      for (const track of candidates) {
        try {
          // CDNs disagree on which referer they accept: track-specific → stream → embed host → none
          const result = await fetchSubtitleText(
            track.url,
            [track.referer, activeSource.referer, embedOrigin, undefined],
            controller.signal
          );
          if (controller.signal.aborted) return;
          if (!result) continue;

          const { text, playableUrl } = result;
          const isAss =
            /\[script info\]|\[events\]/i.test(text) || track.format === 'ass' || track.format === 'ssa';
          const cues = (isAss ? parseAssCues(text) : parseVttCues(text)).sort((a, b) => a.start - b.start);
          if (!cues.length) continue; // empty/unsupported file → try the next track

          let trackUrl = playableUrl;
          if (isAss || !playableUrl) {
            createdBlobUrl = cuesToVttBlobUrl(cues);
            trackUrl = createdBlobUrl;
          }

          setSubtitleCues(cues);
          setVttTrackUrl(trackUrl);
          setLoadedSubtitleUrl(track.url);
          return;
        } catch (err) {
          if ((err as Error)?.name === 'AbortError') return;
          console.warn('Subtitle load error:', track.label, err);
        }
      }
      if (!controller.signal.aborted) {
        console.warn('No subtitle track could be loaded for', activeSource.provider);
        setExternalSubsFailed(true);
      }
    })();

    return () => {
      controller.abort();
      if (createdBlobUrl) URL.revokeObjectURL(createdBlobUrl);
    };
  }, [activeSource, selectedSubtitle]);

  // Fallback: subtitles muxed into the HLS manifest (#EXT-X-MEDIA TYPE=SUBTITLES) or in-band captions.
  // Some sources ship no external track list at all, so read cues from the video's text tracks instead.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeSource || selectedSubtitle === 'off') return;
    const hasExternal = (activeSource.subtitles || []).length > 0;
    if (hasExternal && !externalSubsFailed) return;

    let boundTrack: TextTrack | null = null;

    const syncCues = () => {
      const list = boundTrack?.cues;
      if (!list) return;
      const next: SubtitleCue[] = [];
      for (let i = 0; i < list.length; i++) {
        const cue = list[i] as VTTCue;
        const text = decodeHtmlEntities((cue.text || '').replace(/<[^>]+>/g, '').trim());
        if (text) next.push({ start: cue.startTime, end: cue.endTime, text });
      }
      setSubtitleCues((prev) => (prev.length === next.length ? prev : next));
    };

    const bindBestTrack = () => {
      const tracks = Array.from(video.textTracks).filter(
        (t) => (t.kind === 'subtitles' || t.kind === 'captions') && t.label !== 'metadata'
      );
      if (!tracks.length) return;
      const target =
        tracks.find((t) => /^en/i.test(t.language) || /english/i.test(t.label)) || tracks[0];
      if (target === boundTrack) return;
      boundTrack?.removeEventListener('cuechange', syncCues);
      boundTrack = target;
      tracks.forEach((t) => {
        if (t !== target) t.mode = 'disabled';
      });
      // 'hidden' makes hls.js / Safari load the cues without native rendering (we draw our own)
      target.mode = 'hidden';
      target.addEventListener('cuechange', syncCues);
      syncCues();
    };

    bindBestTrack();
    video.textTracks.addEventListener('addtrack', bindBestTrack);
    return () => {
      video.textTracks.removeEventListener('addtrack', bindBestTrack);
      boundTrack?.removeEventListener('cuechange', syncCues);
    };
  }, [activeSource, selectedSubtitle, externalSubsFailed]);

  // Cross-provider soft subtitle fallback: if the active video server has no external subtitle
  // tracks (e.g. KickAssAnime, AniWaves, AnimeGG) or its subtitle URL failed, pull soft subtitles
  // from AniKoto (.vtt) and AnimeNexus (.ass) so every server has working soft subtitles.
  useEffect(() => {
    if (!activeSource || !animeId) return;
    const existingCount = activeSource.subtitles?.length || 0;
    if (existingCount > 0 && !externalSubsFailed) return;

    let cancelled = false;
    const qTitle = anime?.title || navState?.title || navState?.anime?.title;

    fetchSupplementalSubtitles(animeId, episodeNum, qTitle)
      .then((supp) => {
        if (cancelled || !supp.subtitles.length) return;
        setActiveSource((prev) => {
          if (!prev) return prev;
          const prevSubs = prev.subtitles || [];
          const seen = new Set(prevSubs.map((s) => s.url));
          const merged = [...prevSubs];
          for (const sub of supp.subtitles) {
            if (!seen.has(sub.url)) {
              seen.add(sub.url);
              merged.push(sub);
            }
          }
          if (merged.length === prevSubs.length) return prev;
          return {
            ...prev,
            subtitles: merged,
            storyboard: prev.storyboard || supp.storyboard,
            chapters: prev.chapters || supp.chapters,
          };
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeSource?.id, activeSource?.subtitles?.length, externalSubsFailed, animeId, episodeNum, anime?.title, navState?.title]);

  // Re-evaluate active subtitle line immediately when cues or sync offset change (even while paused)
  useEffect(() => {
    if (selectedSubtitle === 'off' || subtitleCues.length === 0) {
      setCurrentSubtitleText('');
      return;
    }
    const t = videoRef.current?.currentTime ?? currentTime;
    const adjustedT = t + (subConfig.offset || 0);
    const activeLines = Array.from(
      new Set(
        subtitleCues
          .filter((c) => adjustedT >= c.start && adjustedT <= c.end)
          .map((c) => c.text)
      )
    );
    setCurrentSubtitleText(activeLines.join('\n'));
  }, [subtitleCues, selectedSubtitle, subConfig.offset]);

  // Reset storyboard cues immediately when switching episodes so stale cues never linger
  useEffect(() => {
    setStoryboardCues([]);
  }, [animeId, episodeNum]);

  // Load Storyboard VTT from active stream provider (e.g., AniKoto) and upgrade in parallel with AnimeNexus 320x180 storyboard
  useEffect(() => {
    let cancelled = false;

    const loadVttIntoCues = async (rawVttUrl: string, referer: string) => {
      const proxied =
        rawVttUrl.startsWith('/') || rawVttUrl.includes('/hls-proxy')
          ? rawVttUrl
          : `/hls-proxy?url=${encodeURIComponent(rawVttUrl)}${referer ? `&referer=${encodeURIComponent(referer)}` : ''}`;
      const res = await fetch(proxied);
      if (!res.ok) return null;
      const text = await res.text();
      if (!text.includes('-->')) return null;
      const parsed = parseStoryboardVtt(text, rawVttUrl);
      return parsed.length > 0 ? parsed : null;
    };

    // 1. Immediate storyboard from activeSource (runs concurrently)
    if (activeSource?.storyboard) {
      loadVttIntoCues(
        activeSource.storyboard,
        activeSource.referer || 'https://megaplay.buzz/'
      )
        .then((cues) => {
          if (!cancelled && cues && cues.length > 0) {
            // Only use provider cues if high-res 320x180 Nexus cues haven't already loaded
            setStoryboardCues((prev) =>
              prev.length > 0 && (prev[0]?.w || 0) >= 240 ? prev : cues
            );
          }
        })
        .catch(() => {});
    }

    // 2. High-res 320x180 storyboard + chapters from AnimeNexus (runs concurrently)
    const qTitle = anime?.title || navState?.title || navState?.anime?.title;
    if (qTitle) {
      (async () => {
        try {
          const res = await fetch(`/api/anime?q=${encodeURIComponent(qTitle)}&ep=${episodeNum}`);
          if (!res.ok || cancelled) return;
          const json = await res.json();
          const nexusData = json?.data;
          if (!nexusData || cancelled) return;

          if (nexusData.thumbnails) {
            const nexusCues = await loadVttIntoCues(nexusData.thumbnails, 'https://anime.nexus/');
            if (!cancelled && nexusCues && nexusCues.length > 0) {
              setStoryboardCues(nexusCues);
            }
          }

          // Merge AnimeNexus multi-language soft subtitles (.ass) into activeSource so every provider has them
          if (!cancelled && Array.isArray(nexusData.subtitles) && nexusData.subtitles.length > 0) {
            const nexusSubs: SubtitleTrack[] = nexusData.subtitles
              .filter((s: any) => s?.src)
              .map((s: any) => {
                const rawLabel = s.label || 'English';
                const lower = rawLabel.toLowerCase();
                return {
                  url: s.src,
                  lang: s.srcLang || 'en',
                  label: rawLabel,
                  format: s.src.includes('.ass') ? 'ass' : 'vtt',
                  default: lower === 'english' || (lower.includes('english') && !lower.includes('sign')),
                  referer: 'https://anime.nexus/',
                };
              });

            if (nexusSubs.length > 0) {
              setActiveSource((prev) => {
                if (!prev) return prev;
                const existing = prev.subtitles || [];
                const seenUrls = new Set(existing.map((s) => s.url));
                const combined = [...existing];
                for (const ns of nexusSubs) {
                  if (seenUrls.has(ns.url)) continue;
                  seenUrls.add(ns.url);
                  const label = combined.some((c) => c.label === ns.label)
                    ? `${ns.label} (Nexus)`
                    : ns.label;
                  combined.push({ ...ns, label });
                }
                if (combined.length === existing.length) return prev;
                return { ...prev, subtitles: combined };
              });
            }
          }

          // Also enrich skipTimes from AnimeNexus chapters if AniSkip hasn't populated them
          if (Array.isArray(nexusData.video_meta?.chapters)) {
            const chapters = nexusData.video_meta.chapters;
            const opChap = chapters.find((c: any) =>
              /intro|opening|^op$/i.test(String(c.name || c.title || c.type || ''))
            );
            const edChap = chapters.find((c: any) =>
              /outro|ending|^ed$|credits/i.test(String(c.name || c.title || c.type || ''))
            );
            if (!cancelled && (opChap || edChap)) {
              setSkipTimes((prev) => ({
                intro:
                  prev.intro ||
                  (opChap && typeof opChap.start === 'number' && typeof opChap.end === 'number'
                    ? { start: opChap.start, end: opChap.end }
                    : undefined),
                outro:
                  prev.outro ||
                  (edChap && typeof edChap.start === 'number' && typeof edChap.end === 'number'
                    ? { start: edChap.start, end: edChap.end }
                    : undefined),
              }));
            }
          }
        } catch {
          // ignore
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [activeSource?.storyboard, anime?.title, navState?.title, episodeNum]);

  // Preload storyboard sprite sheets in memory so hovering across segments has zero decode lag
  useEffect(() => {
    if (!storyboardCues.length) return;
    const uniqueUrls = Array.from(new Set(storyboardCues.map((c) => c.imageUrl).filter(Boolean)));
    uniqueUrls.forEach((url) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
    });
  }, [storyboardCues]);

  // Load episodes when user switches season inside the right-hand Episodes Sidebar
  const currentSeasonObj = anime?.seasons?.find(
    (s) => String(s.anilistId) === String(animeId)
  );
  const currentSeasonNumber = currentSeasonObj?.season || 1;
  const nextSeasonObj = anime?.seasons?.find(
    (s) => s.season === currentSeasonNumber + 1 && s.anilistId
  );
  const selectedSidebarSeasonObj = anime?.seasons?.find((s) => s.season === sidebarSeason);
  const sidebarSeasonAnilistId = selectedSidebarSeasonObj?.anilistId || animeId;

  useEffect(() => {
    if (!sidebarSeasonAnilistId) return;
    if (String(sidebarSeasonAnilistId) === String(animeId) && episodes.length > 0) {
      setSidebarEpisodes(episodes);
      setLoadingSidebarEpisodes(false);
      return;
    }
    let cancelled = false;
    setLoadingSidebarEpisodes(true);
    fetchAnimeEpisodes(sidebarSeasonAnilistId, 1)
      .then((res) => {
        if (!cancelled) setSidebarEpisodes(res.episodes || []);
      })
      .catch(() => {
        if (!cancelled) setSidebarEpisodes([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSidebarEpisodes(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sidebarSeasonAnilistId, animeId, episodes]);

  // Episode wheel: reset focus to the currently playing episode (or first ep of another season)
  useEffect(() => {
    if (!episodesSidebarOpen) return;
    const isSame = String(sidebarSeasonAnilistId) === String(animeId);
    const idx = isSame ? sidebarEpisodes.findIndex((e) => e.episode === episodeNum) : 0;
    setSidebarFocusIdx(Math.max(0, idx));
  }, [episodesSidebarOpen, sidebarEpisodes, sidebarSeasonAnilistId, animeId, episodeNum]);

  const stepSidebarFocus = useCallback(
    (dir: number) => {
      setSidebarFocusIdx((i) => Math.max(0, Math.min(sidebarEpisodes.length - 1, i + dir)));
    },
    [sidebarEpisodes.length]
  );

  // Arrow keys / Enter navigate the episode wheel while it's open
  useEffect(() => {
    if (!episodesSidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        stepSidebarFocus(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        stepSidebarFocus(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [episodesSidebarOpen, stepSidebarFocus]);

  // Web Audio API Audio Boost Setup
  const initAudioBoost = useCallback(() => {
    const v = videoRef.current;
    if (!v || audioCtxRef.current) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const gainNode = ctx.createGain();
      const source = ctx.createMediaElementSource(v);
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      gainNode.gain.value = audioBoost / 100;
      audioCtxRef.current = ctx;
      gainNodeRef.current = gainNode;
      sourceNodeRef.current = source;
    } catch {
      // ignore if AudioContext cannot connect
    }
  }, [audioBoost]);

  useEffect(() => {
    if (gainNodeRef.current) {
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      gainNodeRef.current.gain.value = audioBoost / 100;
    }
  }, [audioBoost]);

  // Picture in Picture Listener
  const togglePiP = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiPActive(false);
      } else {
        await v.requestPictureInPicture();
        setIsPiPActive(true);
      }
    } catch (err) {
      console.warn('PiP not available', err);
    }
  };

  useEffect(() => {
    const onEnterPiP = () => setIsPiPActive(true);
    const onLeavePiP = () => setIsPiPActive(false);
    const v = videoRef.current;
    if (v) {
      v.addEventListener('enterpictureinpicture', onEnterPiP);
      v.addEventListener('leavepictureinpicture', onLeavePiP);
    }
    return () => {
      if (v) {
        v.removeEventListener('enterpictureinpicture', onEnterPiP);
        v.removeEventListener('leavepictureinpicture', onLeavePiP);
      }
    };
  }, []);

  // Hold-to-2x Speed pointer handlers
  const handleVideoPointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (isControlsLocked) return;
      if ('button' in e && e.button !== 0) return; // Only primary mouse click
      const video = videoRef.current;
      if (!video) return;

      if (speedHoldTimerRef.current) clearTimeout(speedHoldTimerRef.current);
      speedHoldTimerRef.current = setTimeout(() => {
        preBoostSpeedRef.current = video.playbackRate || 1;
        video.playbackRate = 2.0;
        setIsSpeedBoosted(true);
        justBoostedRef.current = true;
      }, 220);
    },
    [isControlsLocked]
  );

  const handleVideoPointerUp = useCallback(() => {
    if (speedHoldTimerRef.current) {
      clearTimeout(speedHoldTimerRef.current);
      speedHoldTimerRef.current = null;
    }
    const video = videoRef.current;
    if (video && isSpeedBoosted) {
      video.playbackRate = preBoostSpeedRef.current || playbackSpeed;
      setIsSpeedBoosted(false);
      setTimeout(() => {
        justBoostedRef.current = false;
      }, 150);
    }
  }, [isSpeedBoosted, playbackSpeed]);

  // Controls auto-hide timer (throttled to avoid timer churn on every mouse subpixel move)
  const lastActiveTrigger = useRef(0);
  const triggerUserActive = useCallback(() => {
    if (isControlsLocked) return;
    const now = Date.now();
    if (now - lastActiveTrigger.current > 120) {
      lastActiveTrigger.current = now;
      setShowControls(true);
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
      controlsTimer.current = setTimeout(() => {
        if (playing && !moreOpen && !episodesSidebarOpen && !settingsOpen) {
          setShowControls(false);
        }
      }, 3600);
    }
  }, [playing, moreOpen, episodesSidebarOpen, settingsOpen, isControlsLocked]);

  const showFeedback = (type: 'play' | 'pause' | 'fwd' | 'rwd') => {
    setActionFeedback({ type, id: Date.now() + Math.random() });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setActionFeedback(null), 1050);
  };

  const togglePlay = () => {
    if (isControlsLocked || justBoostedRef.current) return;
    const v = videoRef.current;
    if (!v) return;
    initAudioBoost();
    if (v.paused) {
      v.play().catch(() => {});
      setPlaying(true);
      showFeedback('play');
    } else {
      v.pause();
      setPlaying(false);
      showFeedback('pause');
    }
  };

  const seekRelative = (seconds: number) => {
    if (isControlsLocked) return;
    const v = videoRef.current;
    if (!v) return;
    const target = Math.max(0, Math.min(v.duration || duration, v.currentTime + seconds));
    v.currentTime = target;
    setCurrentTime(target);
    persistProgress(target, v.duration || duration, true);
    showFeedback(seconds > 0 ? 'fwd' : 'rwd');
  };

  const toggleMute = () => {
    if (isControlsLocked) return;
    const v = videoRef.current;
    if (!v) return;
    initAudioBoost();
    const nextMuted = !muted;
    v.muted = nextMuted;
    setMuted(nextMuted);
  };

  const toggleFullscreen = () => {
    if (isControlsLocked) return;
    const target = playerContainerRef.current || document.documentElement;
    if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
      if (target.requestFullscreen) {
        target.requestFullscreen().catch(() => {});
      } else if ((target as any).webkitRequestFullscreen) {
        (target as any).webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
  };

  const toggleControlsLock = useCallback(() => {
    setIsControlsLocked((prev) => {
      const next = !prev;
      setLockToast(next ? 'locked' : 'unlocked');
      setTimeout(() => setLockToast(null), 2000);
      if (next) {
        setShowControls(false);
        setSettingsOpen(false);
        setEpisodesSidebarOpen(false);
        setMoreOpen(false);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = Boolean(
        document.fullscreenElement || (document as any).webkitFullscreenElement
      );
      setIsFullscreen(isFs);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleNextEpisode = useCallback(() => {
    const nextEp = episodeNum + 1;
    const maxEps = episodes.length || anime?.episodes || 999;
    if (nextEp <= maxEps) {
      navigate(`/watch/anime/${animeId}/1/${nextEp}?mode=${audioMode}`);
    } else if (nextSeasonObj?.anilistId) {
      navigate(`/watch/anime/${nextSeasonObj.anilistId}/1/1?mode=${audioMode}`);
    }
  }, [episodeNum, episodes.length, anime?.episodes, animeId, audioMode, nextSeasonObj, navigate]);

  const handleVideoEnded = () => {
    if (animeId) {
      saveEpisodeProgress(animeId, episodeNum, duration || 1440, duration || 1440);
    }
    if (autoNext) {
      handleNextEpisode();
    }
  };

  // Keyboard navigation & hold shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // 'L' key toggles lock controls
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        toggleControlsLock();
        return;
      }

      if (isControlsLocked) return;

      triggerUserActive();

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (e.repeat) return;
        if (!spaceHoldTimerRef.current) {
          spaceHoldTimerRef.current = setTimeout(() => {
            const v = videoRef.current;
            if (v && !v.paused) {
              preBoostSpeedRef.current = v.playbackRate || 1;
              v.playbackRate = 2.0;
              setIsSpeedBoosted(true);
              spaceBoostedRef.current = true;
            }
          }, 240);
        }
      } else if (e.key === 'k') {
        e.preventDefault();
        if (e.repeat) return;
        togglePlay();
      } else if (e.key === 'ArrowLeft' || e.key === 'j') {
        e.preventDefault();
        seekRelative(-10);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        seekRelative(10);
      } else if (e.key === 'm') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'f') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'Escape') {
        setMoreOpen(false);
        setEpisodesSidebarOpen(false);
        setSettingsOpen(false);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space' || e.key === ' ') {
        if (spaceHoldTimerRef.current) {
          clearTimeout(spaceHoldTimerRef.current);
          spaceHoldTimerRef.current = null;
        }
        if (spaceBoostedRef.current) {
          spaceBoostedRef.current = false;
          const v = videoRef.current;
          if (v) {
            v.playbackRate = preBoostSpeedRef.current || playbackSpeed;
          }
          setIsSpeedBoosted(false);
          return;
        }
        if (!isControlsLocked) {
          togglePlay();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [playing, muted, triggerUserActive, isControlsLocked, playbackSpeed, toggleControlsLock]);

  const formatTime = (sec: number) => {
    if (!Number.isFinite(sec) || sec < 0) return '0:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
    return `${m}:${pad(s)}`;
  };

  // AniSkip detection
  const activeSkip =
    skipTimes.intro && currentTime >= skipTimes.intro.start && currentTime <= skipTimes.intro.end
      ? { label: 'Skip Intro', shortLabel: 'Intro', start: skipTimes.intro.start, target: skipTimes.intro.end }
      : skipTimes.outro && currentTime >= skipTimes.outro.start && currentTime <= skipTimes.outro.end
      ? { label: 'Skip Outro', shortLabel: 'Outro', start: skipTimes.outro.start, target: skipTimes.outro.end }
      : null;

  // Auto Skip automation
  useEffect(() => {
    if (!autoSkip || !activeSkip) return;
    const now = Date.now();
    if (now - lastAutoSkipRef.current < 4000) return;
    lastAutoSkipRef.current = now;

    if (videoRef.current) {
      const fromTime = activeSkip.start;
      const toTime = activeSkip.target;
      videoRef.current.currentTime = toTime;
      setAutoSkipToast({
        label: `Skipped ${activeSkip.shortLabel}`,
        fromTime,
        toTime,
      });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setAutoSkipToast(null), 3400);
    }
  }, [activeSkip, autoSkip]);

  // Quality handler
  const handleQualitySelect = (q: string) => {
    setActiveQuality(q);
    if (!hlsRef.current) return;
    if (q === 'Auto') {
      hlsRef.current.currentLevel = -1;
    } else {
      const targetHeight = parseInt(q, 10);
      const levels = hlsRef.current.levels;
      const idx = levels.findIndex((l) => l.height === targetHeight);
      if (idx !== -1) {
        hlsRef.current.currentLevel = idx;
      }
    }
  };

  // Subtitle handler
  const handleSubtitleSelect = (subLabel: string) => {
    const picked = activeSource?.subtitles?.find((s) => s.label === subLabel);
    if (picked?.lang) preferredSubLangRef.current = picked.lang;
    setSelectedSubtitle(subLabel);
  };

  // Speed handler
  const handleSpeedSelect = (sp: number) => {
    setPlaybackSpeed(sp);
    if (videoRef.current) {
      videoRef.current.playbackRate = sp;
    }
  };

  // Server handler
  const handleServerSelect = (providerId: AnivexaProviderId) => {
    setSelectedProvider(providerId);
    setActiveProviderIndex(0);
    setLoadingStream(true);
    setStreamError(false);
    setActiveSource(null);
  };

  // Navigate settings with slide direction
  const changeSettingsView = (nextView: SettingsView) => {
    setMenuDirection(nextView === 'main' ? -1 : 1);
    setSettingsView(nextView);
  };

  const contentAdvisory = getContentAdvisory(anime);
  const displayTitle = anime?.title || navState?.title || navState?.anime?.title || 'Anime';
  const currentEpData = episodes.find((e) => e.episode === episodeNum);
  const epTitle = currentEpData?.title;
  const hasDistinctTitle =
    epTitle &&
    !epTitle.toLowerCase().startsWith('episode') &&
    epTitle.trim() !== String(episodeNum);
  const displaySubtitle = hasDistinctTitle
    ? `EP ${episodeNum} · ${epTitle}`
    : `Episode ${episodeNum}`;

  const currentProviderName =
    DIRECT_PROVIDERS.find((p) => p.id === (activeSource?.provider || selectedProvider))?.name ||
    (activeSource?.provider || selectedProvider).toUpperCase();

  const currentAudioTrackLabel =
    AUDIO_TRACKS.find((t) => t.id === audioMode)?.label || 'Japanese (Sub)';

  const currentFitLabel =
    VIDEO_FITS.find((f) => f.id === videoFit)?.label.split(' ')[0] || 'Contain';

  const loadedSubtitleTrack = loadedSubtitleUrl
    ? activeSource?.subtitles?.find((s) => s.url === loadedSubtitleUrl)
    : undefined;
  const activeSubtitleDisplayName =
    selectedSubtitle === 'off'
      ? 'Off'
      : loadedSubtitleTrack?.label ||
        (selectedSubtitle === 'default'
          ? activeSource?.subtitles?.[0]?.label || 'English'
          : selectedSubtitle);

  return (
    <div
      ref={playerContainerRef}
      className={
        miniplayer
          ? 'fixed bottom-6 right-6 z-[100] w-[340px] sm:w-[420px] aspect-video rounded-2xl bg-black border border-white/20 shadow-[0_25px_60px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col font-sans select-none'
          : `fixed inset-0 bg-black z-[100] flex flex-col select-none overflow-hidden font-sans ${
              isFullscreen ? '!w-screen !h-screen !rounded-none !border-none !m-0 !p-0 !left-0 !top-0' : ''
            }`
      }
      onMouseMove={triggerUserActive}
      onClick={triggerUserActive}
    >
      {/* ------------------------------------------------------------------ */}
      {/* 1. AMBIENT GLOW BACKDROP                                           */}
      {/* ------------------------------------------------------------------ */}
      {ambientMode && !miniplayer && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center -z-0">
          <div
            className="w-full h-full max-w-4xl max-h-[85%] rounded-full opacity-35 blur-[130px] transition-all duration-700"
            style={{
              background: anime?.backdrop
                ? 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(200,210,255,0.08) 50%, transparent 80%)'
                : 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)',
            }}
          />
          {anime?.backdrop && (
            <img
              src={anime.backdrop}
              alt=""
              className="absolute inset-0 w-full h-full object-cover blur-[90px] opacity-25 scale-125 transform pointer-events-none transition-opacity duration-1000"
            />
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 2. LOADING / BUFFERING OVERLAY                                     */}
      {/* ------------------------------------------------------------------ */}
      <AnimatePresence>
        {loadingStream && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-50 bg-black flex flex-col justify-between p-6 sm:p-10 select-none"
          >
            {/* Top Row: Rating & Content Advisory */}
            <div className="flex items-start justify-between">
              <div className="max-w-md">
                <h2 className="text-white text-base sm:text-lg font-black tracking-tight leading-snug">
                  {contentAdvisory.rating}
                </h2>
                <p className="text-white/60 text-xs sm:text-[13px] leading-relaxed mt-0.5 font-medium">
                  {contentAdvisory.advisory}
                </p>
              </div>

              <div className="text-white/50 p-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l2.4 6.6L21 11l-5.6 4.4L17 22l-5-4-5 4 1.6-6.6L3 11l6.6-2.4L12 2z" />
                </svg>
              </div>
            </div>

            {/* Center: Minimalist circular arc spinner + Witty text */}
            <div className="flex flex-col items-center justify-center text-center px-4">
              <div className="w-12 h-12 rounded-full border-2 border-white/15 border-t-white animate-spin mb-6" />
              <p className="text-white text-sm sm:text-base font-semibold max-w-md leading-relaxed tracking-wide">
                {BUFFERING_LINES[wittyIndex]}
              </p>
              <p className="text-white/40 text-xs mt-3 font-mono">
                Connecting to {currentProviderName} direct stream...
              </p>
            </div>

            {/* Bottom: Close / Cancel '✕' button */}
            <div className="flex justify-center pb-4">
              <motion.button
                whileHover={{ scale: 1.15, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate(`/anime/${animeId}`)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close player"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------------ */}
      {/* 3. ERROR OVERLAY (Direct stream failure)                            */}
      {/* ------------------------------------------------------------------ */}
      <AnimatePresence>
        {streamError && !loadingStream && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-white/10 border border-white/15 flex items-center justify-center mb-4 text-white">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 className="text-white font-bold text-lg mb-1">Direct Stream Unavailable</h3>
            <p className="text-white/60 text-xs sm:text-sm max-w-md mb-6 leading-relaxed">
              We couldn't connect directly to the media servers for this episode. Try another direct server in Settings.
            </p>
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setActiveProviderIndex(0);
                  setLoadingStream(true);
                  setStreamError(false);
                }}
                className="px-5 py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-white/90 transition-colors cursor-pointer"
              >
                Retry Stream
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setSettingsOpen(true);
                  setSettingsView('server');
                }}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Choose Server
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------------ */}
      {/* 4. MAIN VIDEO SURFACE (HTML5 Native Video - 100% DIRECT STREAMING)  */}
      {/* ------------------------------------------------------------------ */}
      <div className="relative flex-1 w-full h-full bg-black overflow-hidden flex items-center justify-center">
        <video
          ref={videoRef}
          onClick={togglePlay}
          onDoubleClick={(e) => {
            if (isControlsLocked || justBoostedRef.current) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            if (x < rect.width / 2) seekRelative(-10);
            else seekRelative(10);
          }}
          onMouseDown={handleVideoPointerDown}
          onMouseUp={handleVideoPointerUp}
          onMouseLeave={handleVideoPointerUp}
          onTouchStart={handleVideoPointerDown}
          onTouchEnd={handleVideoPointerUp}
          onTouchCancel={handleVideoPointerUp}
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setDuration(d);
            restoreSavedProgress(e.currentTarget);
          }}
          onTimeUpdate={(e) => {
            const t = e.currentTarget.currentTime;
            const d = e.currentTarget.duration || 1440;
            setCurrentTime(t);
            setDuration(d);
            persistProgress(t, d);

            // Subtitle synchronization with user-customized timing offset
            if (selectedSubtitle !== 'off' && subtitleCues.length > 0) {
              const adjustedT = t + (subConfig.offset || 0);
              const active = Array.from(
                new Set(
                  subtitleCues
                    .filter((c) => adjustedT >= c.start && adjustedT <= c.end)
                    .map((c) => c.text)
                )
              ).join('\n');
              setCurrentSubtitleText(active);
            } else if (currentSubtitleText) {
              setCurrentSubtitleText('');
            }
          }}
          onEnded={handleVideoEnded}
          onError={() => {
            if (hlsRef.current) return; // HLS.js handles its own fatal errors
            currentAttachedStreamRef.current = '';
            if (activeProviderIndex + 1 < providersOrder.length) {
              setActiveProviderIndex((i) => i + 1);
            } else {
              setLoadingStream(false);
              setStreamError(true);
            }
          }}
          onPlay={() => setPlaying(true)}
          onPause={(e) => {
            setPlaying(false);
            persistProgress(
              e.currentTarget.currentTime,
              e.currentTarget.duration || duration || 1440,
              true
            );
          }}
          muted={muted}
          playsInline
          crossOrigin="anonymous"
          style={{ objectFit: videoFit }}
          className="w-full h-full cursor-pointer"
        >
          {vttTrackUrl && (
            <track
              key={vttTrackUrl}
              kind="subtitles"
              src={vttTrackUrl}
              srcLang="en"
              label={activeSubtitleDisplayName}
              default
            />
          )}
        </video>

        {/* Floating 2X Speed Indicator */}
        <AnimatePresence>
          {isSpeedBoosted && (
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.92 }}
              transition={{ duration: 0.16 }}
              className="pointer-events-none absolute top-16 inset-x-0 z-50 flex justify-center"
            >
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/20 text-white shadow-[0_12px_35px_rgba(0,0,0,0.85)]">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                  <path d="M4 5v14l9-7z" />
                  <path d="M13 5v14l9-7z" />
                </svg>
                <span className="text-xs font-bold tracking-widest">2x</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Controls Lock Toast */}
        <AnimatePresence>
          {lockToast && (
            <motion.div
              key={lockToast}
              initial={{ opacity: 0, y: -12, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 450, damping: 28 }}
              className="pointer-events-none absolute top-8 inset-x-0 z-50 flex justify-center"
            >
              <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#0a0a0a]/92 backdrop-blur-xl border border-white/20 text-white shadow-[0_12px_35px_rgba(0,0,0,0.85)]">
                {lockToast === 'locked' ? (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span className="text-xs font-bold tracking-wide">Controls Locked</span>
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                    </svg>
                    <span className="text-xs font-bold tracking-wide">Controls Unlocked</span>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Unlock Controls Button (Always accessible when locked) */}
        <AnimatePresence>
          {isControlsLocked && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                toggleControlsLock();
              }}
              className="pointer-events-auto absolute top-6 right-6 z-50 flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#0a0a0a]/85 hover:bg-white text-white hover:text-black backdrop-blur-xl border border-white/20 shadow-[0_12px_35px_rgba(0,0,0,0.85)] cursor-pointer transition-colors duration-200"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span className="text-xs font-semibold tracking-tight">Locked · Click to Unlock</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Anime Subtitle Display with user-customized styling, animation & position */}
        <div
          className={`pointer-events-none absolute ${
            subConfig.bottomOffset === 'high'
              ? showControls
                ? 'bottom-28 sm:bottom-32'
                : 'bottom-16 sm:bottom-20'
              : subConfig.bottomOffset === 'low'
              ? showControls
                ? 'bottom-16 sm:bottom-18'
                : 'bottom-5 sm:bottom-7'
              : showControls
              ? 'bottom-20 sm:bottom-24'
              : 'bottom-9 sm:bottom-12'
          } inset-x-4 z-20 flex justify-center text-center transition-[bottom] duration-200`}
        >
          <AnimatePresence mode="wait">
            {selectedSubtitle !== 'off' && currentSubtitleText && (
              <motion.div
                key={currentSubtitleText}
                {...getSubtitleAnimationProps(subConfig.animation)}
                className={`inline-block max-w-3xl select-none transition-all duration-150 ${getSubtitleBoxClasses(subConfig)}`}
                style={getSubtitleBoxStyles(subConfig)}
              >
                <p
                  className={`font-semibold tracking-normal whitespace-pre-line leading-relaxed m-0 p-0 select-none ${getSubtitleTextClasses(subConfig)}`}
                  style={getSubtitleTextStyles(subConfig)}
                >
                  {currentSubtitleText}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Floating Manual Skip Intro / Outro button */}
        <AnimatePresence>
          {activeSkip && !autoSkip && (
            <motion.button
              type="button"
              key={activeSkip.label}
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={(e) => {
                e.stopPropagation();
                if (videoRef.current) {
                  videoRef.current.currentTime = activeSkip.target;
                  setCurrentTime(activeSkip.target);
                  persistProgress(activeSkip.target, videoRef.current.duration || duration, true);
                }
              }}
              className="group/skip pointer-events-auto absolute bottom-24 right-6 sm:right-8 z-40 flex items-center gap-2.5 pl-4 pr-3.5 py-2.5 rounded-xl bg-[#0a0a0a]/90 hover:bg-white text-white hover:text-black backdrop-blur-2xl border border-white/[0.14] shadow-[0_16px_40px_rgba(0,0,0,0.75)] transition-colors duration-200 cursor-pointer"
            >
              <span className="text-[13px] font-semibold tracking-tight">{activeSkip.label}</span>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="transition-transform duration-200 group-hover/skip:translate-x-0.5"
              >
                <path d="M5 5.6v12.8a.8.8 0 0 0 1.24.66l9.3-6.4a.8.8 0 0 0 0-1.32l-9.3-6.4A.8.8 0 0 0 5 5.6z" />
                <rect x="17.2" y="5" width="2.2" height="14" rx="1.1" />
              </svg>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Sleek Floating Auto-Skip Notification Card with Interactive Undo & Dismiss */}
        <AnimatePresence>
          {autoSkipToast && (
            <motion.div
              key={`${autoSkipToast.label}-${autoSkipToast.toTime}`}
              initial={{ opacity: 0, y: 14, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              onMouseEnter={() => {
                if (toastTimer.current) clearTimeout(toastTimer.current);
              }}
              onMouseLeave={() => {
                if (toastTimer.current) clearTimeout(toastTimer.current);
                toastTimer.current = setTimeout(() => setAutoSkipToast(null), 2600);
              }}
              className="pointer-events-auto absolute bottom-24 right-6 sm:right-8 z-40 overflow-hidden rounded-2xl bg-[#0a0a0a]/92 backdrop-blur-2xl border border-white/[0.12] shadow-[0_18px_45px_rgba(0,0,0,0.85)] pl-3 pr-2.5 py-2.5 flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-xl bg-white/[0.08] border border-white/[0.08] flex items-center justify-center text-white shrink-0">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4.5 5.8v12.4a.7.7 0 0 0 1.1.58l8.4-6.2a.7.7 0 0 0 0-1.16L5.6 5.22a.7.7 0 0 0-1.1.58z" />
                  <path d="M13.5 5.8v12.4a.7.7 0 0 0 1.1.58l8.4-6.2a.7.7 0 0 0 0-1.16l-8.4-6.2a.7.7 0 0 0-1.1.58z" />
                </svg>
              </div>
              <div className="min-w-0 pr-1">
                <div className="text-[12.5px] font-semibold text-white leading-tight">
                  {autoSkipToast.label}
                </div>
                <div className="text-[11px] font-medium text-white/45 tabular-nums mt-0.5">
                  {formatTime(autoSkipToast.fromTime)} → {formatTime(autoSkipToast.toTime)}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (videoRef.current) {
                    lastAutoSkipRef.current = Date.now() + 15000;
                    videoRef.current.currentTime = autoSkipToast.fromTime;
                    setCurrentTime(autoSkipToast.fromTime);
                  }
                  setAutoSkipToast(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-white text-black hover:bg-white/90 text-[11px] font-bold transition-colors cursor-pointer shrink-0"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setAutoSkipToast(null);
                }}
                aria-label="Dismiss skip notification"
                className="w-6 h-6 rounded-full text-white/45 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 4.5, ease: 'linear' }}
                style={{ transformOrigin: 'left' }}
                className="absolute bottom-0 inset-x-0 h-[2px] bg-white/40 pointer-events-none"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sleek Floating Auto-Next (Up Next) Notification Card */}
        {(() => {
          const nextEpNum = episodeNum + 1;
          const maxEps = episodes.length || anime?.episodes || 0;
          const hasNextEpInSeason = maxEps === 0 ? true : nextEpNum <= maxEps;
          const nextEpObj = episodes.find((e) => e.episode === nextEpNum);
          const canAdvance = hasNextEpInSeason || Boolean(nextSeasonObj?.anilistId);
          const timeRemaining = duration > 120 ? Math.max(0, Math.ceil(duration - currentTime)) : 999;
          const inEndingWindow =
            duration > 120 &&
            currentTime > 60 &&
            (timeRemaining <= 16 ||
              (skipTimes.outro &&
                currentTime >= skipTimes.outro.start &&
                duration - currentTime <= 35));

          const showUpNextCard =
            autoNext &&
            canAdvance &&
            inEndingWindow &&
            !upNextDismissed &&
            !autoSkipToast &&
            !moreOpen &&
            !episodesSidebarOpen;

          const nextThumb = hasNextEpInSeason
            ? nextEpObj?.still || getEpisodeThumbnail(animeId, nextEpNum) || anime?.backdrop || anime?.poster
            : anime?.backdrop || anime?.poster;

          const upNextLabel = hasNextEpInSeason
            ? `Episode ${nextEpNum}`
            : `${nextSeasonObj?.name || `Season ${currentSeasonNumber + 1}`} · EP 1`;

          const upNextSub = hasNextEpInSeason
            ? nextEpObj?.title && !nextEpObj.title.toLowerCase().startsWith('episode')
              ? nextEpObj.title
              : displayTitle
            : 'Next Season Premiere';

          return (
            <AnimatePresence>
              {showUpNextCard && (
                <motion.div
                  key="up-next-card"
                  initial={{ opacity: 0, y: 16, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  onClick={(e) => e.stopPropagation()}
                  className="pointer-events-auto absolute bottom-24 right-6 sm:right-8 z-40 w-[300px] sm:w-[336px] overflow-hidden rounded-2xl bg-[#0a0a0a]/92 backdrop-blur-2xl border border-white/[0.12] shadow-[0_20px_50px_rgba(0,0,0,0.85)] p-2.5 flex items-center gap-3"
                >
                  {/* Next Episode Thumbnail */}
                  <button
                    type="button"
                    onClick={handleNextEpisode}
                    className="group/un relative w-[104px] aspect-video rounded-xl overflow-hidden bg-black/60 border border-white/[0.08] shrink-0 cursor-pointer"
                  >
                    {nextThumb ? (
                      <img
                        src={nextThumb}
                        alt=""
                        className="w-full h-full object-cover group-hover/un:scale-105 transition-transform duration-300"
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-black/35 group-hover/un:bg-black/15 transition-colors flex items-center justify-center">
                      <div className="w-7 h-7 rounded-full bg-white/95 text-black flex items-center justify-center shadow-md group-hover/un:scale-110 transition-transform">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </button>

                  {/* Info & Actions */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-white/50">
                        Up Next · {timeRemaining}s
                      </span>
                      <button
                        type="button"
                        onClick={() => setUpNextDismissed(true)}
                        className="w-5 h-5 rounded-full text-white/40 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
                        aria-label="Dismiss Up Next"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-[13px] font-bold text-white truncate mt-0.5">
                      {upNextLabel}
                    </p>
                    <p className="text-[11px] font-medium text-white/50 truncate">
                      {upNextSub}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleNextEpisode}
                        className="px-2.5 py-1 rounded-lg bg-white text-black hover:bg-white/90 text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        Play Now
                      </button>
                    </div>
                  </div>

                  {/* Countdown Progress Line */}
                  <div className="absolute bottom-0 inset-x-0 h-[2px] bg-white/10">
                    <div
                      className="h-full bg-white/60 transition-all duration-300"
                      style={{
                        width: `${Math.max(0, Math.min(100, (timeRemaining / 16) * 100))}%`,
                      }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          );
        })()}

        {/* Central Feedback Icon animation (Play/Pause/Seek — Darker Semi-transparent, No Outline, Slower, Never Stacks) */}
        <AnimatePresence>
          {actionFeedback && (
            <motion.div
              key={actionFeedback.id}
              initial={{ opacity: 0, scale: 0.55 }}
              animate={{
                opacity: [0, 1, 0.96, 0],
                scale: [0.55, 1, 1.05, 1.2],
              }}
              exit={{ opacity: 0, scale: 1.15, transition: { duration: 0.12 } }}
              transition={{
                duration: 1.0,
                times: [0, 0.2, 0.72, 1],
                ease: [0.22, 1, 0.36, 1],
              }}
              className="pointer-events-none absolute z-40 w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-black/60 backdrop-blur-md border-0 outline-none flex items-center justify-center text-white"
            >
              <motion.div
                initial={{ scale: 0.5, rotate: actionFeedback.type === 'play' ? -14 : actionFeedback.type === 'pause' ? 14 : 0, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 360, damping: 22 }}
                className="flex items-center justify-center"
              >
                {actionFeedback.type === 'play' && (
                  <svg width="38" height="38" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.5 5.2v13.6a.85.85 0 0 0 1.3.72l10.4-6.8a.85.85 0 0 0 0-1.44L8.8 4.48a.85.85 0 0 0-1.3.72z" />
                  </svg>
                )}
                {actionFeedback.type === 'pause' && (
                  <svg width="38" height="38" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6.5" y="4.5" width="3.8" height="15" rx="1.3" />
                    <rect x="13.7" y="4.5" width="3.8" height="15" rx="1.3" />
                  </svg>
                )}
                {actionFeedback.type === 'fwd' && (
                  <span className="text-sm sm:text-base font-bold tracking-tight">+10s</span>
                )}
                {actionFeedback.type === 'rwd' && (
                  <span className="text-sm sm:text-base font-bold tracking-tight">-10s</span>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Miniplayer Re-expand floating button */}
        {miniplayer && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setMiniplayer(false)}
            className="absolute top-2 right-2 z-40 p-1.5 rounded-lg bg-black/70 hover:bg-black text-white/80 hover:text-white transition-colors cursor-pointer"
            title="Expand to Full Player"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 3h6v6M9 21H3v-6M21 9v12h-6M3 9V3h6" />
            </svg>
          </motion.button>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 5. TOP OVERLAY BAR                                                 */}
      {/* ------------------------------------------------------------------ */}
      {!miniplayer && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: showControls && !isControlsLocked ? 1 : 0, y: showControls && !isControlsLocked ? 0 : -10 }}
          transition={{ duration: 0.25 }}
          className={`absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 sm:px-8 py-5 bg-gradient-to-b from-black/90 via-black/40 to-transparent ${
            showControls && !isControlsLocked ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        >
          {/* Left: Back button + Anime/Episode title */}
          <div className="flex items-center gap-3.5 min-w-0">
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => navigate(`/anime/${animeId}`)}
              className="group/back w-10 h-10 -ml-2 rounded-full text-white/85 hover:text-white hover:bg-white/10 grid place-items-center transition-colors duration-150 shrink-0 cursor-pointer"
              aria-label="Back"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200 group-hover/back:-translate-x-0.5">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </motion.button>
            <div className="min-w-0">
              <h1 className="text-white font-bold text-sm sm:text-base md:text-lg leading-tight truncate">
                {displayTitle}
              </h1>
              <p className="text-white/45 text-[11.5px] font-medium truncate mt-0.5">
                {displaySubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2" />
        </motion.div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 6. RICH SETTINGS FLOATING FLYOUT                                   */}
      {/* ------------------------------------------------------------------ */}
      {/* Settings Backdrop click-away dismiss */}
      <AnimatePresence>
        {settingsOpen && !miniplayer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => setSettingsOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {settingsOpen && !miniplayer && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: 'bottom right' }}
            className="absolute bottom-16 sm:bottom-20 right-4 sm:right-8 z-50 w-[268px] rounded-2xl bg-[#0a0a0a]/96 border border-white/[0.09] backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] p-1.5 text-white overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <AnimatePresence mode="wait" custom={menuDirection}>
              {/* VIEW 1: MAIN SETTINGS MENU */}
              {settingsView === 'main' && (
                <motion.div
                  key="main"
                  custom={menuDirection}
                  initial={{ opacity: 0, x: menuDirection * 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -menuDirection * 15 }}
                  transition={{ duration: 0.14, ease: 'easeOut' }}
                  className="flex flex-col py-0.5"
                >
                  {/* Audio */}
                  <button
                    type="button"
                    onClick={() => changeSettingsView('audio')}
                    className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-left hover:bg-white/[0.08] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-5 flex items-center justify-center text-white/70 group-hover:text-white shrink-0">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                        </svg>
                      </div>
                      <span className="text-[13px] font-medium text-white/90 group-hover:text-white">Audio</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-white/40 group-hover:text-white/70 text-[12px] font-normal shrink-0">
                      <span className="truncate max-w-[90px]">{currentAudioTrackLabel.split(' ')[0]}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </button>

                  {/* Playback speed */}
                  <button
                    type="button"
                    onClick={() => changeSettingsView('speed')}
                    className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-left hover:bg-white/[0.08] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-5 flex items-center justify-center text-white/70 group-hover:text-white shrink-0">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      </div>
                      <span className="text-[13px] font-medium text-white/90 group-hover:text-white">Playback speed</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-white/40 group-hover:text-white/70 text-[12px] font-normal shrink-0">
                      <span>{playbackSpeed === 1 ? '1x' : `${playbackSpeed}x`}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </button>

                  {/* Subtitles/CC */}
                  <button
                    type="button"
                    onClick={() => changeSettingsView('subtitles')}
                    className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-left hover:bg-white/[0.08] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-5 flex items-center justify-center text-white/70 group-hover:text-white shrink-0">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
                          <path d="M9.5 10.3a2 2 0 1 0 0 3.4M16 10.3a2 2 0 1 0 0 3.4" />
                        </svg>
                      </div>
                      <span className="text-[13px] font-medium text-white/90 group-hover:text-white">Subtitles/CC</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-white/40 group-hover:text-white/70 text-[12px] font-normal shrink-0">
                      <span className="truncate max-w-[90px]">{activeSubtitleDisplayName}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </button>

                  {/* Quality */}
                  <button
                    type="button"
                    onClick={() => changeSettingsView('quality')}
                    className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-left hover:bg-white/[0.08] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-5 flex items-center justify-center text-white/70 group-hover:text-white shrink-0">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="3.5" width="20" height="13" rx="2" />
                          <path d="M8 20.5h8M12 16.5v4" />
                        </svg>
                      </div>
                      <span className="text-[13px] font-medium text-white/90 group-hover:text-white">Quality</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-white/40 group-hover:text-white/70 text-[12px] font-normal shrink-0">
                      <span>{activeQuality}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </button>

                  {/* Server */}
                  <button
                    type="button"
                    onClick={() => changeSettingsView('server')}
                    className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-left hover:bg-white/[0.08] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-5 flex items-center justify-center text-white/70 group-hover:text-white shrink-0">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="3" width="20" height="7" rx="2" />
                          <rect x="2" y="14" width="20" height="7" rx="2" />
                          <line x1="6" y1="6.5" x2="6.01" y2="6.5" />
                          <line x1="6" y1="17.5" x2="6.01" y2="17.5" />
                        </svg>
                      </div>
                      <span className="text-[13px] font-medium text-white/90 group-hover:text-white">Server</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-white/40 group-hover:text-white/70 text-[12px] font-normal shrink-0">
                      <span className="truncate max-w-[90px]">{currentProviderName.split(' ')[0]}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </button>

                  {/* Video Fit */}
                  <button
                    type="button"
                    onClick={() => changeSettingsView('fit')}
                    className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-left hover:bg-white/[0.08] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-5 flex items-center justify-center text-white/70 group-hover:text-white shrink-0">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M15 3h6v6M9 21H3v-6M21 9v12h-6M3 9V3h6" />
                        </svg>
                      </div>
                      <span className="text-[13px] font-medium text-white/90 group-hover:text-white">Video Fit</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-white/40 group-hover:text-white/70 text-[12px] font-normal shrink-0">
                      <span>{currentFitLabel}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </button>

                  {/* Subtle Divider */}
                  <div className="my-1 border-t border-white/[0.08]" />

                  {/* More */}
                  <button
                    type="button"
                    onClick={() => changeSettingsView('more')}
                    className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-left hover:bg-white/[0.08] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-5 flex items-center justify-center text-white/70 group-hover:text-white shrink-0">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="4" y1="21" x2="4" y2="14" />
                          <line x1="4" y1="10" x2="4" y2="3" />
                          <line x1="12" y1="21" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12" y2="3" />
                          <line x1="20" y1="21" x2="20" y2="16" />
                          <line x1="20" y1="12" x2="20" y2="3" />
                          <line x1="1.5" y1="14" x2="6.5" y2="14" />
                          <line x1="9.5" y1="8" x2="14.5" y2="8" />
                          <line x1="17.5" y1="16" x2="22.5" y2="16" />
                        </svg>
                      </div>
                      <span className="text-[13px] font-medium text-white/90 group-hover:text-white">More</span>
                    </div>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/40 group-hover:text-white/70 shrink-0">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </motion.div>
              )}

              {/* VIEW 2: "< MORE" EXTENDED PREFERENCES SUBMENU */}
              {settingsView === 'more' && (
                <motion.div
                  key="more"
                  custom={menuDirection}
                  initial={{ opacity: 0, x: menuDirection * 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -menuDirection * 15 }}
                  transition={{ duration: 0.14, ease: 'easeOut' }}
                  className="flex flex-col max-h-[380px] overflow-y-auto custom-scrollbar p-1"
                >
                  {/* Header */}
                  <div className="flex items-center gap-2 px-2 py-1.5 mb-1 border-b border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => changeSettingsView('main')}
                      className="p-1 -ml-1 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                      aria-label="Back"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>
                    <span className="font-semibold text-[13.5px] text-white">More</span>
                  </div>

                  {/* Auto Play */}
                  <div className="flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-white/[0.05] transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className="w-5 flex items-center justify-center text-white/70">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
                        </svg>
                      </div>
                      <span className="text-[13px] font-medium text-white/90">Auto Play</span>
                    </div>
                    <ToggleSwitch checked={autoPlay} onChange={setAutoPlay} />
                  </div>

                  {/* Auto Next */}
                  <div className="flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-white/[0.05] transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className="w-5 flex items-center justify-center text-white/70">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" stroke="none" />
                          <polygon points="13 4 23 12 13 20 13 4" fill="currentColor" stroke="none" />
                        </svg>
                      </div>
                      <span className="text-[13px] font-medium text-white/90">Auto Next</span>
                    </div>
                    <ToggleSwitch checked={autoNext} onChange={setAutoNext} />
                  </div>

                  {/* Auto Skip */}
                  <div className="flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-white/[0.05] transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className="w-5 flex items-center justify-center text-white/70">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19" />
                        </svg>
                      </div>
                      <span className="text-[13px] font-medium text-white/90">Auto Skip</span>
                    </div>
                    <ToggleSwitch checked={autoSkip} onChange={setAutoSkip} />
                  </div>

                  {/* Ambient mode */}
                  <div className="flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-white/[0.05] transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className="w-5 flex items-center justify-center text-white/70">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
                        </svg>
                      </div>
                      <span className="text-[13px] font-medium text-white/90">Ambient mode</span>
                    </div>
                    <ToggleSwitch checked={ambientMode} onChange={setAmbientMode} />
                  </div>

                  {/* Miniplayer */}
                  <div className="flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-white/[0.05] transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className="w-5 flex items-center justify-center text-white/70">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="16" rx="2" />
                          <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                        </svg>
                      </div>
                      <span className="text-[13px] font-medium text-white/90">Miniplayer</span>
                    </div>
                    <ToggleSwitch checked={miniplayer} onChange={setMiniplayer} />
                  </div>

                  {/* PiP */}
                  <div className="flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-white/[0.05] transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className="w-5 flex items-center justify-center text-white/70">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
                          <rect x="12" y="11" width="7" height="5.5" rx="1" fill="currentColor" stroke="none" />
                        </svg>
                      </div>
                      <span className="text-[13px] font-medium text-white/90">PiP</span>
                    </div>
                    <ToggleSwitch checked={isPiPActive} onChange={() => togglePiP()} />
                  </div>

                  {/* Audio Boost Slider */}
                  <div className="px-2.5 pt-2.5 pb-1.5 border-t border-white/[0.08] mt-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] font-medium text-white/90">Audio Boost</span>
                      <span className="text-[12px] font-mono text-white/60 tabular-nums">
                        {audioBoost}%
                      </span>
                    </div>
                    <div className="relative w-full h-1 group/boost rounded-full bg-white/20 flex items-center">
                      <div
                        className="absolute inset-y-0 left-0 bg-white rounded-full"
                        style={{ width: `${((audioBoost - 100) / 100) * 100}%` }}
                      />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow-sm pointer-events-none"
                        style={{ left: `${((audioBoost - 100) / 100) * 100}%` }}
                      />
                      <input
                        type="range"
                        min={100}
                        max={200}
                        step={5}
                        value={audioBoost}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setAudioBoost(v);
                          initAudioBoost();
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* VIEW 3: AUDIO SUBMENU */}
              {settingsView === 'audio' && (
                <motion.div
                  key="audio"
                  custom={menuDirection}
                  initial={{ opacity: 0, x: menuDirection * 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -menuDirection * 15 }}
                  transition={{ duration: 0.14, ease: 'easeOut' }}
                  className="flex flex-col max-h-[380px] overflow-y-auto custom-scrollbar p-1"
                >
                  <div className="flex items-center gap-2 px-2 py-1.5 mb-1 border-b border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => changeSettingsView('main')}
                      className="p-1 -ml-1 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                      aria-label="Back"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>
                    <span className="font-semibold text-[13.5px] text-white">Audio</span>
                  </div>
                  {AUDIO_TRACKS.map((t) => {
                    const isActive = audioMode === t.id;
                    return (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => {
                          setAudioMode(t.id);
                          setActiveProviderIndex(0);
                        }}
                        className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-white/[0.14] text-white font-semibold'
                            : 'text-white/70 hover:bg-white/[0.06] hover:text-white text-[13px] font-normal'
                        }`}
                      >
                        <span className="text-[13px]">{t.label}</span>
                        {isActive && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </motion.div>
              )}

              {/* VIEW 4: PLAYBACK SPEED SUBMENU */}
              {settingsView === 'speed' && (
                <motion.div
                  key="speed"
                  custom={menuDirection}
                  initial={{ opacity: 0, x: menuDirection * 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -menuDirection * 15 }}
                  transition={{ duration: 0.14, ease: 'easeOut' }}
                  className="flex flex-col max-h-[380px] overflow-y-auto custom-scrollbar p-1"
                >
                  <div className="flex items-center gap-2 px-2 py-1.5 mb-1 border-b border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => changeSettingsView('main')}
                      className="p-1 -ml-1 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                      aria-label="Back"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>
                    <span className="font-semibold text-[13.5px] text-white">Playback speed</span>
                  </div>
                  {SPEED_OPTIONS.map((sp) => {
                    const isActive = playbackSpeed === sp;
                    return (
                      <button
                        type="button"
                        key={sp}
                        onClick={() => handleSpeedSelect(sp)}
                        className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-white/[0.14] text-white font-semibold'
                            : 'text-white/70 hover:bg-white/[0.06] hover:text-white text-[13px] font-normal'
                        }`}
                      >
                        <span className="text-[13px]">{sp === 1 ? '1x (Normal)' : `${sp}x`}</span>
                        {isActive && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </motion.div>
              )}

              {/* VIEW 5: SUBTITLES SUBMENU */}
              {settingsView === 'subtitles' && (
                <motion.div
                  key="subtitles"
                  custom={menuDirection}
                  initial={{ opacity: 0, x: menuDirection * 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -menuDirection * 15 }}
                  transition={{ duration: 0.14, ease: 'easeOut' }}
                  className="flex flex-col max-h-[380px] overflow-y-auto custom-scrollbar p-1"
                >
                  <div className="flex items-center gap-2 px-2 py-1.5 mb-1 border-b border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => changeSettingsView('main')}
                      className="p-1 -ml-1 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                      aria-label="Back"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>
                    <span className="font-semibold text-[13.5px] text-white">Subtitles/CC</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSubtitleSelect('off')}
                    className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                      selectedSubtitle === 'off'
                        ? 'bg-white/[0.14] text-white font-semibold'
                        : 'text-white/70 hover:bg-white/[0.06] hover:text-white text-[13px] font-normal'
                    }`}
                  >
                    <span className="text-[13px]">Off</span>
                    {selectedSubtitle === 'off' && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>

                  {(activeSource?.subtitles || [
                    { label: 'Full Subtitles', lang: 'en' },
                  ]).map((sub, i) => {
                    const isActive = loadedSubtitleUrl
                      ? (sub as SubtitleTrack).url === loadedSubtitleUrl
                      : selectedSubtitle === sub.label || (selectedSubtitle === 'default' && i === 0);
                    return (
                      <button
                        type="button"
                        key={i}
                        onClick={() => handleSubtitleSelect(sub.label)}
                        className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-white/[0.14] text-white font-semibold'
                            : 'text-white/70 hover:bg-white/[0.06] hover:text-white text-[13px] font-normal'
                        }`}
                      >
                        <span className="text-[13px] truncate pr-2">{sub.label}</span>
                        {isActive && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    );
                  })}

                  {/* Subtitle Appearance & Timing Customizer Button */}
                  <div className="pt-1.5 mt-1 border-t border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => changeSettingsView('subtitles-style')}
                      className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-left text-white/90 hover:bg-white/[0.1] hover:text-white transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/70 group-hover:text-white">
                          <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
                        </svg>
                        <span className="text-[13px] font-medium">Customize Style & Sync</span>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/40 group-hover:text-white/80">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </div>
                </motion.div>
              )}

              {/* VIEW 5.5: SUBTITLES STYLE & TIMING CUSTOMIZATION */}
              {settingsView === 'subtitles-style' && (
                <motion.div
                  key="subtitles-style"
                  custom={menuDirection}
                  initial={{ opacity: 0, x: menuDirection * 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -menuDirection * 15 }}
                  transition={{ duration: 0.14, ease: 'easeOut' }}
                  className="flex flex-col max-h-[420px] overflow-y-auto custom-scrollbar p-1.5 text-white"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-1 py-1.5 mb-1 border-b border-white/[0.08]">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => changeSettingsView('subtitles')}
                        className="p-1 -ml-1 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                        aria-label="Back"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="15 18 9 12 15 6" />
                        </svg>
                      </button>
                      <span className="font-semibold text-[13.5px] text-white">Subtitle Style & Sync</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateSubConfig(DEFAULT_SUB_CONFIG)}
                      className="text-[11px] text-white/50 hover:text-white px-2 py-0.5 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>

                  {/* Live Interactive Preview Box */}
                  <div className="relative w-full rounded-xl bg-black/60 border border-white/10 p-3 my-1.5 flex flex-col items-center justify-center min-h-[64px] overflow-hidden">
                    <div className="absolute top-1 left-2 text-[9px] uppercase tracking-wider font-semibold text-white/40">
                      Live Preview
                    </div>
                    <div className="w-full flex justify-center text-center mt-1">
                      <div
                        className={`inline-block select-none transition-all duration-150 ${getSubtitleBoxClasses(subConfig)}`}
                        style={getSubtitleBoxStyles(subConfig)}
                      >
                        <p
                          className={`font-semibold tracking-normal whitespace-pre-line leading-relaxed m-0 p-0 select-none ${getSubtitleTextClasses(subConfig)}`}
                          style={getSubtitleTextStyles(subConfig)}
                        >
                          Calculating stochastic evasion routes.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Audio / Subtitle Sync Offset */}
                  <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-2.5 my-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px] font-medium text-white/80">Timing Sync</span>
                      <span
                        className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
                          subConfig.offset === 0
                            ? 'bg-white/10 text-white/60'
                            : 'bg-emerald-500/20 text-emerald-400 font-semibold'
                        }`}
                      >
                        {subConfig.offset === 0
                          ? 'Synced (0.0s)'
                          : `${subConfig.offset > 0 ? '+' : ''}${subConfig.offset.toFixed(1)}s`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateSubConfig({ offset: Math.max(-5, Number((subConfig.offset - 0.5).toFixed(1))) })
                        }
                        className="flex-1 py-1 text-[11px] font-medium bg-white/[0.06] hover:bg-white/[0.14] text-white/80 hover:text-white rounded-lg transition-colors cursor-pointer"
                      >
                        -0.5s
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateSubConfig({ offset: Math.max(-5, Number((subConfig.offset - 0.1).toFixed(1))) })
                        }
                        className="flex-1 py-1 text-[11px] font-medium bg-white/[0.06] hover:bg-white/[0.14] text-white/80 hover:text-white rounded-lg transition-colors cursor-pointer"
                      >
                        -0.1s
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSubConfig({ offset: 0 })}
                        className="px-2.5 py-1 text-[11px] font-medium bg-white/[0.1] hover:bg-white/[0.18] text-white rounded-lg transition-colors cursor-pointer"
                      >
                        0.0s
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateSubConfig({ offset: Math.min(5, Number((subConfig.offset + 0.1).toFixed(1))) })
                        }
                        className="flex-1 py-1 text-[11px] font-medium bg-white/[0.06] hover:bg-white/[0.14] text-white/80 hover:text-white rounded-lg transition-colors cursor-pointer"
                      >
                        +0.1s
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateSubConfig({ offset: Math.min(5, Number((subConfig.offset + 0.5).toFixed(1))) })
                        }
                        className="flex-1 py-1 text-[11px] font-medium bg-white/[0.06] hover:bg-white/[0.14] text-white/80 hover:text-white rounded-lg transition-colors cursor-pointer"
                      >
                        +0.5s
                      </button>
                    </div>
                  </div>

                  {/* Presets */}
                  <div className="my-1.5">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-white/50 px-1 mb-1 block">
                      Quick Presets
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {SUB_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => updateSubConfig(preset.config)}
                          className="px-2.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.12] text-left transition-colors cursor-pointer border border-white/[0.06]"
                        >
                          <div className="text-[12px] font-semibold text-white">{preset.name}</div>
                          <div className="text-[10px] text-white/50 truncate">{preset.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Font Size */}
                  <div className="my-1.5">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-white/50 px-1 mb-1 block">
                      Font Size
                    </span>
                    <div className="grid grid-cols-5 gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/[0.06]">
                      {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => updateSubConfig({ fontSize: sz })}
                          className={`py-1 text-[11.5px] font-semibold rounded-lg transition-colors cursor-pointer uppercase ${
                            subConfig.fontSize === sz
                              ? 'bg-white text-black font-bold shadow-sm'
                              : 'text-white/70 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Text Color */}
                  <div className="my-1.5">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-white/50 px-1 mb-1 block">
                      Text Color
                    </span>
                    <div className="flex items-center gap-2 px-1">
                      {[
                        { color: '#ffffff', label: 'White' },
                        { color: '#fef08a', label: 'Yellow' },
                        { color: '#67e8f9', label: 'Cyan' },
                        { color: '#a7f3d0', label: 'Mint' },
                        { color: '#fed7aa', label: 'Peach' },
                      ].map((item) => (
                        <button
                          key={item.color}
                          type="button"
                          onClick={() => updateSubConfig({ textColor: item.color })}
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform cursor-pointer ${
                            subConfig.textColor === item.color
                              ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-black'
                              : 'opacity-80 hover:opacity-100 hover:scale-105'
                          }`}
                          style={{ backgroundColor: item.color }}
                          title={item.label}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Background Opacity */}
                  <div className="my-1.5">
                    <div className="flex items-center justify-between px-1 mb-1">
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-white/50">
                        Box Transparency
                      </span>
                      <span className="text-[11px] font-mono text-white/70">
                        {subConfig.bgOpacity === 0 ? 'Off (0%)' : `${subConfig.bgOpacity}%`}
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/[0.06]">
                      {[0, 35, 60, 85, 100].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => updateSubConfig({ bgOpacity: val })}
                          className={`py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                            subConfig.bgOpacity === val
                              ? 'bg-white text-black font-bold shadow-sm'
                              : 'text-white/70 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {val === 0 ? 'None' : `${val}%`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Rounding */}
                  <div className="my-1.5">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-white/50 px-1 mb-1 block">
                      Box Rounding
                    </span>
                    <div className="grid grid-cols-5 gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/[0.06]">
                      {(
                        [
                          { id: 'none', label: '0px' },
                          { id: 'sm', label: '6px' },
                          { id: 'md', label: '10px' },
                          { id: 'xl', label: '16px' },
                          { id: 'full', label: 'Pill' },
                        ] as const
                      ).map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => updateSubConfig({ rounding: r.id })}
                          className={`py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                            subConfig.rounding === r.id
                              ? 'bg-white text-black font-bold shadow-sm'
                              : 'text-white/70 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Text Outline / Stroke */}
                  <div className="my-1.5">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-white/50 px-1 mb-1 block">
                      Text Outline / Stroke
                    </span>
                    <div className="grid grid-cols-3 gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/[0.06]">
                      {(
                        [
                          { id: 'none', label: 'None' },
                          { id: 'subtle', label: 'Subtle' },
                          { id: 'strong', label: 'Bold Stroke' },
                          { id: 'glow', label: 'Soft Glow' },
                          { id: 'shadow', label: 'Drop Shadow' },
                        ] as const
                      ).map((out) => (
                        <button
                          key={out.id}
                          type="button"
                          onClick={() => updateSubConfig({ outline: out.id })}
                          className={`py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                            subConfig.outline === out.id
                              ? 'bg-white text-black font-bold shadow-sm'
                              : 'text-white/70 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {out.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Animation Style */}
                  <div className="my-1.5">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-white/50 px-1 mb-1 block">
                      Transition Animation
                    </span>
                    <div className="grid grid-cols-4 gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/[0.06]">
                      {(
                        [
                          { id: 'fade', label: 'Fade' },
                          { id: 'pop', label: 'Pop' },
                          { id: 'slide', label: 'Slide' },
                          { id: 'none', label: 'Instant' },
                        ] as const
                      ).map((anim) => (
                        <button
                          key={anim.id}
                          type="button"
                          onClick={() => updateSubConfig({ animation: anim.id })}
                          className={`py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                            subConfig.animation === anim.id
                              ? 'bg-white text-black font-bold shadow-sm'
                              : 'text-white/70 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {anim.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Vertical Position */}
                  <div className="my-1.5">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-white/50 px-1 mb-1 block">
                      Vertical Placement
                    </span>
                    <div className="grid grid-cols-3 gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/[0.06]">
                      {(
                        [
                          { id: 'low', label: 'Low (Compact)' },
                          { id: 'normal', label: 'Normal' },
                          { id: 'high', label: 'High (Raised)' },
                        ] as const
                      ).map((pos) => (
                        <button
                          key={pos.id}
                          type="button"
                          onClick={() => updateSubConfig({ bottomOffset: pos.id })}
                          className={`py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                            subConfig.bottomOffset === pos.id
                              ? 'bg-white text-black font-bold shadow-sm'
                              : 'text-white/70 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {pos.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* VIEW 6: QUALITY SUBMENU */}
              {settingsView === 'quality' && (
                <motion.div
                  key="quality"
                  custom={menuDirection}
                  initial={{ opacity: 0, x: menuDirection * 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -menuDirection * 15 }}
                  transition={{ duration: 0.14, ease: 'easeOut' }}
                  className="flex flex-col max-h-[380px] overflow-y-auto custom-scrollbar p-1"
                >
                  <div className="flex items-center gap-2 px-2 py-1.5 mb-1 border-b border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => changeSettingsView('main')}
                      className="p-1 -ml-1 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                      aria-label="Back"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>
                    <span className="font-semibold text-[13.5px] text-white">Quality</span>
                  </div>
                  {QUALITY_OPTIONS.map((q) => {
                    const isActive = activeQuality === q;
                    return (
                      <button
                        type="button"
                        key={q}
                        onClick={() => handleQualitySelect(q)}
                        className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-white/[0.14] text-white font-semibold'
                            : 'text-white/70 hover:bg-white/[0.06] hover:text-white text-[13px] font-normal'
                        }`}
                      >
                        <span className="text-[13px]">{q}</span>
                        {isActive && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </motion.div>
              )}

              {/* VIEW 7: SERVER SUBMENU */}
              {settingsView === 'server' && (
                <motion.div
                  key="server"
                  custom={menuDirection}
                  initial={{ opacity: 0, x: menuDirection * 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -menuDirection * 15 }}
                  transition={{ duration: 0.14, ease: 'easeOut' }}
                  className="flex flex-col max-h-[380px] overflow-y-auto custom-scrollbar p-1"
                >
                  <div className="flex items-center gap-2 px-2 py-1.5 mb-1 border-b border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => changeSettingsView('main')}
                      className="p-1 -ml-1 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                      aria-label="Back"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>
                    <span className="font-semibold text-[13.5px] text-white">Direct Servers</span>
                  </div>
                  {DIRECT_PROVIDERS.map((prov) => {
                    const isActive = (activeSource?.provider || selectedProvider) === prov.id;
                    return (
                      <button
                        type="button"
                        key={prov.id}
                        onClick={() => handleServerSelect(prov.id)}
                        className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-white/[0.14] text-white font-semibold'
                            : 'text-white/70 hover:bg-white/[0.06] hover:text-white text-[13px] font-normal'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-[13px] truncate">{prov.name}</p>
                          <p className="text-[10.5px] text-white/40">{prov.tag}</p>
                        </div>
                        {isActive && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 ml-2">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </motion.div>
              )}

              {/* VIEW 8: VIDEO FIT SUBMENU */}
              {settingsView === 'fit' && (
                <motion.div
                  key="fit"
                  custom={menuDirection}
                  initial={{ opacity: 0, x: menuDirection * 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -menuDirection * 15 }}
                  transition={{ duration: 0.14, ease: 'easeOut' }}
                  className="flex flex-col max-h-[380px] overflow-y-auto custom-scrollbar p-1"
                >
                  <div className="flex items-center gap-2 px-2 py-1.5 mb-1 border-b border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => changeSettingsView('main')}
                      className="p-1 -ml-1 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                      aria-label="Back"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>
                    <span className="font-semibold text-[13.5px] text-white">Video Fit</span>
                  </div>
                  {VIDEO_FITS.map((f) => {
                    const isActive = videoFit === f.id;
                    return (
                      <button
                        type="button"
                        key={f.id}
                        onClick={() => setVideoFit(f.id)}
                        className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-white/[0.14] text-white font-semibold'
                            : 'text-white/70 hover:bg-white/[0.06] hover:text-white text-[13px] font-normal'
                        }`}
                      >
                        <div>
                          <p className="font-medium text-[13px]">{f.label}</p>
                          <p className="text-[10.5px] text-white/40">{f.desc}</p>
                        </div>
                        {isActive && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 ml-2">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------------ */}
      {/* 7. BOTTOM OVERLAY CONTROLS                                         */}
      {/* ------------------------------------------------------------------ */}
      {!miniplayer && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: showControls ? 1 : 0, y: showControls ? 0 : 12 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-5 sm:px-8 pb-4 sm:pb-5 pt-28 bg-gradient-to-t from-black/85 via-black/35 to-transparent"
        >
          <div className={showControls ? 'pointer-events-auto' : 'pointer-events-none'}>
          {/* ---------- Scrubber ---------- */}
          {(() => {
            const total = duration || 1;
            const playedPct = Math.min(100, (currentTime / total) * 100);
            // Real buffered range around the playhead (falls back to furthest buffered point)
            let bufferedEnd = 0;
            const v = videoRef.current;
            if (v && v.buffered && v.buffered.length) {
              bufferedEnd = v.buffered.end(v.buffered.length - 1);
              for (let i = 0; i < v.buffered.length; i++) {
                if (v.buffered.start(i) <= currentTime + 0.5 && v.buffered.end(i) >= currentTime) {
                  bufferedEnd = v.buffered.end(i);
                  break;
                }
              }
            }
            const bufferedPct = Math.min(100, (bufferedEnd / total) * 100);

            return (
              <div
                ref={scrubberBarRef}
                className="relative group/bar h-5 mb-1.5 flex items-center cursor-pointer select-none touch-none"
                onPointerEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  const nextTime = pct * (duration || 1);
                  hoverTargetPctRef.current = pct;
                  hoverCurrentPctRef.current = pct;
                  hoverSnappedRef.current = true;
                  applyScrubberDomPosition(pct);
                  setHoverTime(nextTime);
                  setShowHoverTime(true);
                }}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  const nextTime = pct * (duration || 1);
                  hoverTargetPctRef.current = pct;
                  hoverCurrentPctRef.current = pct;
                  hoverSnappedRef.current = true;
                  applyScrubberDomPosition(pct);
                  setIsScrubbing(true);
                  setShowHoverTime(true);
                  setHoverTime(nextTime);
                  setCurrentTime(nextTime);
                  if (videoRef.current) videoRef.current.currentTime = nextTime;
                }}
                onPointerMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  const nextTime = pct * (duration || 1);
                  hoverTargetPctRef.current = pct;
                  if (!hoverSnappedRef.current) {
                    hoverCurrentPctRef.current = pct;
                    hoverSnappedRef.current = true;
                    applyScrubberDomPosition(pct);
                  }
                  if (!showHoverTime) setShowHoverTime(true);
                  // Avoid 120Hz full-page React re-renders: only update state when integer second or cue window shifts
                  setHoverTime((prev) => {
                    if (Math.floor(prev) !== Math.floor(nextTime) || Math.abs(prev - nextTime) >= 0.4) {
                      return nextTime;
                    }
                    return prev;
                  });
                  if (e.buttons === 1) {
                    setCurrentTime(nextTime);
                    if (videoRef.current) videoRef.current.currentTime = nextTime;
                  }
                }}
                onPointerUp={(e) => {
                  setIsScrubbing(false);
                  if (videoRef.current) {
                    persistProgress(
                      videoRef.current.currentTime,
                      videoRef.current.duration || duration || 1440,
                      true
                    );
                  }
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }
                }}
                onPointerCancel={() => {
                  setIsScrubbing(false);
                  setShowHoverTime(false);
                  hoverSnappedRef.current = false;
                }}
                onMouseLeave={() => {
                  if (!isScrubbing) {
                    setShowHoverTime(false);
                    hoverSnappedRef.current = false;
                  }
                }}
              >
                {/* Hover Storyboard Thumbnail Preview & Timestamp (120fps GPU translate3d glide + independent edge clamping) */}
                {(() => {
                  const activeThumbCue = storyboardCues.find(
                    (c) => hoverTime >= c.start && hoverTime <= c.end
                  );
                  const hoverChapter =
                    skipTimes.intro && hoverTime >= skipTimes.intro.start && hoverTime <= skipTimes.intro.end
                      ? 'Intro'
                      : skipTimes.outro && hoverTime >= skipTimes.outro.start && hoverTime <= skipTimes.outro.end
                      ? 'Outro'
                      : null;

                  const previewW = 200;
                  const previewH = 112;

                  return (
                    <AnimatePresence>
                      {showHoverTime && duration > 0 && (
                        <div className="absolute inset-x-0 bottom-full pointer-events-none z-40">
                          {/* 16:9 Cinema Storyboard Thumbnail Box (Clamped at half-width 100px so it never overflows screen edges) */}
                          {activeThumbCue && (
                            <div
                              ref={(el) => {
                                thumbPreviewBoxRef.current = el;
                                if (el) applyScrubberDomPosition(hoverCurrentPctRef.current);
                              }}
                              className="absolute bottom-10 left-0 will-change-transform"
                            >
                              <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: isScrubbing ? 1.03 : 1 }}
                                exit={{ opacity: 0, y: 8, scale: 0.92 }}
                                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                style={{
                                  width: previewW,
                                  height: previewH,
                                  transformOrigin: 'bottom center',
                                }}
                                className="relative rounded-[14px] overflow-hidden bg-[#0a0a0a] shadow-[0_20px_50px_rgba(0,0,0,0.95),0_6px_20px_rgba(0,0,0,0.75)]"
                              >
                                {activeThumbCue.w && activeThumbCue.h ? (
                                  <div
                                    style={{
                                      width: activeThumbCue.w,
                                      height: activeThumbCue.h,
                                      backgroundImage: `url("${activeThumbCue.imageUrl}")`,
                                      backgroundPosition: `-${activeThumbCue.x || 0}px -${activeThumbCue.y || 0}px`,
                                      backgroundRepeat: 'no-repeat',
                                      transform: `scale(${(previewW + 0.5) / activeThumbCue.w}, ${(previewH + 0.5) / activeThumbCue.h})`,
                                      transformOrigin: 'top left',
                                    }}
                                  />
                                ) : (
                                  <img
                                    src={activeThumbCue.imageUrl}
                                    alt=""
                                    decoding="sync"
                                    className="w-full h-full object-cover"
                                  />
                                )}
                                {/* Inset specular glass ring + subtle bottom vignette so rounded corners are razor-clean */}
                                <div className="pointer-events-none absolute inset-0 rounded-[14px] ring-1 ring-inset ring-white/[0.16] bg-gradient-to-t from-black/25 via-transparent to-white/[0.04]" />
                              </motion.div>
                            </div>
                          )}

                          {/* Frosted Dark-Glass Timestamp Pill (Follows cursor all the way to 0:00 at the left/right edges) */}
                          <div
                            ref={(el) => {
                              timePillBoxRef.current = el;
                              if (el) applyScrubberDomPosition(hoverCurrentPctRef.current);
                            }}
                            className="absolute bottom-2 left-0 will-change-transform"
                          >
                            <motion.div
                              initial={{ opacity: 0, y: 6, scale: 0.88 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 4, scale: 0.9 }}
                              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                              style={{ transformOrigin: 'bottom center' }}
                              className="px-2.5 py-[3px] rounded-full bg-black/75 backdrop-blur-md border border-white/[0.14] text-white text-[11.5px] font-semibold tracking-wide tabular-nums shadow-[0_8px_24px_rgba(0,0,0,0.9)] flex items-center gap-1.5 whitespace-nowrap"
                            >
                              {hoverChapter && (
                                <>
                                  <span className="text-white/60 font-medium text-[10.5px]">
                                    {hoverChapter}
                                  </span>
                                  <span className="text-white/30 text-[10px]">•</span>
                                </>
                              )}
                              <span>{formatTime(hoverTime)}</span>
                            </motion.div>
                          </div>
                        </div>
                      )}
                    </AnimatePresence>
                  );
                })()}

                {/* Track */}
                <div className="relative w-full h-[3px] group-hover/bar:h-[5px] rounded-full bg-white/20 overflow-hidden transition-[height] duration-150 ease-out">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-white/30"
                    style={{ width: `${bufferedPct}%` }}
                  />
                  {showHoverTime && (
                    <div
                      ref={(el) => {
                        hoverTrackFillRef.current = el;
                        if (el) applyScrubberDomPosition(hoverCurrentPctRef.current);
                      }}
                      className="absolute inset-0 origin-left bg-white/35 will-change-transform"
                    />
                  )}
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-white"
                    style={{ width: `${playedPct}%` }}
                  />
                </div>

                {/* Thumb */}
                <div
                  className="absolute top-1/2 w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white scale-0 group-hover/bar:scale-100 transition-transform duration-150 ease-out pointer-events-none shadow-[0_0_10px_rgba(255,255,255,0.6)]"
                  style={{ left: `${playedPct}%` }}
                />
              </div>
            );
          })()}

          {/* ---------- Control row: [left] [center] [right] ---------- */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            {/* Left */}
            <div className="flex items-center min-w-0 -ml-2">
              <ControlButton label={playing ? 'Pause (K)' : 'Play (K)'} onClick={togglePlay}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.svg
                    key={playing ? 'pause' : 'play'}
                    initial={{ scale: 0.5, opacity: 0, rotate: playing ? -15 : 15 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 0.5, opacity: 0, rotate: playing ? 15 : -15 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 26 }}
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    {playing ? (
                      <>
                        <rect x="6.5" y="4.5" width="3.4" height="15" rx="1.7" />
                        <rect x="14.1" y="4.5" width="3.4" height="15" rx="1.7" />
                      </>
                    ) : (
                      <path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18c.62-.39.62-1.29 0-1.69L9.54 5.98C8.87 5.55 8 6.03 8 6.82z" />
                    )}
                  </motion.svg>
                </AnimatePresence>
              </ControlButton>

              <ControlButton label="Back 10s (J)" onClick={() => seekRelative(-10)}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200 group-hover/cb:-rotate-12">
                  <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
                  <path d="M3.5 4v4.2h4.2" />
                  <text x="12.3" y="15.6" textAnchor="middle" fontSize="7.4" fontWeight="700" fill="currentColor" stroke="none" fontFamily="inherit">10</text>
                </svg>
              </ControlButton>

              <ControlButton label="Forward 10s (L)" onClick={() => seekRelative(10)}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200 group-hover/cb:rotate-12">
                  <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" />
                  <path d="M20.5 4v4.2h-4.2" />
                  <text x="11.7" y="15.6" textAnchor="middle" fontSize="7.4" fontWeight="700" fill="currentColor" stroke="none" fontFamily="inherit">10</text>
                </svg>
              </ControlButton>

              <ControlButton label="Next episode (N)" onClick={handleNextEpisode}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5 5.6v12.8a.8.8 0 0 0 1.24.66l9.3-6.4a.8.8 0 0 0 0-1.32l-9.3-6.4A.8.8 0 0 0 5 5.6z" />
                  <rect x="17.2" y="5" width="2.2" height="14" rx="1.1" />
                </svg>
              </ControlButton>

              {/* Volume */}
              <div className="flex items-center group/vol">
                <ControlButton label={muted ? 'Unmute (M)' : 'Mute (M)'} onClick={toggleMute}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 9.5h3.2L11.5 6v12l-4.3-3.5H4z" fill="currentColor" />
                    {muted || volume === 0 ? (
                      <path d="M16 9.5l5 5M21 9.5l-5 5" />
                    ) : (
                      <>
                        <path d="M15.3 9.2a4 4 0 0 1 0 5.6" />
                        {volume > 0.5 && <path d="M18.1 6.6a7.6 7.6 0 0 1 0 10.8" />}
                      </>
                    )}
                  </svg>
                </ControlButton>

                <div className="w-0 opacity-0 group-hover/vol:w-[84px] group-hover/vol:opacity-100 group-focus-within/vol:w-[84px] group-focus-within/vol:opacity-100 transition-all duration-200 ease-out overflow-hidden">
                  <div className="relative mx-2 h-4 flex items-center">
                    <div className="relative w-full h-[3px] rounded-full bg-white/25">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-white"
                        style={{ width: `${(muted ? 0 : volume) * 100}%` }}
                      />
                    </div>
                    <div
                      className="absolute top-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white pointer-events-none"
                      style={{ left: `${(muted ? 0 : volume) * 100}%` }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={muted ? 0 : volume}
                      onChange={(e) => {
                        const nextVol = Number(e.target.value);
                        setVolume(nextVol);
                        if (videoRef.current) videoRef.current.volume = nextVol;
                        if (nextVol > 0 && muted) setMuted(false);
                      }}
                      aria-label="Volume"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Time */}
              <span className="ml-2 text-[13px] font-medium text-white tabular-nums whitespace-nowrap shrink-0">
                {formatTime(currentTime)}
                <span className="text-white/40 mx-1">/</span>
                <span className="text-white/60">{formatTime(duration)}</span>
              </span>

              {/* Title */}
              <div className="hidden xl:flex items-center gap-2 min-w-0 ml-4 pl-4 border-l border-white/15">
                <span className="text-[13px] font-semibold text-white truncate">{displayTitle}</span>
                <span className="text-[12px] font-medium text-white/50 shrink-0">E{episodeNum}</span>
              </div>
            </div>

            {/* Center: Animated More Like This Button (Text-only pre-hover, no outline, smooth hover/click anims) */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 480, damping: 26 }}
              onClick={() => {
                setMoreOpen((m) => !m);
                setEpisodesSidebarOpen(false);
                setSettingsOpen(false);
              }}
              className={`group/more hidden md:inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-full text-[13px] font-semibold border-0 outline-none ring-0 focus:outline-none focus:ring-0 transition-colors duration-200 cursor-pointer select-none ${
                moreOpen
                  ? 'bg-white text-black shadow-[0_6px_20px_rgba(255,255,255,0.2)]'
                  : 'bg-transparent hover:bg-white/[0.12] text-white/85 hover:text-white'
              }`}
            >
              <span>More Like This</span>
              <motion.svg
                animate={{ rotate: moreOpen ? 180 : 0 }}
                transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 15l6-6 6 6" />
              </motion.svg>
            </motion.button>

            {/* Right: Filled icons when active, outline when inactive */}
            <div className="flex items-center justify-end -mr-2">
              <ControlButton
                label="Subtitles (C)"
                active={selectedSubtitle !== 'off'}
                onClick={() => {
                  if (selectedSubtitle === 'off') {
                    const firstSub = activeSource?.subtitles?.[0]?.label || 'default';
                    handleSubtitleSelect(firstSub);
                  } else {
                    handleSubtitleSelect('off');
                  }
                }}
              >
                {selectedSubtitle !== 'off' ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <mask id="cc-filled-mask">
                      <rect width="24" height="24" fill="white" />
                      <path
                        d="M10.2 10.3a2.2 2.2 0 1 0 0 3.4M17.2 10.3a2.2 2.2 0 1 0 0 3.4"
                        stroke="black"
                        strokeWidth="2.1"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </mask>
                    <rect x="2.5" y="5" width="19" height="14" rx="3" fill="currentColor" mask="url(#cc-filled-mask)" />
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2.5" y="5" width="19" height="14" rx="3" />
                    <path d="M10.2 10.3a2.2 2.2 0 1 0 0 3.4M17.2 10.3a2.2 2.2 0 1 0 0 3.4" />
                  </svg>
                )}
              </ControlButton>

              <ControlButton
                label="Settings"
                active={settingsOpen}
                onClick={() => {
                  setSettingsOpen((s) => !s);
                  setSettingsView('main');
                  setMoreOpen(false);
                  setEpisodesSidebarOpen(false);
                }}
              >
                <motion.svg
                  animate={{ rotate: settingsOpen ? 45 : 0 }}
                  transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  {settingsOpen ? (
                    <>
                      <mask id="gear-filled-mask">
                        <rect width="24" height="24" fill="white" />
                        <circle cx="12" cy="12" r="3.2" fill="black" />
                      </mask>
                      <path
                        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                        fill="currentColor"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        mask="url(#gear-filled-mask)"
                      />
                    </>
                  ) : (
                    <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </g>
                  )}
                </motion.svg>
              </ControlButton>

              <ControlButton
                label="Episodes"
                active={episodesSidebarOpen}
                onClick={() => {
                  setEpisodesSidebarOpen((d) => !d);
                  setMoreOpen(false);
                  setSettingsOpen(false);
                }}
              >
                {episodesSidebarOpen ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <mask id="episodes-filled-mask">
                      <rect width="24" height="24" fill="white" />
                      <path d="M8.3 11v5l4.2-2.5z" fill="black" />
                    </mask>
                    <path d="M7 4h12a2 2 0 0 1 2 2v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <rect x="2.5" y="7" width="15" height="13" rx="2.2" fill="currentColor" mask="url(#episodes-filled-mask)" />
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="7.5" width="14" height="12" rx="2" />
                    <path d="M7 4h12a2 2 0 0 1 2 2v10" />
                    <path d="M8.5 11.2v4.6l3.8-2.3z" fill="currentColor" />
                  </svg>
                )}
              </ControlButton>

              <ControlButton
                label="Picture in picture"
                active={isPiPActive}
                onClick={togglePiP}
                className="hidden sm:grid"
              >
                {isPiPActive ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <mask id="pip-filled-mask">
                      <rect width="24" height="24" fill="white" />
                      <rect x="11.5" y="10.5" width="7.5" height="6" rx="1.2" fill="black" />
                    </mask>
                    <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" fill="currentColor" mask="url(#pip-filled-mask)" />
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
                    <rect x="12" y="11" width="7" height="5.5" rx="1" fill="currentColor" stroke="none" />
                  </svg>
                )}
              </ControlButton>

              <ControlButton label={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'} onClick={toggleFullscreen}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200 group-hover/cb:scale-110">
                  {isFullscreen ? (
                    <path d="M9 4v3a2 2 0 0 1-2 2H4M20 9h-3a2 2 0 0 1-2-2V4M15 20v-3a2 2 0 0 1 2-2h3M4 15h3a2 2 0 0 1 2 2v3" />
                  ) : (
                    <path d="M4 9V6a2 2 0 0 1 2-2h3M15 4h3a2 2 0 0 1 2 2v3M20 15v3a2 2 0 0 1-2 2h-3M9 20H6a2 2 0 0 1-2-2v-3" />
                  )}
                </svg>
              </ControlButton>
            </div>
          </div>
          </div>
        </motion.div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 8. FLOATING MORE LIKE THIS OVERLAY (NO SOLID BG, MATCHES EPISODES) */}
      {/* ------------------------------------------------------------------ */}
      <AnimatePresence>
        {moreOpen && !miniplayer && (
          <>
            {/* Click-away transparent backdrop + Smooth bottom-up ambient dark fade */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
              onClick={() => setMoreOpen(false)}
              className="fixed inset-0 z-[115]"
            >
              <div className="absolute inset-x-0 bottom-0 h-[62vh] bg-gradient-to-t from-black/95 via-black/80 to-transparent pointer-events-none" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 32, transition: { duration: 0.28, ease: [0.32, 0.72, 0, 1] } }}
              transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="fixed inset-x-0 bottom-20 z-[120] px-6 sm:px-12 select-none pointer-events-none"
            >
              {/* Floating Header */}
              <div className="flex items-center justify-between mb-3.5 pointer-events-auto">
                <div className="flex items-center gap-2.5 min-w-0">
                  <h2 className="text-[18px] sm:text-[19px] font-bold text-white tracking-tight leading-none">
                    More Like This
                  </h2>
                  <span className="text-white/25 text-xs font-semibold">·</span>
                  <span className="text-[12px] text-white/50 font-medium truncate">
                    Similar to {displayTitle}
                  </span>
                </div>

                <div className="flex items-center gap-1 bg-white/[0.07] border border-white/[0.09] rounded-full p-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      moreScrollRef.current?.scrollBy({ left: -660, behavior: 'smooth' })
                    }
                    className="w-7 h-7 rounded-full grid place-items-center text-white/75 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
                    aria-label="Scroll left"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      moreScrollRef.current?.scrollBy({ left: 660, behavior: 'smooth' })
                    }
                    className="w-7 h-7 rounded-full grid place-items-center text-white/75 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
                    aria-label="Scroll right"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Smooth Horizontal Carousel (no solid container bg, no rating badges, AnimeNexus art) */}
              <div
                ref={moreScrollRef}
                onWheel={(e) => {
                  if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && moreScrollRef.current) {
                    moreScrollRef.current.scrollLeft += e.deltaY * 1.1;
                  }
                }}
                className="flex items-center gap-4 sm:gap-5 overflow-x-auto no-scrollbar py-2 -my-2 pointer-events-auto scroll-smooth"
              >
                {recommendations.slice(0, 15).map((item, idx) => {
                  // Prioritize AnimeNexus 16:9 episode still / high-res art over cropped AniList banner strips
                  const thumb =
                    nexusArtMap[String(item.id)] ||
                    getNexusBannerForAnime(item.title, item.id) ||
                    getNexusPosterForAnime(item.title, item.id) ||
                    item.backdrop ||
                    item.backdrop_original ||
                    item.poster;
                  const year = item.year || '';
                  const genreOrType = item.genres?.[0] || item.format || 'Anime';

                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 18, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{
                        duration: 0.42,
                        delay: Math.min(idx * 0.03, 0.24),
                        ease: [0.32, 0.72, 0, 1],
                      }}
                      key={item.id}
                      onClick={() => {
                        setMoreOpen(false);
                        navigate(`/watch/anime/${item.id}/1/1?mode=${audioMode}`);
                      }}
                      className="group relative w-[250px] sm:w-[290px] md:w-[320px] shrink-0 cursor-pointer"
                    >
                      {/* Soft ambient glow on hover (matching the Episode Wheel) */}
                      {thumb && (
                        <img
                          src={thumb}
                          alt=""
                          aria-hidden
                          className="absolute inset-0 w-full h-full object-cover rounded-xl blur-2xl scale-105 opacity-0 group-hover:opacity-45 pointer-events-none transition-opacity duration-500 ease-out"
                        />
                      )}

                      <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-[#111111] ring-1 ring-white/[0.08] group-hover:ring-white/20 shadow-[0_14px_34px_rgba(0,0,0,0.75)] transition-all duration-300">
                        {thumb ? (
                          <LazyImage
                            src={thumb}
                            alt={item.title}
                            className="w-full h-full"
                            imgClassName="w-full h-full object-cover object-center group-hover:scale-[1.04] transition-transform duration-500 ease-out"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-white/30 px-3 text-center">
                            {item.title}
                          </div>
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                        {/* Hover Center Play */}
                        <div className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity duration-250">
                          <div className="w-10 h-10 rounded-full bg-white/95 text-black grid place-items-center shadow-lg scale-90 group-hover:scale-100 transition-transform duration-250 ease-out">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M7.5 5.2v13.6a.85.85 0 0 0 1.3.72l10.4-6.8a.85.85 0 0 0 0-1.44L8.8 4.48a.85.85 0 0 0-1.3.72z" />
                            </svg>
                          </div>
                        </div>

                        {/* Subtle Details Info Button on Hover */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMoreOpen(false);
                            navigate(`/anime/${item.id}`);
                          }}
                          title="View Details"
                          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/65 hover:bg-white text-white/80 hover:text-black border border-white/15 grid place-items-center opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                          </svg>
                        </button>

                        {/* Clean Bottom-Left Title & Metadata (matching "Since you watched" cards, no rating badge) */}
                        <div className="absolute inset-x-0 bottom-0 p-3.5 flex flex-col justify-end pointer-events-none">
                          <h3 className="text-[14px] font-bold text-white leading-snug line-clamp-1 drop-shadow">
                            {item.title}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-medium text-white/65">
                            {year && <span>{year}</span>}
                            {year && <span className="text-white/35">•</span>}
                            <span className="text-white/85 font-semibold">{genreOrType}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------------ */}
      {/* 9. FLOATING RIGHT-SIDE EPISODES OVERLAY MENU                       */}
      {/* ------------------------------------------------------------------ */}
      <AnimatePresence>
        {episodesSidebarOpen && !miniplayer && (
          <>
            {/* Click-away transparent backdrop + Right-side ambient vignette fade */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
              onClick={() => setEpisodesSidebarOpen(false)}
              className="fixed inset-0 z-[115]"
            >
              <div className="absolute inset-y-0 right-0 w-[85vw] sm:w-[640px] bg-gradient-to-l from-black/90 via-black/60 to-transparent pointer-events-none" />
            </motion.div>

            {(() => {
              const SPACING = 128;
              const ITEM_H = 96;
              const EASE = [0.32, 0.72, 0, 1] as const;
              const isSameSeason = String(sidebarSeasonAnilistId) === String(animeId);
              const seasonList = anime?.seasons || [];
              const seasonIdx = seasonList.findIndex((s) => s.season === sidebarSeason);
              const prevSeason = seasonIdx > 0 ? seasonList[seasonIdx - 1] : null;
              const nextSeason = seasonIdx >= 0 && seasonIdx < seasonList.length - 1 ? seasonList[seasonIdx + 1] : null;
              const total = sidebarEpisodes.length;

              return (
                <motion.aside
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 40, transition: { duration: 0.28, ease: EASE } }}
                  transition={{ duration: 0.5, ease: EASE }}
                  onClick={(e) => e.stopPropagation()}
                  className="fixed top-0 right-0 bottom-20 z-[120] w-full max-w-[440px] sm:max-w-[500px] flex flex-col justify-center pr-6 sm:pr-12 pl-8 select-none pointer-events-none"
                >
                  {/* Season header (Flush-aligned with the top episode card + inline season switcher) */}
                  <motion.div
                    initial={false}
                    animate={{
                      x: sidebarFocusIdx === 0 ? 0 : 72,
                    }}
                    transition={{ duration: 0.55, ease: EASE }}
                    className="flex items-center gap-2.5 mb-3 pointer-events-auto will-change-transform"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.h2
                        key={sidebarSeason}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.22, ease: EASE }}
                        className="text-[18px] sm:text-[19px] font-bold text-white tracking-tight leading-none"
                      >
                        Season {sidebarSeason}
                      </motion.h2>
                    </AnimatePresence>

                    <span className="text-white/25 text-xs font-semibold">·</span>
                    <span className="text-[12px] font-medium text-white/50 tabular-nums">
                      {total > 0 ? `${Math.min(sidebarFocusIdx + 1, total)} / ${total}` : '…'}
                    </span>

                    {seasonList.length > 1 && (
                      <div className="flex items-center gap-0.5 ml-1 bg-white/[0.07] border border-white/[0.09] rounded-full p-0.5">
                        <button
                          type="button"
                          disabled={!prevSeason}
                          onClick={() => prevSeason && setSidebarSeason(prevSeason.season)}
                          className="w-6 h-6 rounded-full grid place-items-center text-white/75 hover:text-white hover:bg-white/15 disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                          aria-label="Previous season"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 18l-6-6 6-6" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          disabled={!nextSeason}
                          onClick={() => nextSeason && setSidebarSeason(nextSeason.season)}
                          className="w-6 h-6 rounded-full grid place-items-center text-white/75 hover:text-white hover:bg-white/15 disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                          aria-label="Next season"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </motion.div>

                  {/* 3-up Episode Wheel (scroll / swipe / arrow keys) */}
                  <div
                    className="relative w-full pointer-events-auto"
                    style={{ height: SPACING * 3 + 24 }}
                    onWheel={(e) => {
                      const now = Date.now();
                      if (now - wheelLockRef.current < 260) {
                        wheelAccumRef.current = 0;
                        return;
                      }
                      wheelAccumRef.current += e.deltaY;
                      if (Math.abs(wheelAccumRef.current) >= 28) {
                        stepSidebarFocus(wheelAccumRef.current > 0 ? 1 : -1);
                        wheelAccumRef.current = 0;
                        wheelLockRef.current = now;
                      }
                    }}
                    onTouchStart={(e) => {
                      touchYRef.current = e.touches[0].clientY;
                    }}
                    onTouchMove={(e) => {
                      if (touchYRef.current === null) return;
                      const dy = touchYRef.current - e.touches[0].clientY;
                      if (Math.abs(dy) > 42) {
                        stepSidebarFocus(dy > 0 ? 1 : -1);
                        touchYRef.current = e.touches[0].clientY;
                      }
                    }}
                    onTouchEnd={() => {
                      touchYRef.current = null;
                    }}
                  >
                    {loadingSidebarEpisodes && sidebarEpisodes.length === 0
                      ? [-1, 0, 1].map((o) => (
                          <div
                            key={o}
                            className="absolute inset-x-0 top-1/2 flex items-center gap-4 origin-right"
                            style={{
                              height: ITEM_H,
                              marginTop: -ITEM_H / 2,
                              transform: `translateY(${o * SPACING}px) scale(${o === 0 ? 1 : 0.82})`,
                              opacity: o === 0 ? 1 : 0.4,
                            }}
                          >
                            <div className="w-[168px] aspect-video rounded-xl bg-white/10 animate-pulse shrink-0" />
                            <div className="flex-1 space-y-2">
                              <div className="h-4 w-3/4 rounded bg-white/15 animate-pulse" />
                              <div className="h-2.5 w-1/3 rounded bg-white/10 animate-pulse" />
                              <div className="h-[3px] w-full rounded bg-white/15" />
                            </div>
                          </div>
                        ))
                      : sidebarEpisodes.map((ep, idx) => {
                          // Sliding 3-slot window: first/last episodes sit in the top/bottom slot
                          // instead of leaving an empty gap, so 3 episodes are always visible.
                          const windowStart = Math.max(0, Math.min(sidebarFocusIdx - 1, Math.max(0, total - 3)));
                          const slot = idx - windowStart - 1;
                          if (Math.abs(slot) > 2) return null;
                          const isFocused = idx === sidebarFocusIdx;
                          const inView = Math.abs(slot) <= 1;
                          const isCurrent = isSameSeason && ep.episode === episodeNum;

                          const thumb =
                            ep.still ||
                            getEpisodeThumbnail(sidebarSeasonAnilistId, ep.episode) ||
                            anime?.backdrop ||
                            anime?.poster;

                          const rawTitle = ep.title?.trim() || `Episode ${ep.episode}`;
                          const cleanTitle =
                            rawTitle.toLowerCase() === `episode ${ep.episode}` ? displayTitle : rawTitle;

                          const savedEpProg = getEpisodeProgress(sidebarSeasonAnilistId, ep.episode);
                          const progressPct = isCurrent
                            ? Math.max(4, Math.min(100, (currentTime / (duration || 1440)) * 100))
                            : savedEpProg
                            ? savedEpProg.progress
                            : isSameSeason && ep.episode < episodeNum
                            ? 100
                            : 0;

                          return (
                            <motion.div
                              key={`${sidebarSeasonAnilistId}-${ep.episode}`}
                              initial={false}
                              animate={{
                                y: slot * SPACING,
                                scale: isFocused ? 1 : 0.82,
                                opacity: isFocused ? 1 : inView ? 0.42 : 0,
                              }}
                              transition={{ duration: 0.55, ease: EASE }}
                              onClick={() => {
                                if (!isFocused) {
                                  setSidebarFocusIdx(idx);
                                  return;
                                }
                                setEpisodesSidebarOpen(false);
                                if (!isCurrent) {
                                  navigate(
                                    `/watch/anime/${sidebarSeasonAnilistId}/1/${ep.episode}?mode=${audioMode}`
                                  );
                                }
                              }}
                              style={{
                                height: ITEM_H,
                                marginTop: -ITEM_H / 2,
                                transformOrigin: 'right center',
                                pointerEvents: inView ? 'auto' : 'none',
                              }}
                              className="group absolute inset-x-0 top-1/2 flex items-center gap-4 cursor-pointer will-change-transform"
                            >
                              {/* Thumbnail with soft ambient glow when focused */}
                              <div className="relative w-[168px] aspect-video shrink-0">
                                {thumb && (
                                  <img
                                    src={thumb}
                                    alt=""
                                    aria-hidden
                                    className={`absolute inset-0 w-full h-full object-cover rounded-xl blur-2xl scale-110 pointer-events-none transition-opacity duration-700 ease-out ${
                                      isFocused ? 'opacity-45' : 'opacity-0'
                                    }`}
                                  />
                                )}
                                <div
                                  className={`relative w-full h-full rounded-xl overflow-hidden bg-[#111111] shadow-[0_14px_34px_rgba(0,0,0,0.75)] ring-1 transition-[box-shadow,filter] duration-500 ease-out ${
                                    isFocused ? 'ring-white/15' : 'ring-white/[0.04]'
                                  }`}
                                  style={{ filter: isFocused ? 'saturate(1)' : 'saturate(0.55)' }}
                                >
                                {thumb ? (
                                  <LazyImage
                                    src={thumb}
                                    alt=""
                                    className="w-full h-full"
                                    imgClassName="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white/30">
                                    EP {ep.episode}
                                  </div>
                                )}
                                {isFocused && !isCurrent && (
                                  <div className="absolute inset-0 grid place-items-center bg-black/0 group-hover:bg-black/35 transition-colors duration-300">
                                    <div className="w-9 h-9 rounded-full bg-white/95 text-black grid place-items-center opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 ease-out">
                                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M7.5 5.2v13.6a.85.85 0 0 0 1.3.72l10.4-6.8a.85.85 0 0 0 0-1.44L8.8 4.48a.85.85 0 0 0-1.3.72z" />
                                      </svg>
                                    </div>
                                  </div>
                                )}
                                </div>
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                {isCurrent && (
                                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-white/85 tracking-tight mb-0.5">
                                    <span className="flex items-end gap-[2px] h-[11px]" aria-hidden>
                                      <span className="w-[2px] h-full rounded-full bg-white origin-bottom eq-bar-1" />
                                      <span className="w-[2px] h-full rounded-full bg-white origin-bottom eq-bar-2" />
                                      <span className="w-[2px] h-full rounded-full bg-white origin-bottom eq-bar-3" />
                                    </span>
                                    Now Playing
                                  </span>
                                )}
                                <h3 className="text-[16.5px] font-bold text-white leading-snug truncate">
                                  {cleanTitle}
                                </h3>
                                <p className="text-[11.5px] font-medium text-white/65 mt-0.5">
                                  Episode {ep.episode}
                                </p>
                                <div className="mt-2 h-[3px] w-full rounded-full bg-white/20 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-white"
                                    style={{ width: `${progressPct}%` }}
                                  />
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                  </div>
                </motion.aside>
              );
            })()}
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
