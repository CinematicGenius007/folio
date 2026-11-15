import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const script = resolve('site/scripts/vercel-ignore.sh');
let repo;
let base;

const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
const write = (file, text) => {
  mkdirSync(join(repo, file, '..'), { recursive: true });
  writeFileSync(join(repo, file), text);
};
const commit = (message) => {
  git('add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', message);
};
/** Runs the script from site/, as Vercel does, and returns its exit code. */
const ignore = (env = {}) =>
  spawnSync('bash', [script], { cwd: join(repo, 'site'), env: { ...process.env, VERCEL_GIT_PREVIOUS_SHA: '', ...env } })
    .status;

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), 'folio-ignore-'));
  git('init', '-q');
  write('package.json', '{"version":"0.1.0"}');
  write('site/src/home.html', 'one');
  write('lib/a.ts', 'one');
  write('README.md', 'one');
  commit('base');
  base = git('rev-parse', 'HEAD');
});

afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe('vercel-ignore.sh (exit 0 skips the build, 1 builds)', () => {
  it('builds when there is no earlier build to compare with', () => {
    expect(ignore()).toBe(1);
  });

  it('builds when the earlier commit is not in this clone', () => {
    expect(ignore({ VERCEL_GIT_PREVIOUS_SHA: '0123456789abcdef0123456789abcdef01234567' })).toBe(1);
  });

  it('skips when only extension code and docs changed', () => {
    write('lib/a.ts', 'two');
    write('README.md', 'two');
    commit('extension and docs');
    expect(ignore({ VERCEL_GIT_PREVIOUS_SHA: base })).toBe(0);
  });

  it('builds when a site file changed', () => {
    write('site/src/home.html', 'two');
    commit('site');
    expect(ignore({ VERCEL_GIT_PREVIOUS_SHA: base })).toBe(1);
  });

  it('builds when only the root package.json (the version) changed', () => {
    const afterSite = git('rev-parse', 'HEAD');
    write('package.json', '{"version":"0.1.1"}');
    commit('version');
    expect(ignore({ VERCEL_GIT_PREVIOUS_SHA: afterSite })).toBe(1);
  });

  it('skips again once the last build already includes every change', () => {
    expect(ignore({ VERCEL_GIT_PREVIOUS_SHA: git('rev-parse', 'HEAD') })).toBe(0);
  });
});
