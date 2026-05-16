/**
 * Meanings runtime loader.
 *
 * Lazy-fetches the per-text translation file produced by
 * `scripts/build-meanings.ts`. Two-tier cache: the entire file is
 * loaded on first lookup for that slug, then unit-level lookups are
 * O(1) hash-table reads.
 *
 * The file is part of the precached PWA static set (added to the
 * vite-pwa Workbox glob), so once a text has been opened the
 * translations are available offline.
 */
import { asset } from './asset';
import type { MeaningEntry, MeaningSource, MeaningsFile } from '@/types-meanings';

const cache = new Map<string, Promise<MeaningsFile | null>>();

async function fetchFile(slug: string): Promise<MeaningsFile | null> {
  try {
    const r = await fetch(asset(`data/meanings/${slug}.json`));
    if (!r.ok) return null;
    return (await r.json()) as MeaningsFile;
  } catch {
    return null;
  }
}

export function loadMeanings(slug: string): Promise<MeaningsFile | null> {
  let p = cache.get(slug);
  if (!p) {
    p = fetchFile(slug);
    cache.set(slug, p);
  }
  return p;
}

export interface UnitMeanings {
  /** Translations of the mūla / root text (verse, sūtra, mantra). */
  root: MeaningEntry[];
  /** Translations of each bhāṣya block, in document order. Same length as `unit.blocks`. */
  blocks: MeaningEntry[][];
  /** Source catalog so the UI can show citations. */
  sources: Record<string, MeaningSource>;
}

const EMPTY: UnitMeanings = {
  root: [],
  blocks: [],
  sources: {},
};

export async function meaningsFor(
  slug: string | null | undefined,
  unitId: string,
  blockCount: number,
): Promise<UnitMeanings> {
  if (!slug) return EMPTY;
  const file = await loadMeanings(slug);
  if (!file) return EMPTY;
  const sources: Record<string, MeaningSource> = {};
  for (const s of file.sources) sources[s.id] = s;
  const root: MeaningEntry[] = file.units[unitId]?.entries ?? [];
  const blocks: MeaningEntry[][] = [];
  for (let i = 0; i < blockCount; i++) {
    const k = `${unitId}::block-${i}`;
    blocks.push(file.units[k]?.entries ?? []);
  }
  return { root, blocks, sources };
}

export function entriesByLanguage(entries: MeaningEntry[]): {
  en: MeaningEntry[];
  ml: MeaningEntry[];
} {
  const en: MeaningEntry[] = [];
  const ml: MeaningEntry[] = [];
  for (const e of entries) (e.language === 'ml' ? ml : en).push(e);
  return { en, ml };
}

/** Helper used by the popover to fetch a single unit's first English/Malayalam entry. */
export async function summaryFor(
  slug: string | null | undefined,
  unitId: string,
): Promise<{ en?: MeaningEntry; ml?: MeaningEntry }> {
  if (!slug) return {};
  const file = await loadMeanings(slug);
  if (!file) return {};
  const entries = file.units[unitId]?.entries ?? [];
  const out: { en?: MeaningEntry; ml?: MeaningEntry } = {};
  for (const e of entries) {
    if (!out.en && e.language === 'en') out.en = e;
    if (!out.ml && e.language === 'ml') out.ml = e;
  }
  return out;
}

export type { MeaningEntry, MeaningSource, MeaningsFile, MeaningUnit } from '@/types-meanings';
