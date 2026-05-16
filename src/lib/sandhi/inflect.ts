/**
 * Light-weight inflection lemma resolver.
 *
 * Given a Devanāgarī word, propose its possible lemmas (citation forms).
 * Three sources of candidates, returned together so the dictionary
 * lookup chain can try them in order of confidence:
 *
 *   1. PRONOUN_TABLE — hand-coded surface→lemma map for pronouns,
 *      irregular verbs, sandhi-affected adverbs, common particles
 *      (`method: 'manual'` so the UI can mark these as "from a curated
 *      table" rather than a general rule).
 *   2. Surface variants — anusvāra→m, visarga aḥ→as, n-stem -ā→-न्.
 *   3. Suffix table — a/i/u/n/ṛ-stem case endings, common verbal
 *      endings, abstract noun -tva/-tā with case forms.
 *
 * Candidates 2 and 3 carry `method: 'rule'`. The popover uses these
 * labels to distinguish rule-derived matches from manual / fuzzy ones.
 */
import { PRONOUN_TABLE } from './pronouns';

/**
 * How was the lemma derived from the surface form?
 *   - 'rule'    : a clean inflection-suffix or surface-sandhi rule fired
 *   - 'manual'  : the surface form is in our hand-coded pronoun/particle
 *                 table — highly accurate for the words it covers, but
 *                 not derivable from a general Pāṇinian rule, so we mark
 *                 it explicitly so the popover can show "manual table"
 *                 instead of pretending it came from a rule.
 *   - 'fuzzy'   : nearest-lemma approximation; lowest confidence
 */
export type LemmaMethod = 'rule' | 'manual' | 'fuzzy';

export interface LemmaCandidate {
  lemma: string;
  label: string; // human-readable morphological description, e.g. "n-stem, gen. sg."
  method?: LemmaMethod;
  /** Optional gloss provided by manual table (used when no dict has the lemma). */
  gloss?: string;
}

/**
 * Suffix → (lemmaTransform, label) table. The lemmaTransform is the
 * REPLACEMENT for the suffix in the surface form. So
 *   { suffix: 'णः', replacement: 'न्', label: 'n-stem gen. sg.' }
 * means: if the word ends in "णः", drop "णः" and append "न्" to get the
 * lemma. Order matters — longest suffix wins.
 */
interface InflectionRule {
  suffix: string;
  replacement: string;
  label: string;
}

const RULES: InflectionRule[] = [
  // n-stem (Brahman, ātman, rājan)
  { suffix: 'ण्या', replacement: 'न्य', label: 'n-stem instr. sg.' },
  { suffix: 'णि', replacement: 'न्', label: 'n-stem loc. sg.' },
  { suffix: 'णः', replacement: 'न्', label: 'n-stem gen. sg.' },
  { suffix: 'णा', replacement: 'न्', label: 'n-stem instr. sg.' },
  { suffix: 'णे', replacement: 'न्', label: 'n-stem dat. sg.' },
  { suffix: 'णोः', replacement: 'न्', label: 'n-stem gen./loc. dual' },
  { suffix: 'नौ', replacement: 'न्', label: 'n-stem nom./acc. dual' },
  { suffix: 'नाम्', replacement: 'न्', label: 'n-stem gen. pl.' },
  { suffix: 'भिः', replacement: '', label: 'instr. pl.' },
  { suffix: 'भ्यः', replacement: '', label: 'dat./abl. pl.' },
  { suffix: 'भ्याम्', replacement: '', label: 'instr./dat./abl. dual' },

  // a-stem (deva, brahma) masc/neut
  { suffix: 'स्मात्', replacement: '', label: 'a-stem abl. sg.' },
  { suffix: 'स्मिन्', replacement: '', label: 'a-stem loc. sg.' },
  { suffix: 'स्मै', replacement: '', label: 'a-stem dat. sg.' },
  { suffix: 'स्य', replacement: '', label: 'a-stem gen. sg.' },
  { suffix: 'याम्', replacement: 'ी', label: 'ī/ā-stem fem. loc. sg.' },
  { suffix: 'याः', replacement: 'ी', label: 'ī-stem fem. gen./abl. sg.' },
  { suffix: 'याम्', replacement: 'ा', label: 'ā-stem fem. loc. sg.' },
  { suffix: 'यै', replacement: 'ा', label: 'ā-stem fem. dat. sg.' },
  { suffix: 'याः', replacement: 'ा', label: 'ā-stem fem. gen./abl. sg.' },
  { suffix: 'या', replacement: 'ा', label: 'ā-stem fem. instr. sg.' },
  { suffix: 'ानाम्', replacement: '', label: 'a-stem gen. pl.' },
  { suffix: 'ानि', replacement: '', label: 'a-stem (n.) nom./acc. pl.' },
  { suffix: 'ेषु', replacement: '', label: 'a-stem loc. pl.' },
  { suffix: 'ैः', replacement: '', label: 'a-stem instr. pl.' },
  { suffix: 'ान्', replacement: '', label: 'a-stem (m.) acc. pl.' },
  { suffix: 'ाः', replacement: '', label: 'a-stem (m.) nom. pl.' },
  { suffix: 'ौ', replacement: '', label: 'a-stem nom./acc. dual' },
  { suffix: 'ेन', replacement: '', label: 'a-stem instr. sg.' },
  { suffix: 'े', replacement: '', label: 'a-stem loc. sg. / voc. sg. (m.)' },

  // i / ī / u / ū-stem
  { suffix: 'भिः', replacement: '', label: 'instr. pl.' },
  { suffix: 'षु', replacement: '', label: 'i/u-stem loc. pl.' },
  { suffix: 'योः', replacement: 'ि', label: 'i-stem gen./loc. dual' },
  { suffix: 'वोः', replacement: 'ु', label: 'u-stem gen./loc. dual' },

  // ṛ-stem (pitṛ)
  { suffix: 'त्रा', replacement: 'तृ', label: 'ṛ-stem instr. sg.' },
  { suffix: 'त्रे', replacement: 'तृ', label: 'ṛ-stem dat. sg.' },
  { suffix: 'तुः', replacement: 'तृ', label: 'ṛ-stem gen./abl. sg.' },
  { suffix: 'तरि', replacement: 'तृ', label: 'ṛ-stem loc. sg.' },
  { suffix: 'तरौ', replacement: 'तृ', label: 'ṛ-stem nom./acc. dual' },

  // verbal endings (3rd-person, common)
  { suffix: 'न्ति', replacement: 'त्', label: 'verbal 3 pl. pres.' },
  { suffix: 'न्ते', replacement: 'त्', label: 'verbal 3 pl. ātmane' },
  { suffix: 'त्वा', replacement: '', label: 'absolutive (-tvā)' },
  { suffix: 'य', replacement: '', label: 'absolutive (-ya)' },
  { suffix: 'तुम्', replacement: '', label: 'infinitive (-tum)' },
  { suffix: 'मानः', replacement: 'मान्', label: 'pres. participle (m. nom. sg.)' },
  { suffix: 'त्वम्', replacement: '', label: 'abstract noun -tva' },
  { suffix: 'त्वात्', replacement: '', label: '-tva, abl. sg.' },
  { suffix: 'त्वेन', replacement: '', label: '-tva, instr. sg.' },
  { suffix: 'तया', replacement: '', label: '-tā, instr. sg.' },

  // generic gender/case
  { suffix: 'ः', replacement: '', label: 'nom. sg.' },
  { suffix: 'म्', replacement: '', label: 'acc. sg. / nom.-acc. sg. (n.)' },
];

/**
 * Surface-level normalization candidates. The bhāṣya text has many
 * post-sandhi forms whose dictionary head-words carry an explicit
 * m्/स्/र् instead of anusvāra/visarga / mātrā. We propose the
 * underlying form alongside the literal one so the dictionary can
 * still match.
 */
function surfaceVariants(word: string): Array<{ form: string; label: string }> {
  const out: Array<{ form: string; label: string }> = [];
  // सर्वं → सर्वम्  (anusvāra at word end → -m)
  if (word.endsWith('ं')) {
    out.push({ form: word.slice(0, -1) + 'म्', label: 'anusvāra → m' });
  }
  // अतो + voiced → अतस्   /  देवो + voiced → देवस्
  if (word.endsWith('ो')) {
    const stem = word.slice(0, -1);
    out.push({ form: stem + 'स्', label: 'visarga aḥ → as' });
    out.push({ form: stem + 'अस्', label: 'visarga aḥ → as' });
  }
  // ब्रह्मा → ब्रह्मन्   (head form for n-stems with -ā ending)
  if (word.endsWith('ा') && word.length > 2) {
    out.push({ form: word.slice(0, -1) + 'न्', label: 'n-stem nom. sg.' });
  }
  return out;
}

/**
 * Propose lemma candidates for a surface form. Longest-suffix-first.
 * Returns an empty array if no rule matches. Hand-coded pronoun /
 * irregular-verb hits come first (highest confidence) and are tagged
 * `method: 'manual'` so the UI can show that they're from a curated
 * table rather than a general rule.
 */
export function proposeLemmas(word: string): LemmaCandidate[] {
  const out: LemmaCandidate[] = [];
  // 0. Manual pronoun / irregular table — exact surface match.
  const tab = PRONOUN_TABLE[word];
  if (tab) {
    out.push({ lemma: tab.lemma, label: tab.label, method: 'manual', gloss: tab.gloss });
  }
  // 1. Surface-level variants (anusvāra / visarga restorations).
  for (const v of surfaceVariants(word)) {
    out.push({ lemma: v.form, label: v.label, method: 'rule' });
  }
  // 2. Suffix table — longest match wins.
  const sorted = [...RULES].sort((a, b) => b.suffix.length - a.suffix.length);
  for (const r of sorted) {
    if (!word.endsWith(r.suffix)) continue;
    if (word.length <= r.suffix.length) continue;
    const stem = word.slice(0, word.length - r.suffix.length);
    out.push({ lemma: stem + r.replacement, label: r.label, method: 'rule' });
  }
  // Dedupe by (lemma, label).
  const seen = new Set<string>();
  return out.filter((c) => {
    const k = c.lemma + '\0' + c.label;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
