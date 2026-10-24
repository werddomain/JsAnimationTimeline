// packages/editor/src/plugins/frames/keyframes/__tests__/keyframeTargets.test.ts
/**
 * Tests de `keyframeTargets` : les images visées par F5 / F6 / F7, de droite
 * à gauche, avec repli sur la tête de lecture et sans calque verrouillé.
 */

import type { LayerNode } from '@werddomain/timeline-runtime';
import { createDoc, layer } from '../../../../model/spans/__tests__/fixtures';
import { keyframeTargets, lockedLayerIds } from '../keyframeTargets';

const folder = (id: string, children: readonly LayerNode[], locked?: boolean): LayerNode => ({
  id,
  type: 'folder',
  name: id,
  children,
  ...(locked === undefined ? {} : { locked })
});

const doc = createDoc([
  layer('a', []),
  layer('b', [], { locked: true }),
  folder('f', [layer('c', [])]),
  folder('lockedFolder', [layer('d', []), layer('e', [], { locked: true })], true),
  layer('g', [])
]);

const asKeys = (cells: readonly { rowId: string; frame: number }[]): string[] =>
  cells.map((cell) => `${cell.rowId}:${cell.frame}`);

describe('keyframeTargets from the selected cells', () => {
  it('orders the frames of each row from right to left and keeps the row order', () => {
    // Arrange
    const cells = [
      { rowId: 'a', frame: 2 },
      { rowId: 'a', frame: 5 },
      { rowId: 'g', frame: 1 },
      { rowId: 'g', frame: 3 }
    ];

    // Act
    const targets = keyframeTargets(doc, { cells, playheadFrame: 9, layerIds: undefined });

    // Assert
    expect(asKeys(targets)).toEqual(['a:5', 'a:2', 'g:3', 'g:1']);
  });

  it('removes duplicate cells and never targets folders or unknown rows', () => {
    // Arrange
    const cells = [
      { rowId: 'a', frame: 2 },
      { rowId: 'a', frame: 2 },
      { rowId: 'f', frame: 1 },
      { rowId: 'ghost', frame: 1 }
    ];

    // Act
    const targets = keyframeTargets(doc, { cells, playheadFrame: 9, layerIds: undefined });

    // Assert
    expect(asKeys(targets)).toEqual(['a:2']);
  });

  it('leaves out locked layers and layers inside a locked folder', () => {
    // Arrange
    const cells = ['a', 'b', 'd', 'e', 'g'].map((rowId) => ({ rowId, frame: 4 }));

    // Act
    const targets = keyframeTargets(doc, { cells, playheadFrame: 1, layerIds: undefined });

    // Assert
    expect(asKeys(targets)).toEqual(['a:4', 'g:4']);
  });

  it('keeps only the first target when every target is locked, so the refusal shows', () => {
    // Arrange
    const cells = [
      { rowId: 'b', frame: 2 },
      { rowId: 'b', frame: 6 },
      { rowId: 'd', frame: 1 }
    ];

    // Act
    const targets = keyframeTargets(doc, { cells, playheadFrame: 1, layerIds: undefined });

    // Assert
    expect(asKeys(targets)).toEqual(['b:6']);
  });

  it('returns nothing without selection, layers or playhead layers', () => {
    // Act
    const targets = keyframeTargets(doc, { cells: [], playheadFrame: 3, layerIds: undefined });

    // Assert
    expect(targets).toEqual([]);
  });
});

describe('keyframeTargets playhead fallback', () => {
  it('uses the playhead frame on each selected layer when no frame is selected', () => {
    // Act
    const targets = keyframeTargets(doc, { cells: [], playheadFrame: 7, layerIds: ['g', 'a'] });

    // Assert
    expect(asKeys(targets)).toEqual(['g:7', 'a:7']);
  });

  it('ignores selected folders, unknown ids and locked layers', () => {
    // Act
    const targets = keyframeTargets(doc, { cells: [], playheadFrame: 2, layerIds: ['f', 'ghost', 'b', 'c'] });

    // Assert
    expect(asKeys(targets)).toEqual(['c:2']);
  });

  it('prefers the selected cells over the selected layers', () => {
    // Act
    const targets = keyframeTargets(doc, { cells: [{ rowId: 'a', frame: 4 }], playheadFrame: 2, layerIds: ['g'] });

    // Assert
    expect(asKeys(targets)).toEqual(['a:4']);
  });

  it('keeps the first locked layer when all the selected layers are locked', () => {
    // Act
    const targets = keyframeTargets(doc, { cells: [], playheadFrame: 2, layerIds: ['d', 'b'] });

    // Assert
    expect(asKeys(targets)).toEqual(['d:2']);
  });
});

describe('lockedLayerIds', () => {
  it('lists the locked layers and the layers under a locked folder', () => {
    // Act
    const locked = lockedLayerIds(doc);

    // Assert
    expect(Array.from(locked).sort()).toEqual(['b', 'd', 'e']);
  });
});
