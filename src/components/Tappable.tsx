import { memo } from 'react';
import clsx from 'clsx';
import type { ScriptCode } from '@/types';
import { transliterate } from '@/lib/transliterate';

interface Props {
  /** Source Devanagari text. Transliteration is done at render. */
  text: string;
  script: ScriptCode;
  /** When true, underline hover and expose click handler. */
  interactive?: boolean;
  /** Return the ORIGINAL Devanagari token, regardless of the rendered script. */
  onWordTap?: (devWord: string) => void;
  className?: string;
  /** Set of Devanāgarī tokens that should be wrapped in <mark>. The
   *  set is matched against the ORIGINAL Devanāgarī token regardless
   *  of the script being rendered, so highlighting persists across
   *  script changes. */
  highlights?: ReadonlySet<string>;
}

/**
 * Renders Devanagari Sanskrit split at word boundaries (Devanagari runs
 * separated by spaces/punctuation), transliterates each token to the active
 * script, and wires up a click handler that always reports back the ORIGINAL
 * Devanagari token. That way the dictionary always sees canonical Sanskrit,
 * regardless of which script the reader is currently viewing.
 */
function TappableImpl({
  text,
  script,
  interactive,
  onWordTap,
  className,
  highlights,
}: Props): JSX.Element {
  // Split into a sequence of [token, isWord] pairs. A "word" is any run of
  // Devanagari letters; everything else (spaces, daṇḍas, digits, Latin) is a
  // non-word that we render verbatim.
  const parts = splitWords(text);
  return (
    <span className={clsx(className, `script-${script}`)}>
      {parts.map((p, i) => {
        if (!p.isWord) {
          // Non-words don't need transliteration; Devanagari danda/digits/etc.
          // can optionally be converted for display continuity.
          return (
            <span key={i}>
              {script === 'devanagari' ? p.text : transliterate(p.text, script)}
            </span>
          );
        }
        const display = script === 'devanagari' ? p.text : transliterate(p.text, script);
        // Highlight uses the ORIGINAL Devanāgarī token as the key, so
        // marks persist across script changes. We also try to match the
        // bare-stem versions because the search variants may include
        // post-sandhi forms (सर्वं vs. सर्व).
        const hit = highlights
          ? highlights.has(p.text) ||
            (p.text.endsWith('ं') && highlights.has(p.text.slice(0, -1))) ||
            (p.text.endsWith('ः') && highlights.has(p.text.slice(0, -1)))
          : false;
        return (
          <span
            key={i}
            className={clsx(
              interactive && onWordTap ? 'tap-word' : undefined,
              hit ? 'search-hit' : undefined,
            )}
            role={interactive && onWordTap ? 'button' : undefined}
            tabIndex={interactive && onWordTap ? 0 : undefined}
            onClick={(e) => {
              if (!interactive || !onWordTap) return;
              e.stopPropagation();
              onWordTap(p.text);
            }}
            onKeyDown={(e) => {
              if (!interactive || !onWordTap) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onWordTap(p.text);
              }
            }}
          >
            {display}
          </span>
        );
      })}
    </span>
  );
}

export const Tappable = memo(TappableImpl);

function splitWords(text: string): Array<{ text: string; isWord: boolean }> {
  const out: Array<{ text: string; isWord: boolean }> = [];
  const re = /([ऀ-ॿ]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), isWord: false });
    out.push({ text: m[1], isWord: true });
    last = m.index + m[1].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), isWord: false });
  return out;
}
