import { browser } from 'wxt/browser';
import type { FolderNode } from '@/lib/core/tree';
import type { Folder } from '@/lib/core/types';
import type { ThemePref } from '@/lib/react';
import type { InboxInfo } from '@/components/folders/FolderList';
import { AccountMenu, SwitcherMenu } from '@/components/menus';
import { Kbd } from '@/components/ui';
import { Gear, Unfold } from '@/components/ui/icons';
import { Breadcrumb } from './Breadcrumb';
import { crumbTrail } from './crumbs';

/** Which top-bar dropdown is open. */
export type TopMenu = 'switcher' | 'account' | null;

const buttonClass = (open: boolean) =>
  `group flex h-8 cursor-pointer items-center gap-2 rounded-[14px] border-0 px-2 text-[14px] font-medium text-ink ${open ? 'bg-hover' : 'bg-transparent hover:bg-hover'}`;

interface TopBarProps {
  /** Folders above the current one, outermost first, shown as a clickable breadcrumb. */
  ancestors: Folder[];
  label: string;
  /** CSS colour for the folder dot; undefined draws the hollow Inbox ring. */
  dot: string | undefined;
  menu: TopMenu;
  onMenu: (menu: TopMenu) => void;
  onOpenFolder: (id: string) => void;

  tree: FolderNode[];
  folders: Folder[];
  inbox: InboxInfo | null;
  totalBookmarks: number;
  /** Bookmarks that share a URL with another; the switcher offers the Duplicates view when above 0. */
  duplicateCount: number;
  currentFilter: string;
  /** The current view is a folder that can be renamed, deleted, or added to. */
  canEditFolder: boolean;
  onNewFolder: () => void;
  onRenameFolder: () => void;
  onDeleteFolder: () => void;

  themePref: ThemePref;
  setThemePref: (pref: ThemePref) => void;
  needsBackup: boolean;
  onSettings: () => void;
  onKeys: () => void;
}

/** Logo (the extension icon) and the folder path ending in the switcher on the left; backup reminder and Folio menu on the right. */
export function TopBar(p: TopBarProps) {
  const closeMenu = () => p.onMenu(null);
  return (
    <header className="relative z-20 flex shrink-0 items-center justify-between px-6 py-3">
      <div className="flex min-w-0 items-center gap-1.5">
        <img
          src={browser.runtime.getURL('/icon/48.png')}
          alt="Folio"
          width={24}
          height={24}
          draggable={false}
          className="mr-0.5"
        />
        <span aria-hidden className="select-none text-[16px] text-faint">
          /
        </span>
        <Breadcrumb
          key={p.currentFilter}
          trail={crumbTrail(p.ancestors, p.currentFilter === 'all')}
          onOpen={p.onOpenFolder}
          current={
            <div className="relative">
              <button
                onClick={() => p.onMenu(p.menu === 'switcher' ? null : 'switcher')}
                aria-haspopup="listbox"
                aria-expanded={p.menu === 'switcher'}
                aria-current="page"
                aria-label={`${p.label}, switch folder`}
                className={buttonClass(p.menu === 'switcher')}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={p.dot ? { background: p.dot } : { boxShadow: 'inset 0 0 0 1.5px var(--muted)' }}
                />
                <span className="max-w-[220px] truncate">{p.label}</span>
                <Unfold className="shrink-0 text-muted group-hover:hidden" />
                <span className="hidden group-hover:inline-flex">
                  <Kbd>C</Kbd>
                </span>
              </button>
              {p.menu === 'switcher' && (
                <SwitcherMenu
                  tree={p.tree}
                  folders={p.folders}
                  inbox={p.inbox}
                  total={p.totalBookmarks}
                  duplicates={p.duplicateCount}
                  current={p.currentFilter}
                  canDelete={p.canEditFolder}
                  canRename={p.canEditFolder}
                  onClose={closeMenu}
                  onPick={(id) => (closeMenu(), p.onOpenFolder(id))}
                  onNew={() => (closeMenu(), p.onNewFolder())}
                  onRename={() => (closeMenu(), p.onRenameFolder())}
                  onDelete={() => (closeMenu(), p.onDeleteFolder())}
                />
              )}
            </div>
          }
        />
      </div>

      <div className="flex items-center gap-2">
        {p.needsBackup && (
          <button
            onClick={p.onSettings}
            className="h-7 cursor-pointer rounded-full border-0 bg-warn-bg px-3 text-[12px] font-medium text-warn-text"
          >
            Back up tags and notes
          </button>
        )}
        <div className="relative">
          <button
            onClick={() => p.onMenu(p.menu === 'account' ? null : 'account')}
            aria-haspopup="menu"
            aria-expanded={p.menu === 'account'}
            className={buttonClass(p.menu === 'account')}
          >
            <Gear className="text-muted" />
            <span className="pr-6">Folio</span>
            <Unfold className="text-muted group-hover:hidden" />
            <span className="hidden group-hover:inline-flex">
              <Kbd>O</Kbd>
            </span>
          </button>
          {p.menu === 'account' && (
            <AccountMenu
              themePref={p.themePref}
              setThemePref={p.setThemePref}
              onClose={closeMenu}
              onSettings={() => (closeMenu(), p.onSettings())}
              onKeys={() => (closeMenu(), p.onKeys())}
              onExport={() => (closeMenu(), p.onSettings())}
            />
          )}
        </div>
      </div>
    </header>
  );
}
