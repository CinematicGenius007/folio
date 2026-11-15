/** Items inside a menu that arrow keys move between (`menuitem`, `menuitemradio`...). */
function menuItems(menu: HTMLElement | null): HTMLElement[] {
  return [...(menu?.querySelectorAll<HTMLElement>('[role^=menuitem]') ?? [])];
}

/** Focuses the first item, so a menu opened from the keyboard is immediately usable. */
export function focusFirstItem(menu: HTMLElement | null): void {
  menuItems(menu)[0]?.focus();
}

/** Moves focus to the next (`1`) or previous (`-1`) item, stopping at the ends. */
export function moveFocus(menu: HTMLElement | null, delta: 1 | -1): void {
  const items = menuItems(menu);
  const at = items.indexOf(document.activeElement as HTMLElement);
  items[Math.max(0, Math.min(items.length - 1, at + delta))]?.focus();
}

/** Returns focus to the first item carrying `data-<name>` (used when a submenu closes). */
export function focusItemWith(menu: HTMLElement | null, name: string): void {
  menuItems(menu)
    .find((el) => name in el.dataset)
    ?.focus();
}

/** True when the focused item has `data-<name>`, i.e. it owns a submenu. */
export function focusedItemHas(name: string): boolean {
  return name in ((document.activeElement as HTMLElement | null)?.dataset ?? {});
}
