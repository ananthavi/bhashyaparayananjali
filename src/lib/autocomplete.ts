/**
 * Search autocomplete backed by a corpus-derived token list.
 *
 * `public/data/search/tokens.json` is built by
 * `scripts/build-search-tokens.ts` and contains every Devanāgarī
 * token that appears ≥ 2 times in the corpus, sorted lexically.
 *
 * Lookup uses binary search on the sorted list to find the prefix
 * range, then ranks within that range by frequency. Returns at most
 * `limit` suggestions.
 */

import { asset } from './asset';

interface TokenIndex {
  generatedAt: string;
  total: number;
  distinct: number;
  /** Sorted [devanagari, frequency][]. */
  entries: Array<[string, number]>;
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

/** Find the first index in `entries` whose key is ≥ prefix (lower bound). */
function lowerBound(entries: TokenIndex['entries'], prefix: string): number {
  let lo = 0;
  let hi = entries.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (entries[mid][0] < prefix) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export interface AutocompleteSuggestion {
  token: string;
  freq: number;
}

/**
 * Suggest tokens beginning with `prefix`. Returns up to `limit`
 * results, ranked by corpus frequency (most-common first).
 */
export async function suggest(
  prefix: string,
  limit = 8,
): Promise<AutocompleteSuggestion[]> {
  const idx = await loadIndex();
  if (!idx || !prefix) return [];
  const start = lowerBound(idx.entries, prefix);
  // Walk forward while the entry still starts with the prefix.
  const matches: AutocompleteSuggestion[] = [];
  for (let i = start; i < idx.entries.length; i++) {
    const [tok, freq] = idx.entries[i];
    if (!tok.startsWith(prefix)) break;
    matches.push({ token: tok, freq });
    // Don't gather way more than we need — frequency ranking happens
    // on at most ~`limit * 8` candidates which is still cheap.
    if (matches.length >= limit * 8) break;
  }
  matches.sort((a, b) => b.freq - a.freq);
  return matches.slice(0, limit);
}

/**
 * Token-aware autocomplete: split `query` on whitespace and propose
 * completions for the LAST token only, returning the full replacement
 * string so the caller can swap it in. This is what enables
 * mid-phrase autocomplete after a space — `"ब्रह्म ज"` should suggest
 * `"ब्रह्म ज्ञानम्"`, `"ब्रह्म जगत्"`, etc.
 *
 * Returns objects of shape:
 *   { token: <last-token-completion>, full: <full string with last
 *     token replaced>, freq }
 */
export interface PhraseSuggestion {
  /** The token that would replace the last typed word. */
  token: string;
  /** The full input with the last word replaced by `token`. */
  full: string;
  freq: number;
}

export async function suggestForLastToken(
  query: string,
  limit = 8,
): Promise<PhraseSuggestion[]> {
  if (!query) return [];
  // Split on whitespace, keeping the trailing token for completion.
  const trimmed = query.replace(/\s+$/, ''); // user-typed trailing space → no completion
  if (trimmed !== query) return []; // a trailing space means "I just finished a word"
  const lastSpace = trimmed.lastIndexOf(' ');
  const head = lastSpace >= 0 ? trimmed.slice(0, lastSpace + 1) : '';
  const last = lastSpace >= 0 ? trimmed.slice(lastSpace + 1) : trimmed;
  if (!last) return [];
  const tail = await suggest(last, limit);
  return tail.map((s) => ({ token: s.token, full: head + s.token, freq: s.freq }));
}

/** Number of tokens in the index (or 0 if not loaded). */
export async function tokenCount(): Promise<number> {
  const idx = await loadIndex();
  return idx?.distinct ?? 0;
}
