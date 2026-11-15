import { browser } from 'wxt/browser';

/** Chromium exposes the browser's own favicon cache to extensions that hold the `favicon` permission. */
export function hasBrowserFavicons(): boolean {
  try {
    return (browser.runtime.getManifest().permissions ?? []).includes('favicon');
  } catch {
    return false;
  }
}

/** URL of Chromium's `_favicon` endpoint for a page, served from the browser cache with no network request. */
export function browserFaviconSrc(pageUrl: string, size = 32): string {
  const endpoint = new URL(browser.runtime.getURL('/_favicon/' as never));
  endpoint.searchParams.set('pageUrl', pageUrl);
  endpoint.searchParams.set('size', String(size));
  return endpoint.toString();
}

/** A page that cannot exist, used to ask Chromium for its generic placeholder icon. */
const UNKNOWN_PAGE = 'https://folio-no-such-site.invalid/';
const FINGERPRINT_SIZE = 16;

/** Small hash of an image's pixels; two identical images always match. */
async function fingerprint(src: string): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(await (await fetch(src)).blob());
    const canvas = new OffscreenCanvas(FINGERPRINT_SIZE, FINGERPRINT_SIZE);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, FINGERPRINT_SIZE, FINGERPRINT_SIZE);
    let hash = 2166136261;
    for (const byte of ctx.getImageData(0, 0, FINGERPRINT_SIZE, FINGERPRINT_SIZE).data)
      hash = Math.imul(hash ^ byte, 16777619);
    return (hash >>> 0).toString(36);
  } catch {
    return null;
  }
}

let placeholder: Promise<string | null> | undefined;
const verdicts = new Map<string, Promise<boolean>>();

/**
 * True when Chromium answered with its generic globe because it has no icon for the page.
 * Folio shows a letter tile instead, which looks better and tells sites apart.
 * Results are cached per URL, so each icon is inspected once.
 */
export function isBrowserPlaceholder(src: string): Promise<boolean> {
  let verdict = verdicts.get(src);
  if (!verdict) {
    placeholder ??= fingerprint(browserFaviconSrc(UNKNOWN_PAGE));
    verdict = Promise.all([placeholder, fingerprint(src)]).then(([globe, icon]) => globe !== null && icon === globe);
    verdicts.set(src, verdict);
  }
  return verdict;
}
