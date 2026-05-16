# Plan: English + Malayalam meanings for the entire corpus

This plan describes how to add **per-mantra English and Malayalam
meanings** to the entire Prasthāna-trayī-bhāṣya corpus and present them
inside Pārāyaṇāñjali. The goal is to surface the **most authoritative
and traditional** rendering of each verse + its bhāṣya gist, with full
provenance, in a way that respects copyright, scholarly accuracy, and
the parāyaṇa user-experience of the existing reader.

This is a planning document. **No translations are integrated yet.**
Every source listed here needs explicit copyright clearance before any
text lands in the app.

---

## 1. What "meaning" means here

There are three distinct layers a Sanskrit reader expects, and the
plan should treat them separately:

| Layer | Granularity | Audience |
| --- | --- | --- |
| **Word-by-word** (पदार्थ / pada-artha) | per-word gloss | beginners + parsers |
| **Verse meaning** (वाक्यार्थ / vākyārtha) | per-mantra translation | most users |
| **Bhāṣya summary** (भाष्यार्थ / bhāṣya-artha) | per-bhāṣya block summary | study companions |

The current app already gives the **word-by-word layer** for free via
the tap-a-word analyser (sandhi → inflection → compound → MW/Apte/
Vāchaspatyam/Śabdakalpadruma definition). What's missing is the
**verse meaning** and **bhāṣya summary** layers — those are what this
plan adds.

For each layer we want **English** and **Malayalam** in parallel.

---

## 2. Source candidates by text

The traditional Advaita pedigree for English translations of
Śaṅkara-bhāṣya is well-defined. For Malayalam the field is more
fragmented but Sringeri's Sharada Peetham itself, Chinmaya Mission,
and Ramakrishna Math have produced the most-trusted editions.

Each row below lists, for that text:
- the canonical English translation(s) most aligned with the
  Advaita tradition,
- the canonical Malayalam translation(s),
- the copyright status as of 2026, and
- the import path (public-domain / negotiated / paraphrase).

### 2.1 Upaniṣad-bhāṣyas

| Text | Trusted English | Trusted Malayalam | Copyright |
| --- | --- | --- | --- |
| Īśā | Swāmī Mādhavānanda (Advaita Ashrama, 1957); Swāmī Gambhīrānanda (1965, *Eight Upaniṣads*, vol. 1) | Sringeri Math edition; Chinmaya *Īśāvāsyopaniṣad* (Malayalam) | Both modern editions in copyright |
| Kena (pada + vākya) | Gambhīrānanda *Eight Upaniṣads* vol. 1; S. Sitaram Sastri (1898 — public domain) | Chinmaya; Ramakrishna Math Malayalam | Sastri PD; modern ML in copyright |
| Kaṭha | Gambhīrānanda *Eight Upaniṣads* vol. 1 | Sringeri *Kaṭhopaniṣad-bhāṣyam* (ML) | Modern editions in copyright |
| Praśna | Gambhīrānanda *Eight Upaniṣads* vol. 2 | Chinmaya *Praśnopaniṣad* | Modern editions in copyright |
| Muṇḍaka | Gambhīrānanda *Eight Upaniṣads* vol. 2 | Sringeri *Muṇḍakopaniṣad* (ML) | Modern editions in copyright |
| Māṇḍūkya + GK | Gambhīrānanda *Eight Upaniṣads* vol. 2 | Sringeri *Māṇḍūkya + Gauḍapāda Kārikā* | Modern editions in copyright |
| Taittirīya | Gambhīrānanda *Eight Upaniṣads* vol. 1 | Chinmaya / Sringeri | Modern editions in copyright |
| Aitareya | Gambhīrānanda *Eight Upaniṣads* vol. 2 | Chinmaya | Modern editions in copyright |
| Chāndogya | Gangānātha Jhā (1942); Gambhīrānanda 1983 | Sringeri *Chāndogya* | Jhā 1942 may be PD in India (60 yr); modern ML in copyright |
| Bṛhadāraṇyaka | Mādhavānanda (1934); Gambhīrānanda *Eight Upaniṣads* (incomplete) | Sringeri Bṛhadāraṇyaka (ML) | 1934 PD in India; ML in copyright |

### 2.2 Bhagavad-Gītā-bhāṣya

| Trusted English | Trusted Malayalam | Copyright |
| --- | --- | --- |
| A. Mahādeva Sastri, *Bhagavad-Gītā with the Commentary of Śrī Śaṅkarācārya* (Madras, 1897 — **public domain**) | Sringeri *Gītā-bhāṣyam* (ML); Chinmaya *Holy Geeta* | English PD; ML in copyright |
| Gambhīrānanda, *Bhagavadgītā with the commentary of Śaṅkarācārya* (1991) | | Modern editions in copyright |

### 2.3 Brahma-Sūtra-bhāṣya

| Trusted English | Trusted Malayalam | Copyright |
| --- | --- | --- |
| George Thibaut, *Vedānta Sūtras with the Commentary by Śaṅkarācārya* (SBE 34 + 38, 1890–1896 — **public domain**) | Sringeri *Brahmasūtra-bhāṣyam* (ML, multi-volume) | Thibaut PD; ML in copyright |
| Gambhīrānanda, *Brahma-Sūtra-Bhāṣya of Śrī Śaṅkarācārya* (1965) | | Modern editions in copyright |

### 2.4 What this means concretely for the import path

There are **four import paths** — by source, not by text:

1. **Public domain (pre-1929 US / pre-1965 India for personal authors).**
   Mahādeva Sastri (Gītā 1897), Thibaut (BSB 1890–96), Sitaram Sastri
   (Kena 1898), and Mādhavānanda's older Bṛh. (1934) are safe to ship
   verbatim with attribution. We OCR / digitise from public scans
   (archive.org, sanskritdocuments.org, sacred-texts.com).
2. **Sringeri-licensed (negotiated).** If Sringeri Sharada Peetham is
   willing to grant a licence for their published Malayalam editions
   to be displayed inside Pārāyaṇāñjali (the app is already framed as
   their companion), we can ship them. Needs a written licence; this
   is the highest-quality Malayalam path.
3. **Sublicensed modern editions.** Advaita Ashrama (Gambhīrānanda)
   and Chinmaya Publications could be approached. Cost likely
   significant; not the first path.
4. **Original paraphrase.** Where no other path works, we draft
   compact paraphrases ("the verse states that…") referencing the
   bhāṣya's own gloss. Original text — no copyright on the new
   wording. This is the slowest path because every paraphrase needs
   review.

For practical bootstrap I recommend:

- **English via PD path** for Gītā (Sastri 1897), Brahma-sūtra
  (Thibaut), and Kena pada-bhāṣya (Sastri 1898). These cover ~50% of
  the corpus by mantra count.
- **English original paraphrase** for the remaining Upaniṣads,
  scaffolded against Gambhīrānanda's prose for accuracy but
  rewritten — labelled "summary translation" (not "translation")
  to be clear it's not a verbatim render of any specific edition.
- **Malayalam via Sringeri licence** for everything if obtainable;
  otherwise original Malayalam paraphrase with the same labelling.

---

## 3. Data model

### 3.1 Storage shape

Per-text JSON files mirroring the existing chunk layout:

```
public/data/meanings/<lang>/<text-slug>/<chapter-id>.json
```

For example:

```
public/data/meanings/en/gita/Gi_C02.json
public/data/meanings/ml/brahma-sutra/BS_C01_S01.json
```

Each chunk:

```json
{
  "textSlug": "gita",
  "chapterId": "Gi_C02",
  "lang": "en",
  "source": "mahadeva-sastri-1897",
  "license": "PD",
  "translator": "A. Mahādeva Sastri",
  "year": 1897,
  "url": "https://archive.org/details/...",
  "units": {
    "Gi_C02_V13": {
      "verse": "Just as in this body...",
      "bhashya": "Śaṅkara explains: ...",
      "notes": "..."
    }
  }
}
```

Why per-chapter chunks? Same reason as the bhāṣya itself: lazy load
only what's currently being read, keep the manifest small, let the
service worker cache one chapter at a time.

### 3.2 Coverage manifest

A small per-language index `public/data/meanings/<lang>/index.json`
lists which `(slug, chapterId)` pairs have meanings. The reader
checks this before fetching a chunk so it doesn't 404 on uncovered
chapters and can show a "Translation not yet integrated" placeholder.

```json
{
  "lang": "en",
  "generatedAt": "2026-...",
  "chapters": {
    "gita/Gi_C02": { "source": "mahadeva-sastri-1897", "verses": 72 },
    "brahma-sutra/BS_C01_S01": { "source": "thibaut-sbe-34", "verses": 31 }
  }
}
```

---

## 4. Reader integration UX

The current reader stacks **mantra (mūla) → bhāṣya → next mantra**.
Meanings slot in as **collapsible cards directly under the mūla
card**, before the bhāṣya:

```
┌── mantra card (mūla, large, centred) ───┐
│  ईशा वास्यमिदं सर्वम् ॥ १ ॥             │
└─────────────────────────────────────────┘
   ▾ Meaning · English · Mahādeva Sastri 1897   [collapsible]
   ▾ Meaning · Malayalam · Sringeri              [collapsible]
   ▾ Word-by-word                                [exists today]
┌── bhāṣya card · भाष्यम् ────────────────┐
│  ईशा ईष्टे इति ईट्...                   │
└─────────────────────────────────────────┘
```

Three knobs in the reader settings popover:

- **Show meanings** [default ON] — toggles the collapsible cards
  globally.
- **Default expanded** [default OFF] — when on, every meaning card
  is expanded by default.
- **Language pair** [en, ml, both] — which language(s) to render. A
  Malayalam-only setting hides English entirely; the default is
  `both` when both are available, else whichever is.

A small **🌐 source chip** sits in the meaning card header showing
`Mahādeva Sastri 1897 · Public domain` — tap to open the source
metadata sheet (see §6).

For **bhāṣya summary**, the same pattern: a collapsible at the top
of each `vyakhyana-card`. Sources for bhāṣya summaries are the same
as verse meanings; we typically use the same translation since most
of these editions already include the bhāṣya in their renderings.

### 4.1 Search integration

Once meanings are integrated, the search page gains a **"Search
also in meanings"** toggle (default OFF for backward compat). When
ON, the search index also covers `verse` and `bhashya` fields from
the meanings chunks; results show snippets in whichever language
matched, with the corresponding language badge.

### 4.2 Word-tap drill-down

Tapping a Devanāgarī word in the mūla still opens the existing
sandhi/dictionary popover. **No change** — the new meanings are
verse-level and don't replace the word-level analysis.

---

## 5. Validation workflow before any text ships

Each translation chunk goes through a 4-stage gate before it's
merged to `main`:

1. **Source attestation.** A signed-off `meanings/<lang>/<source>.yml`
   file describes: provenance URL, edition, year, translator, copyright
   status (with PD justification or licence document attached as a
   separate signed PDF). Cannot proceed without this.
2. **Automated import** via `scripts/import-meanings-<source>.ts`.
   Each importer reads the source corpus (OCR / scrape / structured
   file), produces the per-chapter chunks, and writes a coverage
   diff. Pre-existing meanings are never overwritten silently — diff
   must be reviewed.
3. **Reviewer pass.** A reviewer (the user, or someone the user
   designates) walks every imported chapter, comparing against the
   source for accuracy. The reviewer signs off in
   `meanings/<lang>/<source>.review.md` with a per-chapter checkbox.
4. **CI validation.**
   - Lint: every chunk's verse coverage matches the manifest's
     unit list (no orphans, no missing verses for a fully-imported
     chapter).
   - Linking: every meaning's `unitId` resolves in
     `public/data/bhashya/<slug>.json` (same invariant as
     `verify:linking`).
   - Build: the build passes with the new chunks precached.

Only after all four gates does the chunk actually appear in the app.

The **default state** for any unreviewed chunk is hidden from the UI;
a reviewer flag in the chunk metadata (`reviewed: true`) is what
makes it surface.

---

## 6. Source-metadata sheet UX

Tapping a `🌐 source` chip opens a bottom sheet showing:

- Translator + year + edition title
- Copyright status (PD / licensed / paraphrase) with one-line
  justification
- Original-source URL (archive.org link, publisher page, or licence
  doc)
- The reviewer who signed off, with date
- A "Report a translation issue" link that opens a GitHub issue
  pre-populated with the unit ID and the rendered text

This makes provenance unambiguous and gives readers a clear path to
flag concerns.

---

## 7. Critical / traditional fidelity

The user's instruction was that the **most valid, critical, and
traditional** meaning has to be included. Concrete commitments:

1. **Tradition signal in the chip.** Every English chunk carries a
   `lineage` tag: `advaita-sringeri` / `advaita-ashrama` /
   `chinmaya` / `pre-modern-PD`. This is shown in the source chip so
   the user knows whose interpretation they're reading.
2. **Default to the lineage closest to the corpus.** Sringeri's
   editions take precedence over Advaita Ashrama, which takes
   precedence over Chinmaya, which takes precedence over generic
   PD. The first-available source for a given chapter is the
   highest-priority one, never the first in alphabetical order.
3. **No interpretive paraphrasing of bhāṣya prose.** Where a chunk
   is a paraphrase rather than a verbatim translation, the chip
   says so; the verse meaning may be a paraphrase but the bhāṣya
   summary is always either verbatim from a licensed source or
   absent (showing only the sandhi / lexicon-derived word layer).

---

## 8. Phased rollout

| Phase | What ships | Lead time |
| --- | --- | --- |
| **0** *(today)* | Plan + types + manifest scaffolding | 0 |
| **1** | Gītā English (Mahādeva Sastri 1897, PD) verse-only | 4 weeks |
| **2** | Brahma-sūtra English (Thibaut, PD) verse + bhāṣya | 6 weeks |
| **3** | Reader UI: meaning cards, toggles, source chip | 2 weeks (parallel) |
| **4** | Search-in-meanings | 2 weeks |
| **5** | Sringeri Malayalam licensing + import (if licensed) | depends |
| **6** | Remaining Upaniṣads English (paraphrase scaffolded against Gambhīrānanda) | 8–12 weeks |
| **7** | Validation pass on every chunk | continuous |

Phase 1 is the smallest, most credible MVP because Mahādeva Sastri
1897 is genuinely public domain, well-OCRed on archive.org, and
covers the full Gītā-bhāṣya including bhāṣya prose translation.

---

## 9. What this plan deliberately is NOT

- **Not an LLM-paraphrase corpus.** Generating verse meanings from a
  language model risks subtle theological drift (substituting
  Vivekacūḍāmaṇi-style Vedānta for the strict Śaṅkara reading).
  Every meaning that ships is either verbatim from a vetted source or
  a hand-written paraphrase that a reviewer signs off.
- **Not a replacement for the bhāṣya.** The bhāṣya text itself
  remains primary. Meanings are study aids that sit beside it.
- **Not a translation memory.** We don't reuse or re-machine-translate
  across chunks. Each chunk has one source, one translator, one
  review pass.

---

## 10. Next concrete steps if approved

If you approve this plan, the following are the immediate, mergeable
PRs:

1. **PR-1**: Type definitions + per-language manifest + reader UI
   stub that reads `public/data/meanings/<lang>/index.json` and
   shows a "no meanings yet" placeholder when empty. Behind a
   `FEATURES.meaningsEnabled` flag, default OFF.
2. **PR-2**: Mahādeva Sastri 1897 Gītā importer + first 3 chapters
   imported + reviewer template populated. Behind the same flag.
3. **PR-3**: Reader meaning cards with the language-pair toggle and
   source chip. Reviewer-flag gating in place.
4. **PR-4**: Coverage manifest builder + CI invariant
   (`verify:meanings-linking`).

Each PR is independently shippable; nothing user-visible until PR-3
+ at least one reviewed chapter exist.

---

*Drafted 2026 by the Pārāyaṇāñjali maintainers. Open to revision —
this is a starting point for review, not a final design.*
