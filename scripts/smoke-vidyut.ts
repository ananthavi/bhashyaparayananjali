/**
 * Vidyut WASM end-to-end smoke test.
 *
 * Loads the freshly-built panini-wasm bundle from
 * public/data/panini/, calls the real Pāṇinian engine, and
 * asserts a handful of canonical derivations. Run after every
 * `wasm-pack build` to confirm the engine still works:
 *
 *   npm run smoke:vidyut
 *
 * Failure modes:
 *   - public/data/panini/ missing → run `wasm-pack build` first.
 *   - Wrong API shape (vidyut crate bumped, types changed) →
 *     update src/lib/panini/vidyut-wasm-engine.ts to match.
 *   - Surface form not derivable → engine regression OR our
 *     morphology spec is wrong; cross-check with vidyullekha.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WASM_DIR = path.join(ROOT, 'public', 'data', 'panini');

interface Mod {
  default: (path: { module_or_path?: ArrayBufferLike } | string) => Promise<unknown>;
  paniniName: () => string;
  paniniVersion: () => string;
  paniniAvailable: () => boolean;
  paniniInflect: (lemma: string, morphJson: string) => Array<{ text: string; steps: Array<{ source: string; code: string; result: string }> }>;
  paniniVerify: (surface: string, lemma: string, morphJson: string) => { matched: boolean; surface?: string; sutras: string[] };
  paniniTransliterate: (text: string, from: string, to: string) => string;
}

async function main(): Promise<void> {
  const jsPath = path.join(WASM_DIR, 'panini_wasm.js');
  const wasmPath = path.join(WASM_DIR, 'panini_wasm_bg.wasm');
  await fs.access(jsPath);
  await fs.access(wasmPath);

  const mod = (await import(pathToFileURL(jsPath).href)) as Mod;
  const wasmBytes = await fs.readFile(wasmPath);
  await mod.default({ module_or_path: wasmBytes.buffer.slice(wasmBytes.byteOffset, wasmBytes.byteOffset + wasmBytes.byteLength) as ArrayBuffer });

  console.log(`engine: ${mod.paniniName()}@${mod.paniniVersion()}  available=${mod.paniniAvailable()}`);

  const checks: Array<{ name: string; ok: boolean; detail: string }> = [];

  // 1. Lipi: देव → SLP1 "deva"
  {
    const slp1 = mod.paniniTransliterate('देव', 'devanagari', 'slp1');
    checks.push({
      name: 'transliterate devanagari→slp1',
      ok: slp1 === 'deva',
      detail: `देव → ${JSON.stringify(slp1)} (expected "deva")`,
    });
  }

  // 2. Subanta: देव in nom. sg. → "devaH"
  {
    const morph = JSON.stringify({ vibhakti: 1, vacana: 'eka', linga: 'm' });
    const out = mod.paniniInflect('देव', morph);
    const surfaces = out.map((d) => d.text);
    checks.push({
      name: 'subanta deva nom.sg.m → देवः',
      ok: surfaces.includes('देवः'),
      detail: `derived ${JSON.stringify(surfaces)} (sutra trace length: ${out[0]?.steps.length ?? 0})`,
    });
  }

  // 3. Subanta: देव gen.sg. → "devasya" / देवस्य
  {
    const morph = JSON.stringify({ vibhakti: 6, vacana: 'eka', linga: 'm' });
    const out = mod.paniniInflect('देव', morph);
    const surfaces = out.map((d) => d.text);
    checks.push({
      name: 'subanta देव gen.sg → देवस्य',
      ok: surfaces.includes('देवस्य'),
      detail: `derived ${JSON.stringify(surfaces)}`,
    });
  }

  // 4. Tinanta: BhU lat. 3-sg → bhavati / भवति
  {
    const morph = JSON.stringify({ lakara: 'lat', purusha: 3, vacana: 'eka', gana: 1 });
    const out = mod.paniniInflect('BU', morph);
    const surfaces = out.map((d) => d.text);
    checks.push({
      name: 'tinanta BU lat 3sg → भवति',
      ok: surfaces.includes('भवति'),
      detail: `derived ${JSON.stringify(surfaces)}`,
    });
  }

  // 5. Verify: देवस्य as gen.sg.m of देव
  {
    const morph = JSON.stringify({ vibhakti: 6, vacana: 'eka', linga: 'm' });
    const v = mod.paniniVerify('देवस्य', 'देव', morph);
    checks.push({
      name: 'verify देवस्य as देव gen.sg.m',
      ok: v.matched && v.sutras.length > 0,
      detail: `matched=${v.matched}, sutras=${v.sutras.slice(0, 5).join('·')}${v.sutras.length > 5 ? '…' : ''}`,
    });
  }

  let allOk = true;
  for (const c of checks) {
    const mark = c.ok ? '✓' : '✗';
    console.log(`${mark} ${c.name}`);
    console.log(`    ${c.detail}`);
    if (!c.ok) allOk = false;
  }
  if (!allOk) {
    console.error('\nFAILED');
    process.exit(1);
  }
  console.log('\nAll Vidyut smoke checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
