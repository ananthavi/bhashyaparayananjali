# Plan: context-aware meaning extraction

This is a **planning document**. Today the tap-a-word analyser
returns *all* candidate lemmas with no awareness of which one is
right *for this verse, this bhāṣya, this tradition*. A user reading
the Brahma-sūtra-bhāṣya who taps `धर्म` gets every Monier-Williams
sense ("statute, ordinance, law, usage, custom, religious merit,
righteousness, virtue, justice, nature, character, attribute,
property…") in alphabetical-by-source order. The traditional
reader needs the Advaita-Vedānta sense at the top, with the
others available but secondary.

Goal: a **context-aware meaning extractor** that uses traditional
hermeneutic tools alongside modern statistical methods to pick the
right gloss for the right tap. This document lays out the full
design space — what the tradition prescribes, what NLP makes
possible, what concrete signals we already have, and a phased
rollout that can be validated piece by piece.

The current analyser is documented in `docs/analysis-rules.md`.
This plan strictly *adds* layers on top of it; nothing existing is
removed.

---

## 1. The traditional hermeneutic stack

The Sanskrit śāstra has spent two millennia thinking about exactly
this problem — given a polysemous word, how do you decide which
sense applies? The answer is well-codified across three disciplines.

### 1.1 Mīmāṁsā: the six pramāṇas of meaning determination

Jaimini's *Mīmāṁsā-sūtra* (3.3.14) lists six tools, each weaker than
the last, used to fix the sense of a Vedic word. The order matters:
when two pramāṇas conflict, the earlier wins.

| # | Pramāṇa | What it does | App signal |
| --- | --- | --- | --- |
| 1 | **Śruti** (श्रुति) | Direct testimony — the text says it explicitly | Adjacent verses; bhāṣya's own gloss |
| 2 | **Liṅga** (लिङ्ग) | Indication from another expression that selects a sense | Co-occurrence pattern in surrounding text |
| 3 | **Vākya** (वाक्य) | Sentence — the sentence's syntactic and semantic context | Same mantra/sūtra |
| 4 | **Prakaraṇa** (प्रकरण) | Topic / section — the larger discussion the word sits in | Chapter / pāda / brāhmaṇa context |
| 5 | **Sthāna** (स्थान) | Position — proximity to a known referent | Narrative or argumentative position |
| 6 | **Samākhyā** (समाख्या) | Customary name / convention | Default tradition-ranked sense |

The app already has structural access to Vākya (the unit), Prakaraṇa
(the chapter / parent adhyāya), and Samākhyā (we can rank by
tradition). Liṅga and Sthāna require text-co-occurrence statistics.
Śruti requires recognising and lifting glosses out of the bhāṣya
itself. All six are tractable — see §4.

### 1.2 Niruktam: etymological derivation

Yāska's *Niruktam* (~6th c. BCE) treats every Sanskrit word as
derivable from a verbal root (dhātu). The principle:
**नामान्याख्यातजानि** — "nouns are derived from verbs". When senses
conflict, the etymological derivation often privileges the
contextually live one. For example:

- `भगवान्` < √भज् "share, partake" + the suffix `-वत्` →
  "one who has [the qualities to be] shared, i.e. revered". In a
  Bhāgavata context this etymology selects "revered" over the
  generic "fortunate" sense.
- `धर्म` < √धृ "to hold / sustain" → "that which sustains". In
  Vedānta this picks out "sustaining principle" over "ritual
  duty".

We can use a curated etymology table to nudge ranking in favour of
glosses that match the live root meaning.

### 1.3 Pāṇinian semantics: kāraka and samāsa-vigraha

Pāṇini's grammar gives semantic roles to nominal cases — the
**kāraka theory** — and a closed taxonomy for compound types.
Both narrow the meaning space sharply.

**Kāraka** (Aṣṭādhyāyī 1.4.23–55): six semantic roles assigned
to nominal cases:

| Role | Sanskrit | Case typically | Meaning impact |
| --- | --- | --- | --- |
| Agent | कर्तृ (kartṛ) | nom. | the doer |
| Object | कर्म (karman) | acc. | the thing done to |
| Instrument | करण (karaṇa) | instr. | by/with what |
| Recipient | सम्प्रदान (sampradāna) | dat. | to/for whom |
| Source | अपादान (apādāna) | abl. | from where |
| Locus | अधिकरण (adhikaraṇa) | loc. | in/on/at where |

When a polysemous word appears in a particular case, the kāraka
role narrows the live sense. Example: `ब्रह्मणि` (loc. sg. of ब्रह्मन्)
in Vedānta picks out "in Brahman" — the ādhāra (substrate) sense —
not the generic "in the Veda" or "in the priest" sense.

**Samāsa-vigraha**: every Sanskrit compound belongs to one of the
six classes (dvandva, tatpuruṣa with seven case sub-types,
karma-dhāraya, dvigu, bahuvrīhi, avyayī-bhāva). Knowing the class
tells us the relation between the parts. The app's compound
splitter (§7 of analysis-rules.md) finds the parts but doesn't
classify the relation. Adding samāsa-classification would add real
meaning: `ज्ञान-योग` as a tatpuruṣa is "the yoga *of* knowledge",
as a karma-dhāraya it's "yoga that *is* knowledge". Different in
the bhāṣya at different points.

---

## 2. Modern NLP tools that map onto the tradition

The traditional pramāṇas above are all about leveraging context.
Modern NLP has several techniques that target the same problem from
different angles. The goal is not to replace the tradition with a
black-box model but to use ML where it strengthens a specific
pramāṇa.

| Pramāṇa | Modern technique | Notes |
| --- | --- | --- |
| Śruti | Bhāṣya-gloss extractor (§4.1) | Pulls Śaṅkara's own sense definitions out of the prose into a per-word table |
| Liṅga | Pointwise mutual-information (PMI) over corpus co-occurrence | Cheap; strictly statistics, no model |
| Vākya | Sentence-embedding similarity (multilingual MiniLM, IndicBERT, MuRIL) | Compares the live sentence to each candidate gloss's example sentences |
| Prakaraṇa | Tradition / genre prior + topic model | Hand-curated prior + LDA over the corpus |
| Sthāna | Distance metrics + dependency parsing | Sanskrit dependency parsers (e.g. Vidyut, INRIA Sanskrit Heritage) exist |
| Samākhyā | Tradition-ranked default ordering | Static table, low cost |

Two more techniques don't map directly onto Mīmāṁsā but are worth
mentioning:

- **Word-sense disambiguation (WSD)** with sense-tagged training
  data: hard for Sanskrit — there's no large sense-annotated corpus.
  Bootstrap: tag a few hundred sentences from the bhāṣya itself
  using Śaṅkara's gloss-extraction (§4.1).
- **Knowledge graph** linking terms to their bhāṣya-defined senses
  + lineage (Advaita / Viśiṣṭādvaita / Dvaita / Mīmāṁsā). Since the
  app explicitly serves Śaṅkara-bhāṣya, the Advaita branch is
  privileged but the others remain queryable for comparison.

---

## 3. Signals already available in the app

Before we even add new infrastructure, the app already has these
context signals at tap time:

1. **Text slug**: `gita`, `brahma-sutra`, `mandukya`, …
   → tradition prior (Smārta-Advaita-Sringeri lineage).
2. **Chapter id and ordinal**: `BR_C04_S05` → "fourth adhyāya,
   fifth brāhmaṇa of the Bṛhadāraṇyaka".
   → Prakaraṇa for Mīmāṁsā purposes.
3. **Unit id and kind**: mantra / sūtra / kārikā / verse / intro.
   → Distinguishes mūla from bhāṣya; primary text vs commentary
   semantics differ.
4. **Surrounding words**: the full root + bhāṣya block of the
   active unit.
   → Vākya context.
5. **The bhāṣya block itself**: Śaṅkara often glosses the word
   immediately after citing it (e.g. `ब्रह्म इति`). When the
   bhāṣya defines its term, we have a direct Śruti-pramāṇa.
6. **User's chosen display script** + voice locale:
   → User's likely linguistic background; ranks Malayalam glosses
   when locale is `ml-IN`, Hindi when `hi-IN`.

None of this is currently used by the analyser. Even just feeding
(1)–(3) into the dictionary ranking would push Advaita senses to
the top. That's the cheapest possible win.

---

## 4. Concrete features and how they map to the tradition

### 4.1 Bhāṣya-gloss extractor (Śruti)

Śaṅkara's commentary frequently gives explicit definitions of the
term he's about to expound: `X इति Y` ("X means Y"), `X = Y` (in the
sense of), `X अर्थात् Y`, `X इत्यर्थः`. We can lift these into a
**term → bhāṣya-defined-sense** map per text by pattern-matching
the bhāṣya prose:

```
patterns:
  /(\S+)\s*इति\s*([^।]{2,40})/
  /(\S+)\s*=\s*([^।]{2,40})/
  /(\S+)\s*इत्यर्थः/      // implies the previous clause is the gloss
  /(\S+)\s*अर्थात्\s*([^।]{2,40})/
```

Output: `public/data/glosses/<text-slug>.json`:
```json
{
  "ब्रह्म": [
    {
      "unitId": "BR_C01_S01_V01",
      "gloss": "परं ब्रह्म, अद्वयम्, अनन्तम्, सत्यम्, ज्ञानम्",
      "rule": "iti"
    }
  ]
}
```

The popover surfaces the matching bhāṣya-gloss as the **#1 sense**
above all dictionary entries when it's available. This is the
**highest-confidence layer** because it comes directly from the
text being read.

### 4.2 PMI / co-occurrence ranking (Liṅga)

For each pair of dictionary heads (token, sense-keyword) the
co-occurrence count in the corpus is precomputed. At tap time, the
app re-ranks the polysemous senses by which sense's keyword
co-occurs more often with the *neighbouring* tokens of the active
unit.

Cheap to compute: ~5 minutes one-time over the full corpus. Cheap
to query: O(senses × neighbours). No ML model required.

### 4.3 Sentence-embedding semantic match (Vākya)

For each dictionary entry, store an embedding of its primary
example sentence (or the gloss text itself). At tap time, embed
the live unit's text and compute cosine similarity against each
sense's embedding. Highest similarity wins.

Costs: small embedding model (`paraphrase-multilingual-MiniLM-L12-v2`
~120 MB, runs in WASM via Transformers.js). Sense embeddings
precomputed (~50–100 KB per dictionary). Embeddings of the live
sentence cost ~300 ms on a phone — too slow for synchronous tap.
Would need to be async with a "rerank" UX.

Realistic plan: this layer is opt-in (toggle in settings) for users
who want sharper disambiguation but accept the ~300 ms latency.
Defaults OFF.

### 4.4 Tradition / lineage prior (Prakaraṇa + Samākhyā)

Hand-curate a prior over senses for each dictionary head, indexed
by lineage. Example:

```yaml
ब्रह्मन्:
  advaita-sringeri:
    - "the absolute non-dual reality"
    - "Brahman as taught in the Upaniṣads"
    - "the supreme self"
  mimamsa:
    - "the Veda"
    - "ritual formula"
  generic:
    # standard MW order
```

The app reads the **text's tradition tag** from the catalog
(currently all 13 entries are Advaita; future texts may differ)
and ranks senses accordingly. This is by far the cheapest, most
accurate single-feature win for the corpus we currently bundle.

### 4.5 Kāraka-aware sense narrowing

When a tapped word is in an oblique case (revealed by the suffix
table, §5 of analysis-rules.md), ranks senses that match the
kāraka role of that case higher. Implementation: tag each
dictionary entry's sense with a typical kāraka usage where
unambiguous; weight by case match.

### 4.6 Samāsa-vigraha classification

When a compound is split (§7 of analysis-rules.md), classify the
relation:

- **Tatpuruṣa** (gen-tatp / dat-tatp / etc.): "X *of/for/from/in*
  Y". Default unless other rules apply.
- **Karma-dhāraya**: appositive. Detected when both halves are
  attributive (adjective-like).
- **Dvandva**: pair. Detected when both halves are nouns of equal
  weight + final ending matches the dual / plural pattern.
- **Bahuvrīhi**: exocentric. Detected by mismatched gender or by
  paraphrase patterns ("having X as Y").
- **Avyayī-bhāva**: indeclinable. Detected when the result is
  invariant (often starts with `यथा-`, `सम-`, etc.).
- **Dvigu**: numeral first member. Detected when the first part is
  a number.

The popover shows the inferred class as a chip
("तत्पुरुष · genitive") with a tooltip explaining the relation.
This is an **explanatory** feature — it doesn't pick a sense, it
tells the reader how the parts combine.

### 4.7 Co-located commentary cross-reference

Outside the immediate unit, similar passages elsewhere in the
corpus often clarify a term. Build a per-term **passages index**:
all units in the corpus that contain the term, ranked by recency
of bhāṣya gloss + co-occurrence density. The popover offers a
"See also" section listing the top 3–5 passages.

---

## 5. Stack diagram

```
┌──────────────────────────────────────────────────────────────────┐
│  Tap a Devanāgarī word in the reader                              │
└──────────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────────────┐
│  Existing analyser (analysis-rules.md)                            │
│  → list of (lemma, dictionary entries)                            │
└──────────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────────────┐
│  Context layer (this plan)                                        │
│                                                                  │
│   1. Bhāṣya-gloss extract (Śruti)                                 │
│   2. PMI rerank by neighbour tokens (Liṅga)                       │
│   3. Tradition prior by text/chapter (Prakaraṇa + Samākhyā)       │
│   4. Kāraka role match (Pāṇinian semantics)                       │
│   5. Samāsa-vigraha classification (compound relation)            │
│   6. (opt-in) Sentence-embedding rerank (Vākya, async)            │
│   7. Co-located passage cross-references                          │
└──────────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────────────┐
│  Reranked sense list with provenance per item                     │
│                                                                  │
│   • Top-1 from bhāṣya gloss (if any)                              │
│   • Tradition-prior senses                                        │
│   • Other dictionary senses                                       │
│   • Each labelled with its rule chain                             │
│                                                                  │
│   "See also" cross-references                                     │
│   Samāsa-vigraha chip                                             │
└──────────────────────────────────────────────────────────────────┘
```

Each layer is **independently switchable**. A user (or a tester)
can disable any combination via settings to study which is doing
the heavy lifting.

---

## 6. Phased rollout

| Phase | Layer | Cost / risk |
| --- | --- | --- |
| **0** *(today)* | Plan + types | 0 |
| **1** | Bhāṣya-gloss extractor (offline regex pass) + popover top-section | 1 week. No new data shipped; just a derived JSON ~1 MB. |
| **2** | Tradition prior table + dictionary rerank | 2 weeks. Mostly hand-curation; cost is reviewer time. |
| **3** | PMI co-occurrence rerank | 1 week implementation + 1 day to compute over the corpus. ~3 MB shipped. |
| **4** | Kāraka role tagging on dictionary senses | 4 weeks (hand-tag MW for the most common heads). |
| **5** | Samāsa-vigraha classifier | 2 weeks rule-based; longer with real grammatical analysis (Vidyut). |
| **6** | Co-located passage cross-references | 1 week implementation + 30 min compute. |
| **7** | (opt-in) sentence-embedding rerank with WASM Transformers.js | 4 weeks; large download for users who opt in. |

Phases 1–3 deliver 80 % of the user-facing improvement. Phases 4–6
are necessary for the "every tap shows the most traditional
meaning" promise. Phase 7 is the last 5 %.

---

## 7. Validation gate

Same model as `docs/meanings-plan.md`: every layer ships behind a
flag, off by default. Each new layer is validated by:

1. **Eval set**: ~200 hand-tapped words from across the corpus,
   each annotated with the *correct* sense by a reviewer. Top-1
   accuracy + MRR (mean reciprocal rank) measured before vs. after.
2. **Regression tests**: the existing 72 vitest suites must continue
   to pass. New tests added per layer.
3. **Reviewer pass**: spot-check 20 random taps in the live reader,
   verify the chosen ranking feels right.
4. **No silent regressions**: if a layer reduces top-1 accuracy on
   the eval set, it doesn't ship.

A layer is enabled by default only after passing all four gates.

---

## 8. Open questions

These are open and need discussion before locking the design:

1. **How heavy can the per-tap latency budget be?** Current
   analyser: ~50–100 ms on a phone. Adding context layers without
   an embedding model: keeps it under 200 ms. With embeddings:
   400–800 ms. What's tolerable?
2. **Where does the tradition table come from?** Sringeri Sharada
   Peetham could review/sign-off on the Advaita-prior tables. Is
   that an acceptable path for the user, or should we also support
   non-Advaita lineages from day one?
3. **How do we handle disagreement between layers?** When Śruti
   says one thing and PMI says another, who wins? Default: Mīmāṁsā
   order (Śruti wins). But sometimes the bhāṣya is being polemic
   and the gloss is meant for the pūrvapakṣa, not the siddhānta —
   how do we detect that?
4. **Multi-tradition reading mode**: should the popover have a
   "compare lineages" toggle that shows Advaita / Viśiṣṭādvaita /
   Dvaita interpretations side by side? Out of scope for this app
   currently, but worth noting.

---

## 9. What this plan deliberately is NOT

- **Not a sense-annotation project.** We're not building a
  hand-tagged sense-disambiguation corpus from scratch. We use the
  bhāṣya itself + tradition tables + corpus statistics. Layer 7
  (embeddings) is an optional, opt-in enhancement.
- **Not an LLM-driven gloss generator.** The same caveats from
  `docs/meanings-plan.md` §9 apply: no LLM paraphrasing of senses.
  Every gloss surfaced to the user is either from a vetted source
  (dictionary, bhāṣya) or hand-curated (tradition prior).
- **Not a replacement for the analyser.** Existing layers
  (analysis-rules.md) keep doing their job. This plan strictly
  reranks and adds metadata on top.
- **Not autonomous interpretation.** The user always sees the full
  candidate list with the rule chain that produced each. The app
  ranks; it does not decide.

---

## 10. Concrete next steps if approved

The first three PRs (Phase 1):

- **PR-1**: bhāṣya-gloss-extractor pipeline + types.
  - `scripts/extract-bhashya-glosses.ts`: regex pass over the
    chapter chunks producing `public/data/glosses/<slug>.json`.
  - `src/types.ts`: `BhashyaGloss` shape.
  - No UI changes yet; behind a `FEATURES.contextMeaningEnabled`
    flag.
- **PR-2**: popover Śruti section + "See also from this bhāṣya".
  - WordPopover renders glosses for the active unit's terms above
    the dictionary section, with the citation chip showing the
    unit reference.
- **PR-3**: tradition prior table for the Vedāntic head-words.
  - `public/data/tradition/advaita-sringeri.json`: ~200 hand-curated
    head → ranked-senses map.
  - Dictionary lookup chain consults this table to reorder MW /
    Apte senses before display.
  - Eval-set scaffolding (`tests/context-eval.test.ts`).

Each is independently shippable; nothing user-visible until
PR-2 + a reviewed gloss extract.

---

*Drafted alongside `docs/meanings-plan.md`. Open to revision —
this is the design space, not a finalised plan.*
