import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { meaningsFor, type UnitMeanings, type MeaningEntry } from '@/lib/meanings';

interface Props {
  textSlug: string;
  unitId: string;
  blockCount: number;
  showEn: boolean;
  showMl: boolean;
}

/**
 * Collapsible meaning card rendered beneath a mantra's mūla text.
 *
 * Loads `public/data/meanings/<slug>.json` on first mount per unit.
 * Renders one card per language (English, Malayalam) when at least
 * one entry is available. Each card shows the primary entry by
 * default with a "Show alternative translations" disclosure when
 * multiple sources are present, and a citation chip pointing at the
 * underlying source. Long entries collapse to ~280 chars with a
 * "Read more" toggle.
 *
 * Auto-derived placeholder entries (sourceId =
 * `bhashya-prose-derived`) get a discreet "auto-derived from bhāṣya"
 * label so readers know to expect a real translation later.
 */
export function MeaningCard({
  textSlug,
  unitId,
  blockCount,
  showEn,
  showMl,
}: Props): JSX.Element | null {
  const [data, setData] = useState<UnitMeanings | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    void meaningsFor(textSlug, unitId, blockCount).then((d) => {
      if (alive) {
        setData(d);
        setLoaded(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [textSlug, unitId, blockCount]);

  if (!loaded) {
    // Reserve no extra vertical space pre-load; the card animates in
    // when meanings arrive so the reader doesn't see a layout flicker.
    return null;
  }
  if (!data) return null;

  const en = data.root.filter((e) => e.language === 'en');
  const ml = data.root.filter((e) => e.language === 'ml');
  const showEnCard = showEn && en.length > 0;
  const showMlCard = showMl && ml.length > 0;
  const hasRoot = showEnCard || showMlCard;
  if (!hasRoot) return null;

  return (
    <div className="meaning-cards mt-3 space-y-3">
      {showEnCard && (
        <LanguageCard label="English" entries={en} sources={data.sources} accent="en" />
      )}
      {showMlCard && (
        <LanguageCard label="മലയാളം" entries={ml} sources={data.sources} accent="ml" />
      )}
    </div>
  );
}

/**
 * Compact meaning card for a single bhāṣya block. Renders inline
 * underneath the corresponding BhashyaBlock in the reader. Pulls
 * data from the same cached file the unit-level MeaningCard loads,
 * so this only adds DOM, no additional fetches.
 */
export function BlockMeaningCard({
  textSlug,
  unitId,
  blockIndex,
  blockCount,
  showEn,
  showMl,
}: {
  textSlug: string;
  unitId: string;
  blockIndex: number;
  blockCount: number;
  showEn: boolean;
  showMl: boolean;
}): JSX.Element | null {
  const [data, setData] = useState<UnitMeanings | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    void meaningsFor(textSlug, unitId, blockCount).then((d) => {
      if (alive) {
        setData(d);
        setLoaded(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [textSlug, unitId, blockCount]);

  if (!loaded || !data) return null;
  const blockEntries = data.blocks[blockIndex] ?? [];
  if (blockEntries.length === 0) return null;
  const en = blockEntries.filter((e) => e.language === 'en');
  const ml = blockEntries.filter((e) => e.language === 'ml');
  const showEnCard = showEn && en.length > 0;
  const showMlCard = showMl && ml.length > 0;
  if (!showEnCard && !showMlCard) return null;

  return (
    <div className="meaning-cards mt-2 space-y-2">
      {showEnCard && (
        <LanguageCard label="English" entries={en} sources={data.sources} accent="en" />
      )}
      {showMlCard && (
        <LanguageCard label="മലയാളം" entries={ml} sources={data.sources} accent="ml" />
      )}
    </div>
  );
}

function LanguageCard({
  label,
  entries,
  sources,
  accent,
}: {
  label: string;
  entries: MeaningEntry[];
  sources: UnitMeanings['sources'];
  accent: 'en' | 'ml';
}): JSX.Element {
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const PREVIEW_LIMIT = 280;

  const e = entries[active] ?? entries[0];
  const src = sources[e.sourceId];
  const isFallback = e.sourceId === 'bhashya-prose-derived';
  const isAiDraft = src?.license === 'ai-draft';
  const showFull = expanded || e.text.length <= PREVIEW_LIMIT;
  const body = showFull ? e.text : e.text.slice(0, PREVIEW_LIMIT) + '…';

  return (
    <article
      className={clsx(
        'meaning-card surface rounded-lg border p-3 sm:p-4',
        'shadow-sm transition-shadow hover:shadow-md',
      )}
      style={{
        borderColor: 'var(--rule)',
      }}
    >
      <header className="flex items-baseline gap-2 mb-2">
        <span
          className="text-[10px] uppercase tracking-widest font-semibold opacity-70"
          style={{ color: 'var(--accent)' }}
        >
          {label}
        </span>
        <div className="grow" />
        {entries.length > 1 && (
          <div className="flex gap-1">
            {entries.map((entry, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setActive(i);
                  setExpanded(false);
                }}
                aria-pressed={i === active}
                className={clsx(
                  'text-[10px] px-1.5 py-0.5 rounded border',
                  i === active ? 'opacity-100' : 'opacity-50 hover:opacity-80',
                )}
                style={{
                  background: i === active ? 'var(--accent)' : 'transparent',
                  color: i === active ? 'white' : 'inherit',
                  borderColor: 'var(--rule)',
                }}
                title={sources[entry.sourceId]?.citation ?? entry.sourceId}
              >
                {entry.sourceId}
              </button>
            ))}
          </div>
        )}
      </header>

      <div
        className={clsx(
          'meaning-body leading-relaxed whitespace-pre-line',
          accent === 'ml' && 'script-malayalam',
        )}
      >
        {body}
      </div>

      {isAiDraft && (
        <div
          className="mt-2 mb-1 text-[11px] px-2 py-1 rounded"
          style={{
            background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
            color: 'var(--accent)',
            border: '1px dashed var(--accent)',
          }}
          title="AI draft — requires authoritative sign-off."
        >
          ⚠ AI draft — requires authoritative sign-off
        </div>
      )}
      <footer className="mt-2 flex items-baseline gap-2 flex-wrap text-[11px] opacity-70">
        <span className="font-medium">— {src?.citation ?? e.sourceId}</span>
        {isFallback && (
          <span
            className="chip text-[10px]"
            title="Translation file has not yet been ingested for this verse — bhāṣya prose shown as a placeholder."
          >
            auto-derived
          </span>
        )}
        {!isFallback && !isAiDraft && src?.license && (
          <span className="chip text-[10px]" title={`License: ${src.license}`}>
            {src.license}
          </span>
        )}
        {isAiDraft && (
          <span className="chip text-[10px]" title="Unverified AI-generated draft.">
            ai-draft
          </span>
        )}
        {e.text.length > PREVIEW_LIMIT && (
          <button
            type="button"
            onClick={() => setExpanded((x) => !x)}
            className="ml-auto underline opacity-80 hover:opacity-100"
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
        {e.note && <div className="basis-full italic opacity-60">{e.note}</div>}
      </footer>
    </article>
  );
}
