// packages/editor/src/core/events/TimelineEventMap.ts
/**
 * Carte des événements de l'éditeur : associe chaque nom d'événement au type
 * de sa charge utile. Le noyau n'y déclare que ses propres événements ; chaque
 * plugin l'enrichit par fusion de déclarations (augmentation de module).
 */

/** Charge utile de `editor:ready` : l'éditeur est prêt, tous les plugins sont initialisés. */
export interface EditorReadyEvent {
  /** Ids des plugins initialisés, dans l'ordre d'initialisation. */
  readonly pluginIds: readonly string[];
}

/** Charge utile de `editor:destroying` : l'éditeur va être détruit. */
export interface EditorDestroyingEvent {
  /** Raison facultative de la destruction (journalisation, débogage). */
  readonly reason?: string;
}

/**
 * Carte nom d'événement -> type de la charge utile.
 *
 * Chaque plugin ajoute ses événements par fusion de déclarations, sans toucher
 * à ce fichier. Par exemple, depuis `packages/editor/src/plugins/layers/LayerColorPlugin.ts` :
 *
 * ```ts
 * declare module '../../core/events/TimelineEventMap' {
 *   interface TimelineEventMap {
 *     'layer:colorChanged': { layerId: string; color: string };
 *   }
 * }
 * ```
 *
 * Le chemin du `declare module` est relatif au fichier qui déclare
 * l'augmentation et doit désigner ce module. Une fois l'augmentation visible,
 * `bus.emit('layer:colorChanged', { layerId: 'l1', color: '#f00' })` est
 * vérifié par le compilateur (nom et charge utile).
 *
 * Une augmentation est globale au programme TypeScript qui la voit : ne
 * jamais tester l'union exacte des noms (elle grandit avec chaque plugin),
 * seulement l'inclusion des noms attendus.
 *
 * Convention de nommage : `<domaine>:<action au passé ou à l'infinitif>`.
 */
export interface TimelineEventMap {
  'editor:ready': EditorReadyEvent;
  'editor:destroying': EditorDestroyingEvent;
}
