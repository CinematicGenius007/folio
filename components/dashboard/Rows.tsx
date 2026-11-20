import type { FolderNode } from '@/lib/core/tree';
import type { Bm } from '@/lib/core/types';
import { shortDate } from '@/lib/util/format';
import { hostOf, isSafeUrl } from '@/lib/util/url';
import { Favicon } from '@/components/favicon/Favicon';
import { FolderIcon } from '@/components/ui/icons';
import { Kbd } from '@/components/ui';

/** Shown when a view has nothing to list; the wording comes from `emptyMessage`. */
export function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="grid place-items-center p-16 text-center text-muted">
      <div>
        <p className="m-0 mb-1 text-ink">{title}</p>
        <p className="m-0 text-[13px]">{hint}</p>
      </div>
    </div>
  );
}

/** A folder offered for filing an Inbox bookmark, as the triage line shows it. */
export interface TriageSuggestion {
  id: string;
  title: string;
  /** Full folder path, shown as a tooltip. */
  path: string;
  /** CSS colour of the folder's dot. */
  color: string;
}

/**
 * The line under the highlighted Inbox bookmark: up to three suggested folders, each filed with its
 * number key or a click, or a hint to move it by hand when nothing is suggested.
 */
function TriageLine({
  suggestions,
  compact,
  onFile,
}: {
  suggestions: TriageSuggestion[];
  compact: boolean;
  onFile: (index: number) => void;
}) {
  return (
    <div
      data-triage
      className={`flex min-w-0 basis-full items-center gap-1.5 overflow-hidden text-[12px] text-muted ${compact ? 'pl-8' : 'pl-7'}`}
      onClick={(e) => e.stopPropagation()}
    >
      {suggestions.length ? (
        <>
          <span className="shrink-0">File to</span>
          {suggestions.map((s, i) => (
            <button
              key={s.id}
              type="button"
              title={`File to ${s.path}`}
              onClick={() => onFile(i)}
              className="inline-flex min-w-0 cursor-pointer items-center gap-1.5 rounded-md border-0 bg-ground py-0.5 pl-1 pr-2 text-[12px] font-medium text-ink-soft hover:bg-select hover:text-ink"
            >
              <Kbd>{String(i + 1)}</Kbd>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="truncate">{s.title}</span>
            </button>
          ))}
        </>
      ) : (
        <span className="inline-flex items-center gap-1">
          <Kbd>M</Kbd> move
        </span>
      )}
    </div>
  );
}

/** A subfolder, listed above the bookmarks of the folder you are in. */
export function FolderRow({
  node,
  compact,
  focused,
  onFocus,
  onOpen,
}: {
  node: FolderNode;
  compact: boolean;
  focused: boolean;
  onFocus: () => void;
  onOpen: () => void;
}) {
  return (
    <div
      data-id={node.id}
      role="option"
      aria-selected={false}
      onMouseEnter={onFocus}
      onClick={onOpen}
      className={`group flex shrink-0 cursor-pointer items-center justify-between gap-1.5 rounded-[14px] border border-transparent ${compact ? 'px-2.5 py-2' : 'px-4 py-3'} ${focused ? 'bg-hover' : ''}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="grid h-5 w-5 shrink-0 place-items-center" style={{ color: `var(--coll-${node.color})` }}>
          <FolderIcon />
        </span>
        <span className="min-w-0 truncate text-[14px] font-medium">{node.title}</span>
        <span className="shrink-0 text-[13px] font-medium text-muted">
          {node.count} {node.count === 1 ? 'item' : 'items'}
        </span>
      </div>
      {!compact && (
        <div className="flex h-5 w-[100px] shrink-0 items-center justify-end">
          <span className={`items-center gap-1 ${focused ? 'flex' : 'hidden'}`}>
            <Kbd>Enter</Kbd>
          </span>
        </div>
      )}
    </div>
  );
}

/** One bookmark. In the narrow side panel it collapses to two lines. */
export function Row(props: {
  b: Bm;
  compact: boolean;
  focused: boolean;
  selected: boolean;
  where: string;
  tags: string[];
  /** Starts a new group (Duplicates view), so it sits a little apart from the row above. */
  groupStart?: boolean;
  /** Folder suggestions for Inbox triage; only the highlighted Inbox row gets them. */
  triage?: TriageSuggestion[];
  onFocus: () => void;
  onTag: (tag: string) => void;
  onFile: (index: number) => void;
  onOpen: (bg: boolean) => void;
  onToggle: () => void;
  onMenu: (x: number, y: number) => void;
}) {
  const { b, compact, focused, selected, tags } = props;
  const safe = isSafeUrl(b.url);
  const host = safe ? hostOf(b.url) : 'not openable';
  const icon = (
    <span className="grid h-5 w-5 shrink-0 place-items-center" onClick={(e) => (e.stopPropagation(), props.onToggle())}>
      {selected ? (
        <span className="grid h-5 w-5 place-items-center rounded-[5px] bg-primary text-[12px] text-on-primary">✓</span>
      ) : (
        <Favicon url={b.url} title={b.title} />
      )}
    </span>
  );
  return (
    <div
      data-id={b.id}
      role="option"
      aria-selected={selected}
      onMouseEnter={props.onFocus}
      onClick={(e) => (e.metaKey || e.ctrlKey ? props.onToggle() : props.onOpen(false))}
      onAuxClick={(e) => e.button === 1 && props.onOpen(true)}
      onContextMenu={(e) => (e.preventDefault(), props.onMenu(e.clientX, e.clientY))}
      className={`group flex shrink-0 cursor-pointer flex-wrap items-center justify-between gap-1.5 rounded-[14px] border border-transparent ${compact ? 'px-2.5 py-2' : 'px-4 py-3'} ${props.groupStart ? 'mt-3' : ''} ${selected ? 'bg-select' : focused ? 'bg-hover' : ''}`}
    >
      <div className={`flex min-w-0 flex-1 items-center gap-2 ${compact ? '' : 'mr-4'}`}>
        {icon}
        {compact ? (
          <span className="flex min-w-0 flex-col pl-1">
            <span className="truncate text-[14px] font-medium">{b.title}</span>
            <span className="truncate text-[13px] text-muted">
              {host}
              {props.where ? ` · ${props.where}` : ''}
            </span>
          </span>
        ) : (
          <>
            <span className="min-w-0 truncate text-[14px] font-medium">{b.title}</span>
            <span className="shrink-0 truncate text-[13px] font-medium text-muted" style={{ maxWidth: '36%' }}>
              {host}
            </span>
            {props.where && (
              <span
                className="hidden shrink-0 truncate rounded-md bg-surface px-1.5 text-[12px] text-ink-soft sm:inline"
                style={{ maxWidth: '24%' }}
              >
                {props.where}
              </span>
            )}
            {tags.map((t) => (
              <button
                key={t}
                type="button"
                title={`Show every bookmark tagged #${t}`}
                onClick={(e) => (e.stopPropagation(), props.onTag(t))}
                className="hidden shrink-0 cursor-pointer rounded-md border-0 bg-surface px-1.5 text-[12px] text-ink-soft hover:bg-select hover:text-ink sm:inline"
              >
                #{t}
              </button>
            ))}
          </>
        )}
      </div>
      {!compact && (
        <div className="flex h-5 w-[100px] shrink-0 items-center justify-end gap-1.5">
          <span
            className={`text-[13px] font-medium text-muted ${focused ? 'hidden' : ''}`}
            style={{ fontFeatureSettings: '"tnum"' }}
          >
            {shortDate(b.dateAdded)}
          </span>
          <span className={`items-center gap-1 ${focused ? 'flex' : 'hidden'}`}>
            <Kbd>⌘</Kbd>
            <Kbd>Enter</Kbd>
          </span>
        </div>
      )}
      {props.triage && <TriageLine suggestions={props.triage} compact={compact} onFile={props.onFile} />}
    </div>
  );
}
