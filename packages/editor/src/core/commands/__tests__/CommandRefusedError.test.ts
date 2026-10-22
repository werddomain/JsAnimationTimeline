// packages/editor/src/core/commands/__tests__/CommandRefusedError.test.ts
/**
 * Tests de CommandRefusedError : champs, nom, message en français et
 * `instanceof`.
 */

import { CommandRefusedError } from '../CommandRefusedError';

describe('CommandRefusedError', () => {
  it('carries the reason and the command label', () => {
    // Arrange / Act
    const error = new CommandRefusedError('Déplacer', 'calque verrouillé');

    // Assert
    expect(error.reason).toBe('calque verrouillé');
    expect(error.commandLabel).toBe('Déplacer');
    expect(error.name).toBe('CommandRefusedError');
    expect(error.message).toBe('La commande « Déplacer » a été refusée : calque verrouillé');
  });

  it('is an instance of both CommandRefusedError and Error', () => {
    // Arrange / Act
    const error: unknown = new CommandRefusedError('Déplacer', 'verrou');

    // Assert
    expect(error).toBeInstanceOf(CommandRefusedError);
    expect(error).toBeInstanceOf(Error);
  });
});
