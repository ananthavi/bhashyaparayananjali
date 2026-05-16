/**
 * Translation-batch preparation.
 *
 * Walks every unit in a text and produces a sequence of batch files
 * under `tmp/translate-batches/<slug>/batch-<n>.json`. Each batch
 * holds at most BATCH_UNITS units. A parallel translation agent
 * reads one batch file, returns a same-shaped JSON of translations,
 * and the ingester (`ingest-agent-translations.ts`) folds the result
 * into `data-source/meanings/<slug>/`.
 *
 * Usage:
 *   npm run translate:prepare -- --slug isha
 *   npm run translate:prepare -- --slug all
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import type { BhashyaChapterChunk, BhashyaManifest } from '../src/types';

const BHASHYA_DIR = path.join(process.cwd(), 'public', 'data', 'bhashya');
const TMP = path.join(process.cwd(), 'tmp', 'translate-batches');

/** Units per batch. Tuned so each agent prompt stays under ~30K tokens. */
const BATCH_UNITS = 8;
/** Cap each block's text to this many chars to keep prompts manageable. */
const BLOCK_CHAR_CAP = 2400;

interface BatchUnit {
  id: string;
  kind: string;
  ordinal: number;
  root: string;
  blocks: Array<{ kind: string; text: string; truncated?: boolean }>;
  reference: string;
}

interface BatchFile {
  slug: string;
  batchIndex: number;
  totalBatches: number;
  units: BatchUnit[];
}

async function loadManifest(slug: string): Promise<BhashyaManifest> {
  return JSON.parse(
    await fs.readFile(path.join(BHASHYA_DIR, `${slug}.json`), 'utf8'),
  ) as BhashyaManifest;
}

async function loadChunk(slug: string, chId: string): Promise<BhashyaChapterChunk | null> {
  try {
    return JSON.parse(
      await fs.readFile(path.join(BHASHYA_DIR, slug, `${chId}.json`), 'utf8'),
    ) as BhashyaChapterChunk;
  } catch {
    return null;
  }
}

function refFor(manifest: BhashyaManifest, unitId: string): string {
  for (const ch of manifest.chapters ?? []) {
    if (!unitId.startsWith(ch.id)) continue;
    const tail = unitId.slice(ch.id.length).replace(/^_/, '');
    return `${manifest.titleSa} · ${ch.titleSa ?? ch.id} · ${tail || ''}`.trim();
  }
  return unitId;
}

async function prepareSlug(slug: string): Promise<void> {
  const manifest = await loadManifest(slug);
  const allUnits: BatchUnit[] = [];

  for (const stub of manifest.chapters ?? []) {
    const chunk = await loadChunk(slug, stub.id);
    if (!chunk) continue;
    for (const u of chunk.chapter.units) {
      const blocks = u.blocks
        .filter((b) => b.text && b.text.trim().length > 0)
        .map((b) => {
          const t = b.text.trim();
          if (t.length > BLOCK_CHAR_CAP) {
            return { kind: b.kind, text: t.slice(0, BLOCK_CHAR_CAP), truncated: true };
          }
          return { kind: b.kind, text: t };
        });
      if (!u.root && blocks.length === 0) continue;
      allUnits.push({
        id: u.id,
        kind: u.kind,
        ordinal: u.ordinal,
        root: u.root ?? '',
        blocks,
        reference: refFor(manifest, u.id),
      });
    }
  }

  const totalBatches = Math.ceil(allUnits.length / BATCH_UNITS);
  const outDir = path.join(TMP, slug);
  await fs.mkdir(outDir, { recursive: true });
  for (const f of await fs.readdir(outDir).catch(() => [])) {
    if (f.startsWith('batch-')) await fs.rm(path.join(outDir, f));
  }

  for (let i = 0; i < totalBatches; i++) {
    const start = i * BATCH_UNITS;
    const slice = allUnits.slice(start, start + BATCH_UNITS);
    const batch: BatchFile = {
      slug,
      batchIndex: i,
      totalBatches,
      units: slice,
    };
    const out = path.join(outDir, `batch-${String(i).padStart(3, '0')}.json`);
    await fs.writeFile(out, JSON.stringify(batch, null, 2), 'utf8');
  }

  // eslint-disable-next-line no-console
  console.log(
    `${slug.padEnd(20)} ${String(allUnits.length).padStart(5)} units → ${String(totalBatches).padStart(4)} batches`,
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const slugIdx = args.indexOf('--slug');
  const slug = slugIdx >= 0 ? args[slugIdx + 1] : 'all';

  await fs.mkdir(TMP, { recursive: true });
  if (slug === 'all') {
    const files = (await fs.readdir(BHASHYA_DIR)).filter((f) => f.endsWith('.json'));
    for (const f of files) {
      await prepareSlug(f.replace(/\.json$/, ''));
    }
  } else {
    await prepareSlug(slug);
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
