import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/core/db';
import {
  type BrowserIcon,
  browserFaviconSrc,
  colorFor,
  hasBrowserFavicons,
  inspectBrowserIcon,
  letterFor,
} from '@/lib/favicon';
import { useObjectUrl } from '@/lib/react';
import { originOf } from '@/lib/util/url';

/** Chromium reads icons from the browser's own cache; Firefox-based browsers use Folio's cache. */
const USES_BROWSER_CACHE = hasBrowserFavicons();

/** Fallback icon: the site's first letter on a colour that is stable per site. */
export function Tile({ title, url, size }: { title: string; url: string; size: number }) {
  const color = colorFor(originOf(url) ?? title);
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center font-semibold"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size / 5),
        background: `var(--tile-${color})`,
        color: 'var(--tile-ink)',
        fontSize: size * 0.5,
      }}
    >
      {letterFor(title, url)}
    </span>
  );
}

/** What Chromium has at `src`: undefined until checked (so a tile shows first), then whether it is a real icon. */
function useBrowserIcon(src: string | undefined): (BrowserIcon & { src: string }) | undefined {
  const [verdict, setVerdict] = useState<BrowserIcon & { src: string }>();
  useEffect(() => {
    if (!src) return;
    let current = true;
    void inspectBrowserIcon(src).then((icon) => current && setVerdict({ ...icon, src }));
    return () => {
      current = false;
    };
  }, [src]);
  return verdict?.src === src ? verdict : undefined;
}

/**
 * A site's icon. The ladder is: the browser's favicon cache (Chromium), then Folio's cached copy
 * (Firefox, Zen), then a letter tile, so a row never shifts layout while an icon loads or when none exists.
 */
export function Favicon({ url, title, size = 20 }: { url: string; title: string; size?: number }) {
  const origin = originOf(url);
  const [brokenSrc, setBrokenSrc] = useState<string>();
  const row = useLiveQuery(() => (origin && !USES_BROWSER_CACHE ? db.favicons.get(origin) : undefined), [origin]);
  const cachedSrc = useObjectUrl(row?.status === 'ok' ? row.blob : undefined);

  const browserSrc = origin && USES_BROWSER_CACHE ? browserFaviconSrc(url, size >= 20 ? 32 : 16) : undefined;
  const browserIcon = useBrowserIcon(browserSrc);
  const src = !origin
    ? undefined
    : USES_BROWSER_CACHE
      ? browserIcon && !browserIcon.placeholder
        ? browserSrc
        : undefined
      : cachedSrc;
  if (!src || src === brokenSrc) return <Tile title={title} url={url} size={size} />;

  // Only dark glyphs on a transparent background need a light plate on the dark theme (the CSS variable is
  // empty in light). An icon with its own background is shown as designed, with no frame.
  const plate = USES_BROWSER_CACHE ? browserIcon?.needsPlate : row?.needsPlate;
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      draggable={false}
      onError={() => setBrokenSrc(src)}
      className="shrink-0 object-contain"
      style={{
        borderRadius: Math.round(size / 5),
        background: plate ? 'var(--plate)' : undefined,
        padding: plate && size >= 20 ? 1 : 0,
        outline: '1px solid #0000000d',
        outlineOffset: -1,
      }}
    />
  );
}
