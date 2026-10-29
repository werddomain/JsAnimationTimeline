// packages/editor/src/plugins/layers/toolbar/__tests__/toolbarCommands.test.ts
/** Commandes de `layers.toolbar` : exécuter, annuler, rétablir. */

import { isFolder } from '@kazo-ca/timeline-runtime';
import type { LayerNode } from '@kazo-ca/timeline-runtime';
import { doc, folder, layer } from '../../list/__tests__/fixtures';
import { LayerToolbarCommandLabels, deleteLayersCommand, newLayerCommand } from '../toolbarCommands';

function shape(nodes: readonly LayerNode[]): string {
  return nodes.map((node) => (isFolder(node) ? `${node.id}(${shape(node.children)})` : node.id)).join(',');
}

const tree = doc([folder('f', [layer('a'), layer('b')]), layer('c')]);

describe('newLayerCommand', () => {
  it('does, undoes and redoes; undo returns the very same tree', () => {
    const { command, layerId } = newLayerCommand(tree, 'a');
    expect(command.label).toBe(LayerToolbarCommandLabels.newLayer);
    const done = command.do(tree);
    expect(shape(done.layers)).toBe(`f(${layerId},a,b),c`);
    const undone = command.undo(done);
    expect(undone.layers).toBe(tree.layers);
    expect(command.do(undone).layers).toEqual(done.layers);
  });

  it('inserts at the top without anchor and creates an empty targetless layer', () => {
    const { command, layerId } = newLayerCommand(tree, undefined);
    expect(command.do(tree).layers[0]).toEqual({ id: layerId, type: 'layer', name: 'Calque 1', spans: [] });
  });

  it('does not mutate a frozen input', () => {
    const frozen = Object.freeze({ ...tree, layers: Object.freeze([...tree.layers]) });
    expect(() => newLayerCommand(frozen, 'c').command.do(frozen)).not.toThrow();
  });
});

describe('deleteLayersCommand', () => {
  it('does, undoes and redoes; undo returns the very same tree', () => {
    const command = deleteLayersCommand(tree, ['a', 'c']);
    if (command === undefined) throw new Error('commande absente');
    expect(command.label).toBe(LayerToolbarCommandLabels.deleteLayers);
    const done = command.do(tree);
    expect(shape(done.layers)).toBe('f(b)');
    const undone = command.undo(done);
    expect(undone.layers).toBe(tree.layers);
    expect(shape(command.do(undone).layers)).toBe('f(b)');
  });

  it('drops ids whose ancestor is also selected and removes a folder subtree', () => {
    const command = deleteLayersCommand(tree, ['b', 'f']);
    expect(shape(command?.do(tree).layers ?? [])).toBe('c');
  });

  it('returns undefined when no id matches', () => {
    expect(deleteLayersCommand(tree, ['zz'])).toBeUndefined();
  });
});
