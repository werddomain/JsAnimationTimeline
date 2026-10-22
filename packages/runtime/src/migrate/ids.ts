// packages/runtime/src/migrate/ids.ts
/**
 * Attribution d'ids uniques pendant la migration : les ids explicites du
 * fichier v1 sont réservés d'avance, pour qu'un id généré ne prenne jamais
 * celui d'un nœud rencontré plus tard.
 */

export class IdAllocator {
  private readonly reserved: ReadonlySet<string>;
  private readonly used = new Set<string>();

  /** @param reserved Every explicit id of the input, in any order. */
  constructor(reserved: Iterable<string>) {
    this.reserved = new Set(reserved);
  }

  /** Takes `id` when it is free; returns `false` when it was already taken. */
  claim(id: string): boolean {
    if (this.used.has(id)) {
      return false;
    }
    this.used.add(id);
    return true;
  }

  /** Returns `${prefix}${n}` with the smallest n >= 1 that is neither reserved nor used, and takes it. */
  generate(prefix: string): string {
    for (let n = 1; ; n++) {
      const candidate = `${prefix}${n}`;
      if (!this.reserved.has(candidate) && !this.used.has(candidate)) {
        this.used.add(candidate);
        return candidate;
      }
    }
  }
}
