// packages/editor/src/plugins/layers/target/TargetPlugin.ts
/**
 * Plugin : layers.target
 * Epic : layers
 * Dépend de : layers.list
 * Écoute : editor:ready, stage:targetsChanged, document:changed, document:loaded, command:refused
 * Émet : —
 *
 * Cible animée de chaque calque. Un bouton sur la ligne (`order` 40 : après
 * l'œil, 10, le cadenas, 20, et la couleur de Y3, 30) ouvre une fenêtre de
 * choix : les cibles proposées par les scènes, « Choisir sur la scène »
 * (`targets.pick`), ou la saisie d'un sélecteur CSS ou d'une ref. Une ref
 * saisie est rattachée à la scène choisie, à la seule scène quand il n'y en
 * a qu'une, ou garde la scène de la cible courante. Le changement passe par
 * une commande annulable, « Changer la cible du calque », après le contrôle
 * de forme de F06 : une cible vivante `{ element }` n'est jamais enregistrée ;
 * un sélecteur invalide l'est, et le calque devient une cible manquante. Une
 * commande refusée (veto `command:before`) laisse la fenêtre ouverte, avec le
 * motif.
 *
 * Alerte de cible manquante : lue dans `ctx.stage` (`missingTargets` et
 * `warnings`), jamais comptée à partir des `stage:report` ; repeinte au
 * démarrage, à chaque document (par la liste) et quand les cibles manquantes
 * changent (`stage:targetsChanged`, dont `refreshTargets`). Aucune alerte en
 * mode timeline seule (`stage: false`) ni pour un calque sans cible. La cible
 * ne change jamais l'icône du calque. Une fenêtre ouverte est reconstruite
 * quand le nom ou la cible de son calque change (annuler, rétablir), et
 * fermée si le calque disparaît.
 *
 * Lit aussi le noyau `ctx.stage` (C7), réutilise les combinaisons d'annuler /
 * rétablir de `history.undoRedo`, la lecture des touches de
 * `interaction.shortcuts` (voir `historyKeys.ts`) et le placement du menu de
 * `layers.icon` (`menuPosition.ts`), sans dépendre de ces plugins. Une scène
 * qui lève dans `describe` ou `listTargets` ne casse pas la liste : on retombe
 * sur le sélecteur ou la ref.
 *
 * Service `layers.target` : `setTarget`, `alert`, `open`, `close`.
 */

import { findNodeById, isLayer, isRefTarget, isSelectorTarget, sameTarget } from '@werddomain/timeline-runtime';
import type { ILayer, LayerTarget } from '@werddomain/timeline-runtime';
import { CANCELLED_REASON } from '../../../core/commands';
import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import { computeTargetAlert } from './targetAlert';
import type { ITargetAlert } from './targetAlert';
import { createSetTargetCommand } from './targetCommands';
import { createTargetControl } from './targetControl';
import type { ITargetControl } from './targetControl';
import { TargetPopupLabels, openTargetPopup } from './TargetPopup';
import type { ITargetApplyResult, ITargetPopup } from './TargetPopup';
import { toSavableTarget } from './targetValidation';
import './Target.less';

/** Identifiant du plugin, de son service et de son contrôle de ligne. */
export const LAYERS_TARGET_PLUGIN_ID = 'layers.target';

/** Position du contrôle dans la ligne (après l'œil, le cadenas et la couleur). */
export const TARGET_CONTROL_ORDER = 40;

/** Texte d'un calque sans cible. */
export const NO_TARGET_TEXT = 'aucune cible';

/** Motif affiché quand un plugin a opposé un veto (`command:before`) au changement. */
export const TARGET_CANCELLED_MESSAGE = 'La modification a été refusée par un autre module de l\'éditeur.';

/** API publiée sous le service `layers.target`. */
export interface ILayerTargetService {
  /**
   * Donne la cible `target` au calque `id` (commande annulable). `false` si
   * `id` n'est pas un calque, si la cible est refusée par le contrôle de forme
   * (jamais d'élément vivant), si elle ne change pas, ou si la commande est
   * refusée. Ne lève jamais.
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

/** Fenêtre ouverte, avec ce qu'elle montre du calque (pour la reconstruire s'il change). */
interface IOpenPopup {
  readonly layerId: string;
  readonly name: string;
  readonly target: LayerTarget | undefined;
  readonly button: HTMLButtonElement;
  readonly view: ITargetPopup;
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
  private popup: IOpenPopup | null = null;
  /** Motif du dernier refus pendant une application (`command:refused`). */
  private refusal: string | undefined;
  /** Vrai pendant l'exécution de la commande : la fenêtre se ferme juste après, inutile de la reconstruire. */
  private applying = false;

  readonly init = (ctx: IEditorContext): void => {
    const layerOf = (id: string): ILayer | undefined => {
      const node = findNodeById(ctx.document.layers, id);
      return node !== undefined && isLayer(node) ? node : undefined;
    };
    const apply = (id: string, raw: unknown): ITargetApplyResult => this.applyTarget(ctx, layerOf(id), raw);
    const service: ILayerTargetService = {
      setTarget: (id, target) => apply(id, target).kind === 'applied',
      alert: (id) => computeTargetAlert(ctx.stage, id, layerOf(id)?.target),
      open: (id) => {
        const button = control.button(id);
        return button !== undefined && this.openPopup(ctx, id, button, apply);
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
        else this.openPopup(ctx, id, button, apply);
      },
      onDispose: (id) => {
        // La ligne disparaît : son bouton aussi, le focus va à l'éditeur.
        if (this.popup?.layerId === id) this.closePopup(false, true);
      }
    });
    const followDocument = (): void => {
      const open = this.popup;
      if (open === null) return;
      const layer = layerOf(open.layerId);
      if (layer === undefined) this.closePopup(false, true);
      else if (!this.applying && (layer.name !== open.name || !sameTarget(layer.target, open.target))) {
        this.openPopup(ctx, open.layerId, open.button, apply);
      }
    };
    this.cleanups = [
      ctx.services.provide(LAYERS_TARGET_PLUGIN_ID, service),
      ctx.services.require('layers.list').addRowControl(control),
      ctx.events.on('editor:ready', control.repaintAll),
      ctx.events.on('stage:targetsChanged', control.repaintAll),
      ctx.events.on('document:changed', followDocument),
      ctx.events.on('document:loaded', followDocument),
      ctx.events.on('command:refused', (event) => {
        this.refusal = event.reason === CANCELLED_REASON ? TARGET_CANCELLED_MESSAGE : event.reason;
      })
    ];
  };

  destroy(): void {
    this.closePopup(false);
    const cleanups = this.cleanups;
    this.cleanups = [];
    cleanups.forEach((cleanup) => cleanup());
  }

  /**
   * Enregistre `raw` comme cible de `layer` : copie contrôlée une seule fois,
   * puis commande. Ne lève jamais : une cible invalide, une commande qui lève
   * ou un refus donnent `refused` avec un motif ; la même cible, `unchanged`.
   */
  private applyTarget(ctx: IEditorContext, layer: ILayer | undefined, raw: unknown): ITargetApplyResult {
    if (layer === undefined) return { kind: 'refused', message: TargetPopupLabels.refused };
    const target = toSavableTarget(raw);
    if (target === undefined) return { kind: 'refused', message: TargetPopupLabels.refused };
    if (sameTarget(layer.target, target)) return { kind: 'unchanged' };
    this.refusal = undefined;
    this.applying = true;
    try {
      if (ctx.commands.execute(createSetTargetCommand(ctx.document, layer.id, target))) return { kind: 'applied' };
    } catch {
      return { kind: 'refused', message: TARGET_CANCELLED_MESSAGE };
    } finally {
      this.applying = false;
    }
    return { kind: 'refused', message: this.refusal ?? TARGET_CANCELLED_MESSAGE };
  }

  /** Ouvre (ou reconstruit) la fenêtre du calque `layerId` ; `false` si ce n'est pas un calque. */
  private openPopup(
    ctx: IEditorContext,
    layerId: string,
    button: HTMLButtonElement,
    apply: (id: string, raw: unknown) => ITargetApplyResult
  ): boolean {
    this.closePopup(false);
    const layer = findNodeById(ctx.document.layers, layerId);
    if (layer === undefined || !isLayer(layer)) return false;
    const view = openTargetPopup({
      stage: ctx.stage,
      parent: ctx.container,
      anchor: button,
      layerName: layer.name,
      current: layer.target,
      apply: (target) => apply(layerId, target),
      onClose: () => {
        button.setAttribute('aria-expanded', 'false');
        if (this.popup?.view === view) this.popup = null;
      }
    });
    this.popup = { layerId, name: layer.name, target: layer.target, button, view };
    button.setAttribute('aria-expanded', 'true');
    return true;
  }

  private closePopup(restoreFocus: boolean, anchorGone = false): void {
    const open = this.popup;
    this.popup = null;
    open?.view.close(restoreFocus, anchorGone);
  }
}
