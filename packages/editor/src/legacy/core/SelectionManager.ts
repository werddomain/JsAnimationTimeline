import { IJsTimeLineContext } from '../IJsTimeLineContext';

/**
 * SelectionManager
 * Manages selection of frames and keyframes in the timeline
 */
export class SelectionManager {
  private context: IJsTimeLineContext;
  private selectedFrames: Set<string> = new Set();
  private lastSelectedFrame: string | null = null;

  constructor(context: IJsTimeLineContext) {
    this.context = context;
  }

  /**
   * Select a single frame, clearing previous selection
   * @param frameId Unique identifier for the frame (layerId:frameNumber)
   */
  public selectFrame(frameId: string): void {
    this.clearSelection();
    this.selectedFrames.add(frameId);
    this.lastSelectedFrame = frameId;
    this.emitSelectionChange();
  }

  /**
   * Deselect a specific frame
   * @param frameId Unique identifier for the frame
   */
  public deselectFrame(frameId: string): void {
    this.selectedFrames.delete(frameId);
    if (this.lastSelectedFrame === frameId) {
      this.lastSelectedFrame = null;
    }
    this.emitSelectionChange();
  }

  /**
   * Clear all selections
   */
  public clearSelection(): void {
    this.selectedFrames.clear();
    this.lastSelectedFrame = null;
    this.emitSelectionChange();
  }

  /**
   * Toggle selection of a frame (for CTRL+click)
   * @param frameId Unique identifier for the frame
   */
  public toggleSelection(frameId: string): void {
    if (this.selectedFrames.has(frameId)) {
      this.deselectFrame(frameId);
    } else {
      this.selectedFrames.add(frameId);
      this.lastSelectedFrame = frameId;
      this.emitSelectionChange();
    }
  }

  /**
   * Select a range of frames (for Shift+click)
   * @param startFrameId Start of range
   * @param endFrameId End of range
   */
  public selectRange(startFrameId: string, endFrameId: string): void {
    // Parse frame IDs (format: layerId:frameNumber)
    const [startLayerId, startFrameStr] = startFrameId.split(':');
    const [endLayerId, endFrameStr] = endFrameId.split(':');

    // Only select range if on same layer
    if (startLayerId !== endLayerId) {
      console.warn('Range selection only works on the same layer');
      return;
    }

    const startFrame = parseInt(startFrameStr, 10);
    const endFrame = parseInt(endFrameStr, 10);
    const minFrame = Math.min(startFrame, endFrame);
    const maxFrame = Math.max(startFrame, endFrame);

    // Add all frames in range
    for (let i = minFrame; i <= maxFrame; i++) {
      this.selectedFrames.add(`${startLayerId}:${i}`);
    }

    this.lastSelectedFrame = endFrameId;
    this.emitSelectionChange();
  }

  /**
   * Get all selected frame IDs
   */
  public getSelectedFrames(): string[] {
    return Array.from(this.selectedFrames);
  }

  /**
   * Check if a frame is selected
   * @param frameId Unique identifier for the frame
   */
  public isSelected(frameId: string): boolean {
    return this.selectedFrames.has(frameId);
  }

  /**
   * Get the last selected frame ID
   */
  public getLastSelectedFrame(): string | null {
    return this.lastSelectedFrame;
  }

  /**
   * Get count of selected frames
   */
  public getSelectionCount(): number {
    return this.selectedFrames.size;
  }

  /**
   * Emit selection change event
   * Emits onKeyframeSelect event (spec-compliant) and legacy selection:changed event
   */
  private emitSelectionChange(): void {
    const selectedFrames = this.getSelectedFrames();

    // Convert frame IDs to keyframe IDs for spec-compliant event
    const selectedIds = selectedFrames.map(frameId => {
      const [layerId, frame] = frameId.split(':');
      return `kf-${layerId}-${frame}`;
    });

    // Emit onKeyframeSelect event (spec-compliant)
    this.context.Core.eventManager.emit('onKeyframeSelect', {
      selectedIds
    });

    // Also emit legacy event for backward compatibility
    this.context.Core.eventManager.emit('selection:changed', {
      selectedFrames,
      count: this.getSelectionCount()
    });
  }
}
