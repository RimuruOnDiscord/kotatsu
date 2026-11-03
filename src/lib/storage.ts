import { AnimeMedia } from './api';

export type WatchlistStatus = 'watchlist' | 'planned' | 'completed';

export interface WatchlistEntry {
  id: string | number;
  type: 'anime';
  title: string;
  poster?: string | null;
  backdrop?: string | null;
  year?: string | number | null;
  rating?: string | number | null;
  genres?: string[];
  status: WatchlistStatus;
  addedAt: number;
}

export interface ContinueWatchingEntry {
  id: string | number;
  type: 'anime';
  title: string;
  poster?: string | null;
  backdrop?: string | null;
  still?: string | null; // actual episode screencap/thumbnail
  season: number;
  episode: number;
  episodeTitle?: string;
  progress: number; // 0 to 100
  currentTime: number;
  duration: number;
  updatedAt: number;
}

export interface UserProfile {
  id: string;
  name: string;
  avatar: string;
  isKids?: boolean;
}

const WATCHLIST_KEY = 'bingr_anime_watchlist';
const CONTINUE_KEY = 'bingr_anime_continue_watching';
const SEARCH_HISTORY_KEY = 'bingr_anime_search_history';
const PROFILES_KEY = 'bingr_anime_profiles';
const ACTIVE_PROFILE_KEY = 'bingr_anime_active_profile';
const KIDS_MODE_KEY = 'bingr_kids_mode';
const EPISODE_THUMBNAILS_KEY = 'bingr_anime_episode_thumbnails';
const EPISODE_PROGRESS_KEY = 'bingr_anime_episode_progress';

export interface EpisodeProgressEntry {
  currentTime: number;
  duration: number;
  progress: number; // 0 to 100
  updatedAt: number;
}

export function getEpisodeProgress(animeId: string | number, episode: number): EpisodeProgressEntry | null {
  try {
    const raw = localStorage.getItem(EPISODE_PROGRESS_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    return map[`${animeId}-${episode}`] || null;
  } catch {
    return null;
  }
}

export function saveEpisodeProgress(
  animeId: string | number,
  episode: number,
  currentTime: number,
  duration: number
): void {
  if (!Number.isFinite(currentTime) || currentTime < 0) return;
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 1440;
  const progress = Math.min(100, Math.max(0, Math.round((currentTime / safeDuration) * 100)));
  try {
    const raw = localStorage.getItem(EPISODE_PROGRESS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[`${animeId}-${episode}`] = {
      currentTime: Math.floor(currentTime),
      duration: Math.floor(safeDuration),
      progress,
      updatedAt: Date.now(),
    };
    localStorage.setItem(EPISODE_PROGRESS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function getEpisodeThumbnail(animeId: string | number, episode: number): string | null {
  try {
    const raw = localStorage.getItem(EPISODE_THUMBNAILS_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    return map[`${animeId}-${episode}`] || null;
  } catch {
    return null;
  }
}

export function cacheEpisodeThumbnail(animeId: string | number, episode: number, url: string): void {
  if (!url) return;
  try {
    const raw = localStorage.getItem(EPISODE_THUMBNAILS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[`${animeId}-${episode}`] = url;
    localStorage.setItem(EPISODE_THUMBNAILS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function updateContinueWatchingThumbnail(id: string | number, still: string): void {
  if (!still) return;
  try {
    const list = getContinueWatching();
    let updated = false;
    const next = list.map((item) => {
      if (String(item.id) === String(id)) {
        updated = true;
        return { ...item, still };
      }
      return item;
    });
    if (updated) {
      localStorage.setItem(CONTINUE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event('bingr-storage-update'));
    }
  } catch {
    // ignore
  }
}

export const DEFAULT_AVATARS = [
  'https://s4.anilist.co/file/anilistcdn/character/large/b40882-dsj7384.png',
  'https://s4.anilist.co/file/anilistcdn/character/large/b126071-BTNEc1nRIv68.png',
  'https://s4.anilist.co/file/anilistcdn/character/large/b17-IazKGogQwJ1p.png',
  'https://s4.anilist.co/file/anilistcdn/character/large/b40-fDTa3f41.png',
];

export function getWatchlist(): WatchlistEntry[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getWatchlistItemStatus(id: string | number): WatchlistStatus | null {
  const list = getWatchlist();
  const found = list.find((item) => String(item.id) === String(id));
  return found ? found.status : null;
}

export function setWatchlistItem(media: AnimeMedia, status: WatchlistStatus | null): WatchlistEntry[] {
  const list = getWatchlist().filter((item) => String(item.id) !== String(media.id));
  if (status) {
    list.unshift({
      id: media.id,
      type: 'anime',
      title: media.title,
      poster: media.poster,
      backdrop: media.backdrop,
      year: media.year,
      rating: media.rating,
      genres: media.genres,
      status,
      addedAt: Date.now(),
    });
  }
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('bingr-storage-update'));
  return list;
}

/** Change an existing entry's status in place (keeps its position and addedAt). */
export function updateWatchlistStatus(id: string | number, status: WatchlistStatus): WatchlistEntry[] {
  const list = getWatchlist().map((item) =>
    String(item.id) === String(id) ? { ...item, status } : item
  );
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('bingr-storage-update'));
  return list;
}

export function getContinueWatching(): ContinueWatchingEntry[] {
  try {
    const raw = localStorage.getItem(CONTINUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveContinueWatching(entry: Omit<ContinueWatchingEntry, 'updatedAt'>): ContinueWatchingEntry[] {
  const cachedStill = entry.still || getEpisodeThumbnail(entry.id, entry.episode);
  if (entry.still) {
    cacheEpisodeThumbnail(entry.id, entry.episode, entry.still);
  }
  const existingList = getContinueWatching();
  const prevSameEp = existingList.find(
    (item) => String(item.id) === String(entry.id) && Number(item.episode) === Number(entry.episode)
  );
  const savedEpProg = getEpisodeProgress(entry.id, entry.episode);

  let resolvedTime = entry.currentTime;
  let resolvedDuration = entry.duration || 1440;
  let resolvedProgress = entry.progress;

  if (resolvedTime <= 0) {
    if (savedEpProg && savedEpProg.currentTime > 0) {
      resolvedTime = savedEpProg.currentTime;
      resolvedDuration = savedEpProg.duration || resolvedDuration;
      resolvedProgress = savedEpProg.progress;
    } else if (prevSameEp && prevSameEp.currentTime > 0) {
      resolvedTime = prevSameEp.currentTime;
      resolvedDuration = prevSameEp.duration || resolvedDuration;
      resolvedProgress = prevSameEp.progress;
    }
  } else {
    saveEpisodeProgress(entry.id, entry.episode, resolvedTime, resolvedDuration);
    resolvedProgress = Math.min(100, Math.max(2, Math.round((resolvedTime / resolvedDuration) * 100)));
  }

  const list = existingList.filter((item) => String(item.id) !== String(entry.id));
  const updated: ContinueWatchingEntry = {
    ...entry,
    currentTime: resolvedTime,
    duration: resolvedDuration,
    progress: resolvedProgress,
    still: cachedStill || prevSameEp?.still || entry.still || undefined,
    updatedAt: Date.now(),
  };
  list.unshift(updated);
  const trimmed = list.slice(0, 24);
  localStorage.setItem(CONTINUE_KEY, JSON.stringify(trimmed));
  window.dispatchEvent(new Event('bingr-storage-update'));
  return trimmed;
}

export function removeContinueWatching(id: string | number): ContinueWatchingEntry[] {
  const list = getContinueWatching().filter((item) => String(item.id) !== String(id));
  localStorage.setItem(CONTINUE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('bingr-storage-update'));
  return list;
}

export function getSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addSearchHistory(query: string): string[] {
  const q = query.trim();
  if (!q) return getSearchHistory();
  const list = getSearchHistory().filter((item) => item.toLowerCase() !== q.toLowerCase());
  list.unshift(q);
  const trimmed = list.slice(0, 10);
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(trimmed));
  return trimmed;
}

export function removeSearchHistoryItem(query: string): string[] {
  const list = getSearchHistory().filter((item) => item !== query);
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(list));
  return list;
}

export function clearSearchHistory(): void {
  localStorage.removeItem(SEARCH_HISTORY_KEY);
}

export function getProfiles(): UserProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  const defaults: UserProfile[] = [
    { id: 'main', name: 'Otaku', avatar: 'https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=Gojo' },
    { id: 'kids', name: 'Kids', avatar: 'https://api.dicebear.com/9.x/fun-emoji/svg?seed=Anya', isKids: true },
  ];
  localStorage.setItem(PROFILES_KEY, JSON.stringify(defaults));
  return defaults;
}

export function saveProfiles(profiles: UserProfile[]): void {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  window.dispatchEvent(new Event('bingr-storage-update'));
}

export function getActiveProfile(): UserProfile {
  const profiles = getProfiles();
  const activeId = localStorage.getItem(ACTIVE_PROFILE_KEY) || 'main';
  return profiles.find((p) => p.id === activeId) || profiles[0];
}

export function setActiveProfile(profileId: string): UserProfile {
  localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
  const profile = getActiveProfile();
  localStorage.setItem(KIDS_MODE_KEY, profile.isKids ? 'true' : 'false');
  window.dispatchEvent(new Event('bingr-storage-update'));
  return profile;
}

export function isKidsMode(): boolean {
  return localStorage.getItem(KIDS_MODE_KEY) === 'true';
}
