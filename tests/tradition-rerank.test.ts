import { describe, expect, it } from 'vitest';
import { rerankSenses } from '@/lib/tradition-rerank';

describe('rerankSenses (advaita-sringeri prior)', () => {
  it('promotes the absolute / non-dual sense for ब्रह्म', () => {
    const senses = [
      'sacred utterance, prayer; the Veda',
      'the absolute, non-dual reality (Brahman)',
      'a Brahmin priest',
    ];
    const r = rerankSenses('gita', 'ब्रह्म', senses);
    expect(r[0].text).toMatch(/absolute/);
    expect(r[0].score).toBeGreaterThan(0);
    expect(r[0].matched).toBeDefined();
  });

  it('promotes liberation for मोक्ष', () => {
    const senses = ['shedding (of leaves)', 'final release, liberation'];
    const r = rerankSenses('brahma-sutra', 'मोक्ष', senses);
    expect(r[0].text).toMatch(/liberation/);
  });

  it('returns the original order when no prior exists for the head', () => {
    const senses = ['first', 'second', 'third'];
    const r = rerankSenses('gita', 'अप्रसिद्धशब्द', senses);
    expect(r.map((x) => x.text)).toEqual(senses);
    expect(r.every((x) => x.score === 0)).toBe(true);
  });

  it('returns single-sense input unchanged', () => {
    const senses = ['only one sense here'];
    const r = rerankSenses('gita', 'ब्रह्म', senses);
    expect(r).toHaveLength(1);
    expect(r[0].text).toBe(senses[0]);
  });

  it('is stable for senses with equal scores', () => {
    const senses = ['unrelated A', 'unrelated B', 'unrelated C'];
    const r = rerankSenses('gita', 'ब्रह्म', senses);
    expect(r.map((x) => x.text)).toEqual(senses);
  });
});
