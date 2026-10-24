// packages/editor/src/plugins/layers/list/LayerRowView.ts
/**
 * Élément DOM d'une ligne de la liste des calques : bouton de repli (dossier),
 * icône, nom, couleur et cellules des contrôles de ligne. La vue garde le
 * même élément tant que la ligne reste affichée : les classes ajoutées par
 * d'autres plugins (sélection...) et le focus survivent aux mises à jour.
 */

import { isFolder, resolveCollapsed, resolveVisible } from '@werddomain/timeline-runtime';
import { ROW_HEIGHT } from '../../../model/rows';
import { renderLayerIcon } from './layerIcon';
import type { ILayerRow, ILayerRowControl } from './types';

/** Classes et attributs de la liste (contrat pour les styles et les autres plugins). */
export const LAYER_ROW_CLASSES = Object.freeze({
  row: 'jt-layer-row',
  folder: 'jt-layer-row--folder',
  layer: 'jt-layer-row--layer',
  collapsed: 'jt-layer-row--collapsed',
  hidden: 'jt-layer-row--hidden',
  locked: 'jt-layer-row--locked',
  toggle: 'jt-layer-row__toggle',
  spacer: 'jt-layer-row__spacer',
  icon: 'jt-layer-row__icon',
  name: 'jt-layer-row__name',
  controls: 'jt-layer-row__controls',
  control: 'jt-layer-row__control'
});

/** Libellés accessibles du bouton de repli (texte visible : en français). */
export const TOGGLE_LABELS = Object.freeze({
  collapse: 'Replier le dossier',
  expand: 'Déplier le dossier'
});

/** Retrait par niveau d'imbrication, en pixels. */
export const DEPTH_INDENT = 16;

interface IControlCell {
  readonly control: ILayerRowControl;
  readonly element: HTMLElement;
}

/** Vue d'une ligne. */
export class LayerRowView {
  readonly element: HTMLElement;
  private readonly toggleSlot: HTMLElement;
  private readonly icon: HTMLElement;
  private readonly name: HTMLElement;
  private readonly controls: HTMLElement;
  private readonly cells = new Map<string, IControlCell>();
  private current: ILayerRow;

  constructor(doc: Document, row: ILayerRow) {
    this.current = row;
    const element = doc.createElement('div');
    element.classList.add(LAYER_ROW_CLASSES.row);
    element.setAttribute('role', 'treeitem');
    element.dataset.rowId = row.id;
    element.style.height = `${ROW_HEIGHT}px`;
    this.toggleSlot = doc.createElement('span');
    this.icon = doc.createElement('span');
    this.icon.classList.add(LAYER_ROW_CLASSES.icon);
    this.name = doc.createElement('span');
    this.name.classList.add(LAYER_ROW_CLASSES.name);
    this.controls = doc.createElement('span');
    this.controls.classList.add(LAYER_ROW_CLASSES.controls);
    element.append(this.toggleSlot, this.icon, this.name, this.controls);
    this.element = element;
    this.paint(row, true);
  }

  /** Ligne affichée par cette vue. */
  get row(): ILayerRow {
    return this.current;
  }

  /** Met à jour la ligne et ses contrôles. */
  update(row: ILayerRow): void {
    const kindChanged = row.kind !== this.current.kind;
    this.current = row;
    this.paint(row, kindChanged);
    this.cells.forEach(({ control, element }) => {
      if (control.update !== undefined) {
        control.update(row, element);
      } else {
        element.replaceChildren();
        control.render(row, element);
      }
    });
  }

  /** Ajoute la cellule du contrôle, à sa place selon `order`, et la rend. */
  addControl(control: ILayerRowControl, before: string | undefined): void {
    const element = this.element.ownerDocument.createElement('span');
    element.classList.add(LAYER_ROW_CLASSES.control);
    element.dataset.controlId = control.id;
    const next = before === undefined ? null : (this.cells.get(before)?.element ?? null);
    this.controls.insertBefore(element, next);
    this.cells.set(control.id, { control, element });
    control.render(this.current, element);
  }

  /** Retire la cellule du contrôle `id` (après son `dispose`). */
  removeControl(id: string): void {
    const cell = this.cells.get(id);
    if (cell === undefined) return;
    this.cells.delete(id);
    cell.control.dispose?.(this.current, cell.element);
    cell.element.remove();
  }

  /** Retire tous les contrôles puis l'élément. */
  dispose(): void {
    Array.from(this.cells.keys()).forEach((id) => this.removeControl(id));
    this.element.remove();
  }

  private paint(row: ILayerRow, rebuildToggle: boolean): void {
    const { element } = this;
    const node = row.node;
    const folder = isFolder(node);
    const collapsed = folder && resolveCollapsed(node);
    element.classList.toggle(LAYER_ROW_CLASSES.folder, folder);
    element.classList.toggle(LAYER_ROW_CLASSES.layer, !folder);
    element.classList.toggle(LAYER_ROW_CLASSES.collapsed, collapsed);
    element.classList.toggle(LAYER_ROW_CLASSES.hidden, !resolveVisible(node));
    element.classList.toggle(LAYER_ROW_CLASSES.locked, row.lockedByAncestor);
    element.dataset.rowKind = row.kind;
    element.setAttribute('aria-level', String(row.depth + 1));
    element.setAttribute('aria-label', node.name);
    if (folder) element.setAttribute('aria-expanded', String(!collapsed));
    else element.removeAttribute('aria-expanded');
    element.style.setProperty('--jt-row-depth', String(row.depth));
    element.style.paddingLeft = `${row.depth * DEPTH_INDENT}px`;
    if (node.color === undefined) element.style.removeProperty('--jt-layer-color');
    else element.style.setProperty('--jt-layer-color', node.color);
    if (rebuildToggle) this.buildToggle(folder);
    if (folder) this.paintToggle(collapsed);
    renderLayerIcon(node, this.icon);
    if (this.name.textContent !== node.name) this.name.textContent = node.name;
    this.name.title = node.name;
  }

  private buildToggle(folder: boolean): void {
    const doc = this.element.ownerDocument;
    const replacement = folder ? doc.createElement('button') : doc.createElement('span');
    if (replacement instanceof HTMLButtonElement) {
      replacement.type = 'button';
      replacement.classList.add(LAYER_ROW_CLASSES.toggle);
      replacement.dataset.action = 'toggle';
      replacement.tabIndex = -1;
    } else {
      replacement.classList.add(LAYER_ROW_CLASSES.spacer);
      replacement.setAttribute('aria-hidden', 'true');
    }
    this.toggleSlot.replaceChildren(replacement);
  }

  private paintToggle(collapsed: boolean): void {
    const button = this.toggleSlot.firstElementChild;
    if (!(button instanceof HTMLElement)) return;
    button.textContent = collapsed ? '▶' : '▼';
    const label = collapsed ? TOGGLE_LABELS.expand : TOGGLE_LABELS.collapse;
    button.setAttribute('aria-label', label);
    button.title = label;
  }
}
