# Chrome Web Store listing

Everything needed to list Folio on the Chrome Web Store, privately at first. It is written against the
[Chrome Web Store program policies](https://developer.chrome.com/docs/webstore/program-policies) and kept next to the code so the
listing, the privacy page and the build cannot drift apart. The release process itself is in [RELEASING.md](RELEASING.md).

## Before you start

- A Google account for the developer account, with **2-Step Verification** on. The publisher name and contact details are shown publicly, so consider an account dedicated to the project.
- The one-time developer registration fee, paid in the developer dashboard.
- The package: `folio-<version>-chrome.zip` from the [GitHub release](https://github.com/CinematicGenius007/folio/releases) (or `pnpm zip`). Every upload needs a higher `version` than the last, and every update is reviewed before it reaches users.

## Visibility: keep it private

Distribution tab, **Visibility**:

| Option                       | Who can install                   | Use it for                                                                                                                                 |
| ---------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Private**, trusted testers | Only Google accounts you list     | A closed beta. The tester list belongs to your whole developer account, one email per person. Google Groups can also be attached per item. |
| **Unlisted**                 | Anyone with the item's store link | Sharing by link without a search listing                                                                                                   |
| Public                       | Everyone                          | Not planned                                                                                                                                |

All three go through the same review. Choose **All regions** unless you want to limit it.

## Store listing tab

| Field                          | Value                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Name                           | Folio                                                                                                                          |
| Summary (limit 132 characters) | A calm, keyboard-first home for the bookmarks Chrome already keeps: instant search, nested folders, tags and notes. On-device. |
| Category                       | Productivity                                                                                                                   |
| Language                       | English                                                                                                                        |
| Official URL / homepage        | https://folio.cinematicgenius007.com                                                                                           |
| Support URL                    | https://github.com/CinematicGenius007/folio/issues                                                                             |
| Support email                  | folio@cinematicgenius007.com                                                                                                   |

### Description

Plain text, pasted as is. It follows the quality rules: no keyword lists, no word repeated more than five times, no testimonials, and nothing the Chromium build does not do.

```text
Folio gives the bookmarks Chrome already keeps a faster, calmer home.

It does not copy or replace anything. Folio reads and edits Chrome's own bookmark tree, so everything you save still shows in the bookmark bar and syncs the way it always did. Remove Folio and every saved link is still there.

WHAT YOU GET
• Instant search across titles, links, tags, notes and folder names, with forgiving matching.
• Real nested folders: walk them from the keyboard, jump to any one by typing part of its name, and see where you are in a breadcrumb.
• Save the page you're on with Alt+S: pick a folder with a number key, add a note or #tags, press Enter.
• Tags and notes on any saved page, kept on your device, with one-file backup and restore.
• Undo for deletes: removed items wait 30 days and come back with Z, along with what you wrote about them.
• A heads-up when you save a page you already have, ignoring tracking parameters.
• Three ways in: the toolbar popup, a full-page library, and a side panel.
• Light and dark themes, plus an optional quiet background or your own picture.

KEYBOARD FIRST
J and K to move, Enter to open, / to search, C to switch folders, E to edit, M to move, X to select, Z to undo, ? to see every key.

PRIVATE BY DESIGN
No account, no server, no analytics, and no network requests of its own. Everything you add stays in your browser profile.

Open source (MIT): github.com/CinematicGenius007/folio
```

### Images

Generated from the real extension by `pnpm store-assets` into `docs/store/`. Screenshots are 1280x800; upload them in this order. The small promo tile is 440x280 and optional. The 128px icon comes from the package.

| File                           | What it shows                                         |
| ------------------------------ | ----------------------------------------------------- |
| `1-your-library.jpg`           | The library in the light theme                        |
| `2-instant-search.jpg`         | Search narrowing the list as you type                 |
| `3-folder-switcher.jpg`        | Jumping to a nested folder by typing part of its name |
| `4-nested-folders.jpg`         | The breadcrumb inside a nested folder                 |
| `5-themes-and-backgrounds.jpg` | The dark theme with the Meadow background             |
| `6-save-from-the-toolbar.jpg`  | The save popup                                        |
| `promo-small-440x280.png`      | Small promo tile                                      |

## Privacy tab

**Single purpose**

> Folio helps you save, find and organise your browser bookmarks.

Every feature serves it: the popup saves the current page, the library and side panel browse and search, tags and notes annotate, and the background and themes are only the look of the library.

**Permission justifications** (the dashboard asks for one per permission; the build has no host permissions and no content scripts):

| Permission         | Justification                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bookmarks`        | The core purpose: read, display, search, add, edit, move and delete the user's bookmarks.                                                                                 |
| `activeTab`        | Reads the title and address of the current tab only when the user clicks the toolbar icon or uses the shortcut, so the page can be saved.                                 |
| `unlimitedStorage` | Keeps a local, rebuildable search index of the user's bookmarks, and an optional background image the user picks, in IndexedDB. Large libraries exceed the default quota. |
| `favicon`          | Shows each bookmark's site icon from the browser's own icon cache. No external icon service is used.                                                                      |
| `sidePanel`        | Offers the same library in the browser's side panel.                                                                                                                      |

**Remote code:** No. Everything runs from the package; there is no `eval`, no `new Function` and no remote script. The code is minified, not obfuscated, and ships no source maps.

**Data usage.** Folio reads the user's bookmarks on their own device and sends nothing anywhere: the Chromium build makes no network requests. Read the dashboard's own definitions of "collect" and of each data type before ticking boxes, because the policy pages do not say whether bookmarks held only on the device count. Whatever you declare must not contradict the privacy page. The three certifications (no sale of data, no use for unrelated purposes, no use for creditworthiness) are all true.

**Privacy policy URL:** https://folio.cinematicgenius007.com/docs/privacy

The same page carries the **Limited Use** statement the policy requires on the developer's website, and it is linked from the footer of every page.

## Test instructions for the reviewer

```text
No account or login is needed and the extension makes no network requests.
1. Open any http or https page and click the toolbar icon (or press Alt+S). Pick a folder with a number key, or press / to search folders, then Enter to save.
2. Press Alt+Shift+F to open the full-page library. Use J and K to move, / to search, C to switch folders, ? for every shortcut.
3. Press B, then choose Meadow, to see the optional background.
Folio requests only: bookmarks, activeTab, unlimitedStorage, favicon, sidePanel. No host permissions, no content scripts, no remote code.
Source: https://github.com/CinematicGenius007/folio (MIT)
```

## Policy checklist

| Policy                         | How Folio meets it                                                          |
| ------------------------------ | --------------------------------------------------------------------------- |
| Single purpose                 | Bookmark management only, stated above                                      |
| Use of permissions             | Five permissions, each used today, none for future features                 |
| Limited Use and privacy policy | Privacy page linked in the dashboard; Limited Use statement on the website  |
| Remote code (Manifest V3)      | None; the build contains no `eval`, `new Function` or remote script         |
| Code readability               | Minified only, no obfuscation, no source maps                               |
| Listing quality                | Description, icon and screenshots present; no keyword spam; no testimonials |
| Misleading behaviour           | The listing describes only what the Chromium build does                     |

## Updating the listing

Upload the new `folio-<version>-chrome.zip` under **Package** and submit it for review. Re-read the privacy tab if a release changes permissions or data handling, and keep this document in step.
