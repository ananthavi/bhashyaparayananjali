/**
 * Scrape the 13 Prasthanatrayi-bhashya pages from advaitasharada.sringeri.net
 * and write normalized JSON to public/data/bhashya/<slug>.json. Also writes
 * public/data/index.json as a catalog manifest.
 *
 * Usage:
 *   npm run scrape                # all 13 texts
 *   npm run scrape -- --only isha,mandukya
 *   npm run scrape -- --no-cache  # bypass disk cache
 *
 * The scraper is respectful: one request every ~2s, retries with backoff, and
 * caches responses under scripts/.cache/.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchAllBhashyaPages } from './fetch-page';
import { parseBhashyaHtml } from './parse-bhashya';
import { BHASHYA_CATALOG, SOURCE_ATTRIBUTION } from '../src/data/texts';
import type { Catalog, CatalogEntry } from '../src/types';

const OUT_DIR = path.join(process.cwd(), 'public', 'data');
const BHASHYA_DIR = path.join(OUT_DIR, 'bhashya');

function sourceUrlFor(code: string): string {
  return `https://advaitasharada.sringeri.net/display/bhashya/${code}/devanagari`;
}

function parseArgs(argv: string[]): { only: Set<string> | null; noCache: boolean } {
  let only: Set<string> | null = null;
  let noCache = false;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--only') {
      only = new Set(argv[++i]?.split(',').map((s) => s.trim()).filter(Boolean) ?? []);
    } else if (a.startsWith('--only=')) {
      only = new Set(a.slice(7).split(',').map((s) => s.trim()).filter(Boolean));
    } else if (a === '--no-cache') {
      noCache = true;
    }
  }
  return { only, noCache };
}

async function main(): Promise<void> {
  const { only, noCache } = parseArgs(process.argv);
  await fs.mkdir(BHASHYA_DIR, { recursive: true });

  const entries: CatalogEntry[] = [];

  for (const meta of BHASHYA_CATALOG) {
    if (only && !only.has(meta.slug)) continue;
    const sourceUrl = sourceUrlFor(meta.sourceCode);
    process.stdout.write(`• ${meta.slug.padEnd(18)} `);
    try {
      const html = await fetchAllBhashyaPages(meta.sourceCode, { noCache, delayMs: 2500 });
      const text = parseBhashyaHtml(html, { ...meta, sourceUrl });
      const outPath = path.join(BHASHYA_DIR, `${meta.slug}.json`);
      const json = JSON.stringify(text);
      await fs.writeFile(outPath, json, 'utf8');
      const stat = await fs.stat(outPath);
      entries.push({
        slug: meta.slug,
        titleSa: meta.titleSa,
        titleIast: meta.titleIast,
        titleEn: meta.titleEn,
        group: meta.group,
        sourceUrl,
        counts: text.counts,
        dataPath: `/data/bhashya/${meta.slug}.json`,
        sizeBytes: stat.size,
      });
      console.log(
        `ok — chapters=${text.counts.chapters}, mantras=${text.counts.mantras}, words=${text.counts.words}, size=${(stat.size / 1024).toFixed(1)}KB`,
      );
    } catch (err) {
      console.error(`FAIL — ${(err as Error).message}`);
      throw err;
    }
  }

  // Merge with existing catalog if --only was used so we don't drop unrelated entries.
  let existing: CatalogEntry[] = [];
  try {
    const prev = JSON.parse(await fs.readFile(path.join(OUT_DIR, 'index.json'), 'utf8')) as Catalog;
    existing = prev.texts ?? [];
  } catch {
    // no prior catalog — fine
  }
  const merged: CatalogEntry[] = [...existing];
  for (const e of entries) {
    const i = merged.findIndex((x) => x.slug === e.slug);
    if (i >= 0) merged[i] = e;
    else merged.push(e);
  }
  // Preserve canonical order from BHASHYA_CATALOG
  merged.sort(
    (a, b) =>
      BHASHYA_CATALOG.findIndex((x) => x.slug === a.slug) -
      BHASHYA_CATALOG.findIndex((x) => x.slug === b.slug),
  );

  const catalog: Catalog = {
    generatedAt: new Date().toISOString(),
    sourceAttribution: SOURCE_ATTRIBUTION,
    texts: merged,
  };
  await fs.writeFile(path.join(OUT_DIR, 'index.json'), JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`\nWrote catalog with ${merged.length} entries → public/data/index.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
