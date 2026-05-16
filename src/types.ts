/**
 * Normalized domain types for the Prasthanatrayi-bhashya corpus.
 *
 * A Text is one of the 13 bhashyas. It contains Chapters which contain Units.
 * A Unit is either an introductory/concluding prose block (`intro`), a mantra
 * (for Upanishads), a sutra (for Brahmasutra), or a verse (for Gita). Each
 * mantra/sutra/verse unit carries a `root` (the mula) and an ordered list of
 * prose/citation `blocks` that make up Shankara's commentary.
 */

export type ScriptCode =
  | 'devanagari'
  | 'malayalam'
  | 'tamil'
  | 'telugu'
  | 'kannada'
  | 'bengali'
  | 'gurmukhi'
  | 'gujarati'
  | 'oriya'
  | 'grantha'
  | 'iast'
  | 'itrans'
  | 'hk';

export interface ScriptOption {
  code: ScriptCode;
  label: string; // native script label shown on toggle
  englishName: string;
  fontClass: string;
  isRomanized: boolean;
}

export type UnitKind =
  | 'intro' // intro_bhashya / leading_bhashya — prose not attached to a root verse
  | 'mantra' // Upanishad
  | 'sutra' // Brahmasutra
  | 'verse' // Gita shloka
  | 'karika'; // Gauḍapāda kārikā (Māṇḍūkya prakaraṇas 2-4)

export type BlockKind =
  | 'bhashya' // main commentary prose
  | 'aux_bhashya' // aux commentary prose
  | 'leading_bhashya' // prose leading into a verse
  | 'intro_bhashya' // prose at start of chapter / adhikarana
  | 'aux_shloka' // cited shloka inside the commentary
  | 'pratika'; // mula pada being commented on (where present)

export interface ProseBlock {
  kind: BlockKind;
  /** Devanagari Sanskrit, as scraped. Single script of truth; convert at render time. */
  text: string;
  /** Optional source id for stable anchoring. */
  id?: string;
}

export interface BhashyaUnit {
  /** Stable DOM id from source, e.g. "IS_C01_V01", "BS_C01_S01_V01". */
  id: string;
  kind: UnitKind;
  /** 1-based ordinal within the chapter. intro units may share ordinal with neighbors. */
  ordinal: number;
  /** Mula (verse/sutra/mantra) text in Devanagari. Empty for intro units. */
  root: string;
  /** Commentary blocks, in document order. */
  blocks: ProseBlock[];
}

export interface BhashyaChapter {
  /** Stable id, e.g. "IS_C01", "Ka_C01_S01", "BS_C01_S01". */
  id: string;
  /** Ordinal (1-based) within the text. Adhyayas and padas are flattened. */
  ordinal: number;
  /** Optional Sanskrit heading of this leaf section, e.g. "प्रथमा वल्ली". */
  titleSa?: string;
  /** Sanskrit heading of the parent adhyaya, if the text is subdivided. */
  parentTitleSa?: string;
  /** 1-based ordinal of the parent adhyaya within the text. */
  parentOrdinal?: number;
  /** e.g. "valli" / "khanda" / "pada" / "prashna" / "mundaka". */
  kind?: string;
  units: BhashyaUnit[];
}

export interface BhashyaText {
  /** Stable slug, e.g. "isha", "kena-vakya", "brahma-sutra". */
  slug: string;
  /** Source path segment on advaitasharada.sringeri.net. */
  sourceCode: string;
  /** Sanskrit title, e.g. "ईशावास्योपनिषद्भाष्यम्". */
  titleSa: string;
  /** Romanized title, e.g. "Īśāvāsyopaniṣad-bhāṣyam". */
  titleIast: string;
  /** Human English name for the book. */
  titleEn: string;
  /** Short family label shown in the library. */
  group: 'upanishad' | 'gita' | 'brahma-sutra';
  /** Original URL on advaitasharada.sringeri.net (devanagari view). */
  sourceUrl: string;
  /** ISO timestamp at which the content was scraped. */
  fetchedAt: string;
  /** Total counts, cached for library UI. */
  counts: {
    chapters: number;
    mantras: number;
    intros: number;
    words: number;
  };
  chapters: BhashyaChapter[];
}

/**
 * A small, fast-loading description of a chapter without its body. The
 * manifest exposes one of these per chapter so the reader's TOC, the
 * persistent parayanam toolbar, and breadcrumb labels render
 * immediately, while the units' content streams in lazily.
 */
export interface ChapterStub {
  id: string;
  ordinal: number;
  titleSa?: string;
  parentTitleSa?: string;
  parentOrdinal?: number;
  kind?: string;
  /** id-only summary of every unit in the chapter, in order. */
  units: Array<{ id: string; kind: BhashyaUnit['kind']; ordinal: number }>;
  /** Service-worker-cacheable URL of the full chapter chunk JSON. */
  chunkPath: string;
  /** Bytes of the chunk file (informational; helps loading UI). */
  chunkSize: number;
}

/**
 * Manifest for a single bhāṣya. ~5–50 KB depending on text size — the
 * reader downloads this first, renders the TOC, then fetches each
 * chapter chunk only when the user scrolls it into view (or when
 * search / voice-follow needs all chapters at once).
 */
export interface BhashyaManifest {
  slug: string;
  titleSa: string;
  titleIast: string;
  titleEn: string;
  group: BhashyaText['group'];
  sourceUrl: string;
  fetchedAt: string;
  counts: BhashyaText['counts'];
  /** Whether this text was split into chunks. False for tiny texts that
   *  ship as one file (chapter chunks point back to the same file). */
  chunked: boolean;
  chapters: ChapterStub[];
}

/**
 * One chunk of a bhāṣya — the units of a single chapter, body included.
 */
export interface BhashyaChapterChunk {
  textSlug: string;
  chapter: BhashyaChapter;
}

/**
 * Lightweight catalog entry served at /data/index.json so the library screen
 * can render without loading every text's body.
 */
export interface CatalogEntry {
  slug: string;
  titleSa: string;
  titleIast: string;
  titleEn: string;
  group: BhashyaText['group'];
  sourceUrl: string;
  counts: BhashyaText['counts'];
  dataPath: string; // e.g. "/data/bhashya/isha.json"
  sizeBytes: number;
}

export interface Catalog {
  generatedAt: string;
  sourceAttribution: {
    name: string;
    url: string;
    note: string;
  };
  texts: CatalogEntry[];
}

export interface SearchIndexDoc {
  id: string; // textSlug:unitId
  textSlug: string;
  unitId: string;
  chapterOrdinal: number;
  unitOrdinal: number;
  snippet: string; // first ~160 chars in Devanagari
}
