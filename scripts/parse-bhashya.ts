/**
 * HTML → BhashyaText parser for advaitasharada.sringeri.net.
 *
 * Structure on the source:
 *   <div class="chapter" type="adhyaya" data-name="प्रथमोऽध्यायः">
 *     <div class="section" type="valli|pada|khanda" data-name="प्रथमा वल्ली">
 *       <div class="intro_bhashya">...</div>
 *       <div class="verse" type="mantra|sutra|shloka" id="...">
 *         <div class="leading_bhashya">...</div>  // optional
 *         <div class="versetext">mula</div>
 *         <div class="bhashya">...</div>          // one or more
 *         <div class="aux_bhashya">...</div>
 *         <div class="auxShloka">...</div>
 *       </div>
 *       <div class="verse" ...> ... </div>
 *     </div>
 *   </div>
 *
 * Short texts (Isha, Mandukya, Kena, Prashna, etc.) omit `div.section` and
 * place verses directly inside `div.chapter`. Brahma Sutra uses nested
 * chapters for adhyaya + pada.
 *
 * We treat a "leaf subdivision" as any `div.section` that exists, or any
 * `div.chapter` that has no descendant section or chapter. Each leaf becomes
 * one `BhashyaChapter` in our data model. The parent adhyaya's title is
 * carried on the chapter as `parentTitleSa` so the reader UI can show
 * "अध्याय १ · वल्ली १".
 */

import * as cheerio from 'cheerio';
import type {
  BhashyaChapter,
  BhashyaText,
  BhashyaUnit,
  BlockKind,
  ProseBlock,
} from '../src/types';

const BLOCK_CLASS_TO_KIND: Record<string, BlockKind> = {
  bhashya: 'bhashya',
  aux_bhashya: 'aux_bhashya',
  leading_bhashya: 'leading_bhashya',
  intro_bhashya: 'intro_bhashya',
  auxShloka: 'aux_shloka',
  pratika: 'pratika',
};

/** Normalize whitespace, NBSPs, and extra line breaks. */
export function normalizeText(raw: string): string {
  return raw
    .replace(/ /g, ' ')
    .replace(/​/g, '')
    .replace(/[\t\r]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

function countSanskritWords(s: string): number {
  return (s.match(/[ऀ-ॿ]+/g) ?? []).length;
}

function blockKindForClass(cls: string): BlockKind | null {
  for (const c of cls.split(/\s+/)) {
    if (BLOCK_CLASS_TO_KIND[c]) return BLOCK_CLASS_TO_KIND[c];
  }
  return null;
}

// Cheerio's generic takes a DOM node type; parseMarkup returns an anynode
// iterable. Using `any` here keeps the call sites simple without losing
// correctness — we only call the traversal helpers, not node-typed APIs.
/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyEl = cheerio.Cheerio<any>;
type AnyApi = cheerio.CheerioAPI;

function elementText(_$: AnyApi, el: AnyEl): string {
  const clone = el.clone();
  clone.find('br').replaceWith('\n');
  return normalizeText(clone.text());
}

function extractVerseRoot($: AnyApi, verse: AnyEl): string {
  // A verse may contain multiple `div.versetext` siblings: the source uses
  // `<div class="versetext" type="gadya">` for a one-line speaker tag (e.g.
  // "श्रीभगवानुवाच —", "सञ्जय उवाच —", "अरुणिर्ह वै…") followed by a
  // separate `<div class="versetext">` for the actual śloka. Joining only
  // the first one would drop the verse body. Walk every direct child and
  // concatenate their texts in document order, separated by a newline.
  const parts: string[] = [];
  verse.children('div.versetext').each((_: number, raw: any) => {
    const el = $(raw) as unknown as AnyEl;
    const t = elementText($, el);
    if (t) parts.push(t);
  });
  return parts.join('\n');
}

function proseBlocksInside(
  $: AnyApi,
  container: AnyEl,
  opts: { skipVersetext: boolean },
): ProseBlock[] {
  // Walk direct children in document order. If a child is a block, record it.
  // We only look one level deep — nested structures (like .emphasis inside a
  // bhashya) are captured via the block's own text extraction.
  const out: ProseBlock[] = [];
  container.children().each((_: number, raw: any) => {
    const el = $(raw) as unknown as AnyEl;
    if (opts.skipVersetext && el.is('div.versetext')) return;
    const cls = el.attr('class') ?? '';
    const kind = blockKindForClass(cls);
    if (!kind) return;
    const text = elementText($, el);
    if (!text) return;
    out.push({ kind, text, id: el.attr('id') });
  });
  return out;
}

/** True if `el` is a chapter/section that contains no descendant chapter or section. */
function isLeafSubdivision(_$: AnyApi, el: AnyEl): boolean {
  if (!el.is('div.chapter, div.section')) return false;
  return el.find('div.chapter, div.section').length === 0;
}

function subdivisionTitle(_$: AnyApi, el: AnyEl): string | undefined {
  const attr = el.attr('data-name');
  if (attr && attr.trim()) return normalizeText(attr);
  const h = el.children('h1,h2,h3,h4,h5').first();
  if (h.length) return normalizeText(h.text());
  return undefined;
}

/**
 * Auto-fill canonical Devanāgarī titles for chapters where the source
 * supplies none. Right now we cover Māṇḍūkya's four Gauḍapāda
 * prakaraṇas (Āgama / Vaitathya / Advaita / Alātaśānti), which the
 * source delivers without `data-name`.
 */
function canonicalChapterTitle(id: string, _kind: string): string | undefined {
  const m = id.match(/^MK_C(\d+)$/);
  if (m) {
    const idx = Number(m[1]) - 1;
    return ['आगमप्रकरणम्', 'वैतथ्यप्रकरणम्', 'अद्वैतप्रकरणम्', 'अलातशान्तिप्रकरणम्'][idx];
  }
  return undefined;
}

function closestAdhyaya(_$: AnyApi, el: AnyEl): AnyEl | null {
  // Walk up to find a non-leaf ancestor chapter (the adhyaya grouping a set of
  // vallis/padas/khandas). Returns null if the element is itself at the top.
  let node = el.parent() as unknown as AnyEl;
  while (node.length > 0) {
    if (node.is('div.chapter') && node.find('div.chapter, div.section').length > 0) {
      return node;
    }
    node = node.parent() as unknown as AnyEl;
  }
  return null;
}

function parseLeafChapter(
  $: AnyApi,
  chapterEl: AnyEl,
  chapterOrdinal: number,
  parentIndex: Map<string, number>,
): BhashyaChapter {
  const parent = closestAdhyaya($, chapterEl);
  let parentTitleSa: string | undefined;
  let parentOrdinal: number | undefined;
  if (parent) {
    parentTitleSa = subdivisionTitle($, parent);
    const pid = parent.attr('id') ?? '';
    parentOrdinal = parentIndex.get(pid);
    if (parentOrdinal === undefined) {
      parentOrdinal = parentIndex.size + 1;
      parentIndex.set(pid, parentOrdinal);
    }
  }

  const chapter: BhashyaChapter = {
    id: chapterEl.attr('id') ?? `C${chapterOrdinal}`,
    ordinal: chapterOrdinal,
    titleSa:
      subdivisionTitle($, chapterEl) ??
      canonicalChapterTitle(chapterEl.attr('id') ?? '', chapterEl.attr('type') ?? ''),
    parentTitleSa,
    parentOrdinal,
    kind: chapterEl.attr('type') ?? undefined,
    units: [],
  };

  let pendingIntro: ProseBlock[] = [];
  // Separate counters: intros get their own number sequence so they
  // never bump the verse / sutra / kārikā ordinals. Verse/etc. ordinals
  // come from the source ID's trailing digits whenever possible
  // (e.g. `MK_C02_K07` → 7, `BR_C04_S05_V13` → 13). Otherwise we fall
  // back to a per-kind running counter.
  let introCounter = 0;
  let verseCounter = 0;

  function ordinalFromId(id: string | undefined, runningFallback: number): number {
    if (!id) return runningFallback;
    const m = id.match(/_[A-Z](\d+)$/);
    if (m) return Number(m[1]);
    return runningFallback;
  }

  chapterEl.children().each((_: number, raw: any) => {
    const el = $(raw) as unknown as AnyEl;
    const cls = el.attr('class') ?? '';

    if (el.is('div.verse')) {
      // Flush any buffered intro prose.
      if (pendingIntro.length > 0) {
        introCounter += 1;
        chapter.units.push({
          id: `${chapter.id}_INTRO${introCounter}`,
          kind: 'intro',
          ordinal: introCounter,
          root: '',
          blocks: pendingIntro,
        });
        pendingIntro = [];
      }

      const typeAttr = (el.attr('type') ?? '').toLowerCase();
      verseCounter += 1;
      const id = el.attr('id') ?? `${chapter.id}_V${verseCounter}`;
      // Derive the unit kind from (a) the source `type` attribute when
      // present, (b) the ID suffix as a fallback, since some chapters
      // omit the type attr (e.g. Gauḍapāda kārikās are tagged as
      // `K01..K100` in the ID even when typeAttr is empty).
      const idMatch = id.match(/_([A-Z])\d+$/);
      const idLetter = idMatch ? idMatch[1] : '';
      const kind: BhashyaUnit['kind'] =
        typeAttr === 'sutra' || idLetter === 'S'
          ? 'sutra'
          : typeAttr === 'shloka'
            ? 'verse'
            : typeAttr === 'karika' || idLetter === 'K'
              ? 'karika'
              : 'mantra';
      const unit: BhashyaUnit = {
        id,
        kind,
        ordinal: ordinalFromId(id, verseCounter),
        root: extractVerseRoot($ as AnyApi, el),
        blocks: proseBlocksInside($ as AnyApi, el, { skipVersetext: true }),
      };
      chapter.units.push(unit);
      return;
    }

    // A prose block at chapter scope (before the first verse, or between verses).
    const blockKind = blockKindForClass(cls);
    if (blockKind) {
      const text = elementText($, el);
      if (!text) return;
      pendingIntro.push({ kind: blockKind, text, id: el.attr('id') });
    }
  });

  if (pendingIntro.length > 0) {
    introCounter += 1;
    chapter.units.push({
      id: `${chapter.id}_OUTRO${introCounter}`,
      kind: 'intro',
      ordinal: introCounter,
      root: '',
      blocks: pendingIntro,
    });
  }

  return chapter;
}

export function parseBhashyaHtml(
  html: string,
  meta: Pick<
    BhashyaText,
    'slug' | 'sourceCode' | 'titleSa' | 'titleIast' | 'titleEn' | 'group' | 'sourceUrl'
  >,
): BhashyaText {
  const $ = cheerio.load(html);
  const rootScope = $('.container-fluid.maintext').first();
  const scope = rootScope.length > 0 ? rootScope : $('body');

  // Collect leaf subdivisions (chapter/section with no nested chapter/section)
  // in document order.
  const leaves: AnyEl[] = [];
  scope.find('div.chapter, div.section').each((_: number, raw: any) => {
    const el = $(raw) as unknown as AnyEl;
    if (isLeafSubdivision($, el)) leaves.push(el);
  });

  const parentIndex = new Map<string, number>();
  const chapters: BhashyaChapter[] = [];
  if (leaves.length === 0) {
    const synth = cheerio.load(
      `<div class="chapter" id="${meta.slug.toUpperCase()}_C01">${scope.html() ?? ''}</div>`,
    );
    chapters.push(
      parseLeafChapter(synth, synth('div.chapter').first() as unknown as AnyEl, 1, parentIndex),
    );
  } else {
    leaves.forEach((el, i) => {
      chapters.push(parseLeafChapter($, el, i + 1, parentIndex));
    });
  }

  // Counts
  let mantras = 0;
  let intros = 0;
  let words = 0;
  for (const ch of chapters) {
    for (const u of ch.units) {
      if (u.kind === 'intro') intros += 1;
      else mantras += 1;
      words += countSanskritWords(u.root);
      for (const b of u.blocks) words += countSanskritWords(b.text);
    }
  }

  return {
    ...meta,
    fetchedAt: new Date().toISOString(),
    counts: { chapters: chapters.length, mantras, intros, words },
    chapters,
  };
}
