// packages/editor/src/model/spans/SpanOperationError.ts
/**
 * Erreur levée par une opération de plage quand la demande est impossible
 * (calque introuvable ou verrouillé, image hors limites...). Les commandes
 * de `spanCommands.ts` la traduisent en `CommandRefusedError` : la pile
 * émet alors `command:refused` avec le message, affichable tel quel.
 */

/** Raisons possibles d'un refus. */
export const SpanOperationCodes = {
  /** Aucun calque de cet id (ou l'id désigne un dossier). */
  LAYER_NOT_FOUND: 'layer-not-found',
  /** Le calque, ou un de ses dossiers parents, est verrouillé. */
  LAYER_LOCKED: 'layer-locked',
  /** L'image n'est pas un entier compris entre 1 et `totalFrames`. */
  INVALID_FRAME: 'invalid-frame',
  /** La destination d'un déplacement sort des limites permises. */
  OUT_OF_RANGE: 'out-of-range',
  /** L'évaluation des valeurs a échoué (propriété inconnue du registre...). */
  EVALUATION_FAILED: 'evaluation-failed'
} as const;

/** Code d'un refus. */
export type SpanOperationCode = (typeof SpanOperationCodes)[keyof typeof SpanOperationCodes];

/** Demande impossible sur les plages d'un calque ; le message est en français. */
export class SpanOperationError extends Error {
  readonly code: SpanOperationCode;

  constructor(code: SpanOperationCode, message: string) {
    super(message);
    this.name = 'SpanOperationError';
    this.code = code;
    // Garantit `instanceof` quel que soit le niveau de transpilation.
    Object.setPrototypeOf(this, SpanOperationError.prototype);
  }
}
