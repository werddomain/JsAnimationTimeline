// packages/runtime/src/transport/EventEmitter.ts
/**
 * Émetteur d'événements typé et minimal du transport et du lecteur. Une erreur levée par un
 * écouteur n'empêche ni les autres écouteurs ni la suite de la lecture : elle
 * est confiée à `onError`.
 */

/** Receives the errors thrown by listeners. */
export type ListenerErrorHandler = (error: unknown) => void;

/** Listeners keyed by event name, payload typed by `TMap`. */
export class EventEmitter<TMap extends object> {
  private readonly listeners = new Map<keyof TMap, Set<(event: never) => void>>();

  constructor(private readonly onError: ListenerErrorHandler) {}

  on<K extends keyof TMap>(event: K, listener: (payload: TMap[K]) => void): () => void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener as (event: never) => void);
    this.listeners.set(event, set);
    return () => this.off(event, listener);
  }

  off<K extends keyof TMap>(event: K, listener: (payload: TMap[K]) => void): void {
    this.listeners.get(event)?.delete(listener as (event: never) => void);
  }

  /** Calls every listener of `event`, in subscription order, on a snapshot of the list. */
  emit<K extends keyof TMap>(event: K, payload: TMap[K]): void {
    const set = this.listeners.get(event);
    if (set === undefined) {
      return;
    }
    for (const listener of Array.from(set)) {
      try {
        (listener as (payload: TMap[K]) => void)(payload);
      } catch (error) {
        this.onError(error);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
