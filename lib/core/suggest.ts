import type { Bm, Folder, Meta } from './types';
import { hostOf } from '@/lib/util/url';

/** A ranked folder destination for the page being saved. */
export interface FolderSuggestion {
  id: string;
  score: number;
  /** Short human reasons shown under the folder name (e.g. "3 from github.com"). */
  reasons: string[];
}

/** Minimum score before a folder is offered as a suggestion. */
export const SUGGEST_FLOOR = 2;

/** Score at or above this pre-selects the top suggestion instead of the last-used folder. */
export const SUGGEST_CONFIDENCE = 4;

const DEFAULT_LIMIT = 3;

/**
 * Row key to highlight when opening the save picker.
 * Only a confident suggestion is pre-selected; otherwise the last-used folder if it still exists,
 * else the Inbox — never a below-confidence suggestion via a stale last-folder fallback.
 */
export function resolveSaveActiveKey(opts: {
  top?: Pick<FolderSuggestion, 'id' | 'score'> | null;
  lastFolderId: string | null;
  inboxId: string | null;
  folderById: { has(id: string): boolean };
}): { activeKey?: string; expandFor: string | null } {
  const { top, lastFolderId, inboxId, folderById } = opts;
  if (top && top.score >= SUGGEST_CONFIDENCE) {
    return { activeKey: `suggest:${top.id}`, expandFor: top.id };
  }
  const last = lastFolderId && folderById.has(lastFolderId) ? lastFolderId : null;
  const id = last ?? (inboxId && folderById.has(inboxId) ? inboxId : null);
  return { activeKey: id ? `folder:${id}` : undefined, expandFor: last };
}

/** Split titles and hosts into lowercase tokens for overlap scoring (kept local, no MiniSearch dependency). */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s/._:?&=#-]+/)
    .filter((t) => t.length > 1);
}

function overlap(a: Set<string>, b: Iterable<string>): number {
  let n = 0;
  for (const t of b) if (a.has(t)) n++;
  return n;
}

/**
 * Ranks folders for saving `page` from the local library only: host co-occurrence, name overlap,
 * similar bookmark neighbours, and how often the user has picked each folder before.
 * Never looks at page bodies or the network. Pure: safe to unit-test without a browser.
 */
export function suggestFolders(opts: {
  page: { title: string; url: string };
  folders: Folder[];
  bookmarks: Bm[];
  meta?: Map<string, Meta>;
  pickCounts?: Record<string, number>;
  lastFolderId?: string | null;
  /** Folder ids never suggested (Inbox). */
  excludeIds?: Iterable<string>;
  limit?: number;
}): FolderSuggestion[] {
  const {
    page,
    folders,
    bookmarks,
    meta,
    pickCounts = {},
    lastFolderId = null,
    excludeIds,
    limit = DEFAULT_LIMIT,
  } = opts;
  const excluded = new Set(excludeIds);
  const host = hostOf(page.url);
  if (!host && !page.title.trim()) return [];

  const folderById = new Map(folders.map((f) => [f.id, f]));
  const pageTokens = new Set([...tokenize(page.title), ...tokenize(host)]);
  const scores = new Map<string, { score: number; reasons: Map<string, string> }>();

  const bump = (id: string, amount: number, reasonKey: string, reason: string) => {
    if (!id || excluded.has(id) || !folderById.has(id)) return;
    const f = folderById.get(id)!;
    // Roots (depth 1) are browser buckets; collections and nested folders are real destinations.
    if (f.depth < 2) return;
    const row = scores.get(id) ?? { score: 0, reasons: new Map() };
    row.score += amount;
    if (reason && !row.reasons.has(reasonKey)) row.reasons.set(reasonKey, reason);
    scores.set(id, row);
  };

  // Host affinity: bookmarks already filed under this host vote for their parent folder.
  const hostHits = new Map<string, number>();
  for (const b of bookmarks) {
    if (hostOf(b.url) !== host) continue;
    hostHits.set(b.parentId, (hostHits.get(b.parentId) ?? 0) + 1);
  }
  for (const [folderId, count] of hostHits) {
    bump(folderId, 3 + Math.min(count - 1, 4) * 0.75, 'host', `${count} from ${host}`);
  }

  // Folder name / path tokens that appear in the page title or host.
  for (const f of folders) {
    if (f.depth < 2 || excluded.has(f.id)) continue;
    const titleHits = overlap(pageTokens, tokenize(f.title));
    const pathHits = overlap(
      pageTokens,
      f.path.flatMap((p) => tokenize(p)),
    );
    if (titleHits) bump(f.id, titleHits * 2.5, 'name', `matches ${f.title}`);
    else if (pathHits) bump(f.id, pathHits * 1.5, 'name', `matches ${f.path.join(' / ')}`);
  }

  // Neighbours: other bookmarks whose titles/URLs share tokens with the page cast a weaker vote.
  for (const b of bookmarks) {
    if (hostOf(b.url) === host) continue; // already counted as host affinity
    const tagTokens = (meta?.get(b.id)?.tags ?? []).map((t) => t.toLowerCase());
    const tokens = new Set([...tokenize(b.title), ...tokenize(hostOf(b.url)), ...tagTokens]);
    const hits = overlap(pageTokens, tokens);
    if (hits < 2) continue;
    const tagBonus = tagTokens.some((t) => pageTokens.has(t)) ? 0.75 : 0;
    bump(b.parentId, 1.5 + (hits - 2) * 0.5 + tagBonus, 'similar', 'similar bookmarks');
  }

  // Prior picks: frequent destinations rise even when content signals are thin.
  for (const [id, count] of Object.entries(pickCounts)) {
    if (count > 0) bump(id, Math.min(count, 8) * 0.35, 'frequent', 'often used');
  }
  if (lastFolderId) bump(lastFolderId, 1.25, 'last', 'last used');

  return [...scores.entries()]
    .map(([id, { score, reasons }]) => ({ id, score, reasons: [...reasons.values()] }))
    .filter((s) => s.score >= SUGGEST_FLOOR)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit);
}

/**
 * Drops pick counts for folders that no longer exist, so settings stay small after deletes.
 * Returns the same object when nothing changed.
 */
export function prunePickCounts(counts: Record<string, number>, folderIds: Iterable<string>): Record<string, number> {
  const alive = new Set(folderIds);
  let changed = false;
  const next: Record<string, number> = {};
  for (const [id, n] of Object.entries(counts)) {
    if (!alive.has(id) || n <= 0) {
      changed = true;
      continue;
    }
    next[id] = n;
  }
  return changed || Object.keys(next).length !== Object.keys(counts).length ? next : counts;
}

/** Returns a new map with `folderId`'s count increased by one. */
export function bumpPickCount(counts: Record<string, number>, folderId: string): Record<string, number> {
  return { ...counts, [folderId]: (counts[folderId] ?? 0) + 1 };
}
