import { describe, it, expect } from 'vitest';
import { describeUnit, describeUnitFallback } from '@/lib/reference';
import type { BhashyaManifest } from '@/types';

const FIXTURE: BhashyaManifest = {
  slug: 'fixture',
  titleSa: 'परीक्षा',
  titleIast: 'Parīkṣā',
  titleEn: 'Test Fixture',
  group: 'upanishad',
  sourceUrl: 'https://example.invalid',
  fetchedAt: '2026-01-01',
  counts: { chapters: 2, mantras: 4, intros: 0, words: 0 },
  chunked: true,
  chapters: [
    {
      id: 'BR_C04_S05',
      ordinal: 5,
      kind: 'brahmana',
      titleSa: 'पञ्चमं ब्राह्मणम्',
      parentTitleSa: 'चतुर्थोऽध्यायः',
      parentOrdinal: 4,
      units: [
        { id: 'BR_C04_S05_V13', kind: 'mantra', ordinal: 13 },
        { id: 'BR_C04_S05_V14', kind: 'mantra', ordinal: 14 },
      ],
      chunkPath: '/data/bhashya/fixture/BR_C04_S05.json',
      chunkSize: 1024,
    },
    {
      id: 'IS_C01',
      ordinal: 1,
      kind: 'pseudo',
      units: [{ id: 'IS_C01_V07', kind: 'mantra', ordinal: 7 }],
      chunkPath: '/data/bhashya/fixture/IS_C01.json',
      chunkSize: 512,
    },
  ],
};

describe('reference.describeUnit', () => {
  it('decodes a Brihadaranyaka-style nested ID with parent + chapter + mantra', () => {
    const r = describeUnit(FIXTURE, 'BR_C04_S05_V13');
    expect(r.short).toContain('अध्याय 4');
    expect(r.short).toContain('ब्राह्मण 5');
    expect(r.short).toContain('मन्त्र 13');
    expect(r.parentFull).toBe('चतुर्थोऽध्यायः');
    expect(r.chapterFull).toBe('पञ्चमं ब्राह्मणम्');
  });

  it('handles a pseudo-chapter (single-section text) cleanly', () => {
    const r = describeUnit(FIXTURE, 'IS_C01_V07');
    expect(r.short).toContain('मन्त्र 7');
    // Pseudo chapters should not produce "विभाग 1" etc.
    expect(r.short).not.toMatch(/विभाग|खण्ड/);
  });

  it('falls back to a numeric reference when the unit isn\'t in the manifest', () => {
    const r = describeUnit(FIXTURE, 'XX_C99_V99');
    expect(r.short).toMatch(/C99/);
  });

  it('describeUnitFallback always returns a non-empty short label', () => {
    expect(describeUnitFallback('BR_C04_S05_V13').short).toMatch(/C04/);
  });
});
