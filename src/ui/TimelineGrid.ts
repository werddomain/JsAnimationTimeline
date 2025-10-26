/**
 * Timeline Grid UI Component for JsAnimationTimeline
 * Manages the main grid area with frames and keyframes
 * Following the Project Development Guidelines
 */

import { IJsTimeLineContext } from '../interfaces/IJsTimeLineContext';
import { ILayer } from '../data/TimelineData';

/**
 * Timeline Grid class that manages the main timeline grid UI
 */
export class TimelineGrid {
  private _element: HTMLElement;
  private _context: IJsTimeLineContext | null = null;

  constructor() {
    this._element = this._createElement();
  }

  /**
   * Initialize the timeline grid with context
   */
  public initialize(context: IJsTimeLineContext): void {
    this._context = context;
    this._setupEventListeners();
    this._registerScrollElement();
    this._renderGrid();
  }

  /**
   * Get the DOM element
   */
  public getElement(): HTMLElement {
    return this._element;
  }

  /**
   * Dispose of the component
   */
  public dispose(): void {
    if (this._context) {
      this._context.Services.scrollManager.unregisterScrollElement('timeline-grid');
    }
    this._context = null;
  }

  /**
   * Register scroll element with scroll manager
   */
  private _registerScrollElement(): void {
    if (!this._context) return;

    const gridContent = this._element.querySelector('[data-js-grid-content]') as HTMLElement;
    if (gridContent) {
      // Make the grid content scrollable
      gridContent.style.overflow = 'auto';
      gridContent.style.maxHeight = '100%';
      gridContent.style.maxWidth = '100%';
      
      // Register with scroll manager
      this._context.Services.scrollManager.registerScrollElement('timeline-grid', gridContent);
    }
  }

  /**
   * Create the DOM structure
   */
  private _createElement(): HTMLElement {
    const element = document.createElement('div');
    element.className = 'timeline-grid';
    
    element.innerHTML = `
      <div class="timeline-grid-content" data-js-grid-content>
        <div class="timeline-grid-rows" data-js-grid-rows>
          <!-- Timeline grid rows will be rendered here -->
        </div>
      </div>
    `;
    
    return element;
  }

  /**
   * Setup event listeners
   */
  private _setupEventListeners(): void {
    if (!this._context) return;

    // Listen for data changes to re-render grid
    this._context.Core.eventManager.on('data:layers-changed', () => {
      this._renderGrid();
    });

    // Listen for frame changes to update playhead line
    this._context.Core.eventManager.on('state:change:currentFrame', () => {
      this._updatePlayheadLine();
    });
  }

  /**
   * Render the timeline grid
   */
  private _renderGrid(): void {
    if (!this._context) return;

    const gridRows = this._element.querySelector('[data-js-grid-rows]') as HTMLElement;
    if (!gridRows) return;

    const layers = this._context.Data.getLayers();
    const totalFrames = this._context.Config.totalFrames;
    const frameWidth = this._context.Config.timeScale;

    gridRows.innerHTML = '';

    if (layers.length === 0) {
      // Show placeholder when no layers
      const placeholder = document.createElement('div');
      placeholder.className = 'grid-placeholder';
      placeholder.textContent = 'Add a layer to start creating your timeline';
      gridRows.appendChild(placeholder);
      return;
    }

    layers.forEach((layer: ILayer) => {
      const row = document.createElement('div');
      row.className = `timeline-grid-row ${layer.isSelected ? 'selected' : ''} ${layer.isLocked ? 'locked' : ''} ${!layer.isVisible ? 'hidden' : ''}`;
      row.dataset.layerId = layer.id;
      
      // Create frame cells for this layer
      for (let frame = 1; frame <= totalFrames; frame++) {
        const cell = document.createElement('div');
        cell.className = 'timeline-frame-cell';
        cell.style.width = `${frameWidth}px`;
        cell.dataset.frame = frame.toString();
        cell.dataset.layerId = layer.id;
        
        // Determine frame type and render accordingly
        if (this._context) {
          const frameType = this._context.Data.getFrameType(layer.id, frame);
          cell.classList.add(`frame-${frameType}`);
          
          // Add content based on frame type
          this._renderFrameContent(cell, layer, frame, frameType);
        }
        
        row.appendChild(cell);
      }
      
      gridRows.appendChild(row);
    });

    // Update playhead line after grid render
    this._updatePlayheadLine();
  }

  /**
   * Render content for a specific frame cell
   */
  private _renderFrameContent(cell: HTMLElement, layer: ILayer, frame: number, frameType: string): void {
    switch (frameType) {
      case 'keyframe':
        const keyframe = this._getKeyframeAtFrame(layer, frame);
        if (keyframe) {
          const dot = document.createElement('div');
          dot.className = `keyframe-dot ${keyframe.type}`;
          cell.appendChild(dot);
        }
        break;
      case 'tween':
        cell.classList.add('tween-frame');
        break;
      case 'standard':
        cell.classList.add('standard-frame');
        break;
      case 'empty':
      default:
        cell.classList.add('empty-frame');
        break;
    }
  }

  /**
   * Get keyframe at specific frame for a layer
   */
  private _getKeyframeAtFrame(layer: ILayer, frame: number): any {
    if (!layer.keyframes) return null;
    return Object.values(layer.keyframes).find((kf: any) => kf.frame === frame);
  }

  /**
   * Update the playhead line position
   */
  private _updatePlayheadLine(): void {
    if (!this._context) return;

    // Remove existing playhead line
    const existingLine = this._element.querySelector('.timeline-playhead-line');
    if (existingLine) {
      existingLine.remove();
    }

    const currentFrame = this._context.Data.getCurrentFrame();
    const frameWidth = this._context.Config.timeScale;
    const x = (currentFrame - 1) * frameWidth + frameWidth / 2;

    // Create new playhead line
    const playheadLine = document.createElement('div');
    playheadLine.className = 'timeline-playhead-line';
    playheadLine.style.left = `${x}px`;
    
    const gridContent = this._element.querySelector('[data-js-grid-content]') as HTMLElement;
    if (gridContent) {
      gridContent.appendChild(playheadLine);
    }
  }
}