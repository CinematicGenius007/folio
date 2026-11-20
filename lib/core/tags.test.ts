import { describe, expect, it } from 'vitest';
import { completeTag, formatNote, parseTags, rankTags, tagTokenAt } from './tags';
import type { Meta } from './types';

const meta = (id: string, ...tags: string[]): Meta => ({ id, tags, note: '', updatedAt: 0 });

describe('formatNote', () => {
  it('round-trips with parseTags', () => {
    const text = formatNote('read later', ['rust', 'docs']);
    expect(text).toBe('read later #rust #docs');
    expect(parseTags(text)).toEqual({ text: 'read later', tags: ['rust', 'docs'] });
  });

  it('has no stray spaces without a note or tags', () => {
    expect(formatNote('', ['a'])).toBe('#a');
    expect(formatNote(' note ', [])).toBe('note');
    expect(formatNote('', [])).toBe('');
  });
});

describe('rankTags', () => {
  it('puts the most-used tag first', () => {
    expect(rankTags([meta('1', 'rustlang'), meta('2', 'rust'), meta('3', 'rust')])).toEqual(['rust', 'rustlang']);
  });

  it('breaks ties by use on the same host', () => {
    const bookmarks = [
      { id: '1', url: 'https://blog.example/a' },
      { id: '2', url: 'https://www.docs.rs/b' },
    ];
    const metas = [meta('1', 'rust'), meta('2', 'rustlang')];
    expect(rankTags(metas, bookmarks, 'docs.rs')).toEqual(['rustlang', 'rust']);
    expect(rankTags(metas, bookmarks, 'blog.example')).toEqual(['rust', 'rustlang']);
  });

  it('falls back to alphabetical', () => {
    expect(rankTags([meta('1', 'b', 'a', 'c')])).toEqual(['a', 'b', 'c']);
  });

  it('is empty for an untagged library', () => {
    expect(rankTags([])).toEqual([]);
  });
});

describe('tagTokenAt', () => {
  it('finds the #prefix right before the caret', () => {
    expect(tagTokenAt('note #ru', 8)).toEqual({ start: 6, prefix: 'ru' });
    expect(tagTokenAt('#ru later', 3)).toEqual({ start: 1, prefix: 'ru' });
  });

  it('ignores a bare #, a # inside a word and a caret mid-word', () => {
    expect(tagTokenAt('note #', 6)).toBeNull();
    expect(tagTokenAt('C#x', 3)).toBeNull();
    expect(tagTokenAt('#rust', 3)).toBeNull();
    expect(tagTokenAt('plain', 5)).toBeNull();
  });
});

describe('completeTag', () => {
  const ranked = ['rust', 'rustlang', 'reading', 'docs'];

  it('completes to the best tag with the typed prefix', () => {
    expect(completeTag(ranked, 'note #ru', 8)).toBe('st');
    expect(completeTag(ranked, '#rea', 4)).toBe('ding');
  });

  it('matches case-insensitively and returns the lower-case rest', () => {
    expect(completeTag(ranked, '#RU', 3)).toBe('st');
  });

  it('never completes to the exact same text', () => {
    // `rust` is typed and is the best match, so there is nothing to add (not `lang`).
    expect(completeTag(ranked, '#rust', 5)).toBeNull();
    expect(completeTag(['docs'], '#docs', 5)).toBeNull();
  });

  it('skips tags already written elsewhere in the text', () => {
    expect(completeTag(ranked, '#rust #ru', 9)).toBe('stlang');
  });

  it('is off when no tag matches or the caret is not after a token', () => {
    expect(completeTag(ranked, '#zz', 3)).toBeNull();
    expect(completeTag(ranked, 'rust', 4)).toBeNull();
    expect(completeTag([], '#r', 2)).toBeNull();
  });
});
