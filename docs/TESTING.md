# Testing

```sh
pnpm check           # format check, lint, type check and unit tests: run before every commit
pnpm test            # unit tests only (Vitest)
pnpm e2e:chromium    # end-to-end in a throwaway Chromium profile
pnpm e2e:firefox     # end-to-end in a throwaway Zen or Firefox profile
```

## Unit tests

Vitest, run in Node with `fake-indexeddb`. Tests sit next to the code (`*.test.ts`).

What is covered, and why it is easy to test:

| Area                        | File                                   | What it checks                                                                                       |
| --------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Bookmark tree to read model | `lib/core/projector.test.ts`           | Flattening, collections, `pathIds`, tombstones with tags, no-op diffs, tombstone expiry              |
| Folder tree and pickers     | `lib/core/tree.test.ts`                | Subtree counts, hidden roots and Inbox, expand/collapse rows, path-labelled filtering                |
| Search                      | `lib/core/search.test.ts`              | Prefix, fuzzy, tags, notes, folder paths                                                             |
| Sync scheduling             | `lib/core/scheduler.test.ts`           | Debouncing, no overlap, queued re-run, failure recovery, import suspension (fake timers)             |
| Commands                    | `lib/actions/*.test.ts`                | Inbox creation, save, nested folders, restore into a missing folder, safe opening, backup validation |
| Keyboard                    | `components/dashboard/keymap.test.ts`  | Every key binding, including what must _not_ be handled                                              |
| List building               | `components/dashboard/entries.test.ts` | All / folder / search views and scoping                                                              |
| Backgrounds                 | `components/backdrop/backdrop.test.ts` | Bayer matrix, density ranges, determinism of the marble noise                                        |
| URLs and favicons           | `lib/util/url.test.ts`, `lib/favicon/` | Dangerous schemes, normalisation, icon link ranking, private-host guard                              |

The command layer is tested against a small in-memory fake of `browser.bookmarks` (see `lib/actions/bookmarks.test.ts`), so no browser is needed.

## End-to-end tests

The e2e tests load a **test build** of the real extension and drive it. Test builds (`VITE_FOLIO_TEST=1`) differ from release builds in three ways, all gated so they cannot ship:

- they add the `tabs` permission, so a page opened as a tab can find "the page to save";
- the icon fetcher may reach `localhost`, where the tests serve a fixture page;
- with `VITE_FOLIO_OPEN_PAGES=1` the background opens the extension pages as tabs so automation can reach them.

Test builds go to `.output-test/`, never `.output/`.

### Chromium (`e2e/chromium.e2e.mjs`)

Playwright (`playwright-core`) launches Chromium with the extension in a temporary profile. It checks projection, nested folder navigation by keyboard, search scoping, menus, delete and undo, the popup's folder search and height, letter tiles for unknown icons, and that no page throws.

The first time, install a browser: `pnpm exec playwright-core install chromium`.

### Firefox, Zen (`e2e/firefox.e2e.mjs`)

There is no geckodriver. The test starts a **headless, temporary-profile** Firefox-family browser with `--remote-debugging-port` and speaks WebDriver BiDi to it (`e2e/support/firefox-driver.mjs`), installs the unpacked add-on, and checks projection, favicon fetching and caching, search, popup saves with tags and notes, tombstones, and that a change in one page appears live in the others.

Pick the binary with an environment variable:

```sh
ZEN_BIN="/Applications/Zen.app/Contents/MacOS/zen" pnpm e2e:firefox   # the macOS default
FIREFOX_BIN=/usr/bin/firefox pnpm e2e:firefox
```

The test never touches your real profile, and it is safe to run while your own Zen is open.

## Manual check in Zen

1. `pnpm build:firefox`
2. In Zen open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → `.output/firefox-mv2/manifest.json`.
3. Walk through this list:
   - [ ] The toolbar popup opens with `Alt+S` (or your binding) and saves a page into the Inbox.
   - [ ] The same page shows **Saved** when you open the popup again.
   - [ ] The dashboard (`Alt+Shift+F`) lists your existing bookmarks and folders, nested ones included.
   - [ ] Icons appear within a minute or two (they are fetched in the background).
   - [ ] `C` opens the folder switcher; typing finds a nested folder.
   - [ ] Delete a bookmark and press `Z` to restore it.
   - [ ] The sidebar opens from `View → Sidebar → Folio` and looks right at narrow widths.
   - [ ] Switching between light and dark, and the background setting, work.

## Writing a good test

- Prefer a pure function and a unit test. Most logic here is built to allow that: `buildEntries`, `handleKey`, `flatten`.
- Test behaviour, not implementation: assert on the resulting rows or calls, not on internals.
- For browser behaviour, add a check to the e2e files using the `check(name, ok, detail)` helper; keep checks independent of row ordering.
- Never assert on `Date.now()`-dependent output without passing a fixed `now`.
