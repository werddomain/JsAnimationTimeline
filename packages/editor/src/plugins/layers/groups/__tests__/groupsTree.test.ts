// packages/editor/src/plugins/layers/groups/__tests__/groupsTree.test.ts
/** Opérations pures de `layers.groups` : noms, ids, insertion, regroupement, dissociation. */

import { flattenLayers, isFolder } from '@werddomain/timeline-runtime';
import type { LayerNode } from '@werddomain/timeline-runtime';
import { folder, layer } from '../../list/__tests__/fixtures';
import {
  addFolder,
  groupNodes,
  insertNode,
  locateNode,
  newFolder,
  nextFolderId,
  nextFolderName,
  removeNodes,
  topMostIds,
  ungroupNode
} from '../groupsTree';

/** Forme de l'arbre : `f(a,g(b)),c`. */
function shape(nodes: readonly LayerNode[]): string {
  return nodes.map((node) => (isFolder(node) ? `${node.id}(${shape(node.children)})` : node.id)).join(',');
}

const empty = folder('x', []);

describe('nextFolderName / nextFolderId', () => {
  it('starts at 1 on an empty tree', () => {
    expect(nextFolderName([])).toBe('Dossier 1');
    expect(nextFolderId([])).toBe('folder-1');
  });

  it('takes the smallest free number, at any depth', () => {
    const nodes = [layer('a', { name: 'Dossier 1' }), folder('f', [layer('b', { name: 'Dossier 3' })])];
    expect(nextFolderName(nodes)).toBe('Dossier 2');
  });

  it('fills the gap in ids and ignores look-alike ids', () => {
    const nodes = [layer('folder-1'), folder('folder-3', [layer('folder-02'), layer('folder-x')])];
    expect(nextFolderId(nodes)).toBe('folder-2');
  });

  it('newFolder is an empty expanded folder', () => {
    const created = newFolder([layer('folder-1')]);
    expect(created).toEqual({ id: 'folder-2', type: 'folder', name: 'Dossier 1', children: [] });
    expect('collapsed' in created).toBe(false);
  });
});

describe('locateNode', () => {
  const tree = [folder('f', [layer('a'), folder('g', [layer('b')])]), layer('c')];

  it('gives the parent and index', () => {
    expect(locateNode(tree, 'c')).toEqual({ parentId: undefined, index: 1 });
    expect(locateNode(tree, 'b')).toEqual({ parentId: 'g', index: 0 });
    expect(locateNode(tree, 'g')).toEqual({ parentId: 'f', index: 1 });
    expect(locateNode(tree, 'zz')).toBeUndefined();
  });
});

describe('insertNode / removeNodes', () => {
  const tree = [folder('f', [layer('a'), layer('b')]), layer('c')];

  it('inserts at the root and in a nested folder without mutating', () => {
    expect(shape(insertNode(tree, undefined, 1, empty))).toBe('f(a,b),x(),c');
    expect(shape(insertNode(tree, 'f', 1, empty))).toBe('f(a,x(),b),c');
    expect(shape(tree)).toBe('f(a,b),c');
  });

  it('removes nodes at any depth and keeps untouched branches', () => {
    const next = removeNodes(tree, new Set(['b', 'c']));
    expect(shape(next)).toBe('f(a)');
  });
});

describe('topMostIds', () => {
  const tree = [folder('f', [layer('a'), folder('g', [layer('b')])]), layer('c')];

  it('drops descendants of selected folders and unknown ids, in display order', () => {
    expect(topMostIds(tree, ['c', 'b', 'f', 'a', 'nope'])).toEqual(['f', 'c']);
    expect(topMostIds(tree, ['c', 'b'])).toEqual(['b', 'c']);
    expect(topMostIds(tree, [])).toEqual([]);
  });
});

describe('addFolder', () => {
  const tree = [folder('f', [layer('a'), layer('b')]), layer('c')];

  it('inserts above the anchor in its parent', () => {
    expect(shape(addFolder(tree, empty, 'b'))).toBe('f(a,x(),b),c');
    expect(shape(addFolder(tree, empty, 'c'))).toBe('f(a,b),x(),c');
  });

  it('inserts at the top without anchor or with an unknown anchor', () => {
    expect(shape(addFolder(tree, empty, undefined))).toBe('x(),f(a,b),c');
    expect(shape(addFolder(tree, empty, 'nope'))).toBe('x(),f(a,b),c');
  });
});

describe('groupNodes', () => {
  const tree = [folder('f', [layer('a'), folder('g', [layer('b')])]), layer('c'), layer('d')];

  it('wraps siblings where the first one was', () => {
    expect(shape(groupNodes(tree, ['d', 'c'], empty))).toBe('f(a,g(b)),x(c,d)');
  });

  it('moves nodes from different parents, in display order, at the first position', () => {
    expect(shape(groupNodes(tree, ['c', 'b', 'a'], empty))).toBe('f(x(a,b,c),g()),d');
  });

  it('ignores ids whose ancestor is also selected', () => {
    expect(shape(groupNodes(tree, ['f', 'b', 'd'], empty))).toBe('x(f(a,g(b)),d),c');
  });

  it('returns the same tree for an empty or unknown selection', () => {
    expect(groupNodes(tree, [], empty)).toBe(tree);
    expect(groupNodes(tree, ['nope'], empty)).toBe(tree);
  });

  it('keeps the new folder expanded and the moved nodes untouched', () => {
    const next = groupNodes(tree, ['c'], empty);
    const group = flattenLayers(next).find((visit) => visit.node.id === 'x')?.node;
    expect(group !== undefined && isFolder(group) && group.children[0]).toBe(tree[1]);
  });
});

describe('ungroupNode', () => {
  const tree = [layer('a'), folder('f', [layer('b'), folder('g', [layer('c')])]), layer('d')];

  it('replaces a folder by its children at its position', () => {
    expect(shape(ungroupNode(tree, 'f'))).toBe('a,b,g(c),d');
    expect(shape(ungroupNode(tree, 'g'))).toBe('a,f(b,c),d');
  });

  it('returns the same tree for a layer or an unknown id', () => {
    expect(ungroupNode(tree, 'a')).toBe(tree);
    expect(ungroupNode(tree, 'nope')).toBe(tree);
  });
});

describe('reference identity', () => {
  const tree = [folder('f', [layer('a'), layer('b')]), folder('h', [layer('c')]), layer('d')];

  it('removeNodes returns the same array when nothing is removed', () => {
    expect(removeNodes(tree, new Set(['nope']))).toBe(tree);
  });

  it('keeps untouched siblings and branches by reference', () => {
    const removed = removeNodes(tree, new Set(['a']));
    expect(removed[1]).toBe(tree[1]);
    expect(removed[2]).toBe(tree[2]);
    const inserted = insertNode(tree, 'f', 0, empty);
    expect(inserted[1]).toBe(tree[1]);
    expect(inserted[2]).toBe(tree[2]);
  });

  it('insertNode into an unknown parent returns the same array', () => {
    expect(insertNode(tree, 'nope', 0, empty)).toBe(tree);
  });
});
