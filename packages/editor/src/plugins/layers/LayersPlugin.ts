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
 * - `layers.list` : la liste des calques, ses lignes et leurs contrôles ;
 * - `layers.color` : la couleur des calques et dossiers ;
 * - `layers.icon` : l'icône des calques ;
 * - `layers.rename` : renommage sur place des calques et des dossiers.
 * - `layers.visibility` : œil de visibilité (ligne et en-tête).
 * - `layers.lock` : cadenas de verrouillage (ligne et en-tête).
 * - `layers.target` : cible animée de chaque calque et alerte de cible manquante.
 * - `layers.selection` : la sélection multiple des calques et la navigation au clavier.
 *
 * Les tâches suivantes (Y6 à Y8) ajoutent leur plugin à `children`.
 */

import type { EditorPlugin } from '../../core/context/IEditorContext';
import { LayerColorPlugin } from './color/LayerColorPlugin';
import { LayerIconPlugin } from './icon/LayerIconPlugin';
import { LayerListPlugin } from './list/LayerListPlugin';
import { LockPlugin } from './lock/LockPlugin';
import { TargetPlugin } from './target/TargetPlugin';
import { RenamePlugin } from './rename/RenamePlugin';
import { VisibilityPlugin } from './visibility/VisibilityPlugin';
import { LayerSelectionPlugin } from './selection/LayerSelectionPlugin';

/** Epic `layers` : liste des calques et ses fonctionnalités. */
export class LayersPlugin implements EditorPlugin {
  readonly id = 'layers';
  readonly dependencies: readonly string[] = [];
  readonly children: readonly EditorPlugin[];

  constructor() {
    this.children = [
      new LayerListPlugin(),
      new LayerColorPlugin(),
      new LayerIconPlugin(),
      new RenamePlugin(),
      new VisibilityPlugin(),
      new LockPlugin(),
      new TargetPlugin(),
      new LayerSelectionPlugin(),
    ];
  }

  readonly init = (): void => {};

  destroy(): void {}
}
