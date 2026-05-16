/**
 * Reduce the bundled lexicons to only what the corpus actually needs.
 *
 * The full Cologne dumps converted by `build-dict.ts` total ~72 MB.
 * Most of that is never referenced — Vāchaspatyam alone has ~49 k
 * entries but the entire 13-text Prasthāna-trayī corpus only references
 * a small fraction of them. This script:
 *
 *   1. Walks every Devanāgarī token in every bhāṣya.
 *   2. For each token, gathers candidate head-words it might resolve to
 *      via direct match, inflection-stripping, sandhi-revert, and
 *      multi-depth compound splitting.
 *   3. Unions all candidates → the "needed heads" set.
 *   4. Filters each `public/data/dict/<id>.json` in place, keeping only
 *      entries whose head is in the needed set.
 *   5. Writes a tiny `public/data/dict/heads.json` containing every
 *      head from the original full dumps so the compound splitter still
 *      has a complete oracle for known-lemma scoring (the splitter only
 *      needs to know whether a string is a head, not its definition).
 *
 * After running this, the in-app bundle drops from ~72 MB to roughly
 * 10–15 MB while every word actually used in the corpus retains its
 * full entry from every dictionary that has one.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { aksharas } from '../src/lib/sandhi/aksharas';
import { proposeAt } from '../src/lib/sandhi/rules';
import { proposeLemmas } from '../src/lib/sandhi/inflect';
import type {
  BhashyaChapterChunk,
  BhashyaManifest,
} from '../src/types';
import { BULK_DICT_ORDER, type BulkDictId } from '../src/lib/bulk-dictionary';

const BHASHYA_DIR = path.join(process.cwd(), 'public', 'data', 'bhashya');
const DICT_DIR = path.join(process.cwd(), 'public', 'data', 'dict');
const TOKEN_RE = /[ऀ-ॣॲ-ॿ]+/g;

async function loadDict(id: BulkDictId): Promise<Record<string, unknown>> {
  try {
    const txt = await fs.readFile(path.join(DICT_DIR, `${id}.json`), 'utf8');
    return JSON.parse(txt) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Recursive split: try every akṣara boundary, gather candidate heads at depth ≤ d. */
function splitParts(
  word: string,
  isLemma: (s: string) => boolean,
  depth: number,
  out: Set<string>,
): void {
  if (depth <= 0 || word.length < 4) return;
  const ak = aksharas(word);
  if (ak.length < 2) return;
  for (let i = 1; i < ak.length; i++) {
    for (const cand of proposeAt(ak, i)) {
      if (cand.left.length < 1 || cand.right.length < 2) continue;
      if (isLemma(cand.left)) {
        out.add(cand.left);
        if (isLemma(cand.right)) out.add(cand.right);
        else splitParts(cand.right, isLemma, depth - 1, out);
      } else if (isLemma(cand.right)) {
        out.add(cand.right);
        splitParts(cand.left, isLemma, depth - 1, out);
      }
    }
  }
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  // Load every full dict once; the union of all keys is the splitter's
  // global lemma oracle while we discover what the corpus needs.
  const full: Record<BulkDictId, Record<string, unknown>> = {
    mw: {},
    apte: {},
    vachaspatyam: {},
    shabdakalpadruma: {},
  };
  const allHeads = new Set<string>();
  for (const id of BULK_DICT_ORDER) {
    full[id] = await loadDict(id);
    for (const k of Object.keys(full[id])) allHeads.add(k);
  }
  // eslint-disable-next-line no-console
  console.log(`Loaded ${allHeads.size.toLocaleString()} unique heads across all dicts`);

  const isLemma = (s: string): boolean => allHeads.has(s);

  // Walk corpus (manifest + chunks), gather needed heads.
  const needed = new Set<string>();
  const files = (await fs.readdir(BHASHYA_DIR)).filter((f) => f.endsWith('.json'));
  let tokenCount = 0;
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
        const corpus = [u.root, ...u.blocks.map((b) => b.text)].filter(Boolean).join(' ');
        const matches = corpus.match(TOKEN_RE) ?? [];
        for (const tok of matches) {
          tokenCount += 1;
          needed.add(tok);
          for (const lc of proposeLemmas(tok)) needed.add(lc.lemma);
          splitParts(tok, isLemma, 3, needed);
        }
      }
    }
  }
  // eslint-disable-next-line no-console
  console.log(
    `Walked ${tokenCount.toLocaleString()} tokens; needed-heads set: ${needed.size.toLocaleString()}`,
  );

  // Filter each dict in place.
  for (const id of BULK_DICT_ORDER) {
    const orig = full[id];
    const filtered: Record<string, unknown> = {};
    let kept = 0;
    for (const [head, entry] of Object.entries(orig)) {
      if (needed.has(head)) {
        filtered[head] = entry;
        kept += 1;
      }
    }
    const json = JSON.stringify(filtered);
    await fs.writeFile(path.join(DICT_DIR, `${id}.json`), json, 'utf8');
    // eslint-disable-next-line no-console
    console.log(
      `• ${id.padEnd(18)} kept ${kept.toLocaleString()}/${Object.keys(orig).length.toLocaleString()} entries · ${(json.length / 1024 / 1024).toFixed(1)} MB`,
    );
  }

  // Persist the global head set as a flat array for the splitter oracle.
  const headsList = [...allHeads];
  const headsJson = JSON.stringify(headsList);
  await fs.writeFile(path.join(DICT_DIR, 'heads.json'), headsJson, 'utf8');
  // eslint-disable-next-line no-console
  console.log(
    `• heads.json (oracle)  ${headsList.length.toLocaleString()} heads · ${(headsJson.length / 1024 / 1024).toFixed(1)} MB`,
  );

  // eslint-disable-next-line no-console
  console.log(`Done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
