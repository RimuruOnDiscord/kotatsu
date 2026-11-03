import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { Ytdl } from '@distube/ytdl-core';
import { getCachedSession } from './refresher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const trailersDir = process.env.VERCEL
  ? '/tmp/kotatsu-trailers'
  : path.resolve(__dirname, '../data/trailers');
try {
  if (!fs.existsSync(trailersDir)) {
    fs.mkdirSync(trailersDir, { recursive: true });
  }
} catch {}

const activeTrailerDownloads = new Map();

/**
 * Safely pipes a Node Readable stream (including Readable.fromWeb(fetchRes.body))
 * into an HTTP response without crashing the process on client aborts or
 * upstream HTTP/2 stream resets (ERR_HTTP2_STREAM_ERROR / TypeError: terminated).
 */
function safePipeStream(nodeStream, req, res) {
  const cleanup = () => {
    if (!nodeStream.destroyed) {
      try {
        nodeStream.destroy();
      } catch {
        // ignore
      }
    }
  };

  nodeStream.on('error', (err) => {
    // Ignore routine client disconnects / upstream HTTP2 stream resets
    if (
      err?.name === 'AbortError' ||
      err?.message === 'terminated' ||
      err?.code === 'ERR_STREAM_PREMATURE_CLOSE' ||
      err?.code === 'ERR_HTTP2_STREAM_ERROR' ||
      err?.cause?.code === 'ERR_HTTP2_STREAM_ERROR' ||
      err?.code === 'ECONNRESET'
    ) {
      // silent cleanup
    } else {
      console.warn('[proxy stream notice]:', err?.message || err);
    }
    if (!res.headersSent) {
      res.statusCode = 502;
    }
    if (!res.writableEnded && !res.destroyed) {
      try {
        res.end();
      } catch {
        // ignore
      }
    }
  });

  res.on('error', cleanup);
  res.on('close', cleanup);
  if (req) {
    req.on('aborted', cleanup);
    req.on('error', cleanup);
  }

  nodeStream.pipe(res);
}

export async function ensureTrailerDownloaded(videoId) {
  const filePath = path.join(trailersDir, `${videoId}.mp4`);
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 500 * 1024) {
    return true;
  }
  if (activeTrailerDownloads.has(videoId)) {
    return activeTrailerDownloads.get(videoId);
  }

  const downloadPromise = (async () => {
    try {
      const ytdl = new Ytdl();
      const info = await ytdl.getInfo(videoId);
      const videoFormats = info.formats
        .filter((f) => f.hasVideo && !f.hasAudio && (f.container === 'mp4' || f.mimeType?.includes('video/mp4')))
        .sort((a, b) => (b.height || 0) - (a.height || 0));
      let bestVideo = videoFormats[0];
      if (!bestVideo) {
        bestVideo = info.formats.filter((f) => f.hasVideo).sort((a, b) => (b.height || 0) - (a.height || 0))[0];
      }
      const audioFormats = info.formats
        .filter((f) => f.hasAudio && !f.hasVideo)
        .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));
      const bestAudio = audioFormats[0];

      if (!bestVideo?.url || !bestAudio?.url) return false;

      const tempFile = path.join(trailersDir, `${videoId}.tmp.mp4`);
      await new Promise((resolve, reject) => {
        const proc = spawn('ffmpeg', [
          '-y',
          '-ss', '0',
          '-t', '50',
          '-i', bestVideo.url,
          '-ss', '0',
          '-t', '50',
          '-i', bestAudio.url,
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-movflags', '+faststart',
          tempFile,
        ]);
        proc.on('close', (code) => {
          if (code === 0 && fs.existsSync(tempFile)) {
            fs.renameSync(tempFile, filePath);
            resolve(true);
          } else {
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
            reject(new Error(`ffmpeg code ${code}`));
          }
        });
        proc.on('error', reject);
      });
      return true;
    } catch (e) {
      console.warn(`[Trailer on-demand] Failed for ${videoId}:`, e.message);
      return false;
    } finally {
      activeTrailerDownloads.delete(videoId);
    }
  })();

  activeTrailerDownloads.set(videoId, downloadPromise);
  return downloadPromise;
}

export async function handleTrailerStream(req, res) {
  try {
    const parsed = new URL(req.url, 'http://localhost');
    let videoId = parsed.searchParams.get('id') || parsed.searchParams.get('videoId');
    if (!videoId) {
      const m = req.url.match(/\/(?:api\/trailer\/stream|api\/trailer|trailer)\/([a-zA-Z0-9_-]+)/);
      if (m) videoId = m[1];
    }
    if (!videoId) {
      res.statusCode = 400;
      res.end('Missing trailer video id');
      return;
    }
    videoId = videoId.replace(/\.mp4$/i, '').trim();

    const filePath = path.join(trailersDir, `${videoId}.mp4`);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 100 * 1024) {
      // Trigger background download
      ensureTrailerDownloaded(videoId).catch(() => {});
      if (parsed.searchParams.get('check') === '1') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ready: false, videoId }));
        return;
      }
      const ready = await Promise.race([
        ensureTrailerDownloaded(videoId),
        new Promise((r) => setTimeout(() => r(false), 3500)),
      ]);
      if (!ready || !fs.existsSync(filePath)) {
        res.statusCode = 404;
        res.end('Trailer downloading or unavailable');
        return;
      }
    }

    if (parsed.searchParams.get('check') === '1') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ready: true, videoId }));
      return;
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      });
      safePipeStream(fileStream, req, res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      });
      safePipeStream(fs.createReadStream(filePath), req, res);
    }
  } catch (err) {
    console.error('[trailer stream error]', err?.message);
    res.statusCode = 500;
    res.end('Server error: ' + err?.message);
  }
}

export async function handleImgProxy(req, res) {
  try {
    const parsed = new URL(req.url, 'http://localhost');
    const targetUrl = parsed.searchParams.get('url');
    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
      res.statusCode = 400;
      res.end('Invalid url');
      return;
    }

    const imgHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    };

    if (targetUrl.includes('anime.nexus') || targetUrl.includes('anime.delivery')) {
      imgHeaders['Referer'] = 'https://anime.nexus/';
      imgHeaders['Origin'] = 'https://anime.nexus';
      try {
        const session = getCachedSession();
        if (session?.cookies?.length) {
          imgHeaders['Cookie'] = session.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
        }
        if (session?.userAgent) {
          imgHeaders['User-Agent'] = session.userAgent;
        }
      } catch {
        // ignore
      }
    }

    const upstream = await fetch(targetUrl, {
      headers: imgHeaders,
    });
    res.statusCode = upstream.status;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    const cr = upstream.headers.get('content-range');
    if (cr) res.setHeader('Content-Range', cr);
    const ar = upstream.headers.get('accept-ranges');
    if (ar) res.setHeader('Accept-Ranges', ar);
    const cl = upstream.headers.get('content-length');
    if (cl) res.setHeader('Content-Length', cl);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (upstream.body) {
      safePipeStream(Readable.fromWeb(upstream.body), req, res);
    } else {
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.end(buf);
    }
  } catch (err) {
    console.error('[img-proxy error]', err?.message);
    res.statusCode = 502;
    res.end('Proxy error: ' + err?.message);
  }
}

export async function handleHlsProxy(req, res) {
  try {
    const parsed = new URL(req.url, 'http://localhost');
    const targetUrl = parsed.searchParams.get('url');
    let customReferer = parsed.searchParams.get('referer');

    if (
      targetUrl?.includes('eclipseharbor') ||
      targetUrl?.includes('nexabloom') ||
      targetUrl?.includes('emeralddrift') ||
      targetUrl?.includes('midnightvale') ||
      targetUrl?.includes('mgstatics') ||
      targetUrl?.includes('megaplay')
    ) {
      customReferer = 'https://megaplay.buzz/';
    } else if (
      targetUrl?.includes('flixcloud') ||
      targetUrl?.includes('phantomcdn') ||
      targetUrl?.includes('rundowncdn')
    ) {
      customReferer = 'https://flixcloud.cc/';
    } else if (targetUrl?.includes('echovideo')) {
      customReferer = 'https://play.echovideo.ru/';
    } else if (targetUrl?.includes('krussdomi')) {
      customReferer = 'https://krussdomi.com/';
    } else if (targetUrl?.includes('animegg.org')) {
      customReferer = 'https://www.animegg.org/';
    } else if (targetUrl?.includes('settlar')) {
      customReferer = 'https://embed.settlar.io/';
    } else if (targetUrl?.includes('senshi') || targetUrl?.includes('anidap')) {
      customReferer = 'https://senshi.to/';
    } else if (targetUrl?.includes('anime.nexus')) {
      customReferer = 'https://anime.nexus/';
    } else if (!customReferer) {
      if (targetUrl?.includes('vid-cdn.xyz')) customReferer = 'https://anizone.to/';
      else customReferer = 'https://anizone.to/';
    }

    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
      res.statusCode = 400;
      res.end('Invalid url');
      return;
    }

    const hlsHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...(customReferer
        ? { Referer: customReferer, Origin: customReferer.replace(/\/+$/, '') }
        : {}),
      ...(req.headers.range ? { Range: req.headers.range } : {}),
    };

    if (targetUrl.includes('anime.nexus') || targetUrl.includes('anime.delivery')) {
      try {
        const session = getCachedSession();
        if (session?.cookies?.length) {
          hlsHeaders['Cookie'] = session.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
        }
        if (session?.userAgent) {
          hlsHeaders['User-Agent'] = session.userAgent;
        }
        if (session?.fingerprint) {
          hlsHeaders['x-client-fingerprint'] = session.fingerprint;
          hlsHeaders['x-fingerprint'] = session.fingerprint;
        }
      } catch {
        // ignore
      }
    }

    let upstream = await fetch(targetUrl, {
      headers: hlsHeaders,
    });

    if ((upstream.status === 403 || upstream.status === 401) && customReferer) {
      try {
        const retryRes = await fetch(targetUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
        if (retryRes.ok) {
          upstream = retryRes;
        }
      } catch {
        // preserve upstream
      }
    }

    res.statusCode = upstream.status;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    const ct = upstream.headers.get('content-type') || '';
    const baseUrl = new URL(targetUrl);

    if (
      targetUrl.includes('.m3u8') ||
      ct.includes('mpegurl') ||
      ct.includes('application/x-mpegURL') ||
      ct.includes('application/vnd.apple.mpegurl')
    ) {
      const text = await upstream.text();
      const lines = text.split('\n');
      const rewritten = lines
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return line;

          if (trimmed.startsWith('#') && trimmed.includes('URI="')) {
            return line.replace(/URI="([^"]+)"/g, (_, uri) => {
              const resolved = new URL(uri, baseUrl).href;
              return `URI="/hls-proxy?url=${encodeURIComponent(resolved)}&referer=${encodeURIComponent(customReferer || '')}"`;
            });
          }

          if (!trimmed.startsWith('#')) {
            const resolved = new URL(trimmed, baseUrl).href;
            return `/hls-proxy?url=${encodeURIComponent(resolved)}&referer=${encodeURIComponent(customReferer || '')}`;
          }

          return line;
        })
        .join('\n');

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.end(rewritten);
      return;
    }

    if (ct) res.setHeader('Content-Type', ct);
    const cr = upstream.headers.get('content-range');
    if (cr) res.setHeader('Content-Range', cr);
    const ar = upstream.headers.get('accept-ranges');
    if (ar) res.setHeader('Accept-Ranges', ar);
    const cl = upstream.headers.get('content-length');
    if (cl) res.setHeader('Content-Length', cl);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (upstream.body) {
      safePipeStream(Readable.fromWeb(upstream.body), req, res);
    } else {
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.end(buf);
    }
  } catch (err) {
    if (!res.headersSent) {
      res.statusCode = 502;
    }
    if (!res.writableEnded && !res.destroyed) {
      res.end('HLS proxy error: ' + err?.message);
    }
  }
}
