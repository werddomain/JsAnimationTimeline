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

/** Raison affichée quand « Modifier » n'a aucune image clé à viser. */
export const NO_KEYFRAME_REASON = 'Sélectionnez une image clé.';

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
  /** Vrai si l'image `frame` du calque porte une image clé (contenu ou propriété). */
  readonly keyframeAt: (layerId: string, frame: number) => boolean;
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

/** Vrai si l'image clé de propriété sélectionnée de cette cellule est bien dans une interpolation. */
function isTweenPropertyKeyframe(input: IKeyframeActionsInput, target: IFrameCell): boolean {
  return input.selectedKeyframes.some(
    (keyframe) =>
      keyframe.kind === 'propertyKeyframe' &&
      keyframe.rowId === target.rowId &&
      keyframe.frame === target.frame &&
      input.tweenAt(keyframe.rowId, keyframe.frame) !== undefined
  );
}

/** Vrai si la cellule porte une image clé (sélectionnée, ou lue dans le document). */
function carriesKeyframe(input: IKeyframeActionsInput, target: IFrameCell): boolean {
  return (
    input.keyframeAt(target.rowId, target.frame) ||
    input.selectedKeyframes.some((keyframe) => keyframe.rowId === target.rowId && keyframe.frame === target.frame)
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
 *    `frames.keyframes.deleteKeyframe()` (règle mixte : dès qu'UNE image clé
 *    de propriété est sélectionnée, c'est cette action qui s'exécute, même
 *    avec des cellules d'interpolation simples, sur le même calque ou un
 *    autre). Elle s'applique pourtant à TOUTES les cibles modifiables : le
 *    libellé « de propriété » n'est donc retenu que si chacune est une image
 *    clé de propriété sélectionnée, sinon c'est « Supprimer l'image clé » ;
 * 2. sinon, si `tweens.motion.canRemove()` est actif, `remove()` ;
 * 3. sinon `deleteKeyframe()`, désactivé avec la raison des images clés
 *    quand il n'y a rien à supprimer, ou (`NO_KEYFRAME_REASON`) quand aucune
 *    cible modifiable ne porte d'image clé : sur une simple image d'une
 *    étendue, il ne ferait rien.
 *
 * Avec un calque seul sélectionné (aucune image) et la tête de lecture dans
 * une interpolation, `canRemove` ne lit que les images sélectionnées : le
 * bouton passe par `deleteKeyframe()`, actif seulement si la tête de lecture
 * est sur une image clé. Pas de pré-contrôle du modèle au-delà.
 * Le libellé nomme l'action retenue ; il reste générique quand le bouton est
 * désactivé.
 */
export function resolveDeleteAction(input: IKeyframeActionsInput): IDeleteAction {
  const { all, editable } = targetsOf(input);
  const keyframes = keyframePart(all, editable);
  if (editable.some((target) => isTweenPropertyKeyframe(input, target))) {
    const label = editable.every((target) => isTweenPropertyKeyframe(input, target))
      ? DELETE_LABELS.property
      : DELETE_LABELS.keyframe;
    return deleteFrom(keyframes, label);
  }
  if (input.canRemove.enabled) return { action: 'removeTween', enabled: true, label: DELETE_LABELS.tween };
  if (keyframes.enabled && !editable.some((target) => carriesKeyframe(input, target))) {
    return deleteFrom({ enabled: false, reason: NO_KEYFRAME_REASON }, DELETE_LABELS.keyframe);
  }
  return deleteFrom(keyframes, DELETE_LABELS.keyframe);
}

/** Images clés que « Modifier » peut viser : les images clés sélectionnées, sinon celle de la tête de lecture. */
function keyframeCandidates(input: IKeyframeActionsInput): IFrameCell[] {
  if (input.selectedKeyframes.length > 0) {
    return input.selectedKeyframes.map(({ rowId, frame }) => ({ rowId, frame }));
  }
  if (input.cells.length > 0) return [];
  return (input.layerIds ?? [])
    .map((rowId) => ({ rowId, frame: input.playheadFrame }))
    .filter((cell) => input.keyframeAt(cell.rowId, cell.frame));
}

/**
 * « Modifier » : sur la première ligne d'images clés visées et modifiables,
 * l'image clé la plus à gauche. Les images clés visées sont les images clés
 * sélectionnées (contenu ou propriété), sinon, sans image sélectionnée, la
 * tête de lecture sur un calque sélectionné si elle est sur une image clé.
 */
function editOf(input: IKeyframeActionsInput): { edit: IActionAvailability; editTarget?: EditTarget } {
  const candidates = keyframeCandidates(input);
  if (candidates.length === 0) return { edit: { enabled: false, reason: NO_KEYFRAME_REASON } };
  const locked = lockedLayerIds(input.doc);
  const editable = candidates.filter((cell) => !locked.has(cell.rowId));
  if (editable.length === 0) return { edit: { enabled: false, reason: LOCKED_REASON } };
  const layerId = editable[0].rowId;
  const frame = Math.min(...editable.filter((cell) => cell.rowId === layerId).map((cell) => cell.frame));
  return { edit: { enabled: true }, editTarget: { layerId, frame, inTween: input.tweenAt(layerId, frame) !== undefined } };
}

/** État des quatre boutons pour l'entrée donnée. */
export function computeKeyframeActionsState(input: IKeyframeActionsInput): IKeyframeActionsState {
  const { all, editable } = targetsOf(input);
  const keyframes = keyframePart(all, editable);
  const { edit, editTarget } = editOf(input);
  return {
    insert: keyframes,
    createTween: availability(input.canCreate),
    delete: resolveDeleteAction(input),
    edit,
    ...(editTarget === undefined ? {} : { editTarget })
  };
}
