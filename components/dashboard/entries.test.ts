import { describe, expect, it } from 'vitest';
import type { FolderNode } from '@/lib/core/tree';
import type { Bm } from '@/lib/core/types';
import { DUPLICATES, bookmarkIdsIn, buildEntries, duplicateGroups, emptyMessage, isInFolder } from './entries';

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

describe('tag filters', () => {
  it('lists every tagged bookmark in the folder tree, newest first, when there are no words', () => {
    const tagged = new Set(['old', 'deep', 'other']);
    expect(ids(buildEntries({ bookmarks, filter: 'all', subfolders: [], ranking: null, tagged }))).toEqual([
      'other',
      'deep',
      'old',
    ]);
    expect(ids(buildEntries({ bookmarks, filter: 'c', subfolders: [node('p')], ranking: null, tagged }))).toEqual([
      'deep',
      'old',
    ]);
  });

  it('narrows ranked search results to tagged bookmarks', () => {
    const tagged = new Set(['new', 'other']);
    expect(
      ids(buildEntries({ bookmarks, filter: 'all', subfolders: [], ranking: ['old', 'other', 'new'], tagged })),
    ).toEqual(['other', 'new']);
  });

  it('is empty for a tag nobody has', () => {
    expect(buildEntries({ bookmarks, filter: 'all', subfolders: [], ranking: null, tagged: new Set() })).toEqual([]);
  });
});

describe('duplicates', () => {
  const copy = (id: string, normUrl: string, dateAdded: number, parentId = 'c'): Bm => ({
    ...bm(id, parentId, [parentId], dateAdded),
    normUrl,
  });
  const library = [
    copy('a1', 'https://a.dev', 1),
    copy('b1', 'https://b.dev', 2),
    copy('a2', 'https://a.dev', 5, 'z'),
    copy('solo', 'https://solo.dev', 9),
    copy('b2', 'https://b.dev', 3),
    copy('b3', 'https://b.dev', 4),
    copy('blank1', '', 6),
    copy('blank2', '', 7),
  ];

  it('groups bookmarks by normalised URL, oldest copy first, newest group first', () => {
    expect(duplicateGroups(library).map((g) => g.map((b) => b.id))).toEqual([
      ['a1', 'a2'],
      ['b1', 'b2', 'b3'],
    ]);
  });

  it('finds nothing when every URL is unique', () => {
    expect(duplicateGroups(bookmarks)).toEqual([]);
  });

  it('lists the groups back to back in the duplicates view, across folders', () => {
    expect(ids(buildEntries({ bookmarks: library, filter: DUPLICATES, subfolders: [], ranking: null }))).toEqual([
      'a1',
      'a2',
      'b1',
      'b2',
      'b3',
    ]);
  });

  it('narrows the view by search and tags without breaking groups apart', () => {
    expect(
      ids(buildEntries({ bookmarks: library, filter: DUPLICATES, subfolders: [], ranking: ['b3', 'a2', 'b1'] })),
    ).toEqual(['a2', 'b1', 'b3']);
    expect(
      ids(
        buildEntries({
          bookmarks: library,
          filter: DUPLICATES,
          subfolders: [],
          ranking: null,
          tagged: new Set(['b2', 'solo']),
        }),
      ),
    ).toEqual(['b2']);
  });
});

describe('emptyMessage', () => {
  const base = { tags: [] as string[], tagsExist: false, text: '', filter: 'all', isInbox: false };

  it('names an unknown tag', () => {
    expect(emptyMessage({ ...base, tags: ['x'] }).title).toBe('No bookmarks tagged #x');
  });

  it('points to All bookmarks when the tag exists outside the folder', () => {
    expect(emptyMessage({ ...base, tags: ['x'], tagsExist: true, filter: 'c' })).toEqual({
      title: 'No bookmarks tagged #x here',
      hint: 'Switch to All bookmarks to see them.',
    });
  });

  it('says nothing matches for words, with or without tags', () => {
    expect(emptyMessage({ ...base, text: 'zzz' }).title).toBe('Nothing matches');
    expect(emptyMessage({ ...base, text: 'zzz', tags: ['x'] }).title).toBe('Nothing matches');
  });

  it('has its own words for duplicates, the Inbox, a folder and everything', () => {
    expect(emptyMessage({ ...base, filter: DUPLICATES }).title).toBe('No duplicates');
    expect(emptyMessage({ ...base, filter: 'i', isInbox: true }).title).toBe('Your Inbox is clear');
    expect(emptyMessage({ ...base, filter: 'c' }).title).toBe('This folder is empty');
    expect(emptyMessage(base).title).toBe('Nothing here yet');
  });
});
