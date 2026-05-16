/**
 * Lazy loaders for the bhāṣya corpus.
 *
 * Tiers
 * -----
 *   loadCatalog()        — global catalog of all 13 texts (~10 KB)
 *   loadManifest(slug)   — per-text manifest with chapter stubs (1–73 KB)
 *   loadChapter(...)     — single chapter chunk (5–250 KB), on demand
 *   loadFullText(slug)   — composes every chunk into a BhashyaText for
 *                          callers that need the whole text (search
 *                          substring fallback, voice-follow corpus).
 *
 * In-memory caches dedupe concurrent fetches; the service worker
 * caches everything under /data/ on disk so repeat visits are
 * instant.
 */

import type {
  BhashyaText,
  BhashyaChapterChunk,
  BhashyaChapter,
  BhashyaManifest,
  Catalog,
} from '@/types';
import { asset } from './asset';

let catalogPromise: Promise<Catalog> | null = null;
const manifestCache = new Map<string, Promise<BhashyaManifest>>();
const chapterCache = new Map<string, Promise<BhashyaChapter>>();
const fullTextCache = new Map<string, Promise<BhashyaText>>();

export async function loadCatalog(): Promise<Catalog> {
  if (!catalogPromise) {
    catalogPromise = fetch(asset('data/index.json')).then((r) => {
      if (!r.ok) throw new Error(`catalog fetch failed: ${r.status}`);
      return r.json() as Promise<Catalog>;
    });
  }
  return catalogPromise;
}

export async function loadManifest(slug: string): Promise<BhashyaManifest> {
  let p = manifestCache.get(slug);
  if (!p) {
    p = fetch(asset(`data/bhashya/${slug}.json`)).then((r) => {
      if (!r.ok) throw new Error(`manifest fetch failed: ${r.status}`);
      return r.json() as Promise<BhashyaManifest>;
    });
    manifestCache.set(slug, p);
  }
  return p;
}

/** Load one chapter's full body. Cached. */
export async function loadChapter(
  slug: string,
  chapterId: string,
): Promise<BhashyaChapter> {
  const cacheKey = `${slug}:${chapterId}`;
  let p = chapterCache.get(cacheKey);
  if (p) return p;
  p = (async () => {
    const manifest = await loadManifest(slug);
    const stub = manifest.chapters.find((c) => c.id === chapterId);
    if (!stub) throw new Error(`unknown chapter: ${chapterId}`);
    // The chunkPath in the manifest is rooted at `/data/...`; rewrite
    // through `asset()` so it works under a subpath deployment too.
    const url = asset(stub.chunkPath.replace(/^\//, ''));
    const r = await fetch(url);
    if (!r.ok) throw new Error(`chapter fetch failed: ${r.status}`);
    const chunk = (await r.json()) as BhashyaChapterChunk;
    return chunk.chapter;
  })();
  chapterCache.set(cacheKey, p);
  return p;
}

/**
 * Compose every chapter chunk into a complete BhashyaText. Used by
 * callers that need the full corpus for one text (search fallback,
 * voice-follow akṣara stream). Parallel fetches; result is cached.
 */
export async function loadFullText(slug: string): Promise<BhashyaText> {
  let p = fullTextCache.get(slug);
  if (p) return p;
  p = (async () => {
    const manifest = await loadManifest(slug);
    const chapters = await Promise.all(
      manifest.chapters.map((stub) => loadChapter(slug, stub.id)),
    );
    return manifestToShell(manifest, chapters);
  })();
  fullTextCache.set(slug, p);
  return p;
}

function manifestToShell(m: BhashyaManifest, chapters: BhashyaChapter[]): BhashyaText {
  return {
    slug: m.slug,
    sourceCode: m.slug.toUpperCase(),
    titleSa: m.titleSa,
    titleIast: m.titleIast,
    titleEn: m.titleEn,
    group: m.group,
    sourceUrl: m.sourceUrl,
    fetchedAt: m.fetchedAt,
    counts: m.counts,
    chapters,
  };
}

/**
 * Legacy alias. Returns the full text — used by older code paths.
 * New code should prefer loadManifest + loadChapter for laziness.
 */
export async function loadBhashya(slug: string): Promise<BhashyaText> {
  return loadFullText(slug);
}

export function invalidateCache(): void {
  catalogPromise = null;
  manifestCache.clear();
  chapterCache.clear();
  fullTextCache.clear();
}
