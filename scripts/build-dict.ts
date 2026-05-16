/**
 * Convert Cologne `csl-orig` dictionary dumps into compact JSON for the
 * app's bulk-dictionary loader.
 *
 * Sources (all public domain by age):
 *   - mw    Monier-Williams Sanskrit-English (1899)
 *   - ap90  Apte Practical Sanskrit-English (1890)
 *   - vcp   Vāchaspatyam Sanskrit-Sanskrit (1873-84)
 *   - skd   Śabdakalpadruma Sanskrit-Sanskrit (1828-58)
 *
 * Pipeline:
 *   raw `<L>…<LEND>` block
 *     → headword from `<k1>…` (SLP1) → Devanāgarī via sanscript
 *     → body extracted, Cologne XML/marker tags stripped
 *     → `<s>SLP1</s>` and `{#SLP1#}` chunks transliterated to Devanāgarī
 *     → for VCP/SKD whose entire body is SLP1, the full body is transliterated
 *     → truncated to a hard byte budget so the bundled APK stays manageable
 *
 * Output:
 *   public/data/dict/{mw,apte,vcp,skd}.json
 *   shape: { "<devanāgarī head>": { iast, en, src } }
 *
 * The script is idempotent: the cached raw dumps under
 * `scripts/.cache/dict/` are reused across runs unless --no-cache.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import sanscriptImport from '@indic-transliteration/sanscript';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Sanscript: { t: (text: string, from: string, to: string) => string } =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (sanscriptImport as any).default ?? (sanscriptImport as any);

const CACHE_DIR = path.join(process.cwd(), 'scripts', '.cache', 'dict');
const OUT_DIR = path.join(process.cwd(), 'public', 'data', 'dict');

interface DictSpec {
  source: 'mw' | 'ap90' | 'vcp' | 'skd';
  outName: 'mw' | 'apte' | 'vachaspatyam' | 'shabdakalpadruma';
  url: string;
  /** Body language: english (with embedded SLP1 chunks) or sanskrit (SLP1 throughout). */
  bodyLang: 'english' | 'sanskrit';
  /** Hard truncation limit for body, in chars. */
  bodyChars: number;
  /** Friendly label used in the popover. */
  label: string;
}

const SPECS: DictSpec[] = [
  {
    source: 'mw',
    outName: 'mw',
    url: 'https://raw.githubusercontent.com/sanskrit-lexicon/csl-orig/master/v02/mw/mw.txt',
    bodyLang: 'english',
    bodyChars: 800,
    label: 'Monier-Williams',
  },
  {
    source: 'ap90',
    outName: 'apte',
    url: 'https://raw.githubusercontent.com/sanskrit-lexicon/csl-orig/master/v02/ap90/ap90.txt',
    bodyLang: 'english',
    bodyChars: 800,
    label: 'Apte',
  },
  {
    source: 'vcp',
    outName: 'vachaspatyam',
    url: 'https://raw.githubusercontent.com/sanskrit-lexicon/csl-orig/master/v02/vcp/vcp.txt',
    bodyLang: 'sanskrit',
    bodyChars: 600,
    label: 'Vāchaspatyam',
  },
  {
    source: 'skd',
    outName: 'shabdakalpadruma',
    url: 'https://raw.githubusercontent.com/sanskrit-lexicon/csl-orig/master/v02/skd/skd.txt',
    bodyLang: 'sanskrit',
    bodyChars: 600,
    label: 'Śabdakalpadruma',
  },
];

async function ensureRaw(spec: DictSpec, noCache: boolean): Promise<string> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const local = path.join(CACHE_DIR, `${spec.source}.txt`);
  if (!noCache) {
    try {
      const stat = await fs.stat(local);
      if (stat.size > 0) return await fs.readFile(local, 'utf8');
    } catch {
      // not cached
    }
  }
  // eslint-disable-next-line no-console
  console.log(`fetching ${spec.source}…`);
  const resp = await fetch(spec.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${spec.url}`);
  const text = await resp.text();
  await fs.writeFile(local, text, 'utf8');
  return text;
}

function slp1ToDev(s: string): string {
  if (!s) return '';
  try {
    return Sanscript.t(s, 'slp1', 'devanagari');
  } catch {
    return s;
  }
}

function slp1ToIast(s: string): string {
  if (!s) return '';
  try {
    return Sanscript.t(s, 'slp1', 'iast');
  } catch {
    return s;
  }
}

/**
 * Strip Cologne CSL pseudo-XML tags. Convert `<s>SLP1</s>` and `{#SLP1#}`
 * to Devanāgarī. Drops `<lex>`, `<ab>`, `<ls>`, `<info/>`, `<lbinfo/>`,
 * `<lang>`, `<gk>` (Greek), `<i>`, etc.
 */
function cleanEnglishBody(raw: string): string {
  let s = raw;
  // Inline Sanskrit chunks (s-tag and {#…#}) → Devanāgarī
  s = s.replace(/<s1?>([^<]*)<\/s1?>/g, (_m, slp) => slp1ToDev(slp));
  s = s.replace(/\{#([^#]+)#\}/g, (_m, slp) => slp1ToDev(slp));
  // Drop <s2>, <s3>, <gk>… opens too
  s = s.replace(/<\/?(s[0-9]?|gk|i|b|sup|sub|info|lbinfo|lang|etym)[^>]*>/g, '');
  // Drop the content of <H…>…</H…> wrapper attributes if any
  s = s.replace(/<\/?(H[0-9]+[A-Z]?|head|body|tail|hom|key1|key2|e|ls|lex|ab|pc|L)[^>]*>/g, '');
  // Specific markers
  s = s.replace(/<\/?LEND>/g, '').replace(/<\/?ENT>/g, '');
  // Numeric homonym markers
  s = s.replace(/<hom>[^<]*<\/hom>/g, '');
  // Drop the leading "¦" used in the source
  s = s.replace(/¦/g, ' ');
  // Collapse whitespace and trim
  return s.replace(/\s+/g, ' ').trim();
}

function cleanSanskritBody(raw: string): string {
  // VCP/SKD: the body is entirely SLP1 (with citation refs, danda etc.).
  // First strip XML-y tags, then transliterate the whole thing to Devanāgarī.
  let s = raw
    .replace(/<\/?(L|LEND|pc|k1|k2|h|e|hom|head|body|tail|info|lbinfo)[^>]*>/g, '')
    .replace(/¦/g, ' ');
  // Try to transliterate the whole body. SLP1's letter set is a-zA-Z@0-9 plus a few
  // marks; sanscript will leave non-SLP1 bytes mostly intact.
  s = slp1ToDev(s);
  return s.replace(/\s+/g, ' ').trim();
}

function extractEntries(spec: DictSpec, raw: string): Record<string, { iast?: string; en?: string; src: string }> {
  const out: Record<string, { iast?: string; en?: string; src: string }> = {};
  // Each entry block: from `<L>` line through `<LEND>`. Bodies span multiple lines.
  // Simpler: split on `<L>` and process blocks.
  const blocks = raw.split(/^<L>/m).slice(1);
  for (const block of blocks) {
    const headerEnd = block.indexOf('\n');
    if (headerEnd === -1) continue;
    const header = block.slice(0, headerEnd);
    const body = block.slice(headerEnd + 1);
    const k1 = header.match(/<k1>([^<\n]+)/);
    if (!k1) continue;
    const slp1Head = k1[1].trim();
    if (!slp1Head) continue;
    const dev = slp1ToDev(slp1Head);
    const iast = slp1ToIast(slp1Head);
    if (!dev) continue;

    // Trim the body at <LEND>
    const lendIdx = body.indexOf('<LEND>');
    const rawBody = lendIdx >= 0 ? body.slice(0, lendIdx) : body;
    let cleaned =
      spec.bodyLang === 'sanskrit' ? cleanSanskritBody(rawBody) : cleanEnglishBody(rawBody);
    // Drop the headword echo at the start of the body if present.
    cleaned = cleaned.replace(new RegExp('^' + escapeRe(dev) + '\\s*'), '');
    if (cleaned.length > spec.bodyChars) {
      cleaned = cleaned.slice(0, spec.bodyChars).trimEnd() + '…';
    }
    if (!cleaned) continue;

    // Many MW entries are "1.a" continuation of the prior; we still keep them
    // but only if the cleaned body is non-trivial.
    if (out[dev]) {
      // Append additional senses with a separator if first entry was short.
      if (out[dev].en && out[dev].en.length < spec.bodyChars - 30) {
        out[dev].en = (out[dev].en + ' · ' + cleaned).slice(0, spec.bodyChars * 1.5) + '…';
      }
      continue;
    }
    out[dev] = { iast, en: cleaned, src: spec.outName };
  }
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main(): Promise<void> {
  const noCache = process.argv.includes('--no-cache');
  const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');
  await fs.mkdir(OUT_DIR, { recursive: true });

  for (const spec of SPECS) {
    if (only && !only.includes(spec.source) && !only.includes(spec.outName)) continue;
    const raw = await ensureRaw(spec, noCache);
    process.stdout.write(`• ${spec.outName.padEnd(18)} `);
    const entries = extractEntries(spec, raw);
    const json = JSON.stringify(entries);
    const outPath = path.join(OUT_DIR, `${spec.outName}.json`);
    await fs.writeFile(outPath, json, 'utf8');
    const stat = await fs.stat(outPath);
    console.log(
      `${Object.keys(entries).length.toString().padStart(7)} entries · ${(stat.size / 1024 / 1024).toFixed(1)} MB`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
