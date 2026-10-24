// packages/editor/src/plugins/tweens/motion/MotionTweenError.ts
/**
 * Erreur levée par les opérations sur les interpolations de mouvement quand
 * la demande est impossible (aucune image clé, plage vide, images clés
 * voisines...). Les commandes la traduisent en `CommandRefusedError` : la
 * pile émet alors `command:refused` avec le message français, affichable tel
 * quel. Les refus du cœur CS4 (`SpanOperationError` : calque verrouillé,
 * image hors limites...) suivent le même chemin.
 */

import { SpanOperationError } from '../../../model/spans/SpanOperationError';

/** Raisons possibles d'un refus propre aux interpolations. */
export const MotionTweenCodes = {
  /** Aucune image clé (ni plage) dans la sélection. */
  NO_KEYFRAME: 'no-keyframe',
  /** La sélection touche plusieurs plages sans image clé pour les départager. */
  AMBIGUOUS_SELECTION: 'ambiguous-selection',
  /** La sélection couvre plusieurs calques. */
  MULTIPLE_LAYERS: 'multiple-layers',
  /** La plage est déjà une interpolation. */
  ALREADY_TWEEN: 'already-tween',
  /** Une plage vide ne peut pas être interpolée. */
  BLANK_SPAN: 'blank-span',
  /** Les deux images clés se suivent : il n'y a rien à interpoler. */
  ADJACENT_KEYFRAMES: 'adjacent-keyframes',
  /** L'image donnée n'est pas le début d'une plage. */
  NOT_A_KEYFRAME: 'not-a-keyframe',
  /** La seconde image clé ne vient pas après la première. */
  INVALID_RANGE: 'invalid-range',
  /** Aucune interpolation à supprimer. */
  NO_TWEEN: 'no-tween'
} as const;

/** Code d'un refus. */
export type MotionTweenCode = (typeof MotionTweenCodes)[keyof typeof MotionTweenCodes];

/** Nom d'un refus : clé commune de `MotionTweenCodes` et `MotionTweenMessages`. */
export type MotionTweenRefusal = keyof typeof MotionTweenCodes;

/** Messages français des refus (affichés tels quels). */
export const MotionTweenMessages: Readonly<Record<MotionTweenRefusal, string>> = Object.freeze({
  NO_KEYFRAME: 'Aucune image clé à interpoler.',
  AMBIGUOUS_SELECTION: 'Sélection ambiguë.',
  MULTIPLE_LAYERS: "Sélectionnez des images d'un seul calque.",
  ALREADY_TWEEN: 'Déjà une interpolation.',
  BLANK_SPAN: 'Une plage vide ne peut pas être interpolée.',
  ADJACENT_KEYFRAMES: 'Une interpolation doit couvrir au moins deux images.',
  NOT_A_KEYFRAME: "Cette image n'est pas une image clé.",
  INVALID_RANGE: 'La seconde image clé doit suivre la première.',
  NO_TWEEN: 'Aucune interpolation à supprimer.'
});

/** Demande impossible sur une interpolation ; le message est en français. */
export class MotionTweenError extends Error {
  readonly code: MotionTweenCode;

  constructor(code: MotionTweenCode, message: string) {
    super(message);
    this.name = 'MotionTweenError';
    this.code = code;
    // Garantit `instanceof` quel que soit le niveau de transpilation.
    Object.setPrototypeOf(this, MotionTweenError.prototype);
  }
}

/** Refus `name` avec son message français. */
export function motionTweenRefusal(name: MotionTweenRefusal): MotionTweenError {
  return new MotionTweenError(MotionTweenCodes[name], MotionTweenMessages[name]);
}

/**
 * Message d'un refus (`MotionTweenError` ou `SpanOperationError`), ou
 * `undefined` pour toute autre erreur (un vrai bogue, à propager).
 */
export function refusalReason(error: unknown): string | undefined {
  if (error instanceof MotionTweenError || error instanceof SpanOperationError) return error.message;
  return undefined;
}
