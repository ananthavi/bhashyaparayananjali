import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import type { Catalog, CatalogEntry } from '@/types';
import { loadCatalog, loadManifest } from '@/lib/loader';
import { listPositions, type ReadingPosition } from '@/lib/storage';
import { usePrefs } from '@/state/store';
import { transliterate } from '@/lib/transliterate';
import { describeUnit, describeUnitFallback } from '@/lib/reference';
import type { BhashyaManifest } from '@/types';
import { asset } from '@/lib/asset';

/**
 * Home screen. Three sections:
 *   1. Continue reading (if the user has positions saved)
 *   2. Upanishad bhashyas (11 texts)
 *   3. Gita + Brahma-sutra bhashyas
 */
export function LibraryPage(): JSX.Element {
  const prefs = usePrefs();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [positions, setPositions] = useState<ReadingPosition[]>([]);
  const [manifests, setManifests] = useState<Map<string, BhashyaManifest>>(
    () => new Map(),
  );

  useEffect(() => {
    loadCatalog().then(setCatalog).catch(() => null);
    listPositions().then(setPositions).catch(() => []);
  }, []);

  const groups = useMemo(() => groupEntries(catalog?.texts ?? []), [catalog]);
  const resumable = useMemo(() => {
    if (!catalog) return [];
    const byId = new Map(catalog.texts.map((t) => [t.slug, t]));
    return positions
      .map((p) => ({ pos: p, entry: byId.get(p.textSlug) }))
      .filter((x): x is { pos: ReadingPosition; entry: CatalogEntry } => !!x.entry)
      .slice(0, 4);
  }, [positions, catalog]);

  // Pre-load manifests for the resumable cards so we can show a proper
  // "अध्याय N · …" reference instead of the cryptic ID.
  useEffect(() => {
    let alive = true;
    Promise.all(
      resumable.map(async ({ entry }) => [entry.slug, await loadManifest(entry.slug).catch(() => null)] as const),
    ).then((pairs) => {
      if (!alive) return;
      setManifests((prev) => {
        const next = new Map(prev);
        for (const [slug, m] of pairs) if (m) next.set(slug, m);
        return next;
      });
    });
    return () => {
      alive = false;
    };
  }, [resumable]);

  return (
    <div className="space-y-8 py-2">
      <section className="text-center pt-2 pb-4">
        <div className="flex items-end justify-center gap-3 sm:gap-6 mb-3">
          <img
            src={asset('images/advaita/shankara.png')}
            alt="Adi Shankaracharya"
            className="h-24 sm:h-32 w-auto opacity-95 drop-shadow-sm"
            loading="eager"
          />
          <div className="pb-2">
            <div className="script-devanagari text-xs sm:text-sm opacity-80 mantra-emphasis">
              श्रीमच्छङ्करभगवत्पूज्यपादविरचितानि
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight">
              <span className="script-devanagari mantra-emphasis">प्रस्थानत्रयीभाष्याणि</span>
            </h1>
            <div className="iast-text opacity-70 text-xs sm:text-sm mt-0.5">
              Prasthāna-trayī-bhāṣyāṇi
            </div>
          </div>
          <img
            src={asset('images/advaita/sharada.png')}
            alt="Sri Sharada"
            className="h-24 sm:h-32 w-auto opacity-95 drop-shadow-sm"
            loading="eager"
          />
        </div>
        <p className="mt-2 opacity-80 text-sm sm:text-base px-3">
          Adi Shankaracharya's thirteen commentaries on the Upaniṣads, the Bhagavad Gītā, and the
          Brahmasūtras — fully offline, in thirteen scripts.
        </p>
        <div className="mt-3 inline-flex items-center gap-2 text-xs opacity-80 surface rounded-full px-3 py-1">
          <img
            src={asset('images/advaita/logo-circle.png')}
            alt=""
            aria-hidden
            className="h-5 w-5"
          />
          <span>
            Inspired by and based on{' '}
            <a
              href="https://advaitasharada.sringeri.net/"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Advaita Sharada
            </a>
            , Dakṣiṇāmnāya Śrī Śāradā Pīṭham, Śṛṅgerī
          </span>
        </div>
      </section>

      {resumable.length > 0 && (
        <section>
          <SectionHeading>Continue reading</SectionHeading>
          <div className="grid sm:grid-cols-2 gap-3">
            {resumable.map(({ pos, entry }) => {
              const m = manifests.get(entry.slug);
              const ref = m
                ? describeUnit(m, pos.unitId)
                : describeUnitFallback(pos.unitId);
              return (
                <Link
                  key={pos.textSlug}
                  to={`/read/${entry.slug}#${pos.unitId}`}
                  className="surface rounded-xl p-4 hover:bg-[color:var(--surface-2)] transition-colors"
                >
                  <div className="script-devanagari text-lg">{entry.titleSa}</div>
                  <div className="iast-text text-xs opacity-70 mt-0.5">{entry.titleIast}</div>
                  <div className="text-xs mt-2 opacity-80 script-devanagari">
                    {ref.short}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {(['upanishad', 'gita', 'brahma-sutra'] as const).map((g) => {
        const list = groups[g];
        if (!list || list.length === 0) return null;
        return (
          <section key={g}>
            <SectionHeading>{groupTitle(g)}</SectionHeading>
            <div className="grid sm:grid-cols-2 gap-3">
              {list.map((entry) => (
                <TextCard key={entry.slug} entry={entry} script={prefs.script} />
              ))}
            </div>
          </section>
        );
      })}

      {!catalog && (
        <div className="opacity-70 text-sm text-center py-12">Loading catalog…</div>
      )}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <h2 className="text-sm uppercase tracking-widest opacity-70 mb-3 px-1">{children}</h2>
  );
}

function TextCard({ entry, script }: { entry: CatalogEntry; script: string }): JSX.Element {
  const displayScript = script as Parameters<typeof transliterate>[1];
  return (
    <Link
      to={`/read/${entry.slug}`}
      className={clsx(
        'surface rounded-xl p-4 transition-colors',
        'hover:bg-[color:var(--surface-2)] focus:bg-[color:var(--surface-2)]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="script-devanagari text-lg leading-tight">{entry.titleSa}</div>
          {displayScript !== 'devanagari' && (
            <div
              className={clsx(
                `script-${displayScript}`,
                'text-sm opacity-90 mt-0.5',
              )}
            >
              {transliterate(entry.titleSa, displayScript)}
            </div>
          )}
          <div className="iast-text text-xs opacity-70 mt-0.5">{entry.titleIast}</div>
          <div className="text-xs opacity-70 mt-2">{entry.titleEn}</div>
        </div>
        <div className="text-right text-xs opacity-80 shrink-0">
          <div>{entry.counts.chapters} ch</div>
          <div className="mt-1">{entry.counts.mantras} units</div>
          <div className="mt-1 opacity-70">
            {(entry.sizeBytes / 1024).toFixed(0)} KB
          </div>
        </div>
      </div>
    </Link>
  );
}

function groupEntries(
  entries: CatalogEntry[],
): Record<CatalogEntry['group'], CatalogEntry[]> {
  const out: Record<CatalogEntry['group'], CatalogEntry[]> = {
    upanishad: [],
    gita: [],
    'brahma-sutra': [],
  };
  for (const e of entries) out[e.group].push(e);
  return out;
}

function groupTitle(g: CatalogEntry['group']): string {
  switch (g) {
    case 'upanishad':
      return 'Upaniṣad Bhāṣyas';
    case 'gita':
      return 'Bhagavad Gītā Bhāṣya';
    case 'brahma-sutra':
      return 'Brahma Sūtra Bhāṣya';
  }
}
