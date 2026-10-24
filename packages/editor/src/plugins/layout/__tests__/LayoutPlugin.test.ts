// packages/editor/src/plugins/layout/__tests__/LayoutPlugin.test.ts
/**
 * Tests de l'epic `layout` : ses plugins de fonctionnalité, leur ordre
 * d'initialisation et sa présence dans le jeu de plugins par défaut.
 */

import type { EditorPlugin } from '../../../core/context/IEditorContext';
import { createEditor } from '../../../core/editor/createEditor';
import { defaultPlugins } from '../../../core/editor/defaultPlugins';
import { LayoutPlugin } from '../LayoutPlugin';
import { cleanBody, createContainer } from './layoutFixtures';

afterEach(cleanBody);

describe('layout epic', () => {
  it('groups layout.shell and layout.scrollSync', () => {
    // Act
    const epic = new LayoutPlugin();

    // Assert
    expect(epic.id).toBe('layout');
    expect(epic.dependencies).toEqual([]);
    expect(epic.children.map((child) => child.id)).toEqual(['layout.shell', 'layout.scrollSync']);
  });

  it('is part of the default plugin set, initialised before its children', () => {
    // Arrange
    const order: string[] = [];
    const listener: EditorPlugin = {
      id: 'test.listener',
      dependencies: ['core'],
      init: (ctx) => void ctx.events.on('editor:ready', (event) => order.push(...event.pluginIds)),
      destroy: () => {}
    };

    // Act
    const editor = createEditor(createContainer(), { plugins: [listener] });

    // Assert
    expect(defaultPlugins().map((plugin) => plugin.id)).toContain('layout');
    expect(order.indexOf('layout')).toBeLessThan(order.indexOf('layout.shell'));
    expect(order.indexOf('layout.shell')).toBeLessThan(order.indexOf('layout.scrollSync'));
    expect(editor.getService('layout.scrollSync')).toBeDefined();
  });

  it('does nothing by itself', () => {
    // Arrange
    const epic = new LayoutPlugin();

    // Act
    const act = (): void => {
      epic.init();
      epic.destroy();
    };

    // Assert
    expect(act).not.toThrow();
  });
});
