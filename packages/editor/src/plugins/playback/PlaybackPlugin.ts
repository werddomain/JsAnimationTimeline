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
 *   d'outils, par `ctx.playback` (avec ou sans scène) ;
 * - `playback.livePreview` : aperçu de la scène pendant le glisser de la
 *   tête de lecture (en direct, limité ou au relâchement).
 */

import type { EditorPlugin } from '../../core/context/IEditorContext';
import { PlaybackControlsPlugin } from './controls/PlaybackControlsPlugin';
import { LivePreviewPlugin } from './livePreview/LivePreviewPlugin';

/** Epic `playback` : contrôles de lecture. */
export class PlaybackPlugin implements EditorPlugin {
  readonly id = 'playback';
  readonly dependencies: readonly string[] = [];
  readonly children: readonly EditorPlugin[] = [new PlaybackControlsPlugin(), new LivePreviewPlugin()];

  readonly init = (): void => {};

  destroy(): void {}
}
