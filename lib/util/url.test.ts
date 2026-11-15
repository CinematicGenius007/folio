import { describe, expect, it } from 'vitest';
import { isSafeUrl, normalizeUrl, parseUrlInput } from './url';

describe('url', () => {
  it('blocks dangerous schemes', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('data:text/html,hi')).toBe(false);
    expect(isSafeUrl('https://a.dev')).toBe(true);
  });
  it('normalizes for duplicates', () => {
    const a = normalizeUrl('https://Example.com/post/?utm_source=x&b=1#top');
    const b = normalizeUrl('https://example.com/post?b=1');
    expect(a).toBe(b);
    expect(normalizeUrl('https://a.dev/')).toBe(normalizeUrl('https://a.dev'));
  });
  it('parses pasted input', () => {
    expect(parseUrlInput('github.com/foo')).toBe('https://github.com/foo');
    expect(parseUrlInput('hello world')).toBeNull();
    expect(parseUrlInput('javascript:alert(1)')).toBeNull();
  });
});
