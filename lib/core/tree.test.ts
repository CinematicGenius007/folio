import { describe, expect, it } from 'vitest';
import { flatten, type TreeNode } from './projector';
import { activeRowIndex, buildTree, pickerRowKey, pickerRows } from './tree';

const tree: TreeNode[] = [
  {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        parentId: '0',
        index: 0,
        title: 'Bookmarks bar',
        children: [
          { id: '10', parentId: '1', index: 0, title: 'Loose', url: 'https://loose.dev/' },
          {
            id: '11',
            parentId: '1',
            index: 1,
            title: 'Courses',
            children: [
              { id: '12', parentId: '11', index: 0, title: 'Calculus', url: 'https://c.dev/' },
              {
                id: '13',
                parentId: '11',
                index: 1,
                title: 'Physics',
                children: [
                  { id: '14', parentId: '13', index: 0, title: 'Optics', url: 'https://o.dev/' },
                  {
                    id: '15',
                    parentId: '13',
                    index: 1,
                    title: 'Waves',
                    children: [{ id: '16', parentId: '15', index: 0, title: 'Deep', url: 'https://d.dev/' }],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: '2',
        parentId: '0',
        index: 1,
        title: 'Other bookmarks',
        children: [
          {
            id: '20',
            parentId: '2',
            index: 0,
            title: 'Inbox',
            children: [{ id: '21', parentId: '20', index: 0, title: 'New', url: 'https://n.dev/' }],
          },
        ],
      },
    ],
  },
];

const { bookmarks, folders } = flatten(tree);

describe('buildTree', () => {
  const nodes = buildTree(folders, bookmarks, '20');
  it('hides roots without loose bookmarks and the inbox, keeps loose-root as a node', () => {
    expect(nodes.map((n) => n.title)).toEqual(['Bookmarks bar', 'Courses']);
    expect(nodes[0]).toMatchObject({ isRoot: true, count: 1 });
  });
  it('counts whole subtrees and nests folders', () => {
    const courses = nodes[1]!;
    expect(courses.count).toBe(3);
    expect(courses.direct).toBe(1); // the Calculus bookmark sits directly in Courses
    expect(courses.children.map((c) => c.title)).toEqual(['Physics']);
    expect(courses.children[0]!.children.map((c) => c.title)).toEqual(['Waves']);
    expect(courses.children[0]!.count).toBe(2);
  });
});

describe('pickerRows', () => {
  const nodes = buildTree(folders, bookmarks, '20');
  const inbox = { id: '20', title: 'Inbox', count: 1 };
  it('shows inbox first and only top level when collapsed', () => {
    const rows = pickerRows({ tree: nodes, folders, inbox, expanded: new Set(), query: '' });
    expect(rows.map((r) => r.title)).toEqual(['Inbox', 'Bookmarks bar', 'Courses']);
    expect(rows[2]!.hasChildren).toBe(true);
  });
  it('expands children inline with depth', () => {
    const rows = pickerRows({ tree: nodes, folders, inbox, expanded: new Set(['11', '13']), query: '' });
    expect(rows.map((r) => `${r.depth}:${r.title}`)).toEqual([
      '0:Inbox',
      '0:Bookmarks bar',
      '0:Courses',
      '1:Physics',
      '2:Waves',
    ]);
  });
  it('filters across all depths with path labels', () => {
    const rows = pickerRows({ tree: nodes, folders, inbox, expanded: new Set(), query: 'phys wav' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: '15', title: 'Waves', pathLabel: 'Courses / Physics' });
  });
  it('pins suggestions above the inbox and tree, and ignores them while filtering', () => {
    const suggestions = [{ id: '15', title: 'Waves', count: 1, color: 'slate' as const, reason: '1 from waves.dev' }];
    const open = pickerRows({ tree: nodes, folders, inbox, expanded: new Set(), query: '', suggestions });
    expect(open.map((r) => `${r.suggested ? 's' : 't'}:${r.title}`)).toEqual([
      's:Waves',
      't:Inbox',
      't:Bookmarks bar',
      't:Courses',
    ]);
    expect(open[0]).toMatchObject({ rowKey: 'suggest:15', pathLabel: '1 from waves.dev' });
    const filtered = pickerRows({
      tree: nodes,
      folders,
      inbox,
      expanded: new Set(),
      query: 'waves',
      suggestions,
    });
    expect(filtered.every((r) => !r.suggested)).toBe(true);
  });
});

describe('activeRowIndex', () => {
  const nodes = buildTree(folders, bookmarks, '20');
  const inbox = { id: '20', title: 'Inbox', count: 1 };
  const suggestions = [{ id: '11', title: 'Courses', count: 3, color: 'slate' as const, reason: '1 from c.dev' }];
  const rows = pickerRows({ tree: nodes, folders, inbox, expanded: new Set(['11']), query: '', suggestions });

  it('keeps suggestion and tree rows with the same folder id distinct', () => {
    expect(rows.filter((r) => r.id === '11')).toHaveLength(2);
    expect(activeRowIndex(rows, pickerRowKey('suggest', '11'))).toBe(0);
    expect(activeRowIndex(rows, pickerRowKey('folder', '11'))).toBe(
      rows.findIndex((r) => r.rowKey === pickerRowKey('folder', '11')),
    );
  });

  it('moves past a duplicated folder instead of snapping back to the suggestion', () => {
    const suggestIdx = activeRowIndex(rows, pickerRowKey('suggest', '11'));
    const afterDown = Math.min(rows.length - 1, suggestIdx + 1);
    const keyAfterDown = rows[afterDown]!.rowKey;
    expect(keyAfterDown).not.toBe(pickerRowKey('suggest', '11'));
    // Another Down from the tree duplicate must advance further, not return to the suggestion.
    const treeCourses = activeRowIndex(rows, pickerRowKey('folder', '11'));
    expect(rows[Math.min(rows.length - 1, treeCourses + 1)]!.rowKey).not.toBe(pickerRowKey('suggest', '11'));
    expect(activeRowIndex(rows, keyAfterDown)).toBe(afterDown);
  });

  it('falls back to the same folder id when the active key vanishes while filtering', () => {
    const filtered = pickerRows({ tree: nodes, folders, inbox, expanded: new Set(), query: 'courses', suggestions });
    expect(activeRowIndex(filtered, pickerRowKey('suggest', '11'))).toBe(0);
    expect(filtered[0]?.rowKey).toBe(pickerRowKey('folder', '11'));
  });
});
