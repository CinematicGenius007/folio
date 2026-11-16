---
title: Folio privacy and permissions
nav: Privacy
description: What Folio stores, which browser permissions it asks for and why, and its only network request, explained plainly.
order: 6
---

# Privacy and permissions

Folio is local-first. There is no Folio server, no account, no analytics and no telemetry.

## What Folio stores

- **Your bookmarks:** not stored by Folio. They stay in the browser's own bookmark tree.
- **A search index:** a rebuildable copy of titles, links and folders in the browser's IndexedDB, so search is instant.
- **Tags and notes you add:** IndexedDB, on this device only.
- **Deleted bookmarks:** kept for 30 days so you can undo, then removed.
- **Site icons** (Firefox and Zen): small cached images.
- **Settings:** theme, background (including an image you pick), the last folder used, and local folder pick counts used only to rank save suggestions on this device.

Uninstalling Folio removes all of the above and leaves your bookmarks untouched.

## Network use

| Browser                       | Network requests                                                               |
| ----------------------------- | ------------------------------------------------------------------------------ |
| Chrome, Edge, Brave, Arc, Dia | **None.** Icons come from the browser's own cache.                             |
| Firefox and Zen               | Fetches each bookmarked site's icon **directly from that site**. Nothing else. |

Privately signed Firefox and Zen builds also carry an update address on this site. Firefox itself, not Folio, requests that small file about once a day to check for a newer version. Builds you make yourself have none.

How the Firefox and Zen icon fetcher behaves:

- Requests carry no cookies and no referrer.
- Only public `http` and `https` addresses are contacted. `localhost`, private and link-local ranges (including their IPv6 forms), `.local` names and single-word hostnames are never requested, so a bookmark to your router or intranet is never probed. A public site that redirects to a private address is ignored.
- Downloads are capped (300 KB for an icon, 200 KB for a page) and time out after 6 seconds.
- Results are cached for 30 days (7 when no icon was found).
- No third-party icon service is used, so your list of sites goes to no one but the sites themselves.

## Permissions

| Permission                 | Why                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| `bookmarks`                | Read and change your bookmarks. This is the whole point.                                          |
| `activeTab`                | Read the title and link of the page you save, only when you click the icon or press the shortcut. |
| `unlimitedStorage`         | The search index, icons and an optional background image can outgrow the default quota.           |
| `favicon` (Chromium)       | Read the browser's own icon cache.                                                                |
| `sidePanel` (Chromium)     | Show the side panel.                                                                              |
| Site access (Firefox, Zen) | Fetch site icons as described above. Not requested on Chromium.                                   |

Folio does not ask for `history`, `cookies`, `webRequest`, `scripting` or `downloads`, and has no content scripts: it never reads or changes the pages you browse.

## Safety

- Only `http`, `https` and `ftp` links are opened or saved. `javascript:`, `data:` and `file:` links are shown but never followed.
- Backup files are size-limited and checked field by field before anything is restored.

## Chrome Web Store user data policy

The use of information received from Chrome APIs will adhere to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), including the Limited Use requirements. Folio uses bookmark data only to provide its bookmark features, never transfers it, and never uses it for advertising or unrelated purposes.

## This website

This site has no cookies, no analytics and no scripts. Questions: [folio@cinematicgenius007.com](mailto:folio@cinematicgenius007.com).
