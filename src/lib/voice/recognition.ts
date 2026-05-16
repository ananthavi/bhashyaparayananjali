/**
 * Web Speech API wrapper for voice follow.
 *
 * Encapsulates the browser SpeechRecognition lifecycle:
 *   - feature detection (returns null where unavailable, e.g. iOS Safari)
 *   - locale selection (default `hi-IN`, override via prefs)
 *   - continuous mode with auto-restart on `end` so the recognizer
 *     keeps listening across pauses
 *   - both interim and final results streamed to the consumer
 *
 * The Web Speech API on Chrome streams audio to Google's servers for
 * recognition. That detail is surfaced in About → Voice; we don't try
 * to disguise it.
 */

export type VoiceStatus = 'idle' | 'starting' | 'listening' | 'error' | 'unsupported';

export interface VoiceEvent {
  /** Devanāgarī (or whatever the locale produces) heard since the last reset. */
  transcript: string;
  /** Whether this fragment is a final result vs an interim hypothesis. */
  isFinal: boolean;
}

interface RecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    length: number;
    [i: number]: { transcript: string; confidence: number };
  }>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

function getRecognitionCtor(): (new () => RecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => RecognitionLike)
    | null;
}

export function isVoiceSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export interface VoiceController {
  start(): Promise<void>;
  stop(): void;
  setLocale(locale: string): void;
  status(): VoiceStatus;
  /** Total final transcript since the controller was created. */
  finalTranscript(): string;
}

export interface VoiceCallbacks {
  onEvent: (e: VoiceEvent) => void;
  onStatus: (s: VoiceStatus) => void;
  onError?: (msg: string) => void;
}

export function createVoiceController(
  initialLocale: string,
  cb: VoiceCallbacks,
): VoiceController {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    cb.onStatus('unsupported');
    return {
      start: async () => undefined,
      stop: () => undefined,
      setLocale: () => undefined,
      status: () => 'unsupported',
      finalTranscript: () => '',
    };
  }

  let recognition: RecognitionLike | null = null;
  let status: VoiceStatus = 'idle';
  let want = false;
  let locale = initialLocale;
  let finalText = '';
  // eslint-disable-next-line prefer-const
  let restartTimer: ReturnType<typeof setTimeout> | null = null;

  function setStatus(s: VoiceStatus): void {
    status = s;
    cb.onStatus(s);
  }

  function spawn(): void {
    if (!Ctor) return;
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.lang = locale;
    r.onstart = () => setStatus('listening');
    r.onresult = (ev) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        const piece = res[0]?.transcript ?? '';
        if (res.isFinal) {
          finalText += (finalText ? ' ' : '') + piece;
          cb.onEvent({ transcript: piece, isFinal: true });
        } else {
          interim += piece;
        }
      }
      if (interim) cb.onEvent({ transcript: interim, isFinal: false });
    };
    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      cb.onError?.(e.message || e.error);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        want = false;
        setStatus('error');
      }
    };
    r.onend = () => {
      // The browser stops the engine periodically; restart while the user
      // still wants to listen.
      if (want && status !== 'error') {
        restartTimer = setTimeout(() => {
          try {
            r.start();
          } catch {
            spawn();
          }
        }, 200);
      } else {
        setStatus('idle');
      }
    };
    recognition = r;
  }

  return {
    async start() {
      if (status === 'unsupported') return;
      want = true;
      setStatus('starting');
      finalText = '';
      // Prime the microphone permission via getUserMedia. On Android
      // WebView this fires the system runtime prompt; on Chrome desktop
      // it's a no-op when permission already exists. Doing this BEFORE
      // SpeechRecognition.start() is the most reliable way to surface
      // the prompt — some recognizer implementations on WebView don't
      // surface it themselves.
      try {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          // We don't actually need the stream; SpeechRecognition opens
          // its own microphone session. Stop our priming tracks so we
          // don't keep the mic LED on for two simultaneous sessions.
          stream.getTracks().forEach((t) => t.stop());
        }
      } catch (err) {
        cb.onError?.(
          'Microphone permission denied. Tap the app info → Permissions → Microphone to enable.',
        );
        want = false;
        setStatus('error');
        return;
      }
      try {
        if (!recognition) spawn();
        recognition!.start();
      } catch (err) {
        cb.onError?.((err as Error).message);
        setStatus('error');
      }
    },
    stop() {
      want = false;
      if (restartTimer) {
        clearTimeout(restartTimer);
        restartTimer = null;
      }
      try {
        recognition?.stop();
      } catch {
        // ignore
      }
      setStatus('idle');
    },
    setLocale(l: string) {
      locale = l;
      if (recognition) recognition.lang = l;
    },
    status: () => status,
    finalTranscript: () => finalText,
  };
}

/** Common locales useful for Sanskrit recitation. */
export const VOICE_LOCALES: Array<{ code: string; label: string }> = [
  { code: 'hi-IN', label: 'Hindi (Devanāgarī, best ASR coverage)' },
  { code: 'mr-IN', label: 'Marathi (Devanāgarī)' },
  { code: 'sa-IN', label: 'Sanskrit (rare, may not work everywhere)' },
  { code: 'ta-IN', label: 'Tamil' },
  { code: 'te-IN', label: 'Telugu' },
  { code: 'ml-IN', label: 'Malayalam' },
  { code: 'bn-IN', label: 'Bengali' },
  { code: 'gu-IN', label: 'Gujarati' },
  { code: 'kn-IN', label: 'Kannada' },
];
