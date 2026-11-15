import { describe, expect, it } from 'vitest';
import { BAYER8, DITHER_FIELDS, isDotOn } from './dither';
import { fbm, marbleDensity } from './marble';
import {
  CALM_FLOOR,
  MEADOW_PALETTES,
  cloudAt,
  grainTile,
  horizonAt,
  meadowColor,
  meadowWeight,
  paintMeadow,
} from './meadow';

describe('Bayer matrix', () => {
  it('is 8x8 with 64 distinct thresholds strictly inside (0, 1)', () => {
    const values = BAYER8.flat();
    expect(BAYER8).toHaveLength(8);
    expect(BAYER8.every((row) => row.length === 8)).toBe(true);
    expect(new Set(values).size).toBe(64);
    expect(Math.min(...values)).toBeGreaterThan(0);
    expect(Math.max(...values)).toBeLessThan(1);
  });

  it('draws a fraction of dots that matches the density', () => {
    let on = 0;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (isDotOn(0.5, x, y)) on++;
    expect(on).toBe(32);
  });

  it('draws nothing at zero density and everything at full density', () => {
    expect(isDotOn(0, 3, 3)).toBe(false);
    expect(isDotOn(1, 3, 3)).toBe(true);
  });
});

describe('dither fields', () => {
  it.each(Object.entries(DITHER_FIELDS))('%s stays within 0..1 over the page', (_name, field) => {
    for (let nx = 0; nx <= 1; nx += 0.1) {
      for (let ny = 0; ny <= 1; ny += 0.1) {
        const v = field(nx, ny, 1.6);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('edges leaves the centre empty and fills the sides', () => {
    expect(DITHER_FIELDS.edges(0.5, 0.2, 1.6)).toBe(0);
    expect(DITHER_FIELDS.edges(0.02, 0.2, 1.6)).toBeGreaterThan(0.5);
  });
});

describe('marble', () => {
  it('is deterministic', () => {
    expect(marbleDensity(120, 340)).toBe(marbleDensity(120, 340));
  });

  it('stays within 0..1 and varies across the page', () => {
    const samples: number[] = [];
    for (let x = 0; x < 1500; x += 50) for (let y = 0; y < 900; y += 50) samples.push(marbleDensity(x, y));
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...samples)).toBeLessThanOrEqual(1);
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.5);
  });

  it('fbm is continuous: nearby points give nearby values', () => {
    expect(Math.abs(fbm(2.0, 2.0) - fbm(2.001, 2.0))).toBeLessThan(0.01);
  });
});

describe('meadow', () => {
  const W = 1440;
  const H = 900;
  const aspect = W / H;
  const palettes = Object.entries(MEADOW_PALETTES);

  it('is deterministic', () => {
    const p = MEADOW_PALETTES.dark;
    expect(meadowColor(0.2, 0.3, aspect, p)).toEqual(meadowColor(0.2, 0.3, aspect, p));
    expect(paintMeadow(24, 16, W, H, p, 1)).toEqual(paintMeadow(24, 16, W, H, p, 1));
    expect(grainTile(16)).toEqual(grainTile(16));
  });

  it.each(palettes)('%s colours stay within 0..255', (_name, p) => {
    for (let nx = 0; nx <= 1; nx += 0.05) {
      for (let ny = 0; ny <= 1; ny += 0.05) {
        for (const v of meadowColor(nx, ny, aspect, p)) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(255);
        }
      }
    }
  });

  it('paints sky above the horizon and meadow below it', () => {
    const p = { ...MEADOW_PALETTES.dark, vignette: 0, saturation: 1 };
    const [r, g, b] = meadowColor(0.1, 0.97, aspect, p);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
    const [sr, , sb] = meadowColor(0.9, 0.45, aspect, p);
    expect(sb).toBeGreaterThan(sr);
    expect(horizonAt(1)).toBeGreaterThan(0.6);
    expect(horizonAt(1)).toBeLessThan(0.9);
  });

  it('has a cloud streak near the top and none lower down', () => {
    let top = 0;
    let middle = 0;
    for (let nx = 0; nx <= 1; nx += 0.01) {
      top = Math.max(top, cloudAt(nx, 0.11 - 0.07 * (nx - 0.5), aspect));
      middle = Math.max(middle, cloudAt(nx, 0.5, aspect));
    }
    expect(top).toBeGreaterThan(0.5);
    expect(middle).toBeLessThan(0.01);
  });

  it('keeps the content column calm and lets the gutters carry the scene', () => {
    expect(meadowWeight(W / 2, H / 2, W, H)).toBeCloseTo(CALM_FLOOR);
    expect(meadowWeight(W / 2 + 300, H / 2, W, H)).toBeLessThan(0.15);
    expect(meadowWeight(20, H / 2, W, H)).toBeGreaterThan(0.9);
    expect(meadowWeight(W - 20, H / 2, W, H)).toBeGreaterThan(0.9);
    // a little more along the top (sky) and bottom (meadow) edges, but never as much as the gutters
    expect(meadowWeight(W / 2, 2, W, H)).toBeGreaterThan(0.4);
    expect(meadowWeight(W / 2, H - 2, W, H)).toBeGreaterThan(0.3);
    expect(meadowWeight(W / 2, H - 2, W, H)).toBeLessThan(0.6);
  });

  it('paints transparent pixels in the middle and opaque ones at the edges, scaled by strength', () => {
    const w = 72;
    const h = 45;
    const [cx, cy] = [Math.floor(w / 2), Math.floor(h / 2)];
    const alphaAt = (buf: Uint8ClampedArray, i: number, j: number) => buf[(j * w + i) * 4 + 3]!;
    const soft = paintMeadow(w, h, W, H, MEADOW_PALETTES.light, 0.6);
    const strong = paintMeadow(w, h, W, H, MEADOW_PALETTES.light, 1);
    expect(alphaAt(strong, cx, cy)).toBeLessThan(alphaAt(strong, 1, cy) / 4);
    expect(alphaAt(soft, 1, cy)).toBeLessThan(alphaAt(strong, 1, cy));
  });

  it('light print is paler than the dark one', () => {
    const lum = ([r, g, b]: number[]) => 0.299 * r! + 0.587 * g! + 0.114 * b!;
    for (const [nx, ny] of [
      [0.1, 0.1],
      [0.1, 0.5],
      [0.9, 0.95],
    ] as const) {
      expect(lum(meadowColor(nx, ny, aspect, MEADOW_PALETTES.light))).toBeGreaterThan(
        lum(meadowColor(nx, ny, aspect, MEADOW_PALETTES.dark)) + 40,
      );
    }
  });

  it('grain tile mixes dark and light specks around mid grey', () => {
    const tile = grainTile(64);
    let dark = 0;
    let alpha = 0;
    for (let i = 0; i < tile.length; i += 4) {
      if (tile[i] === 0) dark++;
      alpha += tile[i + 3]!;
    }
    const n = tile.length / 4;
    expect(dark / n).toBeGreaterThan(0.4);
    expect(dark / n).toBeLessThan(0.6);
    expect(alpha / n).toBeGreaterThan(40);
    expect(alpha / n).toBeLessThan(140);
  });
});
