// packages/editor/src/plugins/frames/keyframes/keyframeMove.ts
/**
 * Calcul pur du déplacement des images clés sélectionnées : bornes du
 * décalage, déplacements à enchaîner (par ligne, dans un ordre où aucun ne
 * gêne le suivant) et nouvelle sélection.
 */

import { findNodeById, isLayer } from '@kazo-ca/timeline-runtime';
import type { ISpan, ITimelineDocument } from '@kazo-ca/timeline-runtime';
import type { IFrameCell } from '../selection/frameSelection';
import type { ISelectedKeyframe } from '../selection/types';
import { retimeKeyframes } from '../../../model/spans/tracks';
import { lockedLayerIds } from './keyframeTargets';

/** Un déplacement d'image clé : `moveKeyframe(rowId, from, to)`. */
export interface IPlannedMove {
  readonly rowId: string;
  readonly from: number;
  readonly to: number;
}

/** Ramène `offset` dans [1 - première image, `totalFrames` - dernière image] ; 0 sans image clé. */
export function clampOffset(offset: number, keyframes: readonly Pick<ISelectedKeyframe, 'frame'>[], totalFrames: number): number {
  if (keyframes.length === 0) return 0;
  // Boucle (et non Math.min(...)) : une très grande sélection dépasserait la pile d'appel.
  let first = Infinity;
  let last = -Infinity;
  for (const keyframe of keyframes) {
    first = Math.min(first, keyframe.frame);
    last = Math.max(last, keyframe.frame);
  }
  const min = 1 - first;
  const max = totalFrames - last;
  return Math.min(Math.max(offset, min), max);
}

/** Images clés des lignes modifiables (ni verrouillées, ni sous un dossier verrouillé). */
export function movableKeyframes(doc: ITimelineDocument, keyframes: readonly ISelectedKeyframe[]): ISelectedKeyframe[] {
  const locked = lockedLayerIds(doc);
  return keyframes.filter((keyframe) => !locked.has(keyframe.rowId));
}

function groupByRow(keyframes: readonly ISelectedKeyframe[]): Map<string, ISelectedKeyframe[]> {
  const rows = new Map<string, ISelectedKeyframe[]>();
  keyframes.forEach((keyframe) => {
    const row = rows.get(keyframe.rowId);
    if (row === undefined) rows.set(keyframe.rowId, [keyframe]);
    else row.push(keyframe);
  });
  return rows;
}

/**
 * Ids des plages que le déplacement d'une image clé de contenu redimensionne
 * (la sienne et la précédente) : leurs images clés de propriété sont déjà
 * recalées, les déplacer en plus les décalerait deux fois.
 */
function resizedSpanIds(doc: ITimelineDocument, rowId: string, row: readonly ISelectedKeyframe[]): ReadonlySet<string> {
  const node = findNodeById(doc.layers, rowId);
  const spans = node !== undefined && isLayer(node) ? node.spans : [];
  const indexById = new Map(spans.map((span, index) => [span.id, index] as const));
  const ids = new Set<string>();
  row
    .filter((keyframe) => keyframe.kind !== 'propertyKeyframe')
    .forEach((keyframe) => {
      const index = indexById.get(keyframe.spanId);
      if (index === undefined) return;
      ids.add(spans[index].id);
      if (index > 0) ids.add(spans[index - 1].id);
    });
  return ids;
}

/** Déplacements d'une ligne : à droite d'abord pour un décalage positif, à gauche d'abord sinon. */
function rowMoves(doc: ITimelineDocument, rowId: string, row: readonly ISelectedKeyframe[], offset: number): IPlannedMove[] {
  const resized = resizedSpanIds(doc, rowId, row);
  return row
    .filter((keyframe) => keyframe.kind !== 'propertyKeyframe' || !resized.has(keyframe.spanId))
    .map((keyframe) => keyframe.frame)
    .sort((a, b) => (offset > 0 ? b - a : a - b))
    .map((frame) => ({ rowId, from: frame, to: frame + offset }));
}

/** Déplacements à exécuter pour décaler `keyframes` de `offset` images (aucun si `offset` vaut 0). */
export function planMove(doc: ITimelineDocument, keyframes: readonly ISelectedKeyframe[], offset: number): IPlannedMove[] {
  if (offset === 0) return [];
  const rows = groupByRow(movableKeyframes(doc, keyframes));
  return Array.from(rows.entries()).flatMap(([rowId, row]) => rowMoves(doc, rowId, row, offset));
}

/** Images clés de propriété de la plage qui contient `frame` (hors image de début). */
function propertyFramesAround(spans: readonly ISpan[], frame: number): ReadonlySet<number> | undefined {
  const span = spans.find((candidate) => frame >= candidate.start && frame <= candidate.end);
  if (span === undefined || span.start === frame) return undefined;
  const frames = new Set<number>();
  Object.values(span.tracks ?? {}).forEach((track) => track.forEach((keyframe) => frames.add(keyframe.frame)));
  return frames;
}

/**
 * Vrai si un déplacement d'image clé de propriété arriverait sur une autre
 * image clé de propriété qui n'est pas elle-même déplacée : K1 la
 * remplacerait sans prévenir. Le glisser et `move` refusent ce cas.
 */
export function overwritesKeyframe(doc: ITimelineDocument, moves: readonly IPlannedMove[]): boolean {
  const sourcesByRow = new Map<string, Set<number>>();
  moves.forEach((move) => {
    const sources = sourcesByRow.get(move.rowId) ?? new Set<number>();
    sources.add(move.from);
    sourcesByRow.set(move.rowId, sources);
  });
  return moves.some((move) => {
    const node = findNodeById(doc.layers, move.rowId);
    if (node === undefined || !isLayer(node)) return false;
    const existing = propertyFramesAround(node.spans, move.from);
    return existing !== undefined && existing.has(move.to) && sourcesByRow.get(move.rowId)?.has(move.to) !== true;
  });
}

/** Image d'arrivée d'une image clé de propriété recalée avec sa plage (même calcul que K1). */
function retimedFrame(before: ITimelineDocument, after: ITimelineDocument, keyframe: ISelectedKeyframe): number {
  const spanOf = (doc: ITimelineDocument): ISpan | undefined => {
    const node = findNodeById(doc.layers, keyframe.rowId);
    return node !== undefined && isLayer(node) ? node.spans.find((span) => span.id === keyframe.spanId) : undefined;
  };
  const from = spanOf(before);
  const to = spanOf(after);
  if (from === undefined || to === undefined) return keyframe.frame;
  const probe = retimeKeyframes({ probe: [{ frame: keyframe.frame, value: 0 }] }, from, to);
  return probe?.probe?.[0]?.frame ?? keyframe.frame;
}

/**
 * Nouvelle sélection d'après la place réelle des images après le
 * déplacement : une image clé déplacée va à sa destination, une image clé
 * de propriété recalée par K1 (plage redimensionnée) va où K1 l'a mise, les
 * autres images des lignes déplacées sont décalées de `offset`, et les
 * lignes non déplacées (verrouillées) ne bougent pas.
 */
export function landedCells(
  before: ITimelineDocument,
  after: ITimelineDocument,
  keyframes: readonly ISelectedKeyframe[],
  cells: readonly IFrameCell[],
  moves: readonly IPlannedMove[],
  offset: number
): IFrameCell[] {
  const movedRows = new Set(moves.map((move) => move.rowId));
  const destination = new Map<string, number>(moves.map((move) => [`${move.rowId}:${move.from}`, move.to] as const));
  const keyframeAt = new Map<string, ISelectedKeyframe>(keyframes.map((keyframe) => [`${keyframe.rowId}:${keyframe.frame}`, keyframe] as const));
  return cells.map((cell) => {
    if (!movedRows.has(cell.rowId)) return cell;
    const key = `${cell.rowId}:${cell.frame}`;
    const to = destination.get(key);
    if (to !== undefined) return { rowId: cell.rowId, frame: to };
    const keyframe = keyframeAt.get(key);
    if (keyframe?.kind === 'propertyKeyframe') return { rowId: cell.rowId, frame: retimedFrame(before, after, keyframe) };
    return { rowId: cell.rowId, frame: cell.frame + offset };
  });
}
