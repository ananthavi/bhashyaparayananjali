# Plan: integrating a full Pāṇinian engine

This is a **planning document**. The current tap-a-word analyser
(documented in `docs/analysis-rules.md`) uses a hand-curated subset
of Pāṇinian rules — enough for ~84 % of the corpus by frequency.
This plan covers the path to a **complete Pāṇinian engine** that
enumerates every valid derivation for every Sanskrit form, usable
across the existing 13 bhāṣyas and any future texts added to the
app.

The plan is honest about what "complete" can and cannot mean. Read
§1 first.

---

## 1. The honest theoretical limit — what "all correct splits" can mean

Pāṇini's *Aṣṭādhyāyī* (~4,000 sūtras, ~6 BCE) is a **descriptive
generative grammar**. It does not promise unique inverse derivations
from a surface form. Several well-known issues:

1. **Multiple valid derivations for one surface form.** The
   compound `ब्रह्मविद्या` admits at least three Pāṇinian readings:
     - tatpuruṣa (genitive): "the knowledge *of* Brahman"
     - karma-dhāraya: "knowledge that *is* Brahman"
     - bahuvrīhi: "[she] for whom Brahman is the knowledge" (rare,
       but grammatically valid)
   No engine, no human expert, can pick *the* correct one without
   context. They can only enumerate the candidates.
2. **Ambiguity of sandhi reversal.** `देवो ऽस्ति` could be
   `देवः + अस्ति` or `देव + ओम् + अस्ति` (with avagraha + sandhi)
   or `देव + ु + अस्ति` (visarga to ु in some traditions). Pāṇini
   gives us the rules; the rules don't tell us which split was
   *intended*.
3. **Vārtikas + Mahābhāṣya extensions.** Kātyāyana's vārtikas
   (~3 BCE) and Patañjali's Mahābhāṣya (~2 BCE) add ~1,200 more
   rules, exceptions, and meta-rules that Pāṇini's text alone
   doesn't express. A "complete" engine includes these or it isn't
   complete.
4. **Lexical gaps.** Pāṇini's rules generate valid forms only for
   words in the *Dhātupāṭha* (verbal roots, ~2,000) and *Gaṇapāṭha*
   (nominal stem groups). Foreign words, neologisms, and
   text-specific names have no Pāṇinian derivation. The corpus has
   ~1–2 % such tokens (proper nouns, technical terminology specific
   to a tradition).
5. **Semantic ambiguity is out of scope.** Pāṇini handles form, not
   meaning. Once forms are enumerated, picking the right *meaning*
   among the options is a separate problem (covered by
   `docs/context-meaning-plan.md`).

**Therefore "guaranteed all correct splits" reframes as:**

> Every grammatically valid Pāṇinian derivation under the
> Aṣṭādhyāyī + Vārtikas + Mahābhāṣya for the given surface form is
> enumerated, with confidence scores when available. Picking among
> the enumerated candidates, or judging which is "right" for a
> given context, is downstream.

This is what real Pāṇinian engines actually deliver. The rest of
this plan describes how to integrate one into the app.

---

## 2. What a "Pāṇinian engine" must do

A complete engine handles five major operations, all of which are
needed by the app:

### 2.1 Sandhi (saṃhitā)

Forward: combine two padas into one according to the sandhi rules
(svara, visarga, hal, etc.).

Reverse: given a surface word, enumerate every pre-sandhi split
that the rules permit. This is the operation our compound splitter
needs.

### 2.2 Inflection / pada-derivation (sup, tiṅ)

Given a stem (prātipadika) + a vibhakti (case + number), generate
the inflected form. Reverse: given an inflected form, return all
valid (stem, vibhakti) pairs.

### 2.3 Compound formation / decomposition (samāsa)

Forward: given members + a samāsa-vidhi, derive the compound.
Reverse: given a surface compound, enumerate every (parts, type)
where type ∈ {dvandva, tatpuruṣa, karma-dhāraya, dvigu, bahuvrīhi,
avyayī-bhāva}.

### 2.4 Verbal derivation (prakriyā)

Generate inflected verb forms across 10 lakāras × 3 puruṣa × 3
vacana × parasmaipada/ātmanepada from a dhātu + lakāra. Reverse:
given a finite verb, return (dhātu, lakāra, puruṣa, vacana,
pada). Roots come from the Dhātupāṭha.

### 2.5 Krit + taddhita derivation

Apply krit-pratyayas (kta, ktvā, ktvā, śatṛ, śānac, etc.) to roots
and taddhita-pratyayas (tva, tā, mat-up, vant-up, etc.) to stems.
Reverse: identify the krit/taddhita-derived nominal and recover its
base.

### 2.6 Pratyāhāra system

The compressed sound-class notation (अच्, हल्, etc.) used by half
the sūtras. An engine without pratyāhāra resolution can't faithfully
apply the Aṣṭādhyāyī.

### 2.7 Sūtra ordering, anuvṛtti, apavāda

Pāṇini's sūtras are NOT applied in isolation. They have:
- **anuvṛtti**: continuation of an earlier sūtra's terms into
  later sūtras
- **adhikāra**: governing sūtras that scope a section
- **apavāda**: exception sūtras that override earlier rules
- **paribhāṣā**: meta-rules about how rules apply

Any engine that doesn't handle these gives wrong derivations on
non-trivial inputs.

---

## 3. Survey of existing engines

The state of the art in Pāṇinian engines is small but real. Four
serious projects, each with trade-offs:

### 3.1 Vidyut (Ambuda-org)

**Source**: <https://github.com/ambuda-org/vidyut>. Rust. MIT
licence. Active development since 2022. By Arun Prasad and the
Ambuda team.

**Modules**:
- `vidyut-prakriya` — applies the Aṣṭādhyāyī sūtra-by-sūtra to
  produce all valid derivations of a given input. Currently
  implements a substantial fraction of the verbal derivation rules
  and a growing portion of nominal/krit/taddhita.
- `vidyut-cheda` — segmentation (sandhi reversal + word splitting).
- `vidyut-kosha` — compressed lexicon (Apte + MW + others) keyed
  by lemma.
- `vidyut-sandhi` — sandhi forward/reverse.
- `vidyut-lipi` — script transliteration (overlaps with sanscript
  but better for production).

**Status as of late 2025**: ~70–80 % of common verbal forms; ~40 %
of nominal/compound coverage; sandhi essentially complete; lexicon
coverage matches MW + Apte.

**Embeddability**: Rust → WASM via `wasm-bindgen`. Documented build
path. Approximate WASM bundle size: ~3–5 MB (depends on which
modules), comparable to a full-size font. Lookup latency: ~5–20 ms
per call on a phone.

**npm status**: no published package as of 2026-04. Available via
crates.io for Rust consumers and PyPI for Python (vidyut-py). A
WASM bridge requires our own build.

### 3.2 Sanskrit Heritage Engine (INRIA)

**Source**: <https://sanskrit.inria.fr>. OCaml. Hosted by INRIA.
Decades of work by Gérard Huet's team.

**Coverage**: encyclopaedic — ~1.5M generated forms, full
segmenter, lemmatiser, parser, semantic role labeller. Probably the
most complete academic implementation.

**Embeddability**: server-only. The OCaml engine compiled to a
binary; web access via REST endpoints at sanskrit.inria.fr. There's
no WASM bridge and no offline mobile path.

**Use case for us**: build-time data extraction (run during
`npm run dict:build` to enrich entries), not runtime.

### 3.3 Sanskrit Library / SanskritFinder

**Source**: <https://sanskritlibrary.org>. Mixed C++ / web.
Peter Scharf, MIT.

**Coverage**: strong on derivational morphology. Used widely for
search and OCR projects.

**Embeddability**: server tooling only.

### 3.4 samsAdhanī (UoH)

**Source**: <http://sanskrit.uohyd.ac.in>. Python.
Amba Kulkarni's group.

**Coverage**: research-grade. Sandhi splitter, segmenter, parser.
Used in Sanskrit NLP research.

**Embeddability**: Python web service.

### 3.5 Comparison summary

| Engine | License | Lang | Mobile / WASM | Coverage | Notes |
| --- | --- | --- | --- | --- | --- |
| **Vidyut** | MIT | Rust | Yes (we'd build WASM) | Growing, ~70 % | **Recommended** |
| Heritage | LGPL | OCaml | No | Comprehensive | Server-only |
| Sanskrit Library | Mixed | C++/web | No | Strong morphology | Server-only |
| samsAdhanī | Academic | Python | No | Research-grade | Server-only |

**Vidyut is the only realistic path** for an offline mobile app
that needs to handle any future text without server dependency.

---

## 4. Recommended architecture

A clean adapter interface in front of the engine, with the
existing analyser as a fallback.

```
                    ┌─────────────────────────────────────────┐
                    │  src/lib/analysis.ts (orchestrator)     │
                    └───┬─────────────────────────────────────┘
                        │
        ┌───────────────┼─────────────────┐
        ▼               ▼                 ▼
┌───────────────┐ ┌─────────────┐ ┌──────────────────┐
│ Existing      │ │ Pāṇinian    │ │ Bulk dict +      │
│ rule-based    │ │ engine      │ │ MW/Apte/Vāch/Śabd│
│ analyser      │ │ adapter     │ │ lookup           │
│ (fallback)    │ │ (Vidyut)    │ │                  │
└───────────────┘ └──────┬──────┘ └──────────────────┘
                         │
                  ┌──────┴────────────┐
                  ▼                   ▼
         ┌────────────────┐ ┌──────────────────┐
         │ NullEngine     │ │ VidyutWasmEngine │
         │ (no engine     │ │ (when WASM is    │
         │  shipped)      │ │  loaded)         │
         └────────────────┘ └──────────────────┘
```

`src/lib/panini/` holds the adapter (already scaffolded in this
commit). `analysis.ts` consults it after the existing layers; when
the Pāṇinian engine returns hits, those are *added* to the
candidate list with `method: 'panini'` so the popover can label
them as authoritative.

### 4.1 Adapter interface

```ts
export interface PaniniAnalysis {
  /** Lemma (citation form) of the input. */
  lemma: string;
  /** Part-of-speech: noun / verb / particle / etc. */
  pos: string;
  /** Morphology: case, number, gender, tense, voice, etc. */
  morph: Record<string, string>;
  /** Compound parts when the input is a samāsa. */
  parts?: PaniniAnalysis[];
  /** Samāsa class when applicable. */
  samasaType?: 'dvandva' | 'tatpuruṣa' | 'karma-dhāraya'
              | 'dvigu' | 'bahuvrīhi' | 'avyayī-bhāva';
  /** Confidence in [0, 1]. Engines that don't score return 1.0. */
  confidence: number;
  /** Sūtra trace used to derive this analysis (when available). */
  sutras?: string[];
}

export interface PaniniEngine {
  readonly name: string;
  readonly available: boolean;
  /** Enumerate every valid Pāṇinian analysis of the input form. */
  analyze(devanagariWord: string): Promise<PaniniAnalysis[]>;
  /** Sandhi-split a multi-pada utterance (e.g., a sūtra body). */
  segment(devanagariUtterance: string): Promise<string[][]>;
  /** Forward inflection: lemma + morphology → surface form(s). */
  inflect(lemma: string, morph: Record<string, string>): Promise<string[]>;
}
```

`null-engine.ts` is the default; it returns empty arrays and
`available: false`. `vidyut-wasm-engine.ts` (to be implemented in a
later PR) loads the WASM bundle on first use and proxies into the
Vidyut API.

### 4.2 Where the engine plugs into `analysis.ts`

The existing 5-layer chain stays. Pāṇinian results slot in as a
parallel high-confidence layer:

```
1. Direct dictionary match
2. Manual table
3. Surface variants
4. Suffix table  (existing inflection)
5. Compound splitter
6. Fuzzy fallback                   ←── existing layers, unchanged

         ║ Parallel high-confidence track
         ▼
P. Pāṇinian engine (when available)  ←── new

The orchestrator merges P and 1–6, dedupes by (lemma, morph),
and reranks: P-derived candidates with confidence ≥ 0.8 go to
the top, then existing 1–6 results, then P-derived candidates
with low confidence below them.
```

When the engine is unavailable (no WASM loaded) the chain runs
exactly as today.

---

## 5. Build path for the WASM bundle

Vidyut isn't an npm package; we have to build it. Steps:

1. Add `vidyut` as a Rust workspace member at `panini-wasm/`
   (Rust toolchain + `wasm-pack`).
2. Write a thin Rust crate that re-exports just the calls the
   adapter needs (`analyze`, `segment`, `inflect`). Expose via
   `wasm-bindgen`.
3. Build with `wasm-pack build --target web --release`. Output:
   `panini-wasm/pkg/` — a regular npm-style package with a `.wasm`
   blob + JS shim.
4. CI step in `.github/workflows/build-apk.yml` (and the iOS
   workflow) installs the Rust toolchain, builds the WASM, and
   copies it into `public/data/panini/`.
5. The web build's service worker precaches the `.wasm` (with a
   `maximumFileSizeToCacheInBytes` bump if needed; current limit
   80 MB, WASM should be < 10 MB).
6. The adapter's `vidyut-wasm-engine.ts` lazy-loads the WASM via
   dynamic `import()` only when the user taps a word AND the
   feature flag is on.

This keeps the engine **off the cold-load path**. First reader
load doesn't pay the WASM download.

---

## 6. Bundle / latency / correctness trade-offs

| Metric | Today (rule-based) | With Vidyut WASM |
| --- | --- | --- |
| Bundle size | 0 (just JS) | +3–5 MB WASM (lazy-loaded) |
| Cold tap latency | ~50 ms | ~80 ms first call (WASM init), ~5–20 ms steady-state |
| Coverage of common forms | ~84 % freq-weighted | ~95–98 % once Vidyut's nominal coverage matures |
| Correctness on resolved forms | medium (rule-based) | high (sūtra-traced) |
| New text added to corpus | works without code changes | works without code changes |
| Maintenance | per-rule tweaks | upstream Vidyut release tracking |
| Reproducibility | deterministic per release | deterministic per Vidyut version |

The big honest caveats:

- **Vidyut's nominal coverage is incomplete.** Verb derivation is
  the best-supported area. Compound splitting via `vidyut-cheda` is
  good but not yet exhaustive on rare formations.
- **WASM download is ~3–5 MB.** On metered networks this is a
  noticeable hit if we eagerly load. Lazy-loading on first tap
  amortises this — most users tap a word within seconds anyway.
- **Battery / CPU.** Vidyut is fast in Rust, slower under WASM.
  ~5–20 ms per `analyze` is fine for synchronous tap UX but adds up
  if we ran it over the entire corpus (we won't).

---

## 7. What changes in the existing codebase

### 7.1 Removed

Nothing. The existing analyser and rule tables stay.

### 7.2 Modified

- `src/lib/analysis.ts` — adds an optional Pāṇinian-engine layer
  in the chain. When the engine returns results, they're merged
  with existing layer outputs and deduped.
- `src/lib/features.ts` — adds `paniniEngineEnabled: boolean`.
  Default OFF. When ON, the analyser tries to load the engine
  asynchronously on first tap.
- `src/types.ts` — adds `PaniniAnalysis` to the candidate
  envelope returned by the analyser.
- `src/components/WordPopover.tsx` — renders a "Pāṇinian
  derivation" section with sūtra trace when available, plus a
  samāsa-class chip on every compound-relation result.

### 7.3 Added (this commit's scaffolding)

- `src/lib/panini/types.ts` — `PaniniAnalysis`, `PaniniEngine`,
  related types.
- `src/lib/panini/index.ts` — facade exporting `getEngine()` and
  `hasEngine()`. Loads the active engine at module init.
- `src/lib/panini/null-engine.ts` — default engine that returns
  empty arrays. Used until a real engine is wired.
- `src/lib/panini/README.md` — design notes for adapter authors.

A future `src/lib/panini/vidyut-wasm-engine.ts` slots in via the
facade with one line change.

---

## 8. Validation gate

The validation regime is deliberately strict because the engine's
outputs feed the analyser's authoritativeness claims. **All five
gates below are enforced by CI; no production rollout without all
five green.** Full process — gold corpus structure, reviewer
roles, sign-off cadence, disagreement resolution — is in
[`docs/authoritative-validation-plan.md`](authoritative-validation-plan.md).

1. **Forward sandhi round-trip.** Every `(lemma + morph) → surface`
   pair in the gold corpus must be reproducible by the engine's
   `inflect()`. Failure = that engine version is held back.
2. **Reverse sandhi enumeration completeness.** For every known
   compound and sandhi-affected pair in the gold corpus, the
   engine's `analyze()` / `segment()` MUST enumerate the gold
   split among its candidates with confidence ≥ 0.5 (tightened to
   0.7 in Phase 4). This is a **recall guarantee**: the right
   answer is always in the candidate list.
3. **Eval-set top-1 / top-3 accuracy + MRR.** A 2,000-form gold
   corpus drawn stratified-randomly from the 13 bhāṣyas, annotated
   by reviewers. Metrics: top-1 accuracy, top-3 accuracy, mean
   reciprocal rank. Engine version bumps that drop any of these by
   > 1 point are automatically held back.
4. **Coverage non-regression.** `npm run dict:coverage` per layer
   percentages tracked against `tests/baselines/coverage.json`.
   Any drop > 1 point fails CI.
5. **Reviewer sign-off.** Two reviewers (one Vyākaraṇa, one
   Vedānta) sign off on every engine-version bump; sign-offs
   recorded in `tests/gold/signoffs.md`. PR cannot merge without
   both.

### 8.1 Exhaustiveness — what we promise

For form analysis within the engine's rule coverage:

> **Every Pāṇinian-valid analysis** of the input form is in the
> returned candidate list. Confidence ranks them; the user / app
> picks. We do not silently filter valid candidates.

Recall claim, not precision. Precision is downstream
(context-meaning ranking). The gold-corpus enumeration test
(gate 2) measures recall directly.

For exegesis: see `authoritative-validation-plan.md` §1. We don't
make form-analysis claims about exegesis; we surface the bhāṣya
faithfully and let it speak.

### 8.2 What CI fails on

```
PR opened
  ├─ vitest                               (must be green)
  ├─ tests/property/sandhi-roundtrip      (must be green)
  ├─ tests/property/compound-enum         (must be green)
  ├─ tests/property/inflection-coverage   (must be green)
  ├─ npm run dict:coverage                (within 1 pt of baseline)
  ├─ npm run verify:linking               (must be green)
  └─ tests/gold/eval-set-runner           (top-1, top-3, MRR
                                           within thresholds)

Reviewer sign-offs (manual)
  ├─ Vyākaraṇa reviewer on form-analysis diff
  └─ Vedānta reviewer on sense-ranking diff (if changed)

Merge blocked until all green + both sign-offs.
```

### 8.3 Engine disagreement handling

When a Vidyut version bump produces a different analysis on a
gold-corpus form, the diff is posted to the PR. A reviewer accepts
each per-form change explicitly. Unaccepted changes hold back the
version bump — the engine doesn't get to override the gold corpus
unilaterally.

Conversely, when the engine flags an existing gold-corpus entry
as invalid (e.g. our annotation was wrong), the same reviewer
gate applies in reverse: the entry is corrected, sign-off
re-recorded, and the engine version proceeds.

---

## 9. Phased rollout

| Phase | What ships | Gating |
| --- | --- | --- |
| **0** *(this commit)* | Plan + adapter scaffold + null engine + feature flag. Default OFF. No user-visible change. | none |
| **1** | Vidyut WASM bridge + CI build. Engine still OFF by default but loadable for testing. Eval-set scaffolding. | Phase-0 merged |
| **2** | Engine ON for compound splitting only (replaces the existing splitter where confidence ≥ 0.8). All other layers unchanged. Eval-set top-1 must not regress. | Phase-1 merged + reviewer pass |
| **3** | Engine ON for inflection lemma resolution (replaces the suffix table where confidence ≥ 0.8). | Phase-2 merged + 1 week soak |
| **4** | Engine ON for full enumeration. Popover renders sūtra trace. | Phase-3 merged + reviewer pass |
| **5** | Forward generation: a "show all forms of this lemma" feature in the dictionary popover, powered by `vidyut-prakriya`. | Phase-4 merged |

Each phase is independently revertible. The feature flag lets us
disable any phase without code changes.

---

## 10. Forward compatibility for new texts

Any new text added to the bhāṣya corpus runs through the same
pipeline:

1. Scrape via `npm run scrape -- --only=<new-text>` (assumes the
   source has the `<L>...<LEND>` Cologne markup pattern, or a
   custom parser is wired).
2. Split into manifest + chunks via `npm run split:bhashya`.
3. Re-index with `npm run build:index`.
4. Tap-a-word analysis works immediately:
   - Existing analyser handles the form via inflection / sandhi /
     compound rules.
   - Pāṇinian engine handles it via Vidyut.
   - Both feed into the popover.

**No code changes are required for new texts.** That's the
forward-compatibility promise. The engine doesn't memorise text;
it operates on Sanskrit forms.

The only manual step a new text might require is a per-text
**tradition tag** in the catalog (`group: 'upanishad' / 'gita' /
'brahma-sutra' / etc.`) for the context-meaning plan's tradition
prior — see `docs/context-meaning-plan.md` §4.4. The Pāṇinian
engine itself is text-agnostic.

---

## 11. What this plan deliberately is NOT

- **Not a from-scratch Pāṇinian implementation.** Re-implementing
  4,000 sūtras + the pratyāhāra system + vārtikas + the Mahābhāṣya
  is multiple person-years of work. We use Vidyut as the engine,
  not as one of many candidates.
- **Not a guarantee of single correct splits.** Vidyut enumerates
  *all valid* Pāṇinian derivations. Choosing the right one for a
  given context is a separate problem (`docs/context-meaning-plan.md`).
- **Not a replacement for the existing rule-based analyser.** The
  rules stay as a fast / always-available layer. Pāṇinian results
  are *additive*.
- **Not a server.** The engine runs entirely client-side (WASM).
  The app stays fully offline-capable.
- **Not synchronous on first call.** The WASM bundle is lazy-loaded
  on first tap; the first call pays the ~80 ms init.

---

## 12. Concrete next steps (after this plan is approved)

In order, each independently mergeable:

- **PR-A**: Adapter scaffold (this commit). Null engine, feature
  flag. No user-visible change.
- **PR-B**: `panini-wasm/` Rust crate + `wasm-pack` build target +
  CI step that produces `public/data/panini/vidyut.wasm`.
- **PR-C**: `vidyut-wasm-engine.ts` adapter implementation. Lazy
  dynamic import. Feature flag still OFF; can be turned on per
  user via a debug toggle.
- **PR-D**: Eval-set scaffolding + `tests/panini/` test suite +
  reviewer harness.
- **PR-E**: Phase 2 (engine ON for compound splitting,
  confidence-gated). Reviewer pass.
- **PR-F**: Popover sūtra-trace rendering + samāsa-class chip.
- **PR-G**: Phase 3 + Phase 4 rollouts as the eval-set numbers
  improve.

Estimated calendar time end-to-end: 3–6 months, depending on the
Rust toolchain bring-up and how fast Vidyut's nominal coverage
matures upstream.

---

## 13. Open questions for the reviewer

1. **Are we OK shipping a 3–5 MB WASM bundle on first word tap?**
   Alternative: defer to a server-side endpoint for the
   Pāṇinian engine, lose the offline guarantee. Strong preference
   here is offline (WASM).
2. **What confidence threshold should gate Pāṇinian results?**
   0.8 is the default in the rollout above. Lowering broadens
   coverage but risks polluting the ranking with iffy derivations.
3. **Do we surface sūtra references to end-users?** A popover
   showing "this analysis is from sūtras 3.1.7 + 6.1.93" is
   pedagogically valuable but visually heavy. Default ON or OFF?
4. **Do we contribute back to Vidyut?** When we find a gap in
   their nominal coverage during validation, do we contribute
   patches or just work around it? Open-source convention
   suggests upstream contribution; needs maintainer time.

---

*Drafted alongside `docs/analysis-rules.md` (current rules) and
`docs/context-meaning-plan.md` (next-layer disambiguation).*
