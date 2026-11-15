import { type ReactNode, useEffect, useRef, useState } from 'react';
import { type Crumb, collapseTrail } from './crumbs';

const separator = (
  <span aria-hidden className="select-none text-[16px] text-faint">
    /
  </span>
);
const linkClass =
  'h-8 max-w-[180px] cursor-pointer truncate rounded-[14px] border-0 bg-transparent px-2 text-[14px] text-muted hover:bg-hover hover:text-ink-soft focus-visible:bg-hover focus-visible:outline-none';

/**
 * The folder path in the top bar: `All bookmarks / Dev / Rust / [current]`. Each crumb before the
 * current folder jumps to that folder (the same place `H` walks to); the current folder is the
 * `current` slot, which the top bar fills with the folder switcher (marked `aria-current`). Long paths hide their middle
 * behind an ellipsis that reveals them in place. Remount it (`key`) when the folder changes so a
 * revealed path collapses again.
 */
export function Breadcrumb({
  trail,
  onOpen,
  current,
}: {
  trail: Crumb[];
  onOpen: (id: string) => void;
  current: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const revealed = useRef<HTMLButtonElement>(null);
  // after revealing hidden crumbs, keep keyboard focus where the ellipsis was
  useEffect(() => {
    if (expanded) revealed.current?.focus();
  }, [expanded]);
  const items = expanded ? trail.map((crumb) => ({ kind: 'link' as const, crumb })) : collapseTrail(trail);
  return (
    <nav aria-label="Folder path" className="min-w-0">
      <ol className="m-0 flex min-w-0 list-none items-center gap-1 p-0">
        {items.map((item, i) => (
          <li key={item.kind === 'link' ? item.crumb.id : 'more'} className="flex min-w-0 items-center gap-1">
            {item.kind === 'link' ? (
              <button
                className={linkClass}
                title={item.crumb.title}
                onClick={() => onOpen(item.crumb.id)}
                ref={i === 1 ? revealed : undefined}
              >
                {item.crumb.title}
              </button>
            ) : (
              <button
                className={linkClass}
                aria-label={`Show ${item.hidden.length} more folders: ${item.hidden.map((c) => c.title).join(', ')}`}
                title={item.hidden.map((c) => c.title).join(' / ')}
                onClick={() => setExpanded(true)}
              >
                …
              </button>
            )}
            {separator}
          </li>
        ))}
        <li className="min-w-0">{current}</li>
      </ol>
    </nav>
  );
}
