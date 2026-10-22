// packages/editor/src/core/editor/defaultPlugins.ts
/**
 * Jeu de plugins chargé par `createEditor()` quand `defaultPlugins` n'est pas
 * précisé (ou vaut `true`).
 *
 * Il est vide pour l'instant : les tâches suivantes du plan y ajoutent leurs
 * plugins au fur et à mesure (L1 `layout.*`, Y* `layers.*`, G* `frames.*`,
 * T* `toolbar.*`, P* `playback.*`, I2 `interaction.shortcuts`, C5
 * `history.undoRedo`, S2 `persistence.json`...). Les plugins optionnels
 * (par exemple `properties.panel`) n'y figurent pas : l'application les
 * passe dans `options.plugins`.
 */

import type { EditorPlugin } from '../context/IEditorContext';

/** Retourne une nouvelle liste des plugins par défaut (de nouvelles instances à chaque appel). */
export function defaultPlugins(): EditorPlugin[] {
  return [];
}
