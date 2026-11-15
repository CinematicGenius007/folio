import { useEffect, useMemo, useRef } from 'react';
import type { FolderNode } from '@/lib/core/tree';
import type { Folder } from '@/lib/core/types';
import { FolderList, usePicker, type InboxInfo } from '@/components/folders/FolderList';
import { Check, Pencil, Plus, Trash } from '@/components/ui/icons';
import { Kbd } from '@/components/ui';
import { menuBox, menuItem } from './styles';

/** Dropdown for jumping to any folder: a tree with a filter box that finds folders at every depth. */
interface SwitcherProps {
  tree: FolderNode[];
  folders: Folder[];
  inbox: InboxInfo | null;
  total: number;
  current: string;
  canDelete: boolean;
  canRename: boolean;
  onPick: (id: string) => void;
  onNew: () => void;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function SwitcherMenu(props: SwitcherProps) {
  const { tree, folders, inbox, current } = props;
  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const picker = usePicker({
    tree,
    folders,
    inbox,
    initialExpanded: (folderById.get(current)?.pathIds ?? []).slice(0, -1),
    initialActive: current,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);
  const all = current === 'all';
  return (
    <>
      <div className="fixed inset-0 z-40" onMouseDown={props.onClose} />
      <div
        onKeyDown={(e) => {
          if (e.key === 'Escape') return (e.preventDefault(), props.onClose());
          picker.onKey(e, props.onPick);
        }}
        className={`${menuBox} left-0 top-full w-[280px]`}
        style={{ boxShadow: 'var(--shadow)' }}
      >
        <input
          ref={inputRef}
          value={picker.query}
          onChange={(e) => picker.setQuery(e.target.value)}
          placeholder="Find a folder…"
          aria-label="Find a folder"
          className="mb-1 h-8 w-full rounded-[10px] border border-control bg-transparent px-3 text-[14px] text-ink placeholder:text-muted"
        />
        {!picker.query && (
          <button onClick={() => props.onPick('all')} className={`${menuItem} hover:bg-hover`}>
            <span className="h-2.5 w-2.5 rounded-full bg-ink" />
            <span className="flex-1">All bookmarks</span>
            {all ? <Check /> : <span className="text-[13px] text-muted">{props.total}</span>}
          </button>
        )}
        <FolderList picker={picker} current={current} onPick={props.onPick} className="max-h-[320px]" />
        <div className="mt-1 border-t border-line pt-1">
          <button onClick={props.onNew} className={`${menuItem} hover:bg-hover`}>
            <Plus className="text-ink" />
            <span className="flex-1">{!all && props.canRename ? 'New folder here' : 'New collection'}</span>
            <Kbd>⇧N</Kbd>
          </button>
          {props.canRename && (
            <button onClick={props.onRename} className={`${menuItem} hover:bg-hover`}>
              <Pencil className="text-ink" />
              <span className="flex-1">Rename</span>
            </button>
          )}
          {props.canDelete && (
            <button
              onClick={props.onDelete}
              className={`${menuItem} hover:bg-hover`}
              style={{ color: 'var(--danger)' }}
            >
              <Trash />
              <span className="flex-1">Delete folder</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
