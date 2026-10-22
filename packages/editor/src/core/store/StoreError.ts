// packages/editor/src/core/store/StoreError.ts
/**
 * Erreur levée par le `Store` quand un document ne respecte pas les
 * invariants du modèle v2 (voir `validateDocument` du runtime). Le message
 * liste chaque problème avec son chemin.
 */

import type { IValidationIssue } from '@werddomain/timeline-runtime';

function describeIssues(issues: readonly IValidationIssue[]): string {
  const lines = issues.map((issue) => `- ${issue.path} : ${issue.message} (${issue.code})`);
  return `Document invalide (${issues.length} problème(s)) :\n${lines.join('\n')}`;
}

/** Document refusé par le Store. */
export class StoreError extends Error {
  /** Problèmes relevés par `validateDocument` (copie figée). */
  readonly issues: readonly IValidationIssue[];

  constructor(issues: readonly IValidationIssue[]) {
    super(describeIssues(issues));
    this.name = 'StoreError';
    this.issues = Object.freeze([...issues]);
    // Garantit `instanceof` quel que soit le niveau de transpilation.
    Object.setPrototypeOf(this, StoreError.prototype);
  }
}
