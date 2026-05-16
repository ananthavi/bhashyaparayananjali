import clsx from 'clsx';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ScriptPicker } from './ScriptPicker';
import type { BhashyaManifest } from '@/types';
import { usePrefs } from '@/state/store';
import { jumpToRef } from '@/lib/jump-to-ref';

interface Props {
  manifest: BhashyaManifest;
  onToggleToc: () => void;
  tocOpen: boolean;
  /** Voice / mic button is rendered by the reader page so it can own the
   *  speech-recognition lifecycle and corpus reference. */
  voiceButton?: React.ReactNode;
  onOpenInTextSearch?: () => void;
  /** Resolve a free-text reference like "3.42" into a unitId jump. */
  onJumpToUnit?: (unitId: string) => void;
}

/**
 * Single persistent reader toolbar — replaces the generic site nav on
 * the reader. Order, left-to-right:
 *
 *   ←   ☰        Title          अ↗ ScriptPicker  🎙 Mic   ⚙ Settings
 *
 * Sticky at top:0 with `env(safe-area-inset-top)` padding so the
 * status-bar icons never overlap. Stays visible during scroll.
 */
export function ReaderToolbar({
  manifest,
  onToggleToc,
  tocOpen,
  voiceButton,
  onOpenInTextSearch,
  onJumpToUnit,
}: Props): JSX.Element {
  const prefs = usePrefs();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div
      className="sticky top-0 z-30 backdrop-blur border-b"
      style={{
        background: 'color-mix(in srgb, var(--bg) 90%, transparent)',
        borderColor: 'var(--rule)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      <div className="max-w-3xl mx-auto px-1 h-12 flex items-center gap-0.5 sm:gap-1">
        <Link
          to="/"
          className="btn btn-ghost px-2 shrink-0"
          aria-label="Back to library"
          title="Library"
        >
          <span aria-hidden>←</span>
        </Link>
        <button
          type="button"
          className={clsx(
            'btn btn-ghost px-2 shrink-0',
            tocOpen && 'bg-[color:var(--surface-2)]',
          )}
          onClick={onToggleToc}
          aria-label="Index of chapters and slokas"
          aria-expanded={tocOpen}
          title="Chapter & sloka index"
        >
          <span aria-hidden>☰</span>
        </button>
        <div className="min-w-0 grow truncate text-sm font-medium px-1">
          <span className="script-devanagari truncate block">{manifest.titleSa}</span>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          {onOpenInTextSearch && (
            <button
              type="button"
              className="btn btn-ghost px-2"
              onClick={onOpenInTextSearch}
              aria-label="Find within this bhāṣya"
              title="Find within this bhāṣya"
            >
              <span aria-hidden>🔍</span>
            </button>
          )}
          <ScriptPicker value={prefs.script} onChange={(v) => prefs.set('script', v)} />
          {voiceButton}
          <div className="relative">
            <button
              type="button"
              className="btn btn-ghost px-2"
              aria-label="Reader settings"
              title="Settings"
              onClick={() => setSettingsOpen((s) => !s)}
            >
              <span aria-hidden>⚙︎</span>
            </button>
            {settingsOpen && (
              <SettingsPopover
                manifest={manifest}
                onJumpToUnit={onJumpToUnit}
                onClose={() => setSettingsOpen(false)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPopover({
  manifest,
  onJumpToUnit,
  onClose,
}: {
  manifest: BhashyaManifest;
  onJumpToUnit?: (unitId: string) => void;
  onClose: () => void;
}): JSX.Element {
  const prefs = usePrefs();
  return (
    <div
      className="absolute right-0 mt-1 w-[min(320px,90vw)] surface rounded-lg shadow-sutra z-40 p-3 text-sm"
      onMouseLeave={onClose}
    >
      {onJumpToUnit && (
        <GoToRow
          manifest={manifest}
          onJumpToUnit={(uid) => {
            onJumpToUnit(uid);
            onClose();
          }}
        />
      )}
      <div className="font-medium mb-2">Reading</div>
      <Row label="Theme">
        {(['light', 'sepia', 'dark'] as const).map((t) => (
          <Seg key={t} active={prefs.theme === t} onClick={() => prefs.set('theme', t)}>
            {t}
          </Seg>
        ))}
      </Row>
      <Row label="Font size">
        <button className="btn px-2 py-1" onClick={() => prefs.bumpFontSize(-1)}>
          A−
        </button>
        <span className="chip">{prefs.fontSize}</span>
        <button className="btn px-2 py-1" onClick={() => prefs.bumpFontSize(1)}>
          A+
        </button>
      </Row>
      <Row label="Density">
        {(['compact', 'spacious'] as const).map((d) => (
          <Seg key={d} active={prefs.density === d} onClick={() => prefs.set('density', d)}>
            {d}
          </Seg>
        ))}
      </Row>
      <Row label="Continuous">
        <Toggle
          checked={prefs.continuous}
          onChange={(v) => prefs.set('continuous', v)}
          label="One long scroll vs one mantra per screen"
        />
      </Row>
      <Row label="Show IAST under mula">
        <Toggle checked={prefs.showIast} onChange={(v) => prefs.set('showIast', v)} />
      </Row>
      <Row label="Show bhāṣya">
        <Toggle
          checked={prefs.showBhashya}
          onChange={(v) => prefs.set('showBhashya', v)}
          label="Hide to do mula-only parayanam"
        />
      </Row>
      <Row label="English meaning">
        <Toggle
          checked={prefs.showMeaningEn}
          onChange={(v) => prefs.set('showMeaningEn', v)}
          label="Show English translation card under each mantra"
        />
      </Row>
      <Row label="Malayalam meaning">
        <Toggle
          checked={prefs.showMeaningMl}
          onChange={(v) => prefs.set('showMeaningMl', v)}
          label="Show Malayalam translation card under each mantra"
        />
      </Row>
      <Row label="Auto-scroll (wpm)">
        <input
          type="range"
          min={0}
          max={20}
          step={2}
          value={prefs.autoScrollWpm}
          onChange={(e) => prefs.set('autoScrollWpm', Number(e.target.value))}
          className="w-full"
        />
        <span className="chip w-14 justify-center">
          {prefs.autoScrollWpm === 0 ? 'off' : prefs.autoScrollWpm}
        </span>
      </Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="opacity-80">{label}</span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}

function Seg({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      className={clsx(
        'px-2 py-1 rounded-md text-xs capitalize',
        active ? 'bg-[color:var(--accent)] text-[color:var(--bg)]' : 'btn',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}): JSX.Element {
  return (
    <label className="inline-flex items-center gap-2" title={label}>
      <span
        className={clsx(
          'relative inline-flex h-5 w-9 rounded-full transition-colors',
          checked ? 'bg-[color:var(--accent)]' : 'bg-[color:var(--surface-2)]',
        )}
        onClick={() => onChange(!checked)}
      >
        <span
          className={clsx(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </span>
    </label>
  );
}

/**
 * "Go to" reference input. Free-text dotted-numeric jumps. Lives at
 * the top of the settings popover so it's the first thing a returning
 * reciter sees.
 *
 *   Gītā / verse-only      "3.42"
 *   Brahma-sūtra           "1.1.12"
 *   Bṛhadāraṇyaka          "4.5.13"
 *   Single-section text    "7"
 *
 * On a hit we delegate to `onJumpToUnit` (which also closes the
 * popover via the wrapper). On a miss we show an inline error and
 * keep the popover open so the user can correct the input.
 */
function GoToRow({
  manifest,
  onJumpToUnit,
}: {
  manifest: BhashyaManifest;
  onJumpToUnit: (unitId: string) => void;
}): JSX.Element {
  const [value, setValue] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const submit = (): void => {
    const result = jumpToRef(manifest, value);
    if (result.ok) {
      setErr(null);
      setValue('');
      onJumpToUnit(result.unitId);
    } else {
      setErr(result.message);
    }
  };

  return (
    <div className="mb-3 pb-3 border-b" style={{ borderColor: 'var(--rule)' }}>
      <div className="font-medium mb-1.5">Go to</div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-center gap-1.5"
      >
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          placeholder="3.42 or 1.1.12 or 7"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (err) setErr(null);
          }}
          aria-label="Reference (e.g. chapter.verse)"
          aria-invalid={err ? true : undefined}
          className="flex-1 min-w-0 px-2 py-1 rounded-md text-sm border bg-transparent"
          style={{ borderColor: 'var(--rule)' }}
        />
        <button type="submit" className="btn btn-primary px-3 py-1 text-xs">
          Go
        </button>
      </form>
      {err && (
        <div
          className="mt-1.5 text-xs"
          role="alert"
          style={{ color: 'var(--err, #b91c1c)' }}
        >
          {err}
        </div>
      )}
    </div>
  );
}
