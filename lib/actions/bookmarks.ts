import { browser } from 'wxt/browser';
import { db, getSetting, setSetting } from '@/lib/core/db';
import { bumpPickCount, prunePickCounts } from '@/lib/core/suggest';
import type { Tombstone } from '@/lib/core/types';
import { isSafeUrl } from '@/lib/util/url';
import { setMeta } from './metadata';

/*
 * Command side of Folio's one-way data flow.
 *
 * Every function here writes to the browser's native bookmark tree (the source of truth).
 * The background projector observes the resulting events and updates the read model the UI
 * renders from, so callers never touch `db.bookmarks` or `db.folders` directly.
 */

/** Folio only saves and edits links it would also open. Bookmarks that already exist with other schemes are left alone. */
export const UNSAFE_URL_MESSAGE = 'Only http, https and ftp links can be saved';

/** Title of the folder Folio saves into when you do not pick one. */
const INBOX_TITLE = 'Inbox';

/** Matches the browser root that holds "Other bookmarks" (Chromium id `2`, Firefox `unfiled_____`). */
const OTHER_ROOT = /other|unfiled/i;

/**
 * Returns the id of the Inbox folder, creating it under "Other bookmarks" on first use.
 * The id is remembered in settings and re-validated, so renaming or deleting the folder is safe.
 */
export async function ensureInbox(): Promise<string> {
  const remembered = await getSetting<string | null>('inboxId', null);
  if (remembered) {
    const [node] = await browser.bookmarks.get(remembered).catch(() => []);
    if (node && !node.url) return remembered;
  }
  const roots = (await browser.bookmarks.getTree())[0]?.children ?? [];
  const other = roots.find((r) => OTHER_ROOT.test(r.title) || r.id === '2' || r.id === 'unfiled_____') ?? roots[0];
  if (!other) throw new Error('No bookmark root found');
  const existing = other.children?.find((c) => !c.url && c.title === INBOX_TITLE);
  const id = existing?.id ?? (await browser.bookmarks.create({ parentId: other.id, title: INBOX_TITLE })).id;
  await setSetting('inboxId', id);
  return id;
}

/** Saves a bookmark into `parentId` and attaches optional tags and a note. Returns the native bookmark id. Rejects unsafe URLs. */
export async function addBookmark(input: {
  title: string;
  url: string;
  parentId: string;
  note?: string;
  tags?: string[];
}): Promise<string> {
  if (!isSafeUrl(input.url)) throw new Error(UNSAFE_URL_MESSAGE);
  const node = await browser.bookmarks.create({ parentId: input.parentId, title: input.title, url: input.url });
  if (input.note || input.tags?.length) await setMeta(node.id, { note: input.note ?? '', tags: input.tags ?? [] });
  await setSetting('lastCollectionId', input.parentId);
  // Local learning signal for folder suggestions: how often this destination is chosen.
  // The read model may lag the native create, so always keep the folder we just saved into.
  const picks = await getSetting<Record<string, number>>('folderPickCounts', {});
  const folderIds = (await db.folders.toCollection().primaryKeys()).map(String);
  const pruned = folderIds.length > 0 ? prunePickCounts(picks, new Set([...folderIds, input.parentId])) : picks;
  await setSetting('folderPickCounts', bumpPickCount(pruned, input.parentId));
  return node.id;
}

/** Changes a bookmark's title and/or URL. A new URL must be an http, https or ftp link. */
export async function updateBookmark(id: string, patch: { title?: string; url?: string }): Promise<void> {
  if (patch.url !== undefined && !isSafeUrl(patch.url)) throw new Error(UNSAFE_URL_MESSAGE);
  await browser.bookmarks.update(id, patch);
}

/** Moves bookmarks (or folders) to the end of `parentId`. */
export async function moveBookmarks(ids: string[], parentId: string): Promise<void> {
  for (const id of ids) await browser.bookmarks.move(id, { parentId });
}

/**
 * Deletes bookmarks from the browser. Folio keeps a tombstone for 30 days
 * (written by the projector) so {@link restoreTombstones} can undo it.
 */
export async function removeBookmarks(ids: string[]): Promise<void> {
  for (const id of ids) await browser.bookmarks.remove(id);
}

/**
 * Creates a folder. With no `parentId` it becomes a top-level collection next to the Inbox,
 * which is "Other bookmarks" in practice.
 */
export async function createFolder(title: string, parentId?: string): Promise<string> {
  let parent = parentId;
  if (!parent) {
    const inbox = await ensureInbox();
    const [node] = await browser.bookmarks.get(inbox);
    parent = node?.parentId ?? inbox;
  }
  return (await browser.bookmarks.create({ parentId: parent, title })).id;
}

/** Renames a folder. */
export async function renameFolder(id: string, title: string): Promise<void> {
  await browser.bookmarks.update(id, { title });
}

/**
 * Deletes a folder together with everything inside it. The bookmarks within are tombstoned
 * by the projector, so they can still be restored (into the Inbox, because the folder is gone).
 */
export async function removeFolder(id: string): Promise<void> {
  await browser.bookmarks.removeTree(id);
}

/** Undoes a delete. Bookmarks return to their old folder, or to the Inbox if that folder no longer exists. */
export async function restoreTombstones(stones: Tombstone[]): Promise<void> {
  for (const stone of stones) {
    let parentId = stone.bm.parentId;
    const alive = await browser.bookmarks.get(parentId).catch(() => []);
    if (!alive.length) parentId = await ensureInbox();
    const node = await browser.bookmarks.create({
      parentId,
      title: stone.bm.title,
      url: stone.bm.url,
      index: stone.bm.index,
    });
    if (stone.meta) await db.meta.put({ ...stone.meta, id: node.id });
    await db.tombstones.delete(stone.id);
  }
}

/**
 * Opens a bookmark in a new tab. Only http, https and ftp links are opened; `javascript:`,
 * `data:` and other schemes are refused. Returns whether a tab was opened.
 */
export async function openBookmark(url: string, opts: { background?: boolean } = {}): Promise<boolean> {
  if (!isSafeUrl(url)) return false;
  await browser.tabs.create({ url, active: !opts.background });
  return true;
}

/** Opens the full-page dashboard in a new tab. */
export async function openDashboard(): Promise<void> {
  await browser.tabs.create({ url: browser.runtime.getURL('/dashboard.html') });
}
