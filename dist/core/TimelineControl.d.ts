/**
 * Timeline Control
 * Main control class for the timeline
 */
import { TimelineDataModel, Layer, Keyframe, MotionTween } from './DataModel';
import { TimelineEventMap, TimelineEventListener } from './EventTypes';
import { PluginManager } from './PluginManager';
export interface TimelineOptions {
    container: HTMLElement;
    width?: number;
    height?: number;
    duration?: number;
    initialLayers?: Layer[];
}
export declare class TimelineControl {
    private container;
    private dataModel;
    private eventEmitter;
    private isPlaying;
    private animationFrameId;
    private lastFrameTime;
    private timelineEl;
    private layersContainerEl;
    private keyframesContainerEl;
    private timeRulerEl;
    private toolbarEl;
    private objectToolbarEl;
    private timeCursorEl;
    private layerManager;
    private keyframeManager;
    private mainToolbar;
    private objectToolbar;
    private timeRuler;
    private groupManager;
    pluginManager: PluginManager;
    private width;
    private height;
    private layerHeight;
    private leftPanelWidth;
    private components;
    constructor(options: TimelineOptions);
    /**
   * Handle deletion of selected objects
   */
    private handleDeleteObject; /**
   * Update the display of layers
   */
    private updateLayerDisplay;
    /**
     * Update the display of keyframes
     */
    private updateKeyframeDisplay;
    /**
     * Handle keyframe selection
     */
    private handleKeyframeSelect;
    /**
     * Handle keyframe movement
     */
    private handleKeyframeMove;
    /**
     * Handle keyframe deletion
     */
    private handleKeyframeDelete;
    /**
     * Handle user creation of keyframe in the timeline
     */
    private handleKeyframeUserCreate;
    /**
     * Handle adding a keyframe from toolbar
     */
    private handleAddKeyframe;
    /**
     * Handle editing a keyframe
     */
    private handleEditKeyframe;
    /**
     * Handle motion tween creation by user
     */
    private handleMotionTweenUserCreate;
    /**
     * Handle creating a motion tween from toolbar
     */
    private handleCreateMotionTween;
    /**
     * Handle motion tween deletion
     */
    private handleMotionTweenDelete;
    /**
     * Handle deleting keyframes from toolbar
     */
    private handleDeleteKeyframe;
    /**
     * Handle layer selection
     */
    private handleLayerSelect;
    /**
     * Handle layer movement (reordering)
     */
    private handleLayerMove;
    /**
     * Handle layer name change
     */
    private handleLayerNameChange;
    /**
     * Handle layer visibility toggle
     */
    private handleLayerVisibilityToggle;
    /**
     * Handle layer lock toggle
     */
    private handleLayerLockToggle;
    /**
     * Handle layer color change
     */
    private handleLayerColorChange;
    /**
     * Handle layer deletion
     */
    private handleLayerDelete;
    /**
     * Handle creation of a new object/layer
     */
    private handleNewObject;
    /**
     * Handle creation of a layer group
     */
    private handleCreateGroup;
    /**
     * Handle deleting a group
     */
    private handleDeleteGroup;
    /**
     * Handle toggling group expanded/collapsed state
     */
    private handleToggleGroupExpanded;
    /**
     * Handle adding a layer to a group
     */
    private handleAddLayerToGroup;
    /**
     * Handle removing a layer from its group
     */
    private handleRemoveLayerFromGroup;
    /**
   * Initialize all component instances
   */
    private initializeComponents;
    createGroup(): void;
    /**
     * Get the timeline data model
     * @returns Current data model
     */
    getDataModel(): TimelineDataModel;
    /**
     * Add a layer to the timeline
     * @param layer Layer data
     * @returns The created layer
     */
    addLayer(layer: Omit<Layer, 'id'>): Layer | null;
    /**
     * Add a keyframe to a layer
     * @param layerId Layer ID
     * @param keyframe Keyframe data
     * @returns The created keyframe
     */
    addKeyframe(layerId: string, keyframe: Omit<Keyframe, 'id'>): Keyframe | null;
    /**
     * Add a motion tween between keyframes
     * @param layerId Layer ID
     * @param tween Motion tween data
     * @returns The created motion tween
     */
    addMotionTween(layerId: string, tween: Omit<MotionTween, 'id'>): MotionTween | null;
    /**
     * Set the current playback time
     * @param time Time in seconds
     * @param extendDuration Whether to automatically extend duration if needed
     */
    setCurrentTime(time: number, extendDuration?: boolean): void;
    /**
     * Go to a specific time
     * @param time Time in seconds to seek to
     */
    goToTime(time: number): void;
    /**
     * Get the current playback time
     * @returns Current time in seconds
     */
    getCurrentTime(): number;
    /**
     * Get all keyframes at the current time or a specified time
     * @param time Optional time in seconds (defaults to current time)
     * @param tolerance Tolerance window in seconds
     * @returns Array of layer and keyframe pairs
     */
    getKeyframesAtTime(time?: number, tolerance?: number): Array<{
        layerId: string;
        keyframe: Keyframe;
    }>;
    /**
     * Get all objects with their state at the current time or a specified time
     * @param time Optional time in seconds (defaults to current time)
     * @returns Array of layer objects with interpolated properties
     */
    getObjectsAtTime(time?: number): Array<{
        layer: Layer;
        properties: Record<string, any>;
    }>;
    /**
     * Start playback
     */
    play(): void;
    /**
     * Pause playback
     */
    pause(): void;
    /**
     * Stop playback and return to beginning
     */
    stop(): void;
    /**
     * Export timeline data as JSON
     * @returns JSON string
     */
    exportData(): string;
    /**
     * Import timeline data from JSON
     * @param json JSON string
     */
    importData(json: string): void;
    /**
     * Import layers from array
     * @param layers Array of layer objects
     */
    importLayers(layers: Layer[]): void;
    /**
     * Register an event listener
     * @param eventName Event name
     * @param callback Callback function
     * @returns Unsubscribe function
     */
    on<T extends keyof TimelineEventMap>(eventName: T, callback: TimelineEventListener<T>): () => void;
    /**
     * Set the zoom level/time scale
     * @param scale Zoom scale factor
     */
    setTimeScale(scale: number): void;
    /**
     * Resize the timeline
     * @param width New width
     * @param height New height
     */
    resize(width: number, height: number): void;
    /**
     * Create the initial DOM structure
     */
    private createDOMStructure;
    /**
     * Initialize event listeners
     */
    private initEventListeners;
    /**
     * Render all components
     */
    private renderAll;
    /**
     * Render the main toolbar
     */
    private renderToolbar;
    /**
     * Render the object toolbar
     */
    private renderObjectToolbar;
    /**
     * Render the time ruler
     */
    private renderTimeRuler;
    /**
     * Render the layer list
     */
    private renderLayers;
    /**
     * Render keyframes
     */
    private renderKeyframes;
    /**
     * Update the time cursor position
     */
    private updateTimeCursor;
    /**
     * Playback animation frame loop
     */
    private playbackLoop;
    /**
     * Format time as MM:SS.ms
     */
    private formatTime;
    /**
     * Determine appropriate time ruler interval based on zoom level
     */
    private getTimeRulerInterval;
}
