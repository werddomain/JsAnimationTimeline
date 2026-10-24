// packages/editor/src/plugins/layers/reorder/__tests__/dropTarget.test.ts
/**
 * Destination d'un dépôt (zones d'une ligne, sous la liste) et déplacement
 * d'une case au clavier.
 */

import type { ITimelineDocument } from '@werddomain/timeline-runtime';
import { visibleRows } from '../../../../model/rows';
import { doc, folder, layer } from '../../list/__tests__/fixtures';
import { computeDropTarget, dropZone, locateDrop, placementAt } from '../dropTarget';
import type { IRowBox } from '../dropTarget';
import { keyboardMoveTarget } from '../keyboardMove';

/** f(a, g(b)), c, h() : f et g dépliés, h dossier vide, k dossier replié avec un enfant. */
function tree(): ITimelineDocument {
  return doc([
    folder('f', [layer('a'), folder('g', [layer('b')])]),
    layer('c'),
    folder('h', []),
    folder('k', [layer('m')], { collapsed: true })
  ]);
}

describe('dropZone', () => {
  it('splits a layer in two halves', () => {
    expect(dropZone('layer', 0)).toBe('before');
    expect(dropZone('layer', 0.49)).toBe('before');
    expect(dropZone('layer', 0.5)).toBe('after');
    expect(dropZone('layer', 1)).toBe('after');
  });

  it('splits a folder in upper part, middle and lower part', () => {
    expect(dropZone('folder', 0.1)).toBe('before');
    expect(dropZone('folder', 0.5)).toBe('into');
    expect(dropZone('folder', 0.25)).toBe('into');
    expect(dropZone('folder', 0.75)).toBe('into');
    expect(dropZone('folder', 0.9)).toBe('after');
  });
});

describe('computeDropTarget', () => {
  it('drops before / after a layer in its own parent', () => {
    const data = tree();

    expect(computeDropTarget(data, { id: 'c', kind: 'layer' }, 0.1)).toEqual({
      index: 1,
      position: 'before',
      rowId: 'c'
    });
    expect(computeDropTarget(data, { id: 'c', kind: 'layer' }, 0.9)).toEqual({
      index: 2,
      position: 'after',
      rowId: 'c'
    });
    expect(computeDropTarget(data, { id: 'b', kind: 'layer' }, 0.9)).toEqual({
      parentId: 'g',
      index: 1,
      position: 'after',
      rowId: 'b'
    });
  });

  it('drops into the middle of a folder as its first child', () => {
    expect(computeDropTarget(tree(), { id: 'f', kind: 'folder' }, 0.5)).toEqual({
      parentId: 'f',
      index: 0,
      position: 'into',
      rowId: 'f'
    });
    expect(computeDropTarget(tree(), { id: 'k', kind: 'folder' }, 0.5)).toMatchObject({ parentId: 'k', index: 0 });
  });

  it('drops before a folder on its upper part', () => {
    expect(computeDropTarget(tree(), { id: 'g', kind: 'folder' }, 0.05)).toEqual({
      parentId: 'f',
      index: 1,
      position: 'before',
      rowId: 'g'
    });
  });

  it('turns "after" an expanded folder with children into its first child slot', () => {
    expect(computeDropTarget(tree(), { id: 'f', kind: 'folder' }, 0.95)).toEqual({
      parentId: 'f',
      index: 0,
      position: 'after',
      rowId: 'f'
    });
  });

  it('keeps "after" a collapsed or empty folder as a sibling slot', () => {
    expect(computeDropTarget(tree(), { id: 'k', kind: 'folder' }, 0.95)).toMatchObject({ index: 4 });
    expect(computeDropTarget(tree(), { id: 'k', kind: 'folder' }, 0.95)?.parentId).toBeUndefined();
    expect(computeDropTarget(tree(), { id: 'h', kind: 'folder' }, 0.95)).toMatchObject({ index: 3 });
  });

  it('returns undefined for a row that is not in the document', () => {
    expect(computeDropTarget(tree(), { id: 'zzz', kind: 'layer' }, 0.5)).toBeUndefined();
  });
});

describe('locateDrop and placementAt', () => {
  const boxes: IRowBox[] = [
    { id: 'f', kind: 'folder', top: 100, height: 30 },
    { id: 'c', kind: 'layer', top: 130, height: 30 }
  ];

  it('finds the row under the pointer and the ratio on it', () => {
    expect(locateDrop(boxes, 145)).toEqual({ row: boxes[1], ratio: 0.5 });
    expect(locateDrop(boxes, 100)).toEqual({ row: boxes[0], ratio: 0 });
  });

  it('clamps above the first row to its top, and reports below the last row', () => {
    expect(locateDrop(boxes, 10)).toEqual({ row: boxes[0], ratio: 0 });
    expect(locateDrop(boxes, 160)).toBe('below');
    expect(locateDrop([], 5)).toBeUndefined();
  });

  it('drops below the last row at the end of the root list', () => {
    expect(placementAt(tree(), 'below')).toEqual({ index: 4, position: 'end' });
  });

  it('computes the placement of a hit row', () => {
    const hit = locateDrop(boxes, 131);

    expect(hit === undefined || hit === 'below' ? undefined : placementAt(tree(), hit)).toMatchObject({
      index: 1,
      position: 'before'
    });
  });
});

describe('keyboardMoveTarget', () => {
  const data = tree();
  const rows = visibleRows(data);
  // Lignes : f, a, g, b, c, h, k.

  it('enters an expanded folder at its end when moving up from below it', () => {
    // Au-dessus de c se trouve b, dernier descendant du dossier f.
    expect(keyboardMoveTarget(data, rows, ['c'], 'up')).toEqual({ parentId: 'g', index: 1 });
  });

  it('moves before the previous sibling', () => {
    expect(keyboardMoveTarget(data, rows, ['h'], 'up')).toEqual({ index: 1 });
  });

  it('enters an expanded empty folder when moving up onto it, but not a collapsed one', () => {
    expect(keyboardMoveTarget(data, rows, ['k'], 'up')).toEqual({ parentId: 'h', index: 0 });
    const collapsed = doc([folder('p', [], { collapsed: true }), layer('x')]);

    expect(keyboardMoveTarget(collapsed, visibleRows(collapsed), ['x'], 'up')).toEqual({ index: 0 });
  });

  it('leaves a folder upward when the previous row is the parent', () => {
    expect(keyboardMoveTarget(data, rows, ['a'], 'up')).toEqual({ index: 0 });
    expect(keyboardMoveTarget(data, rows, ['b'], 'up')).toEqual({ parentId: 'f', index: 1 });
  });

  it('does nothing at the top of the root list', () => {
    expect(keyboardMoveTarget(data, rows, ['f'], 'up')).toBeUndefined();
  });

  it('moves down after the next sibling and enters an expanded folder first', () => {
    // h est un dossier déplié vide : on y entre (nouveau dossier = vide).
    expect(keyboardMoveTarget(data, rows, ['c'], 'down')).toEqual({ parentId: 'h', index: 0 });
    expect(keyboardMoveTarget(data, rows, ['h'], 'down')).toEqual({ index: 4 });
    expect(keyboardMoveTarget(data, rows, ['a'], 'down')).toEqual({ parentId: 'g', index: 0 });
  });

  it('enters an expanded folder as first child when moving down onto it', () => {
    const wide = doc([layer('x'), folder('p', [layer('q')])]);

    expect(keyboardMoveTarget(wide, visibleRows(wide), ['x'], 'down')).toEqual({ parentId: 'p', index: 0 });
  });

  it('enters an expanded empty folder nested in a folder when moving down onto it', () => {
    const nested = doc([folder('p', [layer('x'), folder('e', [])])]);

    expect(keyboardMoveTarget(nested, visibleRows(nested), ['x'], 'down')).toEqual({ parentId: 'e', index: 0 });
  });

  it('leaves the folder first when the last child is followed by an empty expanded folder after its parent', () => {
    const after = doc([folder('p', [layer('q')]), folder('e', [])]);

    // Une case à la fois : sortir de p (après lui), puis, à la pression suivante, entrer dans e.
    expect(keyboardMoveTarget(after, visibleRows(after), ['q'], 'down')).toEqual({ index: 1 });
  });

  it('leaves a folder downward after its last child', () => {
    expect(keyboardMoveTarget(data, rows, ['b'], 'down')).toEqual({ parentId: 'f', index: 2 });
    expect(keyboardMoveTarget(data, rows, ['g'], 'down')).toEqual({ index: 1 });
  });

  it('skips the descendants of a moved folder and does nothing at the bottom of the root list', () => {
    expect(keyboardMoveTarget(data, rows, ['f'], 'down')).toEqual({ index: 2 });
    expect(keyboardMoveTarget(data, rows, ['k'], 'down')).toBeUndefined();
  });

  it('works on the top-most selection edge and ignores unknown ids', () => {
    expect(keyboardMoveTarget(data, rows, ['c', 'h'], 'down')).toEqual({ index: 4 });
    expect(keyboardMoveTarget(data, rows, ['zzz'], 'up')).toBeUndefined();
    expect(keyboardMoveTarget(data, rows, [], 'down')).toBeUndefined();
  });
});
