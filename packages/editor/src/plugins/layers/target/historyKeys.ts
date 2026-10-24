// packages/editor/src/plugins/layers/target/historyKeys.ts
/**
 * Annuler / rétablir (Ctrl+Z, Ctrl+Y, Ctrl+Maj+Z) : les seules touches que le
 * bouton de cible et la fenêtre de choix laissent remonter aux raccourcis de
 * l'éditeur. Les combinaisons viennent de `history.undoRedo` et sont lues
 * avec les outils de `interaction.shortcuts`.
 */

import { UndoRedoKeys } from '../../history/undoRedo/UndoRedoPlugin';
import { chordToString, chordsFromEvent, parseChord } from '../../interaction/shortcuts/keyChord';

/** Chaînes canoniques des raccourcis annuler / rétablir. */
const HISTORY_CHORDS = new Set(
  [UndoRedoKeys.UNDO, ...UndoRedoKeys.REDO].map((keys) => chordToString(parseChord(keys)))
);

/** Vrai si `event` est un raccourci annuler / rétablir. */
export function isHistoryChord(event: KeyboardEvent): boolean {
  return chordsFromEvent(event).some((chord) => HISTORY_CHORDS.has(chordToString(chord)));
}
