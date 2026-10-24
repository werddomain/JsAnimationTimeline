// packages/editor/src/plugins/frames/clipboard/clipboardModel.ts
/**
 * Modèle sans DOM de la copie d'images, repris de `copyKeyframes` du legacy
 * (`legacy/core/KeyframeManager.ts`) mais sur le modèle de plages CS4 : le
 * presse-papiers garde les plages (genre, accélération, images clés de
 * propriété) des cellules sélectionnées, pas des valeurs isolées.
 *
 * - `extractSpans` : plages d'un calque entre deux images, coupées aux bords
 *   (voir `spanPieces.ts`), en images relatives ; les images après la
 *   dernière plage deviennent une plage vide ;
 * - `buildClip` : la sélection (cellules triées) devient un `IFrameClip`.
 *   Les suites contiguës d'une ligne sont des « runs » ; leur position est
 *   relative à la plus petite image et à la première ligne de CALQUE
 *   visible copiée (les dossiers ne comptent pas). Le résultat est figé en
 *   profondeur et ne partage rien avec le document.
 */

import type { ILayer, ISpan, ITimelineDocument, PropertyRegistry } from '@werddomain/timeline-runtime';
import type { IVisibleRow } from '../../../model/rows';
import { findLayer } from '../../../model/spans/layerAccess';
import { lastFrame, shiftSpan } from '../../../model/spans/tracks';
import { cellRuns } from '../selection/frameSelection';
import type { IFrameCell } from '../selection/frameSelection';
import { slicePiece } from './spanPieces';
import { FRAME_CLIP_FORMAT, FRAME_CLIP_VERSION } from './types';
import type { IClipRow, IClipRun, IClipSpan, IFrameClip } from './types';

/**
 * Copie figée en profondeur de `value` (objets simples et tableaux) : le
 * presse-papiers ne garde aucune référence vers les objets du document.
 */
function frozenCopy<T>(value: T): T {
  if (typeof value !== 'object' || value === null) return value;
  const copy: unknown = Array.isArray(value)
    ? value.map((item: unknown) => frozenCopy(item))
    : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, frozenCopy(item)]));
  return Object.freeze(copy) as T;
}

/** Plus petite et plus grande valeur de `values` (boucle : pas de limite de pile sur une grande sélection). */
function bounds(values: readonly number[]): { readonly min: number; readonly max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return { min, max };
}

/** Plage en images relatives (la première image copiée devient l'image 1). */
function toClipSpan(span: ISpan, first: number): IClipSpan {
  const { start, end, kind, easing, tracks } = shiftSpan(span, 1 - first);
  return { start, end, kind, ...(easing === undefined ? {} : { easing }), ...(tracks === undefined ? {} : { tracks }) };
}

/** Plage vide `from` à `to`, ajoutée après une dernière plage vide si elle la touche. */
function appendBlank(pieces: readonly ISpan[], from: number, to: number): ISpan[] {
  const previous = pieces[pieces.length - 1];
  if (previous?.kind === 'blank') return [...pieces.slice(0, -1), { ...previous, end: to }];
  return [...pieces, { id: '', start: from, end: to, kind: 'blank' }];
}

/**
 * Plages du calque entre `first` et `last` (images absolues, incluses), en
 * images relatives à `first`. Les images après la dernière plage forment une
 * plage vide ; un calque sans plage donne une seule plage vide.
 */
export function extractSpans(layer: ILayer, first: number, last: number, registry: PropertyRegistry): IClipSpan[] {
  const pieces = layer.spans
    .filter((span) => span.end >= first && span.start <= last)
    .map((span) => slicePiece(layer, span, Math.max(span.start, first), Math.min(span.end, last), registry));
  const covered = lastFrame(layer);
  const all = last > covered ? appendBlank(pieces, Math.max(first, covered + 1), last) : pieces;
  return all.map((piece) => toClipSpan(piece, first));
}

/** Suite d'images copiée sur un calque, avec la ligne qui la porte. */
interface IRunSource {
  readonly layer: ILayer;
  readonly rowIndex: number;
  readonly first: number;
  readonly last: number;
}

function sourcesOf(
  doc: ITimelineDocument,
  rows: readonly IVisibleRow[],
  cells: readonly IFrameCell[]
): IRunSource[] {
  const layerRows = rows.filter((row) => row.kind === 'layer');
  const indexOf = new Map(layerRows.map((row, index) => [row.id, index] as const));
  return cellRuns(cells).flatMap((run) => {
    const layer = findLayer(doc, run.rowId);
    const rowIndex = indexOf.get(run.rowId);
    return layer === undefined || rowIndex === undefined ? [] : [{ layer, rowIndex, first: run.first, last: run.last }];
  });
}

function rowsOf(sources: readonly IRunSource[], firstFrame: number, registry: PropertyRegistry): IClipRow[] {
  const firstRow = bounds(sources.map((source) => source.rowIndex)).min;
  const byRow = new Map<number, IClipRun[]>();
  sources.forEach((source) => {
    const run: IClipRun = {
      frameOffset: source.first - firstFrame,
      length: source.last - source.first + 1,
      spans: extractSpans(source.layer, source.first, source.last, registry)
    };
    const runs = byRow.get(source.rowIndex);
    if (runs === undefined) byRow.set(source.rowIndex, [run]);
    else runs.push(run);
  });
  return [...byRow.entries()]
    .sort(([a], [b]) => a - b)
    .map(([rowIndex, runs]) => ({ rowOffset: rowIndex - firstRow, runs }));
}

/**
 * Contenu du presse-papiers pour les cellules `cells` (triées, ordre
 * d'affichage), ou `undefined` si aucune n'est sur un calque visible.
 * Lève une `SpanOperationError` si une valeur ne peut pas être évaluée.
 */
export function buildClip(
  doc: ITimelineDocument,
  rows: readonly IVisibleRow[],
  cells: readonly IFrameCell[],
  registry: PropertyRegistry
): IFrameClip | undefined {
  const sources = sourcesOf(doc, rows, cells);
  if (sources.length === 0) return undefined;
  const firstFrame = bounds(sources.map((source) => source.first)).min;
  const lastFrameCopied = bounds(sources.map((source) => source.last)).max;
  return frozenCopy<IFrameClip>({
    format: FRAME_CLIP_FORMAT,
    version: FRAME_CLIP_VERSION,
    width: lastFrameCopied - firstFrame + 1,
    rows: rowsOf(sources, firstFrame, registry)
  });
}
