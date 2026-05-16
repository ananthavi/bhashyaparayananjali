# Documentation index

Every markdown in `docs/` is one of two kinds:

- **Operations** — how to build, deploy, install, or sideload.
- **Plans** — designs for future work that need user / reviewer
  sign-off before implementation.

This file tracks the current state of each. When a plan ships,
move it from the Plans section to a "Shipped" entry under
Operations.

---

## Operations

| File | Topic | Status |
| --- | --- | --- |
| [`apk.md`](apk.md) | Android APK build, sideload paths, release-signing | shipped |
| [`ios.md`](ios.md) | iOS IPA build, sideload matrix, signing secrets | shipped |
| [`deploy.md`](deploy.md) | GitHub Pages + Netlify + Cloudflare deploy paths | shipped |
| [`dictionary.md`](dictionary.md) | Bundled lexicon stack, source format, build pipeline | shipped |
| [`analysis-rules.md`](analysis-rules.md) | **Every** rule used by the tap-a-word analyser (inflection, sandhi, samāsa, fuzzy, custom tables) — with worked examples and coverage statistics | shipped |

## Plans (not yet implemented)

| File | What it covers | Status |
| --- | --- | --- |
| [`meanings-plan.md`](meanings-plan.md) | Integrating English + Malayalam translations of every mantra and bhāṣya block. Source candidates by text (Mahādeva Sastri PD, Thibaut PD, Gambhīrānanda copyright, Sringeri ML editions copyright), four-stage validation gate, reader UX with collapsible meaning cards, phased rollout. | shipped (schema + ingestion + reader UI live; auto-derived placeholders for all 2,815 units; real translation files drop into `data-source/meanings/<slug>/`) |
| [`translation-effort-estimate.md`](translation-effort-estimate.md) | Volume measurements (3,069 units · 381K Sanskrit tokens · 3M chars · ~1.15M target English words / ~725K Malayalam), throughput assumptions, three paths (PD ingestion / new commission / licence existing), cost ranges (₹3.5M–8M / $40K–95K hybrid), 18–24 month calendar with a 4–6 person team, risk register, recommended hybrid path. | draft |
| [`context-meaning-plan.md`](context-meaning-plan.md) | Context-aware sense disambiguation for tapped words. Mīmāṁsā six-pramāṇa stack mapped to modern NLP (PMI / sentence embeddings / kāraka tagging / samāsa-vigraha classification), tradition prior tables, bhāṣya-gloss extraction (Śruti), phased rollout, validation eval-set. | partially shipped (Phase 1 bhāṣya-gloss layer + tradition-prior reranker live; PMI / sentence-embedding layers pending) |
| [`paninian-engine-plan.md`](paninian-engine-plan.md) | Full Pāṇinian engine integration. Honest discussion of what "guaranteed correct splits" actually means (engines enumerate; ranking is downstream), survey of Vidyut / Heritage / SL / samsAdhanī, recommendation to integrate Vidyut WASM via an engine-agnostic adapter (already scaffolded under `src/lib/panini/`), bundle / latency / correctness trade-offs, hard validation gates (forward / reverse sandhi round-trip + 2,000-form gold-corpus eval + coverage non-regression + dual reviewer sign-off), phased rollout in 7 PRs over 3–6 months. | shipped (vidyut-prakriya WASM does forward derivation + verifies heuristic guesses with sūtra trace in popover; reverse analysis still on heuristic chain pending vidyut-cheda WASM port) |
| [`authoritative-validation-plan.md`](authoritative-validation-plan.md) | What "authoritative" can and can't mean for a software analyser. Sharp split between authoritative *for form* (enumerable, testable, achievable) and authoritative *for exegesis* (the bhāṣya's job, not ours). Defines a 2,000-form gold corpus structure, three reviewer roles (Vyākaraṇa / Vedānta / Bilingual), property-based tests (sandhi round-trip, inflection round-trip, compound enumeration completeness, coverage non-regression), per-engine-version sign-off process, disagreement resolution. Pairs with the Pāṇinian engine and context-meaning plans. | partially shipped (gold-corpus schema + reviewer registry + property tests + coverage gate live; gold-corpus seeds at 5 entries — needs reviewer onboarding) |

## How to add a new doc

1. Write the markdown under `docs/`.
2. Add a row to the appropriate section above.
3. If it's a plan, mark `status: draft`. Once approved and merged
   into the app, change to `status: shipped` and (optionally) move
   it to the Operations table.

## Cross-references between docs

```
analysis-rules.md ──┐
                    ├──> context-meaning-plan.md   (extends, ranks)
                    ├──> meanings-plan.md          (adds verse meanings)
                    └──> paninian-engine-plan.md   (replaces some layers)

paninian-engine-plan.md ──┬─> requires: src/lib/panini/ adapter (shipped)
                          └─> validation: authoritative-validation-plan.md

authoritative-validation-plan.md ──> applies to: paninian-engine-plan.md,
                                                  meanings-plan.md,
                                                  context-meaning-plan.md
                                     (single validation regime for all
                                      three; reviewer roles defined here)

apk.md ─────────────> docs that depend on it: deploy.md (PWA → APK)
ios.md ─────────────> dependence on: WebKit caveats noted in analysis-rules.md
deploy.md ──────────> base-path config from src/lib/asset.ts
dictionary.md ──────> rule references in analysis-rules.md
```
