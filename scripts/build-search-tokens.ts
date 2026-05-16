/**
 * Build a corpus-token index for the search autocomplete.
 *
 * Walks every Devanāgarī token in every bhāṣya, counts frequencies,
 * and emits the top-N tokens sorted alphabetically. The runtime
 * autocomplete uses binary search (O(log n)) over this list to suggest
 * completions as the user types.
 *
 * Output: public/data/search/tokens.json
 *   { generatedAt, total, entries: [[devanagari, freq], …] }
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const BHASHYA_DIR = path.join(process.cwd(), 'public', 'data', 'bhashya');
const OUT = path.join(process.cwd(), 'public', 'data', 'search', 'tokens.json');
const TOKEN_RE = /[ऀ-ॣॲ-ॿ]+/g;

/** Drop tokens that are likely noise: too short, all digits, all marks. */
const LETTER_RE = /[ऄ-हक़-य़ॠ-ॡ]/;
function isUseful(tok: string): boolean {
  if (tok.length < 2) return false;
  // Must contain at least one independent letter (consonant or vowel).
  return LETTER_RE.test(tok);
}

async function main(): Promise<void> {
  const counts = new Map<string, number>();
  const files = (await fs.readdir(BHASHYA_DIR)).filter((f) => f.endsWith('.json'));

  for (const f of files) {
    const slug = f.replace(/\.json$/, '');
    const manifestRaw = await fs.readFile(path.join(BHASHYA_DIR, f), 'utf8');
    const manifest = JSON.parse(manifestRaw) as { chapters: Array<{ id: string }> };
    if (!manifest.chapters) continue; // not a manifest
    for (const stub of manifest.chapters) {
      const chunkPath = path.join(BHASHYA_DIR, slug, stub.id + '.json');
      let raw: string;
      try {
        raw = await fs.readFile(chunkPath, 'utf8');
      } catch {
        continue;
      }
      // Token-extract directly from the raw JSON string — saves parsing.
      const matches = raw.match(TOKEN_RE) ?? [];
      for (const m of matches) {
        if (!isUseful(m)) continue;
        counts.set(m, (counts.get(m) ?? 0) + 1);
      }
    }
  }

  // Keep tokens with frequency >= 2 to drop hapax-legomena noise; this
  // halves the file without losing anything useful for autocomplete.
  // Sort by Devanāgarī (UTF-16) order so the runtime can binary-search.
  const entries: Array<[string, number]> = [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  const total = entries.reduce((s, [, n]) => s + n, 0);
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
