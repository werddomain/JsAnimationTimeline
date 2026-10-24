// packages/editor/src/plugins/layers/reorder/LayerReorderPlugin.ts
/**
 * Plugin : layers.reorder
 * Epic : layers
 * Dépend de : layers.list, layers.selection
 * Écoute : layers:rowsChanged
 * Émet : —
 *
 * Réorganisation des calques et des dossiers par glisser-déposer : une
 * ligne glissée monte ou descend, entre dans un dossier ou en sort, en une
 * seule commande annulable `Déplacer les calques`. Le CSS met `touch-action:
 * none` sur les lignes pour permettre le glisser au doigt ; en contrepartie, le
 * défilement tactile par balayage ne marche pas sur la liste (molette, barre
 * de défilement et clavier restent possibles). Les calques verrouillés
 * peuvent être déplacés : le verrou protège les images, pas leur place dans
 * la liste.
 *
 * Souris (événements pointeur) : le glisser démarre après quelques pixels ;
 * en dessous, l'appui reste un clic de sélection. Les lignes déplacées sont
 * la sélection si la ligne saisie en fait partie, sinon la ligne seule (qui
 * devient la sélection). Dépôt sur la partie haute (basse) d'une ligne :
 * avant (après) elle ; sur le milieu d'un dossier : dedans, en premier
 * enfant ; sous la dernière ligne : à la fin du premier niveau. Échap annule.
 *
 * Clavier : Ctrl+Alt+Haut / Bas (ou Cmd+Alt, car Ctrl+Alt est le modificateur
 * de VoiceOver sous macOS) déplace la sélection (ou la ligne qui a le
 * focus) d'une ligne, en entrant dans un dossier ou en en sortant au bord
 * (voir `keyboardMove`). Le résultat est annoncé dans une zone `aria-live`
 * polie, propre au plugin et retirée à la destruction.
 *
 * Service `layers.reorder` : voir `ILayerReorderService`. Les opérations sur
 * l'arbre (`treeMoves`, `moveNodes`) sont exportées pour les groupes (Y7) et
 * la barre d'outils (Y8).
 */

import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import type { ILayerListService } from '../list';
import type { ILayerSelectionService } from '../selection';
import { DragController } from './dragController';
import { keyboardMoveTarget } from './keyboardMove';
import type { MoveDirection } from './keyboardMove';
import { describeMove } from './moveAnnouncement';
import { moveNodes } from './moveNodes';
import type { ILayerDropTarget } from './moveNodes';
import { createMoveLayersCommand } from './reorderCommand';
import type { ILayerReorderService } from './types';
import './LayerReorder.less';

/** Identifiant du plugin et de son service. */
export const LAYERS_REORDER_PLUGIN_ID = 'layers.reorder';

/** Classe de la zone d'annonce (masquée à l'écran, lue par les lecteurs d'écran). */
export const LIVE_REGION_CLASS = 'jt-layer-reorder-live';

const KEY_DIRECTIONS: Readonly<Record<string, MoveDirection>> = Object.freeze({ ArrowUp: 'up', ArrowDown: 'down' });

/** Réorganisation des calques : glisser-déposer, clavier et service `layers.reorder`. */
export class LayerReorderPlugin implements EditorPlugin {
  readonly id = 'layers.reorder';
  readonly dependencies: readonly string[] = ['layers.list', 'layers.selection'];

  private ctx: IEditorContext | undefined;
  private list: ILayerListService | undefined;
  private selection: ILayerSelectionService | undefined;
  private drag: DragController | undefined;
  private cleanups: Array<() => void> = [];
  private renderCleanups: Array<() => void> = [];
  private liveRegion: HTMLElement | undefined;

  readonly init = (ctx: IEditorContext): void => {
    this.ctx = ctx;
    this.list = ctx.services.require('layers.list');
    this.selection = ctx.services.require('layers.selection');
    const service: ILayerReorderService = { move: (ids, target) => this.move(ids, target) };
    this.drag = new DragController({
      list: this.list,
      selection: this.selection,
      document: () => this.requireContext().document,
      move: (ids, target) => this.move(ids, target)
    });
    this.cleanups = [
      ctx.services.provide(LAYERS_REORDER_PLUGIN_ID, service),
      // Les lignes ont changé pendant un glisser : le repère serait faux, on annule.
      ctx.events.on('layers:rowsChanged', () => this.drag?.cancel())
    ];
  };

  render(): void {
    this.releaseRender();
    const element = this.requireList().element();
    if (element === undefined) return;
    this.drag?.attach(element);
    this.liveRegion = this.createLiveRegion(element);
    const onKeyDown = (event: KeyboardEvent): void => this.onKeyDown(event);
    element.addEventListener('keydown', onKeyDown);
    this.renderCleanups.push(() => element.removeEventListener('keydown', onKeyDown));
  }

  destroy(): void {
    const cleanups = this.cleanups;
    this.cleanups = [];
    cleanups.forEach((cleanup) => cleanup());
    this.releaseRender();
    this.drag?.destroy();
    this.drag = undefined;
    this.list = undefined;
    this.selection = undefined;
    this.ctx = undefined;
  }

  private releaseRender(): void {
    const cleanups = this.renderCleanups;
    this.renderCleanups = [];
    cleanups.forEach((cleanup) => cleanup());
    this.drag?.destroy();
    this.liveRegion?.remove();
    this.liveRegion = undefined;
  }

  private move(ids: readonly string[], target: ILayerDropTarget): boolean {
    const ctx = this.requireContext();
    // Refus ou no-op détectés ici : aucune commande n'est créée.
    if (moveNodes(ctx.document, ids, target) === ctx.document) return false;
    return ctx.commands.execute(createMoveLayersCommand(ids, target));
  }

  /** Ctrl+Alt+Haut / Bas : déplace la sélection (ou la ligne focalisée) d'une ligne. */
  private onKeyDown(event: KeyboardEvent): void {
    const direction = KEY_DIRECTIONS[event.key];
    if (direction === undefined || !(event.ctrlKey || event.metaKey) || !event.altKey || event.shiftKey || event.defaultPrevented) return;
    const list = this.requireList();
    const selection = this.requireSelection();
    const rowId = list.rowIdAt(event.target);
    const onRow = rowId !== undefined && list.rowElement(rowId) === event.target;
    if (!onRow && event.target !== list.element()) return;
    const focused = selection.focused();
    const ids = selection.selected().length > 0 ? selection.selected() : focused === undefined ? [] : [focused];
    const target = keyboardMoveTarget(this.requireContext().document, list.rows(), ids, direction);
    if (target === undefined) return;
    event.preventDefault();
    if (!this.move(ids, target)) return;
    if (focused !== undefined) list.rowElement(focused)?.focus();
    this.announce(describeMove(this.requireContext().document, ids));
  }

  /** Zone d'annonce polie, à côté de la liste (jamais dans la liste : la liste range ses lignes par index). */
  private createLiveRegion(list: HTMLElement): HTMLElement {
    const region = list.ownerDocument.createElement('div');
    region.classList.add(LIVE_REGION_CLASS);
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    list.after(region);
    return region;
  }

  private announce(text: string): void {
    if (this.liveRegion !== undefined) this.liveRegion.textContent = text;
  }

  private requireList(): ILayerListService {
    if (this.list === undefined) throw new Error('layers.reorder : plugin non initialisé ou détruit.');
    return this.list;
  }

  private requireSelection(): ILayerSelectionService {
    if (this.selection === undefined) throw new Error('layers.reorder : plugin non initialisé ou détruit.');
    return this.selection;
  }

  private requireContext(): IEditorContext {
    if (this.ctx === undefined) throw new Error('layers.reorder : plugin non initialisé ou détruit.');
    return this.ctx;
  }
}
