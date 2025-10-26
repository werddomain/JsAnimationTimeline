/**
 * Scroll Manager for JsAnimationTimeline
 * Handles synchronized scrolling between timeline panels
 * Following the Project Development Guidelines
 */

import { EventManager } from '../core/EventManager';
import { StateManager } from '../core/StateManager';

/**
 * Scroll state interface
 */
export interface IScrollState {
  /** Horizontal scroll position */
  scrollX: number;
  /** Vertical scroll position */
  scrollY: number;
  /** Which panel initiated the scroll */
  source: 'timeline-grid' | 'time-ruler' | 'layers-panel' | 'programmatic';
}

/**
 * Scroll Manager class that handles synchronized scrolling
 */
export class ScrollManager {
  private _eventManager: EventManager;
  private _stateManager: StateManager;
  private _scrollElements: Map<string, HTMLElement> = new Map();
  private _isUpdating: boolean = false;

  constructor(eventManager: EventManager, stateManager: StateManager) {
    this._eventManager = eventManager;
    this._stateManager = stateManager;
    
    this._setupEventListeners();
    this._initializeState();
  }

  /**
   * Initialize the scroll state
   */
  private _initializeState(): void {
    this._stateManager.registerProperty('scrollState', {
      defaultValue: { scrollX: 0, scrollY: 0, source: 'programmatic' },
      notify: true
    });
  }

  /**
   * Setup event listeners
   */
  private _setupEventListeners(): void {
    // Listen for scroll state changes
    this._stateManager.watch('scrollState', (change) => {
      if (!this._isUpdating) {
        this._syncScrollPositions(change.newValue);
      }
    });

    // Listen for scroll sync requests
    this._eventManager.on('scroll:sync-request', (data: { scrollX?: number, scrollY?: number, source: string }) => {
      this.updateScrollPosition(data.scrollX, data.scrollY, data.source as any);
    });
  }

  /**
   * Register a scrollable element
   */
  public registerScrollElement(name: string, element: HTMLElement): void {
    this._scrollElements.set(name, element);
    this._attachScrollListener(name, element);
  }

  /**
   * Unregister a scrollable element
   */
  public unregisterScrollElement(name: string): void {
    const element = this._scrollElements.get(name);
    if (element) {
      this._detachScrollListener(name, element);
      this._scrollElements.delete(name);
    }
  }

  /**
   * Update scroll position programmatically
   */
  public updateScrollPosition(scrollX?: number, scrollY?: number, source: IScrollState['source'] = 'programmatic'): void {
    const currentState = this._stateManager.get<IScrollState>('scrollState');
    
    const newState: IScrollState = {
      scrollX: scrollX !== undefined ? scrollX : currentState.scrollX,
      scrollY: scrollY !== undefined ? scrollY : currentState.scrollY,
      source
    };

    this._stateManager.set('scrollState', newState);
  }

  /**
   * Get current scroll position
   */
  public getScrollPosition(): IScrollState {
    return this._stateManager.get<IScrollState>('scrollState');
  }

  /**
   * Attach scroll listener to an element
   */
  private _attachScrollListener(name: string, element: HTMLElement): void {
    const listener = this._createScrollListener(name);
    element.addEventListener('scroll', listener);
    element.dataset.scrollListenerName = name;
  }

  /**
   * Detach scroll listener from an element
   */
  private _detachScrollListener(name: string, element: HTMLElement): void {
    // Note: In a real implementation, we'd need to store the listener reference
    // For now, we'll rely on element removal to clean up listeners
    element.removeAttribute('data-scroll-listener-name');
  }

  /**
   * Create scroll listener for an element
   */
  private _createScrollListener(elementName: string) {
    return (e: Event) => {
      if (this._isUpdating) return;

      const element = e.target as HTMLElement;
      const scrollX = element.scrollLeft;
      const scrollY = element.scrollTop;

      // Determine source based on element name
      let source: IScrollState['source'] = 'programmatic';
      if (elementName.includes('timeline-grid')) {
        source = 'timeline-grid';
      } else if (elementName.includes('time-ruler')) {
        source = 'time-ruler';
      } else if (elementName.includes('layers-panel')) {
        source = 'layers-panel';
      }

      this.updateScrollPosition(scrollX, scrollY, source);
    };
  }

  /**
   * Synchronize scroll positions across all registered elements
   */
  private _syncScrollPositions(scrollState: IScrollState): void {
    this._isUpdating = true;

    for (const [name, element] of this._scrollElements) {
      // Determine which scroll axes to sync based on element type
      const shouldSyncX = this._shouldSyncHorizontal(name, scrollState.source);
      const shouldSyncY = this._shouldSyncVertical(name, scrollState.source);

      if (shouldSyncX && element.scrollLeft !== scrollState.scrollX) {
        element.scrollLeft = scrollState.scrollX;
      }

      if (shouldSyncY && element.scrollTop !== scrollState.scrollY) {
        element.scrollTop = scrollState.scrollY;
      }
    }

    // Emit sync event for other components that might need to react
    this._eventManager.emit('scroll:synced', scrollState);

    this._isUpdating = false;
  }

  /**
   * Determine if horizontal scrolling should be synced for an element
   */
  private _shouldSyncHorizontal(elementName: string, source: IScrollState['source']): boolean {
    // Only timeline grid and time ruler should sync horizontally
    if ((elementName.includes('timeline-grid') || elementName.includes('time-ruler')) &&
        (source === 'timeline-grid' || source === 'time-ruler' || source === 'programmatic')) {
      return true;
    }
    
    return false;
  }

  /**
   * Determine if vertical scrolling should be synced for an element
   */
  private _shouldSyncVertical(elementName: string, source: IScrollState['source']): boolean {
    // No vertical syncing - each panel scrolls independently
    return false;
  }

  /**
   * Scroll to a specific frame (horizontal scroll)
   */
  public scrollToFrame(frame: number, frameWidth: number): void {
    const scrollX = (frame - 1) * frameWidth;
    this.updateScrollPosition(scrollX, undefined, 'programmatic');
  }

  /**
   * Scroll to a specific layer (vertical scroll)
   */
  public scrollToLayer(layerIndex: number, layerHeight: number): void {
    const scrollY = layerIndex * layerHeight;
    this.updateScrollPosition(undefined, scrollY, 'programmatic');
  }

  /**
   * Center view on a specific frame and layer
   */
  public centerView(frame: number, layerIndex: number, frameWidth: number, layerHeight: number, viewportWidth: number, viewportHeight: number): void {
    const scrollX = Math.max(0, (frame - 1) * frameWidth - viewportWidth / 2);
    const scrollY = Math.max(0, layerIndex * layerHeight - viewportHeight / 2);
    
    this.updateScrollPosition(scrollX, scrollY, 'programmatic');
  }

  /**
   * Get debug information
   */
  public getDebugInfo(): {
    registeredElements: string[];
    currentScrollState: IScrollState;
    isUpdating: boolean;
  } {
    return {
      registeredElements: Array.from(this._scrollElements.keys()),
      currentScrollState: this.getScrollPosition(),
      isUpdating: this._isUpdating
    };
  }

  /**
   * Dispose of the scroll manager
   */
  public dispose(): void {
    // Clean up all registered elements
    for (const [name, element] of this._scrollElements) {
      this._detachScrollListener(name, element);
    }
    this._scrollElements.clear();
  }
}