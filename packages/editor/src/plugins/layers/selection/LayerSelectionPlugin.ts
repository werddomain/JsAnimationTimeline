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
 * (`document:loaded`) vide la sélection et l'ancre en un seul événement : un
 * nouveau document peut réutiliser des ids. Le focus est vidé aussi, sauf si le
 * focus DOM était dans la liste : il passe alors sur la première ligne, dans le
 * même événement.
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

import { isFolder, findNodeById, resolveCollapsed } from '@kazo-ca/timeline-runtime';
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
  /**
   * Vrai pendant la tâche d'un appui (souris ou doigt) hors de la liste, ou d'un Tab hors d'une saisie : le focus part alors de lui-même.
   * Une saisie (renommage) qui valide sur `blur` et se détache n'a pas à rendre le focus à la ligne. On ne
   * se fie pas à `blur` : Chromium en envoie un aussi quand l'élément focalisé est retiré, et là la ligne
   * doit au contraire récupérer le focus.
   */
  private outsidePress = false;
  private outsidePressTimer: ReturnType<typeof setTimeout> | undefined;
  /** Appui de souris en cours : a-t-il commencé hors de toute ligne ? `undefined` sans appui connu. */
  private pressedOnEmpty: boolean | undefined;
  /** Où l'appui a été relâché : hors de toute ligne ? `undefined` sans relâchement connu. */
  private releasedOnEmpty: boolean | undefined;
  /** Ligne qui a reçu le focus pendant l'appui : le clic (ou la fin de l'appui) la reprend dans le modèle. */
  private pendingFocus: Element | undefined;
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
    this.flushPendingFocus();
    this.releaseRender();
    const element = this.requireList().element();
    if (element === undefined) return;
    this.listenPressEnd(element.ownerDocument);
    this.knownRows = this.requireList().rows().map(toRef);
    paintList(element);
    const onPress = (event: Event): void => this.onDocumentPress(event);
    const onLeave = (event: Event): void => this.onFocusLeaving(event);
    const doc = element.ownerDocument;
    doc.addEventListener('pointerdown', onPress, true);
    doc.addEventListener('mousedown', onPress, true);
    // Tab : le blur (relatedTarget connu, ou clavier sans destinataire) valide la saisie comme un clic ailleurs.
    element.addEventListener('blur', onLeave, true);
    element.addEventListener('keydown', onLeave, true);
    this.renderCleanups.push(() => {
      element.removeEventListener('blur', onLeave, true);
      element.removeEventListener('keydown', onLeave, true);
      doc.removeEventListener('pointerdown', onPress, true);
      doc.removeEventListener('mousedown', onPress, true);
      this.clearOutsidePress();
    });
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
    this.resetPress();
    const cleanups = this.renderCleanups;
    this.renderCleanups = [];
    cleanups.forEach((cleanup) => cleanup());
  }

  private onFocusIn(event: FocusEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    this.focusedElement = target;
    // Appui de souris en cours : le clic qui suit décidera (un seul événement par clic) ;
    // si ce clic ne fait rien, `flushPendingFocus` reprend ce focus.
    if (this.pressedOnEmpty !== undefined) {
      this.pendingFocus = target;
      return;
    }
    this.syncRowFocus(target);
  }

  private resetPress(): void {
    this.pressedOnEmpty = undefined;
    this.releasedOnEmpty = undefined;
    this.pendingFocus = undefined;
    this.clearPressTimer();
  }

  /** Reprend dans le modèle le focus arrivé pendant l'appui qui vient de finir. */
  private flushPendingFocus(): void {
    const target = this.pendingFocus;
    this.pendingFocus = undefined;
    if (target !== undefined && this.list !== undefined) this.syncRowFocus(target);
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
    this.releasedOnEmpty = undefined;
    this.flushPendingFocus();
  }

  private clearPressTimer(): void {
    if (this.pressTimer === undefined) return;
    clearTimeout(this.pressTimer);
    this.pressTimer = undefined;
  }

  private listenPressEnd(doc: Document): void {
    // `mouseup` précède le `click` du même geste : la fin d'appui est différée d'un tour.
    this.listen(doc, 'mouseup', (event) => {
      if (this.pressedOnEmpty !== undefined && this.list !== undefined) {
        this.releasedOnEmpty = this.list.rowIdAt(event.target) === undefined;
      }
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

  /**
   * Vrai si le clic qui finit a commencé ET fini dans l'espace vide (un clic
   * sans appui connu, synthétique, compte comme vide) ; remet l'appui à zéro.
   */
  private takePressedOnEmpty(): boolean {
    const onEmpty = this.pressedOnEmpty !== false && this.releasedOnEmpty !== false;
    this.pressedOnEmpty = undefined;
    this.releasedOnEmpty = undefined;
    this.clearPressTimer();
    return onEmpty;
  }

  /** Appui hors de la liste : le marqueur vit jusqu'à la fin de la tâche (le blur qui en résulte arrive dans la même). */
  private onDocumentPress(event: Event): void {
    const list = this.list?.element();
    const target = event.target;
    if (list === undefined || (target instanceof Node && list.contains(target))) return;
    this.markFocusLeaving();
  }

  /**
   * Le focus quitte une saisie de la liste de lui-même : `blur` vers un élément connu (Tab ; voir `blurLeaves`
   * pour un `blur` sans destinataire) ou touche Tab.
   */
  private onFocusLeaving(event: Event): void {
    const target = event.target;
    if (!(target instanceof Element) || !target.matches(TEXT_INPUT_SELECTOR)) return;
    const leaves = event instanceof KeyboardEvent ? event.key === 'Tab' : this.blurLeaves(target, event as FocusEvent);
    if (leaves) this.markFocusLeaving();
  }

  /**
   * Un `blur` sans destinataire est un départ (clic dans une iframe : la scène) si la ligne de la saisie est
   * encore affichée ; si elle ne l'est plus, c'est le `blur` que Chromium envoie à l'élément retiré (la liste a
   * déjà recalculé ses lignes d'après le nouveau document) et la ligne voisine doit récupérer le focus.
   * A window or tab switch sends the same destination-less blur while the document loses focus.
   * Keep the row in keyboard navigation in that case; a focused document still signals an iframe departure.
   */
  private blurLeaves(target: Element, event: FocusEvent): boolean {
    if (event.relatedTarget !== null) return true;
    if (!target.ownerDocument.hasFocus()) return false;
    const id = target.closest<HTMLElement>('[data-row-id]')?.dataset.rowId;
    // Saisie hors d'une ligne (en-tête, contrôle) : aucune ligne à retirer, c'est un départ.
    if (id === undefined) return true;
    return this.list?.row(id) !== undefined;
  }

  private markFocusLeaving(): void {
    this.outsidePress = true;
    clearTimeout(this.outsidePressTimer);
    this.outsidePressTimer = setTimeout(() => this.clearOutsidePress(), 0);
  }

  private clearOutsidePress(): void {
    this.outsidePress = false;
    clearTimeout(this.outsidePressTimer);
    this.outsidePressTimer = undefined;
  }

  private onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget;
    const target = event.target;
    const toOutside = next instanceof Node && this.list?.element()?.contains(next) !== true;
    if (toOutside) {
      this.focusedElement = undefined;
      return;
    }
    if (next !== null || !(target instanceof Element)) return;
    // Focus perdu sans destinataire. Chromium envoie aussi cet événement, avant de détacher
    // l'élément, quand on retire la ligne qui a le focus : on décide après coup. Si la ligne
    // est toujours là une fois la pile finie, c'était un vrai départ ; sinon `reconcile` ou
    // `onLoaded` s'en sert pour rendre le focus.
    queueMicrotask(() => {
      // Un focus rendu dans la même pile (blur puis focus) garde l'élément suivi.
      const stillFocused = target.ownerDocument.activeElement === target;
      if (target.isConnected && !stillFocused && this.focusedElement === target) this.focusedElement = undefined;
    });
  }

  /** Vrai si le focus DOM était dans la liste, ou sur un élément de la liste retiré depuis. */
  private listHeldFocus(): boolean {
    const element = this.focusedElement;
    if (element === undefined) return false;
    // Saisie détachée en validant sur un clic hors de la liste : le focus est parti ailleurs de lui-même.
    // Suppression de la ligne au clavier (ou annulation) pendant la saisie : pas d'appui, la ligne voisine le reçoit.
    if (this.outsidePress && element.matches(TEXT_INPUT_SELECTOR)) return false;
    const doc = element.ownerDocument;
    const active = doc.activeElement;
    const inListOrNowhere =
      active === null || active === doc.body || this.list?.element()?.contains(active) === true;
    if (!inListOrNowhere) return false;
    return !element.isConnected || active === element || element.contains(active);
  }

  private createService(): ILayerSelectionService {
    return {
      selected: () => orderedIds(this.state, this.rowIds()),
      isSelected: (id) => this.state.ids.has(id) && this.rowIds().includes(id),
      anchor: () => this.visibleOnly(this.state.anchor),
      focused: () => this.visibleOnly(this.state.focused),
      select: (ids, mode = 'replace', options) => this.select(ids, mode, options?.previous),
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

  private select(ids: readonly string[], mode: SelectionMode, previous?: readonly string[]): void {
    this.commit(selectIds(this.state, this.rowIds(), ids, mode), previous === undefined ? undefined : [...previous]);
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
    const first = this.requireList().rows()[0]?.id;
    const focused = this.listHeldFocus() ? first : undefined;
    this.commit({ ids: new Set(), anchor: undefined, focused }, previousIds);
    if (focused !== undefined) this.requireList().rowElement(focused)?.focus({ preventScroll: true });
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
    const onEmpty = this.takePressedOnEmpty();
    try {
      this.handleClick(event, onEmpty);
    } finally {
      this.flushPendingFocus();
    }
  }

  private handleClick(event: MouseEvent, pressOnEmpty: boolean): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const list = this.requireList();
    const id = list.rowIdAt(target);
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
    if (id === undefined && !pressOnEmpty) return;
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
    const pressOnEmpty = this.takePressedOnEmpty();
    this.flushPendingFocus();
    const onEmpty = pressOnEmpty && (target === zone || target.closest(`.${LAYER_LIST_CLASSES.empty}`) !== null);
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
