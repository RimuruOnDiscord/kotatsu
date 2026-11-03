export interface AnimeSeasonItem {
  season: number;
  anilistId?: number | string;
  idMal?: number | null;
  name?: string;
  fullTitle?: string;
  episodes?: number | null;
  year?: number | string | null;
}

export interface AnimeMedia {
  id: number | string;
  idMal?: number | null;
  imdb_id?: string | null;
  tmdb_id?: number | string | null;
  type?: 'anime' | 'tv' | 'movie';
  title: string;
  title_native?: string | null;
  year?: string | number | null;
  poster?: string | null;
  backdrop?: string | null;
  backdrop_original?: string | null;
  logo?: string | null;
  logo_backdrop?: string | null;
  rating?: string | number | null;
  overview?: string | null;
  format?: string | null;
  episodes?: number | null;
  runtime?: number | null;
  genres?: string[];
  mature?: boolean;
  status?: string | null;
  seasons?: AnimeSeasonItem[];
  studios?: Array<{ id?: number; name: string; siteUrl?: string | null }>;
  season_name?: string | null;
  start_date?: { year?: number; month?: number; day?: number } | null;
  synonyms?: string[];
  tags?: string[];
  siteUrl?: string | null;
  duration?: number | null;
  popularity?: number | null;
  externalLinks?: Array<{ site: string; url: string }>;
  cast?: Array<{
    id: number | string;
    name: string;
    character?: string;
    profile?: string | null;
    photo?: string | null;
  }>;
  similars?: AnimeMedia[];
  trailer?: {
    id?: string | null;
    site?: string | null;
    thumbnail?: string | null;
  } | null;
}

export interface AnimeEpisode {
  episode: number;
  title: string;
  overview?: string | null;
  still?: string | null;
  rating?: number | string | null;
  air_date?: string | null;
  runtime?: number | null;
  filler?: boolean;
}

export interface NextAiringEpisode {
  episode: number;
  airingAt: number;
  timeUntilAiring: number;
}

export interface AnimeEpisodesResponse {
  total: number;
  chunk: number;
  chunkSize: number;
  totalChunks: number;
  nextAiringEpisode?: NextAiringEpisode | null;
  episodes: AnimeEpisode[];
}

export interface SubtitleTrack {
  url: string;
  lang: string;
  label: string;
  format?: string;
  default?: boolean;
  /** Per-track referer some providers require (falls back to the stream referer). */
  referer?: string;
}

export interface EmbedOption {
  name: string;
  url: string;
  type?: string;
}

export interface StreamSource {
  id: string;
  provider: string;
  name: string;
  url: string;
  embedUrl?: string;
  embeds?: EmbedOption[];
  type: 'hls' | 'mp4' | 'embed';
  lang: 'sub' | 'dub' | 'multi';
  subtitles?: SubtitleTrack[];
  chapters?: string;
  storyboard?: string;
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
  /** Referer the CDN expects — required by most HLS hosts or they return 403 */
  referer?: string;
}

export interface SkipTimes {
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
}

export interface CategoryCollection {
  id: string;
  name: string;
  slug: string;
  type: 'studio' | 'genre' | 'theme';
  logo?: string;
  video?: string;
  backdrop?: string;
  gradient?: string;
  description?: string;
  filterGenre?: string;
  filterStudio?: string;
  filterFormat?: string;
}

const ANIVEXA_BASE = '/anivexa';
const ANILIST_GQL = 'https://graphql.anilist.co';
const ANIZIP_API = 'https://api.ani.zip/mappings';

export const ANIVEXA_PROVIDERS = [
  { id: 'nexus', name: 'Nexus (Direct HLS + 1080p)' },
  { id: 'anizone', name: 'AniZone (HLS + Subs)' },
  { id: 'aniwaves', name: 'AniWaves (HLS / MP4)' },
  { id: 'anikoto', name: 'AniKoto (Multi-Server)' },
  { id: 'animenosub', name: 'AnimeNoSub (Sub & Dub)' },
  { id: 'anipm', name: 'Ani.pm (Soft/Hard Sub)' },
  { id: 'reanime', name: 'ReAnime (Fast Stream)' },
  { id: 'senshi', name: 'Senshi (HD)' },
  { id: 'kaa', name: 'KickAssAnime' },
  { id: 'animegg', name: 'AnimeGG' },
] as const;

export type AnivexaProviderId = (typeof ANIVEXA_PROVIDERS)[number]['id'];

const responseCache = new Map<string, { data: any; expiry: number }>();

async function cachedFetch<T>(url: string, ttlMs = 5 * 60 * 1000, timeoutMs = 8000): Promise<T> {
  const cached = responseCache.get(url);
  if (cached && cached.expiry > Date.now()) {
    return cached.data as T;
  }
  // Abort slow upstreams quickly so a dead mirror never stalls the UI
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) {
    throw new Error(`API error ${res.status} for ${url}`);
  }
  const data = await res.json();
  responseCache.set(url, { data, expiry: Date.now() + ttlMs });
  return data as T;
}

function stripHtml(html?: string | null): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeStudios(rawStudios: any): Array<{ id?: number; name: string }> {
  if (!Array.isArray(rawStudios)) return [];
  return rawStudios
    .map((s, idx) => {
      if (typeof s === 'string') return { id: idx, name: s };
      if (s && typeof s === 'object' && s.name) return { id: s.id ?? idx, name: String(s.name) };
      return null;
    })
    .filter(Boolean) as Array<{ id?: number; name: string }>;
}

function normalizeCast(rawCast: any): Array<{
  id: number | string;
  name: string;
  character?: string;
  profile?: string | null;
  photo?: string | null;
}> {
  if (!Array.isArray(rawCast)) return [];
  return rawCast.map((c, idx) => {
    const img = c.photo || c.profile || c.image?.large || null;
    return {
      id: c.id ?? idx,
      name: c.name?.full || c.name || 'Character',
      character: c.character || '',
      profile: img,
      photo: img,
    };
  });
}

let nexusPostersCache: Record<string, string> = {};

export async function initNexusPosters(): Promise<Record<string, string>> {
  try {
    const res = await fetch('/api/nexus/posters-map');
    if (res.ok) {
      const map = await res.json();
      if (map && typeof map === 'object') {
        nexusPostersCache = { ...nexusPostersCache, ...map };
        return nexusPostersCache;
      }
    }
  } catch {
    // ignore
  }
  return nexusPostersCache;
}

if (typeof window !== 'undefined') {
  initNexusPosters().catch(() => {});
}

export function getNexusPosterForAnime(title?: string, id?: number | string): string | null {
  if (id && NEXUS_TOP_10_ART[Number(id)]?.poster) {
    return NEXUS_TOP_10_ART[Number(id)].poster;
  }
  if (!title) return null;
  const clean = title.toLowerCase().trim();
  if (nexusPostersCache[clean]) return nexusPostersCache[clean];

  return null;
}

export function getNexusBannerForAnime(title?: string, id?: number | string): string | null {
  if (!title) return null;
  const clean = title.toLowerCase().trim();
  if (nexusPostersCache[`banner:${clean}`]) return nexusPostersCache[`banner:${clean}`];
  if (id && NEXUS_TOP_10_ART[Number(id)]?.poster) {
    return NEXUS_TOP_10_ART[Number(id)].poster;
  }
  if (nexusPostersCache[clean]) return nexusPostersCache[clean];
  return null;
}

const inFlightNexusArt = new Map<string, Promise<{ poster: string | null; banner: string | null }>>();

/**
 * Resolves AnimeNexus artwork (16:9 HD episode still `banner` + 2:3 `poster`) for a title,
 * fetching from `/api/anime?q=...` and caching if not already in memory.
 */
export async function fetchNexusArtForAnime(
  title?: string,
  id?: number | string
): Promise<{ poster: string | null; banner: string | null }> {
  if (!title) return { poster: null, banner: null };
  const clean = title.toLowerCase().trim();
  const cachedPoster = getNexusPosterForAnime(title, id);
  const cachedBanner = nexusPostersCache[`banner:${clean}`] || null;
  if (cachedPoster && cachedBanner) {
    return { poster: cachedPoster, banner: cachedBanner };
  }

  const existing = inFlightNexusArt.get(clean);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const res = await fetch(`/api/anime?q=${encodeURIComponent(title)}`);
      if (!res.ok) return { poster: cachedPoster, banner: cachedBanner };
      const json = await res.json();
      if (json?.success === false) {
        return { poster: cachedPoster, banner: cachedBanner };
      }
      const poster: string | null = json?.art?.poster || cachedPoster || null;
      const banner: string | null = json?.episodes?.[0]?.thumbnail || poster || null;
      if (poster) {
        nexusPostersCache[clean] = poster;
        if (json?.anime?.name) {
          nexusPostersCache[json.anime.name.toLowerCase().trim()] = poster;
        }
      }
      if (banner) {
        nexusPostersCache[`banner:${clean}`] = banner;
        if (json?.anime?.name) {
          nexusPostersCache[`banner:${json.anime.name.toLowerCase().trim()}`] = banner;
        }
      }
      return { poster, banner };
    } catch {
      return { poster: cachedPoster, banner: cachedBanner };
    } finally {
      inFlightNexusArt.delete(clean);
    }
  })();

  inFlightNexusArt.set(clean, promise);
  return promise;
}

function normalizeAnimeItem(item: any): AnimeMedia {
  if (!item) return item;
  const rawTitle =
    typeof item.title === 'object'
      ? item.title?.english || item.title?.romaji || item.title?.native || 'Untitled Anime'
      : item.title || item.name || 'Untitled Anime';

  const nexusPoster =
    getNexusPosterForAnime(rawTitle, item.id) ||
    item.nexusPoster ||
    null;

  return {
    ...item,
    id: item.id,
    type: 'anime',
    title: rawTitle,
    year:
      item.year ||
      item.seasonYear ||
      item.startDate?.year ||
      (item.release_date ? String(item.release_date).slice(0, 4) : ''),
    poster:
      nexusPoster ||
      item.poster ||
      item.poster_path ||
      item.coverImage?.extraLarge ||
      item.coverImage?.large ||
      null,
    backdrop:
      item.backdrop ||
      item.backdrop_path ||
      item.bannerImage ||
      item.coverImage?.extraLarge ||
      item.poster ||
      null,
    rating:
      item.rating && Number(item.rating) > 0
        ? Number(item.rating).toFixed(1)
        : item.averageScore
        ? (Number(item.averageScore) / 10).toFixed(1)
        : null,
    overview: stripHtml(item.overview || item.description),
    genres: Array.isArray(item.genres)
      ? item.genres.map((g: any) => (typeof g === 'string' ? g : g?.name || '')).filter(Boolean)
      : [],
    studios: normalizeStudios(item.studios?.nodes || item.studios),
    cast: normalizeCast(item.cast),
    popularity: item.popularity || null,
    externalLinks: Array.isArray(item.externalLinks)
      ? item.externalLinks
          .filter((l: any) => l && l.site && l.url)
          .map((l: any) => ({ site: l.site, url: l.url }))
      : [],
    trailer: item.trailer
      ? {
          id: typeof item.trailer.id === 'string' ? item.trailer.id.trim() : item.trailer.id,
          site: item.trailer.site,
          thumbnail: item.trailer.thumbnail,
        }
      : null,
  };
}

const ANILIST_MEDIA_FRAGMENT = `
  id
  idMal
  title { english romaji native }
  description(asHtml: false)
  seasonYear
  season
  startDate { year month day }
  format
  status
  episodes
  duration
  genres
  synonyms
  tags { name }
  siteUrl
  isAdult
  averageScore
  bannerImage
  coverImage { extraLarge large }
  studios(isMain: true) { nodes { id name siteUrl } }
  popularity
  externalLinks { site url }
  trailer { id site thumbnail }
`;

async function queryAniList(query: string, variables: Record<string, any> = {}, ttlMs = 5 * 60 * 1000): Promise<any> {
  const cacheKey = `gql:${query.replace(/\s+/g, ' ').trim()}:${JSON.stringify(variables)}`;
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  // 1. First try SQLite-backed smart GraphQL proxy with Nexus fallback
  try {
    const proxyRes = await fetch('/api/gql-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(10000),
    });
    if (proxyRes.ok) {
      const json = await proxyRes.json();
      if (json?.data) {
        responseCache.set(cacheKey, { data: json.data, expiry: Date.now() + ttlMs });
        return json.data;
      }
    }
  } catch {
    // If local proxy failed, continue to direct AniList
  }

  // 2. Fallback to direct AniList GraphQL
  const res = await fetch(ANILIST_GQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`AniList GQL ${res.status}`);
  const json = await res.json();
  if (json.data) {
    responseCache.set(cacheKey, { data: json.data, expiry: Date.now() + ttlMs });
  }
  return json.data;
}

export async function fetchAniZipData(anilistId: string | number): Promise<any | null> {
  try {
    return await cachedFetch<any>(`${ANIZIP_API}?anilist_id=${anilistId}`, 15 * 60 * 1000);
  } catch {
    return null;
  }
}

export async function fetchEpisodeThumbnail(
  anilistId: string | number,
  episode: number
): Promise<string | null> {
  try {
    const anizip = await fetchAniZipData(anilistId);
    const epObj = anizip?.episodes?.[String(episode)];
    if (epObj?.image) {
      return epObj.image;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function fetchNexusAnime(query: string, ep?: number): Promise<any | null> {
  try {
    const res = await fetch(`/api/anime?q=${encodeURIComponent(query)}${ep ? `&ep=${ep}` : ''}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export interface AiringScheduleEntry {
  id: number;
  episode: number;
  airingAt: number; // unix seconds
  media: AnimeMedia & { totalEpisodes?: number | null; countryOfOrigin?: string | null };
}

const AIRING_SCHEDULE_GQL = `
  query ($page: Int, $start: Int, $end: Int) {
    Page(page: $page, perPage: 50) {
      pageInfo { hasNextPage }
      airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
        id
        episode
        airingAt
        media {
          ${ANILIST_MEDIA_FRAGMENT}
          countryOfOrigin
          popularity
        }
      }
    }
  }
`;

/**
 * Fetch every episode airing between two unix timestamps (seconds) from AniList,
 * following pagination. Adult titles and music videos are excluded.
 */
export async function fetchAiringSchedule(startSec: number, endSec: number): Promise<AiringScheduleEntry[]> {
  const all: any[] = [];
  for (let page = 1; page <= 10; page++) {
    const data = await queryAniList(
      AIRING_SCHEDULE_GQL,
      { page, start: startSec - 1, end: endSec },
      10 * 60 * 1000
    );
    const chunk = data?.Page?.airingSchedules || [];
    all.push(...chunk);
    if (!data?.Page?.pageInfo?.hasNextPage) break;
  }

  return all
    .filter((s) => s?.media && !s.media.isAdult && s.media.format !== 'MUSIC')
    .map((s) => ({
      id: s.id,
      episode: s.episode,
      airingAt: s.airingAt,
      media: {
        ...normalizeAnimeItem(s.media),
        totalEpisodes: s.media.episodes ?? null,
        countryOfOrigin: s.media.countryOfOrigin ?? null,
      },
    }));
}

export async function fetchTrendingAnime(page = 1): Promise<{ results: AnimeMedia[]; total_pages: number }> {
  // api.bingr.one is offline — AniList GraphQL is the primary source
  const gql = `
    query ($page: Int) {
      Page(page: $page, perPage: 20) {
        pageInfo { lastPage }
        media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
          ${ANILIST_MEDIA_FRAGMENT}
        }
      }
    }
  `;
  const data = await queryAniList(gql, { page });
  return {
    results: (data?.Page?.media || []).map(normalizeAnimeItem),
    total_pages: data?.Page?.pageInfo?.lastPage || 1,
  };
}

export const TOP_10_ANIME_IDS = [
  21613,  // Saga of Tanya the Evil (Youjo Senki)
  120377, // Cyberpunk: Edgerunners
  11061,  // Hunter x Hunter (2011)
  127230, // Chainsaw Man
  154587, // Frieren: Beyond Journey's End (Sousou no Frieren)
  101921, // Kaguya-sama: Love Is War
  113415, // Jujutsu Kaisen
  16498,  // Attack on Titan (Shingeki no Kyojin)
  151807, // Solo Leveling
  101922, // Demon Slayer: Kimetsu no Yaiba
];

export const NEXUS_TOP_10_ART: Record<
  number,
  {
    poster: string;
    logo?: string;
    trailerId?: string;
    backdrop?: string;
    title: string;
    year: number;
    rating: string;
    format: string;
    overview: string;
    genres: string[];
  }
> = {
  21613: {
    title: 'Saga of Tanya the Evil',
    year: 2017,
    rating: '7.8',
    format: 'TV',
    overview:
      'A little girl with blonde hair, blue eyes, and porcelain skin commands the imperial army. Tanya Degurechaff has ruthless efficiency and formidable magic.',
    genres: ['Action', 'Fantasy', 'Military'],
    poster:
      'https://anime.delivery/vaJh2BBwRT-CKfITrAjfhVKfoKLRFhIu-h-_ED10fJk/rs:fill/q:70/w:1560/h:2340/aHR0cHM6Ly9hc3Nl/dHMuYW5pbWUubmV4/dXMvc3RvcmFnZS9h/cHAvc2hvd3MvcHVi/bGljLzVlZi85Yzkv/NWFkLzVlZjljOTVh/ZGI3Mjg0MzczODM0/MTkucG5n.avif',
    backdrop: 'https://artworks.thetvdb.com/banners/fanart/original/315500-3.jpg',
    logo: 'https://assets.anime.nexus/storage/app/shows/public/5ef/9c9/9c4/5ef9c99c41e36359465146.png',
    trailerId: 'JwaruTPKq9I',
  },
  120377: {
    title: 'Cyberpunk: Edgerunners',
    year: 2022,
    rating: '8.5',
    format: 'ONA',
    overview:
      'In a dystopia riddled with corruption and cybernetic implants, a talented but reckless street kid strives to become an edgerunner — a mercenary outlaw.',
    genres: ['Action', 'Sci-Fi', 'Psychological'],
    poster:
      'https://anime.delivery/TBt8ai-0-Cz4PDYOriEg_kIotgxfyegA_HDjwJu793s/rs:fill/q:70/w:1560/h:2340/aHR0cHM6Ly9hc3Nl/dHMuYW5pbWUubmV4/dXMvc3RvcmFnZS9h/cHAvc2hvd3MvcHVi/bGljLzY4OS8xYjgv/MzAxLzY4OTFiODMw/MTkxYjM1ODI4OTAw/MDkucG5n.avif',
    backdrop: 'https://artworks.thetvdb.com/banners/v4/series/384541/backgrounds/632f460a7d19a.jpg',
    logo: 'https://assets.anime.nexus/storage/app/shows/public/689/1b7/283/6891b7283af92977879275.png',
    trailerId: 'ax5YUmkWf_Y',
  },
  11061: {
    title: 'Hunter x Hunter (2011)',
    year: 2011,
    rating: '9.0',
    format: 'TV',
    overview:
      'Gon Freecss aspires to become a Hunter, an exceptional being capable of greatness. Together with his friends, he embarks on an unforgettable journey to find his father.',
    genres: ['Action', 'Adventure', 'Fantasy'],
    poster:
      'https://anime.delivery/TfJD3i0e1_jEYLw655lOf3adHUKYQxZW_KyCE5sgLAY/rs:fill/q:70/w:1560/h:2340/aHR0cHM6Ly9hc3Nl/dHMuYW5pbWUubmV4/dXMvc3RvcmFnZS9h/cHAvc2hvd3MvcHVi/bGljLzVlZi9mZjMv/ZTliLzVlZmZmM2U5/YmMyZDcwNzYzOTQ1/NjMucG5n.avif',
    backdrop: 'https://artworks.thetvdb.com/banners/series/252322/backgrounds/62061579.jpg',
    logo: 'https://assets.anime.nexus/storage/app/shows/public/5ef/ff4/2bf/5efff42bf3a4c557152901.png',
    trailerId: 'd6kBeJjTGnY',
  },
  127230: {
    title: 'Chainsaw Man',
    year: 2022,
    rating: '8.4',
    format: 'TV',
    overview:
      'Denji is a teenage boy living with a Chainsaw Devil named Pochita. Forced into debt repayment, his life is transformed when he merges with Pochita to become Chainsaw Man.',
    genres: ['Action', 'Supernatural', 'Gore'],
    poster:
      'https://anime.delivery/v9WwHrEoNAJOqdHRgKNwdhGMmcTkcJ8OqnjT2AGtLXs/rs:fill/q:70/w:1560/h:2340/aHR0cHM6Ly9hc3Nl/dHMuYW5pbWUubmV4/dXMvc3RvcmFnZS9h/cHAvc2hvd3MvcHVi/bGljLzY1Mi8wY2Ev/MWQwLzY1MjBjYTFk/MDJjNmUxNTAyODI5/MzcucG5n.avif',
    backdrop: 'https://artworks.thetvdb.com/banners/v4/series/397934/backgrounds/62f7545a78181.jpg',
    logo: 'https://assets.anime.nexus/storage/app/shows/public/652/0d2/e7d/6520d2e7dfbd2652254624.png',
    trailerId: 'v4yLeNt-kCU',
  },
  154587: {
    title: "Frieren: Beyond Journey's End",
    year: 2023,
    rating: '9.3',
    format: 'TV',
    overview:
      'The adventure is over, but life goes on for an elf mage just beginning to learn what living is all about. A profoundly moving quest through time and memory.',
    genres: ['Adventure', 'Drama', 'Fantasy'],
    poster:
      'https://anime.delivery/znqiX3ZG5QllybaQ_-yBTi3yXuPE0qo9AlNpSzi1PwQ/rs:fill/q:70/w:1560/h:2340/aHR0cHM6Ly9hc3Nl/dHMuYW5pbWUubmV4/dXMvc3RvcmFnZS9h/cHAvc2hvd3MvcHVi/bGljLzY1MS8xYjEv/NTdiLzY1MTFiMTU3/YjliZDk0MTcyOTg2/MTMucG5n.avif',
    backdrop: 'https://artworks.thetvdb.com/banners/v4/series/424536/backgrounds/64e6cbe29d9c0.jpg',
    logo: 'https://assets.anime.nexus/storage/app/shows/public/651/742/2e3/6517422e3ae44242497865.png',
    trailerId: 'tR8YH0G67Rk',
  },
  101921: {
    title: 'Kaguya-sama: Love Is War',
    year: 2019,
    rating: '8.6',
    format: 'TV',
    overview:
      'Miyuki Shirogane and Kaguya Shinomiya lead the illustrious Shuchiin Academy student council. Too proud to confess first, both devise elaborate schemes to force a confession.',
    genres: ['Comedy', 'Psychological', 'Romance'],
    poster:
      'https://anime.delivery/2E8S0-QY1NY2whlSnlSV0iN9eiMw8S00eVDeTEcGf6E/rs:fill/q:70/w:1560/h:2340/aHR0cHM6Ly9hc3Nl/dHMuYW5pbWUubmV4/dXMvc3RvcmFnZS9h/cHAvc2hvd3MvcHVi/bGljLzY4NS9hNDEv/YTMwLzY4NWE0MWEz/MGE1MjIyMDAyNDYy/MDMucG5n.avif',
    backdrop: 'https://artworks.thetvdb.com/banners/v4/series/354198/backgrounds/6063329920f37.jpg',
    logo: null,
    trailerId: 'IwpJJiQkZzI',
  },
  113415: {
    title: 'Jujutsu Kaisen',
    year: 2020,
    rating: '8.6',
    format: 'TV',
    overview:
      'A high school prodigy swallows a cursed talisman — the finger of the King of Curses Ryomen Sukuna — diving into the dangerous world of Jujutsu Sorcerers.',
    genres: ['Action', 'Fantasy', 'Supernatural'],
    poster:
      'https://anime.delivery/nOSGFwo8LE2bul2lXjsS2hB8x7gM48UGmcFeJpI-dUc/rs:fill/q:70/w:1560/h:2340/aHR0cHM6Ly9hc3Nl/dHMuYW5pbWUubmV4/dXMvc3RvcmFnZS9h/cHAvc2hvd3MvcHVi/bGljLzVmZi8xZDIv/ZmI1LzVmZjFkMmZi/NTc1OWI3MDgyMzQ5/ODUucG5n.avif',
    backdrop: 'https://artworks.thetvdb.com/banners/v4/series/377543/backgrounds/609cba7794bab.jpg',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/4/49/Jujutsu_Kaisen_logo.png',
    trailerId: 'RIyb52EMx8c',
  },
  16498: {
    title: 'Attack on Titan',
    year: 2013,
    rating: '8.9',
    format: 'TV',
    overview:
      'When ravenous humanoids called Titans breach humanity’s last fortified sanctuary, Eren Yeager vows to eliminate every last Titan from the face of the Earth.',
    genres: ['Action', 'Drama', 'Fantasy', 'Mystery'],
    poster:
      'https://anime.delivery/Rea_scAswuwEM8_kt_JjJ7gLUwanza4c4Wv4E6RxeiM/rs:fill/q:70/w:1560/h:2340/aHR0cHM6Ly9hc3Nl/dHMuYW5pbWUubmV4/dXMvc3RvcmFnZS9h/cHAvc2hvd3MvcHVi/bGljLzVjYS80NGEv/OWZkLzVjYTQ0YTlm/ZGZlNDE1ODk1NjYw/NjEuanBn.avif',
    backdrop: 'https://artworks.thetvdb.com/banners/series/267440/backgrounds/5f8611eaa79ff.jpg',
    logo: 'https://assets.anime.nexus/storage/app/shows/public/680/20c/87b/68020c87b5ce7737413931.png',
    trailerId: 'LHtdKWJdif4',
  },
  151807: {
    title: 'Solo Leveling',
    year: 2024,
    rating: '8.4',
    format: 'TV',
    overview:
      'Known as the Weakest Hunter of All Mankind, Sung Jinwoo awakens in a hospital with a mysterious floating quest log only he can see, beginning his path as the Shadow Monarch.',
    genres: ['Action', 'Adventure', 'Fantasy'],
    poster:
      'https://anime.delivery/hlbMX8mZCd3OdtGuYFv7CMRM1lfAQ21QT7lz3IKBK20/rs:fill/q:70/w:1560/h:2340/aHR0cHM6Ly9hc3Nl/dHMuYW5pbWUubmV4/dXMvc3RvcmFnZS9h/cHAvc2hvd3MvcHVi/bGljLzY1OS85OTgv/Nzk2LzY1OTk5ODc5/Njk2ZGIyMTg4NTM4/NTgucG5n.avif',
    backdrop: 'https://artworks.thetvdb.com/banners/v4/series/389597/backgrounds/61ed3bc02a309.jpg',
    logo: 'https://assets.anime.nexus/storage/app/shows/public/659/999/7f9/6599997f9d769049658716.png',
    trailerId: 'HkIKAnwLZCw',
  },
  101922: {
    title: 'Demon Slayer: Kimetsu no Yaiba',
    year: 2019,
    rating: '8.5',
    format: 'TV',
    overview:
      'Tanjiro Kamado sets out on a perilous journey to become a demon slayer and find a cure to turn his demonized sister Nezuko back into a human.',
    genres: ['Action', 'Fantasy', 'Historical'],
    poster:
      'https://anime.delivery/F8jXwQ09GfpbCR01Ehgt-HdHoxg8VIOWvOeigkN2bJg/rs:fill/q:70/w:1560/h:2340/aHR0cHM6Ly9hc3Nl/dHMuYW5pbWUubmV4/dXMvc3RvcmFnZS9h/cHAvc2hvd3MvcHVi/bGljLzVlZi9jNzYv/MDk4LzVlZmM3NjA5/ODM4NDQ5MTE2MTU5/MTUucG5n.avif',
    backdrop: 'https://artworks.thetvdb.com/banners/fanart/original/5c93cbb2b60b6.jpg',
    logo: 'https://assets.anime.nexus/storage/app/shows/public/5e9/309/cb5/5e9309cb584ab772764873.png',
    trailerId: '6vMuWuWlW4I',
  },
};

export const ENGLISH_ANIME_LOGOS: Record<string | number, string> = {
  21613: 'https://assets.anime.nexus/storage/app/shows/public/5ef/9c9/9c4/5ef9c99c41e36359465146.png', // Saga of Tanya the Evil
  120377: 'https://assets.anime.nexus/storage/app/shows/public/689/1b7/283/6891b7283af92977879275.png', // Cyberpunk: Edgerunners
  11061: 'https://assets.anime.nexus/storage/app/shows/public/5ef/ff4/2bf/5efff42bf3a4c557152901.png', // Hunter x Hunter
  127230: 'https://assets.anime.nexus/storage/app/shows/public/652/0d2/e7d/6520d2e7dfbd2652254624.png', // Chainsaw Man
  154587: 'https://assets.anime.nexus/storage/app/shows/public/651/742/2e3/6517422e3ae44242497865.png', // Frieren
  113415: 'https://upload.wikimedia.org/wikipedia/commons/4/49/Jujutsu_Kaisen_logo.png', // Jujutsu Kaisen
  16498: 'https://assets.anime.nexus/storage/app/shows/public/680/20c/87b/68020c87b5ce7737413931.png', // Attack on Titan
  151807: 'https://assets.anime.nexus/storage/app/shows/public/659/999/7f9/6599997f9d769049658716.png', // Solo Leveling
  101922: 'https://assets.anime.nexus/storage/app/shows/public/5e9/309/cb5/5e9309cb584ab772764873.png', // Demon Slayer
  21: 'https://assets.anime.nexus/storage/app/shows/public/67f/437/a19/67f437a19a8de889151289.png', // One Piece
  269: 'https://assets.anime.nexus/storage/app/shows/public/5e9/554/b23/5e9554b233388479137139.png', // Bleach
  20: 'https://assets.anime.nexus/storage/app/shows/public/5f5/b6c/831/5f5b6c8315506812744654.png', // Naruto
  1535: 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Death_Note_logo.svg', // Death Note
  163132: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Oshi_no_Ko_logo.svg', // Oshi no Ko
  101348: 'https://assets.anime.nexus/storage/app/shows/public/5ed/c0f/e50/5edc0fe50a67e982984261.png', // Vinland Saga
  21459: 'https://assets.anime.nexus/storage/app/shows/public/5e9/094/11a/5e909411a5a6c807652454.png', // My Hero Academia
  101280: 'https://images.metahub.space/logo/medium/tt9054364/img', // That Time I Got Reincarnated as a Slime
  116742: 'https://images.metahub.space/logo/medium/tt9054364/img', // Slime Season 2
  156822: 'https://images.metahub.space/logo/medium/tt9054364/img', // Slime Season 3
};

function isValidClearLogoUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim().toLowerCase();
  if (!clean) return false;
  // Reject TVDB square opaque icons, posters, backgrounds, and non-transparent JPEGs
  if (clean.includes('/icons/') || clean.includes('/posters/') || clean.includes('/backgrounds/')) {
    return false;
  }
  if (/\.jpe?g($|\?)/i.test(clean)) {
    return false;
  }
  return true;
}

export async function fetchTop10CuratedAnime(): Promise<AnimeMedia[]> {
  try {
    const gql = `
      query ($ids: [Int]) {
        Page(page: 1, perPage: 15) {
          media(id_in: $ids, type: ANIME) {
            ${ANILIST_MEDIA_FRAGMENT}
          }
        }
      }
    `;
    const data = await queryAniList(gql, { ids: TOP_10_ANIME_IDS }, 60 * 60 * 1000);
    const mediaList = data?.Page?.media || [];
    const normalized = mediaList.map(normalizeAnimeItem);

    // Sort strictly in the exact order of TOP_10_ANIME_IDS with AnimeNexus posters & English logos
    const sorted = TOP_10_ANIME_IDS.map((id) => {
      const art = NEXUS_TOP_10_ART[id];
      const m = normalized.find((item: AnimeMedia) => Number(item.id) === id);
      if (m) {
        return {
          ...m,
          rating: m.rating || art?.rating || null,
          poster: art?.poster || m.poster,
          logo: art?.logo || m.logo,
          backdrop: art?.backdrop || m.backdrop,
          trailer: (art?.trailerId ? { id: art.trailerId, site: 'youtube' } : null) || m.trailer,
        };
      }
      if (art) {
        return {
          id,
          type: 'anime',
          title: art.title,
          year: art.year,
          rating: art.rating,
          format: art.format,
          overview: art.overview,
          genres: art.genres,
          poster: art.poster,
          backdrop: art.backdrop,
          logo: art.logo,
          trailer: { id: art.trailerId, site: 'youtube' },
        } as AnimeMedia;
      }
      return null;
    }).filter(Boolean) as AnimeMedia[];

    if (sorted.length >= 6) {
      return sorted;
    }
  } catch (err) {
    console.warn('[fetchTop10CuratedAnime] error:', err);
  }

  // Fallback to high-res AnimeNexus curated dataset
  return TOP_10_ANIME_IDS.map((id) => {
    const art = NEXUS_TOP_10_ART[id];
    return {
      id,
      type: 'anime',
      title: art.title,
      year: art.year,
      rating: art.rating,
      format: art.format,
      overview: art.overview,
      genres: art.genres,
      poster: art.poster,
      backdrop: art.backdrop,
      logo: art.logo,
      trailer: { id: art.trailerId, site: 'youtube' },
    } as AnimeMedia;
  });
}

export interface DiscoverAnimeParams {
  page?: number;
  perPage?: number;
  search?: string;
  sort?: 'POPULARITY_DESC' | 'SCORE_DESC' | 'START_DATE_DESC' | 'TRENDING_DESC';
  genre?: string;
  year?: string | number;
  format?: 'TV' | 'TV_SHORT' | 'MOVIE' | 'SPECIAL' | 'OVA' | 'ONA' | '';
  status?: 'RELEASING' | 'FINISHED' | 'NOT_YET_RELEASED' | '';
  episodesRange?: '1-12' | '13-26' | '27-100' | '100+' | '';
  studio?: string;
  richMeta?: boolean;
  isAdult?: boolean;
}

export async function fetchDiscoverAnime(
  params: DiscoverAnimeParams = {}
): Promise<{ results: AnimeMedia[]; total_pages: number }> {
  const page = params.page || 1;
  const perPage = params.perPage || 24;
  // If filtering by a specific Studio, query AniList Studio media connection
  if (params.studio && params.studio !== 'All') {
    const studioGql = `
      query ($studio: String, $page: Int, $perPage: Int) {
        Studio(search: $studio) {
          id
          name
          media(sort: [POPULARITY_DESC], isMain: true, page: $page, perPage: $perPage) {
            pageInfo { lastPage hasNextPage }
            nodes {
              ${ANILIST_MEDIA_FRAGMENT}
            }
          }
        }
      }
    `;
    try {
      const data = await queryAniList(studioGql, {
        studio: params.studio,
        page,
        perPage: 50,
      });
      const studioName = data?.Studio?.name || params.studio;
      let items: AnimeMedia[] = (data?.Studio?.media?.nodes || [])
        .filter((n: any) => !n.isAdult && n.format !== 'MUSIC')
        .map((n: any) => {
          const norm = normalizeAnimeItem(n);
          if (!norm.studios || norm.studios.length === 0) {
            norm.studios = [{ name: studioName }];
          }
          return norm;
        });

      if (params.search && params.search.trim()) {
        const q = params.search.trim().toLowerCase();
        items = items.filter((i) => i.title.toLowerCase().includes(q));
      }
      if (params.genre && params.genre !== 'All') {
        const g = params.genre.toLowerCase();
        items = items.filter((i) => i.genres?.some((ig) => ig.toLowerCase() === g));
      }
      if (params.format && params.format !== ('All' as any)) {
        items = items.filter((i) => i.format === params.format);
      }
      if (params.status && params.status !== ('All' as any)) {
        items = items.filter((i) => i.status === params.status);
      }
      if (params.year && params.year !== 'All') {
        items = items.filter((i) => String(i.year) === String(params.year));
      }
      if (params.episodesRange && params.episodesRange !== ('All' as any)) {
        items = items.filter((i) => {
          const ep = Number(i.episodes || 0);
          if (!ep) return false;
          if (params.episodesRange === '1-12') return ep >= 1 && ep <= 12;
          if (params.episodesRange === '13-26') return ep >= 13 && ep <= 26;
          if (params.episodesRange === '27-100') return ep >= 27 && ep <= 100;
          if (params.episodesRange === '100+') return ep > 100;
          return true;
        });
      }

      return {
        results: items.slice(0, perPage),
        total_pages: data?.Studio?.media?.pageInfo?.lastPage || 1,
      };
    } catch {
      // Fall through to standard media query
    }
  }

  const gql = `
    query (
      $page: Int,
      $perPage: Int,
      $search: String,
      $sort: [MediaSort],
      $genre: String,
      $seasonYear: Int,
      $format: MediaFormat,
      $status: MediaStatus,
      $epGreater: Int,
      $epLesser: Int
    ) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { lastPage currentPage hasNextPage }
        media(
          type: ANIME,
          search: $search,
          sort: $sort,
          genre: $genre,
          seasonYear: $seasonYear,
          format: $format,
          status: $status,
          episodes_greater: $epGreater,
          episodes_lesser: $epLesser,
          isAdult: false
        ) {
          ${ANILIST_MEDIA_FRAGMENT}
        }
      }
    }
  `;
  const variables: Record<string, any> = {
    page,
    perPage,
    sort: [params.sort || 'POPULARITY_DESC'],
  };
  if (params.search && params.search.trim()) variables.search = params.search.trim();
  if (params.genre && params.genre !== 'All') variables.genre = params.genre;
  if (params.year && params.year !== 'All') variables.seasonYear = Number(params.year);
  if (params.format && params.format !== ('All' as any)) variables.format = params.format;
  if (params.status && params.status !== ('All' as any)) variables.status = params.status;
  if (params.episodesRange && params.episodesRange !== ('All' as any)) {
    if (params.episodesRange === '1-12') {
      variables.epGreater = 0;
      variables.epLesser = 13;
    } else if (params.episodesRange === '13-26') {
      variables.epGreater = 12;
      variables.epLesser = 27;
    } else if (params.episodesRange === '27-100') {
      variables.epGreater = 26;
      variables.epLesser = 101;
    } else if (params.episodesRange === '100+') {
      variables.epGreater = 100;
    }
  }

  try {
    const data = await queryAniList(gql, variables);
    return {
      results: (data?.Page?.media || []).map(normalizeAnimeItem),
      total_pages: Math.min(500, data?.Page?.pageInfo?.lastPage || 1),
    };
  } catch {
    if (params.search && params.search.trim()) {
      return fetchSearchAnime(params.search.trim(), page, Boolean(params.isAdult));
    }
    return { results: [], total_pages: 1 };
  }
}

export async function fetchSearchAnime(
  query: string,
  page = 1,
  isAdult = false
): Promise<{ results: AnimeMedia[]; total_pages: number }> {
  if (!query.trim()) return { results: [], total_pages: 0 };
  void isAdult; // adult titles are always excluded

  const gql = `
    query ($search: String, $page: Int) {
      Page(page: $page, perPage: 20) {
        pageInfo { lastPage }
        media(type: ANIME, search: $search, isAdult: false, sort: POPULARITY_DESC) {
          ${ANILIST_MEDIA_FRAGMENT}
        }
      }
    }
  `;
  const data = await queryAniList(gql, { search: query.trim(), page });
  return {
    results: (data?.Page?.media || []).map(normalizeAnimeItem),
    total_pages: data?.Page?.pageInfo?.lastPage || 1,
  };
}

const FRANCHISE_NODE_FIELDS = `
  id
  idMal
  type
  format
  status
  episodes
  seasonYear
  startDate { year month day }
  title { english romaji }
`;

const FRANCHISE_SEASONS_GQL = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      ${FRANCHISE_NODE_FIELDS}
      relations {
        edges {
          relationType(version: 2)
          node {
            ${FRANCHISE_NODE_FIELDS}
            relations {
              edges {
                relationType(version: 2)
                node {
                  ${FRANCHISE_NODE_FIELDS}
                  relations {
                    edges {
                      relationType(version: 2)
                      node {
                        ${FRANCHISE_NODE_FIELDS}
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export async function fetchFranchiseSeasons(id: string | number): Promise<AnimeSeasonItem[]> {
  const cacheKey = `franchise-seasons:${id}`;
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return cached.data as AnimeSeasonItem[];
  }

  try {
    const data = await queryAniList(FRANCHISE_SEASONS_GQL, { id: Number(id) });
    const rootMedia = data?.Media;
    if (!rootMedia) return [];

    const visited = new Map<number, any>();
    const allowedFormats =
      rootMedia.format === 'ONA'
        ? new Set(['TV', 'ONA'])
        : new Set(['TV']);

    const walk = (node: any, depth = 0) => {
      if (!node || depth > 4) return;
      if (node.type === 'ANIME' && node.id && !visited.has(node.id)) {
        visited.set(node.id, node);
      }
      const edges = node.relations?.edges || [];
      for (const edge of edges) {
        const rel = edge.relationType;
        const target = edge.node;
        if (!target) continue;
        if (rel === 'PREQUEL' || rel === 'SEQUEL') {
          walk(target, depth + 1);
        } else if (rel === 'SOURCE' && target.relations?.edges) {
          for (const srcEdge of target.relations.edges) {
            if (srcEdge.relationType === 'ADAPTATION' && srcEdge.node?.type === 'ANIME') {
              walk(srcEdge.node, depth + 1);
            }
          }
        }
      }
    };

    walk(rootMedia, 0);

    const tvNodes = [...visited.values()].filter((n) => {
      if (!allowedFormats.has(n.format)) return false;
      if (n.status === 'NOT_YET_RELEASED') return false;
      const t = (n.title?.english || n.title?.romaji || '').trim();
      if (/\b(PV|CM|Preview)\b$/i.test(t)) return false;
      return true;
    });

    tvNodes.sort((a, b) => {
      const ya = a.startDate?.year || a.seasonYear || 9999;
      const yb = b.startDate?.year || b.seasonYear || 9999;
      if (ya !== yb) return ya - yb;
      const ma = a.startDate?.month || 12;
      const mb = b.startDate?.month || 12;
      if (ma !== mb) return ma - mb;
      const da = a.startDate?.day || 31;
      const db = b.startDate?.day || 31;
      if (da !== db) return da - db;
      return a.id - b.id;
    });

    const seasons: AnimeSeasonItem[] = tvNodes.map((n, idx) => {
      const fullTitle = n.title?.english || n.title?.romaji || `Season ${idx + 1}`;
      return {
        season: idx + 1,
        anilistId: n.id,
        idMal: n.idMal || null,
        name:
          tvNodes.length > 1
            ? `Season ${idx + 1}${n.episodes ? ` (${n.episodes} Eps)` : ''}`
            : 'Season 1',
        fullTitle,
        episodes: n.episodes || null,
        year: n.startDate?.year || n.seasonYear || null,
      };
    });

    responseCache.set(cacheKey, { data: seasons, expiry: Date.now() + 30 * 60 * 1000 });
    return seasons;
  } catch {
    return [];
  }
}

export async function fetchAnimeDetails(id: string | number): Promise<AnimeMedia> {
  // AniList GraphQL + AniZip (fanart / clearlogo / id mappings) — no dependency on api.bingr.one
  const detailsGql = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        ${ANILIST_MEDIA_FRAGMENT}
        studios(isMain: true) { nodes { id name } }
        characters(sort: [ROLE, RELEVANCE], perPage: 20) {
          edges {
            node { id name { full } image { large } }
            voiceActors(language: JAPANESE, sort: [RELEVANCE]) { id name { full } }
          }
        }
        recommendations(sort: [RATING_DESC], perPage: 14) {
          nodes {
            mediaRecommendation {
              ${ANILIST_MEDIA_FRAGMENT}
            }
          }
        }
      }
    }
  `;

  let gqlData: any = null;
  try {
    gqlData = await queryAniList(detailsGql, { id: Number(id) }, 15 * 60 * 1000);
  } catch (e: any) {
    console.warn(`[fetchAnimeDetails] AniList GQL failed for ${id}:`, e?.message);
  }

  const [anizip, franchiseSeasons] = await Promise.all([
    fetchAniZipData(id).catch(() => null),
    fetchFranchiseSeasons(id).catch(() => []),
  ]);

  const azClearLogo =
    anizip?.images?.find(
      (img: any) =>
        (img.coverType === 'Clearlogo' ||
          img.coverType === 'clearlogo' ||
          img.coverType === 'Logo') &&
        isValidClearLogoUrl(img.url)
    )?.url || null;
  const azFanart =
    anizip?.images?.find((img: any) => img.coverType === 'Fanart')?.url || null;
  const mappedImdbId = anizip?.mappings?.imdb_id || null;
  const mappedMalId = anizip?.mappings?.mal_id || null;
  const mappedTmdbId = anizip?.mappings?.themoviedb_id || null;

  let m = gqlData?.Media;
  if (!m) {
    // Resilient fallback to AnimeNexus if AniList is rate limited or unavailable
    const nexusFallback = await fetchNexusAnime(String(id)).catch(() => null);
    if (nexusFallback?.success && nexusFallback?.anime) {
      m = {
        id: Number(id) || 999999,
        idMal: null,
        title: {
          romaji: nexusFallback.anime.name,
          english: nexusFallback.anime.name,
          native: nexusFallback.anime.name,
          userPreferred: nexusFallback.anime.name,
        },
        description: nexusFallback.anime.overview || '',
        coverImage: {
          extraLarge: nexusFallback.art?.poster || '',
          large: nexusFallback.art?.poster || '',
          medium: nexusFallback.art?.poster || '',
        },
        bannerImage: nexusFallback.art?.poster || null,
        episodes: nexusFallback.total_episodes_found || 12,
        status: 'FINISHED',
        format: 'TV',
        averageScore: 82,
        genres: ['Anime'],
        isAdult: false,
        nexusLogo: nexusFallback.art?.logo || null,
      };
    } else {
      throw new Error(`Anime ${id} not found`);
    }
  }

  const base = normalizeAnimeItem(m);
  const primaryTitle = base.title || m?.title?.english || m?.title?.romaji || '';

  const curatedArt = NEXUS_TOP_10_ART[Number(id)];
  let hiResLogo: string | null = null;
  if (curatedArt && curatedArt.logo === null) {
    // Explicitly null logo requested (e.g. Kaguya-sama white text display)
    hiResLogo = null;
  } else {
    const metahubLogo = mappedImdbId
      ? `https://images.metahub.space/logo/medium/${mappedImdbId}/img`
      : null;

    hiResLogo =
      curatedArt?.logo ||
      ENGLISH_ANIME_LOGOS[Number(id)] ||
      ENGLISH_ANIME_LOGOS[String(id)] ||
      (isValidClearLogoUrl(m?.nexusLogo) ? m.nexusLogo : null) ||
      metahubLogo ||
      azClearLogo ||
      null;

    if (!hiResLogo && primaryTitle) {
      try {
        const nexusData = await fetchNexusAnime(primaryTitle);
        if (isValidClearLogoUrl(nexusData?.art?.logo)) {
          hiResLogo = nexusData.art.logo;
        }
      } catch {
        // ignore
      }
    }
  }

  const safeFanart = azFanart || null;
  const hiResBackdrop = curatedArt?.backdrop || safeFanart || base.backdrop || null;
  const hiResPoster = curatedArt?.poster || base.poster;
  const curatedTrailer = curatedArt?.trailerId ? { id: curatedArt.trailerId, site: 'youtube' } : null;
  const tmdbDetails: any = null;

  return {
    ...base,
    title_native: m?.title?.native || null,
    rating: base.rating || curatedArt?.rating || null,
    poster: hiResPoster,
    logo: hiResLogo,
    backdrop: hiResBackdrop || base.backdrop,
    backdrop_original: tmdbDetails?.backdrop_original || hiResBackdrop || base.backdrop,
    trailer: curatedTrailer || base.trailer,
    imdb_id: tmdbDetails?.imdb_id || mappedImdbId,
    idMal: m?.idMal || mappedMalId,
    tmdb_id: mappedTmdbId,
    seasons: franchiseSeasons.length > 0 ? franchiseSeasons : base.seasons,
    studios: normalizeStudios(m?.studios?.nodes),
    season_name: m?.season || null,
    start_date: m?.startDate || null,
    synonyms: m?.synonyms || [],
    tags: (m?.tags || []).map((t: any) => t?.name).filter(Boolean),
    siteUrl: m?.siteUrl || null,
    duration: m?.duration || base.duration || null,
    cast: (m?.characters?.edges || []).map((edge: any) => ({
      id: edge.node?.id,
      name: edge.node?.name?.full || 'Character',
      character: edge.voiceActors?.[0]?.name?.full || '',
      profile: edge.node?.image?.large || null,
      photo: edge.node?.image?.large || null,
    })),
    similars: (m?.recommendations?.nodes || [])
      .map((n: any) => n?.mediaRecommendation)
      .filter(Boolean)
      .map(normalizeAnimeItem),
  };
}

export async function fetchAnimeEpisodes(
  id: string | number,
  chunk = 1
): Promise<AnimeEpisodesResponse> {
  const [anizip, airing] = await Promise.all([
    fetchAniZipData(id),
    queryAniList(
      `query ($id: Int) { Media(id: $id, type: ANIME) { episodes nextAiringEpisode { episode airingAt timeUntilAiring } } }`,
      { id: Number(id) },
      10 * 60 * 1000
    ).catch(() => null),
  ]);

  const anizipEpisodes = anizip?.episodes || {};
  const nextAiringEpisode: NextAiringEpisode | null = airing?.Media?.nextAiringEpisode || null;

  // Build directly from AniZip metadata
  let epKeys = Object.keys(anizipEpisodes)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);

  // AniZip has no data for this title — attempt AnimeNexus episodes first
  if (epKeys.length === 0) {
    try {
      const nexusData = await fetchNexusAnime(String(id));
      if (nexusData?.episodes?.length) {
        const nexusEpisodes: AnimeEpisode[] = nexusData.episodes.map((nep: any) => ({
          episode: nep.number,
          title: nep.title || `Episode ${nep.number}`,
          overview: null,
          still: nep.thumbnail || null,
          air_date: null,
          runtime: 24,
          rating: null,
        }));
        return {
          total: nexusEpisodes.length,
          chunk: 1,
          chunkSize: 100,
          totalChunks: Math.ceil(nexusEpisodes.length / 100) || 1,
          nextAiringEpisode: null,
          episodes: nexusEpisodes.slice(0, 100),
        };
      }
    } catch {
      // ignore
    }

    const aired = nextAiringEpisode ? nextAiringEpisode.episode - 1 : 0;
    const count = aired > 0 ? aired : Number(airing?.Media?.episodes || 0);
    epKeys = Array.from({ length: count }, (_, i) => i + 1);
  }

  if (epKeys.length > 0) {
    const startIdx = (chunk - 1) * 100;
    const sliceKeys = epKeys.slice(startIdx, startIdx + 100);
    const episodes: AnimeEpisode[] = sliceKeys.map((epNum) => {
      const az = anizipEpisodes[String(epNum)];
      const azTitle =
        typeof az?.title === 'object'
          ? az.title?.en || az.title?.['x-jat'] || az.title?.ja
          : az?.title;
      return {
        episode: epNum,
        title: azTitle || `Episode ${epNum}`,
        overview: az?.overview || az?.summary || null,
        still: az?.image || null,
        air_date: az?.airDate || az?.airdate || null,
        runtime: az?.runtime || az?.length || 24,
        rating: az?.rating || null,
      };
    });

    return {
      total: epKeys.length,
      chunk,
      chunkSize: 100,
      totalChunks: Math.ceil(epKeys.length / 100) || 1,
      nextAiringEpisode,
      episodes,
    };
  }

  return {
    total: 0,
    chunk: 1,
    chunkSize: 100,
    totalChunks: 1,
    nextAiringEpisode,
    episodes: [],
  };
}

export function cleanTrailerVideoId(videoId?: string | null): string | null {
  if (!videoId) return null;
  const cleanId = videoId
    .replace(/^https?:\/\/.*(?:embed\/|v=)/, '')
    .split(/[\?&#]/)[0]
    .trim();
  return cleanId || null;
}

export function getDirectTrailerUrl(videoId?: string | null): string | null {
  const cleanId = cleanTrailerVideoId(videoId);
  if (!cleanId) return null;
  return `/api/trailer/stream?id=${encodeURIComponent(cleanId)}`;
}

export function buildYouTubeEmbedUrl(videoId?: string | null): string | null {
  const cleanId = cleanTrailerVideoId(videoId);
  if (!cleanId) return null;
  return `https://www.youtube.com/embed/${cleanId}?autoplay=1&mute=1&controls=0&disablekb=1&fs=0&playsinline=1&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&enablejsapi=1&vq=hd1080`;
}

export async function resolvePlayableTrailerUrl(videoId?: string | null): Promise<string | null> {
  const cleanId = cleanTrailerVideoId(videoId);
  if (!cleanId) return null;
  try {
    const checkRes = await fetch(`/api/trailer/stream?id=${encodeURIComponent(cleanId)}&check=1`);
    if (checkRes.ok) {
      const data = await checkRes.json();
      if (data?.ready) {
        return `/api/trailer/stream?id=${encodeURIComponent(cleanId)}`;
      }
    }
  } catch {
    // ignore check error and fall back to YouTube embed
  }
  return buildYouTubeEmbedUrl(cleanId);
}

export async function fetchImdbTrailer(imdbId?: string | null): Promise<string | null> {
  // The IMDb trailer endpoint lived on api.bingr.one, which is offline.
  // Callers already handle `null` by falling back to static artwork.
  void imdbId;
  return null;
}

export async function fetchSkipTimes(malId?: number | string | null, episode = 1): Promise<SkipTimes> {
  if (!malId) return {};
  try {
    const res = await fetch(
      `https://api.aniskip.com/v2/skip-times/${malId}/${episode}?types[]=op&types[]=ed&episodeLength=0`
    );
    if (!res.ok) return {};
    const data = await res.json();
    if (!data?.found || !Array.isArray(data.results)) return {};
    const skip: SkipTimes = {};
    for (const item of data.results) {
      if (item.skipType === 'op' && item.interval) {
        skip.intro = { start: item.interval.startTime, end: item.interval.endTime };
      } else if (item.skipType === 'ed' && item.interval) {
        skip.outro = { start: item.interval.startTime, end: item.interval.endTime };
      }
    }
    return skip;
  } catch {
    return {};
  }
}

// In-memory + sessionStorage cache for resolved stream sources (15 min TTL)
const STREAM_CACHE_TTL_MS = 15 * 60 * 1000;
const streamCache = new Map<string, { source: StreamSource; expiresAt: number }>();
const inFlightStreamRequests = new Map<string, Promise<StreamSource | null>>();

function getStreamCacheKey(provider: string, anilistId: string | number, audio: string, episode: number): string {
  return `bingr_stream_v3_${provider}_${anilistId}_${audio}_${episode}`;
}

function readCachedStream(key: string): StreamSource | null {
  const now = Date.now();
  const mem = streamCache.get(key);
  if (mem && mem.expiresAt > now) return mem.source;
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.expiresAt > now && parsed.source?.url) {
        streamCache.set(key, parsed);
        return parsed.source;
      }
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

function writeCachedStream(key: string, source: StreamSource): void {
  const entry = { source, expiresAt: Date.now() + STREAM_CACHE_TTL_MS };
  streamCache.set(key, entry);
  try {
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // ignore storage quota errors
  }
}

export async function fetchAnivexaStreamFromProvider(
  provider: AnivexaProviderId,
  anilistId: string | number,
  audio: 'sub' | 'dub',
  episode: number,
  title?: string
): Promise<StreamSource | null> {
  const cacheKey = getStreamCacheKey(provider, anilistId, audio, episode);
  const cached = readCachedStream(cacheKey);
  if (cached) return cached;

  const existingInFlight = inFlightStreamRequests.get(cacheKey);
  if (existingInFlight) return existingInFlight;

  const task = (async (): Promise<StreamSource | null> => {
    if (provider === 'nexus') {
      try {
        const q = title || String(anilistId);
        const res = await fetch(`/api/anime?q=${encodeURIComponent(q)}&ep=${episode}`);
        if (!res.ok) return null;
        const json = await res.json();
        const streamInfo = json?.data;
        if (!streamInfo?.hls) return null;

        const subList: SubtitleTrack[] = (streamInfo.subtitles || []).map((s: any) => {
          const label = s.label || 'English';
          const lower = label.toLowerCase();
          return {
            url: s.src,
            lang: s.srcLang || 'en',
            label,
            format: s.src?.includes('.ass') ? 'ass' : 'vtt',
            default: lower === 'english' || (lower.includes('english') && !lower.includes('sign')),
            referer: 'https://anime.nexus/',
          };
        });

        const nexusSource: StreamSource = {
          id: `nexus-${audio}-${episode}`,
          provider: 'nexus',
          name: 'Nexus (Direct HLS)',
          url: streamInfo.hls,
          type: 'hls',
          lang: audio,
          subtitles: subList,
          chapters: streamInfo.video_meta?.chapters,
          storyboard: streamInfo.thumbnails,
          referer: 'https://anime.nexus/',
        };
        writeCachedStream(cacheKey, nexusSource);
        return nexusSource;
      } catch {
        return null;
      }
    }

    try {
      const url = `${ANIVEXA_BASE}/watch/${provider}/${anilistId}/${audio}/${provider}-${episode}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      const data = await res.json();
      const streams = Array.isArray(data?.streams) ? data.streams : [];
      const allEmbeds: EmbedOption[] = [];

      if (Array.isArray(data?.embeds)) {
        data.embeds.forEach((em: any) => {
          if (em?.url) allEmbeds.push({ name: em.name || 'Embed', url: em.url, type: em.type });
        });
      }

      streams.forEach((s: any) => {
        if (s?.embed && !allEmbeds.some((e) => e.url === s.embed)) {
          allEmbeds.push({ name: s.server || 'Embed Server', url: s.embed, type: s.type });
        }
      });

      if (!streams.length && !allEmbeds.length) return null;

      // Always prefer highest quality (1080p) HLS or MP4 stream
      const hlsStreams = streams.filter((s: any) => (s.type === 'hls' || String(s.url || '').includes('.m3u8')) && s.url);
      const mp4Streams = streams.filter((s: any) => (s.type === 'mp4' || String(s.url || '').includes('.mp4')) && s.url);

      const best =
        hlsStreams.find((s: any) => String(s.quality || '').includes('1080')) ||
        hlsStreams.find((s: any) => s.isActive) ||
        hlsStreams[0] ||
        mp4Streams.find((s: any) => String(s.quality || '').includes('1080')) ||
        mp4Streams.find((s: any) => String(s.quality || '').includes('720')) ||
        mp4Streams[mp4Streams.length - 1] ||
        streams.find((s: any) => s.url || s.embed) ||
        (allEmbeds.length > 0 ? { url: allEmbeds[0].url, type: 'embed' } : null);

      if (!best) return null;
      const rawUrl = best.url || best.embed || allEmbeds[0]?.url;
      if (!rawUrl) return null;

      const providerMeta = ANIVEXA_PROVIDERS.find((p) => p.id === provider);
      const streamType: 'hls' | 'mp4' | 'embed' =
        best.type === 'embed' || (!rawUrl.includes('.m3u8') && !rawUrl.includes('.mp4'))
          ? 'embed'
          : best.type === 'mp4' || rawUrl.includes('.mp4')
          ? 'mp4'
          : 'hls';

      const resolvedEmbedUrl =
        best.embed ||
        (allEmbeds.length > 0 ? allEmbeds[0].url : undefined) ||
        (streamType === 'embed' ? rawUrl : undefined);

      let streamReferer: string | undefined =
        best.referer || best.headers?.Referer || best.headers?.referer || undefined;
      if (!streamReferer) {
        const embedSrc = best.embedUrl || best.embed;
        if (embedSrc) {
          try {
            streamReferer = `${new URL(embedSrc).origin}/`;
          } catch {
            // ignore malformed embed url
          }
        }
      }

      // Collect all valid subtitles from both best stream and root data, excluding storyboard thumbnails
      const combinedSubs: SubtitleTrack[] = [];
      const seenSubUrls = new Set<string>();
      let detectedStoryboard: string | undefined = best.storyboard;

      const rawCandidateSubs = [
        ...(Array.isArray(best.subtitles) ? best.subtitles : []),
        ...(Array.isArray(data?.subtitles) ? data.subtitles : []),
      ];

      for (const sub of rawCandidateSubs) {
        const subUrl = sub?.url || sub?.file;
        if (!subUrl || typeof subUrl !== 'string') continue;
        const lower = subUrl.toLowerCase();
        // Capture storyboard thumbnail preview VTT if present, then exclude from subtitles list
        if (lower.includes('thumbnails.vtt') || lower.includes('/preview/') || lower.includes('/thumbnail')) {
          if (!detectedStoryboard) detectedStoryboard = subUrl;
          continue;
        }
        if (seenSubUrls.has(subUrl)) continue;
        seenSubUrls.add(subUrl);

        const rawLabel = (sub.label || sub.language || sub.name || '').trim();
        const rawLang = (sub.srclang || sub.lang || sub.language || 'en').trim();
        let displayLabel = rawLabel;
        if (!displayLabel || displayLabel.toLowerCase() === 'english' || displayLabel.toLowerCase() === 'en') {
          displayLabel = 'English';
        }

        const subReferer: string | undefined =
          sub.referer || sub.headers?.Referer || sub.headers?.referer || undefined;

        combinedSubs.push({
          url: subUrl,
          lang: rawLang,
          label: displayLabel,
          format: sub.format || (subUrl.includes('.ass') ? 'ass' : subUrl.includes('.vtt') ? 'vtt' : undefined),
          default: Boolean(sub.default || displayLabel.toLowerCase().includes('english')),
          referer: subReferer,
        });
      }

      const resolvedSource: StreamSource = {
        id: `${provider}-${audio}-${episode}`,
        provider,
        name: best.server || providerMeta?.name || provider.toUpperCase(),
        url: rawUrl,
        embedUrl: resolvedEmbedUrl,
        embeds: allEmbeds,
        type: streamType,
        lang: audio,
        subtitles: combinedSubs,
        chapters: best.chapters,
        storyboard: detectedStoryboard,
        referer: streamReferer,
        intro: best.intro && typeof best.intro.start === 'number' ? best.intro : undefined,
        outro: best.outro && typeof best.outro.start === 'number' ? best.outro : undefined,
      };

      if (resolvedSource.type !== 'embed') {
        writeCachedStream(cacheKey, resolvedSource);
        if (audio === 'dub' || (resolvedSource.subtitles && resolvedSource.subtitles.length > 0)) {
          writeCachedStream(getStreamCacheKey('fast1080', anilistId, audio, episode), resolvedSource);
        }
      }

      return resolvedSource;
    } catch {
      return null;
    }
  })();

  inFlightStreamRequests.set(cacheKey, task);
  try {
    return await task;
  } finally {
    inFlightStreamRequests.delete(cacheKey);
  }
}

const FAST_1080P_PROVIDERS: AnivexaProviderId[] = ['anikoto', 'nexus', 'kaa', 'aniwaves', 'animegg'];

/**
 * Fetches soft subtitle tracks (plus storyboard/chapters/skip-times if available)
 * from subtitle-capable providers (`anikoto` + `nexus`) whenever the active video
 * server (e.g. `kaa`, `aniwaves`, `animegg`) has no external subtitle tracks or
 * its primary subtitle track fails to load.
 */
export async function fetchSupplementalSubtitles(
  anilistId: string | number,
  episode: number,
  title?: string
): Promise<{
  subtitles: SubtitleTrack[];
  storyboard?: string;
  chapters?: string;
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
}> {
  const results = await Promise.allSettled([
    fetchAnivexaStreamFromProvider('anikoto', anilistId, 'sub', episode, title),
    fetchAnivexaStreamFromProvider('nexus', anilistId, 'sub', episode, title),
  ]);

  const mergedSubs: SubtitleTrack[] = [];
  const seenUrls = new Set<string>();
  let storyboard: string | undefined;
  let chapters: string | undefined;
  let intro: { start: number; end: number } | undefined;
  let outro: { start: number; end: number } | undefined;

  for (const res of results) {
    if (res.status !== 'fulfilled' || !res.value) continue;
    const src = res.value;
    if (!storyboard && src.storyboard) storyboard = src.storyboard;
    if (!chapters && src.chapters) chapters = src.chapters;
    if (!intro && src.intro) intro = src.intro;
    if (!outro && src.outro) outro = src.outro;

    for (const sub of src.subtitles || []) {
      if (!sub?.url || seenUrls.has(sub.url)) continue;
      seenUrls.add(sub.url);
      // Disambiguate label if another provider already added a track with the same label
      let label = sub.label;
      if (mergedSubs.some((existing) => existing.label === label)) {
        const suffix = src.provider === 'nexus' ? ' (Nexus)' : ` (${src.provider.toUpperCase()})`;
        if (!label.endsWith(suffix)) label = `${label}${suffix}`;
      }
      mergedSubs.push({ ...sub, label });
    }
  }

  return { subtitles: mergedSubs, storyboard, chapters, intro, outro };
}

/**
 * Races verified 1080p direct providers in parallel so the player connects immediately
 * without waiting on sequential timeouts. Prioritizes `anikoto` and `nexus` (1080p + soft subs)
 * and enriches any winner that lacks soft subtitles.
 */
export async function fetchFastestDirectStream(
  anilistId: string | number,
  audio: 'sub' | 'dub',
  episode: number,
  preferredProvider?: AnivexaProviderId,
  title?: string
): Promise<StreamSource | null> {
  const hasSubs = (s: StreamSource | null) =>
    Boolean(s && (audio === 'dub' || (s.subtitles && s.subtitles.length > 0)));

  if (preferredProvider) {
    const cachedPref = readCachedStream(getStreamCacheKey(preferredProvider, anilistId, audio, episode));
    if (cachedPref && cachedPref.type !== 'embed' && hasSubs(cachedPref)) return cachedPref;
  }

  const fastCached = readCachedStream(getStreamCacheKey('fast1080', anilistId, audio, episode));
  if (fastCached && fastCached.type !== 'embed' && hasSubs(fastCached)) return fastCached;

  for (const p of FAST_1080P_PROVIDERS) {
    const c = readCachedStream(getStreamCacheKey(p, anilistId, audio, episode));
    if (c && c.type !== 'embed' && hasSubs(c)) return c;
  }

  const candidates: AnivexaProviderId[] = preferredProvider
    ? [preferredProvider, ...FAST_1080P_PROVIDERS.filter((p) => p !== preferredProvider)]
    : FAST_1080P_PROVIDERS;

  const requireValidDirect = async (p: AnivexaProviderId): Promise<StreamSource> => {
    const src = await fetchAnivexaStreamFromProvider(p, anilistId, audio, episode, title);
    if (!src || !src.url || src.type === 'embed') {
      throw new Error(`No direct stream from ${p}`);
    }
    return src;
  };

  try {
    // Launch all top 1080p candidates simultaneously
    const softSubProviders = candidates.filter((p) => p === 'anikoto' || p === 'nexus');
    const softSubPromise =
      softSubProviders.length > 0
        ? Promise.any(
            softSubProviders.map(async (p) => {
              const s = await requireValidDirect(p);
              if (!s.subtitles || s.subtitles.length === 0) throw new Error('No subs');
              return s;
            })
          )
        : Promise.reject(new Error('No soft sub providers'));

    const anyPromise = Promise.any(candidates.map((p) => requireValidDirect(p)));

    // Give soft-subbed 1080p servers (anikoto / nexus) up to 2.2s to win cleanly,
    // otherwise take whichever 1080p server finished first.
    const winner = await Promise.race([
      softSubPromise,
      anyPromise.then(
        (first) =>
          new Promise<StreamSource>((resolve) => {
            if (first.subtitles && first.subtitles.length > 0) {
              resolve(first);
              return;
            }
            setTimeout(() => resolve(first), 1800);
          })
      ),
    ]).catch(() => anyPromise);

    return winner;
  } catch {
    return null;
  }
}

/**
 * Silently prefetches and caches the fastest 1080p stream in the background
 * (e.g., when hovering/viewing AnimeDetails or HeroSlider, or for the next episode).
 */
export function prefetchAnimeStream(
  anilistId: string | number,
  episode: number = 1,
  audio: 'sub' | 'dub' = 'sub',
  title?: string
): void {
  if (!anilistId) return;
  const fastCached = readCachedStream(getStreamCacheKey('fast1080', anilistId, audio, episode));
  if (fastCached) return;
  fetchFastestDirectStream(anilistId, audio, episode, 'anikoto', title).catch(() => {});
}

export async function fetchAnimeStreamByMode(
  mode: 'sub' | 'dub' | 'multi',
  params: {
    anilistId: string | number;
    malId?: string | number | null;
    title: string;
    season?: number;
    episode: number;
    preferredProvider?: AnivexaProviderId;
  }
): Promise<StreamSource | null> {
  const audio: 'sub' | 'dub' = mode === 'dub' ? 'dub' : 'sub';

  const fastResult = await fetchFastestDirectStream(
    params.anilistId,
    audio,
    params.episode,
    params.preferredProvider,
    params.title
  );
  if (fastResult && fastResult.url) {
    return fastResult;
  }

  const orderedProviders: AnivexaProviderId[] = params.preferredProvider
    ? [
        params.preferredProvider,
        ...ANIVEXA_PROVIDERS.map((p) => p.id).filter((id) => id !== params.preferredProvider),
      ]
    : ['anikoto', 'kaa', 'aniwaves', 'animegg', 'animenosub', 'anipm', 'senshi', 'reanime', 'anizone'];

  for (const provider of orderedProviders) {
    const source = await fetchAnivexaStreamFromProvider(
      provider,
      params.anilistId,
      audio,
      params.episode,
      params.title
    );
    if (source && source.url) {
      return source;
    }
  }

  return null;
}

export async function fetchRecommendationsForAnime(
  seedId: string | number,
  seedTitle?: string
): Promise<{
  sourceId: string | number;
  sourceTitle: string;
  sourceGenre?: string;
  items: AnimeMedia[];
}> {
  const numId = Number(seedId);
  const gql = `
    query ($id: Int, $search: String) {
      Media(id: $id, search: $search, type: ANIME, isAdult: false) {
        id
        title { english romaji }
        genres
        relations {
          edges {
            node { id }
          }
        }
        recommendations(sort: [RATING_DESC], perPage: 18) {
          nodes {
            rating
            mediaRecommendation {
              ${ANILIST_MEDIA_FRAGMENT}
            }
          }
        }
      }
    }
  `;

  try {
    const vars = Number.isFinite(numId) && numId > 0 ? { id: numId } : { search: seedTitle || 'Haikyu' };
    const data = await queryAniList(gql, vars);
    const media = data?.Media;
    if (media) {
      const resolvedTitle =
        seedTitle || media.title?.english || media.title?.romaji || 'Your Recent Watch';
      const primaryGenre: string | undefined = media.genres?.[0];
      const relatedIds = new Set<string>([
        String(media.id),
        String(seedId),
        ...(media.relations?.edges || []).map((e: any) => String(e?.node?.id)),
      ]);

      const recNodes: AnimeMedia[] = (media.recommendations?.nodes || [])
        .filter((n: any) => n?.mediaRecommendation && !n.mediaRecommendation.isAdult)
        .map((n: any) => normalizeAnimeItem(n.mediaRecommendation))
        .filter((item: AnimeMedia) => !relatedIds.has(String(item.id)));

      if (recNodes.length >= 6) {
        return {
          sourceId: media.id || seedId,
          sourceTitle: resolvedTitle,
          sourceGenre: primaryGenre,
          items: recNodes.slice(0, 14),
        };
      }

      if (primaryGenre) {
        const genreRes = await fetchDiscoverAnime({
          genre: primaryGenre,
          sort: 'POPULARITY_DESC',
          page: 1,
          richMeta: true,
        });
        const seen = new Set<string>(recNodes.map((r) => String(r.id)));
        for (const gItem of genreRes.results) {
          if (!relatedIds.has(String(gItem.id)) && !seen.has(String(gItem.id))) {
            recNodes.push(gItem);
            seen.add(String(gItem.id));
          }
        }
        return {
          sourceId: media.id || seedId,
          sourceTitle: resolvedTitle,
          sourceGenre: primaryGenre,
          items: recNodes.slice(0, 14),
        };
      }
    }
  } catch {
    // Fallback below
  }

  const fallbackRes = await fetchDiscoverAnime({
    sort: 'TRENDING_DESC',
    page: 1,
    richMeta: true,
  });
  return {
    sourceId: seedId,
    sourceTitle: seedTitle || 'Popular Anime',
    items: fallbackRes.results.filter((i) => String(i.id) !== String(seedId)).slice(0, 14),
  };
}

export interface AnimeReview {
  id: number | string;
  summary: string;
  body: string;
  score?: number | null; // out of 100
  rating?: number | null; // upvotes / helpful
  ratingAmount?: number | null;
  createdAt?: number | null; // unix timestamp in ms
  user: {
    name: string;
    avatar?: string | null;
  };
}

export async function fetchAnimeReviews(
  anilistId: number | string,
  idMal?: number | string | null
): Promise<AnimeReview[]> {
  const numericId = Number(anilistId);
  const cacheKey = `reviews:${anilistId}:${idMal || ''}`;
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  // 1. First attempt: AniList GraphQL community reviews
  if (numericId && !isNaN(numericId)) {
    try {
      const query = `
        query ($id: Int) {
          Media (id: $id) {
            reviews (perPage: 10, sort: [RATING_DESC]) {
              nodes {
                id
                summary
                body
                rating
                ratingAmount
                score
                createdAt
                user {
                  id
                  name
                  avatar {
                    medium
                  }
                }
              }
            }
          }
        }
      `;
      const data = await queryAniList(query, { id: numericId });
      const nodes = data?.Media?.reviews?.nodes;
      if (Array.isArray(nodes) && nodes.length > 0) {
        const reviews: AnimeReview[] = nodes.map((n: any) => ({
          id: n.id,
          summary: n.summary?.trim() || '',
          body: n.body?.trim() || '',
          score: typeof n.score === 'number' ? n.score : null,
          rating: n.rating || 0,
          ratingAmount: n.ratingAmount || 0,
          createdAt: n.createdAt ? n.createdAt * 1000 : null,
          user: {
            name: n.user?.name || 'Anonymous',
            avatar: n.user?.avatar?.medium || null,
          },
        }));
        responseCache.set(cacheKey, { data: reviews, expiry: Date.now() + 15 * 60 * 1000 });
        return reviews;
      }
    } catch {
      // Continue to fallback
    }
  }

  // 2. Fallback attempt: Jikan MAL reviews if idMal is known
  const malIdNum = idMal ? Number(idMal) : null;
  if (malIdNum && !isNaN(malIdNum)) {
    try {
      const res = await fetch(`https://api.jikan.moe/v4/anime/${malIdNum}/reviews`, {
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const json = await res.json();
        const data = json?.data;
        if (Array.isArray(data) && data.length > 0) {
          const reviews: AnimeReview[] = data.slice(0, 10).map((r: any) => {
            const rawBody = r.review || '';
            const firstLine = rawBody.split('\n')[0].replace(/<[^>]*>/g, '').trim();
            const summary = firstLine.length > 10 && firstLine.length < 120
              ? firstLine
              : rawBody.slice(0, 95).trim() + '...';
            return {
              id: r.mal_id || `mal-${Math.random()}`,
              summary: summary || 'User Review',
              body: rawBody,
              score: typeof r.score === 'number' ? r.score * 10 : null,
              rating: r.reactions?.overall || 0,
              ratingAmount: 0,
              createdAt: r.date ? new Date(r.date).getTime() : null,
              user: {
                name: r.user?.username || 'MAL Reviewer',
                avatar: r.user?.images?.jpg?.image_url || null,
              },
            };
          });
          responseCache.set(cacheKey, { data: reviews, expiry: Date.now() + 15 * 60 * 1000 });
          return reviews;
        }
      }
    } catch {
      // ignore
    }
  }

  return [];
}

export const ANIME_STUDIOS: CategoryCollection[] = [
  {
    id: 'mappa',
    name: 'MAPPA',
    slug: 'mappa',
    type: 'studio',
    filterStudio: 'MAPPA',
    description: 'Powerhouse studio behind Jujutsu Kaisen, Chainsaw Man, Attack on Titan Final Season, and Vinland Saga Season 2.',
    backdrop: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/113415-jQBSkxWAAk83.jpg',
    gradient: 'from-[#14161d] to-[#0a0b0e]',
    filterGenre: 'Action',
  },
  {
    id: 'ufotable',
    name: 'ufotable',
    slug: 'ufotable',
    type: 'studio',
    filterStudio: 'ufotable',
    description: 'Renowned for breathtaking digital compositing and kinetic swordplay in Demon Slayer and the Fate franchise.',
    backdrop: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/101922-YfZhKBUDDS6L.jpg',
    gradient: 'from-[#1a1325] to-[#0b0910]',
    filterGenre: 'Supernatural',
  },
  {
    id: 'madhouse',
    name: 'Madhouse',
    slug: 'madhouse',
    type: 'studio',
    filterStudio: 'MADHOUSE',
    description: 'Legendary studio behind Frieren: Beyond Journey’s End, Hunter x Hunter, Death Note, Monster, and One Punch Man.',
    backdrop: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/154587-ivXNJ23SM1xB.jpg',
    gradient: 'from-[#101c24] to-[#090d12]',
    filterGenre: 'Fantasy',
  },
  {
    id: 'bones',
    name: 'Studio Bones',
    slug: 'bones',
    type: 'studio',
    filterStudio: 'bones',
    description: 'Masters of sakuga animation behind Fullmetal Alchemist: Brotherhood, My Hero Academia, and Mob Psycho 100.',
    backdrop: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/5114-q0V5URebphSG.jpg',
    gradient: 'from-[#1f1614] to-[#0d0908]',
    filterGenre: 'Adventure',
  },
  {
    id: 'wit-studio',
    name: 'WIT Studio',
    slug: 'wit-studio',
    type: 'studio',
    filterStudio: 'WIT STUDIO',
    description: 'Creators of iconic cinematic anime including Attack on Titan (S1–S3), Spy x Family, Vinland Saga, and Ranking of Kings.',
    backdrop: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/16498-8jpFCOcDmneX.jpg',
    gradient: 'from-[#121e1a] to-[#080d0b]',
    filterGenre: 'Drama',
  },
  {
    id: 'a-1-pictures',
    name: 'A-1 Pictures',
    slug: 'a-1-pictures',
    type: 'studio',
    filterStudio: 'A-1 Pictures',
    description: 'Versatile hitmaker studio behind Solo Leveling, Kaguya-sama: Love is War, Eighty-Six, and Sword Art Online.',
    backdrop: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/151807-37yfQA3ym8PA.jpg',
    gradient: 'from-[#131826] to-[#080b12]',
    filterGenre: 'Action',
  },
  {
    id: 'kyoto-animation',
    name: 'Kyoto Animation',
    slug: 'kyoto-animation',
    type: 'studio',
    filterStudio: 'Kyoto Animation',
    description: 'Unmatched character animation and emotional storytelling in Violet Evergarden, A Silent Voice, and Clannad.',
    backdrop: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/20954-f30bHMXa5Qoe.jpg',
    gradient: 'from-[#1c1624] to-[#0b090f]',
    filterGenre: 'Slice of Life',
  },
  {
    id: 'cloverworks',
    name: 'CloverWorks',
    slug: 'cloverworks',
    type: 'studio',
    filterStudio: 'CloverWorks',
    description: 'Modern animation craft behind Bocchi the Rock!, Horimiya, Rascal Does Not Dream, and Wind Breaker.',
    backdrop: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/130003-5F90a7BtsPQN.jpg',
    gradient: 'from-[#22151c] to-[#0d080a]',
    filterGenre: 'Comedy',
  },
  {
    id: 'toei-animation',
    name: 'Toei Animation',
    slug: 'toei-animation',
    type: 'studio',
    filterStudio: 'Toei Animation',
    description: 'Historic animation titan behind One Piece, Dragon Ball, Slam Dunk, and Sailor Moon.',
    backdrop: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/21-wf37VakJmZqs.jpg',
    gradient: 'from-[#231912] to-[#0e0a07]',
    filterGenre: 'Adventure',
  },
  {
    id: 'studio-ghibli',
    name: 'Studio Ghibli',
    slug: 'studio-ghibli',
    type: 'studio',
    filterStudio: 'Studio Ghibli',
    description: 'Timeless hand-drawn feature films including Spirited Away, Princess Mononoke, and Howl’s Moving Castle.',
    backdrop: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/199-Sm2RU5PSqw7T.jpg',
    gradient: 'from-[#122022] to-[#080e0f]',
    filterGenre: 'Fantasy',
    filterFormat: 'MOVIE',
  },
  {
    id: 'production-ig',
    name: 'Production I.G',
    slug: 'production-ig',
    type: 'studio',
    filterStudio: 'Production I.G',
    description: 'Sci-fi and sports legends behind Haikyu!!, Kaiju No. 8, Psycho-Pass, and Ghost in the Shell.',
    backdrop: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/20464-PpYjO9cPN1gs.jpg',
    gradient: 'from-[#1e1b12] to-[#0c0b07]',
    filterGenre: 'Sports',
  },
  {
    id: 'trigger',
    name: 'Studio Trigger',
    slug: 'trigger',
    type: 'studio',
    filterStudio: 'Trigger',
    description: 'Explosive, stylized animation behind Cyberpunk: Edgerunners, Delicious in Dungeon, and Kill la Kill.',
    backdrop: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/120377-c15oLS8CA31s.jpg',
    gradient: 'from-[#22121a] to-[#0d070a]',
    filterGenre: 'Sci-Fi',
  },
];

export function resolveStudioFilterName(raw?: string | null): string {
  if (!raw || raw === 'All') return 'All';
  const cleaned = decodeURIComponent(raw).trim();
  const bySlug = ANIME_STUDIOS.find(
    (s) =>
      s.slug.toLowerCase() === cleaned.toLowerCase() ||
      s.name.toLowerCase() === cleaned.toLowerCase() ||
      (s.filterStudio && s.filterStudio.toLowerCase() === cleaned.toLowerCase())
  );
  if (bySlug?.filterStudio) return bySlug.filterStudio;
  return cleaned;
}

export function resolveGenreFilterName(raw?: string | null): string {
  if (!raw || raw === 'All') return 'All';
  const cleaned = decodeURIComponent(raw).trim();
  const bySlug = ANIME_GENRES.find(
    (g) =>
      g.slug.toLowerCase() === cleaned.toLowerCase() ||
      g.name.toLowerCase() === cleaned.toLowerCase() ||
      (g.filterGenre && g.filterGenre.toLowerCase() === cleaned.toLowerCase())
  );
  if (bySlug?.filterGenre) return bySlug.filterGenre;
  return cleaned;
}

export function getContentRating(anime?: AnimeMedia | null): string {
  if (!anime) return 'PG-13';

  // 1. Explicit parental_rating / contentRating / ageRating
  const raw =
    (anime as any)?.parental_rating ||
    (anime as any)?.contentRating ||
    (anime as any)?.ageRating;
  if (raw && typeof raw === 'string') {
    const lower = raw.toLowerCase();
    if (lower.includes('rx') || lower.includes('hentai')) return '18+';
    if (
      lower.includes('18+') ||
      lower.includes('r+') ||
      lower.includes('17+') ||
      lower.includes('r - 17') ||
      lower.includes('r-17')
    ) {
      return '18+';
    }
    if (lower.includes('pg-13') || lower.includes('13+')) return 'PG-13';
    if (lower.includes('pg')) return 'PG';
    if (lower.includes('g') && !lower.includes('pg')) return 'G';
  }

  // 2. Known Top / Popular anime content ratings
  const idNum = Number(anime.id);
  const R18_IDS = new Set([
    21613,  // Saga of Tanya the Evil (R-17+)
    120377, // Cyberpunk: Edgerunners (18+)
    127230, // Chainsaw Man (18+)
    113415, // Jujutsu Kaisen (R-17+)
    16498,  // Attack on Titan (R-17+)
    151807, // Solo Leveling (R-17+)
    101922, // Demon Slayer (R-17+)
    1535,   // Death Note (R-17+)
    101348, // Vinland Saga (R-17+)
    99147,  // Berserk
    108465, // Dorohedoro
    106110, // Tokyo Ghoul
    142838, // Monster
  ]);
  if (R18_IDS.has(idNum)) return '18+';

  const PG13_IDS = new Set([
    11061,  // Hunter x Hunter
    154587, // Frieren
    101921, // Kaguya-sama
    21,     // One Piece
    269,    // Bleach
    20,     // Naruto
    101280, // Slime
    21459,  // My Hero Academia
    163132, // Oshi no Ko
  ]);
  if (PG13_IDS.has(idNum)) return 'PG-13';

  // 3. Mature / Adult flag
  if (anime.mature || (anime as any).isAdult) return '18+';

  // 4. Genre-based deduction
  const genres = (anime.genres || []).map((g) => g.toLowerCase());
  if (
    genres.some(
      (g) =>
        g.includes('gore') ||
        g.includes('horror') ||
        g.includes('ecchi') ||
        g.includes('psychological') ||
        g.includes('military')
    )
  ) {
    return '18+';
  }
  if (genres.some((g) => g.includes('kids') || g.includes('children'))) {
    return 'PG';
  }

  return 'PG-13';
}

export const ANIME_GENRES: CategoryCollection[] = [
  {
    id: 'Action',
    name: 'Action & Shonen',
    slug: 'Action',
    type: 'genre',
    filterGenre: 'Action',
    description: 'High-stakes battles, martial arts, and relentless shonen showdowns.',
    backdrop: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/113415-jQBSkxWAAk83.jpg',
  },
  {
    id: 'Fantasy',
    name: 'Dark Fantasy & Isekai',
    slug: 'Fantasy',
    type: 'genre',
    filterGenre: 'Fantasy',
    description: 'Otherworldly realms, arcane magic systems, and epic quests.',
    backdrop: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/154587-ivXNJ23SM1xB.jpg',
  },
  {
    id: 'Romance',
    name: 'Romance & Drama',
    slug: 'Romance',
    type: 'genre',
    filterGenre: 'Romance',
    description: 'Heartfelt confessions, slow-burn relationships, and unforgettable youth.',
    backdrop: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/21519-1ayMXgNlmByb.jpg',
  },
  {
    id: 'Sci-Fi',
    name: 'Sci-Fi & Cyberpunk',
    slug: 'Sci-Fi',
    type: 'genre',
    filterGenre: 'Sci-Fi',
    description: 'Futuristic metropolises, time loops, and mecha warfare.',
    backdrop: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/n9253-JIhmKgBKsWUN.jpg',
  },
  {
    id: 'Supernatural',
    name: 'Supernatural & Occult',
    slug: 'Supernatural',
    type: 'genre',
    filterGenre: 'Supernatural',
    description: 'Curses, spirits, demons, and hidden paranormal worlds.',
    backdrop: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/101922-33MtJGsUSxga.jpg',
  },
  {
    id: 'Comedy',
    name: 'Comedy',
    slug: 'Comedy',
    type: 'genre',
    filterGenre: 'Comedy',
    description: 'Absurd gag humor, chaotic ensembles, and feel-good laughs.',
    backdrop: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/140960-Z7xSvkRxHKfj.jpg',
  },
  {
    id: 'Psychological',
    name: 'Psychological & Thriller',
    slug: 'Psychological',
    type: 'genre',
    filterGenre: 'Psychological',
    description: 'Mind games, cat-and-mouse deductions, and dark mysteries.',
    backdrop: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/1535.jpg',
  },
  {
    id: 'Slice of Life',
    name: 'Slice of Life',
    slug: 'Slice of Life',
    type: 'genre',
    filterGenre: 'Slice of Life',
    description: 'Cozy everyday moments, music clubs, and healing stories.',
    backdrop: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/20954-f30bHMXa5Qoe.jpg',
  },
  {
    id: 'Sports',
    name: 'Sports & Competition',
    slug: 'Sports',
    type: 'genre',
    filterGenre: 'Sports',
    description: 'Tournament arcs, team rivalries, and pushing past every limit.',
    backdrop: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/20464-PpYjO9cPN1gs.jpg',
  },
  {
    id: 'Adventure',
    name: 'Grand Adventure',
    slug: 'Adventure',
    type: 'genre',
    filterGenre: 'Adventure',
    description: 'Uncharted seas, sprawling continents, and legendary treasures.',
    backdrop: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/21-wf37VakJmZqs.jpg',
  },
  {
    id: 'Mystery',
    name: 'Mystery & Detective',
    slug: 'Mystery',
    type: 'genre',
    filterGenre: 'Mystery',
    description: 'Intricate puzzles, cold cases, and gripping whodunits.',
    backdrop: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/16498-8jpFCOcDmneX.jpg',
  },
  {
    id: 'Mecha',
    name: 'Mecha',
    slug: 'Mecha',
    type: 'genre',
    filterGenre: 'Mecha',
    description: 'Giant piloted robots, orbital battles, and political intrigue.',
    backdrop: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/1575.jpg',
  },
];
