// Maintains site/public/updates.json, the update manifest Firefox and Zen read to find new versions of a
// self-distributed (unlisted) Folio build. The release workflow runs it after signing; see docs/RELEASING.md.
//
//   node scripts/update-manifest.mjs <version> <signed.xpi> <https download url> [updates.json]
//
// Format: https://extensionworkshop.com/documentation/manage/updating-your-extension/

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ADDON_ID = 'folio@cinematicgenius007.com';
/** Matches `strict_min_version` in wxt.config.ts: the first Firefox that understands data_collection_permissions. */
export const MIN_FIREFOX = '140.0';

const VERSION = /^\d+(\.\d+){0,3}$/;

/** Orders dotted numeric versions ("0.1.10" after "0.1.9"). */
export function compareVersions(a, b) {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number));
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/**
 * Returns a new update manifest that includes `{ version, url, hash }`, replacing any entry with the same
 * version and keeping the rest in ascending order so older installs can still step forward.
 */
export function addUpdate(manifest, { version, url, hash }) {
  if (!VERSION.test(version)) throw new Error(`Not a numeric version: ${version}`);
  if (!url.startsWith('https://')) throw new Error(`Update links must be https: ${url}`);
  if (!/^sha256:[0-9a-f]{64}$/.test(hash)) throw new Error(`Expected sha256:<64 hex digits>, got ${hash}`);
  const existing = manifest?.addons?.[ADDON_ID]?.updates ?? [];
  const updates = [
    ...existing.filter((u) => u.version !== version),
    {
      version,
      update_link: url,
      update_hash: hash,
      applications: { gecko: { strict_min_version: MIN_FIREFOX } },
    },
  ].sort((a, b) => compareVersions(a.version, b.version));
  return { addons: { [ADDON_ID]: { updates } } };
}

export const sha256Of = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [version, xpi, url, file = 'site/public/updates.json'] = process.argv.slice(2);
  if (!version || !xpi || !url) {
    console.error('usage: node scripts/update-manifest.mjs <version> <signed.xpi> <https url> [updates.json]');
    process.exit(2);
  }
  const current = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const next = addUpdate(current, { version, url, hash: sha256Of(readFileSync(xpi)) });
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`${file}: ${next.addons[ADDON_ID].updates.length} version(s), latest ${version}`);
}
