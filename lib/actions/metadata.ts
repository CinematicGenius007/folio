import { db } from '@/lib/core/db';
import type { Meta } from '@/lib/core/types';

/**
 * Splits free text such as `read later #rust #Docs` into the plain note and a
 * de-duplicated, lower-cased tag list. A tag is `#` followed by letters, digits, `_` or `-`.
 */
export function parseTags(input: string): { text: string; tags: string[] } {
  const tags: string[] = [];
  const text = input
    .replace(/(^|\s)#([\p{L}\p{N}_-]+)/gu, (_match, _lead, tag: string) => {
      tags.push(tag.toLowerCase());
      return ' ';
    })
    .replace(/\s+/g, ' ')
    .trim();
  return { text, tags: [...new Set(tags)] };
}

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
