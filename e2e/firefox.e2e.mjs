// End-to-end test for Firefox-family browsers (Zen, Firefox). Run with `pnpm e2e:firefox`.
// Set ZEN_BIN or FIREFOX_BIN to choose the browser binary.
import { fileURLToPath } from 'node:url';
import { check, finish, sleep } from './support/checks.mjs';
import { startFixtureServer } from './support/fixtures.mjs';
import { ENTER, ESCAPE, launchFirefox } from './support/firefox-driver.mjs';

const extensionPath = process.env.EXT ?? fileURLToPath(new URL('../.output-test/firefox-mv2', import.meta.url));
const server = await startFixtureServer();
const browser = await launchFirefox({ extensionPath });

try {
  await sleep(3000); // the test build opens dashboard, popup and sidebar pages as tabs
  const dash = await browser.findTab('/dashboard.html');
  const popup = await browser.findTab('/popup.html');
  const side = await browser.findTab('/sidepanel.html');
  const rows = (tab) => browser.evaluate(tab, 'document.querySelectorAll("[role=option]").length');
  /** Reads every row of an IndexedDB store inside a page; `project` trims rows to plain data (Blobs cannot cross BiDi). */
  const dump = (tab, store, project = 'row') =>
    browser.evaluate(
      tab,
      `new Promise((res) => { const r = indexedDB.open('folio'); r.onsuccess = () => { const q = r.result.transaction('${store}').objectStore('${store}').getAll(); q.onsuccess = () => res(q.result.map((row) => (${project}))); }; })`,
    );

  // ---- seed native bookmarks ----
  await browser.evaluate(
    dash,
    `(async () => {
      const other = (await browser.bookmarks.getTree())[0].children.find((c) => c.id === 'unfiled_____');
      const make = (parentId, title, url) => browser.bookmarks.create({ parentId, title, url });
      const courses = await make(other.id, 'Courses');
      const physics = await make(courses.id, 'Physics');
      await make(physics.id, 'Optics primer', 'https://optics.dev/');
      const dev = await make(other.id, 'Dev');
      await make(dev.id, 'Fixture Page', '${server.origin}/');
      await make(dev.id, 'Vite', 'https://vite.dev/');
    })()`,
  );
  await sleep(2500);

  check('projector shows bookmarks in the dashboard', (await rows(dash)) >= 3, `rows=${await rows(dash)}`);
  const inbox = await browser.evaluate(
    dash,
    '(async () => (await browser.bookmarks.search({ title: "Inbox" })).length)()',
  );
  check('Inbox folder is created', inbox === 1);

  // ---- favicons: the Firefox path fetches and caches icons ----
  const favicons = await dump(
    dash,
    'favicons',
    '({ origin: row.origin, status: row.status, source: row.source, type: row.blob && row.blob.type, size: row.blob && row.blob.size })',
  );
  const fixtureIcon = favicons.find((f) => f.origin === server.origin);
  check('fetches the icon a page declares', fixtureIcon?.status === 'ok' && fixtureIcon.source === 'site');
  check(
    'stores icons as small PNGs',
    fixtureIcon?.type === 'image/png' && fixtureIcon.size < 2000,
    JSON.stringify(fixtureIcon),
  );

  // ---- search, nested folders ----
  await browser.evaluate(dash, 'document.querySelector("input[aria-label=\\"Search or add\\"]").focus()');
  await browser.type(dash, 'vit');
  await sleep(300);
  check('search filters the list', (await rows(dash)) === 1);
  await browser.type(dash, ESCAPE); // clears the query and leaves the box

  // ---- popup: saved page is recognised even with tracking params ----
  const page = await browser.newTab(`${server.origin}/?utm_source=x#frag`);
  await browser.send('browsingContext.reload', { context: popup, wait: 'complete' });
  await sleep(2500);
  const savedText = await browser.evaluate(popup, 'document.body.innerText');
  check('popup recognises an already-saved page (normalised URL)', /Saved/.test(savedText));

  // ---- popup: save a new page with a tag and note ----
  await browser.send('browsingContext.navigate', { context: page, url: `${server.origin}/fresh`, wait: 'complete' });
  await browser.send('browsingContext.reload', { context: popup, wait: 'complete' });
  await sleep(2000);
  await browser.evaluate(popup, 'document.querySelector("input").focus()');
  await browser.type(popup, '#zen note');
  await browser.type(popup, ENTER);
  await sleep(2000);
  const saved = await browser.evaluate(
    popup,
    `(async () => (await browser.bookmarks.search({ url: '${server.origin}/fresh' })).length)()`,
  );
  check('popup saves a native bookmark', saved === 1);
  const meta = await dump(popup, 'meta');
  check(
    'tags and note are stored',
    meta.some((m) => m.tags?.includes('zen') && m.note === 'note'),
  );

  // ---- delete leaves a tombstone with the tags ----
  await browser.evaluate(
    dash,
    `(async () => { const [b] = await browser.bookmarks.search({ url: '${server.origin}/fresh' }); await browser.bookmarks.remove(b.id); })()`,
  );
  await sleep(1500);
  const stones = await dump(dash, 'tombstones', '({ tags: row.meta && row.meta.tags })');
  check(
    'delete keeps a tombstone with its tags',
    stones.some((s) => s.tags?.includes('zen')),
  );

  // ---- sidebar and live updates across extension pages ----
  const sidebar = await browser.evaluate(dash, 'JSON.stringify(browser.runtime.getManifest().sidebar_action)');
  check('sidebar_action is registered', !!sidebar && sidebar !== 'undefined');
  const [dashBefore, sideBefore] = [await rows(dash), await rows(side)];
  await browser.evaluate(
    popup,
    `(async () => { const [inbox] = await browser.bookmarks.search({ title: 'Inbox' }); await browser.bookmarks.create({ parentId: inbox.id, title: 'Live Test', url: 'https://example.org/live' }); })()`,
  );
  await sleep(2000);
  const [dashAfter, sideAfter] = [await rows(dash), await rows(side)];
  check(
    'a change made in one page appears live in the dashboard and the sidebar',
    dashAfter === dashBefore + 1 && sideAfter === sideBefore + 1,
    `dashboard ${dashBefore}->${dashAfter}, sidebar ${sideBefore}->${sideAfter}`,
  );
} catch (error) {
  check('test run completed without throwing', false, String(error));
} finally {
  await browser.close();
  server.close();
  finish();
}
