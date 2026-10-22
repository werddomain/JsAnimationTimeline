// packages/runtime/src/player/EventEmitter.ts
/**
 * Émetteur d'événements typé et minimal du lecteur.
 */

/** Listeners keyed by event name, payload typed by `TMap`. */
export class EventEmitter<TMap extends object> {
  private readonly listeners = new Map<keyof TMap, Set<(event: never) => void>>();

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
      (listener as (payload: TMap[K]) => void)(payload);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
