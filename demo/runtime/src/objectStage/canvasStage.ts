// demo/runtime/src/objectStage/canvasStage.ts
/**
 * Scène `canvas` de la démo : un sprite dessiné dans un <canvas>. Le sprite
 * reçoit `x`, `y`, `rotation` (propriétés intégrées) et `frameIndex` (propriété
 * `value` entière, `floorInterpolator`) ; un seul dessin par image (`endFrame`).
 */

import { createObjectStage, floorInterpolator } from '@werddomain/timeline-runtime';
import type { IObjectStage } from '@werddomain/timeline-runtime';
import { CANVAS_STAGE_ID } from './document';
import { recordFrame } from './received';
import type { IReceivedFrame } from './received';

/** Number of images of the sprite sheet (colors here). */
export const SPRITE_IMAGES = 12;
const SPRITE_SIZE = 44;
const ORIGIN_X = 40;
const ORIGIN_Y = 100;

/** A sprite drawn by `drawScene`. */
export interface ISprite {
  visible: boolean;
  x: number;
  y: number;
  /** Degrees. */
  angle: number;
  frame: number;
}

/** A sprite in its initial state. */
export function createSprite(): ISprite {
  return { visible: false, x: 0, y: 0, angle: 0, frame: 0 };
}

/** Draws the sprites on `context` (one drawing per frame). */
export function drawScene(context: CanvasRenderingContext2D, sprites: readonly ISprite[]): void {
  const { width, height } = context.canvas;
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#f4f6f8';
  context.fillRect(0, ORIGIN_Y + SPRITE_SIZE / 2, width, 2);
  sprites.filter((sprite) => sprite.visible).forEach((sprite) => {
    context.save();
    context.translate(ORIGIN_X + sprite.x, ORIGIN_Y + sprite.y);
    context.rotate((sprite.angle * Math.PI) / 180);
    context.fillStyle = `hsl(${(sprite.frame % SPRITE_IMAGES) * (360 / SPRITE_IMAGES)}, 70%, 55%)`;
    context.fillRect(-SPRITE_SIZE / 2, -SPRITE_SIZE / 2, SPRITE_SIZE, SPRITE_SIZE);
    context.fillStyle = '#fff';
    context.font = 'bold 18px Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(String(sprite.frame), 0, 0);
    context.restore();
  });
}

/**
 * Creates the `canvas` stage drawing on `context`; what it receives goes to `received`.
 * The `hero` sprite is the one animated (the caller can read it).
 */
export function createCanvasStage(
  context: CanvasRenderingContext2D,
  received: IReceivedFrame[],
  hero: ISprite = createSprite()
): IObjectStage<ISprite> {
  return createObjectStage<ISprite>({
    id: CANVAS_STAGE_ID,
    properties: [
      { name: 'frameIndex', kind: 'value', unit: '', label: 'Image du sprite', defaultValue: 0, min: 0, interpolate: floorInterpolator }
    ],
    objects: [{ id: 'hero', label: 'Héros', icon: 'sprite', object: hero, properties: ['x', 'y', 'rotation', 'frameIndex'] }],
    apply(sprite, values, state) {
      sprite.visible = state.active && state.editorVisible;
      sprite.x = values.x;
      sprite.y = values.y;
      sprite.angle = values.rotation;
      sprite.frame = values.frameIndex;
    },
    reset(sprite) {
      Object.assign(sprite, createSprite());
    },
    endFrame(time, states) {
      recordFrame(received, time, states);
      drawScene(context, [hero]);
    }
  });
}
