# Folio: guide for coding agents

This is the single source of context for any AI coding agent working in this repository. `CLAUDE.md`, `GEMINI.md` and
`.github/copilot-instructions.md` only point here, so **edit this file, not those**. Human contributors want
[CONTRIBUTING.md](CONTRIBUTING.md). Detail lives in `docs/`; this file says what matters, what is easy to get wrong, and where to look.

## What Folio is

An open-source (MIT), local-first, keyboard-first bookmark manager that runs as a browser extension **on top of the browser's native
bookmarks**. WXT 0.21, React 19, TypeScript, Tailwind v4, Dexie, MiniSearch. One codebase builds Chromium (Manifest V3: Chrome, Edge, Brave,
Arc, Dia) and Firefox/Zen (Manifest V2). The repo also holds the website (`site/`) at folio.cinematicgenius007.com.
Contact: folio@cinematicgenius007.com. Repo: `github.com/CinematicGenius007/folio`.

| Read this              | For                                                                         |
| ---------------------- | --------------------------------------------------------------------------- |
| `docs/ARCHITECTURE.md` | The one-way data loop, modules, the favicon pipeline                        |
| `docs/DESIGN.md`       | Themes, tokens, interaction principles, backgrounds, logo                   |
| `docs/TESTING.md`      | Unit tests, e2e, testing on Zen                                             |
| `docs/PRIVACY.md`      | Permissions and network behaviour (keep in step with the code and the site) |
| `docs/RELEASING.md`    | **Cutting a release**, signing, automatic updates                           |
| `docs/CHROME-STORE.md` | Chrome Web Store listing text, permission justifications, images            |
| `site/README.md`       | The website: build, layout, Vercel, SEO                                     |

## Rules that are easy to break

- **One-way loop.** Pages read IndexedDB through Dexie live queries. Writes go to the native bookmark API via `lib/actions`. Only the
  background projector writes the read model. Never write the read model from a page.
- **Privacy is a feature.** No telemetry, no accounts, no network calls on Chromium. Firefox/Zen fetch favicons directly from the sites
  (with the SSRF guards in `lib/favicon`). Any change to permissions or network behaviour must update `docs/PRIVACY.md`, the website's privacy page
  (`site/content/docs/privacy.md`), `docs/CHROME-STORE.md`, and `scripts/verify-build.mjs` together.
- **Permissions are exact.** `pnpm verify:build` pins them. Chromium: bookmarks, activeTab, unlimitedStorage, favicon, sidePanel (no host
  permissions). Firefox adds `<all_urls>`.
- **Firefox needs `data_collection_permissions: { required: ['none'] }`** and `strict_min_version` 140 (addons.mozilla.org rejects new
  add-ons without it). Do not remove either.
- **No remote code, no `eval`, no obfuscation** (Chrome Web Store policy). Minified is fine.
- **Test flags** are exact strings: `VITE_FOLIO_TEST=1` (adds `tabs` permission, allows localhost icon fetches, outputs to `.output-test`),
  `VITE_FOLIO_OPEN_PAGES=1`. Never ship a test build.
- **Document as you go.** Code is documented, tests sit next to code, docs change with behaviour, and every user-visible change gets a
  `CHANGELOG.md` line under _Unreleased_.

## Commands

```sh
pnpm install
pnpm check            # format, lint, types, unit tests: run before every commit
pnpm e2e:chromium     # builds the test build, drives real Chromium (24 checks); stable, run it for UI or popup changes
pnpm e2e:firefox      # same for Firefox/Zen (set ZEN_BIN or FIREFOX_BIN)
pnpm build            # .output/chrome-mv3     | pnpm build:firefox -> .output/firefox-mv2
pnpm zip              # also pnpm zip:firefox: release zips plus the sources zip
pnpm verify:build     # release manifests: permissions, no test code, update_url rules
pnpm screenshots      # docs/screenshots (README images), from sample data in scripts/sample-data.mjs
pnpm store-assets     # docs/store: Chrome Web Store screenshots and promo tile
cd site && npm run build   # website into site/dist and run its link/SEO/headers checks
```

## Git and GitHub workflow

- Work on a branch, open a PR, wait for CI, then merge with a **merge commit** (`gh pr merge N --merge`). Delete the branch afterwards.
  CI: format/lint/types/unit tests, build chrome, build firefox, website build, e2e Chromium (pinned to `ubuntu-24.04` because Playwright
  does not support the newer `ubuntu-latest`), e2e Firefox (non-blocking), plus Vercel previews.
- **Identity.** Commits use `folio@cinematicgenius007.com` (repo-local git config), never a personal address. Check `git config user.email`
  before committing. Commit messages explain why.
- **GitHub account.** The `gh` CLI's active account may not have push rights. Use the owner for repo operations without switching:
  `GH_TOKEN=$(gh auth token -u CinematicGenius007) gh ...`. Git itself pushes over SSH.
- GitHub Actions are pinned to commit SHAs; Dependabot proposes bumps. `main` is not branch-protected, but still go through PRs.
- Secrets are GitHub Actions secrets (`AMO_JWT_ISSUER`, `AMO_JWT_SECRET`). Never print or commit them; if you need a value from the user, ask for it
  through a secret prompt, not in chat.

## Releasing (summary; the procedure is `docs/RELEASING.md`)

1. Bump `version` in `package.json` (numeric, always increasing) and move the changelog's _Unreleased_ entries under it. PR, CI, merge.
2. Push a tag `vX.Y.Z` that equals `package.json`. The **Release** workflow builds both browsers, has Mozilla sign the Firefox build
   (unlisted/private channel), publishes the GitHub release (`.xpi` and zips) and commits the new entry to `site/public/updates.json`, which
   Vercel serves; installed Firefox/Zen copies then update themselves.

- **Tagging is irreversible**: Mozilla never accepts a version number twice, and the release is public. Tag only when the user asks.
- Never delete the add-on on addons.mozilla.org (its ID can never be reused). Never submit versions by hand there; the workflow does it.
- A copy installed before a build had `update_url` cannot self-update; the first such build is installed by hand from the release `.xpi`.
- Chromium: the release attaches `folio-<version>-chrome.zip`; users load it unpacked, or it goes to the Chrome Web Store (private
  visibility) following `docs/CHROME-STORE.md`.

## Website (`site/`)

Static HTML, inlined CSS, **no client JavaScript**, no FAQs. Deployed by Vercel with Root Directory `site`; the domain is
folio.cinematicgenius007.com. `npm run build` also runs `scripts/check.mjs` (unique title/description/canonical, one `<h1>`, no broken
links, valid JSON-LD, valid `updates.json`, valid `vercel.json` header patterns). Header `source` patterns must be valid path-to-regexp
**without nested capture groups**, or Vercel rejects the whole deploy. Docs pages are Markdown in `site/content/docs/` with front matter (`title`,
`nav`, `description`, `order`); raw HTML in them is escaped and non-https/mailto/relative links fail the build. Scene images are painted
by `site/scripts/paint-assets.py` and committed; `site/scripts/og.mjs` makes the social card and favicons. The website's look is the
"Reverie" style (one painted dusk-meadow scene, grain, no cards); the reusable recipe is the user-level skill `reverie-grain` if installed,
and `site/README.md` describes it.

## Design preferences (from the maintainer; honour them)

- Minimal, calm, close to minimal.so's centred layout. **Fills, not outlines**, for hover and selection; off-black rather than black.
- Keyboard first: every action has a key; shortcuts live in `components/dashboard/keymap.ts` (pure, tested) and are documented in
  `components/dialogs/HelpDialog.tsx`, the README and `site/content/docs/keyboard.md`. Change all of them together.
- Backgrounds (`components/backdrop`) must keep the centre column calm and let the edges carry the mood. Marble is the default; Meadow is
  the painted dusk option. Keep the app's own fonts (Geist); the website uses EB Garamond.
- The logo is six small fading dots, no letter. Keep it that way (`scripts/generate-icons.mjs`).

## Gotchas learned the hard way

- A dark icon that fills its square must not get a light plate; only dark glyphs on transparent backgrounds do (`lib/favicon/measure.ts`).
- Pressing `0` in the popup closes it via `window.close()`, which can surface as a Playwright error mid-keypress; e2e catches it.
- `upload-artifact` skips dot-directories, so the CI build job sets `include-hidden-files: true` for `.output`.
- Shell heredocs without quotes execute backticks: write files containing backticks with the editor tool or a quoted `'EOF'`.
- Markdown, JSON and workflow files are all formatted by Prettier (`pnpm format`); `pnpm check` fails on unformatted files.

## Where things stand (snapshot; verify before relying on it)

As of 2026-11-16: v0.1.2 is the latest release (signed, on GitHub, listed in `updates.json`). Firefox/Zen private distribution with automatic
updates works end to end, including the first one made by the Release workflow. Chromium is distributed by loading it unpacked; the Chrome Web
Store developer registration fee has not been paid yet (a payments error), so the store kit in `docs/CHROME-STORE.md` is ready but not
submitted. Dependabot PRs may be waiting for review.
