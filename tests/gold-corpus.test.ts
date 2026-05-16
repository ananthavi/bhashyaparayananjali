/**
 * Gold-corpus integrity checks.
 *
 * Validates the YAML files under tests/gold/ against the schema
 * documented in tests/gold/SCHEMA.md and docs/authoritative-validation-
 * plan.md §2. These are *infrastructure* checks — they don't yet run
 * the analyser against the entries (that lives in tests/property/).
 *
 * What this catches:
 *   1. Malformed YAML.
 *   2. Reviewer-id references that don't exist in reviewers.yaml.
 *   3. `source` unitIds that don't exist in their text manifest.
 *   4. Schema violations (missing required fields, etc.).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';

interface Reviewer {
  id: string;
  name?: string;
  specialisation: 'vyakarana' | 'vedanta-advaita' | 'bilingual-ml-en';
  affiliation?: string;
  active_since?: string;
}

interface GoldForm {
  form: string;
  source: string;
  lemma: string;
  pos?: string;
  morph?: Record<string, unknown>;
  sutras?: string[];
  notes?: string;
  reviewer?: string;
  reviewed_at?: string;
  unverified?: boolean;
  expect_gap?: boolean;
}

const GOLD_DIR = path.join(process.cwd(), 'tests', 'gold');
const BHASHYA_DIR = path.join(process.cwd(), 'public', 'data', 'bhashya');

function loadYaml<T>(file: string): T {
  return yaml.load(fs.readFileSync(file, 'utf8')) as T;
}

function listGoldFiles(): string[] {
  return fs
    .readdirSync(GOLD_DIR)
    .filter((f) => f.endsWith('.yaml') && f !== 'reviewers.yaml');
}

function loadReviewers(): Reviewer[] {
  return loadYaml<Reviewer[]>(path.join(GOLD_DIR, 'reviewers.yaml')) ?? [];
}

function loadManifestUnitIds(slug: string): Set<string> {
  const ids = new Set<string>();
  const manifestPath = path.join(BHASHYA_DIR, `${slug}.json`);
  if (!fs.existsSync(manifestPath)) return ids;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    chapters?: Array<{ id: string }>;
  };
  for (const ch of manifest.chapters ?? []) {
    const chunkPath = path.join(BHASHYA_DIR, slug, `${ch.id}.json`);
    if (!fs.existsSync(chunkPath)) continue;
    const chunk = JSON.parse(fs.readFileSync(chunkPath, 'utf8')) as {
      chapter: { units: Array<{ id: string }> };
    };
    for (const u of chunk.chapter.units) ids.add(u.id);
  }
  return ids;
}

describe('gold corpus — reviewer registry', () => {
  const reviewers = loadReviewers();

  it('parses', () => {
    expect(Array.isArray(reviewers)).toBe(true);
  });

  it('every reviewer has a kebab-case id', () => {
    for (const r of reviewers) {
      expect(r.id).toMatch(/^[a-z][a-z0-9-]+$/);
    }
  });

  it('reviewer ids are unique', () => {
    const ids = reviewers.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every reviewer has a known specialisation', () => {
    const valid = new Set(['vyakarana', 'vedanta-advaita', 'bilingual-ml-en']);
    for (const r of reviewers) {
      expect(valid.has(r.specialisation)).toBe(true);
    }
  });
});

describe('gold corpus — per-text forms', () => {
  const reviewerIds = new Set(loadReviewers().map((r) => r.id));
  const files = listGoldFiles();

  it('there is at least a schema doc and registry', () => {
    expect(fs.existsSync(path.join(GOLD_DIR, 'SCHEMA.md'))).toBe(true);
    expect(fs.existsSync(path.join(GOLD_DIR, 'reviewers.yaml'))).toBe(true);
  });

  for (const f of files) {
    const slug = f.replace(/\.yaml$/, '');
    describe(`tests/gold/${f}`, () => {
      const forms = loadYaml<GoldForm[]>(path.join(GOLD_DIR, f)) ?? [];
      const unitIds = loadManifestUnitIds(slug);

      it('parses to a list', () => {
        expect(Array.isArray(forms)).toBe(true);
      });

      it('every form has the required fields', () => {
        for (const e of forms) {
          expect(typeof e.form).toBe('string');
          expect(e.form.length).toBeGreaterThan(0);
          expect(typeof e.source).toBe('string');
          expect(typeof e.lemma).toBe('string');
        }
      });

      it('every signed-off form references a known reviewer', () => {
        for (const e of forms) {
          if (e.unverified) continue;
          expect(e.reviewer && reviewerIds.has(e.reviewer)).toBe(true);
        }
      });

      it('every source unitId exists in the manifest', () => {
        if (unitIds.size === 0) return; // text not built yet
        for (const e of forms) {
          expect(unitIds.has(e.source)).toBe(true);
        }
      });
    });
  }
});
