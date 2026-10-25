// packages/editor/src/plugins/toolbar/keyframeActions/keyframeActionsState.ts
/**
 * Pure state calculation for the four keyframe buttons: availability,
 * disabled reasons, deletion routing and edit target. Inputs come from the
 * document, selection and tweens.motion verdicts. Targeting matches
 * F5 / F6 / F7 through keyframeTargets.
 */

import type { ISpan, ITimelineDocument } from '@werddomain/timeline-runtime';
import { keyframeTargets, lockedLayerIds } from '../../frames/keyframes/keyframeTargets';
import type { IFrameCell } from '../../frames/selection/frameSelection';
import type { ISelectedKeyframe } from '../../frames/selection/types';
import type { IMotionTweenAvailability } from '../../tweens/motion/types';
import type { ToolbarEditKeyframeEvent } from './types';

/** Reason shown when no frame or layer is targeted. */
export const NO_TARGET_REASON = 'Sélectionnez une image ou un calque.';

/** Reason shown when every targeted layer is locked. */
export const LOCKED_REASON = 'Le calque est verrouillé.';

/** Reason shown when no keyframe is targeted. */
export const NO_KEYFRAME_REASON = 'Sélectionnez une image clé.';

/** Delete button labels naming the action that will run. */
export const DELETE_LABELS = Object.freeze({
  generic: "Supprimer l'image clé ou l'interpolation",
  property: "Supprimer l'image clé de propriété",
  tween: "Supprimer l'interpolation",
  keyframe: "Supprimer l'image clé"
});

/** Action performed by the Delete button. */
export type DeleteActionKind = 'deleteKeyframe' | 'removeTween';

/** Button availability and optional disabled reason. */
export interface IActionAvailability {
  readonly enabled: boolean;
  readonly reason?: string;
}

/** Resolved deletion action, availability and label. */
export interface IDeleteAction extends IActionAvailability {
  readonly action: DeleteActionKind;
  readonly label: string;
}

/** Payload emitted by the Edit button. */
export type EditTarget = ToolbarEditKeyframeEvent;

/** State calculation inputs. */
export interface IKeyframeActionsInput {
  readonly doc: ITimelineDocument;
  /** Selected cells from frames.selection. */
  readonly cells: readonly IFrameCell[];
  /** Selected keyframes and their kinds, from frames.selection. */
  readonly selectedKeyframes: readonly ISelectedKeyframe[];
  /** Current playhead frame. */
  readonly playheadFrame: number;
  /** Selected layer IDs; undefined when layers.selection is absent. */
  readonly layerIds: readonly string[] | undefined;
  /** Whether the layer carries a content or property keyframe at frame. */
  readonly keyframeAt: (layerId: string, frame: number) => boolean;
  /** Tween containing the frame, from tweens.motion. */
  readonly tweenAt: (layerId: string, frame: number) => ISpan | undefined;
  readonly canCreate: IMotionTweenAvailability;
  readonly canRemove: IMotionTweenAvailability;
}

/** State of the four buttons. */
export interface IKeyframeActionsState {
  readonly insert: IActionAvailability;
  readonly createTween: IActionAvailability;
  readonly delete: IDeleteAction;
  readonly edit: IActionAvailability;
  /** Edit target, absent when the button is unavailable. */
  readonly editTarget?: EditTarget;
}

function availability(source: IMotionTweenAvailability): IActionAvailability {
  return source.enabled || source.reason === undefined ? { enabled: source.enabled } : { enabled: false, reason: source.reason };
}

/** F5 / F6 / F7 targets and their editable subset. */
function targetsOf(input: IKeyframeActionsInput): { all: IFrameCell[]; editable: IFrameCell[] } {
  const all = keyframeTargets(input.doc, {
    cells: input.cells,
    playheadFrame: input.playheadFrame,
    layerIds: input.layerIds
  });
  const locked = lockedLayerIds(input.doc);
  return { all, editable: all.filter((cell) => !locked.has(cell.rowId)) };
}

/** Availability for actions operating on targeted keyframes. */
function keyframePart(all: readonly IFrameCell[], editable: readonly IFrameCell[]): IActionAvailability {
  if (all.length === 0) return { enabled: false, reason: NO_TARGET_REASON };
  if (editable.length === 0) return { enabled: false, reason: LOCKED_REASON };
  return { enabled: true };
}

/** Whether this target is a selected property keyframe inside a tween. */
function isTweenPropertyKeyframe(input: IKeyframeActionsInput, target: IFrameCell): boolean {
  return input.selectedKeyframes.some(
    (keyframe) =>
      keyframe.kind === 'propertyKeyframe' &&
      keyframe.rowId === target.rowId &&
      keyframe.frame === target.frame &&
      input.tweenAt(keyframe.rowId, keyframe.frame) !== undefined
  );
}

/** Whether the target carries a selected or document keyframe. */
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
 * Route Delete without implementing model operations:
 * 1. Any selected property keyframe inside a tween chooses deleteKeyframe(),
 *    including mixed selections on one or several layers. That command
 *    acts on every target, so the property label applies only when every
 *    editable target is a selected property keyframe. Mixed selections use
 *    the general keyframe label. In particular, selecting a tween start
 *    still merges its span into the previous one under the existing CS4
 *    command semantics; the toolbar does not narrow the command's targets.
 * 2. Otherwise, canRemove() chooses remove() when available.
 * 3. Otherwise, use deleteKeyframe(), unavailable with the target reason
 *    or NO_KEYFRAME_REASON when no editable target carries a keyframe.
 *
 * With only a layer selected, canRemove() sees no selected cells: deletion
 * uses the playhead keyframe through deleteKeyframe(). No further model dry
 * run is performed. Unavailable buttons use the generic deletion label.
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

/** Selected keyframes, otherwise playhead keyframes on selected layers. */
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
 * Edit the leftmost editable keyframe on the first targeted row. Targets
 * are selected content/property keyframes, otherwise the playhead keyframe
 * on a selected layer when no cells are selected.
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

/** Compute the four button states for these inputs. */
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
