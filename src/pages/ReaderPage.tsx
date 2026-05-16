import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import type {
  BhashyaChapter,
  BhashyaManifest,
  BhashyaText,
  BhashyaUnit,
  ChapterStub,
  ScriptCode,
} from '@/types';
import { loadManifest, loadChapter, loadFullText } from '@/lib/loader';
import { ReaderToolbar } from '@/components/ReaderToolbar';
import { TocDrawer } from '@/components/TocDrawer';
import { WordPopover } from '@/components/WordPopover';
import { BhashyaUnitView } from '@/components/BhashyaUnitView';
import { usePrefs } from '@/state/store';
import { analyzeWord, type AnalysisReport } from '@/lib/analysis';
import { hydrateHeadIndex, autoInstallBundled } from '@/lib/bulk-dictionary';
import { savePosition, loadPosition } from '@/lib/storage';
import { VoiceFollow } from '@/components/VoiceFollow';
import { buildVoiceCorpus, type VoiceCorpus } from '@/lib/voice/corpus';
import { describeUnit } from '@/lib/reference';
import { InTextSearch } from '@/components/InTextSearch';
import { FEATURES } from '@/lib/features';

/**
 * The main parayanam reader, with progressive chapter loading.
 *
 * On entry we fetch only the manifest (1–73 KB). The TOC, breadcrumb,
 * prev/next, and "current section" pill all render immediately from
 * the chapter stubs. Chapters are then fetched lazily as they near
 * the viewport via an IntersectionObserver on per-chapter "rails".
 * Voice follow and the in-app substring search both need the full
 * corpus; they trigger a background `loadFullText()` only when the
 * user actually invokes them.
 */
export function ReaderPage(): JSX.Element {
  const params = useParams<{ slug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const prefs = usePrefs();

  const [manifest, setManifest] = useState<BhashyaManifest | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tocOpen, setTocOpen] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [activeUnitId, setActiveUnitId] = useState<string | undefined>();
  const [voiceUnitId, setVoiceUnitId] = useState<string | undefined>();
  const voiceHintRef = useRef<number | null>(null);
  const [inTextSearchOpen, setInTextSearchOpen] = useState(false);
  /**
   * Stores the unit we are currently trying to scroll to.
   *
   * Why a ref: when the user clicks a TOC entry or a search result for
   * a unit whose chapter chunk hasn't been fetched yet, only a
   * `UnitSkeleton` (a fixed-height placeholder) exists in the DOM at
   * that id. A single `scrollIntoView` call against the skeleton lands
   * the viewport at one offset; once the chunk finishes loading the
   * full bhāṣya is rendered above and below — drastically growing the
   * page height and pushing the target hundreds of pixels away. The
   * user sees the WRONG sloka because we never re-scrolled.
   *
   * Solution: every jump records the target in this ref. A layout
   * effect watching `chunks` re-issues the scroll whenever a chunk
   * loads, until the ref's `attempts` counter is exhausted (or the
   * user manually scrolls, which clears the ref).
   */
  const pendingScrollRef = useRef<{ unitId: string; attempts: number } | null>(
    null,
  );
  /** Devanāgarī tokens to wrap in <mark> inside the unit. Sourced
   *  from `?h=tok1,tok2` on the URL when the user lands here from a
   *  search result. */
  const highlightTokens = useMemo<ReadonlySet<string>>(() => {
    const sp = new URLSearchParams(location.search);
    const h = sp.get('h');
    if (!h) return new Set<string>();
    return new Set(
      h
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }, [location.search]);
  const [singleIdx, setSingleIdx] = useState(0);
  const autoScrollRaf = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /** chapter id → loaded body (or 'pending' while in flight). */
  const [chunks, setChunks] = useState<Map<string, BhashyaChapter | 'pending'>>(
    () => new Map(),
  );

  /** The voice-follow corpus is built from the full text. We fetch it
   *  lazily so opening the reader doesn't pull a multi-MB download
   *  before the user actually taps the mic. */
  const [voiceCorpus, setVoiceCorpus] = useState<VoiceCorpus | null>(null);
  const voiceLoadingRef = useRef<Promise<void> | null>(null);

  // Flat unit list for prev/next, swipe, and ParayanamBar position pill.
  // Sourced from the manifest stubs so it's available before any chunk loads.
  interface FlatStub {
    chapterIdx: number;
    chapter: ChapterStub;
    unit: { id: string; kind: BhashyaUnit['kind']; ordinal: number };
  }
  const flatStubs: FlatStub[] = useMemo(() => {
    if (!manifest) return [];
    const out: FlatStub[] = [];
    manifest.chapters.forEach((ch, chapterIdx) => {
      for (const u of ch.units) out.push({ chapterIdx, chapter: ch, unit: u });
    });
    return out;
  }, [manifest]);

  const unitIndex = useMemo(() => {
    const m = new Map<string, number>();
    flatStubs.forEach((fu, i) => m.set(fu.unit.id, i));
    return m;
  }, [flatStubs]);

  /* ----- chapter loading ----- */

  const requestChapter = useCallback(
    (slug: string, chapterId: string) => {
      setChunks((prev) => {
        if (prev.has(chapterId)) return prev;
        const next = new Map(prev);
        next.set(chapterId, 'pending');
        return next;
      });
      void loadChapter(slug, chapterId)
        .then((ch) => {
          setChunks((prev) => {
            const next = new Map(prev);
            next.set(chapterId, ch);
            return next;
          });
        })
        .catch(() => {
          setChunks((prev) => {
            const next = new Map(prev);
            next.delete(chapterId); // allow retry
            return next;
          });
        });
    },
    [],
  );

  // Load manifest on slug change.
  useEffect(() => {
    if (!params.slug) return;
    setManifest(null);
    setErr(null);
    setChunks(new Map());
    pendingScrollRef.current = null;
    loadManifest(params.slug)
      .then(setManifest)
      .catch((e: Error) => setErr(e.message));
  }, [params.slug]);

  // Restore reading position once manifest loads.
  useEffect(() => {
    if (!manifest) return;
    const hashUnit = decodeURIComponent(location.hash.replace(/^#/, ''));
    const target = hashUnit;
    if (target) {
      // Verify the hash actually names a unit we know about — guards
      // against random fragments from stale links.
      const stub = flatStubs.find((fu) => fu.unit.id === target);
      if (stub) {
        ensureChapterForUnit(target);
        setActiveUnitId(target);
        const idx = flatStubs.findIndex((fu) => fu.unit.id === target);
        if (idx >= 0) setSingleIdx(idx);
        armPendingScroll(target);
        return;
      }
      // Unknown hash → fall through to saved-position / first-chapter.
    }
    void loadPosition(manifest.slug).then((p) => {
      if (!p) {
        // First time: load chapter 1 immediately so the reader isn't blank.
        const first = manifest.chapters[0];
        if (first) requestChapter(manifest.slug, first.id);
        return;
      }
      ensureChapterForUnit(p.unitId);
      setActiveUnitId(p.unitId);
      const idx = flatStubs.findIndex((fu) => fu.unit.id === p.unitId);
      if (idx >= 0) setSingleIdx(idx);
      armPendingScroll(p.unitId);
    });
    function ensureChapterForUnit(unitId: string): void {
      const stub = flatStubs.find((fu) => fu.unit.id === unitId);
      if (stub && manifest) requestChapter(manifest.slug, stub.chapter.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest, flatStubs, location.hash, requestChapter]);

  // IntersectionObserver: as a chapter "rail" comes within ~600px of the
  // viewport, request that chapter (and an immediate neighbor on either
  // side) so scrolling never sees a placeholder.
  useEffect(() => {
    if (!manifest || !containerRef.current) return;
    const slug = manifest.slug;
    const rails = containerRef.current.querySelectorAll<HTMLElement>('[data-chapter-rail]');
    if (rails.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const id = (e.target as HTMLElement).dataset.chapterRail;
          if (!id) continue;
          requestChapter(slug, id);
          // Pre-load neighbors.
          const idx = manifest.chapters.findIndex((c) => c.id === id);
          const prev = manifest.chapters[idx - 1];
          const next = manifest.chapters[idx + 1];
          if (prev) requestChapter(slug, prev.id);
          if (next) requestChapter(slug, next.id);
        }
      },
      { rootMargin: '600px 0px 600px 0px', threshold: 0 },
    );
    rails.forEach((r) => obs.observe(r));
    return () => obs.disconnect();
  }, [manifest, requestChapter, prefs.continuous, singleIdx]);

  // Observe which unit is currently visible — uses [data-unit-id] like before.
  useEffect(() => {
    if (!manifest || !containerRef.current) return;
    const els = containerRef.current.querySelectorAll<HTMLElement>('[data-unit-id]');
    if (els.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) {
          const id = (visible.target as HTMLElement).dataset.unitId;
          if (id) setActiveUnitId(id);
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.3, 0.6] },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [manifest, chunks, prefs.continuous, singleIdx]);

  // Save reading position (debounced).
  useEffect(() => {
    if (!manifest || !activeUnitId) return;
    const timer = setTimeout(() => {
      void savePosition({
        textSlug: manifest.slug,
        unitId: activeUnitId,
        scrollRatio: window.scrollY / Math.max(1, document.body.scrollHeight),
        updatedAt: Date.now(),
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [manifest, activeUnitId]);

  // Auto-scroll for hands-free recitation.
  useEffect(() => {
    if (!prefs.continuous || prefs.autoScrollWpm <= 0) return;
    // The slider exposes a 0-20 range tuned for parayanam pace: at the
    // top end (wpm=20) we want roughly one mantra (~500-700px including
    // bhāṣya prose) every ~10-15 s, i.e. ~60 px/sec. Linear scaling
    // keeps the lowest non-zero values (wpm=2) gentle for slow chant.
    const pxPerSec = prefs.autoScrollWpm * 3;
    let last = performance.now();
    const tick = (now: number): void => {
      const dt = (now - last) / 1000;
      last = now;
      window.scrollBy({ top: pxPerSec * dt, behavior: 'auto' });
      autoScrollRaf.current = requestAnimationFrame(tick);
    };
    autoScrollRaf.current = requestAnimationFrame(tick);
    return () => {
      if (autoScrollRaf.current !== null) cancelAnimationFrame(autoScrollRaf.current);
    };
  }, [prefs.continuous, prefs.autoScrollWpm]);

  // Swipe in single-mantra mode.
  useEffect(() => {
    if (prefs.continuous) return;
    let startX = 0;
    const onTouchStart = (e: TouchEvent): void => {
      startX = e.touches[0].clientX;
    };
    const onTouchEnd = (e: TouchEvent): void => {
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) < 60) return;
      if (dx < 0 && singleIdx < flatStubs.length - 1) setSingleIdx((i) => i + 1);
      else if (dx > 0 && singleIdx > 0) setSingleIdx((i) => i - 1);
    };
    window.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [prefs.continuous, singleIdx, flatStubs.length]);

  // Hydrate the dictionary head index + auto-install bundled lexicons.
  useEffect(() => {
    void (async () => {
      await hydrateHeadIndex();
      await autoInstallBundled();
      await hydrateHeadIndex();
    })();
  }, []);

  /* ----- voice corpus: fetch all chapters lazily on first mic tap ----- */

  const ensureVoiceCorpus = useCallback((): void => {
    if (voiceCorpus || !manifest) return;
    if (voiceLoadingRef.current) return;
    voiceLoadingRef.current = (async () => {
      const text: BhashyaText = await loadFullText(manifest.slug);
      setVoiceCorpus(buildVoiceCorpus(text));
    })();
  }, [voiceCorpus, manifest]);

  /* ----- popover analyzer ----- */

  const handleWordTap = useCallback(
    (devWord: string) => {
      setPopoverOpen(true);
      setAnalyzing(true);
      setAnalysis({
        query: devWord,
        normalized: devWord,
        direct: [],
        inflections: [],
        compounds: [],
        fuzzy: [],
        bhashyaGlosses: [],
        resolved: false,
      });
      void analyzeWord(devWord, { textSlug: manifest?.slug })
        .then((r) => setAnalysis(r))
        .finally(() => setAnalyzing(false));
    },
    [manifest?.slug],
  );

  /**
   * Arm the pending-scroll mechanism: stores the target unitId so the
   * layout effect re-runs `scrollToUnit` whenever new chunks load (up
   * to a small attempt budget) AND issues an immediate first scroll.
   * This is what makes navigation reliable even when the chapter chunk
   * hasn't loaded yet — the skeleton placeholder is the wrong height
   * for the final layout, so a single scroll lands somewhere wrong.
   *
   * In single-mantra mode there's only ever one unit on screen at a
   * time, so we scroll to the very top of the document instead of
   * hunting the element — much more reliable when the page is
   * re-rendering with a new singleIdx.
   */
  const armPendingScroll = useCallback(
    (unitId: string): void => {
      if (!prefs.continuous) {
        // Single-mantra mode: target is always the only thing on screen.
        // Wait one paint for React to commit the new singleIdx.
        pendingScrollRef.current = null;
        requestAnimationFrame(() => {
          window.scrollTo({ top: 0, behavior: 'auto' });
        });
        return;
      }
      pendingScrollRef.current = { unitId, attempts: 0 };
      // First attempt — after React commits the new singleIdx / state.
      requestAnimationFrame(() => {
        if (pendingScrollRef.current?.unitId === unitId) {
          scrollToUnit(unitId);
        }
      });
    },
    [prefs.continuous],
  );

  const jumpToUnit = useCallback(
    (unitId: string) => {
      if (!manifest) return;
      setTocOpen(false);
      const stub = flatStubs.find((fu) => fu.unit.id === unitId);
      if (!stub) return; // unknown unit → no-op rather than wrong jump.
      requestChapter(manifest.slug, stub.chapter.id);
      const idx = flatStubs.findIndex((fu) => fu.unit.id === unitId);
      if (idx >= 0) setSingleIdx(idx);
      // Set activeUnitId synchronously so the ParayanamBar reflects the
      // jump immediately — the IntersectionObserver will only re-fire
      // once the chapter chunk has loaded and the element is in view,
      // which can lag visibly on a long scroll.
      setActiveUnitId(unitId);
      const targetHash = `#${unitId}`;
      // Only navigate if the hash actually changes — pushing the same
      // hash a second time is a no-op for react-router but means the
      // location.hash effect won't re-fire, so we always need
      // armPendingScroll to drive the actual scroll.
      if (location.hash !== targetHash) {
        navigate(`${location.pathname}${location.search}${targetHash}`, {
          replace: true,
        });
      }
      armPendingScroll(unitId);
    },
    [
      manifest,
      flatStubs,
      navigate,
      location.pathname,
      location.search,
      location.hash,
      requestChapter,
      armPendingScroll,
    ],
  );

  /**
   * Layout effect: every time the loaded chunks map changes (a new
   * chapter just arrived, or a skeleton was just replaced with real
   * content), re-issue the scroll if we still have a pending target.
   *
   * `useLayoutEffect` so we measure / scroll BEFORE the browser paints
   * the new layout — avoids the visual flash of "settle on wrong
   * place, then jump to right place".
   *
   * We retry up to 4 times: enough for the target chapter chunk and
   * the surrounding neighbors that the IntersectionObserver fetches as
   * we scroll into them.
   */
  useLayoutEffect(() => {
    const pending = pendingScrollRef.current;
    if (!pending) return;
    const el = document.getElementById(pending.unitId);
    if (!el) return;
    scrollToUnit(pending.unitId);
    pending.attempts += 1;
    if (pending.attempts >= 4) {
      pendingScrollRef.current = null;
    }
  }, [chunks, prefs.continuous, singleIdx]);

  const goPrev = useCallback(() => {
    if (prefs.continuous) {
      const i = activeUnitId ? (unitIndex.get(activeUnitId) ?? 0) : 0;
      const target = flatStubs[Math.max(0, i - 1)];
      if (target) jumpToUnit(target.unit.id);
    } else {
      setSingleIdx((i) => {
        const next = Math.max(0, i - 1);
        const target = flatStubs[next];
        if (target) setActiveUnitId(target.unit.id);
        return next;
      });
    }
  }, [prefs.continuous, activeUnitId, unitIndex, flatStubs, jumpToUnit]);

  const goNext = useCallback(() => {
    if (prefs.continuous) {
      const i = activeUnitId ? (unitIndex.get(activeUnitId) ?? 0) : 0;
      const target = flatStubs[Math.min(flatStubs.length - 1, i + 1)];
      if (target) jumpToUnit(target.unit.id);
    } else {
      setSingleIdx((i) => {
        const next = Math.min(flatStubs.length - 1, i + 1);
        const target = flatStubs[next];
        if (target) setActiveUnitId(target.unit.id);
        return next;
      });
    }
  }, [prefs.continuous, activeUnitId, unitIndex, flatStubs, jumpToUnit]);

  const handleVoiceMatch = useCallback(
    (m: { unitId: string; start: number; end: number; score: number }) => {
      voiceHintRef.current = m.start;
      setVoiceUnitId(m.unitId);
      if (prefs.voiceAutoScroll) scheduleScrollToUnit(m.unitId);
    },
    [prefs.voiceAutoScroll],
  );

  /* ----- render ----- */

  if (err) {
    return (
      <div className="p-6 text-center opacity-80">
        <div>Couldn't load this text.</div>
        <div className="text-xs mt-2 opacity-70">{err}</div>
      </div>
    );
  }
  if (!manifest) {
    return (
      <div className="p-6 text-center opacity-70 animate-pulse">Loading bhāṣya…</div>
    );
  }

  const visibleStubs = prefs.continuous
    ? flatStubs
    : flatStubs.slice(singleIdx, singleIdx + 1);

  const currentReference = activeUnitId ? describeUnit(manifest, activeUnitId).short : '';

  return (
    <>
      <ReaderToolbar
        manifest={manifest}
        onToggleToc={() => setTocOpen((o) => !o)}
        tocOpen={tocOpen}
        onOpenInTextSearch={() => setInTextSearchOpen(true)}
        onJumpToUnit={jumpToUnit}
        voiceButton={
          FEATURES.voiceEnabled ? (
            <VoiceFollow
              corpus={voiceCorpus}
              hint={voiceHintRef.current ?? undefined}
              onActivate={ensureVoiceCorpus}
              onMatch={handleVoiceMatch}
              onStop={() => {
                setVoiceUnitId(undefined);
                voiceHintRef.current = null;
              }}
            />
          ) : undefined
        }
      />
      <TocDrawer
        manifest={manifest}
        open={tocOpen}
        onClose={() => setTocOpen(false)}
        onJump={jumpToUnit}
        activeUnitId={activeUnitId}
      />

      <div ref={containerRef} className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center py-6">
          <div className="script-devanagari text-3xl mantra-emphasis">{manifest.titleSa}</div>
          <div className="iast-text opacity-70 text-sm mt-1">{manifest.titleIast}</div>
          <div className="text-xs opacity-60 mt-2">
            {manifest.counts.chapters} sections · {manifest.counts.mantras} mantras/sutras ·{' '}
            {manifest.counts.words.toLocaleString()} words
            {manifest.chunked && (
              <>
                {' · '}
                <span className="opacity-80">
                  loaded chapter-by-chapter as you scroll
                </span>
              </>
            )}
          </div>
          {currentReference && (
            <div className="mt-3 inline-flex items-center gap-1 chip script-devanagari">
              {currentReference}
            </div>
          )}
        </div>

        {visibleStubs.map((stub, vIdx) => {
          const ch = chunks.get(stub.chapter.id);
          const newChapter =
            vIdx === 0 || stub.chapterIdx !== visibleStubs[vIdx - 1].chapterIdx;
          return (
            <div
              key={stub.unit.id}
              data-chapter-rail={stub.chapter.id}
            >
              {newChapter && (
                <ChapterHeader
                  chapter={stub.chapter}
                  parentTitle={stub.chapter.parentTitleSa}
                />
              )}
              {ch && ch !== 'pending' ? (
                renderUnit(
                  ch,
                  stub.unit.id,
                  manifest.slug,
                  prefs.script,
                  handleWordTap,
                  voiceUnitId,
                  highlightTokens,
                )
              ) : (
                <UnitSkeleton stubId={stub.unit.id} />
              )}
            </div>
          );
        })}

        <div className="mt-24 text-xs text-center opacity-70 py-6">
          Source:{' '}
          <a href={manifest.sourceUrl} target="_blank" rel="noreferrer" className="underline">
            advaitasharada.sringeri.net
          </a>
        </div>
      </div>

      <ParayanamBar
        manifest={manifest}
        flatStubs={flatStubs}
        activeUnitId={activeUnitId}
        singleIdx={singleIdx}
        continuous={prefs.continuous}
        onPrev={goPrev}
        onNext={goNext}
        onOpenIndex={() => setTocOpen(true)}
      />

      <WordPopover
        open={popoverOpen}
        report={analysis}
        loading={analyzing}
        script={prefs.script}
        manifest={manifest}
        textSlug={manifest?.slug ?? null}
        onClose={() => setPopoverOpen(false)}
        onLookup={(w) => handleWordTap(w)}
        onJumpToUnit={(uid) => {
          setPopoverOpen(false);
          jumpToUnit(uid);
        }}
      />

      <InTextSearch
        manifest={manifest}
        loadedChapters={[...chunks.values()].filter(
          (c): c is BhashyaChapter => c !== 'pending',
        )}
        open={inTextSearchOpen}
        onClose={() => setInTextSearchOpen(false)}
        onJump={(unitId, tokens) => {
          // Encode highlight tokens via ?h=… exactly like a search hit so
          // the existing in-page highlight pipeline picks them up.
          const params = new URLSearchParams(location.search);
          params.set('h', tokens.join(','));
          navigate(`${location.pathname}?${params.toString()}#${unitId}`, {
            replace: false,
          });
          // jumpToUnit will set activeUnitId synchronously and request the chapter.
          jumpToUnit(unitId);
        }}
      />
    </>
  );
}

function renderUnit(
  chapter: BhashyaChapter,
  unitId: string,
  textSlug: string,
  script: ScriptCode,
  onWordTap: (w: string) => void,
  voiceUnitId: string | undefined,
  highlights: ReadonlySet<string>,
): JSX.Element | null {
  const unit = chapter.units.find((u) => u.id === unitId);
  if (!unit) return null;
  return (
    <BhashyaUnitView
      textSlug={textSlug}
      chapter={chapter}
      unit={unit}
      script={script}
      onWordTap={onWordTap}
      unitNumber={unit.ordinal}
      voiceActive={unit.id === voiceUnitId}
      highlights={highlights.size > 0 ? highlights : undefined}
    />
  );
}

function UnitSkeleton({ stubId }: { stubId: string }): JSX.Element {
  return (
    <section
      id={stubId}
      data-unit-id={stubId}
      className="py-4 sm:py-6 animate-pulse"
      aria-busy
    >
      <div className="mantra-card h-24 flex items-center justify-center opacity-60 text-xs">
        <span className="script-devanagari">⌛ लोड्यते…</span>
      </div>
    </section>
  );
}

function ChapterHeader({
  chapter,
  parentTitle,
}: {
  chapter: ChapterStub;
  parentTitle?: string;
}): JSX.Element {
  return (
    <div className="rule pt-8 mt-4">
      <div className="flex items-baseline gap-2 text-center justify-center flex-wrap">
        {parentTitle && (
          <span className="script-devanagari opacity-80 text-sm">{parentTitle}</span>
        )}
        {chapter.titleSa && (
          <span className={clsx('script-devanagari', 'text-xl mantra-emphasis')}>
            {chapter.titleSa}
          </span>
        )}
      </div>
    </div>
  );
}

function ParayanamBar({
  manifest,
  flatStubs,
  activeUnitId,
  singleIdx,
  continuous,
  onPrev,
  onNext,
  onOpenIndex,
}: {
  manifest: BhashyaManifest;
  flatStubs: Array<{
    chapterIdx: number;
    chapter: ChapterStub;
    unit: { id: string; kind: BhashyaUnit['kind']; ordinal: number };
  }>;
  activeUnitId?: string;
  singleIdx: number;
  continuous: boolean;
  onPrev: () => void;
  onNext: () => void;
  onOpenIndex: () => void;
}): JSX.Element {
  const total = flatStubs.length;
  const currentIdx = continuous
    ? activeUnitId
      ? Math.max(
          0,
          flatStubs.findIndex((fu) => fu.unit.id === activeUnitId),
        )
      : 0
    : singleIdx;
  const currentUnit = flatStubs[currentIdx]?.unit;
  const ref = currentUnit ? describeUnit(manifest, currentUnit.id) : null;

  return (
    <div
      className="fixed left-0 right-0 bottom-0 border-t backdrop-blur z-20"
      style={{
        background: 'color-mix(in srgb, var(--bg) 92%, transparent)',
        borderColor: 'var(--rule)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="max-w-3xl mx-auto flex items-center px-2 sm:px-4 h-14 gap-2">
        <button
          className="btn px-2 sm:px-3"
          onClick={onPrev}
          disabled={currentIdx === 0}
          aria-label="Previous mantra"
          title="Previous"
        >
          <span aria-hidden>←</span>
          <span className="hidden sm:inline ml-1">Prev</span>
        </button>

        <button
          type="button"
          onClick={onOpenIndex}
          className="grow min-w-0 surface rounded-lg flex items-center justify-center gap-2 px-3 py-1.5 hover:bg-[color:var(--surface-2)] transition-colors"
          style={{ background: 'var(--bg)' }}
          aria-label="Open chapter and sloka index"
          title="Tap to choose any chapter or sloka"
        >
          <span className="text-xs uppercase opacity-60 tracking-widest">
            {currentIdx + 1}/{total}
          </span>
          <span className="script-devanagari truncate">{ref?.short ?? '—'}</span>
          <span aria-hidden className="opacity-60 text-xs">
            ☰
          </span>
        </button>

        <button
          className="btn btn-primary px-2 sm:px-3"
          onClick={onNext}
          disabled={currentIdx >= total - 1}
          aria-label="Next mantra"
          title="Next"
        >
          <span className="hidden sm:inline mr-1">Next</span>
          <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}

let pendingScrollTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleScrollToUnit(unitId: string): void {
  if (pendingScrollTimer) return;
  pendingScrollTimer = setTimeout(() => {
    pendingScrollTimer = null;
    scrollToUnit(unitId);
  }, 500);
}

/**
 * Scroll the viewport so that the given unit's top edge is just below
 * the toolbar (~60px gutter). The element MUST exist in the DOM —
 * either as a `BhashyaUnitView` `<section id={unit.id}>` or a
 * `UnitSkeleton` placeholder with the same id.
 *
 * Uses `behavior: 'auto'` (instant) by default because we re-issue
 * this from a layout effect every time a chunk loads — a smooth
 * animation across multiple chunk arrivals produces a confusing
 * "jittering toward the target" effect.
 */
function scrollToUnit(unitId: string, behavior: ScrollBehavior = 'auto'): void {
  const el = document.getElementById(unitId);
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - 60;
  window.scrollTo({ top: y, behavior });
}
