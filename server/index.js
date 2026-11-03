import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { handleNexusApi } from './nexus/apiHandler.js';
import { handleImgProxy, handleHlsProxy, handleTrailerStream } from './nexus/proxyHandler.js';
import { refreshCookies } from './nexus/refresher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const app = express();
const PORT = Number(process.env.PORT) || 7860;

const isBenignStreamError = (err) => {
  if (!err) return false;
  const msg = String(err.message || '');
  const code = String(err.code || err.cause?.code || '');
  return (
    msg === 'terminated' ||
    msg.includes('NGHTTP2_') ||
    code === 'ERR_HTTP2_STREAM_ERROR' ||
    code === 'ERR_STREAM_PREMATURE_CLOSE' ||
    code === 'ECONNRESET' ||
    code === 'EPIPE'
  );
};

process.on('uncaughtException', (err) => {
  if (isBenignStreamError(err)) return;
  console.error('[Nexus Server Uncaught Exception]:', err);
});

process.on('unhandledRejection', (reason) => {
  if (isBenignStreamError(reason)) return;
  console.error('[Nexus Server Unhandled Rejection]:', reason);
});

app.use(express.json());

// Fast healthcheck endpoint for Hugging Face & Keep-Alive Cron
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Proxy routes for images and HLS media
app.use(async (req, res, next) => {
  if (req.path === '/img-proxy') {
    return handleImgProxy(req, res);
  }
  if (req.path === '/hls-proxy') {
    return handleHlsProxy(req, res);
  }
  if (req.path.startsWith('/api/trailer') || req.path.startsWith('/trailer/')) {
    return handleTrailerStream(req, res);
  }
  next();
});

// Hybrid API route: /api/anime, /api/nexus/*, /api/gql-proxy, /api/cache/*, /refresh
app.use(async (req, res, next) => {
  if (
    req.path === '/api/anime' ||
    req.path.startsWith('/api/nexus') ||
    req.path === '/api/gql-proxy' ||
    req.path.startsWith('/api/cache') ||
    req.path === '/refresh'
  ) {
    return handleNexusApi(req, res);
  }
  next();
});

// Anivexa streaming proxy route: /anivexa/*
let anivexaWorker = null;
app.use(async (req, res, next) => {
  if (!req.path.startsWith('/anivexa')) {
    return next();
  }
  try {
    if (!anivexaWorker) {
      const mod = await import('../anivexa-api/index.js');
      anivexaWorker = mod.default;
    }
    const strippedPath = req.url.replace(/^\/anivexa/, '') || '/';
    const fullUrl = `http://localhost:${PORT}${strippedPath}`;

    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string') headers.set(k, v);
      else if (Array.isArray(v)) headers.set(k, v.join(', '));
    }

    const webReq = new Request(fullUrl, {
      method: req.method || 'GET',
      headers,
    });

    const webRes = await anivexaWorker.fetch(webReq, { API_VERSION: '2.3' });
    res.statusCode = webRes.status;
    webRes.headers.forEach((val, key) => {
      res.setHeader(key, val);
    });
    const buf = Buffer.from(await webRes.arrayBuffer());
    res.end(buf);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err?.message || 'Anivexa internal error' }));
  }
});

// Serve frontend dist if built
const distPath = path.resolve(rootDir, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Keep-alive self-ping every 10 minutes to prevent Render free tier spin-down
cron.schedule('*/10 * * * *', async () => {
  const selfUrl = process.env.RENDER_EXTERNAL_URL || 'https://kotatsu-1-bhfh.onrender.com';
  try {
    await fetch(`${selfUrl.replace(/\/+$/, '')}/health`);
  } catch {
    // ignore
  }
});

// Scheduled cookie refresh every 25 minutes
cron.schedule('*/25 * * * *', async () => {
  console.log('[Nexus Server] ⏰ Scheduled cron triggered cookie refresh');
  try {
    await refreshCookies(true);
  } catch (err) {
    console.error('[Nexus Server] ❌ Scheduled refresh failed:', err.message);
  }
});

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Kotatsu Hybrid Server running on http://0.0.0.0:${PORT}`);
  console.log(`📡 Anime Nexus scraper active at /api/anime?q=<search>`);
  
  // Background warmup check — force fresh cookies on Linux/container boot
  setTimeout(async () => {
    try {
      await refreshCookies(process.platform !== 'win32');
    } catch (e) {
      console.warn('[Nexus Server] Warmup notice:', e.message);
    }
  }, 1500);
});
