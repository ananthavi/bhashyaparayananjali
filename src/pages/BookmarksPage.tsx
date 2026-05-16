import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listBookmarks, removeBookmark, type Bookmark } from '@/lib/storage';
import { loadCatalog, loadManifest } from '@/lib/loader';
import type { Catalog, BhashyaManifest } from '@/types';
import { describeUnit, describeUnitFallback } from '@/lib/reference';

export function BookmarksPage(): JSX.Element {
  const [items, setItems] = useState<Bookmark[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [manifests, setManifests] = useState<Map<string, BhashyaManifest>>(
    () => new Map(),
  );

  useEffect(() => {
    void refresh();
    loadCatalog().then(setCatalog).catch(() => null);
  }, []);

  // Load manifests for every bookmarked text so we can decode the
  // unit ids into proper Sanskrit references like "अध्याय 4 · ब्राह्मण 5 · मन्त्र 13".
  useEffect(() => {
    const slugs = [...new Set(items.map((b) => b.textSlug))];
    let alive = true;
    Promise.all(
      slugs.map(async (slug) => {
        const m = await loadManifest(slug).catch(() => null);
        return [slug, m] as const;
      }),
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
  }, [items]);

  async function refresh(): Promise<void> {
    setItems(await listBookmarks());
  }

  return (
    <div className="py-4 space-y-3">
      <h1 className="text-lg font-medium">Bookmarks</h1>
      {items.length === 0 ? (
        <div className="opacity-70 text-sm">
          No bookmarks yet. Tap the ☆ icon on any mantra to save it here.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((b) => {
            const title = catalog?.texts.find((t) => t.slug === b.textSlug);
            const m = manifests.get(b.textSlug);
            const ref = m ? describeUnit(m, b.unitId) : describeUnitFallback(b.unitId);
            return (
              <li key={b.id}>
                <div className="surface rounded-lg p-3 flex items-start gap-3">
                  <Link to={`/read/${b.textSlug}#${b.unitId}`} className="grow min-w-0">
                    <div className="script-devanagari text-sm font-medium truncate">
                      {title?.titleSa ?? b.textSlug}
                    </div>
                    <div className="text-xs opacity-80 mt-0.5 script-devanagari">
                      {ref.short}
                    </div>
                    {ref.parentFull || ref.chapterFull ? (
                      <div className="text-[11px] opacity-60 mt-0.5 script-devanagari">
                        {[ref.parentFull, ref.chapterFull].filter(Boolean).join(' · ')}
                      </div>
                    ) : null}
                    {b.label && (
                      <div className="script-devanagari text-sm mt-1 line-clamp-2">
                        {b.label}
                      </div>
                    )}
                  </Link>
                  <button
                    className="btn-ghost btn px-2"
                    aria-label="Delete bookmark"
                    onClick={async () => {
                      await removeBookmark(b.id);
                      void refresh();
                    }}
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
