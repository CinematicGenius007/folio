import { useEffect, useMemo, useRef, useState } from 'react';
import { addBookmark, createFolder, ensureInbox, openBookmark, renameFolder } from '@/lib/actions';
import { search } from '@/lib/core/search';
import { ancestorsOf, findNode } from '@/lib/core/tree';
import { hasBrowserFavicons } from '@/lib/favicon';
import { useBackground, useLibrary, useSetting, useTheme } from '@/lib/react';
import { hostOf, parseUrlInput } from '@/lib/util/url';
import { Backdrop } from '@/components/backdrop/Backdrop';
import {
  DeleteBookmarksDialog,
  DeleteFolderDialog,
  EditDialog,
  FolderNameDialog,
  HelpDialog,
  MoveDialog,
  SettingsDialog,
} from '@/components/dialogs';
import { RowMenu } from '@/components/menus';
import { Toast } from '@/components/ui';
import { type FolderFilter, bookmarkIdsIn, buildEntries } from './entries';
import { KeyHints } from './KeyHints';
import { handleKey, isSearchShortcut } from './keymap';
import { FolderSelect, Omnibar } from './Omnibar';
import { Empty, FolderRow, Row } from './Rows';
import { type TopMenu, TopBar } from './TopBar';
import { useBookmarkActions } from './useBookmarkActions';
import { useSelection } from './useSelection';
import { useToast } from './useToast';

type DialogName = 'edit' | 'move' | 'delete' | 'help' | 'settings' | 'new-folder' | 'rename-folder' | 'delete-folder';

/** Remind to back up tags and notes after this long without a backup. */
const BACKUP_NAG_MS = 30 * 24 * 3600 * 1000;

/**
 * The bookmark browser, shared by the full-page dashboard and the narrow side panel (`compact`).
 *
 * This component owns the view state (folder, query, cursor, selection, open menus) and wires the
 * pure pieces together: `buildEntries` decides what to list, `handleKey` interprets keys,
 * `useBookmarkActions` performs changes. Reads come from `useLibrary`; writes go to the browser.
 */
export function Dashboard({ compact = false }: { compact?: boolean }) {
  const lib = useLibrary();
  const [themePref, setThemePref] = useTheme();
  const background = useBackground();
  const [lastBackup] = useSetting<number>('lastBackupAt', 0);
  const [now] = useState(() => Date.now());

  // ----- view state -----
  const [requestedFilter, setFilter] = useState<FolderFilter>('all');
  const [query, setQuery] = useState('');
  const [cursorId, setCursorId] = useState<string | null>(null);
  /** The highlight shows after the first hover or key press, like a plain list. */
  const [cursorVisible, setCursorVisible] = useState(false);
  const selection = useSelection();
  const [menu, setMenu] = useState<TopMenu>(null);
  const [rowMenu, setRowMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const [dialog, setDialog] = useState<DialogName | null>(null);
  /** Folder that rename / delete dialogs act on. */
  const [folderTarget, setFolderTarget] = useState<string | null>(null);
  const { toast, say, dismiss } = useToast();

  const searchRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // A folder deleted elsewhere falls back to "all" without touching state.
  const filter: FolderFilter =
    lib.ready && requestedFilter !== 'all' && !lib.folderById.has(requestedFilter) ? 'all' : requestedFilter;
  const currentFolder = filter === 'all' ? undefined : lib.folderById.get(filter);
  const currentNode = filter === 'all' ? undefined : findNode(lib.tree, filter);
  const isInbox = filter === lib.inboxId;
  /** A real folder: can be renamed, deleted, and have folders added inside. */
  const canEditFolder = !!currentFolder && currentFolder.depth >= 2 && !isInbox;
  const ancestors = useMemo(() => ancestorsOf(lib.folderById, filter), [lib.folderById, filter]);
  const inbox = useMemo(
    () =>
      lib.inboxId
        ? { id: lib.inboxId, title: 'Inbox', count: lib.bookmarks.filter((b) => b.parentId === lib.inboxId).length }
        : null,
    [lib.inboxId, lib.bookmarks],
  );

  // ----- what to list -----
  const entries = useMemo(
    () =>
      buildEntries({
        bookmarks: lib.bookmarks,
        filter,
        subfolders: currentNode?.children ?? [],
        ranking: query.trim() ? search(lib.index, query) : null,
      }),
    [lib.bookmarks, lib.index, filter, query, currentNode],
  );
  const bookmarks = useMemo(() => entries.flatMap((e) => (e.kind === 'bookmark' ? [e.bookmark] : [])), [entries]);
  const cursor = entries.find((e) => e.id === cursorId) ?? entries[0];
  const cursorBookmark = cursor?.kind === 'bookmark' ? cursor.bookmark : undefined;
  const selectedBookmarks = bookmarks.filter((b) => selection.selected.has(b.id));
  /** What bulk actions apply to: the selection, or else the row under the cursor. */
  const targets = selectedBookmarks.length ? selectedBookmarks : cursorBookmark ? [cursorBookmark] : [];

  useEffect(() => {
    if (cursor)
      listRef.current?.querySelector(`[data-id="${CSS.escape(cursor.id)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  // ----- actions -----
  const actions = useBookmarkActions(say, selection.clear);

  const openFolder = (id: string) => {
    setFilter(id);
    setQuery('');
    selection.clear();
    setCursorId(null);
  };
  const moveCursor = (delta: number) => {
    if (!entries.length) return;
    const index = Math.max(
      0,
      entries.findIndex((e) => e.id === cursor?.id),
    );
    setCursorVisible(true);
    setCursorId(entries[Math.min(entries.length - 1, Math.max(0, index + delta))]!.id);
  };
  const edit = (id: string, kind: 'bookmark' | 'folder') => {
    setCursorId(id);
    setFolderTarget(kind === 'folder' ? id : null);
    setDialog(kind === 'folder' ? 'rename-folder' : 'edit');
  };
  const submitOmnibar = async (background: boolean) => {
    const url = parseUrlInput(query);
    if (url) {
      await addBookmark({ title: hostOf(url), url, parentId: canEditFolder ? filter : await ensureInbox() });
      setQuery('');
      say(`Saved ${hostOf(url)}`);
    } else if (cursor?.kind === 'folder') openFolder(cursor.id);
    else if (cursorBookmark) await openBookmark(cursorBookmark.url, { background });
  };
  const confirmDeleteFolder = async () => {
    const id = folderTarget!;
    const ids = bookmarkIdsIn(lib.bookmarks, id);
    const inside = filter === id || !!lib.folderById.get(filter)?.pathIds.includes(id);
    setDialog(null);
    if (inside) setFilter('all');
    await actions.deleteFolder(id, lib.folderById.get(id)?.title ?? 'folder', ids);
  };

  // ----- keyboard -----
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isSearchShortcut(e)) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      const typing = (e.target as HTMLElement).closest('input,textarea,[role=dialog],[role=menu]');
      if (typing || dialog || menu || rowMenu) return;
      handleKey(
        e,
        {
          cursor,
          targets,
          compact,
          canUndo: !!toast?.undo?.length,
          hasTextSelection: !!window.getSelection()?.toString(),
        },
        {
          focusSearch: () => searchRef.current?.focus(),
          moveCursor,
          open: (bookmark, opts) => void openBookmark(bookmark.url, opts),
          enterFolder: openFolder,
          goUp: () => currentFolder && openFolder(currentFolder.depth <= 2 ? 'all' : currentFolder.parentId),
          toggleSelect: (bookmark) => selection.toggle(bookmark.id),
          edit: (entry) => edit(entry.id, entry.kind),
          confirmDelete: () => setDialog('delete'),
          deleteFolder: (id) => (setFolderTarget(id), setDialog('delete-folder')),
          deleteNow: (rows) => void actions.deleteBookmarks(rows),
          moveTargets: () => setDialog('move'),
          newFolder: () => setDialog('new-folder'),
          copyLink: (bookmark) => void actions.copyLink(bookmark),
          undo: () => toast?.undo && void actions.undo(toast.undo),
          clearSelection: () => (selection.clear(), dismiss()),
          openSwitcher: () =>
            compact ? (selectRef.current?.focus(), selectRef.current?.showPicker?.()) : setMenu('switcher'),
          openAccount: () => setMenu('account'),
          openSettings: () => setDialog('settings'),
          openHelp: () => setDialog('help'),
        },
        selectedBookmarks.length > 0,
      );
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // ----- rendering -----
  const label = filter === 'all' ? 'All bookmarks' : currentFolder?.title || 'Folder';
  const dot = filter === 'all' ? 'var(--ink)' : isInbox ? undefined : `var(--coll-${currentNode?.color ?? 'slate'})`;
  const placeholder = compact
    ? 'Search or paste link'
    : filter === 'all'
      ? 'Insert a link, or just search…'
      : `Search in ${label}, or paste a link…`;
  const close = () => setDialog(null);
  const editedMeta = cursorBookmark ? lib.meta.get(cursorBookmark.id) : undefined;
  const topFolders = [
    ...(inbox ? [{ id: inbox.id, title: inbox.title }] : []),
    ...lib.tree.filter((n) => !n.isRoot).map((n) => ({ id: n.id, title: n.title })),
  ];
  const rowMenuBookmark = rowMenu && bookmarks.find((b) => b.id === rowMenu.id);
  const rowMenuGroup = rowMenuBookmark
    ? selection.selected.has(rowMenuBookmark.id) && selectedBookmarks.length > 1
      ? selectedBookmarks
      : [rowMenuBookmark]
    : [];

  return (
    <div className="relative flex h-full flex-col text-ink">
      <Backdrop
        style={compact ? 'none' : background.style}
        intensity={background.intensity}
        imageUrl={background.imageUrl}
      />

      {!compact && (
        <TopBar
          ancestors={ancestors}
          label={label}
          dot={dot}
          menu={menu}
          onMenu={setMenu}
          onOpenFolder={openFolder}
          tree={lib.tree}
          folders={lib.folders}
          inbox={inbox}
          totalBookmarks={lib.bookmarks.length}
          currentFilter={filter}
          canEditFolder={canEditFolder}
          onNewFolder={() => setDialog('new-folder')}
          onRenameFolder={() => (setFolderTarget(filter), setDialog('rename-folder'))}
          onDeleteFolder={() => (setFolderTarget(filter), setDialog('delete-folder'))}
          themePref={themePref}
          setThemePref={setThemePref}
          needsBackup={lib.meta.size > 0 && now - lastBackup > BACKUP_NAG_MS}
          onSettings={() => setDialog('settings')}
          onKeys={() => setDialog('help')}
        />
      )}

      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto" ref={listRef}>
        <div className={compact ? 'px-3 pb-4 pt-3' : 'mx-auto w-full max-w-[672px] px-5 pb-20 pt-20'}>
          <div className={`flex items-center gap-2 ${compact ? '' : 'mb-8'}`}>
            <Omnibar
              inputRef={searchRef}
              value={query}
              placeholder={placeholder}
              compact={compact}
              onChange={setQuery}
              onSubmit={(background) => void submitOmnibar(background)}
              onMove={moveCursor}
              onEscape={() => (setQuery(''), searchRef.current?.blur())}
            />
            {compact && (
              <FolderSelect
                selectRef={selectRef}
                value={filter}
                folders={lib.folders}
                inboxId={lib.inboxId}
                onChange={openFolder}
              />
            )}
          </div>

          {!compact && (
            <div className="mb-2 flex items-center justify-between border-b border-control px-1 pb-2 text-[13px] text-muted">
              <span>Title</span>
            </div>
          )}

          <div role="listbox" aria-label="Bookmarks" className={`flex flex-col gap-0.5 ${compact ? '' : '-mx-3'}`}>
            {!lib.ready && <p className="p-6 text-muted">Loading…</p>}
            {lib.ready && !entries.length && <Empty hasQuery={!!query.trim()} inFolder={filter !== 'all'} />}
            {entries.map((entry) => {
              const focused = cursorVisible && entry.id === cursor?.id;
              const hover = () => (setCursorVisible(true), setCursorId(entry.id));
              if (entry.kind === 'folder') {
                return (
                  <FolderRow
                    key={entry.id}
                    node={entry.node}
                    compact={compact}
                    focused={focused}
                    onFocus={hover}
                    onOpen={() => openFolder(entry.id)}
                  />
                );
              }
              const { bookmark } = entry;
              return (
                <Row
                  key={entry.id}
                  b={bookmark}
                  compact={compact}
                  focused={focused}
                  selected={selection.selected.has(entry.id)}
                  tags={lib.meta.get(entry.id)?.tags ?? []}
                  where={filter === 'all' || query.trim() ? bookmark.path.join(' / ') : ''}
                  onFocus={hover}
                  onOpen={(background) => void openBookmark(bookmark.url, { background })}
                  onToggle={() => selection.toggle(entry.id)}
                  onMenu={(x, y) => (hover(), setRowMenu({ x, y, id: entry.id }))}
                />
              );
            })}
          </div>
        </div>
      </div>

      <KeyHints selectedCount={selectedBookmarks.length} compact={compact} />

      {dialog === 'edit' && cursorBookmark && (
        <EditDialog b={cursorBookmark} tags={editedMeta?.tags ?? []} note={editedMeta?.note ?? ''} onClose={close} />
      )}
      {dialog === 'move' && (
        <MoveDialog
          tree={lib.tree}
          folders={lib.folders}
          inbox={inbox}
          count={targets.length}
          onClose={close}
          onPick={(id) => (close(), void actions.moveTo(targets, id, lib.folderById.get(id)?.title ?? 'folder'))}
        />
      )}
      {dialog === 'delete' && (
        <DeleteBookmarksDialog
          rows={targets}
          onCancel={close}
          onConfirm={() => (close(), void actions.deleteBookmarks(targets))}
        />
      )}
      {dialog === 'new-folder' && (
        <FolderNameDialog
          title={canEditFolder ? `New folder in ${label}` : 'New collection'}
          submit="Create"
          onClose={close}
          onSubmit={async (name) => {
            const id = await createFolder(name, canEditFolder ? filter : undefined);
            close();
            openFolder(id);
            say(`Created “${name}”`);
          }}
        />
      )}
      {dialog === 'rename-folder' && folderTarget && (
        <FolderNameDialog
          title="Rename folder"
          submit="Rename"
          initial={lib.folderById.get(folderTarget)?.title ?? ''}
          onClose={close}
          onSubmit={async (name) => (await renameFolder(folderTarget, name), close())}
        />
      )}
      {dialog === 'delete-folder' && folderTarget && lib.folderById.get(folderTarget) && (
        <DeleteFolderDialog
          title={lib.folderById.get(folderTarget)!.title}
          bookmarkCount={bookmarkIdsIn(lib.bookmarks, folderTarget).length}
          onCancel={close}
          onConfirm={() => void confirmDeleteFolder()}
        />
      )}
      {dialog === 'help' && <HelpDialog onClose={close} />}
      {dialog === 'settings' && (
        <SettingsDialog
          themePref={themePref}
          setThemePref={setThemePref}
          background={background}
          onClose={close}
          say={say}
        />
      )}

      {rowMenu && rowMenuBookmark && (
        <RowMenu
          x={rowMenu.x}
          y={rowMenu.y}
          count={rowMenuGroup.length}
          canRefresh={!hasBrowserFavicons()}
          folders={topFolders}
          inboxId={lib.inboxId}
          onClose={() => setRowMenu(null)}
          onCopy={() => (setRowMenu(null), void actions.copyLink(rowMenuBookmark))}
          onEdit={() => (setRowMenu(null), edit(rowMenuBookmark.id, 'bookmark'))}
          onDelete={() => (
            setRowMenu(null),
            rowMenuGroup.length > 1 ? setDialog('delete') : void actions.deleteBookmarks(rowMenuGroup)
          )}
          onRefresh={() => (setRowMenu(null), void actions.refreshIcon(rowMenuBookmark))}
          onMove={(id) => (
            setRowMenu(null),
            void actions.moveTo(rowMenuGroup, id, lib.folderById.get(id)?.title ?? 'folder')
          )}
          onChooseFolder={() => (
            setRowMenu(null),
            setCursorId(rowMenuBookmark.id),
            selection.only(rowMenuBookmark.id),
            setDialog('move')
          )}
          onSelect={() => (setRowMenu(null), selection.add(rowMenuBookmark.id))}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          action={toast.undo?.length ? 'Undo' : undefined}
          onAction={() => toast.undo && void actions.undo(toast.undo)}
        />
      )}
    </div>
  );
}
