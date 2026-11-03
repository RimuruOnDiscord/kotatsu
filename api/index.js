import { handleNexusApi } from '../server/nexus/apiHandler.js';
import { handleImgProxy, handleHlsProxy, handleTrailerStream } from '../server/nexus/proxyHandler.js';

let anivexaWorker = null;

export default async function handler(req, res) {
  const url = req.url || '/';
  const pathname = url.split('?')[0];

  if (pathname === '/health') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', runtime: 'vercel' }));
    return;
  }

  if (pathname === '/img-proxy') {
    return handleImgProxy(req, res);
  }

  if (pathname === '/hls-proxy') {
    return handleHlsProxy(req, res);
  }

  if (pathname.startsWith('/api/trailer') || pathname.startsWith('/trailer/')) {
    return handleTrailerStream(req, res);
  }

  if (
    pathname === '/api/anime' ||
    pathname.startsWith('/api/nexus') ||
    pathname === '/api/gql-proxy' ||
    pathname.startsWith('/api/cache') ||
    pathname === '/refresh'
  ) {
    return handleNexusApi(req, res);
  }

  if (pathname.startsWith('/anivexa')) {
    try {
      if (!anivexaWorker) {
        const mod = await import('../anivexa-api/index.js');
        anivexaWorker = mod.default;
      }
      const strippedPath = url.replace(/^\/anivexa/, '') || '/';
      const fullUrl = `http://localhost${strippedPath}`;

      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers || {})) {
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
      return;
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err?.message || 'Anivexa internal error' }));
      return;
    }
  }

  res.statusCode = 404;
  res.end('Not found');
}
