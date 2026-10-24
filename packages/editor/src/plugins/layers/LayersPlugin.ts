// packages/editor/src/plugins/layers/LayersPlugin.ts
/**
 * Plugin : layers
 * Epic : layers
 * Dépend de : —
 * Écoute : —
 * Émet : —
 *
 * Epic des calques. Il ne fait rien lui-même : il regroupe ses plugins de
 * fonctionnalité, enregistrés avec lui par l'hôte (et toujours initialisés
 * après lui) :
 * - `layers.list` : la liste des calques, ses lignes et leurs contrôles.
 * - `layers.selection` : la sélection multiple des calques et la navigation au clavier.
 * - `layers.reorder` : le glisser-déposer des calques (ordre, entrée et sortie d'un dossier).
 *
 * Les tâches suivantes (Y2 à Y8) ajoutent leur plugin à `children`.
 */

import type { EditorPlugin } from '../../core/context/IEditorContext';
import { LayerListPlugin } from './list/LayerListPlugin';
import { LayerReorderPlugin } from './reorder/LayerReorderPlugin';
import { LayerSelectionPlugin } from './selection/LayerSelectionPlugin';

/** Epic `layers` : liste des calques et ses fonctionnalités. */
export class LayersPlugin implements EditorPlugin {
  readonly id = 'layers';
  readonly dependencies: readonly string[] = [];
  readonly children: readonly EditorPlugin[];

  constructor() {
    this.children = [new LayerListPlugin(), new LayerSelectionPlugin(), new LayerReorderPlugin()];
  }

  readonly init = (): void => {};

  destroy(): void {}
}
