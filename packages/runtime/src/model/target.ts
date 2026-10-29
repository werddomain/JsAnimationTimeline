// packages/runtime/src/model/target.ts
/**
 * Cible d'un calque. Les formes se distinguent par leur clé :
 * - `{ selector }` : sélecteur CSS (sérialisable) ;
 * - `{ ref, stage? }` : référence résolue par une scène (sérialisable) ;
 * - `{ element }` : élément passé directement (exécution seulement, jamais
 *   sérialisé, absent du schéma JSON).
 * Toute future forme aura sa propre clé obligatoire.
 */

/** Target resolved with `root.querySelector(selector)` by the HTML stage. */
export interface ISelectorTarget {
  readonly selector: string;
}

/** Target resolved by a stage from a developer-chosen reference. */
export interface IRefTarget {
  /** Reference of the animated object, interpreted by the stage (non-empty). */
  readonly ref: string;
  /** Id of the only stage allowed to resolve it; any stage accepting it when absent. */
  readonly stage?: string;
}

/** Runtime-only target: never serialised, not part of the JSON schema. */
export interface IElementTarget {
  readonly element: Element;
}

/** Target forms allowed in a JSON document. */
export type SerializableLayerTarget = ISelectorTarget | IRefTarget;

/** Target of a layer. */
export type LayerTarget = SerializableLayerTarget | IElementTarget;

/** Discriminating keys of the target forms; a target has exactly one of them. */
export const TARGET_KEYS: readonly string[] = Object.freeze(['selector', 'ref', 'element']);
