import { describe, it, expect } from 'vitest';
import { expandQueryToDevanagari } from '@/lib/search';

describe('search query expansion', () => {
  it('passes Devanāgarī through unchanged', () => {
    const v = expandQueryToDevanagari('ब्रह्म');
    expect(v).toContain('ब्रह्म');
  });

  it('converts other Indic scripts to Devanāgarī', () => {
    const v = expandQueryToDevanagari('ബ്രഹ്മ');
    expect(v.some((x) => /[ऀ-ॿ]/.test(x))).toBe(true);
  });

  it('handles IAST with diacritics', () => {
    const v = expandQueryToDevanagari('māyā');
    expect(v.some((x) => x.includes('मा'))).toBe(true);
  });

  it('handles plain ASCII without diacritics', () => {
    const v = expandQueryToDevanagari('brahma');
    // At least one variant should contain the Devanāgarī ब्र consonant.
    expect(v.some((x) => x.includes('ब्र'))).toBe(true);
  });

  it('returns multiple plausible variants for ambiguous ASCII', () => {
    const v = expandQueryToDevanagari('atma');
    expect(v.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty for blank input', () => {
    expect(expandQueryToDevanagari('')).toEqual([]);
    expect(expandQueryToDevanagari('   ')).toEqual([]);
  });
});
