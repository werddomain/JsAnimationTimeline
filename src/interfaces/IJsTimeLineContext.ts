/**
 * Central Context Interface for the JsAnimationTimeline
 * This interface defines the main communication hub for all components and plugins
 * Following the Project Development Guidelines for modular architecture
 */

/**
 * Main context interface that serves as the central hub for communication
 * and state sharing between all modules and plugins
 */
export interface IJsTimeLineContext {
  /**
   * UI components - instances of classes that manage the main DOM containers
   */
  readonly UI: {
    /** Main container element for the timeline control */
    container: HTMLElement;
    /** Left panel managing layers and folders */
    layersPanel: any; // Will be typed properly once circular import is resolved
    /** Top panel with time ruler and playhead */
    timeRuler: any; // Will be typed properly once circular import is resolved
    /** Main grid area with timeline frames and keyframes */
    timelineGrid: any; // Will be typed properly once circular import is resolved
  };

  /**
   * Core logic modules that expose events and methods for direct interaction
   */
  readonly Core: {
    /** Event management system for pub/sub communication */
    eventManager: any; // Will be typed properly once circular import is resolved
    /** State management for the timeline */
    stateManager: any; // Will be typed properly once circular import is resolved
    /** Plugin lifecycle and management */
    pluginManager: any; // Will be typed properly once circular import is resolved
  };

  /**
   * Services for data manipulation and business logic
   */
  readonly Services: {
    /** Layer management service */
    layerService: any; // Will be typed properly once circular import is resolved
    /** Scroll synchronization service */
    scrollManager: any; // Will be typed properly once circular import is resolved
  };

  /**
   * Dictionary of all registered and instantiated plugins
   */
  readonly Plugins: {
    [key: string]: any; // Will be typed properly once circular import is resolved
  };

  /**
   * Read-only manager providing access to the control's current data model
   * Ensures single source of truth for the control's state
   */
  readonly Data: any; // Will be typed properly once circular import is resolved

  /**
   * Configuration options for the timeline
   */
  readonly Config: {
    /** Frames per second for playback */
    fps: number;
    /** Total duration in frames */
    totalFrames: number;
    /** Current time scale (pixels per frame) */
    timeScale: number;
    /** Enable debug mode */
    debug: boolean;
  };
}

/**
 * Configuration options for initializing the timeline context
 */
export interface ITimelineConfig {
  /** Target container element */
  container: HTMLElement;
  /** Initial frames per second (default: 24) */
  fps?: number;
  /** Initial total frames (default: 100) */
  totalFrames?: number;
  /** Initial time scale in pixels per frame (default: 20) */
  timeScale?: number;
  /** Enable debug mode (default: false) */
  debug?: boolean;
  /** Custom plugins to load */
  plugins?: Array<new (context: IJsTimeLineContext) => any>;
}