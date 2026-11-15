import { describe, expect, it } from 'vitest';
import type { FolderNode } from '@/lib/core/tree';
import type { Bm } from '@/lib/core/types';
import { bookmarkIdsIn, buildEntries, isInFolder } from './entries';

const bm = (id: string, parentId: string, pathIds: string[], dateAdded: number): Bm => ({
  id,
  parentId,
  title: id,
  url: `https://${id}.dev/`,
  normUrl: `https://${id}.dev`,
  dateAdded,
  index: 0,
  collectionId: pathIds[0] ?? parentId,
  path: [],
  pathIds,
});

const node = (id: string): FolderNode => ({
  id,
  title: id,
  depth: 3,
  parentId: 'c',
  isRoot: false,
  count: 0,
  direct: 0,
  color: 'blue',
  children: [],
});

const bookmarks = [
  bm('old', 'c', ['c'], 1),
  bm('new', 'c', ['c'], 3),
  bm('deep', 'p', ['c', 'p'], 2),
  bm('other', 'z', ['z'], 4),
];

const ids = (entries: ReturnType<typeof buildEntries>) => entries.map((e) => e.id);

describe('isInFolder', () => {
  it('matches direct children and descendants', () => {
    expect(isInFolder(bookmarks[0]!, 'c')).toBe(true);
    expect(isInFolder(bookmarks[2]!, 'c')).toBe(true);
    expect(isInFolder(bookmarks[3]!, 'c')).toBe(false);
  });
});

describe('bookmarkIdsIn', () => {
  it('collects a whole subtree', () => {
    expect(bookmarkIdsIn(bookmarks, 'c').sort()).toEqual(['deep', 'new', 'old']);
  });
});

describe('buildEntries', () => {
  it('lists everything newest first in "all"', () => {
    expect(ids(buildEntries({ bookmarks, filter: 'all', subfolders: [], ranking: null }))).toEqual([
      'other',
      'new',
      'deep',
      'old',
    ]);
  });

  it('lists subfolders first, then only the bookmarks directly inside the folder', () => {
    const entries = buildEntries({ bookmarks, filter: 'c', subfolders: [node('p')], ranking: null });
    expect(ids(entries)).toEqual(['p', 'new', 'old']);
    expect(entries[0]).toMatchObject({ kind: 'folder' });
  });

  it('orders search results by rank and keeps only bookmarks in scope', () => {
    expect(ids(buildEntries({ bookmarks, filter: 'all', subfolders: [], ranking: ['old', 'other', 'new'] }))).toEqual([
      'old',
      'other',
      'new',
    ]);
    expect(ids(buildEntries({ bookmarks, filter: 'c', subfolders: [], ranking: ['other', 'deep', 'old'] }))).toEqual([
      'deep',
      'old',
    ]);
  });

  it('shows no subfolders while searching', () => {
    const entries = buildEntries({ bookmarks, filter: 'c', subfolders: [node('p')], ranking: ['old'] });
    expect(entries.every((e) => e.kind === 'bookmark')).toBe(true);
  });

  it('returns an empty list for an empty search result', () => {
    expect(buildEntries({ bookmarks, filter: 'all', subfolders: [], ranking: [] })).toEqual([]);
  });
});
