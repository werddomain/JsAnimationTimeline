// packages/editor/src/plugins/tweens/motion/resolveTarget.ts
/**
 * Traduit la sélection d'images en cible d'une interpolation, d'après le
 * document. Fonctions pures, sans DOM ni service.
 *
 * Création : toutes les cellules (hors lignes de dossier et images après la
 * dernière plage, ignorées) doivent être sur un seul calque. Parmi elles,
 * les images clés de contenu (début de plage) décident :
 * - aucune : la plage qui contient toutes les cellules (plusieurs plages :
 *   sélection ambiguë) ;
 * - une : la plage de cette image clé ;
 * - deux ou plus : de la première à la dernière.
 *
 * Suppression : les interpolations touchées par les cellules, sur un ou
 * plusieurs calques.
 */

import { findNodeById, isLayer } from '@werddomain/timeline-runtime';
import type { ILayer, ISpan, ITimelineDocument } from '@werddomain/timeline-runtime';
import { spanIndexAt } from '../../../model/spans/tracks';
import type { IFrameCell } from '../../frames/selection/frameSelection';
import type { IMotionTarget } from './createMotionTween';
import { MotionTweenCodes, MotionTweenMessages } from './MotionTweenError';
import type { MotionTweenCode, MotionTweenRefusal } from './MotionTweenError';
import type { IRemoveTarget } from './removeMotionTween';

/** Refus de la résolution (rien n'a été modifié). */
export interface IResolutionRefusal {
  readonly ok: false;
  readonly code: MotionTweenCode;
  readonly message: string;
}

/** Résolution réussie. */
export interface IResolved<T> {
  readonly ok: true;
  readonly target: T;
}

/** Résultat d'une résolution : la cible ou un refus avec son message français. */
export type Resolution<T> = IResolved<T> | IResolutionRefusal;

/** Cellule posée sur une plage d'un calque. */
interface IPlacedCell {
  readonly layer: ILayer;
  readonly span: ISpan;
  readonly frame: number;
}

function refusal(name: MotionTweenRefusal): IResolutionRefusal {
  return { ok: false, code: MotionTweenCodes[name], message: MotionTweenMessages[name] };
}

/** Cellules sur un calque et dans une plage ; les autres ne désignent rien. */
function placeCells(doc: ITimelineDocument, cells: readonly IFrameCell[]): IPlacedCell[] {
  return cells.flatMap((cell) => {
    const layer = findNodeById(doc.layers, cell.rowId);
    if (layer === undefined || !isLayer(layer)) return [];
    const index = spanIndexAt(layer, cell.frame);
    return index === -1 ? [] : [{ layer, span: layer.spans[index], frame: cell.frame }];
  });
}

function singleLayerTarget(placed: readonly IPlacedCell[]): Resolution<IMotionTarget> {
  const layerId = placed[0].layer.id;
  const keyframes = Array.from(new Set(placed.filter((cell) => cell.span.start === cell.frame).map((cell) => cell.frame)));
  keyframes.sort((a, b) => a - b);
  if (keyframes.length >= 2) return { ok: true, target: { layerId, from: keyframes[0], to: keyframes[keyframes.length - 1] } };
  if (keyframes.length === 1) return { ok: true, target: { layerId, from: keyframes[0] } };
  const spans = new Set(placed.map((cell) => cell.span.id));
  return spans.size > 1 ? refusal('AMBIGUOUS_SELECTION') : { ok: true, target: { layerId, from: placed[0].span.start } };
}

/** Cible d'une création d'interpolation d'après les cellules sélectionnées. */
export function resolveCreateTarget(doc: ITimelineDocument, cells: readonly IFrameCell[]): Resolution<IMotionTarget> {
  const placed = placeCells(doc, cells);
  if (placed.length === 0) return refusal('NO_KEYFRAME');
  if (new Set(placed.map((cell) => cell.layer.id)).size > 1) return refusal('MULTIPLE_LAYERS');
  return singleLayerTarget(placed);
}

/** Interpolations touchées par les cellules sélectionnées, groupées par calque. */
export function resolveRemoveTargets(
  doc: ITimelineDocument,
  cells: readonly IFrameCell[]
): Resolution<readonly IRemoveTarget[]> {
  const byLayer = new Map<string, Set<number>>();
  placeCells(doc, cells)
    .filter((cell) => cell.span.kind === 'tween')
    .forEach((cell) => {
      const starts = byLayer.get(cell.layer.id) ?? new Set<number>();
      starts.add(cell.span.start);
      byLayer.set(cell.layer.id, starts);
    });
  if (byLayer.size === 0) return refusal('NO_TWEEN');
  const targets = Array.from(byLayer, ([layerId, starts]) => ({ layerId, frames: Array.from(starts).sort((a, b) => a - b) }));
  return { ok: true, target: targets };
}
