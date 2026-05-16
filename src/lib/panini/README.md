# Pāṇinian engine adapter

Engine-agnostic facade for plugging a real Pāṇinian engine into the
analyser. The current implementation is `null-engine.ts` — a no-op
that lets the existing rule-based analyser do all the work.

## Adding an engine

Implement the `PaniniEngine` interface in `<name>-engine.ts`:

```ts
import type { PaniniEngine, PaniniAnalysis, Morphology } from './types';

export const myEngine: PaniniEngine = {
  name: 'my-engine@0.1',
  available: true,
  async analyze(word) { /* return PaniniAnalysis[] */ },
  async segment(utterance) { /* return string[][] */ },
  async inflect(lemma, morph) { /* return string[] */ },
};
```

Then update `index.ts` to choose your engine when
`FEATURES.paniniEngineEnabled` is on:

```ts
import { myEngine } from './my-engine';

function selectEngine(): PaniniEngine {
  if (!FEATURES.paniniEngineEnabled) return nullEngine;
  return myEngine.available ? myEngine : nullEngine;
}
```

## Plumbing

`src/lib/analysis.ts` consults `getEngine()` after the existing
layers. Pāṇinian results are merged with the rule-based candidates
and ranked by confidence. The orchestrator deduplicates by
`(lemma, morph)` so a Pāṇinian-derived candidate that matches a
rule-based one collapses to a single entry, with the engine name
recorded in the provenance trail.

## See also

- `docs/paninian-engine-plan.md` — the full design plan including
  Vidyut integration path, validation gate, and phased rollout.
- `docs/analysis-rules.md` — the existing rule-based layers that
  this engine will eventually augment.
- `src/lib/features.ts` — the feature flag.
