// packages/editor/src/plugins/frames/grid/gridCells.ts
/**
 * Calculs sans DOM de `frames.grid`, repris de la classification image par
 * image de `legacy/ui/TimelineGrid.ts` (`renderFrames`) et adaptés au modèle
 * v2 des plages (static, blank, tween) :
 * - les morceaux d'une ligne (une plage, la fin vide de la timeline ou une
 *   ligne de dossier), coupés à la plage d'images affichée ;
 * - les marques d'une ligne : image clé de début de plage (pleine, ou creuse
 *   sur une plage vide), images clés de propriété d'une interpolation
 *   (losanges) et fin d'une plage statique ou vide ;
 * - la fenêtre affichée (images et lignes visibles, avec une marge), pour
 *   ne dessiner que la partie visible d'un grand document.
 */

import { isFolder } from '@werddomain/timeline-runtime';
import type { ISpan, LayerNode } from '@werddomain/timeline-runtime';

/**
 * Nature d'un morceau de ligne :
 * - `static`, `blank`, `tween` : une plage du calque ;
 * - `empty` : images après la dernière plage (ou calque sans plage) ;
 * - `folder` : ligne d'un dossier (aucune image).
 */
export type GridSegmentKind = ISpan['kind'] | 'empty' | 'folder';

/** Morceau contigu d'une ligne, dans les images affichées. */
export interface IGridSegment {
  readonly kind: GridSegmentKind;
  /** Première image affichée du morceau (incluse). */
  readonly start: number;
  /** Dernière image affichée du morceau (incluse). */
  readonly end: number;
  /** Id de la plage ; absent pour `empty` et `folder`. */
  readonly spanId?: string;
  /** Première image de la plage entière (non coupée) ; absente pour `empty` et `folder`. */
  readonly spanStart?: number;
  /** Dernière image de la plage entière (non coupée) ; absente pour `empty` et `folder`. */
  readonly spanEnd?: number;
}

/**
 * Nature d'une marque :
 * - `keyframe` : image clé de contenu (début d'une plage statique ou interpolée) ;
 * - `blankKeyframe` : image clé vide (début d'une plage vide) ;
 * - `propertyKeyframe` : image clé de propriété dans une interpolation (losange) ;
 * - `spanEnd` : dernière image d'une plage statique ou vide de plus d'une image.
 */
export type GridMarkKind = 'keyframe' | 'blankKeyframe' | 'propertyKeyframe' | 'spanEnd';

/** Marque posée sur une image d'une ligne. */
export interface IGridMark {
  readonly kind: GridMarkKind;
  readonly frame: number;
  readonly spanId: string;
}

/** Intervalle inclus d'images, à partir de 1. */
export interface IFrameRange {
  readonly first: number;
  readonly last: number;
}

/** Intervalle inclus d'index de lignes, à partir de 0 ; vide si `last < first`. */
export interface IRowRange {
  readonly first: number;
  readonly last: number;
}

/** Images ajoutées de chaque côté de la partie visible (défilement sans trou). */
export const FRAME_OVERSCAN = 20;
/** Lignes ajoutées au-dessus et au-dessous de la partie visible. */
export const ROW_OVERSCAN = 5;
/** Images dessinées tant que la zone n'a pas de largeur mesurée. */
export const UNMEASURED_FRAMES = 120;
/** Lignes dessinées tant que la zone n'a pas de hauteur mesurée. */
export const UNMEASURED_ROWS = 40;

function bound(range: IFrameRange, totalFrames: number): IFrameRange {
  return { first: Math.max(1, range.first), last: Math.min(totalFrames, range.last) };
}

function clip(start: number, end: number, range: IFrameRange): { start: number; end: number } | undefined {
  const first = Math.max(start, range.first);
  const last = Math.min(end, range.last);
  return first <= last ? { start: first, end: last } : undefined;
}

/**
 * Morceaux de la ligne `node` dans `range`, de gauche à droite. Les images
 * qu'aucune plage ne couvre (après la dernière, ou un trou d'un document
 * mal formé) donnent un morceau `empty`.
 */
export function rowSegments(node: LayerNode, totalFrames: number, range: IFrameRange): IGridSegment[] {
  const bounded = bound(range, totalFrames);
  if (bounded.first > bounded.last) return [];
  if (isFolder(node)) return [{ kind: 'folder', start: bounded.first, end: bounded.last }];
  const segments: IGridSegment[] = [];
  let next = 1;
  const pushEmpty = (end: number): void => {
    const part = clip(next, end, bounded);
    if (part !== undefined) segments.push({ kind: 'empty', ...part });
  };
  for (const span of node.spans) {
    if (span.start > totalFrames) break;
    if (span.start > next) pushEmpty(span.start - 1);
    const part = clip(span.start, span.end, bounded);
    if (part !== undefined) {
      segments.push({ kind: span.kind, ...part, spanId: span.id, spanStart: span.start, spanEnd: span.end });
    }
    next = Math.max(next, span.end + 1);
  }
  if (next <= totalFrames) pushEmpty(totalFrames);
  return segments;
}

/** Images clés de propriété d'une interpolation, sans son image de début, triées. */
function propertyKeyframes(span: ISpan): number[] {
  const frames = new Set<number>();
  Object.values(span.tracks ?? {}).forEach((track) =>
    track.forEach((keyframe) => {
      if (keyframe.frame > span.start && keyframe.frame <= span.end) frames.add(keyframe.frame);
    })
  );
  return Array.from(frames).sort((a, b) => a - b);
}

/** Marques d'une plage, avant le filtrage par la plage d'images affichée. */
function spanMarks(span: ISpan): IGridMark[] {
  const marks: IGridMark[] = [
    { kind: span.kind === 'blank' ? 'blankKeyframe' : 'keyframe', frame: span.start, spanId: span.id }
  ];
  if (span.kind === 'tween') {
    propertyKeyframes(span).forEach((frame) => marks.push({ kind: 'propertyKeyframe', frame, spanId: span.id }));
  } else if (span.end > span.start) {
    marks.push({ kind: 'spanEnd', frame: span.end, spanId: span.id });
  }
  return marks;
}

/** Marques de la ligne `node` dans `range` (aucune pour un dossier), de gauche à droite. */
export function rowMarks(node: LayerNode, totalFrames: number, range: IFrameRange): IGridMark[] {
  if (isFolder(node)) return [];
  const bounded = bound(range, totalFrames);
  return node.spans
    .flatMap(spanMarks)
    .filter((mark) => mark.frame >= bounded.first && mark.frame <= bounded.last);
}

/**
 * Images à dessiner pour une zone qui montre `viewportWidth` pixels à partir
 * de `scrollLeft`, avec `overscan` images de marge (`FRAME_OVERSCAN` par défaut). Sans largeur
 * mesurée (zone pas encore mise en page), les `UNMEASURED_FRAMES` premières
 * images à partir de la position.
 */
export function visibleFrameRange(
  scrollLeft: number,
  viewportWidth: number,
  frameWidth: number,
  totalFrames: number,
  overscan: number = FRAME_OVERSCAN
): IFrameRange {
  const firstVisible = Math.floor(Math.max(0, scrollLeft) / frameWidth) + 1;
  const count = viewportWidth > 0 ? Math.ceil(viewportWidth / frameWidth) : UNMEASURED_FRAMES;
  const last = Math.min(totalFrames, firstVisible + count + overscan);
  const first = Math.min(Math.max(1, firstVisible - overscan), Math.max(1, last));
  return { first, last };
}

/**
 * Index des lignes à dessiner pour une zone qui montre `viewportHeight`
 * pixels à partir de `scrollTop`, avec `overscan` lignes de marge (`ROW_OVERSCAN` par défaut).
 */
export function visibleRowRange(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  rowCount: number,
  overscan: number = ROW_OVERSCAN
): IRowRange {
  const firstVisible = Math.floor(Math.max(0, scrollTop) / rowHeight);
  const count = viewportHeight > 0 ? Math.ceil(viewportHeight / rowHeight) : UNMEASURED_ROWS;
  return {
    first: Math.max(0, Math.min(firstVisible - overscan, rowCount - 1)),
    last: Math.min(rowCount - 1, firstVisible + count + overscan)
  };
}

/**
 * Vrai si `inner` est entièrement dans `outer` (images et lignes). Une
 * fenêtre de lignes vide est contenue dans toute fenêtre.
 */
export function rangeContains(outer: IFrameRange, inner: IFrameRange): boolean {
  return inner.last < inner.first || (inner.first >= outer.first && inner.last <= outer.last);
}
