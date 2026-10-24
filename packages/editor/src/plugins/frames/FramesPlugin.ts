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
 * - `frames.grid` : la grille des plages et des images clés de chaque ligne ;
 * - `frames.selection` : la sélection des images et des images clés ;
 * - `frames.keyframes` : F5 / F6 / F7 et le glisser des images clés.
 *
 * Les tâches suivantes (K3) ajoutent leur plugin à `children`.
 */

import type { EditorPlugin } from '../../core/context/IEditorContext';
import { FramesGridPlugin } from './grid/FramesGridPlugin';
import { FramesKeyframesPlugin } from './keyframes/FramesKeyframesPlugin';
import { FramesSelectionPlugin } from './selection/FramesSelectionPlugin';

/** Epic `frames` : grille des images, sélection et leurs fonctionnalités. */
export class FramesPlugin implements EditorPlugin {
  readonly id = 'frames';
  readonly dependencies: readonly string[] = [];
  readonly children: readonly EditorPlugin[];

  constructor() {
    this.children = [new FramesGridPlugin(), new FramesSelectionPlugin(), new FramesKeyframesPlugin()];
  }

  readonly init = (): void => {};

  destroy(): void {}
}
