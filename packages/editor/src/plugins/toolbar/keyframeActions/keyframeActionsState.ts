// packages/editor/src/plugins/toolbar/keyframeActions/keyframeActionsState.ts
/**
 * Disponibilité des quatre boutons d'images clés (fonctions pures, sans DOM
 * ni service) : à partir du document, de la sélection et des verdicts de
 * `tweens.motion`, quels boutons sont actifs, pourquoi les autres ne le sont
 * pas, quelle action « Supprimer » s'exécute et quelle image « Modifier »
 * vise. Les cibles sont celles de F5 / F6 / F7 (`keyframeTargets`).
 */

import type { ISpan, ITimelineDocument } from '@werddomain/timeline-runtime';
import { keyframeTargets, lockedLayerIds } from '../../frames/keyframes/keyframeTargets';
import type { IFrameCell } from '../../frames/selection/frameSelection';
import type { ISelectedKeyframe } from '../../frames/selection/types';
import type { IMotionTweenAvailability } from '../../tweens/motion/types';
import type { ToolbarEditKeyframeEvent } from './types';

/** Raison affichée quand aucune image ni aucun calque n'est visé. */
export const NO_TARGET_REASON = 'Sélectionnez une image ou un calque.';

/** Raison affichée quand tous les calques visés sont verrouillés. */
export const LOCKED_REASON = 'Le calque est verrouillé.';

/** Libellés du bouton « Supprimer » : celui de l'action qui va s'exécuter. */
export const DELETE_LABELS = Object.freeze({
  generic: "Supprimer l'image clé ou l'interpolation",
  property: "Supprimer l'image clé de propriété",
  tween: "Supprimer l'interpolation",
  keyframe: "Supprimer l'image clé"
});

/** Action du bouton « Supprimer ». */
export type DeleteActionKind = 'deleteKeyframe' | 'removeTween';

/** Disponibilité d'un bouton : active, ou désactivée avec la raison. */
export interface IActionAvailability {
  readonly enabled: boolean;
  readonly reason?: string;
}

/** Action « Supprimer » retenue, avec son état et le libellé de ce qu'elle fait. */
export interface IDeleteAction extends IActionAvailability {
  readonly action: DeleteActionKind;
  readonly label: string;
}

/** Ce que le bouton « Modifier » émet. */
export type EditTarget = ToolbarEditKeyframeEvent;

/** Entrées du calcul. */
export interface IKeyframeActionsInput {
  readonly doc: ITimelineDocument;
  /** Images sélectionnées (`frames.selection`). */
  readonly cells: readonly IFrameCell[];
  /** Images clés sélectionnées, avec leur nature (`frames.selection`). */
  readonly selectedKeyframes: readonly ISelectedKeyframe[];
  /** Image de la tête de lecture. */
  readonly playheadFrame: number;
  /** Calques sélectionnés, `undefined` sans le service `layers.selection`. */
  readonly layerIds: readonly string[] | undefined;
  /** Interpolation qui contient l'image (`tweens.motion`). */
  readonly tweenAt: (layerId: string, frame: number) => ISpan | undefined;
  readonly canCreate: IMotionTweenAvailability;
  readonly canRemove: IMotionTweenAvailability;
}

/** État des quatre boutons. */
export interface IKeyframeActionsState {
  readonly insert: IActionAvailability;
  readonly createTween: IActionAvailability;
  readonly delete: IDeleteAction;
  readonly edit: IActionAvailability;
  /** Image visée par « Modifier », absente quand le bouton est désactivé. */
  readonly editTarget?: EditTarget;
}

function availability(source: IMotionTweenAvailability): IActionAvailability {
  return source.enabled || source.reason === undefined ? { enabled: source.enabled } : { enabled: false, reason: source.reason };
}

/** Cibles de F5 / F6 / F7 de l'entrée, et celles qui sont sur des calques modifiables. */
function targetsOf(input: IKeyframeActionsInput): { all: IFrameCell[]; editable: IFrameCell[] } {
  const all = keyframeTargets(input.doc, {
    cells: input.cells,
    playheadFrame: input.playheadFrame,
    layerIds: input.layerIds
  });
  const locked = lockedLayerIds(input.doc);
  return { all, editable: all.filter((cell) => !locked.has(cell.rowId)) };
}

/** Disponibilité des boutons qui agissent sur les images clés visées. */
function keyframePart(all: readonly IFrameCell[], editable: readonly IFrameCell[]): IActionAvailability {
  if (all.length === 0) return { enabled: false, reason: NO_TARGET_REASON };
  if (editable.length === 0) return { enabled: false, reason: LOCKED_REASON };
  return { enabled: true };
}

/** Vrai si une image clé de propriété sélectionnée est bien dans une interpolation. */
function hasPropertyKeyframe(input: IKeyframeActionsInput): boolean {
  return input.selectedKeyframes.some(
    (keyframe) => keyframe.kind === 'propertyKeyframe' && input.tweenAt(keyframe.rowId, keyframe.frame) !== undefined
  );
}

function deleteFrom(keyframes: IActionAvailability, label: string): IDeleteAction {
  if (keyframes.enabled) return { action: 'deleteKeyframe', enabled: true, label };
  return {
    action: 'deleteKeyframe',
    enabled: false,
    ...(keyframes.reason === undefined ? {} : { reason: keyframes.reason }),
    label: DELETE_LABELS.generic
  };
}

/**
 * Aiguille le bouton « Supprimer » (décision d'interface seulement, sans
 * logique de modèle) :
 * 1. si une image clé de propriété sélectionnée est dans une interpolation,
 *    `frames.keyframes.deleteKeyframe()` : seule cette image clé de propriété
 *    part. Règle mixte : dès qu'UNE image clé de propriété est sélectionnée,
 *    c'est cette action qui s'exécute, même si la sélection compte aussi des
 *    cellules d'interpolation simples (sur le même calque ou un autre) ;
 * 2. sinon, si `tweens.motion.canRemove()` est actif, `remove()` ;
 * 3. sinon `deleteKeyframe()`, désactivé avec la raison des images clés
 *    quand il n'y a rien à supprimer.
 * Le libellé nomme l'action retenue ; il reste générique quand le bouton est
 * désactivé.
 */
export function resolveDeleteAction(input: IKeyframeActionsInput): IDeleteAction {
  const { all, editable } = targetsOf(input);
  const keyframes = keyframePart(all, editable);
  if (hasPropertyKeyframe(input)) return deleteFrom(keyframes, DELETE_LABELS.property);
  if (input.canRemove.enabled) return { action: 'removeTween', enabled: true, label: DELETE_LABELS.tween };
  return deleteFrom(keyframes, DELETE_LABELS.keyframe);
}

/**
 * Image visée par « Modifier » : sur la première ligne ciblée et modifiable,
 * l'image la plus à gauche.
 */
function editTargetOf(input: IKeyframeActionsInput, editable: readonly IFrameCell[]): EditTarget | undefined {
  if (editable.length === 0) return undefined;
  const layerId = editable[0].rowId;
  const frame = Math.min(...editable.filter((cell) => cell.rowId === layerId).map((cell) => cell.frame));
  return { layerId, frame, inTween: input.tweenAt(layerId, frame) !== undefined };
}

/** État des quatre boutons pour l'entrée donnée. */
export function computeKeyframeActionsState(input: IKeyframeActionsInput): IKeyframeActionsState {
  const { all, editable } = targetsOf(input);
  const keyframes = keyframePart(all, editable);
  const editTarget = editTargetOf(input, editable);
  return {
    insert: keyframes,
    createTween: availability(input.canCreate),
    delete: resolveDeleteAction(input),
    edit: keyframes,
    ...(editTarget === undefined ? {} : { editTarget })
  };
}
