// packages/editor/src/plugins/layers/icon/LayerIconPlugin.ts
/**
 * Plugin : layers.icon
 * Epic : layers
 * Dépend de : layers.list
 * Écoute : —
 * Émet : —
 *
 * Choix de l'icône d'un calque. Un clic sur l'icône d'une ligne de calque
 * (pas d'un dossier, qui n'a pas de champ `icon`) ouvre un menu : icônes
 * intégrées, « Icône par défaut » et « Personnalisée… » (URL ou classes CSS,
 * validées par `classifyLayerIcon`). Le choix est une commande annulable
 * « Changer l'icône du calque ». L'icône ne dépend jamais de la cible animée.
 *
 * Le clic est écouté sur le conteneur de l'éditeur (le service `layers.list`
 * ne publie son élément qu'au rendu) ; `rowIdAt` garde les clics de la liste.
 *
 * Service `layers.icon` : `setIcon(id, icon | undefined)` et `openChooser(id)`.
 */

import { findNodeById, isFolder } from '@werddomain/timeline-runtime';
import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import { LAYER_ROW_CLASSES } from '../list/LayerRowView';
import { createSetIconCommand, validateLayerIcon } from './iconCommand';
import { iconChoices } from './iconChoices';
import { IconMenu } from './IconMenu';
import type { ILayerIconService } from './types';
import './LayerIcon.less';

/** Identifiant du plugin et de son service. */
export const LAYERS_ICON_PLUGIN_ID = 'layers.icon';

/** Choix de l'icône des calques : menu et service. */
export class LayerIconPlugin implements EditorPlugin {
  readonly id = 'layers.icon';
  readonly dependencies: readonly string[] = ['layers.list'];

  private cleanups: Array<() => void> = [];
  private menu: IconMenu | undefined;

  readonly init = (ctx: IEditorContext): void => {
    const list = ctx.services.require('layers.list');
    const setIcon = (id: string, icon: string | undefined): boolean => {
      const node = findNodeById(ctx.document.layers, id);
      if (node === undefined || isFolder(node)) return false;
      if (icon !== undefined && !validateLayerIcon(icon).ok) return false;
      return ctx.commands.execute(createSetIconCommand(ctx.document, id, icon));
    };
    const openChooser = (id: string): void => {
      this.menu?.close();
      const node = findNodeById(ctx.document.layers, id);
      if (node === undefined || isFolder(node)) return;
      const anchor = list.rowElement(id)?.querySelector(`.${LAYER_ROW_CLASSES.icon}`)?.getBoundingClientRect();
      const menu = new IconMenu(ctx.container, iconChoices(node.icon), anchor, {
        onPick: (icon) => {
          setIcon(id, icon);
        },
        onClose: () => {
          if (this.menu === menu) this.menu = undefined;
        }
      });
      this.menu = menu;
    };
    const onClick = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Element) || target.closest(`.${LAYER_ROW_CLASSES.icon}`) === null) return;
      const id = list.rowIdAt(target);
      if (id !== undefined) openChooser(id);
    };
    ctx.container.addEventListener('click', onClick);
    const service: ILayerIconService = { setIcon, openChooser };
    this.cleanups = [
      ctx.services.provide(LAYERS_ICON_PLUGIN_ID, service),
      () => ctx.container.removeEventListener('click', onClick)
    ];
  };

  destroy(): void {
    this.menu?.close();
    const cleanups = this.cleanups.reverse();
    this.cleanups = [];
    cleanups.forEach((cleanup) => cleanup());
  }
}
