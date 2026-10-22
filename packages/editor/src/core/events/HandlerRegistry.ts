// packages/editor/src/core/events/HandlerRegistry.ts
/**
 * Registre interne des abonnements d'un canal de l'EventBus : une liste
 * immuable d'inscriptions par nom d'événement. Chaque inscription a sa propre
 * identité, ce qui permet d'inscrire deux fois le même gestionnaire et de
 * n'en retirer qu'une.
 *
 * Une émission lit un instantané de la liste (`snapshot`), puis réclame
 * chaque inscription (`claim`) juste avant de l'appeler : une inscription
 * retirée entre-temps (`off`, fonction de désabonnement, `clear`) est alors
 * ignorée, comme pour `EventTarget` du DOM. Une inscription `once` est retirée
 * au moment où elle est réclamée, donc appelée au plus une fois, même en cas
 * d'émission réentrante.
 */

/** Une inscription : le gestionnaire et son mode (`once` ou permanent). */
export interface IRegistration<H> {
  readonly handler: H;
  readonly once: boolean;
}

/** Registre nom d'événement -> inscriptions, dans l'ordre d'abonnement. */
export class HandlerRegistry<H> {
  private readonly channels = new Map<string, readonly IRegistration<H>[]>();
  /** Inscriptions retirées : un instantané en cours ne doit plus les appeler. */
  private readonly removed = new WeakSet<IRegistration<H>>();

  /** Ajoute une inscription et retourne la fonction qui retire exactement celle-ci. */
  add(name: string, handler: H, once: boolean): () => void {
    const registration: IRegistration<H> = { handler, once };
    this.channels.set(name, [...this.list(name), registration]);
    return () => this.removeRegistration(name, registration);
  }

  /** Retire la première inscription de `handler` ; retourne `false` s'il est absent. */
  remove(name: string, handler: unknown): boolean {
    const target = this.list(name).find((registration) => registration.handler === handler);
    if (target === undefined) return false;
    this.removeRegistration(name, target);
    return true;
  }

  /** Instantané (immuable) des inscriptions de `name` au début d'une émission. */
  snapshot(name: string): readonly IRegistration<H>[] {
    return this.list(name);
  }

  /**
   * Réclame `registration` juste avant de l'appeler. Retourne `false` si elle
   * a été retirée depuis l'instantané ; retire une inscription `once`.
   */
  claim(name: string, registration: IRegistration<H>): boolean {
    if (this.removed.has(registration)) return false;
    if (registration.once) this.removeRegistration(name, registration);
    return true;
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
    const names = name === undefined ? [...this.channels.keys()] : [name];
    for (const channel of names) {
      this.list(channel).forEach((registration) => this.removed.add(registration));
      this.channels.delete(channel);
    }
  }

  private list(name: string): readonly IRegistration<H>[] {
    return this.channels.get(name) ?? [];
  }

  private removeRegistration(name: string, registration: IRegistration<H>): void {
    this.removed.add(registration);
    const remaining = this.list(name).filter((candidate) => candidate !== registration);
    if (remaining.length === 0) this.channels.delete(name);
    else this.channels.set(name, remaining);
  }
}
