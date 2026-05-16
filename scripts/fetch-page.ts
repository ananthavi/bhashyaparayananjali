/**
 * Polite fetcher for advaitasharada.sringeri.net.
 *
 * The site responds with 503 to programmatic user-agents, so we send a real
 * browser UA and appropriate Accept headers. A simple disk cache under
 * scripts/.cache avoids re-fetching the same page across scraper runs.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const CACHE_DIR = path.join(process.cwd(), 'scripts', '.cache');

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.7,sa;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
};

export interface FetchRequest {
  url: string;
  referer?: string;
  xhr?: boolean;
}

export interface FetchOptions {
  /** Milliseconds to wait between successive fetches. */
  delayMs?: number;
  /** Retry on 5xx/network errors. */
  maxRetries?: number;
  /** Bypass disk cache. */
  noCache?: boolean;
}

async function ensureCacheDir(): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

function cachePathFor(url: string): string {
  const hash = crypto.createHash('sha1').update(url).digest('hex').slice(0, 16);
  return path.join(CACHE_DIR, `${hash}.html`);
}

async function readCache(url: string): Promise<string | null> {
  try {
    return await fs.readFile(cachePathFor(url), 'utf8');
  } catch {
    return null;
  }
}

async function writeCache(url: string, body: string): Promise<void> {
  await ensureCacheDir();
  await fs.writeFile(cachePathFor(url), body, 'utf8');
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

let lastFetchAt = 0;

/**
 * Fetch a URL with caching, a minimum inter-request delay, and exponential
 * backoff retries. Throws if all retries fail.
 */
export async function fetchPage(
  request: string | FetchRequest,
  opts: FetchOptions = {},
): Promise<string> {
  const { delayMs = 1500, maxRetries = 4, noCache = false } = opts;
  const req: FetchRequest = typeof request === 'string' ? { url: request } : request;

  if (!noCache) {
    const cached = await readCache(req.url);
    if (cached) return cached;
  }

  const elapsed = Date.now() - lastFetchAt;
  if (elapsed < delayMs) await sleep(delayMs - elapsed);

  const headers: Record<string, string> = { ...DEFAULT_HEADERS };
  if (req.referer) headers['Referer'] = req.referer;
  if (req.xhr) headers['X-Requested-With'] = 'XMLHttpRequest';

  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      lastFetchAt = Date.now();
      const resp = await fetch(req.url, { headers });
      if (resp.status === 429 || resp.status >= 500) {
        throw new Error(`HTTP ${resp.status} for ${req.url}`);
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${req.url}`);
      const body = await resp.text();
      await writeCache(req.url, body);
      return body;
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
        const backoff = 2000 * 2 ** attempt;
        // eslint-disable-next-line no-console
        console.warn(
          `  fetch failed (${(err as Error).message}); retry ${attempt + 1}/${maxRetries} in ${backoff}ms`,
        );
        await sleep(backoff);
      }
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * Fetches a bhashya via the main URL plus the `/display/getBhashyaByPage`
 * endpoint used by the site's infinite scroll. Returns the concatenated HTML
 * of all pages so the parser sees the full text.
 */
export async function fetchAllBhashyaPages(
  sourceCode: string,
  opts: FetchOptions = {},
): Promise<string> {
  const mainUrl = `https://advaitasharada.sringeri.net/display/bhashya/${sourceCode}/devanagari`;
  const mainHtml = await fetchPage(mainUrl, opts);

  // Extract only the main-text container from the initial page so we can
  // cleanly append subsequent pages inside it.
  let combined = mainHtml;
  const openRe = /<div class="container-fluid maintext"[^>]*>/;
  const openMatch = openRe.exec(mainHtml);
  if (!openMatch) return mainHtml;

  // Append pages 2..N until the server returns an empty body.
  for (let page = 2; page < 200; page++) {
    const pageUrl = `https://advaitasharada.sringeri.net/display/getBhashyaByPage/${sourceCode}/devanagari?page=${page}`;
    let body: string;
    try {
      body = await fetchPage({ url: pageUrl, referer: mainUrl, xhr: true }, opts);
    } catch (err) {
      // If a page request fails after retries we stop rather than poisoning
      // the output — surface whichever pages we did manage to get.
      // eslint-disable-next-line no-console
      console.warn(`  page=${page} failed: ${(err as Error).message}; stopping`);
      break;
    }
    if (!body || body.trim().length === 0) break;

    // Splice the page body just before the closing </div> of the main-text
    // container. We find the FIRST balanced close of the initial match.
    const insertAt = findContainerEnd(combined, openMatch.index + openMatch[0].length);
    if (insertAt < 0) {
      combined += body;
    } else {
      combined = combined.slice(0, insertAt) + body + combined.slice(insertAt);
    }
  }
  return combined;
}

/**
 * Find the index of the closing tag matching the opening `<div class="container-fluid maintext">`
 * starting at `after`. Walks forward counting `<div` and `</div>` to find the
 * balanced close. Returns -1 if not found.
 */
function findContainerEnd(html: string, after: number): number {
  let depth = 1;
  let i = after;
  while (i < html.length) {
    const openIdx = html.indexOf('<div', i);
    const closeIdx = html.indexOf('</div>', i);
    if (closeIdx < 0) return -1;
    if (openIdx >= 0 && openIdx < closeIdx) {
      depth += 1;
      i = openIdx + 4;
    } else {
      depth -= 1;
      if (depth === 0) return closeIdx;
      i = closeIdx + 6;
    }
  }
  return -1;
}
