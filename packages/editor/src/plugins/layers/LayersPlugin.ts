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
 * - `layers.rename` : renommage sur place des calques et des dossiers.
 * - `layers.visibility` : œil de visibilité (ligne et en-tête).
 * - `layers.lock` : cadenas de verrouillage (ligne et en-tête).
 * - `layers.selection` : la sélection multiple des calques et la navigation au clavier.
 * - `layers.toolbar` : les boutons Nouveau / Dossier / Grouper / Supprimer.
 * - `layers.groups` : les dossiers et « grouper la sélection ».
 *
 * Les tâches suivantes (Y3, Y4, Y6 à Y8) ajoutent leur plugin à `children`.
 */

import type { EditorPlugin } from '../../core/context/IEditorContext';
import { LayerListPlugin } from './list/LayerListPlugin';
import { LockPlugin } from './lock/LockPlugin';
import { RenamePlugin } from './rename/RenamePlugin';
import { VisibilityPlugin } from './visibility/VisibilityPlugin';
import { LayerSelectionPlugin } from './selection/LayerSelectionPlugin';
import { LayerToolbarPlugin } from './toolbar/LayerToolbarPlugin';
import { LayerGroupsPlugin } from './groups/LayerGroupsPlugin';

/** Epic `layers` : liste des calques et ses fonctionnalités. */
export class LayersPlugin implements EditorPlugin {
  readonly id = 'layers';
  readonly dependencies: readonly string[] = [];
  readonly children: readonly EditorPlugin[];

  constructor() {
    this.children = [
      new LayerListPlugin(),
      new RenamePlugin(),
      new VisibilityPlugin(),
      new LockPlugin(),
      new LayerSelectionPlugin(),
      new LayerGroupsPlugin(),
      new LayerToolbarPlugin(),
    ];
  }

  readonly init = (): void => {};

  destroy(): void {}
}
