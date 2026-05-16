/**
 * Render compact unit IDs (e.g. `BR_C04_S05_V13`, `BS_C01_S01_V01`,
 * `IS_C01_V07`) as proper human references using the chapter
 * metadata in the manifest. Examples of resolved labels:
 *
 *   • Bṛhadāraṇyaka  → "अध्याय 4 · ब्राह्मण 5 · मन्त्र 13"
 *   • Brahmasūtra    → "अध्याय 1 · पाद 1 · सूत्र 1"
 *   • Iśopaniṣad     → "मन्त्र 7"
 *   • Gītā           → "अध्याय 2 · श्लोक 13"
 *   • Mandukya       → "करिका · 18"  (when the unit lives in a
 *                                       Gauḍapāda kārikā chapter)
 *
 * If we don't have manifest metadata yet (e.g. on a cold history
 * page), we fall back to a clean numeric reference like
 * "C04 · S05 · V13" which is at least readable.
 */

import type { BhashyaManifest, ChapterStub } from '@/types';

/**
 * Map a chapter `kind` (from the source's `type` attribute) to a
 * Sanskrit label. The Sringeri source uses several spelling variants
 * (paada / pada, anuvaaka / anuvaka, brahmanam / brahmana) — we
 * accept all of them.
 */
const CHAPTER_KIND_LABEL: Record<string, string> = {
  adhyaya: 'अध्याय',
  valli: 'वल्ली',
  pada: 'पाद',
  paada: 'पाद',
  khanda: 'खण्ड',
  brahmana: 'ब्राह्मण',
  brahmanam: 'ब्राह्मण',
  prashna: 'प्रश्न',
  mundaka: 'मुण्डक',
  prapathaka: 'प्रपाठक',
  anuvaka: 'अनुवाक',
  anuvaaka: 'अनुवाक',
  karika: 'कारिका',
  prakarana: 'प्रकरण',
  prakaranam: 'प्रकरण',
  pseudo: '',
};

/** Map unit kind to a Sanskrit label. */
const UNIT_KIND_LABEL: Record<string, string> = {
  mantra: 'मन्त्र',
  sutra: 'सूत्र',
  verse: 'श्लोक',
  karika: 'कारिका',
  intro: 'भूमिका',
};

export interface UnitReference {
  /** Title-case Sanskrit/English label, e.g. "अध्याय 4 · ब्राह्मण 5 · मन्त्र 13". */
  short: string;
  /** Devanāgarī chapter title if the source provided one (e.g. "तृतीयो ब्राह्मणः"). */
  chapterFull?: string;
  /** Parent adhyāya title from the source, e.g. "द्वितीयोऽध्यायः". */
  parentFull?: string;
}

function findChapterByUnit(
  manifest: BhashyaManifest,
  unitId: string,
): ChapterStub | undefined {
  for (const ch of manifest.chapters) {
    for (const u of ch.units) {
      if (u.id === unitId) return ch;
    }
  }
  // ID may be the chapter id itself (used for "go to chapter").
  return manifest.chapters.find((c) => c.id === unitId);
}

function chapterKindLabel(kind?: string): string {
  if (!kind) return '';
  const k = kind.toLowerCase();
  return CHAPTER_KIND_LABEL[k] ?? k;
}

function unitKindLabel(kind?: string, ordinal?: number): string {
  if (!kind) return ordinal ? String(ordinal) : '';
  const k = UNIT_KIND_LABEL[kind] ?? kind;
  return ordinal ? `${k} ${ordinal}` : k;
}

/**
 * Build a reference label from manifest metadata. If `unitId` doesn't
 * correspond to a known unit, returns a degraded numeric form.
 */
export function describeUnit(manifest: BhashyaManifest, unitId: string): UnitReference {
  const chapter = findChapterByUnit(manifest, unitId);
  if (!chapter) {
    return { short: degradeId(unitId) };
  }
  const unit = chapter.units.find((u) => u.id === unitId);
  const parts: string[] = [];

  if (chapter.parentOrdinal) {
    parts.push(
      chapterKindLabel(detectAdhyayaKind(chapter)) || 'अध्याय',
    );
    parts[parts.length - 1] += ` ${chapter.parentOrdinal}`;
  }
  if (chapter.kind && chapter.kind !== 'pseudo') {
    parts.push(`${chapterKindLabel(chapter.kind) || 'विभाग'} ${chapter.ordinal}`);
  }
  // pseudo / unlabeled chapters contribute nothing — typical for short
  // single-section Upaniṣads (Iśa, etc.) where only the mantra ordinal
  // is meaningful.
  if (unit) {
    parts.push(unitKindLabel(unit.kind, unit.ordinal));
  }

  return {
    short: parts.length > 0 ? parts.join(' · ') : degradeId(unitId),
    chapterFull: chapter.titleSa,
    parentFull: chapter.parentTitleSa,
  };
}

/**
 * Heuristic: when a chapter has a parent grouping, the parent's kind
 * isn't stored separately on the stub — we infer it from convention:
 * adhyāya is the universal name for the top-level grouping in the
 * Sanskrit corpus. Falls back to "section" if the source kind is
 * something else.
 */
function detectAdhyayaKind(_ch: ChapterStub): string {
  return 'adhyaya';
}

/** Convert "BR_C04_S05_V13" → "C04 · S05 · V13". */
function degradeId(unitId: string): string {
  return unitId
    .split('_')
    .filter((p) => /^[A-Z]\d+/.test(p))
    .join(' · ');
}

/**
 * Synchronous degradation when the manifest hasn't loaded yet —
 * surfaces a non-cryptic placeholder.
 */
export function describeUnitFallback(unitId: string): UnitReference {
  return { short: degradeId(unitId) };
}
