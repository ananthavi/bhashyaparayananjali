# Translation effort estimate — full corpus into English + Malayalam

What it would take to populate `data-source/meanings/` with proper
translations for every mantra, sūtra, kārikā, avatāraṇa, and bhāṣya
prose passage across all 13 prasthāna-trayī bhāṣyas the app ships.

This is a *planning* document. The infrastructure (schema, ingestion,
reader UI, review gate) is already shipped — see
`docs/meanings-plan.md`, `data-source/meanings/README.md`, and
`docs/authoritative-validation-plan.md` §3.3 for the bilingual
reviewer role.

---

## 1. Corpus volume

Numbers from `npm run audit:corpus-volume` (script:
`scripts/audit-corpus-volume.ts`), counted from the precached
`public/data/bhashya/` files actually shipped in v0.1.0:

| Bucket                  | Sanskrit tokens | Sanskrit chars | Notes |
| ---                     | ---:            | ---:           | --- |
| **Mūla verses**         | 47,400          | 347,200        | mantras + sūtras + verses + kārikās |
| **Avatāraṇa** (leading) | 11,238          | 87,604         | the connector at the head of each unit |
| **Intro bhāṣya**        | 11,801          | 103,578        | chapter-level introductions |
| **Main bhāṣya**         | 309,496         | 2,498,104      | the body of Śaṅkara's commentary |
| **Aux bhāṣya / śloka**  | 1,876           | 15,740         | quoted verses inside the bhāṣya |
| **Total Sanskrit**      | **381,811**     | **3,052,226**  | across **3,069 units** in 13 texts |

Per-text breakdown (token count of root + every bhāṣya block):

| Text          | Units | Root tokens | Bhāṣya tokens | Sanskrit total |
| ---           |   --: | --:         | --:           | --:            |
| brahma-sutra  |   570 |  2,922      |  98,175       | **101,097**    |
| brihadaranyaka|   461 | 12,904      |  82,422       | **95,326**     |
| gita          |   702 |  8,590      |  51,559       | **60,149**     |
| chandogya     |   658 | 11,505      |  42,026       | **53,531**     |
| mandukya      |   237 |  3,023      |  13,110       | **16,133**     |
| taittiriya    |    54 |  2,424      |  12,603       | **15,027**     |
| katha         |   122 |  1,864      |   7,660       | **9,524**      |
| prashna       |    68 |  1,287      |   5,786       | **7,073**      |
| mundaka       |    68 |  1,076      |   5,765       | **6,841**      |
| aitareya      |    36 |    612      |   5,007       | **5,619**      |
| kena-pada     |    36 |    467      |   4,530       | **4,997**      |
| kena-vakya    |    37 |    467      |   3,596       | **4,063**      |
| isha          |    20 |    259      |   2,172       | **2,431**      |

The four large texts (Brahma-sūtra, Bṛhadāraṇyaka, Gītā, Chāndogya)
account for **81 %** of the Sanskrit text by token. Effort estimates
should be weighted accordingly — finishing those four covers most of
the corpus.

---

## 2. Target volume in English / Malayalam

Translated text is consistently larger than the Sanskrit source
because compounds get unpacked, ellipses are filled in, and modern
syntax requires more function words. Empirical expansion ratios from
published bhāṣya translations (Gambhīrānanda, Mādhavānanda, Thibaut,
Olivelle):

| Direction        | Expansion (× Sanskrit tokens) | Notes |
| ---              | ---                            | --- |
| Sanskrit → English | 2.5×–3.5×                    | 3× modal; verse glosses run higher (5×) than prose |
| Sanskrit → Malayalam | 1.5×–2.2×                  | Malayalam is more compact; many Sanskrit terms remain transliterated |

Resulting target word counts:

|                    |        Low |     Modal |      High |
| ---                |        --: |       --: |       --: |
| **English**        | 954,000    | 1,145,000 | 1,336,000 |
| **Malayalam**      | 573,000    |   725,000 |   840,000 |
| **Combined**       | 1,527,000  | 1,870,000 | 2,176,000 |

For perspective: that's roughly **8–11 full-length books** of
translated material in English alone. Gambhīrānanda's Bṛhadāraṇyaka
alone (the single most cited published translation) is ~580 pages
in print — and that text is a third of the corpus by token volume.

---

## 3. What's already public-domain and ready to ingest

Two large bodies of pre-1929 scholarly translations cover most of
the Upaniṣad bhāṣyas already, free of copyright:

| Translator (year)                 | Texts covered                 | License |
| ---                               | ---                           | --- |
| **S. Sitarama Sastri / Sītā Rāma** (1898–1905) | Īśa, Kena, Kaṭha, Praśna, Muṇḍaka, Māṇḍūkya | PD |
| **Mahādeva Śāstrī** (1899–1923)   | Aitareya, Taittirīya, *Gītā* (incl. bhāṣya) | PD |
| **George Thibaut** SBE 34, 38 (1890–96) | Brahma-sūtra Bhāṣya          | PD |
| **Robert Hume** (1921, *13 Principal Upaniṣads*) | mūla only of all 13 + Bṛhadāraṇyaka | PD (mūla); his Bṛhadāraṇyaka translation does not include bhāṣya |
| **Maxim Müller** SBE 1, 15 (1879–84) | mūla of major Upaniṣads      | PD |

What this gets us, **if we can find clean OCR and ingest at high
quality**:

| Text          | PD English bhāṣya translation | Coverage |
| ---           | ---                            | --- |
| isha, kena-pada, kena-vakya, katha, prashna, mundaka, mandukya | Sitarama Sastri | ~100 % |
| aitareya, taittiriya | Mahādeva Śāstrī | ~100 % |
| gita          | Mahādeva Śāstrī (1899) | ~100 % |
| brahma-sutra  | Thibaut (SBE 34/38)            | ~100 % |
| chandogya     | Gangadhar Sastri / Roer (partial); **gap** | ~30 % |
| brihadaranyaka| **gap** — only Mādhavānanda (1934, copyright) | ~0 % PD |

**Practical implication.** Of ~1.15 M target English words, roughly
**60–70 %** is already covered by reliable PD translations. The two
big gaps — Chāndogya and Bṛhadāraṇyaka bhāṣya — are also the largest
texts by volume, so they dominate the *new translation* effort.

For Malayalam there is **no parallel public-domain stack**. Every
quality Malayalam edition we are aware of (Sringeri, Chinmaya
Mission, Ramakrishna Math Thiruvananthapuram, Manakkulam Pandit's
editions) is in copyright. Acquiring it requires either licensing
or commissioning fresh.

---

## 4. Productivity assumptions

Based on translation-industry benchmarks for scholarly Sanskrit
(verified informally against translator interviews and published
translation timelines):

### 4.1 Translator output per working day

| Task                          | Expert (PhD-level Sanskritist) | Competent grad student | Notes |
| ---                           | ---:                           | ---:                   | --- |
| **Verse mūla** (gloss + render) |   80–150 verses              |  30–60 verses          | rate-limited by metrical analysis + word-by-word gloss tradition |
| **Bhāṣya prose** (English)    | 1,200–2,500 source words       | 500–1,200 source words | full-text, including footnotes / citations |
| **Bhāṣya prose** (Malayalam)  | 1,800–3,500 source words       | 800–1,800 source words | bilingual culture in Kerala; Sanskrit→ML is a shorter cognitive jump than → English |
| **Editorial proofreading**    | 6,000–10,000 target words      | 3,000–5,000            | regardless of source language |
| **PD digitisation / OCR cleanup** | 10–20 printed pages       | 5–10                   | depends heavily on scan quality |

### 4.2 Project scaling factors

- **Compound effect of multiple translators**: a team of `n` does
  not deliver `n×` output. Coordination overhead, terminology
  alignment, voice consistency, and adjudication cycles cost
  ~25–35 % above the single-translator baseline. Glossary
  maintenance becomes the bottleneck.
- **Ramp-up**: a translator new to Śaṅkara's specific style (dense
  ellipsis, oblique reference, pūrva-pakṣa / siddhānta interleaving,
  long quotation chains) needs 4–6 weeks before reaching steady
  state. Estimates below assume steady state.
- **Verse vs prose mix**: mūla translation is *slower per word* but
  shorter per unit. The corpus is 12 % mūla / 88 % bhāṣya by token,
  so prose dominates wall-clock time.

---

## 5. Effort estimates (person-months)

Working in **two effective translator-days = 1 productive working
day** (allowing for review, glossary work, communication overhead).

### 5.1 Path A — *PD ingestion + targeted new translation*

Use Sitarama Sastri / Mahādeva Śāstrī / Thibaut everywhere they
cover. Commission only the gaps (Chāndogya proper bhāṣya,
Bṛhadāraṇyaka bhāṣya). Plus full Malayalam.

| Task                                  | Volume        | Throughput | Person-months |
| ---                                   | ---           | ---:       | ---:          |
| OCR + cleanup of PD English (8 vols)  | ~2,400 print pages | 15 pages/day | **8 PM** |
| Structural alignment to unitId schema | 2,460 covered units | 70 units/day | **2 PM** |
| New English translation: Chāndogya bhāṣya (~70 % of 53,531 tokens) | 37,500 src words | 1,800/day | **5 PM** |
| New English translation: Bṛhadāraṇyaka bhāṣya (~100 %) | 95,300 src words | 1,800/day | **12 PM** |
| English review + adjudication         | 1.15 M tgt words | 7,000/day | **8 PM** |
| Malayalam translation (full corpus)   | 381,800 src words | 2,500/day | **31 PM** |
| Malayalam review                      | 725,000 tgt words | 7,000/day | **5 PM** |
| Glossary + terminology committee      | ongoing          | 0.25 PM/month × 24 | **6 PM** |
| Project management / coordination     | ongoing          | 0.20 PM/month × 24 | **5 PM** |
| **Path A total**                      |                  |               | **~82 PM** |

With a team of **5 translators + 2 senior reviewers + 1 PM** working
in parallel, this is a **15–20 month** calendar project, of which
the first 6 months are dominated by PD ingestion + Chāndogya /
Bṛhadāraṇyaka commissioning in parallel.

### 5.2 Path B — *All-new commissioned translation*

Skip the PD ingestion route entirely (e.g. if the licence terms or
scholarly preferences favour fresh work).

| Task                                  | Volume      | Throughput | Person-months |
| ---                                   | ---         | ---:       | ---:          |
| English translation, full corpus      | 381,800 src words | 1,800/day | **48 PM** |
| English review                        | 1.15 M tgt words | 7,000/day | **8 PM** |
| Malayalam translation, full corpus    | 381,800 src words | 2,500/day | **31 PM** |
| Malayalam review                      | 725,000 tgt words | 7,000/day | **5 PM** |
| Glossary + coordination               | ongoing            | 24 × 0.45 | **11 PM** |
| **Path B total**                      |                    |           | **~103 PM** |

Calendar: **20–28 months** with the same team size.

### 5.3 Path C — *Licence existing copyrighted translations*

If Advaita Ashrama (Gambhīrānanda's editions) and the Sringeri Maṭha
Malayalam editions can be licensed for app inclusion:

| Task                                 | Volume         | Throughput | Person-months |
| ---                                  | ---            | ---:       | ---:          |
| Licence negotiation (legal + admin)  | per publisher  | 1.5 PM each × 3–4 | **4–6 PM** |
| OCR + alignment (English Gambhīrānanda etc.) | ~3,200 pages | 15 pages/day | **11 PM** |
| OCR + alignment (Sringeri Malayalam) | ~2,800 pages   | 12 pages/day | **12 PM** |
| Editorial proofreading               | 1.87 M target words | 8,000/day | **12 PM** |
| Glossary / metadata                  | ongoing             | 24 × 0.20 | **5 PM** |
| **Path C total**                     |                     |           | **~46 PM** |

Calendar: **10–14 months**. Cheapest by far, but *only* if licensing
succeeds and the publishers cooperate on derivative-rights for app
distribution.

---

## 6. Cost estimates

Using rate ranges current in 2024–2026 from translator unions and
academic-publishing benchmarks. **Indian-market rates** (which apply
when translators are India-based and especially for Malayalam) and
**Western academic rates** (which apply when commissioning from
Sanskrit-departments in the EU / NA / Australia):

| Rate type                              | India           | Western        |
| ---                                    | ---:            | ---:           |
| Senior Sanskritist, scholarly prose    | ₹1.50–3.00/word | $0.15–0.25/tgt word |
| Mid-level Sanskritist                  | ₹0.80–1.80/word | $0.10–0.18/tgt word |
| Reviewer (proofreading + adjudication) | ₹0.50–0.90/word | $0.06–0.10/tgt word |
| Malayalam translator / reviewer        | ₹0.40–1.00/src word | n/a (specialised) |
| OCR + structural alignment (per page)  | ₹150–400        | $4–10          |
| Project management (per month FTE)     | ₹80,000–150,000 | $5,000–9,000   |

### 6.1 Path A cost

(India-base team, mixed seniority, exchange rate ₹85/USD)

| Line item                              | Low      | Modal     | High      |
| ---                                    | --:      | --:       | --:       |
| OCR + alignment (4,800 page-equivalents) | ₹720K  | ₹1.2M     | ₹1.9M     |
| Chāndogya English (37,500 src words)   | ₹56K     | ₹84K      | ₹113K     |
| Bṛhadāraṇyaka English (95,300 src words) | ₹143K  | ₹215K     | ₹286K     |
| English review (1.15M tgt words)       | ₹575K    | ₹805K     | ₹1.04M    |
| Malayalam full corpus (381K src words) | ₹153K    | ₹268K     | ₹382K     |
| Malayalam review (725K tgt words)      | ₹290K    | ₹435K     | ₹580K     |
| PM + glossary (24 months × 1 FTE)      | ₹1.92M   | ₹2.4M     | ₹3.6M     |
| **Path A subtotal (₹)**                | **₹3.86M** | **₹5.41M** | **₹7.90M** |
| **Path A subtotal (USD)**              | **$45K** | **$64K**  | **$93K**  |

### 6.2 Path B cost

| Line item                              | Low      | Modal     | High      |
| ---                                    | --:      | --:       | --:       |
| English full corpus (381K src words)   | ₹572K    | ₹859K     | ₹1.15M    |
| English review                         | ₹575K    | ₹805K     | ₹1.04M    |
| Malayalam full corpus                  | ₹153K    | ₹268K     | ₹382K     |
| Malayalam review                       | ₹290K    | ₹435K     | ₹580K     |
| PM + glossary (24 months)              | ₹1.92M   | ₹2.4M     | ₹3.6M     |
| **Path B subtotal (₹)**                | **₹3.51M** | **₹4.77M** | **₹6.75M** |
| **Path B subtotal (USD)**              | **$41K** | **$56K**  | **$79K**  |

Note Path B comes in *cheaper* than Path A in modal terms because it
skips the substantial OCR + alignment cost of ingesting eight PD
volumes. The choice between A and B is therefore not primarily about
cost — it's about **scholarly fidelity** (PD translators bring
recognised authority that fresh commissions don't) and **time-to-first-ship**
(PD-ingested texts come online faster than commissioned ones).

### 6.3 Path C cost

| Line item                              | Low      | Modal     | High      |
| ---                                    | --:      | --:       | --:       |
| Licence fees (one-time + royalty)      | ₹500K    | ₹1.5M     | ₹4M       |
| OCR + alignment (6,000 pages)          | ₹900K    | ₹1.5M     | ₹2.4M     |
| Editorial proofreading                 | ₹935K    | ₹1.31M    | ₹1.69M    |
| Glossary / coordination                | ₹400K    | ₹600K     | ₹900K     |
| Legal + admin                          | ₹250K    | ₹500K     | ₹1M       |
| **Path C subtotal (₹)**                | **₹2.99M** | **₹5.41M** | **₹9.99M** |
| **Path C subtotal (USD)**              | **$35K** | **$64K**  | **$117K** |

The licence-fee range is the dominant uncertainty. Some Indian
publishers grant non-commercial app rights for nominal fees;
internationally distributed presses (Penguin, Oxford) typically
charge significantly more. Royalty-bearing arrangements (e.g.
₹1 per app download payable annually) can dwarf the upfront cost
over 3–5 years if the app reaches mass adoption.

---

## 7. Hybrid path — recommended

Combining elements of A + C:

1. **Months 0–6**: Negotiate a one-time perpetual licence with
   Sringeri Maṭham covering Malayalam editions of the entire
   Upaniṣad-Gītā-Brahmasūtra trilogy. The matham produced these
   editions with the explicit purpose of pārāyaṇa support; an app
   that surfaces them with attribution is plausibly within the
   spirit of their original mandate. **Risk-adjusted cost: ₹500K–2M**.
2. **Months 0–8 (parallel)**: OCR + structural alignment of the
   Sitarama Sastri + Mahādeva Śāstrī + Thibaut English bodies
   covering 11 of the 13 texts. **Cost: ₹600K–1.4M**.
3. **Months 6–14**: Commission new English translation of
   Chāndogya + Bṛhadāraṇyaka (the PD English gaps). This is also
   where the highest scholarly value lies — a fresh translation of
   Bṛhadāraṇyaka bhāṣya hasn't been done since Mādhavānanda 1934.
   **Cost: ₹500K–1.5M**.
4. **Months 12–18**: Reviewer pass — Vyākaraṇa, Vedānta, Bilingual
   per `docs/authoritative-validation-plan.md` §3 — across the full
   ingested corpus before declaring authoritative.
5. **Months 18–24**: Versioned release with explicit per-source
   provenance + license badges already supported in the UI.

**Hybrid total: ~60–80 person-months, ₹3.5M–8M (US$40K–95K),
calendar 18–24 months** with a 4–6 person team.

---

## 8. What this DOES NOT cover

Honest list of out-of-scope items for the cost ranges above:

- **Audio recordings** of mantras / verses (separate effort, easily
  another ₹2M+ for studio-quality across 13 texts).
- **Word-by-word interlinear glosses** (anvayārtha) — common in
  Indian editions but a 2–3× volume blow-up vs prose translation.
  We model this as a separate phase keyed off the Vidyut engine
  output.
- **Chapter introductions** beyond what's already in the corpus —
  the source HTML carried over the Sringeri intros in Sanskrit, but
  *English* chapter introductions like Gambhīrānanda's would need
  separate translation.
- **Annotation footnotes** explaining technical Vedānta terminology
  (māyā, adhyāsa, dhi-vyakti, …). Adds 10–25 % to bhāṣya word count.
- **Sanskrit critical apparatus** — the corpus uses Sringeri's
  edited text; no variant-reading apparatus is currently displayed
  and it isn't covered above.
- **Inscription / manuscript citations** in Brahma-sūtra Bhāṣya
  pūrva-pakṣa sections — Thibaut elides many; modern translation
  would re-trace and translate them, expanding the volume by 5–10 %.

---

## 9. Risks and contingency

| Risk                                  | Likelihood | Cost impact | Mitigation |
| ---                                   | ---        | ---         | --- |
| Licence negotiation falls through     | medium     | +₹2M (commission instead) | Run A and C in parallel until license signed |
| OCR quality of pre-1923 scans is poor | medium-high | +30 % cleanup time | Test OCR on 10 sample pages per source before full run |
| Translator attrition mid-project      | medium     | +15 % rework   | Stagger commissioning so 2 translators cover each text |
| Glossary drift across translators     | high       | +20 % editorial pass | Mandatory weekly glossary review for first 3 months |
| Reviewer bandwidth shortage           | high       | +calendar 3 mo | Identify reviewers before commissioning starts |
| Theological-editorial disputes        | medium     | +calendar 1–2 mo | Adjudication committee + escalation path defined upfront |
| Sringeri specifically declines        | low–medium | +₹1.5M (commission ML) | Have a backup ML translator team identified |

---

## 10. What "use effectively" requires beyond raw text

The numbers above assume we ship a translation per unit. To make
the meanings layer *effective* in the reader the following must
also be in place — none of which is large but all of which has to
be done:

1. **Per-source citation rendering.** Already shipped — the
   `MeaningCard` shows source + license chip per entry.
2. **Source-toggle UX** when multiple translations exist for one
   unit. Already shipped.
3. **Search index of translated text** so a user can find a verse
   by an English phrase. Adds ~2–3 MB to the search index;
   straightforward extension of `lunr` build.
4. **Per-language script + font tuning.** Malayalam already shipped
   with Manjari; English uses the system serif. Both fine.
5. **Cross-reference linking** — when a bhāṣya quotes another
   Upaniṣad we should hyperlink to the cited verse if we have
   meanings for it. Adds ~1–2 PM at the end of the project.
6. **Reviewer registry hand-off** — every translation entry needs
   a `reviewer_id` referencing `tests/gold/reviewers.yaml`. CI will
   already enforce this once the reviewer onboarding finishes.

---

## 11. Concrete next steps

If approved, in order:

1. **Decision: which path** (A / B / C / Hybrid). Hybrid is the
   recommendation; final call depends on Sringeri licensing
   willingness.
2. **Recruit reviewers** for the three roles defined in
   `authoritative-validation-plan.md` §3. **Blocker for any path.**
3. **Run OCR pilot** on 50 pages each from Mahādeva Śāstrī's Gītā
   bhāṣya and Sitarama Sastri's Kaṭha — quantify cleanup overhead.
4. **Begin licensing conversations** with Sringeri (Malayalam) and
   optionally Advaita Ashrama (English Gambhīrānanda).
5. **Define glossary / terminology baseline** — ~200 head terms
   (`brahman`, `ātman`, `māyā`, `adhyāsa`, …) with agreed English
   AND Malayalam renderings. Reviewer-signed before translation
   starts. ~2 weeks of senior-reviewer time.
6. **Commission Bṛhadāraṇyaka bhāṣya** as the first new
   translation, since (a) it's the biggest PD gap, (b) it's where
   the existing app surface is weakest, (c) it's the canonical
   stress-test for the rest of the pipeline.

The infrastructure (data-source/, build-meanings.ts, MeaningCard,
review gate) is already shipped; this plan is what fills it.
