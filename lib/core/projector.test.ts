import { beforeEach, describe, expect, it } from 'vitest';
import { FolioDB } from './db';
import { flatten, syncReadModel, type TreeNode } from './projector';

const tree = (extra: TreeNode[] = []): TreeNode[] => [
  {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        parentId: '0',
        index: 0,
        title: 'Bookmarks bar',
        children: [
          { id: '10', parentId: '1', index: 0, title: 'Loose', url: 'https://loose.dev/' },
          {
            id: '11',
            parentId: '1',
            index: 1,
            title: 'Dev',
            children: [
              { id: '12', parentId: '11', index: 0, title: 'Vite', url: 'https://vite.dev/' },
              {
                id: '13',
                parentId: '11',
                index: 1,
                title: 'Sub',
                children: [{ id: '14', parentId: '13', index: 0, title: 'Deep', url: 'https://deep.dev' }],
              },
              ...extra,
            ],
          },
        ],
      },
      { id: '2', parentId: '0', index: 1, title: 'Other bookmarks', children: [] },
    ],
  },
];

describe('flatten', () => {
  it('assigns collections and paths', () => {
    const { bookmarks, folders } = flatten(tree());
    const by = Object.fromEntries(bookmarks.map((b) => [b.id, b]));
    expect(by['10']).toMatchObject({ collectionId: '1', path: [] });
    expect(by['12']).toMatchObject({ collectionId: '11', path: ['Dev'] });
    expect(by['14']).toMatchObject({ collectionId: '11', path: ['Dev', 'Sub'], pathIds: ['11', '13'] });
    expect(by['10']?.pathIds).toEqual([]);
    expect(folders.find((f) => f.id === '13')?.pathIds).toEqual(['11', '13']);
    expect(folders.find((f) => f.id === '11')).toMatchObject({ depth: 2 });
    expect(folders.find((f) => f.id === '13')).toMatchObject({ depth: 3 });
  });
});

describe('syncReadModel', () => {
  let db: FolioDB;
  beforeEach(async () => {
    db = new FolioDB(`t-${Math.random()}`);
    await syncReadModel(db, tree());
  });

  it('projects bookmarks', async () => {
    expect(await db.bookmarks.count()).toBe(3);
  });

  it('tombstones removed bookmarks with their metadata', async () => {
    await db.meta.put({ id: '12', tags: ['vite'], note: 'build tool', updatedAt: 1 });
    const t = tree();
    t[0]!.children![0]!.children![1]!.children!.shift();
    await syncReadModel(db, t, 1000);
    expect(await db.bookmarks.get('12')).toBeUndefined();
    expect(await db.meta.get('12')).toBeUndefined();
    const stone = await db.tombstones.get('12');
    expect(stone?.meta?.tags).toEqual(['vite']);
    expect(stone?.parentTitle).toBe('Dev');
  });

  it('skips writes when nothing changed', async () => {
    let writes = 0;
    db.bookmarks.hook('updating', () => void writes++);
    await syncReadModel(db, tree());
    expect(writes).toBe(0);
  });

  it('expires old tombstones', async () => {
    await db.tombstones.put({
      id: 'old',
      bm: (await db.bookmarks.get('10'))!,
      parentTitle: '',
      deletedAt: 0,
    });
    await syncReadModel(db, tree(), 31 * 24 * 3600 * 1000);
    expect(await db.tombstones.get('old')).toBeUndefined();
  });
});
