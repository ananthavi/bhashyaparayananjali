/**
 * Fuzzy / approximate lemma fallback.
 *
 * When the analyzer can't resolve a token via direct match, inflection,
 * sandhi-revert, or compound split, this module finds the closest
 * dictionary head-word by character overlap and returns it as a
 * best-effort guess. The popover surfaces these as "approximate" so
 * the user knows the match isn't from a clean rule.
 *
 * Algorithm: trigram Dice coefficient against every head in the
 * combined oracle, keep the top-K above a quality threshold. We don't
 * use Levenshtein here because Devanāgarī conjuncts make character-level
 * edit distance noisy — n-grams are more forgiving and faster.
 */

const NGRAM = 3;

function ngrams(s: string, n = NGRAM): string[] {
  if (s.length < n) return [s];
  const out: string[] = [];
  for (let i = 0; i + n <= s.length; i++) out.push(s.slice(i, i + n));
  return out;
}

function dice(a: string[], b: Set<string>): number {
  if (a.length === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return (2 * inter) / (a.length + b.size);
}

export interface FuzzyHit {
  lemma: string;
  score: number;
}

/**
 * Find heads from `pool` whose trigram set best matches `query`.
 * Returns up to `topK` candidates, score-sorted, all above `minScore`.
 *
 * For 245k heads this runs in ~50–80 ms on a phone. Acceptable for an
 * on-tap UX, but you should call this only as a final fallback.
 */
export function nearestHeads(
  query: string,
  pool: Iterable<string>,
  topK = 5,
  minScore = 0.45,
): FuzzyHit[] {
  if (!query) return [];
  const qg = ngrams(query);
  const qSet = new Set(qg);
  const candidates: FuzzyHit[] = [];
  for (const head of pool) {
    // Cheap pre-filter: skip when length is wildly different.
    if (Math.abs(head.length - query.length) > Math.max(3, query.length * 0.5)) continue;
    const hg = new Set(ngrams(head));
    const score = dice(qg, hg);
    if (score >= minScore) {
      candidates.push({ lemma: head, score });
      // Keep only top-K (cheap heap).
      if (candidates.length > topK * 6) {
        candidates.sort((a, b) => b.score - a.score);
        candidates.length = topK * 3;
      }
    }
    void qSet;
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, topK);
}
