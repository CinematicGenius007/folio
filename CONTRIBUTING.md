# Contributing to Folio

Thanks for helping. Folio is small on purpose, so contributions that keep it fast, quiet and keyboard-friendly fit best.
Bugs, ideas and questions are all welcome: open an [issue](https://github.com/CinematicGenius007/folio/issues) or email
[folio@cinematicgenius007.com](mailto:folio@cinematicgenius007.com).

Using an AI coding agent? Point it at [AGENTS.md](AGENTS.md); it holds the project's working rules, release procedure and gotchas.

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Contributions are licensed under the [MIT License](LICENSE).

## Set up

You need Node.js 20 or newer (22 recommended; `nvm use` reads `.nvmrc`) and [pnpm](https://pnpm.io).

```sh
git clone https://github.com/CinematicGenius007/folio.git
cd folio
pnpm install
pnpm dev             # Chromium with hot reload
pnpm dev:firefox     # Firefox
```

`pnpm dev` opens a browser profile with the extension loaded. Edit a file and the extension reloads. Create a few bookmarks and folders in that
profile to work with, or run `pnpm screenshots` to see the sample data the docs use.

### Scripts

| Script                                  | What it does                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| `pnpm check`                            | Format check, lint, type check and unit tests. **Run before committing.**    |
| `pnpm test`                             | Unit tests (Vitest)                                                          |
| `pnpm lint` / `pnpm compile`            | ESLint / TypeScript                                                          |
| `pnpm format`                           | Prettier, writes changes                                                     |
| `pnpm e2e:chromium`, `pnpm e2e:firefox` | End-to-end tests in a throwaway profile ([docs/TESTING.md](docs/TESTING.md)) |
| `pnpm build`, `pnpm build:firefox`      | Production builds into `.output/`                                            |
| `pnpm zip`, `pnpm zip:firefox`          | Distributable zips                                                           |
| `pnpm icons`, `pnpm screenshots`        | Regenerate the icon set and the README screenshots                           |

## Project layout

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first; it explains the one-way data flow and the module map. In short:

- `lib/core`: pure logic (projector, tree, search, scheduler). No React and no browser API.
- `lib/actions`: every change to data. UI code calls these, never `browser.bookmarks` directly.
- `components/`: React UI, grouped by feature. Reads come from `useLibrary()`.
- `entrypoints/`: thin WXT entry files.

**The one rule that matters:** pages never write the read model (`db.bookmarks`, `db.folders`). Change the browser's tree through `lib/actions`, and the
projector in the background script updates the read model. If you find yourself wanting to write it from a page, the change belongs in an action instead.

## Conventions

- **TypeScript strict**, no `any` without a reason. Prefer small pure functions that take their inputs as arguments.
- **Formatting is automatic** (Prettier, 120 columns, single quotes). Run `pnpm format`. ESLint must be clean.
- **Comments explain why**, not what. Every exported function, hook and component has a short doc comment saying what it is for and any caveat.
- **Keep files focused.** A component that needs more than about 250 lines is usually two components, or a component plus a pure function (see how `Dashboard` leans on `buildEntries` and `handleKey`).
- **Style with tokens.** Use semantic Tailwind names (`bg-ground`, `text-muted`) and CSS variables from `styles/theme.css`, never raw hex values. See [docs/DESIGN.md](docs/DESIGN.md).
- **No heavy outlines.** Hover and selection are fills; a 1 px ring is only for text-field focus.
- **Accessible by default.** Use real buttons, `role`s and `aria-*`, keep keyboard paths for everything, and test both themes.

## Adding things

**A keyboard shortcut.** Add the key to `components/dashboard/keymap.ts` (and its action to `KeyActions`), implement it in `Dashboard.tsx`, add a test in `keymap.test.ts`,
list it in `components/dialogs/HelpDialog.tsx`, and in the README table if it is global.

**A setting.** Store it with `setSetting(key, value)`, read it with `useSetting(key, default)` (live across pages), and expose it in `SettingsDialog`. If it is user data worth backing up, extend `lib/actions/backup.ts` and its validation.

**A background style.** Add a density function to `components/backdrop/dither.ts` (it returns 0 to 1 for a position) with a range test, or, for a painted scene, a pure module like `meadow.ts` with its own tests, then add it to the style list in `SettingsDialog` and the `Background['style']` type.

**A browser permission.** Avoid it. If unavoidable, add it in `wxt.config.ts` with a comment saying why, and update [docs/PRIVACY.md](docs/PRIVACY.md) in the same pull request.

**A data field.** Update `lib/core/types.ts`, bump the Dexie `version()` in `lib/core/db.ts` and clear the read-model tables in its `upgrade()` (see the comment there), make the projector write the field, and add a test to `projector.test.ts` and `db.test.ts`.

## Tests

Every behaviour change needs a test. See [docs/TESTING.md](docs/TESTING.md) for what exists and how to test on Zen.
Bug fixes start with a failing test that shows the bug. Put pure logic in `lib/` or beside its component so it can be tested without a browser.

## Pull requests

1. Fork, then branch from `main`: `feat/folder-colors`, `fix/popup-undo`.
2. Make a focused change. Unrelated cleanups belong in their own pull request.
3. Run `pnpm check`, and `pnpm e2e:chromium` for anything that touches pages or the background.
4. Update docs and `CHANGELOG.md` (under _Unreleased_) when behaviour changes. Add screenshots for visual changes, in both themes.
5. Open the pull request and fill in the template.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org): `feat: add folder colors`, `fix(popup): keep undo after remove`, `docs: explain zen install`.
Keep the subject under 72 characters and explain the _why_ in the body when it is not obvious.

## Reporting bugs and suggesting features

Use the issue templates. For a bug, include your browser and version, Folio's version (`about:debugging` / `chrome://extensions`), what you expected, and what happened.
For a feature, describe the problem first; a screenshot or sketch helps. **Security issues go to email, not to a public issue**: see [SECURITY.md](SECURITY.md).

## Releasing (maintainers)

1. Update `version` in `package.json` and move _Unreleased_ in `CHANGELOG.md` under the new version.
2. `pnpm check && pnpm e2e:chromium && pnpm e2e:firefox`.
3. Tag `vX.Y.Z` and push the tag. The release workflow builds both zips and attaches them to a GitHub release.
4. For a permanent Firefox/Zen build, sign it as unlisted ([docs/INSTALL.md](docs/INSTALL.md)).
