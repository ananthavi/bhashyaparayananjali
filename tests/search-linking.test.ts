import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { BhashyaManifest, SearchIndexDoc } from '../src/types';

const DATA_DIR = path.join(process.cwd(), 'public', 'data');

/**
 * End-to-end linking integrity: every (textSlug, unitId) emitted by
 * the search index must point to a unit that actually exists in the
 * matching manifest. If this fails the user clicks a search result
 * and lands somewhere wrong (the original "linking is messed up" bug).
 */
describe('search index → manifest linking', () => {
  it('every search-doc unitId is present in its text manifest', () => {
    const docs = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, 'search', 'docs.json'), 'utf8'),
    ) as SearchIndexDoc[];
    expect(docs.length).toBeGreaterThan(0);
    const manifests = new Map<string, BhashyaManifest>();
    const broken: Array<{ slug: string; unitId: string }> = [];

    for (const d of docs) {
      let m = manifests.get(d.textSlug);
      if (!m) {
        m = JSON.parse(
          fs.readFileSync(path.join(DATA_DIR, 'bhashya', `${d.textSlug}.json`), 'utf8'),
        ) as BhashyaManifest;
        manifests.set(d.textSlug, m);
      }
      const found = m.chapters.some((ch) => ch.units.some((u) => u.id === d.unitId));
      if (!found) broken.push({ slug: d.textSlug, unitId: d.unitId });
    }
    expect(broken).toEqual([]);
  });

  it('every manifest chapter exists as a chunk file', () => {
    const slugs = fs
      .readdirSync(path.join(DATA_DIR, 'bhashya'))
      .filter((f) => f.endsWith('.json'));
    const broken: string[] = [];
    for (const f of slugs) {
      const slug = f.replace(/\.json$/, '');
      const m = JSON.parse(
        fs.readFileSync(path.join(DATA_DIR, 'bhashya', f), 'utf8'),
      ) as BhashyaManifest;
      for (const ch of m.chapters) {
        const chunkPath = path.join(DATA_DIR, 'bhashya', slug, `${ch.id}.json`);
        if (!fs.existsSync(chunkPath)) broken.push(`${slug}/${ch.id}`);
      }
    }
    expect(broken).toEqual([]);
  });
});
