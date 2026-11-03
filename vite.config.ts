import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Prevent transient upstream HTTP/2 stream resets (undici ERR_HTTP2_STREAM_ERROR / TypeError: terminated)
// from crashing the Vite dev server when a browser tab seeks or aborts a proxied media stream.
const isBenignStreamError = (err: any): boolean => {
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
  console.error('[Vite Server Uncaught Exception]:', err);
});

process.on('unhandledRejection', (reason) => {
  if (isBenignStreamError(reason)) return;
  console.error('[Vite Server Unhandled Rejection]:', reason);
});

function anivexaMiddlewarePlugin() {
  let workerPromise: Promise<any> | null = null;

  const getWorker = () => {
    if (!workerPromise) {
      const workerPath = pathToFileURL(
        path.resolve(__dirname, 'anivexa-api/index.js')
      ).href;
      workerPromise = import(workerPath).then((m) => m.default);
    }
    return workerPromise;
  };

  return {
    name: 'anivexa-api-middleware',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        // Hybrid Scraper API: /api/anime, /api/nexus/*, /api/gql-proxy, /api/cache/*, /refresh
        if (
          req.url &&
          (req.url.startsWith('/api/anime?') ||
            req.url.startsWith('/api/nexus/') ||
            req.url === '/api/anime' ||
            req.url.startsWith('/api/gql-proxy') ||
            req.url.startsWith('/api/cache/') ||
            req.url.startsWith('/refresh'))
        ) {
          try {
            const { handleNexusApi } = await import('./server/nexus/apiHandler.js');
            return await handleNexusApi(req, res);
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err?.message }));
            return;
          }
        }

        if (req.url && (req.url.startsWith('/img-proxy?') || req.url === '/img-proxy')) {
          const { handleImgProxy } = await import('./server/nexus/proxyHandler.js');
          return await handleImgProxy(req, res);
        }

        if (req.url && (req.url.startsWith('/hls-proxy?') || req.url === '/hls-proxy')) {
          const { handleHlsProxy } = await import('./server/nexus/proxyHandler.js');
          return await handleHlsProxy(req, res);
        }

        if (
          req.url &&
          (req.url.startsWith('/api/trailer') ||
            req.url.startsWith('/trailer/'))
        ) {
          const { handleTrailerStream } = await import('./server/nexus/proxyHandler.js');
          return await handleTrailerStream(req, res);
        }

        if (!req.url || !req.url.startsWith('/anivexa/')) {
          return next();
        }

        try {
          const worker = await getWorker();
          const strippedPath = req.url.replace(/^\/anivexa/, '') || '/';
          const fullUrl = `http://localhost:4000${strippedPath}`;

          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) {
            if (typeof v === 'string') headers.set(k, v);
            else if (Array.isArray(v)) headers.set(k, v.join(', '));
          }

          const webReq = new Request(fullUrl, {
            method: req.method || 'GET',
            headers,
          });

          const webRes = await worker.fetch(webReq, { API_VERSION: '2.3' });
          res.statusCode = webRes.status;
          webRes.headers.forEach((val: string, key: string) => {
            res.setHeader(key, val);
          });
          const buf = Buffer.from(await webRes.arrayBuffer());
          res.end(buf);
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err?.message || 'Anivexa internal error' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), anivexaMiddlewarePlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/hls.js')) {
            return 'hls-vendor';
          }
          if (id.includes('node_modules/framer-motion')) {
            return 'motion-vendor';
          }
          if (
            id.includes('node_modules/react') ||
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react-router-dom')
          ) {
            return 'react-core';
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
    host: true,
    watch: {
      ignored: ['**/anivexa-api/**', '**/server/data/**', '**/*.db', '**/*.db-*'],
    },
    proxy: {
      // Legacy upstream — api.bingr.one is offline. The app no longer calls this,
      // but keep the route short-circuited so stray requests fail fast & quietly.
      '/bingr-api': {
        target: 'https://api.bingr.one',
        changeOrigin: true,
        timeout: 2500,
        proxyTimeout: 2500,
        rewrite: (p) => p.replace(/^\/bingr-api/, '/api'),
        headers: {
          Origin: 'https://bingr.one',
          Referer: 'https://bingr.one/',
        },
        configure: (proxy) => {
          proxy.removeAllListeners('error');
          proxy.on('error', (_err, _req, res: any) => {
            if (res && typeof res.writeHead === 'function' && !res.headersSent) {
              res.writeHead(504, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'upstream unavailable' }));
            }
          });
        },
      },
    },
  },
});
