import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bm } from '@/lib/core/types';
import type { Entry } from './entries';
import { handleKey, isSearchShortcut, type KeyActions, type KeyInput, type KeyState } from './keymap';

const bookmark: Bm = {
  id: 'b1',
  parentId: 'f',
  title: 'Vite',
  url: 'https://vite.dev/',
  normUrl: 'https://vite.dev',
  dateAdded: 0,
  index: 0,
  collectionId: 'f',
  path: [],
  pathIds: ['f'],
};
const bookmarkEntry: Entry = { kind: 'bookmark', id: 'b1', bookmark };
const folderEntry: Entry = {
  kind: 'folder',
  id: 'p',
  node: {
    id: 'p',
    title: 'P',
    depth: 3,
    parentId: 'f',
    isRoot: false,
    count: 0,
    direct: 0,
    color: 'blue',
    children: [],
  },
};

const key = (k: string, mods: Partial<KeyInput> = {}): KeyInput => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  preventDefault: vi.fn(),
  ...mods,
});

let actions: { [K in keyof KeyActions]: ReturnType<typeof vi.fn> };
const run = (event: KeyInput, state: Partial<KeyState> = {}, selectionActive = false) =>
  handleKey(
    event,
    { cursor: bookmarkEntry, targets: [bookmark], compact: false, canUndo: false, hasTextSelection: false, ...state },
    actions as unknown as KeyActions,
    selectionActive,
  );

beforeEach(() => {
  actions = new Proxy(
    {},
    { get: (target: Record<string, unknown>, name: string) => (target[name] ??= vi.fn()) },
  ) as typeof actions;
});

describe('navigation', () => {
  it.each([
    ['j', 1],
    ['ArrowDown', 1],
    ['k', -1],
    ['ArrowUp', -1],
  ])('%s moves the cursor %i', (k, delta) => {
    expect(run(key(k))).toBe(true);
    expect(actions.moveCursor).toHaveBeenCalledWith(delta);
  });

  it('opens a bookmark with Enter and in the background with Shift+Enter', () => {
    run(key('Enter'));
    expect(actions.open).toHaveBeenLastCalledWith(bookmark, { background: false });
    run(key('Enter', { shiftKey: true }));
    expect(actions.open).toHaveBeenLastCalledWith(bookmark, { background: true });
  });

  it('enters a folder with Enter, l and →', () => {
    for (const k of ['Enter', 'l', 'ArrowRight']) run(key(k), { cursor: folderEntry, targets: [] });
    expect(actions.enterFolder).toHaveBeenCalledTimes(3);
  });

  it('ignores l and → on a bookmark', () => {
    expect(run(key('l'))).toBe(false);
  });

  it('goes up with h and ←', () => {
    run(key('h'));
    run(key('ArrowLeft'));
    expect(actions.goUp).toHaveBeenCalledTimes(2);
  });

  it('does nothing on Enter when the list is empty', () => {
    expect(run(key('Enter'), { cursor: undefined, targets: [] })).toBe(false);
  });
});

describe('actions on bookmarks', () => {
  it('toggles selection with x, only for bookmarks', () => {
    run(key('x'));
    expect(actions.toggleSelect).toHaveBeenCalledWith(bookmark);
    expect(run(key('x'), { cursor: folderEntry, targets: [] })).toBe(false);
  });

  it('edits with e and ⌘E', () => {
    run(key('e'));
    run(key('e', { metaKey: true }));
    expect(actions.edit).toHaveBeenCalledTimes(2);
  });

  it('moves the targets with m, but not with nothing to move', () => {
    run(key('m'));
    expect(actions.moveTargets).toHaveBeenCalled();
    expect(run(key('m'), { targets: [] })).toBe(false);
  });

  it('deletes one bookmark immediately and several after confirmation', () => {
    run(key('Backspace'));
    expect(actions.deleteNow).toHaveBeenCalledWith([bookmark]);
    run(key('Delete'), { targets: [bookmark, { ...bookmark, id: 'b2' }] });
    expect(actions.confirmDelete).toHaveBeenCalled();
  });

  it('deletes with ⌘⌫ and ⌘Delete too', () => {
    run(key('Backspace', { metaKey: true }));
    run(key('Delete', { ctrlKey: true }));
    expect(actions.deleteNow).toHaveBeenCalledTimes(2);
  });

  it('deletes a folder only when nothing is selected', () => {
    run(key('Backspace'), { cursor: folderEntry, targets: [] }, false);
    expect(actions.deleteFolder).toHaveBeenCalledWith('p');
    actions.deleteFolder.mockClear();
    run(key('Backspace'), { cursor: folderEntry, targets: [bookmark] }, true);
    expect(actions.deleteFolder).not.toHaveBeenCalled();
    expect(actions.deleteNow).toHaveBeenCalled();
  });

  it('copies the link with ⌘C, unless text is highlighted', () => {
    run(key('c', { metaKey: true }));
    expect(actions.copyLink).toHaveBeenCalledWith(bookmark);
    actions.copyLink.mockClear();
    expect(run(key('c', { metaKey: true }), { hasTextSelection: true })).toBe(false);
    expect(actions.copyLink).not.toHaveBeenCalled();
  });
});

describe('panels and dialogs', () => {
  it.each([
    ['c', 'openSwitcher'],
    ['o', 'openAccount'],
    [',', 'openSettings'],
    ['b', 'openSettings'],
    ['?', 'openHelp'],
    ['N', 'newFolder'],
    ['/', 'focusSearch'],
  ] as const)('%s calls %s', (k, action) => {
    expect(run(key(k))).toBe(true);
    expect(actions[action]).toHaveBeenCalled();
  });

  it('does not open the Folio menu in the narrow side panel', () => {
    expect(run(key('o'), { compact: true })).toBe(false);
  });
});

describe('undo and escape', () => {
  it('undoes with ⌘Z always, and with z only when a toast offers it', () => {
    run(key('z', { ctrlKey: true }));
    expect(actions.undo).toHaveBeenCalledTimes(1);
    expect(run(key('z'))).toBe(false);
    run(key('z'), { canUndo: true });
    expect(actions.undo).toHaveBeenCalledTimes(2);
  });

  it('clears the selection on Escape without swallowing the key', () => {
    expect(run(key('Escape'))).toBe(false);
    expect(actions.clearSelection).toHaveBeenCalled();
  });
});

describe('modifiers and unknown keys', () => {
  it('ignores Alt combinations and unknown keys', () => {
    expect(run(key('j', { altKey: true }))).toBe(false);
    expect(run(key('q'))).toBe(false);
  });

  it('prevents the browser default only for keys it handles', () => {
    const handled = key('j');
    const ignored = key('q');
    run(handled);
    run(ignored);
    expect(handled.preventDefault).toHaveBeenCalled();
    expect(ignored.preventDefault).not.toHaveBeenCalled();
  });
});

describe('isSearchShortcut', () => {
  it('matches ⌘F, ⌘K and Ctrl+F only', () => {
    expect(isSearchShortcut(key('f', { metaKey: true }))).toBe(true);
    expect(isSearchShortcut(key('k', { ctrlKey: true }))).toBe(true);
    expect(isSearchShortcut(key('f'))).toBe(false);
    expect(isSearchShortcut(key('g', { metaKey: true }))).toBe(false);
  });
});
