// packages/editor/src/plugins/frames/keyframes/__tests__/batchCommand.test.ts
/**
 * Tests de `batchCommand` : une seule commande pour un lot, tout ou rien.
 */

import { CommandRefusedError } from '../../../../core/commands/CommandRefusedError';
import { CompositeCommand } from '../../../../core/commands/CompositeCommand';
import { createSpanCommands } from '../../../../model/spans';
import { createDoc, createRegistry, layer, shapeOf } from '../../../../model/spans/__tests__/fixtures';
import { batchCommand } from '../batchCommand';

const commands = createSpanCommands(createRegistry());

const doc = createDoc([
  layer('a', [{ id: 'a1', start: 1, end: 10, kind: 'static' }]),
  layer('b', [{ id: 'b1', start: 1, end: 10, kind: 'static' }]),
  layer('lock', [{ id: 'l1', start: 1, end: 10, kind: 'static' }], { locked: true })
]);

describe('batchCommand', () => {
  it('returns undefined for an empty list', () => {
    expect(batchCommand('Lot', [])).toBeUndefined();
  });

  it('returns the command itself when there is only one', () => {
    // Arrange
    const single = commands.insertKeyframe('a', 3);

    // Act and assert
    expect(batchCommand('Lot', [single])).toBe(single);
  });

  it('returns a composite with the given label for several commands', () => {
    // Act
    const batch = batchCommand('Lot', [commands.insertKeyframe('a', 3), commands.insertKeyframe('b', 3)]);

    // Assert
    expect(batch).toBeInstanceOf(CompositeCommand);
    expect(batch?.label).toBe('Lot');
  });

  it('applies every command and restores everything with one undo', () => {
    // Arrange
    const batch = batchCommand('Lot', [commands.insertKeyframe('a', 3), commands.insertKeyframe('b', 5)]);
    if (batch === undefined) throw new Error('lot vide');

    // Act
    const done = batch.do(doc);
    const undone = batch.undo(done);

    // Assert
    expect(shapeOf(done, 'a')).toEqual(['static 1-2', 'static 3-10']);
    expect(shapeOf(done, 'b')).toEqual(['static 1-4', 'static 5-10']);
    expect(undone).toEqual(doc);
  });

  it('refuses as a whole when one command is refused, leaving the input untouched', () => {
    // Arrange
    const batch = batchCommand('Lot', [commands.insertKeyframe('a', 3), commands.insertKeyframe('lock', 3)]);
    if (batch === undefined) throw new Error('lot vide');

    // Act and assert
    expect(() => batch.do(doc)).toThrow(CommandRefusedError);
    expect(shapeOf(doc, 'a')).toEqual(['static 1-10']);
  });
});
