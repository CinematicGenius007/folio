import {
  type InputHTMLAttributes,
  type KeyboardEvent,
  type Ref,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { completeTag } from '@/lib/core/tags';

const FIELD =
  'h-8 w-full rounded-[10px] border border-control bg-transparent px-3 text-[14px] text-ink placeholder:text-muted';

/**
 * A single-line field for a note with `#tags` that completes tags inline. When the caret sits right
 * after `#prefix`, the rest of the best existing tag is drawn as faint ghost text after the caret;
 * `Tab` (or `→` at the end of the text) accepts it. Nothing else changes: no dropdown, so the layout
 * never jumps, and `Tab` keeps its usual meaning whenever no completion is showing.
 *
 * The ghost is an overlay that mirrors the input's text and horizontal scroll. When text follows
 * the caret, the overlay draws that text too (shifted past the ghost) and the input's own glyphs are
 * hidden for the moment, so nothing overlaps.
 */
export function TagInput({
  value,
  onValueChange,
  tags,
  complete = true,
  className = '',
  onKeyDown,
  ref,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
  /** Existing tags, best first (see `rankTags`). */
  tags: readonly string[];
  /** Turn completion off, e.g. while the field holds a `/` folder search. */
  complete?: boolean;
  ref?: Ref<HTMLInputElement>;
}) {
  const input = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => input.current!, []);
  /** Collapsed caret position while focused, else null (no ghost when the field is not in use). */
  const [caret, setCaret] = useState<number | null>(null);
  const [scroll, setScroll] = useState(0);
  const pendingCaret = useRef<number | null>(null);

  const sync = () => {
    const el = input.current;
    if (!el) return;
    const focused = document.activeElement === el;
    setCaret(focused && el.selectionStart === el.selectionEnd ? el.selectionStart : null);
    setScroll(el.scrollLeft);
  };

  // After accepting, put the caret after the inserted text once React has written the new value.
  useLayoutEffect(() => {
    const el = input.current;
    if (!el || pendingCaret.current === null) return;
    el.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
    sync();
  });

  const ghost = complete && caret !== null ? completeTag(tags, value, caret) : null;
  const before = ghost ? value.slice(0, caret!) : '';
  const after = ghost ? value.slice(caret!) : '';

  const accept = () => {
    if (!ghost || caret === null) return;
    // A space after the tag lets typing carry on, unless one is already there.
    const insert = /^\s/.test(after) ? ghost : `${ghost} `;
    pendingCaret.current = caret + insert.length;
    onValueChange(before + insert + after);
  };

  const keyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const plain = !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey;
    if (ghost && plain && (e.key === 'Tab' || (e.key === 'ArrowRight' && caret === value.length))) {
      // Handled here, so page-level key handlers (folder picker, dialogs) never see it.
      e.preventDefault();
      e.stopPropagation();
      accept();
      return;
    }
    onKeyDown?.(e);
  };

  return (
    <div className="relative w-full">
      <input
        {...props}
        ref={input}
        value={value}
        data-completion={ghost ?? undefined}
        onChange={(e) => {
          onValueChange(e.target.value);
          sync();
        }}
        onKeyDown={keyDown}
        onSelect={sync}
        onFocus={(e) => (sync(), props.onFocus?.(e))}
        onBlur={(e) => (setCaret(null), props.onBlur?.(e))}
        onScroll={sync}
        className={`${FIELD} ${className}`}
        style={ghost && after ? { ...props.style, color: 'transparent', caretColor: 'var(--ink)' } : props.style}
      />
      {ghost && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre rounded-[10px] border border-transparent px-3 text-[14px]"
        >
          <span style={{ transform: `translateX(${-scroll}px)` }}>
            <span className="text-transparent">{before}</span>
            <span className="text-muted opacity-70" data-ghost>
              {ghost}
            </span>
            <span className="text-ink">{after}</span>
          </span>
        </div>
      )}
    </div>
  );
}
