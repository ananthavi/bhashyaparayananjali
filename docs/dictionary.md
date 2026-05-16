# Dictionary stack

The reader runs a four-layer chain when you tap a word:

```
exact match   →   inflection-stripped lemma   →   sandhi reversal   →   compound (samāsa) split
```

Each layer can call into any installed dictionary. Layers stop returning
candidates as soon as one yields a hit, but the popover shows every
intermediate analysis so you can see how the form was decomposed.

## What ships in the app

- **Seed glossary** — a hand-curated set of ~200 high-frequency Vedāntic
  terms with English and Malayalam glosses. Always offline, instant.
- **Sandhi engine** — reverse application of the most common Pāṇinian
  rules (vowel coalescence, visarga restoration, anusvāra ↔ m).
- **Inflection table** — a/ā/i/u/n/ṛ-stem case suffixes plus common
  verbal endings (3rd-person, absolutive, infinitive, abstract noun).
- **Compound splitter** — depth-bounded search using the dictionary as
  an oracle: candidates are scored by the fraction of parts that are
  recognized lemmas.

The seed glossary is intentionally small so the JS bundle stays light.

## Bundled lexicons

The app ships four public-domain Sanskrit lexicons inside the APK
itself, all auto-installed into IndexedDB on first launch:

| Slot | Source | Year | Direction | ~Entries |
| --- | --- | --- | --- | --- |
| `mw` | Monier-Williams Sanskrit-English | 1899 | sa → en | ~190 k |
| `apte` | Apte Practical Sanskrit-English | 1890 | sa → en | ~34 k |
| `vachaspatyam` | Vāchaspatyam | 1873–84 | sa → sa | ~49 k |
| `shabdakalpadruma` | Śabdakalpadruma | 1828–58 | sa → sa | ~41 k |

All four are converted from the public Cologne `csl-orig` dumps via
`scripts/build-dict.ts`. Re-run when the upstream changes:

```bash
npm run dict:build           # fetch + convert (cached under scripts/.cache/dict/)
npm run dict:coverage        # walk the corpus and report lookup hits
```

The output JSONs live at `public/data/dict/{mw,apte,vachaspatyam,shabdakalpadruma}.json`
(committed to the repo so CI doesn't refetch ~110 MB on every build).
The PWA service worker precaches them and the Capacitor build embeds
them into `assets/public/data/dict/`. No URL prompt, no manual install
step, no network at runtime.

### Source format

Each JSON is an object keyed by Devanāgarī head-word:

```json
{
  "ब्रह्म": {
    "iast": "brahma",
    "en": "the absolute reality; the supreme self",
    "src": "mw"
  }
}
```

Optional fields: `pos`, `ml` (Malayalam gloss). The Sanskrit-Sanskrit
lexicons (Vāchaspatyam, Śabdakalpadruma) put a Devanāgarī gloss in `en`
since that's what the popover renders.

### Source format

Each dump is a JSON object keyed by Devanāgarī head-word:

```json
{
  "ब्रह्म": {
    "iast": "brahma",
    "pos": "n.",
    "en": "the absolute reality; the supreme self"
  },
  "आत्मन्": {
    "iast": "ātman",
    "pos": "m.",
    "en": "self; the inner witness"
  }
}
```

Optional fields: `ml` (Malayalam gloss), `body` (longer prose entry).
Anything else is ignored.

### Where to find dumps

- **Cologne MW digitization** — XML and SQLite at
  <https://www.sanskrit-lexicon.uni-koeln.de/scans/MWScan/2020/web/webtc/index.html>.
  The `mw` corpus from <https://github.com/funderburkjim/cologne-sanlex>
  converts cleanly to the JSON shape above; small Python script in their
  README.
- **Apte** — same project, `ap90` corpus.
- **Ambuda** — community mirrors at <https://github.com/ambuda-org>
  often package these in JSON form already.

We don't pin a single mirror because they come and go. Pick a source,
host the JSON somewhere with public CORS access, paste the URL.

### Self-hosting the dump

A simple way to host: drop the JSON file into a public bucket
(GitHub raw, Cloudflare R2, etc.) with `Access-Control-Allow-Origin: *`.
The PWA's service-worker will cache the response after the first
download.

## Sandhi rules implemented

Reverse direction (surface → presumed pre-sandhi pieces). Each rule
proposes one or more candidates at a boundary; the dictionary picks
which ones survive.

| Rule | Surface | Candidate(s) |
| --- | --- | --- |
| Vowel coalescence | left ends in ā | a+a, a+ā, ā+a, ā+ā |
| Vowel coalescence | left ends in e | a+i, a+ī, ā+i |
| Vowel coalescence | left ends in o | a+u, a+ū |
| Visarga | left ends in o + voiced | aḥ + voiced |
| Visarga | left ends in o + a | aḥ + a (avagraha) |
| Visarga | left ends in ā | āḥ + … |
| Vowel coalescence | left ends in ai | a+e, ā+e, a+ai |
| Vowel coalescence | left ends in au | a+o, ā+o, a+au |
| Anusvāra | left ends in ṃ | m + … |
| Trivial | (no transformation) | left, right (always offered) |

The "trivial" rule is critical for compound splitting where two stems
are joined without surface change (e.g. ब्रह्मविद्या = ब्रह्म + विद्या).

Yan-sandhi (i/u/ṛ + V → y/v/r + V) and the ay/av/āy/āv productions are
left as scaffolding hooks in `src/lib/sandhi/rules.ts` — extend them
when you have a corpus that exercises them.

## Inflection patterns

Implemented in `src/lib/sandhi/inflect.ts`. Surface form → (lemma, label):

- a-stem masc/neut: nom/acc/instr/dat/abl/gen/loc, dual, pl
- ā-stem fem: gen/abl/dat/instr/loc sg
- i / ī / u / ū-stem: standard cases
- n-stem (brahman, ātman): the historically irregular paradigm
- ṛ-stem (pitṛ, mātṛ)
- Verbal endings: 3 sg/pl pres, 3 pl ātmane, absolutive (-tvā / -ya),
  infinitive (-tum), pres. participle (-māna)
- Abstracts: -tva, -tā with case endings

Longer suffixes win. The resolver returns *all* matching lemma
candidates so the popover can show competing analyses.

## Programmatic API

```ts
import { analyzeWord } from '@/lib/analysis';

const r = await analyzeWord('ब्रह्मविद्यायाम्');
// r.direct       — hits on the surface form
// r.inflections  — { surface, lemma, label, hits[] }[]
// r.compounds    — { parts: { part, lemma, hits[], label? }[], rules, score }[]
// r.resolved     — true if at least one layer produced a hit
```

The reader's tap-a-word handler calls this on every word; the popover
renders each non-empty section.

## Building a custom dictionary source

If you have a CSV, TSV, or some other format, write a Node script that
emits JSON in the shape above and host the result. A minimal converter:

```ts
// scripts/convert-mw.ts
import fs from 'node:fs';
const src = fs.readFileSync('mw-source.tsv', 'utf8');
const out: Record<string, unknown> = {};
for (const line of src.split('\n')) {
  const [head, iast, pos, en] = line.split('\t');
  if (!head) continue;
  out[head] = { iast, pos, en };
}
fs.writeFileSync('mw.json', JSON.stringify(out));
```

Then host `mw.json` and paste its URL into **About → Dictionaries**.
