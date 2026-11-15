import Dexie, { type EntityTable } from 'dexie';
import type { Bm, FaviconRow, Folder, Meta, Setting, Tombstone } from './types';

const STORES = {
  bookmarks: 'id, parentId, collectionId, normUrl, dateAdded',
  folders: 'id, parentId, collectionId, depth',
  meta: 'id, updatedAt, *tags',
  tombstones: 'id, deletedAt',
  favicons: 'origin, fetchedAt',
  settings: 'key',
};

/**
 * Folio's local database.
 *
 * `bookmarks` and `folders` are a read model of the browser's bookmark tree and are fully rebuildable;
 * `meta` (tags, notes), `tombstones` and `settings` are user data and must survive upgrades.
 * When a read-model row gains a field, bump the version and clear those two tables in `upgrade`:
 * the background projector refills them from the browser within a second.
 */
export class FolioDB extends Dexie {
  bookmarks!: EntityTable<Bm, 'id'>;
  folders!: EntityTable<Folder, 'id'>;
  meta!: EntityTable<Meta, 'id'>;
  tombstones!: EntityTable<Tombstone, 'id'>;
  favicons!: EntityTable<FaviconRow, 'origin'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor(name = 'folio') {
    super(name);
    this.version(1).stores(STORES);
    // v2 added `pathIds` to bookmark and folder rows (nested-folder support).
    this.version(2)
      .stores(STORES)
      .upgrade((tx) => Promise.all([tx.table('bookmarks').clear(), tx.table('folders').clear()]));
  }
}

/** The shared database instance. */
export const db = new FolioDB();

/** Reads a setting, or `fallback` if it was never set. */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row ? (row.value as T) : fallback;
}

/** Writes a setting. Open pages that use `useSetting` update live. */
export function setSetting(key: string, value: unknown) {
  return db.settings.put({ key, value });
}
