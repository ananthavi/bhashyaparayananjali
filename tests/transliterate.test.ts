import { describe, it, expect } from 'vitest';
import { transliterate, toDevanagari, detectScript } from '@/lib/transliterate';

describe('transliterate', () => {
  const sample = 'ईशा वास्यमिदं सर्वम्';

  it('passthrough for devanagari', () => {
    expect(transliterate(sample, 'devanagari')).toBe(sample);
  });

  it('converts devanagari to malayalam losslessly via roundtrip', () => {
    const ml = transliterate(sample, 'malayalam');
    expect(ml).not.toBe(sample);
    expect(toDevanagari(ml)).toBe(sample);
  });

  it('converts devanagari to IAST with expected diacritics', () => {
    const iast = transliterate('ब्रह्म', 'iast');
    expect(iast).toBe('brahma');
    expect(transliterate('आत्मन्', 'iast')).toBe('ātman');
  });

  it('converts to tamil, telugu, kannada, bengali, gujarati, oriya, gurmukhi, grantha', () => {
    for (const s of [
      'tamil',
      'telugu',
      'kannada',
      'bengali',
      'gujarati',
      'oriya',
      'gurmukhi',
      'grantha',
    ] as const) {
      const out = transliterate(sample, s);
      expect(out).toBeTruthy();
      expect(out).not.toBe(sample);
    }
  });

  it('detects script correctly', () => {
    expect(detectScript('ब्रह्म')).toBe('devanagari');
    expect(detectScript('ബ്രഹ്മ')).toBe('malayalam');
    expect(detectScript('brahma')).toBe('hk');
    expect(detectScript('brahmā')).toBe('iast');
  });

  it('roundtrips malayalam→devanagari→malayalam', () => {
    const ml = transliterate(sample, 'malayalam');
    const back = toDevanagari(ml);
    const again = transliterate(back, 'malayalam');
    expect(again).toBe(ml);
  });
});
