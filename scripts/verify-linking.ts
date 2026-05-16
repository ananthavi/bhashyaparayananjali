/**
 * Linking integrity check.
 *
 * Walks every entry in the search index docs.json and verifies that
 * its (textSlug, unitId) corresponds to a real unit in the published
 * manifest at public/data/bhashya/<slug>.json. Any mismatch is a
 * potential 404 from a search-result click, so we fail loudly.
 *
 * Run:  npm run verify:linking
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { BhashyaManifest, SearchIndexDoc } from '../src/types';

const ROOT = path.join(process.cwd(), 'public', 'data');

async function main(): Promise<void> {
  const docsRaw = await fs.readFile(path.join(ROOT, 'search', 'docs.json'), 'utf8');
  const docs = JSON.parse(docsRaw) as SearchIndexDoc[];
  const manifests = new Map<string, BhashyaManifest>();
  let bad = 0;
  let checked = 0;

  for (const d of docs) {
    let m = manifests.get(d.textSlug);
    if (!m) {
      const raw = await fs.readFile(
        path.join(ROOT, 'bhashya', `${d.textSlug}.json`),
        'utf8',
      );
      m = JSON.parse(raw) as BhashyaManifest;
      manifests.set(d.textSlug, m);
    }
    let found = false;
    for (const ch of m.chapters) {
      if (ch.units.some((u) => u.id === d.unitId)) {
        found = true;
        break;
      }
    }
    if (!found) {
      // eslint-disable-next-line no-console
      console.error(`MISSING: ${d.textSlug} / ${d.unitId}`);
      bad += 1;
    }
    checked += 1;
    if (checked % 1000 === 0) {
      process.stderr.write(`\rchecked ${checked.toLocaleString()} docs`);
    }
  }
  process.stderr.write('\n');
  // eslint-disable-next-line no-console
  console.log(
    `Linking check: ${(checked - bad).toLocaleString()} / ${checked.toLocaleString()} docs link to a real unit (${bad} broken).`,
  );
  process.exit(bad === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
