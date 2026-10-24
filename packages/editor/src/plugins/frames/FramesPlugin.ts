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
 * - `frames.clipboard` : copier / coller des images (Ctrl+C, Ctrl+V).
 *
 * Les tâches suivantes (K2...) ajoutent leur plugin à `children`.
 */

import type { EditorPlugin } from '../../core/context/IEditorContext';
import { FramesClipboardPlugin } from './clipboard/FramesClipboardPlugin';
import { FramesGridPlugin } from './grid/FramesGridPlugin';
import { FramesSelectionPlugin } from './selection/FramesSelectionPlugin';

/** Epic `frames` : grille des images, sélection et leurs fonctionnalités. */
export class FramesPlugin implements EditorPlugin {
  readonly id = 'frames';
  readonly dependencies: readonly string[] = [];
  readonly children: readonly EditorPlugin[];

  constructor() {
    this.children = [new FramesGridPlugin(), new FramesSelectionPlugin(), new FramesClipboardPlugin()];
  }

  readonly init = (): void => {};

  destroy(): void {}
}
