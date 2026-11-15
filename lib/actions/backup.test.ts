import { beforeEach, describe, expect, it } from 'vitest';
import { db, getSetting } from '@/lib/core/db';
import type { Bm } from '@/lib/core/types';
import { normalizeUrl } from '@/lib/util/url';
import { BACKUP_LIMITS, MAX_BACKUP_BYTES, exportBackup, importBackup, parseBackup } from './backup';

const bookmark = (id: string, url: string): Bm => ({
  id,
  parentId: '1',
  title: id,
  url,
  normUrl: normalizeUrl(url),
  dateAdded: 0,
  index: 0,
  collectionId: '1',
  path: [],
  pathIds: [],
});

const backup = (meta: unknown, extra: object = {}) => JSON.stringify({ app: 'folio', version: 1, meta, ...extra });

describe('parseBackup', () => {
  it('accepts a valid backup', () => {
    expect(parseBackup(backup([{ url: 'https://a.dev/', tags: ['x'], note: 'n' }]))).toEqual([
      { url: 'https://a.dev/', tags: ['x'], note: 'n' },
    ]);
  });

  it('rejects text over the size limit without parsing it', () => {
    expect(() => parseBackup(' '.repeat(MAX_BACKUP_BYTES + 1))).toThrow('too large');
  });

  it.each([
    ['invalid JSON', '{nope'],
    ['a non-object', '42'],
    ['another app', JSON.stringify({ app: 'other', version: 1, meta: [] })],
    ['another version', JSON.stringify({ app: 'folio', version: 2, meta: [] })],
    ['missing meta', JSON.stringify({ app: 'folio', version: 1 })],
  ])('rejects %s', (_name, text) => {
    expect(() => parseBackup(text)).toThrow();
  });

  it.each([
    ['a non-string url', { url: 1, tags: [], note: '' }],
    ['a non-array tags', { url: 'https://a.dev', tags: 'x', note: '' }],
    ['a non-string note', { url: 'https://a.dev', tags: [], note: 5 }],
    ['a tag with spaces', { url: 'https://a.dev', tags: ['a b'], note: '' }],
    ['a tag that looks like markup', { url: 'https://a.dev', tags: ['<script>'], note: '' }],
    ['an oversized note', { url: 'https://a.dev', tags: [], note: 'x'.repeat(BACKUP_LIMITS.note + 1) }],
    [
      'too many tags',
      { url: 'https://a.dev', tags: Array.from({ length: BACKUP_LIMITS.tags + 1 }, (_, i) => `t${i}`), note: '' },
    ],
    ['null', null],
  ])('rejects an entry with %s', (_name, entry) => {
    expect(() => parseBackup(backup([entry]))).toThrow('invalid entry');
  });
});

describe('export and import', () => {
  beforeEach(async () => {
    await Promise.all([db.meta.clear(), db.bookmarks.clear(), db.settings.clear()]);
  });

  it('round-trips tags and notes by URL, onto bookmarks with new ids', async () => {
    await db.bookmarks.put(bookmark('old', 'https://a.dev/'));
    await db.meta.put({ id: 'old', tags: ['rust'], note: 'read me', updatedAt: 1 });
    const text = await exportBackup();

    await Promise.all([db.meta.clear(), db.bookmarks.clear()]);
    await db.bookmarks.put(bookmark('new', 'https://a.dev'));
    expect(await importBackup(text)).toBe(1);
    expect(await db.meta.get('new')).toMatchObject({ tags: ['rust'], note: 'read me' });
  });

  it('records when the backup was taken', async () => {
    await exportBackup();
    expect(await getSetting('lastBackupAt', 0)).toBeGreaterThan(0);
  });

  it('does not export browser-specific settings or images', async () => {
    await db.settings.bulkPut([
      { key: 'inboxId', value: '9' },
      { key: 'bgImage', value: new Blob(['x']) },
    ]);
    const exported = JSON.parse(await exportBackup()) as Record<string, unknown>;
    expect(Object.keys(exported).sort()).toEqual(['app', 'exportedAt', 'meta', 'version']);
  });

  it('applies one entry to every bookmark with that URL, and clears metadata when the entry is empty', async () => {
    await db.bookmarks.bulkPut([bookmark('a', 'https://a.dev/'), bookmark('b', 'https://a.dev')]);
    await db.meta.put({ id: 'b', tags: ['old'], note: 'old', updatedAt: 1 });
    expect(await importBackup(backup([{ url: 'https://a.dev/', tags: ['x'], note: '' }]))).toBe(2);
    expect((await db.meta.get('a'))?.tags).toEqual(['x']);
    expect((await db.meta.get('b'))?.tags).toEqual(['x']);
    expect(await importBackup(backup([{ url: 'https://a.dev/', tags: [], note: '' }]))).toBe(2);
    expect(await db.meta.count()).toBe(0);
  });

  it('skips entries whose bookmark no longer exists', async () => {
    expect(await importBackup(backup([{ url: 'https://gone.dev/', tags: ['a'], note: '' }]))).toBe(0);
  });
});
