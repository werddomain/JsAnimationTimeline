// packages/editor/src/plugins/history/undoRedo/UndoRedoPlugin.ts
/**
 * Plugin : history.undoRedo
 * Epic : history
 * Dépend de : history, toolbar.main, interaction.shortcuts
 * Écoute : history:changed (par toolbar.main, qui relit l'état des boutons)
 * Émet : —
 *
 * Annuler et rétablir, branchés sur l'historique des commandes :
 * - deux boutons dans le groupe `history` de la barre d'outils (Annuler,
 *   Rétablir), actifs seulement quand l'historique le permet ;
 * - les raccourcis Ctrl+Z (annuler), Ctrl+Y et Ctrl+Maj+Z (rétablir), Cmd
 *   sur Mac, déclarés auprès de `interaction.shortcuts`.
 *
 * Pendant un regroupement (glisser en cours), annuler et rétablir sont
 * inactifs : la `CommandStack` les refuse tant que le glisser n'est pas fini.
 * Dans un champ de saisie, Ctrl+Z garde son sens habituel (raccourcis sans
 * `allowInEditable`).
 *
 * Quand un clic ou un raccourci désactive le bouton qui a le focus (dernier
 * Annuler, dernier Rétablir), le focus passe à l'autre bouton : il reste
 * dans l'éditeur, et Ctrl+Y ou Ctrl+Z marchent tout de suite après.
 */

import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import { ToolbarGroupOrders } from '../../toolbar/main/ToolbarItems';

/** Identifiant du plugin (préfixe de ses boutons et raccourcis). */
export const UNDO_REDO_PLUGIN_ID = 'history.undoRedo';

/** Identifiants des boutons et des raccourcis. */
export const UndoRedoIds = {
  UNDO: 'history.undoRedo.undo',
  REDO: 'history.undoRedo.redo'
} as const;

/** Combinaisons des raccourcis (Mod = Ctrl, ou Cmd sur Mac). */
export const UndoRedoKeys = {
  UNDO: 'Mod+Z',
  REDO: ['Mod+Y', 'Mod+Shift+Z']
} as const;

/** Plugin `history.undoRedo` : boutons et raccourcis annuler / rétablir. */
export class UndoRedoPlugin implements EditorPlugin {
  readonly id = 'history.undoRedo';
  readonly dependencies: readonly string[] = ['history', 'toolbar.main', 'interaction.shortcuts'];

  private cleanups: Array<() => void> = [];

  readonly init = (ctx: IEditorContext): void => {
    const toolbar = ctx.services.require('toolbar.main');
    const shortcuts = ctx.services.require('interaction.shortcuts');
    const { commands } = ctx;
    const canUndo = (): boolean => commands.canUndo && !commands.isGrouping;
    const canRedo = (): boolean => commands.canRedo && !commands.isGrouping;
    const undo = (): boolean => canUndo() && commands.undo();
    const redo = (): boolean => canRedo() && commands.redo();
    const button = (id: string): HTMLButtonElement | null =>
      ctx.container.querySelector<HTMLButtonElement>(`[data-toolbar-item="${id}"]`);
    /**
     * Lance `action` depuis le bouton `from` ; si `from` avait le focus et
     * que l'action l'a désactivé, donne le focus à `to` (s'il est actif).
     */
    const run = (action: () => boolean, from: string, to: string): boolean => {
      const source = button(from);
      const hadFocus = source !== null && source.ownerDocument.activeElement === source;
      const done = action();
      const target = button(to);
      if (hadFocus && source !== null && source.disabled && target !== null && !target.disabled) target.focus();
      return done;
    };
    const runUndo = (): boolean => run(undo, UndoRedoIds.UNDO, UndoRedoIds.REDO);
    const runRedo = (): boolean => run(redo, UndoRedoIds.REDO, UndoRedoIds.UNDO);
    const cleanups: Array<() => void> = [];
    try {
      // Chaque retrait est gardé dès son ajout : un échec plus loin défait les précédents.
      cleanups.push(
        shortcuts.register({ id: UndoRedoIds.UNDO, keys: UndoRedoKeys.UNDO, label: 'Annuler', run: runUndo, enabled: canUndo })
      );
      cleanups.push(
        shortcuts.register({ id: UndoRedoIds.REDO, keys: UndoRedoKeys.REDO, label: 'Rétablir', run: runRedo, enabled: canRedo })
      );
      cleanups.push(
        toolbar.addButton({
          id: UndoRedoIds.UNDO,
          label: 'Annuler',
          icon: '↶',
          group: 'history',
          order: ToolbarGroupOrders.history + 1,
          shortcut: UndoRedoKeys.UNDO,
          onClick: () => void runUndo(),
          enabled: canUndo
        })
      );
      cleanups.push(
        toolbar.addButton({
          id: UndoRedoIds.REDO,
          label: 'Rétablir',
          icon: '↷',
          group: 'history',
          order: ToolbarGroupOrders.history + 2,
          shortcut: UndoRedoKeys.REDO[0],
          onClick: () => void runRedo(),
          enabled: canRedo
        })
      );
    } catch (error) {
      cleanups.forEach((cleanup) => cleanup());
      throw error;
    }
    this.cleanups = cleanups;
  };

  destroy(): void {
    const cleanups = this.cleanups;
    this.cleanups = [];
    cleanups.forEach((cleanup) => cleanup());
  }
}

/** Crée le plugin `history.undoRedo`. */
export function createUndoRedoPlugin(): UndoRedoPlugin {
  return new UndoRedoPlugin();
}
