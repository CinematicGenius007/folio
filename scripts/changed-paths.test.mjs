import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/** Runs the CI path classifier on a list of changed files. */
function classify(files) {
  const run = spawnSync('bash', ['.github/scripts/changed-paths.sh'], { input: files.join('\n'), encoding: 'utf8' });
  expect(run.status).toBe(0);
  return Object.fromEntries(
    run.stdout
      .trim()
      .split('\n')
      .map((line) => line.split('=')),
  );
}

describe('changed-paths.sh', () => {
  it('needs nothing extra for documentation-only changes', () => {
    expect(classify(['README.md', 'docs/RELEASING.md', 'CHANGELOG.md', 'AGENTS.md', 'docs/screenshots/a.jpg'])).toEqual(
      {
        extension: 'false',
        site: 'false',
      },
    );
  });

  it('builds only the website for changes under site/', () => {
    expect(classify(['site/content/docs/privacy.md', 'site/src/styles.css'])).toEqual({
      extension: 'false',
      site: 'true',
    });
  });

  it('builds only the extension for extension code', () => {
    for (const file of [
      'components/popup/Popup.tsx',
      'lib/core/db.ts',
      'entrypoints/background.ts',
      'e2e/chromium.e2e.mjs',
      'scripts/verify-build.mjs',
      'wxt.config.ts',
      'pnpm-lock.yaml',
    ]) {
      expect(classify([file]), file).toEqual({ extension: 'true', site: 'false' });
    }
  });

  it('turns both on when the version changes, because the site publishes it', () => {
    expect(classify(['package.json'])).toEqual({ extension: 'true', site: 'true' });
  });

  it('turns both on for any workflow or CI script change', () => {
    expect(classify(['.github/workflows/ci.yml'])).toEqual({ extension: 'true', site: 'true' });
    expect(classify(['.github/scripts/changed-paths.sh'])).toEqual({ extension: 'true', site: 'true' });
  });

  it('combines changes from several areas', () => {
    expect(classify(['README.md', 'site/src/home.html', 'lib/favicon/measure.ts'])).toEqual({
      extension: 'true',
      site: 'true',
    });
  });

  it('copes with an empty list', () => {
    expect(classify([])).toEqual({ extension: 'false', site: 'false' });
  });
});
