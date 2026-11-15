# Privacy

Folio is local-first. There is no Folio server, no account, no analytics and no telemetry.

## What Folio stores

- **Your bookmarks:** not stored by Folio. They stay in the browser's own bookmark tree.
- **A local index:** a rebuildable copy of titles, URLs and folders in the browser's IndexedDB, used for instant search.
- **Tags and notes you add:** IndexedDB, on this device only.
- **Deleted bookmarks:** kept for 30 days in IndexedDB so you can undo, then purged.
- **Cached favicons** (Firefox and Zen): small PNG or SVG files in IndexedDB.
- **Settings:** theme, background (including an image you choose, stored locally), last folder used.

Uninstalling the extension removes all of the above. Your bookmarks are untouched. Export a JSON backup first to keep tags and notes.

## Network use

| Browser         | Network calls                                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Chromium family | **None.** Icons come from the browser's own cache.                                                                                |
| Firefox and Zen | Fetches each bookmarked site's favicon **directly from that site** (its HTML to find the icon link, then the icon). Nothing else. |

Builds signed for private distribution also carry an update address on `folio.cinematicgenius007.com`. Firefox itself, not Folio, requests that small file about once a day to see whether a newer version exists; it contains no information about you and the site sets no cookies. Builds you make yourself have no update address.

Details of the Firefox/Zen fetcher:

- Requests are made without cookies and without a referrer.
- Only public `http`/`https` hosts are contacted. `localhost`, private and link-local ranges (including IPv6 forms), `.local` and single-label names are never requested, so a bookmark to your router or intranet is not probed. If a public site redirects an icon request to a private address, the answer is discarded unread.
- Responses are size-capped while downloading (300 KB for an icon, 200 KB for a page) and time out after 6 seconds.
- Results are cached (30 days for a found icon, 7 for a miss), so a site is contacted rarely.
- No third-party icon service is used, so your list of sites is not sent to anyone but the sites themselves.

## Permissions

| Permission                       | Why it is needed                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `bookmarks`                      | Read and change the native bookmark tree. This is the whole point of the extension.                           |
| `activeTab`                      | Read the title and URL of the page you save from the popup, only when you click the icon or use the shortcut. |
| `unlimitedStorage`               | The local index, cached icons and an optional background image can exceed the default quota.                  |
| `favicon` (Chromium)             | Read the browser's own favicon cache.                                                                         |
| `sidePanel` (Chromium)           | The side panel.                                                                                               |
| `<all_urls>` host (Firefox, Zen) | Fetch site icons, as described above. Not requested on Chromium.                                              |

Folio does **not** request `history`, `cookies`, `webRequest`, `scripting`, `downloads` or `storage`, and has no content scripts: it never reads or changes the pages you browse.

## Safety measures

- Only `http`, `https` and `ftp` bookmarks are opened. `javascript:`, `data:`, `file:` and browser-internal URLs are shown but never navigated to.
- Imported backups are size-limited (10 MB, 50,000 entries) and validated field by field before anything is written.
- Folio only saves or edits links with `http`, `https` or `ftp` schemes.
- All user-provided text is rendered through React, which escapes it; there is no raw HTML injection.
- The extension uses the browsers' default content security policy.

Questions or concerns: [folio@cinematicgenius007.com](mailto:folio@cinematicgenius007.com).
