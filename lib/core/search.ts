import MiniSearch from 'minisearch';
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
