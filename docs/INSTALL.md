# Installing Folio

Folio is not on a browser store yet, so you install it from a build. There are two ways to get one.

1. **Download a release.** Each [GitHub release](https://github.com/CinematicGenius007/folio/releases) attaches a zip per browser family.
2. **Build it yourself** (about a minute). See [Build from source](#build-from-source).

Either way you end up with a folder: `chrome-mv3` for Chromium browsers, `firefox-mv2` for Firefox and Zen.

## Chrome, Edge, Brave, Arc, Dia and other Chromium browsers

1. Unzip the Chromium release, or build with `pnpm build` and use `.output/chrome-mv3`.
2. Open `chrome://extensions` (`edge://extensions` in Edge, and `dia://extensions` if Dia does not accept the `chrome://` address).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and choose the `chrome-mv3` folder.
5. Pin Folio to the toolbar so the popup is one click away.

The extension stays installed across restarts. After pulling a new version, click the reload icon on Folio's card.

Set your own shortcuts at `chrome://extensions/shortcuts`. The defaults are `Alt+S` (save), `Alt+Shift+F` (dashboard) and
`Alt+Shift+B` (side panel). On macOS, `Alt+S` is also the key combination that types `ß`; the browser handles the shortcut first, but
rebind it if you prefer.

## Firefox and Zen

Both are Firefox-based and use the same build, `firefox-mv2`.

### Try it (temporary)

1. Unzip the Firefox release, or build with `pnpm build:firefox` and use `.output/firefox-mv2`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on** and select the `manifest.json` file inside the `firefox-mv2` folder.

A temporary add-on is removed when the browser restarts. Your bookmarks are untouched, and your tags and notes are
kept in the browser profile, so loading it again picks up where you left off. Export a backup from Folio's settings first if you want to be safe.

### Keep it (permanent)

Release builds of Firefox and Zen only keep **signed** add-ons. Pick one of these.

**Sign it yourself for free (recommended).** Mozilla signs unlisted add-ons without publishing them:

```sh
pnpm build:firefox
npx web-ext sign --channel=unlisted --source-dir .output/firefox-mv2 \
  --api-key "$AMO_JWT_ISSUER" --api-secret "$AMO_JWT_SECRET"
```

Create the API key and secret at <https://addons.mozilla.org/developers/addon/api/key/>. The command writes a signed `.xpi`;
open it in the browser, or drag it onto a window, to install it permanently. Keep the same add-on ID
(`folio@cinematicgenius007.com`) and bump the version in `package.json` for each new signed build.

**Use a browser that allows unsigned add-ons.** Firefox Developer Edition, Nightly and ESR honour
`xpinstall.signatures.required = false` in `about:config`. Release Firefox and Zen ignore it.

### Shortcuts in Firefox and Zen

Open `about:addons`, click ⚙, choose **Manage Extension Shortcuts**, and set Folio's commands. The sidebar can also be opened from
the sidebar picker (`View → Sidebar → Folio`).

## Build from source

You need [Node.js](https://nodejs.org) 20 or newer (22 recommended, see `.nvmrc`) and [pnpm](https://pnpm.io).

```sh
git clone https://github.com/CinematicGenius007/folio.git
cd folio
pnpm install

pnpm build            # Chromium  -> .output/chrome-mv3
pnpm build:firefox    # Firefox   -> .output/firefox-mv2
pnpm zip              # also produces distributable .zip files in .output/
pnpm zip:firefox
```

To hack on it with hot reload, use `pnpm dev` (opens a Chromium profile with the extension loaded) or `pnpm dev:firefox`.
See [CONTRIBUTING.md](../CONTRIBUTING.md).

## Updating and uninstalling

- **Update:** build or download the new version and reload the extension. Settings, tags and notes live in the browser profile and survive updates.
- **Uninstall:** remove the extension from the browser's extension page. Your bookmarks are never touched. Folio's own data (tags, notes,
  settings, icon cache) is removed with the extension, so **export a backup first** (Folio menu → _Back up tags and notes_) if you want to keep your tags and notes.
- Folio creates one folder named **Inbox** under "Other bookmarks" for quick saves. It is an ordinary folder; delete or rename it any time.

## Troubleshooting

| Symptom                                    | Fix                                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Load unpacked says the manifest is missing | You chose the parent folder. Choose the folder that contains `manifest.json`.                                             |
| `Alt+S` does nothing                       | Another extension or the OS owns it. Rebind it in the browser's extension shortcut settings.                              |
| The dashboard is empty                     | Give it a second after install; the first sync reads your whole bookmark tree. Reloading the page forces a re-read.       |
| Icons are letters, not logos (Chromium)    | Chromium only has icons for pages you have visited. Folio shows a letter tile for the rest.                               |
| Icons are letters, not logos (Firefox/Zen) | Icons are fetched in the background after install; give it a minute. Sites that block automated requests keep their tile. |
