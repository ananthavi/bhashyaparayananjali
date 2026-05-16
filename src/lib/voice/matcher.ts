/**
 * Sliding-window fuzzy matcher: where in the loaded text is the user
 * currently reciting?
 *
 * Inputs:
 *   - corpus: the akṣara-tokenized text of the current bhāṣya unit (or
 *     a wider window around the user's last position)
 *   - heard: the most-recent akṣara tokens from the speech recognizer
 *
 * The matcher computes a Dice coefficient between the trigram set of
 * `heard` and the trigram set of every length-|heard| window in the
 * corpus, returning the best-scoring window's start index plus a
 * confidence score in [0, 1]. If the score is below a threshold, the
 * caller should treat it as "lost" and fall back to global search.
 */

import { akshara_ngrams } from './normalize';

export interface MatchResult {
  /** Start index in the corpus token stream where the heard window
   *  best aligns. -1 if no candidate scored above zero. */
  start: number;
  /** End index (exclusive). */
  end: number;
  /** Dice coefficient in [0, 1]. */
  score: number;
}

/** Dice coefficient between two trigram multi-sets. */
function dice(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const x of a) counts.set(x, (counts.get(x) ?? 0) + 1);
  let inter = 0;
  for (const y of b) {
    const c = counts.get(y);
    if (c && c > 0) {
      inter += 1;
      counts.set(y, c - 1);
    }
  }
  return (2 * inter) / (a.length + b.length);
}

/**
 * Find the corpus span best aligned with the heard tokens.
 *
 * `searchRange` lets the caller restrict the search to a neighborhood
 * (e.g. ±200 tokens around the previous match). Pass `null` for an
 * exhaustive search over the entire corpus.
 */
export function findMatch(
  corpus: string[],
  heard: string[],
  searchRange: { start: number; end: number } | null = null,
  windowSize: number | null = null,
): MatchResult {
  const win = windowSize ?? Math.min(Math.max(heard.length, 4), 14);
  if (corpus.length === 0 || heard.length === 0) {
    return { start: -1, end: -1, score: 0 };
  }

  const heardWindow = heard.slice(-win);
  const heardGrams = akshara_ngrams(heardWindow, 3);

  const lo = Math.max(0, searchRange?.start ?? 0);
  const hi = Math.min(corpus.length - 1, searchRange?.end ?? corpus.length - 1);

  let best: MatchResult = { start: -1, end: -1, score: 0 };
  // Step by 1 token to keep the matcher responsive on short utterances.
  for (let s = lo; s + win <= hi + 1; s++) {
    const windowGrams = akshara_ngrams(corpus.slice(s, s + win), 3);
    const score = dice(heardGrams, windowGrams);
    if (score > best.score) {
      best = { start: s, end: s + win, score };
    }
  }
  return best;
}

/**
 * Two-stage search: first try a tight neighborhood around the last
 * known position; if nothing scores well, fall back to the full corpus.
 *
 * The threshold and neighborhood are tuned for chanting tempo at
 * ~30–60 wpm where hi-IN ASR returns clean Devanāgarī.
 */
export function followMatch(
  corpus: string[],
  heard: string[],
  hint: number | null = null,
  opts: { neighborhood?: number; minScore?: number } = {},
): MatchResult {
  const neighborhood = opts.neighborhood ?? 80;
  const minScore = opts.minScore ?? 0.25;

  if (hint !== null) {
    const local = findMatch(corpus, heard, {
      start: Math.max(0, hint - neighborhood / 2),
      end: Math.min(corpus.length - 1, hint + neighborhood),
    });
    if (local.score >= minScore) return local;
  }
  return findMatch(corpus, heard, null);
}
