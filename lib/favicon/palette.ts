/** Colour names shared by the letter tiles and the collection dots; each maps to `--tile-*` / `--coll-*` theme variables. */
export const COLOR_NAMES = ['red', 'yellow', 'green', 'teal', 'blue', 'violet', 'pink', 'slate'] as const;
export type ColorName = (typeof COLOR_NAMES)[number];

/** 32-bit FNV-1a hash. Stable across sessions, which is what makes a site's tile colour stay put. */
export function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Picks a stable colour for any key (a site origin, a folder name). */
export function colorFor(key: string): ColorName {
  return COLOR_NAMES[hashString(key) % COLOR_NAMES.length]!;
}

/** The letter shown on a fallback tile: the first letter or digit of the title, else of the host. */
export function letterFor(title: string, url: string): string {
  const host = url.replace(/^https?:\/\/(www\.)?/, '');
  const source = title.trim() || host;
  const char = [...source].find((c) => /[\p{L}\p{N}]/u.test(c));
  return (char ?? '#').toUpperCase();
}
