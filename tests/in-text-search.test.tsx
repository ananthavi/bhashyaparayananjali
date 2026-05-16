import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { InTextSearch, tokeniseSanskrit } from '@/components/InTextSearch';
import { usePrefs } from '@/state/store';
import type { BhashyaChapter, BhashyaManifest } from '@/types';

/**
 * Build a tiny in-memory manifest + chapter so the component has
 * something to search. Two units, distinct vocabulary, with daṇḍas
 * and a sandhi-merged compound to exercise the new tokeniser.
 */
function makeFixture(): {
  manifest: BhashyaManifest;
  chapter: BhashyaChapter;
} {
  const chapter: BhashyaChapter = {
    id: 'TEST_C01',
    ordinal: 1,
    titleSa: 'प्रथमा वल्ली',
    parentTitleSa: undefined,
    parentOrdinal: undefined,
    kind: 'valli',
    units: [
      {
        id: 'TEST_C01_V01',
        kind: 'mantra',
        ordinal: 1,
        // Sandhi-merged: ब्रह्मविद्या is one token. Daṇḍa-separated text.
        root: 'ॐ ब्रह्मविद्या वै सर्वम्। ज्ञानं परमम्॥',
        blocks: [
          {
            kind: 'bhashya',
            text: 'ब्रह्म इति,आत्मा। तत्त्वमसि।',
          },
        ],
      },
      {
        id: 'TEST_C01_V02',
        kind: 'mantra',
        ordinal: 2,
        root: 'सर्वं खल्विदं ब्रह्म।',
        blocks: [
          {
            kind: 'bhashya',
            text: 'विद्यायाः फलम्।',
          },
        ],
      },
    ],
  };
  const manifest: BhashyaManifest = {
    slug: 'test',
    titleSa: 'Test',
    titleIast: 'Test',
    titleEn: 'Test',
    group: 'upanishad',
    sourceUrl: '',
    fetchedAt: '',
    counts: { chapters: 1, mantras: 2, intros: 0, words: 0 },
    chunked: false,
    chapters: [
      {
        id: chapter.id,
        ordinal: chapter.ordinal,
        titleSa: chapter.titleSa,
        parentTitleSa: chapter.parentTitleSa,
        parentOrdinal: chapter.parentOrdinal,
        kind: chapter.kind,
        units: chapter.units.map((u) => ({
          id: u.id,
          kind: u.kind,
          ordinal: u.ordinal,
        })),
        chunkPath: 'test.json',
        chunkSize: 0,
      },
    ],
  };
  return { manifest, chapter };
}

beforeEach(() => {
  cleanup();
  // Reset script preference between tests so we don't bleed state.
  usePrefs.getState().reset();
});

describe('tokeniseSanskrit', () => {
  it('splits on whitespace', () => {
    expect(tokeniseSanskrit('ब्रह्म ज्ञानम्')).toEqual(['ब्रह्म', 'ज्ञानम्']);
  });

  it('splits on daṇḍa and double-daṇḍa', () => {
    expect(tokeniseSanskrit('सर्वम्। ब्रह्म॥')).toEqual(['सर्वम्', 'ब्रह्म']);
  });

  it('splits on commas and semicolons even without surrounding spaces', () => {
    expect(tokeniseSanskrit('ब्रह्म,आत्मा;विद्या')).toEqual([
      'ब्रह्म',
      'आत्मा',
      'विद्या',
    ]);
  });

  it('returns an empty array for empty / whitespace-only input', () => {
    expect(tokeniseSanskrit('')).toEqual([]);
    expect(tokeniseSanskrit('   ।  ')).toEqual([]);
  });
});

describe('InTextSearch component', () => {
  const noop = (): void => undefined;

  it('matches a Latin query against Devanāgarī corpus (brahma → ब्रह्म)', () => {
    const { manifest, chapter } = makeFixture();
    render(
      <InTextSearch
        manifest={manifest}
        loadedChapters={[chapter]}
        open
        onClose={noop}
        onJump={noop}
      />,
    );
    const input = screen.getByPlaceholderText(
      'Find within this bhāṣya…',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'brahma' } });
    // Two units contain "ब्रह्म" (one as ब्रह्मविद्या compound, one bare).
    expect(screen.getByText(/2 matches/)).toBeTruthy();
  });

  it('finds a token bounded by a daṇḍa (no surrounding whitespace)', () => {
    const { manifest, chapter } = makeFixture();
    render(
      <InTextSearch
        manifest={manifest}
        loadedChapters={[chapter]}
        open
        onClose={noop}
        onJump={noop}
      />,
    );
    const input = screen.getByPlaceholderText(
      'Find within this bhāṣya…',
    ) as HTMLInputElement;
    // "तत्त्वमसि" is followed by a daṇḍa with no space — old whitespace
    // tokeniser would still find it via substring, but searching via
    // "आत्मा" (which is comma-bounded "इति,आत्मा।") proves the comma /
    // daṇḍa split actually works.
    fireEvent.change(input, { target: { value: 'आत्मा' } });
    expect(screen.getByText(/1 match/)).toBeTruthy();
    // And "तत्त्वमसि" (bounded only by a daṇḍa).
    fireEvent.change(input, { target: { value: 'तत्त्वमसि' } });
    expect(screen.getByText(/1 match/)).toBeTruthy();
  });

  it('renders the snippet in the user-selected script (Malayalam)', () => {
    usePrefs.getState().set('script', 'malayalam');
    const { manifest, chapter } = makeFixture();
    render(
      <InTextSearch
        manifest={manifest}
        loadedChapters={[chapter]}
        open
        onClose={noop}
        onJump={noop}
      />,
    );
    const input = screen.getByPlaceholderText(
      'Find within this bhāṣya…',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ब्रह्म' } });
    // The container with the snippet should now bear the malayalam font
    // class, and the snippet text itself should be Malayalam codepoints
    // (range U+0D00–U+0D7F), not Devanāgarī.
    const malayalamRangeRe = /[ഀ-ൿ]/;
    const snippetEls = document.querySelectorAll('.script-malayalam');
    expect(snippetEls.length).toBeGreaterThan(0);
    const text = Array.from(snippetEls)
      .map((el) => el.textContent ?? '')
      .join(' ');
    expect(malayalamRangeRe.test(text)).toBe(true);
    // Should not contain Devanāgarī letters/marks in the rendered
    // snippet. (Daṇḍa U+0964 / U+0965 are shared punctuation across
    // Indic scripts and pass through unchanged — exclude them from
    // this check.)
    const devLetterRe = /[ऀ-ॣ०-ॿ]/;
    expect(devLetterRe.test(text)).toBe(false);
  });

  it('keeps source-of-truth (Devanāgarī) tokens when jumping, even when displaying in Malayalam', () => {
    usePrefs.getState().set('script', 'malayalam');
    const { manifest, chapter } = makeFixture();
    let jumpedTokens: string[] = [];
    render(
      <InTextSearch
        manifest={manifest}
        loadedChapters={[chapter]}
        open
        onClose={noop}
        onJump={(_uid, tokens) => {
          jumpedTokens = tokens;
        }}
      />,
    );
    const input = screen.getByPlaceholderText(
      'Find within this bhāṣya…',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'brahma' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // Tokens propagated to onJump are the raw Devanāgarī variants used
    // for matching — the reader's highlight pipeline depends on that.
    expect(jumpedTokens.length).toBeGreaterThan(0);
    expect(jumpedTokens.some((t) => /[ऀ-ॿ]/.test(t))).toBe(true);
  });
});
