import { describe, expect, it } from 'vitest';
import { labelToMorph } from '@/lib/panini/label-to-morph';

describe('labelToMorph', () => {
  it('parses "a-stem gen. sg." correctly', () => {
    const m = labelToMorph('a-stem gen. sg.');
    expect(m).toEqual({ vibhakti: 6, vacana: 'eka', linga: 'm' });
  });

  it('parses "n-stem nom./acc. dual"', () => {
    const m = labelToMorph('n-stem nom./acc. dual');
    expect(m?.vacana).toBe('dvi');
    expect(m?.linga).toBe('n');
    // First-matched vibhakti wins; nom. (1) should appear before acc. (2).
    expect(m?.vibhakti).toBe(1);
  });

  it('parses "instr. pl." with no stem hint', () => {
    const m = labelToMorph('instr. pl.');
    expect(m).toEqual({ vibhakti: 3, vacana: 'bahu' });
  });

  it('parses verb labels: "perf. 3sg of √vac"', () => {
    const m = labelToMorph('perf. 3sg of √vac');
    expect(m?.lakara).toBe('lit');
    expect(m?.purusha).toBe(3);
    expect(m?.vacana).toBe('eka');
  });

  it('returns null for empty / unparseable input', () => {
    expect(labelToMorph('')).toBeNull();
    expect(labelToMorph('something irrelevant')).toBeNull();
  });

  it('returns null when verb has lakara but no purusha or vacana', () => {
    expect(labelToMorph('perfect tense generally')).toBeNull();
  });

  it('returns null when nominal has vibhakti but no vacana', () => {
    expect(labelToMorph('genitive case')).toBeNull();
  });
});
