// packages/editor/src/plugins/tweens/TweensPlugin.ts
/**
 * Plugin: tweens
 * Epic: tweens
 * Depends on: —
 * Listens: —
 * Emits: —
 *
 * Groups motion creation/removal, property-keyframe controls and span easing.
 * Each child owns its own commands, services and lifecycle.
 */
import type { EditorPlugin } from '../../core/context/IEditorContext';
import { MotionTweenPlugin } from './motion/MotionTweenPlugin';
import { PropertyKeyframesPlugin } from './propertyKeyframes/PropertyKeyframesPlugin';
import { EasingPlugin } from './easing/EasingPlugin';

/** Registers all tween features after the epic itself. */
export class TweensPlugin implements EditorPlugin {
  readonly id = 'tweens';
  readonly dependencies: readonly string[] = [];
  readonly children: readonly EditorPlugin[];

  constructor() {
    this.children = [new MotionTweenPlugin(), new PropertyKeyframesPlugin(), new EasingPlugin()];
  }

  init(): void {}

  destroy(): void {}
}
