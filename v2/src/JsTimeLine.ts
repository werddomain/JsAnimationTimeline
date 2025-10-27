// Import the styles directly
import './styles/JsTimeLine.less';
import { IJsTimeLineContext } from './IJsTimeLineContext';
import { TimeLineData } from './data/TimeLineData';
import { EventManager } from './core/EventManager';
import { StateManager } from './core/StateManager';
import { PlaybackEngine } from './core/PlaybackEngine';
import { LayerManager } from './core/LayerManager';
import { SelectionManager } from './core/SelectionManager';
import { KeyframeManager } from './core/KeyframeManager';
import { TweenManager } from './core/TweenManager';
import { LayerPanel } from './ui/LayerPanel';
import { TimeRuler } from './ui/TimeRuler';
import { TimelineGrid } from './ui/TimelineGrid';
import { ContextMenu } from './ui/ContextMenu';
import { TweenPropertiesDialog } from './ui/TweenPropertiesDialog';
import { ITimeLineData } from './data/ITimeLineData';
import { debounce } from './utils/Performance';

export class JsTimeLine {
  private container: HTMLElement;
  private _context!: IJsTimeLineContext;
  private playPauseBtn!: HTMLButtonElement;
  private stopBtn!: HTMLButtonElement;
  private frameDisplay!: HTMLDivElement;

  constructor(elementId: string) {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with id '${elementId}' not found.`);
    }
    this.container = element;
    this.container.classList.add('JsTimeLine');
    
    // Build the three-part DOM structure
    this.buildLayout();

    // Initialize the context
    this.initializeContext();

    // Load test data and render
    this.loadTestData();

    console.log('JsTimeLine control instantiated.');
  }

  private buildLayout(): void {
    // Clear existing content
    this.container.innerHTML = '';

    // Create main layout grid
    const layoutGrid = document.createElement('div');
    layoutGrid.className = 'timeline-layout-grid';

    // Top-left empty corner
    const corner = document.createElement('div');
    corner.className = 'timeline-corner';

    // Add playback controls in the corner
    const controls = document.createElement('div');
    controls.className = 'timeline-controls';
    
    const playPauseBtn = document.createElement('button');
    playPauseBtn.className = 'timeline-control-btn timeline-btn-play';
    playPauseBtn.innerHTML = '▶';
    playPauseBtn.title = 'Play';
    this.playPauseBtn = playPauseBtn;
    
    const stopBtn = document.createElement('button');
    stopBtn.className = 'timeline-control-btn timeline-btn-stop';
    stopBtn.innerHTML = '■';
    stopBtn.title = 'Stop';
    this.stopBtn = stopBtn;
    
    const frameDisplay = document.createElement('div');
    frameDisplay.className = 'timeline-frame-display';
    frameDisplay.textContent = '1';
    this.frameDisplay = frameDisplay;
    
    controls.appendChild(playPauseBtn);
    controls.appendChild(stopBtn);
    controls.appendChild(frameDisplay);
    corner.appendChild(controls);

    // Top: Time Ruler (fixed height, scrolls horizontally)
    const rulerContainer = document.createElement('div');
    rulerContainer.className = 'timeline-ruler';
    
    const rulerContent = document.createElement('div');
    rulerContent.className = 'timeline-ruler-content';
    
    rulerContainer.appendChild(rulerContent);

    // Left: Layer Panel (fixed width, scrolls vertically)
    const layerPanelContainer = document.createElement('div');
    layerPanelContainer.className = 'timeline-layer-panel';
    
    const layerPanelContent = document.createElement('div');
    layerPanelContent.className = 'timeline-layer-content';
    
    layerPanelContainer.appendChild(layerPanelContent);

    // Main: Timeline Grid (scrolls in both directions)
    const gridContainer = document.createElement('div');
    gridContainer.className = 'timeline-grid-container';
    
    const gridContent = document.createElement('div');
    gridContent.className = 'timeline-grid-content';
    
    // Playhead spans across ruler and grid
    const playhead = document.createElement('div');
    playhead.className = 'timeline-playhead';
    
    gridContainer.appendChild(gridContent);
    gridContainer.appendChild(playhead);

    // Assemble the layout
    layoutGrid.appendChild(corner);
    layoutGrid.appendChild(rulerContainer);
    layoutGrid.appendChild(layerPanelContainer);
    layoutGrid.appendChild(gridContainer);

    this.container.appendChild(layoutGrid);

    // Initialize temporary context for UI references
    this._context = {
      UI: {
        root: this.container,
        layoutGrid,
        corner,
        rulerContainer,
        rulerContent,
        playhead,
        layerPanelContainer,
        layerPanelContent,
        gridContainer,
        gridContent
      },
      Core: {
        eventManager: null as any,
        stateManager: null as any
      },
      Data: null as any,
      Plugins: {}
    };
  }

  private initializeContext(): void {
    // Instantiate core services
    const eventManager = new EventManager();
    const stateManager = new StateManager();
    const timeLineData = new TimeLineData();

    // Update context with core services
    this._context.Core.eventManager = eventManager;
    this._context.Core.stateManager = stateManager;
    this._context.Data = timeLineData;

    // Instantiate UI components
    const layerPanel = new LayerPanel(this._context);
    this._context.UI.layerPanel = layerPanel;

    const timeRuler = new TimeRuler(this._context);
    this._context.UI.timeRuler = timeRuler;

    const timelineGrid = new TimelineGrid(this._context);
    this._context.UI.timelineGrid = timelineGrid;

    const contextMenu = new ContextMenu();
    this._context.UI.contextMenu = contextMenu;

    const tweenPropertiesDialog = new TweenPropertiesDialog(this._context);
    this._context.UI.tweenPropertiesDialog = tweenPropertiesDialog;

    // Instantiate PlaybackEngine
    const playbackEngine = new PlaybackEngine(this._context);
    this._context.Core.playbackEngine = playbackEngine;

    // Instantiate LayerManager
    const layerManager = new LayerManager(this._context);
    this._context.Core.layerManager = layerManager;

    // Instantiate SelectionManager
    const selectionManager = new SelectionManager(this._context);
    this._context.Core.selectionManager = selectionManager;

    // Instantiate KeyframeManager
    const keyframeManager = new KeyframeManager(this._context);
    this._context.Core.keyframeManager = keyframeManager;

    // Instantiate TweenManager
    const tweenManager = new TweenManager(this._context);
    this._context.Core.tweenManager = tweenManager;

    // Setup scroll synchronization
    this.setupScrollSync();

    // Setup playback controls
    this.setupPlaybackControls();

    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();

    console.log('Context initialized');
  }

  /**
   * Setup scroll synchronization between grid, ruler, and layer panel
   * Uses RAF for smooth 60fps scrolling performance
   */
  private setupScrollSync(): void {
    const gridContainer = this._context.UI.gridContainer;
    const rulerContent = this._context.UI.rulerContent;
    const layerPanelContent = this._context.UI.layerPanelContent;

    let rafId: number | null = null;
    let lastScrollLeft = 0;
    let lastScrollTop = 0;

    // Use RAF for smooth scroll synchronization
    const syncScroll = () => {
      const scrollLeft = gridContainer.scrollLeft;
      const scrollTop = gridContainer.scrollTop;

      // Only update if scroll position changed
      if (scrollLeft !== lastScrollLeft || scrollTop !== lastScrollTop) {
        // Use CSS transforms for better performance (GPU accelerated)
        rulerContent.style.transform = `translateX(-${scrollLeft}px)`;
        layerPanelContent.style.transform = `translateY(-${scrollTop}px)`;

        lastScrollLeft = scrollLeft;
        lastScrollTop = scrollTop;

        // Debounced event emission (less frequent for event handlers)
        debouncedEmitScroll(scrollLeft, scrollTop);
      }

      rafId = null;
    };

    // Debounce scroll event emission to reduce event spam
    const debouncedEmitScroll = debounce((scrollLeft: number, scrollTop: number) => {
      this._context.Core.eventManager.emit('timeline:scroll', {
        scrollLeft,
        scrollTop
      });
    }, 100);

    gridContainer.addEventListener('scroll', () => {
      // Request animation frame only if not already requested
      if (rafId === null) {
        rafId = requestAnimationFrame(syncScroll);
      }
    }, { passive: true }); // Passive listener for better scroll performance
  }

  /**
   * Setup playback control button handlers
   */
  private setupPlaybackControls(): void {
    const playbackEngine = this._context.Core.playbackEngine;
    if (!playbackEngine) return;

    // Play/Pause button
    this.playPauseBtn.addEventListener('click', () => {
      playbackEngine.togglePlayPause();
    });

    // Stop button
    this.stopBtn.addEventListener('click', () => {
      playbackEngine.stop();
    });

    // Listen to playback events to update UI
    this._context.Core.eventManager.on('playback:started', () => {
      this.playPauseBtn.innerHTML = '⏸';
      this.playPauseBtn.title = 'Pause';
      this.playPauseBtn.classList.remove('timeline-btn-play');
      this.playPauseBtn.classList.add('timeline-btn-pause');
    });

    this._context.Core.eventManager.on('playback:paused', () => {
      this.playPauseBtn.innerHTML = '▶';
      this.playPauseBtn.title = 'Play';
      this.playPauseBtn.classList.remove('timeline-btn-pause');
      this.playPauseBtn.classList.add('timeline-btn-play');
    });

    this._context.Core.eventManager.on('playback:stopped', () => {
      this.playPauseBtn.innerHTML = '▶';
      this.playPauseBtn.title = 'Play';
      this.playPauseBtn.classList.remove('timeline-btn-pause');
      this.playPauseBtn.classList.add('timeline-btn-play');
    });

    // Update frame display on frame changes
    this._context.Core.eventManager.on('playback:frameEnter', (data: { frame: number }) => {
      this.frameDisplay.textContent = data.frame.toString();
    });

    this._context.Core.eventManager.on('playback:frameChanged', (data: { frame: number }) => {
      this.frameDisplay.textContent = data.frame.toString();
    });

    this._context.Core.eventManager.on('playhead:moved', (data: { frame: number }) => {
      this.frameDisplay.textContent = data.frame.toString();
    });
  }

  /**
   * Setup keyboard shortcuts for keyframe operations
   */
  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      const keyframeManager = this._context.Core.keyframeManager;
      const playbackEngine = this._context.Core.playbackEngine;
      const selectionManager = this._context.Core.selectionManager;

      if (!keyframeManager || !playbackEngine) return;

      // Get currently selected layer (we'll use the first layer for now)
      // TODO: Track currently active layer selection
      const data = this._context.Data.getData();
      const firstLayer = data.layers[0];
      if (!firstLayer) return;

      const currentFrame = playbackEngine.getCurrentFrame();

      // CTRL+C: Copy selected keyframes
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectionManager) {
          const selectedFrames = selectionManager.getSelectedFrames();
          if (selectedFrames.length > 0) {
            e.preventDefault();
            keyframeManager.copyKeyframes(selectedFrames);
          }
        }
      }

      // CTRL+V: Paste keyframes
      else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        keyframeManager.pasteKeyframes(firstLayer.id, currentFrame);
      }

      // Enter: Toggle Play/Pause
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (playbackEngine.getIsPlaying()) {
          playbackEngine.pause();
          console.log('Playback paused (Enter)');
        } else {
          playbackEngine.play();
          console.log('Playback started (Enter)');
        }
      }

      // Comma (,): Previous Frame
      else if (e.key === ',') {
        e.preventDefault();
        const prevFrame = Math.max(1, currentFrame - 1);
        playbackEngine.goToFrame(prevFrame);
        console.log(`Moved to previous frame: ${prevFrame}`);
      }

      // Period (.): Next Frame
      else if (e.key === '.') {
        e.preventDefault();
        const nextFrame = Math.min(data.settings.totalFrames, currentFrame + 1);
        playbackEngine.goToFrame(nextFrame);
        console.log(`Moved to next frame: ${nextFrame}`);
      }

      // Delete: Delete selected frames/keyframes
      else if (e.key === 'Delete') {
        if (selectionManager) {
          const selectedFrames = selectionManager.getSelectedFrames();
          if (selectedFrames.length > 0) {
            e.preventDefault();
            // Group selected frames by layer and delete them
            const framesByLayer = new Map<string, number[]>();
            selectedFrames.forEach(frameId => {
              const [layerId, frameStr] = frameId.split(':');
              const frame = parseInt(frameStr, 10);
              if (!framesByLayer.has(layerId)) {
                framesByLayer.set(layerId, []);
              }
              framesByLayer.get(layerId)!.push(frame);
            });

            // Delete frames for each layer
            framesByLayer.forEach((frames, layerId) => {
              const minFrame = Math.min(...frames);
              const maxFrame = Math.max(...frames);
              keyframeManager.deleteFrames(layerId, minFrame, maxFrame);
            });

            selectionManager.clearSelection();
            console.log(`Deleted ${selectedFrames.length} selected frames`);
          }
        }
      }

      // F6: Insert content keyframe
      else if (e.key === 'F6') {
        e.preventDefault();
        keyframeManager.insertKeyframe(firstLayer.id, currentFrame);
        console.log(`Inserted content keyframe at frame ${currentFrame}`);
      }

      // F7: Insert blank keyframe
      else if (e.key === 'F7') {
        e.preventDefault();
        keyframeManager.insertBlankKeyframe(firstLayer.id, currentFrame);
        console.log(`Inserted blank keyframe at frame ${currentFrame}`);
      }

      // F5: Insert frame (extend sequence)
      else if (e.key === 'F5') {
        e.preventDefault();
        if (e.shiftKey) {
          // Shift+F5: Delete frames
          // For now, delete just the current frame
          keyframeManager.deleteFrames(firstLayer.id, currentFrame, currentFrame);
          console.log(`Deleted frame ${currentFrame}`);
        } else {
          // F5: Insert frame
          keyframeManager.insertFrame(firstLayer.id, currentFrame);
          console.log(`Inserted frame at ${currentFrame}`);
        }
      }
    });
  }

  /**
   * Load test data and render the UI
   */
  private loadTestData(): void {
    // Create test data based on spec example
    const testData: ITimeLineData = {
      version: '1.0.0',
      settings: {
        totalFrames: 100,
        frameRate: 24,
        frameWidth: 15,
        rowHeight: 30
      },
      layers: [
        {
          id: 'layer-1',
          name: 'Background',
          type: 'layer',
          visible: true,
          locked: false,
          keyframes: [
            { frame: 1, isEmpty: false },
            { frame: 20, isEmpty: false },
            { frame: 50, isEmpty: true }
          ],
          tweens: [
            { startFrame: 1, endFrame: 20, type: 'linear' }
          ]
        },
        {
          id: 'folder-1',
          name: 'Character',
          type: 'folder',
          visible: true,
          locked: false,
          children: [
            {
              id: 'layer-2',
              name: 'Head',
              type: 'layer',
              visible: true,
              locked: false,
              keyframes: [
                { frame: 1, isEmpty: false },
                { frame: 15, isEmpty: false }
              ],
              tweens: [
                { startFrame: 1, endFrame: 15, type: 'ease' }
              ]
            },
            {
              id: 'layer-3',
              name: 'Body',
              type: 'layer',
              visible: true,
              locked: false,
              keyframes: [
                { frame: 1, isEmpty: false },
                { frame: 30, isEmpty: false }
              ],
              tweens: []
            }
          ]
        },
        {
          id: 'layer-4',
          name: 'Foreground',
          type: 'layer',
          visible: false,
          locked: true,
          keyframes: [
            { frame: 10, isEmpty: false }
          ],
          tweens: []
        }
      ]
    };

    // Load the test data
    this._context.Data.load(testData);

    // Render the layer panel
    if (this._context.UI.layerPanel) {
      this._context.UI.layerPanel.render();
    }

    // Render the time ruler
    if (this._context.UI.timeRuler) {
      this._context.UI.timeRuler.render();
      // Set initial playhead position at frame 1
      this._context.UI.timeRuler.setPlayheadPosition(1);
    }

    // Render the timeline grid
    if (this._context.UI.timelineGrid) {
      this._context.UI.timelineGrid.render();
    }
  }

  /**
   * Get the context (for plugin access)
   */
  public getContext(): IJsTimeLineContext {
    return this._context;
  }

  /**
   * Export timeline data as JSON string
   * @returns JSON string representation of timeline data
   */
  public exportData(): string {
    return this._context.Data.toJSON();
  }

  /**
   * Import timeline data from JSON string
   * @param json JSON string to import
   * @throws Error if JSON is invalid or incompatible
   */
  public importData(json: string): void {
    try {
      // Load and validate data
      this._context.Data.fromJSON(json);
      
      // Re-render all UI components
      if (this._context.UI.layerPanel) {
        this._context.UI.layerPanel.render();
      }
      
      if (this._context.UI.timeRuler) {
        this._context.UI.timeRuler.render();
        this._context.UI.timeRuler.setPlayheadPosition(1);
      }
      
      if (this._context.UI.timelineGrid) {
        this._context.UI.timelineGrid.render();
      }
      
      // Reset playback to frame 1
      if (this._context.Core.playbackEngine) {
        this._context.Core.playbackEngine.stop();
      }
      
      // Emit event
      this._context.Core.eventManager.emit('timeline:dataImported', {
        timestamp: new Date().toISOString()
      });
      
      console.log('Timeline data imported successfully');
      
    } catch (error) {
      console.error('Failed to import timeline data:', error);
      throw error;
    }
  }
}

// Export utility functions
export { EventLogger, attachEventLogger } from './utils/EventLogger';
export { debounce, throttle, rafLoop, calculateVisibleRange, memoize, PerformanceMonitor } from './utils/Performance';
