// packages/editor/src/plugins/layers/visibility/VisibilityPlugin.ts
/**
 * Plugin : layers.visibility
 * Epic : layers
 * Dépend de : layers.list
 * Écoute : document:loaded, document:changed
 * Émet : —
 *
 * Œil de visibilité sur chaque ligne de la liste des calques (contrôle
 * `layers.visibility`, `order` 10 : à gauche du cadenas, `order` 20) et dans
 * son en-tête. Le bouton bascule `visible` du nœud par une commande
 * annulable ; celui de l'en-tête bascule tous les nœuds de premier niveau
 * (tout afficher s'il en manque un, sinon tout masquer) en une seule entrée
 * d'historique.
 *
 * `visible` n'est qu'un drapeau du document : le plugin ne touche aucune
 * scène ni cible. Ce qu'il en reste à l'écran est l'affaire du rendu.
 *
 * Service `layers.visibility` : `setVisible`, `toggle`, `setAll`.
 */

import { findNodeById, resolveVisible } from '@werddomain/timeline-runtime';
import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import { VISIBLE_FLAG, nextAllValue } from '../layerFlags';
import { createFlagToggleControl } from '../flagToggleControl';
import { VisibilityLabels, createSetAllVisibleCommand, createSetVisibleCommand } from './visibilityCommands';
import './Visibility.less';

/** Identifiant du plugin, de son service et de son contrôle de ligne. */
export const LAYERS_VISIBILITY_PLUGIN_ID = 'layers.visibility';

/** Position du contrôle dans la ligne (avant le cadenas, 20). */
export const VISIBILITY_CONTROL_ORDER = 10;

/** Classe du bouton de visibilité. */
export const VISIBILITY_BUTTON_CLASS = 'jt-layer-flag--visibility';

/** API publiée sous le service `layers.visibility`. */
export interface ILayerVisibilityService {
  /** Affiche ou masque le nœud `id` (commande annulable) ; `false` si inconnu ou sans changement. */
  setVisible(id: string, visible: boolean): boolean;
  /** Inverse la visibilité du nœud `id` ; `false` si `id` est inconnu. */
  toggle(id: string): boolean;
  /** Affiche ou masque tous les nœuds de premier niveau en une commande ; `false` sans changement. */
  setAll(visible: boolean): boolean;
}

declare module '../../../core/context/IEditorContext' {
  interface EditorServiceMap {
    'layers.visibility': ILayerVisibilityService;
  }
}

/** Œil de visibilité des calques et dossiers. */
export class VisibilityPlugin implements EditorPlugin {
  readonly id = 'layers.visibility';
  readonly dependencies: readonly string[] = ['layers.list'];

  private cleanups: Array<() => void> = [];

  readonly init = (ctx: IEditorContext): void => {
    const service: ILayerVisibilityService = {
      setVisible: (id, visible) =>
        findNodeById(ctx.document.layers, id) !== undefined &&
        ctx.commands.execute(createSetVisibleCommand(ctx.document, id, visible)),
      toggle: (id) => {
        const node = findNodeById(ctx.document.layers, id);
        return node !== undefined && service.setVisible(id, !resolveVisible(node));
      },
      setAll: (visible) => ctx.commands.execute(createSetAllVisibleCommand(ctx.document, visible))
    };
    const control = createFlagToggleControl({
      id: LAYERS_VISIBILITY_PLUGIN_ID,
      order: VISIBILITY_CONTROL_ORDER,
      className: VISIBILITY_BUTTON_CLASS,
      pressed: resolveVisible,
      glyph: (pressed) => (pressed ? '👁' : '◌'),
      rowLabel: (node) => `Visibilité de « ${node.name} »`,
      rowTitle: (pressed) => (pressed ? VisibilityLabels.hide : VisibilityLabels.show),
      headerLabel: 'Visibilité de tous les calques',
      headerTitle: (all) => (all ? VisibilityLabels.hideAll : VisibilityLabels.showAll),
      document: () => ctx.document,
      onToggle: (id) => void service.toggle(id),
      onToggleAll: () => void service.setAll(nextAllValue(ctx.document, VISIBLE_FLAG))
    });
    const refresh = (): void => control.refreshHeaders();
    this.cleanups = [
      ctx.services.provide(LAYERS_VISIBILITY_PLUGIN_ID, service),
      ctx.services.require('layers.list').addRowControl(control),
      ctx.events.on('document:loaded', refresh),
      ctx.events.on('document:changed', refresh)
    ];
  };

  destroy(): void {
    const cleanups = this.cleanups;
    this.cleanups = [];
    cleanups.forEach((cleanup) => cleanup());
  }
}
