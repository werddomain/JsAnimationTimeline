// packages/editor/src/plugins/layers/icon/types.ts
/** Service `layers.icon`. */

/** API publiée sous le service `layers.icon`. */
export interface ILayerIconService {
  /**
   * Donne l'icône `icon` (nom intégré, classes CSS ou URL, validée par
   * `classifyLayerIcon`) au calque `id`, ou la retire avec `undefined`
   * (commande annulable).
   *
   * @returns `false` si le nœud est inconnu ou est un dossier, si l'icône est refusée ou si rien ne change.
   */
  setIcon(id: string, icon: string | undefined): boolean;
  /** Ouvre le menu d'icônes du calque `id` ; sans effet pour un dossier ou un id inconnu. */
  openChooser(id: string): void;
}

declare module '../../../core/context/IEditorContext' {
  interface EditorServiceMap {
    'layers.icon': ILayerIconService;
  }
}
