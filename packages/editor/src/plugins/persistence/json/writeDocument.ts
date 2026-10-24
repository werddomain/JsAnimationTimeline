// packages/editor/src/plugins/persistence/json/writeDocument.ts
/**
 * Écriture d'un document en texte JSON. Le document est d'abord contrôlé par
 * `validateDocument(doc, { allowLiveTargets: false })` : le texte produit se
 * relit toujours avec `readDocument`. Les cibles sont écrites telles quelles
 * (`{ selector }` ou `{ ref, stage? }`) ; une cible vivante `{ element }`
 * est refusée au lieu d'être écrite `{}`.
 */

import type { ITimelineDocument } from '@werddomain/timeline-runtime';
import { assertSerializable } from './readDocument';

/** Indentation par défaut du JSON exporté (lisible et stable dans un dépôt). */
export const DEFAULT_JSON_SPACE = 2;

/** Options d'écriture. */
export interface IWriteOptions {
  /** Indentation passée à `JSON.stringify` (`0` pour une seule ligne). Par défaut : 2. */
  readonly space?: number | string;
}

/**
 * Écrit `doc` en JSON.
 *
 * @throws PersistenceError `invalid-document` si `doc` ne passe pas la validation.
 */
export function writeDocument(doc: ITimelineDocument, options: IWriteOptions = {}): string {
  assertSerializable(doc);
  return JSON.stringify(doc, null, options.space ?? DEFAULT_JSON_SPACE);
}
