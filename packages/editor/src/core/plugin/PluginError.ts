// packages/editor/src/core/plugin/PluginError.ts
/**
 * Erreur levée par le système de plugins (identifiant invalide, dépendance
 * manquante ou circulaire, emplacement absent ou invalide, échec de
 * démarrage...).
 */

/** Code machine de chaque cas d'erreur du système de plugins. */
export type PluginErrorCode =
  | 'invalid-id'
  | 'duplicate-id'
  | 'missing-dependency'
  | 'circular-dependency'
  | 'missing-slot'
  | 'invalid-slot'
  | 'duplicate-slot'
  | 'init-failed'
  | 'render-failed'
  | 'starting'
  | 'already-started'
  | 'not-started';

/** Erreur du système de plugins, avec un code exploitable par programme. */
export class PluginError extends Error {
  /** Code du cas d'erreur. */
  readonly code: PluginErrorCode;

  /** Identifiant du plugin concerné, quand il y en a un. */
  readonly pluginId?: string;

  /**
   * Erreur d'origine (pour `init-failed` et `render-failed`). Déclarée ici
   * car la bibliothèque ES2018 ne connaît pas `ErrorOptions`.
   */
  readonly cause?: unknown;

  constructor(code: PluginErrorCode, message: string, pluginId?: string, cause?: unknown) {
    super(message);
    // Rétablit la chaîne de prototypes (cible ES2018 : `instanceof` sinon faux).
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'PluginError';
    this.code = code;
    this.pluginId = pluginId;
    this.cause = cause;
  }
}
