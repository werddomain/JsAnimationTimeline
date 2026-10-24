// packages/editor/src/plugins/history/HistoryPlugin.ts
/**
 * Plugin : history
 * Epic : history
 * Dépend de : —
 * Écoute : —
 * Émet : —
 *
 * Epic de l'historique (annuler / rétablir). Il ne fait rien lui-même : il
 * regroupe ses plugins de fonctionnalité, enregistrés avec lui par l'hôte
 * (et toujours initialisés après lui) :
 * - `history.undoRedo` : boutons de la barre d'outils et raccourcis Ctrl+Z,
 *   Ctrl+Y et Ctrl+Maj+Z.
 */

import type { EditorPlugin } from '../../core/context/IEditorContext';
import { UndoRedoPlugin } from './undoRedo/UndoRedoPlugin';

/** Epic `history` : annuler / rétablir. */
export class HistoryPlugin implements EditorPlugin {
  readonly id = 'history';
  readonly dependencies: readonly string[] = [];
  readonly children: readonly EditorPlugin[] = [new UndoRedoPlugin()];

  readonly init = (): void => {};

  destroy(): void {}
}
