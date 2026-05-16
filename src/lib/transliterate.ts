/**
 * Transliteration wrapper around @indic-transliteration/sanscript.
 *
 * Our source of truth is Devanagari. At render time we convert to the user's
 * chosen script. Sanscript handles vowels, consonants, conjuncts, anusvara,
 * visarga, and nukta correctly across all supported scripts.
 */

// The sanscript package ships UMD; use the default export regardless of shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import sanscriptImport from '@indic-transliteration/sanscript';
import type { ScriptCode, ScriptOption } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Sanscript: { t: (text: string, from: string, to: string) => string } =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (sanscriptImport as any).default ?? (sanscriptImport as any);

/** Map of our ScriptCode → sanscript scheme name. */
const SCHEME: Record<ScriptCode, string> = {
  devanagari: 'devanagari',
  malayalam: 'malayalam',
  tamil: 'tamil',
  telugu: 'telugu',
  kannada: 'kannada',
  bengali: 'bengali',
  gurmukhi: 'gurmukhi',
  gujarati: 'gujarati',
  oriya: 'oriya',
  grantha: 'grantha',
  iast: 'iast',
  itrans: 'itrans',
  hk: 'hk',
};

export const SCRIPT_OPTIONS: ScriptOption[] = [
  {
    code: 'devanagari',
    label: 'देवनागरी',
    englishName: 'Devanagari',
    fontClass: 'script-devanagari',
    isRomanized: false,
  },
  {
    code: 'malayalam',
    label: 'മലയാളം',
    englishName: 'Malayalam',
    fontClass: 'script-malayalam',
    isRomanized: false,
  },
  {
    code: 'tamil',
    label: 'தமிழ்',
    englishName: 'Tamil',
    fontClass: 'script-tamil',
    isRomanized: false,
  },
  {
    code: 'telugu',
    label: 'తెలుగు',
    englishName: 'Telugu',
    fontClass: 'script-telugu',
    isRomanized: false,
  },
  {
    code: 'kannada',
    label: 'ಕನ್ನಡ',
    englishName: 'Kannada',
    fontClass: 'script-kannada',
    isRomanized: false,
  },
  {
    code: 'bengali',
    label: 'বাংলা',
    englishName: 'Bengali',
    fontClass: 'script-bengali',
    isRomanized: false,
  },
  {
    code: 'gurmukhi',
    label: 'ਗੁਰਮੁਖੀ',
    englishName: 'Gurmukhi',
    fontClass: 'script-gurmukhi',
    isRomanized: false,
  },
  {
    code: 'gujarati',
    label: 'ગુજરાતી',
    englishName: 'Gujarati',
    fontClass: 'script-gujarati',
    isRomanized: false,
  },
  {
    code: 'oriya',
    label: 'ଓଡ଼ିଆ',
    englishName: 'Odia',
    fontClass: 'script-oriya',
    isRomanized: false,
  },
  {
    code: 'grantha',
    label: '𑌗𑍍𑌰𑌨𑍍𑌥',
    englishName: 'Grantha',
    fontClass: 'script-grantha',
    isRomanized: false,
  },
  {
    code: 'iast',
    label: 'IAST',
    englishName: 'IAST (Roman)',
    fontClass: 'script-iast',
    isRomanized: true,
  },
  {
    code: 'itrans',
    label: 'ITRANS',
    englishName: 'ITRANS (ASCII)',
    fontClass: 'script-itrans',
    isRomanized: true,
  },
  {
    code: 'hk',
    label: 'HK',
    englishName: 'Harvard–Kyoto',
    fontClass: 'script-hk',
    isRomanized: true,
  },
];

const cache = new Map<string, string>();

/**
 * Transliterate Devanagari Sanskrit text into the target script.
 * Uses a small LRU-like in-memory cache keyed by (script, text) because
 * the same mantras/blocks are rendered repeatedly as the user scrolls.
 */
export function transliterate(devanagari: string, to: ScriptCode): string {
  if (to === 'devanagari') return devanagari;
  if (!devanagari) return '';
  const key = `${to}::${devanagari}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  try {
    const out = Sanscript.t(devanagari, 'devanagari', SCHEME[to]);
    if (cache.size > 4000) cache.clear();
    cache.set(key, out);
    return out;
  } catch {
    return devanagari;
  }
}

export function fontClassFor(code: ScriptCode): string {
  return SCRIPT_OPTIONS.find((o) => o.code === code)?.fontClass ?? 'script-devanagari';
}

export function scriptByCode(code: ScriptCode): ScriptOption {
  return SCRIPT_OPTIONS.find((o) => o.code === code) ?? SCRIPT_OPTIONS[0];
}

/**
 * Convert input in any supported script into Devanagari. Detects the source
 * script by codepoint ranges or, for romanized input, by diacritic patterns.
 * Returns the input unchanged if no mapping can be determined.
 */
export function toDevanagari(input: string): string {
  if (!input) return input;
  const from = detectScript(input);
  if (from === 'devanagari') return input;
  try {
    return Sanscript.t(input, SCHEME[from], 'devanagari');
  } catch {
    return input;
  }
}

/** Rough script detector used by the search bar. */
export function detectScript(s: string): ScriptCode {
  const ranges: Array<[ScriptCode, RegExp]> = [
    ['devanagari', /[ऀ-ॿ]/],
    ['malayalam', /[ഀ-ൿ]/],
    ['tamil', /[஀-௿]/],
    ['telugu', /[ఀ-౿]/],
    ['kannada', /[ಀ-೿]/],
    ['bengali', /[ঀ-৿]/],
    ['gurmukhi', /[਀-੿]/],
    ['gujarati', /[઀-૿]/],
    ['oriya', /[଀-୿]/],
  ];
  for (const [code, re] of ranges) if (re.test(s)) return code;
  // Romanized: IAST if diacritics, else ITRANS if capitalized clusters, else HK.
  if (/[āīūṛṝḷḹṃḥṅñṭḍṇśṣ]/i.test(s)) return 'iast';
  if (/[A-Z]{2,}|\./.test(s)) return 'itrans';
  return 'hk';
}
