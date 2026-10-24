// packages/editor/src/plugins/layers/color/LayerColorPlugin.ts
/**
 * Plugin : layers.color
 * Epic : layers
 * Dépend de : layers.list
 * Écoute : —
 * Émet : —
 *
 * Couleur de contour des calques et des dossiers, comme dans Flash : un
 * petit carré à droite de chaque ligne ouvre le sélecteur de couleur natif.
 * Le choix est une commande annulable « Changer la couleur du calque ». La
 * bande colorée à gauche de la ligne reste peinte par `layers.list`.
 *
 * Service `layers.color` : `setColor(id, color | undefined)` ; `undefined`
 * retire la couleur. Une couleur n'est acceptée que sous la forme `#rrggbb`
 * (rendue en minuscules).
 */

import { findNodeById } from '@werddomain/timeline-runtime';
import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import { createLayerColorControl } from './layerColorControl';
import { createSetColorCommand, normalizeLayerColor } from './layerColor';
import type { ILayerColorService } from './types';
import './LayerColor.less';

/** Identifiant du plugin et de son service. */
export const LAYERS_COLOR_PLUGIN_ID = 'layers.color';

/** Couleur des calques : contrôle de ligne et service. */
export class LayerColorPlugin implements EditorPlugin {
  readonly id = 'layers.color';
  readonly dependencies: readonly string[] = ['layers.list'];

  private cleanups: Array<() => void> = [];

  readonly init = (ctx: IEditorContext): void => {
    const setColor = (id: string, color: string | undefined): boolean => {
      if (findNodeById(ctx.document.layers, id) === undefined) return false;
      if (color !== undefined && normalizeLayerColor(color) === undefined) return false;
      return ctx.commands.execute(createSetColorCommand(ctx.document, id, color));
    };
    const service: ILayerColorService = { setColor };
    const control = createLayerColorControl(LAYERS_COLOR_PLUGIN_ID, (id, color) => {
      setColor(id, color);
    });
    this.cleanups = [
      ctx.services.provide(LAYERS_COLOR_PLUGIN_ID, service),
      ctx.services.require('layers.list').addRowControl(control)
    ];
  };

  destroy(): void {
    const cleanups = this.cleanups.reverse();
    this.cleanups = [];
    cleanups.forEach((cleanup) => cleanup());
  }
}
