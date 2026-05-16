# Translation source files

Drop ingestable translation files here. The `npm run build:meanings`
script reads every `<text-slug>/` directory and emits a runtime-ready
`public/data/meanings/<text-slug>.json` keyed by unit ID.

## Per-text directory layout

```
data-source/meanings/<text-slug>/
├── sources.json           # required if any of the files below exist
├── <sourceId>.en.json     # English entries  { "<unitId>": "<text>", ... }
├── <sourceId>.en.tsv      # alternative: tab-separated
├── <sourceId>.ml.json     # Malayalam entries
├── <sourceId>.ml.tsv
└── …
```

Multiple `<sourceId>.…` pairs are allowed per text (e.g. one English
translator + one Malayalam editor).

## `sources.json`

```json
{
  "sources": [
    {
      "id": "gambhirananda",
      "citation": "Swāmī Gambhīrānanda, Eight Upaniṣads with the Commentary of Śaṅkara, Vol. I, Advaita Ashrama, 1957.",
      "license": "permission",
      "publishedAt": "1957",
      "isPrimary": true
    },
    {
      "id": "sringeri-ml",
      "citation": "Śrī Śāradā Pīṭham, Sringeri — Malayalam edition.",
      "license": "permission",
      "publishedAt": "1990"
    }
  ]
}
```

Only sources referenced by an entry need to appear; orphan sources
are silently dropped from the output.

## Unit IDs

The keys must match the IDs used in `public/data/bhashya/<slug>/<chapter>.json`.
Examples:

- `IS_C01_V01` — Īśāvāsya, chapter 1, verse 1.
- `BG_C03_V42` — Bhagavad-Gītā, chapter 3, verse 42.
- `BR_C04_S05_V13` — Bṛhadāraṇyaka, brāhmaṇa 4, section 5, mantra 13.
- `BS_C01_S01_V12` — Brahma-sūtra, adhyāya 1, pāda 1, sūtra 12.

For per-block translations (commenting on individual prose passages
inside the bhāṣya rather than the root mantra), append `::block-<n>`
(0-based index into the unit's `blocks` array). Most translations
live at the unit level.

## Fallback behaviour

Units with no matching entry in any source receive an auto-derived
placeholder pulled from the first ~600 characters of the bhāṣya
prose. This appears under the synthetic source `bhashya-prose-derived`
(license: `fair-use`) and is clearly labelled in the reader UI as a
placeholder. As real translations are ingested they replace the
fallback.

## Reproducing

```sh
# After dropping files into data-source/meanings/<slug>/
npm run build:meanings
# → updates public/data/meanings/<slug>.json
# → vite-pwa picks up the new files for the next precache rebuild
```

The output is gitignored (it's regenerated from source); the source
files in this directory are NOT gitignored — commit them so CI can
rebuild deterministically.

## License governance

The validation regime (`docs/authoritative-validation-plan.md` §3.3)
requires bilingual reviewer sign-off on every Malayalam translation
before it's marked authoritative. Ingest first, then queue for
review; the UI labels every entry with its source so users can
trace provenance.
