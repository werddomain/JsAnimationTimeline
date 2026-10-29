// packages/runtime/src/migrate/v1-types.ts
/**
 * Format de document v1 (lecture seule) : celui de l'ancien contrôle
 * (`src/data/ITimeLineData.ts` sur `main`). On ne l'écrit jamais ; le
 * migrateur le convertit en v2 à la lecture.
 */

/** v1 global settings; the view fields (frameWidth, rowHeight...) are dropped by the migration. */
export interface IV1Settings {
  readonly totalFrames: number;
  readonly frameRate: number;
  readonly frameWidth?: number;
  readonly rowHeight?: number;
  readonly layerPanelWidth?: number;
  readonly rulerHeight?: number;
  readonly movePlayheadOnFrameClick?: boolean;
}

/** v1 keyframe: solid (content) or hollow (`isEmpty`, nothing shown). */
export interface IV1Keyframe {
  readonly frame: number;
  readonly isEmpty?: boolean;
}

/** v1 classic tween between the keyframes at `startFrame` and `endFrame`. */
export interface IV1Tween {
  readonly startFrame: number;
  readonly endFrame: number;
  /** Easing name, e.g. `linear`, `ease`, `ease-in`. */
  readonly type?: string;
}

/** v1 layer or folder (same shape, distinguished by `type`). */
export interface IV1Layer {
  readonly id: string;
  readonly name: string;
  readonly type: 'layer' | 'folder';
  readonly visible?: boolean;
  readonly locked?: boolean;
  readonly keyframes?: readonly IV1Keyframe[];
  readonly tweens?: readonly IV1Tween[];
  readonly children?: readonly IV1Layer[];
}

/** Root of a v1 document (`version` has major 1, e.g. `1.0.0`). */
export interface IV1TimelineDocument {
  readonly version: string;
  readonly settings: IV1Settings;
  readonly layers: readonly IV1Layer[];
}
