import { useEffect, useMemo, useRef, useState } from 'react';
import { addBookmark, createFolder, ensureInbox, openBookmark, renameFolder } from '@/lib/actions';
import { parseQuery, search, taggedIds } from '@/lib/core/search';
import { suggestFolders } from '@/lib/core/suggest';
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
import { DUPLICATES, type FolderFilter, bookmarkIdsIn, buildEntries, duplicateGroups, emptyMessage } from './entries';
import { KeyHints } from './KeyHints';
import { handleKey, isSearchShortcut } from './keymap';
import { FolderSelect, Omnibar } from './Omnibar';
import { Empty, FolderRow, Row, type TriageSuggestion } from './Rows';
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
  const [pickCounts] = useSetting<Record<string, number>>('folderPickCounts', {});
  const [now] = useState(() => Date.now());

  // ----- view state -----
  const [requestedFilter, setFilter] = useState<FolderFilter>('all');
  const [query, setQueryState] = useState('');
  /**
   * The keyboard cursor: a row id, and the position it was last seen at. When the row leaves the
   * list (deleted, filed, moved away) the cursor stays at that position, on the row taking its place.
   */
  const [cursorAt, setCursorAt] = useState<{ id: string | null; index: number }>({ id: null, index: 0 });
  /** Bookmark the Edit dialog is for; set before the row exists when a pasted link is saved. */
  const [editId, setEditId] = useState<string | null>(null);
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
  /** Title input of the Edit dialog to select once it opens (after saving a pasted link). */
  const selectTitleFor = useRef<string | null>(null);

  // A folder deleted elsewhere falls back to "all" without touching state.
  const isFolderView = requestedFilter !== 'all' && requestedFilter !== DUPLICATES;
  const filter: FolderFilter =
    lib.ready && isFolderView && !lib.folderById.has(requestedFilter) ? 'all' : requestedFilter;
  const isDuplicates = filter === DUPLICATES;
  const currentFolder = filter === 'all' || isDuplicates ? undefined : lib.folderById.get(filter);
  const currentNode = currentFolder ? findNode(lib.tree, filter) : undefined;
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

  const duplicateCount = useMemo(
    () => duplicateGroups(lib.bookmarks).reduce((n, group) => n + group.length, 0),
    [lib.bookmarks],
  );

  // ----- what to list -----
  /** `#tag` tokens filter exactly; the remaining words go to full-text search. */
  const parsedQuery = useMemo(() => parseQuery(query), [query]);
  const tagged = useMemo(
    () => (parsedQuery.tags.length ? taggedIds(lib.meta, parsedQuery.tags) : null),
    [lib.meta, parsedQuery],
  );
  const entries = useMemo(
    () =>
      buildEntries({
        bookmarks: lib.bookmarks,
        filter,
        subfolders: currentNode?.children ?? [],
        ranking: parsedQuery.text ? search(lib.index, parsedQuery.text) : null,
        tagged,
      }),
    [lib.bookmarks, lib.index, filter, parsedQuery, tagged, currentNode],
  );
  const bookmarks = useMemo(() => entries.flatMap((e) => (e.kind === 'bookmark' ? [e.bookmark] : [])), [entries]);
  const foundAt = entries.findIndex((e) => e.id === cursorAt.id);
  const cursor = entries[foundAt >= 0 ? foundAt : Math.min(cursorAt.index, entries.length - 1)];
  const cursorBookmark = cursor?.kind === 'bookmark' ? cursor.bookmark : undefined;
  const selectedBookmarks = bookmarks.filter((b) => selection.selected.has(b.id));
  /** What bulk actions apply to: the selection, or else the row under the cursor. */
  const targets = selectedBookmarks.length ? selectedBookmarks : cursorBookmark ? [cursorBookmark] : [];
  const editTarget = editId ? lib.bookmarks.find((b) => b.id === editId) : undefined;

  // ----- inbox triage -----
  /** In the Inbox (not searching, nothing selected) the cursor row offers folders to file it into. */
  const triageOn = isInbox && !query.trim() && selectedBookmarks.length === 0;
  const triage = useMemo((): TriageSuggestion[] => {
    if (!triageOn || !cursorBookmark) return [];
    const self = cursorBookmark;
    return suggestFolders({
      page: { title: self.title, url: self.url },
      folders: lib.folders,
      // The bookmark itself sits in the Inbox, but must not vote for anything.
      bookmarks: lib.bookmarks.filter((b) => b.id !== self.id),
      meta: lib.meta,
      pickCounts,
      excludeIds: lib.inboxId ? [lib.inboxId] : [],
    }).flatMap((s) => {
      const folder = lib.folderById.get(s.id);
      if (!folder) return [];
      const color = findNode(lib.tree, s.id)?.color ?? 'slate';
      return [{ id: s.id, title: folder.title, path: folder.path.join(' / '), color: `var(--coll-${color})` }];
    });
  }, [
    triageOn,
    cursorBookmark,
    lib.folders,
    lib.bookmarks,
    lib.meta,
    lib.inboxId,
    lib.folderById,
    lib.tree,
    pickCounts,
  ]);

  useEffect(() => {
    if (cursor)
      listRef.current?.querySelector(`[data-id="${CSS.escape(cursor.id)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  // After saving a pasted link, select the title so typing replaces the hostname.
  const editOpenFor = dialog === 'edit' ? editTarget?.id : undefined;
  useEffect(() => {
    if (!editOpenFor || selectTitleFor.current !== editOpenFor) return;
    selectTitleFor.current = null;
    document.querySelector<HTMLInputElement>('[role=dialog] input[aria-label="Title"]')?.select();
  }, [editOpenFor]);

  // ----- actions -----
  const actions = useBookmarkActions(say, selection.clear);

  /** Puts the cursor on a row, remembering its position for when the row goes away. */
  const setCursorId = (id: string | null) =>
    setCursorAt({
      id,
      index: Math.max(
        0,
        entries.findIndex((e) => e.id === id),
      ),
    });
  const setQuery = (next: string) => {
    setQueryState(next);
    setCursorAt((c) => ({ ...c, index: 0 }));
  };
  const openFolder = (id: string) => {
    setFilter(id);
    setQuery('');
    selection.clear();
    setCursorAt({ id: null, index: 0 });
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
    if (kind === 'bookmark') setEditId(id);
    setDialog(kind === 'folder' ? 'rename-folder' : 'edit');
  };
  /** Files the cursor bookmark into its `index`-th suggestion; the cursor moves to the row taking its place. */
  const fileTo = (index: number) => {
    const target = triage[index];
    const row = cursorBookmark;
    if (!target || !row) return;
    const at = entries.findIndex((e) => e.id === row.id);
    setCursorAt({ id: entries[at + 1]?.id ?? entries[at - 1]?.id ?? null, index: at });
    setCursorVisible(true);
    void actions.fileTo(row, target.id, target.title);
  };
  /** Runs the toast's undo once: the toast goes away first, so a second Z cannot repeat it. */
  const undo = () => {
    const run = toast?.undo;
    if (!run) return;
    dismiss();
    void run();
  };
  const submitOmnibar = async (background: boolean) => {
    const url = parseUrlInput(query);
    if (url) {
      const id = await addBookmark({ title: hostOf(url), url, parentId: canEditFolder ? filter : await ensureInbox() });
      setQuery('');
      say(`Saved ${hostOf(url)}`);
      // Name it in the same breath: the Edit dialog opens on the new row (once the read model has it)
      // with the hostname selected, so typing replaces it and Esc keeps it.
      setCursorVisible(true);
      setCursorAt({ id, index: 0 });
      setEditId(id);
      selectTitleFor.current = id;
      setDialog('edit');
      searchRef.current?.blur();
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
      // An Edit dialog still waiting for its new row does not block keys.
      const dialogOpen = dialog === 'edit' ? !!editTarget : !!dialog;
      if (typing || dialogOpen || menu || rowMenu) return;
      handleKey(
        e,
        {
          cursor,
          targets,
          compact,
          canUndo: !!toast?.undo,
          hasTextSelection: !!window.getSelection()?.toString(),
          triage: triage.length,
        },
        {
          focusSearch: () => searchRef.current?.focus(),
          moveCursor,
          open: (bookmark, opts) => void openBookmark(bookmark.url, opts),
          enterFolder: openFolder,
          goUp: () =>
            currentFolder
              ? openFolder(currentFolder.depth <= 2 ? 'all' : currentFolder.parentId)
              : isDuplicates && openFolder('all'),
          toggleSelect: (bookmark) => selection.toggle(bookmark.id),
          edit: (entry) => edit(entry.id, entry.kind),
          confirmDelete: () => setDialog('delete'),
          deleteFolder: (id) => (setFolderTarget(id), setDialog('delete-folder')),
          deleteNow: (rows) => void actions.deleteBookmarks(rows),
          moveTargets: () => setDialog('move'),
          fileTo,
          newFolder: () => setDialog('new-folder'),
          copyLink: (bookmark) => void actions.copyLink(bookmark),
          undo,
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
  const label = filter === 'all' ? 'All bookmarks' : isDuplicates ? 'Duplicates' : currentFolder?.title || 'Folder';
  const dot =
    filter === 'all'
      ? 'var(--ink)'
      : isDuplicates
        ? 'var(--faint)'
        : isInbox
          ? undefined
          : `var(--coll-${currentNode?.color ?? 'slate'})`;
  const empty = emptyMessage({
    tags: parsedQuery.tags,
    tagsExist: !!tagged?.size,
    text: parsedQuery.text,
    filter,
    isInbox,
  });
  const showPath = filter === 'all' || isDuplicates || !!query.trim();
  const placeholder = compact
    ? 'Search or paste link'
    : filter === 'all'
      ? 'Insert a link, or just search…'
      : `Search in ${label}, or paste a link…`;
  const close = () => setDialog(null);
  const editedMeta = editTarget ? lib.meta.get(editTarget.id) : undefined;
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
          duplicateCount={duplicateCount}
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
                duplicateCount={duplicateCount}
                onChange={openFolder}
              />
            )}
          </div>

          {!compact && (
            <div className="mb-2 flex items-center justify-between border-b border-control px-1 pb-2 text-[13px] text-muted">
              <span>Title</span>
              <span>Created At</span>
            </div>
          )}

          <div role="listbox" aria-label="Bookmarks" className={`flex flex-col gap-0.5 ${compact ? '' : '-mx-3'}`}>
            {!lib.ready && <p className="p-6 text-muted">Loading…</p>}
            {lib.ready && !entries.length && <Empty title={empty.title} hint={empty.hint} />}
            {entries.map((entry) => {
              // Triage is about the row in hand, so the Inbox shows its cursor from the start.
              const focused = (cursorVisible || triageOn) && entry.id === cursor?.id;
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
                  where={showPath ? bookmark.path.join(' / ') : ''}
                  triage={triageOn && focused ? triage : undefined}
                  onFocus={hover}
                  onTag={(tag) => setQuery(`#${tag}`)}
                  onFile={fileTo}
                  onOpen={(background) => void openBookmark(bookmark.url, { background })}
                  onToggle={() => selection.toggle(entry.id)}
                  onMenu={(x, y) => (hover(), setRowMenu({ x, y, id: entry.id }))}
                />
              );
            })}
          </div>
        </div>
      </div>

      <KeyHints selectedCount={selectedBookmarks.length} triageCount={triageOn ? triage.length : 0} compact={compact} />

      {dialog === 'edit' && editTarget && (
        <EditDialog
          key={editTarget.id}
          b={editTarget}
          tags={editedMeta?.tags ?? []}
          note={editedMeta?.note ?? ''}
          onClose={close}
        />
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

      {toast && <Toast message={toast.message} action={toast.undo ? 'Undo' : undefined} onAction={undo} />}
    </div>
  );
}
