/**
 * Pure maths for the ordered-dither backgrounds. A "field" says how dense the grain should be at
 * each point of the page; the Bayer matrix turns that density into on/off pixels.
 */

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** Density from 0 to 1 at a normalised position (`nx`, `ny` in 0..1) on a page with the given width/height ratio. */
export type Field = (nx: number, ny: number, aspect: number) => number;

/** 8x8 Bayer threshold matrix with values strictly between 0 and 1. */
export const BAYER8: number[][] = (() => {
  const grow = (m: number[][]): number[][] => {
    const n = m.length;
    const out = Array.from({ length: n * 2 }, () => new Array<number>(n * 2).fill(0));
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = m[y]![x]! * 4;
        out[y]![x] = v;
        out[y]![x + n] = v + 2;
        out[y + n]![x] = v + 3;
        out[y + n]![x + n] = v + 1;
      }
    }
    return out;
  };
  return grow(
    grow([
      [0, 2],
      [3, 1],
    ]),
  ).map((row) => row.map((v) => (v + 0.5) / 64));
})();

/** True when a pixel at (`x`, `y`) should be drawn for the given density. */
export const isDotOn = (density: number, x: number, y: number): boolean => density > BAYER8[y % 8]![x % 8]!;

export const DITHER_FIELDS = {
  /** Grain gathers toward the left and right edges and leaves the middle clear, like a frame. */
  edges: (nx, ny, _aspect) => clamp01((Math.abs(2 * nx - 1) - 0.4) / 0.6) ** 1.5 * (1 - 0.4 * ny),
  /** Light pooling from the top centre, like a dithered sky. */
  glow: (nx, ny, aspect) => clamp01(1 - Math.hypot((nx - 0.5) * aspect * 0.8, ny * 1.15) / 0.75) ** 1.7,
  /** Grain thickening toward the bottom edge. */
  horizon: (_nx, ny) => clamp01((ny - 0.35) / 0.65) ** 2.2,
  /** Flowing bands that fade out going down. */
  waves: (nx, ny, aspect) =>
    (0.5 + 0.5 * Math.sin(nx * aspect * 9 + Math.sin(ny * 5) * 1.7)) * clamp01(1 - ny) ** 1.3 * 0.9,
} satisfies Record<string, Field>;

export type DitherStyle = keyof typeof DITHER_FIELDS;
