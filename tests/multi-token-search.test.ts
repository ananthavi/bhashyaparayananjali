import { describe, it, expect, vi } from 'vitest';

describe('autocomplete.suggestForLastToken (next token after space)', () => {
  const FAKE = {
    generatedAt: '2026-01-01',
    total: 100,
    distinct: 5,
    entries: [
      ['ज्ञानम्', 30],
      ['ज्ञानं', 12],
      ['जगत्', 25],
      ['ब्रह्म', 50],
    ] as Array<[string, number]>,
  };

  it("autocompletes only the last token (after space) and returns full string", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(FAKE) } as Response)),
    );
    vi.resetModules();
    const { suggestForLastToken } = await import('@/lib/autocomplete');
    const r = await suggestForLastToken('ब्रह्म ज', 5);
    // Full strings should keep the leading "ब्रह्म " prefix.
    expect(r.length).toBeGreaterThan(0);
    for (const s of r) expect(s.full.startsWith('ब्रह्म ')).toBe(true);
    // Best-ranked suggestion comes first by frequency.
    expect(r[0].token).toBe('ज्ञानम्');
    vi.unstubAllGlobals();
  });

  it('returns empty when the last char is whitespace (word just finished)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(FAKE) } as Response)),
    );
    vi.resetModules();
    const { suggestForLastToken } = await import('@/lib/autocomplete');
    const r = await suggestForLastToken('ब्रह्म ज ', 5);
    expect(r).toEqual([]);
    vi.unstubAllGlobals();
  });

  it('autocompletes a single-token query via the same code path', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(FAKE) } as Response)),
    );
    vi.resetModules();
    const { suggestForLastToken } = await import('@/lib/autocomplete');
    const r = await suggestForLastToken('ब्र', 5);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].full).toBe(r[0].token);
  });
});
