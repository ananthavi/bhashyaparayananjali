/**
 * Build the corpus payload that feeds the browser's FlexSearch index.
 *
 * Instead of pre-building and serializing the index (FlexSearch v0.8's
 * export API is brittle across versions), we ship the raw indexed
 * fields plus display metadata. The runtime builds the FlexSearch
 * Document index on first search — for ~3 000 docs this costs <100 ms
 * cold and amortizes to zero on every subsequent query.
 *
 * Each indexed doc carries two normalized fields produced by
 * `src/lib/search-normalize.ts`:
 *
 *   • `dev`   — Devanāgarī source (token full-text)
 *   • `ascii` — IAST-ascii fold so a Roman query of any partial /
 *               infix string ("tma" → "ātma", "paramātman") hits.
 *
 * Output:
 *   public/data/search/docs.json     — display metadata for hits
 *   public/data/search/payload.json  — { id, dev, ascii }[] for indexing
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { BhashyaManifest, BhashyaChapterChunk, SearchIndexDoc } from '../src/types';
import { normalize } from '../src/lib/search-normalize';

const DATA_DIR = path.join(process.cwd(), 'public', 'data');
const BHASHYA_DIR = path.join(DATA_DIR, 'bhashya');
const OUT_DIR = path.join(DATA_DIR, 'search');

interface IndexPayload {
  id: string;
  dev: string;
  ascii: string;
}

async function main(): Promise<void> {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const files = (await fs.readdir(BHASHYA_DIR)).filter((f) => f.endsWith('.json'));

  const docs: SearchIndexDoc[] = [];
  const payload: IndexPayload[] = [];

  for (const f of files) {
    const slug = f.replace(/\.json$/, '');
    const manifest = JSON.parse(
      await fs.readFile(path.join(BHASHYA_DIR, f), 'utf8'),
    ) as BhashyaManifest;
    if (!manifest.chapters) continue;

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
        const dev =
          (u.root || '') +
          ' ' +
          u.blocks.map((b) => (b.text || '').slice(0, 400)).join(' ');
        if (!dev.trim()) continue;
        const n = normalize(dev);
        payload.push({
          id,
          dev: n.dev || dev,
          ascii: n.ascii,
        });
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

  await fs.writeFile(
    path.join(OUT_DIR, 'payload.json'),
    JSON.stringify(payload),
    'utf8',
  );
  await fs.writeFile(
    path.join(OUT_DIR, 'docs.json'),
    JSON.stringify(docs),
    'utf8',
  );

  // Remove the old Lunr-format file if present so dev builds don't
  // accidentally still ship it.
  try {
    await fs.unlink(path.join(OUT_DIR, 'index.json'));
  } catch {
    /* not present */
  }

  // eslint-disable-next-line no-console
  console.log(
    `Built search payload: ${docs.length} docs across ${files.length} texts.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
