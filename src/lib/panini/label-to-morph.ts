/**
 * Translate a free-text inflection label (the strings emitted by
 * `src/lib/sandhi/inflect.ts` and the manual pronoun table) into a
 * Morphology spec the WASM engine understands. Best-effort: returns
 * `null` when the label doesn't map cleanly, in which case the
 * heuristic candidate stands without engine verification.
 *
 * Examples:
 *   "a-stem gen. sg."         → { vibhakti: 6, vacana: 'eka', linga: 'm' }
 *   "n-stem nom./acc. dual"   → { vibhakti: 1, vacana: 'dvi', linga: 'n' }
 *   "gen. pl."                → { vibhakti: 6, vacana: 'bahu' }
 *   "perf. 3sg of √vac"       → { lakara: 'lit', purusha: 3, vacana: 'eka' }
 *   "fut. 3sg passive"        → { lakara: 'lrt', purusha: 3, vacana: 'eka' }
 */
import type { Morphology } from './types';

const VIBHAKTI: Array<[RegExp, 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8]> = [
  [/\bnom\./i, 1],
  [/\bvoc\./i, 8],
  [/\bacc\./i, 2],
  [/\binstr\./i, 3],
  [/\bdat\./i, 4],
  [/\babl\./i, 5],
  [/\bgen\./i, 6],
  [/\bloc\./i, 7],
];

const VACANA: Array<[RegExp, 'eka' | 'dvi' | 'bahu']> = [
  [/\bsg\b|\bsing(?:ular)?\b|\d+sg\b/i, 'eka'],
  [/\bdual\b|\bdu\.?\b|\d+du\b/i, 'dvi'],
  [/\bpl\b|\bplural\b|\d+pl\b/i, 'bahu'],
];

const LINGA: Array<[RegExp, 'm' | 'f' | 'n']> = [
  [/\bmasc\.|\bm\b/i, 'm'],
  [/\bfem\.|\bfeminine\b|\bf\b/i, 'f'],
  [/\bneut\.|\bn\b/i, 'n'],
];

const LAKARA: Array<[RegExp, string]> = [
  [/(?:^|\W)perf(?:\.|ect\b)/i, 'lit'],
  [/(?:^|\W)fut(?:\.|ure\b)/i, 'lrt'],
  [/(?:^|\W)pres(?:\.|ent\b)/i, 'lat'],
  [/(?:^|\W)impv(?:\.|erative\b)/i, 'lot'],
  [/(?:^|\W)impf(?:\.|ect\b)/i, 'lan'],
  [/(?:^|\W)aor(?:\.|ist\b)/i, 'lun'],
  [/(?:^|\W)opt(?:\.|ative\b)/i, 'vidhi-lin'],
];

const PURUSHA: Array<[RegExp, 1 | 2 | 3]> = [
  [/\b1(?:st)?\s*(?:p|per|persona?)?\b|\b1\s*sg\b|\b1\s*pl\b/i, 1],
  [/\b2(?:nd)?\s*(?:p|per|persona?)?\b|\b2\s*sg\b|\b2\s*pl\b/i, 2],
  [/\b3(?:rd)?\s*(?:p|per|persona?)?\b|\b3\s*sg\b|\b3\s*pl\b/i, 3],
];

export function labelToMorph(label: string | undefined): Morphology | null {
  if (!label) return null;
  const out: Morphology = {};

  for (const [re, k] of LAKARA) if (re.test(label)) { out.lakara = k; break; }
  for (const [re, p] of PURUSHA) if (re.test(label)) { out.purusha = p; break; }
  for (const [re, v] of VIBHAKTI) if (re.test(label)) { out.vibhakti = v; break; }
  for (const [re, v] of VACANA) if (re.test(label)) { out.vacana = v; break; }
  for (const [re, l] of LINGA) if (re.test(label)) { out.linga = l; break; }

  // Single-word vacana cues without a dot ("singular" / "plural" / "dual").
  if (!out.vacana) {
    if (/\bsingular\b/i.test(label)) out.vacana = 'eka';
    else if (/\bplural\b/i.test(label)) out.vacana = 'bahu';
    else if (/\bdual\b/i.test(label)) out.vacana = 'dvi';
  }

  // a-stem default linga is masculine when not stated.
  if (out.vibhakti && !out.linga && /a-stem|i-stem|u-stem/i.test(label)) {
    out.linga = 'm';
  }

  // Reject if we extracted nothing useful.
  if (Object.keys(out).length === 0) return null;
  // Verb form needs lakara + purusha + vacana to be derivable.
  if (out.lakara && (!out.purusha || !out.vacana)) return null;
  // Nominal form needs vibhakti + vacana to be derivable.
  if (out.vibhakti && !out.vacana) return null;
  return out;
}
