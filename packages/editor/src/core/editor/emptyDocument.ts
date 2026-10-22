// packages/editor/src/core/editor/emptyDocument.ts
/**
 * Document v2 vide utilisé par `createEditor()` quand aucune donnée n'est
 * fournie : aucune couche, 24 images par seconde, 60 images.
 */

import { SCHEMA_VERSION } from '@werddomain/timeline-runtime';
import type { ITimelineDocument } from '@werddomain/timeline-runtime';

/** Cadence d'un document vide (même valeur que la cadence par défaut du migrateur v1). */
export const DEFAULT_FPS = 24;

/** Durée d'un document vide, en images. */
export const DEFAULT_TOTAL_FRAMES = 60;

/** Crée un document v2 vide et figé. */
export function createEmptyDocument(): ITimelineDocument {
  return Object.freeze<ITimelineDocument>({
    version: SCHEMA_VERSION,
    settings: Object.freeze({ fps: DEFAULT_FPS, totalFrames: DEFAULT_TOTAL_FRAMES }),
    layers: Object.freeze([])
  });
}
