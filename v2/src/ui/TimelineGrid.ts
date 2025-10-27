import { IJsTimeLineContext } from '../IJsTimeLineContext';
import { ILayer, IKeyframe, ITween } from '../data/ITimeLineData';

/**
 * TimelineGrid Component
 * Renders the main timeline grid with frames, keyframes, and tweens for each layer
 */
export class TimelineGrid {
  private context: IJsTimeLineContext;
  private gridContent: HTMLElement;

  constructor(context: IJsTimeLineContext) {
    this.context = context;
    this.gridContent = context.UI.gridContent;
  }

  /**
   * Main render method - clears and rebuilds the entire grid
   */
  public render(): void {
    // Clear existing content
    this.gridContent.innerHTML = '';

    // Get data from context
    const data = this.context.Data.getData();
    if (!data) {
      console.warn('No timeline data available to render');
      return;
    }

    const { settings, layers } = data;
    const totalFrames = settings.totalFrames;
    const frameWidth = settings.frameWidth ?? 15;
    const rowHeight = settings.rowHeight ?? 30;

    // Set grid content dimensions based on total frames and layers
    const totalRows = this.countLayers(layers);
    const gridWidth = totalFrames * frameWidth;
    const gridHeight = totalRows * rowHeight;

    this.gridContent.style.width = `${gridWidth}px`;
    this.gridContent.style.height = `${gridHeight}px`;

    // Remove temporary test background
    this.gridContent.style.background = 'none';

    // Render all layers recursively
    let rowIndex = 0;
    this.renderLayers(layers, 0, rowIndex, totalFrames, frameWidth, rowHeight);
  }

  /**
   * Count total number of layers (including nested layers in folders)
   */
  private countLayers(layers: readonly ILayer[]): number {
    let count = 0;
    for (const layer of layers) {
      count++;
      if (layer.type === 'folder' && layer.children) {
        count += this.countLayers(layer.children);
      }
    }
    return count;
  }

  /**
   * Render layers recursively, handling both regular layers and folders
   */
  private renderLayers(layers: readonly ILayer[], depth: number, startRow: number, totalFrames: number, frameWidth: number, rowHeight: number): number {
    let currentRow = startRow;

    for (const layer of layers) {
      // Create row container for this layer
      this.renderLayerRow(layer, currentRow, totalFrames, frameWidth, rowHeight);
      currentRow++;

      // If this is a folder, recursively render children
      if (layer.type === 'folder' && layer.children) {
        currentRow = this.renderLayers(layer.children, depth + 1, currentRow, totalFrames, frameWidth, rowHeight);
      }
    }

    return currentRow;
  }

  /**
   * Render a single layer row with all its frames
   */
  private renderLayerRow(layer: ILayer, rowIndex: number, totalFrames: number, frameWidth: number, rowHeight: number): void {
    // Create row container
    const rowElement = document.createElement('div');
    rowElement.className = 'grid-row';
    rowElement.style.position = 'absolute';
    rowElement.style.left = '0';
    rowElement.style.top = `${rowIndex * rowHeight}px`;
    rowElement.style.width = `${totalFrames * frameWidth}px`;
    rowElement.style.height = `${rowHeight}px`;
    rowElement.dataset.layerId = layer.id;

    // For folders, just render empty frames
    if (layer.type === 'folder') {
      this.renderEmptyFrames(rowElement, totalFrames, frameWidth, rowHeight);
      this.gridContent.appendChild(rowElement);
      return;
    }

    // For regular layers, render frames based on keyframes and tweens
    this.renderFrames(rowElement, layer, frameWidth, rowHeight, totalFrames);
    this.gridContent.appendChild(rowElement);
  }

  /**
   * Render empty frames for folder rows
   */
  private renderEmptyFrames(container: HTMLElement, totalFrames: number, frameWidth: number, rowHeight: number): void {
    for (let frame = 1; frame <= totalFrames; frame++) {
      const frameElement = document.createElement('div');
      frameElement.className = 'grid-frame';
      frameElement.style.position = 'absolute';
      frameElement.style.left = `${(frame - 1) * frameWidth}px`;
      frameElement.style.top = '0';
      frameElement.style.width = `${frameWidth}px`;
      frameElement.style.height = `${rowHeight}px`;
      container.appendChild(frameElement);
    }
  }

  /**
   * Render frames for a regular layer, determining frame type contextually
   */
  private renderFrames(container: HTMLElement, layer: ILayer, frameWidth: number, rowHeight: number, totalFrames: number): void {
    const keyframes = layer.keyframes || [];
    const tweens = layer.tweens || [];

    // Sort keyframes by frame number
    const sortedKeyframes = [...keyframes].sort((a, b) => a.frame - b.frame);

    // Track the last keyframe to determine standard frames
    let lastKeyframe: IKeyframe | null = null;

    for (let frame = 1; frame <= totalFrames; frame++) {
      // Check if this frame is a keyframe
      const keyframe = sortedKeyframes.find(kf => kf.frame === frame);
      
      if (keyframe) {
        // This is a keyframe
        const isEmpty = keyframe.isEmpty ?? false;
        this.renderKeyframe(container, frame, isEmpty, frameWidth, rowHeight);
        lastKeyframe = keyframe;
      } else {
        // Check if this frame is part of a tween
        const tween = tweens.find(tw => frame > tw.startFrame && frame <= tw.endFrame);
        
        if (tween) {
          // This is part of a tween sequence
          this.renderTweenFrame(container, frame, tween, frameWidth, rowHeight);
        } else if (lastKeyframe && !lastKeyframe.isEmpty) {
          // This is a standard frame (content persists from last keyframe)
          this.renderStandardFrame(container, frame, frameWidth, rowHeight);
        } else {
          // This is an empty frame
          this.renderEmptyFrame(container, frame, frameWidth, rowHeight);
        }
      }
    }

    // Render tween overlays (arrows and backgrounds)
    this.renderTweens(container, tweens, frameWidth, rowHeight);
  }

  /**
   * Render a keyframe (solid or hollow circle)
   */
  private renderKeyframe(container: HTMLElement, frame: number, isEmpty: boolean, frameWidth: number, rowHeight: number): void {
    const frameElement = document.createElement('div');
    frameElement.className = isEmpty ? 'grid-keyframe-empty' : 'grid-keyframe';
    frameElement.style.position = 'absolute';
    frameElement.style.left = `${(frame - 1) * frameWidth}px`;
    frameElement.style.top = '0';
    frameElement.style.width = `${frameWidth}px`;
    frameElement.style.height = `${rowHeight}px`;
    frameElement.dataset.frame = frame.toString();
    container.appendChild(frameElement);
  }

  /**
   * Render a standard frame (content persists from previous keyframe)
   */
  private renderStandardFrame(container: HTMLElement, frame: number, frameWidth: number, rowHeight: number): void {
    const frameElement = document.createElement('div');
    frameElement.className = 'grid-frame-standard';
    frameElement.style.position = 'absolute';
    frameElement.style.left = `${(frame - 1) * frameWidth}px`;
    frameElement.style.top = '0';
    frameElement.style.width = `${frameWidth}px`;
    frameElement.style.height = `${rowHeight}px`;
    frameElement.dataset.frame = frame.toString();
    container.appendChild(frameElement);
  }

  /**
   * Render an empty frame
   */
  private renderEmptyFrame(container: HTMLElement, frame: number, frameWidth: number, rowHeight: number): void {
    const frameElement = document.createElement('div');
    frameElement.className = 'grid-frame';
    frameElement.style.position = 'absolute';
    frameElement.style.left = `${(frame - 1) * frameWidth}px`;
    frameElement.style.top = '0';
    frameElement.style.width = `${frameWidth}px`;
    frameElement.style.height = `${rowHeight}px`;
    frameElement.dataset.frame = frame.toString();
    container.appendChild(frameElement);
  }

  /**
   * Render a frame that is part of a tween sequence
   */
  private renderTweenFrame(container: HTMLElement, frame: number, tween: ITween, frameWidth: number, rowHeight: number): void {
    const frameElement = document.createElement('div');
    frameElement.className = 'grid-frame-tween';
    frameElement.style.position = 'absolute';
    frameElement.style.left = `${(frame - 1) * frameWidth}px`;
    frameElement.style.top = '0';
    frameElement.style.width = `${frameWidth}px`;
    frameElement.style.height = `${rowHeight}px`;
    frameElement.dataset.frame = frame.toString();
    container.appendChild(frameElement);
  }

  /**
   * Render tween overlays (backgrounds and arrows)
   */
  private renderTweens(container: HTMLElement, tweens: readonly ITween[], frameWidth: number, rowHeight: number): void {
    for (const tween of tweens) {
      const tweenElement = document.createElement('div');
      tweenElement.className = 'grid-tween';
      tweenElement.style.position = 'absolute';
      tweenElement.style.left = `${tween.startFrame * frameWidth}px`;
      tweenElement.style.top = '0';
      tweenElement.style.width = `${(tween.endFrame - tween.startFrame) * frameWidth}px`;
      tweenElement.style.height = `${rowHeight}px`;
      tweenElement.dataset.tweenType = tween.type ?? 'linear';
      tweenElement.dataset.startFrame = tween.startFrame.toString();
      tweenElement.dataset.endFrame = tween.endFrame.toString();
      container.appendChild(tweenElement);
    }
  }
}
