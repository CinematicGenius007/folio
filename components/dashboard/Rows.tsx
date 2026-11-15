import type { FolderNode } from '@/lib/core/tree';
import type { Bm } from '@/lib/core/types';
import { shortDate } from '@/lib/util/format';
import { hostOf, isSafeUrl } from '@/lib/util/url';
import { Favicon } from '@/components/favicon/Favicon';
import { FolderIcon } from '@/components/ui/icons';
import { Kbd } from '@/components/ui';

/** Shown when a folder or search has nothing to list. */
export function Empty({ hasQuery, inFolder }: { hasQuery: boolean; inFolder: boolean }) {
  return (
    <div className="grid place-items-center p-16 text-center text-muted">
      <div>
        <p className="m-0 mb-1 text-ink">
          {hasQuery ? 'Nothing matches' : inFolder ? 'This folder is empty' : 'Nothing here yet'}
        </p>
        <p className="m-0 text-[13px]">
          {hasQuery ? 'Try fewer words, or paste a link to save it.' : 'Press Alt+S on any page to save it.'}
        </p>
      </div>
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
  onFocus: () => void;
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
      className={`group flex shrink-0 cursor-pointer items-center justify-between gap-1.5 rounded-[14px] border border-transparent ${compact ? 'px-2.5 py-2' : 'px-4 py-3'} ${selected ? 'bg-select' : focused ? 'bg-hover' : ''}`}
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
              <span
                key={t}
                className="hidden shrink-0 rounded-md bg-surface px-1.5 text-[12px] text-ink-soft sm:inline"
              >
                #{t}
              </span>
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
    </div>
  );
}
