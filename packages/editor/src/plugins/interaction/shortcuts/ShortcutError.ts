// packages/editor/src/plugins/interaction/shortcuts/ShortcutError.ts
/**
 * Erreur levée par le registre des raccourcis clavier (combinaison invalide,
 * définition incomplète, identifiant déjà pris, combinaison déjà attribuée à
 * un autre raccourci).
 */

/** Code machine de chaque cas d'erreur du registre des raccourcis. */
export type ShortcutErrorCode = 'invalid-keys' | 'invalid-definition' | 'duplicate-id' | 'conflict';

/** Erreur du registre des raccourcis, avec un code exploitable par programme. */
export class ShortcutError extends Error {
  /** Code du cas d'erreur. */
  readonly code: ShortcutErrorCode;

  /** Identifiant du raccourci en cours d'enregistrement, quand il est connu. */
  readonly shortcutId?: string;

  /** Pour `conflict` : identifiant du raccourci qui possède déjà la combinaison. */
  readonly conflictsWith?: string;

  constructor(code: ShortcutErrorCode, message: string, shortcutId?: string, conflictsWith?: string) {
    super(message);
    // Rétablit la chaîne de prototypes (cible ES2018 : `instanceof` sinon faux).
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'ShortcutError';
    this.code = code;
    if (shortcutId !== undefined) this.shortcutId = shortcutId;
    if (conflictsWith !== undefined) this.conflictsWith = conflictsWith;
  }
}
