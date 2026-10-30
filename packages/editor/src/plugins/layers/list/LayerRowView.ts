// packages/editor/src/plugins/layers/list/LayerRowView.ts
/**
 * Élément DOM d'une ligne de la liste des calques : bouton de repli (dossier),
 * icône, nom, couleur et cellules des contrôles de ligne. La vue garde le
 * même élément tant que la ligne reste affichée : les classes ajoutées par
 * d'autres plugins (sélection...) et le focus survivent aux mises à jour.
 *
 * Les appels aux contrôles (`update`, `dispose`) sont isolés : une erreur
 * d'un contrôle n'empêche pas la mise à jour des autres. Les erreurs sont
 * retournées à la liste, qui les relance une fois son travail fini.
 */

import { isFolder, resolveCollapsed } from '@kazo-ca/timeline-runtime';
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

/**
 * Attribut posé sur l'élément du nom pendant une saisie (renommage, Y2) :
 * tant qu'il est présent, la liste ne réécrit pas le nom.
 */
export const NAME_EDITING_ATTRIBUTE = 'data-editing';

interface IControlCell {
  readonly control: ILayerRowControl;
  readonly element: HTMLElement;
}

/** Exécute `action` ; ajoute son erreur éventuelle à `errors` au lieu de la lever. */
export function collectError(errors: unknown[], action: () => void): void {
  try {
    action();
  } catch (error) {
    errors.push(error);
  }
}

/** Vue d'une ligne. */
export class LayerRowView {
  readonly element: HTMLElement;
  /** Élément du nom (texte du nœud), pour le renommage sur place. */
  readonly nameElement: HTMLElement;
  private readonly toggleSlot: HTMLElement;
  private readonly icon: HTMLElement;
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
    this.nameElement = doc.createElement('span');
    this.nameElement.classList.add(LAYER_ROW_CLASSES.name);
    this.controls = doc.createElement('span');
    this.controls.classList.add(LAYER_ROW_CLASSES.controls);
    element.append(this.toggleSlot, this.icon, this.nameElement, this.controls);
    this.element = element;
    this.paint(row, true);
  }

  /** Ligne affichée par cette vue. */
  get row(): ILayerRow {
    return this.current;
  }

  /** Met à jour la ligne et ses contrôles ; retourne les erreurs des contrôles. */
  update(row: ILayerRow): unknown[] {
    const previous = this.current;
    const kindChanged = row.kind !== previous.kind || (row.propertiesExpanded === undefined) !== (previous.propertiesExpanded === undefined);
    this.current = row;
    this.paint(row, kindChanged);
    const errors: unknown[] = [];
    this.cells.forEach(({ control, element }) =>
      {
        if (control.update !== undefined) {
          collectError(errors, () => control.update?.(row, element));
          return;
        }
        // Un `dispose` en panne n'empêche pas le nouveau rendu.
        collectError(errors, () => control.dispose?.(previous, element));
        collectError(errors, () => {
          element.replaceChildren();
          control.render(row, element);
        });
      }
    );
    return errors;
  }

  /** Ajoute la cellule du contrôle, à sa place selon `order`, et la rend (lève si `render` lève). */
  addControl(control: ILayerRowControl, before: string | undefined): void {
    const element = this.element.ownerDocument.createElement('span');
    element.classList.add(LAYER_ROW_CLASSES.control);
    element.dataset.controlId = control.id;
    const next = before === undefined ? null : (this.cells.get(before)?.element ?? null);
    this.controls.insertBefore(element, next);
    this.cells.set(control.id, { control, element });
    control.render(this.current, element);
  }

  /** Retire la cellule du contrôle `id` (après son `dispose`) ; retourne l'erreur de `dispose`. */
  removeControl(id: string): unknown[] {
    const cell = this.cells.get(id);
    if (cell === undefined) return [];
    this.cells.delete(id);
    const errors: unknown[] = [];
    collectError(errors, () => cell.control.dispose?.(this.current, cell.element));
    cell.element.remove();
    return errors;
  }

  /** Retire tous les contrôles puis l'élément ; retourne les erreurs des `dispose`. */
  dispose(): unknown[] {
    const errors = Array.from(this.cells.keys()).flatMap((id) => this.removeControl(id));
    this.element.remove();
    return errors;
  }

  private paint(row: ILayerRow, rebuildToggle: boolean): void {
    const { element } = this;
    const node = row.node;
    const folder = isFolder(node);
    const expandable = folder || row.propertiesExpanded !== undefined;
    const collapsed = folder ? resolveCollapsed(node) : row.propertiesExpanded === false;
    element.classList.toggle(LAYER_ROW_CLASSES.folder, folder);
    element.classList.toggle(LAYER_ROW_CLASSES.layer, !folder);
    element.classList.toggle(LAYER_ROW_CLASSES.collapsed, collapsed);
    element.classList.toggle(LAYER_ROW_CLASSES.hidden, row.hiddenByAncestor);
    element.classList.toggle(LAYER_ROW_CLASSES.locked, row.lockedByAncestor);
    element.dataset.rowKind = row.kind;
    element.setAttribute('aria-level', String(row.depth + 1));
    element.setAttribute('aria-label', node.name);
    if (expandable) element.setAttribute('aria-expanded', String(!collapsed));
    else element.removeAttribute('aria-expanded');
    element.style.setProperty('--jt-row-depth', String(row.depth));
    element.style.paddingLeft = `${row.depth * DEPTH_INDENT}px`;
    if (node.color === undefined) element.style.removeProperty('--jt-layer-color');
    else element.style.setProperty('--jt-layer-color', node.color);
    if (rebuildToggle) this.buildToggle(expandable);
    if (expandable) this.paintToggle(collapsed, !folder);
    renderLayerIcon(node, this.icon);
    this.paintName(node.name);
  }

  private paintName(name: string): void {
    const element = this.nameElement;
    element.title = name;
    if (element.hasAttribute(NAME_EDITING_ATTRIBUTE) || element.textContent === name) return;
    element.textContent = name;
  }

  private buildToggle(folder: boolean): void {
    const doc = this.element.ownerDocument;
    const replacement = folder ? doc.createElement('button') : doc.createElement('span');
    if (replacement instanceof HTMLButtonElement) {
      replacement.type = 'button';
      replacement.classList.add(LAYER_ROW_CLASSES.toggle);
      replacement.dataset.action = 'toggle';
      // Hors de l'ordre de tabulation : le clavier passe par la sélection (Y5),
      // qui replie et déplie avec les flèches via le service `layers.list`.
      replacement.tabIndex = -1;
    } else {
      replacement.classList.add(LAYER_ROW_CLASSES.spacer);
      replacement.setAttribute('aria-hidden', 'true');
    }
    this.toggleSlot.replaceChildren(replacement);
  }

  private paintToggle(collapsed: boolean, properties = false): void {
    const button = this.toggleSlot.firstElementChild;
    if (!(button instanceof HTMLElement)) return;
    button.textContent = collapsed ? '▶' : '▼';
    const label = properties ? (collapsed ? 'Déplier les propriétés' : 'Replier les propriétés')
      : (collapsed ? TOGGLE_LABELS.expand : TOGGLE_LABELS.collapse);
    button.setAttribute('aria-label', label);
    button.title = label;
  }
}
