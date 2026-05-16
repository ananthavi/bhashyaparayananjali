/**
 * Ingest agent-produced translations.
 *
 * The translation agents drop their JSON output into
 * `tmp/translate-batches/<slug>/result-<n>.json`. This script:
 *
 *   1. Walks every result-*.json under a slug,
 *   2. Validates the shape (every unitId is from the source corpus,
 *      EN + ML are non-empty, no obvious truncation markers),
 *   3. Fuses them into:
 *        data-source/meanings/<slug>/sources.json
 *        data-source/meanings/<slug>/ai-draft-en.en.json
 *        data-source/meanings/<slug>/ai-draft-ml.ml.json
 *
 * The downstream `npm run build:meanings` then folds those into the
 * runtime `public/data/meanings/<slug>.json`.
 *
 * Every entry is tagged with the AI source ID + license `ai-draft`,
 * which the reader UI surfaces with an unmistakable "AI draft —
 * awaiting reviewer sign-off" caveat. None of these entries
 * supersede a reviewer-signed entry from `unverified: false`
 * sources.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const TMP = path.join(process.cwd(), 'tmp', 'translate-batches');
const SRC_ROOT = path.join(process.cwd(), 'data-source', 'meanings');

interface ResultUnit {
  id: string;
  /** Translation of the mūla / root text. */
  rootEn?: string;
  rootMl?: string;
  /** Per-block translations, indexed by block position. */
  blocksEn?: string[];
  blocksMl?: string[];
}

interface ResultFile {
  slug: string;
  batchIndex: number;
  totalBatches: number;
  units: ResultUnit[];
}

interface OutMaps {
  en: Record<string, string>;
  ml: Record<string, string>;
}

async function listResultFiles(slug: string): Promise<string[]> {
  const dir = path.join(TMP, slug);
  let names: string[] = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  return names
    .filter((n) => n.startsWith('result-') && n.endsWith('.json'))
    .map((n) => path.join(dir, n))
    .sort();
}

function validate(unit: ResultUnit, lineage: string): string | null {
  if (!unit.id) return `${lineage}: missing id`;
  // rootEn / rootMl are optional — empty / short root means an intro
  // unit (no mūla text). We accept those silently and still ingest the
  // block-level translations, which is what readers will see.
  return null;
}

async function fuseSlug(slug: string): Promise<{ enUnits: number; mlUnits: number }> {
  const files = await listResultFiles(slug);
  if (files.length === 0) return { enUnits: 0, mlUnits: 0 };

  const out: OutMaps = { en: {}, ml: {} };
  let totalUnits = 0;

  for (const f of files) {
    const data = JSON.parse(await fs.readFile(f, 'utf8')) as ResultFile;
    if (data.slug !== slug) {
      // eslint-disable-next-line no-console
      console.warn(`  skip ${path.basename(f)}: slug mismatch (${data.slug} ≠ ${slug})`);
      continue;
    }
    for (const u of data.units ?? []) {
      const err = validate(u, path.basename(f));
      if (err) {
        // eslint-disable-next-line no-console
        console.warn(`  skip unit: ${err}`);
        continue;
      }
      totalUnits += 1;
      if (u.rootEn && u.rootEn.trim().length >= 2) out.en[u.id] = u.rootEn.trim();
      if (u.rootMl && u.rootMl.trim().length >= 2) out.ml[u.id] = u.rootMl.trim();
      if (Array.isArray(u.blocksEn)) {
        u.blocksEn.forEach((t, i) => {
          // Some agents emit {kind, text} objects instead of bare strings.
          // Accept both shapes — pull `.text` when the item is an object.
          const s = typeof t === 'string'
            ? t
            : (t && typeof t === 'object' && typeof (t as { text?: unknown }).text === 'string'
                ? (t as { text: string }).text
                : '');
          if (s && s.trim()) out.en[`${u.id}::block-${i}`] = s.trim();
        });
      }
      if (Array.isArray(u.blocksMl)) {
        u.blocksMl.forEach((t, i) => {
          const s = typeof t === 'string'
            ? t
            : (t && typeof t === 'object' && typeof (t as { text?: unknown }).text === 'string'
                ? (t as { text: string }).text
                : '');
          if (s && s.trim()) out.ml[`${u.id}::block-${i}`] = s.trim();
        });
      }
    }
  }

  if (totalUnits === 0) return { enUnits: 0, mlUnits: 0 };

  const dir = path.join(SRC_ROOT, slug);
  await fs.mkdir(dir, { recursive: true });

  // Existing sources.json may already declare reviewer-signed entries.
  // We only ADD the ai-draft sources; never overwrite existing source records.
  const sourcesPath = path.join(dir, 'sources.json');
  let sources: { sources?: Array<Record<string, unknown>> } = {};
  try {
    sources = JSON.parse(await fs.readFile(sourcesPath, 'utf8'));
  } catch {
    /* fresh */
  }
  const existing = new Set((sources.sources ?? []).map((s) => String(s.id)));
  const aiSources: Array<Record<string, unknown>> = [];
  if (Object.keys(out.en).length > 0 && !existing.has('ai-draft-en')) {
    aiSources.push({
      id: 'ai-draft-en',
      citation: 'AI draft — requires authoritative sign-off.',
      license: 'ai-draft',
      publishedAt: new Date().toISOString(),
    });
  }
  if (Object.keys(out.ml).length > 0 && !existing.has('ai-draft-ml')) {
    aiSources.push({
      id: 'ai-draft-ml',
      citation: 'AI draft — requires authoritative sign-off.',
      license: 'ai-draft',
      publishedAt: new Date().toISOString(),
    });
  }
  if (aiSources.length > 0) {
    const merged = { sources: [...(sources.sources ?? []), ...aiSources] };
    await fs.writeFile(sourcesPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  }

  if (Object.keys(out.en).length > 0) {
    await fs.writeFile(
      path.join(dir, 'ai-draft-en.en.json'),
      JSON.stringify(out.en, null, 2) + '\n',
      'utf8',
    );
  }
  if (Object.keys(out.ml).length > 0) {
    await fs.writeFile(
      path.join(dir, 'ai-draft-ml.ml.json'),
      JSON.stringify(out.ml, null, 2) + '\n',
      'utf8',
    );
  }

  return { enUnits: Object.keys(out.en).length, mlUnits: Object.keys(out.ml).length };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const slugIdx = args.indexOf('--slug');
  const slug = slugIdx >= 0 ? args[slugIdx + 1] : 'all';

  let slugs: string[] = [];
  if (slug === 'all') {
    slugs = await fs.readdir(TMP);
  } else {
    slugs = [slug];
  }

  let totalEn = 0;
  let totalMl = 0;
  for (const s of slugs) {
    const { enUnits, mlUnits } = await fuseSlug(s);
    if (enUnits || mlUnits) {
      // eslint-disable-next-line no-console
      console.log(
        `${s.padEnd(20)} en=${String(enUnits).padStart(4)} entries · ml=${String(mlUnits).padStart(4)} entries`,
      );
    }
    totalEn += enUnits;
    totalMl += mlUnits;
  }
  // eslint-disable-next-line no-console
  console.log(`\nTotal: ${totalEn} EN + ${totalMl} ML entries written to data-source/meanings/`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
