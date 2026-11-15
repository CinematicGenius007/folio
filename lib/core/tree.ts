import { colorFor, type ColorName } from '@/lib/favicon/palette';
import type { Bm, Folder } from './types';

export interface FolderNode {
  id: string;
  title: string;
  depth: number; // 2 = collection, 3+ = nested. Depth 1 (browser roots) only appears when they hold loose bookmarks.
  parentId: string;
  isRoot: boolean;
  /** bookmarks anywhere beneath this folder */
  count: number;
  /** bookmarks directly in this folder */
  direct: number;
  color: ColorName;
  children: FolderNode[];
}

/**
 * Folder tree for navigation. Top level = collections (depth-2 folders, except the Inbox).
 * Browser roots (Bookmarks bar, Other bookmarks...) are hidden unless they hold loose bookmarks.
 */
export function buildTree(folders: Folder[], bookmarks: Bm[], inboxId: string | null): FolderNode[] {
  const subtree = new Map<string, number>();
  const direct = new Map<string, number>();
  for (const b of bookmarks) {
    direct.set(b.parentId, (direct.get(b.parentId) ?? 0) + 1);
    for (const id of b.pathIds ?? []) subtree.set(id, (subtree.get(id) ?? 0) + 1);
  }

  const byParent = new Map<string, Folder[]>();
  for (const f of folders) {
    const list = byParent.get(f.parentId) ?? [];
    list.push(f);
    byParent.set(f.parentId, list);
  }
  const make = (f: Folder): FolderNode => ({
    id: f.id,
    title: f.title || 'Untitled',
    depth: f.depth,
    parentId: f.parentId,
    isRoot: f.depth === 1,
    count: f.depth === 1 ? (direct.get(f.id) ?? 0) : (subtree.get(f.id) ?? 0),
    direct: direct.get(f.id) ?? 0,
    color:
      f.depth === 1
        ? 'slate'
        : colorFor(f.pathIds.length ? (folders.find((x) => x.id === f.pathIds[0])?.title ?? f.title) : f.title),
    children: (byParent.get(f.id) ?? []).sort((a, b) => a.index - b.index).map(make),
  });

  const out: FolderNode[] = [];
  for (const root of folders.filter((f) => f.depth === 1).sort((a, b) => a.index - b.index)) {
    if ((direct.get(root.id) ?? 0) > 0) {
      out.push({ ...make(root), children: [] });
    }
    for (const child of (byParent.get(root.id) ?? []).sort((a, b) => a.index - b.index)) {
      if (child.id === inboxId) continue;
      out.push(make(child));
    }
  }
  return out;
}

export function findNode(nodes: FolderNode[], id: string): FolderNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    const hit = findNode(n.children, id);
    if (hit) return hit;
  }
}

/** Ancestors from the collection down to (but excluding) the folder itself. */
export function ancestorsOf(folderById: Map<string, Folder>, id: string): Folder[] {
  const f = folderById.get(id);
  if (!f) return [];
  return f.pathIds
    .slice(0, -1)
    .map((x) => folderById.get(x))
    .filter((x): x is Folder => !!x);
}

export interface PickerRow {
  id: string;
  title: string;
  depth: number; // indent level, 0 = top
  count: number;
  color: ColorName | 'inbox';
  hasChildren: boolean;
  expanded: boolean;
  /** shown under filtered results so deep folders are recognizable */
  pathLabel?: string;
}

/** Rows for a folder picker: tree view normally, flat path-labelled matches while filtering. */
export function pickerRows(opts: {
  tree: FolderNode[];
  folders: Folder[];
  inbox: { id: string; title: string; count: number } | null;
  expanded: Set<string>;
  query: string;
}): PickerRow[] {
  const { tree, folders, inbox, expanded } = opts;
  const q = opts.query.trim().toLowerCase();
  const rows: PickerRow[] = [];
  if (!q) {
    if (inbox)
      rows.push({
        id: inbox.id,
        title: inbox.title,
        depth: 0,
        count: inbox.count,
        color: 'inbox',
        hasChildren: false,
        expanded: false,
      });
    const walk = (nodes: FolderNode[], depth: number) => {
      for (const n of nodes) {
        const open = expanded.has(n.id);
        rows.push({
          id: n.id,
          title: n.title,
          depth,
          count: n.count,
          color: n.color,
          hasChildren: n.children.length > 0,
          expanded: open,
        });
        if (open) walk(n.children, depth + 1);
      }
    };
    walk(tree, 0);
    return rows;
  }
  const tokens = q.split(/\s+/);
  const nodes = new Map<string, FolderNode>();
  const index = (ns: FolderNode[]) => ns.forEach((n) => (nodes.set(n.id, n), index(n.children)));
  index(tree);
  for (const f of folders) {
    if (f.depth < 2) continue;
    const label = f.path.join(' / ');
    if (!tokens.every((t) => label.toLowerCase().includes(t))) continue;
    const n = nodes.get(f.id);
    const isInbox = inbox?.id === f.id;
    rows.push({
      id: f.id,
      title: f.title,
      depth: 0,
      count: isInbox ? inbox!.count : (n?.count ?? 0),
      color: isInbox ? 'inbox' : (n?.color ?? 'slate'),
      hasChildren: false,
      expanded: false,
      pathLabel: f.path.length > 1 ? f.path.slice(0, -1).join(' / ') : undefined,
    });
  }
  // best matches first: exact title, then shallower, then alphabetical
  return rows.sort((a, b) => {
    const ae = a.title.toLowerCase() === q ? 0 : 1;
    const be = b.title.toLowerCase() === q ? 0 : 1;
    return ae - be || (a.pathLabel ? 1 : 0) - (b.pathLabel ? 1 : 0) || a.title.localeCompare(b.title);
  });
}
