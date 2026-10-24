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
 *
 * Les tâches suivantes (Y3 à Y8) ajoutent leur plugin à `children`.
 */

import type { EditorPlugin } from '../../core/context/IEditorContext';
import { LayerListPlugin } from './list/LayerListPlugin';
import { LockPlugin } from './lock/LockPlugin';
import { RenamePlugin } from './rename/RenamePlugin';
import { VisibilityPlugin } from './visibility/VisibilityPlugin';

/** Epic `layers` : liste des calques et ses fonctionnalités. */
export class LayersPlugin implements EditorPlugin {
  readonly id = 'layers';
  readonly dependencies: readonly string[] = [];
  readonly children: readonly EditorPlugin[];

  constructor() {
    this.children = [new LayerListPlugin(), new RenamePlugin(), new VisibilityPlugin(), new LockPlugin()];
  }

  readonly init = (): void => {};

  destroy(): void {}
}
