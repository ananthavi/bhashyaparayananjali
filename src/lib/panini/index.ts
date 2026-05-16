/**
 * Pāṇinian engine facade.
 *
 * The active engine is selected at module init based on the
 * `paniniEngineEnabled` feature flag and on what's actually
 * available at runtime (the WASM bundle may not have been
 * downloaded yet, etc.). Until a real engine is wired in this
 * facade always returns the no-op `nullEngine`.
 *
 * Consumers should use `getEngine()` and check `available` before
 * calling — never assume an engine is loaded.
 *
 * Adding a new engine adapter:
 *   1. Implement `PaniniEngine` in src/lib/panini/<name>-engine.ts.
 *   2. Update `selectEngine()` below to instantiate it when the
 *      feature flag is on AND the engine reports available.
 *   3. Document the engine in docs/paninian-engine-plan.md.
 */

import { FEATURES } from '@/lib/features';
import type { Morphology } from './types';
import { nullEngine } from './null-engine';
import {
  loadVidyutWasmEngine,
  type PaniniEngineWithVerify,
  type VerifyResult,
} from './vidyut-wasm-engine';

let activeEngine: PaniniEngineWithVerify = nullEngine;
let loading: Promise<PaniniEngineWithVerify> | null = null;

export function getEngine(): PaniniEngineWithVerify {
  return activeEngine;
}

export function ensureEngine(): Promise<PaniniEngineWithVerify> {
  if (loading) return loading;
  if (!FEATURES.paniniEngineEnabled) {
    return Promise.resolve(nullEngine);
  }
  loading = (async () => {
    const wasm = await loadVidyutWasmEngine();
    activeEngine = wasm ?? nullEngine;
    return activeEngine;
  })();
  return loading;
}

export function hasEngine(): boolean {
  return activeEngine.available;
}

/**
 * Convenience: verify a heuristic guess against the engine. Returns
 * null when no engine is loaded (the analyser then trusts the
 * heuristic chain unconditionally).
 */
export async function verifyWithEngine(
  surface: string,
  lemma: string,
  morph: Morphology,
): Promise<VerifyResult | null> {
  const e = await ensureEngine();
  if (!e.available || typeof e.verify !== 'function') return null;
  return e.verify(surface, lemma, morph);
}

export type { VerifyResult };

export type { PaniniEngine, PaniniAnalysis, Morphology, SamasaType, Pos } from './types';
