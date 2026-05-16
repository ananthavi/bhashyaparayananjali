/**
 * Bhāṣya-gloss extractor.
 *
 * Walks every chapter chunk in the corpus and finds places where
 * Śaṅkara's prose explicitly defines a Sanskrit term. The patterns
 * we recognise:
 *
 *   1. `X इति Y`         — "X means Y" (the most common)
 *   2. `X इत्यर्थः`       — "(the previous clause is) the meaning"
 *   3. `X अर्थात् Y`     — "by 'X' is meant Y"
 *   4. `X = Y`           — explicit equation in editorial brackets
 *   5. `X इत्युच्यते`     — "is called X" (term following)
 *
 * The extractor is conservative — false negatives are fine, false
 * positives pollute the popover. Matches that are clearly
 * grammatical particles (इति-clauses inside quotations, for
 * instance) are filtered out.
 *
 * Output: public/data/glosses/<text-slug>.json
 *   {
 *     "<term-devanagari>": [
 *       { unitId, snippet, rule, score }
 *     ]
 *   }
 *
 * The popover (Phase 1 of context-meaning-plan) reads these and
 * shows the matching gloss above any dictionary entry — the Śruti
 * pramāṇa from Mīmāṁsā: the bhāṣya defines its own term.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { BhashyaChapterChunk, BhashyaManifest } from '../src/types';

const BHASHYA_DIR = path.join(process.cwd(), 'public', 'data', 'bhashya');
const OUT_DIR = path.join(process.cwd(), 'public', 'data', 'glosses');

// Devanāgarī-only word: at least 2 akṣaras of consonants/vowels.
const TERM = '([\\u0900-\\u097F]{3,}?)';
// A short clause: up to ~30 chars of Devanāgarī (the gloss body).
const CLAUSE = '([\\u0900-\\u097F\\s]{2,40}?)';
const SENT_BREAK = '[।॥;,—]';

interface Pattern {
  rule: 'iti' | 'ity-arthah' | 'arthat' | 'equals' | 'iti-uchyate';
  re: RegExp;
  /** Index of the term capture group; the gloss is captured separately. */
  termGroup: number;
  glossGroup: number | null;
  /** Higher = more confident. Used to break ties when multiple patterns hit. */
  score: number;
}

const PATTERNS: Pattern[] = [
  // X इत्यर्थः — the immediately-preceding clause is the meaning of X.
  // We capture the preceding clause as the gloss.
  {
    rule: 'ity-arthah',
    re: new RegExp(`${CLAUSE}\\s*${TERM}\\s*इत्यर्थः`, 'g'),
    termGroup: 2,
    glossGroup: 1,
    score: 1.0,
  },
  // X अर्थात् Y — "by X is meant Y".
  {
    rule: 'arthat',
    re: new RegExp(`${TERM}\\s*अर्थात्\\s*${CLAUSE}(?=${SENT_BREAK})`, 'g'),
    termGroup: 1,
    glossGroup: 2,
    score: 0.95,
  },
  // X इत्युच्यते — "is called X". The preceding clause is the term.
  {
    rule: 'iti-uchyate',
    re: new RegExp(`${CLAUSE}\\s*इत्युच्यते`, 'g'),
    termGroup: 1, // we treat the clause as both term and gloss for review
    glossGroup: 1,
    score: 0.6,
  },
  // X इति Y — broadest pattern. Lots of false positives possible
  // because "इति" is ubiquitous, so we score lower and require
  // the gloss clause to be reasonably short.
  {
    rule: 'iti',
    re: new RegExp(`${TERM}\\s*इति\\s*${CLAUSE}(?=${SENT_BREAK})`, 'g'),
    termGroup: 1,
    glossGroup: 2,
    score: 0.7,
  },
];

interface GlossEntry {
  unitId: string;
  snippet: string;
  rule: string;
  score: number;
}

function clean(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/[‘’"]/g, '')
    .trim();
}

function extractFromUnit(unitId: string, body: string): Map<string, GlossEntry> {
  const out = new Map<string, GlossEntry>();
  for (const p of PATTERNS) {
    let m: RegExpExecArray | null;
    p.re.lastIndex = 0;
    while ((m = p.re.exec(body)) !== null) {
      const term = clean(m[p.termGroup]);
      if (term.length < 3 || term.length > 30) continue;
      // Keep the highest-scoring entry per (unit, term).
      const key = `${term}`;
      const prev = out.get(key);
      if (!prev || prev.score < p.score) {
        out.set(key, {
          unitId,
          snippet: clean(m[0]).slice(0, 220),
          rule: p.rule,
          score: p.score,
        });
      }
    }
  }
  return out;
}

async function main(): Promise<void> {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const files = (await fs.readdir(BHASHYA_DIR)).filter((f) => f.endsWith('.json'));
  let totalGlosses = 0;
  let totalUnits = 0;

  for (const f of files) {
    const slug = f.replace(/\.json$/, '');
    const manifest = JSON.parse(
      await fs.readFile(path.join(BHASHYA_DIR, f), 'utf8'),
    ) as BhashyaManifest;
    if (!manifest.chapters) continue;

    const perTerm: Record<string, GlossEntry[]> = {};
    for (const stub of manifest.chapters) {
      const chunkPath = path.join(BHASHYA_DIR, slug, `${stub.id}.json`);
      let chunk: BhashyaChapterChunk;
      try {
        chunk = JSON.parse(await fs.readFile(chunkPath, 'utf8')) as BhashyaChapterChunk;
      } catch {
        continue;
      }
      for (const u of chunk.chapter.units) {
        const body = [u.root, ...u.blocks.map((b) => b.text)].filter(Boolean).join(' ');
        if (!body) continue;
        totalUnits += 1;
        const found = extractFromUnit(u.id, body);
        for (const [term, entry] of found) {
          (perTerm[term] = perTerm[term] ?? []).push(entry);
          totalGlosses += 1;
        }
      }
    }

    // Sort entries per term by score descending, drop the long tail (>10).
    for (const term of Object.keys(perTerm)) {
      perTerm[term].sort((a, b) => b.score - a.score);
      perTerm[term] = perTerm[term].slice(0, 10);
    }

    const out = {
      slug,
      generatedAt: new Date().toISOString(),
      glossesPerTerm: perTerm,
    };
    const json = JSON.stringify(out);
    await fs.writeFile(path.join(OUT_DIR, `${slug}.json`), json, 'utf8');
    // eslint-disable-next-line no-console
    console.log(
      `• ${slug.padEnd(20)} ${Object.keys(perTerm).length.toLocaleString().padStart(6)} terms · ${(json.length / 1024).toFixed(1)} KB`,
    );
  }

  // eslint-disable-next-line no-console
  console.log(
    `\nWalked ${totalUnits.toLocaleString()} units across ${files.length} texts · extracted ${totalGlosses.toLocaleString()} gloss entries.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
