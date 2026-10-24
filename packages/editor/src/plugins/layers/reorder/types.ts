// packages/editor/src/plugins/layers/reorder/types.ts
/**
 * Contrat de `layers.reorder` pour les autres plugins : le service
 * `layers.reorder` (déplacement annulable de calques et de dossiers).
 */

import type { ILayerDropTarget } from './moveNodes';

/** API publiée sous le service `layers.reorder`. */
export interface ILayerReorderService {
  /**
   * Déplace les nœuds `ids` vers `target` en une commande annulable
   * `Déplacer les calques` (voir `moveNodes` pour les règles : nœuds de tête,
   * ordre d'affichage conservé, `target.index` dans la liste d'avant). Les
   * calques verrouillés peuvent être déplacés.
   *
   * @returns `true` si le document a changé ; `false` si le déplacement est
   * refusé (dossier dans lui-même ou un descendant, destination inconnue) ou
   * ne change rien.
   */
  move(ids: readonly string[], target: ILayerDropTarget): boolean;
}

declare module '../../../core/context/IEditorContext' {
  interface EditorServiceMap {
    'layers.reorder': ILayerReorderService;
  }
}
