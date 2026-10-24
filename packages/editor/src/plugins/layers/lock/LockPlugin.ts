// packages/editor/src/plugins/layers/lock/LockPlugin.ts
/**
 * Plugin : layers.lock
 * Epic : layers
 * Dépend de : layers.list
 * Écoute : document:loaded, document:changed
 * Émet : —
 *
 * Cadenas de verrouillage sur chaque ligne de la liste des calques (contrôle
 * `layers.lock`, `order` 20 : à droite de l'œil, `order` 10) et dans son
 * en-tête. Le bouton bascule `locked` du nœud par une commande annulable ;
 * celui de l'en-tête bascule tous les nœuds de premier niveau (tout verrouiller
 * s'il en manque un, sinon tout déverrouiller) en une seule entrée d'historique.
 *
 * Le verrou protège les images clés, pas le nom ni l'affichage : ce sont les
 * commandes d'édition des images qui le font respecter (elles refusent un
 * calque verrouillé et un calque dans un dossier verrouillé). Un nœud verrouillé
 * par un dossier parent (`lockedByAncestor`) montre un cadenas atténué ; le
 * bouton ne change jamais que le drapeau du nœud lui-même.
 *
 * Service `layers.lock` : `setLocked`, `toggle`, `setAll`.
 */

import { findNodeById, resolveLocked } from '@werddomain/timeline-runtime';
import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import { LOCKED_FLAG, nextAllValue } from '../layerFlags';
import { createFlagToggleControl } from '../flagToggleControl';
import { LockLabels, createSetAllLockedCommand, createSetLockedCommand } from './lockCommands';
import './Lock.less';

/** Identifiant du plugin, de son service et de son contrôle de ligne. */
export const LAYERS_LOCK_PLUGIN_ID = 'layers.lock';

/** Position du contrôle dans la ligne (après l'œil, 10). */
export const LOCK_CONTROL_ORDER = 20;

/** Note ajoutée au cadenas d'une ligne verrouillée par un dossier parent. */
export const LOCK_INHERITED_NOTE = 'verrouillé par le dossier';

/** Classe du bouton de verrouillage. */
export const LOCK_BUTTON_CLASS = 'jt-layer-flag--lock';

/** API publiée sous le service `layers.lock`. */
export interface ILayerLockService {
  /** Verrouille ou déverrouille le nœud `id` (commande annulable) ; `false` si inconnu ou sans changement. */
  setLocked(id: string, locked: boolean): boolean;
  /** Inverse le verrou propre du nœud `id` ; `false` si `id` est inconnu. */
  toggle(id: string): boolean;
  /** Verrouille ou déverrouille tous les nœuds de premier niveau en une commande ; `false` sans changement. */
  setAll(locked: boolean): boolean;
}

declare module '../../../core/context/IEditorContext' {
  interface EditorServiceMap {
    'layers.lock': ILayerLockService;
  }
}

/** Cadenas des calques et dossiers. */
export class LockPlugin implements EditorPlugin {
  readonly id = 'layers.lock';
  readonly dependencies: readonly string[] = ['layers.list'];

  private cleanups: Array<() => void> = [];

  readonly init = (ctx: IEditorContext): void => {
    const service: ILayerLockService = {
      setLocked: (id, locked) =>
        findNodeById(ctx.document.layers, id) !== undefined &&
        ctx.commands.execute(createSetLockedCommand(ctx.document, id, locked)),
      toggle: (id) => {
        const node = findNodeById(ctx.document.layers, id);
        return node !== undefined && service.setLocked(id, !resolveLocked(node));
      },
      setAll: (locked) => ctx.commands.execute(createSetAllLockedCommand(ctx.document, locked))
    };
    const control = createFlagToggleControl({
      id: LAYERS_LOCK_PLUGIN_ID,
      order: LOCK_CONTROL_ORDER,
      className: LOCK_BUTTON_CLASS,
      pressed: resolveLocked,
      inherited: (row) => row.lockedByAncestor && !resolveLocked(row.node),
      glyph: (pressed, inherited) => (pressed || inherited ? '🔒' : '🔓'),
      rowLabel: (node) => `Verrou de « ${node.name} »`,
      rowTitle: (pressed) => (pressed ? LockLabels.unlock : LockLabels.lock),
      inheritedNote: LOCK_INHERITED_NOTE,
      headerLabel: 'Verrou de tous les calques',
      headerTitle: (all) => (all ? LockLabels.unlockAll : LockLabels.lockAll),
      document: () => ctx.document,
      onToggle: (id) => void service.toggle(id),
      onToggleAll: () => void service.setAll(nextAllValue(ctx.document, LOCKED_FLAG))
    });
    const refresh = (): void => control.refreshHeaders();
    this.cleanups = [
      ctx.services.provide(LAYERS_LOCK_PLUGIN_ID, service),
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
