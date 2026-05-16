/**
 * IndexedDB-backed storage for bookmarks and reading positions.
 *
 * Two stores:
 *   - bookmarks: { id, textSlug, unitId, chapterOrdinal, unitOrdinal, label, createdAt }
 *   - positions: { textSlug -> { unitId, scrollY, updatedAt } }
 */

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'bhashya-parayana';
const DB_VERSION = 1;

export interface Bookmark {
  id: string; // `${textSlug}:${unitId}`
  textSlug: string;
  unitId: string;
  chapterOrdinal: number;
  unitOrdinal: number;
  label?: string;
  createdAt: number;
}

export interface ReadingPosition {
  textSlug: string;
  unitId: string;
  scrollRatio: number;
  updatedAt: number;
}

let dbp: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbp) {
    dbp = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('bookmarks')) {
          const s = db.createObjectStore('bookmarks', { keyPath: 'id' });
          s.createIndex('byText', 'textSlug');
          s.createIndex('byCreatedAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains('positions')) {
          db.createObjectStore('positions', { keyPath: 'textSlug' });
        }
      },
    });
  }
  return dbp;
}

export async function addBookmark(b: Omit<Bookmark, 'createdAt'>): Promise<Bookmark> {
  const db = await getDb();
  const entry: Bookmark = { ...b, createdAt: Date.now() };
  await db.put('bookmarks', entry);
  return entry;
}

export async function removeBookmark(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('bookmarks', id);
}

export async function listBookmarks(): Promise<Bookmark[]> {
  const db = await getDb();
  const all = await db.getAll('bookmarks');
  all.sort((a, b) => b.createdAt - a.createdAt);
  return all as Bookmark[];
}

export async function hasBookmark(id: string): Promise<boolean> {
  const db = await getDb();
  return (await db.get('bookmarks', id)) !== undefined;
}

export async function savePosition(p: ReadingPosition): Promise<void> {
  const db = await getDb();
  await db.put('positions', p);
}

export async function loadPosition(textSlug: string): Promise<ReadingPosition | null> {
  const db = await getDb();
  const p = await db.get('positions', textSlug);
  return (p as ReadingPosition | undefined) ?? null;
}

export async function listPositions(): Promise<ReadingPosition[]> {
  const db = await getDb();
  const all = (await db.getAll('positions')) as ReadingPosition[];
  all.sort((a, b) => b.updatedAt - a.updatedAt);
  return all;
}
