// packages/editor/src/index.ts
/**
 * Point d'entrée public du package editor.
 * Pendant la migration v2, il réexporte le contrôle actuel (legacy).
 * Les nouveaux plugins remplaceront ces exports au fil des tâches du plan.
 */
export * from './legacy/JsTimeLine';
