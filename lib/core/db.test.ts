import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { FolioDB, getSetting, setSetting } from './db';

describe('schema upgrade', () => {
  it('clears the rebuildable read model but keeps user data when upgrading from v1', async () => {
    const name = `upgrade-${Math.random()}`;

    // an install from before nested folders: rows have no `pathIds`
    const old = new Dexie(name);
    old.version(1).stores({
      bookmarks: 'id, parentId, collectionId, normUrl, dateAdded',
      folders: 'id, parentId, collectionId, depth',
      meta: 'id, updatedAt, *tags',
      tombstones: 'id, deletedAt',
      favicons: 'origin, fetchedAt',
      settings: 'key',
    });
    await old.open();
    await old.table('bookmarks').put({ id: '1', parentId: '2', url: 'https://a.dev/' });
    await old.table('folders').put({ id: '2', parentId: '0', title: 'Dev' });
    await old.table('meta').put({ id: '1', tags: ['keep'], note: 'me', updatedAt: 1 });
    await old.table('settings').put({ key: 'theme', value: 'dark' });
    old.close();

    const upgraded = new FolioDB(name);
    expect(await upgraded.bookmarks.count()).toBe(0);
    expect(await upgraded.folders.count()).toBe(0);
    expect(await upgraded.meta.get('1')).toMatchObject({ tags: ['keep'], note: 'me' });
    expect((await upgraded.settings.get('theme'))?.value).toBe('dark');
    upgraded.close();
  });
});

describe('settings', () => {
  it('returns the fallback until a value is set, then the value', async () => {
    expect(await getSetting('db-test-key', 'fallback')).toBe('fallback');
    await setSetting('db-test-key', 'value');
    expect(await getSetting('db-test-key', 'fallback')).toBe('value');
  });
});
