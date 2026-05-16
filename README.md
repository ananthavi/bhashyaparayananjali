# Bhashya Parayana — Prasthanatrayi

An offline-friendly Progressive Web App for parayanam of Ādi Śaṅkarācārya's
thirteen commentaries on the three foundations of Vedānta — the Upaniṣads,
the Bhagavad Gītā, and the Brahma Sūtras. Installable on Android (and iOS)
straight from the browser.

| | |
| --- | --- |
| Texts | 13 bhāṣyas (11 Upaniṣads + Gītā + Brahmasūtra) |
| Corpus | ~361 000 Sanskrit words across ~3 000 mantras/sūtras |
| Scripts | Devanāgarī · Malayalam · Tamil · Telugu · Kannada · Bengali · Gurmukhi · Gujarati · Odia · Grantha · IAST · ITRANS · Harvard–Kyoto |
| Offline | Full corpus pre-bundled and cached by the service worker |
| Source | [Advaita Sharada](https://advaitasharada.sringeri.net/), Sringeri Śāradā Pīṭham |

## Features

- **Library + reader** with large mula, toggleable bhāṣya, chapter-nested
  table of contents, deep-linking to any unit by id.
- **13-script transliteration** — source is Devanāgarī; every other script is
  rendered on the fly via `@indic-transliteration/sanscript`.
- **Best-rated reading fonts** per script: Manjari for Malayalam, Noto Serif
  Devanāgarī (with Tiro Sanskrit fallback), Noto Serif Tamil/Telugu/Kannada/
  Bengali/Gujarati, and classical alternatives (Ramaraja, Gubbi, Hind
  Siliguri, Hind Vadodara) as fallbacks.
- **Tap-a-word morphological analysis** with a four-layer chain: exact
  match → inflection-stripped lemma → sandhi reversal → compound
  (samāsa) decomposition. Ships with a seed of ~200 Vedāntic head-words;
  installable Monier-Williams (~160k) and Apte (~50k) JSON dumps via
  *About → Dictionaries* (cached in IndexedDB, then offline forever). See
  [`docs/dictionary.md`](docs/dictionary.md) for sources and format.
- **Full-text search** across all 13 texts, indexed on Devanāgarī; you can
  type your query in any supported script or in IAST/ITRANS/HK and it is
  normalized before matching.
- **Parāyaṇam-first UX**: light/sepia/dark themes, 5 font sizes, compact vs
  spacious density, continuous scroll vs one-mantra-per-screen, auto-scroll
  pacing (0–120 wpm), mula-only mode for recitation, swipe navigation,
  bookmarks, resume-where-you-left-off.
- **PWA**: installable, fully offline once loaded, Workbox-precached.

## Quick start

```bash
npm install
npm run dev              # http://localhost:3000
npm run build            # production build → dist/
npm run preview          # serve the built bundle
```

## Install on a phone

The same Vite bundle is wrapped by Capacitor for both Android (APK) and iOS
(IPA), and it can also be installed straight from a browser as a PWA.

### Android

- **As a PWA**: serve `dist/` over HTTPS, open in Chrome on Android,
  *Add to home screen*. Works offline after first load.
- **As an APK**: every push triggers
  [`.github/workflows/build-apk.yml`](.github/workflows/build-apk.yml),
  which builds a debug APK on a Linux runner and uploads it as the
  `bhashya-parayana-debug-apk` artifact. See [`docs/apk.md`](docs/apk.md)
  for sideload + release-signing instructions.
- **Locally** (JDK 21 + Android SDK platform-34): `npm run apk:debug`.

### iPhone / iPad

- **As a PWA**: open in Safari → Share → *Add to Home Screen*. Voice
  follow-along and voice search are unavailable on iOS Safari (Web
  Speech API isn't there); everything else works.
- **As an IPA** (sideloadable): every push also triggers
  [`.github/workflows/build-ios.yml`](.github/workflows/build-ios.yml)
  on a macOS runner and uploads `parayananjali-ios-ipa`. Sideload it
  via Sideloadly / AltStore (free Apple ID, 7-day cert), Xcode (free
  Apple ID, 7-day cert; or paid Apple Developer Program for 1-year
  cert), or TestFlight / Diawi for distribution.
- **Locally** (Mac + Xcode 15 + CocoaPods): `npm run cap:sync && cd
  ios/App && pod install && open App.xcworkspace`. Full instructions
  in [`docs/ios.md`](docs/ios.md).

The bundles ship the full corpus (`public/data/`) inside the app, so
both APK and IPA work offline immediately — no hosted URL and no Digital
Asset Links required.

## Regenerating the corpus

Scraped JSON lives under `public/data/` and is committed, so a clean clone
has a working dataset. Re-scrape when the source updates:

```bash
npm run scrape           # all 13 texts
npm run scrape -- --only=isha,mandukya
npm run scrape -- --no-cache
npm run build:index      # rebuild the search index
npm run data:all         # both of the above
```

The scraper (`scripts/scrape.ts`) sends a realistic browser User-Agent,
paces requests at 2.5 s, retries with exponential backoff, and caches
responses under `scripts/.cache/`. It follows the site's lazy-load
endpoint (`/display/getBhashyaByPage/{code}/devanagari?page=N`) to pull
every paginated chunk, so long texts (Bṛhadāraṇyaka, BSB, Chāndogya) come
through in full.

### Adding a larger dictionary

The runtime lookup accepts any number of sources:

```ts
import { registerDictionarySource } from '@/lib/dictionary';
import mw from './my-monier-williams.json';

registerDictionarySource({
  label: 'Monier-Williams',
  entries: mw, // { [devanagariHeadword: string]: { iast, pos, en, ... } }
});
```

Public-domain MW/Apte JSONs ship from several upstream projects (e.g.
Cologne Sanskrit Lexicon, Ambuda, Sanskritsahitya); converting them to the
`DictionarySource` shape is a small script. The seed glossary remains as a
baseline so the popover is always useful offline.

## Project layout

```
src/
  App.tsx                routes
  main.tsx               entry + HashRouter
  types.ts               domain types (BhashyaText, BhashyaChapter, …)
  data/texts.ts          canonical list of the 13 bhashyas
  state/store.ts         reader preferences (zustand, persisted)
  lib/
    transliterate.ts     sanscript wrapper + 13-script table + detection
    dictionary.ts        lookup with suffix stripping + pluggable sources
    dictionary-seed.ts   ~200 Vedantic head-words with en/ml glosses
    loader.ts            lazy loaders for catalog + per-text JSON
    search.ts            Lunr index + runtime substring fallback
    storage.ts           IndexedDB (bookmarks, reading positions)
  components/            Layout, Toolbar, TocDrawer, WordPopover, Tappable, …
  pages/                 Library · Reader · Search · Bookmarks · About
scripts/
  fetch-page.ts          respectful cached HTTP with lazy-load pagination
  parse-bhashya.ts       HTML → BhashyaText
  scrape.ts              CLI driver
  build-search-index.ts  Lunr index generator
  build-icons.ts         PWA icon generator
public/
  data/
    index.json           catalog
    bhashya/*.json       one file per text
    search/*.json        search index + docs
  icons/                 generated PWA icons
  favicon.svg
tests/                   vitest specs for transliteration, dictionary, parser
```

## Testing

```bash
npm test                 # unit tests (transliteration, dictionary, parser)
npm run typecheck        # strict tsc
```

Tests cover: 13-script round-trips, script detection, dictionary suffix
stripping, and the HTML parser across flat chapters, adhyaya/valli nesting,
and word counting.

## Source & attribution

The Sanskrit text of each bhāṣya is the digital edition maintained by the
Sringeri Śāradā Pīṭham at
[advaitasharada.sringeri.net](https://advaitasharada.sringeri.net/). The
Sanskrit itself — by Śrī Ādi Śaṅkarācārya (c. 8th century CE) — is public
domain; the editorial digitization work is theirs. This reader is an
independent parāyaṇam-focused interface over that public corpus and is not
affiliated with or endorsed by Sringeri. Attribution is displayed on every
reader view and in the About page.

## Licence

MIT for the application code in this repository. The bhāṣya text itself is
public domain. Respect Sringeri's presentation when you redistribute.
