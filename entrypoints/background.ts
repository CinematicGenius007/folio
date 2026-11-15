import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { ensureInbox, openDashboard } from '@/lib/actions';
import { db } from '@/lib/core/db';
import { syncReadModel } from '@/lib/core/projector';
import { createSyncScheduler } from '@/lib/core/scheduler';
import { ensureIcons, hasBrowserFavicons } from '@/lib/favicon';

/**
 * Background script: the projector, and the only writer of the bookmark read model.
 *
 * Bookmark events only say "something changed". Each burst of events triggers one re-read of the
 * browser's tree and a write of the differences, so handlers are idempotent and an event missed
 * while the worker slept is repaired by the next run (and by the run at every wake-up).
 */
export default defineBackground(() => {
  const sync = createSyncScheduler(async () => {
    try {
      await syncReadModel(db, await browser.bookmarks.getTree());
      // Firefox and Zen have no icon cache to read, so fetch icons in the background.
      if (!hasBrowserFavicons()) void ensureIcons((await db.bookmarks.toArray()).map((b) => b.url));
    } catch (error) {
      console.error('[folio] sync failed', error);
    }
  });

  const { bookmarks } = browser;
  for (const event of [
    bookmarks.onCreated,
    bookmarks.onRemoved,
    bookmarks.onChanged,
    bookmarks.onMoved,
    bookmarks.onChildrenReordered,
  ]) {
    event?.addListener(sync.schedule);
  }
  bookmarks.onImportBegan?.addListener(() => sync.setImporting(true));
  bookmarks.onImportEnded?.addListener(() => sync.setImporting(false));

  browser.runtime.onInstalled.addListener(() => void ensureInbox().then(sync.runNow));
  browser.runtime.onStartup.addListener(() => void sync.runNow());

  browser.commands.onCommand.addListener(async (command, tab) => {
    if (command === 'open-dashboard') await openDashboard();
    if (command === 'toggle-sidebar') await toggleSidebar(tab?.windowId);
  });

  // Test builds only: open the extension pages as tabs so automation can reach them.
  if (import.meta.env.VITE_FOLIO_OPEN_PAGES === '1') {
    for (const page of ['/dashboard.html', '/popup.html', '/sidepanel.html'] as const) {
      void browser.tabs.create({ url: browser.runtime.getURL(page) });
    }
  }

  // Wake-up reconcile: repairs anything that changed while the worker was asleep.
  void sync.runNow();
});

/** Firefox and Zen toggle their sidebar; Chromium opens the side panel for the window. Both need a user gesture. */
async function toggleSidebar(windowId: number | undefined): Promise<void> {
  const g = globalThis as unknown as {
    chrome?: { sidePanel?: { open(options: { windowId: number }): Promise<void> } };
    browser?: { sidebarAction?: { toggle(): Promise<void> } };
  };
  if (g.browser?.sidebarAction) return g.browser.sidebarAction.toggle();
  // `windowId` comes with the command event, so no await sits between the key press and this call.
  const target = windowId ?? (await browser.windows.getCurrent()).id;
  if (target !== undefined) await g.chrome?.sidePanel?.open({ windowId: target });
}
