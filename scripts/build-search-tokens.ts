/**
 * Build the corpus token list that backs autocomplete.
 *
 * Each entry carries the Devanāgarī token, its IAST-ascii fold (via
 * `src/lib/search-normalize.ts`), and the frequency. Autocomplete at
 * runtime feeds both forms into the matcher so the user can type a
 * prefix, infix, or suffix of either form ("tma" → "ātma",
 * "paramātman", "pratyagātmā").
 *
 * Output: public/data/search/tokens.json
 *   { generatedAt, total, distinct, entries: [[dev, ascii, freq], …] }
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { normalize } from '../src/lib/search-normalize';

const BHASHYA_DIR = path.join(process.cwd(), 'public', 'data', 'bhashya');
const OUT = path.join(process.cwd(), 'public', 'data', 'search', 'tokens.json');
// All Devanāgarī block codepoints (independent + dependent + nukta).
const TOKEN_RE = /[ऀ-ॿ]+/g;
// Independent vowels & consonants (U+0904–U+0939), nukta-set
// (U+0958–U+095F), vocalic ṛ/ḷ (U+0960–U+0961). Written as Unicode
// escapes so the TS compiler doesn't trip on canonical-equivalence
// inside the literal character class.
const LETTER_RE = /[ऄ-हक़-य़ॠ-ॡ]/;

function isUseful(tok: string): boolean {
  if (tok.length < 2) return false;
  return LETTER_RE.test(tok);
}

async function main(): Promise<void> {
  const counts = new Map<string, number>();
  const files = (await fs.readdir(BHASHYA_DIR)).filter((f) => f.endsWith('.json'));

  for (const f of files) {
    const slug = f.replace(/\.json$/, '');
    const manifestRaw = await fs.readFile(path.join(BHASHYA_DIR, f), 'utf8');
    const manifest = JSON.parse(manifestRaw) as { chapters: Array<{ id: string }> };
    if (!manifest.chapters) continue;
    for (const stub of manifest.chapters) {
      const chunkPath = path.join(BHASHYA_DIR, slug, stub.id + '.json');
      let raw: string;
      try {
        raw = await fs.readFile(chunkPath, 'utf8');
      } catch {
        continue;
      }
      const matches = raw.match(TOKEN_RE) ?? [];
      for (const m of matches) {
        if (!isUseful(m)) continue;
        counts.set(m, (counts.get(m) ?? 0) + 1);
      }
    }
    // Touch slug so unused-var lint stays quiet.
    void slug;
  }

  const entries: Array<[string, string, number]> = [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .map(([dev, n]) => [dev, normalize(dev).ascii, n] as [string, string, number])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  const total = entries.reduce((s, [, , n]) => s + n, 0);
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  const json = JSON.stringify({
    generatedAt: new Date().toISOString(),
    total,
    distinct: entries.length,
    entries,
  });
  await fs.writeFile(OUT, json, 'utf8');
  // eslint-disable-next-line no-console
  console.log(
    `tokens index: ${entries.length.toLocaleString()} distinct over ${total.toLocaleString()} occurrences · ${(json.length / 1024 / 1024).toFixed(1)} MB`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
