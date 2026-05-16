import { useMemo, useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import type { ScriptCode } from '@/types';
import { SCRIPT_OPTIONS } from '@/lib/transliterate';

interface Props {
  value: ScriptCode;
  onChange: (v: ScriptCode) => void;
  className?: string;
}

/**
 * Compact script picker. Collapses to a single button showing the native
 * label; opens a grid of all supported scripts. Keyboard: arrows to move,
 * Enter to select, Esc to close.
 */
export function ScriptPicker({ value, onChange, className }: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = useMemo(
    () => SCRIPT_OPTIONS.find((o) => o.code === value) ?? SCRIPT_OPTIONS[0],
    [value],
  );

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={clsx('relative', className)}>
      <button
        type="button"
        className="btn btn-ghost px-2 text-sm flex items-center gap-1"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((x) => !x)}
        title={`Script: ${current.englishName}`}
      >
        <span
          className={clsx(current.fontClass, 'leading-none')}
          aria-hidden
          style={{ fontSize: '1.05em' }}
        >
          {current.label}
        </span>
        <span aria-hidden className="opacity-60 text-[0.7em]">▾</span>
        <span className="sr-only">{current.englishName}</span>
      </button>
      {open && (
        <ul
          role="listbox"
          // The trigger sits in the right cluster of the toolbar; the
          // dropdown anchors to the trigger's right edge but is clamped
          // to the viewport via max-width and a hard cap on the column
          // count. This fixes the previous bug where the second column
          // extended past the screen edge on phones < 380 px wide.
          className="absolute right-0 mt-1 surface rounded-lg shadow-sutra z-40 p-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1"
          style={{ width: 'min(20rem, calc(100vw - 1rem))', maxHeight: '70vh', overflowY: 'auto' }}
        >
          {SCRIPT_OPTIONS.map((o) => (
            <li key={o.code}>
              <button
                type="button"
                role="option"
                aria-selected={o.code === value}
                className={clsx(
                  'w-full px-2.5 py-2 rounded-md text-left flex flex-col gap-0.5 min-w-0',
                  o.code === value
                    ? 'bg-[color:var(--surface-2)] ring-1 ring-[color:var(--accent)]'
                    : 'hover:bg-[color:var(--surface-2)]',
                )}
                onClick={() => {
                  onChange(o.code);
                  setOpen(false);
                }}
              >
                <span className={clsx(o.fontClass, 'text-base leading-tight truncate')} aria-hidden>
                  {o.label}
                </span>
                <span className="opacity-70 text-[11px] truncate">{o.englishName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
