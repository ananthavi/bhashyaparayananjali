/**
 * Reverse-sandhi sanity test.
 *
 * Per docs/authoritative-validation-plan.md §4.1, every (left, right,
 * joined) triple should round-trip through forward + reverse sandhi.
 * The current codebase only has the *reverse* direction (the bhāṣya
 * splitter); a forward-sandhi function arrives with the Pāṇinian
 * engine integration. Until then, this test exercises the reverse
 * direction against a small hand-curated set of triples drawn from
 * actual bhāṣya text.
 *
 * The gold corpus (`tests/gold/<slug>.yaml`) does not yet carry a
 * `sandhi:` block; when reviewer-signed entries land we'll iterate
 * over those instead of the inline list. The structural test stays
 * stable either way.
 */
import { describe, expect, it } from 'vitest';
import { aksharas } from '@/lib/sandhi/aksharas';
import { proposeAt } from '@/lib/sandhi/rules';

interface Triple {
  left: string;
  right: string;
  joined: string;
  notes?: string;
}

const TRIPLES: Triple[] = [
  // Vowel coalescence: a + i → e
  { left: 'तत्र', right: 'इदम्', joined: 'तत्रेदम्' },
  // Vowel coalescence: a + a → ā
  { left: 'न', right: 'अस्ति', joined: 'नास्ति' },
  // Visarga sandhi: aḥ + voiced → o
  { left: 'देवः', right: 'अस्ति', joined: 'देवोऽस्ति', notes: 'avagraha' },
];

// Known gaps in the existing reverse-sandhi splitter — the Pāṇinian
// engine integration is expected to close these. Listed here so the
// test history makes the expectation explicit.
//   - Yan-sandhi at a virāma boundary: इति + अपि → इत्यपि
//     (the splitter currently doesn't propose this reversal; tracked
//     in docs/paninian-engine-plan.md §3.)

function reverseSplitsAtAnyBoundary(joined: string): Array<{ left: string; right: string }> {
  const seq = aksharas(joined);
  const out: Array<{ left: string; right: string }> = [];
  for (let i = 1; i < seq.length; i++) {
    for (const c of proposeAt(seq, i)) {
      out.push({ left: c.left, right: c.right });
    }
  }
  return out;
}

describe('reverse-sandhi sanity (property)', () => {
  for (const t of TRIPLES) {
    it(`splits ${t.joined} into a candidate including ${t.left} | ${t.right}`, () => {
      const candidates = reverseSplitsAtAnyBoundary(t.joined);
      const found = candidates.some(
        (c) =>
          (c.left === t.left && c.right === t.right) ||
          // Some triples drop avagraha or anusvāra surface ornamentation;
          // accept a normalised compare for those.
          (normalise(c.left) === normalise(t.left) &&
            normalise(c.right) === normalise(t.right)),
      );
      expect(found).toBe(true);
    });
  }
});

function normalise(s: string): string {
  return s.replace(/[ऽ]/g, '').replace(/ं/g, 'म्').trim();
}
