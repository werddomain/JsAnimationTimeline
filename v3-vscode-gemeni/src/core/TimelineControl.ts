import { BaseComponent } from './BaseComponent';
import { DataModel } from './DataModel';
import { EventEmitter } from './EventEmitter';
import { PluginManager } from './PluginManager';
import { Events } from '@utils/EventTypes';

// Import styles
import '@styles/timeline.less';

/**
 * Options for initializing the TimelineControl
 */
export interface TimelineControlOptions {
    container: HTMLElement;
    duration?: number;
    timeScale?: number;
    pixelsPerSecond?: number;
}

/**
 * Main control class that ties everything together
 */
export class TimelineControl extends BaseComponent {
    // Core components
    private dataModel: DataModel;
    private eventEmitter: EventEmitter;
    private pluginManager: PluginManager;
    
    // DOM elements
    private toolbarEl: HTMLElement | null = null;
    private contentEl: HTMLElement | null = null;
    private contentContainerEl: HTMLElement | null = null;
    private layersContainerEl: HTMLElement | null = null;
    private keyframesAreaEl: HTMLElement | null = null;
    private timeRulerEl: HTMLElement | null = null;
    private keyframesContainerEl: HTMLElement | null = null;
    private objectToolbarEl: HTMLElement | null = null;
    
    /**
     * Constructor for TimelineControl
     * @param options Options for initializing the timeline
     */
    constructor(options: TimelineControlOptions) {
        super(options.container, 'timeline-control');
        
        // Get singleton instances
        this.dataModel = DataModel.getInstance();
        this.eventEmitter = EventEmitter.getInstance();
        this.pluginManager = PluginManager.getInstance();
        
        // Set initial options
        if (options.duration) {
            this.dataModel.setDuration(options.duration);
        }
        
        if (options.timeScale) {
            this.dataModel.setTimeScale(options.timeScale, this);
        }
        
        if (options.pixelsPerSecond) {
            this.dataModel.setPixelsPerSecond(options.pixelsPerSecond);
        }
        
        // Create the DOM structure and initialize
        this.mount();
    }
    
    /**
     * Initialize the timeline control
     */
    public initialize(): void {
        // Cache DOM elements
        this.toolbarEl = document.getElementById('timeline-toolbar');
        this.contentEl = document.getElementById('timeline-content');
        this.contentContainerEl = document.getElementById('timeline-content-container');
        this.layersContainerEl = document.getElementById('timeline-layers-container');
        this.keyframesAreaEl = document.getElementById('timeline-keyframes-area');
        this.timeRulerEl = document.getElementById('timeline-ruler');
        this.keyframesContainerEl = document.getElementById('timeline-keyframes-container');
        this.objectToolbarEl = document.getElementById('timeline-object-toolbar');
        
        // Set up scroll synchronization
        this.setupScrollSynchronization();
    }
    
    /**
     * Render the timeline control
     * @returns HTML string for the timeline
     */
    public render(): string {
        return `
            <div id="timeline-control" class="timeline-control">
                <div id="timeline-toolbar" class="timeline-toolbar"></div>
                <div id="timeline-content" class="timeline-content">
                    <div id="timeline-content-container" class="timeline-content-container">
                        <div id="timeline-layers-container" class="timeline-layers-container"></div>
                        <div id="timeline-keyframes-area" class="timeline-keyframes-area">
                            <div id="timeline-ruler" class="timeline-ruler">
                                <div class="timeline-ruler-content"></div>
                            </div>
                            <div id="timeline-keyframes-container" class="timeline-keyframes-container"></div>
                        </div>
                    </div>
                </div>
                <div id="timeline-object-toolbar" class="timeline-object-toolbar"></div>
            </div>
        `;
    }
    
    /**
     * Update the timeline control with new data
     * @param data The data to update with
     */
    public update(data: any): void {
        // This method would be called to update the timeline with new data
        // For now, we just pass the update to the data model
    }
    
    /**
     * Clean up the timeline control
     */
    public destroy(): void {
        // Clean up the plugin manager
        this.pluginManager.destroy();
        
        // Clear any event listeners
        if (this.keyframesContainerEl) {
            this.keyframesContainerEl.removeEventListener('scroll', this.handleKeyframesContainerScroll);
        }
        
        if (this.layersContainerEl) {
            this.layersContainerEl.removeEventListener('scroll', this.handleLayersContainerScroll);
        }
    }
    
    /**
     * Set up scroll synchronization between containers
     */
    private setupScrollSynchronization(): void {
        if (!this.keyframesContainerEl || !this.layersContainerEl || !this.timeRulerEl) {
            console.error('Cannot set up scroll synchronization: DOM elements not found');
            return;
        }
        
        // Sync vertical scrolling
        this.keyframesContainerEl.addEventListener('scroll', this.handleKeyframesContainerScroll);
        this.layersContainerEl.addEventListener('scroll', this.handleLayersContainerScroll);
    }
    
    /**
     * Handle scroll events on the keyframes container
     */
    private handleKeyframesContainerScroll = (): void => {
        if (!this.keyframesContainerEl || !this.layersContainerEl || !this.timeRulerEl) {
            return;
        }
        
        // Sync vertical scrolling with layers container
        this.layersContainerEl.scrollTop = this.keyframesContainerEl.scrollTop;
        
        // Sync horizontal scrolling with time ruler
        const rulerContent = this.timeRulerEl.querySelector('.timeline-ruler-content');
        if (rulerContent) {
            (rulerContent as HTMLElement).style.transform = 
                `translateX(-${this.keyframesContainerEl.scrollLeft}px)`;
        }
        
        // Emit scroll events
        this.eventEmitter.emit(Events.UI_SCROLL_HORIZONTAL, this, { 
            scrollLeft: this.keyframesContainerEl.scrollLeft 
        });
        
        this.eventEmitter.emit(Events.UI_SCROLL_VERTICAL, this, { 
            scrollTop: this.keyframesContainerEl.scrollTop 
        });
    };
    
    /**
     * Handle scroll events on the layers container
     */
    private handleLayersContainerScroll = (): void => {
        if (!this.keyframesContainerEl || !this.layersContainerEl) {
            return;
        }
        
        // Sync vertical scrolling with keyframes container
        this.keyframesContainerEl.scrollTop = this.layersContainerEl.scrollTop;
    };
    
    /**
     * Add a plugin to the timeline
     * @param plugin The plugin to add
     * @param metadata The plugin metadata
     * @returns True if the plugin was added successfully
     */
    public addPlugin(plugin: any, metadata: any): boolean {
        return this.pluginManager.register({
            plugin,
            metadata
        });
    }
    
    /**
     * Initialize all plugins
     * @returns True if all plugins were initialized successfully
     */
    public initializePlugins(): boolean {
        return this.pluginManager.initialize();
    }
    
    /**
     * Get the data model
     * @returns The data model instance
     */
    public getDataModel(): DataModel {
        return this.dataModel;
    }
    
    /**
     * Get the current time
     * @returns The current time in seconds
     */
    public getCurrentTime(): number {
        return this.dataModel.getCurrentTime();
    }
    
    /**
     * Set the current time
     * @param time The new time in seconds
     */
    public setCurrentTime(time: number): void {
        this.dataModel.setCurrentTime(time, this);
    }
    
    /**
     * Get the time scale
     * @returns The time scale factor
     */
    public getTimeScale(): number {
        return this.dataModel.getTimeScale();
    }
    
    /**
     * Set the time scale
     * @param scale The new time scale factor
     */
    public setTimeScale(scale: number): void {
        this.dataModel.setTimeScale(scale, this);
    }
    
    /**
     * Add a layer to the timeline
     * @param layer The layer data to add
     * @returns The added layer data
     */
    public addLayer(layer: any): any {
        return this.dataModel.addLayer(layer, this);
    }
    
    /**
     * Remove a layer from the timeline
     * @param layerId The ID of the layer to remove
     */
    public removeLayer(layerId: string): void {
        this.dataModel.removeLayer(layerId, this);
    }
    
    /**
     * Get all layers
     * @returns Array of layer data objects
     */
    public getLayers(): any[] {
        return this.dataModel.getLayers();
    }
    
    /**
     * Get a layer by ID
     * @param layerId The ID of the layer to retrieve
     * @returns The layer data or undefined if not found
     */
    public getLayer(layerId: string): any {
        return this.dataModel.getLayer(layerId);
    }
    
    /**
     * Select a layer
     * @param layerId The ID of the layer to select
     */
    public selectLayer(layerId: string | null): void {
        this.dataModel.selectLayer(layerId, this);
    }
    
    /**
     * Get the currently selected layer
     * @returns The selected layer data or null if none selected
     */
    public getSelectedLayer(): any {
        return this.dataModel.getSelectedLayer();
    }
    
    /**
     * Add a keyframe to the timeline
     * @param keyframe The keyframe data to add
     * @returns The added keyframe data
     */
    public addKeyframe(keyframe: any): any {
        return this.dataModel.addKeyframe(keyframe, this);
    }
    
    /**
     * Remove a keyframe from the timeline
     * @param keyframeId The ID of the keyframe to remove
     */
    public removeKeyframe(keyframeId: string): void {
        this.dataModel.removeKeyframe(keyframeId, this);
    }
    
    /**
     * Move a keyframe to a new time
     * @param keyframeId The ID of the keyframe to move
     * @param newTime The new time for the keyframe
     */
    public moveKeyframe(keyframeId: string, newTime: number): void {
        this.dataModel.moveKeyframe(keyframeId, newTime, this);
    }
    
    /**
     * Get all keyframes
     * @returns Array of keyframe data objects
     */
    public getKeyframes(): any[] {
        return this.dataModel.getKeyframes();
    }
    
    /**
     * Get keyframes for a specific layer
     * @param layerId The ID of the layer
     * @returns Array of keyframe data objects for the layer
     */
    public getKeyframesForLayer(layerId: string): any[] {
        return this.dataModel.getKeyframesForLayer(layerId);
    }
    
    /**
     * Select a keyframe
     * @param keyframeId The ID of the keyframe to select
     */
    public selectKeyframe(keyframeId: string | null): void {
        this.dataModel.selectKeyframe(keyframeId, this);
    }
    
    /**
     * Get the currently selected keyframe
     * @returns The selected keyframe data or null if none selected
     */
    public getSelectedKeyframe(): any {
        return this.dataModel.getSelectedKeyframe();
    }
}
