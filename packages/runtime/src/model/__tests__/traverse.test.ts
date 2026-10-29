// packages/runtime/src/model/__tests__/traverse.test.ts
/**
 * Depth-first traversal of the layer tree.
 */

import type { LayerNode } from '../layer';
import { findNodeById, flattenLayers, walkLayers } from '../traverse';

const tree: readonly LayerNode[] = [
  { id: 'a', type: 'layer', name: 'A', spans: [] },
  {
    id: 'f1',
    type: 'folder',
    name: 'F1',
    children: [
      { id: 'b', type: 'layer', name: 'B', spans: [] },
      { id: 'f2', type: 'folder', name: 'F2', children: [{ id: 'c', type: 'layer', name: 'C', spans: [] }] }
    ]
  },
  { id: 'd', type: 'layer', name: 'D', spans: [] }
];

describe('flattenLayers', () => {
  it('lists nodes depth-first in display order', () => {
    expect(flattenLayers(tree).map((visit) => visit.node.id)).toEqual(['a', 'f1', 'b', 'f2', 'c', 'd']);
  });

  it('reports parent folder ids, depth, index and pointer', () => {
    const c = flattenLayers(tree).find((visit) => visit.node.id === 'c');
    expect(c).toMatchObject({
      parentIds: ['f1', 'f2'],
      depth: 2,
      index: 0,
      pointer: '/layers/1/children/1/children/0'
    });
    const d = flattenLayers(tree).find((visit) => visit.node.id === 'd');
    expect(d).toMatchObject({ parentIds: [], depth: 0, index: 2, pointer: '/layers/2' });
  });

  it('returns an empty list for an empty tree', () => {
    expect(flattenLayers([])).toEqual([]);
  });
});

describe('walkLayers', () => {
  it('skips the children of a folder when the visitor returns false', () => {
    const ids: string[] = [];
    walkLayers(tree, ({ node }) => {
      ids.push(node.id);
      return node.id === 'f2' ? false : undefined;
    });
    expect(ids).toEqual(['a', 'f1', 'b', 'f2', 'd']);
  });
});

describe('findNodeById', () => {
  it('finds nodes at any depth', () => {
    expect(findNodeById(tree, 'a')?.name).toBe('A');
    expect(findNodeById(tree, 'f2')?.type).toBe('folder');
    expect(findNodeById(tree, 'c')?.name).toBe('C');
  });

  it('returns undefined for an unknown id', () => {
    expect(findNodeById(tree, 'zzz')).toBeUndefined();
  });
});
