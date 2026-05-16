import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import type { SearchHit } from '@/lib/search';
import { searchAll, expandQueryToDevanagari } from '@/lib/search';
import { loadCatalog, loadManifest } from '@/lib/loader';
import type { Catalog, BhashyaManifest } from '@/types';
import { usePrefs } from '@/state/store';
import { transliterate, toDevanagari } from '@/lib/transliterate';
import { suggestForLastToken, type PhraseSuggestion } from '@/lib/autocomplete';
import {
  loadHistory,
  recordSearch,
  removeFromHistory,
  clearHistory,
  type HistoryEntry,
} from '@/lib/search-history';
import { describeUnit, describeUnitFallback } from '@/lib/reference';

/**
 * Full-text search across all 13 bhāṣyas with:
 *
 *   - Multi-script input: Devanāgarī, any other Indic script, IAST,
 *     plain ASCII Latin (no marks), or whatever the device's voice
 *     recognizer produces.
 *   - Live autocomplete from a corpus-derived token list (~24 k tokens
 *     appearing ≥ 2× in the bhāṣyas, sorted lexically — binary search
 *     on every keystroke).
 *   - Voice search button that streams interim transcripts straight
 *     into the input.
 *   - Per-result rank badges (exact / prefix / substring / fuzzy);
 *     "Exact match only" toggle suppresses the fuzzy tier.
 */
export function SearchPage(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const exactOnly = params.get('exact') === '1';
  const [query, setQuery] = useState(q);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [variants, setVariants] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [busy, setBusy] = useState(false);
  const [autocomplete, setAutocomplete] = useState<PhraseSuggestion[]>([]);
  const [acOpen, setAcOpen] = useState(false);
  const [acIdx, setAcIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const prefs = usePrefs();

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  useEffect(() => {
    setHistory(loadHistory());
  }, [q]);

  // Scope: which texts to search. Loaded from URL `?scope=slug1,slug2`.
  const scopeParam = params.get('scope') ?? '';
  const scope = useMemo(
    () => (scopeParam ? scopeParam.split(',').filter(Boolean) : []),
    [scopeParam],
  );
  const [scopeOpen, setScopeOpen] = useState(false);

  // Manifests for displayed result texts so we can show full references.
  const [manifests, setManifests] = useState<Map<string, BhashyaManifest>>(
    () => new Map(),
  );

  useEffect(() => {
    loadCatalog().then(setCatalog).catch(() => null);
  }, []);

  useEffect(() => {
    setQuery(q);
    if (!q) {
      setHits([]);
      setVariants([]);
      return;
    }
    setBusy(true);
    setVariants(expandQueryToDevanagari(q));
    searchAll(q, { exactOnly, limit: 80, scope })
      .then((newHits) => {
        setHits(newHits);
        // Record in history once we know the search returned at least
        // attempted (we record regardless of whether it had hits — the
        // user typed it deliberately).
        recordSearch({
          query: q,
          scope: scope.length > 0 ? [...scope] : undefined,
          exactOnly: exactOnly || undefined,
        });
        setHistory(loadHistory());
      })
      .finally(() => setBusy(false));
  }, [q, exactOnly, scopeParam]);

  // Lazy-load manifests for every text appearing in current results so we
  // can show a proper "अध्याय 4 · ब्राह्मण 5 · मन्त्र 13" reference.
  useEffect(() => {
    const slugs = [...new Set(hits.map((h) => h.doc.textSlug))];
    const missing = slugs.filter((s) => !manifests.has(s));
    if (missing.length === 0) return;
    let alive = true;
    void Promise.all(missing.map((s) => loadManifest(s).catch(() => null))).then(
      (results) => {
        if (!alive) return;
        setManifests((prev) => {
          const next = new Map(prev);
          missing.forEach((slug, i) => {
            const m = results[i];
            if (m) next.set(slug, m);
          });
          return next;
        });
      },
    );
    return () => {
      alive = false;
    };
  }, [hits, manifests]);

  // Autocomplete: only the LAST token of the query is treated as the
  // partial word. Convert Latin→Devanāgarī if needed so suggestions
  // match. After a trailing space the dropdown closes (signals "I just
  // finished a word") until the next keystroke.
  useEffect(() => {
    if (query.length < 1) {
      setAutocomplete([]);
      return;
    }
    let cancelled = false;
    // Convert Latin tail to Devanāgarī so the binary-search index hits.
    const lastSpace = query.trimEnd().lastIndexOf(' ');
    const head = lastSpace >= 0 ? query.slice(0, lastSpace + 1) : '';
    const tail = lastSpace >= 0 ? query.slice(lastSpace + 1) : query;
    if (!tail.trim()) {
      setAutocomplete([]);
      return;
    }
    const devTail = /[ऀ-ॿ]/.test(tail) ? tail : toDevanagari(tail);
    const candidates = new Set([head + tail, head + devTail]);
    void Promise.all([...candidates].map((c) => suggestForLastToken(c, 8))).then(
      (results) => {
        if (cancelled) return;
        const merged = new Map<string, PhraseSuggestion>();
        for (const list of results) for (const s of list) merged.set(s.token, s);
        const top = [...merged.values()].sort((a, b) => b.freq - a.freq).slice(0, 8);
        setAutocomplete(top);
        setAcIdx(-1);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [query]);

  const titleBySlug = useMemo(() => {
    const m = new Map<string, { sa: string; iast: string }>();
    for (const t of catalog?.texts ?? []) m.set(t.slug, { sa: t.titleSa, iast: t.titleIast });
    return m;
  }, [catalog]);

  function setExact(v: boolean): void {
    const next = new URLSearchParams(params);
    if (v) next.set('exact', '1');
    else next.delete('exact');
    if (query) next.set('q', query);
    setParams(next);
  }

  function setScope(slugs: string[]): void {
    const next = new URLSearchParams(params);
    if (slugs.length > 0) next.set('scope', slugs.join(','));
    else next.delete('scope');
    if (query) next.set('q', query);
    setParams(next);
  }

  function commit(text: string): void {
    const next = new URLSearchParams(params);
    if (text) next.set('q', text);
    else next.delete('q');
    setParams(next);
    setAcOpen(false);
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (!acOpen || autocomplete.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAcIdx((i) => Math.min(autocomplete.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAcIdx((i) => Math.max(-1, i - 1));
    } else if (e.key === 'Enter' && acIdx >= 0) {
      e.preventDefault();
      const choice = autocomplete[acIdx];
      setQuery(choice.full);
      commit(choice.full);
    } else if (e.key === 'Escape') {
      setAcOpen(false);
    }
  }

  return (
    <div className="py-4 space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          commit(query);
        }}
        className="surface rounded-xl p-2 flex items-center gap-1 relative"
      >
        <span aria-hidden className="opacity-60 px-1 text-lg shrink-0">🔍</span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setAcOpen(true);
          }}
          onFocus={() => setAcOpen(true)}
          onBlur={() => setTimeout(() => setAcOpen(false), 150)}
          onKeyDown={onInputKeyDown}
          placeholder="Search any script or plain ASCII…"
          className="grow min-w-0 bg-transparent outline-none text-base sm:text-lg px-1"
          inputMode="search"
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
        />
        <button type="submit" className="btn btn-primary px-3 shrink-0" aria-label="Run search">
          <span className="hidden sm:inline">Search</span>
          <span className="sm:hidden" aria-hidden>↵</span>
        </button>

        {acOpen && autocomplete.length > 0 && (
          <ul
            role="listbox"
            className="absolute left-3 right-3 top-full mt-1 surface rounded-lg shadow-sutra z-30 overflow-hidden"
          >
            {autocomplete.map((s, i) => (
              <li
                key={s.full}
                role="option"
                aria-selected={i === acIdx}
                onMouseDown={(e) => e.preventDefault() /* keep focus */}
                onClick={() => {
                  setQuery(s.full);
                  commit(s.full);
                }}
                className={clsx(
                  'px-3 py-2 cursor-pointer flex items-baseline justify-between gap-3',
                  i === acIdx
                    ? 'bg-[color:var(--surface-2)]'
                    : 'hover:bg-[color:var(--surface-2)]',
                )}
              >
                <span className="script-devanagari text-base truncate">
                  {s.full !== s.token && (
                    <span className="opacity-60">{s.full.slice(0, s.full.length - s.token.length)}</span>
                  )}
                  <span className="font-medium">{s.token}</span>
                </span>
                <span className="text-[10px] uppercase tracking-wider opacity-60 whitespace-nowrap">
                  {s.freq.toLocaleString()}×
                </span>
              </li>
            ))}
          </ul>
        )}
      </form>

      <div className="flex items-center justify-between flex-wrap gap-2 px-1 text-xs">
        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            className="btn px-2 py-1 text-xs flex items-center gap-1"
            onClick={() => setScopeOpen((s) => !s)}
            aria-expanded={scopeOpen}
            title="Limit search to selected texts"
          >
            <span aria-hidden>📚</span>
            {scope.length > 0
              ? `Scope: ${scope.length} text${scope.length > 1 ? 's' : ''}`
              : 'All 13 texts'}
            <span aria-hidden className="opacity-60">▾</span>
          </button>
          <span className="opacity-70">
            Examples:{' '}
            <button className="underline" onClick={() => setParams({ q: 'ब्रह्म' })}>
              ब्रह्म
            </button>
            {' · '}
            <button className="underline" onClick={() => setParams({ q: 'brahma jnana' })}>
              brahma jnana
            </button>
            {' · '}
            <button className="underline" onClick={() => setParams({ q: 'māyā' })}>
              māyā
            </button>
          </span>
        </div>
        <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={exactOnly}
            onChange={(e) => setExact(e.target.checked)}
          />
          <span className="opacity-80">Exact match only</span>
        </label>
      </div>

      {scopeOpen && catalog && (
        <ScopePicker
          catalog={catalog}
          selected={scope}
          onChange={(s) => setScope(s)}
          onClose={() => setScopeOpen(false)}
        />
      )}

      {!q && history.length > 0 && (
        <div className="surface rounded-xl p-3">
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-xs uppercase tracking-widest opacity-70">Recent searches</div>
            <button
              type="button"
              className="text-xs underline opacity-70 hover:opacity-100"
              onClick={() => {
                clearHistory();
                setHistory([]);
              }}
            >
              Clear all
            </button>
          </div>
          <ul className="space-y-1">
            {history.map((h) => (
              <li key={h.query} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setQuery(h.query);
                    const next = new URLSearchParams();
                    next.set('q', h.query);
                    if (h.exactOnly) next.set('exact', '1');
                    if (h.scope && h.scope.length > 0) next.set('scope', h.scope.join(','));
                    setParams(next);
                  }}
                  className="grow min-w-0 text-left flex items-baseline gap-2 hover:bg-[color:var(--surface-2)] rounded px-2 py-1.5"
                >
                  <span aria-hidden className="opacity-60">🕘</span>
                  <span className="grow truncate">{h.query}</span>
                  {h.scope && h.scope.length > 0 && (
                    <span className="chip text-[10px]">{h.scope.length}t</span>
                  )}
                  {h.exactOnly && <span className="chip text-[10px]">exact</span>}
                </button>
                <button
                  type="button"
                  className="btn-ghost btn px-2 py-1 text-xs opacity-70"
                  onClick={() => {
                    removeFromHistory(h.query);
                    setHistory(loadHistory());
                  }}
                  aria-label={`Remove "${h.query}" from history`}
                  title="Remove from history"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {variants.length > 0 && (
        <div
          className="text-xs opacity-70 px-2 flex flex-wrap items-baseline gap-1.5"
          aria-live="polite"
        >
          Searching for:{' '}
          {variants.map((v, i) => (
            <span
              key={i}
              className="script-devanagari chip"
              title={`Devanāgarī interpretation #${i + 1}`}
            >
              {v}
            </span>
          ))}
        </div>
      )}

      {busy && <div className="opacity-70 text-sm px-2">Searching…</div>}

      {!busy && q && hits.length === 0 && (
        <div className="opacity-80 text-sm px-2">
          No matches.{' '}
          {exactOnly && (
            <button
              className="underline"
              onClick={() => setExact(false)}
              type="button"
            >
              Try with approximate matches
            </button>
          )}
        </div>
      )}

      <ul className="space-y-2">
        {hits.map((hit) => {
          const t = titleBySlug.get(hit.doc.textSlug);
          const m = manifests.get(hit.doc.textSlug);
          const ref = m
            ? describeUnit(m, hit.doc.unitId)
            : describeUnitFallback(hit.doc.unitId);
          // Highlights are passed via ?h=token1,token2 so the reader
          // can wrap matching tokens in <mark> when the user lands on
          // the unit. We pass the Devanāgarī tokens regardless of the
          // user's chosen display script — Tappable's source of truth
          // is always Devanāgarī.
          const highlightParam =
            hit.matchedTokens.length > 0
              ? `?h=${encodeURIComponent(hit.matchedTokens.join(','))}`
              : '';
          const snippet =
            prefs.script === 'devanagari'
              ? hit.doc.snippet
              : transliterate(hit.doc.snippet, prefs.script);
          return (
            <li key={hit.doc.id + ':' + hit.rank}>
              <Link
                to={`/read/${hit.doc.textSlug}${highlightParam}#${hit.doc.unitId}`}
                className="block surface rounded-lg p-3 hover:bg-[color:var(--surface-2)] transition-colors"
              >
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <div className="script-devanagari text-sm font-medium">
                    {t?.sa ?? hit.doc.textSlug}
                  </div>
                  <RankBadge rank={hit.rank} />
                </div>
                <div className="mt-0.5 text-xs opacity-80 script-devanagari">
                  {ref.short}
                </div>
                <div className={`mt-2 text-sm leading-relaxed script-${prefs.script}`}>
                  <HighlightedSnippet
                    text={snippet}
                    tokens={
                      // For non-Devanāgarī display, transliterate the
                      // tokens too so highlighting still hits.
                      prefs.script === 'devanagari'
                        ? hit.matchedTokens
                        : hit.matchedTokens.map((t) => transliterate(t, prefs.script))
                    }
                  />
                  …
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ScopePicker({
  catalog,
  selected,
  onChange,
  onClose,
}: {
  catalog: Catalog;
  selected: string[];
  onChange: (next: string[]) => void;
  onClose: () => void;
}): JSX.Element {
  const set = new Set(selected);
  function toggle(slug: string): void {
    const next = new Set(set);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    onChange([...next]);
  }
  function clearAll(): void {
    onChange([]);
  }
  function selectAll(): void {
    onChange(catalog.texts.map((t) => t.slug));
  }
  return (
    <div className="surface rounded-xl p-3 space-y-2">
      <div className="flex items-baseline justify-between">
        <div className="text-xs uppercase tracking-widest opacity-70">
          Search in {selected.length === 0 ? 'all texts' : `${selected.length} selected`}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button className="underline opacity-80" onClick={clearAll}>
            All
          </button>
          <button className="underline opacity-80" onClick={selectAll}>
            None
          </button>
          <button className="btn-ghost btn px-2 py-1" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {catalog.texts.map((t) => {
          const active = set.has(t.slug);
          return (
            <li key={t.slug}>
              <button
                type="button"
                className={clsx(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm',
                  active
                    ? 'bg-[color:var(--surface-2)] ring-1 ring-[color:var(--accent)]'
                    : 'hover:bg-[color:var(--surface-2)]',
                )}
                onClick={() => toggle(t.slug)}
              >
                <span className="text-base" aria-hidden>
                  {active ? '☑' : '☐'}
                </span>
                <span className="script-devanagari truncate grow">{t.titleSa}</span>
                <span className="text-[10px] opacity-60 whitespace-nowrap">
                  {t.counts.mantras}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="text-[11px] opacity-70 leading-relaxed">
        Empty selection means all 13 texts. Pick specific texts to scope a search.
      </div>
    </div>
  );
}

/**
 * Wraps every occurrence of any token in `tokens` (longest-first) with
 * a <mark>. Tokens that overlap pick the longest match. Stable across
 * scripts because the snippet has been transliterated upstream.
 */
function HighlightedSnippet({
  text,
  tokens,
}: {
  text: string;
  tokens: string[];
}): JSX.Element {
  if (tokens.length === 0) return <>{text}</>;
  // De-dupe and sort longest-first so the regex prefers full matches.
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
            className="rounded px-0.5"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent)',
              color: 'var(--ink)',
            }}
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

function RankBadge({ rank }: { rank: SearchHit['rank'] }): JSX.Element {
  const tone = {
    exact: 'bg-emerald-200/60 text-emerald-900 border-emerald-700/30',
    prefix: 'bg-sky-200/60 text-sky-900 border-sky-700/30',
    substring: 'bg-amber-200/60 text-amber-900 border-amber-700/30',
    fuzzy: 'bg-rose-200/60 text-rose-900 border-rose-700/30',
  }[rank];
  const label = {
    exact: 'exact',
    prefix: 'prefix',
    substring: 'contains',
    fuzzy: 'approx.',
  }[rank];
  return (
    <span
      className={clsx(
        'text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border',
        tone,
      )}
      title={
        rank === 'fuzzy'
          ? 'Approximate match (edit-distance fuzzy). Lower confidence than exact / prefix matches.'
          : rank === 'substring'
            ? 'The query appears as a substring inside a token.'
            : rank === 'prefix'
              ? 'The query is a prefix of a matched token.'
              : 'Exact full-token match.'
      }
    >
      {label}
    </span>
  );
}
