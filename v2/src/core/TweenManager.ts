import { IJsTimeLineContext } from '../IJsTimeLineContext';
import { ILayer, ITween } from '../data/ITimeLineData';

/**
 * TweenManager
 * Manages tween/interpolation operations
 */
export class TweenManager {
  private context: IJsTimeLineContext;

  constructor(context: IJsTimeLineContext) {
    this.context = context;
  }

  /**
   * Create a motion tween between two keyframes
   * Emits onTweenAdd event
   * @param layerId ID of the layer
   * @param startFrame Start frame number
   * @param endFrame End frame number
   * @param type Tween type (linear, ease, etc.)
   * @returns true if created successfully, false if error or overlap
   */
  public createMotionTween(layerId: string, startFrame: number, endFrame: number, type: string = 'linear'): boolean {
    const layer = this.findLayer(layerId);
    if (!layer) {
      console.error(`Layer ${layerId} not found`);
      return false;
    }

    // Validate that both frames are keyframes
    if (!layer.keyframes) {
      console.error('Layer has no keyframes');
      return false;
    }

    const hasStartKeyframe = layer.keyframes.some(kf => kf.frame === startFrame);
    const hasEndKeyframe = layer.keyframes.some(kf => kf.frame === endFrame);

    if (!hasStartKeyframe || !hasEndKeyframe) {
      console.error('Both start and end must be keyframes');
      return false;
    }

    if (startFrame >= endFrame) {
      console.error('Start frame must be before end frame');
      return false;
    }

    // Check for overlapping tweens
    if (layer.tweens) {
      const overlapping = layer.tweens.some(tw => {
        return (startFrame >= tw.startFrame && startFrame <= tw.endFrame) ||
               (endFrame >= tw.startFrame && endFrame <= tw.endFrame) ||
               (startFrame <= tw.startFrame && endFrame >= tw.endFrame);
      });

      if (overlapping) {
        console.warn('Tween overlaps with existing tween');
        return false;
      }
    }

    // Create new tween
    const newTween: ITween = {
      startFrame,
      endFrame,
      type
    };

    // Add to tweens array
    if (!layer.tweens) {
      layer.tweens = [];
    }
    layer.tweens.push(newTween);

    // Sort tweens by start frame
    layer.tweens.sort((a, b) => a.startFrame - b.startFrame);

    // Emit onTweenAdd event (spec-compliant)
    this.context.Core.eventManager.emit('onTweenAdd', {
      layerId,
      startFrame,
      endFrame,
      type: 'motion'
    });

    // Also emit legacy event for backward compatibility
    this.context.Core.eventManager.emit('tween:added', { layerId, startFrame, endFrame, type });

    // Trigger UI re-render
    this.refreshUI();

    console.log(`Created motion tween from frame ${startFrame} to ${endFrame}`);
    return true;
  }

  /**
   * Remove a tween from a layer
   * Emits onTweenRemove event
   * @param layerId ID of the layer
   * @param startFrame Start frame of the tween to remove
   * @param endFrame End frame of the tween to remove
   * @returns true if removed successfully, false if not found
   */
  public removeTween(layerId: string, startFrame: number, endFrame: number): boolean {
    const layer = this.findLayer(layerId);
    if (!layer || !layer.tweens) {
      console.error('Layer or tweens not found');
      return false;
    }

    // Find and remove the tween
    const initialLength = layer.tweens.length;
    layer.tweens = layer.tweens.filter(tw => !(tw.startFrame === startFrame && tw.endFrame === endFrame));

    if (layer.tweens.length === initialLength) {
      console.warn('Tween not found');
      return false;
    }

    // Emit onTweenRemove event (spec-compliant)
    this.context.Core.eventManager.emit('onTweenRemove', {
      layerId,
      startFrame,
      endFrame
    });

    // Also emit legacy event for backward compatibility
    this.context.Core.eventManager.emit('tween:removed', { layerId, startFrame, endFrame });

    // Trigger UI re-render
    this.refreshUI();

    console.log(`Removed tween from frame ${startFrame} to ${endFrame}`);
    return true;
  }

  /**
   * Get tween at a specific frame
   * @param layerId ID of the layer
   * @param frame Frame number
   * @returns Tween if found, null otherwise
   */
  public getTweenAtFrame(layerId: string, frame: number): ITween | null {
    const layer = this.findLayer(layerId);
    if (!layer || !layer.tweens) {
      return null;
    }

    const tween = layer.tweens.find(tw => frame > tw.startFrame && frame <= tw.endFrame);
    return tween || null;
  }

  /**
   * Check if a frame is within a tween
   * @param layerId ID of the layer
   * @param frame Frame number
   * @returns True if frame is part of a tween
   */
  public isFrameInTween(layerId: string, frame: number): boolean {
    return this.getTweenAtFrame(layerId, frame) !== null;
  }

  /**
   * Find a layer by ID recursively
   * @param layerId ID of the layer to find
   */
  private findLayer(layerId: string): ILayer | null {
    const data = this.context.Data.getData();
    return this.findLayerRecursive(data.layers, layerId);
  }

  /**
   * Recursive helper to find a layer
   */
  private findLayerRecursive(layers: readonly ILayer[], layerId: string): ILayer | null {
    for (const layer of layers) {
      if (layer.id === layerId) {
        return layer as ILayer;
      }
      if (layer.children) {
        const found = this.findLayerRecursive(layer.children, layerId);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  /**
   * Refresh UI components
   */
  private refreshUI(): void {
    if (this.context.UI.timelineGrid) {
      this.context.UI.timelineGrid.render();
    }
  }
}
