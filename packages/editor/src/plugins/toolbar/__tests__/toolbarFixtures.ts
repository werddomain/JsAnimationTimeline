// packages/editor/src/plugins/toolbar/__tests__/toolbarFixtures.ts
/**
 * Fixtures des tests de l'epic `toolbar` : montage d'un éditeur avec la
 * coquille, les raccourcis et la barre d'outils, plus des plugins de test.
 */

import { createEditor } from '../../../core/editor/createEditor';
import type { IEditor } from '../../../core/editor/types';
import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import { createShortcutsPlugin } from '../../interaction/shortcuts';
import { LayoutPlugin } from '../../layout/LayoutPlugin';
import { createManualScheduler } from '../../layout/__tests__/layoutFixtures';
import type { IToolbarMainService } from '../main/types';
import { ToolbarMainPlugin } from '../main/ToolbarMainPlugin';
import type { ToolbarOptions } from '../ToolbarPlugin';

/** Éditeur monté avec la barre d'outils. */
export interface IMountedToolbar {
  readonly editor: IEditor;
  readonly container: HTMLElement;
  /** Service `toolbar.main` (lève s'il est absent). */
  readonly toolbar: () => IToolbarMainService;
  /** Élément de la zone `toolbar` de la coquille. */
  readonly zone: () => HTMLElement;
  /** Élément d'un bouton ou d'un contrôle par son identifiant (`null` s'il est absent). */
  readonly item: (id: string) => HTMLElement | null;
}

/** Epic `toolbar` de test : les tests montent seulement les plugins de la barre qu'ils visent. */
function toolbarEpic(children: readonly EditorPlugin[]): EditorPlugin {
  return { id: 'toolbar', dependencies: [], children, init: () => {}, destroy: () => {} };
}

/**
 * Plugins de base : coquille, raccourcis et barre d'outils (`toolbar.main`
 * seul, plus `toolbarChildren` comme autres enfants de l'epic).
 */
export function toolbarBasePlugins(
  options: ToolbarOptions = {},
  toolbarChildren: readonly EditorPlugin[] = []
): EditorPlugin[] {
  return [
    new LayoutPlugin({ scrollSync: { scheduler: createManualScheduler() } }),
    createShortcutsPlugin(),
    toolbarEpic([new ToolbarMainPlugin(options.main), ...toolbarChildren])
  ];
}

/** Monte un éditeur avec `layout`, `interaction.shortcuts` et `toolbar`, puis `plugins`. */
export function mountToolbar(plugins: readonly EditorPlugin[] = [], options: ToolbarOptions = {}): IMountedToolbar {
  const container = document.createElement('section');
  document.body.appendChild(container);
  const editor = createEditor(container, { defaultPlugins: toolbarBasePlugins(options), plugins });
  const toolbar = (): IToolbarMainService => {
    const service = editor.getService('toolbar.main');
    if (service === undefined) throw new Error('Service toolbar.main absent.');
    return service;
  };
  const zone = (): HTMLElement => {
    const element = editor.container.querySelector<HTMLElement>('[data-zone="toolbar"]');
    if (element === null) throw new Error('Zone toolbar introuvable.');
    return element;
  };
  const item = (id: string): HTMLElement | null =>
    editor.container.querySelector<HTMLElement>(`[data-toolbar-item="${id}"]`);
  return { editor, container, toolbar, zone, item };
}

/** Plugin de test qui dépend de `toolbar.main` et appelle `onInit` avec son contexte. */
export function toolbarUser(
  id: string,
  onInit: (ctx: IEditorContext) => void,
  onDestroy: () => void = () => {}
): EditorPlugin {
  return { id, dependencies: ['toolbar.main'], init: onInit, destroy: onDestroy };
}
