# Plan: making the analysis authoritative — what that can and can't mean

This is a **planning document** that pairs with
`docs/paninian-engine-plan.md` (which engine to build) and
`docs/context-meaning-plan.md` (how to disambiguate sense). Its job
is to define **what "authoritative" means in this app**, the gap
between what's verifiable and what's interpretive, and the concrete
process — gold corpus, reviewer roles, property-based tests,
sign-off cadence — that gets us from "looks plausible" to
"verified by qualified scholars".

Read §1 first. The honest framing matters.

---

## 1. Authoritative for what?

Two things sometimes called "authoritative" need to be separated
sharply, because conflating them is the path to bad faith claims:

### 1.1 Authoritative for *form*

Given a Sanskrit surface form, can we say: "the grammatical analysis
of this word is X, derived from Pāṇini sūtras Y₁ … Yₙ" — and have
that statement be **verifiable**?

**Yes**, this is achievable. It's a finite, testable claim. A
Pāṇinian engine (Vidyut) enumerates the valid analyses; a reviewer
checks them; we ship only the verified set. Sandhi splits, stem +
vibhakti, samāsa class — all of these are formal claims with a
right answer (or a finite set of right answers in ambiguous cases).

This is what the analyser can be authoritative for.

### 1.2 Authoritative for *exegesis*

Given a Sanskrit verse or commentary passage, can we say: "this
passage means X, in the Advaita tradition, in this context"?

**No**, not as a software claim. Exegesis is the bhāṣya's job. The
bhāṣyas — Śaṅkara's commentaries themselves — *are* the
authoritative exegesis of the Upaniṣads / Gītā / Brahma-sūtras in
the Advaita tradition. Sub-commentaries (Ānandagiri, Govindānanda,
Vācaspati Miśra) are the authority on Śaṅkara. The app can:

- **faithfully surface** the bhāṣya's own glosses without
  paraphrase or distortion
- **link** a tapped term to the bhāṣya passage where Śaṅkara
  defines it
- **rank** dictionary senses by lineage prior so the
  Advaita-aligned sense is shown first

But it cannot **be** the exegesis. That's not what software does;
that's what a teacher in a paramparā or a careful reading of the
bhāṣya itself does.

The honest claim we can make:

> Pārāyaṇāñjali surfaces the source text and Śaṅkara's bhāṣya
> verbatim, with form-level analysis verified against a gold
> corpus signed off by qualified Sanskrit scholars. Where the
> bhāṣya glosses a term, the gloss is shown above any
> dictionary entry. Where it doesn't, dictionary entries are
> shown ranked by Advaita-traditional relevance, with the
> reader free to consult the bhāṣya as the primary source.

That's the goal of this plan. Not "the app is authoritative for
exegesis" — it isn't, and shouldn't pretend to be.

---

## 2. The gold corpus

A test corpus that the analyser is measured against. The size,
structure, and review process determine the quality of every
validation claim.

### 2.1 Composition

A target of **2,000 hand-annotated forms** drawn proportionally
from across the 13 bhāṣyas:

| Source proportion | Forms | Rationale |
| --- | --- | --- |
| Bṛhadāraṇyaka, Chāndogya, Brahma-sūtra (large texts) | ~600 each | broadest morphology |
| Gītā | ~200 | well-studied, many cross-references |
| Mandukya + Gauḍapāda kārikās | ~100 | non-trivial sandhi + kārikā kind |
| Other Upaniṣads | ~500 total | shorter, easier to fully cover |

Each entry:

```yaml
- form: "तेषाम्"
  source: "BR_C04_S05_V13"        # exact corpus location
  lemma: "तद्"
  pos: "pronoun"
  morph:
    vibhakti: 6
    vacana: "bahu"
    linga: "m"     # or "n", both valid here
  sutras:                          # key sūtra trace from Vidyut
    - "7.1.52"                     # āmi sarva-nāmnāḥ suṭ
    - "7.3.103"                    # bahuvacane jhalyet
  notes: "M./n. genitive plural; surface form preserves anusvāra"
  reviewer: "rs-001"
  reviewed_at: "2026-04-...."
```

Stored in `tests/gold/<text-slug>.yaml`. CI loads them at test
time and runs every entry through the active analyser.

### 2.2 Selection process

Forms are picked by **stratified random sampling** across:

- Common words (top-N frequency in the text)
- Rare words (frequency 1–2)
- Compounds of varying length and class
- Sandhi-affected forms (visarga, anusvāra, vowel coalescence)
- Pronouns and irregular verbs
- Forms the existing analyser misses (the unresolved tail from
  `npm run dict:coverage`)

This guarantees coverage isn't biased toward forms the analyser
already handles well.

### 2.3 Annotation process

Each form goes through:

1. **First pass**: an importer (script) seeds candidate analyses
   from the Pāṇinian engine.
2. **Second pass**: a reviewer corrects, fills missing fields,
   adds sūtra references where the engine didn't trace.
3. **Adjudication**: when two reviewers disagree, a third
   senior reviewer resolves. Disagreements logged in
   `tests/gold/<text-slug>.adjudication.md`.
4. **Sign-off**: each reviewer's `id` recorded with the entry.

---

## 3. Reviewer roles

Three distinct hats, none optional:

### 3.1 Vyākaraṇa reviewer (form analysis)

A scholar with formal training in Pāṇinian grammar (vyākaraṇa).
Verifies sandhi splits, vibhakti / lakāra / pratyaya analyses,
samāsa classifications, sūtra references. Roughly: a vyākaraṇa-
ācārya, a Sanskrit professor specialising in grammar, or a senior
graduate student under such guidance.

The app already ships forms that this reviewer would *judge as
wrong* in some cases (the existing rule-based analyser is
permissive). The reviewer's role is to catch these and either
correct the entry or open an issue against the analyser.

### 3.2 Vedānta reviewer (exegetical context)

A scholar versed in the Advaita-Vedānta tradition who can verify
that **dictionary-sense ranking** lands the correct Advaita
reading on top, that the **bhāṣya-gloss extractor** is pulling
the right sentences, and that the **lineage-prior tables** match
the Sringeri-Advaita interpretive tradition.

This is *not* a reviewer of "what the verse means" — that's the
bhāṣya. It's a reviewer of: does the app surface the bhāṣya's
own meaning faithfully, in the right rank order?

Sringeri-affiliated reviewer is the natural choice for this
corpus; the same wouldn't apply if we expand to Vaiṣṇava or
Smārta-non-Advaita commentaries in future.

### 3.3 Bilingual reviewer (Malayalam + English)

For when `docs/meanings-plan.md` lands and we surface English /
Malayalam translations: a reviewer fluent in both Sanskrit and
the target language, who can verify the translation faithfully
renders the bhāṣya's gloss without theological drift.

### 3.4 Reviewer registry

`tests/gold/reviewers.yaml`:

```yaml
- id: rs-001
  name: ...
  specialisation: vyākaraṇa
  affiliation: ...
  active_since: 2026-...
- id: rs-002
  specialisation: vedānta-advaita
  ...
```

Every annotated form references a reviewer by id. CI will fail if
an entry references an unknown reviewer or has no reviewer.

---

## 4. Property-based tests

Beyond the gold corpus, automated property tests catch whole
classes of bugs without per-form annotation. These run on every
PR; failures block the merge.

### 4.1 Sandhi forward / reverse round-trip

For each `(left, right)` pair from the gold corpus:

```ts
test('sandhi roundtrip', () => {
  for (const [left, right, joined] of GOLD_SANDHI_PAIRS) {
    expect(forwardSandhi(left, right)).toContain(joined);
    const reverses = reverseSandhi(joined);
    expect(reverses).toContainEqual({ left, right });
  }
});
```

Engine-agnostic: works for both the existing rule-based splitter
and any future Pāṇinian engine.

### 4.2 Inflection generation / parsing round-trip

For each `(lemma, morph, surface)` in the gold corpus:

```ts
test('inflection roundtrip', () => {
  for (const { lemma, morph, surface } of GOLD_FORMS) {
    const generated = engine.inflect(lemma, morph);
    expect(generated).toContain(surface);

    const parsed = engine.analyze(surface);
    expect(parsed.some(a =>
      a.lemma === lemma && morphMatches(a.morph, morph),
    )).toBe(true);
  }
});
```

Strong guarantee: every form the engine *generates* it can also
*parse*, and vice versa.

### 4.3 Compound enumeration completeness

For each compound in the gold corpus, the engine must enumerate
the gold split among its candidates with confidence ≥ τ
(τ defaulted to 0.5; tightened over time):

```ts
test('compound enumeration', () => {
  for (const { compound, splits } of GOLD_COMPOUNDS) {
    const enumerated = engine.split(compound);
    for (const goldSplit of splits) {
      expect(enumerated).toContainEqual(goldSplit);
    }
  }
});
```

### 4.4 Coverage non-regression

`scripts/dict-coverage.ts` produces frequency-weighted resolution
percentages per layer. CI tracks these in
`tests/baselines/coverage.json` and fails when a PR drops any
percentage by more than 1 point.

This catches silent regressions — e.g. a refactor that breaks the
fuzzy fallback would surface as a sudden 16 % → 30 % unresolved
spike.

### 4.5 Dictionary integrity

Already have `tests/search-linking.test.ts` checking that every
search-doc unitId resolves in its manifest. Extending:

- Every gold-corpus form's `source` location actually contains
  the form (regression check against the bhāṣya text itself).
- Every reviewer-id referenced in the gold corpus exists in the
  registry.
- Every bhāṣya-gloss extractor output (when shipped) aligns to a
  real unit.

---

## 5. Sign-off process

Engine versions, gold-corpus changes, and lineage-prior tables
all go through the same flow:

```
1. Author opens a PR with the proposed change.
2. CI runs:
   - All vitest suites
   - Property-based tests
   - Coverage non-regression check
   - Gold-corpus eval (top-1 / top-3 / MRR)
3. Reviewer with the relevant specialisation pulls the PR locally,
   walks the diff, signs off in the PR description with their id.
4. A second reviewer (different person) cross-checks.
5. Merge requires:
   - All CI green
   - 2 reviewer sign-offs
   - No coverage regression
   - For engine-version bumps: explicit reviewer note that the
     gold-corpus eval set was rerun
```

Sign-offs recorded in `tests/gold/signoffs.md` so the audit trail
is permanent.

### 5.1 Engine version bumps

Vidyut releases (or any other engine) update frequently. Each
bump is treated as a substantive change because subtle rule
changes can shift many derivations. Process:

1. Bump the version in `panini-wasm/Cargo.toml`.
2. Rebuild WASM.
3. CI runs the full eval set + property tests.
4. Eval-set diff (forms whose top-1 changed between versions) is
   posted to the PR as a comment.
5. Reviewer walks the diff, accepts or rejects per-form changes.
6. If any acceptance is wrong, the engine version is held back
   and an upstream issue is opened.

### 5.2 Gold-corpus expansion

Adding new forms to the gold corpus follows the same flow but with
the **annotation review** gate (§2.3) instead of the engine review.

---

## 6. What "all possibilities to be handled explicitly" can mean

For form analysis, "all possibilities" is finite and tractable:

- **Sandhi splits**: enumerable. Pāṇinian engine returns every
  valid `(left, right)` pair.
- **Inflectional analyses**: enumerable. Every valid `(lemma,
  vibhakti, vacana, …)` combination.
- **Samāsa classifications**: 6 main classes, finite sub-types.
- **Verb derivations**: 10 lakāras × 3 puruṣa × 3 vacana × pada.

The Pāṇinian engine guarantees enumeration completeness within
its rule coverage. The gold-corpus tests verify that every
documented form actually appears in the engine's enumeration.

For exegesis, "all possibilities" is **not finite**. Different
readings have shaped the tradition for centuries (Bhāmatī vs
Vivaraṇa schools within Advaita itself, Viśiṣṭādvaita vs Dvaita
across schools). The app surfaces:

- Śaṅkara's own bhāṣya (primary)
- Multiple dictionary senses ranked by lineage (secondary)
- Cross-references to passages where the same term recurs
  (tertiary)

The user is presented with the data, not a pre-decided answer.
That's the design choice — not "we know the right meaning", but
"here's everything we can verifiably surface; you read the bhāṣya
and decide".

---

## 7. Phased rollout — making the form analysis authoritative

| Phase | What ships | Authoritativeness gain |
| --- | --- | --- |
| **0** *(today)* | Plan + reviewer registry skeleton | none yet |
| **1** | Gold corpus v1: 200 hand-annotated forms (verifying *existing* rule-based analyser) | Baseline measured |
| **2** | Pāṇinian engine integration (Vidyut, see `docs/paninian-engine-plan.md`) | Form analysis is sūtra-traced |
| **3** | Property-based tests + CI gates | Regressions caught automatically |
| **4** | Reviewer sign-offs on gold corpus + engine version | Form analysis is reviewer-verified |
| **5** | Gold corpus expanded to 2,000 forms across all 13 texts | Form analysis is broadly verified |
| **6** | Bhāṣya-gloss extractor with reviewer pass | Exegetical *surfacing* is verified |
| **7** | Lineage-prior tables with Vedānta-reviewer sign-off | Sense ranking is verified |

Each phase is independent and adds an explicit authoritativeness
claim that can be made publicly. No phase claims more than its
verification gate supports.

---

## 8. What this plan deliberately is NOT

- **Not a claim that the app is authoritative for exegesis.** The
  bhāṣyas are. The app surfaces them faithfully and helps the
  reader find the right passage.
- **Not "trust the engine".** Every engine output flows through
  the gold corpus + reviewer gate before being treated as
  authoritative. An engine that disagrees with a sign-off doesn't
  ship until the conflict is resolved.
- **Not a substitute for tradition.** The lineage-prior tables
  encode the Advaita ordering for our corpus; they don't
  override the bhāṣya's own glosses. When Śaṅkara defines a
  term, his definition wins, period.
- **Not a one-time process.** Reviewer sign-off is per-engine-
  version. Gold-corpus entries are revisited when sūtra coverage
  in the engine changes.

---

## 9. Concrete next steps

In order, after this plan is approved:

- **PR-1**: Reviewer registry + sign-off-tracking infrastructure.
  - `tests/gold/reviewers.yaml` schema + loader.
  - `tests/gold/signoffs.md` initial template.
  - CI integration so missing reviewer-ids fail the build.
- **PR-2**: Gold corpus seed (200 forms drawn from the unresolved
  tail of the existing coverage report). Annotated by an importer
  pass + a single reviewer.
- **PR-3**: Property-based test harness.
  - `tests/property/sandhi-roundtrip.test.ts`
  - `tests/property/inflection-coverage.test.ts`
  - `tests/property/compound-enum.test.ts`
- **PR-4**: Coverage non-regression CI gate
  (`tests/baselines/coverage.json` + comparison check).
- **PR-5**: First Vyākaraṇa-reviewer sign-off pass on the seed
  gold corpus.
- **PR-6**: First Vedānta-reviewer sign-off on the lineage-prior
  table for the most common 100 head-words.

Each PR is independently shippable. The first 5 add infrastructure;
PR-6 is the first time we can publicly claim "verified by a
qualified Vedānta reviewer for the seed terms".

---

## 10. Open questions

1. **Who are the reviewers?** This is the hardest part. The
   plan needs at least one Vyākaraṇa reviewer and one Vedānta
   reviewer to function. Sringeri-affiliated reviewers would be
   the natural choice for this corpus.
2. **Public attribution?** Reviewers signed off — do we list
   them in About? Some scholars prefer anonymity; some prefer
   credit. Default: credit by name + affiliation, opt-out
   available.
3. **Gold-corpus licence.** Created from scratch; should it be
   CC-BY so other Sanskrit projects can reuse?
4. **Reviewer disagreement resolution.** Two-out-of-three is the
   default in §2.3, but for tradition-specific questions (Bhāmatī
   vs Vivaraṇa), the Vedānta-reviewer's call is final. Codify?

---

*Drafted alongside `docs/paninian-engine-plan.md` (the engine
that powers form analysis) and `docs/context-meaning-plan.md`
(how senses are ranked once forms are resolved). Together these
three plans describe the path from today's permissive analyser to
a verifiably authoritative form-analysis pipeline with faithful
exegetical surfacing.*
