// packages/editor/src/core/editor/EditorLifecycle.ts
/**
 * Cycle de vie d'un éditeur : actif, en cours de destruction, détruit.
 * Pendant la destruction (`editor:destroying` puis `destroy` des plugins),
 * l'éditeur reste utilisable ; une fois détruit, toute action lève une
 * erreur.
 */

/** État du cycle de vie. */
type LifecycleState = 'active' | 'destroying' | 'destroyed';

/** Suit l'état d'un éditeur et refuse les actions après sa destruction. */
export class EditorLifecycle {
  private state: LifecycleState = 'active';

  /** Vrai une fois la destruction terminée. */
  get isDestroyed(): boolean {
    return this.state === 'destroyed';
  }

  /**
   * Lève une erreur si l'éditeur est détruit.
   *
   * @param operation Membre appelé, repris dans le message (ex. « execute »).
   */
  assertActive(operation: string): void {
    if (this.state !== 'destroyed') return;
    throw new Error(`L'éditeur a été détruit : « ${operation} » n'est plus disponible.`);
  }

  /** Passe à l'état « en cours de destruction » ; `false` si c'est déjà le cas ou si c'est fait. */
  beginDestroy(): boolean {
    if (this.state !== 'active') return false;
    this.state = 'destroying';
    return true;
  }

  /** Marque l'éditeur comme détruit. */
  finishDestroy(): void {
    this.state = 'destroyed';
  }
}
