// packages/runtime/src/index.ts
/**
 * Point d'entrée public du package runtime (lecteur sans interface).
 * Pour l'instant : le modèle de document v2 (F05) et le migrateur v1 → v2 (R4).
 * Le lecteur arrive avec R1 à R3.
 */
export * from './model';
export * from './migrate';
