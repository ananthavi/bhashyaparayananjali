import { describe, it, expect } from 'vitest';
import { parseBhashyaHtml } from '../scripts/parse-bhashya';

const META = {
  slug: 'test',
  sourceCode: 'Test',
  titleSa: 'परीक्षा',
  titleIast: 'Parīkṣā',
  titleEn: 'Test',
  group: 'upanishad' as const,
  sourceUrl: 'https://example.invalid/',
};

describe('parser ordinals — verses are indexed independently of intros', () => {
  it('a chapter with an intro before mantra 1 still numbers mantras 1, 2, 3', () => {
    const html = `
      <div class="container-fluid maintext">
        <div class="chapter" id="X_C01">
          <div class="intro_bhashya" id="X_C01_I01">पूर्वम्</div>
          <div class="verse" type="mantra" id="X_C01_V01"><div class="versetext">मूलम् १</div></div>
          <div class="verse" type="mantra" id="X_C01_V02"><div class="versetext">मूलम् २</div></div>
          <div class="verse" type="mantra" id="X_C01_V03"><div class="versetext">मूलम् ३</div></div>
        </div>
      </div>`;
    const text = parseBhashyaHtml(html, META);
    const ch = text.chapters[0];
    const m1 = ch.units.find((u) => u.id === 'X_C01_V01')!;
    const m2 = ch.units.find((u) => u.id === 'X_C01_V02')!;
    const m3 = ch.units.find((u) => u.id === 'X_C01_V03')!;
    expect(m1.ordinal).toBe(1);
    expect(m2.ordinal).toBe(2);
    expect(m3.ordinal).toBe(3);
    // Intro has its own ordinal sequence.
    const intros = ch.units.filter((u) => u.kind === 'intro');
    expect(intros.length).toBe(1);
    expect(intros[0].ordinal).toBe(1);
  });

  it('detects kārikā kind from _K## ID even when the type attr is absent', () => {
    const html = `
      <div class="container-fluid maintext">
        <div class="chapter" id="MK_C02">
          <div class="verse" id="MK_C02_K01"><div class="versetext">k1</div></div>
          <div class="verse" id="MK_C02_K02"><div class="versetext">k2</div></div>
        </div>
      </div>`;
    const text = parseBhashyaHtml(html, META);
    const k1 = text.chapters[0].units.find((u) => u.id === 'MK_C02_K01')!;
    const k2 = text.chapters[0].units.find((u) => u.id === 'MK_C02_K02')!;
    expect(k1.kind).toBe('karika');
    expect(k1.ordinal).toBe(1);
    expect(k2.kind).toBe('karika');
    expect(k2.ordinal).toBe(2);
  });

  it('canonical Mandukya prakaraṇa titles are filled in when the source omits data-name', () => {
    const html = `
      <div class="container-fluid maintext">
        <div class="chapter" id="MK_C02" type="prakaranam">
          <div class="verse" id="MK_C02_K01"><div class="versetext">k</div></div>
        </div>
      </div>`;
    const text = parseBhashyaHtml(html, { ...META, slug: 'mandukya' });
    expect(text.chapters[0].titleSa).toBe('वैतथ्यप्रकरणम्');
  });

  it('uses source ID ordinal even when verses are non-contiguous (e.g. V13)', () => {
    const html = `
      <div class="container-fluid maintext">
        <div class="chapter" id="BR_C04_S05">
          <div class="verse" type="mantra" id="BR_C04_S05_V13"><div class="versetext">m13</div></div>
          <div class="verse" type="mantra" id="BR_C04_S05_V14"><div class="versetext">m14</div></div>
        </div>
      </div>`;
    const text = parseBhashyaHtml(html, META);
    const v13 = text.chapters[0].units.find((u) => u.id === 'BR_C04_S05_V13')!;
    const v14 = text.chapters[0].units.find((u) => u.id === 'BR_C04_S05_V14')!;
    expect(v13.ordinal).toBe(13);
    expect(v14.ordinal).toBe(14);
  });
});
