// packages/editor/src/plugins/layers/target/targetValidation.ts
/**
 * Cible d'un calque saisie ou choisie dans `layers.target` : transformation
 * de la saisie libre en cible, et contrôle de forme de F06 avant tout
 * enregistrement.
 *
 * Le contrôle passe par `checkDocumentShape` du runtime (avec
 * `allowLiveTargets: false`) sur un document minimal qui ne contient que ce
 * calque : la règle est donc exactement celle du schéma (une seule clé
 * `selector` ou `ref`, chaînes non vides, `stage` facultatif non vide, aucun
 * autre champ). Une cible vivante `{ element }` est refusée : le Store gèle
 * le document et ne doit jamais contenir un nœud DOM. La syntaxe CSS d'un
 * sélecteur n'est pas vérifiée : un sélecteur invalide est enregistré et le
 * calque apparaît simplement dans les cibles manquantes.
 */

import { SCHEMA_VERSION, checkDocumentShape } from '@werddomain/timeline-runtime';
import type { IValidationIssue, SerializableLayerTarget } from '@werddomain/timeline-runtime';

/** Saisie libre : un sélecteur CSS, ou une ref avec une scène facultative. */
export interface ITargetInput {
  readonly kind: 'selector' | 'ref';
  readonly text: string;
  /** Id de la scène (pour une ref, quand il y a plusieurs scènes). */
  readonly stage?: string;
}

/** Chemin de la cible dans le document minimal. */
const TARGET_PATH = '/layers/0/target';

/** Cible de la saisie (texte et scène rognés), ou `undefined` si le texte est vide. */
export function targetFromInput(input: ITargetInput): SerializableLayerTarget | undefined {
  const text = input.text.trim();
  if (text === '') return undefined;
  if (input.kind === 'selector') return { selector: text };
  const stage = input.stage?.trim() ?? '';
  return stage === '' ? { ref: text } : { ref: text, stage };
}

/** Problèmes de forme de `value` en tant que cible enregistrable (chemins relatifs à la cible). */
export function checkTargetShape(value: unknown): IValidationIssue[] {
  const probe = {
    version: SCHEMA_VERSION,
    settings: { fps: 1, totalFrames: 1 },
    layers: [{ id: 'probe', type: 'layer', name: 'probe', spans: [], target: value }]
  };
  return checkDocumentShape(probe, { allowLiveTargets: false })
    .filter((issue) => issue.path === TARGET_PATH || issue.path.startsWith(`${TARGET_PATH}/`))
    .map((issue) => ({ ...issue, path: issue.path.slice(TARGET_PATH.length) }));
}

/** Copie simple de `value` si c'est une cible enregistrable, `undefined` sinon. */
export function toSavableTarget(value: unknown): SerializableLayerTarget | undefined {
  if (checkTargetShape(value).length > 0) return undefined;
  const target = value as SerializableLayerTarget;
  if ('selector' in target) return { selector: target.selector };
  return target.stage === undefined ? { ref: target.ref } : { ref: target.ref, stage: target.stage };
}
