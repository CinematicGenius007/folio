---
title: Install Folio in Chrome, Edge, Brave, Arc, Dia, Firefox and Zen
nav: Install
description: Step-by-step installation of the Folio bookmark extension for every Chromium browser and for Firefox and Zen, from a release or from source.
order: 2
---

# Install

Folio is not on a browser store yet, so you install it from a build. Get one of two ways:

1. **Download a release.** Each [GitHub release](https://github.com/CinematicGenius007/folio/releases) has a zip for Chromium browsers and one for Firefox and Zen.
2. **Build it yourself** in about a minute. See [Build and contribute](/docs/contributing).

Either way you end up with a folder: `chrome-mv3` for Chromium browsers, `firefox-mv2` for Firefox and Zen.

## Chrome, Edge, Brave, Arc, Dia

1. Unzip the Chromium release.
2. Open `chrome://extensions`. In Edge it is `edge://extensions`; in Dia, use `dia://extensions` if the `chrome://` address does not open.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and choose the `chrome-mv3` folder, the one that contains `manifest.json`.
5. Pin Folio to the toolbar so the popup is one click away.

The extension stays installed across restarts. To update, replace the folder with the new release and click the reload icon on Folio's card.

## Firefox and Zen

Both use the same `firefox-mv2` build.

### Try it

1. Unzip the Firefox release.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on** and pick `manifest.json` inside the `firefox-mv2` folder.

A temporary add-on is removed when the browser restarts. Your bookmarks are untouched, and loading Folio again picks up your tags and notes.

### Keep it

Release builds of Firefox and Zen only keep **signed** add-ons. Mozilla signs unlisted add-ons for free without publishing them:

```sh
npx web-ext sign --channel=unlisted --source-dir firefox-mv2 \
  --api-key "$AMO_JWT_ISSUER" --api-secret "$AMO_JWT_SECRET"
```

Create the key and secret at [addons.mozilla.org](https://addons.mozilla.org/developers/addon/api/key/). Open the signed `.xpi` it writes to install Folio permanently. Firefox Developer Edition, Nightly and ESR can also run unsigned add-ons with `xpinstall.signatures.required` set to `false` in `about:config`.

## Shortcuts after installing

The defaults are `Alt+S` (save), `Alt+Shift+F` (full page) and `Alt+Shift+B` (side panel). Change them at `chrome://extensions/shortcuts` in Chromium browsers, or in Firefox and Zen under `about:addons`, the gear menu, **Manage Extension Shortcuts**.

## Uninstalling

Remove Folio from the extensions page. Your bookmarks are never touched. Folio's own data (tags, notes, settings, icon cache) goes with it, so export a backup first from the Folio menu (`O`, then **Back up tags and notes**) if you want to keep them.
