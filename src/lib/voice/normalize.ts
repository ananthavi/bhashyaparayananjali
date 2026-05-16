/**
 * Sanskrit-aware text normalization for voice/text matching.
 *
 * The Web Speech API recognizers (Chrome/Android) don't ship a Sanskrit
 * locale. The closest is `hi-IN`, which produces Devanāgarī output that
 * is mostly accurate phonetically but introduces normalization noise:
 *
 *   - anusvāra (ं) and the corresponding nasal+consonant clusters get
 *     swapped freely (अहं ↔ अहम्)
 *   - visarga (ः) is sometimes dropped or rendered as "h"
 *   - long/short vowels are sometimes confused (कमल/कामल)
 *   - chandrabindu ँ may appear or disappear
 *   - non-Devanāgarī tokens (English noise words, numerals) creep in
 *
 * We normalize before matching by:
 *   - dropping every non-Devanāgarī codepoint
 *   - collapsing all forms of nasal markers (ं ँ ं + dental-class) to
 *     a single token
 *   - dropping visarga
 *   - collapsing vowel length
 *   - dropping accents (Vedic udātta etc.)
 *
 * The result is a "phonetic skeleton" of the utterance that survives
 * the recognizer's typical errors. Both sides of the match (ASR output
 * AND corpus text) go through the same normalizer.
 */

// Bare combining-mark codepoints are not legal as TS object-key
// identifier-starts, so we string-quote every key to be safe.
const VOWEL_LENGTH_FOLD: Record<string, string> = {
  'आ': 'अ',
  'ई': 'इ',
  'ऊ': 'उ',
  'ॠ': 'ऋ',
  'ॡ': 'ऌ',
  // mātrās (combining marks)
  'ा': '', // ा
  'ी': 'ि', // ी → ि
  'ू': 'ु', // ू → ु
  'ॄ': 'ृ', // ॄ → ृ
};

/** Strip every codepoint that isn't Devanāgarī or whitespace. */
function devanagariOnly(s: string): string {
  return s.replace(/[^ऀ-ॿ\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Drop accents, anusvāra/visarga/candrabindu, fold vowel length. */
export function normalizeForMatch(input: string): string {
  let s = devanagariOnly(input);
  // drop visarga, anusvāra, candrabindu, accents, nukta
  s = s.replace(/[ऀ-ः़॑-॔ॢॣॽ]/g, '');
  // fold vowel length
  s = s.replace(/[आईऊॠॡाीूॄ]/g, (ch) => VOWEL_LENGTH_FOLD[ch] ?? ch);
  // collapse runs of whitespace
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Tokenize a normalized string into an array of akṣaras for matching.
 * Reuses the akṣara segmenter so conjuncts stay together.
 */
import { aksharas } from '@/lib/sandhi/aksharas';

export function tokensFor(input: string): string[] {
  return aksharas(normalizeForMatch(input)).filter((t) => t.trim().length > 0 && t !== ' ');
}

/**
 * Akṣara n-grams, useful as a similarity feature. We build n-grams over
 * the akṣara stream (not the codepoint stream) so the score is robust
 * to conjunct rendering choices.
 */
export function akshara_ngrams(tokens: string[], n = 3): string[] {
  if (tokens.length < n) return [tokens.join('')];
  const out: string[] = [];
  for (let i = 0; i + n <= tokens.length; i++) {
    out.push(tokens.slice(i, i + n).join(''));
  }
  return out;
}
