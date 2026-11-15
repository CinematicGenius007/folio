#!/usr/bin/env node
// Renders the Chrome Web Store listing images into docs/store from the real extension and sample data.
//   pnpm store-assets        (builds the test build first)
//
// Screenshots are 1280x800 JPEGs (the store accepts 1280x800 or 640x400, JPEG or 24-bit PNG); the small
// promo tile is 440x280. See docs/CHROME-STORE.md for the listing text that goes with them.
import { chromium } from 'playwright-core';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SAMPLE } from './sample-data.mjs';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const extensionPath = root('.output-test/chrome-mv3');
const outDir = root('docs/store/');
mkdirSync(outDir, { recursive: true });

const profile = mkdtempSync(join(tmpdir(), 'folio-store-'));
const tmp = mkdtempSync(join(tmpdir(), 'folio-store-html-'));
const context = await chromium.launchPersistentContext(profile, {
  headless: false,
  args: ['--headless=new', `--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
});

/** Saves a JPEG screenshot after letting transitions settle. */
async function shoot(page, name, options = {}) {
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${outDir}${name}.jpg`, type: 'jpeg', quality: 90, ...options });
  console.log(`docs/store/${name}.jpg`);
}

try {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const base = `chrome-extension://${new URL(worker.url()).host}`;
  await worker.evaluate(async (sample) => {
    const other = (await chrome.bookmarks.getTree())[0].children[1];
    for (const [collection, groups] of Object.entries(sample)) {
      const folder = await chrome.bookmarks.create({ parentId: other.id, title: collection });
      for (const [group, items] of Object.entries(groups)) {
        const parent = group === '_' ? folder : await chrome.bookmarks.create({ parentId: folder.id, title: group });
        for (const [title, url] of items) await chrome.bookmarks.create({ parentId: parent.id, title, url });
      }
    }
  }, SAMPLE);
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const dashboard = await context.newPage();
  await dashboard.goto(`${base}/dashboard.html`);
  await dashboard.waitForSelector('[role=option]');
  await dashboard.mouse.move(640, 300);

  // 1. The library in the default light theme.
  await shoot(dashboard, '1-your-library');

  // 2. Search finds a link by any part of its title, domain, tag or folder.
  await dashboard.keyboard.press('/');
  await dashboard.keyboard.type('rust');
  await shoot(dashboard, '2-instant-search');
  await dashboard.keyboard.press('Escape');

  // 3. Nested folders: the folder switcher, then the breadcrumb inside a nested folder.
  await dashboard.keyboard.press('c');
  await dashboard.keyboard.type('typo');
  await shoot(dashboard, '3-folder-switcher');
  await dashboard.keyboard.press('Enter');
  await shoot(dashboard, '4-nested-folders');

  // 5. The Meadow background in the dark theme, back at the top level.
  await dashboard.keyboard.press('h');
  await dashboard.keyboard.press('h');
  await dashboard.emulateMedia({ colorScheme: 'dark' });
  await dashboard.keyboard.press('b');
  await dashboard.getByRole('button', { name: 'Meadow' }).click();
  await dashboard.getByRole('button', { name: 'Strong' }).click(); // the default is subtler than a listing image should be
  await dashboard.keyboard.press('Escape');
  await dashboard.mouse.move(640, 300);
  await shoot(dashboard, '5-themes-and-backgrounds');
  const meadowShot = readFileSync(`${outDir}5-themes-and-backgrounds.jpg`);

  // 6. The popup, centred on the meadow so the store image is not mostly empty.
  const page = await context.newPage();
  await page.goto('https://example.com/').catch(() => {});
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 380, height: 420 });
  await popup.emulateMedia({ colorScheme: 'dark' });
  await popup.goto(`${base}/popup.html`);
  await popup.waitForSelector('[role=option]');
  const height = await popup.evaluate(() => document.querySelector('#root > div').getBoundingClientRect().height);
  await popup.waitForTimeout(700);
  const popupPng = await popup.screenshot({ clip: { x: 0, y: 0, width: 380, height: Math.ceil(height) } });
  const compose = await context.newPage();
  await compose.setViewportSize({ width: 1280, height: 800 });
  await compose.setContent(`<body style="margin:0;width:1280px;height:800px;overflow:hidden;position:relative">
      <div style="position:absolute;inset:-30px;filter:blur(12px);background:url(data:image/jpeg;base64,${meadowShot.toString('base64')}) center/cover"></div>
      <div style="position:absolute;inset:0;background:rgba(8,14,28,.45)"></div>
      <img src="data:image/png;base64,${popupPng.toString('base64')}" style="position:absolute;left:50%;top:50%;
        transform:translate(-50%,-50%) scale(1.5);border-radius:14px;box-shadow:0 30px 90px rgba(0,0,0,.55)">
    </body>`);
  await shoot(compose, '6-save-from-the-toolbar');

  // Small promo tile (440x280): the website's dusk meadow and headline.
  const site = root('site/public');
  const promo = join(tmp, 'promo.html');
  writeFileSync(
    promo,
    `<!doctype html><meta charset="utf-8"><style>
      @font-face{font-family:'EB Garamond';src:url('${pathToFileURL(site)}/fonts/eb-garamond.woff2');font-weight:400 800}
      @font-face{font-family:'EB Garamond';font-style:italic;src:url('${pathToFileURL(site)}/fonts/eb-garamond-italic.woff2');font-weight:400 800}
      body{margin:0;width:440px;height:280px;overflow:hidden;position:relative;color:#f4ead2;font-family:'EB Garamond',serif;
        background:#3e682c url('${pathToFileURL(site)}/assets/hero-960.webp') 58% 100%/cover}
      h1{position:absolute;left:0;right:0;bottom:62px;margin:0;text-align:center;font-weight:400;font-size:48px;line-height:1;
        letter-spacing:-.02em;text-shadow:0 0 18px rgba(8,20,10,.7)}
      p{position:absolute;left:0;right:0;bottom:26px;margin:0;text-align:center;font-style:italic;font-size:17px;
        text-shadow:0 0 12px rgba(8,20,10,.9)}
      .b{position:absolute;top:18px;left:20px;font-size:22px}
    </style><div class="b">Folio</div><h1>Bookmarks, set free.</h1><p>Keyboard-first, on your device</p>`,
  );
  const tile = await context.newPage();
  await tile.setViewportSize({ width: 440, height: 280 });
  await tile.goto(pathToFileURL(promo).href);
  await tile.evaluate(() => document.fonts.ready);
  await tile.screenshot({ path: `${outDir}promo-small-440x280.png` });
  console.log('docs/store/promo-small-440x280.png');
} finally {
  await context.close();
  rmSync(profile, { recursive: true, force: true });
  rmSync(tmp, { recursive: true, force: true });
}
