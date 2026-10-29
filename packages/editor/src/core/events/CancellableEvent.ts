// packages/editor/src/core/events/CancellableEvent.ts
/**
 * Événement annulable transmis aux gestionnaires de `emitCancellable` :
 * il porte la charge utile et un drapeau d'annulation que tout gestionnaire
 * peut lever (sans pouvoir le baisser).
 */

/** Événement annulable vu par un gestionnaire. */
export interface ICancellableEvent<P> {
  /** Charge utile de l'événement. */
  readonly payload: P;
  /** Vrai dès qu'un gestionnaire a appelé `cancel()`. */
  readonly cancelled: boolean;
  /** Annule l'événement ; l'appel est idempotent et irréversible. */
  cancel(): void;
}

/** Implémentation interne (non exportée par l'index du module). */
export class CancellableEvent<P> implements ICancellableEvent<P> {
  private isCancelled = false;

  constructor(public readonly payload: P) {}

  get cancelled(): boolean {
    return this.isCancelled;
  }

  cancel(): void {
    this.isCancelled = true;
  }
}
