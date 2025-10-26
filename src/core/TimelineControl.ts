/**
 * TimelineControl class
 * Main control that coordinates plugins and manages the timeline interface
 * Following the Project Development Guidelines for modular architecture
 */

import { IJsTimeLineContext, ITimelineConfig } from '../interfaces/IJsTimeLineContext';
import { EventManager } from './EventManager';
import { StateManager } from './StateManager';
import { PluginManager } from './PluginManager';
import { TimelineData, LayerType } from '../data/TimelineData';
import { LayerService } from '../services/LayerService';
import { ScrollManager } from '../services/ScrollManager';
import { LayersPanel } from '../ui/LayersPanel';
import { TimeRuler } from '../ui/TimeRuler';
import { TimelineGrid } from '../ui/TimelineGrid';
import { Events } from '../constants/Constants';

/**
 * Main Timeline Control class that orchestrates all components
 */
export class TimelineControl implements IJsTimeLineContext {
  // Context properties
  public readonly UI: {
    container: HTMLElement;
    layersPanel: LayersPanel;
    timeRuler: TimeRuler;
    timelineGrid: TimelineGrid;
  };
  
  public readonly Core: {
    eventManager: EventManager;
    stateManager: StateManager;
    pluginManager: PluginManager;
  };

  public readonly Services: {
    layerService: LayerService;
    scrollManager: ScrollManager;
  };
  
  public readonly Plugins: { [key: string]: any } = {};
  public readonly Data: TimelineData;
  public readonly Config: {
    fps: number;
    totalFrames: number;
    timeScale: number;
    debug: boolean;
  };

  private _initialized: boolean = false;

  /**
   * Constructor
   * @param config Timeline configuration
   */
  constructor(config: ITimelineConfig) {
    // Initialize core systems
    this.Core = {
      eventManager: new EventManager(),
      stateManager: new StateManager(new EventManager()),
      pluginManager: new PluginManager(new EventManager())
    };

    // Initialize services
    this.Services = {
      layerService: new LayerService(this.Core.eventManager, this.Core.stateManager),
      scrollManager: new ScrollManager(this.Core.eventManager, this.Core.stateManager)
    };

    // Initialize data model
    this.Data = new TimelineData(this.Core.eventManager, {
      fps: config.fps || 24,
      totalFrames: config.totalFrames || 100,
      timeScale: config.timeScale || 20,
      currentFrame: 1
    });

    // Inject layer service into data model
    this.Data.setLayerService(this.Services.layerService);

    // Initialize configuration
    this.Config = {
      fps: config.fps || 24,
      totalFrames: config.totalFrames || 100,
      timeScale: config.timeScale || 20,
      debug: config.debug || false
    };

    // Initialize UI components
    this.UI = {
      container: config.container,
      layersPanel: new LayersPanel(),
      timeRuler: new TimeRuler(),
      timelineGrid: new TimelineGrid()
    };

    // Setup the DOM structure
    this._setupDOMStructure();

    // Initialize core systems with context
    this.Core.pluginManager.initialize(this);

    // Register state properties
    this._registerStateProperties();
  }

  /**
   * Initialize the timeline control
   */
  public async initialize(): Promise<void> {
    if (this._initialized) {
      return;
    }

    this.Core.eventManager.emit(Events.TIMELINE_INIT, { timeline: this });

    try {
      // Initialize UI components with context
      this.UI.layersPanel.initialize(this);
      this.UI.timeRuler.initialize(this);
      this.UI.timelineGrid.initialize(this);

      // Add sample data for testing if in debug mode
      if (this.Config.debug) {
        this._addSampleData();
      }

      // Load and initialize plugins
      this.Core.pluginManager.loadGlobalPlugins();
      this.Core.pluginManager.initializePlugins();

      // Setup event listeners
      this._setupEventListeners();

      this._initialized = true;

      this.Core.eventManager.emit(Events.TIMELINE_INIT + ':complete', { timeline: this });

      if (this.Config.debug) {
        console.log('TimelineControl initialized successfully', this.getDebugInfo());
      }
    } catch (error) {
      console.error('Failed to initialize TimelineControl:', error);
      throw error;
    }
  }

  /**
   * Dispose of the timeline control
   */
  public dispose(): void {
    if (!this._initialized) {
      return;
    }

    this.Core.eventManager.emit(Events.TIMELINE_DESTROYED, { timeline: this });

    // Dispose plugins
    this.Core.pluginManager.dispose();

    // Dispose UI components
    this.UI.layersPanel.dispose();
    this.UI.timeRuler.dispose();
    this.UI.timelineGrid.dispose();

    // Clear events
    this.Core.eventManager.clear();
    this.Core.stateManager.clear();

    // Clear DOM
    this.UI.container.innerHTML = '';

    this._initialized = false;
  }

  /**
   * Check if timeline is initialized
   */
  public isInitialized(): boolean {
    return this._initialized;
  }

  /**
   * Set current time
   * @param time Time in seconds
   */
  public setCurrentTime(time: number): void {
    const frame = Math.round(time * this.Config.fps) + 1;
    this.setCurrentFrame(frame);
  }

  /**
   * Set current frame
   * @param frame Frame number (1-based)
   */
  public setCurrentFrame(frame: number): void {
    const clampedFrame = Math.max(1, Math.min(frame, this.Config.totalFrames));
    this.Core.stateManager.set('currentFrame', clampedFrame);
    this.Core.eventManager.emit(Events.TIME_CHANGED, { 
      frame: clampedFrame,
      time: (clampedFrame - 1) / this.Config.fps
    });
  }

  /**
   * Get current frame
   */
  public getCurrentFrame(): number {
    return this.Core.stateManager.get('currentFrame', 1);
  }

  /**
   * Get current time in seconds
   */
  public getCurrentTime(): number {
    return (this.getCurrentFrame() - 1) / this.Config.fps;
  }

  /**
   * Get the main DOM element
   */
  public getElement(): HTMLElement {
    return this.UI.container;
  }

  /**
   * Setup the DOM structure following the three-panel layout
   */
  private _setupDOMStructure(): void {
    this.UI.container.className = 'timeline-control';
    
    // Create the main layout structure using CSS Grid
    this.UI.container.innerHTML = `
      <div class="timeline-content">
        <div class="timeline-layers-header-container"></div>
        <div class="timeline-layers-list-container"></div>
        <div class="timeline-scroll-container">
          <div class="timeline-ruler-container"></div>
          <div class="timeline-grid-container"></div>
        </div>
      </div>
    `;

    // Mount UI components
    const layersHeaderContainer = this.UI.container.querySelector('.timeline-layers-header-container') as HTMLElement;
    const layersListContainer = this.UI.container.querySelector('.timeline-layers-list-container') as HTMLElement;
    const rulerContainer = this.UI.container.querySelector('.timeline-ruler-container') as HTMLElement;
    const gridContainer = this.UI.container.querySelector('.timeline-grid-container') as HTMLElement;

    if (layersHeaderContainer && layersListContainer) {
      const layersElement = this.UI.layersPanel.getElement();
      
      // Split the layers panel into header and list parts
      const header = layersElement.querySelector('.timeline-layers-header');
      const list = layersElement.querySelector('.timeline-layers-list');
      
      if (header && list) {
        layersHeaderContainer.appendChild(header);
        layersListContainer.appendChild(list);
      } else {
        // Fallback: put entire panel in header container
        layersHeaderContainer.appendChild(layersElement);
      }
    }
    if (rulerContainer) {
      rulerContainer.appendChild(this.UI.timeRuler.getElement());
    }
    if (gridContainer) {
      gridContainer.appendChild(this.UI.timelineGrid.getElement());
    }
  }

  /**
   * Register state properties with default values
   */
  private _registerStateProperties(): void {
    this.Core.stateManager.registerProperty('currentFrame', {
      defaultValue: 1,
      validator: (value: number) => value >= 1 && value <= this.Config.totalFrames
    });

    this.Core.stateManager.registerProperty('isPlaying', {
      defaultValue: false
    });

    this.Core.stateManager.registerProperty('selectedLayers', {
      defaultValue: []
    });

    this.Core.stateManager.registerProperty('selectedKeyframes', {
      defaultValue: []
    });
  }

  /**
   * Setup event listeners for timeline interactions
   */
  private _setupEventListeners(): void {
    // Listen for state changes
    this.Core.stateManager.watch('currentFrame', (change) => {
      this.Core.eventManager.emit(Events.PLAYHEAD_MOVED, {
        frame: change.newValue,
        time: (change.newValue - 1) / this.Config.fps
      });
    });

    // Listen for window resize
    window.addEventListener('resize', () => {
      this.Core.eventManager.emit(Events.TIMELINE_RESIZED, {
        width: this.UI.container.clientWidth,
        height: this.UI.container.clientHeight
      });
    });
  }

  /**
   * Add sample data for testing purposes
   */
  private _addSampleData(): void {
    // Add a few sample layers
    const layer1Id = this.Services.layerService.addLayer('Background');
    const layer2Id = this.Services.layerService.addLayer('Character');
    const layer3Id = this.Services.layerService.addLayer('Effects');
    const folderId = this.Services.layerService.addLayer('Animation Folder', LayerType.FOLDER);

    // Select the character layer
    this.Services.layerService.selectLayer(layer2Id);
  }

  /**
   * Get debug information about the timeline
   */
  public getDebugInfo(): {
    initialized: boolean;
    config: {
      fps: number;
      totalFrames: number;
      timeScale: number;
      debug: boolean;
    };
    pluginInfo: any;
    stateInfo: any;
    dataInfo: any;
  } {
    return {
      initialized: this._initialized,
      config: this.Config,
      pluginInfo: this.Core.pluginManager.getDebugInfo(),
      stateInfo: this.Core.stateManager.getDebugInfo(),
      dataInfo: this.Data.getDebugInfo()
    };
  }
}
