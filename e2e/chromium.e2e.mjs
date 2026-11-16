// End-to-end test for Chromium-family browsers. Run with `pnpm e2e:chromium`.
// Loads the test build into a throwaway Chromium profile and drives the real extension pages.
import { chromium } from 'playwright-core';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, finish, sleep } from './support/checks.mjs';
import { startFixtureServer } from './support/fixtures.mjs';

const extensionPath = process.env.EXT ?? fileURLToPath(new URL('../.output-test/chrome-mv3', import.meta.url));
const profile = mkdtempSync(join(tmpdir(), 'folio-chromium-'));
const server = await startFixtureServer();

const context = await chromium.launchPersistentContext(profile, {
  headless: false,
  args: ['--headless=new', `--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  viewport: { width: 1280, height: 800 },
});
const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
const base = `chrome-extension://${new URL(worker.url()).host}`;
const pageErrors = [];
const watch = (page) => page.on('pageerror', (e) => pageErrors.push(String(e)));

/** Runs code inside the extension's service worker, where `chrome.bookmarks` lives. */
const inWorker = (fn, arg) => worker.evaluate(fn, arg);
const count = (page) => page.locator('[role=option]').count();

try {
  // ---- seed native bookmarks, as a user would have them ----
  await inWorker(async () => {
    const other = (await chrome.bookmarks.getTree())[0].children[1];
    const make = (parentId, title, url) => chrome.bookmarks.create({ parentId, title, url });
    const courses = await make(other.id, 'Courses');
    const physics = await make(courses.id, 'Physics');
    const waves = await make(physics.id, 'Waves');
    await make(courses.id, 'Calculus', 'https://calculus.dev/');
    await make(physics.id, 'Optics primer', 'https://optics.dev/');
    await make(waves.id, 'Wave equation', 'https://waves.dev/');
    const dev = await make(other.id, 'Dev Tech');
    await make(dev.id, 'Vite', 'https://vite.dev/');
    await make(dev.id, 'Unsafe', 'javascript:alert(1)');
  });
  await sleep(1200);

  // ---- dashboard ----
  const dash = await context.newPage();
  watch(dash);
  await dash.goto(`${base}/dashboard.html`);
  await dash.waitForSelector('[role=option]');
  check('projector lists every bookmark', (await count(dash)) === 5, `rows=${await count(dash)}`);
  await sleep(500);
  check(
    'sites with no cached icon get a letter tile, not the browser globe',
    (await dash.locator('[role=option] img').count()) === 0,
  );

  await dash.keyboard.press('c');
  await dash.keyboard.type('wav');
  await dash.keyboard.press('Enter');
  await sleep(300);
  check('folder switcher finds a nested folder by name', (await count(dash)) === 1);
  const bar = await dash.locator('header').innerText();
  check('breadcrumb shows the folder path', /Courses/.test(bar) && /Physics/.test(bar));
  const crumbs = dash.locator('nav[aria-label="Folder path"]');
  check(
    'breadcrumb is a labelled nav that marks the current folder',
    (await crumbs.count()) === 1 && /Waves/.test(await crumbs.locator('[aria-current="page"]').innerText()),
  );
  await crumbs.getByRole('button', { name: 'Courses', exact: true }).click();
  await sleep(200);
  check(
    'clicking a breadcrumb opens that folder',
    /^Physics/.test((await dash.locator('[role=option]').first().innerText()) ?? ''),
  );
  // back down to Waves for the keyboard checks below
  await dash.keyboard.press('c');
  await dash.keyboard.type('wav');
  await dash.keyboard.press('Enter');
  await sleep(300);

  await dash.keyboard.press('h');
  await sleep(200);
  const physicsRows = await dash.locator('[role=option]').allInnerTexts();
  check(
    'h goes up one level and lists a subfolder first',
    /^Waves/.test(physicsRows[0] ?? '') && physicsRows.length === 2,
  );
  await dash.keyboard.press('h');
  await sleep(200);
  check(
    'subfolder rows come before bookmarks',
    /^Physics/.test((await dash.locator('[role=option]').first().innerText()) ?? ''),
  );

  await dash.keyboard.press('Meta+f');
  await dash.keyboard.type('vite');
  await sleep(250);
  check('search is scoped to the current folder tree', (await count(dash)) === 0);
  await dash.keyboard.press('Escape');
  await dash.keyboard.press('h');
  await sleep(200);

  await dash.keyboard.press('o');
  check('O opens the Folio menu', (await dash.locator('[role=menu]').count()) === 1);
  await dash.keyboard.press('Escape');

  // right-click: copy, then move through the submenu
  const firstRow = dash.locator('[role=option]').first();
  await firstRow.click({ button: 'right' });
  check('right-click opens the row menu', (await dash.locator('[role=menu]').count()) === 1);
  await dash.keyboard.press('Escape');

  // delete one bookmark and undo it
  const before = await inWorker(async () => (await chrome.bookmarks.search({ title: 'Vite' })).length);
  await dash.keyboard.press('c');
  await dash.keyboard.type('dev tech');
  await dash.keyboard.press('Enter');
  await sleep(300);
  await dash.locator('[role=option]', { hasText: 'Vite' }).hover(); // sort order between rows is not guaranteed
  await dash.keyboard.press('Backspace');
  await sleep(900);
  const afterDelete = await inWorker(async () => (await chrome.bookmarks.search({ title: 'Vite' })).length);
  check('Backspace deletes a bookmark from the browser', before === 1 && afterDelete === 0);
  check('deleting shows an undo toast', (await dash.locator('text=Undo for 30 days').count()) === 1);
  await dash.keyboard.press('Meta+z');
  await sleep(900);
  const afterUndo = await inWorker(async () => (await chrome.bookmarks.search({ title: 'Vite' })).length);
  check('⌘Z restores it', afterUndo === 1);

  // javascript: bookmarks are listed but never opened
  const opened = await inWorker(
    async () => (await chrome.tabs.query({})).filter((t) => (t.url ?? '').startsWith('javascript:')).length,
  );
  check('unsafe javascript: links are never opened', opened === 0);

  // ---- popup ----
  // Same host under Dev Tech so the save popup can suggest (and pre-select) that folder.
  await inWorker(async (origin) => {
    const other = (await chrome.bookmarks.getTree())[0].children[1];
    const dev = other.children.find((c) => c.title === 'Dev Tech' && !c.url);
    await chrome.bookmarks.create({ parentId: dev.id, title: 'Local fixture a', url: `${origin}/related-a` });
    await chrome.bookmarks.create({ parentId: dev.id, title: 'Local fixture b', url: `${origin}/related-b` });
    await chrome.bookmarks.create({ parentId: dev.id, title: 'Local fixture c', url: `${origin}/related-c` });
  }, server.origin);
  await sleep(1200);

  const page = await context.newPage();
  await page.goto(`${server.origin}/`);
  const popup = await context.newPage();
  watch(popup);
  await popup.setViewportSize({ width: 380, height: 520 });
  await popup.goto(`${base}/popup.html`);
  await popup.waitForSelector('[role=option][data-active=true]');
  const suggested = await popup.locator('[role=option]').first().innerText();
  check(
    'popup suggests a folder that already holds this host',
    /Dev Tech/.test(suggested) && /from/.test(suggested),
    suggested,
  );
  const activeKey = await popup.locator('[role=option][data-active=true]').getAttribute('data-row-key');
  check('confident host affinity pre-selects the suggestion', /^suggest:/.test(activeKey ?? ''), activeKey);
  const activeInView = await popup.locator('[role=option][data-active=true]').evaluate((el) => {
    const list = el.closest('[role=listbox]');
    if (!list) return false;
    const e = el.getBoundingClientRect();
    const l = list.getBoundingClientRect();
    return e.top >= l.top - 1 && e.bottom <= l.bottom + 1;
  });
  check('active save destination is visible when the popup opens', activeInView);
  await popup.keyboard.press('ArrowDown');
  await popup.keyboard.press('ArrowDown');
  await popup.keyboard.press('ArrowDown');
  const afterNav = await popup.locator('[role=option][data-active=true]').getAttribute('data-row-key');
  check(
    'keyboard moves past a suggested folder into the tree',
    !!afterNav && afterNav !== activeKey && !afterNav.startsWith('suggest:'),
    afterNav,
  );
  const heightSaving = await popup.evaluate(() => document.querySelector('#root > div').getBoundingClientRect().height);
  await popup.locator('input').fill('/phys wav');
  await sleep(250);
  const matches = await popup.locator('[role=option]').allInnerTexts();
  check(
    'popup folder search shows the full path of a nested folder',
    matches.length === 1 && /Courses \/ Physics/.test(matches[0]),
  );
  await popup.keyboard.press('Enter');
  await sleep(1500);
  const savedInto = await inWorker(async (url) => {
    const [bookmark] = await chrome.bookmarks.search({ url });
    return (await chrome.bookmarks.get(bookmark.parentId))[0].title;
  }, `${server.origin}/`);
  check('Enter saves into the highlighted nested folder', savedInto === 'Waves', savedInto);
  const heightSaved = await popup.evaluate(() => document.querySelector('#root > div').getBoundingClientRect().height);
  check(
    'popup is shorter once the page is saved',
    heightSaved < heightSaving - 80,
    `${Math.round(heightSaving)}px -> ${Math.round(heightSaved)}px`,
  );

  await popup.keyboard.press('Backspace');
  await sleep(1000);
  check(
    'popup offers Open Folio while saving a page',
    (await popup.locator('button', { hasText: 'Open Folio' }).count()) === 1,
  );
  await popup.keyboard.press('z');
  await sleep(1000);
  const restored = await inWorker(async (url) => (await chrome.bookmarks.search({ url })).length, `${server.origin}/`);
  check('popup Remove then Z restores the bookmark', restored === 1);

  // a page Folio cannot save still leads to the dashboard, by key
  await page.goto('about:blank');
  const unsavable = await context.newPage();
  await unsavable.goto(`${base}/popup.html`);
  await unsavable.waitForSelector('text=Folio can save http and https pages.');
  const dashboardOpened = context.waitForEvent('page');
  // the popup closes itself on this key, which can surface as an error on the press that triggered it
  await unsavable.keyboard.press('0').catch(() => {});
  const dashboardTab = await dashboardOpened;
  await dashboardTab.waitForURL('**/dashboard.html');
  check('0 opens the dashboard from a page that cannot be saved', true);

  // ---- icons: only a dark glyph on a transparent background is drawn on a light plate ----
  for (const path of ['/tile', '/glyph']) {
    const visited = await context.newPage();
    await visited.goto(`${server.origin}${path}`);
    await sleep(1500); // lets Chromium fetch and cache the page's icon
    await visited.close();
  }
  await inWorker(async (origin) => {
    const other = (await chrome.bookmarks.getTree())[0].children[1];
    await chrome.bookmarks.create({ parentId: other.id, title: 'Tile icon site', url: `${origin}/tile` });
    await chrome.bookmarks.create({ parentId: other.id, title: 'Glyph icon site', url: `${origin}/glyph` });
  }, server.origin);
  await sleep(1200);
  const icons = await context.newPage();
  await icons.emulateMedia({ colorScheme: 'dark' });
  await icons.goto(`${base}/dashboard.html`);
  await icons.waitForSelector('[role=option]');
  await sleep(1500);
  const plateOf = (title) =>
    icons.evaluate((t) => {
      const img = [...document.querySelectorAll('[role=option]')]
        .find((r) => r.textContent.includes(t))
        ?.querySelector('img');
      return img ? getComputedStyle(img).backgroundColor : null;
    }, title);
  const [glyphPlate, tilePlate] = [await plateOf('Glyph icon site'), await plateOf('Tile icon site')];
  check(
    'a dark glyph on a transparent background is drawn on a light plate',
    glyphPlate && glyphPlate !== 'rgba(0, 0, 0, 0)',
    String(glyphPlate),
  );
  check('a dark icon that fills its square gets no white frame', tilePlate === 'rgba(0, 0, 0, 0)', String(tilePlate));

  // ---- no runtime errors anywhere ----
  check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));
} catch (error) {
  check('test run completed without throwing', false, String(error));
} finally {
  await context.close();
  server.close();
  rmSync(profile, { recursive: true, force: true });
  finish();
}
