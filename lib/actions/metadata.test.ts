import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/core/db';
import { parseTags, setMeta } from './metadata';

describe('parseTags', () => {
  it('splits tags from the note and lower-cases them', () => {
    expect(parseTags('read later #Rust #docs')).toEqual({ text: 'read later', tags: ['rust', 'docs'] });
  });

  it('de-duplicates tags and collapses whitespace', () => {
    expect(parseTags('  #a   note  #A #b ')).toEqual({ text: 'note', tags: ['a', 'b'] });
  });

  it('keeps a # that is not at a word start', () => {
    expect(parseTags('C# is fine')).toEqual({ text: 'C# is fine', tags: [] });
  });

  it('supports non-latin tags', () => {
    expect(parseTags('#学習 メモ').tags).toEqual(['学習']);
  });

  it('returns nothing for empty input', () => {
    expect(parseTags('')).toEqual({ text: '', tags: [] });
  });
});

describe('setMeta', () => {
  beforeEach(() => db.meta.clear());

  it('stores tags and a note', async () => {
    await setMeta('1', { tags: ['a'], note: 'hello' });
    expect(await db.meta.get('1')).toMatchObject({ tags: ['a'], note: 'hello' });
  });

  it('keeps fields that the patch leaves out', async () => {
    await setMeta('1', { tags: ['a'], note: 'hello' });
    await setMeta('1', { note: 'changed' });
    expect(await db.meta.get('1')).toMatchObject({ tags: ['a'], note: 'changed' });
  });

  it('deletes the row when both tags and note become empty', async () => {
    await setMeta('1', { tags: ['a'], note: 'x' });
    await setMeta('1', { tags: [], note: '' });
    expect(await db.meta.get('1')).toBeUndefined();
  });
});
