// packages/editor/src/plugins/frames/keyframes/keyframeActions.ts
/**
 * Actions de `frames.keyframes` sur le contexte de l'éditeur : F5 / F6 / F7
 * et leurs inverses (un lot par action) et déplacement des images clés
 * sélectionnées. Chaque action exécute une seule commande : une entrée
 * d'historique, tout ou rien.
 *
 * `commands.execute` retourne `false` aussi bien pour un refus (annoncé par
 * `command:refused`) que pour une commande sans effet : le résultat se lit
 * donc dans la référence du document.
 */

import type { IEditorContext } from '../../../core/context/IEditorContext';
import { CommandRefusedError } from '../../../core/commands/CommandRefusedError';
import { createCommand } from '../../../core/commands/createCommand';
import type { ICommand } from '../../../core/commands/ICommand';
import { SpanCommandLabels } from '../../../model/spans';
import type { ISpanCommands } from '../../../model/spans';
import type { IFrameCell } from '../selection/frameSelection';
import type { ISelectedKeyframe } from '../selection/types';
// Types seulement : le service optionnel layers.selection.
import type {} from '../../layers/selection/types';
import { batchCommand } from './batchCommand';
import { clampOffset, landedCells, movableKeyframes, overwritesKeyframe, planMove } from './keyframeMove';
import type { IPlannedMove } from './keyframeMove';
import { insertFrameTargets, keyframeTargets } from './keyframeTargets';

/** Actions de plage sur les images visées. */
export type SpanAction = 'insertKeyframe' | 'insertBlankKeyframe' | 'deleteKeyframe' | 'insertFrame' | 'removeFrame';

const ACTION_LABELS: Readonly<Record<SpanAction, string>> = Object.freeze({
  insertKeyframe: SpanCommandLabels.INSERT_KEYFRAME,
  insertBlankKeyframe: SpanCommandLabels.INSERT_BLANK_KEYFRAME,
  deleteKeyframe: SpanCommandLabels.DELETE_KEYFRAME,
  insertFrame: SpanCommandLabels.INSERT_FRAME,
  removeFrame: SpanCommandLabels.REMOVE_FRAME
});

/** Exécute `command` ; vrai si le document a changé. */
function executeChanged(ctx: IEditorContext, command: ICommand): boolean {
  const before = ctx.document;
  ctx.commands.execute(command);
  return ctx.document !== before;
}

/** Lot d'une action sur les images visées (sélection, sinon tête de lecture sur les calques). */
function actionBatch(ctx: IEditorContext, commands: ISpanCommands, action: SpanAction): ICommand | undefined {
  const all = keyframeTargets(ctx.document, {
    cells: ctx.services.require('frames.selection').cells(),
    playheadFrame: ctx.playback.frame,
    layerIds: ctx.services.get('layers.selection')?.selected()
  });
  const targets = action === 'insertFrame' ? insertFrameTargets(ctx.document, all) : all;
  return batchCommand(
    ACTION_LABELS[action],
    targets.map((target) => commands[action](target.rowId, target.frame))
  );
}

/** Exécute `action` ; vrai si le document a changé. */
export function runSpanAction(ctx: IEditorContext, commands: ISpanCommands, action: SpanAction): boolean {
  const batch = actionBatch(ctx, commands, action);
  return batch !== undefined && executeChanged(ctx, batch);
}

/** Lot des déplacements `moves`, ou `undefined` s'il n'y en a aucun. */
export function moveBatch(commands: ISpanCommands, moves: readonly IPlannedMove[]): ICommand | undefined {
  return batchCommand(
    SpanCommandLabels.MOVE_KEYFRAME,
    moves.map((move) => commands.moveKeyframe(move.rowId, move.from, move.to))
  );
}

/** Exécute une commande qui refuse avec `reason` : `command:refused` annonce le refus. */
function refuse(ctx: IEditorContext, reason: string): false {
  const label = SpanCommandLabels.MOVE_KEYFRAME;
  ctx.commands.execute(
    createCommand(
      label,
      () => {
        throw new CommandRefusedError(label, reason);
      },
      (doc) => doc
    )
  );
  return false;
}

/** Raison du refus d'un déplacement qui écraserait une image clé de propriété. */
export const OVERWRITE_REASON = "L'image clé arriverait sur une autre image clé de propriété, qui serait remplacée.";

/**
 * Déplace `keyframes` de `offset` images (déjà borné) et, si le document a
 * changé, reconstruit la sélection d'après la place réelle des images
 * (voir `landedCells`).
 */
export function moveKeyframes(
  ctx: IEditorContext,
  commands: ISpanCommands,
  keyframes: readonly ISelectedKeyframe[],
  cells: readonly IFrameCell[],
  offset: number
): boolean {
  if (offset === 0) return false;
  const before = ctx.document;
  const moves = planMove(before, keyframes, offset);
  if (overwritesKeyframe(before, moves)) return refuse(ctx, OVERWRITE_REASON);
  const first = keyframes[0];
  // Toutes les images clés sont sur des lignes verrouillées : le refus de K1 l'explique.
  if (moves.length === 0 && first !== undefined) {
    ctx.commands.execute(commands.moveKeyframe(first.rowId, first.frame, first.frame + offset));
    return false;
  }
  const batch = moveBatch(commands, moves);
  if (batch === undefined || !executeChanged(ctx, batch)) return false;
  ctx.services.require('frames.selection').set(landedCells(before, ctx.document, keyframes, cells, moves, offset));
  return true;
}

/** Déplace les images clés sélectionnées de `offset` images, borné à la timeline. */
export function moveSelectedKeyframes(ctx: IEditorContext, commands: ISpanCommands, offset: number): boolean {
  const selection = ctx.services.require('frames.selection');
  const keyframes = selection.keyframes();
  const movable = movableKeyframes(ctx.document, keyframes);
  // Toutes sur des lignes verrouillées : bornes calculées sur elles, pour que le refus de K1 s'affiche.
  const bounded = clampOffset(offset, movable.length > 0 ? movable : keyframes, ctx.document.settings.totalFrames);
  return moveKeyframes(ctx, commands, keyframes, selection.cells(), bounded);
}
