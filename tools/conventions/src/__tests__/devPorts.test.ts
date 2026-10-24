// tools/conventions/src/__tests__/devPorts.test.ts
/**
 * Tests de tools/devPorts.ts (ports des démos, lus dans l'environnement) :
 * valeurs par défaut inchangées, ports choisis par variable, refus d'une
 * valeur invalide.
 */

import {
  DEFAULT_EDITOR_PORT,
  DEFAULT_RUNTIME_PORT,
  editorPort,
  portFromEnv,
  runtimePort
} from '../../../devPorts';

describe('devPorts', () => {
  it('keeps 9000 and 9001 when nothing is set', () => {
    // Assert
    expect([DEFAULT_EDITOR_PORT, DEFAULT_RUNTIME_PORT]).toEqual([9000, 9001]);
    expect([editorPort({}), runtimePort({})]).toEqual([9000, 9001]);
    expect(editorPort({ E2E_EDITOR_PORT: '  ' })).toBe(9000);
  });

  it('reads each worktree pair from E2E_EDITOR_PORT and E2E_RUNTIME_PORT', () => {
    // Arrange
    const env = { E2E_EDITOR_PORT: '9100', E2E_RUNTIME_PORT: '9101' };

    // Assert
    expect([editorPort(env), runtimePort(env)]).toEqual([9100, 9101]);
  });

  it.each(['abc', '0', '65536', '91.5', '-1'])('refuses %p with a clear message', (value) => {
    // Act + Assert
    expect(() => portFromEnv('E2E_EDITOR_PORT', 9000, { E2E_EDITOR_PORT: value })).toThrow(
      `E2E_EDITOR_PORT doit être un port entier de 1 à 65535 (reçu : « ${value} »).`
    );
  });
});
