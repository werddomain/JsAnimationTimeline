// packages/editor/src/plugins/frames/clipboard/__tests__/pasteCommand.test.ts
/**
 * Tests de la commande de collage : une seule annulation pour toutes les
 * lignes (durée comprise), rétablir, et refus sans effet.
 */

import { evaluateLayer } from '@werddomain/timeline-runtime';
import type { PropertyRegistry } from '@werddomain/timeline-runtime';
import { CommandRefusedError } from '../../../../core/commands/CommandRefusedError';
import { createDoc, createRegistry, layer, shapeOf } from '../../../../model/spans/__tests__/fixtures';
import { createPasteCommand, PASTE_COMMAND_LABEL } from '../pasteCommand';
import type { IPastePlacement } from '../pasteCommand';

const registry: PropertyRegistry = createRegistry();
const blank = { frameOffset: 0, length: 3, spans: [{ start: 1, end: 3, kind: 'blank' as const }] };

const doc = createDoc(
  [
    layer('a', [{ id: 'a1', start: 1, end: 24, kind: 'static', tracks: { x: [{ frame: 1, value: 1 }] } }]),
    layer('b', [{ id: 'b1', start: 1, end: 24, kind: 'static', tracks: { x: [{ frame: 1, value: 2 }] } }])
  ],
  24
);

const placements: IPastePlacement[] = [
  { layerId: 'a', runs: [{ at: 22, run: blank }] },
  { layerId: 'b', runs: [{ at: 2, run: blank }] }
];

describe('createPasteCommand', () => {
  it('carries the paste label', () => {
    // Act
    const command = createPasteCommand(placements, registry);

    // Assert
    expect(command.label).toBe(PASTE_COMMAND_LABEL);
  });

  it('pastes on every row in one do', () => {
    // Act
    const next = createPasteCommand(placements, registry).do(doc);

    // Assert
    expect(shapeOf(next, 'a')).toEqual(['static 1-21', 'blank 22-24']);
    expect(shapeOf(next, 'b')).toEqual(['static 1-1', 'blank 2-4', 'static 5-24']);
  });

  it('restores every row and totalFrames with one undo', () => {
    // Arrange
    const grown: IPastePlacement[] = [{ layerId: 'a', runs: [{ at: 23, run: blank }] }, placements[1]];
    const command = createPasteCommand(grown, registry);
    const pasted = command.do(doc);

    // Act
    const restored = command.undo(pasted);

    // Assert
    expect(pasted.settings.totalFrames).toBe(25);
    expect(restored).toEqual(doc);
  });

  it('applies again after an undo (redo)', () => {
    // Arrange
    const command = createPasteCommand(placements, registry);
    const first = command.do(doc);
    const undone = command.undo(first);

    // Act
    const again = command.do(undone);

    // Assert
    expect(again).toEqual(first);
  });

  it('applies several runs of the same row in order', () => {
    // Arrange
    const twoRuns: IPastePlacement[] = [{ layerId: 'a', runs: [{ at: 2, run: blank }, { at: 8, run: blank }] }];

    // Act
    const next = createPasteCommand(twoRuns, registry).do(doc);

    // Assert
    expect(shapeOf(next, 'a')).toEqual(['static 1-1', 'blank 2-4', 'static 5-7', 'blank 8-10', 'static 11-24']);
  });

  it('refuses the whole paste when one row is locked, and changes nothing', () => {
    // Arrange
    const locked = createDoc([layer('a', [{ id: 'a1', start: 1, end: 5, kind: 'blank' }]), layer('b', [], { locked: true })]);
    const command = createPasteCommand(placements, registry);

    // Act
    const act = (): unknown => command.do(locked);

    // Assert
    expect(act).toThrow(CommandRefusedError);
    expect(act).toThrow('verrouillé');
    expect(shapeOf(locked, 'a')).toEqual(['blank 1-5']);
  });

  it('undoes to the same document when nothing was applied', () => {
    // Arrange
    const command = createPasteCommand([], registry);

    // Act
    const next = command.do(doc);

    // Assert
    expect(next).toBe(doc);
    expect(command.undo(next)).toBe(doc);
  });
});


describe('paste carry command history', () => {
  it('restores overwritten inherited values with one undo and reproduces them on redo', () => {
    const input = createDoc([layer('a', [
      { id: 'before', start: 1, end: 4, kind: 'static', tracks: { x: [{ frame: 1, value: 0 }] } },
      { id: 'removed', start: 5, end: 8, kind: 'static', tracks: { x: [{ frame: 5, value: 100 }] } },
      { id: 'after', start: 9, end: 12, kind: 'static' }
    ])], 12);
    const command = createPasteCommand([{ layerId: 'a', runs: [{ at: 5, run: { length: 4, spans: [{ start: 1, end: 4, kind: 'blank' }] } }] }], registry);

    const pasted = command.do(input);
    const restored = command.undo(pasted);
    const redone = command.do(restored);

    const first = pasted.layers[0];
    const again = redone.layers[0];
    if (first.type !== 'layer' || again.type !== 'layer') throw new Error('Expected pasted layers.');
    expect(evaluateLayer(first, 9, { registry }).values.x).toBe(100);
    expect(restored).toEqual(input);
    expect(redone).toEqual(pasted);
    expect(evaluateLayer(again, 12, { registry }).values.x).toBe(100);
  });
});
