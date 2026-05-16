import { useEffect, useState } from 'react';
import { loadCatalog } from '@/lib/loader';
import type { Catalog } from '@/types';
import { SOURCE_ATTRIBUTION } from '@/data/texts';
import { DictionaryManager } from '@/components/DictionaryManager';
import { asset } from '@/lib/asset';

export function AboutPage(): JSX.Element {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  useEffect(() => {
    loadCatalog().then(setCatalog).catch(() => null);
  }, []);

  return (
    <div className="py-4 space-y-6">
      <section className="surface rounded-xl p-4">
        <div className="flex items-center gap-3 mb-2">
          <img
            src={asset('images/advaita/logo-circle.png')}
            alt="Advaita Sharada · Sringeri"
            className="h-12 w-12"
          />
          <div>
            <div className="text-xs uppercase tracking-widest opacity-70">
              Inspired by and based on
            </div>
            <div className="font-medium">Advaita Sharada</div>
            <div className="text-xs opacity-80">
              Dakṣiṇāmnāya Śrī Śāradā Pīṭham, Śṛṅgerī
            </div>
          </div>
        </div>
        <p className="mt-2 text-sm opacity-85 leading-relaxed">
          <span className="iast-text mantra-emphasis">Pārāyaṇāñjali</span> — an
          offline-friendly companion to{' '}
          <a
            href="https://advaitasharada.sringeri.net/"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            advaitasharada.sringeri.net
          </a>{' '}
          for the recitation and study of Ādi Śaṅkarācārya's commentaries on
          the Upaniṣads, the Bhagavad Gītā, and the Brahma Sūtras.
        </p>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-widest opacity-70 mb-2">Dedication</h2>
        <div className="surface rounded-lg p-4 text-center space-y-1">
          <div className="script-devanagari text-base mantra-emphasis">श्रीगुरुभ्यो नमः ।</div>
          <div className="iast-text opacity-80 text-xs">śrī-gurubhyo namaḥ</div>
          <div className="rule mt-3 pt-3" />
          <div className="script-devanagari text-base">
            श्रीमच्छङ्करभगवत्पूज्यपादविरचितानि
          </div>
          <div className="script-devanagari text-lg mantra-emphasis">
            प्रस्थानत्रयीभाष्याणि
          </div>
          <div className="iast-text opacity-70 text-xs">
            śrīmac-chaṅkara-bhagavat-pūjyapāda-viracitāni prasthāna-trayī-bhāṣyāṇi
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-widest opacity-70 mb-2">Lineage</h2>
        <div className="grid grid-cols-2 gap-3 text-center text-sm">
          <figure className="surface rounded-lg p-3">
            <img
              src={asset('images/advaita/mahasannidhanam.jpg')}
              alt="His Holiness Jagadguru Mahāsannidhānam"
              className="rounded-md w-full h-auto"
            />
            <figcaption className="mt-2 text-xs opacity-80">
              His Holiness Jagadguru Mahāsannidhānam
            </figcaption>
          </figure>
          <figure className="surface rounded-lg p-3">
            <img
              src={asset('images/advaita/sannidhanam.jpg')}
              alt="His Holiness Jagadguru Sannidhānam"
              className="rounded-md w-full h-auto"
            />
            <figcaption className="mt-2 text-xs opacity-80">
              His Holiness Jagadguru Sannidhānam
            </figcaption>
          </figure>
        </div>
      </section>

      {catalog && (
        <section>
          <h2 className="text-sm uppercase tracking-widest opacity-70 mb-2">
            Corpus ({catalog.texts.length} texts)
          </h2>
          <ul className="text-sm divide-y divide-[color:var(--rule)]">
            {catalog.texts.map((t) => (
              <li key={t.slug} className="py-1.5 flex items-baseline gap-2">
                <span className="script-devanagari grow truncate">{t.titleSa}</span>
                <span className="opacity-70 text-xs whitespace-nowrap">
                  {t.counts.chapters} sec · {t.counts.mantras}{' '}
                  {t.group === 'brahma-sutra' ? 'sūtra' : t.group === 'gita' ? 'śloka' : 'mantra'}
                </span>
              </li>
            ))}
          </ul>
          <div className="text-xs opacity-60 mt-2">
            Source corpus retrieved {new Date(catalog.generatedAt).toLocaleDateString()}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm uppercase tracking-widest opacity-70 mb-2">What's in this app</h2>
        <ul className="space-y-1.5 text-sm opacity-90 leading-relaxed list-disc pl-5">
          <li>
            <strong>Reader.</strong> Each text loads as a tiny manifest plus
            per-chapter chunks fetched on demand, so opening even the
            Bṛhadāraṇyaka or Brahma-sūtra is instant. Mantra and bhāṣya
            blocks render in distinct cards; embedded śloka quotations are
            bolded with their source citation as a small chip.
          </li>
          <li>
            <strong>13-script transliteration.</strong> Devanāgarī, Malayalam,
            Tamil, Telugu, Kannada, Bengali, Gurmukhi, Gujarati, Odia,
            Grantha, plus romanised IAST, ITRANS, and Harvard–Kyoto.
            Source-of-truth is Devanāgarī; conversion is done at render
            time via{' '}
            <a
              className="underline"
              href="https://github.com/indic-transliteration/sanscript.js"
              target="_blank"
              rel="noreferrer"
            >
              sanscript
            </a>
            .
          </li>
          <li>
            <strong>Full-text search across all 13 texts.</strong> Type in any
            script or in plain ASCII — variants are auto-expanded with
            sandhi-aware substitutions. Multi-token queries find units
            containing all words (with gaps allowed); typo tolerance via
            edit-distance fuzzy. Results show the proper Sanskrit reference
            and a snippet with matched tokens highlighted.
          </li>
          <li>
            <strong>Find within a bhāṣya.</strong> 🔍 in the reader toolbar
            opens an in-text search over the chapters currently loaded —
            useful for tracking a phrase down without leaving the text.
          </li>
          <li>
            <strong>Autocomplete from the corpus itself.</strong> ~24 k
            distinct tokens (≥ 2 occurrences) indexed lexically; suggestions
            ranked by frequency. Multi-word: only the trailing token is
            completed.
          </li>
          <li>
            <strong>Tap-a-word analysis.</strong> A four-layer lookup chain —
            direct match, inflectional lemma (with suffix table + a curated
            pronoun / irregular-verb table), sandhi reversal, and compound
            (samāsa) decomposition with the dictionary as oracle. When all
            of those miss, a fuzzy nearest-lemma fallback returns
            best-effort guesses tagged as <em>approximate</em>.
          </li>
          <li>
            <strong>Bookmarks &amp; resume.</strong> The reader remembers your
            last position per text; bookmarks live in IndexedDB and survive
            offline.
          </li>
          <li>
            <strong>Search history &amp; scope.</strong> Recent searches saved
            locally (12 entries); a 📚 chip lets you scope a search to a
            chosen subset of the 13 texts.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-widest opacity-70 mb-2">
          Bundled lexicons
        </h2>
        <DictionaryManager />
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-widest opacity-70 mb-2">Source</h2>
        <div className="surface rounded-lg p-3 text-sm">
          <div className="font-medium">{SOURCE_ATTRIBUTION.name}</div>
          <a
            href={SOURCE_ATTRIBUTION.url}
            target="_blank"
            rel="noreferrer"
            className="underline text-sm opacity-80"
          >
            {SOURCE_ATTRIBUTION.url}
          </a>
          <p className="mt-2 opacity-85">{SOURCE_ATTRIBUTION.note}</p>
        </div>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-widest opacity-70 mb-2">Install</h2>
        <p className="text-sm opacity-85 leading-relaxed">
          This is a PWA. On Android (Chrome): three-dot menu →{' '}
          <em>Install app</em> or <em>Add to Home screen</em>. On iOS
          (Safari): share icon → <em>Add to Home Screen</em>. Native APK
          and IPA builds for sideloading are also available — see{' '}
          <code>docs/apk.md</code> and <code>docs/ios.md</code> in the
          source repository.
        </p>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-widest opacity-70 mb-2">Credits</h2>
        <p className="text-sm opacity-85 leading-relaxed">
          Sanskrit corpus: Advaita Sharada, Sringeri Sharada Peetham.
          Lexicons: Cologne digital editions of Monier-Williams (1899),
          Apte (1890), Vāchaspatyam (1873–84), and Śabdakalpadruma
          (1828–58). Script conversion: sanscript. Malayalam font: Manjari
          (SMC). Devanāgarī: Noto Serif Devanagari with Tiro Sanskrit
          fallback. Other scripts: Noto Serif family.
        </p>
      </section>
    </div>
  );
}
