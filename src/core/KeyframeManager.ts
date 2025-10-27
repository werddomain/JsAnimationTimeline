import { IJsTimeLineContext } from '../IJsTimeLineContext';
import { ILayer, IKeyframe } from '../data/ITimeLineData';

/**
 * KeyframeManager
 * Manages keyframe and frame operations
 */
export class KeyframeManager {
  private context: IJsTimeLineContext;

  constructor(context: IJsTimeLineContext) {
    this.context = context;
  }

  /**
   * Insert a content keyframe (F6)
   * Emits onKeyframeAdd event
   * @param layerId ID of the layer
   * @param frame Frame number where to insert
   */
  public insertKeyframe(layerId: string, frame: number): void {
    const layer = this.findLayer(layerId);
    if (!layer) {
      console.error(`Layer ${layerId} not found`);
      return;
    }

    // Check if keyframe already exists at this frame
    const existingKeyframe = layer.keyframes?.find(kf => kf.frame === frame);
    if (existingKeyframe) {
      console.warn(`Keyframe already exists at frame ${frame}`);
      return;
    }

    // Create new keyframe
    const newKeyframe: IKeyframe = {
      frame,
      isEmpty: false
    };

    // Add to keyframes array
    if (!layer.keyframes) {
      layer.keyframes = [];
    }
    layer.keyframes.push(newKeyframe);

    // Sort keyframes by frame number
    layer.keyframes.sort((a, b) => a.frame - b.frame);

    // Generate keyframe ID for event
    const keyframeId = `kf-${layerId}-${frame}`;

    // Emit onKeyframeAdd event (spec-compliant)
    this.context.Core.eventManager.emit('onKeyframeAdd', {
      id: keyframeId,
      layerId,
      frame,
      type: 'content'
    });

    // Also emit legacy event for backward compatibility
    this.context.Core.eventManager.emit('keyframe:added', { layerId, frame, isEmpty: false });

    // Trigger UI re-render
    this.refreshUI();
  }

  /**
   * Insert a blank keyframe (F7)
   * Emits onKeyframeAdd event
   * @param layerId ID of the layer
   * @param frame Frame number where to insert
   */
  public insertBlankKeyframe(layerId: string, frame: number): void {
    const layer = this.findLayer(layerId);
    if (!layer) {
      console.error(`Layer ${layerId} not found`);
      return;
    }

    // Check if keyframe already exists at this frame
    const existingKeyframe = layer.keyframes?.find(kf => kf.frame === frame);
    if (existingKeyframe) {
      console.warn(`Keyframe already exists at frame ${frame}`);
      return;
    }

    // Create new blank keyframe
    const newKeyframe: IKeyframe = {
      frame,
      isEmpty: true
    };

    // Add to keyframes array
    if (!layer.keyframes) {
      layer.keyframes = [];
    }
    layer.keyframes.push(newKeyframe);

    // Sort keyframes by frame number
    layer.keyframes.sort((a, b) => a.frame - b.frame);

    // Generate keyframe ID for event
    const keyframeId = `kf-${layerId}-${frame}`;

    // Emit onKeyframeAdd event (spec-compliant)
    this.context.Core.eventManager.emit('onKeyframeAdd', {
      id: keyframeId,
      layerId,
      frame,
      type: 'blank'
    });

    // Also emit legacy event for backward compatibility
    this.context.Core.eventManager.emit('keyframe:added', { layerId, frame, isEmpty: true });

    // Trigger UI re-render
    this.refreshUI();
  }

  /**
   * Insert a frame (F5) - extends frame sequence
   * @param layerId ID of the layer
   * @param frame Frame number where to insert
   */
  public insertFrame(layerId: string, frame: number): void {
    const layer = this.findLayer(layerId);
    if (!layer) {
      console.error(`Layer ${layerId} not found`);
      return;
    }

    // Shift all keyframes and tweens after this frame by 1
    if (layer.keyframes) {
      layer.keyframes.forEach(kf => {
        if (kf.frame >= frame) {
          kf.frame++;
        }
      });
    }

    if (layer.tweens) {
      layer.tweens.forEach(tw => {
        if (tw.startFrame >= frame) {
          tw.startFrame++;
          tw.endFrame++;
        } else if (tw.endFrame >= frame) {
          tw.endFrame++;
        }
      });
    }

    // Emit event
    this.context.Core.eventManager.emit('frame:inserted', { layerId, frame });

    // Trigger UI re-render
    this.refreshUI();
  }

  /**
   * Delete frames (Shift+F5)
   * Emits cancellable onBeforeKeyframeDelete event, then onKeyframeDelete event
   * @param layerId ID of the layer
   * @param frameStart Start frame number (inclusive)
   * @param frameEnd End frame number (inclusive)
   * @returns true if deleted, false if cancelled by listener
   */
  public deleteFrames(layerId: string, frameStart: number, frameEnd: number): boolean {
    const layer = this.findLayer(layerId);
    if (!layer) {
      console.error(`Layer ${layerId} not found`);
      return false;
    }

    // Collect keyframe IDs that will be deleted
    const keyframesToDelete = layer.keyframes
      ?.filter(kf => kf.frame >= frameStart && kf.frame <= frameEnd)
      .map(kf => `kf-${layerId}-${kf.frame}`) || [];

    // Emit cancellable onBeforeKeyframeDelete event
    const beforeEvent = this.context.Core.eventManager.emitCancellable('onBeforeKeyframeDelete', {
      ids: keyframesToDelete
    });

    // Check if the deletion was cancelled
    if (beforeEvent.defaultPrevented) {
      console.log('Keyframe deletion cancelled by listener');
      return false;
    }

    const frameCount = frameEnd - frameStart + 1;

    // Remove keyframes in the range
    if (layer.keyframes) {
      layer.keyframes = layer.keyframes.filter(kf => kf.frame < frameStart || kf.frame > frameEnd);

      // Shift keyframes after the deleted range
      layer.keyframes.forEach(kf => {
        if (kf.frame > frameEnd) {
          kf.frame -= frameCount;
        }
      });
    }

    // Handle tweens
    if (layer.tweens) {
      layer.tweens = layer.tweens.filter(tw => {
        // Remove tweens completely within the range
        if (tw.startFrame >= frameStart && tw.endFrame <= frameEnd) {
          return false;
        }
        return true;
      });

      // Adjust remaining tweens
      layer.tweens.forEach(tw => {
        if (tw.startFrame > frameEnd) {
          tw.startFrame -= frameCount;
          tw.endFrame -= frameCount;
        } else if (tw.endFrame > frameEnd && tw.startFrame < frameStart) {
          tw.endFrame -= frameCount;
        }
      });
    }

    // Emit onKeyframeDelete event (spec-compliant)
    this.context.Core.eventManager.emit('onKeyframeDelete', {
      ids: keyframesToDelete
    });

    // Also emit legacy event for backward compatibility
    this.context.Core.eventManager.emit('frames:deleted', { layerId, frameStart, frameEnd });

    // Trigger UI re-render
    this.refreshUI();

    return true;
  }

  /**
   * Delete a specific keyframe
   * Emits cancellable onBeforeKeyframeDelete event, then onKeyframeDelete event
   * @param layerId ID of the layer
   * @param frame Frame number of the keyframe to delete
   * @returns true if deleted, false if not found or cancelled by listener
   */
  public deleteKeyframe(layerId: string, frame: number): boolean {
    const layer = this.findLayer(layerId);
    if (!layer) {
      console.error(`Layer ${layerId} not found`);
      return false;
    }

    if (!layer.keyframes) {
      return false;
    }

    // Generate keyframe ID
    const keyframeId = `kf-${layerId}-${frame}`;

    // Emit cancellable onBeforeKeyframeDelete event
    const beforeEvent = this.context.Core.eventManager.emitCancellable('onBeforeKeyframeDelete', {
      ids: [keyframeId]
    });

    // Check if the deletion was cancelled
    if (beforeEvent.defaultPrevented) {
      console.log('Keyframe deletion cancelled by listener');
      return false;
    }

    // Remove the keyframe
    layer.keyframes = layer.keyframes.filter(kf => kf.frame !== frame);

    // Emit onKeyframeDelete event (spec-compliant)
    this.context.Core.eventManager.emit('onKeyframeDelete', {
      ids: [keyframeId]
    });

    // Also emit legacy event for backward compatibility
    this.context.Core.eventManager.emit('keyframe:deleted', { layerId, frame });

    // Trigger UI re-render
    this.refreshUI();

    return true;
  }

  /**
   * Move keyframes to a new position (for drag-and-drop)
   * Emits onKeyframeMove event
   * @param frameIds Array of frame IDs (format: layerId:frameNumber)
   * @param targetLayerId Target layer ID
   * @param targetFrame Target frame number
   * @returns true if moved successfully, false if conflict or error
   */
  public moveKeyframes(frameIds: string[], targetLayerId: string, targetFrame: number): boolean {
    if (frameIds.length === 0) return false;

    // Parse first frameId to get source layer
    const [sourceLayerId, sourceFrameStr] = frameIds[0].split(':');
    const sourceFrame = parseInt(sourceFrameStr, 10);

    // Calculate offset
    const frameOffset = targetFrame - sourceFrame;
    const isLayerChange = sourceLayerId !== targetLayerId;

    // Get source and target layers
    const sourceLayer = this.findLayer(sourceLayerId);
    const targetLayer = this.findLayer(targetLayerId);

    if (!sourceLayer || !targetLayer) {
      console.error('Source or target layer not found');
      return false;
    }

    // Collect keyframes to move
    const keyframesToMove: IKeyframe[] = [];
    const moves: Array<{ id: string; newFrame: number; oldFrame: number }> = [];

    frameIds.forEach(frameId => {
      const [layerId, frameStr] = frameId.split(':');
      const frame = parseInt(frameStr, 10);
      const layer = this.findLayer(layerId);
      if (layer && layer.keyframes) {
        const kf = layer.keyframes.find(k => k.frame === frame);
        if (kf) {
          const newFrame = kf.frame + frameOffset;
          keyframesToMove.push({ ...kf, frame: newFrame });
          moves.push({
            id: `kf-${layerId}-${frame}`,
            oldFrame: frame,
            newFrame
          });
        }
      }
    });

    // Check for conflicts in target layer
    if (targetLayer.keyframes) {
      for (const kf of keyframesToMove) {
        const conflict = targetLayer.keyframes.find(existing => existing.frame === kf.frame);
        if (conflict && !frameIds.includes(`${targetLayerId}:${conflict.frame}`)) {
          console.warn('Conflict detected at target position');
          return false;
        }
      }
    }

    // Remove keyframes from source layer(s)
    frameIds.forEach(frameId => {
      const [layerId, frameStr] = frameId.split(':');
      const frame = parseInt(frameStr, 10);
      const layer = this.findLayer(layerId);
      if (layer && layer.keyframes) {
        layer.keyframes = layer.keyframes.filter(kf => kf.frame !== frame);
      }
    });

    // Add keyframes to target layer
    if (!targetLayer.keyframes) {
      targetLayer.keyframes = [];
    }
    targetLayer.keyframes.push(...keyframesToMove);
    targetLayer.keyframes.sort((a, b) => a.frame - b.frame);

    // Emit onKeyframeMove event (spec-compliant)
    this.context.Core.eventManager.emit('onKeyframeMove', {
      moves
    });

    // Also emit legacy event for backward compatibility
    this.context.Core.eventManager.emit('keyframes:moved', {
      frameIds,
      targetLayerId,
      targetFrame,
      frameOffset
    });

    // Trigger UI re-render
    this.refreshUI();

    return true;
  }

  /**
   * Copy selected keyframes to clipboard (CTRL+C)
   * @param frameIds Array of frame IDs to copy
   */
  public copyKeyframes(frameIds: string[]): void {
    if (frameIds.length === 0) {
      console.warn('No keyframes selected to copy');
      return;
    }

    // Collect keyframe data
    const keyframeData: Array<{ layerId: string; frame: number; keyframe: IKeyframe }> = [];
    frameIds.forEach(frameId => {
      const [layerId, frameStr] = frameId.split(':');
      const frame = parseInt(frameStr, 10);
      const layer = this.findLayer(layerId);
      if (layer && layer.keyframes) {
        const kf = layer.keyframes.find(k => k.frame === frame);
        if (kf) {
          keyframeData.push({ layerId, frame, keyframe: { ...kf } });
        }
      }
    });

    if (keyframeData.length === 0) {
      console.warn('No valid keyframes to copy');
      return;
    }

    // Store in StateManager
    this.context.Core.stateManager.set('clipboard_keyframes', keyframeData);

    // Emit event
    this.context.Core.eventManager.emit('keyframes:copied', { count: keyframeData.length });

    console.log(`Copied ${keyframeData.length} keyframes to clipboard`);
  }

  /**
   * Paste keyframes from clipboard (CTRL+V)
   * @param targetLayerId Target layer ID
   * @param targetFrame Target frame number
   */
  public pasteKeyframes(targetLayerId: string, targetFrame: number): void {
    const clipboardData = this.context.Core.stateManager.get('clipboard_keyframes');
    if (!clipboardData || !Array.isArray(clipboardData) || clipboardData.length === 0) {
      console.warn('No keyframes in clipboard');
      return;
    }

    const targetLayer = this.findLayer(targetLayerId);
    if (!targetLayer) {
      console.error(`Target layer ${targetLayerId} not found`);
      return;
    }

    // Find the minimum frame in clipboard to calculate offset
    const minFrame = Math.min(...clipboardData.map((item: any) => item.frame));
    const frameOffset = targetFrame - minFrame;

    // Create new keyframes with adjusted frames
    const newKeyframes: IKeyframe[] = [];
    clipboardData.forEach((item: any) => {
      const newFrame = item.frame + frameOffset;
      
      // Check for conflicts
      const conflict = targetLayer.keyframes?.find(kf => kf.frame === newFrame);
      if (!conflict) {
        newKeyframes.push({
          ...item.keyframe,
          frame: newFrame
        });
      } else {
        console.warn(`Skipping frame ${newFrame} - conflict detected`);
      }
    });

    if (newKeyframes.length === 0) {
      console.warn('All frames conflict - nothing pasted');
      return;
    }

    // Add to target layer
    if (!targetLayer.keyframes) {
      targetLayer.keyframes = [];
    }
    targetLayer.keyframes.push(...newKeyframes);
    targetLayer.keyframes.sort((a, b) => a.frame - b.frame);

    // Emit event
    this.context.Core.eventManager.emit('keyframes:pasted', {
      targetLayerId,
      targetFrame,
      count: newKeyframes.length
    });

    // Trigger UI re-render
    this.refreshUI();

    console.log(`Pasted ${newKeyframes.length} keyframes at frame ${targetFrame}`);
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
    if (this.context.UI.layerPanel) {
      this.context.UI.layerPanel.render();
    }
  }
}
