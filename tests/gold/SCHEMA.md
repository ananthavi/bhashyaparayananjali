# Gold-corpus schema

This directory holds the hand-annotated forms the analyser is
validated against, and the reviewer registry that tracks who signed
off on each entry.

The format is documented in `docs/authoritative-validation-plan.md`
§2 and §3.4. The summary below is the canonical reference; if it ever
diverges from the plan, the plan wins.

## Files

- `reviewers.yaml` — registry of reviewer IDs.
- `<text-slug>.yaml` — annotated forms, one file per bhāṣya
  (`gita.yaml`, `brahma-sutra.yaml`, …). All optional; absent files
  simply mean no forms are signed off for that text yet.

## `reviewers.yaml`

```yaml
- id: <kebab-case, unique>
  name: <human-readable>          # optional
  specialisation: vyakarana | vedanta-advaita | bilingual-ml-en
  affiliation: <free text>
  active_since: YYYY-MM-DD
```

## `<text-slug>.yaml`

```yaml
- form: "तेषाम्"                    # exact Devanāgarī surface form
  source: "BR_C04_S05_V13"          # corpus unit ID, must exist in the manifest
  lemma: "तद्"
  pos: pronoun
  morph:                            # optional; structure depends on pos
    vibhakti: 6
    vacana: bahu
    linga: m                        # m | n | f | mn | mfn
  sutras:                           # optional; trace from a Pāṇinian engine
    - "7.1.52"
  notes: free text
  reviewer: rs-001                  # MUST exist in reviewers.yaml
  reviewed_at: YYYY-MM-DD
  unverified: false                 # default false; true skips reviewer check
  expect_gap: false                 # default false; true marks an entry the
                                    # current analyser is known not to handle
                                    # (e.g. forms that need the Pāṇinian engine).
                                    # Property tests pass on these even when
                                    # the analyser misses them.
```

When a form is added before a reviewer is identified, set
`unverified: true` and leave `reviewer` empty. Such entries do *not*
count toward the 2,000-form sign-off target and the property tests
that require a reviewer signature skip them.

## CI checks (`tests/gold-corpus.test.ts`)

1. Every reviewer entry has a unique `id`.
2. Every `*.yaml` file parses and matches the schema above.
3. Every form's `reviewer` (when set) exists in the registry.
4. Every form's `source` ID appears in the corresponding text
   manifest (`public/data/bhashya/<slug>.json`).

The actual property-based tests (sandhi/inflection round-trip,
compound enumeration completeness) live in `tests/property/`.
