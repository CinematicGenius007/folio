import { moveBookmarks, removeBookmarks, removeFolder, restoreTombstones } from '@/lib/actions';
import { db } from '@/lib/core/db';
import type { Bm, Tombstone } from '@/lib/core/types';
import { ensureIcons } from '@/lib/favicon';
import { originOf } from '@/lib/util/url';

/** The projector writes tombstones a moment after the browser reports a delete, so wait before reading them. */
const TOMBSTONE_DELAY_MS = 400;

/**
 * Operations the dashboard runs on bookmarks, each reporting the outcome through `say`.
 * Reads of the bookmark tree never happen here; see `lib/actions` for how writes flow.
 */
export function useBookmarkActions(say: (message: string, undo?: Tombstone[]) => void, afterChange: () => void) {
  /** Shows "Deleted…" with an Undo button once the tombstones for `ids` exist. */
  const announceDeletion = (message: string, ids: string[]) =>
    setTimeout(async () => {
      const stones = (await db.tombstones.bulkGet(ids)).filter((s): s is Tombstone => !!s);
      say(`${message} Undo for 30 days.`, stones);
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
      await moveBookmarks(
        rows.map((r) => r.id),
        folderId,
      );
      afterChange();
      say(`Moved ${rows.length} to ${folderTitle}`);
    },

    async undo(stones: Tombstone[]) {
      await restoreTombstones(stones);
      say(`Restored ${stones.length}`);
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
