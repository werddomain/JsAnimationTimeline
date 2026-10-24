// packages/editor/src/plugins/toolbar/ToolbarPlugin.ts
/**
 * Plugin : toolbar
 * Epic : toolbar
 * Dépend de : —
 * Écoute : —
 * Émet : —
 *
 * Epic de la barre d'outils au-dessus de la timeline. Il ne fait rien
 * lui-même : il regroupe ses plugins de fonctionnalité, enregistrés avec lui
 * par l'hôte (et toujours initialisés après lui) :
 * - `toolbar.main` : la zone « Scène 1 » et l'API d'ajout de boutons et de
 *   contrôles, utilisée par les autres plugins de la barre ;
 * - `toolbar.timeSettings` : la cadence et la durée du document.
 */

import type { EditorPlugin } from '../../core/context/IEditorContext';
import { ToolbarMainPlugin } from './main/ToolbarMainPlugin';
import type { IToolbarMainOptions } from './main/types';
import { TimeSettingsPlugin } from './timeSettings/TimeSettingsPlugin';

/** Options de l'epic `toolbar`, transmises à ses plugins. */
export interface ToolbarOptions {
  readonly main?: IToolbarMainOptions;
}

/** Epic `toolbar` : barre d'outils principale et ses plugins. */
export class ToolbarPlugin implements EditorPlugin {
  readonly id = 'toolbar';
  readonly dependencies: readonly string[] = [];
  readonly children: readonly EditorPlugin[];

  constructor(options: ToolbarOptions = {}) {
    this.children = [new ToolbarMainPlugin(options.main), new TimeSettingsPlugin()];
  }

  readonly init = (): void => {};

  destroy(): void {}
}
