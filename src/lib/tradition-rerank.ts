/**
 * Tradition-prior aware sense reranker.
 *
 * Given a Sanskrit head and a list of dictionary senses, returns a
 * permutation that pushes senses matching the active tradition's
 * preferred-meaning markers to the top. Falls through to the
 * original order when no prior exists for the head — explicitly the
 * non-destructive behaviour the validation regime requires.
 *
 * See:
 *   - docs/context-meaning-plan.md §4.4 (Prakaraṇa + Samākhyā)
 *   - src/data/tradition-priors.ts (the curated tables)
 */
import { priorFor, traditionFor, type TraditionTag } from '@/data/tradition-priors';

export interface RerankedSense {
  /** Index into the original `senses` array. */
  index: number;
  /** The sense text, unchanged. */
  text: string;
  /**
   * Score in [0, 1]. 0 means no prior matched; higher means better
   * alignment with the tradition's preferred sense. Used by the
   * popover to render a small "tradition" chip on the winning sense.
   */
  score: number;
  /** First matched prior keyword, useful for surfacing as a chip. */
  matched?: string;
}

/**
 * Rerank `senses` using the tradition prior for `head` (if any).
 *
 * The score for each sense is a weighted overlap with the prior's
 * `preferred` array, where earlier preferred entries are weighted
 * slightly higher. Ties are broken by the original order (stable).
 */
export function rerankSenses(
  textSlug: string | null | undefined,
  head: string,
  senses: string[],
): RerankedSense[] {
  const tradition: TraditionTag = traditionFor(textSlug);
  const prior = priorFor(tradition, head);
  const baseline = senses.map((text, index) => ({ index, text, score: 0 } as RerankedSense));
  if (!prior || senses.length <= 1) return baseline;

  const pref = prior.preferred;
  return baseline
    .map((s) => {
      let score = 0;
      let matched: string | undefined;
      const lower = s.text.toLowerCase();
      for (let i = 0; i < pref.length; i++) {
        const k = pref[i].toLowerCase();
        if (!k) continue;
        if (lower.includes(k)) {
          // earlier entries weight more; range ~ [1.0, 0.5]
          const w = 1 - (i / Math.max(pref.length, 1)) * 0.5;
          score += w;
          if (!matched) matched = pref[i];
        }
      }
      // Normalise to [0, 1] so the popover can compare across heads.
      const max = pref.length;
      return { ...s, score: max ? score / max : 0, matched };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    });
}
