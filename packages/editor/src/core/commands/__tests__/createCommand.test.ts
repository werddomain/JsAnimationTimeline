// packages/editor/src/core/commands/__tests__/createCommand.test.ts
/**
 * Tests de createCommand et des commandes d'exemple des fixtures (règle :
 * chaque commande a son test d'annulation, sur des entrées figées).
 */

import type { ITimelineDocument } from '@werddomain/timeline-runtime';
import { createCommand } from '../createCommand';
import { createDocument, layerName, renameLayer, renameUnlessLocked, setFps } from './fixtures';

describe('createCommand', () => {
  it('builds a frozen command with the given label and transforms', () => {
    // Arrange
    const doFn = jest.fn((doc: ITimelineDocument) => doc);
    const undoFn = jest.fn((doc: ITimelineDocument) => doc);
    const doc = createDocument();

    // Act
    const command = createCommand('Libellé', doFn, undoFn);
    command.do(doc);
    command.undo(doc);

    // Assert
    expect(command.label).toBe('Libellé');
    expect(Object.isFrozen(command)).toBe(true);
    expect(doFn).toHaveBeenCalledWith(doc);
    expect(undoFn).toHaveBeenCalledWith(doc);
  });

  it('undoes renameLayer back to a deep-equal document without mutating the input', () => {
    // Arrange
    const original = createDocument();
    const command = renameLayer('l1', 'Titre', 'Logo');

    // Act
    const done = command.do(original);
    const undone = command.undo(done);

    // Assert
    expect(layerName(done, 'l1')).toBe('Titre');
    expect(undone).toEqual(original);
    expect(original).toEqual(createDocument());
  });

  it('undoes setFps back to a deep-equal document without mutating the input', () => {
    // Arrange
    const original = createDocument(24);
    const command = setFps(60, 24);

    // Act
    const done = command.do(original);
    const undone = command.undo(done);

    // Assert
    expect(done.settings.fps).toBe(60);
    expect(undone).toEqual(original);
    expect(original).toEqual(createDocument(24));
  });

  it('undoes renameUnlessLocked on an unlocked layer back to a deep-equal document', () => {
    // Arrange
    const original = createDocument();
    const command = renameUnlessLocked('l1', 'Titre', 'Logo');

    // Act
    const undone = command.undo(command.do(original));

    // Assert
    expect(undone).toEqual(original);
    expect(original).toEqual(createDocument());
  });

  it('makes renameUnlessLocked refuse a locked layer', () => {
    // Arrange
    const command = renameUnlessLocked('l2', 'Titre', 'Fond');

    // Act / Assert
    expect(() => command.do(createDocument())).toThrow('calque verrouillé');
  });
});
