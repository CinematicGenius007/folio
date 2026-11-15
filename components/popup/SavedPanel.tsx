import { useEffect, useMemo, useState } from 'react';
import { moveBookmarks, removeBookmarks } from '@/lib/actions';
import { db } from '@/lib/core/db';
import type { Tombstone } from '@/lib/core/types';
import type { Library } from '@/lib/react';
import { FolderList, usePicker } from '@/components/folders/FolderList';
import { Button, Kbd } from '@/components/ui';
import { openFolio } from './openFolio';

/** The projector writes the tombstone shortly after the browser reports the delete. */
const TOMBSTONE_DELAY_MS = 300;

/** Summary for a page that is already saved: where it is, with move, remove (undoable) and open-in-Folio. */
export function SavedPanel({
  saved,
  lib,
  onRemoved,
}: {
  saved: Library['bookmarks'];
  lib: Library;
  onRemoved: (stone: Tombstone | null) => void;
}) {
  const bookmark = saved[0]!;
  const meta = lib.meta.get(bookmark.id);
  const [moving, setMoving] = useState(false);

  const folderLabel =
    bookmark.parentId === lib.inboxId
      ? 'Inbox'
      : lib.folderById.get(bookmark.parentId)?.path.join(' / ') || 'Unknown folder';

  const remove = async () => {
    await removeBookmarks([bookmark.id]);
    setTimeout(async () => onRemoved((await db.tombstones.get(bookmark.id)) ?? null), TOMBSTONE_DELAY_MS);
  };
  useEffect(() => {
    if (moving) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.close();
      else if (e.key === 'm') {
        e.preventDefault();
        setMoving(true);
      } else if (e.key === 'Backspace' || e.key === 'Delete') void remove();
      else if (e.key === '0') void openFolio();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  if (moving) {
    return <MovePanel bookmarkId={bookmark.id} lib={lib} onDone={() => setMoving(false)} />;
  }

  return (
    <>
      <div className="flex flex-col gap-2 px-4 pb-3">
        <button
          onClick={() => setMoving(true)}
          className="flex h-8 w-full cursor-pointer items-center justify-between rounded-[10px] border border-control bg-transparent px-3 text-left text-[13px] text-ink"
        >
          <span className="truncate">{folderLabel}</span>
          <span className="flex shrink-0 items-center gap-2 text-muted">
            Move <Kbd>M</Kbd>
          </span>
        </button>
        {(meta?.note || meta?.tags.length) && (
          <div className="text-[13px] text-ink-soft">
            {meta.note && <p className="m-0 mb-1">{meta.note}</p>}
            <div className="flex gap-1">
              {meta.tags.map((tag) => (
                <span key={tag} className="rounded-md bg-surface px-1.5 text-[12px]">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}
        {saved.length > 1 && <p className="m-0 text-[12px] text-muted">Saved {saved.length} times in this profile.</p>}
      </div>
      <div className="flex items-center justify-between px-4 pb-3 pt-1">
        <Button variant="ghost" onClick={() => void remove()} className="-ml-3" style={{ color: 'var(--danger)' }}>
          Remove <Kbd>⌫</Kbd>
        </Button>
        <Button onClick={() => void openFolio()}>
          Open in Folio <Kbd>0</Kbd>
        </Button>
      </div>
    </>
  );
}

/** Folder picker for moving an already-saved bookmark. */
function MovePanel({ bookmarkId, lib, onDone }: { bookmarkId: string; lib: Library; onDone: () => void }) {
  const inbox = useMemo(
    () =>
      lib.inboxId
        ? { id: lib.inboxId, title: 'Inbox', count: lib.bookmarks.filter((b) => b.parentId === lib.inboxId).length }
        : null,
    [lib.inboxId, lib.bookmarks],
  );
  const picker = usePicker({ tree: lib.tree, folders: lib.folders, inbox });
  const move = async (folderId: string) => {
    await moveBookmarks([bookmarkId], folderId);
    onDone();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone();
      else if (picker.onKey(e, (id) => void move(id))) return;
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <div className="px-2 pb-3">
      <div className="flex items-center justify-between px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted">
        <span>Move to</span>
        <span className="normal-case tracking-normal">Esc to cancel</span>
      </div>
      <input
        autoFocus
        value={picker.query}
        onChange={(e) => picker.setQuery(e.target.value)}
        placeholder="Find a folder…"
        aria-label="Find a folder"
        className="mb-1 h-8 w-full rounded-[10px] border border-control bg-transparent px-3 text-[14px] text-ink placeholder:text-muted"
      />
      <FolderList picker={picker} onPick={(id) => void move(id)} className="max-h-[192px]" itemClass="h-8" />
    </div>
  );
}
