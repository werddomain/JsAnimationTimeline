// packages/editor/src/plugins/layers/selection/LayerSelectionPlugin.ts
/**
 * Plugin : layers.selection
 * Epic : layers
 * Dépend de : layers.list
 * Écoute : layers:rowsChanged, document:changed, document:loaded
 * Émet : layers:selectionChanged
 *
 * Sélection multiple des calques et des dossiers, et navigation au clavier
 * dans l'arbre. La sélection est de l'état d'interface : elle n'est ni dans
 * le document ni annulable.
 *
 * Souris (clics délégués sur l'élément de `layers.list`) : clic = cette ligne
 * seule ; Ctrl / Cmd + clic = inverse la ligne ; Maj + clic = plage depuis
 * l'ancre sur les lignes visibles ; Ctrl + Maj + clic = plage ajoutée ; clic
 * dans la zone vide = vider. Le bouton de repli, les contrôles de ligne et
 * les champs de saisie (renommage) sont ignorés.
 *
 * Clavier (focus sur une ligne, `tabindex` itinérant) : Haut / Bas / Début /
 * Fin déplacent le focus et la sélection (Maj étend, Ctrl ne bouge que le
 * focus) ; Gauche / Droite replient, déplient ou vont au parent / premier
 * enfant ; Espace inverse la ligne ; Ctrl+A sélectionne tout ; Échap vide.
 *
 * `layers:selectionChanged` part chaque fois que l'ensemble des ids, l'ancre ou le
 * focus change (un déplacement du focus seul, avec Ctrl+flèche, l'émet aussi) ;
 * `ids` et `previous` sont dans l'ordre d'affichage. Charger un autre document
 * (`document:loaded`) vide la sélection, l'ancre et le focus : un nouveau
 * document peut réutiliser des ids.
 *
 * Élagage : à chaque `document:changed` (la liste a déjà annoncé ses lignes avec
 * `layers:rowsChanged`, qui ne fait que repeindre), la sélection perd les ids qui ne sont plus dans le
 * document ET ceux qui ne sont plus visibles (dans un dossier replié) ; ainsi
 * une action sur la sélection (supprimer, glisser, grouper) ne touche jamais
 * une ligne cachée. L'ancre et le focus passent sur la ligne restante la plus
 * proche (le dossier replié lui-même, ou la ligne voisine d'une ligne
 * supprimée). `layers:selectionChanged` part si l'élagage a changé quelque chose.
 *
 * Service `layers.selection` : voir `ILayerSelectionService`.
 */

import { isFolder, findNodeById, resolveCollapsed } from '@werddomain/timeline-runtime';
import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import { LAYER_LIST_CLASSES, LAYER_ROW_CLASSES, NAME_EDITING_ATTRIBUTE } from '../list';
import type { ILayerListService, ILayerRow } from '../list';
import { resolveClick } from './clickIntent';
import type { ClickIntent } from './clickIntent';
import { resolveKey } from './keyboardNav';
import type { NavAction, NavRow } from './keyboardNav';
import {
  EMPTY_SELECTION,
  clearSelection,
  focusRow,
  orderedIds,
  pruneSelection,
  sameSelection,
  selectAllIds,
  selectIds,
  selectRangeIds
} from './selectionModel';
import type { SelectionRowRef, SelectionState } from './selectionModel';
import { paintList, paintRows, unpaint } from './selectionView';
import type { ILayerSelectionService, LayerSelectionChangedEvent, SelectionMode } from './types';
import './LayerSelection.less';

/** Identifiant du plugin et de son service. */
export const LAYERS_SELECTION_PLUGIN_ID = 'layers.selection';

/** Éléments sur lesquels un clic ne touche pas à la sélection : repli, contrôles de ligne, saisie. */
const TEXT_INPUT_SELECTOR = [
  `[${NAME_EDITING_ATTRIBUTE}]`,
  'input',
  'textarea',
  'select',
  '[contenteditable]:not([contenteditable="false"])'
].join(',');
const IGNORED_CLICK_SELECTOR = `[data-action="toggle"],.${LAYER_ROW_CLASSES.control},${TEXT_INPUT_SELECTOR}`;

function toRef(row: ILayerRow): SelectionRowRef {
  return row.parentId === undefined ? { id: row.id } : { id: row.id, parentId: row.parentId };
}

function toNavRow(row: ILayerRow): NavRow {
  const folder = isFolder(row.node);
  return {
    id: row.id,
    ...(row.parentId === undefined ? {} : { parentId: row.parentId }),
    isFolder: folder,
    collapsed: folder && resolveCollapsed(row.node)
  };
}

/** Sélection des calques : souris, clavier, élagage et service `layers.selection`. */
export class LayerSelectionPlugin implements EditorPlugin {
  readonly id = 'layers.selection';
  readonly dependencies: readonly string[] = ['layers.list'];

  private ctx: IEditorContext | undefined;
  private list: ILayerListService | undefined;
  private cleanups: Array<() => void> = [];
  private state: SelectionState = EMPTY_SELECTION;
  /** Lignes au moment du dernier élagage : elles servent à retrouver le voisin ou le parent d'une ligne disparue. */
  private knownRows: readonly SelectionRowRef[] = [];
  /** Dernier élément de la liste qui a eu le focus DOM (pour le rendre après le retrait de sa ligne). */
  private focusedElement: Element | undefined;
  /** Appui de souris en cours : a-t-il commencé hors de toute ligne ? `undefined` sans appui connu. */
  private pressedOnEmpty: boolean | undefined;
  private pressTimer: ReturnType<typeof setTimeout> | undefined;
  private renderCleanups: Array<() => void> = [];

  readonly init = (ctx: IEditorContext): void => {
    this.ctx = ctx;
    this.list = ctx.services.require('layers.list');
    this.cleanups = [
      ctx.services.provide(LAYERS_SELECTION_PLUGIN_ID, this.createService()),
      // Lignes neuves : on les repeint seulement. L'élagage attend `document:changed` ou
      // `document:loaded` : la liste annonce ses lignes avant, et sur un chargement la
      // sélection doit être vidée d'un coup, sans élagage intermédiaire.
      ctx.events.on('layers:rowsChanged', () => paintRows(this.requireList(), this.state)),
      ctx.events.on('document:changed', () => this.reconcile()),
      ctx.events.on('document:loaded', () => this.onLoaded())
    ];
  };

  render(): void {
    this.releaseRender();
    const element = this.requireList().element();
    if (element === undefined) return;
    this.listenPressEnd(element.ownerDocument);
    this.knownRows = this.requireList().rows().map(toRef);
    paintList(element);
    this.listen(element, 'focusin', (event) => this.onFocusIn(event as FocusEvent));
    this.listen(element, 'focusout', (event) => this.onFocusOut(event as FocusEvent));
    this.listen(element, 'mousedown', (event) => this.onMouseDown(event as MouseEvent));
    this.listen(element, 'click', (event) => this.onClick(event as MouseEvent));
    this.listen(element, 'keydown', (event) => this.onKeyDown(event as KeyboardEvent));
    const zone = element.parentElement;
    if (zone !== null) this.listen(zone, 'mousedown', (event) => this.onMouseDown(event as MouseEvent));
    if (zone !== null) this.listen(zone, 'click', (event) => this.onZoneClick(event as MouseEvent));
    paintRows(this.requireList(), this.state);
  }

  destroy(): void {
    const cleanups = this.cleanups;
    this.cleanups = [];
    cleanups.forEach((cleanup) => cleanup());
    this.releaseRender();
    if (this.list?.element() !== undefined) unpaint(this.list);
    this.state = EMPTY_SELECTION;
    this.knownRows = [];
    this.focusedElement = undefined;
    this.list = undefined;
    this.ctx = undefined;
  }

  /** Retire les écouteurs posés par `render` (avant un nouveau `render`, et à la destruction). */
  private releaseRender(): void {
    this.pressedOnEmpty = undefined;
    this.clearPressTimer();
    const cleanups = this.renderCleanups;
    this.renderCleanups = [];
    cleanups.forEach((cleanup) => cleanup());
  }

  private onFocusIn(event: FocusEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    this.focusedElement = target;
    // Appui de souris en cours : le clic qui suit décidera (un seul événement par clic).
    if (this.pressedOnEmpty !== undefined) return;
    this.syncRowFocus(target);
  }

  /** Focus arrivé par un autre chemin (lecteur d'écran, autre plugin) : le tabindex suit. */
  private syncRowFocus(target: Element | null): void {
    const list = this.requireList();
    const id = list.rowIdAt(target);
    if (id !== undefined && list.rowElement(id) === target) this.commit(focusRow(this.state, this.rowIds(), id));
  }

  /**
   * Un appui de souris sans clic (relâché hors de la liste, glissement, menu
   * contextuel, fenêtre qui perd le focus) ne doit pas laisser un état d'appui
   * périmé : fin de l'appui, puis le focus DOM éventuel est repris dans le modèle.
   */
  private endPress(): void {
    this.clearPressTimer();
    if (this.pressedOnEmpty === undefined || this.list === undefined) return;
    this.pressedOnEmpty = undefined;
    const active = this.list.element()?.ownerDocument.activeElement ?? null;
    if (this.list.element()?.contains(active) === true) this.syncRowFocus(active);
  }

  private clearPressTimer(): void {
    if (this.pressTimer === undefined) return;
    clearTimeout(this.pressTimer);
    this.pressTimer = undefined;
  }

  private listenPressEnd(doc: Document): void {
    // `mouseup` précède le `click` du même geste : la fin d'appui est différée d'un tour.
    this.listen(doc, 'mouseup', () => {
      this.clearPressTimer();
      this.pressTimer = setTimeout(() => this.endPress(), 0);
    });
    this.listen(doc, 'dragend', () => this.endPress());
    this.listen(doc, 'contextmenu', () => this.endPress());
    const view = doc.defaultView;
    if (view !== null) this.listen(view, 'blur', () => this.endPress());
  }

  /** Mémorise si l'appui d'un clic a commencé dans l'espace vide (hors de toute ligne). */
  private onMouseDown(event: MouseEvent): void {
    this.clearPressTimer();
    this.pressedOnEmpty = this.requireList().rowIdAt(event.target) === undefined;
  }

  /** Vrai si le clic qui finit a commencé dans l'espace vide (ou sans appui connu, clic synthétique) ; remet à zéro. */
  private takePressedOnEmpty(): boolean {
    const startedEmpty = this.pressedOnEmpty !== false;
    this.pressedOnEmpty = undefined;
    return startedEmpty;
  }

  private onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (next instanceof Node && this.list?.element()?.contains(next) !== true) this.focusedElement = undefined;
  }

  /** Vrai si le focus DOM était dans la liste, ou sur un élément de la liste retiré depuis. */
  private listHeldFocus(): boolean {
    const element = this.focusedElement;
    if (element === undefined) return false;
    const active = element.ownerDocument.activeElement;
    return !element.isConnected || active === element || element.contains(active);
  }

  private createService(): ILayerSelectionService {
    return {
      selected: () => orderedIds(this.state, this.rowIds()),
      isSelected: (id) => this.state.ids.has(id) && this.rowIds().includes(id),
      anchor: () => this.visibleOnly(this.state.anchor),
      focused: () => this.visibleOnly(this.state.focused),
      select: (ids, mode = 'replace') => this.select(ids, mode),
      selectRange: (fromId, toId, additive = false) =>
        this.commit(selectRangeIds(this.state, this.rowIds(), fromId, toId, additive)),
      selectAll: () => this.commit(selectAllIds(this.state, this.rowIds())),
      clear: () => this.commit(clearSelection(this.state))
    };
  }

  /** `id` s'il est une ligne visible (entre `layers:rowsChanged` et l'élagage, l'état peut pointer une ligne cachée). */
  private visibleOnly(id: string | undefined): string | undefined {
    return id !== undefined && this.rowIds().includes(id) ? id : undefined;
  }

  private select(ids: readonly string[], mode: SelectionMode): void {
    this.commit(selectIds(this.state, this.rowIds(), ids, mode));
  }

  private rowIds(): readonly string[] {
    return this.requireList().rows().map((row) => row.id);
  }

  /**
   * Adopte `next` ; si les ids, l'ancre ou le focus ont changé, repeint les
   * lignes et annonce `layers:selectionChanged`. `previousIds` : ids d'avant dans
   * leur ordre d'avant (défaut : ordre d'affichage courant).
   */
  private commit(next: SelectionState, previousIds?: readonly string[]): void {
    const before = this.state;
    if (sameSelection(before, next)) return;
    const rowIds = this.rowIds();
    const previous = previousIds ?? orderedIds(before, rowIds);
    this.state = next;
    paintRows(this.requireList(), next);
    const { anchor, focused } = next;
    const payload: LayerSelectionChangedEvent = {
      ids: orderedIds(next, rowIds),
      previous,
      ...(anchor === undefined ? {} : { anchor }),
      ...(focused === undefined ? {} : { focused })
    };
    this.requireContext().events.emit('layers:selectionChanged', payload);
  }

  /** Nouveau document : ses ids peuvent en réutiliser d'anciens, donc tout est remis à zéro. */
  private onLoaded(): void {
    const previousIds = orderedIds(this.state, this.knownRows.map((row) => row.id));
    this.knownRows = this.requireList().rows().map(toRef);
    const held = this.listHeldFocus();
    this.commit(EMPTY_SELECTION, previousIds);
    const first = this.requireList().rows()[0];
    if (held && first !== undefined) this.requireList().rowElement(first.id)?.focus({ preventScroll: true });
  }

  /** Élague la sélection d'après les lignes visibles. */
  private reconcile(): void {
    const held = this.listHeldFocus();
    const ctx = this.requireContext();
    const rows = this.requireList().rows();
    const refs = rows.map(toRef);
    const previousRows = this.knownRows;
    const previousIds = orderedIds(this.state, previousRows.map((row) => row.id));
    const exists = (id: string): boolean => findNodeById(ctx.document.layers, id) !== undefined;
    const next = pruneSelection(this.state, previousRows, refs, exists);
    this.knownRows = refs;
    this.commit(next, previousIds);
    if (held) this.restoreFocus();
  }

  /** Si la ligne qui avait le focus DOM a disparu, le focus passe sur la ligne du modèle. */
  private restoreFocus(): void {
    const element = this.focusedElement;
    const id = this.state.focused;
    if (element?.isConnected !== false || id === undefined) return;
    this.requireList().rowElement(id)?.focus({ preventScroll: true });
  }

  private onClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const list = this.requireList();
    const id = list.rowIdAt(target);
    const startedEmpty = this.takePressedOnEmpty();
    if (target.closest(IGNORED_CLICK_SELECTOR) !== null) {
      // Repli ou contrôle : la sélection ne bouge pas, mais le clavier reste sur cette ligne.
      if (id !== undefined && target.closest(TEXT_INPUT_SELECTOR) === null) {
        this.commit(focusRow(this.state, this.rowIds(), id));
        list.rowElement(id)?.focus({ preventScroll: true });
      }
      return;
    }
    // Appui sur une ligne, relâché ailleurs (clic maladroit, glissement) : le clic arrive
    // sur la liste, pas sur une ligne ; on ne vide pas la sélection pour autant.
    if (id === undefined && !startedEmpty) return;
    const intent = resolveClick(
      { id, ctrl: event.ctrlKey || event.metaKey, shift: event.shiftKey },
      this.state.anchor
    );
    if (intent === undefined) return;
    this.applyClick(intent);
    if (id !== undefined) list.rowElement(id)?.focus({ preventScroll: true });
  }

  /** Clic dans la zone des calques en dehors de la liste (sous les lignes, ou sur « Aucun calque »). */
  private onZoneClick(event: MouseEvent): void {
    const target = event.target;
    const zone = event.currentTarget;
    if (!(target instanceof Element) || !(zone instanceof Element)) return;
    const startedEmpty = this.takePressedOnEmpty();
    const onEmpty = startedEmpty && (target === zone || target.closest(`.${LAYER_LIST_CLASSES.empty}`) !== null);
    if (!onEmpty || event.ctrlKey || event.metaKey || event.shiftKey) return;
    this.commit(clearSelection(this.state));
  }

  private applyClick(intent: ClickIntent): void {
    switch (intent.kind) {
      case 'replace':
        return this.select([intent.id], 'replace');
      case 'toggle':
        return this.select([intent.id], 'toggle');
      case 'range':
        return this.commit(selectRangeIds(this.state, this.rowIds(), intent.from, intent.to, intent.additive));
      case 'clear':
        return this.commit(clearSelection(this.state));
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    const list = this.requireList();
    const target = event.target;
    const rowId = list.rowIdAt(target);
    const onRow = rowId !== undefined && list.rowElement(rowId) === target;
    if (event.defaultPrevented || (!onRow && target !== list.element())) return;
    const current = rowId ?? this.state.focused;
    const action = resolveKey(
      { key: event.key, ctrl: event.ctrlKey || event.metaKey, shift: event.shiftKey, alt: event.altKey },
      { rows: list.rows().map(toNavRow), current, hasSelection: this.state.ids.size > 0 }
    );
    if (action === undefined) return;
    event.preventDefault();
    this.perform(action, current);
  }

  private perform(action: NavAction, current: string | undefined): void {
    const list = this.requireList();
    switch (action.kind) {
      case 'move':
        return this.performMove(action, current);
      case 'collapse':
      case 'expand':
        this.commit(focusRow(this.state, this.rowIds(), action.id));
        list.setCollapsed(action.id, action.kind === 'collapse');
        return;
      case 'toggleRow':
        return this.select([action.id], 'toggle');
      case 'selectAll':
        return this.commit(selectAllIds(this.state, this.rowIds()));
      case 'clear':
        return this.commit(clearSelection(this.state));
    }
  }

  private performMove(action: Extract<NavAction, { kind: 'move' }>, current: string | undefined): void {
    const rowIds = this.rowIds();
    const { to, mode, additive } = action;
    if (mode === 'replace') this.commit(selectIds(this.state, rowIds, [to], 'replace'));
    else if (mode === 'focus') this.commit(focusRow(this.state, rowIds, to));
    else this.commit(selectRangeIds(this.state, rowIds, this.state.anchor ?? current ?? to, to, additive));
    this.requireList().rowElement(to)?.focus();
  }

  private listen(
    target: EventTarget,
    type: 'click' | 'mousedown' | 'mouseup' | 'dragend' | 'contextmenu' | 'blur' | 'keydown' | 'focusin' | 'focusout',
    handler: (event: Event) => void
  ): void {
    target.addEventListener(type, handler);
    this.renderCleanups.push(() => target.removeEventListener(type, handler));
  }

  private requireList(): ILayerListService {
    if (this.list === undefined) throw new Error('layers.selection : plugin non initialisé ou détruit.');
    return this.list;
  }

  private requireContext(): IEditorContext {
    if (this.ctx === undefined) throw new Error('layers.selection : plugin non initialisé ou détruit.');
    return this.ctx;
  }
}
