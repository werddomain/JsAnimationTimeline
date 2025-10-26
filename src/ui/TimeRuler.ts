/**
 * Time Ruler UI Component for JsAnimationTimeline
 * Manages the top panel with time ruler and playhead
 * Following the Project Development Guidelines
 */

import { IJsTimeLineContext } from '../interfaces/IJsTimeLineContext';

/**
 * Time Ruler class that manages the time ruler UI
 */
export class TimeRuler {
  private _element: HTMLElement;
  private _context: IJsTimeLineContext | null = null;
  private _playheadElement: HTMLElement | null = null;

  constructor() {
    this._element = this._createElement();
  }

  /**
   * Initialize the time ruler with context
   */
  public initialize(context: IJsTimeLineContext): void {
    this._context = context;
    this._setupEventListeners();
    this._registerScrollElement();
    this._renderFrameMarkers();
    this._updatePlayhead();
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
      this._context.Services.scrollManager.unregisterScrollElement('time-ruler');
    }
    this._context = null;
  }

  /**
   * Register scroll element with scroll manager
   */
  private _registerScrollElement(): void {
    if (!this._context) return;

    const rulerContent = this._element.querySelector('[data-js-ruler-content]') as HTMLElement;
    if (rulerContent) {
      // Make the ruler content horizontally scrollable
      rulerContent.style.overflowX = 'auto';
      rulerContent.style.overflowY = 'hidden';
      rulerContent.style.maxWidth = '100%';
      
      // Register with scroll manager
      this._context.Services.scrollManager.registerScrollElement('time-ruler', rulerContent);
    }
  }

  /**
   * Create the DOM structure
   */
  private _createElement(): HTMLElement {
    const element = document.createElement('div');
    element.className = 'timeline-ruler';
    
    element.innerHTML = `
      <div class="timeline-ruler-content" data-js-ruler-content>
        <div class="timeline-frame-markers" data-js-frame-markers></div>
        <div class="timeline-playhead" data-js-playhead></div>
      </div>
    `;
    
    return element;
  }

  /**
   * Setup event listeners
   */
  private _setupEventListeners(): void {
    if (!this._context) return;

    // Listen for current frame changes
    this._context.Core.eventManager.on('state:change:currentFrame', () => {
      this._updatePlayhead();
    });

    // Listen for ruler clicks to set playhead position
    const rulerContent = this._element.querySelector('[data-js-ruler-content]') as HTMLElement;
    if (rulerContent) {
      rulerContent.addEventListener('click', (event) => {
        this._handleRulerClick(event);
      });
    }

    // Setup playhead dragging
    this._playheadElement = this._element.querySelector('[data-js-playhead]') as HTMLElement;
    if (this._playheadElement) {
      this._setupPlayheadDragging();
    }
  }

  /**
   * Render frame markers based on current configuration
   */
  private _renderFrameMarkers(): void {
    if (!this._context) return;

    const markersContainer = this._element.querySelector('[data-js-frame-markers]') as HTMLElement;
    if (!markersContainer) return;

    const config = this._context.Config;
    const frameWidth = config.timeScale;
    const totalFrames = config.totalFrames;

    markersContainer.innerHTML = '';

    for (let frame = 1; frame <= totalFrames; frame++) {
      const x = (frame - 1) * frameWidth;
      const isMajor = frame % 5 === 1; // Major marker every 5 frames
      
      const marker = document.createElement('div');
      marker.className = `frame-marker ${isMajor ? 'major' : ''}`;
      marker.style.left = `${x}px`;
      
      if (isMajor) {
        const label = document.createElement('div');
        label.className = 'frame-label';
        label.textContent = frame.toString();
        marker.appendChild(label);
      }
      
      markersContainer.appendChild(marker);
    }
  }

  /**
   * Update playhead position
   */
  private _updatePlayhead(): void {
    if (!this._context || !this._playheadElement) return;

    const currentFrame = this._context.Data.getCurrentFrame();
    const frameWidth = this._context.Config.timeScale;
    const x = (currentFrame - 1) * frameWidth;
    
    this._playheadElement.style.left = `${x}px`;
  }

  /**
   * Handle ruler click to set playhead position
   */
  private _handleRulerClick(event: MouseEvent): void {
    if (!this._context) return;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const frameWidth = this._context.Config.timeScale;
    const frame = Math.max(1, Math.round(x / frameWidth) + 1);
    
    this._context.Core.stateManager.set('currentFrame', frame);
  }

  /**
   * Setup playhead dragging functionality
   */
  private _setupPlayheadDragging(): void {
    if (!this._playheadElement || !this._context) return;

    let isDragging = false;

    this._playheadElement.addEventListener('mousedown', (event) => {
      event.preventDefault();
      isDragging = true;
      document.body.style.cursor = 'ew-resize';
    });

    document.addEventListener('mousemove', (event) => {
      if (!isDragging || !this._context) return;

      const rulerContent = this._element.querySelector('[data-js-ruler-content]') as HTMLElement;
      const rect = rulerContent.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const frameWidth = this._context.Config.timeScale;
      const frame = Math.max(1, Math.min(this._context.Config.totalFrames, Math.round(x / frameWidth) + 1));
      
      this._context.Core.stateManager.set('currentFrame', frame);
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.cursor = '';
      }
    });
  }
}