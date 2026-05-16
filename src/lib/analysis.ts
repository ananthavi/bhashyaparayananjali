/**
 * Public API tying word-level analysis together. The reader's
 * tap-a-word handler should call `analyzeWord(word)` and render the
 * resulting AnalysisReport.
 *
 * Lookup chain (in order):
 *   1. Exact match in seed or any bundled dictionary.
 *   2. Inflection: hand-coded pronoun table → surface variants
 *      (anusvāra/visarga restoration) → suffix-table rules.
 *   3. Sandhi-revert at every akṣara boundary (via the compound
 *      splitter, which uses the dictionary as oracle).
 *   4. Compound (samāsa) decomposition.
 *   5. Fuzzy nearest-lemma fallback (n-gram Dice coefficient over
 *      every known head). Always returns something for any
 *      reasonably-sized query, marked as `method: 'fuzzy'`.
 *
 * Each step is recorded so the popover can show every layer it tried
 * AND the confidence of the resolution (rule / manual table /
 * approximate).
 */

import { lookup as seedLookup, type DictionaryEntry } from './dictionary';
import { proposeLemmas, type LemmaCandidate } from './sandhi/inflect';
import { splitCompound, type CompoundSplit } from './sandhi/compound';
import {
  isKnownHead,
  lookupBulk,
  allKnownHeads,
  BULK_DICT_ORDER,
  BULK_DICT_LABEL,
  type BulkDictId,
} from './bulk-dictionary';
import { nearestHeads } from './sandhi/fuzzy';
import { lookupGlosses, type GlossEntry } from './glosses';
import { verifyWithEngine, type VerifyResult } from './panini';
import { labelToMorph } from './panini/label-to-morph';

export interface AnalysisHit {
  query: string;
  source: 'seed' | BulkDictId | 'manual-table';
  entry: DictionaryEntry;
}

export type StepMethod = 'exact' | 'rule' | 'manual' | 'sandhi' | 'compound' | 'fuzzy';

export interface InflectionStep {
  surface: string;
  lemma: string;
  label: string;
  method: StepMethod;
  hits: AnalysisHit[];
  /** Set when the Pāṇinian engine successfully re-derived this surface from the lemma. */
  panini?: { matched: boolean; sutras: string[] };
}

export interface CompoundStep {
  parts: Array<{
    part: string;
    lemma: string;
    hits: AnalysisHit[];
    label?: string;
    method?: StepMethod;
  }>;
  rules: string[];
  score: number;
  method: StepMethod;
}

export interface FuzzyStep {
  lemma: string;
  score: number;
  hits: AnalysisHit[];
}

/**
 * A bhāṣya-internal gloss: Śaṅkara has explicitly defined this term
 * somewhere in the commentary on the active text. Surfaced above the
 * dictionary entries because, in the Mīmāṁsā pramāṇa stack, an
 * author's own gloss (Śruti) outranks lexicon evidence.
 */
export interface BhashyaGlossStep {
  unitId: string;
  snippet: string;
  rule: GlossEntry['rule'];
  score: number;
}

export interface AnalyzeContext {
  /** Slug of the active bhāṣya, e.g. `gita`, `brahma-sutra`. */
  textSlug?: string;
}

export interface AnalysisReport {
  query: string;
  normalized: string;
  direct: AnalysisHit[];
  inflections: InflectionStep[];
  compounds: CompoundStep[];
  fuzzy: FuzzyStep[];
  /** Empty unless `analyzeWord` was called with a text-slug context. */
  bhashyaGlosses: BhashyaGlossStep[];
  resolved: boolean;
}

const PUNCT_RE = /[।॥,.;:?!«»"'()\[\]\s]+/g;

export async function analyzeWord(
  rawWord: string,
  ctx: AnalyzeContext = {},
): Promise<AnalysisReport> {
  const normalized = (rawWord ?? '').trim().replace(PUNCT_RE, '');
  const empty: AnalysisReport = {
    query: rawWord,
    normalized,
    direct: [],
    inflections: [],
    compounds: [],
    fuzzy: [],
    bhashyaGlosses: [],
    resolved: false,
  };
  if (!normalized) return empty;

  const direct = await collectHits(normalized);

  const inflections: InflectionStep[] = [];
  const lemmaCandidates: LemmaCandidate[] = proposeLemmas(normalized);
  for (const c of lemmaCandidates) {
    const hits = await collectHits(c.lemma, c.gloss);
    if (hits.length > 0) {
      inflections.push({
        surface: normalized,
        lemma: c.lemma,
        label: c.label,
        method: c.method ?? 'rule',
        hits,
      });
    }
  }
  // Pāṇinian verification — for each candidate, ask the WASM engine
  // to re-derive the surface from the lemma + parsed morphology.
  // When it matches, surface a sūtra trace in the popover.
  await verifyInflections(inflections);

  // Compound analysis runs only if direct + inflection didn't hit.
  let compounds: CompoundStep[] = [];
  const needCompound = direct.length === 0 && inflections.length === 0;
  if (needCompound) {
    const splits = splitCompound(normalized, { isLemma: isKnownHead, maxDepth: 4 });
    const realSplits = splits.filter((s) => s.parts.length > 1 && s.score > 0.5);
    for (const split of realSplits.slice(0, 4)) {
      const step = await annotateSplit(split);
      if (step.parts.some((p) => p.hits.length > 0)) compounds.push(step);
    }
  }

  // Final fuzzy fallback — never empty if we have at least the
  // bundled dicts loaded.
  let fuzzy: FuzzyStep[] = [];
  const stillNothing =
    direct.length === 0 && inflections.length === 0 && compounds.length === 0;
  if (stillNothing && normalized.length >= 2) {
    const nearest = nearestHeads(normalized, allKnownHeads(), 5);
    for (const n of nearest) {
      const hits = await collectHits(n.lemma);
      if (hits.length > 0) fuzzy.push({ lemma: n.lemma, score: n.score, hits });
    }
  }

  // Bhāṣya glosses are looked up against the active text only —
  // outside the reader (e.g. from search results) we have no
  // text-slug context and skip this layer entirely.
  let bhashyaGlosses: BhashyaGlossStep[] = [];
  if (ctx.textSlug) {
    const glossLemmas = new Set<string>([normalized]);
    for (const c of lemmaCandidates) glossLemmas.add(c.lemma);
    const seen = new Set<string>();
    for (const term of glossLemmas) {
      const entries = await lookupGlosses(ctx.textSlug, term, 5);
      for (const e of entries) {
        const key = `${e.unitId}|${e.snippet}`;
        if (seen.has(key)) continue;
        seen.add(key);
        bhashyaGlosses.push({
          unitId: e.unitId,
          snippet: e.snippet,
          rule: e.rule,
          score: e.score,
        });
      }
    }
    bhashyaGlosses.sort((a, b) => b.score - a.score);
    bhashyaGlosses = bhashyaGlosses.slice(0, 6);
  }

  return {
    query: rawWord,
    normalized,
    direct,
    inflections,
    compounds,
    fuzzy,
    bhashyaGlosses,
    resolved:
      direct.length +
        inflections.length +
        compounds.length +
        fuzzy.length +
        bhashyaGlosses.length >
      0,
  };
}

async function collectHits(head: string, fallbackGloss?: string): Promise<AnalysisHit[]> {
  const out: AnalysisHit[] = [];
  // Seed first (always offline, instant).
  const seed = seedLookup(head);
  if (seed.exact) {
    for (const m of seed.matches) out.push({ query: head, source: 'seed', entry: m });
  } else if (seed.matches.length > 0 && seed.lemma === head) {
    for (const m of seed.matches) out.push({ query: head, source: 'seed', entry: m });
  }
  // Bulk dictionaries.
  if (isKnownHead(head)) {
    for (const id of BULK_DICT_ORDER) {
      const e = await lookupBulk(id, head);
      if (!e) continue;
      out.push({
        query: head,
        source: id,
        entry: {
          lemma: head,
          iast: e.iast,
          pos: e.pos,
          en: e.en,
          ml: e.ml,
          source: BULK_DICT_LABEL[id],
        },
      });
    }
  }
  // If nothing else found a definition but the manual table provided
  // a gloss, surface it so the popover always shows something.
  if (out.length === 0 && fallbackGloss) {
    out.push({
      query: head,
      source: 'manual-table',
      entry: {
        lemma: head,
        en: fallbackGloss,
        source: 'Bhāṣya Pārāyaṇa pronoun/particle table',
      },
    });
  }
  return out;
}

async function verifyInflections(steps: InflectionStep[]): Promise<void> {
  // Run verifications in parallel; abort silently if engine isn't loaded.
  const tasks = steps.map(async (step) => {
    const morph = labelToMorph(step.label);
    if (!morph) return;
    let result: VerifyResult | null = null;
    try {
      result = await verifyWithEngine(step.surface, step.lemma, morph);
    } catch {
      return;
    }
    if (result && result.matched) {
      step.panini = { matched: true, sutras: result.sutras };
    }
  });
  await Promise.all(tasks);
}

async function annotateSplit(split: CompoundSplit): Promise<CompoundStep> {
  const parts: CompoundStep['parts'] = [];
  for (const p of split.parts) {
    const hits = await collectHits(p);
    if (hits.length === 0) {
      const lemmas = proposeLemmas(p);
      let added = false;
      for (const lc of lemmas) {
        const lemmaHits = await collectHits(lc.lemma, lc.gloss);
        if (lemmaHits.length > 0) {
          parts.push({
            part: p,
            lemma: lc.lemma,
            hits: lemmaHits,
            label: lc.label,
            method: lc.method ?? 'rule',
          });
          added = true;
          break;
        }
      }
      if (!added) parts.push({ part: p, lemma: p, hits: [] });
    } else {
      parts.push({ part: p, lemma: p, hits, method: 'exact' });
    }
  }
  return {
    parts,
    rules: split.rules,
    score: split.score,
    method: 'compound',
  };
}
