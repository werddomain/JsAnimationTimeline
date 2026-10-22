// packages/runtime/src/index.ts
/**
 * Point d'entrée public du package runtime (lecteur sans interface).
 * Le modèle de document v2 (F05), le registre de propriétés (R1), le
 * migrateur v1 → v2 (R4), et l'évaluation à l'image N (R2). Le lecteur arrive
 * avec R3.
 */
export * from './model';
export * from './properties';
export * from './migrate';
export * from './evaluate';
