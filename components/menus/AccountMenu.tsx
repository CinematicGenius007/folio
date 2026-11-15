import { useEffect, useRef, useState } from 'react';
import type { ThemePref } from '@/lib/react';
import { Check, ChevronRight, Download, Gear, Keyboard, Palette } from '@/components/ui/icons';
import { focusFirstItem, focusItemWith, focusedItemHas, moveFocus } from './focus';
import { menuBox, menuItem } from './styles';

/** The "Folio" menu: settings, backup, theme and shortcuts. Fully keyboard operable. */
export function AccountMenu({
  themePref,
  setThemePref,
  onSettings,
  onKeys,
  onExport,
  onClose,
}: {
  themePref: ThemePref;
  setThemePref: (t: ThemePref) => void;
  onSettings: () => void;
  onKeys: () => void;
  onExport: () => void;
  onClose: () => void;
}) {
  const [themeOpen, setThemeOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => focusFirstItem(ref.current), []);
  const themes: [ThemePref, string][] = [
    ['system', 'System'],
    ['light', 'Overcast'],
    ['dark', 'Dusk'],
  ];
  return (
    <>
      <div className="fixed inset-0 z-40" onMouseDown={onClose} />
      <div
        ref={ref}
        tabIndex={0}
        role="menu"
        onKeyDown={(e) => {
          const key = e.key;
          if (key === 'Escape' || key === 'o') {
            e.preventDefault();
            onClose();
          } else if (key === 'ArrowDown' || key === 'j' || key === 'ArrowUp' || key === 'k') {
            e.preventDefault();
            moveFocus(ref.current, key === 'ArrowDown' || key === 'j' ? 1 : -1);
          } else if (key === 'ArrowRight' && !themeOpen && focusedItemHas('theme')) {
            e.preventDefault();
            setThemeOpen(true);
          } else if (key === 'ArrowLeft' && themeOpen) {
            e.preventDefault();
            setThemeOpen(false);
            focusItemWith(ref.current, 'theme');
          }
        }}
        className={`${menuBox} right-0 top-full w-[220px]`}
        style={{ boxShadow: 'var(--shadow)' }}
      >
        <button role="menuitem" onClick={onSettings} className={`${menuItem} hover:bg-hover focus:bg-hover`}>
          <Gear className="text-ink" />
          Settings
        </button>
        <button role="menuitem" onClick={onExport} className={`${menuItem} hover:bg-hover focus:bg-hover`}>
          <Download className="text-ink" />
          Back up tags and notes
        </button>
        <div className="my-1 border-t border-line" />
        <button
          role="menuitem"
          data-theme="1"
          onClick={() => setThemeOpen((v) => !v)}
          className={`${menuItem} hover:bg-hover focus:bg-hover`}
        >
          <Palette className="text-ink" />
          <span className="flex-1">Theme</span>
          <ChevronRight className={`text-muted transition-transform ${themeOpen ? 'rotate-90' : ''}`} />
        </button>
        {themeOpen &&
          themes.map(([id, label]) => (
            <button
              key={id}
              role="menuitemradio"
              aria-checked={themePref === id}
              onClick={() => setThemePref(id)}
              className={`${menuItem} pl-9 hover:bg-hover focus:bg-hover`}
            >
              <span className="flex-1">{label}</span>
              {themePref === id && <Check />}
            </button>
          ))}
        <button role="menuitem" onClick={onKeys} className={`${menuItem} hover:bg-hover focus:bg-hover`}>
          <Keyboard className="text-ink" />
          Keyboard shortcuts
        </button>
      </div>
    </>
  );
}
