# Releasing

How a version of Folio gets to people. This covers the private (unlisted) Firefox and Zen distribution with automatic updates, and the Chromium zip. Nothing here publishes Folio on a public store.

## How updates reach Firefox and Zen

Mozilla signs the Firefox build as an **unlisted** add-on: signed, but never listed or searchable on addons.mozilla.org. A build made for this has `update_url` in its manifest pointing at
`https://folio.cinematicgenius007.com/updates.json`. The browser itself checks that file about once a day, and when it lists a newer version it downloads the signed `.xpi` from the GitHub release and installs it.

```
git tag v0.1.2 ──► release workflow ──► build ──► Mozilla signs ──► GitHub release (.xpi, zips)
                                                                      │
                          site/public/updates.json ◄── commit ◄───────┘
                                   │
                          Vercel redeploys the site ──► installed copies update
```

`update_url` is added only when the `FOLIO_UPDATE_URL` environment variable is set, which only the release workflow does. Local and CI builds have none, and `pnpm verify:build` fails if it appears when it shouldn't, or is missing when it should be there.

## One-time setup

1. Create an API key at <https://addons.mozilla.org/developers/addon/api/key/>.
2. Add its two values as repository secrets named `AMO_JWT_ISSUER` and `AMO_JWT_SECRET` (Settings, Secrets and variables, Actions).
3. Make sure the Vercel project for `site/` is connected, so a push to `main` redeploys `updates.json`.

The add-on (`folio@cinematicgenius007.com`) already exists on addons.mozilla.org. Never delete it: Mozilla does not let an add-on ID be reused.

## Cutting a release

1. Update `version` in `package.json`, and move the changelog's _Unreleased_ entries under the new version. Versions must be numeric and must increase: Mozilla refuses a version number it has seen, even one that was deleted.
2. Merge that to `main` through a pull request.
3. Tag and push:

   ```sh
   git switch main && git pull
   git tag v0.1.2
   git push origin v0.1.2
   ```

4. The **Release** workflow runs `pnpm check`, builds both browsers, gets Mozilla to sign the Firefox build, publishes a GitHub release, and commits the new entry to `site/public/updates.json`. The tag must match `package.json`, or it stops.

Signing is normally automatic within minutes. If Mozilla holds a version for manual review, the workflow waits up to 30 minutes and then fails. When that happens, check the version's page on addons.mozilla.org; once it is approved, re-run the failed job, which finds the already-signed upload.

Reviewer notes and the source-code upload are sent with every signing request (`.github/amo-metadata.json` and the sources zip). Update the notes there if the build steps or permissions change.

## The first signed copy

A copy installed before `update_url` existed cannot update itself. Install one release by hand, from the `.xpi` on its GitHub release (drag it onto a Firefox or Zen window); every later version arrives automatically.

## Chromium (Dia, Chrome, Brave)

The release attaches `folio-<version>-chrome.zip`. Without a store listing, unzip it and use **Load unpacked** (see [INSTALL.md](INSTALL.md)); it does not auto-update. For private distribution with updates, use the Chrome Web Store's **Private** (trusted testers) or **Unlisted** visibility: upload the same zip there, using the text and images in [CHROME-STORE.md](CHROME-STORE.md).

## Checks before tagging

```sh
pnpm check
FOLIO_UPDATE_URL=https://folio.cinematicgenius007.com/updates.json pnpm zip:firefox
FOLIO_UPDATE_URL=https://folio.cinematicgenius007.com/updates.json pnpm verify:build
(cd site && npm run build)
```
