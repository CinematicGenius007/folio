import { describe, expect, it } from 'vitest';
import { buildIndex, parseQuery, search, taggedIds } from './search';
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

describe('parseQuery', () => {
  it('takes #tag tokens out as lowercase filters', () => {
    expect(parseQuery('#Rust borrow')).toEqual({ text: 'borrow', tags: ['rust'] });
    expect(parseQuery('borrow #rust #cli')).toEqual({ text: 'borrow', tags: ['rust', 'cli'] });
  });

  it('lists a query of only tags with no words', () => {
    expect(parseQuery('  #rust  ')).toEqual({ text: '', tags: ['rust'] });
  });

  it('dedupes tags and accepts letters, digits, - and _', () => {
    expect(parseQuery('#to-read #to-read #día_2').tags).toEqual(['to-read', 'día_2']);
  });

  it('never treats a pasted link as a filter', () => {
    expect(parseQuery('https://example.com/#intro')).toEqual({ text: 'https://example.com/#intro', tags: [] });
    expect(parseQuery('example.com#top')).toEqual({ text: 'example.com#top', tags: [] });
  });

  it('keeps words with a # inside, and drops a half-typed #', () => {
    expect(parseQuery('c# notes')).toEqual({ text: 'c# notes', tags: [] });
    expect(parseQuery('rust #')).toEqual({ text: 'rust', tags: [] });
  });

  it('returns an empty query unchanged', () => expect(parseQuery('   ')).toEqual({ text: '', tags: [] }));
});

describe('taggedIds', () => {
  const meta = new Map<string, Meta>([
    ['a', { id: 'a', tags: ['rust', 'cli'], note: '', updatedAt: 0 }],
    ['b', { id: 'b', tags: ['rust'], note: '', updatedAt: 0 }],
    ['c', { id: 'c', tags: ['rusty'], note: '', updatedAt: 0 }],
  ]);

  it('matches tags exactly, not by prefix', () => expect([...taggedIds(meta, ['rust'])].sort()).toEqual(['a', 'b']));
  it('requires every tag', () => expect([...taggedIds(meta, ['rust', 'cli'])]).toEqual(['a']));
  it('is empty for an unknown tag', () => expect(taggedIds(meta, ['go']).size).toBe(0));
});
