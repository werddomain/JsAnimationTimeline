// packages/editor/src/plugins/persistence/json/PersistenceError.ts
/**
 * Erreur levée par l'import ou l'export JSON (plugin `persistence.json`) :
 * texte qui n'est pas du JSON, document que le migrateur ne sait pas
 * convertir, ou document refusé par `validateDocument`. Le message est en
 * français ; `code`, `issues` et `migrationCode` servent au programme.
 */

import type { IValidationIssue, MigrationErrorCode } from '@kazo-ca/timeline-runtime';

/**
 * Code machine de chaque cas d'erreur :
 * - `invalid-json` : le texte ne s'analyse pas en JSON ;
 * - `unsupported-document` : ni un document v2, ni un document v1 convertible ;
 * - `invalid-document` : le document v2 (lu ou migré) ne passe pas `validateDocument`.
 */
export type PersistenceErrorCode = 'invalid-json' | 'unsupported-document' | 'invalid-document';

function describeIssues(issues: readonly IValidationIssue[]): string {
  const lines = issues.map((issue) => `- ${issue.path} : ${issue.message} (${issue.code})`);
  return `Document invalide (${issues.length} problème(s)) :\n${lines.join('\n')}`;
}

/** Erreur d'import ou d'export JSON, avec un code exploitable par programme. */
export class PersistenceError extends Error {
  /** Code du cas d'erreur. */
  readonly code: PersistenceErrorCode;

  /** Pour `invalid-document` : problèmes relevés par `validateDocument` (copie figée). */
  readonly issues: readonly IValidationIssue[];

  /** Pour `unsupported-document` : code de la `MigrationError` du runtime. */
  readonly migrationCode?: MigrationErrorCode;

  constructor(
    code: PersistenceErrorCode,
    message: string,
    issues: readonly IValidationIssue[] = [],
    migrationCode?: MigrationErrorCode
  ) {
    super(message);
    // Rétablit la chaîne de prototypes (cible ES2018 : `instanceof` sinon faux).
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'PersistenceError';
    this.code = code;
    this.issues = Object.freeze([...issues]);
    if (migrationCode !== undefined) this.migrationCode = migrationCode;
  }

  /** Le texte n'est pas du JSON (`detail` : message de `JSON.parse`). */
  static invalidJson(detail: string): PersistenceError {
    return new PersistenceError('invalid-json', `Le fichier n'est pas du JSON valide : ${detail}`);
  }

  /** Le migrateur refuse l'entrée (version inconnue, réglages v1 absents...). */
  static unsupported(migrationCode: MigrationErrorCode, detail: string): PersistenceError {
    return new PersistenceError(
      'unsupported-document',
      `Ce fichier n'est pas un document de timeline lisible (${migrationCode}) : ${detail}`,
      [],
      migrationCode
    );
  }

  /** Le document ne passe pas `validateDocument`. */
  static invalidDocument(issues: readonly IValidationIssue[]): PersistenceError {
    return new PersistenceError('invalid-document', describeIssues(issues), issues);
  }
}
