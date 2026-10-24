// packages/editor/src/plugins/layers/list/LayerListPlugin.ts
/**
 * Plugin : layers.list
 * Epic : layers
 * Dépend de : layout.shell
 * Écoute : document:loaded, document:changed
 * Émet : layers:rowsChanged
 *
 * Liste des calques (zone `layers`) et son en-tête (zone `layersHeader`) :
 * l'arbre des calques et des dossiers, une ligne par nœud visible, dans
 * l'ordre du modèle partagé avec la grille (`visibleRows`, Y0). Une ligne
 * montre le nom, l'icône et la couleur du nœud ; elle ne suppose aucune
 * scène (la cible est l'affaire de `layers.target`).
 *
 * L'état replié d'un dossier vient du document (`folder.collapsed`) : le
 * bouton de repli exécute une commande annulable.
 *
 * Service `layers.list` : lignes affichées, éléments des lignes et API des
 * contrôles de ligne (œil, cadenas, couleur...), pour que les plugins de Y2
 * à Y4 s'ajoutent sans toucher à la liste. La sélection (Y5, avec la
 * navigation au clavier), le glisser-déposer (Y6) et le renommage (Y2)
 * passent par `element()`, `rowElement()`, `nameElement()` et `rowIdAt()`.
 *
 * Une erreur d'un contrôle n'interrompt pas la mise à jour de la liste ni
 * l'envoi de `layers:rowsChanged` : la première erreur est relancée à la fin.
 */

import type { ITimelineDocument } from '@werddomain/timeline-runtime';
import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import { LAYOUT_SLOTS } from '../../layout/shell/layoutSlots';
import { layerRows, sameRowLayout } from './layerRows';
import { createSetCollapsedCommand, createToggleCollapsedCommand, findFolder } from './layerTree';
import { LayerRowView, collectError } from './LayerRowView';
import type { ILayerListService, ILayerRow, ILayerRowControl } from './types';
import './LayerList.less';

/** Identifiant du plugin et de son service. */
export const LAYERS_LIST_PLUGIN_ID = 'layers.list';

/** Classes de la liste et de son en-tête. */
export const LAYER_LIST_CLASSES = Object.freeze({
  list: 'jt-layer-list',
  empty: 'jt-layer-list__empty',
  header: 'jt-layers-header',
  headerTitle: 'jt-layers-header__title',
  headerControls: 'jt-layers-header__controls',
  headerControl: 'jt-layers-header__control'
});

/** Textes visibles de la liste (en français). */
export const LAYER_LIST_TEXTS = Object.freeze({
  label: 'Calques',
  empty: 'Aucun calque'
});

/** Forme d'un identifiant de contrôle : segments pointés en camelCase (`layers.lock`, `myApp.solo`). */
export const CONTROL_ID_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)*$/;

/** Lève la première erreur de `errors`, s'il y en a. */
function rethrowFirst(errors: readonly unknown[]): void {
  if (errors.length > 0) throw errors[0];
}

/** Liste des calques : arbre des calques, en-tête et contrôles de ligne. */
export class LayerListPlugin implements EditorPlugin {
  readonly id = 'layers.list';
  readonly dependencies: readonly string[] = ['layout.shell'];
  readonly slot = LAYOUT_SLOTS.layers;

  private ctx: IEditorContext | undefined;
  private cleanups: Array<() => void> = [];
  private list: HTMLElement | undefined;
  private empty: HTMLElement | undefined;
  private header: HTMLElement | undefined;
  private headerControls: HTMLElement | undefined;
  private readonly views = new Map<string, LayerRowView>();
  private controls: ILayerRowControl[] = [];
  private readonly headerCells = new Map<string, HTMLElement>();
  private rowsDocument: ITimelineDocument | undefined;
  private currentRows: readonly ILayerRow[] = [];
  private emittedRows: readonly ILayerRow[] | undefined;

  readonly init = (ctx: IEditorContext): void => {
    this.ctx = ctx;
    const service: ILayerListService = {
      rows: () => this.rows(),
      row: (id) => this.rows().find((row) => row.id === id),
      rowElement: (id) => this.views.get(id)?.element,
      nameElement: (id) => this.views.get(id)?.nameElement,
      rowIdAt: (target) => this.rowIdAt(target),
      element: () => this.list,
      addRowControl: (control) => this.addRowControl(control),
      setCollapsed: (folderId, collapsed) => {
        const context = this.requireContext();
        return context.commands.execute(createSetCollapsedCommand(context.document, folderId, collapsed));
      },
      toggleCollapsed: (folderId) => {
        const context = this.requireContext();
        return context.commands.execute(createToggleCollapsedCommand(context.document, folderId));
      }
    };
    this.cleanups = [
      ctx.services.provide(LAYERS_LIST_PLUGIN_ID, service),
      ctx.events.on('document:loaded', () => this.refresh()),
      ctx.events.on('document:changed', () => this.refresh())
    ];
  };

  render(slot: HTMLElement): void {
    const ctx = this.requireContext();
    const doc = slot.ownerDocument;
    const list = doc.createElement('div');
    list.classList.add(LAYER_LIST_CLASSES.list);
    list.setAttribute('role', 'tree');
    list.setAttribute('aria-label', LAYER_LIST_TEXTS.label);
    const onClick = (event: MouseEvent): void => this.onListClick(event);
    list.addEventListener('click', onClick);
    this.cleanups.push(() => list.removeEventListener('click', onClick));
    const empty = doc.createElement('div');
    empty.classList.add(LAYER_LIST_CLASSES.empty);
    empty.textContent = LAYER_LIST_TEXTS.empty;
    slot.append(list, empty);
    this.list = list;
    this.empty = empty;
    const headerSlot = ctx.slots.get(LAYOUT_SLOTS.layersHeader);
    if (headerSlot !== undefined) this.renderHeader(headerSlot);
    this.refresh();
  }

  destroy(): void {
    const cleanups = this.cleanups;
    this.cleanups = [];
    cleanups.forEach((cleanup) => cleanup());
    const errors: unknown[] = [];
    this.views.forEach((view) => errors.push(...view.dispose()));
    this.controls.forEach((control) => this.removeHeaderCell(control, errors));
    this.views.clear();
    this.headerCells.clear();
    this.list?.remove();
    this.empty?.remove();
    this.header?.remove();
    this.list = undefined;
    this.empty = undefined;
    this.header = undefined;
    this.headerControls = undefined;
    this.controls = [];
    this.rowsDocument = undefined;
    this.currentRows = [];
    this.emittedRows = undefined;
    this.ctx = undefined;
    rethrowFirst(errors);
  }

  private rows(): readonly ILayerRow[] {
    const doc = this.requireContext().document;
    if (doc !== this.rowsDocument) {
      this.currentRows = layerRows(doc, this.currentRows);
      this.rowsDocument = doc;
    }
    return this.currentRows;
  }

  /**
   * Recalcule les lignes et met le DOM à jour. Annonce `layers:rowsChanged`
   * au premier rendu, puis chaque fois que la disposition des lignes change
   * (ids, ordre, profondeur, parent) ; un simple changement de nom ou de
   * couleur passe par `document:changed` (ou `document:loaded`).
   */
  private refresh(): void {
    const rows = this.rows();
    if (this.list === undefined) return;
    const errors = this.reconcile(this.list, rows);
    const previous = this.emittedRows;
    this.emittedRows = rows;
    if (previous === undefined || !sameRowLayout(previous, rows)) {
      this.requireContext().events.emit('layers:rowsChanged', { rows, previous: previous ?? [] });
    }
    rethrowFirst(errors);
  }

  /**
   * Garde les vues des lignes encore affichées, crée les nouvelles, retire
   * les autres, remet l'ordre. Retourne les erreurs des contrôles.
   */
  private reconcile(list: HTMLElement, rows: readonly ILayerRow[]): unknown[] {
    const errors: unknown[] = [];
    const kept = new Set(rows.map((row) => row.id));
    this.views.forEach((view, id) => {
      if (kept.has(id)) return;
      errors.push(...view.dispose());
      this.views.delete(id);
    });
    rows.forEach((row, index) => {
      const view = this.views.get(row.id) ?? this.createView(list, row, errors);
      if (view.row !== row) errors.push(...view.update(row));
      if (list.children[index] !== view.element) list.insertBefore(view.element, list.children[index] ?? null);
    });
    if (this.empty !== undefined) this.empty.hidden = rows.length > 0;
    return errors;
  }

  private createView(list: HTMLElement, row: ILayerRow, errors: unknown[]): LayerRowView {
    const view = new LayerRowView(list.ownerDocument, row);
    this.views.set(row.id, view);
    this.controls.forEach((control) => collectError(errors, () => view.addControl(control, undefined)));
    return view;
  }

  private addRowControl(control: ILayerRowControl): () => void {
    if (!CONTROL_ID_PATTERN.test(control.id)) {
      throw new Error(`layers.list : identifiant de contrôle invalide : ${JSON.stringify(control.id)}.`);
    }
    if (this.controls.some((existing) => existing.id === control.id)) {
      throw new Error(`layers.list : le contrôle « ${control.id} » est déjà ajouté.`);
    }
    const controls = [...this.controls, control].sort((a, b) => a.order - b.order);
    const before = controls[controls.indexOf(control) + 1]?.id;
    this.controls = controls;
    try {
      this.views.forEach((view) => view.addControl(control, before));
      this.addHeaderCell(control, before);
    } catch (error) {
      this.detachControl(control);
      throw error;
    }
    let removed = false;
    return () => {
      if (removed) return;
      removed = true;
      rethrowFirst(this.detachControl(control));
    };
  }

  /** Retire le contrôle des lignes et de l'en-tête ; retourne les erreurs de ses `dispose`. */
  private detachControl(control: ILayerRowControl): unknown[] {
    const errors: unknown[] = [];
    this.controls = this.controls.filter((existing) => existing !== control);
    this.views.forEach((view) => errors.push(...view.removeControl(control.id)));
    this.removeHeaderCell(control, errors);
    return errors;
  }

  private renderHeader(slot: HTMLElement): void {
    const doc = slot.ownerDocument;
    const header = doc.createElement('div');
    header.classList.add(LAYER_LIST_CLASSES.header);
    const title = doc.createElement('span');
    title.classList.add(LAYER_LIST_CLASSES.headerTitle);
    title.textContent = LAYER_LIST_TEXTS.label;
    const controls = doc.createElement('span');
    controls.classList.add(LAYER_LIST_CLASSES.headerControls);
    header.append(title, controls);
    slot.appendChild(header);
    this.header = header;
    this.headerControls = controls;
    this.controls.forEach((control) => this.addHeaderCell(control, undefined));
  }

  /** Cellule d'en-tête du contrôle (vide sans `renderHeader`, pour garder les colonnes alignées). */
  private addHeaderCell(control: ILayerRowControl, before: string | undefined): void {
    const container = this.headerControls;
    if (container === undefined) return;
    const cell = container.ownerDocument.createElement('span');
    cell.classList.add(LAYER_LIST_CLASSES.headerControl);
    cell.dataset.controlId = control.id;
    container.insertBefore(cell, before === undefined ? null : (this.headerCells.get(before) ?? null));
    this.headerCells.set(control.id, cell);
    control.renderHeader?.(cell);
  }

  private removeHeaderCell(control: ILayerRowControl, errors: unknown[]): void {
    const cell = this.headerCells.get(control.id);
    if (cell === undefined) return;
    this.headerCells.delete(control.id);
    collectError(errors, () => control.disposeHeader?.(cell));
    cell.remove();
  }

  private onListClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const toggle = target.closest('[data-action="toggle"]');
    if (toggle === null) return;
    const id = this.rowIdAt(toggle);
    if (id === undefined) return;
    event.stopPropagation();
    const ctx = this.requireContext();
    if (findFolder(ctx.document, id) !== undefined) {
      ctx.commands.execute(createToggleCollapsedCommand(ctx.document, id));
    }
  }

  private rowIdAt(target: EventTarget | null): string | undefined {
    if (!(target instanceof Element) || this.list === undefined) return undefined;
    const row = target.closest<HTMLElement>('[data-row-id]');
    if (row === null || !this.list.contains(row)) return undefined;
    const id = row.dataset.rowId;
    return id !== undefined && this.views.get(id)?.element === row ? id : undefined;
  }

  private requireContext(): IEditorContext {
    if (this.ctx === undefined) throw new Error('layers.list : plugin non initialisé ou détruit.');
    return this.ctx;
  }
}
