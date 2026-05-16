import { useEffect, useState } from 'react';
import {
  hydrateHeadIndex,
  getBulkMeta,
  BULK_DICT_ORDER,
  BULK_DICT_LABEL,
  type BulkDictId,
  type BulkDictMeta,
} from '@/lib/bulk-dictionary';

/**
 * Read-only status panel for the bundled dictionaries. The full lexicons
 * (Monier-Williams, Apte, Vāchaspatyam, Śabdakalpadruma) are shipped
 * inside the APK and auto-installed into IndexedDB on first launch by
 * `autoInstallBundled()`. This panel just reports what's installed and
 * how big it is — no install / uninstall buttons, since the integration
 * is fully managed.
 */
export function DictionaryManager(): JSX.Element {
  const [metas, setMetas] = useState<Partial<Record<BulkDictId, BulkDictMeta | null>>>({});

  useEffect(() => {
    void (async () => {
      await hydrateHeadIndex();
      const next: Partial<Record<BulkDictId, BulkDictMeta | null>> = {};
      for (const id of BULK_DICT_ORDER) {
        next[id] = await getBulkMeta(id);
      }
      setMetas(next);
    })();
  }, []);

  return (
    <div className="space-y-2">
      {BULK_DICT_ORDER.map((id) => {
        const m = metas[id];
        return (
          <div
            key={id}
            className="surface rounded-lg p-3 flex items-baseline justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="font-medium">{BULK_DICT_LABEL[id]}</div>
              <div className="text-xs opacity-70">
                {id === 'mw' && 'Sanskrit → English (1899)'}
                {id === 'apte' && 'Sanskrit → English (1890)'}
                {id === 'vachaspatyam' && 'Sanskrit → Sanskrit (1873–1884)'}
                {id === 'shabdakalpadruma' && 'Sanskrit → Sanskrit (1828–1858)'}
              </div>
            </div>
            <div className="text-right text-xs opacity-80 whitespace-nowrap">
              {m ? (
                <>
                  <div>{m.entryCount.toLocaleString()} entries</div>
                  <div className="opacity-70">{(m.sizeBytes / 1024 / 1024).toFixed(1)} MB</div>
                </>
              ) : m === null ? (
                <span className="opacity-60">awaiting first launch…</span>
              ) : (
                <span className="opacity-60">checking…</span>
              )}
            </div>
          </div>
        );
      })}
      <p className="text-xs opacity-70 leading-relaxed">
        All four lexicons are public-domain digitizations bundled inside the app.
        On first launch they are loaded into the device's local database; from
        then on every word lookup runs against them entirely offline. Tap any
        Sanskrit word in the reader to see all matches across these sources, plus
        sandhi-viccheda and samāsa-vigraha analyses.
      </p>
    </div>
  );
}
