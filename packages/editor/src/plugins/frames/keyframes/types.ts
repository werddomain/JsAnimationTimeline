// packages/editor/src/plugins/frames/keyframes/types.ts
/**
 * Contrat de `frames.keyframes` pour les autres plugins : le service
 * `frames.keyframes`. La barre d'outils (T2) et le menu contextuel (I1)
 * l'appellent comme les raccourcis F5 / F6 / F7.
 *
 * Chaque méthode vise les images sélectionnées (sinon la tête de lecture sur
 * les calques sélectionnés), exécute un seul lot (une entrée d'historique,
 * tout ou rien) et retourne `true` si le document a changé. Un refus (calque
 * verrouillé, image hors limites) émet `command:refused` et retourne `false`.
 */

/** API publiée sous le service `frames.keyframes`. */
export interface IFramesKeyframesService {
  /** F6 : insère une image clé. */
  insertKeyframe(): boolean;
  /** F7 : insère une image clé vide. */
  insertBlankKeyframe(): boolean;
  /** Maj+F6 : efface les images clés. */
  deleteKeyframe(): boolean;
  /** F5 : insère une image. */
  insertFrame(): boolean;
  /** Maj+F5 : supprime une image. */
  removeFrame(): boolean;
  /**
   * Déplace les images clés sélectionnées de `offset` images (négatif : vers
   * la gauche) et déplace la sélection avec elles. `offset` est d'abord
   * borné pour que les images clés restent dans la timeline (1 à
   * `totalFrames`) ; s'il vaut alors 0 (déjà au bord), rien ne se passe et
   * `false` est retourné sans événement. Un refus (verrou, bornes de K1,
   * image clé de propriété écrasée) émet `command:refused` et retourne
   * `false`.
   */
  move(offset: number): boolean;
}

declare module '../../../core/context/IEditorContext' {
  interface EditorServiceMap {
    'frames.keyframes': IFramesKeyframesService;
  }
}
