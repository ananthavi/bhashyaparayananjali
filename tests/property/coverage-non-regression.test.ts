/**
 * Coverage non-regression gate.
 *
 * Per docs/authoritative-validation-plan.md §4.4, CI tracks the
 * frequency-weighted analyser coverage and fails any PR that drops
 * a per-layer percentage by more than `MAX_REGRESSION_POINTS`. The
 * comparison runs against `tests/baselines/coverage.json`, which is
 * updated deliberately when the analyser improves.
 *
 * Workflow:
 *   1. CI (or a developer) runs `npm run dict:coverage`, writing
 *      `scripts/.cache/coverage.json`.
 *   2. This test reads both files and asserts no layer regressed.
 *   3. When a PR legitimately changes the layer distribution
 *      (e.g. moving forms from `compound` to `inflection`), update
 *      the baseline in the same PR with the new numbers and a
 *      one-line note.
 *
 * If the cache file is missing, the test reports the situation but
 * does NOT fail — coverage runs are slow (full dict + corpus walk)
 * and aren't required for every CI run. The release workflow gates
 * the merge by running coverage explicitly.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const BASELINE = path.join(process.cwd(), 'tests', 'baselines', 'coverage.json');
const CACHE = path.join(process.cwd(), 'scripts', '.cache', 'coverage.json');
const MAX_REGRESSION_POINTS = 1.0;

interface Baseline {
  totalTokens: number;
  distinct: number;
  percentByDistinct: Record<string, number>;
  percentByOccurrence: Record<string, number>;
}

interface CacheFile {
  totalTokens: number;
  distinct: number;
  layerCounts: Record<string, number>;
  layerTokenCounts: Record<string, number>;
}

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n * 10000) / d) / 100;
}

describe('coverage non-regression', () => {
  it('baseline file exists and parses', () => {
    expect(fs.existsSync(BASELINE)).toBe(true);
    const b = JSON.parse(fs.readFileSync(BASELINE, 'utf8')) as Baseline;
    expect(b.percentByOccurrence).toBeDefined();
    expect(b.percentByDistinct).toBeDefined();
  });

  it('latest cache (when present) does not regress any layer', () => {
    if (!fs.existsSync(CACHE)) {
      // Coverage hasn't been re-run. Soft-pass; release workflow runs
      // it explicitly. Surface a console hint so a curious developer
      // knows why this test is one-line.
      // eslint-disable-next-line no-console
      console.info(
        '[coverage] scripts/.cache/coverage.json missing — run `npm run dict:coverage` to compare.',
      );
      return;
    }
    const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')) as Baseline;
    const cur = JSON.parse(fs.readFileSync(CACHE, 'utf8')) as CacheFile;
    const curByDistinct: Record<string, number> = {};
    const curByOcc: Record<string, number> = {};
    for (const k of Object.keys(cur.layerCounts)) {
      curByDistinct[k] = pct(cur.layerCounts[k], cur.distinct);
    }
    for (const k of Object.keys(cur.layerTokenCounts)) {
      curByOcc[k] = pct(cur.layerTokenCounts[k], cur.totalTokens);
    }
    // For every "good" layer (everything but `none`), regression
    // means the percentage went DOWN. For `none`, regression means it
    // went UP — more tokens are now unresolved.
    for (const layer of Object.keys(baseline.percentByDistinct)) {
      const before = baseline.percentByDistinct[layer];
      const after = curByDistinct[layer] ?? 0;
      const delta = layer === 'none' ? after - before : before - after;
      expect(
        delta,
        `distinct.${layer}: baseline ${before}% → current ${after}% (regression > ${MAX_REGRESSION_POINTS} pt)`,
      ).toBeLessThanOrEqual(MAX_REGRESSION_POINTS);
    }
    for (const layer of Object.keys(baseline.percentByOccurrence)) {
      const before = baseline.percentByOccurrence[layer];
      const after = curByOcc[layer] ?? 0;
      const delta = layer === 'none' ? after - before : before - after;
      expect(
        delta,
        `occurrence.${layer}: baseline ${before}% → current ${after}% (regression > ${MAX_REGRESSION_POINTS} pt)`,
      ).toBeLessThanOrEqual(MAX_REGRESSION_POINTS);
    }
  });
});
