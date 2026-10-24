// packages/editor/src/plugins/layout/LayoutPlugin.ts
/**
 * Plugin : layout
 * Epic : layout
 * Dépend de : —
 * Écoute : —
 * Émet : —
 *
 * Epic de la mise en page de la timeline. Il ne fait rien lui-même : il
 * regroupe ses plugins de fonctionnalité, enregistrés avec lui par l'hôte
 * (et toujours initialisés après lui) :
 * - `layout.shell` : la grille de zones et ses emplacements de rendu ;
 * - `layout.scrollSync` : le défilement synchronisé de la règle et des calques ;
 * - `layout.ruler` : la règle des images ;
 * - `layout.playhead` : la tête de lecture (posée sur `ctx.playback`) ;
 * - `layout.zoom` : la largeur d'image variable (`zoom:changed`).
 *
 * La mise en page ne contient que la timeline : aucune zone de scène.
 */

import type { EditorPlugin } from '../../core/context/IEditorContext';
import { PlayheadPlugin } from './playhead/PlayheadPlugin';
import { RulerPlugin } from './ruler/RulerPlugin';
import type { RulerOptions } from './ruler/RulerPlugin';
import { ScrollSyncPlugin } from './scrollSync/ScrollSyncPlugin';
import { ZoomPlugin } from './zoom/ZoomPlugin';
import type { ZoomOptions } from './zoom/ZoomPlugin';
import type { ScrollSyncOptions } from './scrollSync/ScrollSyncPlugin';
import { LayoutShellPlugin } from './shell/LayoutShellPlugin';

/** Options de l'epic `layout`, transmises à ses plugins. */
export interface LayoutOptions {
  readonly scrollSync?: ScrollSyncOptions;
  readonly ruler?: RulerOptions;
  readonly zoom?: ZoomOptions;
}

/** Epic `layout` : coquille, défilement synchronisé, règle, tête de lecture et zoom. */
export class LayoutPlugin implements EditorPlugin {
  readonly id = 'layout';
  readonly dependencies: readonly string[] = [];
  readonly children: readonly EditorPlugin[];

  constructor(options: LayoutOptions = {}) {
    this.children = [
      new LayoutShellPlugin(),
      new ScrollSyncPlugin(options.scrollSync),
      new RulerPlugin(options.ruler),
      new PlayheadPlugin(),
      new ZoomPlugin(options.zoom)
    ];
  }

  readonly init = (): void => {};

  destroy(): void {}
}
