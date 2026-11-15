import type { FolderNode } from '@/lib/core/tree';
import type { Bm } from '@/lib/core/types';

/** A row in the dashboard list: a subfolder to open, or a bookmark. */
export type Entry = { kind: 'folder'; id: string; node: FolderNode } | { kind: 'bookmark'; id: string; bookmark: Bm };

/** Which folder the dashboard is showing: everything, or one folder by native id. */
export type FolderFilter = 'all' | (string & {});

/** True when a bookmark sits directly in, or anywhere beneath, the folder. */
export function isInFolder(bookmark: Bm, folderId: string): boolean {
  return bookmark.parentId === folderId || bookmark.pathIds.includes(folderId);
}

/** Ids of every bookmark in a folder and its subfolders. */
export function bookmarkIdsIn(bookmarks: Bm[], folderId: string): string[] {
  return bookmarks.filter((b) => isInFolder(b, folderId)).map((b) => b.id);
}

/**
 * Builds the list the dashboard shows.
 *
 * - While searching (`ranking` is the ordered list of matching ids) it lists matches inside the
 *   current folder tree, best first.
 * - In "all" it lists every bookmark, newest first.
 * - In a folder it lists its subfolders, then the bookmarks directly inside it, newest first.
 */
export function buildEntries(opts: {
  bookmarks: Bm[];
  filter: FolderFilter;
  subfolders: FolderNode[];
  ranking: string[] | null;
}): Entry[] {
  const { bookmarks, filter, subfolders, ranking } = opts;
  const toEntry = (bookmark: Bm): Entry => ({ kind: 'bookmark', id: bookmark.id, bookmark });
  const newestFirst = (a: Bm, b: Bm) => b.dateAdded - a.dateAdded;

  if (ranking) {
    const position = new Map(ranking.map((id, i) => [id, i]));
    return bookmarks
      .filter((b) => position.has(b.id) && (filter === 'all' || isInFolder(b, filter)))
      .sort((a, b) => position.get(a.id)! - position.get(b.id)!)
      .map(toEntry);
  }
  if (filter === 'all') return [...bookmarks].sort(newestFirst).map(toEntry);

  const folders = subfolders.map((node): Entry => ({ kind: 'folder', id: node.id, node }));
  const direct = bookmarks
    .filter((b) => b.parentId === filter)
    .sort(newestFirst)
    .map(toEntry);
  return [...folders, ...direct];
}
