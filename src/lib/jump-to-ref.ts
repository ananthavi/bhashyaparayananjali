/**
 * Parse free-text references like `3.42`, `4.5.13`, `1.1.12`, or `7`
 * and resolve them to a unit id within a `BhashyaManifest`.
 *
 * The reference grammar is dotted ordinals (one to three parts) drawn
 * from the natural numbering system of each text family:
 *
 *   • `7`         — a single unit ordinal. Used in single-section
 *                   texts like Īśa, Kena, where the manifest has one
 *                   chapter and the verse number alone disambiguates.
 *   • `3.42`      — adhyāya/chapter `3`, verse `42`. Gītā-style: the
 *                   chapter has no parent grouping.
 *   • `1.1.12`    — adhyāya `1`, pāda `1`, sūtra `12`. Brahma-sūtra
 *                   nesting.
 *   • `4.5.13`    — adhyāya `4`, brāhmaṇa `5`, mantra `13`. Bṛhadāraṇ-
 *                   yaka nesting.
 *
 * No text family is hard-coded. We walk the manifest's ChapterStub
 * list, matching on `parentOrdinal` / `ordinal` / unit `ordinal`,
 * and the resolved unit id is whatever the manifest already carries
 * (so prefixes like `BG_`, `BS_`, `BR_`, `IS_`, `KP_`, `KV_` etc.
 * never need to appear in this code).
 *
 * Intro units (`kind: 'intro'`) are intentionally skipped — a user
 * who types `2.1` for the Gītā wants verse 1 of adhyāya 2, not the
 * leading bhāṣya.
 */

import type { BhashyaManifest, ChapterStub } from '@/types';

export type JumpResult =
  | { ok: true; unitId: string }
  | { ok: false; reason: 'parse' | 'no-match'; message: string };

/**
 * Parse the user-typed reference into ordinal parts. Returns null if
 * the string isn't a valid dotted-numeric ref. Trims whitespace and
 * accepts a trailing dot to be forgiving (e.g. `3.42.`).
 */
export function parseRef(input: string): number[] | null {
  const trimmed = input.trim().replace(/\.+$/, '');
  if (!trimmed) return null;
  if (!/^\d+(?:\.\d+){0,2}$/.test(trimmed)) return null;
  const parts = trimmed.split('.').map((p) => Number.parseInt(p, 10));
  if (parts.some((n) => !Number.isFinite(n) || n <= 0)) return null;
  return parts;
}

/**
 * Walk a manifest's chapters and return the unit id that matches the
 * given dotted reference, or null if nothing matches.
 *
 * Matching rules, given parts = [p1, p2?, p3?]:
 *
 *   - 1 part: find a unit whose `ordinal === p1`. Restricted to the
 *     manifest's first/only chapter when the text is single-section
 *     (i.e. no chapter has a parentOrdinal AND there's only one
 *     non-pseudo group). Otherwise we still search the first chapter
 *     to keep `7` deterministic.
 *
 *   - 2 parts: chapter where `parentOrdinal` is unset/0 and
 *     `ordinal === p1`, then unit where `ordinal === p2`.
 *
 *   - 3 parts: chapter where `parentOrdinal === p1` and
 *     `ordinal === p2`, then unit where `ordinal === p3`.
 *
 * In every case we skip `intro` units when matching the leaf ordinal —
 * users typing `2.1` mean the first verse, not the chapter intro.
 */
export function resolveRef(manifest: BhashyaManifest, parts: number[]): string | null {
  if (parts.length === 0 || parts.length > 3) return null;

  if (parts.length === 1) {
    return resolveSingle(manifest, parts[0]);
  }
  if (parts.length === 2) {
    return resolveFlat(manifest, parts[0], parts[1]);
  }
  return resolveNested(manifest, parts[0], parts[1], parts[2]);
}

function findUnitByOrdinal(chapter: ChapterStub, ordinal: number): string | null {
  // Prefer non-intro units; an `intro` unit can share an ordinal with
  // its neighbouring verse, and the user almost always means the verse.
  const nonIntro = chapter.units.find(
    (u) => u.kind !== 'intro' && u.ordinal === ordinal,
  );
  if (nonIntro) return nonIntro.id;
  return null;
}

function resolveSingle(manifest: BhashyaManifest, ordinal: number): string | null {
  // Single-section texts have exactly one chapter; pick it.
  if (manifest.chapters.length === 1) {
    return findUnitByOrdinal(manifest.chapters[0], ordinal);
  }
  // For multi-chapter texts a bare ordinal is ambiguous, but if the
  // first chapter has the requested verse we still honour it — useful
  // for Kaṭha/Praśna-style texts where each "section" only has a
  // handful of verses. If you typed something out of range we'll
  // simply return null and the caller surfaces "no match".
  if (manifest.chapters.length === 0) return null;
  return findUnitByOrdinal(manifest.chapters[0], ordinal);
}

function resolveFlat(
  manifest: BhashyaManifest,
  chapterOrd: number,
  unitOrd: number,
): string | null {
  // Top-level chapter = no parentOrdinal. Gītā-style.
  const chapter = manifest.chapters.find(
    (c) => !c.parentOrdinal && c.ordinal === chapterOrd,
  );
  if (chapter) {
    const unit = findUnitByOrdinal(chapter, unitOrd);
    if (unit) return unit;
  }
  // Fallback: some single-section texts (e.g. Kena-vākya) have several
  // khaṇḍas as flat chapters with no parent. Try matching ordinal-only.
  const flat = manifest.chapters.find((c) => c.ordinal === chapterOrd);
  if (flat) {
    return findUnitByOrdinal(flat, unitOrd);
  }
  return null;
}

function resolveNested(
  manifest: BhashyaManifest,
  parentOrd: number,
  chapterOrd: number,
  unitOrd: number,
): string | null {
  const chapter = manifest.chapters.find(
    (c) => c.parentOrdinal === parentOrd && c.ordinal === chapterOrd,
  );
  if (!chapter) return null;
  return findUnitByOrdinal(chapter, unitOrd);
}

/**
 * High-level helper: parse + resolve in one go. Returns a discriminated
 * union with a human-friendly message for the UI's inline error.
 */
export function jumpToRef(manifest: BhashyaManifest, input: string): JumpResult {
  const parts = parseRef(input);
  if (!parts) {
    return {
      ok: false,
      reason: 'parse',
      message: `couldn't parse "${input.trim()}" — try 3.42 or 1.1.12`,
    };
  }
  const unitId = resolveRef(manifest, parts);
  if (!unitId) {
    return {
      ok: false,
      reason: 'no-match',
      message: `no unit matched ${parts.join('.')} in ${manifest.titleEn}`,
    };
  }
  return { ok: true, unitId };
}
