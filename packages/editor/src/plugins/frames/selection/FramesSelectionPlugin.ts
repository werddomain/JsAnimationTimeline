// packages/editor/src/plugins/frames/selection/FramesSelectionPlugin.ts
/**
 * Plugin : frames.selection
 * Epic : frames
 * Dépend de : frames.grid, layout.ruler
 * Écoute : document:loaded, document:changed, layers:rowsChanged, frames:gridRendered
 * Émet : frames:selectionChanged
 *
 * Sélection des images et des images clés de la grille, reprise de
 * `legacy/core/SelectionManager.ts` et du clic de `legacy/ui/TimelineGrid.ts`
 * (`addFrameClickHandler`) :
 * - clic seul : sélectionne seulement l'image cliquée et y déplace la tête
 *   de lecture ;
 * - Ctrl / Cmd + clic : ajoute l'image ou la retire ;
 * - Maj + clic : rectangle de l'ancre à l'image cliquée (Ctrl + Maj : ajouté
 *   à la sélection) ;
 * - appui sur une image d'une sélection de plusieurs images : la sélection
 *   reste entière (glisser de K2), et se réduit à cette image au relâchement ;
 * - clic sur une ligne de dossier : vide la sélection (un dossier n'a pas
 *   d'images).
 *
 * La sélection est de l'état d'interface : elle n'entre ni dans le document
 * ni dans l'historique. Elle est vidée au chargement d'un document, et
 * nettoyée quand un calque disparaît, qu'un dossier est replié ou que la
 * durée diminue. Ordre : sur `document:changed`, la grille redessine (et
 * annonce `frames:gridRendered`) avant ce nettoyage, qui redessine ensuite. Elle est dessinée dans un
 * calque de décoration posé sur la grille (`frames.grid` → `element()`),
 * redessiné à chaque `frames:gridRendered`, seulement dans la fenêtre
 * dessinée par la grille.
 */

import { walkLayers } from '@werddomain/timeline-runtime';
import type { LayerNode } from '@werddomain/timeline-runtime';
import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import type { IVisibleRow } from '../../../model/rows';
import { LAYOUT_SLOTS } from '../../layout/shell/layoutSlots';
// Types seulement : événements écoutés (layers:rowsChanged, frames:gridRendered) et services utilisés.
import type {} from '../../layers/list/types';
import type {} from '../grid/types';
import type {} from '../../layout/ruler/RulerPlugin';
import { rowMarks } from '../grid/gridCells';
import type { IGridMark } from '../grid/gridCells';
import {
  EMPTY_FRAME_SELECTION,
  cellKey,
  cellRuns,
  pruneSelection,
  sameCells,
  selectCells,
  selectOnly,
  selectRectangle,
  toggleCell
} from './frameSelection';
import type { IFrameCell, IFrameSelectionState } from './frameSelection';
import type { ISelectedKeyframe, SelectedKeyframeKind } from './types';
import './FramesSelection.less';

/** Identifiant du plugin (et de son service). */
export const FRAMES_SELECTION_PLUGIN_ID = 'frames.selection';

/** Classes CSS du calque de sélection. */
export const FRAMES_SELECTION_CLASSES = Object.freeze({
  layer: 'jt-frame-selection',
  run: 'jt-frame-selection__run'
});

/** Fonction vide (aucun relâchement en attente). */
const NO_OP = (): void => undefined;

/** Bouton principal de la souris. */
const PRIMARY_BUTTON = 0;

/** Sélectionne les images de la grille (clic, Ctrl, Maj) et publie la sélection. */
export class FramesSelectionPlugin implements EditorPlugin {
  readonly id = 'frames.selection';
  readonly dependencies: readonly string[] = ['frames.grid', 'layout.ruler'];
  readonly slot = LAYOUT_SLOTS.frames;

  private ctx: IEditorContext | undefined;
  private state: IFrameSelectionState = EMPTY_FRAME_SELECTION;
  private keys: ReadonlySet<string> = new Set();
  private overlay: HTMLElement | undefined;
  private cleanups: Array<() => void> = [];
  /** Retire l'écoute du relâchement en attente (appui sur une image déjà sélectionnée). */
  private cancelRelease: () => void = NO_OP;

  readonly init = (ctx: IEditorContext): void => {
    this.ctx = ctx;
    const prune = (): void => this.prune();
    // Un autre document : la sélection (et son ancre) ne le concerne pas.
    const reset = (): void => this.commit(EMPTY_FRAME_SELECTION);
    this.cleanups = [
      ctx.services.provide('frames.selection', {
        cells: () => this.state.cells,
        keyframes: () => this.keyframes(),
        isSelected: (rowId, frame) => this.keys.has(cellKey({ rowId, frame })),
        anchor: () => this.state.anchor,
        select: (cell) => this.apply((rows, total) => selectOnly(cell, rows, total)),
        toggle: (cell) => this.apply((rows, total) => toggleCell(this.state, cell, rows, total)),
        selectRange: (to, additive = false) =>
          this.apply((rows, total) => selectRectangle(this.state, to, additive, rows, total)),
        set: (cells) => this.apply((rows, total) => selectCells(cells, rows, total)),
        clear: () => this.commit(EMPTY_FRAME_SELECTION)
      }),
      ctx.events.on('document:loaded', reset),
      ctx.events.on('document:changed', prune),
      ctx.events.on('layers:rowsChanged', prune),
      ctx.events.on('frames:gridRendered', () => this.draw())
    ];
  };

  render(): void {
    const ctx = this.requireContext();
    const grid = ctx.services.require('frames.grid').element();
    if (grid === undefined) throw new Error("frames.selection : la grille frames.grid n'est pas rendue.");
    const overlay = grid.ownerDocument.createElement('div');
    overlay.className = FRAMES_SELECTION_CLASSES.layer;
    overlay.setAttribute('aria-hidden', 'true');
    grid.appendChild(overlay);
    this.overlay = overlay;
    const onPointerDown = (event: PointerEvent): void => this.onPointerDown(event);
    grid.addEventListener('pointerdown', onPointerDown);
    this.cleanups.push(() => grid.removeEventListener('pointerdown', onPointerDown));
    this.draw();
  }

  destroy(): void {
    this.cancelRelease();
    const cleanups = this.cleanups;
    this.cleanups = [];
    cleanups.forEach((cleanup) => cleanup());
    this.overlay?.remove();
    this.overlay = undefined;
    this.state = EMPTY_FRAME_SELECTION;
    this.keys = new Set();
    this.ctx = undefined;
  }

  private onPointerDown(event: PointerEvent): void {
    if (event.button !== PRIMARY_BUTTON) return;
    const ctx = this.requireContext();
    const cell = ctx.services.require('frames.grid').cellAt(event.clientX, event.clientY);
    if (cell === undefined) return;
    const target: IFrameCell = { rowId: cell.rowId, frame: cell.frame };
    const ctrl = event.ctrlKey || event.metaKey;
    if (event.shiftKey) {
      // Pas de sélection de texte du navigateur sur Maj+clic.
      event.preventDefault();
      this.apply((rows, total) => selectRectangle(this.state, target, ctrl, rows, total));
    } else if (ctrl) {
      this.apply((rows, total) => toggleCell(this.state, target, rows, total));
    } else if (this.keys.has(cellKey(target)) && this.state.cells.length > 1) {
      // Appui sur une image déjà sélectionnée (comme Flash) : la sélection reste
      // entière pour un glisser (K2) ; elle se réduit à cette image au relâchement
      // si le pointeur est toujours dessus.
      this.collapseOnRelease(target);
    } else {
      this.apply((rows, total) => selectOnly(target, rows, total));
    }
    // Comme le legacy (`movePlayheadOnFrameClick`) et Flash : la tête de lecture suit
    // le clic, seulement si l'image cliquée est (encore) sélectionnée.
    if (this.keys.has(cellKey(target)) && cell.frame !== ctx.playback.frame) ctx.playback.seek(cell.frame);
  }

  /** Au prochain relâchement du bouton, sélectionne seulement `target` si le pointeur est encore dessus. */
  private collapseOnRelease(target: IFrameCell): void {
    const doc = this.overlay?.ownerDocument;
    if (doc === undefined) return;
    this.cancelRelease();
    const onUp = (up: PointerEvent): void => {
      this.cancelRelease();
      const cell = this.ctx?.services.get('frames.grid')?.cellAt(up.clientX, up.clientY);
      if (cell?.rowId === target.rowId && cell.frame === target.frame) {
        this.apply((rows, total) => selectOnly(target, rows, total));
      }
    };
    doc.addEventListener('pointerup', onUp);
    this.cancelRelease = () => {
      doc.removeEventListener('pointerup', onUp);
      this.cancelRelease = NO_OP;
    };
  }



  /** Calcule le nouvel état sur les lignes et la durée courantes, puis le publie. */
  private apply(next: (rows: readonly IVisibleRow[], totalFrames: number) => IFrameSelectionState): void {
    const ctx = this.requireContext();
    const rows = ctx.services.require('frames.grid').rows();
    this.commit(next(rows, ctx.document.settings.totalFrames));
  }

  private prune(): void {
    this.apply((rows, total) => pruneSelection(this.state, rows, total));
  }

  /** Publie `next` s'il diffère de l'état courant (cellules ou ancre) : redessin et événement. */
  private commit(next: IFrameSelectionState): void {
    const previous = this.state;
    if (next === previous) return;
    const anchorChanged =
      next.anchor?.rowId !== previous.anchor?.rowId || next.anchor?.frame !== previous.anchor?.frame;
    if (!anchorChanged && sameCells(next.cells, previous.cells)) return;
    this.state = next;
    this.keys = new Set(next.cells.map(cellKey));
    this.draw();
    this.requireContext().events.emit('frames:selectionChanged', {
      cells: next.cells,
      previous: previous.cells,
      ...(next.anchor === undefined ? {} : { anchor: next.anchor })
    });
  }

  /** Cellules sélectionnées qui portent une image clé dans le document courant. */
  private keyframes(): ISelectedKeyframe[] {
    const doc = this.requireContext().document;
    const nodes = new Map<string, LayerNode>();
    walkLayers(doc.layers, ({ node }) => void nodes.set(node.id, node));
    const { totalFrames } = doc.settings;
    return this.state.cells.flatMap((cell) => {
      const node = nodes.get(cell.rowId);
      if (node === undefined) return [];
      const marks = rowMarks(node, totalFrames, { first: cell.frame, last: cell.frame });
      const mark = marks.find((candidate): candidate is IGridMark & { kind: SelectedKeyframeKind } =>
        candidate.kind !== 'spanEnd'
      );
      return mark === undefined ? [] : [{ rowId: cell.rowId, frame: cell.frame, kind: mark.kind, spanId: mark.spanId }];
    });
  }

  /** Redessine les rectangles de la sélection dans la fenêtre dessinée par la grille. */
  private draw(): void {
    const overlay = this.overlay;
    const ctx = this.ctx;
    if (overlay === undefined || ctx === undefined) return;
    const grid = ctx.services.require('frames.grid');
    const window = grid.window();
    const ruler = ctx.services.require('layout.ruler');
    const rowHeight = grid.rowHeight();
    const rowIndex = new Map(grid.rows().map((row) => [row.id, row.index] as const));
    const fragment = overlay.ownerDocument.createDocumentFragment();
    cellRuns(this.state.cells).forEach((run) => {
      const index = rowIndex.get(run.rowId);
      const first = Math.max(run.first, window.frames.first);
      const last = Math.min(run.last, window.frames.last);
      if (index === undefined || index < window.rows.first || index > window.rows.last || first > last) return;
      const element = overlay.ownerDocument.createElement('div');
      element.className = FRAMES_SELECTION_CLASSES.run;
      const left = ruler.frameLeft(first);
      element.style.left = `${left}px`;
      element.style.width = `${ruler.frameLeft(last + 1) - left}px`;
      element.style.top = `${index * rowHeight}px`;
      element.style.height = `${rowHeight}px`;
      element.dataset.rowId = run.rowId;
      element.dataset.first = String(run.first);
      element.dataset.last = String(run.last);
      fragment.appendChild(element);
    });
    overlay.replaceChildren(fragment);
  }

  private requireContext(): IEditorContext {
    if (this.ctx === undefined) throw new Error('frames.selection : utilisé avant init ou après destroy.');
    return this.ctx;
  }
}
