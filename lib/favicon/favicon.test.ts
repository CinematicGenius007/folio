import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchLimited, isStale } from './cache';
import { parseIconLinks } from './links';
import { isFetchableUrl, isPublicHost } from './network';
import { colorFor, hashString, letterFor } from './palette';

describe('parseIconLinks', () => {
  const html = `
    <link rel="icon" href="/a.png" sizes="16x16">
    <link rel="apple-touch-icon" href="/b.png" sizes="180x180">
    <link rel="icon" href="/c.svg">
    <link rel="stylesheet" href="/style.css">`;

  it('prefers a scalable SVG, then the raster closest to 64px', () => {
    const links = parseIconLinks(html, 'https://x.dev/');
    expect(links[0]).toBe('https://x.dev/c.svg');
    expect(links).toContain('https://x.dev/b.png');
    expect(links).not.toContain('https://x.dev/style.css');
  });

  it('resolves relative links against the page URL', () => {
    expect(parseIconLinks('<link rel="icon" href="img/i.png">', 'https://x.dev/docs/page')).toEqual([
      'https://x.dev/docs/img/i.png',
    ]);
  });

  it('ignores links without an href and unparseable ones', () => {
    expect(parseIconLinks('<link rel="icon">', 'https://x.dev/')).toEqual([]);
  });
});

describe('palette', () => {
  it('hashes deterministically and picks a stable colour', () => {
    expect(hashString('github.com')).toBe(hashString('github.com'));
    expect(colorFor('github.com')).toBe(colorFor('github.com'));
  });
  it('takes the tile letter from the title, skipping punctuation', () => {
    expect(letterFor('"Vite"', 'https://vite.dev')).toBe('V');
    expect(letterFor('', 'https://www.example.com/x')).toBe('E');
    expect(letterFor('!!!', 'https://')).toBe('#');
  });
});

describe('isStale', () => {
  const day = 24 * 3600 * 1000;
  it('treats a missing row as stale', () => expect(isStale(undefined)).toBe(true));
  it('retries misses sooner than hits', () => {
    const now = 100 * day;
    expect(isStale({ origin: 'a', status: 'miss', source: 'none', fetchedAt: now - 8 * day }, now)).toBe(true);
    expect(isStale({ origin: 'a', status: 'ok', source: 'site', fetchedAt: now - 8 * day }, now)).toBe(false);
    expect(isStale({ origin: 'a', status: 'ok', source: 'site', fetchedAt: now - 31 * day }, now)).toBe(true);
  });
});

describe('network guard', () => {
  it.each([
    'localhost',
    'app.localhost',
    'printer.local',
    'intranet',
    '127.0.0.1',
    '10.0.0.5',
    '192.168.1.1',
    '172.16.0.1',
    '172.31.255.1',
    '169.254.1.1',
    '100.64.0.1',
    '[::1]',
    'fd00::1',
    'fe80::1',
  ])('rejects %s', (host) => expect(isPublicHost(host)).toBe(false));
  it.each([
    'example.com',
    'sub.example.co.uk',
    '8.8.8.8',
    '172.32.0.1',
    '100.63.0.1',
    '[2606:4700::1111]',
    '[::ffff:8.8.8.8]',
  ])('accepts %s', (host) => expect(isPublicHost(host)).toBe(true));
  it('only fetches http(s) URLs', () => {
    expect(isFetchableUrl('https://example.com/favicon.ico')).toBe(true);
    expect(isFetchableUrl('file:///etc/passwd')).toBe(false);
    expect(isFetchableUrl('javascript:alert(1)')).toBe(false);
    expect(isFetchableUrl('http://192.168.0.1/')).toBe(false);
    expect(isFetchableUrl('not a url')).toBe(false);
    expect(isFetchableUrl('http://[::ffff:127.0.0.1]:8080/')).toBe(false);
    expect(isFetchableUrl('http://2130706433/')).toBe(false); // decimal form of 127.0.0.1
    expect(isFetchableUrl('http://0x7f.1/')).toBe(false);
    expect(isFetchableUrl('https://user:pass@example.com/')).toBe(false);
  });
});

describe('fetchLimited', () => {
  const respond = (body: BodyInit | null, init: ResponseInit & { url?: string } = {}) => {
    const response = new Response(body, init);
    if (init.url) Object.defineProperty(response, 'url', { value: init.url });
    return response;
  };
  const stubFetch = (response: Response) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
  afterEach(() => vi.unstubAllGlobals());

  it('returns the body of a small public response', async () => {
    stubFetch(respond('hello', { headers: { 'content-type': 'text/plain' }, url: 'https://example.com/a' }));
    const result = await fetchLimited('https://example.com/a', 100);
    expect(new TextDecoder().decode(result!.bytes)).toBe('hello');
    expect(result!.contentType).toBe('text/plain');
  });

  it('refuses a body over budget even when it does not declare a length', async () => {
    stubFetch(respond('x'.repeat(500), { url: 'https://example.com/a' }));
    expect(await fetchLimited('https://example.com/a', 100)).toBeNull();
  });

  it('refuses a declared length over budget without reading the body', async () => {
    const response = respond('x', { headers: { 'content-length': '999999' }, url: 'https://example.com/a' });
    stubFetch(response);
    expect(await fetchLimited('https://example.com/a', 100)).toBeNull();
  });

  it('discards the answer when a redirect ends on a private address', async () => {
    stubFetch(respond('secret', { url: 'http://192.168.1.1/admin' }));
    expect(await fetchLimited('https://example.com/a', 100)).toBeNull();
  });

  it('rejects non-OK responses', async () => {
    stubFetch(respond('nope', { status: 404, url: 'https://example.com/a' }));
    expect(await fetchLimited('https://example.com/a', 100)).toBeNull();
  });

  it('sends no cookies and no referrer', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond('ok', { url: 'https://example.com/a' }));
    vi.stubGlobal('fetch', fetchMock);
    await fetchLimited('https://example.com/a', 100);
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer' });
  });

  it('returns null when the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await fetchLimited('https://example.com/a', 100)).toBeNull();
  });
});
