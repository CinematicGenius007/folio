import { db } from '@/lib/core/db';
import type { Meta } from '@/lib/core/types';

export { formatNote, parseTags } from '@/lib/core/tags';

/**
 * Writes Folio-only metadata (tags, note) for a bookmark. Fields left out of `patch` keep their
 * current value, and a row with neither tags nor note is deleted instead of stored empty.
 */
export async function setMeta(id: string, patch: Partial<Pick<Meta, 'tags' | 'note'>>): Promise<void> {
  const current = await db.meta.get(id);
  const next: Meta = {
    id,
    tags: patch.tags ?? current?.tags ?? [],
    note: patch.note ?? current?.note ?? '',
    updatedAt: Date.now(),
  };
  if (!next.tags.length && !next.note) await db.meta.delete(id);
  else await db.meta.put(next);
}
