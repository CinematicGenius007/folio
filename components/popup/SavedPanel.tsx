import { useEffect, useMemo, useState } from 'react';
import { formatNote, moveBookmarks, parseTags, removeBookmarks, setMeta } from '@/lib/actions';
import { db } from '@/lib/core/db';
import { rankTags } from '@/lib/core/tags';
import type { Tombstone } from '@/lib/core/types';
import type { Library } from '@/lib/react';
import { FolderList, usePicker } from '@/components/folders/FolderList';
import { hostOf } from '@/lib/util/url';
import { Button, Kbd, TagInput } from '@/components/ui';
import { openFolio } from './openFolio';

/** The projector writes the tombstone shortly after the browser reports the delete. */
const TOMBSTONE_DELAY_MS = 300;

/**
 * Summary for a page that is already saved: where it is, its note and tags, with move, edit note
 * (`E`), remove (undoable) and open-in-Folio.
 */
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
  const hasNote = !!(meta?.note || meta?.tags.length);
  const [moving, setMoving] = useState(false);
  const [editing, setEditing] = useState(false);

  const folderLabel =
    bookmark.parentId === lib.inboxId
      ? 'Inbox'
      : lib.folderById.get(bookmark.parentId)?.path.join(' / ') || 'Unknown folder';

  const rankedTags = useMemo(
    () => rankTags(lib.meta.values(), lib.bookmarks, hostOf(bookmark.url)),
    [lib.meta, lib.bookmarks, bookmark.url],
  );

  const remove = async () => {
    await removeBookmarks([bookmark.id]);
    setTimeout(async () => onRemoved((await db.tombstones.get(bookmark.id)) ?? null), TOMBSTONE_DELAY_MS);
  };
  useEffect(() => {
    // While editing, the note field owns the keyboard: its own ↵ and Esc, and letters are text.
    if (moving || editing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') window.close();
      else if (e.key === 'm') {
        e.preventDefault();
        setMoving(true);
      } else if (e.key === 'e') {
        e.preventDefault(); // or the `e` lands in the field that opens on this key
        setEditing(true);
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
        {editing ? (
          <NoteEditor
            initial={formatNote(meta?.note ?? '', meta?.tags ?? [])}
            tags={rankedTags}
            onDone={async (value) => {
              if (value !== null) {
                const { text, tags } = parseTags(value);
                await setMeta(bookmark.id, { note: text, tags });
              }
              setEditing(false);
              // Focus would otherwise sit on a footer button, where a stray ↵ acts on it.
              (document.activeElement as HTMLElement | null)?.blur();
            }}
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            aria-label={hasNote ? 'Edit note and tags' : 'Add a note'}
            className="flex min-h-8 w-full cursor-pointer items-center justify-between gap-3 rounded-[10px] border border-transparent bg-transparent px-3 py-1.5 text-left text-[13px] hover:bg-hover"
          >
            {hasNote && meta ? (
              <span className="flex min-w-0 flex-col gap-1 text-ink-soft">
                {meta.note && <span className="line-clamp-2 break-words">{meta.note}</span>}
                {meta.tags.length > 0 && (
                  <span className="flex flex-wrap gap-1">
                    {meta.tags.map((tag) => (
                      <span key={tag} className="rounded-md bg-surface px-1.5 text-[12px]">
                        #{tag}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted">Add a note</span>
            )}
            <span className="flex shrink-0 items-center gap-2 text-muted">
              {hasNote && 'Edit'} <Kbd>E</Kbd>
            </span>
          </button>
        )}
        {saved.length > 1 && <p className="m-0 text-[12px] text-muted">Saved {saved.length} times in this profile.</p>}
      </div>
      <div className="flex items-center justify-between px-4 pb-3 pt-1">
        {editing ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
              <Kbd>Esc</Kbd> cancel
            </span>
            <Button key="save-note" variant="primary" form="saved-note">
              Save <Kbd>↵</Kbd>
            </Button>
          </>
        ) : (
          <>
            <Button
              key="remove"
              variant="ghost"
              onClick={() => void remove()}
              className="-ml-3"
              style={{ color: 'var(--danger)' }}
            >
              Remove <Kbd>⌫</Kbd>
            </Button>
            <Button key="open" onClick={() => void openFolio()}>
              Open in Folio <Kbd>0</Kbd>
            </Button>
          </>
        )}
      </div>
    </>
  );
}

/**
 * The note and #tags of a saved page as one editable line, the same format the save view takes.
 * `↵` saves and `Esc` cancels (`onDone(null)`); Esc here never reaches the popup's close-on-Esc.
 */
function NoteEditor({
  initial,
  tags,
  onDone,
}: {
  initial: string;
  tags: readonly string[];
  onDone: (value: string | null) => void | Promise<void>;
}) {
  const [text, setText] = useState(initial);
  return (
    <form
      id="saved-note"
      onSubmit={(e) => {
        e.preventDefault();
        void onDone(text);
      }}
    >
      <TagInput
        autoFocus
        value={text}
        onValueChange={setText}
        tags={tags}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            void onDone(null);
          }
        }}
        placeholder="Note and #tags"
        aria-label="Note and tags"
      />
    </form>
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
