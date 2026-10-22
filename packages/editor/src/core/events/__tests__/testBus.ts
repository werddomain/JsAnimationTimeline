// packages/editor/src/core/events/__tests__/testBus.ts
/**
 * Fixture partagée des tests de l'EventBus : une carte d'événements locale
 * (indépendante de TimelineEventMap) et une fabrique de bus.
 */

import { EventBus } from '../EventBus';

/** Carte d'événements utilisée uniquement par les tests du bus. */
export interface TestEvents {
  'item:added': { readonly id: string };
  'item:removed': { readonly id: string };
  'count:changed': number;
}

/** Crée un bus sur `TestEvents`, avec un rapporteur d'erreurs facultatif. */
export function createBus(
  onError?: (error: unknown, eventName: string) => void
): EventBus<TestEvents> {
  return new EventBus<TestEvents>({ onError });
}
