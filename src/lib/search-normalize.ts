/**
 * Unified search input/index normalization.
 *
 * The corpus is stored in Devanāgarī. Users type queries in any of:
 *   • Devanāgarī            — passes through
 *   • Other Indic scripts   — transliterated to Devanāgarī
 *   • IAST (with diacritics)  — both kept and stripped
 *   • Plain ASCII / Roman   — normalized to ASCII
 *   • ITRANS / HK / SLP1    — best-effort conversion
 *
 * For every string we expose two canonical forms used by the search
 * engine and the autocomplete:
 *
 *   • `dev`   — Devanāgarī (for exact / prefix / infix matches within
 *               Devanāgarī text)
 *   • `ascii` — lowercase IAST-without-diacritics (for the user who
 *               types ‘atma’ and expects to find ‘ātma’ /
 *               ‘paramātman’ as an infix in either Roman or Devanāgarī)
 *
 * Both forms are indexed; queries are normalized to both forms and
 * the union of hits is returned. This is the foundation that lets a
 * user type ‘tma’ and hit ‘ātma’, ‘paramātman’, ‘pratyagātmā’ — the
 * old prefix-only index could not.
 */
import sanscriptImport from '@indic-transliteration/sanscript';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Sanscript: { t: (text: string, from: string, to: string) => string } =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (sanscriptImport as any).default ?? (sanscriptImport as any);

/** Devanāgarī codepoint range. */
const DEV_RE = /[ऀ-ॿ᳐-᳿]/;
/** Any non-Devanāgarī Indic script we support via Sanscript. */
const OTHER_INDIC_RE = /[ঀ-࿿]/;
/** IAST diacritics. */
const IAST_DIACRITIC_RE = /[āīūṛṝḷḹṃḥṅñṭḍṇśṣĀĪŪṚṜḶḸṂḤṄÑṬḌṆŚṢ]/;
/** ITRANS / SLP1 / HK signal characters. */
const TRANSLIT_HINT_RE = /[A-Z~^.]/;

export function isDevanagari(s: string): boolean {
  return DEV_RE.test(s);
}

export function isOtherIndic(s: string): boolean {
  return OTHER_INDIC_RE.test(s);
}

/** Strip IAST + general Latin diacritics; lowercase; collapse cluster substitutions. */
export function asciiFold(s: string): string {
  // Custom map covers the IAST set with letter mappings; NFD covers the rest.
  const SUBS: Record<string, string> = {
    ā: 'a', Ā: 'a', ī: 'i', Ī: 'i', ū: 'u', Ū: 'u',
    ṛ: 'r', Ṛ: 'r', ṝ: 'r', Ṝ: 'r', ḷ: 'l', Ḷ: 'l', ḹ: 'l', Ḹ: 'l',
    ṃ: 'm', Ṃ: 'm', ḥ: 'h', Ḥ: 'h',
    ṅ: 'n', Ṅ: 'n', ñ: 'n', Ñ: 'n',
    ṭ: 't', Ṭ: 't', ḍ: 'd', Ḍ: 'd', ṇ: 'n', Ṇ: 'n',
    ś: 's', Ś: 's', ṣ: 's', Ṣ: 's',
  };
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[āĀīĪūŪṛṚṝṜḷḶḹḸṃṂḥḤṅṄñÑṭṬḍḌṇṆśŚṣṢ]/g, (c) => SUBS[c] ?? c)
    .toLowerCase();
}

/**
 * Try to convert any input to Devanāgarī. Returns null when the input
 * doesn't look like anything Sanscript understands.
 */
function toDevanagariBest(s: string): string | null {
  if (!s) return null;
  if (isDevanagari(s)) return s;
  if (isOtherIndic(s)) {
    try { return Sanscript.t(s, detectIndicScheme(s) ?? 'devanagari', 'devanagari'); } catch { return null; }
  }
  // Latin family. Try a small ladder: IAST → ITRANS → HK → SLP1.
  for (const scheme of ['iast', 'itrans', 'hk', 'slp1'] as const) {
    try {
      const out = Sanscript.t(s, scheme, 'devanagari');
      // Reject the no-op identity (when sanscript can't make sense of it).
      if (out && out !== s && isDevanagari(out)) return out;
    } catch {
      /* try next */
    }
  }
  return null;
}

function detectIndicScheme(s: string): string | null {
  if (/[ঀ-৿]/.test(s)) return 'bengali';
  if (/[਀-੿]/.test(s)) return 'gurmukhi';
  if (/[઀-૿]/.test(s)) return 'gujarati';
  if (/[଀-୿]/.test(s)) return 'oriya';
  if (/[஀-௿]/.test(s)) return 'tamil';
  if (/[ఀ-౿]/.test(s)) return 'telugu';
  if (/[ಀ-೿]/.test(s)) return 'kannada';
  if (/[ഀ-ൿ]/.test(s)) return 'malayalam';
  if (/[඀-෿]/.test(s)) return 'sinhala';
  return null;
}

export interface NormalForm {
  /** Original input (trimmed). */
  raw: string;
  /** Canonical Devanāgarī form (empty if no plausible conversion). */
  dev: string;
  /** ASCII-folded, lowercase IAST. */
  ascii: string;
}

/**
 * Normalize any input string to canonical search keys. Indexed text and
 * runtime queries both pass through this so the two halves agree.
 *
 * For Devanāgarī text we also derive the IAST-ascii so a Roman query
 * can hit it (and vice versa: Devanāgarī-typed query also hits text
 * indexed in Roman via the dev form).
 */
export function normalize(input: string): NormalForm {
  const raw = (input ?? '').trim();
  if (!raw) return { raw: '', dev: '', ascii: '' };

  // Already Devanāgarī? Derive ASCII via Sanscript → IAST → asciiFold.
  if (isDevanagari(raw)) {
    let iast = '';
    try { iast = Sanscript.t(raw, 'devanagari', 'iast'); } catch { /* leave empty */ }
    return { raw, dev: raw, ascii: asciiFold(iast || raw) };
  }

  // Other Indic? Convert to Devanāgarī, then to ASCII.
  if (isOtherIndic(raw)) {
    const dev = toDevanagariBest(raw) ?? '';
    let iast = '';
    if (dev) {
      try { iast = Sanscript.t(dev, 'devanagari', 'iast'); } catch { /* leave empty */ }
    }
    return { raw, dev, ascii: asciiFold(iast || raw) };
  }

  // Latin family. Always compute ASCII; try to compute Dev best-effort.
  const ascii = asciiFold(raw);
  const looksTransliteration =
    IAST_DIACRITIC_RE.test(raw) || TRANSLIT_HINT_RE.test(raw);
  const dev = looksTransliteration ? (toDevanagariBest(raw) ?? '') : (toDevanagariBest(raw) ?? '');
  return { raw, dev, ascii };
}

/**
 * Tokenize a stretch of Devanāgarī / Latin text into individual
 * searchable tokens. Splits on whitespace, daṇḍa (। / ॥), punctuation,
 * and the avagraha. Tokens shorter than 2 chars are dropped.
 */
const TOKEN_SPLIT_RE = /[\s।॥,;:—–\-()[\]"'`॰ऽ.!?/]+/u;

export function tokenize(text: string): string[] {
  if (!text) return [];
  return text.split(TOKEN_SPLIT_RE).filter((t) => t.length >= 1);
}

/**
 * Build the set of index keys to add for a single token. Each token
 * is indexed under BOTH its Devanāgarī form and its ASCII-folded IAST
 * form, so an infix query in either script can find it.
 */
export function indexKeys(token: string): { dev: string; ascii: string } {
  const n = normalize(token);
  return { dev: n.dev || (isDevanagari(token) ? token : ''), ascii: n.ascii };
}
