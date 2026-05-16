/**
 * Bhāṣya-gloss runtime loader.
 *
 * Lazy-fetches the per-text gloss table built by
 * `scripts/extract-bhashya-glosses.ts`. The output is a map from
 * Devanāgarī term → list of {unitId, snippet, rule, score} entries
 * harvested from places where Śaṅkara explicitly defines that term in
 * his commentary (`X इति Y`, `X इत्यर्थः`, `X अर्थात् Y`, …).
 *
 * In the Mīmāṁsā six-pramāṇa stack this is the *Śruti* layer — the
 * bhāṣya defines its own terms, so when we have a match it
 * supersedes anything the dictionary alone can offer. The popover
 * surfaces it above the lexicon hits with a citation chip pointing
 * back at the unit where the gloss occurs.
 *
 * One JSON per text, fetched on first lookup and cached for the
 * lifetime of the page. Files are small (2 KB – 64 KB) and live
 * under the precached PWA static set, so this is offline-safe.
 */
import { asset } from './asset';

export interface GlossEntry {
  unitId: string;
  snippet: string;
  rule: 'iti' | 'ity-arthah' | 'arthat' | 'equals' | 'iti-uchyate';
  score: number;
}

interface GlossFile {
  slug: string;
  generatedAt: string;
  glossesPerTerm: Record<string, GlossEntry[]>;
}

const cache = new Map<string, Promise<GlossFile | null>>();

async function fetchGlosses(slug: string): Promise<GlossFile | null> {
  try {
    const res = await fetch(asset(`data/glosses/${slug}.json`));
    if (!res.ok) return null;
    return (await res.json()) as GlossFile;
  } catch {
    return null;
  }
}

export function loadGlosses(slug: string): Promise<GlossFile | null> {
  let p = cache.get(slug);
  if (!p) {
    p = fetchGlosses(slug);
    cache.set(slug, p);
  }
  return p;
}

/**
 * Look up a Devanāgarī term in the gloss table for the active text.
 * Returns up to `limit` entries, highest-confidence first; the
 * extractor has already capped each list at 10. We try the exact
 * surface, then a coarse stem (drop the final vowel sign) so simple
 * inflectional variants still hit a stored citation.
 */
export async function lookupGlosses(
  slug: string | null | undefined,
  term: string,
  limit = 5,
): Promise<GlossEntry[]> {
  if (!slug || !term) return [];
  const file = await loadGlosses(slug);
  if (!file) return [];
  const direct = file.glossesPerTerm[term];
  if (direct && direct.length) return direct.slice(0, limit);
  // Strip a trailing vowel-sign / virāma (very conservative stem).
  const stem = term.replace(/[ा-्ॢॣ]+$/u, '');
  if (stem !== term && stem.length >= 3) {
    const stemHits = file.glossesPerTerm[stem];
    if (stemHits && stemHits.length) return stemHits.slice(0, limit);
  }
  return [];
}
