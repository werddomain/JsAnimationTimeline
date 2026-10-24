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
 *
 * Les tâches suivantes (Y2 à Y8) ajoutent leur plugin à `children`.
 */

import type { EditorPlugin } from '../../core/context/IEditorContext';
import { LayerListPlugin } from './list/LayerListPlugin';

/** Epic `layers` : liste des calques et ses fonctionnalités. */
export class LayersPlugin implements EditorPlugin {
  readonly id = 'layers';
  readonly dependencies: readonly string[] = [];
  readonly children: readonly EditorPlugin[];

  constructor() {
    this.children = [new LayerListPlugin()];
  }

  readonly init = (): void => {};

  destroy(): void {}
}
