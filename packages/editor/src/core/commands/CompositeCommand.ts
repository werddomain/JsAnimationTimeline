// packages/editor/src/core/commands/CompositeCommand.ts
/**
 * Commande composée : applique une suite de commandes comme une seule entrée
 * d'historique (regroupement pendant un glisser, actions multiples).
 * `do` applique les commandes dans l'ordre, `undo` annule dans l'ordre inverse.
 * Si une sous-commande refuse ou lève, la commande composée lève à son tour :
 * comme le document est immuable, rien n'est appliqué à moitié.
 */

import type { ITimelineDocument } from '@kazo-ca/timeline-runtime';
import type { ICommand } from './ICommand';

/** Suite de commandes exécutée et annulée d'un bloc. */
export class CompositeCommand implements ICommand {
  /** Sous-commandes, dans l'ordre d'exécution (copie figée). */
  readonly commands: readonly ICommand[];

  constructor(
    readonly label: string,
    commands: readonly ICommand[]
  ) {
    this.commands = Object.freeze([...commands]);
  }

  readonly do = (doc: ITimelineDocument): ITimelineDocument =>
    this.commands.reduce((current, command) => command.do(current), doc);

  readonly undo = (doc: ITimelineDocument): ITimelineDocument =>
    this.commands.reduceRight((current, command) => command.undo(current), doc);
}
