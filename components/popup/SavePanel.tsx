import { useEffect, useMemo, useRef, useState } from 'react';
import { addBookmark, parseTags, restoreTombstones } from '@/lib/actions';
import type { Tombstone } from '@/lib/core/types';
import { rankTags } from '@/lib/core/tags';
import { prunePickCounts, resolveSaveActiveKey, suggestFolders } from '@/lib/core/suggest';
import { findNode, type PickerSuggestion } from '@/lib/core/tree';
import { hasBrowserFavicons, storeIconFromUrl } from '@/lib/favicon';
import type { Library } from '@/lib/react';
import { hostOf, originOf } from '@/lib/util/url';
import { FolderList, usePicker } from '@/components/folders/FolderList';
import { Button, Kbd, TagInput } from '@/components/ui';
import { openFolio } from './openFolio';
import type { PageTab } from './types';

/**
 * Save a new page: pick a folder (1–9, ↑↓, or `/` to search every folder) and optionally type a
 * note with #tags (completed inline from existing tags; `Tab` accepts). A text starting with `/` is a
 * folder search instead of a note, and completion is off while it is.
 * Ranked suggestions (host affinity, name overlap, prior picks) sit above the tree when any
 * folder clears the score floor; the top one is pre-selected only when it clears the confidence bar.
 */
export function SavePanel({
  tab,
  lib,
  lastFolderId,
  pickCounts,
  removed,
  onRemoved,
}: {
  tab: PageTab;
  lib: Library;
  lastFolderId: string | null;
  /** Loaded before mount so the first paint can pre-select a confident suggestion. */
  pickCounts: Record<string, number>;
  /** The bookmark just removed from this page, if any, so it can be restored. */
  removed: Tombstone | null;
  onRemoved: (stone: Tombstone | null) => void;
}) {
  const inbox = useMemo(
    () =>
      lib.inboxId
        ? { id: lib.inboxId, title: 'Inbox', count: lib.bookmarks.filter((b) => b.parentId === lib.inboxId).length }
        : null,
    [lib.inboxId, lib.bookmarks],
  );

  const ranked = useMemo(() => {
    const alive = prunePickCounts(
      pickCounts,
      lib.folders.map((f) => f.id),
    );
    return suggestFolders({
      page: { title: tab.title, url: tab.url },
      folders: lib.folders,
      bookmarks: lib.bookmarks,
      meta: lib.meta,
      pickCounts: alive,
      lastFolderId,
      excludeIds: lib.inboxId ? [lib.inboxId] : [],
    });
  }, [tab.title, tab.url, lib.folders, lib.bookmarks, lib.meta, lib.inboxId, pickCounts, lastFolderId]);

  const suggestions: PickerSuggestion[] = useMemo(
    () =>
      ranked.flatMap((s) => {
        const node = findNode(lib.tree, s.id);
        const folder = lib.folderById.get(s.id);
        if (!folder) return [];
        return [
          {
            id: s.id,
            title: folder.title || 'Untitled',
            count: node?.count ?? 0,
            color: node?.color ?? 'slate',
            reason: s.reasons[0],
          },
        ];
      }),
    [ranked, lib.tree, lib.folderById],
  );

  const { activeKey: initialActiveKey, expandFor } = resolveSaveActiveKey({
    top: ranked[0],
    lastFolderId,
    inboxId: lib.inboxId,
    folderById: lib.folderById,
  });

  const picker = usePicker({
    tree: lib.tree,
    folders: lib.folders,
    inbox,
    suggestions,
    initialExpanded: (expandFor ? (lib.folderById.get(expandFor)?.pathIds ?? []) : []).slice(0, -1),
    initialActiveKey,
  });
  const rankedTags = useMemo(
    () => rankTags(lib.meta.values(), lib.bookmarks, hostOf(tab.url)),
    [lib.meta, lib.bookmarks, tab.url],
  );
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const searching = text.startsWith('/');
  const { setQuery } = picker;
  useEffect(() => setQuery(searching ? text.slice(1) : ''), [text, searching, setQuery]);
  useEffect(() => inputRef.current?.focus(), []);

  const undo = async () => {
    if (removed) await restoreTombstones([removed]);
    onRemoved(null);
  };

  const save = async (folderId: string) => {
    if (busy || !folderId) return;
    setBusy(true);
    const { text: note, tags } = parseTags(searching ? '' : text);
    await addBookmark({ title: tab.title, url: tab.url, parentId: folderId, note, tags });
    const origin = originOf(tab.url);
    // Firefox and Zen have no icon cache to read, so keep the one the tab already loaded.
    if (!hasBrowserFavicons() && origin && tab.favIconUrl) void storeIconFromUrl(origin, tab.favIconUrl, 'tab');
    setBusy(false);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const inInput = (e.target as HTMLElement).tagName === 'INPUT';
      if (e.key === 'Escape') {
        if (searching) setText('');
        else window.close();
      } else if (e.key === 'z' && removed && !text) {
        e.preventDefault();
        void undo();
      } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && inInput && text) {
        return; // keep caret movement inside the note
      } else if (picker.onKey(e, (id) => void save(id))) {
        return;
      } else if (!inInput && /^[1-9]$/.test(e.key) && !searching) {
        void save(picker.rows[Number(e.key) - 1]?.id ?? '');
      } else if (!inInput && e.key === '/') {
        e.preventDefault();
        setText('/');
        inputRef.current?.focus();
      } else if (!inInput && (e.key === 'j' || e.key === 'k')) {
        picker.move(e.key === 'j' ? 1 : -1);
      } else if (!inInput && e.key === '0') {
        void openFolio();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <>
      <div className="px-2 pb-2">
        <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted">
          {searching ? 'Find a folder' : 'Save to'}
        </div>
        <FolderList picker={picker} onPick={(id) => void save(id)} className="max-h-[192px]" itemClass="h-8" />
      </div>
      <div className="px-4 pb-3">
        <TagInput
          ref={inputRef}
          value={text}
          onValueChange={setText}
          tags={rankedTags}
          complete={!searching}
          placeholder="Note, #tag, or / to find a folder"
          aria-label="Note, tags, or folder search"
        />
      </div>
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-1">
        <span className="flex items-center gap-2 whitespace-nowrap text-[12px] text-muted">
          {removed ? (
            <span>
              Removed.{' '}
              <button
                onClick={() => void undo()}
                className="cursor-pointer border-0 bg-transparent p-0 text-ink underline"
              >
                Undo
              </button>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Kbd>↑↓</Kbd> choose
            </span>
          )}
          {/* The placeholder says this too, but it disappears once you type; this hint stays. */}
          <button
            onClick={() => (setText('/'), inputRef.current?.focus())}
            className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[12px] text-muted hover:text-ink"
          >
            <Kbd>/</Kbd> folders
          </button>
          <button
            onClick={() => void openFolio()}
            className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[12px] text-muted hover:text-ink"
          >
            Open Folio <Kbd>0</Kbd>
          </button>
        </span>
        <Button
          variant="primary"
          className="shrink-0"
          disabled={busy || !picker.rows.length}
          onClick={() => void save(picker.rows[picker.active]?.id ?? '')}
        >
          Save <Kbd>↵</Kbd>
        </Button>
      </div>
    </>
  );
}
