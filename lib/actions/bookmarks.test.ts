import { beforeEach, describe, expect, it, vi } from 'vitest';

/** A tiny in-memory stand-in for `browser.bookmarks`, enough to exercise the command layer. */
const native = vi.hoisted(() => {
  interface Node {
    id: string;
    parentId?: string;
    title: string;
    url?: string;
    index?: number;
    children?: Node[];
  }
  const state = { next: 100, nodes: new Map<string, Node>(), tabs: [] as { url: string; active: boolean }[] };

  const reset = () => {
    state.nodes.clear();
    state.tabs = [];
    state.nodes.set('0', { id: '0', title: '', children: [] });
    for (const [id, title] of [
      ['1', 'Bookmarks bar'],
      ['2', 'Other bookmarks'],
    ] as const) {
      state.nodes.set(id, { id, parentId: '0', title, children: [] });
      state.nodes.get('0')!.children!.push(state.nodes.get(id)!);
    }
  };
  const tree = (id: string): Node => ({
    ...state.nodes.get(id)!,
    children: state.nodes.get(id)!.children?.map((c) => tree(c.id)),
  });

  const bookmarks = {
    get: async (id: string) => {
      const n = state.nodes.get(id);
      if (!n) throw new Error('not found');
      return [n];
    },
    getTree: async () => [tree('0')],
    create: async (o: { parentId: string; title: string; url?: string; index?: number }) => {
      const node: Node = {
        id: String(state.next++),
        parentId: o.parentId,
        title: o.title,
        url: o.url,
        children: o.url ? undefined : [],
      };
      state.nodes.set(node.id, node);
      state.nodes.get(o.parentId)!.children!.push(node);
      return node;
    },
    update: async (id: string, patch: Partial<Node>) => Object.assign(state.nodes.get(id)!, patch),
    move: async (id: string, { parentId }: { parentId: string }) => {
      const node = state.nodes.get(id)!;
      const old = state.nodes.get(node.parentId!)!;
      old.children = old.children!.filter((c) => c.id !== id);
      node.parentId = parentId;
      state.nodes.get(parentId)!.children!.push(node);
    },
    remove: async (id: string) => {
      const node = state.nodes.get(id)!;
      const parent = state.nodes.get(node.parentId!)!;
      parent.children = parent.children!.filter((c) => c.id !== id);
      state.nodes.delete(id);
    },
    removeTree: async (id: string) => bookmarks.remove(id),
  };
  const tabs = {
    create: async (o: { url: string; active?: boolean }) => state.tabs.push({ url: o.url, active: o.active !== false }),
  };
  const runtime = { getURL: (p: string) => `chrome-extension://folio${p}` };
  reset();
  return { state, reset, browser: { bookmarks, tabs, runtime } };
});

vi.mock('wxt/browser', () => ({ browser: native.browser }));

import { db, getSetting } from '@/lib/core/db';
import type { Tombstone } from '@/lib/core/types';
import {
  UNSAFE_URL_MESSAGE,
  addBookmark,
  createFolder,
  ensureInbox,
  openBookmark,
  openDashboard,
  restoreTombstones,
  updateBookmark,
} from './bookmarks';

beforeEach(async () => {
  native.reset();
  await Promise.all([db.meta.clear(), db.settings.clear(), db.tombstones.clear()]);
});

describe('ensureInbox', () => {
  it('creates an Inbox under Other bookmarks and remembers it', async () => {
    const id = await ensureInbox();
    expect(native.state.nodes.get(id)).toMatchObject({ title: 'Inbox', parentId: '2' });
    expect(await getSetting('inboxId', null)).toBe(id);
  });

  it('reuses the same folder on later calls', async () => {
    expect(await ensureInbox()).toBe(await ensureInbox());
    expect(native.state.nodes.get('2')!.children).toHaveLength(1);
  });

  it('adopts an existing folder named Inbox instead of creating a second one', async () => {
    const existing = await native.browser.bookmarks.create({ parentId: '2', title: 'Inbox' });
    expect(await ensureInbox()).toBe(existing.id);
  });

  it('recovers when the remembered folder was deleted', async () => {
    const first = await ensureInbox();
    await native.browser.bookmarks.remove(first);
    const second = await ensureInbox();
    expect(second).not.toBe(first);
    expect(native.state.nodes.has(second)).toBe(true);
  });
});

describe('addBookmark', () => {
  it('creates a native bookmark, stores tags and notes, and remembers the folder', async () => {
    const folder = await createFolder('Dev');
    const id = await addBookmark({
      title: 'Vite',
      url: 'https://vite.dev/',
      parentId: folder,
      tags: ['build'],
      note: 'fast',
    });
    expect(native.state.nodes.get(id)).toMatchObject({ title: 'Vite', url: 'https://vite.dev/', parentId: folder });
    expect(await db.meta.get(id)).toMatchObject({ tags: ['build'], note: 'fast' });
    expect(await getSetting('lastCollectionId', null)).toBe(folder);
    expect(await getSetting<Record<string, number>>('folderPickCounts', {})).toEqual({ [folder]: 1 });
  });

  it('writes no metadata row when there are no tags or note', async () => {
    const id = await addBookmark({ title: 'A', url: 'https://a.dev/', parentId: await ensureInbox() });
    expect(await db.meta.get(id)).toBeUndefined();
  });

  it('increments folder pick counts on each save', async () => {
    const folder = await createFolder('Picks');
    await addBookmark({ title: 'A', url: 'https://a.dev/', parentId: folder });
    await addBookmark({ title: 'B', url: 'https://b.dev/', parentId: folder });
    expect(await getSetting<Record<string, number>>('folderPickCounts', {})).toEqual({ [folder]: 2 });
  });

  it('keeps pick counts correct when two saves race', async () => {
    const folder = await createFolder('Race');
    await Promise.all([
      addBookmark({ title: 'A', url: 'https://race-a.dev/', parentId: folder }),
      addBookmark({ title: 'B', url: 'https://race-b.dev/', parentId: folder }),
      addBookmark({ title: 'C', url: 'https://race-c.dev/', parentId: folder }),
    ]);
    expect(await getSetting<Record<string, number>>('folderPickCounts', {})).toEqual({ [folder]: 3 });
  });
});

describe('unsafe URLs', () => {
  it.each([
    'javascript:alert(1)',
    ' javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,hi',
    'file:///etc/passwd',
    'vbscript:x',
    'chrome://settings',
    'not a url',
  ])('addBookmark and updateBookmark reject %s', async (url) => {
    const parentId = await ensureInbox();
    await expect(addBookmark({ title: 'x', url, parentId })).rejects.toThrow(UNSAFE_URL_MESSAGE);
    const id = await addBookmark({ title: 'ok', url: 'https://ok.dev/', parentId });
    await expect(updateBookmark(id, { url })).rejects.toThrow(UNSAFE_URL_MESSAGE);
    expect(native.state.nodes.get(id)).toMatchObject({ url: 'https://ok.dev/' });
  });

  it('lets a title change through without touching the URL', async () => {
    const id = await addBookmark({ title: 'old', url: 'https://ok.dev/', parentId: await ensureInbox() });
    await updateBookmark(id, { title: 'new' });
    expect(native.state.nodes.get(id)).toMatchObject({ title: 'new', url: 'https://ok.dev/' });
  });
});

describe('createFolder', () => {
  it('puts a top-level folder next to the Inbox', async () => {
    const id = await createFolder('Reading');
    expect(native.state.nodes.get(id)).toMatchObject({ title: 'Reading', parentId: '2' });
  });

  it('nests a folder under the given parent', async () => {
    const parent = await createFolder('Courses');
    const child = await createFolder('Physics', parent);
    expect(native.state.nodes.get(child)).toMatchObject({ parentId: parent });
  });
});

describe('restoreTombstones', () => {
  const stone = (parentId: string, withMeta = true): Tombstone => ({
    id: 'gone',
    bm: {
      id: 'gone',
      parentId,
      title: 'Back',
      url: 'https://back.dev/',
      normUrl: 'https://back.dev',
      dateAdded: 0,
      index: 0,
      collectionId: parentId,
      path: [],
      pathIds: [],
    },
    meta: withMeta ? { id: 'gone', tags: ['t'], note: 'n', updatedAt: 1 } : undefined,
    parentTitle: '',
    deletedAt: 1,
  });

  it('puts the bookmark back in its old folder with its tags and note', async () => {
    const folder = await createFolder('Old');
    await db.tombstones.put(stone(folder));
    await restoreTombstones([stone(folder)]);
    const restored = [...native.state.nodes.values()].find((n) => n.title === 'Back')!;
    expect(restored.parentId).toBe(folder);
    expect(await db.meta.get(restored.id)).toMatchObject({ tags: ['t'], note: 'n' });
    expect(await db.tombstones.get('gone')).toBeUndefined();
  });

  it('falls back to the Inbox when the old folder is gone', async () => {
    await restoreTombstones([stone('missing', false)]);
    const restored = [...native.state.nodes.values()].find((n) => n.title === 'Back')!;
    expect(restored.parentId).toBe(await ensureInbox());
  });
});

describe('openBookmark', () => {
  it('opens https links in the foreground by default', async () => {
    expect(await openBookmark('https://a.dev/')).toBe(true);
    expect(native.state.tabs).toEqual([{ url: 'https://a.dev/', active: true }]);
  });

  it('can open in the background', async () => {
    await openBookmark('https://a.dev/', { background: true });
    expect(native.state.tabs[0]).toMatchObject({ active: false });
  });

  it.each(['javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd', 'chrome://settings', 'not a url'])(
    'refuses %s',
    async (url) => {
      expect(await openBookmark(url)).toBe(false);
      expect(native.state.tabs).toHaveLength(0);
    },
  );
});

describe('openDashboard', () => {
  it('opens the extension page', async () => {
    await openDashboard();
    expect(native.state.tabs[0]!.url).toBe('chrome-extension://folio/dashboard.html');
  });
});
