---
title: Build Folio from source and contribute
nav: Build and contribute
description: Build the Folio extension from source with Node and pnpm, run its tests, and contribute fixes or features to the open-source project.
order: 9
---

# Build and contribute

Folio is MIT licensed and developed in the open on [GitHub](https://github.com/CinematicGenius007/folio).

## Build from source

You need [Node.js](https://nodejs.org) 20 or newer (22 recommended) and [pnpm](https://pnpm.io).

```sh
git clone https://github.com/CinematicGenius007/folio.git
cd folio
pnpm install

pnpm build            # Chromium  -> .output/chrome-mv3
pnpm build:firefox    # Firefox   -> .output/firefox-mv2
```

Then load the folder as described in [Install](/docs/install).

## Develop

```sh
pnpm dev            # Chromium with hot reload
pnpm dev:firefox    # Firefox
pnpm check          # formatting, lint, types and unit tests
pnpm e2e:chromium   # end-to-end tests in a throwaway Chromium profile
pnpm e2e:firefox    # the same in Zen or Firefox
```

## Ways to help

- **Report a bug** with the browser, its version and the steps to reproduce it, as an [issue](https://github.com/CinematicGenius007/folio/issues).
- **Suggest a shortcut or feature.** Small, keyboard-first ideas fit best.
- **Send a pull request.** Read [CONTRIBUTING.md](https://github.com/CinematicGenius007/folio/blob/main/CONTRIBUTING.md) first; it covers the project layout, conventions and tests.

Security issues: please follow the [security policy](https://github.com/CinematicGenius007/folio/blob/main/SECURITY.md) instead of opening a public issue.
