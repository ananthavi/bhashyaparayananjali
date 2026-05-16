import clsx from 'clsx';
import { useEffect, useState } from 'react';
import type { BhashyaChapter, BhashyaUnit, ProseBlock, ScriptCode } from '@/types';
import { Tappable } from './Tappable';
import { MeaningCard, BlockMeaningCard } from './MeaningCard';
import { transliterate } from '@/lib/transliterate';
import { usePrefs } from '@/state/store';
import { addBookmark, hasBookmark, removeBookmark } from '@/lib/storage';

interface Props {
  textSlug: string;
  chapter: BhashyaChapter;
  unit: BhashyaUnit;
  script: ScriptCode;
  onWordTap: (devWord: string) => void;
  unitNumber: number;
  voiceActive?: boolean;
  /** Devanāgarī tokens to mark inside the unit. */
  highlights?: ReadonlySet<string>;
}

/**
 * Renders one mula + bhashya unit. The mula sits in a prominent
 * "mantra card", followed by one card per commentary block ("vyakhyana
 * cards"). The active card (current voice-follow position, or the
 * focused unit in single-mantra mode) is outlined.
 */
export function BhashyaUnitView({
  textSlug,
  chapter,
  unit,
  script,
  onWordTap,
  unitNumber,
  voiceActive,
  highlights,
}: Props): JSX.Element {
  const prefs = usePrefs();
  const [marked, setMarked] = useState(false);
  const bmId = `${textSlug}:${unit.id}`;

  useEffect(() => {
    let alive = true;
    hasBookmark(bmId).then((v) => alive && setMarked(v));
    return () => {
      alive = false;
    };
  }, [bmId]);

  async function toggleBookmark(): Promise<void> {
    if (marked) {
      await removeBookmark(bmId);
      setMarked(false);
    } else {
      await addBookmark({
        id: bmId,
        textSlug,
        unitId: unit.id,
        chapterOrdinal: chapter.ordinal,
        unitOrdinal: unit.ordinal,
        label: unit.root || '—',
      });
      setMarked(true);
    }
  }

  const isIntro = unit.kind === 'intro';
  const hasMula = !!unit.root;
  const showBhashya = prefs.showBhashya || isIntro;

  // The avatharanika is Śaṅkara's connector text introducing a verse —
  // traditionally it appears BEFORE the mūla. Pull any leading_bhashya /
  // intro_bhashya blocks at the START of the unit's blocks list out so we
  // can render them above the mantra card. Once we hit a non-leading
  // block, everything from there on stays in document order under the
  // mantra. Intro-only units (no mūla) are unaffected.
  const { leadingBlocks, trailingBlocks } = splitLeadingBlocks(unit.blocks, hasMula);

  return (
    <section
      id={unit.id}
      data-unit-id={unit.id}
      className={clsx(
        'scroll-mt-20 py-4 sm:py-6',
        voiceActive && 'voice-active',
      )}
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-70 mb-3 px-1">
        {isIntro ? (
          <span>भूमिका · intro</span>
        ) : (
          <span>
            {chapter.parentOrdinal ? `${chapter.parentOrdinal}·` : ''}
            {chapter.ordinal}·{unit.ordinal} · {labelForKind(unit.kind)} {unitNumber}
          </span>
        )}
        <div className="grow" />
        {!isIntro && (
          <button
            type="button"
            className="btn-ghost btn px-2 py-1 text-xs"
            onClick={() => {
              void toggleBookmark();
            }}
            aria-pressed={marked}
            aria-label={marked ? 'Remove bookmark' : 'Add bookmark'}
            title={marked ? 'Remove bookmark' : 'Bookmark'}
          >
            {marked ? '★' : '☆'}
          </button>
        )}
      </div>

      {showBhashya && leadingBlocks.length > 0 && (
        <div className="mb-4 space-y-3">
          {leadingBlocks.map((b, i) => (
            <BhashyaBlock
              key={b.id ?? `lead-${i}`}
              block={b}
              script={script}
              onWordTap={onWordTap}
              highlights={highlights}
              textSlug={textSlug}
              unitId={unit.id}
              blockIndex={i}
              blockCount={unit.blocks.length}
              showMeaningEn={prefs.showMeaningEn}
              showMeaningMl={prefs.showMeaningMl}
            />
          ))}
        </div>
      )}

      {hasMula && (
        <div className="mantra-card reader-root">
          <Tappable
            text={unit.root}
            script={script}
            interactive
            onWordTap={onWordTap}
            highlights={highlights}
            className="mantra-emphasis"
          />
          {prefs.showIast && script !== 'iast' && (
            <div className="iast-text mt-2 opacity-70 text-[0.85em]">
              {transliterate(unit.root, 'iast')}
            </div>
          )}
        </div>
      )}

      {hasMula && (prefs.showMeaningEn || prefs.showMeaningMl) && (
        <MeaningCard
          textSlug={textSlug}
          unitId={unit.id}
          blockCount={unit.blocks.length}
          showEn={prefs.showMeaningEn}
          showMl={prefs.showMeaningMl}
        />
      )}

      {showBhashya && trailingBlocks.length > 0 && (
        <div className="mt-4 space-y-3">
          {trailingBlocks.map((b, i) => (
            <BhashyaBlock
              key={b.id ?? `trail-${i}`}
              block={b}
              script={script}
              onWordTap={onWordTap}
              highlights={highlights}
              textSlug={textSlug}
              unitId={unit.id}
              blockIndex={leadingBlocks.length + i}
              blockCount={unit.blocks.length}
              showMeaningEn={prefs.showMeaningEn}
              showMeaningMl={prefs.showMeaningMl}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Split a unit's blocks into the leading run (avatharanika) that should
 * render above the mantra and the rest. Only the FIRST contiguous run of
 * `leading_bhashya` / `intro_bhashya` blocks is treated as leading — once
 * any other block is seen, everything from there on stays in document
 * order. Returns no leading blocks when there is no mūla to lead into.
 */
export function splitLeadingBlocks(
  blocks: ReadonlyArray<ProseBlock>,
  hasMula: boolean,
): { leadingBlocks: ProseBlock[]; trailingBlocks: ProseBlock[] } {
  if (!hasMula) return { leadingBlocks: [], trailingBlocks: [...blocks] };
  let i = 0;
  while (
    i < blocks.length &&
    (blocks[i].kind === 'leading_bhashya' || blocks[i].kind === 'intro_bhashya')
  ) {
    i++;
  }
  return { leadingBlocks: blocks.slice(0, i), trailingBlocks: blocks.slice(i) };
}

function BhashyaBlock({
  block,
  script,
  onWordTap,
  highlights,
  textSlug,
  unitId,
  blockIndex,
  blockCount,
  showMeaningEn,
  showMeaningMl,
}: {
  block: ProseBlock;
  script: ScriptCode;
  onWordTap: (devWord: string) => void;
  highlights?: ReadonlySet<string>;
  textSlug?: string;
  unitId?: string;
  blockIndex?: number;
  blockCount?: number;
  showMeaningEn?: boolean;
  showMeaningMl?: boolean;
}): JSX.Element {
  const variant = (() => {
    switch (block.kind) {
      case 'intro_bhashya':
      case 'leading_bhashya':
        return 'vyakhyana-card vyakhyana-leading';
      case 'aux_bhashya':
        return 'vyakhyana-card vyakhyana-aux';
      case 'aux_shloka':
        return 'aux-shloka-card';
      case 'pratika':
        return 'pratika';
      case 'bhashya':
      default:
        return 'vyakhyana-card';
    }
  })();

  const label = (() => {
    switch (block.kind) {
      case 'leading_bhashya':
        return 'अवतरणिका';
      case 'intro_bhashya':
        return 'भूमिका';
      case 'aux_bhashya':
        return 'अनुबन्ध';
      case 'aux_shloka':
        return 'श्लोकाधिकरण';
      case 'pratika':
        return 'प्रतीक';
      case 'bhashya':
      default:
        return 'भाष्यम्';
    }
  })();

  const showBlockMeaning =
    textSlug != null &&
    unitId != null &&
    blockIndex != null &&
    blockCount != null &&
    ((showMeaningEn ?? false) || (showMeaningMl ?? false));

  return (
    <div className={clsx(variant, 'reader-root')}>
      <div className="vyakhyana-label">{label}</div>
      <div className="bhashya-para">
        <RenderQuoted
          text={block.text}
          script={script}
          onWordTap={onWordTap}
          highlights={highlights}
        />
      </div>
      {showBlockMeaning && (
        <BlockMeaningCard
          textSlug={textSlug!}
          unitId={unitId!}
          blockIndex={blockIndex!}
          blockCount={blockCount!}
          showEn={showMeaningEn ?? false}
          showMl={showMeaningMl ?? false}
        />
      )}
    </div>
  );
}

/**
 * Renders prose with embedded śloka quotes as bold callouts and the
 * trailing parenthetical reference as a chip. Source pattern observed
 * in the corpus: ‘<quoted Sanskrit>’ (<short ref>) — sometimes the
 * reference is omitted, sometimes the quote is in straight quotes.
 *
 * We keep all word-level interactivity on each segment by reusing
 * Tappable per fragment.
 */
function RenderQuoted({
  text,
  script,
  onWordTap,
  highlights,
}: {
  text: string;
  script: ScriptCode;
  onWordTap: (devWord: string) => void;
  highlights?: ReadonlySet<string>;
}): JSX.Element {
  // Match: ‘…’ or "…" optionally followed by ( … ) reference.
  // Group 1: quoted body. Group 2 (optional): reference body without parens.
  const re = /(['‘"](.+?)['’"])(?:\s*\(([^)]+)\))?/g;
  const parts: Array<
    | { kind: 'plain'; text: string }
    | { kind: 'quote'; text: string; ref?: string }
  > = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ kind: 'plain', text: text.slice(last, m.index) });
    parts.push({ kind: 'quote', text: m[2] ?? m[1], ref: m[3] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ kind: 'plain', text: text.slice(last) });

  return (
    <>
      {parts.map((p, i) => {
        if (p.kind === 'plain') {
          return (
            <Tappable
              key={i}
              text={p.text}
              script={script}
              interactive
              onWordTap={onWordTap}
              highlights={highlights}
            />
          );
        }
        return (
          <span key={i} className="quoted-sloka">
            <span aria-hidden>‘</span>
            <span className="quoted-sloka-body">
              <Tappable
                text={p.text}
                script={script}
                interactive
                onWordTap={onWordTap}
                highlights={highlights}
              />
            </span>
            <span aria-hidden>’</span>
            {p.ref && <span className="quoted-ref" title={p.ref}>({p.ref})</span>}
          </span>
        );
      })}
    </>
  );
}

function labelForKind(kind: BhashyaUnit['kind']): string {
  switch (kind) {
    case 'mantra':
      return 'mantra';
    case 'sutra':
      return 'sūtra';
    case 'verse':
      return 'śloka';
    case 'karika':
      return 'kārikā';
    default:
      return 'intro';
  }
}
