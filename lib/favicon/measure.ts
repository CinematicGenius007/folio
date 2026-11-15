/** RGBA pixel data, as returned by `getImageData`. */
type Pixels = ArrayLike<number>;

/** Below this mean luminance (0 to 1) the drawn part of an icon counts as dark. */
const DARK_MEAN = 0.28;
/** An icon is "mostly transparent" when more than this share of its pixels is see-through. */
const TRANSPARENT_SHARE = 0.25;

/**
 * Whether an icon would disappear on a dark theme unless drawn on a light plate: its drawn pixels are dark
 * **and** much of the image is transparent, as with a black logo on nothing.
 *
 * A dark icon that fills its square (a rounded dark tile, for example) is a finished design on its own
 * background, so plating it would only add a white frame. Its transparent corners are a few percent of the
 * image, well below the threshold.
 */
export function needsPlate(pixels: Pixels): boolean {
  let luminance = 0;
  let opaque = 0;
  const total = Math.floor(pixels.length / 4);
  for (let i = 0; i < total * 4; i += 4) {
    if ((pixels[i + 3] ?? 0) < 128) continue;
    luminance += 0.2126 * (pixels[i] ?? 0) + 0.7152 * (pixels[i + 1] ?? 0) + 0.0722 * (pixels[i + 2] ?? 0);
    opaque++;
  }
  if (!total || !opaque) return false;
  const mean = luminance / opaque / 255;
  return mean < DARK_MEAN && 1 - opaque / total > TRANSPARENT_SHARE;
}
