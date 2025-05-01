import { StateManager } from './stateManager';
import { EventManager } from './eventManager';

// Import all the component classes
import { PlaybackController } from './timeline-components/PlaybackController';
import { FrameNavigator } from './timeline-components/FrameNavigator';
import { KeyframeManager } from './timeline-components/KeyframeManager';
import { RulerRenderer } from './timeline-components/RulerRenderer';
import { TracksRenderer } from './timeline-components/TracksRenderer';
import { PlayheadController } from './timeline-components/PlayheadController';
import { TimelineScrollController } from './timeline-components/TimelineScrollController';
import { TimelineConfigManager } from './timeline-components/TimelineConfigManager';
import { VirtualScrollbar } from './virtualScrollbar';

/**
 * TimelineGrid3D Component
 * 
 * Main timeline grid class that orchestrates the interaction between different
 * timeline components for visualization and manipulation of animation sequences.
 */
export class TimelineGrid3D {
  // Main container and state management
  private container: HTMLElement;
  private stateManager: StateManager;
  private eventManager: EventManager;
  
  // DOM elements references
  private scrollContainer: HTMLElement | null = null;
  private rulerEl: HTMLElement | null = null;
  private tracksEl: HTMLElement | null = null;
  
  // Component instances
  private playbackController: PlaybackController;
  private frameNavigator: FrameNavigator;
  private keyframeManager: KeyframeManager;
  private rulerRenderer: RulerRenderer;
  private tracksRenderer: TracksRenderer;
  private playheadController: PlayheadController;
  private scrollController: TimelineScrollController;
  private configManager: TimelineConfigManager;
  private virtualScrollbar: VirtualScrollbar | null = null;

  /**
   * Creates an instance of TimelineGrid3D.
   * 
   * @param container - The container element to render the timeline in
   * @param stateManager - The state manager for the timeline
   * @param eventManager - The event manager for the timeline
   */
  constructor(container: HTMLElement, stateManager: StateManager, eventManager: EventManager) {
    // Set main references
    this.container = container;
    this.stateManager = stateManager;
    this.eventManager = eventManager;
    
    // Initialize components with default configuration
    const initialFrameCount = 60;
    const frameWidth = 24;
    const rulerHeight = 28;
    const rowHeight = 22;
    
    // Initialize configuration manager
    this.configManager = new TimelineConfigManager(
      this.stateManager,
      this.eventManager,
      {
        container: this.container,
        frameWidth: frameWidth,
        initialFrameCount: initialFrameCount
      }
    );
    
    // Initialize scroll controller
    this.scrollController = new TimelineScrollController(
      this.eventManager,
      {
        container: this.container,
        frameWidth: frameWidth,
        initialFrameCount: initialFrameCount
      }
    );
    
    // Initialize keyframe manager (needs to be before tracks renderer)
    this.keyframeManager = new KeyframeManager(
      this.stateManager,
      this.eventManager,
      {
        container: this.container,
        frameWidth: frameWidth
      }
    );
    
    // Initialize tracks renderer
    this.tracksRenderer = new TracksRenderer(
      this.stateManager,
      this.eventManager,
      {
        container: this.container,
        frameWidth: frameWidth,
        rowHeight: rowHeight
      },
      // Pass keyframe renderer function from keyframeManager
      (layerIdx: number, frameCount: number) => this.keyframeManager.renderTrackFrames(layerIdx, frameCount)
    );
    
    // Initialize ruler renderer
    this.rulerRenderer = new RulerRenderer(
      this.stateManager,
      this.eventManager,
      {
        container: this.container,
        frameWidth: frameWidth,
        rulerHeight: rulerHeight
      }
    );
    
    // Initialize frame navigator
    this.frameNavigator = new FrameNavigator(
      this.stateManager,
      this.eventManager,
      {
        container: this.container,
        frameCount: initialFrameCount,
        frameWidth: frameWidth
      }
    );
    
    // Initialize playhead controller
    this.playheadController = new PlayheadController(
      this.stateManager,
      this.eventManager,
      {
        container: this.container,
        frameWidth: frameWidth
      }
    );
    
    // Initialize playback controller
    this.playbackController = new PlaybackController(
      this.stateManager,
      this.eventManager,
      {
        container: this.container,
        frameCount: initialFrameCount
      }
    );
    
    // Register event handlers
    this.registerEvents();
    
    // Initial render
    this.render();
  }
  
  /**
   * Register event handlers for this component
   */
  private registerEvents(): void {
    // Listen for state changes to re-render or update playhead
    this.eventManager.subscribe('stateChange', () => {
      if (!this.container.querySelector('.timeline-grid__playhead')) {
        // Only do a full render if the playhead doesn't exist yet
        this.render();
      } else {
        // Just update the playhead position for better performance
        this.playheadController.updatePlayheadPosition();
      }
    });
    
    // Listen for frame count changes from scroll controller
    this.eventManager.subscribe('frameCountChanged', (data) => {
      // Update other components with new frame count
      this.playbackController.setFrameCount(data.frameCount);
      this.frameNavigator.setFrameCount(data.frameCount);
      
      // Re-render if necessary
      this.render();
    });
    
    // Listen for playhead drag events to ensure frame is visible
    this.eventManager.subscribe('playheadDragged', (data) => {
      this.frameNavigator.ensureFrameVisible(data.frame);
    });
    
    // Update virtual scrollbar when scrolling happens
    this.eventManager.subscribe('scrollPositionChange', (data) => {
      if (this.virtualScrollbar && this.scrollContainer) {
        const { scrollWidth, clientWidth } = this.scrollContainer;
        this.virtualScrollbar.update(scrollWidth, clientWidth, data.position);
      }
    });
    
    // Update virtual scrollbar when content size changes
    this.eventManager.subscribe('contentSizeChange', (data) => {
      if (this.virtualScrollbar) {
        this.virtualScrollbar.update(data.totalWidth, data.viewportWidth, 
          this.scrollContainer ? this.scrollContainer.scrollLeft : 0);
      }
    });
    
    // Handle window resize to ensure timeline always fills double the viewport width
    let resizeTimeout: any = null;
    window.addEventListener('resize', () => {
      // Debounce the resize event
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      
      resizeTimeout = setTimeout(() => {
        const containerWidth = this.container.clientWidth;
        const frameWidth = this.configManager.getFrameWidth();
        const currentFrameCount = this.configManager.getFrameCount();
        const minRequiredFrames = Math.ceil((containerWidth * 2) / frameWidth);
        
        // Only update if we need more frames than we currently have
        if (currentFrameCount < minRequiredFrames) {
          this.render(); // This will recalculate and update the frame count
        }
      }, 200); // 200ms debounce
    });
  }

  /**
   * Render the timeline grid
   */
  render() {
    // Clean up previous event listeners
    this.playheadController.cleanup();
    
    // Clean up previous virtual scrollbar if exists
    if (this.virtualScrollbar) {
      this.virtualScrollbar.destroy();
      this.virtualScrollbar = null;
    }
    
    const state = this.stateManager.getState();
    const playheadFrame = state.playhead ? state.playhead.frame : 1;
    
    // Calculate total content width based on frame count
    let frameCount = this.configManager.getFrameCount();
    const frameWidth = this.configManager.getFrameWidth();
    
    // Get the container width to ensure we have at least double the viewport width
    const containerWidth = this.container.clientWidth;
    const minRequiredFrames = Math.ceil((containerWidth * 2) / frameWidth);
    
    // Update the frameCount if it's less than what's needed to fill double the viewport
    if (frameCount < minRequiredFrames) {
      frameCount = minRequiredFrames;
      // Update the frame count in the config manager
      this.configManager.setFrameCount(frameCount);
      // Also update other components that need to know about the frame count
      this.playbackController.setFrameCount(frameCount);
      this.frameNavigator.setFrameCount(frameCount);
      // Notify other interested components about the frame count change
      this.eventManager.emit('frameCountChanged', {
        frameCount: frameCount,
        previousFrameCount: this.configManager.getFrameCount()
      });
    }
    
    const totalWidth = frameCount * frameWidth;
    
    // Render the main container HTML
    this.container.innerHTML = `
      <div class="timeline-grid__scroll-container">
        <div class="timeline-grid__ruler" style="height:${this.rulerRenderer.getRulerHeight()}px; width:${totalWidth}px">
          ${this.rulerRenderer.renderRuler(playheadFrame, frameCount)}
        </div>
        <div class="timeline-grid__tracks" style="width:${totalWidth}px">
          ${this.tracksRenderer.renderTracks(playheadFrame, frameCount)}
        </div>
        <div class="timeline-grid__playhead" style="left:${(playheadFrame-1)*frameWidth}px"></div>
      </div>
      </div>      <div class="timeline-grid__control-bar">
        <button class="timeline-grid__ctrl-btn" id="play-btn" title="Play/Pause">${this.playbackController.getIsPlaying() ? '<svg width=16 height=16><rect x=3 y=3 width=3 height=10 fill=black/><rect x=10 y=3 width=3 height=10 fill=black/></svg>' : '<svg width=16 height=16><polygon points="3,3 13,8 3,13" fill="black"/></svg>'}</button>
        <button class="timeline-grid__ctrl-btn" id="stop-btn" title="Stop"><svg width=16 height=16><rect x=3 y=3 width=10 height=10 fill=black/></svg></button>
        <button class="timeline-grid__ctrl-btn" id="step-back-btn" title="Step Back"><svg width=16 height=16><polygon points="11,3 11,13 3,8" fill="black"/></svg></button>
        <button class="timeline-grid__ctrl-btn" id="step-fwd-btn" title="Step Forward"><svg width=16 height=16><polygon points="5,3 5,13 13,8" fill="black"/></svg></button>
        <span class="timeline-grid__ctrl-sep"></span>
        <label for="goto-frame">Frame:</label>
        <input type="number" id="goto-frame" min="1" max="${frameCount}" value="${playheadFrame}" class="timeline-grid__goto-input" />        <label for="goto-time">Time:</label>
        <input type="number" id="goto-time" min="0" step="0.01" value="${((playheadFrame - 1) / state.fps).toFixed(2)}" class="timeline-grid__goto-input goto-time" /> <span class="timeline-grid__unit">s</span>
        <label for="fps-input">FPS:</label>
        <input type="number" id="fps-input" min="1" max="120" step="0.01" value="${state.fps}" class="timeline-grid__fps-input" />
        <button id="goto-frame-btn" class="timeline-grid__goto-btn">Go</button>
        <div class="timeline-grid__scrollbar-container" id="scrollbar-container"></div>
      </div>
    `;
    
    // Get references to DOM elements
    this.scrollContainer = this.container.querySelector('.timeline-grid__scroll-container');
    this.rulerEl = this.container.querySelector('.timeline-grid__ruler');
    this.tracksEl = this.container.querySelector('.timeline-grid__tracks');
    
    // Update component references
    this.scrollController.setScrollContainer(this.scrollContainer);
    this.frameNavigator.setScrollContainer(this.scrollContainer);
    this.rulerRenderer.setElements(this.rulerEl, this.tracksEl, this.scrollContainer);
    this.tracksRenderer.setTracksElement(this.tracksEl);
    this.keyframeManager.setTracksElement(this.tracksEl);
    this.playheadController.setTracksElement(this.tracksEl);
    
    // Create virtual scrollbar
    this.virtualScrollbar = new VirtualScrollbar(this.container, this.eventManager);
    
    // Update virtual scrollbar with initial values
    if (this.virtualScrollbar && this.scrollContainer) {
      const { scrollLeft, scrollWidth, clientWidth } = this.scrollContainer;
      this.virtualScrollbar.update(scrollWidth, clientWidth, scrollLeft);
    }
    
    // Ensure frame is visible in scroll area
    if (this.scrollContainer) {
      this.frameNavigator.ensureFrameVisible(playheadFrame);
    }
    
    // Set up component functionality
    this.rulerRenderer.syncRulerAndTracks();
    this.scrollController.attachScrollHandler();
    this.keyframeManager.attachFrameSelection();
    this.frameNavigator.attachGotoFrame();
    this.configManager.attachFpsInput();
    this.frameNavigator.attachGotoTimeSync();
    this.playbackController.attachPlaybackControls();
    this.playheadController.attachPlayheadDrag();
  }

  /**
   * Extend frames by a specific count
   * 
   * @param count - Number of frames to add
   */
  extendFrames(count: number): void {
    this.scrollController.extendFrames(count);
  }
}
