import type { Meta } from './types';
import { hostOf } from '@/lib/util/url';

/**
 * Tags: parsing free text into a note and tags, and the ranking behind inline tag completion.
 * Pure, so the popup, the dashboard and tests share one definition of what a tag is.
 */

/** A tag is `#` at the start of the text or after whitespace, then letters, digits, `_` or `-`. */
const TAG = /(^|\s)#([\p{L}\p{N}_-]+)/gu;
const TAG_CHAR = /[\p{L}\p{N}_-]/u;

/**
 * Splits free text such as `read later #rust #Docs` into the plain note and a
 * de-duplicated, lower-cased tag list.
 */
export function parseTags(input: string): { text: string; tags: string[] } {
  const tags: string[] = [];
  const text = input
    .replace(TAG, (_match, _lead, tag: string) => {
      tags.push(tag.toLowerCase());
      return ' ';
    })
    .replace(/\s+/g, ' ')
    .trim();
  return { text, tags: [...new Set(tags)] };
}

/** The inverse of {@link parseTags}: `note #a #b`, for prefilling an editor. */
export function formatNote(note: string, tags: readonly string[]): string {
  return [note.trim(), ...tags.map((t) => `#${t}`)].filter(Boolean).join(' ');
}

/**
 * Every tag in use, best first: most-used across the library, then most-used on bookmarks of
 * `host` (so `#rust` beats `#rustlang` on a page from a site you already file as `#rust`),
 * then alphabetical.
 */
export function rankTags(
  meta: Iterable<Meta>,
  bookmarks: readonly { id: string; url: string }[] = [],
  host = '',
): string[] {
  const sameHost = new Set(host ? bookmarks.filter((b) => hostOf(b.url) === host).map((b) => b.id) : []);
  const uses = new Map<string, { all: number; host: number }>();
  for (const m of meta) {
    for (const tag of m.tags) {
      const u = uses.get(tag) ?? { all: 0, host: 0 };
      u.all++;
      if (sameHost.has(m.id)) u.host++;
      uses.set(tag, u);
    }
  }
  return [...uses]
    .sort(([a, ua], [b, ub]) => ub.all - ua.all || ub.host - ua.host || (a < b ? -1 : a > b ? 1 : 0))
    .map(([tag]) => tag);
}

/** The `#prefix` token that ends at `caret`, or null when the caret is not right after one. */
export function tagTokenAt(text: string, caret: number): { start: number; prefix: string } | null {
  if (caret < text.length && TAG_CHAR.test(text[caret]!)) return null; // caret is inside a word
  let i = caret;
  while (i > 0 && TAG_CHAR.test(text[i - 1]!)) i--;
  if (i === caret || text[i - 1] !== '#') return null;
  const hash = i - 1;
  if (hash > 0 && !/\s/.test(text[hash - 1]!)) return null; // `C#` is not a tag
  return { start: i, prefix: text.slice(i, caret) };
}

/**
 * The rest of the best tag for the token at `caret` (what the ghost text shows), or null.
 * Tags already written elsewhere in `text` are skipped. When the best match is exactly what was
 * typed, there is nothing to complete: the typed tag already exists and outranks longer ones.
 */
export function completeTag(ranked: readonly string[], text: string, caret: number): string | null {
  const token = tagTokenAt(text, caret);
  if (!token) return null;
  const prefix = token.prefix.toLowerCase();
  const others = parseTags(text.slice(0, token.start - 1) + ' ' + text.slice(caret)).tags;
  const best = ranked.find((t) => t.startsWith(prefix) && !others.includes(t));
  if (!best || best === prefix) return null;
  return best.slice(prefix.length);
}
