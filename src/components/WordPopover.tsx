import { useEffect, useState } from 'react';
import { transliterate } from '@/lib/transliterate';
import type { BhashyaManifest, ScriptCode } from '@/types';
import { describeUnit, describeUnitFallback } from '@/lib/reference';
import { rerankSenses, type RerankedSense } from '@/lib/tradition-rerank';
import type {
  AnalysisReport,
  AnalysisHit,
  BhashyaGlossStep,
  CompoundStep,
  InflectionStep,
  FuzzyStep,
  StepMethod,
} from '@/lib/analysis';

interface Props {
  open: boolean;
  report: AnalysisReport | null;
  loading: boolean;
  script: ScriptCode;
  manifest?: BhashyaManifest | null;
  /** Slug of the active text — feeds the tradition-prior reranker. */
  textSlug?: string | null;
  onClose: () => void;
  onLookup: (devWord: string) => void;
  onJumpToUnit?: (unitId: string) => void;
}

/**
 * Bottom-sheet popover for Sanskrit word analysis. Surfaces the full chain:
 * direct match, inflectional lemma, sandhi-aware compound decomposition.
 * Tapping a part recursively re-runs the analyzer for that part so the user
 * can drill into nested compounds.
 */
export function WordPopover({
  open,
  report,
  loading,
  script,
  manifest,
  textSlug,
  onClose,
  onLookup,
  onJumpToUnit,
}: Props): JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40" aria-hidden />
      <div
        role="dialog"
        aria-label="Word analysis"
        className="relative surface rounded-t-2xl sm:rounded-2xl max-w-md w-full mx-auto max-h-[85vh] overflow-y-auto p-5 shadow-sutra"
        onClick={(e) => e.stopPropagation()}
      >
        <Header report={report} script={script} onClose={onClose} />

        {loading && <div className="mt-4 text-sm opacity-70">Analyzing…</div>}

        {!loading && report && (
          <>
            {report.bhashyaGlosses.length > 0 && (
              <Section title="From the bhāṣya (śruti)">
                <div className="text-xs mb-2 italic opacity-80">
                  Śaṅkara's commentary defines this term explicitly. Tap a
                  citation to jump to the source.
                </div>
                {report.bhashyaGlosses.map((g, i) => (
                  <GlossRow
                    key={'g' + i}
                    gloss={g}
                    manifest={manifest ?? null}
                    onJumpToUnit={onJumpToUnit}
                  />
                ))}
              </Section>
            )}

            {report.direct.length > 0 && (
              <Section title="Direct match">
                {report.direct.map((h, i) => (
                  <HitRow key={'d' + i} hit={h} textSlug={textSlug} />
                ))}
              </Section>
            )}

            {report.inflections.length > 0 && (
              <Section title="Inflection (sandhi-viccheda)">
                {report.inflections.map((step, i) => (
                  <InflectionRow
                    key={'i' + i}
                    step={step}
                    textSlug={textSlug}
                    onLookup={onLookup}
                  />
                ))}
              </Section>
            )}

            {report.compounds.length > 0 && (
              <Section title="Compound (samāsa-vigraha)">
                {report.compounds.map((step, i) => (
                  <CompoundRow
                    key={'c' + i}
                    step={step}
                    textSlug={textSlug}
                    onLookup={onLookup}
                  />
                ))}
              </Section>
            )}

            {report.fuzzy.length > 0 && (
              <Section title="Approximate match (fuzzy)">
                <div
                  className="text-xs mb-2 italic opacity-80"
                  style={{ color: 'var(--accent)' }}
                >
                  No clean rule matched this form; these are nearest-lemma
                  guesses by character overlap. Verify before relying on them.
                </div>
                {report.fuzzy.map((step, i) => (
                  <FuzzyRow
                    key={'f' + i}
                    step={step}
                    textSlug={textSlug}
                    onLookup={onLookup}
                  />
                ))}
              </Section>
            )}

            {!report.resolved && report.normalized && report.bhashyaGlosses.length === 0 && (
              <div className="mt-4 text-sm opacity-80 leading-relaxed">
                The bundled glossary doesn't recognize this form. Try{' '}
                <em>About → Dictionaries</em> to install the full Monier-Williams
                lexicon, which covers ~160 000 head-words and runs the same
                sandhi/compound analysis you see here against a much wider
                vocabulary.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ----- subcomponents ----- */

function Header({
  report,
  script,
  onClose,
}: {
  report: AnalysisReport | null;
  script: ScriptCode;
  onClose: () => void;
}): JSX.Element {
  const word = report?.normalized ?? report?.query ?? '';
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-xs uppercase tracking-wider opacity-70">Word lookup</div>
        <div className="script-devanagari text-2xl mt-0.5">
          {word}
          {script !== 'devanagari' && word && (
            <span className="opacity-70 ml-2 text-base align-middle">
              /{' '}
              <span className={`script-${script}`}>
                {transliterate(word, script)}
              </span>
            </span>
          )}
        </div>
        {word && (
          <div className="iast-text opacity-70 text-sm mt-0.5">
            {transliterate(word, 'iast')}
          </div>
        )}
      </div>
      <button className="btn-ghost btn px-2" onClick={onClose} aria-label="Close">
        ✕
      </button>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="mt-4">
      <div
        className="text-[11px] uppercase tracking-widest opacity-70 mb-2 pb-1 border-b"
        style={{ borderColor: 'var(--rule)' }}
      >
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function sourceBadge(source: AnalysisHit['source']): string {
  switch (source) {
    case 'seed':
      return 'Seed';
    case 'mw':
      return 'MW';
    case 'apte':
      return 'Apte';
    case 'vachaspatyam':
      return 'Vāch.';
    case 'shabdakalpadruma':
      return 'Śabd.';
    case 'manual-table':
      return 'Table';
  }
}

function methodBadge(method?: StepMethod): { label: string; tone: 'rule' | 'manual' | 'fuzzy' } | null {
  switch (method) {
    case 'rule':
      return { label: 'inflection rule', tone: 'rule' };
    case 'sandhi':
      return { label: 'sandhi reversal', tone: 'rule' };
    case 'compound':
      return { label: 'samāsa split', tone: 'rule' };
    case 'manual':
      return { label: 'manual table — not from a Pāṇinian rule', tone: 'manual' };
    case 'fuzzy':
      return { label: 'approximate (n-gram match)', tone: 'fuzzy' };
    case 'exact':
      return null;
    default:
      return null;
  }
}

/**
 * Split a dictionary body into separate senses for visually distinct
 * rendering. Cologne MW / Apte conventions:
 *   - " · " separates main numbered senses
 *   - "<n>" or "(<n>)" markers denote numbered definitions
 *   - "{@<n>@}" was Cologne's homonym marker — already cleaned at
 *     build time
 *   - Sanskrit-Sanskrit dicts (Vāch., Śabd.) use Devanāgarī "।" or
 *     " ·  " between senses too.
 */
function splitMeanings(text: string): string[] {
  if (!text) return [];
  // Primary separator from the build-dict pipeline.
  const primary = text.split(/\s+·\s+/);
  if (primary.length > 1) return primary.map((s) => s.trim()).filter(Boolean);
  // Fall back to numbered-list detection inside one prose blob.
  const numbered = text.split(/\s*(?=\b\d{1,2}\.\s)/);
  if (numbered.length > 1) return numbered.map((s) => s.trim()).filter(Boolean);
  return [text.trim()];
}

const PREVIEW_LIMIT = 240;

function HitRow({
  hit,
  textSlug,
}: {
  hit: AnalysisHit;
  textSlug?: string | null;
}): JSX.Element {
  const { entry, source } = hit;
  const [expanded, setExpanded] = useState(false);
  const fullText = entry.en ?? '';
  const rawSenses = splitMeanings(fullText);
  const reranked: RerankedSense[] = rerankSenses(textSlug, entry.lemma, rawSenses);
  const isLong = fullText.length > PREVIEW_LIMIT;
  const showAll = expanded || reranked.length <= 1 || !isLong;
  const promoted = reranked.length > 0 && reranked[0].score > 0;

  return (
    <div className="text-sm">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="script-devanagari font-semibold text-lg">{entry.lemma}</span>
        {entry.iast && <span className="iast-text opacity-80">{entry.iast}</span>}
        {entry.pos && <span className="chip">{entry.pos}</span>}
        <span className="ml-auto text-[10px] uppercase tracking-wider opacity-60">
          {sourceBadge(source)}
        </span>
      </div>
      {reranked.length > 1 ? (
        <ol className="mt-1.5 space-y-1.5 list-none">
          {reranked.slice(0, showAll ? reranked.length : 2).map((rs, i) => (
            <li
              key={rs.index}
              className="flex gap-2 pl-3 border-l-2"
              style={{
                borderColor:
                  i === 0 && promoted ? 'var(--accent)' : 'var(--rule)',
              }}
            >
              <span
                className="text-[11px] font-semibold opacity-60 leading-relaxed shrink-0"
                style={{ color: 'var(--accent)' }}
              >
                {i + 1}.
              </span>
              <span className="leading-relaxed flex-1">
                {rs.text}
                {i === 0 && promoted && rs.matched && (
                  <span
                    className="ml-1.5 chip text-[10px]"
                    title="Surfaced first by the Advaita-Sringeri tradition prior. See docs/context-meaning-plan.md §4.4."
                  >
                    advaita
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        entry.en && (
          <div className="mt-1 leading-relaxed">
            {showAll ? entry.en : entry.en.slice(0, PREVIEW_LIMIT) + '…'}
          </div>
        )
      )}
      {(reranked.length > 2 || isLong) && (
        <button
          type="button"
          onClick={() => setExpanded((x) => !x)}
          className="mt-2 text-xs underline opacity-80 hover:opacity-100"
        >
          {expanded
            ? 'Show less'
            : reranked.length > 2
              ? `Show all ${reranked.length} senses`
              : 'Show full entry'}
        </button>
      )}
      {entry.ml && (
        <div className="mt-2 script-malayalam" style={{ color: 'var(--accent)' }}>
          {entry.ml}
        </div>
      )}
    </div>
  );
}

function MethodChip({ method }: { method?: StepMethod }): JSX.Element | null {
  const b = methodBadge(method);
  if (!b) return null;
  const cls =
    b.tone === 'manual'
      ? 'bg-amber-200/60 text-amber-900 border border-amber-700/30'
      : b.tone === 'fuzzy'
        ? 'bg-rose-200/60 text-rose-900 border border-rose-700/30'
        : '';
  return (
    <span
      className={`chip text-[10px] ${cls}`}
      title={
        b.tone === 'manual'
          ? "Resolved via the app's hand-coded pronoun/particle table — not derived from a general inflection or sandhi rule."
          : b.tone === 'fuzzy'
            ? 'Approximate match by character n-gram overlap. Treat as a guess.'
            : undefined
      }
    >
      {b.label}
    </span>
  );
}

function InflectionRow({
  step,
  textSlug,
  onLookup,
}: {
  step: InflectionStep;
  textSlug?: string | null;
  onLookup: (s: string) => void;
}): JSX.Element {
  return (
    <div className="text-sm">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="script-devanagari opacity-80">{step.surface}</span>
        <span className="opacity-60">→</span>
        <button
          type="button"
          className="script-devanagari font-semibold text-lg underline-offset-2 hover:underline"
          onClick={() => onLookup(step.lemma)}
          title={'Look up ' + step.lemma}
        >
          {step.lemma}
        </button>
        <span className="chip text-[10px]">{step.label}</span>
        <MethodChip method={step.method} />
        {step.panini?.matched && (
          <span
            className="chip text-[10px]"
            style={{ background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' }}
            title={
              step.panini.sutras.length
                ? `Vidyut re-derived this surface via Pāṇinian rules: ${step.panini.sutras.slice(0, 8).join(' · ')}${step.panini.sutras.length > 8 ? ` … +${step.panini.sutras.length - 8} more` : ''}`
                : 'Vidyut confirmed this derivation.'
            }
          >
            ✓ Pāṇini
          </span>
        )}
      </div>
      {step.panini?.matched && step.panini.sutras.length > 0 && (
        <div className="mt-1 text-[11px] opacity-70 leading-relaxed">
          <span className="font-medium opacity-80">sūtras:</span>{' '}
          {dedupeSutras(step.panini.sutras).slice(0, 6).join(' · ')}
          {step.panini.sutras.length > 6 && ` · +${step.panini.sutras.length - 6}`}
        </div>
      )}
      <div className="mt-1 space-y-2 pl-3 border-l" style={{ borderColor: 'var(--rule)' }}>
        {step.hits.map((h, i) => (
          <HitRow key={i} hit={h} textSlug={textSlug} />
        ))}
      </div>
    </div>
  );
}

function dedupeSutras(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function FuzzyRow({
  step,
  textSlug,
  onLookup,
}: {
  step: FuzzyStep;
  textSlug?: string | null;
  onLookup: (s: string) => void;
}): JSX.Element {
  return (
    <div className="text-sm">
      <div className="flex items-baseline gap-2 flex-wrap">
        <button
          type="button"
          className="script-devanagari font-semibold text-lg underline-offset-2 hover:underline"
          onClick={() => onLookup(step.lemma)}
          title={'Look up ' + step.lemma}
        >
          {step.lemma}
        </button>
        <span className="chip text-[10px]">score {(step.score * 100).toFixed(0)}%</span>
        <MethodChip method="fuzzy" />
      </div>
      <div className="mt-1 space-y-2 pl-3 border-l" style={{ borderColor: 'var(--rule)' }}>
        {step.hits.map((h, i) => (
          <HitRow key={i} hit={h} textSlug={textSlug} />
        ))}
      </div>
    </div>
  );
}

const GLOSS_RULE_LABEL: Record<BhashyaGlossStep['rule'], string> = {
  'iti': 'X iti Y',
  'ity-arthah': 'ity-arthaḥ',
  'arthat': 'arthāt',
  'equals': 'editorial =',
  'iti-uchyate': 'ity-ucyate',
};

function GlossRow({
  gloss,
  manifest,
  onJumpToUnit,
}: {
  gloss: BhashyaGlossStep;
  manifest: BhashyaManifest | null;
  onJumpToUnit?: (unitId: string) => void;
}): JSX.Element {
  const ref = manifest
    ? describeUnit(manifest, gloss.unitId)
    : describeUnitFallback(gloss.unitId);
  const ruleLabel = GLOSS_RULE_LABEL[gloss.rule] ?? gloss.rule;
  const canJump = !!onJumpToUnit;
  return (
    <div className="text-sm">
      <div className="script-devanagari leading-relaxed">{gloss.snippet}</div>
      <div className="mt-1.5 flex items-baseline flex-wrap gap-1.5">
        {canJump ? (
          <button
            type="button"
            className="chip text-[10px] underline-offset-2 hover:underline"
            onClick={() => onJumpToUnit?.(gloss.unitId)}
            title={'Jump to ' + gloss.unitId}
          >
            {ref.short}
          </button>
        ) : (
          <span className="chip text-[10px]">{ref.short}</span>
        )}
        <span className="chip text-[10px]" title={`pattern: ${gloss.rule}`}>
          {ruleLabel}
        </span>
        <span className="text-[10px] opacity-60">
          score {(gloss.score * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

function CompoundRow({
  step,
  textSlug,
  onLookup,
}: {
  step: CompoundStep;
  textSlug?: string | null;
  onLookup: (s: string) => void;
}): JSX.Element {
  return (
    <div className="text-sm">
      <div className="flex flex-wrap items-baseline gap-1.5">
        {step.parts.map((p, i) => (
          <span key={i} className="inline-flex items-baseline gap-1.5">
            {i > 0 && <span className="opacity-50">+</span>}
            <button
              type="button"
              className="script-devanagari text-lg font-semibold underline-offset-2 hover:underline disabled:opacity-50"
              onClick={() => onLookup(p.lemma)}
              disabled={p.hits.length === 0}
              title={p.hits.length ? 'Look up ' + p.lemma : 'No entry for ' + p.part}
            >
              {p.part}
            </button>
          </span>
        ))}
        <MethodChip method="compound" />
      </div>
      <div
        className="mt-2 space-y-2 pl-3 border-l text-sm"
        style={{ borderColor: 'var(--rule)' }}
      >
        {step.parts
          .filter((p) => p.hits.length > 0)
          .map((p, i) => (
            <div key={i}>
              <div className="text-xs opacity-70 mb-0.5 flex items-baseline flex-wrap gap-1.5">
                <span className="script-devanagari font-medium">{p.part}</span>
                {p.lemma !== p.part && (
                  <>
                    <span>→</span>
                    <span className="script-devanagari">{p.lemma}</span>
                  </>
                )}
                {p.label && <span className="chip text-[10px]">{p.label}</span>}
                <MethodChip method={p.method} />
              </div>
              {p.hits.map((h, j) => (
                <HitRow key={j} hit={h} textSlug={textSlug} />
              ))}
            </div>
          ))}
      </div>
      {step.rules.length > 0 && (
        <div className="mt-2 text-[11px] opacity-60">
          sandhi: {step.rules.filter((r) => r !== 'no-sandhi').join(' · ') || 'plain join'}
        </div>
      )}
    </div>
  );
}
