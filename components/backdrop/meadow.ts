import { clamp01 } from './dither';
import { hash2, smoothstep, valueNoise } from './marble';

/**
 * Pure maths for the "Meadow" background: a toned-down version of the landing page's painted
 * scene (navy dusk sky, a coral cloud streak, a rolling green hill with a few flowers), faded into
 * the page so it frames the content instead of sitting behind it.
 *
 * Everything here is deterministic and resolution independent: the canvas samples it at a low
 * resolution and lets the browser smooth the upscale, which is also what makes it look soft.
 */

export type Rgb = [number, number, number];

/** The colours and finish of the scene for one theme. */
export interface MeadowPalette {
  skyTop: Rgb;
  skyMid: Rgb;
  /** Teal glow just above the horizon. */
  skyLow: Rgb;
  cloud: Rgb;
  /** Hotter colour in the densest part of the cloud. */
  cloudCore: Rgb;
  meadowHigh: Rgb;
  meadowLow: Rgb;
  flower: Rgb;
  /** 1 keeps colours, 0 is greyscale. */
  saturation: number;
  /** How much the corners darken, 0..1. */
  vignette: number;
  /** Opacity where the scene is fully shown (the side gutters), before the intensity setting. */
  opacity: number;
}

const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export const MEADOW_PALETTES: Record<'light' | 'dark', MeadowPalette> = {
  // The landing page colours, a little subdued.
  dark: {
    skyTop: hex('#0b1022'),
    skyMid: hex('#1b3248'),
    skyLow: hex('#2a6470'),
    cloud: hex('#e8402c'),
    cloudCore: hex('#ff5a36'),
    meadowHigh: hex('#557f36'),
    meadowLow: hex('#2b4f20'),
    flower: hex('#f2d14a'),
    saturation: 0.78,
    vignette: 0.4,
    opacity: 0.8,
  },
  // A sun-faded print: the same hues lifted toward paper, so the light theme stays clean, not muddy.
  light: {
    skyTop: hex('#7389b4'),
    skyMid: hex('#98b6ca'),
    skyLow: hex('#b4d4cf'),
    cloud: hex('#ee8a76'),
    cloudCore: hex('#f59a7c'),
    meadowHigh: hex('#a9c18d'),
    meadowLow: hex('#89a774'),
    flower: hex('#f0d260'),
    saturation: 0.8,
    vignette: 0.12,
    opacity: 0.62,
  },
};

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** Fractal value noise with a chosen number of octaves, roughly 0..1. Fewer octaves is cheaper and softer. */
export function fbmN(x: number, y: number, octaves: number): number {
  let sum = 0;
  let amplitude = 0.5;
  let norm = 0;
  let frequency = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amplitude * valueNoise(x * frequency, y * frequency);
    norm += amplitude;
    frequency *= 2.03;
    amplitude *= 0.5;
  }
  return sum / norm;
}

/** Height of the hill's ridge (0 = top of the page, 1 = bottom) at horizontal position `x` in aspect units. */
export function horizonAt(x: number): number {
  return (
    0.76 + 0.04 * Math.sin(x * 1.7 + 0.8) + 0.02 * Math.sin(x * 4.3 + 2) + 0.05 * (fbmN(x * 0.9 + 11, 4.2, 3) - 0.5)
  );
}

/** Density of the coral cloud streak, 0..1: a horizontally stretched, slightly tilted band of wisps near the top. */
export function cloudAt(nx: number, ny: number, aspect: number): number {
  const x = nx * aspect;
  const centre = 0.11 - 0.07 * (nx - 0.5) + 0.025 * Math.sin(x * 1.3 + 1);
  // domain warp makes the band ragged; stretching x makes the wisps long and thin
  const warp = (fbmN(x * 1.1 + 5, ny * 3 + 3, 3) - 0.5) * 0.09;
  const u = (ny - centre + warp) / 0.05;
  const band = Math.exp(-u * u);
  const wisps = smoothstep(0.32, 0.72, fbmN(x * 1.6 + 1.3, ny * 16 + 7, 4));
  // the streak is thicker on the left and thins out to the right, like a brush stroke
  const stroke = 0.55 + 0.45 * smoothstep(1.1, 0.1, nx);
  return clamp01(band * wisps * stroke * 1.3);
}

/** Colour of the painted scene at a normalised position, before it is faded into the page. */
export function meadowColor(nx: number, ny: number, aspect: number, p: MeadowPalette): Rgb {
  const x = nx * aspect;
  const horizon = horizonAt(x);
  let c: Rgb;

  if (ny < horizon + 0.01) {
    const t = clamp01(ny / horizon);
    c = t < 0.55 ? mix(p.skyTop, p.skyMid, t / 0.55) : mix(p.skyMid, p.skyLow, ((t - 0.55) / 0.45) ** 1.4);
    // painted, uneven sky
    const mottle = 1 + (fbmN(x * 2.5, ny * 4, 3) - 0.5) * 0.12;
    c = [c[0] * mottle, c[1] * mottle, c[2] * mottle];
    const cloud = cloudAt(nx, ny, aspect);
    // halation: a broad warm bloom around the streak
    const bloom = Math.exp(-(((ny - 0.11 + 0.07 * (nx - 0.5)) / 0.16) ** 2)) * 0.2;
    c = mix(c, p.cloud, bloom);
    c = mix(c, mix(p.cloud, p.cloudCore, smoothstep(0.5, 0.95, cloud)), cloud * 0.92);
  } else {
    c = p.skyLow;
  }

  if (ny > horizon - 0.01) {
    const depth = clamp01((ny - horizon) / (1 - horizon));
    let g = mix(p.meadowHigh, p.meadowLow, depth ** 0.7);
    // mottled clumps of grass
    const clump = 0.86 + 0.28 * fbmN(x * 7 + 2, ny * 11, 3);
    g = [g[0] * clump, g[1] * clump, g[2] * clump];
    // a few faint flowers, on a fixed grid in page units so they do not depend on resolution
    const fx = Math.floor(x * 60);
    const fy = Math.floor(ny * 90);
    if (depth > 0.12 && hash2(fx + 17, fy + 91) > 0.99) g = mix(g, p.flower, 0.4);
    c = mix(c, g, smoothstep(horizon - 0.006, horizon + 0.006, ny));
  }

  // slight desaturation and a vignette, like an old print
  const lum = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  c = [lum + (c[0] - lum) * p.saturation, lum + (c[1] - lum) * p.saturation, lum + (c[2] - lum) * p.saturation];
  const r = Math.hypot((nx - 0.5) * 1.4, ny - 0.5) / 0.86;
  const shade = 1 - p.vignette * smoothstep(0.45, 1.05, r);
  return [
    clamp01((c[0] * shade) / 255) * 255,
    clamp01((c[1] * shade) / 255) * 255,
    clamp01((c[2] * shade) / 255) * 255,
  ];
}

/** Half-width in CSS pixels of the area the scene keeps calm: the 672 px content column plus a margin. */
export const CALM_HALF_WIDTH = 360;
/** Opacity floor inside the calm column, as a fraction of the full opacity. */
export const CALM_FLOOR = 0.1;

/**
 * How much of the scene shows at a point, 0..1. Full in the side gutters, a low floor behind the
 * content column, with a little extra along the top edge (sky and cloud) and the bottom edge (meadow).
 * The calm area is a soft, slightly wavering oval rather than a straight column, so its edge reads
 * as painted, not as a stripe. Positions are CSS pixels so the calm area matches the real list
 * width at every window size.
 */
export function meadowWeight(x: number, y: number, width: number, height: number): number {
  const ny = y / height;
  const top = 1 - smoothstep(0.015, 0.16, ny);
  const bottom = smoothstep(0.86, 1, ny);
  // the scene reaches further in near the top and bottom edges, and its edge wanders a little
  const reach = 150 * Math.max(top, bottom) ** 1.5 + (fbmN(ny * 3 + 40, 1.7, 2) - 0.5) * 80;
  const side = smoothstep(CALM_HALF_WIDTH - 20, CALM_HALF_WIDTH + 360, Math.abs(x - width / 2) + reach);
  return CALM_FLOOR + (1 - CALM_FLOOR) * Math.max(side, 0.5 * top, 0.35 * bottom);
}

/**
 * Paints the scene into an RGBA buffer `w` x `h` pixels, standing for a page of `pageWidth` x
 * `pageHeight` CSS pixels. `strength` scales the opacity (the user's intensity setting).
 */
export function paintMeadow(
  w: number,
  h: number,
  pageWidth: number,
  pageHeight: number,
  palette: MeadowPalette,
  strength: number,
): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(w * h * 4);
  const aspect = pageWidth / pageHeight;
  for (let j = 0; j < h; j++) {
    const ny = (j + 0.5) / h;
    for (let i = 0; i < w; i++) {
      const nx = (i + 0.5) / w;
      const [r, g, b] = meadowColor(nx, ny, aspect, palette);
      const alpha = meadowWeight(nx * pageWidth, ny * pageHeight, pageWidth, pageHeight) * palette.opacity * strength;
      const o = (j * w + i) * 4;
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = clamp01(alpha) * 255;
    }
  }
  return out;
}

/**
 * A square tile of film grain as RGBA: each pixel is a black or white speck with an alpha that
 * follows its distance from mid grey, so the tile darkens and lightens any background evenly.
 * Seeded, so the grain is identical on every load.
 */
export function grainTile(size: number, seed = 7): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // sum of two hashes leans toward the middle, like real grain
      const v = (hash2(x + seed * 131, y) + hash2(x, y + seed * 977)) / 2;
      const o = (y * size + x) * 4;
      const tone = v > 0.5 ? 255 : 0;
      out[o] = out[o + 1] = out[o + 2] = tone;
      out[o + 3] = Math.abs(v - 0.5) * 2 * 255;
    }
  }
  return out;
}
