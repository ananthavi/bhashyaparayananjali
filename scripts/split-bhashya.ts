/**
 * Post-process the scraped per-text bhāṣya JSONs into a lazy-loadable
 * manifest + per-chapter chunk format.
 *
 * Output layout under public/data/bhashya/:
 *
 *   <slug>.json                  — small manifest (chapter stubs only)
 *   <slug>/<chapterId>.json      — full chapter (units + bodies)
 *
 * Tiny texts (< MIN_SPLIT_BYTES) skip the per-chapter split — they're
 * fast to load whole. The manifest still exists so the loader code path
 * is uniform.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  BhashyaText,
  BhashyaManifest,
  ChapterStub,
  BhashyaChapterChunk,
} from '../src/types';

const BHASHYA_DIR = path.join(process.cwd(), 'public', 'data', 'bhashya');
/** Texts smaller than this stay as one file. */
const MIN_SPLIT_BYTES = 100 * 1024;

async function processOne(filename: string): Promise<void> {
  const fullPath = path.join(BHASHYA_DIR, filename);
  const stat = await fs.stat(fullPath);
  if (!stat.isFile() || !filename.endsWith('.json')) return;
  const slug = filename.replace(/\.json$/, '');
  const raw = await fs.readFile(fullPath, 'utf8');
  let text: BhashyaText;
  try {
    text = JSON.parse(raw) as BhashyaText;
  } catch {
    return;
  }
  // Skip if this is already a manifest (has `chunked` field).
  if ((text as unknown as BhashyaManifest).chunked !== undefined) return;

  // Always split — even tiny texts. Per-chapter chunks are what the
  // lazy loader expects and the per-file overhead is negligible.
  const chunkDir = path.join(BHASHYA_DIR, slug);
  await fs.mkdir(chunkDir, { recursive: true });
  // Whether to mark the manifest as chunked is a pure information
  // bit for the loader; we always physically split.
  const chunked = stat.size >= MIN_SPLIT_BYTES && text.chapters.length > 1;

  const stubs: ChapterStub[] = [];
  for (const ch of text.chapters) {
    const chunkPath = `/data/bhashya/${slug}/${ch.id}.json`;
    const chunk: BhashyaChapterChunk = { textSlug: slug, chapter: ch };
    const json = JSON.stringify(chunk);
    const out = path.join(chunkDir, `${ch.id}.json`);
    await fs.writeFile(out, json, 'utf8');
    const chunkSize = Buffer.byteLength(json, 'utf8');
    stubs.push({
      id: ch.id,
      ordinal: ch.ordinal,
      titleSa: ch.titleSa,
      parentTitleSa: ch.parentTitleSa,
      parentOrdinal: ch.parentOrdinal,
      kind: ch.kind,
      units: ch.units.map((u) => ({ id: u.id, kind: u.kind, ordinal: u.ordinal })),
      chunkPath,
      chunkSize,
    });
  }

  const manifest: BhashyaManifest = {
    slug,
    titleSa: text.titleSa,
    titleIast: text.titleIast,
    titleEn: text.titleEn,
    group: text.group,
    sourceUrl: text.sourceUrl,
    fetchedAt: text.fetchedAt,
    counts: text.counts,
    chunked,
    chapters: stubs,
  };
  const manifestJson = JSON.stringify(manifest);
  await fs.writeFile(fullPath, manifestJson, 'utf8');
  // eslint-disable-next-line no-console
  console.log(
    `• ${slug.padEnd(18)} ${chunked ? 'split' : 'tiny '} · manifest ${(manifestJson.length / 1024).toFixed(1)} KB · ${text.chapters.length} chapters`,
  );
}

async function main(): Promise<void> {
  const files = await fs.readdir(BHASHYA_DIR);
  for (const f of files) await processOne(f);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
