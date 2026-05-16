/**
 * Adapter types for a Pāṇinian engine.
 *
 * The interface is engine-agnostic: any backend that can enumerate
 * valid derivations from a Sanskrit surface form (Vidyut WASM,
 * Sanskrit Heritage Engine via REST, samsAdhanī, a hand-rolled
 * implementation) can plug in by implementing PaniniEngine.
 *
 * The default implementation in this commit is `null-engine.ts`,
 * which returns empty results for every call. The real Vidyut
 * WASM adapter will land in a follow-up PR; see
 * docs/paninian-engine-plan.md §5.
 *
 * All input and output strings are Devanāgarī.
 */

export type SamasaType =
  | 'dvandva'
  | 'tatpurusha'
  | 'karmadharaya'
  | 'dvigu'
  | 'bahuvrihi'
  | 'avyayibhava';

export type Pos = 'noun' | 'verb' | 'particle' | 'pronoun' | 'adjective' | 'numeral' | 'unknown';

export interface Morphology {
  /** Verbal: one of la-T, li-T, lu-T, lṛ-T, leT, loT, laN, liN, luN, lṛN. */
  lakara?: string;
  /** Verbal: 1, 2, 3 (uttama, madhyama, prathama puruṣa). */
  purusha?: 1 | 2 | 3;
  /** Verbal + nominal: eka, dvi, bahu. */
  vacana?: 'eka' | 'dvi' | 'bahu';
  /** Verbal: P (parasmaipada) / A (ātmanepada) / U (ubhaya). */
  pada?: 'P' | 'A' | 'U';
  /** Nominal: vibhakti 1..7. 8 marks sambodhana (vocative) as a distinct category for engines that prefer it explicit. */
  vibhakti?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  /** Nominal: gender. */
  linga?: 'm' | 'f' | 'n';
  /** Krit / taddhita marker, e.g. "kta", "ktvā", "tva". */
  pratyaya?: string;
  /** Free-form additional marker the engine wants to record. */
  extra?: Record<string, string>;
}

export interface PaniniAnalysis {
  /** Lemma (citation form): dhātu for a verb, prātipadika for a noun. */
  lemma: string;
  /** Coarse part-of-speech. */
  pos: Pos;
  /** Detailed morphology — empty for indeclinables. */
  morph: Morphology;
  /** Compound parts when the input is a samāsa. */
  parts?: PaniniAnalysis[];
  /** Samāsa class, when applicable. */
  samasaType?: SamasaType;
  /** Confidence in [0, 1]. Engines that don't score should return 1.0. */
  confidence: number;
  /**
   * Optional sūtra trace explaining the derivation. Each entry is a
   * sūtra reference like "3.1.68" or "6.1.77 yan-sandhi". Useful for
   * pedagogical display and for debugging engine disagreements.
   */
  sutras?: string[];
  /** Engine that produced this analysis (for provenance display). */
  engine: string;
}

/** Options for the Pāṇinian engine adapter. */
export interface AnalyzeOptions {
  /** Cap the number of returned analyses; defaults to engine choice. */
  limit?: number;
  /** Drop analyses whose confidence is below this. */
  minConfidence?: number;
}

export interface PaniniEngine {
  /** Engine identifier — e.g. "vidyut-wasm@0.7.2", "null". */
  readonly name: string;
  /** True when the engine is loaded and able to serve calls. */
  readonly available: boolean;
  /**
   * Enumerate every valid Pāṇinian analysis of a single surface word.
   * Order: highest-confidence first.
   */
  analyze(devanagariWord: string, opts?: AnalyzeOptions): Promise<PaniniAnalysis[]>;
  /**
   * Sandhi-split a multi-pada utterance (e.g. a sūtra body) into
   * possible token sequences. Returns multiple candidate
   * sequences; downstream picks one.
   */
  segment(devanagariUtterance: string): Promise<string[][]>;
  /**
   * Forward inflection: given a lemma + a partial morphology spec,
   * return every valid surface form. Empty array means the engine
   * couldn't generate any (unknown root, missing rules, etc.).
   */
  inflect(lemma: string, morph: Morphology): Promise<string[]>;
}
