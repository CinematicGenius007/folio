import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/core/db';
import { rankTags } from '@/lib/core/tags';
import { hostOf } from '@/lib/util/url';

/**
 * Existing tags ranked for completion on a bookmark at `url` (see `rankTags`), live from the read
 * model. For places that do not already hold the whole library, such as the Edit dialog.
 */
export function useRankedTags(url: string): string[] {
  const meta = useLiveQuery(() => db.meta.toArray(), []);
  const bookmarks = useLiveQuery(() => db.bookmarks.toArray(), []);
  return useMemo(() => rankTags(meta ?? [], bookmarks ?? [], hostOf(url)), [meta, bookmarks, url]);
}
