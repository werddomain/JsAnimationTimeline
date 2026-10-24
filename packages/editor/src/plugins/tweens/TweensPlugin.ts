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
 * - `tweens.motion` : créer et supprimer les interpolations de mouvement.
 *
 * Les tâches suivantes (W2 `tweens.propertyKeyframes`, W3 `tweens.easing`)
 * ajoutent leur plugin à `children`.
 */

import type { EditorPlugin } from '../../core/context/IEditorContext';
import { MotionTweenPlugin } from './motion/MotionTweenPlugin';

/** Epic `tweens` : interpolations de mouvement et leurs fonctionnalités. */
export class TweensPlugin implements EditorPlugin {
  readonly id = 'tweens';
  readonly dependencies: readonly string[] = [];
  readonly children: readonly EditorPlugin[];

  constructor() {
    this.children = [new MotionTweenPlugin()];
  }

  init(): void {}

  destroy(): void {}
}
