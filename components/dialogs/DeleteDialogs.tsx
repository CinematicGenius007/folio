import type { Bm } from '@/lib/core/types';
import { Button, Dialog, Kbd } from '@/components/ui';

/** Confirms deleting several bookmarks at once. A single bookmark is deleted straight away, with undo. */
export function DeleteBookmarksDialog({
  rows,
  onCancel,
  onConfirm,
}: {
  rows: Bm[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog title={`Delete ${rows.length} bookmarks?`} onClose={onCancel}>
      <p className="m-0 mb-3 text-[13px] text-ink-soft">
        This also removes them from your browser’s bookmarks and any device synced with this profile. Folio keeps a copy
        for 30 days so you can undo.
      </p>
      <div className="mb-4 rounded-xl border border-danger-border bg-danger-bg p-3 text-[12px] text-danger-text">
        {rows.slice(0, 3).map((row) => (
          <div key={row.id} className="truncate">
            {row.title}
          </div>
        ))}
        {rows.length > 3 && <div>+{rows.length - 3} more</div>}
      </div>
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>
          Cancel <Kbd>Esc</Kbd>
        </Button>
        <Button variant="danger" onClick={onConfirm} autoFocus>
          Delete from browser
        </Button>
      </div>
    </Dialog>
  );
}

/** Confirms deleting a folder together with everything inside it. */
export function DeleteFolderDialog({
  title,
  bookmarkCount,
  onCancel,
  onConfirm,
}: {
  title: string;
  bookmarkCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog title={`Delete “${title}”?`} onClose={onCancel}>
      <p className="m-0 mb-3 text-[13px] text-ink-soft">
        This deletes the folder, any folders inside it, and its {bookmarkCount} bookmarks from your browser, on every
        device synced with this profile. Folio keeps copies of the bookmarks for 30 days; undo puts them in your Inbox.
      </p>
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>
          Cancel <Kbd>Esc</Kbd>
        </Button>
        <Button variant="danger" autoFocus onClick={onConfirm}>
          Delete folder
        </Button>
      </div>
    </Dialog>
  );
}
