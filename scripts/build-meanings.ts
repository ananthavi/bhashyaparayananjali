/**
 * Meanings ingestion + per-text JSON builder.
 *
 * Reads source translation files from `data-source/meanings/` and
 * emits the runtime-ready per-text JSON under `public/data/meanings/`.
 *
 * Source layout (one of):
 *
 *   data-source/meanings/<text-slug>/<sourceId>.<en|ml>.tsv
 *     Tab-separated: unitId\ttext  — one entry per row.
 *     The translator's name + license come from
 *     data-source/meanings/<text-slug>/sources.json.
 *
 *   data-source/meanings/<text-slug>/<sourceId>.<en|ml>.json
 *     { "<unitId>": "<text>", ... }
 *
 *   data-source/meanings/<text-slug>/sources.json
 *     { "sources": [ { id, citation, license, publishedAt?, isPrimary? }, ... ] }
 *
 * The ingestion is non-destructive: missing texts are silently
 * skipped, missing keys are dropped from the output. CI re-runs
 * `npm run build:meanings` after pulling new source files.
 *
 * For demonstration when a text has no source yet, the script
 * synthesises a "bhāṣya-prose" fallback entry from the first prose
 * block of each unit — this lets the UI show *something* useful
 * before real translation files arrive. Mark this in the source
 * registry as `id: "bhashya-prose-derived"` and `license: "fair-use"`.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  MeaningEntry,
  MeaningSource,
  MeaningUnit,
  MeaningsFile,
} from '../src/types-meanings';
import type { BhashyaChapterChunk, BhashyaManifest } from '../src/types';

const SRC_ROOT = path.join(process.cwd(), 'data-source', 'meanings');
const BHASHYA_DIR = path.join(process.cwd(), 'public', 'data', 'bhashya');
const OUT_DIR = path.join(process.cwd(), 'public', 'data', 'meanings');

const FALLBACK_SOURCE: MeaningSource = {
  id: 'bhashya-prose-derived',
  citation:
    "Auto-derived from Śaṅkara's bhāṣya prose (placeholder until a translation file is ingested).",
  license: 'fair-use',
};

async function listTextSlugs(): Promise<string[]> {
  const files = await fs.readdir(BHASHYA_DIR);
  return files.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readSources(slug: string): Promise<MeaningSource[]> {
  const p = path.join(SRC_ROOT, slug, 'sources.json');
  if (!(await fileExists(p))) return [];
  const raw = JSON.parse(await fs.readFile(p, 'utf8')) as { sources?: MeaningSource[] };
  return raw.sources ?? [];
}

async function readEntriesForSource(
  slug: string,
  sourceId: string,
  language: 'en' | 'ml',
): Promise<Record<string, string>> {
  const json = path.join(SRC_ROOT, slug, `${sourceId}.${language}.json`);
  if (await fileExists(json)) {
    return JSON.parse(await fs.readFile(json, 'utf8')) as Record<string, string>;
  }
  const tsv = path.join(SRC_ROOT, slug, `${sourceId}.${language}.tsv`);
  if (await fileExists(tsv)) {
    const out: Record<string, string> = {};
    const txt = await fs.readFile(tsv, 'utf8');
    for (const raw of txt.split(/\r?\n/)) {
      const line = raw.trimEnd();
      if (!line || line.startsWith('#')) continue;
      const tab = line.indexOf('\t');
      if (tab < 0) continue;
      const k = line.slice(0, tab).trim();
      const v = line.slice(tab + 1).trim();
      if (k && v) out[k] = v;
    }
    return out;
  }
  return {};
}

async function loadManifest(slug: string): Promise<BhashyaManifest> {
  return JSON.parse(
    await fs.readFile(path.join(BHASHYA_DIR, `${slug}.json`), 'utf8'),
  ) as BhashyaManifest;
}

async function loadChunk(slug: string, chId: string): Promise<BhashyaChapterChunk | null> {
  const p = path.join(BHASHYA_DIR, slug, `${chId}.json`);
  try {
    return JSON.parse(await fs.readFile(p, 'utf8')) as BhashyaChapterChunk;
  } catch {
    return null;
  }
}

async function buildOne(slug: string): Promise<MeaningsFile | null> {
  const manifest = await loadManifest(slug);
  const sources = await readSources(slug);
  const realEntries = new Map<string, MeaningEntry[]>();

  for (const src of sources) {
    for (const lang of ['en', 'ml'] as const) {
      const map = await readEntriesForSource(slug, src.id, lang);
      for (const [k, text] of Object.entries(map)) {
        if (!realEntries.has(k)) realEntries.set(k, []);
        realEntries.get(k)!.push({ language: lang, text, sourceId: src.id });
      }
    }
  }

  // Fallback: if no entry exists for a unit, synthesise a stub from
  // the first non-empty bhāṣya block. The UI shows it with a clear
  // "auto-derived" label so readers know to expect more.
  const usedFallback = new Set<string>();
  for (const stub of manifest.chapters ?? []) {
    const chunk = await loadChunk(slug, stub.id);
    if (!chunk) continue;
    for (const u of chunk.chapter.units) {
      if (!realEntries.has(u.id)) {
        const firstBlock = u.blocks.find((b) => b.text && b.text.trim().length > 0);
        if (firstBlock) {
          realEntries.set(u.id, [
            {
              language: 'en',
              text:
                'A scholarly translation has not yet been ingested for this verse. ' +
                "The first lines of Śaṅkara's bhāṣya are shown below as a placeholder.\n\n" +
                firstBlock.text.slice(0, 600) +
                (firstBlock.text.length > 600 ? '…' : ''),
              sourceId: FALLBACK_SOURCE.id,
            },
          ]);
          usedFallback.add(u.id);
        }
      }
    }
  }

  const allSources = [...sources];
  if (usedFallback.size > 0) allSources.push(FALLBACK_SOURCE);

  if (realEntries.size === 0) return null;

  const units: Record<string, MeaningUnit> = {};
  for (const [k, entries] of realEntries) {
    // Sort: primary reviewer-signed source first, then other reviewer-
    // signed, then ai-draft (always last within a language), then by
    // language (en before ml).
    const primaryIds = new Set(allSources.filter((s) => s.isPrimary).map((s) => s.id));
    const aiDraftIds = new Set(allSources.filter((s) => s.license === 'ai-draft').map((s) => s.id));
    entries.sort((a, b) => {
      const aPrim = primaryIds.has(a.sourceId) ? 0 : 1;
      const bPrim = primaryIds.has(b.sourceId) ? 0 : 1;
      if (aPrim !== bPrim) return aPrim - bPrim;
      const aAi = aiDraftIds.has(a.sourceId) ? 1 : 0;
      const bAi = aiDraftIds.has(b.sourceId) ? 1 : 0;
      if (aAi !== bAi) return aAi - bAi;
      if (a.language !== b.language) return a.language === 'en' ? -1 : 1;
      return 0;
    });
    units[k] = { key: k, entries };
  }

  return {
    slug,
    generatedAt: new Date().toISOString(),
    sources: allSources,
    units,
  };
}

async function main(): Promise<void> {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const slugs = await listTextSlugs();
  let unitsWritten = 0;
  let textsWritten = 0;

  for (const slug of slugs) {
    const out = await buildOne(slug);
    if (!out) {
      // eslint-disable-next-line no-console
      console.log(`• ${slug.padEnd(20)} — no source data; skipped`);
      continue;
    }
    const json = JSON.stringify(out);
    await fs.writeFile(path.join(OUT_DIR, `${slug}.json`), json, 'utf8');
    const real = out.sources.filter((s) => s.id !== FALLBACK_SOURCE.id).length;
    const sourceTag = real > 0 ? `${real} ingested source(s)` : 'fallback only';
    // eslint-disable-next-line no-console
    console.log(
      `• ${slug.padEnd(20)} ${Object.keys(out.units).length.toString().padStart(5)} units · ${(json.length / 1024).toFixed(1)} KB · ${sourceTag}`,
    );
    unitsWritten += Object.keys(out.units).length;
    textsWritten += 1;
  }

  // eslint-disable-next-line no-console
  console.log(
    `\nWrote ${textsWritten} files / ${unitsWritten.toLocaleString()} units to ${OUT_DIR}`,
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
