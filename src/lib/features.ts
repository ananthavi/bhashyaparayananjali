/**
 * Compile-time feature flags.
 */
export const FEATURES = {
  voiceEnabled: false as boolean,
  /**
   * When true, the analyser pipeline ensures the Vidyut WASM engine
   * is loaded (lazy on first word-tap) and uses it to verify
   * heuristic guesses against Pāṇinian rules, surfacing sūtra
   * traces in the popover. See `docs/paninian-engine-plan.md`.
   *
   * The engine is built from `panini-wasm/` via wasm-pack and
   * deployed to `public/data/panini/` by the
   * `.github/workflows/build-panini-wasm.yml` workflow.
   */
  paniniEngineEnabled: true as boolean,
} as const;
