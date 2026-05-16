/**
 * Devanāgarī akṣara-aware utilities.
 *
 * For Sanskrit segmentation, the right unit is the akṣara — a consonant
 * cluster plus its vowel — not the Unicode codepoint. "ब्रह्म" is three
 * akṣaras (ब्र, ह्म, ... well actually ब्र-ह्म, two), but five codepoints.
 * Splitting strings at codepoint boundaries breaks halant chains.
 *
 * Rules used here:
 *   - A run starts at any consonant or independent vowel.
 *   - It absorbs subsequent halant+consonant pairs (conjuncts).
 *   - It absorbs a final vowel sign (mātrā) if present.
 *   - Anusvāra/visarga/candrabindu/nukta cling to the previous akṣara.
 *
 * Codepoint ranges referenced:
 *   - independent vowels: U+0904–U+0914
 *   - consonants:         U+0915–U+0939
 *   - nukta-affected:     U+0958–U+095F (treated as consonants)
 *   - vowel signs:        U+093A–U+094C, U+0962–U+0963
 *   - virāma (halant):    U+094D
 *   - anusvāra/visarga:   U+0902, U+0903, U+093C (nukta), U+0901
 */

const HALANT = '्';
const NUKTA = '़';

const RE_INDEP_VOWEL = /[ऄ-औॠ-ॡॲ-ॷ]/;
const RE_CONSONANT = /[क-हक़-य़ॸ-ॿ]/;
const RE_VOWEL_SIGN = /[ऺ-ौॕ-ॗॢ-ॣ]/;
const RE_CLINGER = /[ऀ-ः़॑-॔]/; // anusvara, visarga, candrabindu, nukta, accents

export function isConsonant(ch: string): boolean {
  return RE_CONSONANT.test(ch);
}

export function isIndependentVowel(ch: string): boolean {
  return RE_INDEP_VOWEL.test(ch);
}

export function isVowelSign(ch: string): boolean {
  return RE_VOWEL_SIGN.test(ch);
}

/** Segments a Devanāgarī string into akṣaras. Non-Devanāgarī passes through. */
export function aksharas(text: string): string[] {
  const out: string[] = [];
  const codepoints = [...text];
  let i = 0;
  while (i < codepoints.length) {
    const ch = codepoints[i];
    // Non-Devanagari char → emit verbatim and continue
    if (
      !RE_INDEP_VOWEL.test(ch) &&
      !RE_CONSONANT.test(ch) &&
      !RE_VOWEL_SIGN.test(ch) &&
      !RE_CLINGER.test(ch) &&
      ch !== HALANT
    ) {
      out.push(ch);
      i += 1;
      continue;
    }

    let acc = ch;
    i += 1;

    // If we started on a consonant, absorb any halant+consonant chain that follows.
    if (RE_CONSONANT.test(ch)) {
      while (i < codepoints.length && codepoints[i] === HALANT) {
        const nxt = codepoints[i + 1];
        if (nxt && RE_CONSONANT.test(nxt)) {
          acc += HALANT + nxt;
          i += 2;
        } else {
          // Bare halant ending an akṣara (consonant without vowel)
          acc += HALANT;
          i += 1;
          break;
        }
      }
    }

    // Absorb optional nukta (e.g., for ZWJ-formed conjuncts) — typically attached
    // to the preceding consonant before any halant chain, but we keep it cling-y.
    while (i < codepoints.length && codepoints[i] === NUKTA) {
      acc += NUKTA;
      i += 1;
    }

    // Absorb a single vowel sign / mātrā.
    if (i < codepoints.length && RE_VOWEL_SIGN.test(codepoints[i])) {
      acc += codepoints[i];
      i += 1;
    }

    // Absorb clinging marks (anusvāra, visarga, candrabindu, accents).
    while (i < codepoints.length && RE_CLINGER.test(codepoints[i])) {
      acc += codepoints[i];
      i += 1;
    }

    out.push(acc);
  }
  return out;
}

/** Strip a trailing halant from the last akṣara (used for padatva analysis). */
export function withoutFinalHalant(text: string): string {
  return text.endsWith(HALANT) ? text.slice(0, -1) : text;
}

/** True if the last akṣara of `text` ends in a halant (i.e., a bare consonant). */
export function endsHalant(text: string): boolean {
  return text.endsWith(HALANT);
}

/** Get the akṣara count (Sanskrit "syllable" count). */
export function aksharaCount(text: string): number {
  return aksharas(text).length;
}
