#!/usr/bin/env node
// Draws the Folio icon into public/icon/{16,32,48,96,128}.png.
// Dependency-free: rasterises with 4x supersampling and encodes PNG by hand.
//
//   node scripts/generate-icons.mjs                  write the default variant into public/icon/
//   node scripts/generate-icons.mjs halftone         write another variant
//   node scripts/generate-icons.mjs --sheet out.png  write a side-by-side preview of every variant
//
// The mark is a rounded tile with six small dots fading out from the bottom-right corner: no letter, nothing busy.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SIZES = [16, 32, 48, 96, 128];
const OUT_DIR = fileURLToPath(new URL('../public/icon/', import.meta.url));
const SUPERSAMPLE = 4;
const PAGE = [0xfd, 0xfd, 0xff]; // preview sheet background

const DARK = [0x52, 0x52, 0x5c]; // --primary, Overcast
const LIGHT = [0xfd, 0xfd, 0xff]; // --on-primary
const PAPER = [0xf1, 0xf1, 0xf5];

const inRoundedSquare = (x, y, radius) => {
  const dx = Math.max(radius - x, x - (1 - radius), 0);
  const dy = Math.max(radius - y, y - (1 - radius), 0);
  return dx * dx + dy * dy <= radius * radius;
};

/** The six dots, as [centre x, centre y, opacity] on a 28-unit tile: a triangle of 3, 2 and 1 dots fading out from the corner. */
const DOTS = [
  [22, 22, 1],
  [18, 22, 0.75],
  [22, 18, 0.75],
  [14, 22, 0.5],
  [18, 18, 0.5],
  [22, 14, 0.5],
];
const DOT_RADIUS = 1.45;

/** Opacity (0..1) of the dots at a point on the tile, 0 where there is none. */
const dotsAt = (x, y) => {
  for (const [cx, cy, opacity] of DOTS) {
    if (Math.hypot(x * 28 - cx, y * 28 - cy) <= DOT_RADIUS) return opacity;
  }
  return 0;
};

/**
 * Each variant says how much of the `grain` colour to blend over the `tile` colour at a point (0..1).
 */
const VARIANTS = {
  /** Charcoal tile, light dots. */
  dots: { tile: DARK, grain: LIGHT, at: dotsAt },
  /** Light tile, dark dots, for light browser chrome. */
  light: { tile: PAPER, grain: DARK, at: dotsAt },
};
const DEFAULT_VARIANT = 'dots';

function render(size, variant) {
  const spec = VARIANTS[variant];
  const pixels = Buffer.alloc(size * size * 4);
  const n = SUPERSAMPLE * SUPERSAMPLE;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const x = (px + (sx + 0.5) / SUPERSAMPLE) / size;
          const y = (py + (sy + 0.5) / SUPERSAMPLE) / size;
          if (!inRoundedSquare(x, y, 0.22)) continue;
          const amount = Number(spec.at(x, y));
          r += spec.tile[0] + (spec.grain[0] - spec.tile[0]) * amount;
          g += spec.tile[1] + (spec.grain[1] - spec.tile[1]) * amount;
          b += spec.tile[2] + (spec.grain[2] - spec.tile[2]) * amount;
          a++;
        }
      }
      const o = (py * size + px) * 4;
      pixels[o] = a ? Math.round(r / a) : 0;
      pixels[o + 1] = a ? Math.round(g / a) : 0;
      pixels[o + 2] = a ? Math.round(b / a) : 0;
      pixels[o + 3] = Math.round((a / n) * 255);
    }
  }
  return pixels;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};

function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) rgba.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A preview sheet: every variant at 128, 48 and 16 px on the page colour. */
function writeSheet(path) {
  const names = Object.keys(VARIANTS);
  const pad = 24;
  const width = pad + names.length * (128 + pad);
  const height = pad * 3 + 128 + 48 + 16;
  const sheet = Buffer.alloc(width * height * 4);
  for (let i = 0; i < sheet.length; i += 4) sheet.set([...PAGE, 255], i);
  const paste = (size, left, top, variant) => {
    const icon = render(size, variant);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const s = (y * size + x) * 4;
        const d = ((top + y) * width + left + x) * 4;
        const alpha = icon[s + 3] / 255;
        for (let c = 0; c < 3; c++) sheet[d + c] = Math.round(icon[s + c] * alpha + sheet[d + c] * (1 - alpha));
      }
    }
  };
  names.forEach((name, i) => {
    const left = pad + i * (128 + pad);
    paste(128, left, pad, name);
    paste(48, left, pad * 2 + 128, name);
    paste(16, left + 48 + 16, pad * 2 + 128 + 16, name);
  });
  writeFileSync(path, encodePng(width, height, sheet));
  console.log(`${path}: ${names.join(', ')}`);
}

const arg = process.argv[2];
if (arg === '--sheet') {
  writeSheet(process.argv[3] ?? 'icon-variants.png');
} else {
  const variant = arg ?? DEFAULT_VARIANT;
  if (!VARIANTS[variant]) {
    console.error(`Unknown variant "${variant}". Choose one of: ${Object.keys(VARIANTS).join(', ')}`);
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  for (const size of SIZES) {
    writeFileSync(`${OUT_DIR}${size}.png`, encodePng(size, size, render(size, variant)));
    console.log(`public/icon/${size}.png (${variant})`);
  }
}
