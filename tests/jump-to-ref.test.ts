import { describe, it, expect } from 'vitest';
import { parseRef, resolveRef, jumpToRef } from '@/lib/jump-to-ref';
import type { BhashyaManifest } from '@/types';

/* ----- fixtures: pared-down manifests for each text family ----- */

const GITA: BhashyaManifest = {
  slug: 'gita',
  titleSa: 'श्रीमद्भगवद्गीताभाष्यम्',
  titleIast: 'Śrīmad-bhagavadgītā-bhāṣyam',
  titleEn: 'Gītā',
  group: 'gita',
  sourceUrl: 'https://example.invalid',
  fetchedAt: '2026-01-01',
  counts: { chapters: 18, mantras: 700, intros: 2, words: 0 },
  chunked: true,
  chapters: [
    {
      id: 'BG_C02',
      ordinal: 2,
      kind: 'adhyaya',
      units: [
        { id: 'BG_C02_INTRO1', kind: 'intro', ordinal: 1 },
        { id: 'BG_C02_V01', kind: 'verse', ordinal: 1 },
        { id: 'BG_C02_V13', kind: 'verse', ordinal: 13 },
      ],
      chunkPath: '/x',
      chunkSize: 1,
    },
    {
      id: 'BG_C03',
      ordinal: 3,
      kind: 'adhyaya',
      units: [
        { id: 'BG_C03_V01', kind: 'verse', ordinal: 1 },
        { id: 'BG_C03_V42', kind: 'verse', ordinal: 42 },
      ],
      chunkPath: '/x',
      chunkSize: 1,
    },
  ],
};

const BS: BhashyaManifest = {
  slug: 'brahma-sutra',
  titleSa: 'ब्रह्मसूत्रभाष्यम्',
  titleIast: 'Brahma-sūtra-bhāṣyam',
  titleEn: 'Brahma-sūtra',
  group: 'brahma-sutra',
  sourceUrl: 'https://example.invalid',
  fetchedAt: '2026-01-01',
  counts: { chapters: 16, mantras: 555, intros: 0, words: 0 },
  chunked: true,
  chapters: [
    {
      id: 'BS_C01_S01',
      ordinal: 1,
      parentOrdinal: 1,
      kind: 'paada',
      units: [
        { id: 'BS_C01_S01_V01', kind: 'sutra', ordinal: 1 },
        { id: 'BS_C01_S01_V12', kind: 'sutra', ordinal: 12 },
      ],
      chunkPath: '/x',
      chunkSize: 1,
    },
    {
      id: 'BS_C02_S03',
      ordinal: 3,
      parentOrdinal: 2,
      kind: 'paada',
      units: [{ id: 'BS_C02_S03_V01', kind: 'sutra', ordinal: 1 }],
      chunkPath: '/x',
      chunkSize: 1,
    },
  ],
};

const BR: BhashyaManifest = {
  slug: 'brihadaranyaka',
  titleSa: 'बृहदारण्यकोपनिषद्भाष्यम्',
  titleIast: 'Bṛhadāraṇyaka',
  titleEn: 'Bṛhadāraṇyaka',
  group: 'upanishad',
  sourceUrl: 'https://example.invalid',
  fetchedAt: '2026-01-01',
  counts: { chapters: 47, mantras: 0, intros: 0, words: 0 },
  chunked: true,
  chapters: [
    {
      id: 'BR_C04_S05',
      ordinal: 5,
      parentOrdinal: 4,
      kind: 'brahmanam',
      units: [
        { id: 'BR_C04_S05_INTRO1', kind: 'intro', ordinal: 1 },
        { id: 'BR_C04_S05_V01', kind: 'mantra', ordinal: 1 },
        { id: 'BR_C04_S05_V13', kind: 'mantra', ordinal: 13 },
      ],
      chunkPath: '/x',
      chunkSize: 1,
    },
  ],
};

const ISHA: BhashyaManifest = {
  slug: 'isha',
  titleSa: 'ईशावास्योपनिषद्भाष्यम्',
  titleIast: 'Īśa',
  titleEn: 'Īśa',
  group: 'upanishad',
  sourceUrl: 'https://example.invalid',
  fetchedAt: '2026-01-01',
  counts: { chapters: 1, mantras: 18, intros: 0, words: 0 },
  chunked: false,
  chapters: [
    {
      id: 'IS_C01',
      ordinal: 1,
      kind: 'pseudo',
      units: [
        { id: 'IS_C01_INTRO1', kind: 'intro', ordinal: 1 },
        { id: 'IS_C01_V01', kind: 'mantra', ordinal: 1 },
        { id: 'IS_C01_V07', kind: 'mantra', ordinal: 7 },
        { id: 'IS_C01_V18', kind: 'mantra', ordinal: 18 },
      ],
      chunkPath: '/x',
      chunkSize: 1,
    },
  ],
};

/* ----- parseRef ----- */

describe('jump-to-ref · parseRef', () => {
  it('parses a single ordinal', () => {
    expect(parseRef('7')).toEqual([7]);
    expect(parseRef('  18  ')).toEqual([18]);
  });
  it('parses a 2-part ref', () => {
    expect(parseRef('3.42')).toEqual([3, 42]);
  });
  it('parses a 3-part ref', () => {
    expect(parseRef('1.1.12')).toEqual([1, 1, 12]);
    expect(parseRef('4.5.13')).toEqual([4, 5, 13]);
  });
  it('tolerates a trailing dot', () => {
    expect(parseRef('3.42.')).toEqual([3, 42]);
  });
  it('rejects empty / non-numeric / over-long input', () => {
    expect(parseRef('')).toBeNull();
    expect(parseRef('abc')).toBeNull();
    expect(parseRef('1.a.2')).toBeNull();
    expect(parseRef('1.2.3.4')).toBeNull();
    expect(parseRef('-1')).toBeNull();
    expect(parseRef('0')).toBeNull();
    expect(parseRef('3..42')).toBeNull();
  });
});

/* ----- resolveRef + jumpToRef per text family ----- */

describe('jump-to-ref · Gītā (2-part flat)', () => {
  it('3.42 → BG_C03_V42', () => {
    expect(resolveRef(GITA, [3, 42])).toBe('BG_C03_V42');
  });
  it('2.13 → BG_C02_V13 (skips the intro that shares ordinal 1)', () => {
    expect(resolveRef(GITA, [2, 13])).toBe('BG_C02_V13');
  });
  it('jumpToRef returns ok and the unit id', () => {
    expect(jumpToRef(GITA, '3.42')).toEqual({ ok: true, unitId: 'BG_C03_V42' });
  });
  it('no match for an out-of-range verse', () => {
    const r = jumpToRef(GITA, '3.999');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('no-match');
  });
});

describe('jump-to-ref · Brahma-sūtra (3-part nested)', () => {
  it('1.1.12 → BS_C01_S01_V12', () => {
    expect(resolveRef(BS, [1, 1, 12])).toBe('BS_C01_S01_V12');
  });
  it('2.3.1 → BS_C02_S03_V01', () => {
    expect(resolveRef(BS, [2, 3, 1])).toBe('BS_C02_S03_V01');
  });
  it('2-part ref against a nested manifest falls back to ordinal-only chapter match', () => {
    // BS has no top-level chapter with parentOrdinal=null; the
    // fallback in resolveFlat matches by chapter.ordinal alone, so
    // `1.1` lands on BS_C01_S01_V01. This is best-effort — users are
    // expected to type the full 3-part ref for BS.
    expect(resolveRef(BS, [1, 1])).toBe('BS_C01_S01_V01');
  });
});

describe('jump-to-ref · Bṛhadāraṇyaka (3-part nested with intro)', () => {
  it('4.5.13 → BR_C04_S05_V13', () => {
    expect(resolveRef(BR, [4, 5, 13])).toBe('BR_C04_S05_V13');
  });
  it('4.5.1 prefers the mantra over the intro that shares ordinal 1', () => {
    expect(resolveRef(BR, [4, 5, 1])).toBe('BR_C04_S05_V01');
  });
});

describe('jump-to-ref · Īśa (single-section, 1-part)', () => {
  it('7 → IS_C01_V07', () => {
    expect(resolveRef(ISHA, [7])).toBe('IS_C01_V07');
  });
  it('18 → IS_C01_V18', () => {
    expect(resolveRef(ISHA, [18])).toBe('IS_C01_V18');
  });
  it('jumpToRef accepts a bare ordinal for single-section texts', () => {
    expect(jumpToRef(ISHA, '7')).toEqual({ ok: true, unitId: 'IS_C01_V07' });
  });
  it('out-of-range bare ordinal returns no-match with helpful message', () => {
    const r = jumpToRef(ISHA, '999');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('no-match');
      expect(r.message).toMatch(/Īśa/);
    }
  });
});

describe('jump-to-ref · jumpToRef parse errors', () => {
  it('returns parse error with helpful hint', () => {
    const r = jumpToRef(GITA, 'foo');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('parse');
      expect(r.message).toMatch(/3\.42|1\.1\.12/);
    }
  });
});
