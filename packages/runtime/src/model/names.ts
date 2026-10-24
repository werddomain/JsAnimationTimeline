// packages/runtime/src/model/names.ts
/**
 * Règle des noms de propriétés, partagée par le schéma JSON, le contrôle de
 * forme de `validateDocument` et le registre de propriétés : des lettres et
 * des chiffres, en commençant par une lettre. `constructor` et `prototype`
 * sont refusés, pour qu'un fichier importé ne puisse jamais créer une piste
 * qui touche au prototype d'un objet.
 */

/** Same pattern as `PropertyTracks.propertyNames` in `schema/timeline.schema.json`. */
export const PROPERTY_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9]*$/;

/** Names matching the pattern but refused everywhere. */
export const RESERVED_PROPERTY_NAMES: readonly string[] = Object.freeze(['constructor', 'prototype']);

/** True for a valid track / property name such as `x` or `borderRadius`. */
export function isValidPropertyName(name: unknown): name is string {
  return typeof name === 'string' && PROPERTY_NAME_PATTERN.test(name) && !RESERVED_PROPERTY_NAMES.includes(name);
}
