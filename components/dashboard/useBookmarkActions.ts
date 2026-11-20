import {
  type MoveRecord,
  fileBookmark,
  moveBookmarks,
  removeBookmarks,
  removeFolder,
  restoreMoves,
  restoreTombstones,
} from '@/lib/actions';
import { db } from '@/lib/core/db';
import type { Bm, Tombstone } from '@/lib/core/types';
import { ensureIcons } from '@/lib/favicon';
import { originOf } from '@/lib/util/url';
import type { Undo } from './useToast';

/** The projector writes tombstones a moment after the browser reports a delete, so wait before reading them. */
const TOMBSTONE_DELAY_MS = 400;

/**
 * Operations the dashboard runs on bookmarks, each reporting the outcome through `say`.
 * Deletes and moves hand the toast an undo. Reads of the bookmark tree never happen here; see
 * `lib/actions` for how writes flow.
 */
export function useBookmarkActions(say: (message: string, undo?: Undo) => void, afterChange: () => void) {
  const count = (n: number) => (n === 1 ? '1 bookmark' : `${n} bookmarks`);

  /** Undo for a delete: recreate the bookmarks from their tombstones. */
  const restore =
    (stones: Tombstone[]): Undo =>
    async () => {
      await restoreTombstones(stones);
      say(`Restored ${count(stones.length)}`);
    };

  /** Undo for a move: put each bookmark back where it was. */
  const moveBack =
    (records: MoveRecord[]): Undo =>
    async () => {
      await restoreMoves(records);
      say(`Moved back ${count(records.length)}`);
    };

  /** Shows "Deleted…" with an Undo button once the tombstones for `ids` exist. */
  const announceDeletion = (message: string, ids: string[]) =>
    setTimeout(async () => {
      const stones = (await db.tombstones.bulkGet(ids)).filter((s): s is Tombstone => !!s);
      say(`${message} Undo for 30 days.`, stones.length ? restore(stones) : undefined);
    }, TOMBSTONE_DELAY_MS);

  return {
    async deleteBookmarks(rows: Bm[]) {
      await removeBookmarks(rows.map((r) => r.id));
      afterChange();
      announceDeletion(
        `Deleted ${rows.length === 1 ? `“${rows[0]!.title}”` : `${rows.length} bookmarks`}.`,
        rows.map((r) => r.id),
      );
    },

    async deleteFolder(id: string, title: string, bookmarkIds: string[]) {
      await removeFolder(id);
      announceDeletion(`Deleted “${title}” and ${bookmarkIds.length} bookmarks.`, bookmarkIds);
    },

    async moveTo(rows: Bm[], folderId: string, folderTitle: string) {
      const records = await moveBookmarks(
        rows.map((r) => r.id),
        folderId,
      );
      afterChange();
      say(`Moved ${rows.length} to ${folderTitle}`, records.length ? moveBack(records) : undefined);
    },

    /** Inbox triage: files one bookmark into a suggested folder. */
    async fileTo(row: Bm, folderId: string, folderTitle: string) {
      const records = await fileBookmark(row.id, folderId);
      say(`Filed to ${folderTitle}`, records.length ? moveBack(records) : undefined);
    },

    async copyLink(bookmark: Bm) {
      try {
        await navigator.clipboard.writeText(bookmark.url);
        say('Link copied');
      } catch {
        say('Could not copy the link');
      }
    },

    async refreshIcon(bookmark: Bm) {
      const origin = originOf(bookmark.url);
      if (!origin) return say('This link has no icon to refresh');
      await db.favicons.delete(origin);
      await ensureIcons([bookmark.url]);
      say('Icon refreshed');
    },
  };
}
