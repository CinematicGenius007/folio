import { clamp01 } from './dither';

/**
 * Smoky "marble" texture: domain-warped fractal value noise. The result is deterministic, so the
 * background looks the same on every load and in every window.
 */

/** Integer lattice hash to 0..1. */
export function hash2(x: number, y: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smoothly interpolated value noise, 0..1. */
export function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Five octaves of value noise, roughly 0..1. */
export function fbm(x: number, y: number): number {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let i = 0; i < 5; i++) {
    sum += amplitude * valueNoise(x * frequency, y * frequency);
    frequency *= 2.03;
    amplitude *= 0.5;
  }
  return sum;
}

export const smoothstep = (edge0: number, edge1: number, v: number): number => {
  const t = clamp01((v - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/** Pixels per unit of noise space; larger means broader cloud shapes. */
const NOISE_SCALE = 1 / 380;

/** Dot density 0..1 of the marble texture at a page position in CSS pixels. */
export function marbleDensity(x: number, y: number): number {
  const px = x * NOISE_SCALE;
  const py = y * NOISE_SCALE;
  const q = fbm(px + 3.1, py + 1.7);
  const w = fbm(px + 3.6 * q + 8.3, py + 3.6 * q + 2.9);
  return smoothstep(0.34, 0.8, fbm(px + 3.2 * w, py + 3.2 * w));
}
