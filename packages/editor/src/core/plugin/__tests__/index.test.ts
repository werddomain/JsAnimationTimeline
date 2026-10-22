// packages/editor/src/core/plugin/__tests__/index.test.ts
/**
 * Vérifie que le point d'entrée du système de plugins expose l'API publique.
 */

import * as api from '../index';
import type { IPlugin, PluginErrorCode, PluginHostOptions } from '../index';

describe('core/plugin index', () => {
  it('re-exports the runtime values', () => {
    expect(api.PluginHost).toBeDefined();
    expect(api.PluginError).toBeDefined();
    expect(api.SlotRegistry).toBeDefined();
    expect(api.ROOT_SLOT).toBe('root');
    expect(typeof api.topologicalSort).toBe('function');
    expect(api.PLUGIN_ID_PATTERN.test('layers.color')).toBe(true);
    expect(api.isValidPluginId('core')).toBe(true);
    expect(typeof api.assertValidPluginId).toBe('function');
    expect(api.isValidSlotName('timeline.header')).toBe(true);
    expect(typeof api.assertValidSlotName).toBe('function');
  });

  it('re-exports the types usable together', () => {
    // Arrange
    const plugin: IPlugin<string> = { id: 'a', dependencies: [], init: () => undefined, destroy: () => undefined };
    const options: PluginHostOptions = { providedIds: [] };
    const code: PluginErrorCode = 'missing-slot';

    // Act
    const host = new api.PluginHost<string>(options).register(plugin);

    // Assert
    expect(host.order()).toEqual(['a']);
    expect(code).toBe('missing-slot');
  });
});
