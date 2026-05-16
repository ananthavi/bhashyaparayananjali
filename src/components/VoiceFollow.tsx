import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  createVoiceController,
  isVoiceSupported,
  VOICE_LOCALES,
  type VoiceController,
  type VoiceStatus,
} from '@/lib/voice/recognition';
import { tokensFor } from '@/lib/voice/normalize';
import { followMatch } from '@/lib/voice/matcher';
import type { VoiceCorpus } from '@/lib/voice/corpus';
import { usePrefs } from '@/state/store';

interface Props {
  corpus: VoiceCorpus | null;
  /** Last known token index, used as a search hint. */
  hint?: number;
  /** Called whenever the matcher finds a confident position. */
  onMatch: (m: { unitId: string; start: number; end: number; score: number }) => void;
  /** Called when the user stops voice follow. */
  onStop?: () => void;
  /** Called when the user activates the mic — gives the page a chance
   *  to start fetching the full corpus needed for matching. */
  onActivate?: () => void;
}

interface DebugSnapshot {
  status: string;
  lastInterim: string;
  lastFinal: string;
  heardTokens: string[];
  lastMatch: { unitId: string; score: number; start: number } | null;
  attempts: number;
  matches: number;
  startedAt: number | null;
}

/**
 * Microphone-button + listening UI for voice follow. Spawns a single
 * VoiceController, accumulates a rolling window of heard akṣaras, and
 * runs the fuzzy matcher against the loaded corpus on every interim
 * result. Emits matches upward so the reader can highlight + scroll.
 */
export function VoiceFollow({ corpus, hint, onMatch, onStop, onActivate }: Props): JSX.Element | null {
  const prefs = usePrefs();
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [heard, setHeard] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  /** First-tap rationale: shown only when the user has never granted mic
   *  permission via the app before. Tap "Continue" → triggers the OS
   *  prompt (via getUserMedia inside createVoiceController.start). */
  const [rationaleOpen, setRationaleOpen] = useState(false);
  const ctrlRef = useRef<VoiceController | null>(null);
  const heardTokensRef = useRef<string[]>([]);
  /** Debug snapshot — only rendered when prefs.voiceDebug is on. */
  const [debug, setDebug] = useState<DebugSnapshot>({
    status: 'idle',
    lastInterim: '',
    lastFinal: '',
    heardTokens: [],
    lastMatch: null,
    attempts: 0,
    matches: 0,
    startedAt: null,
  });

  const supported = isVoiceSupported();

  // Initialize controller once.
  useEffect(() => {
    const c = createVoiceController(prefs.voiceLocale, {
      onStatus: (s) => {
        setStatus(s);
        setDebug((d) => ({ ...d, status: s }));
      },
      onError: setError,
      onEvent: (ev) => {
        // Build a rolling buffer of the last ~80 akṣaras heard.
        const newTokens = tokensFor(ev.transcript);
        if (newTokens.length === 0) return;
        if (ev.isFinal) {
          heardTokensRef.current = [...heardTokensRef.current, ...newTokens].slice(-80);
        } else {
          const stable = heardTokensRef.current.slice(0, -newTokens.length);
          heardTokensRef.current = [...stable, ...newTokens].slice(-80);
        }
        setHeard(heardTokensRef.current.slice(-12).join(''));
        setDebug((d) => ({
          ...d,
          lastInterim: ev.isFinal ? d.lastInterim : ev.transcript,
          lastFinal: ev.isFinal ? ev.transcript : d.lastFinal,
          heardTokens: [...heardTokensRef.current],
          attempts: d.attempts + 1,
        }));

        if (corpus) {
          const m = followMatch(corpus.tokens, heardTokensRef.current, hint ?? null);
          if (m.score >= 0.25 && m.start >= 0) {
            const entry = corpus.entries[m.start];
            if (entry) {
              onMatch({ unitId: entry.unitId, start: m.start, end: m.end, score: m.score });
              setDebug((d) => ({
                ...d,
                matches: d.matches + 1,
                lastMatch: { unitId: entry.unitId, score: m.score, start: m.start },
              }));
            }
          }
        }
      },
    });
    ctrlRef.current = c;
    return () => {
      c.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push locale changes through.
  useEffect(() => {
    ctrlRef.current?.setLocale(prefs.voiceLocale);
  }, [prefs.voiceLocale]);

  if (!supported) {
    return (
      <button
        type="button"
        className="btn-ghost btn px-2 opacity-60 cursor-not-allowed"
        title="Speech recognition isn't available on this browser. Chrome / Android Chrome / Edge work."
        aria-label="Voice follow unavailable"
      >
        <span aria-hidden>🎙</span>
      </button>
    );
  }

  const listening = status === 'listening' || status === 'starting';

  function actuallyStart(): void {
    onActivate?.();
    setDebug({
      status: 'starting',
      lastInterim: '',
      lastFinal: '',
      heardTokens: [],
      lastMatch: null,
      attempts: 0,
      matches: 0,
      startedAt: Date.now(),
    });
    void ctrlRef.current?.start();
    if (!prefs.voicePermissionAsked) prefs.set('voicePermissionAsked', true);
  }

  function toggle(): void {
    if (listening) {
      ctrlRef.current?.stop();
      onStop?.();
      setHeard('');
      heardTokensRef.current = [];
      return;
    }
    if (!prefs.voicePermissionAsked) {
      setRationaleOpen(true);
      return;
    }
    actuallyStart();
  }

  return (
    <>
      <button
        type="button"
        className={clsx(
          'btn-ghost btn px-2 transition-colors relative',
          listening && 'text-[color:var(--accent)]',
        )}
        onClick={toggle}
        onContextMenu={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        aria-pressed={listening}
        aria-label={listening ? 'Stop voice follow' : 'Start voice follow'}
        title={listening ? 'Listening — tap to stop' : 'Voice follow (tap)'}
      >
        <span aria-hidden>{listening ? '🔴' : '🎙'}</span>
        {listening && (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 h-2 w-2 rounded-full animate-pulse"
            style={{ background: 'var(--accent)' }}
          />
        )}
      </button>

      {/* Settings popover for voice locale */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40" aria-hidden />
          <div
            className="relative surface rounded-t-2xl sm:rounded-2xl max-w-md w-full mx-auto p-4 shadow-sutra space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-baseline justify-between">
              <div className="font-medium">Voice follow settings</div>
              <button className="btn-ghost btn px-2" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>
            <label className="block text-sm">
              <span className="opacity-70">Recognition language</span>
              <select
                value={prefs.voiceLocale}
                onChange={(e) => prefs.set('voiceLocale', e.target.value)}
                className="surface w-full px-2 py-1.5 rounded mt-1"
                style={{ background: 'var(--bg)' }}
              >
                {VOICE_LOCALES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label} ({l.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center justify-between text-sm">
              <span className="opacity-80">Auto-scroll to matched mantra</span>
              <input
                type="checkbox"
                checked={prefs.voiceAutoScroll}
                onChange={(e) => prefs.set('voiceAutoScroll', e.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between text-sm">
              <span className="opacity-80">Show live debug panel</span>
              <input
                type="checkbox"
                checked={prefs.voiceDebug}
                onChange={(e) => prefs.set('voiceDebug', e.target.checked)}
              />
            </label>
            <p className="text-xs opacity-70 leading-relaxed">
              Voice follow uses your browser's built-in speech recognition. On
              Chrome / Android Chrome the audio is processed by Google. No
              audio is recorded by this app. Microphone permission is required.
            </p>
          </div>
        </div>
      )}

      {/* Tiny live readout while listening */}
      {listening && heard && (
        <div
          className="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 surface rounded-full px-3 py-1 text-xs script-devanagari max-w-[80vw] truncate shadow-sutra"
          style={{ borderColor: 'var(--rule)' }}
          aria-live="polite"
        >
          {heard}
        </div>
      )}

      {error && (
        <div
          className="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 surface rounded-full px-3 py-1 text-xs"
          style={{ color: 'var(--accent)' }}
        >
          mic: {error}
        </div>
      )}

      {prefs.voiceDebug && (listening || debug.attempts > 0) && (
        <VoiceDebugPanel
          snapshot={debug}
          corpusReady={!!corpus}
          locale={prefs.voiceLocale}
        />
      )}

      {rationaleOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setRationaleOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40" aria-hidden />
          <div
            className="relative surface rounded-t-2xl sm:rounded-2xl max-w-md w-full mx-auto p-5 shadow-sutra"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <div className="font-semibold text-lg">Voice follow</div>
              <button
                className="btn-ghost btn px-2"
                onClick={() => setRationaleOpen(false)}
                aria-label="Cancel"
              >
                ✕
              </button>
            </div>
            <p className="text-sm opacity-90 leading-relaxed">
              Bhāṣya Pārāyaṇa can listen to your recitation and highlight the
              mantra you're currently reading, so you don't lose your place
              while chanting. To do that it needs access to the microphone.
            </p>
            <ul className="mt-3 text-xs opacity-80 space-y-1.5 list-disc pl-5">
              <li>The microphone is only opened while the mic icon is pulsing.</li>
              <li>No audio is recorded or stored by this app.</li>
              <li>
                Recognition runs through the browser's built-in speech engine; on
                Chrome / Android Chrome that means audio is processed by Google.
              </li>
              <li>You can revoke permission anytime from system Settings.</li>
            </ul>
            <div className="mt-4 flex gap-2 justify-end">
              <button className="btn px-3" onClick={() => setRationaleOpen(false)}>
                Not now
              </button>
              <button
                className="btn btn-primary px-3"
                onClick={() => {
                  setRationaleOpen(false);
                  actuallyStart();
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function VoiceDebugPanel({
  snapshot,
  corpusReady,
  locale,
}: {
  snapshot: DebugSnapshot;
  corpusReady: boolean;
  locale: string;
}): JSX.Element {
  const elapsed = snapshot.startedAt ? Math.floor((Date.now() - snapshot.startedAt) / 1000) : 0;
  return (
    <div
      className="fixed left-2 right-2 bottom-16 z-30 surface rounded-lg p-3 text-xs shadow-sutra max-w-md mx-auto space-y-1"
      style={{ borderColor: 'var(--rule)' }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold uppercase tracking-wider opacity-80">Voice debug</span>
        <span className="opacity-70">{locale} · {elapsed}s</span>
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
        <span className="opacity-70">status</span>
        <span>{snapshot.status}</span>
        <span className="opacity-70">corpus loaded</span>
        <span>{corpusReady ? 'yes' : 'still loading…'}</span>
        <span className="opacity-70">events</span>
        <span>
          {snapshot.attempts} ASR · {snapshot.matches} matches
        </span>
        <span className="opacity-70">last match</span>
        <span className="truncate">
          {snapshot.lastMatch
            ? `${snapshot.lastMatch.unitId} (score ${snapshot.lastMatch.score.toFixed(2)})`
            : '—'}
        </span>
      </div>
      {snapshot.lastInterim && (
        <div>
          <div className="opacity-70">interim</div>
          <div className="script-devanagari truncate" dir="ltr">
            {snapshot.lastInterim}
          </div>
        </div>
      )}
      {snapshot.lastFinal && (
        <div>
          <div className="opacity-70">final</div>
          <div className="script-devanagari truncate" dir="ltr">
            {snapshot.lastFinal}
          </div>
        </div>
      )}
      {snapshot.heardTokens.length > 0 && (
        <div>
          <div className="opacity-70">heard akṣaras (last {snapshot.heardTokens.length})</div>
          <div className="script-devanagari" style={{ wordBreak: 'break-all' }}>
            {snapshot.heardTokens.slice(-30).join('')}
          </div>
        </div>
      )}
    </div>
  );
}
