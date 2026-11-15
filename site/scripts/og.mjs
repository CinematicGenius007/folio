// Renders the social preview image (public/og.jpg) and the PNG favicons from HTML/SVG in headless Chromium.
// Uses the repo's playwright-core, so run it from the repo root after `pnpm install`:
//
//   node site/scripts/og.mjs
//
// The outputs are committed; the Vercel build does not run this.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const SITE = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(SITE, 'public');
const asset = (p) => pathToFileURL(join(PUBLIC, p)).href;

const DOTS = `<g fill="#f4ead2"><circle cx="22" cy="22" r="1.9"/><circle cx="17" cy="22" r="1.9" fill-opacity=".75"/><circle cx="22" cy="17" r="1.9" fill-opacity=".75"/><circle cx="12" cy="22" r="1.9" fill-opacity=".5"/><circle cx="17" cy="17" r="1.9" fill-opacity=".5"/><circle cx="22" cy="12" r="1.9" fill-opacity=".5"/></g>`;
const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141d36"/><stop offset="1" stop-color="#1f4d5c"/></linearGradient></defs><rect width="28" height="28" rx="7" fill="url(#s)"/>${DOTS}</svg>\n`;
writeFileSync(join(PUBLIC, 'favicon.svg'), FAVICON);

const css = readFileSync(join(SITE, 'src', 'styles.css'), 'utf8').replaceAll(
  "url('/",
  "url('" + pathToFileURL(PUBLIC).href + '/',
);

const OG = `<!doctype html><html><head><meta charset="utf-8"><style>${css}
body::after{opacity:.38}
.og{width:1200px;height:630px;position:relative;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;padding:0 0 92px;text-align:center;
  background:#3e682c url('${asset('assets/hero-1920.webp')}') 58% 100%/cover no-repeat}
.og h1{font-size:118px;line-height:1}
.og p{margin-top:22px;font-style:italic;font-size:30px;color:#faf2de;text-shadow:0 0 14px rgba(16,34,14,.9),0 0 40px rgba(16,34,14,.55)}
.og .brand{position:absolute;top:40px;left:52px;font-size:34px}
</style></head><body style="margin:0;width:1200px;height:630px;overflow:hidden">
<div class="og"><span class="brand"><svg width="40" height="40" viewBox="0 0 28 28">${DOTS}</svg>Folio</span>
<h1 class="ink ink--sky">Bookmarks, set free.</h1>
<p>A keyboard-first home for your browser’s own bookmarks.</p></div></body></html>`;

const browser = await chromium.launch({ args: ['--headless=new'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
// file:// assets only load from a file:// page, so the card is written to a temporary file first
const tmp = mkdtempSync(join(tmpdir(), 'folio-og-'));
writeFileSync(join(tmp, 'og.html'), OG);
await page.goto(pathToFileURL(join(tmp, 'og.html')).href, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(PUBLIC, 'og.jpg'), type: 'jpeg', quality: 86 });
rmSync(tmp, { recursive: true, force: true });

for (const [size, name] of [
  [32, 'favicon-32.png'],
  [180, 'apple-touch-icon.png'],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0">${FAVICON.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`,
  );
  await page.screenshot({ path: join(PUBLIC, name), omitBackground: true });
}
await browser.close();
console.log('wrote og.jpg, favicon.svg, favicon-32.png, apple-touch-icon.png');
