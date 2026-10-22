// packages/runtime/src/model/target.ts
/**
 * Cible d'un calque : un sélecteur CSS (seule forme sérialisable, présente
 * dans le schéma JSON) ou un élément passé directement (exécution seulement,
 * jamais sérialisé).
 */

/** Target resolved with `root.querySelector(selector)` by the player. */
export interface ISelectorTarget {
  readonly selector: string;
}

/** Runtime-only target: never serialised, not part of the JSON schema. */
export interface IElementTarget {
  readonly element: Element;
}

/** Target of a layer. */
export type LayerTarget = ISelectorTarget | IElementTarget;
