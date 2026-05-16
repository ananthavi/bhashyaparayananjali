import { describe, it, expect, vi } from 'vitest';

// Mock /data/search/tokens.json so we don't depend on the live file in tests.
const FAKE = {
  generatedAt: '2026-01-01',
  total: 100,
  distinct: 5,
  entries: [
    ['ब्रह्म', 50],
    ['ब्रह्मण्', 5],
    ['ब्रह्मणः', 20],
    ['ब्रह्मा', 10],
    ['ब्रह्मविद्या', 15],
  ] as Array<[string, number]>,
};

describe('autocomplete.suggest', () => {
  it('returns prefix matches sorted by frequency', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve(FAKE) } as Response),
      ),
    );
    // Force a fresh module import so the cache is reset to use our stub.
    vi.resetModules();
    const { suggest } = await import('@/lib/autocomplete');
    const r = await suggest('ब्रह्म', 4);
    expect(r.length).toBe(4);
    // Top match should be the most-frequent prefix hit.
    expect(r[0].token).toBe('ब्रह्म');
    expect(r[0].freq).toBe(50);
    // Frequency-sorted.
    for (let i = 1; i < r.length; i++) {
      expect(r[i].freq).toBeLessThanOrEqual(r[i - 1].freq);
    }
    vi.unstubAllGlobals();
  });

  it('returns empty for no prefix match', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve(FAKE) } as Response),
      ),
    );
    vi.resetModules();
    const { suggest } = await import('@/lib/autocomplete');
    const r = await suggest('xyz123', 5);
    expect(r).toEqual([]);
    vi.unstubAllGlobals();
  });

  it('returns empty when index is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false } as Response)),
    );
    vi.resetModules();
    const { suggest } = await import('@/lib/autocomplete');
    const r = await suggest('ब्रह्म', 5);
    expect(r).toEqual([]);
    vi.unstubAllGlobals();
  });
});

describe('search query expansion variants', () => {
  it('expands a Devanāgarī token with anusvāra into its m-form too', async () => {
    const { expandQueryToDevanagari } = await import('@/lib/search');
    const v = expandQueryToDevanagari('सर्वं');
    expect(v).toContain('सर्वं');
    // m-restored variant
    expect(v.some((x) => x.endsWith('म्'))).toBe(true);
    // bare-stem variant
    expect(v.some((x) => x === 'सर्व')).toBe(true);
  });

  it('expands a Devanāgarī o-final into visarga variant', async () => {
    const { expandQueryToDevanagari } = await import('@/lib/search');
    const v = expandQueryToDevanagari('देवो');
    expect(v.some((x) => x.endsWith('ः'))).toBe(true);
  });
});
