// packages/editor/src/plugins/layers/color/types.ts
/** Service `layers.color`. */

/** API publiée sous le service `layers.color`. */
export interface ILayerColorService {
  /**
   * Donne la couleur `#rrggbb` au nœud `id` (calque ou dossier), ou la retire
   * avec `undefined` (commande annulable).
   *
   * @returns `false` si le nœud est inconnu, la couleur invalide ou si rien ne change.
   */
  setColor(id: string, color: string | undefined): boolean;
}

declare module '../../../core/context/IEditorContext' {
  interface EditorServiceMap {
    'layers.color': ILayerColorService;
  }
}
