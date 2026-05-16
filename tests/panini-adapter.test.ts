import { describe, it, expect } from 'vitest';
import { ensureEngine, getEngine, hasEngine } from '@/lib/panini';
import { nullEngine } from '@/lib/panini/null-engine';
import type { Morphology, PaniniEngine } from '@/lib/panini/types';

/**
 * Adapter contract tests. The active engine in this commit is the
 * no-op `nullEngine` — assertions here document the contract the
 * facade enforces so that any future Vidyut WASM implementation
 * (or other engine) is guaranteed to be a drop-in replacement.
 */

describe('panini adapter facade', () => {
  it('exposes a nullEngine that reports unavailable by default', () => {
    expect(hasEngine()).toBe(false);
    expect(getEngine().name).toBe('null');
    expect(getEngine().available).toBe(false);
  });

  it('nullEngine returns empty arrays for every call (never throws)', async () => {
    const e = nullEngine;
    expect(await e.analyze('ब्रह्मविद्या')).toEqual([]);
    expect(await e.segment('तत्त्वमसि')).toEqual([]);
    expect(await e.inflect('गम्', { lakara: 'la-T', purusha: 3, vacana: 'eka' })).toEqual([]);
  });

  it('respects the AnalyzeOptions shape (limit + minConfidence are optional)', async () => {
    const e = nullEngine;
    expect(await e.analyze('ब्रह्म', { limit: 5 })).toEqual([]);
    expect(await e.analyze('ब्रह्म', { minConfidence: 0.8 })).toEqual([]);
    expect(await e.analyze('ब्रह्म', {})).toEqual([]);
  });

  it('contract: PaniniEngine has the four required methods', () => {
    const e: PaniniEngine = nullEngine;
    expect(typeof e.analyze).toBe('function');
    expect(typeof e.segment).toBe('function');
    expect(typeof e.inflect).toBe('function');
    expect(typeof e.name).toBe('string');
  });

  it('Morphology accepts vibhakti 1..7 and lakāra strings (compile-time only)', () => {
    const m1: Morphology = { vibhakti: 6, vacana: 'bahu', linga: 'm' };
    const m2: Morphology = { lakara: 'la-T', purusha: 3, vacana: 'eka', pada: 'P' };
    expect(m1.vibhakti).toBe(6);
    expect(m2.lakara).toBe('la-T');
  });

  it('ensureEngine resolves to the nullEngine when the feature flag is off', async () => {
    // FEATURES.paniniEngineEnabled defaults to false; ensure that the
    // lazy loader short-circuits to null without attempting any
    // dynamic imports (which would 404 in the test environment).
    const e = await ensureEngine();
    expect(e.name).toBe('null');
    expect(e.available).toBe(false);
  });
});
