import { useEffect, useMemo, useRef, useState } from 'react';
import { type PickerRow, pickerRows, type FolderNode, type PickerSuggestion } from '@/lib/core/tree';
import type { Folder } from '@/lib/core/types';
import { Check, ChevronRight } from '@/components/ui/icons';

export interface InboxInfo {
  id: string;
  title: string;
  count: number;
}

/**
 * State and keyboard rules shared by every folder picker (switcher, move dialog, popup):
 * a filter query, which folders are expanded, and the highlighted row.
 */
export function usePicker(opts: {
  tree: FolderNode[];
  folders: Folder[];
  inbox: InboxInfo | null;
  initialExpanded?: string[];
  /** Folder id to highlight first. */
  initialActive?: string;
  /** Ranked destinations pinned above the tree while the filter is empty. */
  suggestions?: PickerSuggestion[];
}) {
  const { tree, folders, inbox, suggestions } = opts;
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(() => new Set(opts.initialExpanded ?? []));
  const rows = useMemo(
    () => pickerRows({ tree, folders, inbox, expanded, query, suggestions }),
    [tree, folders, inbox, expanded, query, suggestions],
  );

  // The highlight is remembered by folder id, so it survives filtering and expanding.
  const [activeId, setActiveId] = useState(opts.initialActive);
  const active = Math.max(
    0,
    rows.findIndex((row) => row.id === activeId),
  );
  const setActive = (index: number) => setActiveId(rows[index]?.id);
  /** Bumps on keyboard moves so the list scrolls; mouse hover must not scroll. */
  const [keyboardMoves, setKeyboardMoves] = useState(0);

  const move = (delta: number) => {
    setKeyboardMoves((n) => n + 1);
    setActive(Math.max(0, Math.min(rows.length - 1, active + delta)));
  };

  const toggle = (id: string, open?: boolean) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (open ?? !next.has(id)) next.add(id);
      else next.delete(id);
      return next;
    });

  /**
   * Handles ↑ ↓ ↵ and, while the filter is empty, → and ← to expand and collapse.
   * Returns true when the key was used.
   */
  const onKey = (e: { key: string; preventDefault(): void }, pick: (id: string) => void): boolean => {
    const row = rows[active];
    const handled = (action: () => void) => (e.preventDefault(), action(), true);
    if (e.key === 'ArrowDown') return handled(() => move(1));
    if (e.key === 'ArrowUp') return handled(() => move(-1));
    if (e.key === 'Enter' && row) return handled(() => pick(row.id));
    if (!query && row) {
      if (e.key === 'ArrowRight' && row.hasChildren) return handled(() => toggle(row.id, true));
      if (e.key === 'ArrowLeft' && row.expanded) return handled(() => toggle(row.id, false));
    }
    return false;
  };

  return { query, setQuery, rows, active, setActive, move, toggle, onKey, keyboardMoves };
}

const dotStyle = (row: PickerRow) =>
  row.color === 'inbox' ? { boxShadow: 'inset 0 0 0 1.5px var(--muted)' } : { background: `var(--coll-${row.color})` };

/** The rows of a folder picker: indented tree with expand toggles, or flat path-labelled matches while filtering. */
export function FolderList({
  picker,
  current,
  onPick,
  className = '',
  itemClass = 'h-9',
}: {
  picker: ReturnType<typeof usePicker>;
  /** Folder id to mark with a check, e.g. the folder being viewed. */
  current?: string;
  onPick: (id: string) => void;
  className?: string;
  itemClass?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { rows, active, setActive, toggle, keyboardMoves } = picker;
  const scrolledFor = useRef(0);

  useEffect(() => {
    if (keyboardMoves === scrolledFor.current) return;
    scrolledFor.current = keyboardMoves;
    ref.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [keyboardMoves, active]);

  return (
    <div ref={ref} role="listbox" className={`overflow-y-auto ${className}`}>
      {rows.map((row, i) => (
        <div key={row.rowKey}>
          {row.suggested && i === 0 && (
            <div className="px-2 pb-1 pt-0.5 text-[11px] font-medium uppercase tracking-wider text-muted">
              Suggested
            </div>
          )}
          {!row.suggested && rows[i - 1]?.suggested && <div className="mx-2 mb-1 mt-1.5 border-t border-control" />}
          <div
            data-idx={i}
            role="option"
            aria-selected={row.id === current}
            onMouseEnter={() => setActive(i)}
            onClick={() => onPick(row.id)}
            className={`flex cursor-pointer items-center gap-2 rounded-[10px] pr-2.5 text-[14px] text-ink ${itemClass} ${i === active ? 'bg-hover' : ''} ${row.id === current ? 'font-medium' : ''}`}
            style={{ paddingLeft: 8 + row.depth * 16 }}
          >
            {row.hasChildren ? (
              <button
                tabIndex={-1}
                aria-label={row.expanded ? 'Collapse' : 'Expand'}
                onClick={(e) => (e.stopPropagation(), toggle(row.id))}
                className="grid h-5 w-5 shrink-0 cursor-pointer place-items-center rounded border-0 bg-transparent p-0 text-muted hover:bg-surface"
              >
                <ChevronRight
                  className={`transition-transform ${row.expanded ? 'rotate-90' : ''}`}
                  width={12}
                  height={12}
                />
              </button>
            ) : (
              <span className="w-5 shrink-0" />
            )}
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={dotStyle(row)} />
            <span className="min-w-0 flex-1 truncate">
              {row.title}
              {row.pathLabel && <span className="ml-2 text-[12px] font-normal text-muted">{row.pathLabel}</span>}
            </span>
            {row.id === current ? <Check /> : <span className="text-[13px] text-muted">{row.count}</span>}
          </div>
        </div>
      ))}
      {!rows.length && <div className="px-3 py-4 text-[13px] text-muted">No folder matches</div>}
    </div>
  );
}
