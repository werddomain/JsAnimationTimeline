// packages/runtime/src/model/document.ts
/**
 * Document timeline v2 (racine du JSON décrit par
 * `schema/timeline.schema.json`).
 */

import type { LayerNode } from './layer';

/** Version written by this package. */
export const SCHEMA_VERSION = '2.0.0';

/** Global timing settings. */
export interface ITimelineSettings {
  /** Frames per second, integer 1..240. */
  readonly fps: number;
  /** Timeline length; frames are numbered 1..totalFrames. */
  readonly totalFrames: number;
}

/** Root of a timeline document. */
export interface ITimelineDocument {
  /** Semver with major 2, e.g. `SCHEMA_VERSION`. */
  readonly version: string;
  readonly settings: ITimelineSettings;
  /** Top-level nodes, first one displayed on top. */
  readonly layers: readonly LayerNode[];
}
