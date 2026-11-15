import { useEffect, useMemo, useState } from 'react';
import type { Tombstone } from '@/lib/core/types';
import { browser } from 'wxt/browser';
import { getSetting } from '@/lib/core/db';
import { type Library, useLibrary, useTheme } from '@/lib/react';
import { hostOf, isSafeUrl, normalizeUrl } from '@/lib/util/url';
import { Favicon } from '@/components/favicon/Favicon';
import { SavedPanel } from './SavedPanel';
import { SavePanel } from './SavePanel';
import { UnsavablePanel } from './UnsavablePanel';
import type { PageTab } from './types';

/**
 * The toolbar popup. Its height follows the task: just the header while loading, a folder list and
 * note field when saving a new page, and a short summary when the page is already saved.
 */
export function Popup() {
  useTheme();
  const lib = useLibrary();
  const tab = useActiveTab();
  const lastFolderId = useLastFolder();
  /** Lives here, not in a panel: removing the page swaps SavedPanel for SavePanel, and the undo must survive that. */
  const [removed, setRemoved] = useState<Tombstone | null>(null);

  // Matched against the library already in memory, so the first render can never offer to save a saved page.
  const saved = useMemo(() => {
    if (!tab) return [];
    const key = normalizeUrl(tab.url);
    return lib.bookmarks.filter((b) => b.normUrl === key);
  }, [tab, lib.bookmarks]);
  const ready = !!tab && lib.ready && lastFolderId !== undefined;

  return (
    <div className="w-[380px] bg-ground text-ink">
      {!tab ? (
        <div className="p-4 text-[13px] text-muted">Loading…</div>
      ) : (
        <>
          <Header tab={tab} saved={ready && saved.length > 0} />
          {ready && (
            <PopupBody
              tab={tab}
              saved={saved}
              lastFolderId={lastFolderId ?? null}
              lib={lib}
              removed={removed}
              onRemoved={setRemoved}
            />
          )}
        </>
      )}
    </div>
  );
}

/** The page being saved: the active tab, or the most recent page tab when the popup is opened as a tab. */
function useActiveTab(): PageTab | null {
  const [tab, setTab] = useState<PageTab | null>(null);
  useEffect(() => {
    void browser.tabs.query({ currentWindow: true }).then((tabs) => {
      const pages = tabs.filter((t) => t.url && !/^(chrome|moz)-extension:/.test(t.url));
      const page =
        pages.find((t) => t.active) ?? pages.sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))[0];
      if (page?.url) setTab({ title: page.title ?? page.url, url: page.url, favIconUrl: page.favIconUrl });
    });
  }, []);
  return tab;
}

/** The folder used last time (`null` if none); `undefined` until the setting has loaded. */
function useLastFolder(): string | null | undefined {
  const [id, setId] = useState<string | null>();
  useEffect(() => {
    void getSetting<string | null>('lastCollectionId', null).then(setId);
  }, []);
  return id;
}

function Header({ tab, saved }: { tab: PageTab; saved: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Favicon url={tab.url} title={tab.title} size={28} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold">{tab.title}</div>
        <div className="truncate text-[13px] text-muted">
          {isSafeUrl(tab.url) ? hostOf(tab.url) : 'This page cannot be saved'}
        </div>
      </div>
      {saved && <span className="rounded-full bg-ok-bg px-2 py-0.5 text-[12px] font-medium text-ok-text">Saved</span>}
    </div>
  );
}

function PopupBody({
  tab,
  saved,
  lastFolderId,
  lib,
  removed,
  onRemoved,
}: {
  tab: PageTab;
  saved: Library['bookmarks'];
  lastFolderId: string | null;
  lib: Library;
  removed: Tombstone | null;
  onRemoved: (stone: Tombstone | null) => void;
}) {
  if (!isSafeUrl(tab.url)) return <UnsavablePanel />;
  return saved.length ? (
    <SavedPanel saved={saved} lib={lib} onRemoved={onRemoved} />
  ) : (
    <SavePanel tab={tab} lib={lib} lastFolderId={lastFolderId} removed={removed} onRemoved={onRemoved} />
  );
}
