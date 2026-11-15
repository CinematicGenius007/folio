import { useEffect, useState } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'folio-theme';

/** Resolves `system` against the OS setting and writes the result to `<html data-theme>`. */
export function applyTheme(pref: ThemePref): void {
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

/**
 * Theme preference for a page. The choice is mirrored to `localStorage` (a per-viewer
 * convenience) and, while set to `system`, follows OS changes live.
 */
export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(() => (localStorage.getItem(STORAGE_KEY) as ThemePref) || 'system');
  useEffect(() => {
    applyTheme(pref);
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      /* storage can be unavailable in private windows */
    }
    if (pref !== 'system') return;
    const query = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [pref]);
  return [pref, setPref] as const;
}
