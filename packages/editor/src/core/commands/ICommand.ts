// packages/editor/src/core/commands/ICommand.ts
/**
 * Contrat d'une commande : toute modification du document passe par une
 * commande `{ label, do, undo }` exécutée par la `CommandStack`.
 *
 * Une commande est une paire de transformations pures et immuables :
 * - `do(doc)` retourne le document modifié, `undo(doc)` le document restauré ;
 * - elles ne modifient jamais leur entrée : elles retournent un nouveau
 *   document, ou la même référence si rien ne change (la pile traite alors
 *   l'exécution comme un no-op) ;
 * - `undo(do(doc))` doit être égal en profondeur à `doc` ;
 * - pour refuser (calque verrouillé, cible absente...), `do` lève une
 *   `CommandRefusedError` : le refus se fait dans la commande, pas seulement
 *   dans l'interface, pour que l'API respecte aussi le verrou.
 *
 * `do` et `undo` sont des propriétés de type fonction (et non des méthodes)
 * pour bénéficier de la vérification stricte des paramètres
 * (`strictFunctionTypes`) ; une classe peut tout de même les implémenter par
 * des méthodes.
 */

import type { ITimelineDocument } from '@werddomain/timeline-runtime';

/** Commande annulable appliquée au document par la `CommandStack`. */
export interface ICommand {
  /** Libellé lisible (« Déplacer l'image clé »), affiché par l'historique. */
  readonly label: string;
  /** Applique la commande ; lève `CommandRefusedError` pour refuser. */
  readonly do: (doc: ITimelineDocument) => ITimelineDocument;
  /** Annule la commande sur le document produit par `do`. */
  readonly undo: (doc: ITimelineDocument) => ITimelineDocument;
}
