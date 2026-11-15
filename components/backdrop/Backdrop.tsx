import { type RefObject, useEffect, useRef, useState } from 'react';
import type { Background } from '@/lib/react';
import { DITHER_FIELDS, type DitherStyle, type Field, isDotOn } from './dither';
import { marbleDensity } from './marble';
import { MEADOW_PALETTES, grainTile, paintMeadow } from './meadow';

type Intensity = Background['intensity'];

/** CSS pixels per dither cell. */
const DITHER_CELL = 3;
/** Distance in CSS pixels between marble dots. */
const MARBLE_PITCH = 7;

const DITHER_STRENGTH: Record<Intensity, number> = { soft: 0.5, medium: 0.75, strong: 1 };
const MARBLE_STRENGTH: Record<Intensity, number> = { soft: 0.6, medium: 0.85, strong: 1.1 };
const MEADOW_STRENGTH: Record<Intensity, number> = { soft: 0.6, medium: 0.8, strong: 1 };
/** The meadow is painted at this fraction of the page size and smoothed up by the browser. */
const MEADOW_SCALE = 1 / 5;
/** Side length in CSS pixels of the repeating film-grain tile. */
const GRAIN_TILE = 128;

/** Dither styles keep the middle column clear; only the side margins show grain. */
const GUTTER_MASK =
  'linear-gradient(to right, #000 0, #000 calc(50% - 470px), transparent calc(50% - 380px), transparent calc(50% + 380px), #000 calc(50% + 470px), #000 100%)';
/** Marble fades the middle to a low floor instead of removing it. */
const MARBLE_MASK =
  'linear-gradient(to right, #000 0, #000 calc(50% - 520px), rgba(0,0,0,0.22) calc(50% - 360px), rgba(0,0,0,0.22) calc(50% + 360px), #000 calc(50% + 520px), #000 100%)';

/** Grain is heaviest in the gutters and faint over the list, like the meadow itself. */
const GRAIN_MASK =
  'linear-gradient(to right, #000 0, #000 calc(50% - 700px), rgba(0,0,0,0.3) calc(50% - 340px), rgba(0,0,0,0.3) calc(50% + 340px), #000 calc(50% + 700px), #000 100%)';

/** Resolves a CSS custom property (such as `--ink`) to RGB so canvases can use theme colours. */
function themeColor(name: string): [number, number, number] {
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#000';
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r!, g!, b!];
}

/** Runs `draw` now, and again whenever the window is resized or the theme changes. */
function useRedraw(
  canvas: RefObject<HTMLCanvasElement | null>,
  draw: (canvas: HTMLCanvasElement) => void,
  deps: unknown[],
) {
  useEffect(() => {
    const el = canvas.current!;
    const run = () => draw(el);
    // a drag-resize fires many events; redraw once it settles
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(run, 120);
    };
    run();
    addEventListener('resize', onResize);
    const observer = new MutationObserver(run);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      clearTimeout(timer);
      removeEventListener('resize', onResize);
      observer.disconnect();
    };
    // `draw` closes over `deps` only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function DitherCanvas({ field, intensity }: { field: Field; intensity: Intensity }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useRedraw(
    ref,
    (canvas) => {
      const w = Math.max(1, Math.ceil(innerWidth / DITHER_CELL));
      const h = Math.max(1, Math.ceil(innerHeight / DITHER_CELL));
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      const image = ctx.createImageData(w, h);
      const [r, g, b] = themeColor('--ink');
      const strength = DITHER_STRENGTH[intensity];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (!isDotOn(field(x / w, y / h, w / h) * strength, x, y)) continue;
          const o = (y * w + x) * 4;
          image.data.set([r, g, b, 26], o);
        }
      }
      ctx.putImageData(image, 0, 0);
    },
    [field, intensity],
  );
  return <canvas ref={ref} className="h-full w-full" style={{ imageRendering: 'pixelated' }} />;
}

function MarbleCanvas({ intensity }: { intensity: Intensity }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useRedraw(
    ref,
    (canvas) => {
      const width = innerWidth;
      const height = innerHeight;
      const dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.ceil(width * dpr);
      canvas.height = Math.ceil(height * dpr);
      const ctx = canvas.getContext('2d')!;
      ctx.scale(dpr, dpr);
      const [r, g, b] = themeColor('--ink');
      const dark = document.documentElement.dataset.theme === 'dark';
      ctx.fillStyle = `rgba(${r},${g},${b},${dark ? 0.55 : 0.42})`;
      const scale = MARBLE_STRENGTH[intensity];
      ctx.beginPath();
      for (let y = MARBLE_PITCH / 2; y < height; y += MARBLE_PITCH) {
        for (let x = MARBLE_PITCH / 2; x < width; x += MARBLE_PITCH) {
          const radius = MARBLE_PITCH * 0.5 * Math.sqrt(marbleDensity(x, y)) * scale;
          if (radius < 0.35) continue;
          ctx.moveTo(x + radius, y);
          ctx.arc(x, y, radius, 0, Math.PI * 2);
        }
      }
      ctx.fill();
    },
    [intensity],
  );
  return <canvas ref={ref} className="h-full w-full" />;
}

/** Data URL of the film-grain tile, made once per page. */
let grainUrl: string | undefined;
function grainImage(): string {
  if (grainUrl) return grainUrl;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = GRAIN_TILE;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(new ImageData(grainTile(GRAIN_TILE), GRAIN_TILE, GRAIN_TILE), 0, 0);
  return (grainUrl = canvas.toDataURL('image/png'));
}

/** The painted dusk meadow: a small canvas stretched over the page, with a static grain tile on top. */
function MeadowCanvas({ intensity }: { intensity: Intensity }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dark = useDarkTheme();
  useRedraw(
    ref,
    (canvas) => {
      const w = Math.max(1, Math.ceil(innerWidth * MEADOW_SCALE));
      const h = Math.max(1, Math.ceil(innerHeight * MEADOW_SCALE));
      canvas.width = w;
      canvas.height = h;
      const palette = MEADOW_PALETTES[document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'];
      const pixels = paintMeadow(w, h, innerWidth, innerHeight, palette, MEADOW_STRENGTH[intensity]);
      canvas.getContext('2d')!.putImageData(new ImageData(pixels, w, h), 0, 0);
    },
    [intensity],
  );
  const grain = (dark ? 0.16 : 0.11) * MEADOW_STRENGTH[intensity];
  return (
    <>
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${grainImage()})`,
          backgroundSize: `${GRAIN_TILE}px`,
          opacity: grain,
          WebkitMaskImage: GRAIN_MASK,
          maskImage: GRAIN_MASK,
        }}
      />
    </>
  );
}

/** True while the dark theme is on; follows changes to `data-theme`. */
function useDarkTheme(): boolean {
  const read = () => document.documentElement.dataset.theme === 'dark';
  const [dark, setDark] = useState(read);
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

/** Full-page background behind the dashboard: a generated pattern or the user's own image. */
export function Backdrop({
  style,
  intensity,
  imageUrl,
}: {
  style: Background['style'];
  intensity: Intensity;
  imageUrl?: string;
}) {
  if (style === 'none') return null;
  // the meadow fades itself (see `meadowWeight`), so it needs no mask here
  const mask = style === 'marble' ? MARBLE_MASK : style === 'meadow' ? undefined : GUTTER_MASK;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={mask && style !== 'image' ? { WebkitMaskImage: mask, maskImage: mask } : undefined}
    >
      {style === 'image' ? (
        imageUrl && (
          <>
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${imageUrl})` }} />
            {/* dims the picture so text stays readable in both themes */}
            <div
              className="absolute inset-0"
              style={{ background: 'color-mix(in srgb, var(--ground) 78%, transparent)', backdropFilter: 'blur(2px)' }}
            />
          </>
        )
      ) : style === 'marble' ? (
        <MarbleCanvas intensity={intensity} />
      ) : style === 'meadow' ? (
        <MeadowCanvas intensity={intensity} />
      ) : (
        <DitherCanvas field={DITHER_FIELDS[style as DitherStyle]} intensity={intensity} />
      )}
    </div>
  );
}
