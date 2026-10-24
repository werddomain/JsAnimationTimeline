// packages/editor/src/core/store/unknownTracks.ts
/**
 * Pistes dont le nom est inconnu du registre de l'éditeur. Le Store les
 * signale au chargement : un avertissement par défaut, un refus avec
 * `strictProperties`. L'évaluation, elle, les saute (rendu des autres pistes
 * conservé).
 */

import { findUnknownProperties, isLayer, resolveTracks, walkLayers } from '@werddomain/timeline-runtime';
import type { ILayer, ITimelineDocument, IValidationIssue, PropertyRegistry } from '@werddomain/timeline-runtime';

/** Code d'un nom de piste inconnu du registre. */
export const UNKNOWN_PROPERTY = 'unknown-property';

/** Problème relevé par le Store en plus de `validateDocument`. */
export interface IUnknownPropertyIssue {
  /** Chemin de la première piste qui porte ce nom dans le calque. */
  readonly path: string;
  readonly code: typeof UNKNOWN_PROPERTY;
  /** Nom de la propriété inconnue. */
  readonly property: string;
  readonly message: string;
}

/** Problème d'un document refusé ou signalé par le Store. */
export type StoreIssue = IValidationIssue | IUnknownPropertyIssue;

function firstTrackPath(layer: ILayer, pointer: string, property: string): string {
  const index = layer.spans.findIndex((span) =>
    Object.prototype.hasOwnProperty.call(resolveTracks(span), property)
  );
  return index < 0 ? `${pointer}/spans` : `${pointer}/spans/${index}/tracks/${property}`;
}

/** Une entrée par calque et par nom inconnu, à la première piste qui le porte. */
export function findUnknownTracks(doc: ITimelineDocument, registry: PropertyRegistry): IUnknownPropertyIssue[] {
  const issues: IUnknownPropertyIssue[] = [];
  walkLayers(doc.layers, ({ node, pointer }) => {
    if (!isLayer(node)) return;
    findUnknownProperties(node, registry).forEach((property) => {
      issues.push({
        path: firstTrackPath(node, pointer, property),
        code: UNKNOWN_PROPERTY,
        property,
        message: `Layer "${node.id}": property "${property}" is not in the editor registry.`
      });
    });
  });
  return issues;
}
