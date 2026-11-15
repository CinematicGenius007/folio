import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Copy, MoveTo, Pencil, Refresh, SelectMany, Trash } from '@/components/ui/icons';
import { Kbd } from '@/components/ui';
import { focusedItemHas, moveFocus } from './focus';
import { menuItem } from './styles';

/** Context menu for a bookmark row, opened by right-click. Acts on the whole selection when the row is part of one. */
export function RowMenu(props: {
  x: number;
  y: number;
  count: number;
  canRefresh: boolean;
  inboxId: string | null;
  folders: { id: string; title: string }[];
  onClose: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRefresh: () => void;
  onMove: (folderId: string) => void;
  onChooseFolder: () => void;
  onSelect: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [sub, setSub] = useState(false);
  const [pos, setPos] = useState({ left: props.x, top: props.y });
  const multi = props.count > 1;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(props.x, innerWidth - r.width - 8)),
      top: Math.max(8, Math.min(props.y, innerHeight - r.height - 8)),
    });
    el.focus();
  }, [props.x, props.y]);
  const flip = pos.left + 240 + 220 > innerWidth;
  const ordered = [...props.folders]
    .sort((a, b) => (a.id === props.inboxId ? -1 : b.id === props.inboxId ? 1 : 0))
    .slice(0, 8);
  const item = `${menuItem} hover:bg-hover focus:bg-hover`;
  const keys = (...k: string[]) => (
    <span className="flex gap-1">
      {k.map((x) => (
        <Kbd key={x}>{x}</Kbd>
      ))}
    </span>
  );
  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onMouseDown={props.onClose}
        onContextMenu={(e) => (e.preventDefault(), props.onClose())}
      />
      <div
        ref={ref}
        role="menu"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            if (sub) setSub(false);
            else props.onClose();
          } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            moveFocus(ref.current, e.key === 'ArrowDown' ? 1 : -1);
          } else if (e.key === 'ArrowRight' && focusedItemHas('sub')) {
            e.preventDefault();
            setSub(true);
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            setSub(false);
          }
        }}
        className="fixed z-50 w-[240px] rounded-2xl bg-ground p-1.5"
        style={{ left: pos.left, top: pos.top, boxShadow: 'var(--shadow)' }}
      >
        {!multi && (
          <button role="menuitem" onClick={props.onCopy} className={item}>
            <Copy className="text-ink" />
            <span className="flex-1">Copy link</span>
            {keys('⌘', 'C')}
          </button>
        )}
        {!multi && (
          <button role="menuitem" onClick={props.onEdit} className={item}>
            <Pencil className="text-ink" />
            <span className="flex-1">Edit</span>
            {keys('⌘', 'E')}
          </button>
        )}
        <button role="menuitem" onClick={props.onDelete} className={item} style={{ color: 'var(--danger)' }}>
          <Trash />
          <span className="flex-1">{multi ? `Delete ${props.count}` : 'Delete'}</span>
          {keys('⌘', '⌫')}
        </button>
        {!multi && props.canRefresh && (
          <button role="menuitem" onClick={props.onRefresh} className={item}>
            <Refresh className="text-ink" />
            <span className="flex-1">Refresh icon</span>
          </button>
        )}
        <div className="relative" onMouseEnter={() => setSub(true)} onMouseLeave={() => setSub(false)}>
          <button role="menuitem" data-sub="1" onClick={() => setSub((v) => !v)} className={item}>
            <MoveTo className="text-ink" />
            <span className="flex-1">Move to…</span>
            <ChevronRight className="text-muted" />
          </button>
          {sub && (
            <div
              className={`absolute top-0 w-[220px] rounded-2xl bg-ground p-1.5 ${flip ? 'right-full mr-1' : 'left-full ml-1'}`}
              style={{ boxShadow: 'var(--shadow)' }}
            >
              <div className="max-h-[300px] overflow-y-auto">
                {ordered.map((f) => (
                  <button key={f.id} role="menuitem" onClick={() => props.onMove(f.id)} className={item}>
                    <span className="flex-1 truncate">{f.title}</span>
                    {f.id === props.inboxId && <span className="text-[12px] text-muted">default</span>}
                  </button>
                ))}
              </div>
              <div className="mt-1 border-t border-line pt-1">
                <button role="menuitem" onClick={props.onChooseFolder} className={item}>
                  <span className="flex-1">Choose folder…</span>
                  <Kbd>M</Kbd>
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="my-1 border-t border-line" />
        <button role="menuitem" onClick={props.onSelect} className={item}>
          <SelectMany className="text-ink" />
          <span className="flex-1">Select multiple</span>
          {keys('X')}
        </button>
      </div>
    </>
  );
}
