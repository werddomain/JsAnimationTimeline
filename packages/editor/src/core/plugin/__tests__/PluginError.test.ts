// packages/editor/src/core/plugin/__tests__/PluginError.test.ts
/**
 * Tests de PluginError : code, identifiant, cause et chaîne de prototypes.
 */

import { PluginError } from '../PluginError';

describe('PluginError', () => {
  it('is an Error and a PluginError with its name, code, pluginId and cause', () => {
    // Arrange
    const cause = new Error('boom');

    // Act
    const error = new PluginError('init-failed', 'message', 'layers.color', cause);

    // Assert
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(PluginError);
    expect(error.name).toBe('PluginError');
    expect(error.message).toBe('message');
    expect(error.code).toBe('init-failed');
    expect(error.pluginId).toBe('layers.color');
    expect(error.cause).toBe(cause);
  });

  it('leaves pluginId and cause undefined when not given', () => {
    // Act
    const error = new PluginError('already-started', 'déjà démarré');

    // Assert
    expect(error.pluginId).toBeUndefined();
    expect(error.cause).toBeUndefined();
  });
});
