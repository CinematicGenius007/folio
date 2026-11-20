import MiniSearch from 'minisearch';
import { parseUrlInput } from '@/lib/util/url';
import type { Bm, Meta } from './types';

export interface Doc {
  id: string;
  title: string;
  url: string;
  tags: string;
  note: string;
  path: string;
}

export function buildIndex(bookmarks: Bm[], meta: Map<string, Meta>) {
  const index = new MiniSearch<Doc>({
    fields: ['title', 'url', 'tags', 'note', 'path'],
    storeFields: [],
    searchOptions: {
      boost: { title: 3, tags: 2, path: 1.5 },
      prefix: true,
      fuzzy: (term) => (term.length > 4 ? 0.2 : false),
      combineWith: 'AND',
    },
    tokenize: (s) =>
      s
        .toLowerCase()
        .split(/[\s/._:?&=#-]+/)
        .filter(Boolean),
  });
  index.addAll(
    bookmarks.map((b) => {
      const m = meta.get(b.id);
      return {
        id: b.id,
        title: b.title,
        url: b.url,
        tags: m?.tags.join(' ') ?? '',
        note: m?.note ?? '',
        path: b.path.join(' '),
      };
    }),
  );
  return index;
}

export function search(index: MiniSearch<Doc>, query: string): string[] {
  const q = query.trim();
  if (!q) return [];
  return index.search(q).map((r) => String(r.id));
}

/** A search box query split into exact tag filters and the words to search for. */
export interface ParsedQuery {
  /** Words for the full-text search, with the tag tokens taken out. */
  text: string;
  /** Lowercase tags a bookmark must all have (`#rust #cli`). Empty when there is no tag filter. */
  tags: string[];
}

/** A whole `#tag` token, with the same characters tags are written with in the Edit dialog. */
const TAG_TOKEN = /^#([\p{L}\p{N}_-]+)$/u;

/**
 * Splits a query into `#tag` filters and plain words. A pasted link is never a filter, even one
 * with a `#fragment`, so it can still be saved. A lone `#` (half-typed tag) is dropped.
 */
export function parseQuery(query: string): ParsedQuery {
  const q = query.trim();
  if (!q || parseUrlInput(q)) return { text: q, tags: [] };
  const tags: string[] = [];
  const words: string[] = [];
  for (const token of q.split(/\s+/)) {
    const tag = TAG_TOKEN.exec(token)?.[1];
    if (tag) tags.push(tag.toLowerCase());
    else if (token !== '#') words.push(token);
  }
  return { text: words.join(' '), tags: [...new Set(tags)] };
}

/** Ids of the bookmarks that carry every one of `tags` (tags in `meta` are lowercase). */
export function taggedIds(meta: Map<string, Meta>, tags: string[]): Set<string> {
  const ids = new Set<string>();
  for (const m of meta.values()) if (tags.every((t) => m.tags.includes(t))) ids.add(m.id);
  return ids;
}
