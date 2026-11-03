import 'dotenv/config';
import puppeteer from 'puppeteer-core';
import { Redis } from '@upstash/redis';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const REDIS_URL = process.env.UPSTASH_REDIS_URL || 'https://stable-swan-131317.upstash.io';
const REDIS_TOKEN = process.env.UPSTASH_REDIS_TOKEN || 'gQAAAAAAAgD1AAIgcDJlNjdkMDUwZDUzMjI0ZDcxOTg4ZDEwNDAyMmQ5ZjIwYw';

let redis = null;
try {
  if (REDIS_URL && REDIS_TOKEN) {
    redis = new Redis({ url: REDIS_URL, token: REDIS_TOKEN });
  }
} catch {
  // offline / no redis
}

function findChromePath() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/root/.nix-profile/bin/chromium',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  try {
    const resolved = execSync('which chromium || which google-chrome || which chromium-browser', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
      .split('\n')[0];
    if (resolved && fs.existsSync(resolved)) return resolved;
  } catch {
    // ignore
  }
  return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
}

const DATA_COOKIE_FILE = path.resolve(process.cwd(), 'server/data/.nexus-cookies.json');
const ROOT_COOKIE_FILE = path.resolve(process.cwd(), '.nexus-cookies.json');
let inMemorySession = null;
let isRefreshing = false;
let lastRefreshTime = 0;

export function getCachedSession() {
  if (inMemorySession?.cookies?.length) return inMemorySession;
  for (const file of [DATA_COOKIE_FILE, ROOT_COOKIE_FILE]) {
    try {
      if (fs.existsSync(file)) {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (data?.cookies?.length) {
          inMemorySession = data;
          return data;
        }
      }
    } catch {
      // ignore
    }
  }
  return inMemorySession || { cookies: [], userAgent: null, fingerprint: '1734c53a-2ee2-40c6-b022-c019edfe9757:da9cf4ea-1d71-48b7-98ac-81579702a2af' };
}

export function getCachedCookies() {
  return getCachedSession().cookies || [];
}

export async function refreshCookies(force = false) {
  if (isRefreshing) {
    console.log('[Nexus Refresher] Refresh already in progress, waiting...');
    while (isRefreshing) {
      await new Promise(r => setTimeout(r, 400));
    }
    return getCachedSession().cookies;
  }

  const now = Date.now();
  if (!force && now - lastRefreshTime < 60000 && getCachedCookies().length > 0) {
    return getCachedCookies();
  }

  isRefreshing = true;
  console.log(`[Nexus Refresher] 🔄 Starting browser session refresh at ${new Date().toISOString()}`);

  const chromePath = findChromePath();
  let browser = null;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: chromePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        ...(process.platform !== 'win32'
          ? ['--no-zygote', '--single-process', '--js-flags=--max-old-space-size=128']
          : []),
      ],
    });

    const page = await browser.newPage();
    const userAgent = await page.evaluate(() => navigator.userAgent);

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.chrome = { runtime: {} };
    });

    let detectedFp = '1734c53a-2ee2-40c6-b022-c019edfe9757:da9cf4ea-1d71-48b7-98ac-81579702a2af';
    page.on('request', req => {
      const h = req.headers();
      const fp = h['x-client-fingerprint'] || h['x-fingerprint'];
      if (fp) detectedFp = fp;
    });

    try {
      await page.goto('https://anime.nexus/', {
        waitUntil: 'networkidle2',
        timeout: 40000,
      });
    } catch (e) {
      console.warn('[Nexus Refresher] goto notice:', e.message);
    }

    await new Promise(r => setTimeout(r, 2000));

    const cookies = await page.cookies();
    console.log(`[Nexus Refresher] 🍪 Captured cookies: ${cookies.map(c => c.name).join(', ')}`);

    const sessionData = {
      userAgent,
      fingerprint: detectedFp,
      cookies,
      updatedAt: new Date().toISOString(),
    };

    inMemorySession = sessionData;
    lastRefreshTime = Date.now();

    for (const file of [DATA_COOKIE_FILE, ROOT_COOKIE_FILE]) {
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(sessionData, null, 2), 'utf8');
      } catch (e) {
        // ignore write error on read-only path
      }
    }
    console.log(`[Nexus Refresher] Stored session data to local file cache`);

    if (redis) {
      try {
        await redis.set('anime_nexus_cookies', JSON.stringify(cookies), { ex: 72000 });
        console.log(`[Nexus Refresher] ✅ Saved cookies to Upstash Redis`);
      } catch (e) {
        console.warn('[Nexus Refresher] Upstash Redis save error:', e.message);
      }
    }

    return cookies;
  } catch (err) {
    console.error('[Nexus Refresher] ❌ Error refreshing cookies:', err.message);
    return getCachedCookies();
  } finally {
    if (browser) await browser.close();
    isRefreshing = false;
  }
}
