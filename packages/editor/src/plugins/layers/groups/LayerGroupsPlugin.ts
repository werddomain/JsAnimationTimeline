// packages/editor/src/plugins/layers/groups/LayerGroupsPlugin.ts
/**
 * Plugin : layers.groups
 * Epic : layers
 * Dépend de : layers.list, layers.selection, interaction.shortcuts
 * Écoute : —
 * Émet : —
 *
 * Dossiers de calques (Flash CS4 : « Nouveau dossier » et grouper la
 * sélection dans un dossier). Chaque opération est une commande annulable ;
 * après une création ou un regroupement, le nouveau dossier (déplié) devient
 * la sélection, par le service `layers.selection` (la sélection n'est jamais
 * dans une commande). Pas de bouton ici : la barre d'outils (Y8) appelle le
 * service `layers.groups` et écoute `selection:changed` pour `canGroup()`.
 *
 * Clavier, par `interaction.shortcuts`, seulement quand le focus est dans la
 * liste des calques : Ctrl+G groupe la sélection ; Ctrl+Maj+G dissocie le
 * premier dossier sélectionné. Sans effet possible, la touche reste au
 * navigateur.
 *
 * Service `layers.groups` : voir `ILayerGroupsService`.
 */

import { isFolder } from '@werddomain/timeline-runtime';
import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import type { ICommand } from '../../../core/commands/ICommand';
import type { ILayerListService } from '../list';
import { findFolder } from '../list/layerTree';
import type { ILayerSelectionService } from '../selection';
import { createFolderCommand, groupSelectionCommand, ungroupCommand } from './groupCommands';
import type { IFolderCommand } from './groupCommands';
import type { ILayerGroupsService } from './types';

/** Identifiant du plugin et de son service. */
export const LAYERS_GROUPS_PLUGIN_ID = 'layers.groups';

/** Raccourcis du plugin (`Mod` = Ctrl ou Cmd). */
export const LAYER_GROUPS_SHORTCUTS = Object.freeze({
  group: Object.freeze({ shortcutId: 'layers.groups.group', keys: 'Mod+G', label: 'Grouper la sélection' }),
  ungroup: Object.freeze({ shortcutId: 'layers.groups.ungroup', keys: 'Mod+Shift+G', label: 'Dissocier le dossier' })
});

/** Groupes de calques : dossiers, regroupement de la sélection et raccourcis. */
export class LayerGroupsPlugin implements EditorPlugin {
  readonly id = 'layers.groups';
  readonly dependencies: readonly string[] = ['layers.list', 'layers.selection', 'interaction.shortcuts'];

  private ctx: IEditorContext | undefined;
  private list: ILayerListService | undefined;
  private selection: ILayerSelectionService | undefined;
  private cleanups: Array<() => void> = [];

  readonly init = (ctx: IEditorContext): void => {
    this.ctx = ctx;
    this.list = ctx.services.require('layers.list');
    this.selection = ctx.services.require('layers.selection');
    const shortcuts = ctx.services.require('interaction.shortcuts');
    const { group, ungroup } = LAYER_GROUPS_SHORTCUTS;
    const base = (info: { shortcutId: string; keys: string; label: string }) => ({ id: info.shortcutId, keys: info.keys, label: info.label });
    this.cleanups = [
      ctx.services.provide(LAYERS_GROUPS_PLUGIN_ID, this.createService()),
      shortcuts.register({
        ...base(group),
        enabled: () => this.listHasFocus() && this.canGroup(),
        run: () => this.groupSelection() !== undefined
      }),
      shortcuts.register({
        ...base(ungroup),
        enabled: () => this.listHasFocus() && this.selectedFolderId() !== undefined,
        run: () => {
          const folderId = this.selectedFolderId();
          return folderId !== undefined && this.ungroup(folderId);
        }
      })
    ];
  };

  destroy(): void {
    const cleanups = this.cleanups;
    this.cleanups = [];
    cleanups.forEach((cleanup) => cleanup());
    this.list = undefined;
    this.selection = undefined;
    this.ctx = undefined;
  }

  private createService(): ILayerGroupsService {
    return {
      createFolder: () => this.createFolder(),
      groupSelection: () => this.groupSelection(),
      ungroup: (folderId) => this.ungroup(folderId),
      canGroup: () => this.canGroup()
    };
  }

  private createFolder(): string | undefined {
    const ctx = this.requireContext();
    const anchor = this.requireSelection().selected()[0];
    return this.runAndSelect(createFolderCommand(ctx.document, anchor));
  }

  private groupSelection(): string | undefined {
    const ctx = this.requireContext();
    const created = groupSelectionCommand(ctx.document, this.requireSelection().selected());
    return created === undefined ? undefined : this.runAndSelect(created);
  }

  /** Exécute la commande puis sélectionne le dossier créé ; `undefined` si elle a été refusée. */
  private runAndSelect(created: IFolderCommand): string | undefined {
    if (!this.requireContext().commands.execute(created.command)) return undefined;
    this.requireSelection().select([created.folderId]);
    return created.folderId;
  }

  private ungroup(folderId: string): boolean {
    const ctx = this.requireContext();
    const folder = findFolder(ctx.document, folderId);
    if (folder === undefined) return false;
    const command: ICommand = ungroupCommand(ctx.document, folderId);
    if (!ctx.commands.execute(command)) return false;
    this.requireSelection().select(folder.children.map((child) => child.id));
    return true;
  }

  private canGroup(): boolean {
    return this.requireSelection().selected().length > 0;
  }

  /** Premier dossier sélectionné (dans l'ordre d'affichage), ou `undefined`. */
  private selectedFolderId(): string | undefined {
    const rows = this.requireList().rows();
    const selected = new Set(this.requireSelection().selected());
    return rows.find((row) => selected.has(row.id) && isFolder(row.node))?.id;
  }

  /** Vrai si le focus DOM est dans la liste des calques. */
  private listHasFocus(): boolean {
    const element = this.requireList().element();
    return element !== undefined && element.contains(element.ownerDocument.activeElement);
  }

  private requireList(): ILayerListService {
    if (this.list === undefined) throw new Error('layers.groups : plugin non initialisé ou détruit.');
    return this.list;
  }

  private requireSelection(): ILayerSelectionService {
    if (this.selection === undefined) throw new Error('layers.groups : plugin non initialisé ou détruit.');
    return this.selection;
  }

  private requireContext(): IEditorContext {
    if (this.ctx === undefined) throw new Error('layers.groups : plugin non initialisé ou détruit.');
    return this.ctx;
  }
}
