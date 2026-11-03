import { getCachedSession, refreshCookies } from './refresher.js';
import { getNexusShow, saveNexusShow, getAnimeDetails } from './database.js';

let cachedCookieString = null;
let lastCookieBuild = 0;

export async function getSession(forceRefresh = false) {
  const now = Date.now();
  let session = getCachedSession();
  if (!session?.cookies?.length || forceRefresh || now - lastCookieBuild > 60000) {
    if (!session?.cookies?.length || forceRefresh) {
      await refreshCookies(forceRefresh);
      session = getCachedSession();
    }
    if (session?.cookies?.length) {
      cachedCookieString = session.cookies.map(c => `${c.name}=${c.value}`).join('; ');
      lastCookieBuild = now;
    }
  }
  return {
    cookies: cachedCookieString || session.cookies.map(c => `${c.name}=${c.value}`).join('; '),
    userAgent: session.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36',
    fingerprint: session.fingerprint || '1734c53a-2ee2-40c6-b022-c019edfe9757:da9cf4ea-1d71-48b7-98ac-81579702a2af',
  };
}

export async function scrapeAnime(searchQuery, targetEp) {
  if (!searchQuery || !searchQuery.trim()) {
    throw new Error('Missing search query.');
  }

  let query = searchQuery.trim();

  // If a numeric AniList ID was passed instead of a title, resolve its title first
  if (/^\d+$/.test(query)) {
    const cachedMedia = getAnimeDetails(Number(query));
    const resolvedTitle =
      cachedMedia?.title?.english ||
      cachedMedia?.title?.romaji ||
      cachedMedia?.title?.userPreferred;
    if (resolvedTitle) {
      query = resolvedTitle;
    } else {
      try {
        const gqlRes = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            query: 'query ($id: Int) { Media(id: $id, type: ANIME) { title { english romaji } } }',
            variables: { id: Number(query) },
          }),
          signal: AbortSignal.timeout(4000),
        });
        if (gqlRes.ok) {
          const gqlJson = await gqlRes.json();
          const t = gqlJson?.data?.Media?.title;
          if (t?.english || t?.romaji) {
            query = t.english || t.romaji;
          }
        }
      } catch {
        // ignore
      }
    }
  }

  // If show info (not specific episode) is requested, check SQLite DB first
  if (!targetEp) {
    const cachedShow = getNexusShow(query);
    if (cachedShow && cachedShow.art?.logo) {
      return cachedShow;
    }
  }

  let session = await getSession();

  const makeHeaders = (referer = 'https://anime.nexus/') => ({
    'User-Agent': session.userAgent,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': referer,
    'Origin': 'https://anime.nexus',
    'x-client-fingerprint': session.fingerprint,
    'x-fingerprint': session.fingerprint,
    'Cookie': session.cookies,
  });

  // STEP 1: Search shows (strip hyphens/colons so '-Word' is never parsed as a search negation operator)
  const safeSearchQuery = String(query || '')
    .replace(/[-–—:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const searchApiUrl = `https://api.anime.nexus/api/anime/shows?search=${encodeURIComponent(safeSearchQuery || query)}&sortBy=name+asc&page=1&includes[]=poster`;
  let searchRes = await fetch(searchApiUrl, { headers: makeHeaders() });

  // If Cloudflare 403, trigger cookie refresh and retry once
  if (searchRes.status === 403 || searchRes.status === 401) {
    console.log('[Nexus Scraper] ⚠️ Got 403 on search — triggering cookie refresh...');
    session = await getSession(true);
    searchRes = await fetch(searchApiUrl, { headers: makeHeaders() });
  }

  if (!searchRes.ok) {
    throw new Error(`Search API responded with HTTP ${searchRes.status}`);
  }

  const searchData = await searchRes.json().catch(() => null);
  const items = searchData?.data || [];
  if (!items.length) {
    return { success: false, error: `No anime found for: "${query}"` };
  }

  const norm = (str) =>
    String(str || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const queryNorm = norm(query);
  const STOP_WORDS = new Set(['the', 'in', 'of', 'to', 'no', 'ni', 'wa', 'ga', 'and', 'for', 'on', 'at', 'by', 'with']);
  const queryWords = queryNorm.split(' ').filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
  const wantsMovie = /\b(movie|film|ova|special)\b/i.test(query);

  const isSpinOffUnrequested = (text) => {
    const spinoffs = ['petit', 'break time', 'memory snow', 'frozen bond', 'chibi', 'mini', 'recap', 'summary'];
    return spinoffs.some((sp) => text.includes(sp) && !queryNorm.includes(sp));
  };

  const hasWordOverlap = (s) => {
    const nameNorm = norm(s?.name);
    const slugNorm = norm(String(s?.slug || '').replace(/-[0-9a-f]{16,}$/i, ''));
    if (!nameNorm && !slugNorm) return false;
    if (nameNorm === queryNorm || slugNorm === queryNorm) return true;
    if (queryNorm.length >= 4 && (nameNorm.includes(queryNorm) || slugNorm.includes(queryNorm))) return true;
    if (!queryWords.length) return false;
    const candidateWords = new Set(`${nameNorm} ${slugNorm}`.split(' '));
    const matchedCount = queryWords.filter((w) => candidateWords.has(w)).length;
    return matchedCount / queryWords.length >= 0.6;
  };

  const scoreShow = (s) => {
    if (!hasWordOverlap(s)) return -9999;
    const nameNorm = norm(s.name);
    const slugNorm = norm(String(s.slug || '').replace(/-[0-9a-f]{16,}$/i, ''));
    let score = 0;

    if (nameNorm === queryNorm || slugNorm === queryNorm) score += 1000;
    else if (nameNorm.startsWith(queryNorm + ' ') || slugNorm.startsWith(queryNorm + ' ')) score += 600;
    else if (nameNorm.includes(queryNorm) || slugNorm.includes(queryNorm)) score += 350;
    else {
      const candidateWords = new Set(`${nameNorm} ${slugNorm}`.split(' '));
      const matchedCount = queryWords.filter((w) => candidateWords.has(w)).length;
      score += Math.round((matchedCount / Math.max(1, queryWords.length)) * 250);
    }

    if (isSpinOffUnrequested(nameNorm) || isSpinOffUnrequested(slugNorm)) {
      score -= 500;
    }

    // Prefer TV / ONA series unless the query specifically asks for a movie/OVA
    if (!wantsMovie) {
      if (s.type === 'TV' || s.type === 'ONA') score += 180;
      else if (s.type === 'Movie' || s.type === 'Special') score -= 120;
    }

    // Prefer the base series (shorter title) over long sub-arc/sequel suffixes when ambiguous
    score -= Math.min(120, Math.abs(nameNorm.length - queryNorm.length) * 2);
    return score;
  };

  const rankedItems = [...items]
    .filter((s) => hasWordOverlap(s))
    .sort((a, b) => scoreShow(b) - scoreShow(a));
  let matchedShow = rankedItems[0];
  if (!matchedShow) {
    return { success: false, error: `No matching anime found for: "${query}"` };
  }

  // ==========================================
  // IF A SPECIFIC EPISODE WAS REQUESTED
  // ==========================================
  if (targetEp) {
    let epMatch = null;
    // Check top ranked candidate shows in case the first candidate is an unreleased entry
    const candidatesToTry = rankedItems.slice(0, 4);

    for (const candidate of candidatesToTry) {
      const episodesApiUrl = `https://api.anime.nexus/api/anime/details/episodes?id=${candidate.id}&page=1&perPage=100&order=asc&fillers=true&recaps=true`;
      let episodesRes = await fetch(episodesApiUrl, { headers: makeHeaders() });
      if (episodesRes.status === 403) {
        session = await getSession(true);
        episodesRes = await fetch(episodesApiUrl, { headers: makeHeaders() });
      }
      const episodesData = await episodesRes.json().catch(() => ({ data: [] }));
      const epList = episodesData?.data || [];

      const found = epList.find((e) => String(e.number) === String(targetEp));
      if (found) {
        matchedShow = candidate;
        epMatch = found;
        break;
      }
    }

    if (!epMatch) {
      return { success: false, error: `Episode ${targetEp} not found for this show.` };
    }

    const animeId = matchedShow.id;
    const animeSlug = matchedShow.slug;

    const episodePageUrl = `https://anime.nexus/series/${animeId}/${animeSlug}/episodes/${epMatch.number}`;
    const streamApiUrl = `https://api.anime.nexus/api/anime/details/episode/stream?id=${epMatch.id}&fillers=true&recaps=true`;

    let streamRes = await fetch(streamApiUrl, {
      headers: makeHeaders(episodePageUrl),
    });

    if (streamRes.status === 403) {
      console.log('[Nexus Scraper] Got 403 on stream — triggering emergency refresh...');
      session = await getSession(true);
      streamRes = await fetch(streamApiUrl, { headers: makeHeaders(episodePageUrl) });
    }

    if (!streamRes.ok) {
      return { success: false, error: `Stream fetch failed with HTTP ${streamRes.status}` };
    }

    const streamJson = await streamRes.json().catch(() => null);
    return {
      success: true,
      anime: { id: animeId, slug: animeSlug, name: matchedShow.name },
      episode: { id: epMatch.id, number: epMatch.number, title: epMatch.title },
      data: streamJson?.data || streamJson,
    };
  }

  const animeId = matchedShow.id;
  const animeSlug = matchedShow.slug;

  // ==========================================
  // NO EPISODE REQUESTED — Return show metadata & logo
  // ==========================================
  const episodesApiUrl = `https://api.anime.nexus/api/anime/details/episodes?id=${animeId}&page=1&perPage=50&order=asc&fillers=true&recaps=true`;
  const targetUrl = `https://anime.nexus/series/${animeId}/${animeSlug}`;

  const [episodesRes, html] = await Promise.all([
    fetch(episodesApiUrl, { headers: makeHeaders() }).then(r => r.json()).catch(() => ({ data: [] })),
    fetch(targetUrl, { headers: { ...makeHeaders(), Accept: 'text/html' } }).then(r => r.text()).catch(() => null),
  ]);

  let originalLogoPng = null;
  if (html) {
    try {
      const logoRegex = /logo:\$R\[\d+\]=\{resized:\$R\[\d+\]=\{large:"([^"]+)"/;
      const match = html.match(logoRegex);
      if (match && match[1]) {
        const cdnPath = match[1];
        const base64Marker = 'aHR0cHM6';
        const markerIndex = cdnPath.indexOf(base64Marker);
        if (markerIndex !== -1) {
          const base64String = cdnPath.substring(markerIndex).replace(/\.[a-z0-9]+$/i, '').replace(/\//g, '');
          originalLogoPng = Buffer.from(base64String, 'base64').toString('utf-8');
        }
      }
    } catch {
      // ignore
    }
  }

  const episodes = (episodesRes.data || []).map(ep => ({
    id: ep.id,
    number: ep.number,
    title: ep.title,
    thumbnail: ep.image?.resized?.['1920x1080']
      ? `https://anime.delivery${ep.image.resized['1920x1080']}`
      : null,
  }));

  const result = {
    success: true,
    anime: {
      id: animeId,
      slug: animeSlug,
      name: matchedShow.name,
      url: targetUrl,
      overview: matchedShow.overview || matchedShow.description || null,
    },
    art: {
      logo: originalLogoPng,
      poster: matchedShow.poster?.resized?.['1560x2340']
        ? `https://anime.delivery${matchedShow.poster.resized['1560x2340']}`
        : null,
    },
    total_episodes_found: episodes.length,
    episodes,
  };

  try {
    saveNexusShow(query, result);
  } catch {
    // ignore
  }

  return result;
}
