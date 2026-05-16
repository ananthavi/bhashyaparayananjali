/**
 * Dictionary coverage report.
 *
 * Walks every Devanāgarī token in every bhāṣya JSON, runs each token
 * through the same analyzer the in-app word-tap popover uses, and
 * reports:
 *
 *   - total tokens vs distinct tokens
 *   - resolved fraction at each layer (direct, inflection, compound)
 *   - top-N unresolved tokens by frequency, so you know which lemmas
 *     are most worth adding to the seed glossary or which compounds
 *     the splitter is missing
 *
 * Run after the bulk dictionaries have been built so the splitter has
 * its full lemma oracle:
 *
 *   npm run dict:build           # generate public/data/dict/*.json
 *   npm run dict:coverage        # this script
 *
 * Output: a one-page summary on stdout plus
 * `scripts/.cache/coverage.json` with the full per-token verdict.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { proposeLemmas } from '../src/lib/sandhi/inflect';
import { splitCompound } from '../src/lib/sandhi/compound';
import { nearestHeads } from '../src/lib/sandhi/fuzzy';
import { lookup as seedLookup } from '../src/lib/dictionary';
import { BULK_DICT_ORDER, type BulkDictId } from '../src/lib/bulk-dictionary';
import type { BhashyaText } from '../src/types';

const BHASHYA_DIR = path.join(process.cwd(), 'public', 'data', 'bhashya');
const DICT_DIR = path.join(process.cwd(), 'public', 'data', 'dict');
const OUT = path.join(process.cwd(), 'scripts', '.cache', 'coverage.json');
// Devanāgarī codepoints minus dandas (0964 ।, 0965 ॥), minus digits (0966–096F),
// minus header chars (0970–0971). Anusvāra/visarga/halant remain because they're
// part of words.
const TOKEN_RE = /[ऀ-ॣॲ-ॿ]+/g;

interface DictMap {
  [head: string]: { iast?: string; en?: string };
}

async function loadBundledDicts(): Promise<{
  combined: Set<string>;
  perDict: Record<BulkDictId, DictMap>;
}> {
  const perDict = {
    mw: {},
    apte: {},
    vachaspatyam: {},
    shabdakalpadruma: {},
  } as Record<BulkDictId, DictMap>;
  for (const id of BULK_DICT_ORDER) {
    try {
      const txt = await fs.readFile(path.join(DICT_DIR, `${id}.json`), 'utf8');
      perDict[id] = JSON.parse(txt) as DictMap;
    } catch {
      // missing — fine
    }
  }
  const combined = new Set<string>();
  for (const id of BULK_DICT_ORDER) for (const k of Object.keys(perDict[id])) combined.add(k);
  return { combined, perDict };
}

interface TokenVerdict {
  layer: 'direct' | 'inflection' | 'compound' | 'fuzzy' | 'none';
  via?: string;
}

function classify(
  token: string,
  bulkHas: (s: string) => boolean,
  perDict: Record<BulkDictId, DictMap>,
): TokenVerdict {
  // 1. direct
  const seed = seedLookup(token);
  if (seed.exact) return { layer: 'direct', via: 'seed' };
  for (const id of BULK_DICT_ORDER) {
    if (perDict[id][token]) return { layer: 'direct', via: id };
  }

  // 2. inflection
  const lemmas = proposeLemmas(token);
  for (const c of lemmas) {
    const seedHit = seedLookup(c.lemma);
    if (seedHit.exact) return { layer: 'inflection', via: 'seed' };
    for (const id of BULK_DICT_ORDER) {
      if (perDict[id][c.lemma]) return { layer: 'inflection', via: id };
    }
  }

  // 3. compound
  const splits = splitCompound(token, { isLemma: bulkHas, maxDepth: 3 });
  const real = splits.find((s) => s.parts.length > 1 && s.score >= 0.6);
  if (real) return { layer: 'compound', via: 'split' };

  // 4. fuzzy approximate (matches the in-app fallback) — limited to
  //    tokens of reasonable length so we don't return absurd guesses
  //    for stray punctuation fragments.
  if (token.length >= 3) {
    // Pass the global oracle as the pool. We reuse `bulkHas` indirectly
    // via the closure in main(); here we just need any non-empty pool.
    const pool = Object.keys(perDict.mw); // approx; mw covers most heads
    const nearest = nearestHeads(token, pool, 1, 0.5);
    if (nearest.length > 0) return { layer: 'fuzzy', via: nearest[0].lemma };
  }

  return { layer: 'none' };
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const { combined, perDict } = await loadBundledDicts();
  // eslint-disable-next-line no-console
  console.log(
    `Loaded bundled dicts (combined heads: ${combined.size.toLocaleString()}). Walking corpus…`,
  );

  const files = (await fs.readdir(BHASHYA_DIR)).filter((f) => f.endsWith('.json'));
  const totalCounts = new Map<string, number>();
  let totalTokens = 0;

  for (const f of files) {
    const text = JSON.parse(
      await fs.readFile(path.join(BHASHYA_DIR, f), 'utf8'),
    ) as BhashyaText;
    for (const ch of text.chapters) {
      for (const u of ch.units) {
        const corpus = [u.root, ...u.blocks.map((b) => b.text)].filter(Boolean).join(' ');
        const matches = corpus.match(TOKEN_RE) ?? [];
        for (const m of matches) {
          totalTokens += 1;
          totalCounts.set(m, (totalCounts.get(m) ?? 0) + 1);
        }
      }
    }
  }

  const distinct = totalCounts.size;
  // eslint-disable-next-line no-console
  console.log(
    `Corpus tokens: total=${totalTokens.toLocaleString()}, distinct=${distinct.toLocaleString()}`,
  );

  const bulkHas = (s: string): boolean => combined.has(s);
  const layerCounts = { direct: 0, inflection: 0, compound: 0, fuzzy: 0, none: 0 };
  const layerTokenCounts = { direct: 0, inflection: 0, compound: 0, fuzzy: 0, none: 0 };
  const unresolvedByFreq = new Map<string, number>();
  const distinctEntries = [...totalCounts.entries()];

  let processed = 0;
  for (const [tok, freq] of distinctEntries) {
    const v = classify(tok, bulkHas, perDict);
    layerCounts[v.layer] += 1;
    layerTokenCounts[v.layer] += freq;
    if (v.layer === 'none') unresolvedByFreq.set(tok, freq);
    processed += 1;
    if (processed % 5000 === 0) {
      process.stderr.write(
        `\r  …classified ${processed.toLocaleString()}/${distinct.toLocaleString()}`,
      );
    }
  }
  process.stderr.write('\n');

  const sortedUnresolved = [...unresolvedByFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100);

  const pct = (n: number, d: number): string =>
    d === 0 ? '0%' : ((n * 100) / d).toFixed(2) + '%';

  // eslint-disable-next-line no-console
  console.log(`
Coverage by distinct token
  direct     : ${layerCounts.direct.toLocaleString()} (${pct(layerCounts.direct, distinct)})
  inflection : ${layerCounts.inflection.toLocaleString()} (${pct(layerCounts.inflection, distinct)})
  compound   : ${layerCounts.compound.toLocaleString()} (${pct(layerCounts.compound, distinct)})
  fuzzy      : ${layerCounts.fuzzy.toLocaleString()} (${pct(layerCounts.fuzzy, distinct)})
  unresolved : ${layerCounts.none.toLocaleString()} (${pct(layerCounts.none, distinct)})

Coverage by token occurrences (frequency-weighted)
  direct     : ${layerTokenCounts.direct.toLocaleString()} (${pct(layerTokenCounts.direct, totalTokens)})
  inflection : ${layerTokenCounts.inflection.toLocaleString()} (${pct(layerTokenCounts.inflection, totalTokens)})
  compound   : ${layerTokenCounts.compound.toLocaleString()} (${pct(layerTokenCounts.compound, totalTokens)})
  fuzzy      : ${layerTokenCounts.fuzzy.toLocaleString()} (${pct(layerTokenCounts.fuzzy, totalTokens)})
  unresolved : ${layerTokenCounts.none.toLocaleString()} (${pct(layerTokenCounts.none, totalTokens)})
`);

  // eslint-disable-next-line no-console
  console.log('Top 25 unresolved tokens by frequency:');
  for (const [tok, freq] of sortedUnresolved.slice(0, 25)) {
    // eslint-disable-next-line no-console
    console.log(`  ${freq.toString().padStart(6)}  ${tok}`);
  }

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(
    OUT,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        totalTokens,
        distinct,
        layerCounts,
        layerTokenCounts,
        unresolved: sortedUnresolved.map(([tok, freq]) => ({ tok, freq })),
      },
      null,
      2,
    ),
    'utf8',
  );
  // eslint-disable-next-line no-console
  console.log(`\nFull verdict written to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
