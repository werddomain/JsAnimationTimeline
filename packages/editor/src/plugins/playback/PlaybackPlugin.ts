// packages/editor/src/plugins/playback/PlaybackPlugin.ts
/**
 * Plugin : playback
 * Epic : playback
 * Dépend de : —
 * Écoute : —
 * Émet : —
 *
 * Epic de la lecture. Il ne fait rien lui-même : il regroupe ses plugins de
 * fonctionnalité, enregistrés avec lui par l'hôte (et toujours initialisés
 * après lui) :
 * - `playback.controls` : lire, pause, boucle et vitesse dans la barre
 *   d'outils, par `ctx.playback` (avec ou sans scène).
 */

import type { EditorPlugin } from '../../core/context/IEditorContext';
import { PlaybackControlsPlugin } from './controls/PlaybackControlsPlugin';

/** Epic `playback` : contrôles de lecture. */
export class PlaybackPlugin implements EditorPlugin {
  readonly id = 'playback';
  readonly dependencies: readonly string[] = [];
  readonly children: readonly EditorPlugin[] = [new PlaybackControlsPlugin()];

  readonly init = (): void => {};

  destroy(): void {}
}
