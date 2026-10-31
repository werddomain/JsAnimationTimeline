// packages/runtime/src/index.ts
/**
 * Point d'entrée public du package runtime (lecteur sans interface).
 * Le modèle de document v2 (F05), le registre de propriétés (R1), le
 * migrateur v1 → v2 (R4), l'évaluation à l'image N (R2) et le lecteur Web
 * Animations (R3), son transport sans DOM et l'horloge manuelle (R6), les
 * scènes (`IStage`, routage, cycle de vie, scène HTML) (R7).
 */
export * from './model';
export * from './properties';
export * from './migrate';
export * from './evaluate';
export * from './player';
export * from './transport';
export * from './stage';
export * from './playback';
export * from './playback/html';
