/**
 * TimelineControl class
 * Main control that coordinates plugins and manages the timeline interface
 */

import { BaseComponent } from '../components/BaseComponent';
import { SceneSelector } from '../components/SceneSelector';
import { EventEmitter } from '../core/EventEmitter';
import { DataModel, ITimelineOptions, ILayer } from '../core/DataModel';
import { PluginManager } from '../core/PluginManager';
import { Events, CssClasses, PluginIds } from '../constants/Constants';
import { LayerManager } from '../plugins/LayerManager';

// Timeline control options
export interface ITimelineControlOptions {
    // Container element or ID
    container: HTMLElement | string;
    // Timeline options
    timeline?: Partial<ITimelineOptions>;
    // Plugins to load
    plugins?: Record<string, any>;
}

export class TimelineControl extends BaseComponent {
    private eventEmitter: EventEmitter;
    private dataModel: DataModel;
    private pluginManager: PluginManager;
    private sceneSelector: SceneSelector | null = null;
    
    // DOM elements
    private toolbarEl: HTMLElement | null = null;
    private contentEl: HTMLElement | null = null;
    private contentContainerEl: HTMLElement | null = null;
    private layersContainerEl: HTMLElement | null = null;
    private layersHeaderEl: HTMLElement | null = null;
    private layersListEl: HTMLElement | null = null;
    private layersToolbarEl: HTMLElement | null = null;
    private keyframesAreaEl: HTMLElement | null = null;
    private timeRulerEl: HTMLElement | null = null;
    private keyframesContainerEl: HTMLElement | null = null;
    private playbackToolbarEl: HTMLElement | null = null;
    private objectToolbarEl: HTMLElement | null = null;
    
    /**
     * Constructor for TimelineControl
     * @param options - Configuration options
     */
    constructor(options: ITimelineControlOptions) {
        super(options.container, 'timeline-control');
        
        // Create event emitter
        this.eventEmitter = new EventEmitter();
        
        // Create data model with timeline options
        this.dataModel = new DataModel(options.timeline);
        
        // Create plugin manager
        this.pluginManager = new PluginManager(this.eventEmitter);
        
        // Register plugins if provided
        if (options.plugins) {
            Object.entries(options.plugins).forEach(([id, plugin]) => {
                this.pluginManager.register(id, plugin);
            });
        }
    }
    
    /**
     * Initialize the timeline control
     */
    public initialize(): void {
        console.log('Initializing TimelineControl...');
        
        try {
            // Create DOM structure if it doesn't exist
            if (!this.element) {
                console.log('Main element does not exist, mounting component...');
                // First mount the component to create the main element
                this.mount();
                console.log('Component mounted');
                
                // Then create the inner DOM structure
                this.createDomStructure();
                console.log('DOM structure created');
            }
              // Check that all required DOM elements exist
            if (!this.toolbarEl || !this.contentEl || !this.contentContainerEl || !this.layersContainerEl ||
                !this.layersHeaderEl || !this.layersListEl || !this.layersToolbarEl ||
                !this.keyframesAreaEl || !this.timeRulerEl || !this.keyframesContainerEl || 
                !this.playbackToolbarEl || !this.objectToolbarEl) {
                throw new Error('Required DOM elements not found after initialization');
            }
              // Set up scroll synchronization
            console.log('Setting up scroll synchronization...');
            this.setupScrollSynchronization();
            
            // Verify and adjust alignment
            console.log('Verifying layer-keyframe alignment...');
            this.verifyAlignment();              // Set up the toolbar components
            this.setupToolbar();
            
            // Verify that a default layer exists
            this.verifyDefaultLayer();
            
            // Set up event listeners
            this.eventEmitter.on(Events.TIMELINE_RESIZED, this.handleResize.bind(this));
            
            // Initialize plugins last to ensure DOM is ready
            console.log('All TimelineControl DOM elements ready, initializing plugins...');
            
            // Emit init event
            console.log('Emitting TIMELINE_INIT event');
            this.eventEmitter.emit(Events.TIMELINE_INIT, this.dataModel.getState(), this);
            
            console.log('TimelineControl initialized successfully');
        } catch (error) {
            console.error('Error initializing TimelineControl:', error);
            throw error; // Rethrow to notify callers
        }
    }
      /**
     * Render the timeline control
     * @returns HTML string representation
     */
    public render(): string {
        return `
            <div class="${CssClasses.TIMELINE_CONTROL}" id="${this.id}">
                <div class="${CssClasses.TIMELINE_TOOLBAR}"></div>
                <div class="${CssClasses.TIMELINE_CONTENT}">
                    <div class="${CssClasses.TIMELINE_CONTENT_CONTAINER}">                        <div class="${CssClasses.TIMELINE_LAYERS_CONTAINER}">
                            <div class="${CssClasses.TIMELINE_LAYERS_HEADER}"></div>
                            <div class="${CssClasses.LAYER_LIST}"></div>
                            <div class="${CssClasses.TIMELINE_LAYERS_TOOLBAR}"></div>
                        </div>
                        <div class="${CssClasses.TIMELINE_KEYFRAMES_AREA}">
                            <div class="${CssClasses.TIMELINE_RULER}"></div>
                            <div class="${CssClasses.TIMELINE_KEYFRAMES_CONTAINER}"></div>
                            <div class="${CssClasses.TIMELINE_PLAYBACK_TOOLBAR}"></div>
                        </div>
                    </div>
                </div>
                <div class="${CssClasses.TIMELINE_OBJECT_TOOLBAR}"></div>
            </div>
        `;
    }
      /**
     * Update the timeline control
     * @param data - New data for the timeline
     */
    public update(data?: any): void {
        if (data) {
            this.dataModel.setState(data);
        }
        
        // Verify default layer to ensure we always have at least one layer
        this.verifyDefaultLayer();
    }
    
    /**
     * Destroy the timeline control and clean up resources
     */
    public destroy(): void {
        // Destroy all plugins
        this.pluginManager.destroyAll();
        
        // Remove event listeners
        this.eventEmitter.clear();
        
        // Emit destroyed event
        this.eventEmitter.emit(Events.TIMELINE_DESTROYED, {}, this);
    }
    
    /**
     * Create the DOM structure for the timeline control
     */    private createDomStructure(): void {
        // Check if element already exists
        if (!this.element) {
            // Render without initializing to avoid recursion
            const html = this.render();
            this.container.innerHTML = html;
            this.element = this.container.firstElementChild as HTMLElement;
        }
        
        // Get the DOM elements
        if (!this.element) {
            throw new Error('Failed to create timeline control element');
        }
        
        this.toolbarEl = this.element.querySelector(`.${CssClasses.TIMELINE_TOOLBAR}`);
        this.contentEl = this.element.querySelector(`.${CssClasses.TIMELINE_CONTENT}`);
        this.contentContainerEl = this.element.querySelector(`.${CssClasses.TIMELINE_CONTENT_CONTAINER}`);        this.layersContainerEl = this.element.querySelector(`.${CssClasses.TIMELINE_LAYERS_CONTAINER}`);
        this.layersHeaderEl = this.element.querySelector(`.${CssClasses.TIMELINE_LAYERS_HEADER}`);
        this.layersListEl = this.element.querySelector(`.${CssClasses.LAYER_LIST}`);
        this.layersToolbarEl = this.element.querySelector(`.${CssClasses.TIMELINE_LAYERS_TOOLBAR}`);
        this.keyframesAreaEl = this.element.querySelector(`.${CssClasses.TIMELINE_KEYFRAMES_AREA}`);
        this.timeRulerEl = this.element.querySelector(`.${CssClasses.TIMELINE_RULER}`);
        this.keyframesContainerEl = this.element.querySelector(`.${CssClasses.TIMELINE_KEYFRAMES_CONTAINER}`);
        this.playbackToolbarEl = this.element.querySelector(`.${CssClasses.TIMELINE_PLAYBACK_TOOLBAR}`);
        this.objectToolbarEl = this.element.querySelector(`.${CssClasses.TIMELINE_OBJECT_TOOLBAR}`);
        
        // Initialize the layers header with column titles
        if (this.layersHeaderEl) {
            this.layersHeaderEl.innerHTML = `
                <div class="layers-header-title">Layers</div>
                <div class="layers-header-actions">
                    <span class="header-icon" title="Toggle visibility of all layers">👁️</span>
                    <span class="header-icon" title="Toggle lock of all layers">🔓</span>
                </div>
            `;
        }
          
        if (!this.toolbarEl || !this.contentEl || !this.contentContainerEl || !this.layersContainerEl ||
            !this.keyframesAreaEl || !this.timeRulerEl || !this.keyframesContainerEl || !this.objectToolbarEl ||
            !this.layersHeaderEl || !this.layersListEl || !this.layersToolbarEl || !this.playbackToolbarEl) {
            throw new Error('Failed to get all timeline control elements');
        }
    }    /**
     * Set up scroll synchronization between layers and keyframes
     */
    private setupScrollSynchronization(): void {
        if (!this.layersContainerEl || !this.layersListEl || !this.keyframesContainerEl || !this.timeRulerEl) {
            throw new Error('Cannot set up scroll synchronization - required elements not found');
        }
        
        console.log('Setting up scroll synchronization...');
        
        // Sync vertical scrolling with debouncing to prevent loops
        let isScrollingKeyframes = false;
        let isScrollingLayers = false;
        
        // Keyframes to Layers sync
        this.keyframesContainerEl.addEventListener('scroll', () => {
            if (!isScrollingLayers && this.layersListEl) {
                isScrollingKeyframes = true;
                this.layersListEl.scrollTop = this.keyframesContainerEl!.scrollTop;
                setTimeout(() => { isScrollingKeyframes = false; }, 10);
            }
        });
        
        // Layers to Keyframes sync
        this.layersListEl.addEventListener('scroll', () => {
            if (!isScrollingKeyframes && this.keyframesContainerEl) {
                isScrollingLayers = true;
                this.keyframesContainerEl.scrollTop = this.layersListEl!.scrollTop;
                setTimeout(() => { isScrollingLayers = false; }, 10);
            }
        });
        
        // Sync horizontal scrolling between ruler and keyframes
        this.keyframesContainerEl.addEventListener('scroll', () => {
            const rulerContent = this.timeRulerEl!.querySelector('.timeline-ruler-content');
            if (rulerContent) {
                (rulerContent as HTMLElement).style.transform = 
                    `translateX(-${this.keyframesContainerEl!.scrollLeft}px)`;
            } else {
                console.error('Ruler content element not found');
            }
            
            // Emit scroll event
            this.eventEmitter.emit(Events.SCROLL_HORIZONTAL, {
                position: this.keyframesContainerEl!.scrollLeft
            }, this);
        });
        
        console.log('Scroll synchronization set up successfully');
    }    /**
     * Handle resize event
     */
    private handleResize(): void {
        // Update the timeline display and verify alignment
        this.verifyAlignment();
        
        // Emit resize event
        this.eventEmitter.emit(Events.TIMELINE_RESIZED, {
            width: this.element?.clientWidth,
            height: this.element?.clientHeight
        }, this);
    }
    
    /**
     * Set up the toolbar components
     */
    private setupToolbar(): void {
        if (!this.toolbarEl) {
            throw new Error('Toolbar element not found');
        }
        
        console.log('Setting up toolbar components...');
        
        // Create scene selector
        this.sceneSelector = new SceneSelector({
            container: this.toolbarEl,
            dataModel: this.dataModel,
            eventEmitter: this.eventEmitter
        });
        
        this.sceneSelector.mount();
        this.sceneSelector.initialize();
        
        // Add keyframe button
        const addKeyframeBtn = document.createElement('button');
        addKeyframeBtn.className = CssClasses.ADD_KEYFRAME_BUTTON;
        addKeyframeBtn.textContent = 'Add Keyframe';
        addKeyframeBtn.title = 'Add a keyframe at the current time';
        addKeyframeBtn.addEventListener('click', this.handleAddKeyframeClick.bind(this));
        
        this.toolbarEl.appendChild(addKeyframeBtn);
    }
    
    /**
     * Handle add keyframe button click
     */
    private handleAddKeyframeClick(): void {
        // Get selected layer IDs
        const selectedLayerIds = this.dataModel.getSelectedLayerIds();
        
        if (selectedLayerIds.length === 0) {
            console.warn('No layers selected. Cannot add keyframe.');
            return;
        }
        
        // Get current time
        const currentTime = this.dataModel.getCurrentTime();
        
        // Add keyframe to all selected layers
        selectedLayerIds.forEach(layerId => {
            const keyframeId = `keyframe-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            
            this.dataModel.addKeyframe(layerId, {
                id: keyframeId,
                time: currentTime,
                value: {} // Default empty value
            });
        });
    }
      /**
     * Verify and adjust alignment between layers and keyframes
     */
    private verifyAlignment(): void {
        if (!this.layersHeaderEl || !this.timeRulerEl || 
            !this.layersListEl || !this.keyframesContainerEl ||
            !this.layersToolbarEl || !this.playbackToolbarEl) {
            return;
        }
        
        // Ensure headers have the same height
        const layersHeaderHeight = this.layersHeaderEl.clientHeight;
        const timeRulerHeight = this.timeRulerEl.clientHeight;
        
        if (layersHeaderHeight !== timeRulerHeight) {
            console.warn(`Header height mismatch: layers=${layersHeaderHeight}px, ruler=${timeRulerHeight}px`);
            
            // Force them to have the same computed height
            this.layersHeaderEl.style.height = `${timeRulerHeight}px`;
        }
        
        // Ensure toolbars have the same height
        const layersToolbarHeight = this.layersToolbarEl.clientHeight;
        const playbackToolbarHeight = this.playbackToolbarEl.clientHeight;
        
        if (layersToolbarHeight !== playbackToolbarHeight) {
            console.warn(`Toolbar height mismatch: layers=${layersToolbarHeight}px, playback=${playbackToolbarHeight}px`);
            
            // Force them to have the same computed height
            this.layersToolbarEl.style.height = `${playbackToolbarHeight}px`;
        }
    }
      /**
     * Public method to ensure at least one layer exists
     * Used after plugin initialization
     */
    public ensureDefaultLayer(): void {
        this.verifyDefaultLayer();
    }
      /**
     * Verify that at least one default layer exists
     * Create one if none exists
     */
    private verifyDefaultLayer(): void {
        const layers = this.dataModel.getLayers();
        const layerCount = Object.keys(layers).length;
        
        console.log(`Verifying default layer... Found ${layerCount} layers.`);
        
        // If no layers exist, create a default one
        if (layerCount === 0) {
            console.log('No layers found. Creating default layer...');
            
            try {
                // Create default layer using our centralized addLayer method
                const defaultLayer = this.addLayer({
                    name: 'Default Layer',
                    order: 0,
                    color: '#4A90E2' // Default blue color
                });
                
                console.log('Default layer created successfully with ID:', defaultLayer.id);
            } catch (error) {
                console.error('Error creating default layer:', error);
            }
        } else {
            console.log('Existing layers found, no need to create default layer.');
        }
    }
    
    /**
     * Get the event emitter instance
     * @returns EventEmitter instance
     */
    public getEventEmitter(): EventEmitter {
        return this.eventEmitter;
    }
    
    /**
     * Get the data model instance
     * @returns DataModel instance
     */
    public getDataModel(): DataModel {
        return this.dataModel;
    }
    
    /**
     * Get the plugin manager instance
     * @returns PluginManager instance
     */
    public getPluginManager(): PluginManager {
        return this.pluginManager;
    }      /**
     * Get a specific DOM element
     * @param elementClass - CSS class of the element to get
     * @param required - Whether the element is required (throws if not found)
     * @returns The DOM element if found, null otherwise
     * @throws Error if the element is not found and is marked as required
     */    public getDomElement(elementClass: string, required: boolean = false): HTMLElement | null {
        let element: HTMLElement | null = null;
        
        // Map the element class to actual DOM elements using switch statement
        switch (elementClass) {
            case 'timeline-toolbar':
            case CssClasses.TIMELINE_TOOLBAR:
                element = this.toolbarEl;
                break;
            case 'timeline-content':
            case CssClasses.TIMELINE_CONTENT:
                element = this.contentEl;
                break;
            case 'timeline-content-container':
            case CssClasses.TIMELINE_CONTENT_CONTAINER:
                element = this.contentContainerEl;
                break;
            case 'timeline-layers-container':
            case CssClasses.TIMELINE_LAYERS_CONTAINER:
                element = this.layersContainerEl;
                break;            case 'timeline-layers-header':
            case CssClasses.TIMELINE_LAYERS_HEADER:
                element = this.layersHeaderEl;
                break;
            case 'timeline-layer-list':
            case CssClasses.LAYER_LIST:
                element = this.layersListEl;
                break;
            case 'timeline-layers-toolbar':
            case CssClasses.TIMELINE_LAYERS_TOOLBAR:
                element = this.layersToolbarEl;
                break;
            case 'timeline-keyframes-area':
            case CssClasses.TIMELINE_KEYFRAMES_AREA:
                element = this.keyframesAreaEl;
                break;
            case 'timeline-ruler':
            case CssClasses.TIMELINE_RULER:
                element = this.timeRulerEl;
                break;
            case 'timeline-keyframes-container':
            case CssClasses.TIMELINE_KEYFRAMES_CONTAINER:
                element = this.keyframesContainerEl;
                break;
            case 'timeline-playback-toolbar':
            case CssClasses.TIMELINE_PLAYBACK_TOOLBAR:
                element = this.playbackToolbarEl;
                break;
            case 'timeline-object-toolbar':
            case CssClasses.TIMELINE_OBJECT_TOOLBAR:
                element = this.objectToolbarEl;
                break;
            default:
                element = this.element ? this.element.querySelector(`.${elementClass}`) : null;
                break;
        }
        
        if (!element && required) {
            throw new Error(`Required DOM element with class "${elementClass}" not found`);
        }
        
        return element;
    }
      /**
     * Add a new layer to the timeline
     * @param layer - Layer to add, if not provided a layer with default values will be created
     * @param selectLayer - Whether to select the layer after adding (defaults to true)
     * @returns The created/added layer
     */
    public addLayer(layer?: Partial<ILayer>, selectLayer: boolean = true): ILayer {
        // Generate a unique ID with timestamp
        const timestamp = Date.now();
        const randomNum = Math.floor(Math.random() * 10000);
        const layerId = layer?.id || `layer-${timestamp}-${randomNum}`;
        
        // Generate a random color but ensure it's reasonably bright (not too dark)
        const getRandomColorComponent = () => Math.floor(Math.random() * 156) + 100; // 100-255
        const color = layer?.color || `rgb(${getRandomColorComponent()}, ${getRandomColorComponent()}, ${getRandomColorComponent()})`;
        
        // Calculate layer order (put new layer at the top)
        const layerCount = this.dataModel.getLayerCount();
        
        // Create a new layer with default values that can be overridden
        const newLayer: ILayer = {
            id: layerId,
            name: layer?.name || `Layer ${layerCount + 1}`,
            order: layer?.order !== undefined ? layer.order : layerCount,
            visible: layer?.visible !== undefined ? layer.visible : true,
            locked: layer?.locked !== undefined ? layer.locked : false,
            color: color,
            keyframes: layer?.keyframes || {},
            parent: layer?.parent || null,
            isGroup: layer?.isGroup || false,
            children: layer?.children || []
        };
        
        // Add the layer to the data model - this will emit LAYER_ADDED event
        // and automatically update all plugins that listen to this event
        this.dataModel.addLayer(newLayer);
          // Select the new layer if selectLayer is true
        if (selectLayer) {
            this.dataModel.clearLayerSelection();
            this.dataModel.selectLayer(layerId);
        }
        
        console.log('Added new layer:', newLayer);
        
        return newLayer;
    }
}
