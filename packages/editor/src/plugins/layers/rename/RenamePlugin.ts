// packages/editor/src/plugins/layers/rename/RenamePlugin.ts
/**
 * Plugin : layers.rename
 * Epic : layers
 * Dépend de : layers.list
 * Écoute : layers:rowsChanged
 * Émet : —
 *
 * Renommage sur place des calques et des dossiers. Un double-clic sur le nom
 * d'une ligne le remplace par un champ de saisie (l'élément du nom porte
 * `data-editing` pendant la saisie) : Entrée ou la perte du focus valide,
 * Échap annule. Le nom est rogné ; un nom vide ou blanc est refusé et
 * l'ancien nom est gardé. La validation est une commande annulable
 * (« Renommer le calque »). Un calque verrouillé peut être renommé, comme
 * dans Flash : le verrou protège les images clés, pas le nom.
 *
 * Aucun bouton de ligne : le double-clic et `startEditing` (que la sélection
 * de Y5 appellera pour F2) suffisent ; un bouton n'ajouterait qu'une colonne
 * de plus à chaque ligne.
 *
 * Service `layers.rename` : `rename(id, name)` et `startEditing(id)`.
 */

import { findNodeById } from '@werddomain/timeline-runtime';
import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import { startInlineEdit } from './inlineEdit';
import type { IInlineEdit } from './inlineEdit';
import { createRenameCommand, normalizeLayerName } from './renameCommands';
import './Rename.less';

/** Identifiant du plugin et de son service. */
export const LAYERS_RENAME_PLUGIN_ID = 'layers.rename';

/** API publiée sous le service `layers.rename`. */
export interface ILayerRenameService {
  /**
   * Renomme le nœud `id` (commande annulable). `false` si `id` est inconnu,
   * si le nom est blanc ou s'il ne change pas.
   */
  rename(id: string, name: string): boolean;
  /** Démarre la saisie sur place du nom de `id` (sans effet si la ligne n'est pas affichée). */
  startEditing(id: string): void;
}

declare module '../../../core/context/IEditorContext' {
  interface EditorServiceMap {
    'layers.rename': ILayerRenameService;
  }
}

interface IEditSession {
  readonly id: string;
  readonly edit: IInlineEdit;
}

/** Renommage sur place des lignes de la liste des calques. */
export class RenamePlugin implements EditorPlugin {
  readonly id = 'layers.rename';
  readonly dependencies: readonly string[] = ['layers.list'];

  private cleanups: Array<() => void> = [];
  private session: IEditSession | undefined;

  readonly init = (ctx: IEditorContext): void => {
    const list = ctx.services.require('layers.list');
    const service: ILayerRenameService = {
      rename: (id, name) =>
        findNodeById(ctx.document.layers, id) !== undefined &&
        normalizeLayerName(name) !== undefined &&
        ctx.commands.execute(createRenameCommand(ctx.document, id, name)),
      startEditing: (id) => this.startEditing(ctx, id, service)
    };
    // L'écoute est sur la racine de l'éditeur, qui existe avant le rendu de la liste.
    const onDoubleClick = (event: MouseEvent): void => {
      const id = list.rowIdAt(event.target);
      if (id === undefined || !(event.target instanceof Node)) return;
      if (list.nameElement(id)?.contains(event.target)) service.startEditing(id);
    };
    ctx.container.addEventListener('dblclick', onDoubleClick);
    this.cleanups = [
      ctx.services.provide(LAYERS_RENAME_PLUGIN_ID, service),
      () => ctx.container.removeEventListener('dblclick', onDoubleClick),
      // Une ligne retirée pendant la saisie (annulation, rechargement) emporte l'input : on abandonne.
      ctx.events.on('layers:rowsChanged', () => {
        if (this.session !== undefined && !this.session.edit.input.isConnected) this.session.edit.cancel();
      })
    ];
  };

  destroy(): void {
    const cleanups = this.cleanups;
    this.cleanups = [];
    this.session?.edit.cancel();
    this.session = undefined;
    cleanups.forEach((cleanup) => cleanup());
  }

  private startEditing(ctx: IEditorContext, id: string, service: ILayerRenameService): void {
    const list = ctx.services.require('layers.list');
    const row = list.row(id);
    const nameElement = list.nameElement(id);
    if (row === undefined || nameElement === undefined) return;
    if (this.session?.id === id) {
      this.session.edit.input.focus();
      return;
    }
    // Une saisie encore ouverte sur une autre ligne est validée d'abord.
    this.session?.edit.commit();
    const edit = startInlineEdit(nameElement, {
      // Nom relu au moment voulu : il a pu changer (annulation, autre plugin) pendant la saisie.
      currentName: () => list.row(id)?.node.name ?? row.node.name,
      onCommit: (value) => void service.rename(id, value),
      onDone: (refocus) => {
        if (this.session?.edit === edit) this.session = undefined;
        // Entrée et Échap rendent le focus à la ligne (clavier) ; une perte de focus le laisse où il est allé.
        if (refocus) list.rowElement(id)?.focus();
      }
    });
    this.session = { id, edit };
  }
}
