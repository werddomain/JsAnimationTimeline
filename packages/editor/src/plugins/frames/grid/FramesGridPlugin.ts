// packages/editor/src/plugins/frames/grid/FramesGridPlugin.ts
/**
 * Plugin : frames.grid
 * Epic : frames
 * Dépend de : layout.shell, layout.scrollSync, layout.ruler
 * Écoute : document:loaded, document:changed, layers:rowsChanged, layout:scrolled, zoom:changed
 * Émet : frames:gridRendered
 *
 * Grille des images, reprise de `legacy/ui/TimelineGrid.ts` : une ligne par
 * ligne visible (`visibleRows`, mêmes lignes et même ordre que la liste des
 * calques), et dans chaque ligne ses plages (statique, vide, interpolation),
 * la fin vide de la timeline, les images clés (pleines ou creuses), les
 * images clés de propriété d'une interpolation (losanges) et la fin des
 * plages statiques ou vides.
 *
 * Différences avec le legacy :
 * - un élément par plage (et non par image) : les traits des images et la
 *   teinte des colonnes multiples de 5 sont des fonds CSS, à la largeur
 *   `--jt-grid-frame-width` ;
 * - seule la partie visible est dessinée (avec une marge), d'après
 *   `layout:scrolled` : un grand document reste léger ;
 * - la grille ne gère ni la sélection, ni le glisser, ni le menu contextuel :
 *   les plugins `frames.selection`, `frames.keyframes`... s'appuient sur son
 *   service (`cellAt`, `element`) et sur `frames:gridRendered`.
 *
 * Alignement sur la règle : la largeur et la position des images viennent du
 * service `layout.ruler` (`frameWidth`, `frameLeft`), relus à chaque dessin.
 * `zoom:changed` (émis par L3, après la mise à jour de la règle) fait
 * redessiner la grille. La grille ne touche jamais aux cibles ni
 * à la scène.
 *
 * `layers:rowsChanged` (de `layers.list`) est écouté sans dépendance : la
 * grille fonctionne aussi sans la liste des calques.
 */

import type { ITimelineDocument, LayerNode } from '@kazo-ca/timeline-runtime';
import { walkLayers } from '@kazo-ca/timeline-runtime';
import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import { ROW_HEIGHT, visibleRows } from '../../../model/rows';
import type { IVisibleRow } from '../../../model/rows';
import type { IRulerApi } from '../../layout/ruler/RulerPlugin';
import type { IScrollState } from '../../layout/scrollSync/scrollGeometry';
import { LAYOUT_SLOTS } from '../../layout/shell/layoutSlots';
// Types seulement : événements écoutés (layers:rowsChanged, layout:scrolled, zoom:changed).
import type {} from '../../layers/list/types';
import type {} from '../../layout/scrollSync/ScrollSyncPlugin';
import type {} from '../../layout/zoom/zoomEvents';
import { rangeContains, rowMarks, rowSegments, visibleFrameRange, visibleRowRange } from './gridCells';
import type { IGridCell, IGridWindow } from './types';
import './FramesGrid.less';

/** Identifiant du plugin (et de son service). */
export const FRAMES_GRID_PLUGIN_ID = 'frames.grid';

/** Classes CSS de la grille (le reste se déduit : `jt-grid__span--tween`...). */
export const FRAMES_GRID_CLASSES = Object.freeze({
  grid: 'jt-grid',
  rows: 'jt-grid__rows',
  row: 'jt-grid__row',
  span: 'jt-grid__span',
  mark: 'jt-grid__mark'
});

/** Lignes d'un document, avec le nœud de chaque ligne. */
interface IRowsCache {
  readonly document: ITimelineDocument;
  readonly rows: readonly IVisibleRow[];
  readonly nodes: ReadonlyMap<string, LayerNode>;
}

/** Ce qui a servi au dernier dessin (pour ne pas redessiner à l'identique). */
interface IDrawnState {
  readonly document: ITimelineDocument;
  readonly frameWidth: number;
  readonly window: IGridWindow;
}

const EMPTY_SCROLL: IScrollState = { scrollLeft: 0, scrollTop: 0, viewportWidth: 0, viewportHeight: 0 };
const EMPTY_WINDOW: IGridWindow = { frames: { first: 1, last: 0 }, rows: { first: 0, last: -1 } };

/** Vrai si la partie visible `visible` est entièrement dessinée dans `drawn`. */
function covers(drawn: IGridWindow, visible: IGridWindow): boolean {
  return rangeContains(drawn.frames, visible.frames) && rangeContains(drawn.rows, visible.rows);
}

function buildRows(document: ITimelineDocument): IRowsCache {
  const nodes = new Map<string, LayerNode>();
  walkLayers(document.layers, ({ node }) => void nodes.set(node.id, node));
  return { document, rows: visibleRows(document), nodes };
}

/** Dessine les plages, la fin vide et les images clés de chaque ligne visible. */
export class FramesGridPlugin implements EditorPlugin {
  readonly id = 'frames.grid';
  readonly dependencies: readonly string[] = ['layout.shell', 'layout.scrollSync', 'layout.ruler'];
  readonly slot = LAYOUT_SLOTS.frames;

  private ctx: IEditorContext | undefined;
  private scroll: IScrollState = EMPTY_SCROLL;
  private cache: IRowsCache | undefined;
  private drawn: IDrawnState | undefined;
  private grid: HTMLElement | undefined;
  private rowsLayer: HTMLElement | undefined;
  private cleanups: Array<() => void> = [];

  readonly init = (ctx: IEditorContext): void => {
    this.ctx = ctx;
    const update = (): void => this.update(false);
    this.cleanups = [
      ctx.services.provide('frames.grid', {
        frameWidth: () => this.ruler().frameWidth(),
        rowHeight: () => ROW_HEIGHT,
        rows: () => this.rowsCache().rows,
        window: () => this.drawn?.window ?? EMPTY_WINDOW,
        cellAt: (clientX, clientY) => this.cellAt(clientX, clientY),
        element: () => this.grid,
        refresh: () => this.update(true)
      }),
      ctx.events.on('document:loaded', update),
      ctx.events.on('document:changed', update),
      ctx.events.on('layers:rowsChanged', update),
      ctx.events.on('layout:scrolled', (state) => {
        this.scroll = state;
        this.update(false);
      }),
      ctx.events.on('zoom:changed', () => this.onZoom())
    ];
  };

  render(slot: HTMLElement): void {
    const ctx = this.requireContext();
    const doc = slot.ownerDocument;
    const grid = doc.createElement('div');
    grid.className = FRAMES_GRID_CLASSES.grid;
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', 'Grille des images');
    const rowsLayer = doc.createElement('div');
    rowsLayer.className = FRAMES_GRID_CLASSES.rows;
    grid.appendChild(rowsLayer);
    slot.appendChild(grid);
    this.grid = grid;
    this.rowsLayer = rowsLayer;
    this.scroll = ctx.services.require('layout.scrollSync').getScroll();
    this.update(true);
  }

  destroy(): void {
    const cleanups = this.cleanups;
    this.cleanups = [];
    cleanups.forEach((cleanup) => cleanup());
    this.grid?.remove();
    this.grid = undefined;
    this.rowsLayer = undefined;
    this.cache = undefined;
    this.drawn = undefined;
    this.ctx = undefined;
  }

  /**
   * Après un zoom : redessine (toujours, même si la règle n'a pas encore pris
   * la nouvelle largeur), puis demande une nouvelle mesure (la taille du
   * contenu a changé) ; le `layout:scrolled` qui suit corrige la fenêtre.
   */
  private onZoom(): void {
    this.update(true);
    this.ctx?.services.get('layout.scrollSync')?.refresh();
  }

  private ruler(): IRulerApi {
    return this.requireContext().services.require('layout.ruler');
  }

  private rowsCache(): IRowsCache {
    const document = this.requireContext().document;
    if (this.cache?.document !== document) this.cache = buildRows(document);
    return this.cache;
  }

  /** Fenêtre à dessiner (partie visible et sa marge), ou partie visible seule si `overscan` vaut false. */
  private currentWindow(cache: IRowsCache, frameWidth: number, overscan: boolean): IGridWindow {
    const { totalFrames } = cache.document.settings;
    const { scrollLeft, scrollTop, viewportWidth, viewportHeight } = this.scroll;
    return overscan
      ? {
          frames: visibleFrameRange(scrollLeft, viewportWidth, frameWidth, totalFrames),
          rows: visibleRowRange(scrollTop, viewportHeight, ROW_HEIGHT, cache.rows.length)
        }
      : {
          frames: visibleFrameRange(scrollLeft, viewportWidth, frameWidth, totalFrames, 0),
          rows: visibleRowRange(scrollTop, viewportHeight, ROW_HEIGHT, cache.rows.length, 0)
        };
  }

  /**
   * Redessine la fenêtre si le document ou la largeur a changé, si la partie
   * visible sort de la fenêtre dessinée (la marge évite de redessiner à
   * chaque pas de défilement), ou si `force`.
   */
  private update(force: boolean): void {
    const grid = this.grid;
    const rowsLayer = this.rowsLayer;
    if (grid === undefined || rowsLayer === undefined) return;
    const cache = this.rowsCache();
    const frameWidth = this.ruler().frameWidth();
    const drawn = this.drawn;
    if (
      !force &&
      drawn !== undefined &&
      drawn.document === cache.document &&
      drawn.frameWidth === frameWidth &&
      covers(drawn.window, this.currentWindow(cache, frameWidth, false))
    ) {
      return;
    }
    const window = this.currentWindow(cache, frameWidth, true);
    this.draw(grid, rowsLayer, cache, window, frameWidth);
    this.drawn = { document: cache.document, frameWidth, window };
    this.requireContext().events.emit('frames:gridRendered', { window, frameWidth, rowHeight: ROW_HEIGHT });
  }

  private draw(
    grid: HTMLElement,
    rowsLayer: HTMLElement,
    cache: IRowsCache,
    window: IGridWindow,
    frameWidth: number
  ): void {
    const { totalFrames } = cache.document.settings;
    grid.style.width = `${this.ruler().frameLeft(totalFrames + 1)}px`;
    grid.style.height = `${cache.rows.length * ROW_HEIGHT}px`;
    grid.style.setProperty('--jt-grid-frame-width', `${frameWidth}px`);
    const fragment = grid.ownerDocument.createDocumentFragment();
    for (let index = window.rows.first; index <= window.rows.last; index += 1) {
      const row = cache.rows[index];
      const node = row === undefined ? undefined : cache.nodes.get(row.id);
      if (row === undefined || node === undefined) continue;
      fragment.appendChild(this.drawRow(grid, row, node, cache, window));
    }
    rowsLayer.replaceChildren(fragment);
  }

  private drawRow(
    grid: HTMLElement,
    row: IVisibleRow,
    node: LayerNode,
    cache: IRowsCache,
    window: IGridWindow
  ): HTMLElement {
    const doc = grid.ownerDocument;
    const ruler = this.ruler();
    const { totalFrames } = cache.document.settings;
    const element = doc.createElement('div');
    element.className = `${FRAMES_GRID_CLASSES.row} ${FRAMES_GRID_CLASSES.row}--${row.kind}`;
    element.style.top = `${row.index * ROW_HEIGHT}px`;
    element.style.height = `${ROW_HEIGHT}px`;
    element.dataset.rowId = row.id;
    element.dataset.rowIndex = String(row.index);
    const place = (child: HTMLElement, start: number, end: number): void => {
      const left = ruler.frameLeft(start);
      child.style.left = `${left}px`;
      child.style.width = `${ruler.frameLeft(end + 1) - left}px`;
    };
    rowSegments(node, totalFrames, window.frames).forEach((segment) => {
      const span = doc.createElement('div');
      span.className = `${FRAMES_GRID_CLASSES.span} ${FRAMES_GRID_CLASSES.span}--${segment.kind}`;
      place(span, segment.start, segment.end);
      // Fonds (traits, teinte des colonnes multiples de 5) ancrés sur l'image 1, et
      // non sur le bord gauche du morceau : ils restent alignés sur la règle.
      span.style.backgroundPositionX = `${-ruler.frameLeft(segment.start)}px`;
      if (segment.spanId !== undefined) span.dataset.spanId = segment.spanId;
      // Bornes de la plage entière (et non du morceau coupé à la fenêtre).
      if (segment.spanStart !== undefined) span.dataset.start = String(segment.spanStart);
      if (segment.spanEnd !== undefined) span.dataset.end = String(segment.spanEnd);
      element.appendChild(span);
    });
    rowMarks(node, totalFrames, window.frames).forEach((mark) => {
      const markElement = doc.createElement('span');
      markElement.className = `${FRAMES_GRID_CLASSES.mark} ${FRAMES_GRID_CLASSES.mark}--${mark.kind}`;
      place(markElement, mark.frame, mark.frame);
      markElement.dataset.frame = String(mark.frame);
      markElement.dataset.spanId = mark.spanId;
      element.appendChild(markElement);
    });
    return element;
  }

  private cellAt(clientX: number, clientY: number): IGridCell | undefined {
    const grid = this.grid;
    if (grid === undefined) return undefined;
    const ruler = this.ruler();
    const cache = this.rowsCache();
    const rect = grid.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (x < 0 || y < 0 || x >= ruler.frameLeft(cache.document.settings.totalFrames + 1)) return undefined;
    const row = cache.rows[Math.floor(y / ROW_HEIGHT)];
    if (row === undefined) return undefined;
    // Même calcul que `frameAtClientX` de la règle, mais sur la grille elle-même : pas
    // d'écart quand la règle n'a pas encore recopié le défilement (une image d'affichage).
    const frame = Math.min(Math.floor(x / ruler.frameWidth()) + 1, cache.document.settings.totalFrames);
    return { rowId: row.id, rowIndex: row.index, frame };
  }

  private requireContext(): IEditorContext {
    if (this.ctx === undefined) throw new Error('frames.grid : utilisé avant init ou après destroy.');
    return this.ctx;
  }
}
