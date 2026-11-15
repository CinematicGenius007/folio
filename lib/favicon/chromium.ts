import { browser } from 'wxt/browser';
import { needsPlate } from './measure';

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

/** What a quick look at an icon's pixels tells us. */
interface IconLook {
  /** Small hash of the pixels; two identical images always match. */
  hash: string;
  /** Dark glyph on a transparent background: needs a light plate on a dark theme. */
  plate: boolean;
}

async function look(src: string): Promise<IconLook | null> {
  try {
    const bitmap = await createImageBitmap(await (await fetch(src)).blob());
    const canvas = new OffscreenCanvas(FINGERPRINT_SIZE, FINGERPRINT_SIZE);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, FINGERPRINT_SIZE, FINGERPRINT_SIZE);
    const data = ctx.getImageData(0, 0, FINGERPRINT_SIZE, FINGERPRINT_SIZE).data;
    let hash = 2166136261;
    for (const byte of data) hash = Math.imul(hash ^ byte, 16777619);
    return { hash: (hash >>> 0).toString(36), plate: needsPlate(data) };
  } catch {
    return null;
  }
}

let placeholder: Promise<IconLook | null> | undefined;
const inspections = new Map<string, Promise<BrowserIcon>>();

/** The verdict on one icon from Chromium's cache. */
export interface BrowserIcon {
  /** True when Chromium answered with its generic globe because it has no icon for the page. */
  placeholder: boolean;
  /** True for a dark glyph on a transparent background, which needs a light plate on a dark theme. */
  needsPlate: boolean;
}

/**
 * Inspects an icon from Chromium's cache: is it the generic globe (Folio shows a letter tile instead, which
 * looks better and tells sites apart), and does it need a plate? Results are cached per URL, so each icon is
 * inspected once.
 */
export function inspectBrowserIcon(src: string): Promise<BrowserIcon> {
  let verdict = inspections.get(src);
  if (!verdict) {
    placeholder ??= look(browserFaviconSrc(UNKNOWN_PAGE));
    verdict = Promise.all([placeholder, look(src)]).then(([globe, icon]) => ({
      placeholder: globe !== null && icon !== null && icon.hash === globe.hash,
      needsPlate: icon?.plate ?? false,
    }));
    inspections.set(src, verdict);
  }
  return verdict;
}
