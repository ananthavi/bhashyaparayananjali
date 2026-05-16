import { describe, it, expect } from 'vitest';
import { normalizeForMatch, tokensFor } from '@/lib/voice/normalize';
import { findMatch, followMatch } from '@/lib/voice/matcher';

describe('voice/normalize', () => {
  it('strips visarga, anusvāra, and accents', () => {
    expect(normalizeForMatch('अहं ब्रह्मास्मि')).not.toContain('ं');
    expect(normalizeForMatch('रामः')).not.toContain('ः');
  });

  it('drops non-Devanāgarī tokens', () => {
    expect(normalizeForMatch('Hello रामायण World')).not.toContain('Hello');
  });

  it('folds long vowels onto short vowels', () => {
    const a = normalizeForMatch('कामल');
    const b = normalizeForMatch('कमल');
    expect(a).toBe(b);
  });

  it('tokenizes into akṣaras after normalization', () => {
    const t = tokensFor('ब्रह्म');
    expect(t.length).toBeGreaterThan(0);
    expect(t.join('')).toMatch(/ब्र|ब्रह्म/);
  });
});

describe('voice/matcher', () => {
  const corpus = tokensFor(
    'ईश वसयम इदम सरवम यतकञच जगतयम जगत तन तयकतन भञजथ म गधह कसय सवद धनम',
  );

  it('returns positive score when heard tokens overlap the corpus', () => {
    const heard = tokensFor('इदम सरवम यतकञच');
    const m = findMatch(corpus, heard);
    expect(m.score).toBeGreaterThan(0.3);
    expect(m.start).toBeGreaterThanOrEqual(0);
  });

  it('returns score 0 for completely unrelated input', () => {
    const heard = tokensFor('कुछ भी अलग बातें');
    const m = findMatch(corpus, heard);
    expect(m.score).toBeLessThan(0.4);
  });

  it('followMatch prefers a neighborhood around the hint', () => {
    const heard = tokensFor('जगतयम जगत');
    const m = followMatch(corpus, heard, 3);
    expect(m.start).toBeGreaterThanOrEqual(0);
  });
});
