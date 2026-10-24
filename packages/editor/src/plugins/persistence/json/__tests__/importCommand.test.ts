// packages/editor/src/plugins/persistence/json/__tests__/importCommand.test.ts
/**
 * Commande d'import : `do` remplace le document, `undo` rend le document
 * remplacé, libellé par défaut ou choisi.
 */

import { createEmptyDocument } from '../../../../core/editor/emptyDocument';
import { IMPORT_COMMAND_LABEL, createImportCommand } from '../importCommand';
import { makeV2Document } from './fixtures';

describe('createImportCommand', () => {
  it('replaces the document, then undo restores the replaced one', () => {
    // Arrange
    const before = createEmptyDocument();
    const imported = makeV2Document();
    const command = createImportCommand(imported);

    // Act
    const after = command.do(before);
    const restored = command.undo(after);

    // Assert
    expect(after).toBe(imported);
    expect(restored).toBe(before);
  });

  it('restores the document given to the latest do (redo after undo)', () => {
    // Arrange
    const first = createEmptyDocument();
    const second = { ...createEmptyDocument(), settings: { fps: 12, totalFrames: 5 } };
    const command = createImportCommand(makeV2Document());

    // Act
    command.do(first);
    const after = command.do(second);

    // Assert
    expect(command.undo(after)).toBe(second);
  });

  it('returns its input from undo when do never ran', () => {
    // Arrange
    const doc = createEmptyDocument();

    // Act / Assert
    expect(createImportCommand(makeV2Document()).undo(doc)).toBe(doc);
  });

  it('uses the default label or the given one, and is frozen', () => {
    // Act
    const byDefault = createImportCommand(makeV2Document());
    const custom = createImportCommand(makeV2Document(), 'Ouvrir');

    // Assert
    expect(byDefault.label).toBe(IMPORT_COMMAND_LABEL);
    expect(IMPORT_COMMAND_LABEL).toBe('Importer le document');
    expect(custom.label).toBe('Ouvrir');
    expect(Object.isFrozen(byDefault)).toBe(true);
  });
});
