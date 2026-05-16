/**
 * Global app state: reader preferences persisted to localStorage.
 * Kept intentionally small; deeper state (bookmarks, positions) lives in
 * IndexedDB via src/lib/storage.ts.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ScriptCode } from '@/types';

export type Theme = 'light' | 'sepia' | 'dark';
export type FontSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type ReaderDensity = 'compact' | 'spacious';

export interface Prefs {
  script: ScriptCode;
  theme: Theme;
  fontSize: FontSize;
  density: ReaderDensity;
  showIast: boolean; // show IAST under Devanagari mula line
  showBhashya: boolean; // collapse commentary for mula-only parayanam
  continuous: boolean; // continuous scroll vs one-mantra-per-screen
  autoScrollWpm: number; // 0 = off; 40–80 wpm typical recital pace
  hideStopWords: boolean; // do not underline particles like च / हि / तु on tap
  voiceLocale: string; // ASR locale for voice follow (default hi-IN)
  voiceAutoScroll: boolean; // pin viewport on the matched mantra
  voicePermissionAsked: boolean; // suppress the rationale after first ask
  voiceDebug: boolean; // surface a live debug panel during voice follow
  showMeaningEn: boolean; // show English meaning card under each mantra
  showMeaningMl: boolean; // show Malayalam meaning card under each mantra
}

interface Actions {
  set: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
  bumpFontSize: (delta: 1 | -1) => void;
  reset: () => void;
}

const DEFAULTS: Prefs = {
  script: 'devanagari',
  theme: 'sepia',
  fontSize: 'lg',
  density: 'spacious',
  showIast: false,
  showBhashya: true,
  continuous: true,
  autoScrollWpm: 0,
  hideStopWords: true,
  voiceLocale: 'hi-IN',
  voiceAutoScroll: true,
  voicePermissionAsked: false,
  voiceDebug: false,
  showMeaningEn: true,
  showMeaningMl: false,
};

const SIZES: FontSize[] = ['sm', 'md', 'lg', 'xl', '2xl'];

export const usePrefs = create<Prefs & Actions>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (key, value) => set((s) => ({ ...s, [key]: value })),
      bumpFontSize: (delta) =>
        set((s) => {
          const i = SIZES.indexOf(s.fontSize);
          const next = Math.min(SIZES.length - 1, Math.max(0, i + delta));
          return { ...s, fontSize: SIZES[next] };
        }),
      reset: () => set(() => ({ ...DEFAULTS })),
    }),
    { name: 'bhashya-prefs-v1' },
  ),
);

/** Apply theme & font size as HTML data attributes so CSS vars pick up. */
export function applyPrefsToHtml(prefs: Pick<Prefs, 'theme' | 'fontSize'>): void {
  document.documentElement.setAttribute('data-theme', prefs.theme);
  document.documentElement.setAttribute('data-fontsize', prefs.fontSize);
}
