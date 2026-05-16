import { describe, it, expect } from 'vitest';
import { proposeLemmas } from '@/lib/sandhi/inflect';
import { nearestHeads } from '@/lib/sandhi/fuzzy';

describe('inflection — pronoun table', () => {
  it('resolves तेषाम् as gen. pl. of तद्', () => {
    const ls = proposeLemmas('तेषाम्');
    const tab = ls.find((l) => l.method === 'manual');
    expect(tab?.lemma).toBe('तद्');
    expect(tab?.label).toMatch(/gen\.\s*pl/i);
  });

  it('resolves अस्य as gen. sg. of इदम्', () => {
    const ls = proposeLemmas('अस्य');
    const tab = ls.find((l) => l.method === 'manual');
    expect(tab?.lemma).toBe('इदम्');
  });

  it('resolves उवाच as pf. of वच्', () => {
    const ls = proposeLemmas('उवाच');
    const tab = ls.find((l) => l.method === 'manual');
    expect(tab?.lemma).toBe('वच्');
  });

  it('marks rule-derived candidates with method=rule', () => {
    const ls = proposeLemmas('रामस्य');
    const rule = ls.find((l) => l.lemma === 'राम');
    expect(rule?.method).toBe('rule');
  });

  it('still falls through to suffix table for non-pronoun forms', () => {
    const ls = proposeLemmas('लोकेषु');
    expect(ls.some((l) => l.lemma === 'लोक')).toBe(true);
  });
});

describe('inflection — surface variants', () => {
  it('proposes anusvāra → m', () => {
    const ls = proposeLemmas('सर्वं');
    expect(ls.some((l) => l.lemma === 'सर्वम्')).toBe(true);
  });

  it('proposes visarga aḥ → as', () => {
    // अतो → अतस् (sandhi-restored)
    const ls = proposeLemmas('अतो');
    expect(ls.some((l) => l.lemma === 'अतस्' && l.method === 'manual')).toBe(true);
  });

  it('proposes n-stem -ā → -न्', () => {
    const ls = proposeLemmas('ब्रह्मा');
    expect(ls.some((l) => l.lemma === 'ब्रह्मन्')).toBe(true);
  });
});

describe('fuzzy — nearestHeads', () => {
  const pool = ['ब्रह्म', 'ब्रह्मन्', 'ब्रह्मणः', 'विद्या', 'योग', 'ज्ञान', 'धर्म'];

  it('returns the closest heads by trigram overlap', () => {
    const r = nearestHeads('ब्रह्मण', pool, 3, 0.3);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].lemma).toMatch(/ब्रह्म/);
  });

  it('returns empty for unrelated input below the threshold', () => {
    const r = nearestHeads('कुछ अलग', pool, 3, 0.6);
    expect(r.length).toBe(0);
  });

  it('caps results at topK', () => {
    const r = nearestHeads('ब्रह्म', pool, 2, 0.1);
    expect(r.length).toBeLessThanOrEqual(2);
  });
});
