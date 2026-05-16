import { describe, it, expect } from 'vitest';
import { aksharas, aksharaCount, isConsonant, isIndependentVowel } from '@/lib/sandhi/aksharas';
import { proposeAt } from '@/lib/sandhi/rules';
import { proposeLemmas } from '@/lib/sandhi/inflect';
import { splitCompound } from '@/lib/sandhi/compound';

describe('aksharas', () => {
  it('segments simple Devanagari into akṣaras', () => {
    expect(aksharas('कमल')).toEqual(['क', 'म', 'ल']);
    expect(aksharas('रामः')).toEqual(['रा', 'मः']);
  });

  it('absorbs halant + consonant chains as a single akṣara', () => {
    expect(aksharaCount('ब्रह्म')).toBe(2); // ब्र, ह्म
    expect(aksharaCount('कृष्ण')).toBe(2); // कृ, ष्ण
  });

  it('keeps anusvāra and visarga clinging to the previous akṣara', () => {
    expect(aksharas('अहं')).toEqual(['अ', 'हं']);
    expect(aksharas('कः')).toEqual(['कः']);
  });

  it('round-trips: joining akṣaras reproduces the original string', () => {
    for (const w of ['ईशावास्यमिदं', 'सर्वम्', 'ब्रह्मविद्या', 'आत्मन्', 'अहंकार']) {
      expect(aksharas(w).join('')).toBe(w);
    }
  });

  it('classifies consonants and vowels', () => {
    expect(isConsonant('क')).toBe(true);
    expect(isIndependentVowel('अ')).toBe(true);
    expect(isIndependentVowel('क')).toBe(false);
  });
});

describe('sandhi rule proposals', () => {
  it('proposes a-coalescence reversal at a long ā', () => {
    // विद्यालय could come from विद्या + आलय (ā + ā → ā). Boundary is after द्या.
    const ak = aksharas('विद्यालय');
    const idx = ak.findIndex((a) => a.endsWith('ा')) + 1;
    expect(idx).toBeGreaterThan(0);
    const props = proposeAt(ak, idx);
    expect(props.find((p) => p.rule.startsWith('vowel-'))).toBeDefined();
    // The trivial no-sandhi split is always available.
    expect(props.find((p) => p.rule === 'no-sandhi')).toBeDefined();
  });

  it('proposes visarga restoration for o-final left half', () => {
    const ak = aksharas('रामोऽस्ति');
    // Boundary just after ो — propose aḥ + ...
    const idx = 2;
    const props = proposeAt(ak, idx);
    expect(props.some((p) => p.rule.includes('visarga-aḥ'))).toBe(true);
  });
});

describe('inflection lemma resolver', () => {
  it('resolves a-stem genitive singular', () => {
    const lemmas = proposeLemmas('रामस्य');
    expect(lemmas.some((l) => l.lemma === 'राम' && l.label.includes('gen'))).toBe(true);
  });

  it('resolves n-stem genitive singular', () => {
    const lemmas = proposeLemmas('ब्रह्मणः');
    expect(lemmas.some((l) => l.lemma.endsWith('न्'))).toBe(true);
  });

  it('resolves a-stem locative plural', () => {
    const lemmas = proposeLemmas('लोकेषु');
    expect(lemmas.some((l) => l.lemma === 'लोक')).toBe(true);
  });

  it('resolves -tva abstract noun forms', () => {
    const lemmas = proposeLemmas('एकत्वात्');
    expect(lemmas.some((l) => l.lemma === 'एक')).toBe(true);
  });

  it('returns empty array for indeclinable particles', () => {
    expect(proposeLemmas('च')).toEqual([]);
  });
});

describe('compound splitter', () => {
  const lemmas = new Set(['ब्रह्म', 'विद्या', 'योग', 'आचार्य', 'ज्ञान', 'मार्ग', 'धर्म']);
  const isLemma = (s: string): boolean => lemmas.has(s);

  it('splits a 2-part compound when both halves are known lemmas', () => {
    const splits = splitCompound('ब्रह्मविद्या', { isLemma });
    const best = splits[0];
    expect(best.parts).toEqual(['ब्रह्म', 'विद्या']);
    expect(best.score).toBe(1);
  });

  it('returns the trivial single-part split when nothing matches', () => {
    const splits = splitCompound('क्षनदोह', { isLemma });
    expect(splits[0].parts.length).toBe(1);
  });

  it('finds nested compounds', () => {
    const splits = splitCompound('ब्रह्मविद्यायोग', { isLemma });
    const best = splits[0];
    expect(best.score).toBeGreaterThan(0.6);
    expect(best.parts.length).toBeGreaterThanOrEqual(2);
  });
});
