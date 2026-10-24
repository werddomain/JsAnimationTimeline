// packages/editor/src/plugins/layers/reorder/dropIndicator.ts
/**
 * Repère visuel du glisser-déposer : un trait entre deux lignes (avant /
 * après / fin de liste), ou une surbrillance de la ligne du dossier (« dans »).
 * Le trait est le dernier enfant de la liste (position absolue) ; il est
 * placé d'après l'index de la ligne et `ROW_HEIGHT`, sans mesurer le DOM.
 */

import { ROW_HEIGHT } from '../../../model/rows';
import { DEPTH_INDENT } from '../list';
import type { ILayerListService } from '../list';
import type { IDropPlacement } from './dropTarget';

/** Classes du glisser-déposer. */
export const REORDER_CLASSES = Object.freeze({
  /** Posée sur la liste pendant un glisser. */
  listDragging: 'jt-layer-list--dragging',
  /** Posée sur les lignes déplacées (et leurs descendants visibles). */
  dragging: 'jt-layer-row--dragging',
  /** Posée sur le dossier qui va accueillir le dépôt. */
  dropInto: 'jt-layer-row--drop-into',
  /** Le trait d'insertion. */
  dropLine: 'jt-layer-drop-line'
});

/** Repère de dépôt : crée le trait à la demande, le déplace, puis disparaît. */
export class DropIndicator {
  private line: HTMLElement | undefined;
  private highlighted: HTMLElement | undefined;

  constructor(
    private readonly list: ILayerListService,
    private readonly container: HTMLElement
  ) {}

  /** Montre le repère de `placement` (remplace le précédent). */
  show(placement: IDropPlacement): void {
    this.clearHighlight();
    if (placement.position === 'into') {
      this.hideLine();
      this.highlight(placement.rowId);
      return;
    }
    const rows = this.list.rows();
    const row = placement.rowId === undefined ? undefined : this.list.row(placement.rowId);
    const slot = placement.position === 'before' ? (row?.index ?? 0) : (row?.index ?? rows.length - 1) + 1;
    // Sous un dossier déplié, le trait « après » est au niveau de ses enfants.
    const depth = row === undefined ? 0 : row.depth + (placement.parentId === row.id ? 1 : 0);
    const line = this.ensureLine();
    line.style.top = `${slot * ROW_HEIGHT}px`;
    line.style.left = `${depth * DEPTH_INDENT}px`;
    line.hidden = false;
  }

  /** Cache le repère sans le détruire. */
  hide(): void {
    this.clearHighlight();
    this.hideLine();
  }

  /** Retire le trait et la surbrillance. */
  destroy(): void {
    this.clearHighlight();
    this.line?.remove();
    this.line = undefined;
  }

  private highlight(rowId: string | undefined): void {
    const element = rowId === undefined ? undefined : this.list.rowElement(rowId);
    element?.classList.add(REORDER_CLASSES.dropInto);
    this.highlighted = element;
  }

  private clearHighlight(): void {
    this.highlighted?.classList.remove(REORDER_CLASSES.dropInto);
    this.highlighted = undefined;
  }

  private hideLine(): void {
    if (this.line !== undefined) this.line.hidden = true;
  }

  private ensureLine(): HTMLElement {
    if (this.line === undefined) {
      const line = this.container.ownerDocument.createElement('div');
      line.classList.add(REORDER_CLASSES.dropLine);
      line.setAttribute('aria-hidden', 'true');
      line.setAttribute('role', 'presentation');
      this.container.appendChild(line);
      this.line = line;
    }
    return this.line;
  }
}
