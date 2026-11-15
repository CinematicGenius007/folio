import type { FolioDB } from './db';
import { normalizeUrl } from '@/lib/util/url';
import { TOMBSTONE_TTL_MS, type Bm, type Folder, type Tombstone } from './types';

export interface TreeNode {
  id: string;
  parentId?: string;
  index?: number;
  title: string;
  url?: string;
  dateAdded?: number;
  children?: TreeNode[];
}

export interface Flat {
  bookmarks: Bm[];
  folders: Folder[];
}

/** Flatten the native tree. Children of the tree root are "roots" (depth 1). */
export function flatten(tree: TreeNode[]): Flat {
  const bookmarks: Bm[] = [];
  const folders: Folder[] = [];
  const top = tree[0];
  if (!top) return { bookmarks, folders };

  const walk = (node: TreeNode, depth: number, collectionId: string, path: string[], pathIds: string[]) => {
    for (const child of node.children ?? []) {
      if (child.url !== undefined && child.children === undefined) {
        bookmarks.push({
          id: child.id,
          parentId: node.id,
          title: child.title || child.url,
          url: child.url,
          normUrl: normalizeUrl(child.url),
          dateAdded: child.dateAdded ?? 0,
          index: child.index ?? 0,
          collectionId,
          path,
          pathIds,
        });
      } else {
        const childDepth = depth + 1;
        const childCollection = childDepth === 2 ? child.id : collectionId;
        const childPath = childDepth >= 2 ? [...path, child.title] : path;
        const childPathIds = childDepth >= 2 ? [...pathIds, child.id] : pathIds;
        folders.push({
          id: child.id,
          parentId: node.id,
          title: child.title,
          index: child.index ?? 0,
          depth: childDepth,
          collectionId: childCollection,
          path: childPath,
          pathIds: childPathIds,
        });
        walk(child, childDepth, childCollection, childPath, childPathIds);
      }
    }
  };

  for (const root of top.children ?? []) {
    folders.push({
      id: root.id,
      parentId: top.id,
      title: root.title,
      index: root.index ?? 0,
      depth: 1,
      collectionId: root.id,
      path: [],
      pathIds: [root.id],
    });
    walk(root, 1, root.id, [], []);
  }
  return { bookmarks, folders };
}

const sameBm = (a: Bm, b: Bm) =>
  a.parentId === b.parentId &&
  a.title === b.title &&
  a.url === b.url &&
  a.index === b.index &&
  a.collectionId === b.collectionId &&
  a.dateAdded === b.dateAdded &&
  a.path.join('\u0000') === b.path.join('\u0000') &&
  (a.pathIds ?? []).join('\u0000') === b.pathIds.join('\u0000');

const sameFolder = (a: Folder, b: Folder) =>
  a.parentId === b.parentId &&
  a.title === b.title &&
  a.index === b.index &&
  a.depth === b.depth &&
  a.collectionId === b.collectionId &&
  a.path.join('\u0000') === b.path.join('\u0000') &&
  (a.pathIds ?? []).join('\u0000') === b.pathIds.join('\u0000');

/**
 * Make the read model match the native tree. Writes only rows that changed.
 * Bookmarks that vanished get a tombstone (with their metadata) so deletes can be undone.
 * This is the only function that writes bookmarks/folders.
 */
export async function syncReadModel(db: FolioDB, tree: TreeNode[], now = Date.now()) {
  const flat = flatten(tree);
  await db.transaction('rw', db.bookmarks, db.folders, db.meta, db.tombstones, async () => {
    const [oldBms, oldFolders] = await Promise.all([db.bookmarks.toArray(), db.folders.toArray()]);

    const oldBmMap = new Map(oldBms.map((b) => [b.id, b]));
    const newBmIds = new Set(flat.bookmarks.map((b) => b.id));
    const bmPut = flat.bookmarks.filter((b) => {
      const old = oldBmMap.get(b.id);
      return !old || !sameBm(old, b);
    });
    const removed = oldBms.filter((b) => !newBmIds.has(b.id));

    if (removed.length) {
      const folderTitle = new Map(oldFolders.map((f) => [f.id, f.title]));
      const metas = await db.meta.bulkGet(removed.map((b) => b.id));
      const stones: Tombstone[] = removed.map((bm, i) => ({
        id: bm.id,
        bm,
        meta: metas[i],
        parentTitle: folderTitle.get(bm.parentId) ?? '',
        deletedAt: now,
      }));
      await db.tombstones.bulkPut(stones);
      await db.bookmarks.bulkDelete(removed.map((b) => b.id));
      await db.meta.bulkDelete(removed.map((b) => b.id));
    }
    if (bmPut.length) await db.bookmarks.bulkPut(bmPut);

    const oldFolderMap = new Map(oldFolders.map((f) => [f.id, f]));
    const newFolderIds = new Set(flat.folders.map((f) => f.id));
    const folderPut = flat.folders.filter((f) => {
      const old = oldFolderMap.get(f.id);
      return !old || !sameFolder(old, f);
    });
    const folderDel = oldFolders.filter((f) => !newFolderIds.has(f.id)).map((f) => f.id);
    if (folderDel.length) await db.folders.bulkDelete(folderDel);
    if (folderPut.length) await db.folders.bulkPut(folderPut);

    await db.tombstones
      .where('deletedAt')
      .below(now - TOMBSTONE_TTL_MS)
      .delete();
  });
}
