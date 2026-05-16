import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type {
  BhashyaChapter,
  BhashyaChapterChunk,
  BhashyaManifest,
} from '@/types';

/**
 * Bug regression: clicking a TOC entry or search result for a unit
 * deep inside a not-yet-loaded chapter must navigate to the CORRECT
 * unit, not a neighbour.
 *
 * Failure mode this test guards: the old ReaderPage scrolled exactly
 * once (via a single rAF) using `getElementById` against whatever was
 * in the DOM at that instant — usually a fixed-height skeleton. Once
 * the chapter chunk arrived and rendered the real bhāṣya (much taller
 * than the skeleton), the page reflowed but the viewport stayed at
 * the old offset, leaving the user looking at the wrong sloka.
 *
 * The fix arms a `pendingScrollRef` so a layout effect re-scrolls
 * whenever new chunks load, until the layout settles.
 */

// We mock the loader so we can deterministically delay chapter
// fetches and observe the second scroll attempt happen after the
// chunk arrives.
const loaders = vi.hoisted(() => ({
  manifestPromises: new Map<string, Promise<BhashyaManifest>>(),
  chapterResolvers: new Map<string, (ch: BhashyaChapter) => void>(),
  chapterPromises: new Map<string, Promise<BhashyaChapter>>(),
}));

vi.mock('@/lib/loader', () => ({
  loadManifest: (slug: string) => loaders.manifestPromises.get(slug)!,
  loadChapter: (slug: string, chapterId: string) => {
    const key = `${slug}:${chapterId}`;
    if (!loaders.chapterPromises.has(key)) {
      loaders.chapterPromises.set(
        key,
        new Promise<BhashyaChapter>((resolve) => {
          loaders.chapterResolvers.set(key, resolve);
        }),
      );
    }
    return loaders.chapterPromises.get(key)!;
  },
  loadFullText: () => Promise.reject(new Error('not used')),
  loadCatalog: () => Promise.resolve({ texts: [] }),
}));

vi.mock('@/lib/storage', () => ({
  loadPosition: () => Promise.resolve(null),
  savePosition: () => Promise.resolve(),
  hasBookmark: () => Promise.resolve(false),
  addBookmark: () => Promise.resolve(),
  removeBookmark: () => Promise.resolve(),
  listBookmarks: () => Promise.resolve([]),
}));

vi.mock('@/lib/bulk-dictionary', () => ({
  hydrateHeadIndex: () => Promise.resolve(),
  autoInstallBundled: () => Promise.resolve(),
}));

vi.mock('@/lib/analysis', () => ({
  analyzeWord: () => Promise.resolve({ resolved: false }),
}));

// IntersectionObserver isn't implemented in jsdom.
class MockIntersectionObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
(globalThis as unknown as { IntersectionObserver: typeof MockIntersectionObserver }).IntersectionObserver =
  MockIntersectionObserver;

// scrollTo isn't implemented either; record calls so we can assert.
const scrollCalls: Array<{ top: number; behavior?: ScrollBehavior }> = [];
window.scrollTo = ((opts: ScrollToOptions | number, _y?: number) => {
  if (typeof opts === 'number') {
    scrollCalls.push({ top: _y ?? 0 });
  } else {
    scrollCalls.push({ top: opts.top ?? 0, behavior: opts.behavior });
  }
}) as typeof window.scrollTo;

function buildManifest(): BhashyaManifest {
  // A two-chapter Gītā fixture. Chapter 3 has 5 verses; we will jump
  // to verse 3 (the deep target) before the chunk has loaded.
  return {
    slug: 'gita',
    titleSa: 'श्रीमद्भगवद्गीताभाष्यम्',
    titleIast: 'Gītā',
    titleEn: 'Gītā',
    group: 'gita',
    sourceUrl: 'https://example.invalid',
    fetchedAt: '2026-01-01',
    counts: { chapters: 2, mantras: 7, intros: 0, words: 0 },
    chunked: true,
    chapters: [
      {
        id: 'BG_C01',
        ordinal: 1,
        titleSa: 'प्रथमोऽध्यायः',
        kind: 'adhyaya',
        units: [
          { id: 'BG_C01_V01', kind: 'verse', ordinal: 1 },
          { id: 'BG_C01_V02', kind: 'verse', ordinal: 2 },
        ],
        chunkPath: '/data/bhashya/gita/BG_C01.json',
        chunkSize: 100,
      },
      {
        id: 'BG_C03',
        ordinal: 3,
        titleSa: 'तृतीयोऽध्यायः',
        kind: 'adhyaya',
        units: [
          { id: 'BG_C03_V01', kind: 'verse', ordinal: 1 },
          { id: 'BG_C03_V02', kind: 'verse', ordinal: 2 },
          { id: 'BG_C03_V03', kind: 'verse', ordinal: 3 },
          { id: 'BG_C03_V04', kind: 'verse', ordinal: 4 },
          { id: 'BG_C03_V05', kind: 'verse', ordinal: 5 },
        ],
        chunkPath: '/data/bhashya/gita/BG_C03.json',
        chunkSize: 100,
      },
    ],
  };
}

function buildChapter3(): BhashyaChapter {
  return {
    id: 'BG_C03',
    ordinal: 3,
    titleSa: 'तृतीयोऽध्यायः',
    kind: 'adhyaya',
    units: [1, 2, 3, 4, 5].map((ord) => ({
      id: `BG_C03_V${String(ord).padStart(2, '0')}`,
      kind: 'verse' as const,
      ordinal: ord,
      root: `verse ${ord} root text`,
      blocks: [{ kind: 'bhashya' as const, text: `bhāṣya for verse ${ord}` }],
    })),
  };
}

beforeEach(() => {
  loaders.manifestPromises.clear();
  loaders.chapterPromises.clear();
  loaders.chapterResolvers.clear();
  scrollCalls.length = 0;
  cleanup();
});

describe('ReaderPage navigation: deep-unit jump survives chunk-load layout shift', () => {
  it('records DOM ids that match the unitId for every loaded unit', async () => {
    // Eagerly resolve manifest + chapter 3.
    const manifest = buildManifest();
    loaders.manifestPromises.set('gita', Promise.resolve(manifest));

    const ch3 = buildChapter3();
    const ch3Key = 'gita:BG_C03';
    loaders.chapterPromises.set(ch3Key, Promise.resolve(ch3));

    const { ReaderPage } = await import('@/pages/ReaderPage');

    render(
      <MemoryRouter initialEntries={['/read/gita#BG_C03_V03']}>
        <Routes>
          <Route path="/read/:slug" element={<ReaderPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Wait for manifest + chapter to flush.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // The rendered section MUST have id matching the unitId. This is
    // what `scrollToUnit(unitId)` looks up.
    const target = document.getElementById('BG_C03_V03');
    expect(target).not.toBeNull();
    expect(target?.getAttribute('data-unit-id')).toBe('BG_C03_V03');

    // And the neighbours must have their own correct ids — guards
    // against an off-by-one where the section near the target uses a
    // sibling id by accident.
    expect(document.getElementById('BG_C03_V02')?.getAttribute('data-unit-id')).toBe(
      'BG_C03_V02',
    );
    expect(document.getElementById('BG_C03_V04')?.getAttribute('data-unit-id')).toBe(
      'BG_C03_V04',
    );
  });

  it('DOM ids are unique — no two sections share an id (would scroll to wrong unit)', async () => {
    const manifest = buildManifest();
    loaders.manifestPromises.set('gita', Promise.resolve(manifest));

    // Resolve both chapters synchronously so all real units render.
    loaders.chapterPromises.set(
      'gita:BG_C01',
      Promise.resolve({
        id: 'BG_C01',
        ordinal: 1,
        kind: 'adhyaya',
        units: [1, 2].map((ord) => ({
          id: `BG_C01_V${String(ord).padStart(2, '0')}`,
          kind: 'verse' as const,
          ordinal: ord,
          root: `c1 v${ord}`,
          blocks: [],
        })),
      } as BhashyaChapter),
    );
    loaders.chapterPromises.set('gita:BG_C03', Promise.resolve(buildChapter3()));

    const { ReaderPage } = await import('@/pages/ReaderPage');

    render(
      <MemoryRouter initialEntries={['/read/gita']}>
        <Routes>
          <Route path="/read/:slug" element={<ReaderPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const sections = document.querySelectorAll<HTMLElement>('[data-unit-id]');
    expect(sections.length).toBeGreaterThan(0);
    const ids = [...sections].map((s) => s.id);
    const seen = new Set<string>();
    for (const id of ids) {
      expect(seen.has(id), `duplicate DOM id: ${id}`).toBe(false);
      seen.add(id);
    }
    // Each rendered unit's id MUST also exist as a unit in the
    // manifest — guards against a stale stubId leaking past a chunk
    // load.
    const allUnitIds = new Set(
      manifest.chapters.flatMap((c) => c.units.map((u) => u.id)),
    );
    for (const id of ids) expect(allUnitIds.has(id)).toBe(true);
  });

  it('TOC click on a deep unit lands on the correct unitId (regression)', async () => {
    const manifest = buildManifest();
    loaders.manifestPromises.set('gita', Promise.resolve(manifest));
    loaders.chapterPromises.set(
      'gita:BG_C01',
      Promise.resolve({
        id: 'BG_C01',
        ordinal: 1,
        kind: 'adhyaya',
        units: [
          {
            id: 'BG_C01_V01',
            kind: 'verse' as const,
            ordinal: 1,
            root: 'r',
            blocks: [],
          },
          {
            id: 'BG_C01_V02',
            kind: 'verse' as const,
            ordinal: 2,
            root: 'r',
            blocks: [],
          },
        ],
      } as BhashyaChapter),
    );
    loaders.chapterPromises.set('gita:BG_C03', Promise.resolve(buildChapter3()));

    const { ReaderPage } = await import('@/pages/ReaderPage');

    render(
      <MemoryRouter initialEntries={['/read/gita']}>
        <Routes>
          <Route path="/read/:slug" element={<ReaderPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Wait for manifest + chunks.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Open TOC by clicking the toolbar button (aria-label: "Index of
    // chapters and slokas").
    const tocButton = screen.getByLabelText(/index of chapters/i);
    await act(async () => {
      fireEvent.click(tocButton);
    });

    // Click verse-3 of chapter-3 inside the drawer. The TOC renders
    // a button per unit with title={unit.id} — use that as a stable
    // selector.
    const drawer = document.querySelector<HTMLElement>(
      'aside[aria-label="Table of contents"]',
    );
    expect(drawer).not.toBeNull();
    const button = drawer!.querySelector<HTMLButtonElement>(
      'button[title="BG_C03_V03"]',
    );
    expect(button).not.toBeNull();
    await act(async () => {
      fireEvent.click(button!);
    });

    // After the click, ParayanamBar's "current section" pill MUST
    // reflect the new unit. The pill is rendered with the current
    // unit ordinal, e.g. "अध्याय 3 · श्लोक 3". This is the most
    // direct user-facing assertion that "the click took us to the
    // right unit".
    const refMatches = await screen.findAllByText(/अध्याय 3 · श्लोक 3/);
    expect(refMatches.length).toBeGreaterThan(0);

    // And the rendered DOM still has the right id at that anchor.
    const target = document.getElementById('BG_C03_V03');
    expect(target).not.toBeNull();
    expect(target?.getAttribute('data-unit-id')).toBe('BG_C03_V03');
  });

  it('hash-jump to deep unit re-scrolls after the chapter chunk arrives', async () => {
    const manifest = buildManifest();
    loaders.manifestPromises.set('gita', Promise.resolve(manifest));

    // Hold the chapter promise unresolved so we can observe the
    // skeleton-then-real layout transition.
    const ch3Promise = new Promise<BhashyaChapter>((resolve) => {
      loaders.chapterResolvers.set('gita:BG_C03', resolve);
    });
    loaders.chapterPromises.set('gita:BG_C03', ch3Promise);

    const { ReaderPage } = await import('@/pages/ReaderPage');

    render(
      <MemoryRouter initialEntries={['/read/gita#BG_C03_V03']}>
        <Routes>
          <Route path="/read/:slug" element={<ReaderPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Allow manifest to resolve. Skeletons render.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Skeleton MUST exist at the target id so the first scroll attempt
    // has something to land on.
    const skeleton = document.getElementById('BG_C03_V03');
    expect(skeleton).not.toBeNull();

    // Resolve chapter. The layout effect should re-issue scrollTo
    // because chunks-state changed.
    const beforeChunk = scrollCalls.length;
    await act(async () => {
      loaders.chapterResolvers.get('gita:BG_C03')!(buildChapter3());
      await ch3Promise;
      await Promise.resolve();
      await Promise.resolve();
    });

    // After chunk arrival there must be at least one additional scroll
    // call — that's how we land on the right sloka after the layout
    // grew from skeleton to full bhāṣya.
    expect(scrollCalls.length).toBeGreaterThan(beforeChunk);

    // And the rendered DOM MUST still expose the correct id for the
    // target.
    const realEl = document.getElementById('BG_C03_V03');
    expect(realEl?.getAttribute('data-unit-id')).toBe('BG_C03_V03');
  });
});
