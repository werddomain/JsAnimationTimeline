// packages/editor/src/plugins/frames/keyframes/batchCommand.ts
/**
 * Regroupe des commandes en une seule : une entrée d'historique, tout ou
 * rien (si une commande refuse, la commande composée lève et rien n'est
 * appliqué).
 */

import { CompositeCommand } from '../../../core/commands/CompositeCommand';
import type { ICommand } from '../../../core/commands/ICommand';

/**
 * `undefined` sans commande, la commande elle-même s'il n'y en a qu'une,
 * sinon une commande composée libellée `label`.
 */
export function batchCommand(label: string, commands: readonly ICommand[]): ICommand | undefined {
  if (commands.length === 0) return undefined;
  if (commands.length === 1) return commands[0];
  return new CompositeCommand(label, commands);
}
