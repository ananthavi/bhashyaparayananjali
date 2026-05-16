/**
 * Per-text corpus indexer for voice match.
 *
 * Flattens a BhashyaText into a single stream of normalized akṣaras
 * paired with provenance markers (which unit + which character offset
 * inside that unit), so the matcher can return both an akṣara index and
 * a unit id without an extra scan.
 */

import type { BhashyaText } from '@/types';
import { tokensFor } from './normalize';

export interface VoiceCorpusEntry {
  unitId: string;
  /** Position of this akṣara within the unit's combined text (root + blocks). */
  unitOffset: number;
}

export interface VoiceCorpus {
  /** Flat akṣara stream — what the matcher searches over. */
  tokens: string[];
  /** Parallel array describing where each token came from. */
  entries: VoiceCorpusEntry[];
  /** Map unitId → first token index, for fast hint lookup. */
  unitStart: Map<string, number>;
}

export function buildVoiceCorpus(text: BhashyaText): VoiceCorpus {
  const tokens: string[] = [];
  const entries: VoiceCorpusEntry[] = [];
  const unitStart = new Map<string, number>();

  for (const ch of text.chapters) {
    for (const u of ch.units) {
      // Combine the mula + every commentary block into one source string,
      // so users can recite either the verse or the bhāṣya and we'll
      // still locate them.
      const combined = [u.root, ...u.blocks.map((b) => b.text)].filter(Boolean).join(' ');
      const t = tokensFor(combined);
      if (t.length === 0) continue;
      unitStart.set(u.id, tokens.length);
      for (let i = 0; i < t.length; i++) {
        tokens.push(t[i]);
        entries.push({ unitId: u.id, unitOffset: i });
      }
    }
  }
  return { tokens, entries, unitStart };
}
