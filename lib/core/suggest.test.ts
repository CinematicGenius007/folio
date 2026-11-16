import { describe, expect, it } from 'vitest';
import type { Bm, Folder, Meta } from './types';
import {
  SIMILAR_CAP,
  SUGGEST_CONFIDENCE,
  SUGGEST_FLOOR,
  bumpPickCount,
  prunePickCounts,
  resolveSaveActiveKey,
  suggestFolders,
  tokenize,
} from './suggest';

function folder(partial: Partial<Folder> & Pick<Folder, 'id' | 'title' | 'depth'>): Folder {
  return {
    parentId: '1',
    index: 0,
    collectionId: partial.id,
    path: [partial.title],
    pathIds: [partial.id],
    ...partial,
  };
}

function bm(partial: Partial<Bm> & Pick<Bm, 'id' | 'parentId' | 'title' | 'url'>): Bm {
  return {
    normUrl: partial.url,
    dateAdded: 0,
    index: 0,
    collectionId: partial.parentId,
    path: [],
    pathIds: [],
    ...partial,
  };
}

const folders = [
  folder({ id: 'dev', title: 'Dev Tech', depth: 2 }),
  folder({
    id: 'rust',
    title: 'Rust',
    depth: 3,
    parentId: 'dev',
    path: ['Dev Tech', 'Rust'],
    pathIds: ['dev', 'rust'],
  }),
  folder({ id: 'read', title: 'Reading', depth: 2 }),
  folder({ id: 'inbox', title: 'Inbox', depth: 2 }),
  folder({ id: 'root', title: 'Bookmarks bar', depth: 1 }),
];

const bookmarks = [
  bm({ id: '1', parentId: 'dev', title: 'Vite', url: 'https://vite.dev/' }),
  bm({ id: '2', parentId: 'dev', title: 'WXT', url: 'https://wxt.dev/' }),
  bm({ id: '3', parentId: 'rust', title: 'Tokio', url: 'https://tokio.rs/' }),
  bm({ id: '4', parentId: 'read', title: 'Sketching with Code', url: 'https://gorillasun.de/' }),
];

describe('tokenize', () => {
  it('splits hosts and titles into lowercase content tokens', () => {
    expect(tokenize('Vite — next gen')).toEqual(['vite', 'next', 'gen']);
    expect(tokenize('github.com')).toEqual(['github']);
    expect(tokenize('The garden')).toEqual(['garden']);
  });
});

describe('suggestFolders', () => {
  it('returns nothing for an empty library', () => {
    expect(
      suggestFolders({ page: { title: 'Vite', url: 'https://vite.dev/guide' }, folders: [], bookmarks: [] }),
    ).toEqual([]);
  });

  it('ranks the folder that already holds this host highest', () => {
    const [top, ...rest] = suggestFolders({
      page: { title: 'Vite Guide', url: 'https://vite.dev/guide' },
      folders,
      bookmarks,
      excludeIds: ['inbox'],
    });
    expect(top).toMatchObject({ id: 'dev' });
    expect(top!.score).toBeGreaterThanOrEqual(SUGGEST_CONFIDENCE);
    expect(top!.reasons.some((r) => /vite\.dev/.test(r))).toBe(true);
    expect(rest.every((s) => s.id !== 'inbox')).toBe(true);
  });

  it('matches folder names in the page title when no host hits exist', () => {
    const hits = suggestFolders({
      page: { title: 'Notes on Rust async', url: 'https://example.com/rust-async' },
      folders,
      bookmarks,
      excludeIds: ['inbox'],
    });
    expect(hits[0]?.id).toBe('rust');
    expect(hits[0]?.reasons.some((r) => /Rust/.test(r))).toBe(true);
  });

  it('boosts frequently picked and last-used folders', () => {
    const cold = suggestFolders({
      page: { title: 'Something new', url: 'https://brand-new.example/' },
      folders,
      bookmarks,
      excludeIds: ['inbox'],
    });
    const warm = suggestFolders({
      page: { title: 'Something new', url: 'https://brand-new.example/' },
      folders,
      bookmarks,
      pickCounts: { read: 6 },
      lastFolderId: 'read',
      excludeIds: ['inbox'],
    });
    expect(cold.find((s) => s.id === 'read')).toBeUndefined();
    expect(warm[0]?.id).toBe('read');
  });

  it('never suggests excluded ids or browser roots', () => {
    const hits = suggestFolders({
      page: { title: 'Vite', url: 'https://vite.dev/' },
      folders,
      bookmarks,
      pickCounts: { inbox: 99, root: 99 },
      lastFolderId: 'inbox',
      excludeIds: ['inbox'],
    });
    expect(hits.every((s) => s.id !== 'inbox' && s.id !== 'root')).toBe(true);
  });

  it('lets similar bookmark titles vote for their parent', () => {
    const hits = suggestFolders({
      page: { title: 'Sketching ideas with code', url: 'https://other.example/sketch' },
      folders,
      bookmarks,
      excludeIds: ['inbox'],
    });
    expect(hits.some((s) => s.id === 'read')).toBe(true);
  });

  it('does not let stop-token neighbour votes alone clear confidence', () => {
    const noisy = [
      bm({ id: 'n1', parentId: 'read', title: 'The Times', url: 'https://a.com/' }),
      bm({ id: 'n2', parentId: 'read', title: 'The Verge', url: 'https://b.com/' }),
      bm({ id: 'n3', parentId: 'read', title: 'The Atlantic', url: 'https://c.com/' }),
    ];
    const hits = suggestFolders({
      page: { title: 'The garden', url: 'https://d.com/garden' },
      folders,
      bookmarks: noisy,
      excludeIds: ['inbox'],
    });
    const read = hits.find((s) => s.id === 'read');
    expect(read === undefined || read.score < SUGGEST_CONFIDENCE).toBe(true);
    expect(
      resolveSaveActiveKey({
        top: read ?? { id: 'read', score: 0 },
        lastFolderId: 'dev',
        inboxId: 'inbox',
        folderById: new Map(folders.map((f) => [f.id, f])),
      }).activeKey,
    ).toBe('folder:dev');
  });

  it('caps accumulated neighbour scores below confidence', () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      bm({
        id: `s${i}`,
        parentId: 'read',
        title: `Sketching code part ${i}`,
        url: `https://sketch-${i}.example/`,
      }),
    );
    const hits = suggestFolders({
      page: { title: 'Sketching with code notes', url: 'https://other.example/workshop' },
      folders,
      bookmarks: many,
      excludeIds: ['inbox'],
    });
    const read = hits.find((s) => s.id === 'read');
    expect(read).toBeDefined();
    expect(read!.reasons).toContain('similar bookmarks');
    // Cap keeps neighbour votes from alone clearing the pre-select bar.
    expect(read!.score).toBeLessThanOrEqual(SIMILAR_CAP);
    expect(read!.score).toBeLessThan(SUGGEST_CONFIDENCE);
  });

  it('uses tags on similar bookmarks as a small bonus', () => {
    const page = { title: 'Sketching with code notes', url: 'https://other.example/workshop' };
    const base = suggestFolders({ page, folders, bookmarks, excludeIds: ['inbox'] });
    const meta = new Map<string, Meta>([['4', { id: '4', tags: ['sketching'], note: '', updatedAt: 0 }]]);
    const withTags = suggestFolders({ page, folders, bookmarks, meta, excludeIds: ['inbox'] });
    const baseRead = base.find((s) => s.id === 'read')!.score;
    const taggedRead = withTags.find((s) => s.id === 'read')!.score;
    expect(taggedRead).toBeGreaterThan(baseRead);
  });

  it('caps results at the limit', () => {
    const hits = suggestFolders({
      page: { title: 'Vite Rust Reading Dev', url: 'https://vite.dev/' },
      folders,
      bookmarks,
      pickCounts: { read: 3, rust: 3 },
      excludeIds: ['inbox'],
      limit: 2,
    });
    expect(hits).toHaveLength(2);
  });
});

describe('resolveSaveActiveKey', () => {
  const folderById = new Map(folders.map((f) => [f.id, f]));

  it('pre-selects only a confident suggestion', () => {
    expect(
      resolveSaveActiveKey({
        top: { id: 'dev', score: SUGGEST_CONFIDENCE },
        lastFolderId: 'read',
        inboxId: 'inbox',
        folderById,
      }),
    ).toEqual({ activeKey: 'suggest:dev', expandFor: 'dev' });
    expect(
      resolveSaveActiveKey({
        top: { id: 'dev', score: SUGGEST_CONFIDENCE - 0.1 },
        lastFolderId: 'read',
        inboxId: 'inbox',
        folderById,
      }),
    ).toEqual({ activeKey: 'folder:read', expandFor: 'read' });
  });

  it('ignores a deleted last folder and falls back to Inbox, not a weak suggestion', () => {
    expect(
      resolveSaveActiveKey({
        top: { id: 'dev', score: SUGGEST_FLOOR },
        lastFolderId: 'deleted',
        inboxId: 'inbox',
        folderById,
      }),
    ).toEqual({ activeKey: 'folder:inbox', expandFor: null });
  });
});

describe('pick count helpers', () => {
  it('bumps a folder count immutably', () => {
    const base = { a: 1 };
    expect(bumpPickCount(base, 'a')).toEqual({ a: 2 });
    expect(bumpPickCount(base, 'b')).toEqual({ a: 1, b: 1 });
    expect(base).toEqual({ a: 1 });
  });

  it('prunes missing and non-positive counts', () => {
    const counts = { keep: 2, gone: 3, zero: 0 };
    expect(prunePickCounts(counts, ['keep'])).toEqual({ keep: 2 });
    expect(prunePickCounts({ keep: 1 }, ['keep'])).toEqual({ keep: 1 });
  });
});
