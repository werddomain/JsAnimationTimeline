// packages/editor/src/core/commands/CommandRefusedError.ts
/**
 * Erreur levée par `ICommand.do` (ou `undo`) pour refuser son exécution, par
 * exemple sur un calque verrouillé. La `CommandStack` l'intercepte : le
 * document et l'historique restent inchangés et l'événement
 * `command:refused` est émis avec `reason`.
 */

/** Refus volontaire d'une commande (ce n'est pas un bogue). */
export class CommandRefusedError extends Error {
  /** Raison du refus, transmise dans `command:refused` (ex. « calque verrouillé »). */
  readonly reason: string;
  /** Libellé de la commande refusée. */
  readonly commandLabel: string;

  constructor(commandLabel: string, reason: string) {
    super(`La commande « ${commandLabel} » a été refusée : ${reason}`);
    this.name = 'CommandRefusedError';
    this.reason = reason;
    this.commandLabel = commandLabel;
    // Garantit `instanceof` quel que soit le niveau de transpilation.
    Object.setPrototypeOf(this, CommandRefusedError.prototype);
  }
}
