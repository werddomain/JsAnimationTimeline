// packages/editor/src/core/editor/defaultPlugins.ts
/**
 * Jeu de plugins chargé par `createEditor()` quand `defaultPlugins` n'est pas
 * précisé (ou vaut `true`).
 *
 * Les tâches du plan y ajoutent leurs plugins au fur et à mesure (L1
 * `layout.*` : fait ; Y1 `layers.list` : fait ; Y* `layers.*`, G* `frames.*`, T* `toolbar.*`, P* `playback.*`,
 * C5 `history.undoRedo`...). Déjà présents : I2 `interaction.shortcuts`,
 * T1 `toolbar` (`toolbar.main`) et S2 `persistence.json`. Les plugins optionnels
 * (par exemple `properties.panel`) n'y figurent pas : l'application les
 * passe dans `options.plugins`.
 */

import type { EditorPlugin } from '../context/IEditorContext';
import { LayoutPlugin } from '../../plugins/layout/LayoutPlugin';
import { LayersPlugin } from '../../plugins/layers/LayersPlugin';
import { createShortcutsPlugin } from '../../plugins/interaction/shortcuts';
import { ToolbarPlugin } from '../../plugins/toolbar/ToolbarPlugin';
import { createPersistenceJsonPlugin } from '../../plugins/persistence/json';

/** Retourne une nouvelle liste des plugins par défaut (de nouvelles instances à chaque appel). */
export function defaultPlugins(): EditorPlugin[] {
  return [
    new LayoutPlugin(),
    new LayersPlugin(),
    createShortcutsPlugin(),
    new ToolbarPlugin(),
    createPersistenceJsonPlugin()
  ];
}
