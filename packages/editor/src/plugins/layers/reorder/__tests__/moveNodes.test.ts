// packages/editor/src/plugins/layers/reorder/__tests__/moveNodes.test.ts
/**
 * Opérations pures de l'arbre (`treeMoves`), déplacement (`moveNodes`) et
 * commande `Déplacer les calques`.
 */

import type { ITimelineDocument, LayerNode } from '@werddomain/timeline-runtime';
import { isFolder } from '@werddomain/timeline-runtime';
import { doc, folder, layer } from '../../list/__tests__/fixtures';
import { moveNodes } from '../moveNodes';
import { LAYER_MOVE_LABEL, createMoveLayersCommand } from '../reorderCommand';
import {
  childrenOf,
  detachNodes,
  findNodeLocation,
  insertNodes,
  isSameOrDescendant,
  sameArrangement,
  topMostIds
} from '../treeMoves';

/** Représentation compacte : `f(a,g(b)),c` pour contrôler l'arbre d'un coup d'oeil. */
function show(nodes: readonly LayerNode[]): string {
  return nodes.map((node) => (isFolder(node) ? `${node.id}(${show(node.children)})` : node.id)).join(',');
}

/** f(a, g(b)), c, d. */
function tree(): ITimelineDocument {
  return doc([folder('f', [layer('a'), folder('g', [layer('b')])]), layer('c'), layer('d')]);
}

describe('treeMoves', () => {
  it('finds the parent and index of a node at any depth', () => {
    const { layers } = tree();

    expect(findNodeLocation(layers, 'f')).toEqual({ index: 0 });
    expect(findNodeLocation(layers, 'd')).toEqual({ index: 2 });
    expect(findNodeLocation(layers, 'b')).toEqual({ parentId: 'g', index: 0 });
    expect(findNodeLocation(layers, 'g')).toEqual({ parentId: 'f', index: 1 });
    expect(findNodeLocation(layers, 'zzz')).toBeUndefined();
  });

  it('returns the children of a folder, the root list, or undefined for a layer or unknown id', () => {
    const { layers } = tree();

    expect(childrenOf(layers, undefined)).toBe(layers);
    expect(childrenOf(layers, 'g')?.map((node) => node.id)).toEqual(['b']);
    expect(childrenOf(layers, 'a')).toBeUndefined();
    expect(childrenOf(layers, 'zzz')).toBeUndefined();
  });

  it('tells whether a node is the same as or inside another', () => {
    const { layers } = tree();

    expect(isSameOrDescendant(layers, 'f', 'f')).toBe(true);
    expect(isSameOrDescendant(layers, 'f', 'b')).toBe(true);
    expect(isSameOrDescendant(layers, 'g', 'f')).toBe(false);
    expect(isSameOrDescendant(layers, 'zzz', 'f')).toBe(false);
  });

  it('keeps only top-most ids in display order and drops unknown ids and duplicates', () => {
    const { layers } = tree();

    expect(topMostIds(layers, ['d', 'b', 'f', 'a', 'f', 'zzz'])).toEqual(['f', 'd']);
    expect(topMostIds(layers, ['d', 'b', 'a'])).toEqual(['a', 'b', 'd']);
    expect(topMostIds(layers, [])).toEqual([]);
  });

  it('detaches nodes at any depth without mutating the input, and keeps references when nothing is found', () => {
    const { layers } = tree();

    const result = detachNodes(layers, ['b', 'c']);

    expect(show(result.nodes)).toBe('f(a,g()),d');
    expect(result.detached.map((node) => node.id)).toEqual(['b', 'c']);
    expect(show(layers)).toBe('f(a,g(b)),c,d');
    expect(detachNodes(layers, ['zzz']).nodes).toBe(layers);
  });

  it('does not descend into a detached node', () => {
    const { layers } = tree();

    const result = detachNodes(layers, ['f', 'b']);

    expect(show(result.nodes)).toBe('c,d');
    expect(result.detached.map((node) => node.id)).toEqual(['f']);
  });

  it('inserts nodes under a parent or at the root, clamping the index', () => {
    const { layers } = tree();
    const x = layer('x');

    expect(show(insertNodes(layers, undefined, 1, [x]))).toBe('f(a,g(b)),x,c,d');
    expect(show(insertNodes(layers, 'g', 0, [x]))).toBe('f(a,g(x,b)),c,d');
    expect(show(insertNodes(layers, 'f', 99, [x]))).toBe('f(a,g(b),x),c,d');
    expect(show(insertNodes(layers, undefined, -5, [x]))).toBe('x,f(a,g(b)),c,d');
    expect(insertNodes(layers, 'zzz', 0, [x])).toBe(layers);
    expect(insertNodes(layers, 'a', 0, [x])).toBe(layers);
    expect(insertNodes(layers, undefined, 0, [])).toBe(layers);
  });

  it('compares arrangements by ids, order and folders', () => {
    const { layers } = tree();

    expect(sameArrangement(layers, layers)).toBe(true);
    expect(sameArrangement(layers, tree().layers)).toBe(true);
    expect(sameArrangement(layers, [...layers].reverse())).toBe(false);
    expect(sameArrangement([layer('a')], [folder('a', [])])).toBe(false);
    expect(sameArrangement(layers, detachNodes(layers, ['b']).nodes)).toBe(false);
  });
});

describe('moveNodes', () => {
  it('moves a layer down, the index being read in the list as it was before the move', () => {
    // Arrange / Act : c vers « après d » (index 3 = fin).
    const moved = moveNodes(tree(), ['c'], { index: 3 });

    // Assert
    expect(show(moved.layers)).toBe('f(a,g(b)),d,c');
  });

  it('moves a layer up', () => {
    const moved = moveNodes(tree(), ['d'], { index: 0 });

    expect(show(moved.layers)).toBe('d,f(a,g(b)),c');
  });

  it('moves a layer into a folder at an index, and out of it', () => {
    const into = moveNodes(tree(), ['c'], { parentId: 'f', index: 0 });
    const out = moveNodes(tree(), ['b'], { index: 3 });

    expect(show(into.layers)).toBe('f(c,a,g(b)),d');
    expect(show(out.layers)).toBe('f(a,g()),c,d,b');
  });

  it('moves several nodes keeping their display order, whatever the order of ids', () => {
    const moved = moveNodes(tree(), ['d', 'a'], { parentId: 'g', index: 1 });

    expect(show(moved.layers)).toBe('f(g(b,a,d)),c');
  });

  it('moves only top-most nodes: a folder takes its children along', () => {
    const moved = moveNodes(tree(), ['b', 'f'], { index: 3 });

    expect(show(moved.layers)).toBe('c,d,f(a,g(b))');
  });

  it('accounts for moved siblings located before the index in the same parent', () => {
    const data = doc([layer('a'), layer('b'), layer('c'), layer('d')]);

    expect(show(moveNodes(data, ['a', 'b'], { index: 3 }).layers)).toBe('c,a,b,d');
    expect(show(moveNodes(data, ['b'], { index: 4 }).layers)).toBe('a,c,d,b');
  });

  it('refuses a folder moved into itself or a descendant, returning the same document', () => {
    const data = tree();

    expect(moveNodes(data, ['f'], { parentId: 'f', index: 0 })).toBe(data);
    expect(moveNodes(data, ['f'], { parentId: 'g', index: 0 })).toBe(data);
    expect(moveNodes(data, ['f', 'c'], { parentId: 'g', index: 0 })).toBe(data);
  });

  it('allows moving a folder next to its own descendant level (to the root)', () => {
    const moved = moveNodes(tree(), ['g'], { index: 0 });

    expect(show(moved.layers)).toBe('g(b),f(a),c,d');
  });

  it('returns the same document for a no-op move', () => {
    const data = tree();

    expect(moveNodes(data, ['c'], { index: 1 })).toBe(data);
    expect(moveNodes(data, ['c'], { index: 2 })).toBe(data);
    expect(moveNodes(data, ['a'], { parentId: 'f', index: 0 })).toBe(data);
    expect(moveNodes(data, ['a'], { parentId: 'f', index: 1 })).toBe(data);
    expect(moveNodes(data, ['c', 'd'], { index: 1 })).toBe(data);
  });

  it('returns the same document for unknown ids, an unknown or non-folder destination, or an invalid index', () => {
    const data = tree();

    expect(moveNodes(data, [], { index: 0 })).toBe(data);
    expect(moveNodes(data, ['zzz'], { index: 0 })).toBe(data);
    expect(moveNodes(data, ['c'], { parentId: 'zzz', index: 0 })).toBe(data);
    expect(moveNodes(data, ['c'], { parentId: 'a', index: 0 })).toBe(data);
    expect(moveNodes(data, ['c'], { index: Number.NaN })).toBe(data);
  });

  it('clamps an out-of-range index and keeps untouched nodes by reference', () => {
    const data = tree();

    const moved = moveNodes(data, ['c'], { index: 99 });

    expect(show(moved.layers)).toBe('f(a,g(b)),d,c');
    expect(moved.layers[0]).toBe(data.layers[0]);
  });

  it('moves locked layers: the lock protects keyframes, not the place in the list', () => {
    const data = doc([layer('a', { locked: true }), folder('f', [], { locked: true }), layer('b')]);

    const moved = moveNodes(data, ['a'], { parentId: 'f', index: 0 });

    expect(show(moved.layers)).toBe('f(a),b');
  });
});

describe('createMoveLayersCommand', () => {
  it('has the French label and moves on do', () => {
    const command = createMoveLayersCommand(['c'], { index: 3 });

    expect(command.label).toBe('Déplacer les calques');
    expect(command.label).toBe(LAYER_MOVE_LABEL);
    expect(show(command.do(tree()).layers)).toBe('f(a,g(b)),d,c');
  });

  it('undo restores the exact previous tree, and redo works', () => {
    const data = tree();
    const command = createMoveLayersCommand(['b', 'c'], { parentId: 'f', index: 0 });

    const done = command.do(data);
    const undone = command.undo(done);
    const redone = command.do(undone);

    expect(undone.layers).toBe(data.layers);
    expect(redone).toEqual(done);
  });

  it('is a no-op (same document) when the move is refused or changes nothing', () => {
    const data = tree();

    expect(createMoveLayersCommand(['f'], { parentId: 'g', index: 0 }).do(data)).toBe(data);
    expect(createMoveLayersCommand(['c'], { index: 1 }).do(data)).toBe(data);
    expect(createMoveLayersCommand(['c'], { index: 1 }).undo(data)).toBe(data);
  });

  it('is not affected by later changes to the ids array it was given', () => {
    const ids = ['c'];
    const command = createMoveLayersCommand(ids, { index: 3 });
    ids.push('d');

    expect(show(command.do(tree()).layers)).toBe('f(a,g(b)),d,c');
  });
});
