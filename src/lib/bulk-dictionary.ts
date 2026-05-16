/**
 * Bulk Sanskrit dictionary loader: full Monier-Williams, Apte,
 * Vāchaspatyam, and Śabdakalpadruma.
 *
 * Bundling
 * --------
 * The app expects `public/data/dict/{mw,apte,vachaspatyam,shabdakalpadruma}.json`
 * to exist. The Capacitor build copies them into the APK; the PWA's
 * service worker precaches them. On first launch we copy the contents
 * into IndexedDB so subsequent lookups are O(1) and don't need to
 * re-parse the multi-MB JSON each time.
 *
 * Source format
 * -------------
 * Each JSON is an object keyed by Devanāgarī head-word:
 *
 *   {
 *     "ब्रह्म": { "iast": "brahma", "pos": "n.", "en": "the absolute…" },
 *     ...
 *   }
 *
 * `scripts/build-dict.ts` converts the Cologne csl-orig dumps to this
 * shape. See docs/dictionary.md.
 */

import { openDB, type IDBPDatabase } from 'idb';
import { asset } from './asset';

export type BulkDictId = 'mw' | 'apte' | 'vachaspatyam' | 'shabdakalpadruma';

export const BULK_DICT_ORDER: BulkDictId[] = ['mw', 'apte', 'vachaspatyam', 'shabdakalpadruma'];

export const BULK_DICT_LABEL: Record<BulkDictId, string> = {
  mw: 'Monier-Williams',
  apte: 'Apte',
  vachaspatyam: 'Vāchaspatyam',
  shabdakalpadruma: 'Śabdakalpadruma',
};

export interface BulkEntry {
  iast?: string;
  pos?: string;
  en?: string;
  ml?: string;
  src?: string;
}

export interface BulkDictMeta {
  id: BulkDictId;
  label: string;
  installedAt: number;
  entryCount: number;
  sizeBytes: number;
}

const DB_NAME = 'bhashya-bulk-dict';
// Bumped from v1 → v2 when we added vachaspatyam + shabdakalpadruma stores.
const DB_VERSION = 2;

let dbp: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbp) {
    dbp = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const id of BULK_DICT_ORDER) {
          if (!db.objectStoreNames.contains(id)) db.createObjectStore(id);
        }
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('headIndex')) {
          db.createObjectStore('headIndex', { keyPath: 'id' });
        }
      },
    });
  }
  return dbp;
}

/**
 * Install a dictionary from a (typically same-origin) URL, persisting
 * every entry into IDB and rebuilding the in-memory head-word set
 * consumed by the sandhi splitter as a known-lemma oracle.
 */
async function installFrom(
  id: BulkDictId,
  url: string,
  onProgress?: (n: number, total: number) => void,
): Promise<BulkDictMeta> {
  const resp = await fetch(url, { credentials: 'omit' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${id}`);
  const text = await resp.text();
  const parsed = JSON.parse(text) as Record<string, BulkEntry>;
  const headwords = Object.keys(parsed);
  const total = headwords.length;
  const db = await getDb();
  // Chunk inserts so a 200 000-entry dict doesn't block the UI thread.
  const tx = db.transaction([id, 'meta', 'headIndex'], 'readwrite');
  const store = tx.objectStore(id);
  await store.clear();
  let n = 0;
  for (const head of headwords) {
    await store.put(parsed[head], head);
    n += 1;
    if (n % 10000 === 0) onProgress?.(n, total);
  }
  const sizeBytes = new Blob([text]).size;
  const meta: BulkDictMeta = {
    id,
    label: BULK_DICT_LABEL[id],
    installedAt: Date.now(),
    entryCount: n,
    sizeBytes,
  };
  await tx.objectStore('meta').put(meta);
  await tx.objectStore('headIndex').put({ id, headwords });
  await tx.done;
  HEAD_SETS[id] = new Set(headwords);
  return meta;
}

export async function getBulkMeta(id: BulkDictId): Promise<BulkDictMeta | null> {
  const db = await getDb();
  const m = await db.get('meta', id);
  return (m as BulkDictMeta | undefined) ?? null;
}

export async function lookupBulk(id: BulkDictId, head: string): Promise<BulkEntry | null> {
  const db = await getDb();
  const v = await db.get(id, head);
  return (v as BulkEntry | undefined) ?? null;
}

/* ----- in-memory head-word index for fast `isLemma` predicate ----- */

/**
 * The splitter's known-lemma oracle. Populated from a flat
 * `/data/dict/heads.json` containing every head from the original
 * (pre-reduction) Cologne dumps. We keep the per-dict HEAD_SETS too so
 * UI can show which dictionary actually has the entry, but for the
 * compound splitter we want the broadest possible "is this a real
 * Sanskrit head-word?" answer regardless of which dict's entries we
 * shipped.
 */
let GLOBAL_HEADS: Set<string> = new Set();

const HEAD_SETS: Record<BulkDictId, Set<string>> = {
  mw: new Set(),
  apte: new Set(),
  vachaspatyam: new Set(),
  shabdakalpadruma: new Set(),
};

/** Hydrate the in-memory head-word sets from IDB. Call once at app start. */
export async function hydrateHeadIndex(): Promise<void> {
  const db = await getDb();
  for (const id of BULK_DICT_ORDER) {
    const idx = await db.get('headIndex', id);
    const heads = ((idx as { headwords?: string[] } | undefined)?.headwords ?? []);
    HEAD_SETS[id] = new Set(heads);
  }
  // Also load the global oracle if it was bundled.
  try {
    const r = await fetch(asset('data/dict/heads.json'));
    if (r.ok) {
      const list = (await r.json()) as string[];
      GLOBAL_HEADS = new Set(list);
    }
  } catch {
    // No oracle file — fall back to per-dict union.
    GLOBAL_HEADS = new Set();
    for (const id of BULK_DICT_ORDER) for (const h of HEAD_SETS[id]) GLOBAL_HEADS.add(h);
  }
}

/**
 * Predicate consumed by the compound splitter. Returns true if any
 * known Sanskrit lexicon head-word matches `word`. Uses the broad
 * GLOBAL_HEADS oracle when present so the splitter scores compound
 * candidates correctly even after the entry-store has been reduced.
 */
export function isKnownHead(word: string): boolean {
  if (GLOBAL_HEADS.has(word)) return true;
  for (const id of BULK_DICT_ORDER) if (HEAD_SETS[id].has(word)) return true;
  return false;
}

/** Lazy access to all known heads — used by the fuzzy nearest-lemma fallback. */
export function allKnownHeads(): Set<string> {
  if (GLOBAL_HEADS.size > 0) return GLOBAL_HEADS;
  const merged = new Set<string>();
  for (const id of BULK_DICT_ORDER) for (const h of HEAD_SETS[id]) merged.add(h);
  return merged;
}

export function totalBulkHeads(): number {
  let n = 0;
  for (const id of BULK_DICT_ORDER) n += HEAD_SETS[id].size;
  return n;
}

/**
 * Auto-install every dictionary shipped at `public/data/dict/<id>.json`.
 * Called once at app boot. Idempotent — already-installed dicts are
 * skipped. The service worker precaches the JSONs and the Capacitor
 * APK embeds them, so this works fully offline once the app has been
 * loaded the first time.
 *
 * Reports installation status via `onStatus(id, status, info?)` so a
 * UI can render a one-line progress strip.
 */
export type InstallStatus = 'present' | 'installing' | 'installed' | 'missing' | 'error';

export interface InstallReport {
  id: BulkDictId;
  status: InstallStatus;
  meta?: BulkDictMeta;
  message?: string;
}

export async function autoInstallBundled(
  onStatus?: (r: InstallReport) => void,
): Promise<InstallReport[]> {
  const reports: InstallReport[] = [];
  for (const id of BULK_DICT_ORDER) {
    const existing = await getBulkMeta(id);
    if (existing) {
      const r: InstallReport = { id, status: 'present', meta: existing };
      reports.push(r);
      onStatus?.(r);
      continue;
    }
    const url = asset(`data/dict/${id}.json`);
    let exists = false;
    try {
      const head = await fetch(url, { method: 'HEAD' });
      exists = head.ok;
    } catch {
      exists = false;
    }
    if (!exists) {
      const r: InstallReport = { id, status: 'missing' };
      reports.push(r);
      onStatus?.(r);
      continue;
    }
    onStatus?.({ id, status: 'installing' });
    try {
      const meta = await installFrom(id, url);
      const r: InstallReport = { id, status: 'installed', meta };
      reports.push(r);
      onStatus?.(r);
    } catch (err) {
      const r: InstallReport = { id, status: 'error', message: (err as Error).message };
      reports.push(r);
      onStatus?.(r);
    }
  }
  return reports;
}
