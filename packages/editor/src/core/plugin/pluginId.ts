// packages/editor/src/core/plugin/pluginId.ts
/**
 * Règle de forme des identifiants de plugin (notation pointée, par exemple
 * « core », « layers.color », « layout.scrollSync »).
 */

import { PluginError } from './PluginError';

/** Forme valide d'un identifiant : segments `[a-z][a-zA-Z0-9]*` séparés par des points. */
export const PLUGIN_ID_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)*$/;

/** Vrai si `id` est un identifiant de plugin valide. */
export function isValidPluginId(id: unknown): id is string {
  return typeof id === 'string' && PLUGIN_ID_PATTERN.test(id);
}

/** Lève une `PluginError` 'invalid-id' si `id` n'est pas valide. */
export function assertValidPluginId(id: unknown): asserts id is string {
  if (isValidPluginId(id)) return;
  throw new PluginError(
    'invalid-id',
    `Identifiant de plugin invalide : ${JSON.stringify(id)}. ` +
      'Attendu : des segments commençant par une minuscule, séparés par des points ' +
      '(ex. "core", "layers.color").'
  );
}
