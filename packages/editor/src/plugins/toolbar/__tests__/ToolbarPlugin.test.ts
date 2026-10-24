// packages/editor/src/plugins/toolbar/__tests__/ToolbarPlugin.test.ts
/**
 * Tests de l'epic `toolbar` : ses plugins de fonctionnalité, sa place dans
 * le jeu de plugins par défaut et la transmission des options.
 */

import { createEditor } from '../../../core/editor/createEditor';
import { defaultPlugins } from '../../../core/editor/defaultPlugins';
import { ToolbarMainPlugin } from '../main/ToolbarMainPlugin';
import { ToolbarPlugin } from '../ToolbarPlugin';
import { mountToolbar } from './toolbarFixtures';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('toolbar epic', () => {
  it('registers toolbar.main and toolbar.timeSettings as children and depends on nothing', () => {
    // Act
    const epic = new ToolbarPlugin();

    // Assert
    expect(epic.dependencies).toEqual([]);
    expect(epic.children.map((child) => child.id)).toEqual(['toolbar.main', 'toolbar.timeSettings']);
    expect(epic.children[0]).toBeInstanceOf(ToolbarMainPlugin);
  });

  it('is part of the default plugin set, so a default editor shows the scene zone', () => {
    // Arrange
    const container = document.createElement('div');
    document.body.appendChild(container);

    // Act
    const editor = createEditor(container);

    // Assert
    expect(defaultPlugins().map((plugin) => plugin.id)).toContain('toolbar');
    expect(editor.getService('toolbar.main')?.sceneName).toBe('Scène 1');
    expect(editor.container.querySelector('[data-zone="toolbar"] .jt-toolbar__sceneName')?.textContent).toBe('Scène 1');
  });

  it('passes its main options to toolbar.main', () => {
    // Act
    const { toolbar } = mountToolbar([], { main: { sceneName: 'Scène 2' } });

    // Assert
    expect(toolbar().sceneName).toBe('Scène 2');
  });
});
