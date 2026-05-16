import { describe, it, expect } from 'vitest';
import { splitLeadingBlocks } from '../src/components/BhashyaUnitView';
import type { ProseBlock } from '../src/types';

const mk = (kind: ProseBlock['kind'], text: string): ProseBlock => ({ kind, text });

describe('splitLeadingBlocks (Bug 1: avatharanika ordering)', () => {
  it('moves a leading_bhashya at the START before the mantra', () => {
    const blocks: ProseBlock[] = [
      mk('leading_bhashya', 'अवतरणिका'),
      mk('bhashya', 'मुख्यभाष्यम्'),
    ];
    const { leadingBlocks, trailingBlocks } = splitLeadingBlocks(blocks, true);
    expect(leadingBlocks.map((b) => b.kind)).toEqual(['leading_bhashya']);
    expect(trailingBlocks.map((b) => b.kind)).toEqual(['bhashya']);
  });

  it('moves consecutive leading_bhashya + intro_bhashya at the start', () => {
    const blocks: ProseBlock[] = [
      mk('leading_bhashya', 'अवतरणिका १'),
      mk('intro_bhashya', 'भूमिका'),
      mk('bhashya', 'मुख्यभाष्यम्'),
      mk('aux_bhashya', 'अनुबन्ध'),
    ];
    const { leadingBlocks, trailingBlocks } = splitLeadingBlocks(blocks, true);
    expect(leadingBlocks.map((b) => b.kind)).toEqual([
      'leading_bhashya',
      'intro_bhashya',
    ]);
    expect(trailingBlocks.map((b) => b.kind)).toEqual(['bhashya', 'aux_bhashya']);
  });

  it('leaves leading_bhashya AFTER a non-leading block in place', () => {
    // Once a main bhashya has appeared, any later leading-style block is
    // attached to a sub-section and must NOT jump above the mantra.
    const blocks: ProseBlock[] = [
      mk('bhashya', 'मुख्य'),
      mk('leading_bhashya', 'मध्यतोऽवतरणिका'),
      mk('bhashya', 'अधिकम्'),
    ];
    const { leadingBlocks, trailingBlocks } = splitLeadingBlocks(blocks, true);
    expect(leadingBlocks).toEqual([]);
    expect(trailingBlocks.map((b) => b.kind)).toEqual([
      'bhashya',
      'leading_bhashya',
      'bhashya',
    ]);
  });

  it('does not pull blocks above an intro unit (no mūla to lead into)', () => {
    const blocks: ProseBlock[] = [
      mk('leading_bhashya', 'अवतरणिका'),
      mk('bhashya', 'मुख्य'),
    ];
    const { leadingBlocks, trailingBlocks } = splitLeadingBlocks(blocks, false);
    expect(leadingBlocks).toEqual([]);
    expect(trailingBlocks.map((b) => b.kind)).toEqual(['leading_bhashya', 'bhashya']);
  });

  it('handles empty block list', () => {
    const { leadingBlocks, trailingBlocks } = splitLeadingBlocks([], true);
    expect(leadingBlocks).toEqual([]);
    expect(trailingBlocks).toEqual([]);
  });
});
