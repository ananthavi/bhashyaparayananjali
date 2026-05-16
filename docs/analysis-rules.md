# Analysis rules — how Pārāyaṇāñjali extracts meaning from a Sanskrit token

This document describes every rule the app currently uses when you tap
a word in the reader. The goal is full transparency: every layer the
analyser tries, in order, with worked examples for each.

The analyser lives at `src/lib/analysis.ts`. It calls into:
- `src/lib/sandhi/aksharas.ts` (akṣara segmentation)
- `src/lib/sandhi/inflect.ts` (inflectional suffix table + surface variants)
- `src/lib/sandhi/pronouns.ts` (hand-coded pronoun / irregular-verb table)
- `src/lib/sandhi/rules.ts` (reverse sandhi rules)
- `src/lib/sandhi/compound.ts` (samāsa splitter)
- `src/lib/sandhi/fuzzy.ts` (n-gram nearest-lemma fallback)

Each lemma candidate carries a `method` tag (`exact` / `rule` /
`manual` / `compound` / `sandhi` / `fuzzy`) so the popover can show
the user *how* the resolution was reached. Manual-table and fuzzy
matches are flagged so they're never confused with a Pāṇinian rule.

---

## 0. Akṣara segmentation (foundation)

Source: `src/lib/sandhi/aksharas.ts`

Sanskrit words are processed as akṣaras (consonant-cluster + vowel
units), not as Unicode codepoints. Splitting at codepoint boundaries
breaks halant chains. Rules used:

- A run starts at any consonant or independent vowel.
- It absorbs subsequent halant + consonant pairs (conjuncts).
- It absorbs one final vowel sign (mātrā), if any.
- Anusvāra (ं), visarga (ः), candrabindu (ँ), nukta (़), and Vedic
  accents cling to the previous akṣara.

Example: **ब्रह्म** → `[ब्र, ह्म]` (two akṣaras, five codepoints).

---

## 1. Lookup chain

When a Devanāgarī word is tapped, the analyser tries each layer in
this fixed order. As soon as any layer produces hits, the chain
returns; the rest of the layers don't run.

```
1. Direct match           → seed glossary, then MW, Apte,
                             Vāchaspatyam, Śabdakalpadruma
2. Manual table          → 200+ pronoun + irregular verb table
3. Surface variants       → anusvāra/visarga/n-stem normalisation
4. Suffix table           → 50+ a/i/u/n/ṛ-stem + verbal suffix rules
5. Compound (samāsa)      → multi-akṣara split with dictionary oracle
6. Fuzzy fallback         → trigram n-gram nearest-head (last resort)
```

Each is described below in detail.

---

## 2. Layer 1 — Direct dictionary match

Source: `src/lib/dictionary.ts` (seed) and `src/lib/bulk-dictionary.ts`
(bundled MW / Apte / Vāch. / Śabd.).

Order of dictionaries queried, all returning hits if the head matches:

1. **Seed glossary** (~200 hand-curated Vedāntic terms with English +
   Malayalam) — always loaded, instant.
2. **Monier-Williams Cologne 1899** (~190k heads, English).
3. **Apte 1890** (~34k heads, English).
4. **Vāchaspatyam 1873–84** (~49k heads, Sanskrit gloss).
5. **Śabdakalpadruma 1828–58** (~41k heads, Sanskrit gloss).

The dictionaries are bundled inside the APK / IPA / web service-worker
cache so this layer runs entirely offline once the app has been
loaded once.

---

## 3. Layer 2 — Manual pronoun / irregular-verb table

Source: `src/lib/sandhi/pronouns.ts` (~140 entries).

Coverage (every cell is a single hand-coded surface→lemma entry):

| Group | Surface forms covered (samples) | Lemma |
| --- | --- | --- |
| **तद् paradigm** (m./n./f.) | सः, तम्, तेन, तस्मै, तस्मात्, तस्य, तस्मिन्, ते, तौ, तान्, तैः, तेषाम्, तेषु, तत्, तानि, सा, ताम्, तया, तस्यै, तस्याः, तस्याम्, ताः | तद् |
| **यद् paradigm** | यः, यम्, येन, यस्मै, यस्मात्, यस्य, यस्मिन्, ये, यान्, यैः, येषाम्, येषु, यत्, यानि, या, याम्, ययोः | यद् |
| **एतद् paradigm** | एषः, एष, एतम्, एतेन, एतस्य, एतस्मात्, एतस्मिन्, एते, एतत्, एतानि, एषा, एताम्, एतेषाम् | एतद् |
| **इदम् paradigm** | अयम्, इमम्, अनेन, अस्य, अस्मात्, अस्मिन्, इमे, इदम्, इमानि, इयम्, इमाम्, एषाम्, एभिः | इदम् |
| **अदस् paradigm** | असौ, अमुम्, अमुना, अमुष्य, अमी, अदः | अदस् |
| **किम् paradigm** | कः, कम्, केन, कस्य, कस्मात्, कस्मिन्, के, किम्, कानि, का, काम् | किम् |
| **1st person अस्मद्** | अहम्, आवाम्, वयम्, माम्, मा, मया, मह्यम्, मे, मम, मत्, मयि, अस्मान्, अस्माभिः, अस्मभ्यम्, अस्माकम् | अस्मद् |
| **2nd person युष्मद्** | त्वम्, युवाम्, यूयम्, त्वाम्, त्वा, त्वया, तुभ्यम्, तव, त्वत्, त्वयि, युष्मान्, युष्माभिः, युष्माकम् | युष्मद् |
| **n-stem ब्रह्मन्** | ब्रह्मा, ब्रह्माणम्, ब्रह्मणा, ब्रह्मणे, ब्रह्मणः, ब्रह्मणि, ब्रह्मणाम् | ब्रह्मन् |
| **n-stem आत्मन्** | आत्मा, आत्मानम्, आत्मना, आत्मने, आत्मनः, आत्मनि, आत्मानौ, आत्मानः | आत्मन् |
| **Common irregular verbs** | उवाच, उवाचुः, ऊचुः, आह, आहुः, अस्ति, सन्ति, आसीत्, आसन्, स्यात्, भवति, भवन्ति, बभूव, करोति, कुर्वन्ति, कुर्यात्, चकार, कृतम्, कृतः, कर्ता, गच्छति, गतः, गत्वा, जगाम, वेद, विद्यते, विद्यन्ते, उच्यते, उच्यन्ते, जानाति, जानन्ति, ज्ञात्वा, ज्ञातम्, जातः, पश्यति, पश्यन्ति, ददर्श, दृष्टम्, ददाति, दत्तम् | वच् / अह् / अस् / भू / कृ / कर्तृ / गम् / विद् / ज्ञा / जन् / दृश् / दा |
| **Common indeclinables** | एवम्, कथम्, यथा, तथा, यदा, तदा, कदा, सदा, सर्वदा, यत्र, तत्र, कुत्र, अत्र, अद्य, अधुना, अस्तु, सन्तु, चेत्, यदि, ननु, नु, ह्, वै, खलु, सु, कु, निर्, दुर्, ना, नैव, नेति, चेति, तन्न, तच्च | (self) |
| **सर्व paradigm** | सर्वम्, सर्वः, सर्वा, सर्वे, सर्वाणि, सर्वेषाम्, सर्वस्य | सर्व |
| **High-frequency oblique** | आदि, आदिः, आदौ, सिद्धम्, सिद्धान्तः, व्याख्या, व्याख्यानम्, श्रुतेः, श्रुतौ, प्राणो, प्राणं, प्राणाः, प्राणाद् | (canonical) |
| **Sandhi-affected adverbs** | यो (←यस्), सो (←सस्), अतो (←अतस्), ततो (←ततस्), यतो (←यतस्), कुतो (←कुतस्) | (canonical) |

Each entry carries a Sanskrit morphological label
(e.g. *m. nom. sg.*, *gen. pl.*) and an optional English gloss for
fallback rendering when no dictionary contains the lemma.

These entries are tagged `method: 'manual'` so the popover badges
them honestly as "from a curated table — not derived from a Pāṇinian
rule".

---

## 4. Layer 3 — Surface variants

Source: `src/lib/sandhi/inflect.ts:surfaceVariants()`.

Three transformations applied to the surface form (each tagged
`method: 'rule'`):

| Surface ends in | Proposed variant | Rationale |
| --- | --- | --- |
| `ं` (anusvāra) | drop ं  +  suffix `म्` | Word-final ं is a common written shortcut for `-m`. Lemma in MW carries explicit म्. |
| `ः` (visarga) | drop ः  +  suffix `स्`   | Word-final visarga of an `-as` stem reverts to `-as`. |
| `ो` (mātrā o) | drop ो  +  suffix `स्` (or `अस्`) | Sandhi `aḥ + voiced → o`. Lemma is `-as`. |
| `ा` (mātrā ā), word ≥ 3 akṣaras | drop ा  +  suffix `न्` | n-stem nominative singular: `ब्रह्मा ↔ ब्रह्मन्`, `आत्मा ↔ आत्मन्`. |

Examples:

- `सर्वं` → `सर्वम्` (anusvāra → m)
- `अतो` → `अतस्` (visarga aḥ → as)
- `देवो` → `देवस्` (visarga aḥ → as) → matches `देव`-stem
- `ब्रह्मा` → `ब्रह्मन्` (n-stem nominative)

These run BEFORE the suffix table because they're high-precision
restorations rather than table lookups.

---

## 5. Layer 4 — Suffix table

Source: `src/lib/sandhi/inflect.ts` (the `RULES` array).

50+ entries covering the inflection patterns most common in
Śaṅkara-bhāṣya prose. Sorted by descending suffix length so the
longest match wins. Categorised below.

### 5.1 n-stem (Brahman, ātman, rājan)

| Suffix | Replacement | Label |
| --- | --- | --- |
| `ण्या` | `न्य` | n-stem instr. sg. |
| `णि` | `न्` | n-stem loc. sg. |
| `णः` | `न्` | n-stem gen. sg. |
| `णा` | `न्` | n-stem instr. sg. |
| `णे` | `न्` | n-stem dat. sg. |
| `णोः` | `न्` | n-stem gen./loc. dual |
| `नौ` | `न्` | n-stem nom./acc. dual |
| `नाम्` | `न्` | n-stem gen. pl. |
| `भिः` | (drop) | instr. pl. |
| `भ्यः` | (drop) | dat./abl. pl. |
| `भ्याम्` | (drop) | instr./dat./abl. dual |

### 5.2 a-stem (deva, brahma) masc/neut

| Suffix | Replacement | Label |
| --- | --- | --- |
| `स्मात्` | (drop) | a-stem abl. sg. |
| `स्मिन्` | (drop) | a-stem loc. sg. |
| `स्मै` | (drop) | a-stem dat. sg. |
| `स्य` | (drop) | a-stem gen. sg. |
| `ानाम्` | (drop) | a-stem gen. pl. |
| `ानि` | (drop) | a-stem (n.) nom./acc. pl. |
| `ेषु` | (drop) | a-stem loc. pl. |
| `ैः` | (drop) | a-stem instr. pl. |
| `ान्` | (drop) | a-stem (m.) acc. pl. |
| `ाः` | (drop) | a-stem (m.) nom. pl. |
| `ौ` | (drop) | a-stem nom./acc. dual |
| `ेन` | (drop) | a-stem instr. sg. |
| `े` | (drop) | a-stem loc./voc. sg. (m.) |

### 5.3 ā / ī-stem feminine

| Suffix | Replacement | Label |
| --- | --- | --- |
| `याम्` | `ी` | ī/ā-stem fem. loc. sg. |
| `याः` | `ी` | ī-stem fem. gen./abl. sg. |
| `याम्` | `ा` | ā-stem fem. loc. sg. |
| `यै` | `ा` | ā-stem fem. dat. sg. |
| `याः` | `ा` | ā-stem fem. gen./abl. sg. |
| `या` | `ा` | ā-stem fem. instr. sg. |

### 5.4 i / ī / u / ū-stem

| Suffix | Replacement | Label |
| --- | --- | --- |
| `भिः` | (drop) | instr. pl. |
| `षु` | (drop) | i/u-stem loc. pl. |
| `योः` | `ि` | i-stem gen./loc. dual |
| `वोः` | `ु` | u-stem gen./loc. dual |

### 5.5 ṛ-stem (pitṛ, mātṛ, kartṛ)

| Suffix | Replacement | Label |
| --- | --- | --- |
| `त्रा` | `तृ` | ṛ-stem instr. sg. |
| `त्रे` | `तृ` | ṛ-stem dat. sg. |
| `तुः` | `तृ` | ṛ-stem gen./abl. sg. |
| `तरि` | `तृ` | ṛ-stem loc. sg. |
| `तरौ` | `तृ` | ṛ-stem nom./acc. dual |

### 5.6 Verbal endings

| Suffix | Replacement | Label |
| --- | --- | --- |
| `न्ति` | `त्` | 3 pl. pres. parasmaipada |
| `न्ते` | `त्` | 3 pl. pres. ātmanepada |
| `त्वा` | (drop) | absolutive (-tvā) |
| `य` | (drop) | absolutive (-ya) |
| `तुम्` | (drop) | infinitive (-tum) |
| `मानः` | `मान्` | pres. participle (m. nom. sg.) |

### 5.7 Abstract noun derivatives

| Suffix | Replacement | Label |
| --- | --- | --- |
| `त्वम्` | (drop) | abstract noun -tva |
| `त्वात्` | (drop) | -tva, abl. sg. |
| `त्वेन` | (drop) | -tva, instr. sg. |
| `तया` | (drop) | -tā, instr. sg. |

### 5.8 Generic case fallbacks

| Suffix | Replacement | Label |
| --- | --- | --- |
| `ः` | (drop) | nom. sg. |
| `म्` | (drop) | acc. sg. / nom.-acc. sg. (n.) |

---

## 6. Layer 5 — Sandhi reversal

Source: `src/lib/sandhi/rules.ts` (used by the compound splitter).

When the suffix table doesn't yield a known lemma, the splitter
considers every akṣara boundary in the word and proposes
pre-sandhi pieces. The dictionary acts as the oracle — only splits
whose halves are real heads survive.

### 6.1 Vowel coalescence (savarṇa-dīrgha and ay/av/āy/āv branches)

For each surface boundary akṣara ending in `ा / े / ो / ै / ौ`, all
the historical pre-sandhi possibilities are proposed:

| Surface | Pre-sandhi reversal candidates |
| --- | --- |
| `ा` (long ā) | `a + a`, `a + ā`, `ā + a`, `ā + ā` |
| `े` (e) | `a + i`, `a + ī`, `ā + i` |
| `ो` (o) | `a + u`, `a + ū`, `aḥ + (voiced)`, `aḥ + a` (avagraha) |
| `ै` (ai) | `a + e`, `ā + e`, `a + ai` |
| `ौ` (au) | `a + o`, `ā + o`, `a + au` |

### 6.2 Visarga reversal

| Surface | Reversal candidate |
| --- | --- |
| `ा` (long ā) at boundary | `āḥ + ...` |
| `ो` at boundary | `aḥ + (voiced)`, or `aḥ + a` with avagraha |

### 6.3 Anusvāra ↔ m

| Surface | Reversal candidate |
| --- | --- |
| Boundary akṣara ends in `ं` | `m्` + ... |

### 6.4 Trivial join (no sandhi)

A pure concatenation candidate is always proposed in addition to
the sandhi-aware ones. This is what catches plain compounds like
**ब्रह्मविद्या** = ब्रह्म + विद्या where no surface change occurs.

### 6.5 Yan-sandhi and ay/av/āy/āv productions

Currently scaffolded but conservative — yan-sandhi (i + V → y + V,
u + V → v + V, ṛ + V → r + V) and the ay/av/āy/āv productions
(e + V → ay + V, etc.) are detected only when the o-coalescence
already covers them. Expanding these is on the future-work list.

---

## 7. Layer 6 — Compound (samāsa) decomposition

Source: `src/lib/sandhi/compound.ts`.

When direct match + inflection both miss, the splitter does a
depth-bounded recursive search:

1. For every akṣara boundary in the word, generate sandhi-reversal
   candidates (§6).
2. For each `(left, right)` candidate, score by the dictionary:
   - +1.0 if the part is a known head
   - +0.6 if its inflection-stripped lemma is a known head
   - 0.0 otherwise
3. Recurse into each half up to depth 4, so multi-part samāsas
   like ब्रह्मविद्योपासना (ब्रह्म + विद्या + उपासना) decompose.
4. Rank candidates: highest score first; ties broken by part count
   (fewer parts preferred).
5. Memoise results so repeated calls on the same input are O(1).

The compound splitter consults the **broad oracle**: a 245k-headword
set built from every Cologne dictionary regardless of whether we
shipped its full entry. This is why even rare proper nouns get
correctly identified as compound parts.

---

## 8. Layer 7 — Fuzzy nearest-lemma fallback

Source: `src/lib/sandhi/fuzzy.ts`.

When all of layers 1–5 return nothing, the analyser computes a
trigram **Dice coefficient** between the input and every known
head:

```
similarity(query, head) = 2 · |trigrams(query) ∩ trigrams(head)|
                        / (|trigrams(query)| + |trigrams(head)|)
```

- A length-difference pre-filter (`|head.length - query.length| ≤
  max(3, query.length × 0.5)`) avoids comparing wildly different
  forms.
- Top-K candidates above a quality threshold (default 0.45) are
  returned.
- Each is tagged `method: 'fuzzy'`. The popover surfaces them in a
  separate "Approximate match" section with an explicit caveat
  banner ("No clean rule matched this form; these are nearest-lemma
  guesses by character overlap. Verify before relying on them.").

This layer ensures the popover virtually always returns *something*
for a tapped word ≥ 3 akṣaras, even when no rule applies.

---

## 9. Search-side rules (related but separate)

The search bar uses a parallel rule set focused on accepting any
input form and finding it in the corpus. See
`src/lib/search.ts:expandQueryToDevanagari()`. Summary:

### 9.1 Script detection + transliteration

- Devanāgarī → as-is
- Any Indic script (Malayalam, Tamil, Telugu, Kannada, Bengali,
  Gurmukhi, Gujarati, Oriya, Grantha) → transliterated to
  Devanāgarī via sanscript
- IAST with diacritics → Devanāgarī
- Plain ASCII Latin → IAST guesses, then Devanāgarī

### 9.2 ASCII guess rules (when input has no diacritics)

| Replacement | Example |
| --- | --- |
| `^a` → `ā` (initial long-a guess) | `arjuna` → `ārjuna` |
| `a$` → `ā` (final long-a guess) | `vidya` → `vidyā` |
| `i` → `ī`, `u` → `ū` | `niti` → `nītī` |
| `ri` → `ṛ`, `Ri` → `ṛ` | `rishi` → `ṛṣi` |
| `aa` → `ā`, `ee` → `ī`, `oo` → `ū` | `aatma` → `ātma` |
| `sh` → `ś` or `ṣ` | `shankara` → `śaṅkara` |
| `Sh` → `ṣ` | `Shashti` → `ṣaṣṭi` |
| `T/D/N` → `ṭ/ḍ/ṇ` (retroflex) | `pati` → `paṭi` |
| `Dh` → `ḍh` | `Dharma` → `ḍharma` |
| `M` → `ṃ` (anusvāra) | `dharmaM` → `dharmaṃ` |
| `H` → `ḥ` (visarga) | `ramaH` → `ramaḥ` |
| Trailing `m` / `h` → `ṃ` / `ḥ` | `dharmam` → `dharmaṃ` |
| Add or drop final `a` | `rama` ↔ `ram` |
| `-an` ↔ `-a` | `brahman` ↔ `brahma` |

### 9.3 Sandhi-aware Devanāgarī variant generation

Once we have a Devanāgarī candidate, the search expander adds
sandhi-relevant variants so the query matches whichever surface
form appears in the corpus:

| Trigger | Variants generated |
| --- | --- |
| Word ends in `ं` | drop `ं`, OR replace with `म्` |
| Word ends in `ः` | drop `ः`, OR replace with `स्` |
| Word ends in `ो` | replace with `ः`, OR replace with `स्` |
| Word ends in `ा` (≥ 3 akṣaras) | replace with `न्` (n-stem) |
| Word ends in `्` (halant) | drop the halant |

### 9.4 Multi-token and fuzzy match in search

- Each token expanded independently via §9.1–9.3.
- For each token's variants, four parallel Lunr queries:
  exact (weight 1.0), prefix `*` (0.7), fuzzy `~1` (0.5),
  fuzzy `~2` for tokens ≥ 5 akṣaras (0.3), substring `**` (0.3).
- Aggregate per document: sum of weighted scores +
  count of matched tokens.
- Multi-token queries with all tokens hitting the same unit get a
  1.6× score multiplier (the gap-tolerant phrase match).
- Multi-token queries require at least half the tokens to match.

---

## 10. Coverage on the Prasthāna-trayī corpus

Last measured by `npm run dict:coverage`:

| Layer | Distinct tokens | All token occurrences |
| --- | --- | --- |
| Direct dictionary match | 5.7 % | 37.0 % |
| Inflection (suffix + manual + surface variant) | 9.9 % | 13.9 % |
| Compound (samāsa) decomposition | 64.3 % | 33.0 % |
| Fuzzy nearest-lemma fallback | 0–95 % (length-gated) | up to ~16 % of the remainder |
| Unresolved | 19.6 % distinct | ~16 % occurrences |

The frequency-weighted total (~84 % resolved by direct + inflection
+ compound, then asymptotic to ~99 % once the fuzzy layer kicks in)
is what the user feels in practice.

---

## 11. What this rule set deliberately is NOT

- **Not a full Pāṇinian engine.** We don't generate forms from
  roots via the Aṣṭādhyāyī. We invert observed surface patterns.
  A real engine (e.g. Vidyut, Sanskrit Heritage) would produce more
  precise grammatical analyses; the trade-off is binary size and
  startup latency. **The integration plan is in
  [`paninian-engine-plan.md`](paninian-engine-plan.md);** the
  adapter facade is already scaffolded under `src/lib/panini/`,
  defaulted to a no-op so the existing rules keep working until a
  real engine ships.
- **Not a stemmer / lemmatiser in the Lucene sense.** The output is
  a Devanāgarī lemma keyed against Cologne head-words, not a stem.
- **Not context-aware.** Multiple lemma candidates are returned
  ranked by confidence; the user picks. A future plan
  (`docs/context-meaning-plan.md`) describes how to layer
  Mīmāṁsā / Pāṇinian / NLP context disambiguation on top.
- **Not authoritative for traditional exegesis.** Use the bhāṣya
  itself as the primary text; this analyser is a study aid.

---

## 12. Verifying the rules

Vitest unit tests covering every layer:

- `tests/sandhi.test.ts` — akṣara segmentation, sandhi rule
  proposals, inflection lemmas, compound splitter
- `tests/analysis.test.ts` — pronoun-table hits, surface-variant
  proposals, method tagging, fuzzy nearestHeads
- `tests/linking.test.ts` — verse ordinals derived from source IDs,
  kārikā kind detection from `_K##` suffix, canonical Mandukya
  prakaraṇa titles

Run: `npm test`.

A corpus-wide coverage scan (every word in every bhāṣya, classified
by which layer resolves it) is in `scripts/dict-coverage.ts`. Run:
`npm run dict:coverage`.

---

*Last updated alongside commit aa49efc.*
