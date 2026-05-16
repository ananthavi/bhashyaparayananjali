import { describe, it, expect } from 'vitest';
import { parseBhashyaHtml, normalizeText } from '../scripts/parse-bhashya';

const META = {
  slug: 'test',
  sourceCode: 'Test',
  titleSa: 'परीक्षा',
  titleIast: 'Parīkṣā',
  titleEn: 'Test',
  group: 'upanishad' as const,
  sourceUrl: 'https://example.invalid/',
};

describe('parseBhashyaHtml', () => {
  it('parses a simple flat chapter with intro + verses', () => {
    const html = `
      <div class="container-fluid maintext">
        <div class="chapter" id="T_C01">
          <div class="intro_bhashya" id="I">पूर्वप्रस्तावना</div>
          <div class="verse" type="mantra" id="T_C01_V01">
            <div class="versetext">मूलम्</div>
            <div class="bhashya" id="T_C01_V01_B01">भाष्यम्</div>
          </div>
          <div class="verse" type="mantra" id="T_C01_V02">
            <div class="leading_bhashya">उपक्रम</div>
            <div class="versetext">द्वितीयम्</div>
            <div class="bhashya">विवरण</div>
            <div class="aux_bhashya">उपबृंहण</div>
          </div>
        </div>
      </div>
    `;
    const text = parseBhashyaHtml(html, META);
    expect(text.chapters.length).toBe(1);
    const ch = text.chapters[0];
    // 1 intro unit + 2 verse units
    expect(ch.units.length).toBe(3);
    expect(ch.units[0].kind).toBe('intro');
    expect(ch.units[1].kind).toBe('mantra');
    expect(ch.units[1].root).toBe('मूलम्');
    expect(ch.units[1].blocks.length).toBe(1);
    expect(ch.units[2].blocks.map((b) => b.kind)).toEqual([
      'leading_bhashya',
      'bhashya',
      'aux_bhashya',
    ]);
  });

  it('handles adhyaya>section nesting and records parentTitleSa', () => {
    const html = `
      <div class="container-fluid maintext">
        <div class="chapter" id="A1" data-name="प्रथमोऽध्यायः">
          <div class="section" id="A1_S1" data-name="प्रथमा वल्ली">
            <div class="verse" type="mantra" id="A1_S1_V1">
              <div class="versetext">म</div>
              <div class="bhashya">भा</div>
            </div>
          </div>
          <div class="section" id="A1_S2" data-name="द्वितीया वल्ली">
            <div class="verse" type="mantra" id="A1_S2_V1">
              <div class="versetext">म२</div>
            </div>
          </div>
        </div>
      </div>
    `;
    const text = parseBhashyaHtml(html, META);
    expect(text.chapters.length).toBe(2);
    for (const ch of text.chapters) {
      expect(ch.parentTitleSa).toBe('प्रथमोऽध्यायः');
      expect(ch.parentOrdinal).toBe(1);
    }
    expect(text.chapters[0].titleSa).toBe('प्रथमा वल्ली');
  });

  it('counts mantras, intros, and words', () => {
    const html = `
      <div class="container-fluid maintext">
        <div class="chapter" id="C">
          <div class="intro_bhashya">अ आ इ</div>
          <div class="verse" type="mantra" id="V1">
            <div class="versetext">क ख ग</div>
            <div class="bhashya">घ ङ च छ</div>
          </div>
        </div>
      </div>
    `;
    const text = parseBhashyaHtml(html, META);
    expect(text.counts.intros).toBe(1);
    expect(text.counts.mantras).toBe(1);
    expect(text.counts.words).toBe(10);
  });

  // Bug 2: Gītā verses introduced by a one-line speaker tag use TWO sibling
  // `div.versetext` elements — `type="gadya"` for the speaker line and a
  // plain one for the śloka body. Earlier the parser kept only the first,
  // which lost the entire verse text after "śrībhagavān-uvāca —" / "saṁjaya
  // uvāca —" / "arjuna uvāca —".
  it('joins gadya speaker tag with the following śloka body', () => {
    const html = `
      <div class="container-fluid maintext">
        <div class="chapter" id="BG_C02">
          <div class="verse" type="shloka" id="BG_C02_V01">
            <div class="versetext" type="gadya">सञ्जय उवाच —</div>
            <div class="versetext">तं तथा कृपयाविष्टम् ॥ १ ॥</div>
          </div>
          <div class="verse" type="shloka" id="BG_C02_V02">
            <div class="versetext" type="gadya">श्रीभगवानुवाच —</div>
            <div class="versetext">कुतस्त्वा कश्मलमिदम् ॥ २ ॥</div>
          </div>
        </div>
      </div>
    `;
    const text = parseBhashyaHtml(html, META);
    const ch = text.chapters[0];
    expect(ch.units[0].root).toContain('सञ्जय उवाच —');
    expect(ch.units[0].root).toContain('तं तथा कृपयाविष्टम् ॥ १ ॥');
    expect(ch.units[1].root).toContain('श्रीभगवानुवाच —');
    expect(ch.units[1].root).toContain('कुतस्त्वा कश्मलमिदम् ॥ २ ॥');
  });

  it('normalizes NBSP and line breaks', () => {
    expect(normalizeText('क  ख\n\n\n ग')).toBe('क ख\n\nग');
  });
});
