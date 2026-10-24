// packages/editor/src/plugins/layers/reorder/dragController.ts
/**
 * Glisser-déposer des lignes de la liste, aux événements pointeur (pas le
 * glisser-déposer HTML5, peu fiable et intestable sous jsdom).
 *
 * Un appui sur une ligne ouvre une session « en attente » ; le glisser ne
 * démarre qu'après un déplacement de `DRAG_THRESHOLD` pixels. Avant ce seuil
 * l'appui reste un clic ordinaire (rien n'est empêché : la sélection de Y5
 * fonctionne). Après un vrai glisser, le clic qui suit est supprimé.
 *
 * Pendant le glisser : classes sur la liste et sur les lignes déplacées,
 * repère de dépôt (`DropIndicator`), capture du pointeur. Le dépôt appelle
 * `deps.move` ; tout le reste annule sans toucher au document. Un glisser se
 * termine par :
 * - le dépôt (`pointerup`) ;
 * - Échap, un changement des lignes, un menu contextuel, la perte du focus de la
 *   fenêtre ou la perte de la capture du pointeur : la session est annulée mais
 *   reste en attente du relâchement (le bouton peut être encore enfoncé), qui
 *   supprime alors le clic ; un nouvel appui, ou un déplacement souris sans bouton,
 *   la clôt aussi ;
 * - `pointercancel` (aucun clic ne suit) ;
 * - un déplacement de la souris sans bouton enfoncé (le relâchement s'est perdu) ;
 * - la destruction.
 * Tout (écouteurs, classes, repère, capture) est retiré à la fin de la session.
 */

import type { ITimelineDocument } from '@werddomain/timeline-runtime';
import type { ILayerListService } from '../list';
import { LAYER_ROW_CLASSES, NAME_EDITING_ATTRIBUTE } from '../list';
import type { ILayerSelectionService } from '../selection';
import { REORDER_CLASSES, DropIndicator } from './dropIndicator';
import { locateDrop, placementAt, toDropTarget } from './dropTarget';
import type { IDropPlacement, IRowBox } from './dropTarget';
import { moveNodes } from './moveNodes';
import type { ILayerDropTarget } from './moveNodes';
import { topMostIds } from './treeMoves';
import { ROW_HEIGHT } from '../../../model/rows';

/** Déplacement minimal du pointeur (en pixels) avant que l'appui devienne un glisser. */
export const DRAG_THRESHOLD = 4;
/** Durée pendant laquelle le clic qui suit un glisser est supprimé (ms). */
export const CLICK_SUPPRESSION_MS = 50;

const PRIMARY_BUTTON = 0;
/** Bit de `event.buttons` du bouton principal. */
const PRIMARY_BUTTONS_MASK = 1;
/** Champs de saisie, y compris le nom en cours de renommage. */
const TEXT_INPUT_SELECTOR = [
  `[${NAME_EDITING_ATTRIBUTE}]`,
  'input',
  'textarea',
  'select',
  '[contenteditable]:not([contenteditable="false"])'
].join(',');
/** Éléments sur lesquels un appui ne démarre pas de glisser : contrôles, repli, saisie. */
const IGNORED_SELECTOR = `.${LAYER_ROW_CLASSES.control},[data-action="toggle"],${TEXT_INPUT_SELECTOR}`;

/** Ce dont le contrôleur a besoin : services des deux plugins parents, document courant, déplacement. */
export interface IDragDeps {
  readonly list: ILayerListService;
  readonly selection: ILayerSelectionService;
  readonly document: () => ITimelineDocument;
  readonly move: (ids: readonly string[], target: ILayerDropTarget) => boolean;
}

interface IDragSession {
  readonly pointerId: number;
  readonly rowId: string;
  readonly startX: number;
  readonly startY: number;
  started: boolean;
  /** Annulée (Échap...) mais le bouton est encore enfoncé : on attend le relâchement. */
  cancelled: boolean;
  ids: readonly string[];
  placement: IDropPlacement | undefined;
  dragged: HTMLElement[];
  indicator: DropIndicator | undefined;
  stop: () => void;
  /** Retire l'écouteur de Échap (dès l'annulation : Échap redevient libre). */
  stopKey: () => void;
  /** Retire l'écouteur de `lostpointercapture` (posé au démarrage du glisser). */
  stopLost: () => void;
}

/** Contrôleur du glisser-déposer des lignes, attaché à l'élément de la liste. */
export class DragController {
  private listElement: HTMLElement | undefined;
  private session: IDragSession | undefined;
  private suppressClick: (() => void) | undefined;

  constructor(private readonly deps: IDragDeps) {}

  /** Écoute les appuis sur `element` (l'élément de `layers.list`). */
  attach(element: HTMLElement): void {
    this.destroy();
    this.listElement = element;
    element.addEventListener('pointerdown', this.onPointerDown);
  }

  /** Vrai pendant un glisser démarré (seuil franchi, ni annulé ni terminé). */
  get dragging(): boolean {
    return this.session?.started === true && !this.session.cancelled;
  }

  /** Annule le glisser en cours sans modifier le document (sans effet si aucun). */
  cancel(): void {
    const session = this.session;
    if (session === undefined) return;
    if (!session.started) {
      this.endSession();
      return;
    }
    this.teardownVisuals(session);
    session.stopKey();
    session.cancelled = true;
  }

  /** Retire tous les écouteurs et le repère ; à appeler avant de remplacer ou de retirer la liste. */
  destroy(): void {
    this.endSession();
    this.suppressClick?.();
    this.listElement?.removeEventListener('pointerdown', this.onPointerDown);
    this.listElement = undefined;
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    const element = this.listElement;
    const target = event.target;
    if (element === undefined || !(target instanceof Element)) return;
    // Session annulée qui attendait un relâchement jamais reçu : ce nouvel appui la clôt.
    if (this.session?.cancelled === true) this.endSession();
    if (this.session !== undefined) return;
    if (event.button !== PRIMARY_BUTTON || event.isPrimary === false) return;
    if (target.closest(IGNORED_SELECTOR) !== null) return;
    const rowId = this.deps.list.rowIdAt(target);
    if (rowId === undefined) return;
    const doc = element.ownerDocument;
    const onMove = (move: PointerEvent): void => this.onPointerMove(move);
    const onEnd = (end: PointerEvent): void => this.onPointerEnd(end);
    const onKey = (key: KeyboardEvent): void => this.onKeyDown(key);
    doc.addEventListener('pointermove', onMove);
    doc.addEventListener('pointerup', onEnd);
    doc.addEventListener('pointercancel', onEnd);
    doc.addEventListener('keydown', onKey, true);
    // Le relâchement peut ne jamais arriver (menu contextuel, fenêtre qui perd le focus) : on abandonne alors.
    const onAbort = (): void => this.abortHeld();
    const win = doc.defaultView;
    doc.addEventListener('contextmenu', onAbort);
    win?.addEventListener('blur', onAbort);
    const stopKey = (): void => doc.removeEventListener('keydown', onKey, true);
    const stop = (): void => {
      doc.removeEventListener('pointermove', onMove);
      doc.removeEventListener('pointerup', onEnd);
      doc.removeEventListener('pointercancel', onEnd);
      doc.removeEventListener('contextmenu', onAbort);
      win?.removeEventListener('blur', onAbort);
      stopKey();
    };
    this.session = {
      pointerId: event.pointerId,
      rowId,
      startX: event.clientX,
      startY: event.clientY,
      started: false,
      cancelled: false,
      ids: [],
      placement: undefined,
      dragged: [],
      indicator: undefined,
      stop,
      stopKey,
      stopLost: () => undefined
    };
  };

  private onPointerMove(event: PointerEvent): void {
    const session = this.session;
    if (session === undefined || event.pointerId !== session.pointerId) return;
    // Plus de bouton enfoncé : le relâchement a été perdu, ce survol ne doit pas démarrer ni poursuivre un glisser.
    // (Un stylet ou un doigt peut annoncer 0 en contact : seule la souris est contrôlée.)
    if (event.pointerType === 'mouse' && (event.buttons & PRIMARY_BUTTONS_MASK) === 0) {
      this.abortReleased();
      return;
    }
    if (session.cancelled) return;
    if (!session.started) {
      const distance = Math.hypot(event.clientX - session.startX, event.clientY - session.startY);
      if (distance < DRAG_THRESHOLD) return;
      this.startDrag(session);
    }
    this.updateTarget(session, event.clientY);
  }

  private onPointerEnd(event: PointerEvent): void {
    const session = this.session;
    if (session === undefined || event.pointerId !== session.pointerId) return;
    if (!session.started) {
      this.endSession();
      return;
    }
    const drop = event.type === 'pointerup' && !session.cancelled;
    if (drop) this.updateTarget(session, event.clientY);
    const { ids, placement } = session;
    this.endSession();
    // Pas de clic après un `pointercancel` ; après un relâchement, le navigateur en envoie un.
    if (event.type === 'pointerup') this.armClickSuppression();
    if (drop && placement !== undefined && this.deps.move(ids, toDropTarget(placement))) {
      // Comme au clavier : le focus suit la première ligne déplacée (ses éléments ont été réordonnés).
      const first = ids[0];
      const active = this.listElement?.ownerDocument.activeElement;
      const typing = active?.closest(TEXT_INPUT_SELECTOR) != null;
      if (first !== undefined && !typing) this.deps.list.rowElement(first)?.focus({ preventScroll: true });
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    // Avant le seuil, l'appui est un clic : Échap passe (Y5 vide la sélection).
    if (event.key !== 'Escape' || !this.dragging) return;
    event.preventDefault();
    event.stopPropagation();
    this.cancel();
  }

  /** Seuil franchi : fixe les lignes déplacées, pose les classes, capture le pointeur. */
  private startDrag(session: IDragSession): void {
    const element = this.listElement;
    if (element === undefined) return;
    const { list, selection } = this.deps;
    const grabbed = selection.isSelected(session.rowId);
    // Saisir une ligne non sélectionnée la sélectionne (comme Flash) : le glisser a un retour visuel.
    if (!grabbed) selection.select([session.rowId]);
    const wanted = grabbed ? selection.selected() : [session.rowId];
    session.ids = topMostIds(this.deps.document().layers, wanted);
    session.started = true;
    session.indicator = new DropIndicator(list, element);
    session.dragged = this.markDragged(session.ids);
    element.classList.add(REORDER_CLASSES.listDragging);
    // Le doigt reçoit une capture implicite sur la ligne : seul le relâchement de NOTRE capture (cible = liste) compte.
    const onLost = (lost: Event): void => {
      if (lost.target === element && (lost as PointerEvent).pointerId === session.pointerId) this.abortHeld();
    };
    element.addEventListener('lostpointercapture', onLost);
    session.stopLost = () => element.removeEventListener('lostpointercapture', onLost);
    try {
      element.setPointerCapture?.(session.pointerId);
    } catch {
      // Pointeur déjà relâché ou capture non gérée : le glisser marche sans.
    }
  }

  /** Pose la classe sur les lignes déplacées et sur leurs descendants visibles. */
  private markDragged(ids: readonly string[]): HTMLElement[] {
    const flagged = new Set<string>();
    const elements: HTMLElement[] = [];
    this.deps.list.rows().forEach((row) => {
      const moved = ids.includes(row.id) || (row.parentId !== undefined && flagged.has(row.parentId));
      if (!moved) return;
      flagged.add(row.id);
      const element = this.deps.list.rowElement(row.id);
      element?.classList.add(REORDER_CLASSES.dragging);
      if (element !== undefined) elements.push(element);
    });
    return elements;
  }

  /** Recalcule la destination sous `clientY` et met le repère à jour (caché si le dépôt est sans effet). */
  private updateTarget(session: IDragSession, clientY: number): void {
    const doc = this.deps.document();
    const hit = locateDrop(this.rowBoxes(), clientY);
    const placement = hit === undefined ? undefined : placementAt(doc, hit);
    const effective = placement !== undefined && moveNodes(doc, session.ids, placement) !== doc;
    session.placement = effective ? placement : undefined;
    if (session.placement === undefined) session.indicator?.hide();
    else session.indicator?.show(session.placement);
  }

  private rowBoxes(): IRowBox[] {
    const boxes: IRowBox[] = [];
    this.deps.list.rows().forEach((row) => {
      const rect = this.deps.list.rowElement(row.id)?.getBoundingClientRect();
      if (rect === undefined) return;
      boxes.push({ id: row.id, kind: row.kind, top: rect.top, height: rect.height > 0 ? rect.height : ROW_HEIGHT });
    });
    return boxes;
  }

  /** Retire classes, repère et capture (la session reste, si elle attend le relâchement). */
  private teardownVisuals(session: IDragSession): void {
    session.dragged.forEach((element) => element.classList.remove(REORDER_CLASSES.dragging));
    session.dragged = [];
    // Avant de relâcher la capture : ce relâchement ne doit pas finir la session (annulation par Échap).
    session.stopLost();
    session.indicator?.destroy();
    session.indicator = undefined;
    session.placement = undefined;
    const element = this.listElement;
    if (element === undefined) return;
    element.classList.remove(REORDER_CLASSES.listDragging);
    try {
      element.releasePointerCapture?.(session.pointerId);
    } catch {
      // La capture a déjà pris fin avec le pointeur.
    }
  }

  /**
   * Abandon sans dépôt alors que le bouton peut rester enfoncé (menu contextuel,
   * perte du focus, capture perdue). Un glisser démarré est annulé mais la session
   * reste, en attente du relâchement : `onPointerEnd` arme alors la suppression du
   * clic, quel que soit le délai. Avant le seuil, rien à supprimer : la session finit.
   */
  private abortHeld(): void {
    const session = this.session;
    if (session === undefined) return;
    if (!session.started) this.endSession();
    else if (!session.cancelled) this.cancel();
  }

  /**
   * Abandon parce qu'un déplacement souris arrive sans bouton enfoncé : le
   * relâchement a eu lieu hors de nos yeux. La session finit ; si le glisser
   * avait démarré, le clic éventuel du relâchement est supprimé.
   */
  private abortReleased(): void {
    const started = this.session?.started === true;
    this.endSession();
    if (started) this.armClickSuppression();
  }

  private endSession(): void {
    const session = this.session;
    if (session === undefined) return;
    this.session = undefined;
    session.stop();
    this.teardownVisuals(session);
  }

  /**
   * Supprime le prochain clic du document (celui qui suit le relâchement d'un
   * glisser) : sur le document, il couvre aussi un dépôt sous la dernière ligne,
   * dont le clic vise la zone vide et vide la sélection (Y5).
   */
  private armClickSuppression(): void {
    const element = this.listElement?.ownerDocument;
    if (element === undefined) return;
    this.suppressClick?.();
    const onClick = (event: MouseEvent): void => {
      event.stopPropagation();
      event.preventDefault();
      disarm();
    };
    const timer = setTimeout(() => disarm(), CLICK_SUPPRESSION_MS);
    const disarm = (): void => {
      clearTimeout(timer);
      element.removeEventListener('click', onClick, true);
      if (this.suppressClick === disarm) this.suppressClick = undefined;
    };
    element.addEventListener('click', onClick, true);
    this.suppressClick = disarm;
  }
}

