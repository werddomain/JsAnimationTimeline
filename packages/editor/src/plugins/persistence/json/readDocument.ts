// packages/editor/src/plugins/persistence/json/readDocument.ts
/**
 * Lecture d'un document de timeline (texte JSON ou objet déjà analysé),
 * sans toucher à l'éditeur :
 * 1. le texte est analysé (`JSON.parse`) ;
 * 2. `migrateToV2` du runtime rend un document v2 : un v2 tel quel, un v1
 *    converti (avec ses avertissements) ;
 * 3. `validateDocument(doc, { allowLiveTargets: false })` contrôle la forme
 *    et les invariants. Aucun contrôle de forme n'est écrit ici : le runtime
 *    est la seule source de vérité.
 *
 * Les cibles ne sont jamais réécrites : `{ selector }` et `{ ref, stage? }`
 * arrivent telles quelles dans le document lu. Une cible vivante
 * `{ element }` est refusée par la validation (`live-target`).
 *
 * Le document rendu ne partage rien avec un objet passé en entrée (copie
 * d'un v2 déjà validé), car l'éditeur gèle en place le document qu'il reçoit.
 */

import { MigrationError, migrateToV2, validateDocument } from '@werddomain/timeline-runtime';
import type { IMigrationWarning, ITimelineDocument } from '@werddomain/timeline-runtime';
import { PersistenceError } from './PersistenceError';

/** Document lu, prêt à être chargé. */
export interface IReadResult {
  /** Document v2 validé (copie indépendante de l'entrée). */
  readonly document: ITimelineDocument;
  /** Vrai si l'entrée était un document v1 converti par le migrateur. */
  readonly migrated: boolean;
  /** Corrections faites par le migrateur (vide pour un document v2). */
  readonly warnings: readonly IMigrationWarning[];
}

/** Analyse `text` en JSON ; lève `PersistenceError` (`invalid-json`) sinon. */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw PersistenceError.invalidJson(error instanceof Error ? error.message : String(error));
  }
}

function copyJson(doc: ITimelineDocument): ITimelineDocument {
  return JSON.parse(JSON.stringify(doc)) as ITimelineDocument;
}

function migrate(input: unknown): { readonly document: ITimelineDocument; readonly warnings: readonly IMigrationWarning[] } {
  try {
    return migrateToV2(input);
  } catch (error) {
    if (error instanceof MigrationError) throw PersistenceError.unsupported(error.code, error.message);
    throw error;
  }
}

/** Lève `PersistenceError` (`invalid-document`) si `doc` ne passe pas `validateDocument` sans cible vivante. */
export function assertSerializable(doc: unknown): asserts doc is ITimelineDocument {
  const issues = validateDocument(doc, { allowLiveTargets: false });
  if (issues.length > 0) throw PersistenceError.invalidDocument(issues);
}

/**
 * Lit un document : texte JSON (`string`) ou valeur déjà analysée.
 *
 * @throws PersistenceError `invalid-json`, `unsupported-document` ou `invalid-document`.
 */
export function readDocument(source: unknown): IReadResult {
  const input = typeof source === 'string' ? parseJson(source) : source;
  const { document, warnings } = migrate(input);
  assertSerializable(document);
  const migrated = document !== input;
  // Un v2 est rendu par référence par le migrateur : on copie l'objet de
  // l'appelant. Validé, il ne contient que des valeurs JSON (aucun élément,
  // nombres finis) : l'aller-retour JSON en fait une copie fidèle.
  const independent = !migrated && typeof source !== 'string' ? copyJson(document) : document;
  return { document: independent, migrated, warnings: Object.freeze([...warnings]) };
}
