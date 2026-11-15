#!/usr/bin/env node
// Fails if a release build contains anything that belongs only to test builds, or asks for more than documented.
// Run after `pnpm build` / `pnpm build:firefox`:  pnpm verify:build
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../.output/', import.meta.url));
const EXPECTED = {
  'chrome-mv3': { permissions: ['activeTab', 'bookmarks', 'favicon', 'sidePanel', 'unlimitedStorage'], hosts: [] },
  'firefox-mv2': { permissions: ['<all_urls>', 'activeTab', 'bookmarks', 'unlimitedStorage'], hosts: [] },
};

let failures = 0;
const fail = (message) => {
  failures++;
  console.error(`FAIL  ${message}`);
};

const built = Object.keys(EXPECTED).filter((name) => existsSync(`${root}${name}/manifest.json`));
if (!built.length) fail('no build found in .output/; run pnpm build first');

for (const name of built) {
  const manifest = JSON.parse(readFileSync(`${root}${name}/manifest.json`, 'utf8'));
  const permissions = [...(manifest.permissions ?? [])].sort();
  if (JSON.stringify(permissions) !== JSON.stringify(EXPECTED[name].permissions)) {
    fail(
      `${name}: permissions are ${JSON.stringify(permissions)}, expected ${JSON.stringify(EXPECTED[name].permissions)}`,
    );
  }
  if ((manifest.host_permissions ?? []).length)
    fail(`${name}: unexpected host_permissions ${JSON.stringify(manifest.host_permissions)}`);
  if (manifest.web_accessible_resources) fail(`${name}: web_accessible_resources must not be set in a release build`);
  if (manifest.content_scripts) fail(`${name}: Folio has no content scripts`);
  if (name === 'firefox-mv2') {
    // addons.mozilla.org rejects new add-ons without this, and it is a promise we keep (docs/PRIVACY.md).
    const declared = manifest.browser_specific_settings?.gecko?.data_collection_permissions;
    if (JSON.stringify(declared) !== JSON.stringify({ required: ['none'] }))
      fail(`${name}: data_collection_permissions must be {"required":["none"]}, got ${JSON.stringify(declared)}`);
  }

  // The background must not contain the test-only code that opens extension pages as tabs.
  const background = readFileSync(`${root}${name}/background.js`, 'utf8');
  if (background.includes('sidepanel.html')) fail(`${name}: background.js contains test-only page-opening code`);

  if (!failures) console.log(`PASS  ${name}: permissions ${permissions.join(', ')}`);
}

if (existsSync(`${root}../.output-test`) && process.env.CI)
  console.log('note: .output-test exists but is never published');
process.exitCode = failures ? 1 : 0;
