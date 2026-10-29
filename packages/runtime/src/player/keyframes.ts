// packages/runtime/src/player/keyframes.ts
/**
 * Les images clés Web Animations vivent désormais dans la scène HTML
 * (`stage/html/keyframes.ts`) ; ce module les réexporte pour les imports existants.
 */

export { buildLayerKeyframes, frameToOffset } from '../stage/html/keyframes';
