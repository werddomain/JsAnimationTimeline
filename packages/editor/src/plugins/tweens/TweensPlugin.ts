// packages/editor/src/plugins/tweens/TweensPlugin.ts
/**
 * Plugin : tweens
 * Epic : tweens
 * Dépend de : —
 * Écoute : —
 * Émet : —
 *
 * Epic des interpolations. Il ne fait rien lui-même : il regroupe ses
 * plugins de fonctionnalité, enregistrés avec lui par l'hôte (et toujours
 * initialisés après lui) :
 * - `tweens.motion`: create and remove motion tweens;
 * - `tweens.easing`: edit span easing through an undoable command.
 *
 * W2 adds the property-keyframe plugin to this epic separately.
 */

import type { EditorPlugin } from '../../core/context/IEditorContext';
import { MotionTweenPlugin } from './motion/MotionTweenPlugin';
import { EasingPlugin } from './easing/EasingPlugin';

/** Epic `tweens` : interpolations de mouvement et leurs fonctionnalités. */
export class TweensPlugin implements EditorPlugin {
  readonly id = 'tweens';
  readonly dependencies: readonly string[] = [];
  readonly children: readonly EditorPlugin[];

  constructor() {
    this.children = [new MotionTweenPlugin(), new EasingPlugin()];
  }

  init(): void {}

  destroy(): void {}
}
