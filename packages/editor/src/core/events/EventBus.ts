// packages/editor/src/core/events/EventBus.ts
/**
 * Bus d'événements typé de l'éditeur. Les noms et les charges utiles sont
 * vérifiés à la compilation grâce à une carte d'événements (par défaut
 * `TimelineEventMap`, enrichie par les plugins).
 *
 * Sémantique :
 * - les gestionnaires s'exécutent de façon synchrone, dans l'ordre d'abonnement ;
 * - la liste des gestionnaires est figée au début de chaque émission : s'abonner
 *   ou se désabonner pendant une émission n'a d'effet qu'à l'émission suivante ;
 * - un gestionnaire qui lève une erreur est signalé à `onError` et n'empêche pas
 *   les suivants de s'exécuter ;
 * - un même gestionnaire inscrit deux fois est appelé deux fois, et `off` ne
 *   retire qu'une inscription ;
 * - chaque nom d'événement a deux canaux séparés : `on`/`once`/`emit` d'un côté,
 *   `onCancellable`/`emitCancellable` de l'autre. `emit` n'appelle jamais les
 *   gestionnaires annulables et `emitCancellable` n'appelle jamais ceux de `on`.
 */

import { CancellableEvent } from './CancellableEvent';
import type { ICancellableEvent } from './CancellableEvent';
import { HandlerRegistry } from './HandlerRegistry';
import type { IRegistration } from './HandlerRegistry';
import type { TimelineEventMap } from './TimelineEventMap';

/** Gestionnaire d'un événement ordinaire. */
export type EventHandler<P> = (payload: P) => void;

/** Gestionnaire d'un événement annulable. */
export type CancellableHandler<P> = (event: ICancellableEvent<P>) => void;

/** Noms d'événements (clés textuelles) d'une carte d'événements. */
export type EventName<M> = keyof M & string;

/** Options du bus. */
export interface EventBusOptions {
  /**
   * Reçoit les erreurs levées par les gestionnaires. Par défaut, elles sont
   * écrites avec `console.error`, préfixées de `ERROR_PREFIX`.
   */
  readonly onError?: (error: unknown, eventName: string) => void;
}

/** Préfixe du message écrit par le rapporteur d'erreurs par défaut. */
export const ERROR_PREFIX = '[EventBus]';

function reportToConsole(error: unknown, eventName: string): void {
  console.error(
    `${ERROR_PREFIX} Un gestionnaire de l'événement « ${eventName} » a levé une erreur :`,
    error
  );
}

/** Bus d'événements typé ; `M` est la carte nom -> charge utile. */
export class EventBus<M extends object = TimelineEventMap> {
  private readonly handlers = new HandlerRegistry<EventHandler<never>>();
  private readonly cancellableHandlers = new HandlerRegistry<CancellableHandler<never>>();
  private readonly reportError: (error: unknown, eventName: string) => void;

  constructor(options: EventBusOptions = {}) {
    this.reportError = options.onError ?? reportToConsole;
  }

  /** S'abonne à `name` ; retourne la fonction de désabonnement. */
  on<K extends EventName<M>>(name: K, handler: EventHandler<M[K]>): () => void {
    return this.handlers.add(name, handler, false);
  }

  /** S'abonne à la prochaine émission de `name` seulement. */
  once<K extends EventName<M>>(name: K, handler: EventHandler<M[K]>): () => void {
    return this.handlers.add(name, handler, true);
  }

  /**
   * Retire une inscription de `handler` pour `name` : d'abord dans le canal
   * ordinaire, sinon dans le canal annulable. Sans effet si elle est absente.
   */
  off<K extends EventName<M>>(
    name: K,
    handler: EventHandler<M[K]> | CancellableHandler<M[K]>
  ): void {
    if (!this.handlers.remove(name, handler)) this.cancellableHandlers.remove(name, handler);
  }

  /** Émet `name` vers les gestionnaires ordinaires. */
  emit<K extends EventName<M>>(name: K, payload: M[K]): void {
    this.dispatch(this.handlers.take(name), name, (handler) =>
      (handler as EventHandler<M[K]>)(payload)
    );
  }

  /** S'abonne aux émissions annulables de `name` ; retourne la fonction de désabonnement. */
  onCancellable<K extends EventName<M>>(
    name: K,
    handler: CancellableHandler<M[K]>
  ): () => void {
    return this.cancellableHandlers.add(name, handler, false);
  }

  /**
   * Émet `name` vers les gestionnaires annulables. Tous s'exécutent, même
   * après une annulation (ils peuvent lire `event.cancelled`).
   * @returns `true` si aucun gestionnaire n'a annulé l'événement.
   */
  emitCancellable<K extends EventName<M>>(name: K, payload: M[K]): boolean {
    const event = new CancellableEvent<M[K]>(payload);
    this.dispatch(this.cancellableHandlers.take(name), name, (handler) =>
      (handler as CancellableHandler<M[K]>)(event)
    );
    return !event.cancelled;
  }

  /** Nombre d'inscriptions (les deux canaux) pour `name`, ou au total si absent. */
  listenerCount(name?: EventName<M>): number {
    return this.handlers.count(name) + this.cancellableHandlers.count(name);
  }

  /** Retire toutes les inscriptions (les deux canaux) de `name`, ou toutes si absent. */
  clear(name?: EventName<M>): void {
    this.handlers.clear(name);
    this.cancellableHandlers.clear(name);
  }

  private dispatch<H>(
    snapshot: readonly IRegistration<H>[],
    name: string,
    invoke: (handler: H) => void
  ): void {
    for (const registration of snapshot) {
      try {
        invoke(registration.handler);
      } catch (error) {
        this.reportError(error, name);
      }
    }
  }
}
