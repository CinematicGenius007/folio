import { describe, expect, it } from 'vitest';
import { needsPlate } from './measure';

/** Builds RGBA pixels: `count` pixels of the given colour, then `rest` fully transparent ones. */
function pixels(count: number, rgba: [number, number, number, number], rest = 0): Uint8ClampedArray {
  const data = new Uint8ClampedArray((count + rest) * 4);
  for (let i = 0; i < count; i++) data.set(rgba, i * 4);
  return data;
}

describe('needsPlate', () => {
  it('plates a dark glyph on a transparent background', () => {
    expect(needsPlate(pixels(30, [10, 10, 10, 255], 70))).toBe(true);
  });

  it('does not plate a dark icon that fills its square, such as a dark rounded tile', () => {
    expect(needsPlate(pixels(97, [20, 30, 50, 255], 3))).toBe(false);
  });

  it('does not plate a fully opaque dark icon', () => {
    expect(needsPlate(pixels(100, [0, 0, 0, 255]))).toBe(false);
  });

  it('does not plate a light glyph on a transparent background', () => {
    expect(needsPlate(pixels(30, [240, 240, 240, 255], 70))).toBe(false);
  });

  it('does not plate an empty or fully transparent icon', () => {
    expect(needsPlate(new Uint8ClampedArray(0))).toBe(false);
    expect(needsPlate(pixels(0, [0, 0, 0, 0], 100))).toBe(false);
  });

  it('ignores faint, semi-transparent pixels when judging the drawn colour', () => {
    // 20 dark opaque pixels and 80 nearly invisible light ones: the dark part is what is drawn.
    const data = new Uint8ClampedArray(100 * 4);
    for (let i = 0; i < 20; i++) data.set([5, 5, 5, 255], i * 4);
    for (let i = 20; i < 100; i++) data.set([255, 255, 255, 40], i * 4);
    expect(needsPlate(data)).toBe(true);
  });
});
