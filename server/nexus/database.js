import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveWritableDataDir() {
  const defaultDir = path.resolve(__dirname, '../data');
  if (process.env.VERCEL) {
    const tmpDir = '/tmp/kotatsu-data';
    try {
      fs.mkdirSync(tmpDir, { recursive: true });
      return tmpDir;
    } catch {
      return defaultDir;
    }
  }
  try {
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
    }
    return defaultDir;
  } catch {
    const tmpDir = '/tmp/kotatsu-data';
    try {
      fs.mkdirSync(tmpDir, { recursive: true });
    } catch {}
    return tmpDir;
  }
}

const dataDir = resolveWritableDataDir();

const dbPath = path.join(dataDir, 'kotatsu.db');
let db = null;

function getDb() {
  if (!db) {
    db = new DatabaseSync(dbPath);
    // Performance optimizations
    try {
      db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;

        CREATE TABLE IF NOT EXISTS cache_entries (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_entries (expires_at);

        CREATE TABLE IF NOT EXISTS anime_details (
          id TEXT PRIMARY KEY,
          title TEXT,
          data TEXT NOT NULL,
          source TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_anime_title ON anime_details (title);

        CREATE TABLE IF NOT EXISTS nexus_shows (
          id TEXT PRIMARY KEY,
          query_key TEXT,
          slug TEXT,
          name TEXT,
          logo TEXT,
          poster TEXT,
          overview TEXT,
          data TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_nexus_query ON nexus_shows (query_key);
        CREATE INDEX IF NOT EXISTS idx_nexus_slug ON nexus_shows (slug);
      `);
    } catch (e) {
      console.warn('[Database] Initialization note:', e.message);
    }
  }
  return db;
}

/**
 * Cache operations
 */
export function getCache(key, allowStale = false) {
  try {
    const database = getDb();
    const row = database
      .prepare('SELECT value, expires_at FROM cache_entries WHERE key = ?')
      .get(key);

    if (!row) return null;

    const isExpired = Date.now() > row.expires_at;
    if (isExpired && !allowStale) return null;

    return {
      data: JSON.parse(row.value),
      isStale: isExpired,
      expiresAt: row.expires_at,
    };
  } catch (err) {
    console.error('[Database Cache] get error:', err.message);
    return null;
  }
}

export function setCache(key, value, ttlSeconds = 86400 * 7) {
  try {
    const database = getDb();
    const now = Date.now();
    const expiresAt = now + ttlSeconds * 1000;
    const valueStr = JSON.stringify(value);

    database
      .prepare(`
        INSERT INTO cache_entries (key, value, expires_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          expires_at = excluded.expires_at,
          updated_at = excluded.updated_at
      `)
      .run(key, valueStr, expiresAt, now);

    return true;
  } catch (err) {
    console.error('[Database Cache] set error:', err.message);
    return false;
  }
}

/**
 * Anime Details operations
 */
export function saveAnimeDetails(id, data, source = 'anilist') {
  try {
    const database = getDb();
    const now = Date.now();
    const title =
      typeof data?.title === 'object'
        ? data.title.english || data.title.romaji || data.title.userPreferred || ''
        : data?.title || '';

    database
      .prepare(`
        INSERT INTO anime_details (id, title, data, source, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          data = excluded.data,
          source = excluded.source,
          updated_at = excluded.updated_at
      `)
      .run(String(id), title, JSON.stringify(data), source, now);

    return true;
  } catch (err) {
    console.error('[Database Anime] save error:', err.message);
    return false;
  }
}

export function getAnimeDetails(id) {
  try {
    const database = getDb();
    const row = database
      .prepare('SELECT data, source, updated_at FROM anime_details WHERE id = ?')
      .get(String(id));

    if (!row) return null;
    return {
      data: JSON.parse(row.data),
      source: row.source,
      updatedAt: row.updated_at,
    };
  } catch (err) {
    console.error('[Database Anime] get error:', err.message);
    return null;
  }
}

/**
 * Nexus Shows operations
 */
export function saveNexusShow(queryKey, showData) {
  try {
    const database = getDb();
    const now = Date.now();
    const id = showData?.anime?.id || showData?.id || String(Date.now());
    const slug = showData?.anime?.slug || showData?.slug || '';
    const name = showData?.anime?.name || showData?.name || '';
    const logo = showData?.art?.logo || null;
    const poster = showData?.art?.poster || null;
    const overview = showData?.anime?.overview || showData?.overview || null;

    database
      .prepare(`
        INSERT INTO nexus_shows (id, query_key, slug, name, logo, poster, overview, data, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          query_key = excluded.query_key,
          slug = excluded.slug,
          name = excluded.name,
          logo = COALESCE(excluded.logo, nexus_shows.logo),
          poster = COALESCE(excluded.poster, nexus_shows.poster),
          overview = COALESCE(excluded.overview, nexus_shows.overview),
          data = excluded.data,
          updated_at = excluded.updated_at
      `)
      .run(
        id,
        queryKey.toLowerCase().trim(),
        slug,
        name,
        logo,
        poster,
        overview,
        JSON.stringify(showData),
        now
      );

    return true;
  } catch (err) {
    console.error('[Database Nexus] save error:', err.message);
    return false;
  }
}

export function getNexusShow(queryOrSlug) {
  try {
    const database = getDb();
    const normalized = queryOrSlug.toLowerCase().trim();
    const rows = database
      .prepare(`
        SELECT query_key, slug, name, data, updated_at FROM nexus_shows
        WHERE query_key = ? OR slug = ? OR lower(name) = ?
        ORDER BY updated_at DESC
      `)
      .all(normalized, normalized, normalized);

    for (const row of rows) {
      if (
        row.slug?.toLowerCase().trim() === normalized ||
        row.name?.toLowerCase().trim() === normalized ||
        isMatchingTitleKey(normalized, row.name, row.slug)
      ) {
        return JSON.parse(row.data);
      }
    }
    return null;
  } catch (err) {
    console.error('[Database Nexus] get error:', err.message);
    return null;
  }
}

/**
 * DB Stats
 */
export function getDbStats() {
  try {
    const database = getDb();
    const cacheCount = database.prepare('SELECT count(*) as count FROM cache_entries').get().count;
    const animeCount = database.prepare('SELECT count(*) as count FROM anime_details').get().count;
    const nexusCount = database.prepare('SELECT count(*) as count FROM nexus_shows').get().count;

    return {
      dbPath,
      cacheEntries: cacheCount,
      cachedAnime: animeCount,
      cachedNexusShows: nexusCount,
    };
  } catch (err) {
    return { error: err.message };
  }
}

function isMatchingTitleKey(queryKey, name, slug) {
  if (!queryKey) return false;
  const norm = (s) =>
    String(s || '')
      .replace(/-[0-9a-f]{16,}$/i, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const qNorm = norm(queryKey);
  const nNorm = norm(name);
  const sNorm = norm(slug);
  if (!qNorm) return false;
  if (qNorm === nNorm || qNorm === sNorm) return true;
  if (qNorm.length >= 4 && (nNorm.includes(qNorm) || sNorm.includes(qNorm))) return true;
  const stopWords = new Set(['the', 'in', 'of', 'to', 'no', 'ni', 'wa', 'ga', 'and', 'for', 'on', 'at', 'by', 'with']);
  const qWords = qNorm.split(' ').filter((w) => w.length >= 2 && !stopWords.has(w));
  if (!qWords.length) return false;
  const targetWords = new Set(`${nNorm} ${sNorm}`.split(' '));
  const matched = qWords.filter((w) => targetWords.has(w)).length;
  return matched / qWords.length >= 0.6;
}

/**
 * Returns a key-value mapping of { normalized_title: poster_url, "banner:" + normalized_title: ep1_thumb_url } from all cached nexus shows
 */
export function getAllNexusPostersMap() {
  try {
    const database = getDb();
    const rows = database
      .prepare(`
        SELECT query_key, slug, name, poster, logo, data FROM nexus_shows
        WHERE poster IS NOT NULL AND length(poster) > 0
      `)
      .all();

    const map = {};
    for (const r of rows) {
      let epThumb = null;
      if (r.data) {
        try {
          const parsed = JSON.parse(r.data);
          epThumb = parsed?.episodes?.[0]?.thumbnail || null;
        } catch {
          // ignore
        }
      }
      const validQueryKey = isMatchingTitleKey(r.query_key, r.name, r.slug);
      if (r.poster) {
        if (validQueryKey && r.query_key) map[r.query_key.toLowerCase().trim()] = r.poster;
        if (r.slug) map[r.slug.toLowerCase().trim()] = r.poster;
        if (r.name) map[r.name.toLowerCase().trim()] = r.poster;
      }
      if (epThumb) {
        if (validQueryKey && r.query_key) map[`banner:${r.query_key.toLowerCase().trim()}`] = epThumb;
        if (r.slug) map[`banner:${r.slug.toLowerCase().trim()}`] = epThumb;
        if (r.name) map[`banner:${r.name.toLowerCase().trim()}`] = epThumb;
      }
    }
    return map;
  } catch (err) {
    console.error('[Database Nexus] getAllNexusPostersMap error:', err.message);
    return {};
  }
}

/**
 * Exact search for an AnimeNexus poster by show title (No fuzzy mismatching)
 */
export function findNexusPoster(title) {
  if (!title) return null;
  try {
    const database = getDb();
    const clean = title.toLowerCase().trim();

    // Exact match by slug or lower(name), or validated query_key
    const rows = database
      .prepare(`
        SELECT query_key, slug, name, poster FROM nexus_shows
        WHERE (query_key = ? OR slug = ? OR lower(name) = ?) AND poster IS NOT NULL
      `)
      .all(clean, clean, clean);
    for (const row of rows) {
      if (
        row.slug?.toLowerCase().trim() === clean ||
        row.name?.toLowerCase().trim() === clean ||
        isMatchingTitleKey(clean, row.name, row.slug)
      ) {
        return row.poster;
      }
    }

    return null;
  } catch {
    return null;
  }
}
