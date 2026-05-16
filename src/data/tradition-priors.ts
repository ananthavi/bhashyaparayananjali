/**
 * Tradition / lineage prior over dictionary senses.
 *
 * For ambiguous polysemous head-words, the dictionary's natural sense
 * order (alphabetical, or chronological by attestation) often surfaces
 * a peripheral meaning above the one the bhāṣya is invoking. The
 * tradition prior is a hand-curated list of "what this term means in
 * THIS commentarial tradition" — ordered keywords / phrases that, when
 * any of them appear in a candidate sense, push that sense up.
 *
 * Per docs/context-meaning-plan.md §4.4 (the *Prakaraṇa + Samākhyā*
 * pramāṇas in the Mīmāṁsā stack), this is the cheapest single-feature
 * win for our current corpus: every text we bundle is from the
 * Advaita-Sringeri lineage, so the same prior applies to all 13.
 *
 * When we expand to a different lineage (Vaiṣṇava, Smārta-non-Advaita,
 * etc.) a new tag will be added to `traditionFor()` and a separate
 * priors map keyed by tag.
 *
 * Reviewer-sign-off note: this table is a starter — entries should be
 * audited by a Vedānta-Advaita reviewer per the validation regime in
 * docs/authoritative-validation-plan.md §3.2 before being treated as
 * authoritative for sense-ranking.
 */

export type TraditionTag = 'advaita-sringeri';

export interface SensePrior {
  /** Devanāgarī or IAST head-word. We match on the Devanāgarī key. */
  head: string;
  /**
   * Ordered list of preferred-sense markers. A candidate sense gets a
   * higher rank score when more of these substrings (case-insensitive
   * for ASCII) appear in its English gloss. The ORDER of the array
   * also matters: earlier markers are weighted slightly higher.
   */
  preferred: string[];
}

const ADVAITA_SRINGERI: SensePrior[] = [
  {
    head: 'ब्रह्म',
    preferred: [
      'absolute',
      'non-dual',
      'supreme self',
      'the supreme',
      'ultimate reality',
      'Brahman',
    ],
  },
  {
    head: 'ब्रह्मन्',
    preferred: [
      'absolute',
      'non-dual',
      'supreme self',
      'the supreme',
      'ultimate reality',
      'Brahman',
    ],
  },
  {
    head: 'आत्मन्',
    preferred: [
      'self',
      'the self',
      'soul',
      'inmost essence',
      'innermost being',
      'Ātman',
    ],
  },
  {
    head: 'आत्म',
    preferred: ['self', 'the self', 'inmost essence', 'soul'],
  },
  {
    head: 'विद्या',
    preferred: ['knowledge', 'true knowledge', 'right knowledge', 'spiritual knowledge'],
  },
  {
    head: 'अविद्या',
    preferred: [
      'ignorance',
      'nescience',
      'metaphysical ignorance',
      'beginningless ignorance',
    ],
  },
  {
    head: 'माया',
    preferred: ['illusion', 'cosmic illusion', 'creative power', 'unreality', 'māyā'],
  },
  {
    head: 'मोक्ष',
    preferred: ['liberation', 'final release', 'emancipation', 'release', 'mokṣa'],
  },
  {
    head: 'धर्म',
    preferred: ['duty', 'right conduct', 'religious duty', 'moral law'],
  },
  {
    head: 'कर्म',
    preferred: ['action', 'rite', 'religious rite', 'ritual action', 'work'],
  },
  {
    head: 'योग',
    preferred: ['discipline', 'union', 'spiritual discipline', 'meditation'],
  },
  {
    head: 'ज्ञान',
    preferred: ['knowledge', 'wisdom', 'true knowledge', 'spiritual knowledge'],
  },
  {
    head: 'सत्',
    preferred: ['real', 'existent', 'being', 'truth', 'real entity'],
  },
  {
    head: 'असत्',
    preferred: ['unreal', 'non-existent', 'untrue', 'illusory'],
  },
  {
    head: 'चित्',
    preferred: ['consciousness', 'pure consciousness', 'pure awareness', 'sentience'],
  },
  {
    head: 'आनन्द',
    preferred: ['bliss', 'happiness', 'supreme bliss'],
  },
  {
    head: 'अहंकार',
    preferred: ['ego', 'I-sense', 'egoism', 'sense of I'],
  },
  {
    head: 'जीव',
    preferred: ['individual self', 'embodied self', 'living being', 'soul'],
  },
  {
    head: 'ईश्वर',
    preferred: ['lord', 'God', 'supreme lord', 'the Lord'],
  },
  {
    head: 'पुरुष',
    preferred: ['supreme self', 'spirit', 'cosmic person', 'the person', 'Puruṣa'],
  },
  {
    head: 'प्रकृति',
    preferred: ['primal matter', 'nature', 'material cause', 'unmanifest source'],
  },
  {
    head: 'गुण',
    preferred: ['quality', 'attribute', 'sattva', 'rajas', 'tamas'],
  },
  {
    head: 'उपासना',
    preferred: ['meditation', 'contemplation', 'devout worship', 'meditative worship'],
  },
  {
    head: 'श्रद्धा',
    preferred: ['faith', 'trust', 'reverence', 'conviction'],
  },
  {
    head: 'सत्य',
    preferred: ['truth', 'reality', 'the real', 'truthfulness'],
  },
];

const TRADITION_PRIORS: Record<TraditionTag, SensePrior[]> = {
  'advaita-sringeri': ADVAITA_SRINGERI,
};

/**
 * Map a text-slug to its commentarial tradition. Every text in the
 * current bundle is Advaita-Sringeri (Śaṅkara's bhāṣyas, Sringeri
 * editions). Future texts can override here.
 */
export function traditionFor(_textSlug: string | null | undefined): TraditionTag {
  return 'advaita-sringeri';
}

const PRIOR_INDEX: Record<TraditionTag, Map<string, SensePrior>> = {
  'advaita-sringeri': new Map(ADVAITA_SRINGERI.map((e) => [e.head, e])),
};

export function priorFor(tradition: TraditionTag, head: string): SensePrior | undefined {
  return PRIOR_INDEX[tradition].get(head);
}

export const PRIOR_COUNT: Record<TraditionTag, number> = {
  'advaita-sringeri': ADVAITA_SRINGERI.length,
};

export { TRADITION_PRIORS };
