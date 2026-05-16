/**
 * Vidyut WASM engine adapter.
 *
 * Loads the panini-wasm bundle (built from `panini-wasm/` under the
 * Rust toolchain via wasm-pack) and routes adapter calls through it.
 * The bundle today is a stub that reports `available = false`; the
 * adapter detects that and falls back to the null engine, which
 * keeps the analyser chain unchanged. Once the real Vidyut bindings
 * land in `panini-wasm/src/lib.rs` this adapter starts returning
 * real analyses without further code change here.
 *
 * The WASM bundle is loaded LAZILY — never on the cold-load path —
 * so the reader's first-paint stays untouched. The first tap that
 * needs an engine triggers `loadVidyutWasmEngine()` which:
 *
 *   1. Dynamic-imports `public/data/panini/panini_wasm.js`.
 *   2. Calls `init()` so the WASM instance is ready.
 *   3. Probes `available()` to confirm the bundle reports itself
 *      ready (the stub returns false; the real Vidyut returns true).
 *
 * If any step fails (no bundle deployed yet, ad-blocker stripped
 * the .wasm, init crashed, …), the loader resolves to `null` and
 * the facade transparently uses the null engine.
 */
import { asset } from '@/lib/asset';
import type {
  AnalyzeOptions,
  Morphology,
  PaniniAnalysis,
  PaniniEngine,
} from './types';

interface VidyutDerivation {
  text: string;
  steps: Array<{ source: string; code: string; result: string }>;
}

interface VidyutVerification {
  matched: boolean;
  surface?: string;
  sutras: string[];
}

interface WasmModule {
  /** wasm-pack default export: initialiser. */
  default: (path?: string) => Promise<unknown>;
  paniniName: () => string;
  paniniVersion: () => string;
  paniniAvailable: () => boolean;
  paniniAnalyze: (word: string) => unknown;
  paniniSegment: (utterance: string) => unknown;
  paniniInflect: (lemma: string, morphJson: string) => VidyutDerivation[];
  paniniVerify: (surface: string, lemma: string, morphJson: string) => VidyutVerification;
  paniniTransliterate: (text: string, from: string, to: string) => string;
}

let cached: Promise<PaniniEngine | null> | null = null;

export function loadVidyutWasmEngine(): Promise<PaniniEngine | null> {
  if (cached) return cached;
  cached = (async () => {
    try {
      const jsUrl = asset('data/panini/panini_wasm.js');
      const wasmUrl = asset('data/panini/panini_wasm_bg.wasm');
      // The wasm-pack `web` target ships an init function as the
      // default export. We rely on the default-import shape; if the
      // bundler resolves it differently the fallback handles it.
      const mod = (await import(/* @vite-ignore */ jsUrl)) as WasmModule;
      if (typeof mod.default !== 'function') return null;
      await mod.default(wasmUrl);
      if (!mod.paniniAvailable()) return null;
      return wrap(mod);
    } catch {
      return null;
    }
  })();
  return cached;
}

function wrap(mod: WasmModule): PaniniEngineWithVerify {
  const name = `${safe(() => mod.paniniName(), 'vidyut-wasm')}@${safe(() => mod.paniniVersion(), '0.0.0')}`;
  return {
    name,
    available: true,
    async analyze(_word: string, _opts?: AnalyzeOptions): Promise<PaniniAnalysis[]> {
      // Reverse analysis is delegated to the heuristic chain until
      // vidyut-cheda is WASM-ready upstream. The engine is still
      // useful for `inflect()` and `verify()`.
      return [];
    },
    async segment(_utterance: string): Promise<string[][]> {
      return [];
    },
    async inflect(lemma: string, morph: Morphology): Promise<string[]> {
      try {
        const raw = mod.paniniInflect(lemma, JSON.stringify(morph));
        if (!Array.isArray(raw)) return [];
        const surfaces = new Set<string>();
        for (const d of raw) if (d?.text) surfaces.add(d.text);
        return [...surfaces];
      } catch {
        return [];
      }
    },
    async verify(surface, lemma, morph): Promise<VerifyResult | null> {
      try {
        const raw = mod.paniniVerify(surface, lemma, JSON.stringify(morph));
        if (!raw) return null;
        return {
          matched: !!raw.matched,
          surface: raw.surface,
          sutras: Array.isArray(raw.sutras) ? raw.sutras : [],
        };
      } catch {
        return null;
      }
    },
    async deriveWithTrace(lemma, morph): Promise<VidyutDerivation[]> {
      try {
        const raw = mod.paniniInflect(lemma, JSON.stringify(morph));
        return Array.isArray(raw) ? raw : [];
      } catch {
        return [];
      }
    },
  };
}

export interface VerifyResult {
  matched: boolean;
  surface?: string;
  sutras: string[];
}

export interface PaniniEngineWithVerify extends PaniniEngine {
  verify?: (surface: string, lemma: string, morph: Morphology) => Promise<VerifyResult | null>;
  deriveWithTrace?: (lemma: string, morph: Morphology) => Promise<VidyutDerivation[]>;
}

export type { VidyutDerivation };

function safe<T>(f: () => T, fallback: T): T {
  try {
    return f();
  } catch {
    return fallback;
  }
}
