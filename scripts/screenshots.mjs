#!/usr/bin/env node
// Regenerates the screenshots in docs/screenshots from realistic sample data.
//   pnpm screenshots        (builds the test build first)
import { chromium } from 'playwright-core';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLE } from './sample-data.mjs';

const extensionPath = fileURLToPath(new URL('../.output-test/chrome-mv3', import.meta.url));
const outDir = fileURLToPath(new URL('../docs/screenshots/', import.meta.url));
mkdirSync(outDir, { recursive: true });

const profile = mkdtempSync(join(tmpdir(), 'folio-shots-'));
const context = await chromium.launchPersistentContext(profile, {
  headless: false,
  args: ['--headless=new', `--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});

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
  // Full-page shots are JPEG because the dotted background compresses badly as PNG; popups stay PNG.
  const shoot = async (page, name, options = {}) => {
    await page.waitForTimeout(700);
    const type = options.clip ? 'png' : 'jpeg';
    await page.screenshot({
      path: `${outDir}${name}.${type === 'jpeg' ? 'jpg' : 'png'}`,
      type,
      ...(type === 'jpeg' ? { quality: 82 } : {}),
      ...options,
    });
    console.log(`docs/screenshots/${name}.${type === 'jpeg' ? 'jpg' : 'png'}`);
  };

  // Show the Meadow background, at medium strength so the edges read clearly in a README-sized image.
  await dashboard.keyboard.press('b');
  await dashboard.getByRole('button', { name: 'Meadow' }).click();
  await dashboard.getByRole('button', { name: 'Medium' }).click();
  await dashboard.keyboard.press('Escape');

  await dashboard.mouse.move(720, 330);
  await shoot(dashboard, 'dashboard-light');
  await dashboard.keyboard.press('c');
  await dashboard.keyboard.type('typo');
  await shoot(dashboard, 'folder-switcher');
  await dashboard.keyboard.press('Enter');
  await shoot(dashboard, 'nested-folder');
  await dashboard.keyboard.press('h'); // up to Design
  await dashboard.keyboard.press('h'); // up to everything
  await dashboard.emulateMedia({ colorScheme: 'dark' });
  await dashboard.mouse.move(720, 330);
  await shoot(dashboard, 'dashboard-dark');

  // The popup needs a page to save, so open one first.
  const page = await context.newPage();
  await page.goto('https://example.com/').catch(() => {});
  for (const [scheme, name] of [
    ['light', 'popup-save'],
    ['dark', 'popup-saved'],
  ]) {
    const popup = await context.newPage();
    await popup.emulateMedia({ colorScheme: scheme });
    await popup.setViewportSize({ width: 380, height: 420 });
    await popup.goto(`${base}/popup.html`);
    await popup.waitForSelector('[role=option]');
    if (name === 'popup-saved') {
      await popup.keyboard.press('Enter');
      await popup.waitForSelector('text=Remove');
    }
    const height = await popup.evaluate(() => document.querySelector('#root > div').getBoundingClientRect().height);
    await shoot(popup, name, { clip: { x: 0, y: 0, width: 380, height: Math.ceil(height) } });
  }
} finally {
  await context.close();
  rmSync(profile, { recursive: true, force: true });
}
