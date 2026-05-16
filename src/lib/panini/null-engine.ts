/**
 * Null Pāṇinian engine — the safe default.
 *
 * Returns empty results for every call. Used when no real engine
 * (Vidyut WASM, Heritage REST, etc.) has been wired in. The
 * orchestrator in `analysis.ts` checks `engine.available` and
 * skips the Pāṇinian layer entirely when this is the active engine,
 * so the existing rule-based analyser keeps doing its job.
 *
 * Replace this with the real engine in `index.ts` when the WASM
 * bundle is built and shipped. See docs/paninian-engine-plan.md.
 */

import type {
  AnalyzeOptions,
  Morphology,
  PaniniAnalysis,
  PaniniEngine,
} from './types';

class NullPaniniEngine implements PaniniEngine {
  readonly name = 'null';
  readonly available = false;

  async analyze(_word: string, _opts?: AnalyzeOptions): Promise<PaniniAnalysis[]> {
    return [];
  }

  async segment(_utterance: string): Promise<string[][]> {
    return [];
  }

  async inflect(_lemma: string, _morph: Morphology): Promise<string[]> {
    return [];
  }
}

export const nullEngine: PaniniEngine = new NullPaniniEngine();
