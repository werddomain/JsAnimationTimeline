// packages/editor/src/core/store/StoreError.ts
/**
 * Erreur levée par le `Store` quand un document ne respecte pas les
 * invariants du modèle v2 (voir `validateDocument` du runtime), ou qu'il a
 * une piste inconnue du registre avec `strictProperties`. Le message liste
 * chaque problème avec son chemin.
 */

import type { StoreIssue } from './unknownTracks';

function describeIssues(issues: readonly StoreIssue[]): string {
  const lines = issues.map((issue) => `- ${issue.path} : ${issue.message} (${issue.code})`);
  return `Document invalide (${issues.length} problème(s)) :\n${lines.join('\n')}`;
}

/** Document refusé par le Store. */
export class StoreError extends Error {
  /**
   * Problèmes relevés par `validateDocument`, ou pistes inconnues du registre
   * avec `strictProperties` (copie figée).
   */
  readonly issues: readonly StoreIssue[];

  constructor(issues: readonly StoreIssue[]) {
    super(describeIssues(issues));
    this.name = 'StoreError';
    this.issues = Object.freeze([...issues]);
    // Garantit `instanceof` quel que soit le niveau de transpilation.
    Object.setPrototypeOf(this, StoreError.prototype);
  }
}
