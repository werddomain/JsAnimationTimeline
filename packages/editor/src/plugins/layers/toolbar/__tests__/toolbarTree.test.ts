// packages/editor/src/plugins/layers/toolbar/__tests__/toolbarTree.test.ts
/** Aides pures de `layers.toolbar` et commandes (exécuter, annuler, rétablir). */

import { isFolder } from '@werddomain/timeline-runtime';
import type { LayerNode } from '@werddomain/timeline-runtime';
import { doc, folder, layer } from '../../list/__tests__/fixtures';
import { deleteLayersCommand, newLayerCommand, LayerToolbarCommandLabels } from '../toolbarCommands';
import { addLayer, newLayer, nextLayerId, nextLayerName, rowAfterDelete } from '../toolbarTree';

function shape(nodes: readonly LayerNode[]): string {
  return nodes.map((node) => (isFolder(node) ? `${node.id}(${shape(node.children)})` : node.id)).join(',');
}

const tree = doc([folder('f', [layer('a'), folder('g', [layer('b')])]), layer('c')]);

describe('names and ids', () => {
  it('uses the smallest free number', () => {
    expect(nextLayerName([])).toBe('Calque 1');
    expect(nextLayerName([layer('x', { name: 'Calque 1' }), layer('y', { name: 'Calque 3' })])).toBe('Calque 2');
    expect(nextLayerName([layer('x', { name: 'Calque 01' }), layer('y', { name: 'Calque' })])).toBe('Calque 1');
  });

  it('looks for ids in the whole tree', () => {
    const nodes = [folder('f', [layer('layer-1'), folder('g', [layer('layer-2')])])];
    expect(nextLayerId(nodes)).toBe('layer-3');
    expect(nextLayerId([layer('layer-2')])).toBe('layer-1');
  });

  it('creates an empty layer without target', () => {
    expect(newLayer([])).toEqual({ id: 'layer-1', type: 'layer', name: 'Calque 1', spans: [] });
    expect('target' in newLayer([])).toBe(false);
  });
});

describe('addLayer', () => {
  it('inserts at the top without anchor or with an unknown anchor', () => {
    expect(shape(addLayer(tree.layers, layer('n'), undefined))).toBe('n,f(a,g(b)),c');
    expect(shape(addLayer(tree.layers, layer('n'), 'zz'))).toBe('n,f(a,g(b)),c');
  });

  it('inserts above the anchor in its parent', () => {
    expect(shape(addLayer(tree.layers, layer('n'), 'b'))).toBe('f(a,g(n,b)),c');
    expect(shape(addLayer(tree.layers, layer('n'), 'c'))).toBe('f(a,g(b)),n,c');
  });
});

describe('rowAfterDelete', () => {
  it('takes the row that moved into the first removed place', () => {
    expect(rowAfterDelete(['a', 'b', 'c', 'd'], ['a', 'd'])).toBe('d');
    expect(rowAfterDelete(['a', 'b', 'c'], ['b', 'c'])).toBe('b');
  });

  it('falls back to the last row, or nothing', () => {
    expect(rowAfterDelete(['a', 'b', 'c'], ['a'])).toBe('a');
    expect(rowAfterDelete(['a'], [])).toBeUndefined();
    expect(rowAfterDelete(['a'], ['a'])).toBe('a');
  });
});

describe('newLayerCommand', () => {
  it('executes, undoes and redoes to the exact same trees', () => {
    const { command, layerId } = newLayerCommand(tree, 'b');
    expect(command.label).toBe(LayerToolbarCommandLabels.newLayer);
    expect(layerId).toBe('layer-1');
    const done = command.do(tree);
    expect(shape(done.layers)).toBe('f(a,g(layer-1,b)),c');
    expect(command.undo(done).layers).toBe(tree.layers);
    expect(command.do(tree).layers).toEqual(done.layers);
  });
});

describe('deleteLayersCommand', () => {
  it('returns undefined for an empty or unknown selection', () => {
    expect(deleteLayersCommand(tree, [])).toBeUndefined();
    expect(deleteLayersCommand(tree, ['zz'])).toBeUndefined();
  });

  it('removes top-most nodes, a folder taking its subtree; undo restores the tree', () => {
    const command = deleteLayersCommand(tree, ['b', 'g', 'c']);
    if (command === undefined) throw new Error('commande absente');
    expect(command.label).toBe(LayerToolbarCommandLabels.deleteLayers);
    const done = command.do(tree);
    expect(shape(done.layers)).toBe('f(a)');
    expect(command.undo(done).layers).toBe(tree.layers);
    expect(shape(command.do(tree).layers)).toBe('f(a)');
  });

  it('deletes locked layers too', () => {
    const locked = doc([layer('a', { locked: true }), layer('b')]);
    const command = deleteLayersCommand(locked, ['a']);
    expect(shape(command?.do(locked).layers ?? [])).toBe('b');
  });
});
