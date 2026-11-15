import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSetting } from '@/lib/core/db';
import { buildIndex } from '@/lib/core/search';
import { buildTree } from '@/lib/core/tree';
import type { Meta } from '@/lib/core/types';

/**
 * The whole read model, live. Pages read bookmarks only through this hook; they never talk to the
 * browser's bookmark API for reads. Cheap enough for tens of thousands of rows.
 */
export function useLibrary() {
  const bookmarks = useLiveQuery(() => db.bookmarks.toArray(), []);
  const folders = useLiveQuery(() => db.folders.toArray(), []);
  const metaRows = useLiveQuery(() => db.meta.toArray(), []);
  const inboxId = useLiveQuery(() => getSetting<string | null>('inboxId', null), [], null);
  const ready = !!bookmarks && !!folders && !!metaRows;

  const meta = useMemo(() => new Map<string, Meta>((metaRows ?? []).map((m) => [m.id, m])), [metaRows]);
  const tree = useMemo(() => buildTree(folders ?? [], bookmarks ?? [], inboxId), [folders, bookmarks, inboxId]);
  const folderById = useMemo(() => new Map((folders ?? []).map((f) => [f.id, f])), [folders]);
  const index = useMemo(() => buildIndex(bookmarks ?? [], meta), [bookmarks, meta]);

  return { ready, bookmarks: bookmarks ?? [], folders: folders ?? [], meta, tree, folderById, index, inboxId };
}

export type Library = ReturnType<typeof useLibrary>;
