import type { FolderNode } from '@/lib/core/tree';
import type { Folder } from '@/lib/core/types';
import { FolderList, usePicker, type InboxInfo } from '@/components/folders/FolderList';
import { Dialog } from '@/components/ui';

/** Picks a destination folder from the whole tree, with a filter for deep folders. */
export function MoveDialog({
  tree,
  folders,
  inbox,
  count,
  onClose,
  onPick,
}: {
  tree: FolderNode[];
  folders: Folder[];
  inbox: InboxInfo | null;
  count: number;
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  const picker = usePicker({ tree, folders, inbox });
  return (
    <Dialog title={`Move ${count} ${count === 1 ? 'bookmark' : 'bookmarks'} to…`} onClose={onClose} width={380}>
      <div onKeyDown={(e) => picker.onKey(e, onPick)}>
        <input
          autoFocus
          value={picker.query}
          onChange={(e) => picker.setQuery(e.target.value)}
          placeholder="Find a folder…"
          aria-label="Find a folder"
          className="mb-2 h-8 w-full rounded-[10px] border border-control bg-transparent px-3 text-[14px] text-ink placeholder:text-muted"
        />
        <FolderList picker={picker} onPick={onPick} className="max-h-[300px]" />
      </div>
    </Dialog>
  );
}
