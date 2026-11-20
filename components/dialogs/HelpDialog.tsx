import { Fragment } from 'react';
import { Dialog, Glyphs } from '@/components/ui';

/** Every shortcut, as `[keys, what it does]`. Keep in sync with the key handler in the dashboard. */
const KEYS: [string, string][] = [
  ['J / K, ↓ / ↑', 'Move through the list'],
  ['↵ / ⌘↵ / ⇧↵', 'Open / open / open in background'],
  ['⌘F, ⌘K, /', 'Search or paste a link'],
  ['→ / L', 'Open the highlighted folder'],
  ['← / H', 'Up one folder'],
  ['C', 'Folder switcher (type to find any depth)'],
  ['O', 'Folio menu (theme, shortcuts, backup)'],
  ['Right-click', 'Row menu'],
  ['⌘C', 'Copy link'],
  ['⌘E / E', 'Edit (rename a folder)'],
  ['M', 'Move to a folder (undo with Z)'],
  ['1 – 3', 'In the Inbox: file into a suggested folder'],
  ['#tag', 'In search: only bookmarks with that tag'],
  ['X', 'Select / deselect'],
  ['⌫ / Del / ⌘⌫', 'Delete (undo with Z)'],
  ['⇧N', 'New folder here'],
  ['B', 'Background settings'],
  ['Esc', 'Clear / close'],
  ['Alt+S', 'Save current page (popup)'],
  ['Alt+Shift+F', 'Open dashboard'],
  ['Alt+Shift+B', 'Toggle sidebar'],
];

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Keyboard shortcuts" onClose={onClose} width={480}>
      <div className="grid grid-cols-[150px_1fr] gap-x-4 gap-y-2 text-[13px]">
        {KEYS.map(([k, d]) => (
          <Fragment key={k}>
            <span className="flex items-center gap-0.5 font-mono text-[12px] text-ink">
              <Glyphs text={k} />
            </span>
            <span className="text-ink-soft">{d}</span>
          </Fragment>
        ))}
      </div>
      <p className="mb-0 mt-4 text-[12px] text-muted">
        Global shortcuts can be changed at chrome://extensions/shortcuts (Firefox/Zen: about:addons → ⚙ → Manage
        Extension Shortcuts).
      </p>
    </Dialog>
  );
}
