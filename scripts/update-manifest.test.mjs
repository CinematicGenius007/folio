import { describe, expect, it } from 'vitest';
import { ADDON_ID, addUpdate, compareVersions, sha256Of } from './update-manifest.mjs';

const hash = sha256Of(Buffer.from('xpi'));
const url = (v) => `https://github.com/CinematicGenius007/folio/releases/download/v${v}/folio-${v}.xpi`;
const entry = (version) => ({ version, url: url(version), hash });
const versions = (m) => m.addons[ADDON_ID].updates.map((u) => u.version);

describe('compareVersions', () => {
  it('compares numerically, not as text', () => {
    expect(compareVersions('0.1.10', '0.1.9')).toBeGreaterThan(0);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('0.9.9', '1.0.0')).toBeLessThan(0);
  });
});

describe('addUpdate', () => {
  it('creates a manifest from nothing', () => {
    const m = addUpdate({}, entry('0.1.1'));
    expect(m.addons[ADDON_ID].updates).toEqual([
      {
        version: '0.1.1',
        update_link: url('0.1.1'),
        update_hash: hash,
        applications: { gecko: { strict_min_version: '140.0' } },
      },
    ]);
  });

  it('keeps versions in ascending order', () => {
    let m = addUpdate({}, entry('0.1.10'));
    m = addUpdate(m, entry('0.1.9'));
    m = addUpdate(m, entry('0.2.0'));
    expect(versions(m)).toEqual(['0.1.9', '0.1.10', '0.2.0']);
  });

  it('replaces an entry for the same version instead of duplicating it', () => {
    const m = addUpdate(addUpdate({}, entry('0.1.1')), { ...entry('0.1.1'), url: url('0.1.1').replace('v0', 'w0') });
    expect(versions(m)).toEqual(['0.1.1']);
    expect(m.addons[ADDON_ID].updates[0].update_link).toContain('w0.1.1');
  });

  it('does not mutate its input', () => {
    const before = addUpdate({}, entry('0.1.1'));
    const snapshot = JSON.stringify(before);
    addUpdate(before, entry('0.1.2'));
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('refuses insecure links, odd versions and malformed hashes', () => {
    expect(() => addUpdate({}, { ...entry('0.1.1'), url: 'http://example.com/a.xpi' })).toThrow(/https/);
    expect(() => addUpdate({}, entry('0.1.1-beta'))).toThrow(/numeric/);
    expect(() => addUpdate({}, { ...entry('0.1.1'), hash: 'sha256:abc' })).toThrow(/sha256/);
  });
});
