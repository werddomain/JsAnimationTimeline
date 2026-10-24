// packages/editor/src/plugins/layers/target/TargetPlugin.ts
/**
 * Plugin : layers.target
 * Epic : layers
 * Dépend de : layers.list
 * Écoute : editor:ready, stage:targetsChanged, document:changed, document:loaded
 * Émet : —
 *
 * Cible animée de chaque calque. Un bouton sur la ligne (`order` 40 : après
 * l'œil, 10, le cadenas, 20, et la couleur de Y3, 30) ouvre une fenêtre de
 * choix : les cibles proposées par les scènes, « Choisir sur la scène »
 * (`targets.pick`), ou la saisie d'un sélecteur CSS ou d'une ref (avec la
 * scène quand il y en a plusieurs). Le changement passe par une commande
 * annulable, « Changer la cible du calque », après le contrôle de forme de
 * F06 : une cible vivante `{ element }` n'est jamais enregistrée ; un
 * sélecteur invalide l'est, et le calque devient une cible manquante.
 *
 * Alerte de cible manquante : lue dans `ctx.stage` (`missingTargets` et
 * `warnings`), jamais comptée à partir des `stage:report` ; repeinte au
 * démarrage, à chaque document (par la liste) et quand les cibles manquantes
 * changent (`stage:targetsChanged`, dont `refreshTargets`). Aucune alerte en
 * mode timeline seule (`stage: false`) ni pour un calque sans cible. La cible
 * ne change jamais l'icône du calque.
 *
 * Lit aussi le noyau `ctx.stage` (C7) et réutilise les combinaisons
 * d'annuler / rétablir de `history.undoRedo` et la lecture des touches de
 * `interaction.shortcuts` (constantes et fonctions pures, voir
 * `historyKeys.ts`) sans dépendre de ces plugins. Une scène qui lève dans
 * `describe` ou `listTargets` ne casse pas la liste : on retombe sur le
 * sélecteur ou la ref.
 *
 * Service `layers.target` : `setTarget`, `alert`, `open`, `close`.
 */

import { findNodeById, isLayer, isRefTarget, isSelectorTarget } from '@werddomain/timeline-runtime';
import type { ILayer, LayerTarget } from '@werddomain/timeline-runtime';
import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import { computeTargetAlert } from './targetAlert';
import type { ITargetAlert } from './targetAlert';
import { createSetTargetCommand } from './targetCommands';
import { createTargetControl } from './targetControl';
import type { ITargetControl } from './targetControl';
import { openTargetPopup } from './TargetPopup';
import type { ITargetPopup } from './TargetPopup';
import { toSavableTarget } from './targetValidation';
import './Target.less';

/** Identifiant du plugin, de son service et de son contrôle de ligne. */
export const LAYERS_TARGET_PLUGIN_ID = 'layers.target';

/** Position du contrôle dans la ligne (après l'œil, le cadenas et la couleur). */
export const TARGET_CONTROL_ORDER = 40;

/** Texte d'un calque sans cible. */
export const NO_TARGET_TEXT = 'aucune cible';

/** API publiée sous le service `layers.target`. */
export interface ILayerTargetService {
  /**
   * Donne la cible `target` au calque `id` (commande annulable). `false` si
   * `id` n'est pas un calque, si la cible est refusée par le contrôle de forme
   * (jamais d'élément vivant) ou si elle ne change pas. Ne lève jamais.
   */
  setTarget(id: string, target: unknown): boolean;
  /** Alerte de cible manquante du calque `id`. */
  alert(id: string): ITargetAlert;
  /** Ouvre la fenêtre de choix du calque `id` ; `false` si sa ligne n'a pas de bouton affiché. */
  open(id: string): boolean;
  /** Ferme la fenêtre de choix si elle est ouverte. */
  close(): void;
}

declare module '../../../core/context/IEditorContext' {
  interface EditorServiceMap {
    'layers.target': ILayerTargetService;
  }
}

/** Libellé de `target` par la scène, ou `undefined` (scène qui lève, libellé qui n'est pas un texte). */
function stageLabel(ctx: IEditorContext, target: LayerTarget): string | undefined {
  try {
    const label = ctx.stage.describe(target)?.label;
    return typeof label === 'string' && label !== '' ? label : undefined;
  } catch {
    return undefined;
  }
}

/** Texte d'une cible : sélecteur, ou ref suivie de sa scène. */
function targetText(target: LayerTarget): string {
  if (isSelectorTarget(target)) return target.selector;
  if (isRefTarget(target)) return target.stage === undefined ? target.ref : `${target.ref} (${target.stage})`;
  return NO_TARGET_TEXT;
}

/** Cible des calques. */
export class TargetPlugin implements EditorPlugin {
  readonly id = 'layers.target';
  readonly dependencies: readonly string[] = ['layers.list'];

  private cleanups: Array<() => void> = [];
  private popup: { readonly layerId: string; readonly view: ITargetPopup } | null = null;

  readonly init = (ctx: IEditorContext): void => {
    const layerOf = (id: string): ILayer | undefined => {
      const node = findNodeById(ctx.document.layers, id);
      return node !== undefined && isLayer(node) ? node : undefined;
    };
    const service: ILayerTargetService = {
      setTarget: (id, target) => {
        if (layerOf(id) === undefined || toSavableTarget(target) === undefined) return false;
        return ctx.commands.execute(createSetTargetCommand(ctx.document, id, target));
      },
      alert: (id) => computeTargetAlert(ctx.stage, id, layerOf(id)?.target),
      open: (id) => {
        const button = control.button(id);
        return button !== undefined && this.openPopup(ctx, id, button, service);
      },
      close: () => this.closePopup(false)
    };
    const control: ITargetControl = createTargetControl({
      id: LAYERS_TARGET_PLUGIN_ID,
      order: TARGET_CONTROL_ORDER,
      describe: (target) => (target === undefined ? NO_TARGET_TEXT : stageLabel(ctx, target) ?? targetText(target)),
      alertOf: service.alert,
      onActivate: (id, button) => {
        if (this.popup?.layerId === id) this.closePopup(true);
        else this.openPopup(ctx, id, button, service);
      },
      onDispose: (id) => {
        if (this.popup?.layerId === id) this.closePopup(false);
      }
    });
    const closeIfGone = (): void => {
      if (this.popup !== null && layerOf(this.popup.layerId) === undefined) this.closePopup(false);
    };
    this.cleanups = [
      ctx.services.provide(LAYERS_TARGET_PLUGIN_ID, service),
      ctx.services.require('layers.list').addRowControl(control),
      ctx.events.on('editor:ready', control.repaintAll),
      ctx.events.on('stage:targetsChanged', control.repaintAll),
      ctx.events.on('document:changed', closeIfGone),
      ctx.events.on('document:loaded', closeIfGone)
    ];
  };

  destroy(): void {
    this.closePopup(false);
    const cleanups = this.cleanups;
    this.cleanups = [];
    cleanups.forEach((cleanup) => cleanup());
  }

  /** Ouvre la fenêtre du calque `layerId` ; `false` si ce n'est pas un calque. */
  private openPopup(ctx: IEditorContext, layerId: string, button: HTMLButtonElement, service: ILayerTargetService): boolean {
    this.closePopup(false);
    const layer = findNodeById(ctx.document.layers, layerId);
    if (layer === undefined || !isLayer(layer)) return false;
    const view = openTargetPopup({
      stage: ctx.stage,
      parent: ctx.container,
      anchor: button,
      layerName: layer.name,
      current: layer.target,
      apply: (target) => {
        if (toSavableTarget(target) === undefined) return 'refused';
        return service.setTarget(layerId, target) ? 'applied' : 'unchanged';
      },
      onClose: () => {
        button.setAttribute('aria-expanded', 'false');
        if (this.popup?.view === view) this.popup = null;
      }
    });
    this.popup = { layerId, view };
    button.setAttribute('aria-expanded', 'true');
    return true;
  }

  private closePopup(restoreFocus: boolean): void {
    this.popup?.view.close(restoreFocus);
    this.popup = null;
  }
}
