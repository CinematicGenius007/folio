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

  // ---- inbox triage, move undo, duplicates, tag filter, naming a pasted link ----
  await inWorker(async () => {
    const other = (await chrome.bookmarks.getTree())[0].children[1];
    const inbox = other.children.find((c) => c.title === 'Inbox' && !c.url);
    // A second copy of calculus.dev: host affinity suggests Courses, and it is a duplicate.
    await chrome.bookmarks.create({ parentId: inbox.id, title: 'Calculus notes', url: 'https://calculus.dev/' });
    await chrome.bookmarks.create({ parentId: inbox.id, title: 'Unfiled zebra', url: 'https://zebra-unique.example/' });
  });
  await sleep(1200);
  const parentOf = (title) =>
    inWorker(async (t) => {
      const [bookmark] = await chrome.bookmarks.search({ title: t });
      return bookmark ? (await chrome.bookmarks.get(bookmark.parentId))[0].title : null;
    }, title);
  const triageLine = () => dash.locator('[data-triage]');
  /** Puts the cursor on a row by hovering it. The pointer leaves first, because a row that appears under a still pointer gets no mouseenter. */
  const pointAt = async (row) => {
    await dash.mouse.move(1, 1);
    await row.hover();
    await sleep(100);
  };

  await dash.keyboard.press('c');
  await dash.keyboard.type('inbox');
  await dash.keyboard.press('Enter');
  await sleep(300);
  check(
    'the Inbox highlights a row from the start',
    (await triageLine().count()) === 1,
    await triageLine()
      .allInnerTexts()
      .then((t) => t.join('|')),
  );
  // Both rows were created in the same instant, so their order varies: pick them by name.
  await pointAt(dash.locator('[role=option]', { hasText: 'Unfiled zebra' }));
  await sleep(150);
  check(
    'a row with nothing to suggest shows only a move hint',
    /move/.test(await triageLine().innerText()) && !/File to/.test(await triageLine().innerText()),
    await triageLine().innerText(),
  );
  await pointAt(dash.locator('[role=option]', { hasText: 'Calculus notes' }));
  await sleep(150);
  check(
    'the highlighted Inbox row suggests the folder that holds its site',
    /File to/.test(await triageLine().innerText()) && /Courses/.test(await triageLine().innerText()),
    await triageLine().innerText(),
  );
  await dash.keyboard.press('1');
  await sleep(900);
  check('1 files the row into the first suggestion', (await parentOf('Calculus notes')) === 'Courses');
  check('filing shows a toast with undo', (await dash.locator('text=Filed to Courses').count()) === 1);
  check(
    'the cursor stays on the row that takes its place',
    (await count(dash)) === 1 &&
      /Unfiled zebra/.test(await dash.locator('[role=option]:has([data-triage])').innerText()),
  );
  await dash.keyboard.press('z');
  await sleep(900);
  check('Z moves a filed bookmark back to the Inbox', (await parentOf('Calculus notes')) === 'Inbox');
  await pointAt(dash.locator('[role=option]', { hasText: 'Calculus notes' }));
  await dash.locator('[data-triage] button', { hasText: 'Courses' }).click();
  await sleep(900);
  check('a suggestion can be clicked to file the row', (await parentOf('Calculus notes')) === 'Courses');
  await dash.keyboard.press('Backspace'); // deletes Unfiled zebra, the last row
  await sleep(900);
  check('an empty Inbox has its own message', (await dash.locator('text=Your Inbox is clear').count()) === 1);

  // bulk move undo from a folder, through the move dialog
  await dash.keyboard.press('c');
  await dash.keyboard.type('courses');
  await dash.keyboard.press('Enter');
  await sleep(300);
  await pointAt(dash.locator('[role=option]', { hasText: 'Calculus notes' }));
  await dash.keyboard.press('x');
  await pointAt(dash.locator('[role=option]', { hasText: 'Calculus' }).filter({ hasNotText: 'notes' }));
  await dash.keyboard.press('x');
  await dash.keyboard.press('m');
  await dash.keyboard.type('dev tech');
  await dash.keyboard.press('Enter');
  await sleep(900);
  const movedBoth = (await parentOf('Calculus notes')) === 'Dev Tech';
  await dash.keyboard.press('Meta+z');
  await sleep(900);
  check(
    '⌘Z undoes a move of several bookmarks',
    movedBoth && (await parentOf('Calculus notes')) === 'Courses',
    `${movedBoth} ${await parentOf('Calculus notes')}`,
  );

  // duplicates: both calculus.dev bookmarks, side by side, with their folder shown
  await dash.keyboard.press('c');
  const dupEntry = dash.locator('button', { hasText: 'Duplicates' });
  check('the folder switcher offers Duplicates with a count', /Duplicates\s*2/.test(await dupEntry.innerText()));
  await dupEntry.click();
  await sleep(300);
  const dupRows = await dash.locator('[role=option]').allInnerTexts();
  check(
    'the Duplicates view lists copies of one link together with their folders',
    dupRows.length === 2 && dupRows.every((r) => /Courses/.test(r)),
    dupRows.join(' | '),
  );
  await pointAt(dash.locator('[role=option]', { hasText: 'Calculus notes' }));
  await dash.keyboard.press('Backspace');
  await sleep(900);
  check('⌫ deletes the copy under the cursor', (await dash.locator('text=No duplicates').count()) === 1);
  await dash.keyboard.press('z');
  await sleep(900);
  check('a deleted duplicate comes back with Z', (await count(dash)) === 2);
  await dash.keyboard.press('h');
  await sleep(300);

  // tags: add one in the Edit dialog, then filter by it
  await dash.keyboard.press('/');
  await dash.keyboard.type('#physics');
  await sleep(250);
  check('an unknown tag says so', (await dash.locator('text=No bookmarks tagged #physics').count()) === 1);
  await dash.keyboard.press('Escape');
  await pointAt(dash.locator('[role=option]', { hasText: 'Optics primer' }));
  await dash.keyboard.press('e');
  await dash.locator('[role=dialog] input[aria-label="Tags"]').fill('#physics');
  await dash.keyboard.press('Enter');
  await sleep(400);
  await dash.keyboard.press('/');
  await dash.keyboard.type('#Physics');
  await sleep(250);
  const tagRows = await dash.locator('[role=option]').allInnerTexts();
  check(
    '#tag in the search lists exactly the tagged bookmarks',
    tagRows.length === 1 && /Optics primer/.test(tagRows[0]),
    tagRows.join(' | '),
  );
  await dash.keyboard.type(' zzzz');
  await sleep(250);
  check('words after a tag still narrow the list', (await count(dash)) === 0);
  await dash.keyboard.press('Escape');
  await sleep(150);
  await dash.locator('[role=option] button', { hasText: '#physics' }).click();
  await sleep(250);
  check(
    'clicking a tag chip filters by that tag without opening the row',
    (await dash.locator('input[aria-label="Search or add"]').inputValue()) === '#physics' &&
      (await count(dash)) === 1 &&
      (await context.pages()).every((p) => !p.url().includes('optics.dev')),
  );
  await dash.locator('input[aria-label="Search or add"]').fill('');

  // a pasted link is saved, then its Edit dialog opens with the hostname selected
  await dash.keyboard.press('Meta+f');
  await dash.keyboard.type('https://paste-title.dev/');
  await dash.keyboard.press('Enter');
  const titleInput = dash.locator('[role=dialog] input[aria-label="Title"]');
  await titleInput.waitFor({ timeout: 3000 });
  const selected = await titleInput.evaluate((el) => el.value.slice(el.selectionStart, el.selectionEnd));
  check('saving a pasted link opens Edit with the hostname selected', selected === 'paste-title.dev', selected);
  await dash.keyboard.type('Pasted title');
  await dash.keyboard.press('Enter');
  await sleep(600);
  const pastedTitle = await inWorker(
    async () => (await chrome.bookmarks.search({ url: 'https://paste-title.dev/' }))[0]?.title,
  );
  check('typing names the pasted link in one step', pastedTitle === 'Pasted title', pastedTitle);

  // leave the library as the popup checks below expect it
  await inWorker(async () => {
    for (const url of ['https://paste-title.dev/', 'https://zebra-unique.example/'])
      for (const b of await chrome.bookmarks.search({ url })) await chrome.bookmarks.remove(b.id);
    for (const b of await chrome.bookmarks.search({ title: 'Calculus notes' })) await chrome.bookmarks.remove(b.id);
  });
  await sleep(600);

  // ---- popup ----
  // Many top-level folders so a last-used destination sits below the 192px list without scrolling.
  await inWorker(async () => {
    const other = (await chrome.bookmarks.getTree())[0].children[1];
    for (let i = 0; i < 14; i++) await chrome.bookmarks.create({ parentId: other.id, title: `Spacer ${i}` });
    await chrome.bookmarks.create({ parentId: other.id, title: 'Scroll Target' });
  });
  await sleep(1200);

  const page = await context.newPage();
  await page.goto(`${server.origin}/`);
  const popupSetup = await context.newPage();
  watch(popupSetup);
  await popupSetup.setViewportSize({ width: 380, height: 520 });
  await popupSetup.goto(`${base}/popup.html`);
  await popupSetup.waitForSelector('[role=option]');
  await popupSetup.locator('input').fill('/Scroll Target');
  await sleep(250);
  await popupSetup.keyboard.press('Enter');
  await sleep(1500);
  await popupSetup.keyboard.press('Backspace');
  await sleep(1000);
  await popupSetup.close();

  // Re-open so lastCollectionId (Scroll Target) is loaded; it should be below the fold.
  const popupScroll = await context.newPage();
  watch(popupScroll);
  await popupScroll.setViewportSize({ width: 380, height: 520 });
  await popupScroll.goto(`${base}/popup.html`);
  await popupScroll.waitForSelector('[role=option][data-active=true]');
  const scrollActive = popupScroll.locator('[role=option][data-active=true]');
  const scrollKey = await scrollActive.getAttribute('data-row-key');
  const scrollIdx = Number(await scrollActive.getAttribute('data-idx'));
  check(
    'last-used folder below the fold is the initial selection',
    /^folder:/.test(scrollKey ?? '') && (await scrollActive.innerText()).includes('Scroll Target') && scrollIdx > 6,
    `key=${scrollKey} idx=${scrollIdx}`,
  );
  const scrollInView = await scrollActive.evaluate((el) => {
    const list = el.closest('[role=listbox]');
    if (!list) return false;
    const e = el.getBoundingClientRect();
    const l = list.getBoundingClientRect();
    return e.top >= l.top - 1 && e.bottom <= l.bottom + 1;
  });
  check('initial selection below the fold is scrolled into view', scrollInView);

  // Host fixtures reshape the list with suggestions while the last-used folder stays selected.
  await inWorker(async (origin) => {
    const other = (await chrome.bookmarks.getTree())[0].children[1];
    const dev = other.children.find((c) => c.title === 'Dev Tech' && !c.url);
    await chrome.bookmarks.create({ parentId: dev.id, title: 'Local fixture a', url: `${origin}/related-a` });
  }, server.origin);
  await sleep(1200);
  await popupScroll.waitForSelector('text=Suggested');
  const afterReshape = popupScroll.locator('[role=option][data-active=true]');
  check(
    'active last-used folder stays selected after suggestions appear',
    (await afterReshape.innerText()).includes('Scroll Target'),
  );
  const reshapeInView = await afterReshape.evaluate((el) => {
    const list = el.closest('[role=listbox]');
    if (!list) return false;
    const e = el.getBoundingClientRect();
    const l = list.getBoundingClientRect();
    return e.top >= l.top - 1 && e.bottom <= l.bottom + 1;
  });
  check('active folder stays in view after the list reshapes', reshapeInView);

  // Hover a different already-visible row (force skips Playwright's scroll-into-view).
  const hoverIdx = await popupScroll.locator('[role=listbox]').evaluate((list) => {
    const activeIdx = Number(list.querySelector('[role=option][data-active=true]')?.getAttribute('data-idx'));
    const lr = list.getBoundingClientRect();
    for (const opt of list.querySelectorAll('[role=option]')) {
      const idx = Number(opt.getAttribute('data-idx'));
      if (idx === activeIdx) continue;
      const r = opt.getBoundingClientRect();
      if (r.top >= lr.top - 1 && r.bottom <= lr.bottom + 1) return idx;
    }
    return -1;
  });
  const scrollTopBeforeHover = await popupScroll.locator('[role=listbox]').evaluate((el) => el.scrollTop);
  if (hoverIdx >= 0) {
    await popupScroll.locator(`[role=option][data-idx="${hoverIdx}"]`).hover({ force: true });
    await sleep(100);
  }
  const scrollTopAfterHover = await popupScroll.locator('[role=listbox]').evaluate((el) => el.scrollTop);
  const activeAfterHover = Number(
    await popupScroll.locator('[role=option][data-active=true]').getAttribute('data-idx'),
  );
  check(
    'hovering another visible row changes highlight without scrolling',
    hoverIdx >= 0 && activeAfterHover === hoverIdx && scrollTopBeforeHover === scrollTopAfterHover,
    `hoverIdx=${hoverIdx} active=${activeAfterHover} top=${scrollTopBeforeHover}->${scrollTopAfterHover}`,
  );
  await popupScroll.close();

  // Fresh popup: three same-host bookmarks make Dev Tech a confident pre-selection.
  await inWorker(async (origin) => {
    const other = (await chrome.bookmarks.getTree())[0].children[1];
    const dev = other.children.find((c) => c.title === 'Dev Tech' && !c.url);
    await chrome.bookmarks.create({ parentId: dev.id, title: 'Local fixture b', url: `${origin}/related-b` });
    await chrome.bookmarks.create({ parentId: dev.id, title: 'Local fixture c', url: `${origin}/related-c` });
  }, server.origin);
  await sleep(1200);

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

  // ---- saved popup: edit the note and #tags in place ----
  const noteField = popup.getByLabel('Note and tags', { exact: true });
  check('saved popup offers to add a note', (await popup.locator('button', { hasText: 'Add a note' }).count()) === 1);
  await popup.keyboard.press('e');
  await noteField.waitFor();
  await popup.keyboard.type('keep m0 #rustlang');
  check(
    'typing in the saved note ignores the popup letter keys (M, 0, E)',
    (await noteField.inputValue()) === 'keep m0 #rustlang' &&
      (await popup.locator('text=Move to').count()) === 0 &&
      !popup.isClosed(),
    await noteField.inputValue(),
  );
  await popup.keyboard.press('Enter');
  await popup.locator('text=#rustlang').waitFor();
  check('Enter saves the note and tags from the saved popup', (await popup.locator('text=keep m0').count()) === 1);
  await popup.keyboard.press('e');
  await noteField.waitFor();
  check('E reopens the editor prefilled', (await noteField.inputValue()) === 'keep m0 #rustlang');
  await noteField.fill('#ru');
  await sleep(100);
  check(
    'a #prefix shows the best existing tag as ghost text',
    (await noteField.getAttribute('data-completion')) === 'stlang',
    String(await noteField.getAttribute('data-completion')),
  );
  await popup.keyboard.press('Tab');
  check(
    'Tab accepts the tag completion',
    (await noteField.inputValue()) === '#rustlang ',
    await noteField.inputValue(),
  );
  await popup.keyboard.press('Escape');
  await sleep(200);
  check(
    'Esc cancels the note edit without closing the popup',
    !popup.isClosed() && (await noteField.count()) === 0 && (await popup.locator('text=keep m0').count()) === 1,
    `editor=${await noteField.count()} note=${await popup.locator('text=keep m0').count()}`,
  );

  // ---- save popup on a new page: tag completion and a footer that fits ----
  const footerFits = (p) =>
    p.evaluate(() => {
      const footer = document.querySelector('#root > div').lastElementChild;
      const edge = footer.getBoundingClientRect().right - parseFloat(getComputedStyle(footer).paddingRight);
      const right = Math.max(...[...footer.querySelectorAll('*')].map((el) => el.getBoundingClientRect().right));
      // the hints must also keep clear of the Save button
      const [hints, save] = footer.children;
      const clear = save.getBoundingClientRect().left - hints.getBoundingClientRect().right >= 8;
      return clear && right <= edge + 0.5 && document.documentElement.scrollWidth <= 380;
    });
  await page.goto(`${server.origin}/fresh-page`);
  const popupTags = await context.newPage();
  watch(popupTags);
  await popupTags.setViewportSize({ width: 380, height: 520 });
  await popupTags.goto(`${base}/popup.html`);
  await popupTags.waitForSelector('[role=option]');
  check(
    'save popup shows the / folders hint',
    (await popupTags.locator('button', { hasText: 'folders' }).count()) === 1,
  );
  check('save popup footer fits 380px', await footerFits(popupTags));
  const saveField = popupTags.getByLabel('Note, tags, or folder search');
  await saveField.fill('read later #ru');
  await sleep(100);
  check(
    'save popup completes tags inline',
    (await saveField.getAttribute('data-completion')) === 'stlang',
    String(await saveField.getAttribute('data-completion')),
  );
  await popupTags.keyboard.press('ArrowRight');
  check('→ at the end accepts the completion', (await saveField.inputValue()) === 'read later #rustlang ');
  await saveField.fill('/x #ru');
  await sleep(100);
  check('no tag completion during / folder search', (await saveField.getAttribute('data-completion')) === null);
  await popupTags.close();
  await page.goto(`${server.origin}/`);

  await popup.keyboard.press('Backspace');
  await sleep(1000);
  check(
    'popup offers Open Folio while saving a page',
    (await popup.locator('button', { hasText: 'Open Folio' }).count()) === 1,
  );
  check('save popup footer fits 380px with Removed. Undo', await footerFits(popup));
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
