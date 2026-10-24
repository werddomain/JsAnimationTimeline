// packages/editor/src/plugins/layers/selection/types.ts
/**
 * Contrat de `layers.selection` pour les autres plugins : le service
 * `layers.selection` et l'événement `layers:selectionChanged`.
 *
 * La sélection est de l'état d'interface de l'éditeur : elle n'est ni dans le
 * document ni annulable.
 */

/** Mode de `select` : remplacer la sélection, ajouter à elle, ou inverser l'état de chaque id. */
export type SelectionMode = 'replace' | 'add' | 'toggle';

/** Charge utile de `layers:selectionChanged`. */
export interface LayerSelectionChangedEvent {
  /** Ids sélectionnés, dans l'ordre d'affichage des lignes. */
  readonly ids: readonly string[];
  /** Ids sélectionnés avant le changement (même ordre d'affichage). */
  readonly previous: readonly string[];
  /** Ancre de la sélection par plage (absente si aucune). */
  readonly anchor?: string;
  /** Ligne qui a le focus clavier (absente si aucune). */
  readonly focused?: string;
}

/** API publiée sous le service `layers.selection`. */
export interface ILayerSelectionService {
  /** Ids sélectionnés, dans l'ordre d'affichage des lignes. */
  selected(): readonly string[];
  /** Vrai si la ligne `id` est sélectionnée. */
  isSelected(id: string): boolean;
  /** Ancre de la sélection par plage : la ligne d'où part Maj+clic. */
  anchor(): string | undefined;
  /** Ligne qui a le focus clavier (celle qui porte `tabindex="0"`). */
  focused(): string | undefined;
  /**
   * Sélectionne `ids` (les ids qui ne sont pas des lignes visibles sont
   * ignorés). L'ancre et le focus vont sur le dernier id valide. `replace`
   * avec aucun id valide vide la sélection.
   */
  select(ids: readonly string[], mode?: SelectionMode): void;
  /**
   * Sélectionne les lignes visibles de `fromId` à `toId` (dans un sens ou
   * l'autre), en remplaçant la sélection ou, si `additive`, en la complétant.
   * L'ancre va sur `fromId`, le focus sur `toId`. Sans effet si l'un des
   * deux n'est pas une ligne visible.
   */
  selectRange(fromId: string, toId: string, additive?: boolean): void;
  /** Sélectionne toutes les lignes visibles. */
  selectAll(): void;
  /** Vide la sélection et l'ancre ; le focus clavier reste où il est. */
  clear(): void;
}

declare module '../../../core/context/IEditorContext' {
  interface EditorServiceMap {
    'layers.selection': ILayerSelectionService;
  }
}

declare module '../../../core/events/TimelineEventMap' {
  interface TimelineEventMap {
    'layers:selectionChanged': LayerSelectionChangedEvent;
  }
}
