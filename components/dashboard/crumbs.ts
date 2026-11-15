/**
 * Pure logic for the folder breadcrumb in the dashboard top bar. The breadcrumb starts at
 * "All bookmarks" (the top level, which `H` returns to from a collection), lists the folders above
 * the current one, and ends with the current folder. Long paths hide their middle behind an ellipsis.
 */

/** One folder in the path, as the breadcrumb shows it. */
export interface Crumb {
  /** Folder id, or `'all'` for the top level. */
  id: string;
  title: string;
}

/** What the breadcrumb renders, left to right. The current folder is not included; the switcher shows it. */
export type CrumbItem = { kind: 'link'; crumb: Crumb } | { kind: 'more'; hidden: Crumb[] };

/** The top level of the dashboard, always the first crumb when a folder is open. */
export const ALL_CRUMB: Crumb = { id: 'all', title: 'All bookmarks' };

/**
 * The links in front of the current folder: "All bookmarks" then each ancestor, outermost first.
 * Empty when the current view is already the top level.
 */
export function crumbTrail(ancestors: { id: string; title: string }[], atTop: boolean): Crumb[] {
  if (atTop) return [];
  return [ALL_CRUMB, ...ancestors.map((a) => ({ id: a.id, title: a.title || 'Untitled' }))];
}

/**
 * Collapses a long trail so the top bar stays one short line. The first crumb (the root) and the
 * last `keepEnd - 1` links stay visible next to the current folder; the rest go behind one
 * ellipsis. Trails that fit (`root + keepEnd` items in total, counting the current folder) are left whole.
 */
export function collapseTrail(trail: Crumb[], keepEnd = 2): CrumbItem[] {
  const tail = Math.max(0, keepEnd - 1);
  if (trail.length <= 1 + tail + 1) return trail.map((crumb) => ({ kind: 'link', crumb }));
  const hidden = trail.slice(1, trail.length - tail);
  return [
    { kind: 'link', crumb: trail[0]! },
    { kind: 'more', hidden },
    ...trail.slice(trail.length - tail).map((crumb): CrumbItem => ({ kind: 'link', crumb })),
  ];
}
