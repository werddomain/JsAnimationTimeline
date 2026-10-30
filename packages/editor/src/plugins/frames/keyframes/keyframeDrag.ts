// packages/editor/src/plugins/frames/keyframes/keyframeDrag.ts
/**
 * Glisser des images clés sélectionnées (machine à états du pointeur).
 *
 * - Départ : appui du bouton principal, sans Ctrl / Cmd ni Maj, pas au
 *   toucher, sur une image clé sélectionnée d'une ligne modifiable. Le
 *   glisser ne devient actif que lorsque le pointeur change d'image.
 * - Mouvement : le décalage (borné à la timeline) suit l'image sous le
 *   pointeur ; à chaque changement, un essai à blanc du lot (sans l'exécuter)
 *   colore le fantôme : valide ou refusé.
 * - Relâchement (même pointeur) avec un décalage non nul : le lot est
 *   exécuté, une seule entrée d'historique, et la sélection suit.
 * - Échap (phase de capture, seulement pendant un glisser actif),
 *   `pointercancel`, un autre document ou une modification venue d'ailleurs,
 *   la destruction : abandon, sans rien changer, tous les écouteurs retirés.
 */

import type { IEditorContext } from '../../../core/context/IEditorContext';
import type { ISpanCommands } from '../../../model/spans';
import type { IFrameCell } from '../selection/frameSelection';
import type { ISelectedKeyframe } from '../selection/types';
import { moveBatch, moveKeyframes } from './keyframeActions';
import type { IKeyframeGhost } from './keyframeGhost';
import { clampOffset, movableKeyframes, overwritesKeyframe, planMove } from './keyframeMove';
import { checkPropertyOperations, movePropertyKeys, propertyCells, propertyKeys, propertyMoveOperations } from './propertyKeyframeActions';
import type { IPropertyCell } from './propertyKeyframeActions';

/** Bouton principal de la souris. */
const PRIMARY_BUTTON = 0;

/** Geste en cours. */
interface IDragState {
  readonly pointerId: number;
  /** Image sur laquelle le pointeur a appuyé. */
  readonly startFrame: number;
  /** Images clés des lignes modifiables, au départ. */
  readonly keyframes: readonly ISelectedKeyframe[];
  readonly propertyKeys: readonly IPropertyCell[];
  /** Sélection au départ. */
  readonly cells: readonly IFrameCell[];
  /** Décalage courant, borné. */
  readonly offset: number;
  /** Vrai dès que le pointeur a changé d'image. */
  readonly active: boolean;
  /** Retire les écouteurs de ce geste. */
  readonly release: () => void;
}

/** Glisser des images clés sur la grille `grid`. */
export class KeyframeDrag {
  private state: IDragState | undefined;
  private readonly onPointerDown = (event: PointerEvent): void => this.start(event);

  constructor(
    private readonly ctx: IEditorContext,
    private readonly grid: HTMLElement,
    private readonly ghost: IKeyframeGhost,
    private readonly commands: ISpanCommands
  ) {
    grid.addEventListener('pointerdown', this.onPointerDown);
  }

  /** Vrai pendant un glisser actif (le pointeur a changé d'image). */
  get active(): boolean {
    return this.state?.active === true;
  }

  /** Abandonne le geste en cours et retire tous les écouteurs. */
  destroy(): void {
    this.grid.removeEventListener('pointerdown', this.onPointerDown);
    this.abort();
  }

  private start(event: PointerEvent): void {
    this.abort();
    const mayDrag = event.button === PRIMARY_BUTTON && !event.ctrlKey && !event.metaKey && !event.shiftKey;
    if (!mayDrag || event.pointerType === 'touch') return;
    const cell = this.ctx.services.require('frames.grid').cellAt(event.clientX, event.clientY);
    const selection = this.ctx.services.require('frames.selection');
    if (cell === undefined) return;
    // La sélection a déjà traité cet appui (écouteur posé avant celui-ci).
    const keyframes = movableKeyframes(this.ctx.document, selection.keyframes());
    const modern = propertyKeys(this.ctx, selection.cells());
    if (modern.length > 0 && propertyCells(this.ctx, selection.cells()).length !== selection.cells().length) return;
    if (![...keyframes, ...modern].some((key) => key.rowId === cell.rowId && key.frame === cell.frame)) return;
    this.state = {
      pointerId: event.pointerId,
      startFrame: cell.frame,
      keyframes,
      propertyKeys: modern,
      cells: selection.cells(),
      offset: 0,
      active: false,
      release: this.listen()
    };
  }

  /** Écoute le geste ; retourne la fonction qui retire les écouteurs. */
  private listen(): () => void {
    const doc = this.grid.ownerDocument;
    const onMove = (event: PointerEvent): void => this.move(event);
    const onUp = (event: PointerEvent): void => this.up(event);
    const onCancel = (event: PointerEvent): void => {
      if (event.pointerId === this.state?.pointerId) this.abort();
    };
    const onKey = (event: KeyboardEvent): void => this.escape(event);
    const onDocument = (): void => this.abort();
    const stopLoaded = this.ctx.events.on('document:loaded', onDocument);
    const stopChanged = this.ctx.events.on('document:changed', onDocument);
    const stopSelection = this.ctx.events.on('frames:selectionChanged', onDocument);
    const stopRows = this.ctx.events.on('layers:rowsChanged', onDocument);
    const view = doc.defaultView;
    view?.addEventListener('blur', onDocument);
    doc.addEventListener('pointermove', onMove, true);
    doc.addEventListener('pointerup', onUp, true);
    doc.addEventListener('pointercancel', onCancel, true);
    doc.addEventListener('keydown', onKey, true);
    return () => {
      stopLoaded();
      stopChanged();
      stopSelection();
      stopRows();
      view?.removeEventListener('blur', onDocument);
      doc.removeEventListener('pointermove', onMove, true);
      doc.removeEventListener('pointerup', onUp, true);
      doc.removeEventListener('pointercancel', onCancel, true);
      doc.removeEventListener('keydown', onKey, true);
    };
  }

  private move(event: PointerEvent): void {
    const state = this.state;
    if (state === undefined || event.pointerId !== state.pointerId) return;
    // Bouton relâché sans `pointerup` reçu (hors de la fenêtre, perte du focus) : on abandonne.
    if (event.buttons === 0) {
      this.abort();
      return;
    }
    const delta = this.frameUnder(event) - state.startFrame;
    if (!state.active && delta === 0) return;
    const offset = clampOffset(delta, state.propertyKeys.length > 0 ? state.propertyKeys : state.keyframes, this.ctx.document.settings.totalFrames);
    // Pas de sélection de texte du navigateur pendant le glisser.
    event.preventDefault();
    if (state.active && offset === state.offset) return;
    // Le glisser démarre : le relâchement ne doit plus compter comme un clic de la sélection.
    if (!state.active) this.ctx.services.require('frames.selection').cancelPendingClick();
    this.state = { ...state, offset, active: true };
    if (state.propertyKeys.length > 0) {
      const validity = checkPropertyOperations(this.ctx, propertyMoveOperations(state.propertyKeys, offset));
      this.ghost.show(state.propertyKeys.map((key) => ({ rowId: key.rowId, frame: key.frame + offset })), validity.enabled);
    } else this.preview(state.keyframes, offset);
  }

  private up(event: PointerEvent): void {
    const state = this.state;
    if (state === undefined || event.pointerId !== state.pointerId) return;
    this.finish();
    if (!state.active || state.offset === 0) return;
    if (state.propertyKeys.length > 0) {
      movePropertyKeys(this.ctx, state.propertyKeys, state.cells, state.offset);
      return;
    }
    moveKeyframes(this.ctx, this.commands, state.keyframes, state.cells, state.offset);
  }

  private escape(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || !this.active) return;
    event.preventDefault();
    event.stopPropagation();
    this.abort();
  }

  /** Image sous le pointeur : la cellule de la grille, sinon le calcul de la règle. */
  private frameUnder(event: PointerEvent): number {
    const cell = this.ctx.services.require('frames.grid').cellAt(event.clientX, event.clientY);
    return cell?.frame ?? this.ctx.services.require('layout.ruler').frameAtClientX(event.clientX);
  }

  /** Dessine les destinations ; rouge si l'essai à blanc du lot est refusé. */
  private preview(keyframes: readonly ISelectedKeyframe[], offset: number): void {
    const moves = planMove(this.ctx.document, keyframes, offset);
    const batch = moveBatch(this.commands, moves);
    if (batch === undefined) {
      this.ghost.clear();
      return;
    }
    let valid = !overwritesKeyframe(this.ctx.document, moves);
    try {
      if (valid) batch.do(this.ctx.document);
    } catch {
      valid = false;
    }
    this.ghost.show(
      moves.map((move) => ({ rowId: move.rowId, frame: move.to })),
      valid
    );
  }

  /** Termine le geste : écouteurs retirés, fantôme effacé. */
  private finish(): void {
    const state = this.state;
    this.state = undefined;
    state?.release();
    this.ghost.clear();
  }

  private abort(): void {
    if (this.state !== undefined) this.finish();
  }
}
