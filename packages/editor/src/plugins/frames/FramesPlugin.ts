// packages/editor/src/plugins/frames/FramesPlugin.ts
/**
 * Plugin : frames
 * Epic : frames
 * Dépend de : —
 * Écoute : —
 * Émet : —
 *
 * Epic des images de la timeline. Il ne fait rien lui-même : il regroupe ses
 * plugins de fonctionnalité, enregistrés avec lui par l'hôte (et toujours
 * initialisés après lui) :
 * - `frames.grid` : la grille des plages et des images clés de chaque ligne.
 *
 * Les tâches suivantes (G2, K2, K3) ajoutent leur plugin à `children`.
 */

import type { EditorPlugin } from '../../core/context/IEditorContext';
import { FramesGridPlugin } from './grid/FramesGridPlugin';

/** Epic `frames` : grille des images et ses fonctionnalités. */
export class FramesPlugin implements EditorPlugin {
  readonly id = 'frames';
  readonly dependencies: readonly string[] = [];
  readonly children: readonly EditorPlugin[];

  constructor() {
    this.children = [new FramesGridPlugin()];
  }

  readonly init = (): void => {};

  destroy(): void {}
}
