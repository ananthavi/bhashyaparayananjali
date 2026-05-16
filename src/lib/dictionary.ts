/**
 * Sanskrit word-lookup for the reader's tap-a-word popover.
 *
 * Strategy:
 *   1. Ship a hand-curated seed glossary covering ~200 of the most common
 *      Vedantic / Prasthanatrayi terms, with English and Malayalam glosses.
 *      This keeps the PWA useful offline and the bundle small.
 *   2. Expose a loader contract (`registerDictionarySource`) so a future
 *      full Monier-Williams or Apte JSON can be dropped in without code
 *      changes. When additional sources are present, we prefer the richest
 *      entry (seed > registered > substring match).
 *
 * The lookup performs prefix + suffix stripping for common sandhi/case
 * endings so the user doesn't have to isolate the lemma perfectly before
 * tapping. Match quality is reported so the UI can show "exact" vs
 * "possibly <lemma>".
 */

import type { DictionarySource } from './dictionary-seed';
import { SEED_GLOSSARY } from './dictionary-seed';

export interface DictionaryEntry {
  /** Head-word in Devanagari. */
  lemma: string;
  /** Romanized form (IAST). */
  iast?: string;
  /** Part of speech hints, e.g. "n." or "m." or "vi." */
  pos?: string;
  /** English gloss. */
  en?: string;
  /** Malayalam gloss. */
  ml?: string;
  /** Source label for attribution. */
  source: string;
}

export interface LookupResult {
  query: string;
  matches: DictionaryEntry[];
  /** Whether the query matched a head-word exactly. */
  exact: boolean;
  /** If a suffix/prefix was stripped to find the match, the stripped form. */
  lemma?: string;
}

const sources: DictionarySource[] = [SEED_GLOSSARY];

export function registerDictionarySource(src: DictionarySource): void {
  sources.push(src);
}

/** Simple Devanagari suffix list covering very common inflections. */
const COMMON_SUFFIXES = [
  // a-stem
  'स्य',
  'ाय',
  'ेन',
  'स्मै',
  'ात्',
  'स्मात्',
  'स्मिन्',
  'ानि',
  'ेषु',
  'याम्',
  'याः',
  'ानाम्',
  'ेभ्यः',
  'ाभ्याम्',
  // n-stem (brahman, ātman)
  'णः',
  'णा',
  'णे',
  'णि',
  'नि',
  // abstract / derivative
  'तया',
  'त्वम्',
  'त्वा',
  'त्वात्',
  'त्वेन',
  // verbal participles
  'त्वा',
  'यित्वा',
  // shorter endings
  'ः',
  'म्',
  'ा',
  'ी',
  'ौ',
  'ि',
];

function stripCandidates(word: string): string[] {
  const out = new Set<string>([word]);
  for (const suf of COMMON_SUFFIXES) {
    if (word.endsWith(suf) && word.length > suf.length + 1) {
      out.add(word.slice(0, -suf.length));
    }
  }
  // Try dropping the final halant if present
  if (word.endsWith('्')) out.add(word.slice(0, -1));
  return [...out];
}

function findExact(head: string): DictionaryEntry[] {
  const hits: DictionaryEntry[] = [];
  for (const src of sources) {
    const entry = src.entries[head];
    if (entry) hits.push({ ...entry, lemma: head, source: src.label });
  }
  return hits;
}

export function lookup(rawWord: string): LookupResult {
  const word = (rawWord ?? '').trim().replace(/[।॥,.;:?!«»"'\s]+/g, '');
  if (!word) return { query: rawWord, matches: [], exact: false };

  // 1. Try exact match
  const exactHits = findExact(word);
  if (exactHits.length > 0) {
    return { query: word, matches: exactHits, exact: true };
  }

  // 2. Try suffix-stripped lemmas in order of length (shortest-stripped first)
  const candidates = stripCandidates(word).filter((c) => c !== word);
  candidates.sort((a, b) => b.length - a.length);
  for (const c of candidates) {
    const hits = findExact(c);
    if (hits.length > 0) {
      return { query: word, matches: hits, exact: false, lemma: c };
    }
  }

  // 3. Fall back to a prefix scan: any headword that starts with the first
  //    few characters of the query. Useful when the user taps a compound.
  if (word.length >= 3) {
    const prefix = word.slice(0, Math.min(6, word.length));
    const hits: DictionaryEntry[] = [];
    for (const src of sources) {
      for (const head of Object.keys(src.entries)) {
        if (head.startsWith(prefix)) {
          hits.push({ ...src.entries[head], lemma: head, source: src.label });
          if (hits.length >= 5) break;
        }
      }
      if (hits.length >= 5) break;
    }
    if (hits.length > 0) return { query: word, matches: hits, exact: false };
  }

  return { query: word, matches: [], exact: false };
}
