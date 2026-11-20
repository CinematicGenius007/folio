import type { FolderNode } from '@/lib/core/tree';
import type { Bm } from '@/lib/core/types';

/** A row in the dashboard list: a subfolder to open, or a bookmark. */
export type Entry = { kind: 'folder'; id: string; node: FolderNode } | { kind: 'bookmark'; id: string; bookmark: Bm };

/** The special view that lists bookmarks saved more than once. */
export const DUPLICATES = 'duplicates';

/**
 * Which folder the dashboard is showing: everything, the duplicates view, or one folder by native id.
 * Native ids are numeric on Chromium and 12-character GUIDs on Firefox, so the names cannot collide.
 */
export type FolderFilter = 'all' | typeof DUPLICATES | (string & {});

/** True when a bookmark sits directly in, or anywhere beneath, the folder. */
export function isInFolder(bookmark: Bm, folderId: string): boolean {
  return bookmark.parentId === folderId || bookmark.pathIds.includes(folderId);
}

/** Ids of every bookmark in a folder and its subfolders. */
export function bookmarkIdsIn(bookmarks: Bm[], folderId: string): string[] {
  return bookmarks.filter((b) => isInFolder(b, folderId)).map((b) => b.id);
}

/**
 * Bookmarks that share a normalised URL (`normUrl`), one array per URL. Each group lists the oldest
 * copy first, so the original reads first and later saves follow; the group with the most recent
 * save comes first. Links with no URL are ignored.
 */
export function duplicateGroups(bookmarks: Bm[]): Bm[][] {
  const byUrl = new Map<string, Bm[]>();
  for (const b of bookmarks) {
    if (!b.normUrl) continue;
    const group = byUrl.get(b.normUrl);
    if (group) group.push(b);
    else byUrl.set(b.normUrl, [b]);
  }
  const newest = (group: Bm[]) => Math.max(...group.map((b) => b.dateAdded));
  return [...byUrl.values()]
    .filter((group) => group.length > 1)
    .map((group) => group.sort((a, b) => a.dateAdded - b.dateAdded || a.id.localeCompare(b.id)))
    .sort((a, b) => newest(b) - newest(a) || a[0]!.normUrl.localeCompare(b[0]!.normUrl));
}

/**
 * Builds the list the dashboard shows.
 *
 * - While searching (`ranking` is the ordered list of matching ids) it lists matches inside the
 *   current folder tree, best first.
 * - In "all" it lists every bookmark, newest first.
 * - In a folder it lists its subfolders, then the bookmarks directly inside it, newest first.
 * - With a tag filter (`tagged`, the ids that carry the tags) it keeps only those bookmarks; with no
 *   words to rank by, it lists every tagged bookmark in the folder tree, newest first.
 * - In the duplicates view it lists each group of copies together (see {@link duplicateGroups}),
 *   narrowed by the search and tags but never reordered, so copies stay side by side.
 */
export function buildEntries(opts: {
  bookmarks: Bm[];
  filter: FolderFilter;
  subfolders: FolderNode[];
  ranking: string[] | null;
  tagged?: Set<string> | null;
}): Entry[] {
  const { bookmarks, filter, subfolders, ranking, tagged } = opts;
  const toEntry = (bookmark: Bm): Entry => ({ kind: 'bookmark', id: bookmark.id, bookmark });
  const newestFirst = (a: Bm, b: Bm) => b.dateAdded - a.dateAdded;
  const position = ranking && new Map(ranking.map((id, i) => [id, i]));
  const matches = (b: Bm) => (!position || position.has(b.id)) && (!tagged || tagged.has(b.id));

  if (filter === DUPLICATES) return duplicateGroups(bookmarks).flat().filter(matches).map(toEntry);
  const inScope = (b: Bm) => filter === 'all' || isInFolder(b, filter);

  if (position) {
    return bookmarks
      .filter((b) => matches(b) && inScope(b))
      .sort((a, b) => position.get(a.id)! - position.get(b.id)!)
      .map(toEntry);
  }
  if (tagged)
    return bookmarks
      .filter((b) => matches(b) && inScope(b))
      .sort(newestFirst)
      .map(toEntry);
  if (filter === 'all') return [...bookmarks].sort(newestFirst).map(toEntry);

  const folders = subfolders.map((node): Entry => ({ kind: 'folder', id: node.id, node }));
  const direct = bookmarks
    .filter((b) => b.parentId === filter)
    .sort(newestFirst)
    .map(toEntry);
  return [...folders, ...direct];
}

/** The two lines an empty list shows. */
export interface EmptyMessage {
  title: string;
  hint: string;
}

/**
 * What to say when the list is empty, from most to least specific: a tag filter, a search, the
 * duplicates view, the Inbox, a folder, everything.
 */
export function emptyMessage(opts: {
  /** Tags filtered by, and whether any bookmark anywhere carries them all. */
  tags: string[];
  tagsExist: boolean;
  /** Words searched for besides the tags. */
  text: string;
  filter: FolderFilter;
  isInbox: boolean;
}): EmptyMessage {
  const { tags, tagsExist, text, filter, isInbox } = opts;
  if (tags.length && !text) {
    const title = `No bookmarks tagged ${tags.map((t) => `#${t}`).join(' ')}`;
    if (tagsExist && filter !== 'all') return { title: `${title} here`, hint: 'Switch to All bookmarks to see them.' };
    return { title, hint: 'Add tags to a bookmark with E.' };
  }
  if (text || tags.length) return { title: 'Nothing matches', hint: 'Try fewer words, or paste a link to save it.' };
  if (filter === DUPLICATES) return { title: 'No duplicates', hint: 'Every link is saved once.' };
  if (isInbox) return { title: 'Your Inbox is clear', hint: 'Pages saved without a folder land here.' };
  if (filter !== 'all') return { title: 'This folder is empty', hint: 'Press Alt+S on any page to save it.' };
  return { title: 'Nothing here yet', hint: 'Press Alt+S on any page to save it.' };
}
