import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import type { BhashyaChapter, BhashyaManifest } from '@/types';
import { expandQueryToDevanagari } from '@/lib/search';
import { transliterate, fontClassFor } from '@/lib/transliterate';
import { usePrefs } from '@/state/store';

/**
 * Tokeniser for Sanskrit corpus + query — splits on whitespace, daṇḍa
 * (। / ॥), commas, semicolons, em/en dashes, and parens. Used so that a
 * query token is matched against individual corpus tokens (substring
 * within a single token), instead of against a haystack that was glued
 * together with stray punctuation.
 */
const TOKEN_SPLIT_RE = /[\s।॥,;:—–\-()[\]"'`]+/u;

export function tokeniseSanskrit(text: string): string[] {
  if (!text) return [];
  return text.split(TOKEN_SPLIT_RE).filter(Boolean);
}

interface Props {
  manifest: BhashyaManifest;
  /** Loaded chapter chunks; only those will be searched in real time. */
  loadedChapters: BhashyaChapter[];
  open: boolean;
  onClose: () => void;
  onJump: (unitId: string, tokens: string[]) => void;
}

interface Hit {
  unitId: string;
  chapterId: string;
  /** Sanskrit ordinal label, e.g. "मन्त्र 7 · ब्राह्मण 1". */
  ref: string;
  /** Snippet of the matched line, ~140 chars around the first hit. */
  snippet: string;
  /** Variants used so the reader can highlight them when we jump. */
  tokens: string[];
}

/**
 * Find-in-page for the currently-open bhāṣya.
 *
 * Searches just the chapters that have already been loaded as chunks
 * (everything the reader is rendering). Click a hit to scroll there
 * and propagate token highlights through the URL `?h=` flow.
 */
export function InTextSearch({
  manifest,
  loadedChapters,
  open,
  onClose,
  onJump,
}: Props): JSX.Element | null {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const prefs = usePrefs();

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQuery('');
  }, [open]);

  // Build a flat lookup of (unitId → text) only over loaded chapters,
  // each mapped to the chapter id for jump scrolling. Recomputed when
  // chapters or query change.
  //
  // Matching strategy:
  //   • Tokenise the query on whitespace + daṇḍa + punctuation.
  //   • Each query token is expanded to a set of Devanāgarī variants
  //     (handles Latin / IAST / other-script input + sandhi-relevant
  //     endings — see expandQueryToDevanagari).
  //   • Tokenise each unit's text the same way, then require every
  //     query token to substring-match at least one corpus token via
  //     any of its variants. This is robust to daṇḍas, commas, and
  //     sandhi-merged compounds (the variant is still a substring of
  //     the merged token).
  const hits = useMemo<Hit[]>(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const queryTokens = tokeniseSanskrit(trimmed);
    if (queryTokens.length === 0) return [];
    const variants: string[][] = queryTokens.map((t) =>
      expandQueryToDevanagari(t).filter(Boolean),
    );
    const allVariants = Array.from(new Set(variants.flat().filter(Boolean)));
    if (allVariants.length === 0) return [];

    const out: Hit[] = [];
    for (const ch of loadedChapters) {
      for (const u of ch.units) {
        const haystack = u.root + ' ' + u.blocks.map((b) => b.text).join(' ');
        const corpusTokens = tokeniseSanskrit(haystack);
        // Every query token's variants must hit some corpus token.
        const allHit = variants.every((vs) =>
          vs.some((v) => corpusTokens.some((ct) => ct.includes(v))),
        );
        if (!allHit) continue;
        // Locate a matching variant in the raw haystack so the snippet
        // has surrounding context. If no variant matches as a raw
        // substring (e.g., it only matched after splitting on a daṇḍa)
        // we anchor at the start of the unit.
        let idx = 0;
        for (const v of allVariants) {
          const i = haystack.indexOf(v);
          if (i >= 0) {
            idx = i;
            break;
          }
        }
        const start = Math.max(0, idx - 30);
        const end = Math.min(haystack.length, idx + 110);
        const snippet =
          (start > 0 ? '…' : '') +
          haystack.slice(start, end) +
          (end < haystack.length ? '…' : '');
        out.push({
          unitId: u.id,
          chapterId: ch.id,
          ref: refLabel(manifest, u.id),
          snippet,
          tokens: allVariants,
        });
        if (out.length >= 100) return out;
      }
    }
    return out;
  }, [query, loadedChapters, manifest]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center pt-12"
      onClick={onClose}
      style={{ background: 'rgba(0,0,0,0.4)' }}
      role="dialog"
      aria-label="Find in this bhāṣya"
    >
      <div
        className="surface rounded-xl shadow-sutra w-[min(640px,94vw)] max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="p-3 border-b flex items-center gap-2"
          style={{ borderColor: 'var(--rule)' }}
        >
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find within this bhāṣya…"
            className="grow bg-transparent outline-none text-base px-1"
            inputMode="search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter' && hits.length > 0) {
                onJump(hits[0].unitId, hits[0].tokens);
                onClose();
              }
            }}
          />
          <span className="text-xs opacity-70 whitespace-nowrap">
            {hits.length} match{hits.length === 1 ? '' : 'es'}
          </span>
          <button className="btn-ghost btn px-2" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto">
          {query.trim() && hits.length === 0 && (
            <div className="p-4 text-sm opacity-70">
              No matches in the chapters loaded so far. Scroll a bit to load
              more, then try again.
            </div>
          )}
          {!query.trim() && (
            <div className="p-4 text-sm opacity-70">
              Type to find within the chapters of this bhāṣya that are
              currently loaded.
            </div>
          )}
          <ul>
            {hits.map((h, i) => {
              // Render snippet (and matching tokens) in the user's
              // currently-selected script. Source-of-truth in the
              // corpus is Devanāgarī; we transliterate at render time.
              const displayedSnippet =
                prefs.script === 'devanagari'
                  ? h.snippet
                  : transliterate(h.snippet, prefs.script);
              const displayedTokens =
                prefs.script === 'devanagari'
                  ? h.tokens
                  : h.tokens.map((t) => transliterate(t, prefs.script));
              const fontClass = fontClassFor(prefs.script);
              return (
                <li
                  key={h.unitId + ':' + i}
                  className="border-t"
                  style={{ borderColor: 'var(--rule)' }}
                >
                  <button
                    type="button"
                    className="w-full text-left p-3 hover:bg-[color:var(--surface-2)]"
                    onClick={() => {
                      onJump(h.unitId, h.tokens);
                      onClose();
                    }}
                  >
                    <div className="flex items-baseline justify-between gap-2 flex-wrap">
                      <div className={`${fontClass} text-sm font-medium`}>
                        {prefs.script === 'devanagari'
                          ? h.ref
                          : transliterate(h.ref, prefs.script)}
                      </div>
                      <div className="text-[10px] opacity-60 uppercase tracking-wider">
                        {h.unitId}
                      </div>
                    </div>
                    <div className={`mt-1 ${fontClass} text-sm leading-relaxed`}>
                      {renderSnippet(displayedSnippet, displayedTokens)}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function renderSnippet(text: string, tokens: string[]): JSX.Element {
  const escaped = [...new Set(tokens.filter(Boolean))]
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (escaped.length === 0) return <>{text}</>;
  const re = new RegExp(`(${escaped.join('|')})`, 'g');
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark
            key={i}
            className={clsx('rounded px-0.5')}
            style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 25%, transparent)' }}
          >
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function refLabel(manifest: BhashyaManifest, unitId: string): string {
  for (const ch of manifest.chapters) {
    for (const u of ch.units) {
      if (u.id !== unitId) continue;
      const parts: string[] = [];
      if (ch.parentTitleSa) parts.push(ch.parentTitleSa);
      if (ch.titleSa) parts.push(ch.titleSa);
      const kindLabel: Record<string, string> = {
        mantra: 'मन्त्र',
        sutra: 'सूत्र',
        verse: 'श्लोक',
        karika: 'कारिका',
        intro: 'भूमिका',
      };
      parts.push(`${kindLabel[u.kind] ?? ''} ${u.ordinal}`.trim());
      return parts.join(' · ');
    }
  }
  return unitId;
}
