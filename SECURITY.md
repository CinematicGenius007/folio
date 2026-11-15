# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for a security problem. Email
[folio@cinematicgenius007.com](mailto:folio@cinematicgenius007.com) with:

- what you found and where (file, function, or behaviour),
- steps or a proof of concept to reproduce it,
- the browser and Folio version.

You will get an acknowledgement within a few days. Folio is maintained by volunteers, so fixes are made as quickly as is practical, and
you will be told when one is released. Please give us a reasonable time to fix an issue before discussing it publicly. If you like, we will credit you in the changelog.

## Supported versions

Only the latest release is supported.

## Threat model

Folio runs only inside the browser's extension sandbox, has no server, and has no content scripts, so it never sees or changes web pages.
What it protects, and how:

| Risk                                             | Mitigation                                                                                                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A bookmark whose URL is `javascript:` or `data:` | Only `http`, `https` and `ftp` URLs are ever opened (`isSafeUrl`). Other bookmarks are listed and marked "not openable".                                     |
| Hostile text in titles, tags, notes or backups   | All text is rendered through React (escaped). There is no `dangerouslySetInnerHTML`. Backups are validated field by field and size-limited.                  |
| The icon fetcher probing your private network    | Only public `http(s)` hosts are requested; loopback, private ranges, `.local` and single-label hosts are refused. Requests carry no cookies and no referrer. |
| Over-broad permissions                           | `bookmarks`, `activeTab`, `unlimitedStorage`, plus Chromium's `favicon` and `sidePanel`. Host access is requested only on Firefox/Zen, for icons.            |
| Data leaving the device                          | Nothing is sent anywhere by Folio. There is no analytics. Firefox/Zen contact bookmarked sites directly to fetch icons.                                      |
| Scripts injected into the extension pages        | The default MV3/MV2 content security policy applies; there is no inline script and no remote code.                                                           |

Known limits worth stating plainly:

- Icon requests follow HTTP redirects. If a public site redirects to a private address, the request to that address is still made, but the final URL is checked and the answer is discarded unread. Browsers cannot be told to validate each hop, and DNS rebinding cannot be ruled out from inside an extension.
- The IndexedDB data is not encrypted, like the rest of the browser profile. Anyone with access to your profile can read your tags and notes.
- The test build (`VITE_FOLIO_TEST=1`) relaxes some rules for automation (extra `tabs` permission, localhost icon fetching). The flag must be exactly `1`, test builds go to a separate `.output-test/` folder, and `pnpm verify:build` fails the release if a build asks for anything beyond the documented permissions.

## Dependencies

Dependencies are few (React, Dexie, MiniSearch, Tailwind, WXT) and updated through Dependabot. Reproducible installs use `pnpm install --frozen-lockfile`. GitHub Actions are pinned to full commit SHAs, workflows are read-only by default, and only the release job may write, to publish a release.
