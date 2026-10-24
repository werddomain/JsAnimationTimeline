// packages/editor/src/plugins/layers/toolbar/LayerToolbarPlugin.ts
/**
 * Plugin : layers.toolbar
 * Epic : layers
 * Dépend de : layers.list, layers.selection, layers.groups, interaction.shortcuts
 * Écoute : layers:selectionChanged, document:changed, document:loaded
 * Émet : —
 *
 * Barre d'outils sous la liste des calques (zone `layersFooter`, Flash CS4) :
 * Nouveau calque, Nouveau dossier, Grouper la sélection, Supprimer la
 * sélection. Les boutons sont désactivés quand ils ne peuvent rien faire
 * (grouper et supprimer sans sélection) et se mettent à jour à chaque
 * changement de sélection ou de document. Flèches, Début et Fin déplacent le
 * focus entre les boutons (tabindex itinérant).
 *
 * Les dossiers et le regroupement passent par le service `layers.groups`. Les
 * commandes « Nouveau calque » et « Supprimer les calques » sont annulables ;
 * la sélection (état d'interface) est posée après coup par `layers.selection` :
 * le nouveau calque, ou la ligne qui a pris la place de la première supprimée.
 * Un nouveau calque n'a aucune cible : il n'assume jamais de scène HTML.
 *
 * Verrous : supprimer un calque verrouillé est permis (comme dans Flash, le
 * verrou protège les images clés, pas l'existence du calque). Comme pour
 * `layers.groups`, après un « annuler » la sélection n'est pas restaurée.
 *
 * Clavier, par `interaction.shortcuts`, seulement quand le focus est dans la
 * liste des calques (jamais dans un champ de saisie comme le renommage) :
 * Suppr ou Retour arrière supprime la sélection ; Ctrl+Alt+L (le raccourci de
 * Flash ; Ctrl+Maj+N est pris par le navigateur) crée un calque. Attention :
 * sur certaines dispositions Windows, Ctrl+Alt+L est aussi AltGr+L (un
 * caractère saisi) ; il n'agit que si le focus est dans la liste, jamais dans
 * un champ.
 *
 * Service `layers.toolbar` : voir `ILayerToolbarService`.
 */

import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import { LAYOUT_SLOTS } from '../../layout/shell/layoutSlots';
import type { ILayerListService } from '../list';
import type { ILayerSelectionService } from '../selection';
import { deleteLayersCommand, newLayerCommand } from './toolbarCommands';
import { rowAfterDelete, visibleAnchor } from './toolbarTree';
import { ToolbarView } from './ToolbarView';
import type { ToolbarAction } from './ToolbarView';
import type { ILayerToolbarService } from './types';
import './LayerToolbar.less';

/** Identifiant du plugin et de son service. */
export const LAYERS_TOOLBAR_PLUGIN_ID = 'layers.toolbar';

/** Raccourcis du plugin (`Mod` = Ctrl ou Cmd). */
export const LAYER_TOOLBAR_SHORTCUTS = Object.freeze({
  newLayer: Object.freeze({ shortcutId: 'layers.toolbar.newLayer', keys: 'Mod+Alt+L', label: 'Nouveau calque' }),
  delete: Object.freeze({
    shortcutId: 'layers.toolbar.delete',
    keys: ['Delete', 'Backspace'],
    label: 'Supprimer la sélection'
  })
});

/** Barre d'outils des calques : nouveau calque, dossier, grouper, supprimer. */
export class LayerToolbarPlugin implements EditorPlugin {
  readonly id = 'layers.toolbar';
  readonly dependencies: readonly string[] = [
    'layers.list',
    'layers.selection',
    'layers.groups',
    'interaction.shortcuts'
  ];
  readonly slot = LAYOUT_SLOTS.layersFooter;

  private ctx: IEditorContext | undefined;
  private list: ILayerListService | undefined;
  private selection: ILayerSelectionService | undefined;
  private view: ToolbarView | undefined;
  private cleanups: Array<() => void> = [];

  readonly init = (ctx: IEditorContext): void => {
    this.ctx = ctx;
    this.list = ctx.services.require('layers.list');
    this.selection = ctx.services.require('layers.selection');
    const shortcuts = ctx.services.require('interaction.shortcuts');
    const { newLayer, delete: remove } = LAYER_TOOLBAR_SHORTCUTS;
    const service: ILayerToolbarService = {
      newLayer: () => this.newLayer(),
      deleteSelection: () => this.deleteSelection()
    };
    const refresh = (): void => this.refresh();
    // Chaque nettoyage est retenu dès sa création : un `register` qui lève ne laisse rien derrière lui.
    this.cleanups = [];
    this.cleanups.push(ctx.services.provide(LAYERS_TOOLBAR_PLUGIN_ID, service));
    this.cleanups.push(ctx.events.on('layers:selectionChanged', refresh));
    this.cleanups.push(ctx.events.on('document:changed', refresh));
    this.cleanups.push(ctx.events.on('document:loaded', refresh));
    this.cleanups.push(
      shortcuts.register({
        id: newLayer.shortcutId,
        keys: newLayer.keys,
        label: newLayer.label,
        enabled: () => this.listHasFocus(),
        run: () => this.newLayer() !== undefined
      })
    );
    this.cleanups.push(
      shortcuts.register({
        id: remove.shortcutId,
        keys: remove.keys,
        label: remove.label,
        enabled: () => this.listHasFocus() && this.requireSelection().selected().length > 0,
        run: () => this.deleteSelection()
      })
    );
  };

  render(slot: HTMLElement): void {
    this.view = new ToolbarView(slot, (action) => this.perform(action));
    this.refresh();
  }

  destroy(): void {
    const cleanups = this.cleanups;
    this.cleanups = [];
    cleanups.forEach((cleanup) => cleanup());
    this.view?.dispose();
    this.view = undefined;
    this.list = undefined;
    this.selection = undefined;
    this.ctx = undefined;
  }

  private perform(action: ToolbarAction): void {
    const groups = this.requireContext().services.require('layers.groups');
    if (action === 'newLayer') this.newLayer();
    else if (action === 'newFolder') groups.createFolder();
    else if (action === 'group') groups.groupSelection();
    else this.deleteSelection();
  }

  private newLayer(): string | undefined {
    const ctx = this.requireContext();
    const anchor = visibleAnchor(ctx.document.layers, this.requireSelection().selected()[0]);
    const created = newLayerCommand(ctx.document, anchor);
    if (!ctx.commands.execute(created.command)) return undefined;
    this.requireSelection().select([created.layerId]);
    return created.layerId;
  }

  private deleteSelection(): boolean {
    const ctx = this.requireContext();
    const command = deleteLayersCommand(ctx.document, this.requireSelection().selected());
    if (command === undefined) return false;
    const before = this.rowIds();
    if (!ctx.commands.execute(command)) return false;
    const after = this.rowIds();
    // Aucune ligne visible retirée : la sélection reste telle quelle.
    if (before.length === after.length) return true;
    const next = rowAfterDelete(before, after);
    this.requireSelection().select(next === undefined ? [] : [next]);
    return true;
  }

  private rowIds(): string[] {
    return this.requireList().rows().map((row) => row.id);
  }

  /** Met l'état des boutons à jour (sans effet avant le rendu). */
  private refresh(): void {
    if (this.view === undefined || this.ctx === undefined) return;
    const groups = this.ctx.services.require('layers.groups');
    this.view.setEnabled({
      newLayer: true,
      newFolder: true,
      group: groups.canGroup(),
      delete: this.requireSelection().selected().length > 0
    });
  }

  /** Vrai si le focus DOM est dans la liste des calques. */
  private listHasFocus(): boolean {
    const element = this.requireList().element();
    return element !== undefined && element.contains(element.ownerDocument.activeElement);
  }

  private requireList(): ILayerListService {
    if (this.list === undefined) throw new Error('layers.toolbar : plugin non initialisé ou détruit.');
    return this.list;
  }

  private requireSelection(): ILayerSelectionService {
    if (this.selection === undefined) throw new Error('layers.toolbar : plugin non initialisé ou détruit.');
    return this.selection;
  }

  private requireContext(): IEditorContext {
    if (this.ctx === undefined) throw new Error('layers.toolbar : plugin non initialisé ou détruit.');
    return this.ctx;
  }
}
