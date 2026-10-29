// packages/editor/src/plugins/persistence/json/importCommand.ts
/**
 * Commande annulable qui remplace le document entier par un document
 * importé. `undo` rend le document remplacé : un import se défait avec
 * Ctrl+Z comme toute autre modification (règle 8 du plan).
 */

import type { ITimelineDocument } from '@kazo-ca/timeline-runtime';
import type { ICommand } from '../../../core/commands/ICommand';

/** Libellé par défaut de la commande d'import (historique). */
export const IMPORT_COMMAND_LABEL = 'Importer le document';

/**
 * Crée la commande qui remplace le document par `imported` (déjà validé).
 * Le document remplacé est retenu par `do` et rendu par `undo` : la
 * `CommandStack` appelle toujours `do` avant `undo`, et chaque `do` (rétablir
 * compris) le retient de nouveau.
 */
export function createImportCommand(imported: ITimelineDocument, label: string = IMPORT_COMMAND_LABEL): ICommand {
  let replaced: ITimelineDocument | undefined;
  return Object.freeze({
    label,
    do: (doc: ITimelineDocument): ITimelineDocument => {
      replaced = doc;
      return imported;
    },
    undo: (doc: ITimelineDocument): ITimelineDocument => replaced ?? doc
  });
}
