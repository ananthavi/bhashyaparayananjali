import { describe, it, expect } from 'vitest';
import { lookup } from '@/lib/dictionary';

describe('dictionary.lookup', () => {
  it('exact-matches a seed entry', () => {
    const r = lookup('ब्रह्म');
    expect(r.exact).toBe(true);
    expect(r.matches[0].iast).toBe('brahma');
  });

  it('strips a common suffix to find the lemma', () => {
    const r = lookup('ब्रह्मणः');
    expect(r.exact).toBe(false);
    expect(r.lemma ?? '').toMatch(/ब्रह्म/);
    expect(r.matches.length).toBeGreaterThan(0);
  });

  it('returns empty when nothing matches', () => {
    const r = lookup('जलदजलदजलद');
    expect(r.matches.length).toBe(0);
  });

  it('handles empty input', () => {
    const r = lookup('');
    expect(r.matches).toEqual([]);
  });

  it('normalizes punctuation', () => {
    const r = lookup('आत्मा।');
    expect(r.matches.length).toBeGreaterThan(0);
  });
});
