// packages/editor/src/plugins/layers/list/types.ts
/**
 * Contrat de `layers.list` pour les autres plugins : la ligne vue par un
 * contrôle, le contrôle de ligne (Y2 à Y4 s'y branchent sans toucher à la
 * liste), le service `layers.list` et l'événement `layers:rowsChanged`.
 */

import type { LayerNode } from '@kazo-ca/timeline-runtime';
import type { IVisibleRow } from '../../../model/rows';

/** Une ligne affichée, avec son nœud du document courant. */
export interface ILayerRow extends IVisibleRow {
  /** Calque ou dossier de la ligne (document courant, figé). */
  readonly node: LayerNode;
  /**
   * Vrai si la ligne est verrouillée, elle ou un dossier parent : les
   * contrôles qui modifient les images s'en servent pour se désactiver.
   */
  readonly lockedByAncestor: boolean;
  /**
   * Vrai si la ligne est masquée, elle ou un dossier parent (œil fermé) :
   * la ligne est grisée ; l'œil d'un enfant reste celui de son propre champ.
   */
  readonly hiddenByAncestor: boolean;
}

/**
 * Contrôle ajouté à droite de chaque ligne (œil, cadenas, couleur...).
 *
 * La liste crée pour chaque ligne un élément `<span>` propre au contrôle,
 * le place selon `order`, puis appelle `render` une fois. Ensuite, à chaque
 * document (ou changement de ligne), elle appelle `update` sur le même
 * élément. Sans `update`, l'élément est vidé et `render` rappelé.
 */
export interface ILayerRowControl {
  /** Identifiant unique, en notation pointée (par convention, celui du plugin : `layers.lock`). */
  readonly id: string;
  /** Position de gauche à droite : le plus petit `order` est le plus à gauche. */
  readonly order: number;
  /** Rend le contrôle de `row` dans `element` (vide, déjà dans la ligne). */
  readonly render: (row: ILayerRow, element: HTMLElement) => void;
  /** Met à jour le contrôle quand la ligne ou son nœud a changé. */
  readonly update?: (row: ILayerRow, element: HTMLElement) => void;
  /**
   * Libère ce que `render` a créé hors de `element`. Appelé quand la ligne
   * ou le contrôle disparaît (l'élément est retiré ensuite), et aussi avant
   * chaque nouveau rendu d'un contrôle sans `update` (l'élément reste en place).
   */
  readonly dispose?: (row: ILayerRow, element: HTMLElement) => void;
  /**
   * En-tête de colonne facultatif (comme l'œil et le cadenas au-dessus des
   * colonnes dans Flash), rendu dans la zone `layersHeader`.
   */
  readonly renderHeader?: (element: HTMLElement) => void;
  /** Libère ce que `renderHeader` a créé hors de `element` (retrait du contrôle ou destruction). */
  readonly disposeHeader?: (element: HTMLElement) => void;
}

/**
 * Charge utile de `layers:rowsChanged`. L'événement part au rendu de la
 * liste (premier envoi, `previous` vide), puis chaque fois que la
 * disposition des lignes change (ids, ordre, profondeur, parent), après la
 * mise à jour du DOM. Un changement qui garde la disposition (nom, couleur,
 * verrou...) ne le déclenche pas : pour le contenu des nœuds, écouter
 * `document:changed` et `document:loaded` (un chargement n'émet que ce
 * dernier), puis relire `rows()` du service. Les lignes sont celles
 * du document au moment de l'envoi : ne pas les garder en cache.
 */
export interface LayerRowsChangedEvent {
  /** Lignes affichées, en ordre d'affichage. */
  readonly rows: readonly ILayerRow[];
  /** Lignes d'avant (vide au premier rendu). */
  readonly previous: readonly ILayerRow[];
}

/** API publiée sous le service `layers.list`. */
export interface ILayerListService {
  /** Lignes affichées (document courant), en ordre d'affichage. */
  rows(): readonly ILayerRow[];
  /** Ligne `id`, ou `undefined` si elle n'est pas affichée (inconnue ou dans un dossier replié). */
  row(id: string): ILayerRow | undefined;
  /** Élément DOM de la ligne `id`, ou `undefined` (non affichée, ou avant le rendu). */
  rowElement(id: string): HTMLElement | undefined;
  /**
   * Élément du nom de la ligne `id` (renommage sur place) ; tant qu'il porte
   * l'attribut `data-editing`, la liste ne réécrit pas son texte.
   */
  nameElement(id: string): HTMLElement | undefined;
  /** Id de la ligne qui contient `target` (délégation d'événements), ou `undefined`. */
  rowIdAt(target: EventTarget | null): string | undefined;
  /** Élément de la liste (`role="tree"`), ou `undefined` avant le rendu et après la destruction. */
  element(): HTMLElement | undefined;
  /**
   * Ajoute un contrôle de ligne, rendu tout de suite sur les lignes déjà
   * affichées. Lève une erreur si son `id` est déjà pris.
   *
   * @returns La fonction qui retire le contrôle de toutes les lignes.
   */
  addRowControl(control: ILayerRowControl): () => void;
  /**
   * Replie ou déplie le dossier `folderId` (commande annulable) ; `true` si
   * le document a changé, `false` si le dossier était déjà dans cet état.
   * Lève une erreur si `folderId` n'est pas un dossier du document.
   */
  setCollapsed(folderId: string, collapsed: boolean): boolean;
  /**
   * Inverse l'état replié du dossier `folderId` (commande annulable) ;
   * `true` si le document a changé (toujours le cas pour un dossier).
   * Lève une erreur si `folderId` n'est pas un dossier du document.
   */
  toggleCollapsed(folderId: string): boolean;
}

declare module '../../../core/context/IEditorContext' {
  interface EditorServiceMap {
    'layers.list': ILayerListService;
  }
}

declare module '../../../core/events/TimelineEventMap' {
  interface TimelineEventMap {
    'layers:rowsChanged': LayerRowsChangedEvent;
  }
}
