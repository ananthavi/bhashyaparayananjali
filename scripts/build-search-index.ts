/**
 * Build a Lunr search index over the entire bhashya corpus.
 *
 * Reads the per-text manifest at public/data/bhashya/<slug>.json,
 * then loads every chapter chunk under public/data/bhashya/<slug>/<chId>.json
 * to access the unit bodies. Indexes mula (root) of each verse/sutra
 * with a short snippet for result display; the in-app search.ts
 * loads chapter chunks on demand for substring fallback over the
 * bhāṣya prose itself.
 *
 * Output: public/data/search/index.json and public/data/search/docs.json.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import lunr from 'lunr';
import type { BhashyaManifest, BhashyaChapterChunk, SearchIndexDoc } from '../src/types';

const DATA_DIR = path.join(process.cwd(), 'public', 'data');
const BHASHYA_DIR = path.join(DATA_DIR, 'bhashya');
const OUT_DIR = path.join(DATA_DIR, 'search');

async function main(): Promise<void> {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const files = (await fs.readdir(BHASHYA_DIR)).filter(
    (f) => f.endsWith('.json'),
  );

  const docs: SearchIndexDoc[] = [];
  const raw: Array<{ id: string; body: string }> = [];

  for (const f of files) {
    const slug = f.replace(/\.json$/, '');
    const manifest = JSON.parse(
      await fs.readFile(path.join(BHASHYA_DIR, f), 'utf8'),
    ) as BhashyaManifest;
    if (!manifest.chapters) continue; // skip non-manifest files

    for (const stub of manifest.chapters) {
      const chunkPath = path.join(BHASHYA_DIR, slug, `${stub.id}.json`);
      let chunk: BhashyaChapterChunk;
      try {
        chunk = JSON.parse(await fs.readFile(chunkPath, 'utf8')) as BhashyaChapterChunk;
      } catch {
        continue;
      }
      for (const u of chunk.chapter.units) {
        const id = `${slug}:${u.id}`;
        const body = u.root || u.blocks.map((b) => b.text.slice(0, 200)).join(' ');
        if (!body) continue;
        raw.push({ id, body });
        const snippet = (u.root || u.blocks[0]?.text || '').slice(0, 160);
        docs.push({
          id,
          textSlug: slug,
          unitId: u.id,
          chapterOrdinal: stub.ordinal,
          unitOrdinal: u.ordinal,
          snippet,
        });
      }
    }
  }

  // Lunr index. Pipeline is reset so the English stemmer / stop-words
  // don't run over Devanāgarī tokens.
  const index = lunr(function (this: lunr.Builder) {
    this.ref('id');
    this.field('body');
    this.pipeline.reset();
    this.searchPipeline.reset();
    for (const d of raw) this.add(d);
  });

  await fs.writeFile(path.join(OUT_DIR, 'index.json'), JSON.stringify(index), 'utf8');
  await fs.writeFile(path.join(OUT_DIR, 'docs.json'), JSON.stringify(docs), 'utf8');
  // eslint-disable-next-line no-console
  console.log(`Built search index: ${docs.length} docs across ${files.length} texts.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
