import { describe, expect, it } from 'vitest';
import { ALL_CRUMB, type Crumb, collapseTrail, crumbTrail } from './crumbs';

const folders = (...titles: string[]) => titles.map((title, i) => ({ id: `f${i}`, title }));
const titles = (items: ReturnType<typeof collapseTrail>) =>
  items.map((item) => (item.kind === 'link' ? item.crumb.title : `…${item.hidden.length}`));

describe('crumbTrail', () => {
  it('is empty at the top level', () => {
    expect(crumbTrail([], true)).toEqual([]);
  });

  it('starts at All bookmarks for a collection', () => {
    expect(crumbTrail([], false)).toEqual([ALL_CRUMB]);
  });

  it('lists ancestors outermost first after the root', () => {
    expect(crumbTrail(folders('Dev', 'Rust'), false).map((c) => c.title)).toEqual(['All bookmarks', 'Dev', 'Rust']);
  });

  it('names untitled folders', () => {
    expect(crumbTrail(folders(''), false)[1]!.title).toBe('Untitled');
  });
});

describe('collapseTrail', () => {
  const trail = (n: number): Crumb[] => [ALL_CRUMB, ...folders(...Array.from({ length: n }, (_, i) => `L${i + 1}`))];

  it('leaves short paths whole', () => {
    expect(titles(collapseTrail(trail(0)))).toEqual(['All bookmarks']);
    expect(titles(collapseTrail(trail(2)))).toEqual(['All bookmarks', 'L1', 'L2']);
  });

  it('keeps the root and the parent, and hides the middle', () => {
    expect(titles(collapseTrail(trail(3)))).toEqual(['All bookmarks', '…2', 'L3']);
    expect(titles(collapseTrail(trail(6)))).toEqual(['All bookmarks', '…5', 'L6']);
  });

  it('never hides a single crumb behind an ellipsis', () => {
    for (let n = 0; n < 8; n++) {
      for (const item of collapseTrail(trail(n)))
        if (item.kind === 'more') expect(item.hidden.length).toBeGreaterThan(1);
    }
  });

  it('hides exactly the crumbs it does not show, in order', () => {
    const items = collapseTrail(trail(5));
    const more = items.find((i) => i.kind === 'more');
    expect(more?.kind === 'more' && more.hidden.map((c) => c.title)).toEqual(['L1', 'L2', 'L3', 'L4']);
  });

  it('can keep more of the end', () => {
    expect(titles(collapseTrail(trail(5), 3))).toEqual(['All bookmarks', '…3', 'L4', 'L5']);
  });
});
