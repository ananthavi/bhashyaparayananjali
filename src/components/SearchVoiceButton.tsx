import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  createVoiceController,
  isVoiceSupported,
  type VoiceController,
  type VoiceStatus,
} from '@/lib/voice/recognition';
import { usePrefs } from '@/state/store';

interface Props {
  /** Called whenever the recognizer emits a transcript fragment. The
   *  search input replaces its current value with the latest interim
   *  hypothesis, then upgrades to the final result when ASR commits. */
  onTranscript: (text: string, isFinal: boolean) => void;
}

/**
 * Mic button for the search bar. Shares the same speech-recognition
 * controller as the reader's voice-follow button (separate instance,
 * same wrapper) so locale and permission flow stay consistent.
 *
 * Designed to be unobtrusive — when listening, pulses the mic icon
 * and routes every interim transcript into the input via `onTranscript`.
 * Stops automatically when the user submits, taps the mic again, or
 * the OS prompt is denied.
 */
export function SearchVoiceButton({ onTranscript }: Props): JSX.Element | null {
  const prefs = usePrefs();
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const ctrlRef = useRef<VoiceController | null>(null);

  useEffect(() => {
    if (!isVoiceSupported()) {
      setStatus('unsupported');
      return;
    }
    const c = createVoiceController(prefs.voiceLocale, {
      onStatus: setStatus,
      onError: setError,
      onEvent: (ev) => onTranscript(ev.transcript, ev.isFinal),
    });
    ctrlRef.current = c;
    return () => c.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    ctrlRef.current?.setLocale(prefs.voiceLocale);
  }, [prefs.voiceLocale]);

  if (status === 'unsupported') {
    return (
      <button
        type="button"
        className="btn-ghost btn px-2 opacity-60 cursor-not-allowed"
        title="Voice search isn't available on this browser. Try Chrome on Android."
        aria-label="Voice search unavailable"
        tabIndex={-1}
      >
        <span aria-hidden>🎙</span>
      </button>
    );
  }

  const listening = status === 'listening' || status === 'starting';

  function toggle(): void {
    if (listening) {
      ctrlRef.current?.stop();
    } else {
      void ctrlRef.current?.start();
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={clsx(
        'btn-ghost btn px-2 transition-colors relative',
        listening && 'text-[color:var(--accent)]',
      )}
      aria-pressed={listening}
      aria-label={listening ? 'Stop voice search' : 'Voice search'}
      title={
        error
          ? `mic: ${error}`
          : listening
            ? 'Listening — tap to stop'
            : 'Voice search (uses the same locale as voice follow-along)'
      }
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
  );
}
