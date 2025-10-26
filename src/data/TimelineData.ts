/**
 * Timeline Data Model for JsAnimationTimeline
 * Provides read-only access to the timeline's data model
 * Following the Project Development Guidelines
 */

import { EventManager } from '../core/EventManager';

/**
 * Keyframe types following Flash MX specification
 */
export enum KeyframeType {
  CONTENT = 'content',     // Standard keyframe with content
  BLANK = 'blank'          // Empty keyframe
}

/**
 * Frame types for timeline visualization
 */
export enum FrameType {
  EMPTY = 'empty',         // Empty frame (no content)
  STANDARD = 'standard',   // Standard frame (extends keyframe)
  KEYFRAME = 'keyframe',   // Keyframe (content or blank)
  TWEEN = 'tween'          // Part of a tween sequence
}

/**
 * Tween types
 */
export enum TweenType {
  MOTION = 'motion',       // Motion tween
  SHAPE = 'shape'          // Shape tween
}

/**
 * Layer types
 */
export enum LayerType {
  LAYER = 'layer',         // Regular layer
  FOLDER = 'folder'        // Layer folder
}

/**
 * Keyframe data interface
 */
export interface IKeyframe {
  /** Unique identifier */
  id: string;
  /** Frame number (1-based) */
  frame: number;
  /** Keyframe type */
  type: KeyframeType;
  /** Associated data */
  data?: any;
}

/**
 * Tween data interface
 */
export interface ITween {
  /** Unique identifier */
  id: string;
  /** Start frame number */
  startFrame: number;
  /** End frame number */
  endFrame: number;
  /** Tween type */
  type: TweenType;
  /** Tween properties */
  properties?: Record<string, any>;
}

/**
 * Layer data interface
 */
export interface ILayer {
  /** Unique identifier */
  id: string;
  /** Layer name */
  name: string;
  /** Layer type */
  type: LayerType;
  /** Whether layer is visible */
  isVisible: boolean;
  /** Whether layer is locked */
  isLocked: boolean;
  /** Whether layer is selected */
  isSelected: boolean;
  /** Parent layer ID (for folders) */
  parentId?: string;
  /** Child layer IDs (for folders) */
  children?: string[];
  /** Keyframes (only for regular layers) */
  keyframes?: Record<string, IKeyframe>;
  /** Tweens (only for regular layers) */
  tweens?: Record<string, ITween>;
  /** Whether folder is expanded (for folders) */
  isExpanded?: boolean;
}

/**
 * Timeline configuration interface
 */
export interface ITimelineConfig {
  /** Frames per second */
  fps: number;
  /** Total number of frames */
  totalFrames: number;
  /** Current time scale (pixels per frame) */
  timeScale: number;
  /** Current frame */
  currentFrame: number;
}

/**
 * Timeline Data class that manages all timeline data
 */
export class TimelineData {
  private _config: ITimelineConfig;
  private _eventManager: EventManager;
  private _layerService: any = null; // Will be injected after initialization

  constructor(eventManager: EventManager, initialConfig: Partial<ITimelineConfig> = {}) {
    this._eventManager = eventManager;
    this._config = {
      fps: 24,
      totalFrames: 100,
      timeScale: 20,
      currentFrame: 1,
      ...initialConfig
    };
  }

  /**
   * Inject the layer service after construction
   * This is needed to avoid circular dependencies
   */
  public setLayerService(layerService: any): void {
    this._layerService = layerService;
  }

  /**
   * Get timeline configuration
   */
  public getConfig(): Readonly<ITimelineConfig> {
    return { ...this._config };
  }

  /**
   * Get current frame
   */
  public getCurrentFrame(): number {
    return this._config.currentFrame;
  }

  /**
   * Get current time in seconds
   */
  public getCurrentTime(): number {
    return (this._config.currentFrame - 1) / this._config.fps;
  }

  /**
   * Get total duration in seconds
   */
  public getDuration(): number {
    return this._config.totalFrames / this._config.fps;
  }

  /**
   * Get FPS
   */
  public getFPS(): number {
    return this._config.fps;
  }

  /**
   * Get total frames
   */
  public getTotalFrames(): number {
    return this._config.totalFrames;
  }

  /**
   * Get time scale
   */
  public getTimeScale(): number {
    return this._config.timeScale;
  }

  /**
   * Get all layers in order
   */
  public getLayers(): readonly ILayer[] {
    if (!this._layerService) return [];
    return this._layerService.getLayers();
  }

  /**
   * Get a layer by ID
   */
  public getLayer(id: string): ILayer | undefined {
    if (!this._layerService) return undefined;
    const layers = this._layerService.getLayers();
    return layers.find((layer: ILayer) => layer.id === id);
  }

  /**
   * Get layer order
   */
  public getLayerOrder(): readonly string[] {
    if (!this._layerService) return [];
    return this._layerService.getLayers().map((layer: ILayer) => layer.id);
  }

  /**
   * Get selected layer IDs
   */
  public getSelectedLayerIds(): readonly string[] {
    if (!this._layerService) return [];
    return this._layerService.getSelectedLayerIds();
  }

  /**
   * Get selected keyframe IDs
   */
  public getSelectedKeyframeIds(): readonly string[] {
    // TODO: Implement keyframe selection service
    return [];
  }

  /**
   * Get all keyframes for a layer
   */
  public getLayerKeyframes(layerId: string): readonly IKeyframe[] {
    const layer = this.getLayer(layerId);
    if (!layer || !layer.keyframes) {
      return [];
    }
    return Object.values(layer.keyframes);
  }

  /**
   * Get all tweens for a layer
   */
  public getLayerTweens(layerId: string): readonly ITween[] {
    const layer = this.getLayer(layerId);
    if (!layer || !layer.tweens) {
      return [];
    }
    return Object.values(layer.tweens);
  }

  /**
   * Get keyframes at a specific frame across all layers
   */
  public getKeyframesAtFrame(frame: number): IKeyframe[] {
    const keyframes: IKeyframe[] = [];
    
    for (const layer of this.getLayers()) {
      if (layer.type === LayerType.LAYER && layer.keyframes) {
        const frameKeyframe = Object.values(layer.keyframes).find(kf => kf.frame === frame);
        if (frameKeyframe) {
          keyframes.push(frameKeyframe);
        }
      }
    }
    
    return keyframes;
  }

  /**
   * Get the frame type at a specific position
   */
  public getFrameType(layerId: string, frame: number): FrameType {
    const layer = this.getLayer(layerId);
    if (!layer || layer.type !== LayerType.LAYER) {
      return FrameType.EMPTY;
    }

    // Check if it's a keyframe
    if (layer.keyframes) {
      const keyframe = Object.values(layer.keyframes).find((kf: IKeyframe) => kf.frame === frame);
      if (keyframe) {
        return FrameType.KEYFRAME;
      }
    }

    // Check if it's part of a tween
    if (layer.tweens) {
      const tween = Object.values(layer.tweens).find((t: ITween) => frame >= t.startFrame && frame <= t.endFrame);
      if (tween) {
        return FrameType.TWEEN;
      }
    }

    // Check if it's a standard frame (extends from a previous keyframe)
    if (layer.keyframes) {
      const sortedKeyframes = Object.values(layer.keyframes)
        .filter((kf: IKeyframe) => kf.frame < frame)
        .sort((a: IKeyframe, b: IKeyframe) => a.frame - b.frame);
      
      if (sortedKeyframes.length > 0) {
        return FrameType.STANDARD;
      }
    }

    return FrameType.EMPTY;
  }

  /**
   * Check if a layer is selected
   */
  public isLayerSelected(layerId: string): boolean {
    const selectedIds = this.getSelectedLayerIds();
    return selectedIds.includes(layerId);
  }

  /**
   * Check if a keyframe is selected
   */
  public isKeyframeSelected(keyframeId: string): boolean {
    // TODO: Implement keyframe selection service
    return false;
  }

  /**
   * Get hierarchical layer structure
   */
  public getLayerHierarchy(): ILayer[] {
    const rootLayers: ILayer[] = [];
    const layers = this.getLayers();
    
    for (const layer of layers) {
      if (!layer.parentId) {
        rootLayers.push(this._buildLayerTree(layer));
      }
    }
    
    return rootLayers;
  }

  /**
   * Build layer tree recursively
   */
  private _buildLayerTree(layer: ILayer): ILayer {
    const result = { ...layer };
    
    if (layer.type === LayerType.FOLDER && layer.children) {
      const children: ILayer[] = [];
      for (const childId of layer.children) {
        const childLayer = this.getLayer(childId);
        if (childLayer) {
          children.push(this._buildLayerTree(childLayer));
        }
      }
      result.children = children.map(c => c.id);
    }
    
    return result;
  }

  /**
   * Export timeline data for serialization
   */
  public exportData(): {
    version: string;
    config: ITimelineConfig;
    layers: ILayer[];
    layerOrder: string[];
  } {
    return {
      version: '1.0',
      config: this._config,
      layers: this.getLayers() as ILayer[],
      layerOrder: this.getLayerOrder() as string[]
    };
  }

  /**
   * Get debug information
   */
  public getDebugInfo(): {
    layerCount: number;
    totalKeyframes: number;
    totalTweens: number;
    selectedLayers: number;
    selectedKeyframes: number;
  } {
    let totalKeyframes = 0;
    let totalTweens = 0;
    
    const layers = this.getLayers();
    for (const layer of layers) {
      if (layer.keyframes) {
        totalKeyframes += Object.keys(layer.keyframes).length;
      }
      if (layer.tweens) {
        totalTweens += Object.keys(layer.tweens).length;
      }
    }
    
    return {
      layerCount: layers.length,
      totalKeyframes,
      totalTweens,
      selectedLayers: this.getSelectedLayerIds().length,
      selectedKeyframes: this.getSelectedKeyframeIds().length
    };
  }
}