import { scrapeAnime } from './scraper.js';
import { refreshCookies, getCachedCookies } from './refresher.js';
import {
  getCache,
  setCache,
  saveAnimeDetails,
  getAnimeDetails,
  getNexusShow,
  getDbStats,
  getAllNexusPostersMap,
  findNexusPoster,
} from './database.js';

function enrichMediaNode(m) {
  if (!m) return;
  const title = m.title?.english || m.title?.romaji || m.title?.native || '';
  const poster = findNexusPoster(title);
  if (poster) {
    m.nexusPoster = poster;
    if (m.coverImage) {
      m.coverImage.extraLarge = poster;
      m.coverImage.large = poster;
    }
  }
}

function enrichWithNexusArt(data) {
  if (!data) return data;
  try {
    if (Array.isArray(data.Page?.media)) {
      for (const m of data.Page.media) {
        enrichMediaNode(m);
      }
    }
    if (data.Media) {
      enrichMediaNode(data.Media);
      if (Array.isArray(data.Media.recommendations?.nodes)) {
        for (const node of data.Media.recommendations.nodes) {
          if (node?.mediaRecommendation) {
            enrichMediaNode(node.mediaRecommendation);
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return data;
}

async function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

export async function handleNexusApi(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-refresh-secret');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const url = new URL(req.url, 'http://localhost:5173');
  const pathname = url.pathname;

  // Manual / Cron Refresh Endpoint: /api/nexus/refresh
  if (pathname === '/api/nexus/refresh' || pathname === '/refresh') {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
      return;
    }
    const secret = req.headers['x-refresh-secret'];
    const expected = process.env.REFRESH_SECRET || 'VelocityOnTop0';
    if (secret && secret !== expected) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    try {
      const cookies = await refreshCookies(true);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, cookies: cookies.map((c) => c.name) }));
      return;
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: err.message }));
      return;
    }
  }

  // Status & Database Stats: /api/nexus/status or /api/cache/stats
  if (pathname === '/api/nexus/status' || pathname === '/api/cache/stats') {
    const cookies = getCachedCookies();
    const stats = getDbStats();
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'kotatsu-hybrid-engine',
        cookieCount: cookies.length,
        cookieNames: cookies.map((c) => c.name),
        database: stats,
      })
    );
    return;
  }

  // Fast Full AnimeNexus Posters Map: /api/nexus/posters-map
  if (pathname === '/api/nexus/posters-map' || pathname === '/api/posters') {
    const map = getAllNexusPostersMap();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=1800');
    res.end(JSON.stringify(map));
    return;
  }

  // Smart GraphQL Proxy with SQLite Caching & Nexus Fallback: /api/gql-proxy
  if (pathname === '/api/gql-proxy') {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    const { query, variables } = await parseJsonBody(req);
    const normalizedQ = query ? query.replace(/\s+/g, ' ').trim() : '';
    const hashKey = `gql:${normalizedQ}:${JSON.stringify(variables || {})}`;

    // 1. Check local SQLite DB cache
    const cached = getCache(hashKey, false);
    if (cached?.data) {
      enrichWithNexusArt(cached.data);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Cache', 'HIT');
      res.end(JSON.stringify({ data: cached.data }));
      return;
    }

    // 2. Fetch from AniList GraphQL
    try {
      const upstreamRes = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(9000),
      });

      if (upstreamRes.ok) {
        const json = await upstreamRes.json();
        if (json?.data) {
          // Persist to SQLite DB (7 days TTL)
          setCache(hashKey, json.data, 86400 * 7);
          if (json.data.Media?.id) {
            saveAnimeDetails(json.data.Media.id, json.data.Media, 'anilist');
          }
          enrichWithNexusArt(json.data);
        }
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-Cache', 'MISS');
        res.end(JSON.stringify(json));
        return;
      }

      console.warn(
        `[GQL Proxy] Upstream AniList returned HTTP ${upstreamRes.status}. Checking local fallbacks...`
      );

      // Fallback A: Stale SQLite Cache Entry
      const stale = getCache(hashKey, true);
      if (stale?.data) {
        console.log('[GQL Proxy] ⚡ Serving stale SQLite cache due to rate limit/error');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-Cache', 'STALE');
        res.end(JSON.stringify({ data: stale.data, _stale: true }));
        return;
      }

      // Fallback B: If searching or querying Media, build from AnimeNexus
      const targetQuery =
        variables?.search ||
        (variables?.id ? String(variables.id) : null);

      if (targetQuery) {
        console.log(`[GQL Proxy] 🌐 Attempting AnimeNexus fallback for "${targetQuery}"...`);
        const nexus = await scrapeAnime(targetQuery).catch(() => null);
        if (nexus?.success && nexus?.anime) {
          const fallbackMedia = {
            id: variables?.id || 999999,
            idMal: null,
            title: {
              romaji: nexus.anime.name,
              english: nexus.anime.name,
              native: nexus.anime.name,
              userPreferred: nexus.anime.name,
            },
            description: nexus.anime.overview || 'Synopsis provided by AnimeNexus.',
            coverImage: {
              extraLarge: nexus.art?.poster || '',
              large: nexus.art?.poster || '',
              medium: nexus.art?.poster || '',
            },
            bannerImage: nexus.art?.poster || null,
            episodes: nexus.total_episodes_found || 12,
            status: 'FINISHED',
            format: 'TV',
            averageScore: 82,
            genres: ['Action', 'Fantasy'],
            isAdult: false,
            nexusLogo: nexus.art?.logo || null,
          };

          const payload = { Media: fallbackMedia };
          setCache(hashKey, payload, 86400 * 3);
          saveAnimeDetails(fallbackMedia.id, fallbackMedia, 'nexus');

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('X-Cache', 'NEXUS-FALLBACK');
          res.end(JSON.stringify({ data: payload }));
          return;
        }
      }

      res.statusCode = upstreamRes.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: `AniList upstream returned ${upstreamRes.status}` }));
      return;
    } catch (netErr) {
      console.warn('[GQL Proxy] Network error:', netErr.message);
      const stale = getCache(hashKey, true);
      if (stale?.data) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-Cache', 'STALE-OFFLINE');
        res.end(JSON.stringify({ data: stale.data, _stale: true }));
        return;
      }

      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'GQL upstream connection failed: ' + netErr.message }));
      return;
    }
  }

  // Scraper Endpoint: /api/anime or /api/nexus/anime
  if (pathname === '/api/anime' || pathname === '/api/nexus/anime') {
    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    const q = url.searchParams.get('q');
    const ep = url.searchParams.get('ep');

    if (!q || !q.trim()) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: 'Missing search query. Use ?q=your+anime' }));
      return;
    }

    try {
      const data = await scrapeAnime(q, ep);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
      return;
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: err.message }));
      return;
    }
  }

  // Fallthrough
  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Not found' }));
}
