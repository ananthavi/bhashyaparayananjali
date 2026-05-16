/**
 * Compound (samāsa) decomposition.
 *
 * Strategy: try every possible akṣara-boundary inside the word, and at
 * each boundary apply the reverse-sandhi rules from `rules.ts`. Score
 * candidates by whether the dictionary recognizes both halves. The
 * recursion handles deeper compounds — once we find a 2-way split,
 * we recurse into each half so "ब्रह्मविद्योपासना" can become
 * ब्रह्म + विद्या + उपासना.
 *
 * `isLemma` is a fast yes/no predicate supplied by the dictionary
 * subsystem. It avoids loading entries; it merely answers "is this a
 * known head-word?".
 */

import { aksharas } from './aksharas';
import { proposeAt, type SandhiCandidate } from './rules';
import { proposeLemmas } from './inflect';

export interface CompoundSplit {
  parts: string[];
  /** Per-boundary sandhi rule labels in order. */
  rules: string[];
  /** Score: 1.0 = every part is a known lemma. */
  score: number;
}

export interface SplitOptions {
  isLemma: (s: string) => boolean;
  maxDepth?: number;
  maxCandidates?: number;
}

const DEFAULT_OPTIONS = { maxDepth: 4, maxCandidates: 16 };

/**
 * Try to split a Devanāgarī compound. Returns splits with the best score
 * first. Always includes a "no split" candidate at the end so the popover
 * can fall back gracefully.
 */
export function splitCompound(word: string, opts: SplitOptions): CompoundSplit[] {
  const { isLemma } = opts;
  const maxDepth = opts.maxDepth ?? DEFAULT_OPTIONS.maxDepth;
  const maxCandidates = opts.maxCandidates ?? DEFAULT_OPTIONS.maxCandidates;

  const memo = new Map<string, CompoundSplit[]>();

  function recur(input: string, depth: number): CompoundSplit[] {
    if (memo.has(input)) return memo.get(input)!;
    if (depth >= maxDepth) {
      const trivial = [{ parts: [input], rules: [], score: scoreParts([input], isLemma) }];
      memo.set(input, trivial);
      return trivial;
    }

    const ak = aksharas(input);
    const out: CompoundSplit[] = [];

    // Trivial: no split.
    out.push({ parts: [input], rules: [], score: scoreParts([input], isLemma) });

    for (let i = 1; i < ak.length; i++) {
      const candidates = proposeAt(ak, i);
      for (const cand of candidates) {
        if (!cand.left || !cand.right) continue;
        // Skip too-short halves; aksharaCount<2 are usually noise.
        const leftAk = aksharas(cand.left);
        const rightAk = aksharas(cand.right);
        if (leftAk.length < 2 || rightAk.length < 1) continue;

        // Recurse into each half. Cap branching with a per-call budget.
        const rightSubs = depth + 1 < maxDepth
          ? recur(cand.right, depth + 1).slice(0, 4)
          : [{ parts: [cand.right], rules: [], score: scoreParts([cand.right], isLemma) }];

        for (const rsub of rightSubs) {
          const parts = [cand.left, ...rsub.parts];
          const rules = [cand.rule, ...rsub.rules];
          const score = scoreParts(parts, isLemma);
          out.push({ parts, rules, score });
        }
      }
    }

    // Sort: best score first; among equals, prefer fewer parts.
    out.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.parts.length - b.parts.length;
    });
    const result = out.slice(0, maxCandidates);
    memo.set(input, result);
    return result;
  }

  return recur(word, 0);
}

/**
 * Score = fraction of parts that are recognized lemmas, with a small
 * boost for compounds where every part scores 1.0. Inflected forms are
 * recognized as half-credit (the underlying lemma is a hit).
 */
function scoreParts(parts: string[], isLemma: (s: string) => boolean): number {
  if (parts.length === 0) return 0;
  let total = 0;
  for (const p of parts) {
    if (isLemma(p)) total += 1.0;
    else if (proposeLemmas(p).some((l) => isLemma(l.lemma))) total += 0.6;
  }
  return total / parts.length;
}

/** Pretty-print a CompoundSplit using the akṣara separator. */
export function formatSplit(split: CompoundSplit, sep = ' + '): string {
  return split.parts.join(sep);
}

export { type SandhiCandidate };
