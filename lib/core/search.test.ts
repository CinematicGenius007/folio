import { describe, expect, it } from 'vitest';
import { buildIndex, search } from './search';
import type { Bm, Meta } from './types';

const bm = (id: string, title: string, url: string, path: string[] = []): Bm => ({
  id,
  parentId: '1',
  title,
  url,
  normUrl: url,
  dateAdded: 0,
  index: 0,
  collectionId: '1',
  path,
  pathIds: [],
});

describe('search', () => {
  const list = [
    bm('1', 'Vite: next generation frontend tooling', 'https://vite.dev'),
    bm('2', 'React Documentation', 'https://react.dev', ['Dev Tech']),
  ];
  const meta = new Map<string, Meta>([['2', { id: '2', tags: ['hooks'], note: 'reread effects', updatedAt: 0 }]]);
  const idx = buildIndex(list, meta);

  it('matches title prefixes', () => expect(search(idx, 'vit')).toEqual(['1']));
  it('matches tags and notes', () => {
    expect(search(idx, 'hooks')).toEqual(['2']);
    expect(search(idx, 'effects')).toEqual(['2']);
  });
  it('matches folder path', () => expect(search(idx, 'dev tech')).toEqual(['2']));
  it('is fuzzy for longer terms', () => expect(search(idx, 'documentaton')).toEqual(['2']));
  it('returns nothing for empty query', () => expect(search(idx, '  ')).toEqual([]));
});
