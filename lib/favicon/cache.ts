import { db } from '@/lib/core/db';
import type { FaviconRow } from '@/lib/core/types';
import { originOf } from '@/lib/util/url';
import { parseIconLinks } from './links';
import { needsPlate } from './measure';
import { isFetchableUrl } from './network';

/** A found icon is trusted for 30 days; a miss is retried after 7 so dead sites are not hammered. */
const HIT_TTL_MS = 30 * 24 * 3600 * 1000;
const MISS_TTL_MS = 7 * 24 * 3600 * 1000;
const MAX_ICON_BYTES = 300 * 1024;
const MAX_HTML_BYTES = 200_000;
const FETCH_TIMEOUT_MS = 6000;
/** Raster icons are stored at most this many pixels on the long side. */
const STORED_SIZE = 64;

/** Whether a cached row should be fetched again. */
export function isStale(row: FaviconRow | undefined, now = Date.now()): boolean {
  if (!row) return true;
  return now - row.fetchedAt > (row.status === 'ok' ? HIT_TTL_MS : MISS_TTL_MS);
}

/** A response body read within a byte budget. */
interface Fetched {
  bytes: Uint8Array;
  contentType: string;
  /** Final URL after redirects. */
  url: string;
}

/**
 * Downloads `url` safely: no cookies, no referrer, one timeout covering headers _and_ body, a hard
 * cap on bytes (the stream is cancelled when it is exceeded, so a hostile host cannot fill memory),
 * and the final URL after redirects must still be a public host. Returns null on any problem.
 */
export async function fetchLimited(url: string, maxBytes: number, init: RequestInit = {}): Promise<Fetched | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    const body = res.body;
    // A public site may redirect to a private address; the request is made, but its answer is discarded.
    const acceptable =
      res.ok && body && isFetchableUrl(res.url || url) && !(Number(res.headers.get('content-length')) > maxBytes);
    if (!body || !acceptable) {
      await body?.cancel();
      return null;
    }

    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { bytes, contentType: res.headers.get('content-type') ?? '', url: res.url || url };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Shrinks a raster icon to {@link STORED_SIZE} and measures it (see {@link needsPlate}: dark glyphs on a
 * transparent background disappear on a dark theme unless drawn on a light plate).
 * SVGs are stored untouched.
 */
async function normalizeIcon(blob: Blob): Promise<{ blob: Blob; needsPlate: boolean }> {
  if (blob.type.includes('svg') || typeof OffscreenCanvas === 'undefined') return { blob, needsPlate: false };
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, STORED_SIZE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) return { blob, needsPlate: false };
    ctx.drawImage(bitmap, 0, 0, w, h);
    const plate = needsPlate(ctx.getImageData(0, 0, w, h).data);
    return { blob: await canvas.convertToBlob({ type: 'image/png' }), needsPlate: plate };
  } catch {
    return { blob, needsPlate: false };
  }
}

/** Downloads one icon, normalises it and stores it under `origin`. Returns false if anything is off. */
export async function storeIconFromUrl(
  origin: string,
  iconUrl: string,
  source: FaviconRow['source'],
): Promise<boolean> {
  if (!isFetchableUrl(iconUrl)) return false;
  const icon = await fetchLimited(iconUrl, MAX_ICON_BYTES);
  if (!icon || icon.bytes.length === 0) return false;
  if (icon.contentType && !icon.contentType.startsWith('image/')) return false;
  try {
    const { blob, needsPlate } = await normalizeIcon(
      new Blob([icon.bytes as BlobPart], { type: icon.contentType.split(';')[0] }),
    );
    await db.favicons.put({ origin, blob, source, status: 'ok', fetchedAt: Date.now(), needsPlate });
    return true;
  } catch {
    return false;
  }
}

/** Reads the icons a site declares in its HTML, then `/favicon.ico`; records a miss if none work. */
export async function fetchSiteIcon(origin: string): Promise<boolean> {
  if (!isFetchableUrl(origin)) return false;
  const candidates: string[] = [];
  const page = await fetchLimited(`${origin}/`, MAX_HTML_BYTES, { headers: { Accept: 'text/html' } });
  if (page) candidates.push(...parseIconLinks(new TextDecoder().decode(page.bytes), page.url));
  candidates.push(`${origin}/favicon.ico`);
  for (const url of [...new Set(candidates)].slice(0, 4)) {
    if (await storeIconFromUrl(origin, url, 'site')) return true;
  }
  await db.favicons.put({ origin, source: 'none', status: 'miss', fetchedAt: Date.now() });
  return false;
}

/** Fills in missing or stale icons for the origins of `urls`, a few at a time. */
export async function ensureIcons(urls: string[], concurrency = 4): Promise<void> {
  const origins = [...new Set(urls.map(originOf).filter((o): o is string => !!o))];
  const rows = await db.favicons.bulkGet(origins);
  const todo = origins.filter((_, i) => isStale(rows[i]));
  let next = 0;
  const worker = async () => {
    while (next < todo.length) await fetchSiteIcon(todo[next++]!);
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, worker));
}
