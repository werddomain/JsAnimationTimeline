// packages/editor/src/plugins/layers/icon/LayerIconPlugin.ts
/**
 * Plugin : layers.icon
 * Epic : layers
 * Dépend de : layers.list
 * Écoute : document:loaded, document:changed
 * Émet : —
 *
 * Choix de l'icône d'un calque. Un clic sur l'icône d'une ligne de calque
 * (pas d'un dossier, qui n'a pas de champ `icon`) ouvre un menu : icônes
 * intégrées, « Icône par défaut » et « Personnalisée… » (URL ou classes CSS,
 * validées par `classifyLayerIcon`). Un second clic sur la même icône le
 * ferme. Au clavier, Alt+I sur une ligne de calque (ou dans la ligne) ouvre
 * le même menu. Le choix est une commande annulable « Changer l'icône du
 * calque ». L'icône ne dépend jamais de la cible animée.
 *
 * Le menu se ferme aussi quand son calque disparaît du document ou devient
 * un dossier. Le clic et Alt+I sont écoutés sur le conteneur de l'éditeur
 * (le service `layers.list` ne publie son élément qu'au rendu) ; `rowIdAt`
 * garde les événements de la liste. Le clic n'est pas arrêté : la sélection
 * de la ligne a lieu comme d'habitude.
 *
 * Service `layers.icon` : `setIcon(id, icon | undefined)` et `openChooser(id)`.
 */

import { findNodeById, isFolder } from '@werddomain/timeline-runtime';
import type { ILayer } from '@werddomain/timeline-runtime';
import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import { LAYER_ROW_CLASSES } from '../list/LayerRowView';
import type { ILayerListService } from '../list/types';
import { createSetIconCommand, validateLayerIcon } from './iconCommand';
import { iconChoices } from './iconChoices';
import { IconMenu } from './IconMenu';
import type { ILayerIconService } from './types';
import { classifyLayerIcon } from '../list/layerIcon';
import './LayerIcon.less';

/** Identifiant du plugin et de son service. */
export const LAYERS_ICON_PLUGIN_ID = 'layers.icon';

const ICON_SELECTOR = `.${LAYER_ROW_CLASSES.icon}`;

/** Vrai pour le raccourci Alt+I (sans Ctrl ni Méta), quelle que soit la disposition du clavier. */
function isOpenChooserKey(event: KeyboardEvent): boolean {
  if (!event.altKey || event.ctrlKey || event.metaKey) return false;
  return event.code === 'KeyI' || event.key.toLowerCase() === 'i';
}

/** Choix de l'icône des calques : menu et service. */
export class LayerIconPlugin implements EditorPlugin {
  readonly id = 'layers.icon';
  readonly dependencies: readonly string[] = ['layers.list'];

  private cleanups: Array<() => void> = [];
  private menu: IconMenu | undefined;
  private anchorId: string | undefined;
  /** Id de la ligne dont l'icône a été pressée alors que son menu était ouvert. */
  private pressedOpenFor: string | undefined;

  readonly init = (ctx: IEditorContext): void => {
    const list = ctx.services.require('layers.list');
    const service: ILayerIconService = {
      setIcon: (id, icon) => this.setIcon(ctx, id, icon),
      openChooser: (id) => this.openChooser(ctx, list, id)
    };
    const onClick = (event: MouseEvent): void => this.onClick(ctx, list, event);
    const onKeyDown = (event: KeyboardEvent): void => this.onKeyDown(ctx, list, event);
    const onMouseDown = (event: MouseEvent): void => this.onMouseDown(list, event);
    ctx.container.addEventListener('mousedown', onMouseDown, true);
    ctx.container.addEventListener('click', onClick);
    ctx.container.addEventListener('keydown', onKeyDown);
    this.cleanups = [
      ctx.services.provide(LAYERS_ICON_PLUGIN_ID, service),
      () => ctx.container.removeEventListener('mousedown', onMouseDown, true),
      () => ctx.container.removeEventListener('click', onClick),
      () => ctx.container.removeEventListener('keydown', onKeyDown),
      ctx.events.on('document:changed', () => this.closeIfStale(ctx)),
      ctx.events.on('document:loaded', () => this.closeIfStale(ctx))
    ];
  };

  destroy(): void {
    this.menu?.close();
    const cleanups = this.cleanups.reverse();
    this.cleanups = [];
    cleanups.forEach((cleanup) => cleanup());
  }

  private setIcon(ctx: IEditorContext, id: string, icon: string | undefined): boolean {
    const node = findNodeById(ctx.document.layers, id);
    if (node === undefined || isFolder(node)) return false;
    if (icon !== undefined && !validateLayerIcon(icon).ok) return false;
    return ctx.commands.execute(createSetIconCommand(ctx.document, id, icon));
  }

  /** Calque `id` du document, ou `undefined` (inconnu ou dossier). */
  private layerOf(ctx: IEditorContext, id: string | undefined): ILayer | undefined {
    const node = id === undefined ? undefined : findNodeById(ctx.document.layers, id);
    return node === undefined || isFolder(node) ? undefined : node;
  }

  private openChooser(ctx: IEditorContext, list: ILayerListService, id: string): void {
    this.menu?.close();
    const layer = this.layerOf(ctx, id);
    if (layer === undefined) return;
    const rowElement = list.rowElement(id);
    const anchor = rowElement?.querySelector(ICON_SELECTOR)?.getBoundingClientRect();
    const active = ctx.container.ownerDocument.activeElement;
    const returnFocus = active instanceof HTMLElement && active !== active.ownerDocument.body ? active : rowElement;
    const customValue = layer.icon !== undefined && classifyLayerIcon(layer.icon) !== 'builtin' ? layer.icon : undefined;
    const menu = new IconMenu(ctx.container, iconChoices(layer.icon), anchor, {
      onPick: (icon) => {
        this.setIcon(ctx, id, icon);
      },
      onClose: () => {
        if (this.menu !== menu) return;
        this.menu = undefined;
        this.anchorId = undefined;
      },
      returnFocus,
      customValue,
      // Le mousedown sur l'icône d'ancrage ne ferme pas le menu : le clic qui suit le ferme (bascule).
      ignoreOutside: (target) => target instanceof Element && target.closest(ICON_SELECTOR) !== null && list.rowIdAt(target) === id
    });
    this.menu = menu;
    this.anchorId = id;
  }

  /**
   * Retient, avant tout changement de focus, si le menu était ouvert pour
   * l'icône pressée : la sélection (Y5) donne le focus à la ligne pendant le
   * clic, ce qui ferme le menu avant que `onClick` ne s'exécute.
   */
  private onMouseDown(list: ILayerListService, event: MouseEvent): void {
    const target = event.target;
    const onIcon = target instanceof Element && target.closest(ICON_SELECTOR) !== null;
    const id = onIcon ? list.rowIdAt(target) : undefined;
    this.pressedOpenFor = id !== undefined && this.menu !== undefined && this.anchorId === id ? id : undefined;
  }

  private onClick(ctx: IEditorContext, list: ILayerListService, event: MouseEvent): void {
    const pressedOpenFor = this.pressedOpenFor;
    this.pressedOpenFor = undefined;
    const target = event.target;
    if (!(target instanceof Element) || target.closest(ICON_SELECTOR) === null) return;
    const id = list.rowIdAt(target);
    if (id === undefined) return;
    const wasOpen = pressedOpenFor === id || (this.menu !== undefined && this.anchorId === id);
    if (wasOpen) this.menu?.close();
    else this.openChooser(ctx, list, id);
  }

  private onKeyDown(ctx: IEditorContext, list: ILayerListService, event: KeyboardEvent): void {
    if (!isOpenChooserKey(event)) return;
    const id = list.rowIdAt(event.target);
    if (this.layerOf(ctx, id) === undefined || id === undefined) return;
    event.preventDefault();
    this.openChooser(ctx, list, id);
  }

  /** Ferme le menu si son calque n'existe plus ou n'est plus un calque. */
  private closeIfStale(ctx: IEditorContext): void {
    if (this.menu !== undefined && this.layerOf(ctx, this.anchorId) === undefined) this.menu.close();
  }
}
