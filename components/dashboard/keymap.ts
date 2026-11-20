import type { Bm } from '@/lib/core/types';
import type { Entry } from './entries';

/** The slice of a `KeyboardEvent` the key handler reads. */
export type KeyInput = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'preventDefault'>;

/** Everything the key handler needs to know about the dashboard right now. */
export interface KeyState {
  /** Row under the keyboard cursor. */
  cursor: Entry | undefined;
  /** Bookmarks an action applies to: the selection, or else the cursor row. */
  targets: Bm[];
  compact: boolean;
  /** An Undo is available on the toast. */
  canUndo: boolean;
  /** The user has text highlighted on the page, so ⌘C should copy that instead of the link. */
  hasTextSelection: boolean;
  /** How many suggested folders the cursor row offers for filing (Inbox triage); 0 when none. */
  triage: number;
}

/** What a key can make the dashboard do. */
export interface KeyActions {
  focusSearch(selectText: boolean): void;
  moveCursor(delta: number): void;
  open(bookmark: Bm, opts: { background: boolean }): void;
  enterFolder(id: string): void;
  goUp(): void;
  toggleSelect(bookmark: Bm): void;
  edit(entry: Entry): void;
  confirmDelete(): void;
  deleteFolder(id: string): void;
  deleteNow(rows: Bm[]): void;
  moveTargets(): void;
  /** Files the cursor bookmark into its `index`-th suggested folder (0-based). */
  fileTo(index: number): void;
  newFolder(): void;
  copyLink(bookmark: Bm): void;
  undo(): void;
  clearSelection(): void;
  openSwitcher(): void;
  openAccount(): void;
  openSettings(): void;
  openHelp(): void;
}

/**
 * Handles one keydown for the dashboard. Returns true when the key was used, after calling
 * `preventDefault`. The caller decides when keys apply at all (not while typing or in a dialog).
 *
 * Plain keys are vim-style single letters; ⌘/Ctrl combinations mirror the row menu.
 */
export function handleKey(e: KeyInput, state: KeyState, a: KeyActions, selectionActive: boolean): boolean {
  const { cursor, targets } = state;
  const bookmark = cursor?.kind === 'bookmark' ? cursor.bookmark : undefined;
  const handled = (action: () => void) => {
    e.preventDefault();
    action();
    return true;
  };
  const deleteTargets = () => (targets.length > 1 ? a.confirmDelete() : a.deleteNow(targets));
  const openCursor = (background: boolean) => (bookmark ? a.open(bookmark, { background }) : a.enterFolder(cursor!.id));

  if (e.metaKey || e.ctrlKey) {
    if (e.key === 'z') return handled(a.undo);
    if (e.key === 'c' && bookmark && !state.hasTextSelection) return handled(() => a.copyLink(bookmark));
    if (e.key === 'e' && cursor) return handled(() => a.edit(cursor));
    if ((e.key === 'Backspace' || e.key === 'Delete') && targets.length) return handled(deleteTargets);
    if (e.key === 'Enter' && cursor) return handled(() => openCursor(false));
    return false;
  }
  if (e.altKey) return false;

  switch (e.key) {
    case 'j':
    case 'ArrowDown':
      return handled(() => a.moveCursor(1));
    case 'k':
    case 'ArrowUp':
      return handled(() => a.moveCursor(-1));
    case 'Enter':
      return cursor ? handled(() => openCursor(e.shiftKey)) : false;
    case 'l':
    case 'ArrowRight':
      return cursor?.kind === 'folder' ? handled(() => a.enterFolder(cursor.id)) : false;
    case 'h':
    case 'ArrowLeft':
      return handled(a.goUp);
    case '/':
      return handled(() => a.focusSearch(false));
    case 'x':
      return bookmark ? handled(() => a.toggleSelect(bookmark)) : false;
    case 'e':
      return cursor ? handled(() => a.edit(cursor)) : false;
    case 'm':
      return targets.length ? handled(a.moveTargets) : false;
    case 'Backspace':
    case 'Delete':
      if (cursor?.kind === 'folder' && !selectionActive) return handled(() => a.deleteFolder(cursor.id));
      return targets.length ? handled(deleteTargets) : false;
    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
    case '7':
    case '8':
    case '9': {
      // Inbox triage: digits pick a suggested folder for the cursor row (not for a selection).
      const index = Number(e.key) - 1;
      return bookmark && !selectionActive && index < state.triage ? handled(() => a.fileTo(index)) : false;
    }
    case 'N':
      return handled(a.newFolder);
    case 'c':
      return handled(a.openSwitcher);
    case 'o':
      return state.compact ? false : handled(a.openAccount);
    case ',':
    case 'b':
      return handled(a.openSettings);
    case '?':
      return handled(a.openHelp);
    case 'z':
      return state.canUndo ? handled(a.undo) : false;
    case 'Escape':
      a.clearSelection();
      return false;
    default:
      return false;
  }
}

/** ⌘F / ⌘K focus the search box from anywhere, even while typing. */
export function isSearchShortcut(e: KeyInput): boolean {
  return (e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'k');
}
