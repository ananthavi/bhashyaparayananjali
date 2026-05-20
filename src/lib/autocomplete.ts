/**
 * Search autocomplete backed by the corpus token list.
 *
 * `public/data/search/tokens.json` is built by
 * `scripts/build-search-tokens.ts`. Each entry is
 * `[devanagari, ascii, frequency]`. The runtime supports the full
 * cross-script matching contract:
 *
 *   • Prefix in either form     — "ब्रह्म…", "brahm…"
 *   • Infix in either form      — "tma" → "ātma" / "paramātman"
 *   • Suffix in either form     — "ñjali" → "pārāyaṇāñjali"
 *   • IAST with or without marks — "ātma" or "atma" both work
 *   • ITRANS / HK / SLP1        — normalized to ASCII via Sanscript
 *
 * Implementation: a single linear scan over the ~24 k tokens, checking
 * `includes()` on both forms. At 24 k entries this is ~1–2 ms on a
 * mid-range phone — well within keystroke budget — and avoids a second
 * indexing layer for a fundamentally substring-style query.
 */

import { asset } from './asset';
import { normalize, asciiFold, isDevanagari } from './search-normalize';

interface TokenIndex {
  generatedAt: string;
  total: number;
  distinct: number;
  /**
   * Token entries. The current builder emits triples
   * `[devanagari, ascii, freq]`; older index files were pairs
   * `[devanagari, freq]`. Both are accepted — when the ASCII fold is
   * missing it is derived on the fly via the normalizer.
   */
  entries: Array<[string, string, number] | [string, number]>;
}

let indexPromise: Promise<TokenIndex | null> | null = null;

async function loadIndex(): Promise<TokenIndex | null> {
  if (!indexPromise) {
    indexPromise = (async () => {
      try {
        const r = await fetch(asset('data/search/tokens.json'));
        if (!r.ok) return null;
        return (await r.json()) as TokenIndex;
      } catch {
        return null;
      }
    })();
  }
  return indexPromise;
}

export interface AutocompleteSuggestion {
  token: string;
  freq: number;
}

/**
 * Suggest tokens matching `query` anywhere — prefix, infix, or suffix.
 * Ranked: prefix-hits first (by frequency), then infix hits, then
 * suffix-only hits. Returns at most `limit`.
 */
export async function suggest(
  query: string,
  limit = 8,
): Promise<AutocompleteSuggestion[]> {
  const idx = await loadIndex();
  if (!idx || !query) return [];
  const n = normalize(query);
  const devNeedle = n.dev;
  const asciiNeedle = n.ascii;
  if (!devNeedle && !asciiNeedle) return [];

  const prefix: Array<[string, number]> = [];
  const infix: Array<[string, number]> = [];
  const suffix: Array<[string, number]> = [];

  for (const entry of idx.entries) {
    const dev: string = entry[0];
    // Accept either 3-tuple [dev, ascii, freq] or legacy 2-tuple [dev, freq].
    const ascii: string =
      typeof entry[1] === 'string' ? entry[1] : normalize(dev).ascii;
    const freq: number =
      typeof entry[1] === 'number' ? entry[1] : (entry[2] as number);
    let bucket: typeof prefix | null = null;
    if (devNeedle) {
      if (dev.startsWith(devNeedle)) bucket = prefix;
      else if (dev.endsWith(devNeedle)) bucket = suffix;
      else if (dev.includes(devNeedle)) bucket = infix;
    }
    if (!bucket && asciiNeedle) {
      if (ascii.startsWith(asciiNeedle)) bucket = prefix;
      else if (ascii.endsWith(asciiNeedle)) bucket = suffix;
      else if (ascii.includes(asciiNeedle)) bucket = infix;
    }
    if (bucket) bucket.push([dev, freq]);
    // Early exit: enough prefix hits to satisfy the limit comfortably.
    if (prefix.length >= limit * 4) break;
  }

  const byFreq = (a: [string, number], b: [string, number]): number => b[1] - a[1];
  prefix.sort(byFreq);
  infix.sort(byFreq);
  suffix.sort(byFreq);

  const merged = [...prefix, ...infix, ...suffix].slice(0, limit);
  return merged.map(([token, freq]) => ({ token, freq }));
}

export interface PhraseSuggestion {
  /** The token that would replace the last typed word. */
  token: string;
  /** The full input with the last word replaced by `token`. */
  full: string;
  freq: number;
}

/**
 * Phrase-aware autocomplete: complete only the LAST whitespace-
 * separated token, returning the full replacement string.
 */
export async function suggestForLastToken(
  query: string,
  limit = 8,
): Promise<PhraseSuggestion[]> {
  if (!query) return [];
  const trimmed = query.replace(/\s+$/, '');
  if (trimmed !== query) return [];
  const lastSpace = trimmed.lastIndexOf(' ');
  const head = lastSpace >= 0 ? trimmed.slice(0, lastSpace + 1) : '';
  const last = lastSpace >= 0 ? trimmed.slice(lastSpace + 1) : trimmed;
  if (!last) return [];
  const tail = await suggest(last, limit);
  return tail.map((s) => ({ token: s.token, full: head + s.token, freq: s.freq }));
}

export async function tokenCount(): Promise<number> {
  const idx = await loadIndex();
  return idx?.distinct ?? 0;
}

// Re-export from search-normalize for callers that want the canonicals.
export { normalize, asciiFold, isDevanagari };
