/**
 * Recent-searches store, backed by localStorage.
 *
 * Keeps the last MAX_HISTORY queries the user actually committed
 * (entered via Enter / submit, NOT every keystroke). Each entry
 * carries the raw text and the chosen text-scope so the dropdown can
 * restore both at once.
 */

const KEY = 'bhashya-search-history-v1';
const MAX_HISTORY = 12;

export interface HistoryEntry {
  query: string;
  scope?: string[]; // text slugs the user had selected at the time, or undefined for "all"
  exactOnly?: boolean;
  ts: number;
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordSearch(entry: Omit<HistoryEntry, 'ts'>): void {
  const trimmed = entry.query.trim();
  if (!trimmed) return;
  const all = loadHistory().filter((e) => e.query !== trimmed);
  all.unshift({ ...entry, query: trimmed, ts: Date.now() });
  if (all.length > MAX_HISTORY) all.length = MAX_HISTORY;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // private mode — drop silently
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function removeFromHistory(query: string): void {
  const all = loadHistory().filter((e) => e.query !== query);
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}
