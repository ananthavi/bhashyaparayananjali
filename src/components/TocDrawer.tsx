import clsx from 'clsx';
import type { BhashyaManifest, ChapterStub } from '@/types';

interface Props {
  manifest: BhashyaManifest;
  open: boolean;
  onClose: () => void;
  onJump: (unitId: string) => void;
  activeUnitId?: string;
}

/**
 * Slide-in table of contents. Chapters grouped under their parent
 * adhyāya when the source provides that subdivision (Katha, Prashna,
 * Taittiriya, Chandogya, Brihadaranyaka, BSB). Renders directly from
 * the manifest stubs, so it appears immediately without waiting for
 * any chapter chunk to load.
 */
export function TocDrawer({ manifest, open, onClose, onJump, activeUnitId }: Props): JSX.Element {
  const groups = new Map<number | 'flat', { title?: string; chapters: ChapterStub[] }>();
  for (const ch of manifest.chapters) {
    const key = ch.parentOrdinal ?? 'flat';
    const g = groups.get(key) ?? { title: ch.parentTitleSa, chapters: [] };
    g.chapters.push(ch);
    groups.set(key, g);
  }

  return (
    <>
      <div
        className={clsx(
          'fixed inset-0 z-40 transition-opacity',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
        style={{ background: 'rgba(0,0,0,0.35)' }}
        aria-hidden={!open}
      />
      <aside
        className={clsx(
          'fixed left-0 top-0 bottom-0 z-40 w-[min(360px,90vw)] overflow-y-auto transition-transform surface',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        role="dialog"
        aria-label="Table of contents"
        aria-hidden={!open}
      >
        <div className="p-4 border-b" style={{ borderColor: 'var(--rule)' }}>
          <div className="text-xs uppercase opacity-70 tracking-wider">Contents</div>
          <div className="script-devanagari text-lg mt-1">{manifest.titleSa}</div>
          <div className="iast-text opacity-70 text-sm">{manifest.titleIast}</div>
        </div>
        <nav className="p-2 text-sm">
          {[...groups.entries()].map(([key, g]) => (
            <div key={String(key)} className="mb-3">
              {g.title && (
                <div className="px-2 py-1 font-medium script-devanagari text-[color:var(--accent)]">
                  {g.title}
                </div>
              )}
              <ul className="space-y-0.5">
                {g.chapters.map((ch) => (
                  <li key={ch.id}>
                    <div className="px-2 py-1 text-xs uppercase opacity-70 tracking-wider">
                      {ch.titleSa ? (
                        <span className="script-devanagari normal-case">{ch.titleSa}</span>
                      ) : (
                        <>Section {ch.ordinal}</>
                      )}
                    </div>
                    <ul className="grid grid-cols-6 gap-1 px-2">
                      {ch.units.map((u) => {
                        const active = u.id === activeUnitId;
                        if (u.kind === 'intro') {
                          return (
                            <li key={u.id} className="col-span-6">
                              <button
                                className={clsx(
                                  'w-full text-left px-2 py-1 rounded italic opacity-80 text-xs',
                                  active
                                    ? 'bg-[color:var(--accent)] text-[color:var(--bg)]'
                                    : 'hover:bg-[color:var(--surface-2)]',
                                )}
                                onClick={() => onJump(u.id)}
                              >
                                — intro —
                              </button>
                            </li>
                          );
                        }
                        return (
                          <li key={u.id}>
                            <button
                              className={clsx(
                                'w-full text-center px-1 py-1 rounded text-xs',
                                active
                                  ? 'bg-[color:var(--accent)] text-[color:var(--bg)]'
                                  : 'hover:bg-[color:var(--surface-2)]',
                              )}
                              onClick={() => onJump(u.id)}
                              title={u.id}
                            >
                              {u.ordinal}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
