// packages/editor/src/core/events/HandlerRegistry.ts
/**
 * Registre interne des abonnements d'un canal de l'EventBus : une liste
 * immuable d'inscriptions par nom d'événement. Chaque inscription a sa propre
 * identité, ce qui permet d'inscrire deux fois le même gestionnaire et de
 * n'en retirer qu'une.
 */

/** Une inscription : le gestionnaire et son mode (`once` ou permanent). */
export interface IRegistration<H> {
  readonly handler: H;
  readonly once: boolean;
}

/** Registre nom d'événement -> inscriptions, dans l'ordre d'abonnement. */
export class HandlerRegistry<H> {
  private readonly channels = new Map<string, readonly IRegistration<H>[]>();

  /** Ajoute une inscription et retourne la fonction qui retire exactement celle-ci. */
  add(name: string, handler: H, once: boolean): () => void {
    const registration: IRegistration<H> = { handler, once };
    this.channels.set(name, [...this.list(name), registration]);
    return () => this.removeRegistration(name, registration);
  }

  /** Retire la première inscription de `handler` ; ne fait rien s'il est absent. */
  remove(name: string, handler: unknown): boolean {
    const target = this.list(name).find((registration) => registration.handler === handler);
    if (target === undefined) return false;
    this.removeRegistration(name, target);
    return true;
  }

  /**
   * Retourne l'instantané des inscriptions à appeler pour une émission et
   * retire dès maintenant les inscriptions `once`, pour qu'une émission
   * réentrante ne les rappelle pas.
   */
  take(name: string): readonly IRegistration<H>[] {
    const snapshot = this.list(name);
    if (snapshot.some((registration) => registration.once)) {
      this.replace(name, snapshot.filter((registration) => !registration.once));
    }
    return snapshot;
  }

  /** Nombre d'inscriptions pour `name`, ou pour tous les noms si absent. */
  count(name?: string): number {
    if (name !== undefined) return this.list(name).length;
    let total = 0;
    for (const registrations of this.channels.values()) total += registrations.length;
    return total;
  }

  /** Vide les inscriptions de `name`, ou toutes si absent. */
  clear(name?: string): void {
    if (name === undefined) this.channels.clear();
    else this.channels.delete(name);
  }

  private list(name: string): readonly IRegistration<H>[] {
    return this.channels.get(name) ?? [];
  }

  private removeRegistration(name: string, registration: IRegistration<H>): void {
    this.replace(
      name,
      this.list(name).filter((candidate) => candidate !== registration)
    );
  }

  private replace(name: string, registrations: readonly IRegistration<H>[]): void {
    if (registrations.length === 0) this.channels.delete(name);
    else this.channels.set(name, registrations);
  }
}
