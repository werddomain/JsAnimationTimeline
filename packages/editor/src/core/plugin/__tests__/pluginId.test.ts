// packages/editor/src/core/plugin/__tests__/pluginId.test.ts
/**
 * Tests de la règle de forme des identifiants de plugin.
 */

import { PluginError } from '../PluginError';
import { assertValidPluginId, isValidPluginId } from '../pluginId';
import { catchError } from './fixtures/plugins';

describe('isValidPluginId', () => {
  it.each(['core', 'layers.color', 'layout.scrollSync', 'a1.b2.c3', 'x'])(
    'accepts "%s"',
    (id) => {
      expect(isValidPluginId(id)).toBe(true);
    }
  );

  it.each(['', 'Core', '1abc', 'layers.', '.layers', 'layers..color', 'layers.Color', 'a-b', 'a b', 'a_b'])(
    'rejects "%s"',
    (id) => {
      expect(isValidPluginId(id)).toBe(false);
    }
  );

  it('rejects non-string values', () => {
    expect(isValidPluginId(undefined)).toBe(false);
    expect(isValidPluginId(42)).toBe(false);
  });
});

describe('assertValidPluginId', () => {
  it('does nothing for a valid id', () => {
    expect(() => assertValidPluginId('layers.color')).not.toThrow();
  });

  it('throws a PluginError invalid-id that quotes the id', () => {
    // Act
    const error = catchError(() => assertValidPluginId('Bad.Id'));

    // Assert
    expect(error).toBeInstanceOf(PluginError);
    expect((error as PluginError).code).toBe('invalid-id');
    expect((error as PluginError).message).toContain('"Bad.Id"');
  });
});
