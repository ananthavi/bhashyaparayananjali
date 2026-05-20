/**
 * Full-text search across all bhāṣyas.
 *
 * Implementation: FlexSearch `Document` index with two fields (`dev`,
 * `ascii`) per doc, both indexed with `tokenize: 'full'` so any
 * substring of any token is searchable — exact, prefix, infix, or
 * ending match all hit. The index is built lazily in the browser from
 * `public/data/search/payload.json`; for ~3 000 docs this is <100 ms
 * cold and free after that.
 *
 * Cross-script input is handled by `src/lib/search-normalize.ts`. The
 * user can type Devanāgarī, IAST (with or without diacritics), ITRANS,
 * HK, SLP1, or any other Indic script; the query is normalized into
 * the same two canonical forms (`dev`, `ascii`) the index uses.
 *
 *   - `expandQueryToDevanagari()` is kept as a thin compatibility
 *     shim returning a flat list of variants for callers that wanted
 *     to highlight matched tokens (InTextSearch, SearchPage).
 */

// FlexSearch ships ESM + CJS; the default export is the namespace.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import FlexSearchImport from 'flexsearch';
import type { BhashyaText, SearchIndexDoc } from '@/types';
import { loadCatalog, loadBhashya } from './loader';
import { asset } from './asset';
import { normalize, asciiFold, isDevanagari } from './search-normalize';
import { aksharas } from './sandhi/aksharas';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FlexSearch: any = (FlexSearchImport as any).default ?? FlexSearchImport;

export interface SearchHit {
  doc: SearchIndexDoc;
  score: number;
  /** What kind of match this is, for UI badges. */
  rank: 'exact' | 'prefix' | 'substring' | 'fuzzy';
  /** Tokens (in any script) that triggered the match, for highlighting. */
  matchedTokens: string[];
}

export interface SearchOptions {
  /** Skip the fuzzy / approximate tier. Default: false. */
  exactOnly?: boolean;
  /** Maximum results to return. */
  limit?: number;
  /** Restrict matches to these text slugs. Empty/undefined = all texts. */
  scope?: string[];
}

interface IndexPayload {
  id: string;
  dev: string;
  ascii: string;
}

interface LoadedIndex {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  index: any;
  docs: SearchIndexDoc[];
  docById: Map<string, SearchIndexDoc>;
}

let indexPromise: Promise<LoadedIndex | null> | null = null;

async function buildIndex(): Promise<LoadedIndex | null> {
  try {
    const [payloadRes, docsRes] = await Promise.all([
      fetch(asset('data/search/payload.json')),
      fetch(asset('data/search/docs.json')),
    ]);
    if (!payloadRes.ok || !docsRes.ok) return null;
    const payload = (await payloadRes.json()) as IndexPayload[];
    const docs = (await docsRes.json()) as SearchIndexDoc[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const index: any = new FlexSearch.Document({
      document: {
        id: 'id',
        index: [
          { field: 'dev', tokenize: 'full' },
          { field: 'ascii', tokenize: 'full' },
        ],
      },
    });
    for (const p of payload) index.add(p);
    const docById = new Map(docs.map((d) => [d.id, d]));
    return { index, docs, docById };
  } catch {
    return null;
  }
}

export async function ensureIndex(): Promise<LoadedIndex | null> {
  if (!indexPromise) indexPromise = buildIndex();
  return indexPromise;
}

/**
 * Generate plausible Devanāgarī forms equivalent to `input`. Used by
 * the in-page highlighter (Tappable, InTextSearch) to mark every form
 * of a query word that occurs in the unit — not by the search engine,
 * which has its own normalize-based matching.
 *
 * Covers:
 *   - Devanāgarī passes through
 *   - Other Indic scripts via Sanscript
 *   - IAST / ITRANS / HK with marks
 *   - Plain ASCII with long-vowel + aspirate + sibilant guesses
 *   - Common sandhi-relevant endings (anusvāra ↔ -m, visarga ↔ -s,
 *     -o ↔ -aḥ, -ā ↔ -an, trailing virāma drop)
 */
export function expandQueryToDevanagari(input: string): string[] {
  const trimmed = (input ?? '').trim();
  if (!trimmed) return [];
  const out = new Set<string>();
  const n = normalize(trimmed);

  if (isDevanagari(trimmed)) {
    addDevanagariVariants(trimmed, out);
    return [...out];
  }
  if (n.dev) addDevanagariVariants(n.dev, out);

  // For plain ASCII (no diacritics), also try a few high-yield IAST
  // re-interpretations and re-transliterate each. This is what gives
  // a query like "atma" multiple Devanāgarī candidates.
  const hasDiacritics = /[āīūṛṝḷḹṃḥṅñṭḍṇśṣ]/i.test(trimmed);
  if (!isDevanagari(trimmed) && !hasDiacritics) {
    for (const candidate of generateIastVariants(asciiFold(trimmed))) {
      const dev = normalize(candidate).dev;
      if (dev) addDevanagariVariants(dev, out);
    }
  }
  return [...out].filter(Boolean);
}

/** Add a Devanāgarī string + sandhi-relevant endings to `out`. */
function addDevanagariVariants(dev: string, out: Set<string>): void {
  if (!dev) return;
  out.add(dev);
  if (dev.endsWith('ं')) {
    out.add(dev.slice(0, -1));
    out.add(dev.slice(0, -1) + 'म्');
  }
  if (dev.endsWith('ः')) {
    out.add(dev.slice(0, -1));
    out.add(dev.slice(0, -1) + 'स्');
  }
  if (dev.endsWith('ो')) {
    out.add(dev.slice(0, -1) + 'ः');
    out.add(dev.slice(0, -1) + 'स्');
  }
  if (dev.endsWith('ा') && dev.length > 2) {
    out.add(dev.slice(0, -1) + 'न्');
  }
  if (dev.endsWith('्')) out.add(dev.slice(0, -1));
}

/** From a plain-ASCII string, produce a set of plausible IAST guesses. */
function generateIastVariants(ascii: string): string[] {
  const out = new Set<string>([ascii]);
  for (const [pat, sub] of [
    [/^a/, 'ā'],
    [/a$/, 'ā'],
    [/i/g, 'ī'],
    [/u/g, 'ū'],
    [/ri/g, 'ṛ'],
    [/aa/g, 'ā'],
  ] as const) {
    out.add(ascii.replace(pat, sub));
  }
  out.add(ascii.replace(/sh/g, 'ś'));
  out.add(ascii.replace(/sh/g, 'ṣ'));
  if (ascii.endsWith('m')) out.add(ascii.slice(0, -1) + 'ṃ');
  if (ascii.endsWith('h')) out.add(ascii.slice(0, -1) + 'ḥ');
  if (ascii.endsWith('a')) out.add(ascii.slice(0, -1) + 'an');
  if (ascii.endsWith('an')) out.add(ascii.slice(0, -2));
  return [...out];
}

/**
 * Search the entire corpus. Multi-word queries: every word must hit
 * the same document (FlexSearch handles intra-doc AND natively).
 */
export async function searchAll(
  rawQuery: string,
  opts: SearchOptions = {},
): Promise<SearchHit[]> {
  const limit = opts.limit ?? 100;
  const trimmed = rawQuery.trim();
  if (!trimmed) return [];

  const loaded = await ensureIndex();
  if (!loaded) {
    return fallbackSubstringSearch(trimmed, limit);
  }
  const { index, docById } = loaded;

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const matchedTokens: string[] = [];
  const aggregate = new Map<string, { score: number; tokensHit: number; rank: SearchHit['rank'] }>();

  // For each query token, search both fields. FlexSearch returns
  // doc-id lists per field; we union them and tally per-token hits so
  // we can require ALL tokens to match in the same doc later.
  for (const tok of tokens) {
    const n = normalize(tok);
    const devVariants = [n.dev, isDevanagari(tok) ? tok : ''].filter(Boolean);
    const asciiVariants = [n.ascii, asciiFold(tok)].filter(Boolean);
    if (n.dev) matchedTokens.push(n.dev);
    matchedTokens.push(tok);
    const ids = new Set<string>();

    for (const v of devVariants) {
      const res = safeSearch(index, v, 'dev', limit);
      for (const id of res) ids.add(id);
    }
    for (const v of asciiVariants) {
      const res = safeSearch(index, v, 'ascii', limit);
      for (const id of res) ids.add(id);
    }

    for (const id of ids) {
      const prev = aggregate.get(id);
      if (!prev) {
        aggregate.set(id, { score: 1, tokensHit: 1, rank: 'substring' });
      } else {
        prev.tokensHit += 1;
        prev.score += 1;
      }
    }
  }

  // Require all query tokens to match in the same doc; with a single
  // token that's automatic.
  const scopeSet = opts.scope && opts.scope.length > 0 ? new Set(opts.scope) : null;
  const results: SearchHit[] = [];
  for (const [id, agg] of aggregate) {
    if (agg.tokensHit < tokens.length) continue;
    const doc = docById.get(id);
    if (!doc) continue;
    if (scopeSet && !scopeSet.has(doc.textSlug)) continue;
    results.push({
      doc,
      score: agg.score + agg.tokensHit * 0.1,
      rank: agg.rank,
      matchedTokens: Array.from(new Set(matchedTokens)),
    });
  }

  // Promote results whose mūla begins with the query (exact / prefix tier).
  const lowerAscii = asciiFold(trimmed);
  const devTrimmed = normalize(trimmed).dev || trimmed;
  for (const h of results) {
    const root = h.doc.snippet || '';
    if (root.startsWith(devTrimmed)) h.rank = 'prefix';
    if (root === devTrimmed) h.rank = 'exact';
    const rootAscii = asciiFold(root);
    if (rootAscii.startsWith(lowerAscii)) h.rank = h.rank === 'exact' ? 'exact' : 'prefix';
  }

  const rankWeight: Record<SearchHit['rank'], number> = {
    exact: 4, prefix: 3, substring: 2, fuzzy: 1,
  };
  results.sort((a, b) => {
    const dr = rankWeight[b.rank] - rankWeight[a.rank];
    if (dr !== 0) return dr;
    return b.score - a.score;
  });
  return results.slice(0, limit);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeSearch(index: any, query: string, field: string, limit: number): string[] {
  if (!query) return [];
  try {
    // Document.search returns Array<{ field, result: string[] }>.
    const res = index.search(query, { field, limit, suggest: true });
    if (!Array.isArray(res)) return [];
    const out: string[] = [];
    for (const r of res) {
      if (r && Array.isArray(r.result)) {
        for (const id of r.result) out.push(String(id));
      } else if (Array.isArray(r)) {
        for (const id of r) out.push(String(id));
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Slow path when the index can't load: linear substring scan in both scripts. */
async function fallbackSubstringSearch(
  query: string,
  limit: number,
): Promise<SearchHit[]> {
  const n = normalize(query);
  const needles = [n.dev, n.ascii].filter(Boolean).filter((s) => s.length >= 2);
  if (needles.length === 0) return [];

  const catalog = await loadCatalog();
  const hits: SearchHit[] = [];
  for (const entry of catalog.texts) {
    const text: BhashyaText = await loadBhashya(entry.slug);
    for (const ch of text.chapters) {
      for (const u of ch.units) {
        const dev = u.root + ' ' + u.blocks.map((b) => b.text).join(' ');
        const ascii = asciiFold(dev);
        for (const needle of needles) {
          const haystack = isDevanagari(needle) ? dev : ascii;
          const idx = haystack.indexOf(needle);
          if (idx >= 0) {
            hits.push({
              doc: {
                id: `${text.slug}:${u.id}`,
                textSlug: text.slug,
                unitId: u.id,
                chapterOrdinal: ch.ordinal,
                unitOrdinal: u.ordinal,
                snippet: dev.slice(Math.max(0, idx - 20), idx + 140),
              },
              score: 1 / (1 + idx),
              rank: 'substring',
              matchedTokens: [needle],
            });
            if (hits.length >= limit) return hits;
            break;
          }
        }
      }
    }
  }
  return hits;
}

/**
 * In-text search — same engine, narrowed to a single text slug. Used
 * by the reader's "find in this bhāṣya" widget so the matching logic
 * stays consistent with the corpus-wide search.
 */
export async function searchInText(
  slug: string,
  rawQuery: string,
  opts: { limit?: number } = {},
): Promise<SearchHit[]> {
  return searchAll(rawQuery, { ...opts, scope: [slug] });
}

// Re-export for tests / external callers.
export { aksharas };
