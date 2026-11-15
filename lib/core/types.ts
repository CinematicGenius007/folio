/** Read-model row for one native bookmark. The browser's bookmark tree stays the source of truth. */
export interface Bm {
  id: string; // native bookmark id (per profile)
  parentId: string;
  title: string;
  url: string;
  normUrl: string;
  dateAdded: number;
  index: number;
  /** id of the collection: depth-2 folder ancestor, or the root id when the bookmark sits directly in a root. */
  collectionId: string;
  /** folder titles from the root (excluded) down to the parent folder. */
  path: string[];
  /** folder ids matching `path`; lets a folder view include everything beneath it. */
  pathIds: string[];
}

export interface Folder {
  id: string;
  parentId: string;
  title: string;
  index: number;
  depth: number; // 1 = root (Bookmarks bar...), 2 = collection, 3+ = nested
  collectionId: string;
  path: string[];
  /** ids from the collection down to this folder, inclusive. Roots hold [rootId]. */
  pathIds: string[];
}

/** Folio-only metadata keyed by native bookmark id. Lives in IndexedDB only. */
export interface Meta {
  id: string;
  tags: string[];
  note: string;
  updatedAt: number;
}

export interface Tombstone {
  id: string; // native id at deletion time
  bm: Bm;
  meta?: Meta;
  parentTitle: string;
  deletedAt: number;
}

export interface FaviconRow {
  origin: string;
  blob?: Blob;
  source: 'browser' | 'tab' | 'site' | 'service' | 'none';
  status: 'ok' | 'miss';
  fetchedAt: number;
  needsPlate?: boolean;
}

export interface Setting {
  key: string;
  value: unknown;
}

export const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
