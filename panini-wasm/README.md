# panini-wasm

Rust → WASM shim that the JS adapter under `src/lib/panini/` calls
into. Today it's a stub — every operation returns an empty result —
and exists so the build pipeline (Rust toolchain → `wasm-pack` →
artifact copy → service-worker precache) can be exercised before the
heavy Vidyut data dependency lands.

The full design is in `docs/paninian-engine-plan.md`. The validation
regime (gold corpus, property tests, reviewer sign-off) is in
`docs/authoritative-validation-plan.md`.

## Local build

```sh
# One-time
rustup target add wasm32-unknown-unknown
cargo install wasm-pack

# Each rebuild
cd panini-wasm
wasm-pack build --target web --release --out-dir ../public/data/panini
```

After the build, `public/data/panini/` contains:

- `panini_wasm.js`  — JS shim loaded by the adapter
- `panini_wasm_bg.wasm` — the actual binary
- `package.json` (used only by tooling; we don't publish to npm)

The vite-PWA precache picks these up automatically.

## Wiring Vidyut (next PR)

1. Uncomment the `vidyut-*` deps in `Cargo.toml`.
2. Replace each stub function in `src/lib.rs` with calls into the
   appropriate Vidyut crate. Match the JSON shapes documented in
   `src/lib/panini/types.ts`.
3. Run the gold-corpus tests (`tests/property/`); update the
   baseline (`tests/baselines/coverage.json`) only if every layer
   improves or holds.
4. Reviewer sign-off per `docs/authoritative-validation-plan.md` §5.1.

## CI

A GitHub Actions workflow at `.github/workflows/build-panini-wasm.yml`
builds on Linux and uploads the resulting WASM as an artifact. The
release builds (APK, IPA) consume that artifact.
