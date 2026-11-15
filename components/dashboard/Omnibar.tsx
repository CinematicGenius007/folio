import type { RefObject } from 'react';
import type { Folder } from '@/lib/core/types';
import { Kbd } from '@/components/ui';

/**
 * The search box. Typing filters the list; pasting a link and pressing Enter saves it.
 * `⌘↵` opens the highlighted result in the background.
 */
export function Omnibar({
  inputRef,
  value,
  placeholder,
  compact,
  onChange,
  onSubmit,
  onMove,
  onEscape,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  placeholder: string;
  compact: boolean;
  onChange: (value: string) => void;
  onSubmit: (background: boolean) => void;
  onMove: (delta: number) => void;
  onEscape: () => void;
}) {
  return (
    <div className="relative flex-1">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">+</span>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSubmit(e.metaKey || e.ctrlKey);
          } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            onMove(e.key === 'ArrowDown' ? 1 : -1);
          } else if (e.key === 'Escape') {
            onEscape();
          }
        }}
        placeholder={placeholder}
        aria-label="Search or add"
        className={`h-8 w-full rounded-[10px] border border-control bg-transparent pl-8 text-[14px] text-ink placeholder:text-muted ${compact ? 'pr-2' : 'pr-16'}`}
      />
      {!compact && (
        <span className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
          <Kbd>⌘</Kbd>
          <Kbd>F</Kbd>
        </span>
      )}
    </div>
  );
}

/** Folder dropdown for the narrow side panel, where the top bar does not fit. */
export function FolderSelect({
  selectRef,
  value,
  folders,
  inboxId,
  onChange,
}: {
  selectRef: RefObject<HTMLSelectElement | null>;
  value: string;
  folders: Folder[];
  inboxId: string | null;
  onChange: (folderId: string) => void;
}) {
  const options = folders.filter((f) => f.depth >= 2).sort((a, b) => a.path.join('/').localeCompare(b.path.join('/')));
  return (
    <select
      ref={selectRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 max-w-[45%] rounded-[10px] border border-control bg-ground px-2 text-[13px] text-ink"
      aria-label="Folder"
    >
      <option value="all">All</option>
      {options.map((f) => (
        <option key={f.id} value={f.id}>
          {f.id === inboxId ? 'Inbox' : f.path.join(' / ')}
        </option>
      ))}
    </select>
  );
}
