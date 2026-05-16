/**
 * Corpus volume audit for translation-effort estimation.
 *
 * Walks every chapter chunk and reports per-text token / character
 * counts split by (root text vs bhāṣya prose). The numbers here feed
 * `docs/translation-effort.md`.
 *
 * Definitions:
 *   - root token   = whitespace-separated piece of the mūla string
 *   - bhāṣya token = whitespace-separated piece of any block.text
 *   - "block kind" buckets so we know how much is leading bhāṣya
 *     (avatāraṇa) vs main bhāṣya vs aux śloka vs pratīka.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'public', 'data', 'bhashya');

interface Counts {
  units: number;
  rootChars: number;
  rootTokens: number;
  blockChars: Record<string, number>;
  blockTokens: Record<string, number>;
}

function newCounts(): Counts {
  return { units: 0, rootChars: 0, rootTokens: 0, blockChars: {}, blockTokens: {} };
}

function tokens(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

async function audit(slug: string): Promise<Counts> {
  const c = newCounts();
  const manifestPath = path.join(ROOT, `${slug}.json`);
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as {
    chapters?: Array<{ id: string }>;
  };
  for (const stub of manifest.chapters ?? []) {
    const chunkPath = path.join(ROOT, slug, `${stub.id}.json`);
    let chunk;
    try {
      chunk = JSON.parse(await fs.readFile(chunkPath, 'utf8')) as {
        chapter: { units: Array<{ root?: string; blocks?: Array<{ kind: string; text: string }> }> };
      };
    } catch {
      continue;
    }
    for (const u of chunk.chapter.units) {
      c.units += 1;
      const root = u.root ?? '';
      c.rootChars += root.length;
      c.rootTokens += tokens(root);
      for (const b of u.blocks ?? []) {
        const k = b.kind ?? 'unknown';
        c.blockChars[k] = (c.blockChars[k] ?? 0) + b.text.length;
        c.blockTokens[k] = (c.blockTokens[k] ?? 0) + tokens(b.text);
      }
    }
  }
  return c;
}

function fmt(n: number): string {
  return n.toLocaleString();
}

async function main(): Promise<void> {
  const files = (await fs.readdir(ROOT))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''));

  const all: Counts = newCounts();
  console.log(
    `slug                  units      root tok       root chars    bhāṣya tok    bhāṣya chars`,
  );
  console.log('-'.repeat(95));
  for (const slug of files.sort()) {
    const c = await audit(slug);
    const blockTokTotal = Object.values(c.blockTokens).reduce((a, b) => a + b, 0);
    const blockCharTotal = Object.values(c.blockChars).reduce((a, b) => a + b, 0);
    console.log(
      `${slug.padEnd(20)} ${fmt(c.units).padStart(6)} ${fmt(c.rootTokens).padStart(13)} ${fmt(c.rootChars).padStart(15)} ${fmt(blockTokTotal).padStart(13)} ${fmt(blockCharTotal).padStart(15)}`,
    );
    all.units += c.units;
    all.rootTokens += c.rootTokens;
    all.rootChars += c.rootChars;
    for (const [k, v] of Object.entries(c.blockTokens))
      all.blockTokens[k] = (all.blockTokens[k] ?? 0) + v;
    for (const [k, v] of Object.entries(c.blockChars))
      all.blockChars[k] = (all.blockChars[k] ?? 0) + v;
  }
  console.log('-'.repeat(95));
  const allBlockTok = Object.values(all.blockTokens).reduce((a, b) => a + b, 0);
  const allBlockChar = Object.values(all.blockChars).reduce((a, b) => a + b, 0);
  console.log(
    `${'TOTAL'.padEnd(20)} ${fmt(all.units).padStart(6)} ${fmt(all.rootTokens).padStart(13)} ${fmt(all.rootChars).padStart(15)} ${fmt(allBlockTok).padStart(13)} ${fmt(allBlockChar).padStart(15)}`,
  );

  console.log('\nBy bhāṣya block kind (across all 13 texts):');
  const kinds = Object.keys(all.blockTokens).sort();
  for (const k of kinds) {
    console.log(
      `  ${k.padEnd(20)} ${fmt(all.blockTokens[k] ?? 0).padStart(10)} tokens  ${fmt(all.blockChars[k] ?? 0).padStart(11)} chars`,
    );
  }

  // English equivalent (rough): translated English typically expands
  // Sanskrit by 2.5–3.5× in word count due to compound unpacking and
  // syntactic explicitness. We use 3× as the modal estimate.
  const englishWordsLow = (all.rootTokens + allBlockTok) * 2.5;
  const englishWordsHi = (all.rootTokens + allBlockTok) * 3.5;
  console.log(
    `\nEnglish translation volume (estimate, 2.5–3.5× expansion): ${fmt(Math.round(englishWordsLow))}–${fmt(Math.round(englishWordsHi))} words`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
