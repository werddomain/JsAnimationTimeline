// packages/editor/src/plugins/toolbar/main/ToolbarError.ts
/**
 * Erreur levée par la barre d'outils principale (définition d'élément
 * incomplète, identifiant déjà pris, nom de scène vide).
 */

/** Code machine de chaque cas d'erreur de la barre d'outils. */
export type ToolbarErrorCode = 'invalid-definition' | 'duplicate-id';

/** Erreur de la barre d'outils, avec un code exploitable par programme. */
export class ToolbarError extends Error {
  /** Code du cas d'erreur. */
  readonly code: ToolbarErrorCode;

  /** Identifiant de l'élément en cours d'ajout, quand il est connu. */
  readonly itemId?: string;

  constructor(code: ToolbarErrorCode, message: string, itemId?: string) {
    super(message);
    // Rétablit la chaîne de prototypes (cible ES2018 : `instanceof` sinon faux).
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'ToolbarError';
    this.code = code;
    if (itemId !== undefined) this.itemId = itemId;
  }
}
