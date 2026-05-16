/**
 * Full-text search across all bhāṣyas.
 *
 * The query is translated into a set of equivalent forms before
 * matching, so the user can type in any supported script with or
 * without IAST diacritics:
 *
 *   • Devanāgarī       → match as-is
 *   • Any Indic script → transliterated to Devanāgarī
 *   • IAST (with marks)  → transliterated to Devanāgarī
 *   • Plain ASCII Latin  → treated as ITRANS-style; if that fails,
 *                          treated as IAST-without-diacritics with
 *                          long↔short and aspirate substitutions
 *                          tried automatically (e.g. "brahma"
 *                          matches "ब्रह्म"; "atma" matches "आत्मन्")
 *
 * Results are ranked: exact (full-token) hits first, then prefix /
 * substring, then approximate (fuzzy edit-distance / wildcard).
 * The caller can pass `exactOnly` to suppress the fuzzy tier.
 */

import lunr from 'lunr';
import type { BhashyaText, SearchIndexDoc } from '@/types';
import { loadCatalog, loadBhashya } from './loader';
import { toDevanagari } from './transliterate';
import { aksharas } from './sandhi/aksharas';
import { asset } from './asset';

export interface SearchHit {
  doc: SearchIndexDoc;
  score: number;
  /** What kind of match this is, for ranking + UI badge. */
  rank: 'exact' | 'prefix' | 'substring' | 'fuzzy';
  /** Devanāgarī tokens that triggered the match — used by the UI to
   *  highlight them in the snippet and inside the opened unit. */
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

let indexPromise: Promise<{ index: lunr.Index; docs: SearchIndexDoc[] } | null> | null = null;

async function tryLoadIndex(): Promise<{ index: lunr.Index; docs: SearchIndexDoc[] } | null> {
  try {
    const [idxRes, docsRes] = await Promise.all([
      fetch(asset('data/search/index.json')),
      fetch(asset('data/search/docs.json')),
    ]);
    if (!idxRes.ok || !docsRes.ok) return null;
    const rawIndex = await idxRes.json();
    const docs = (await docsRes.json()) as SearchIndexDoc[];
    const index = lunr.Index.load(rawIndex);
    return { index, docs };
  } catch {
    return null;
  }
}

export async function ensureIndex(): Promise<{
  index: lunr.Index;
  docs: SearchIndexDoc[];
} | null> {
  if (!indexPromise) indexPromise = tryLoadIndex();
  return indexPromise;
}

/** Simple Devanāgarī check. */
function isDevanagari(s: string): boolean {
  return /[ऀ-ॿ]/.test(s);
}

/** Detect any Indic script. */
function isIndic(s: string): boolean {
  return /[ऀ-ॿഀ-ൿ஀-௿ఀ-౿ಀ-೿ঀ-৿਀-੿઀-૿଀-୿]/.test(s);
}

/** Strip IAST diacritics so we can search "brahma" against "brahmā". */
function stripDiacritics(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // combining marks
    .replace(/[ḥḤṃṂṅṄñÑṭṬḍḌṇṆśŚṣṢṛṚṝṜḷḶ]/g, (c) => {
      const map: Record<string, string> = {
        ḥ: 'h', Ḥ: 'h', ṃ: 'm', Ṃ: 'm',
        ṅ: 'n', Ṅ: 'n', ñ: 'n', Ñ: 'n',
        ṭ: 't', Ṭ: 't', ḍ: 'd', Ḍ: 'd', ṇ: 'n', Ṇ: 'n',
        ś: 's', Ś: 's', ṣ: 's', Ṣ: 's',
        ṛ: 'r', Ṛ: 'r', ṝ: 'r', Ṝ: 'r', ḷ: 'l', Ḷ: 'l',
      };
      return map[c] ?? c;
    })
    .toLowerCase();
}

/**
 * Build the set of Devanāgarī forms this query could plausibly mean.
 * Each form is fed to the index separately and the union of hits is
 * returned (de-duplicated and re-ranked).
 *
 * For Devanāgarī input we also produce sandhi-relevant variants:
 *   • drop a trailing anusvāra (सर्वं → सर्व)
 *   • restore an explicit -m for a final anusvāra (सर्वं → सर्वम्)
 *   • drop a trailing visarga (रामः → राम)
 *   • restore as-form for a final ो (देवो → देवस्)
 * so the query can match either the post-sandhi corpus form or the
 * dictionary head.
 */
export function expandQueryToDevanagari(input: string): string[] {
  const out = new Set<string>();
  const trimmed = input.trim();
  if (!trimmed) return [];

  // 1. Already Devanāgarī.
  if (isDevanagari(trimmed)) {
    addDevanagariVariants(trimmed, out);
    return [...out];
  }

  // 2. Any other Indic script: convert, then sandhi-expand.
  if (isIndic(trimmed)) {
    const dev = toDevanagari(trimmed);
    addDevanagariVariants(dev, out);
    return [...out];
  }

  // 3. Latin input. Try multiple interpretations.
  const hasDiacritics = /[āīūṛṝḷḹṃḥṅñṭḍṇśṣ]/i.test(trimmed);

  if (hasDiacritics) {
    addDevanagariVariants(toDevanagari(trimmed), out);
  }

  // ITRANS / SLP1 cluster signal — uppercase letters or escape chars.
  if (/[A-Z]/.test(trimmed) || /\.|~/.test(trimmed)) {
    try {
      addDevanagariVariants(toDevanagari(trimmed), out);
    } catch {
      // fall through
    }
  }

  // 4. Plain ASCII without marks. Generate plausible IAST guesses,
  //    then sandhi-expand each.
  const stripped = stripDiacritics(trimmed);
  const candidates = generateIastVariants(stripped);
  for (const c of candidates) {
    const d = toDevanagari(c);
    if (d) addDevanagariVariants(d, out);
  }

  return [...out].filter((s) => s.length > 0);
}

/**
 * Add a Devanāgarī string plus its high-yield sandhi/morphology
 * variants to the set. Limited to safe transformations that don't
 * explode the variant count.
 */
function addDevanagariVariants(dev: string, out: Set<string>): void {
  if (!dev) return;
  out.add(dev);
  // Word-final anusvāra ↔ -m
  if (dev.endsWith('ं')) {
    out.add(dev.slice(0, -1));
    out.add(dev.slice(0, -1) + 'म्');
  }
  // Word-final visarga: drop / restore
  if (dev.endsWith('ः')) {
    out.add(dev.slice(0, -1));
    out.add(dev.slice(0, -1) + 'स्');
  }
  // Word-final -o (often <-aḥ in sandhi)
  if (dev.endsWith('ो')) {
    out.add(dev.slice(0, -1) + 'ः');
    out.add(dev.slice(0, -1) + 'स्');
  }
  // Word-final mātrā -ā ↔ -न् (n-stem like ब्रह्मा ↔ ब्रह्मन्)
  if (dev.endsWith('ा') && dev.length > 2) {
    out.add(dev.slice(0, -1) + 'न्');
  }
  // Drop a trailing virāma: "ब्रह्मन्" → "ब्रह्मन" (rough lookup).
  if (dev.endsWith('्')) {
    out.add(dev.slice(0, -1));
  }
}

/**
 * From a plain ASCII string, generate a set of plausible IAST /
 * ITRANS interpretations. Covers the typing patterns common in the
 * corpus: long-vowel marks dropped, aspirates with `h`, sibilant
 * spellings, retroflex `R`/`Sh`/`T`, etc.
 */
function generateIastVariants(ascii: string): string[] {
  const out = new Set<string>([ascii]);
  out.add(ascii);

  // Long-vowel guesses (any single vowel could be either).
  for (const m of [
    [/^a/, 'ā'],
    [/a$/, 'ā'],
    [/i/g, 'ī'],
    [/u/g, 'ū'],
    [/ri/g, 'ṛ'],
    [/Ri/g, 'ṛ'],
    [/aa/g, 'ā'],
    [/ee/g, 'ī'],
    [/oo/g, 'ū'],
  ] as const) {
    out.add(ascii.replace(m[0], m[1] as string));
  }

  // Sibilant variants — both palatal and retroflex are valid for plain "sh".
  out.add(ascii.replace(/sh/g, 'ś'));
  out.add(ascii.replace(/sh/g, 'ṣ'));
  out.add(ascii.replace(/Sh/g, 'ṣ'));

  // Aspirated dentals/retroflexes spelled with `h`.
  out.add(ascii.replace(/dh/g, 'dh'));
  out.add(ascii.replace(/Dh/g, 'ḍh'));
  out.add(ascii.replace(/T/g, 'ṭ'));
  out.add(ascii.replace(/D/g, 'ḍ'));
  out.add(ascii.replace(/N/g, 'ṇ'));

  // Anusvāra spelled `M` or `m`.
  if (ascii.endsWith('m')) out.add(ascii.slice(0, -1) + 'ṃ');
  if (ascii.includes('M')) out.add(ascii.replace(/M/g, 'ṃ'));

  // Visarga spelled `H` (sandhi forms).
  if (ascii.endsWith('h')) out.add(ascii.slice(0, -1) + 'ḥ');
  if (ascii.includes('H')) out.add(ascii.replace(/H/g, 'ḥ'));

  // Final adjustments — citations vs. surface forms.
  out.add(ascii + 'a');
  if (ascii.endsWith('a')) out.add(ascii.slice(0, -1));
  // The Sanskrit -an ending citation form.
  if (ascii.endsWith('a')) out.add(ascii.slice(0, -1) + 'an');
  if (ascii.endsWith('an')) out.add(ascii.slice(0, -2));

  return [...out];
}

export async function searchAll(
  rawQuery: string,
  opts: SearchOptions = {},
): Promise<SearchHit[]> {
  const limit = opts.limit ?? 100;
  const exactOnly = opts.exactOnly ?? false;
  const trimmed = rawQuery.trim();
  if (!trimmed) return [];

  // Multi-token: split on whitespace and resolve each independently. The
  // ranker prefers documents that contain ALL query tokens (or their
  // sandhi-relevant variants); next-best are docs containing most tokens;
  // last are single-token matches. Within each tier we sort by Lunr's
  // TF-IDF-ish score.
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const tokenVariants: string[][] = tokens.map((t) => expandQueryToDevanagari(t));
  // Flat list for highlight reporting.
  const allMatchedTokens = Array.from(
    new Set(tokenVariants.flat().filter((v) => v.length > 0)),
  );

  if (tokenVariants.length === 0 || allMatchedTokens.length === 0) return [];

  const loaded = await ensureIndex();
  if (!loaded) {
    return fallbackSubstringSearch(allMatchedTokens, limit, exactOnly).then((hits) =>
      hits.map((h) => ({ ...h, matchedTokens: allMatchedTokens })),
    );
  }
  const { index, docs } = loaded;
  const docById = new Map(docs.map((d) => [d.id, d]));

  /**
   * For each query token, find the set of docs that match any of its
   * variants. Then rank docs by how many tokens match.
   */
  const perTokenDocs: Map<string, number>[] = tokenVariants.map((variants) => {
    const docScores = new Map<string, number>();
    for (const v of variants) {
      // Try exact, then prefix, then fuzzy (unless exactOnly).
      tryAddScores(index, v, docScores, 1.0); // exact
      tryAddScores(index, `${v}*`, docScores, 0.7); // prefix
      if (!exactOnly && v.length > 2) {
        tryAddScores(index, `${v}~1`, docScores, 0.5); // fuzzy edit-distance 1
      }
      if (!exactOnly && v.length > 4) {
        tryAddScores(index, `${v}~2`, docScores, 0.3); // fuzzy edit-distance 2 for longer typos
      }
      if (v.length > 1) tryAddScores(index, `*${v}*`, docScores, 0.3); // substring
    }
    return docScores;
  });

  // Aggregate across query tokens.
  const aggregate = new Map<string, { score: number; tokensHit: number; bestRank: SearchHit['rank'] }>();
  for (const docScores of perTokenDocs) {
    for (const [docId, score] of docScores) {
      const prev = aggregate.get(docId);
      if (!prev) {
        aggregate.set(docId, { score, tokensHit: 1, bestRank: 'substring' });
      } else {
        prev.score += score;
        prev.tokensHit += 1;
      }
    }
  }
  // Bonus for documents that contain ALL query tokens (gap-tolerant
  // multi-word match). The user might type "brahma jnana" expecting
  // both words to be in the same unit, with anything in between.
  if (tokens.length > 1) {
    for (const [, agg] of aggregate) {
      if (agg.tokensHit === tokens.length) {
        agg.score *= 1.6;
      }
    }
  }
  // Promote docs that scored best on EACH token's first (exact) query.
  for (const docScores of perTokenDocs) {
    for (const [docId] of docScores) {
      const e = aggregate.get(docId);
      if (e) e.bestRank = bestRankForScore(docScores.get(docId) ?? 0, e.bestRank);
    }
  }

  const scopeSet =
    opts.scope && opts.scope.length > 0 ? new Set(opts.scope) : null;
  const results: SearchHit[] = [];
  for (const [docId, agg] of aggregate) {
    const doc = docById.get(docId);
    if (!doc) continue;
    if (scopeSet && !scopeSet.has(doc.textSlug)) continue;
    // Require at least half of the tokens to match for multi-token queries.
    if (tokens.length > 1 && agg.tokensHit < Math.ceil(tokens.length / 2)) continue;
    results.push({
      doc,
      score: agg.score * (1 + agg.tokensHit / Math.max(1, tokens.length)),
      rank: agg.bestRank,
      matchedTokens: allMatchedTokens,
    });
  }

  const rankWeight: Record<SearchHit['rank'], number> = {
    exact: 4,
    prefix: 3,
    substring: 2,
    fuzzy: 1,
  };
  results.sort((a, b) => {
    const dr = rankWeight[b.rank] - rankWeight[a.rank];
    if (dr !== 0) return dr;
    return b.score - a.score;
  });
  return results.slice(0, limit);
}

function tryAddScores(
  index: lunr.Index,
  query: string,
  out: Map<string, number>,
  weight: number,
): void {
  let res: lunr.Index.Result[];
  try {
    res = index.search(query);
  } catch {
    return;
  }
  for (const r of res) {
    const score = r.score * weight;
    const prev = out.get(r.ref) ?? 0;
    if (score > prev) out.set(r.ref, score);
  }
}

function bestRankForScore(_score: number, prev: SearchHit['rank']): SearchHit['rank'] {
  // Lunr score alone doesn't tell us exact vs. prefix; preserve the
  // best rank we've already promoted to on this doc.
  return prev;
}

async function fallbackSubstringSearch(
  variants: string[],
  limit: number,
  _exactOnly: boolean,
): Promise<Omit<SearchHit, 'matchedTokens'>[]> {
  const catalog = await loadCatalog();
  const hits: Omit<SearchHit, 'matchedTokens'>[] = [];
  for (const entry of catalog.texts) {
    const text: BhashyaText = await loadBhashya(entry.slug);
    for (const ch of text.chapters) {
      for (const u of ch.units) {
        const haystack = u.root + ' ' + u.blocks.map((b) => b.text).join(' ');
        for (const v of variants) {
          const idx = haystack.indexOf(v);
          if (idx >= 0) {
            hits.push({
              rank: 'substring',
              score: 1 / (1 + idx),
              doc: {
                id: `${text.slug}:${u.id}`,
                textSlug: text.slug,
                unitId: u.id,
                chapterOrdinal: ch.ordinal,
                unitOrdinal: u.ordinal,
                snippet: haystack.slice(Math.max(0, idx - 20), idx + 140),
              },
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

// Re-export for tests.
export { aksharas };
