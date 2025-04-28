/**
 * TimelineControl class
 * Main control that coordinates plugins and manages the timeline interface
 */

import { BaseComponent } from '../components/BaseComponent';
import { EventEmitter } from '../core/EventEmitter';
import { DataModel, ITimelineOptions, ILayer, KeyframeType, TweenType } from '../core/DataModel';
import { PluginManager } from '../core/PluginManager';
import { Events, CssClasses } from '../constants/Constants';
import { KeyboardHandler } from '../utils/KeyboardHandler';
import { SceneSelector } from '../components/SceneSelector';

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
    private keyboardHandler: KeyboardHandler | null = null;    // DOM elements
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
    private objectToolbarEl: HTMLElement | null = null;
    private sceneSelector: SceneSelector | null = null;
    
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
        // Create DOM structure if it doesn't exist
        if (!this.element) {
            // First mount the component to create the main element
            this.mount();
            // Then create the inner DOM structure
            this.createDomStructure();
        }
          // Set up scroll synchronization
        this.setupScrollSynchronization();
        
        // Set up the toolbar components
        this.setupToolbar();
        
        // Set up layers resize functionality
        this.setupLayersResize();
        
        // Verify alignment of layers and keyframes
        this.verifyAlignment();
        
        // Verify default layer exists
        this.verifyDefaultLayer();
        
        // Initialize keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        // Initialize plugins
        this.pluginManager.initializeAll();
        
        // Set up event listeners
        this.eventEmitter.on(Events.TIMELINE_RESIZED, this.handleResize.bind(this));
        
        // Emit init event
        this.eventEmitter.emit(Events.TIMELINE_INIT, this.dataModel.getState(), this);
        
        // Set up the toolbar components
        this.setupToolbar();
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
                    <div class="${CssClasses.TIMELINE_CONTENT_CONTAINER}">
                        <div class="${CssClasses.TIMELINE_LAYERS_CONTAINER}">
                            <div class="${CssClasses.TIMELINE_LAYERS_HEADER}"></div>
                            <div class="${CssClasses.LAYER_LIST}"></div>
                            <div class="${CssClasses.TIMELINE_LAYERS_TOOLBAR}"></div>
                        </div>
                        <div class="${CssClasses.TIMELINE_KEYFRAMES_AREA}">
                            <div class="${CssClasses.TIMELINE_RULER}"></div>
                            <div class="${CssClasses.TIMELINE_KEYFRAMES_CONTAINER}"></div>
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
     */
    private createDomStructure(): void {
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
        this.contentContainerEl = this.element.querySelector(`.${CssClasses.TIMELINE_CONTENT_CONTAINER}`);
        this.layersContainerEl = this.element.querySelector(`.${CssClasses.TIMELINE_LAYERS_CONTAINER}`);
        this.layersHeaderEl = this.element.querySelector(`.${CssClasses.TIMELINE_LAYERS_HEADER}`);
        this.layersListEl = this.element.querySelector(`.${CssClasses.LAYER_LIST}`);
        this.layersToolbarEl = this.element.querySelector(`.${CssClasses.TIMELINE_LAYERS_TOOLBAR}`);
        this.keyframesAreaEl = this.element.querySelector(`.${CssClasses.TIMELINE_KEYFRAMES_AREA}`);
        this.timeRulerEl = this.element.querySelector(`.${CssClasses.TIMELINE_RULER}`);
        this.keyframesContainerEl = this.element.querySelector(`.${CssClasses.TIMELINE_KEYFRAMES_CONTAINER}`);
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
            !this.layersHeaderEl || !this.layersListEl || !this.layersToolbarEl || 
            !this.keyframesAreaEl || !this.timeRulerEl || !this.keyframesContainerEl || !this.objectToolbarEl) {
            throw new Error('Failed to get all timeline control elements');
        }
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
     * Handle adding a keyframe at the current playhead position
     */
    private handleAddKeyframeClick(): void {
        const selectedLayerIds = this.dataModel.getSelectedLayerIds();
        const currentTime = this.dataModel.getCurrentTime();
        
        if (selectedLayerIds.length === 0) {
            console.warn('No layer selected for keyframe addition');
            return;
        }
        
        // Add a keyframe to each selected layer
        selectedLayerIds.forEach(layerId => {
            const keyframeId = `keyframe-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
            const keyframe = {
                id: keyframeId,
                time: currentTime,
                value: {}, // Default value
                type: KeyframeType.SOLID
            };
            
            this.dataModel.addKeyframe(layerId, keyframe);
        });
    }
    
    /**
     * Set up scroll synchronization between layers and keyframes
     */
    private setupScrollSynchronization(): void {
        if (!this.layersContainerEl || !this.layersListEl || !this.keyframesContainerEl || !this.timeRulerEl) {
            return;
        }
        
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
            }
            
            // Emit scroll event
            this.eventEmitter.emit(Events.SCROLL_HORIZONTAL, {
                position: this.keyframesContainerEl!.scrollLeft
            }, this);
        });
    }
    
    /**
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
    }
    
    /**
     * Get a specific DOM element
     * @param elementClass - CSS class of the element to get
     * @returns The DOM element if found, null otherwise
     */
    public getDomElement(elementClass: string): HTMLElement | null {
        // Map the element class to actual DOM elements using switch statement
        switch (elementClass) {
            case 'timeline-toolbar':
            case CssClasses.TIMELINE_TOOLBAR:
                return this.toolbarEl;
            case 'timeline-content':
            case CssClasses.TIMELINE_CONTENT:
                return this.contentEl;
            case 'timeline-content-container':
            case CssClasses.TIMELINE_CONTENT_CONTAINER:
                return this.contentContainerEl;
            case 'timeline-layers-container':
            case CssClasses.TIMELINE_LAYERS_CONTAINER:
                return this.layersContainerEl;
            case 'timeline-layers-header':
            case CssClasses.TIMELINE_LAYERS_HEADER:
                return this.layersHeaderEl;
            case 'timeline-layer-list':
            case CssClasses.LAYER_LIST:
                return this.layersListEl;
            case 'timeline-layers-toolbar':
            case CssClasses.TIMELINE_LAYERS_TOOLBAR:
                return this.layersToolbarEl;
            case 'timeline-keyframes-area':
            case CssClasses.TIMELINE_KEYFRAMES_AREA:
                return this.keyframesAreaEl;
            case 'timeline-ruler':
            case CssClasses.TIMELINE_RULER:
                return this.timeRulerEl;
            case 'timeline-keyframes-container':
            case CssClasses.TIMELINE_KEYFRAMES_CONTAINER:
                return this.keyframesContainerEl;
            case 'timeline-object-toolbar':
            case CssClasses.TIMELINE_OBJECT_TOOLBAR:
                return this.objectToolbarEl;
            default:
                return this.element ? this.element.querySelector(`.${elementClass}`) : null;
        }
    }
    
    /**
     * Set up keyboard shortcuts for common timeline operations
     */
    private setupKeyboardShortcuts(): void {
        // Initialize the KeyboardHandler if it doesn't exist
        if (!this.keyboardHandler && this.element) {
            this.keyboardHandler = new KeyboardHandler({
                eventEmitter: this.eventEmitter,
                dataModel: this.dataModel,
                timelineElement: this.element
            });
        }
    }
    
    /**
     * Ensures that a default layer exists in the timeline
     * @returns The default layer ID
     */
    public ensureDefaultLayer(): string {
        return this.verifyDefaultLayer();
    }
    
    /**
     * Add a new layer to the timeline
     * @param nameOrLayer - Name of the layer or complete layer object
     * @param options - Additional layer options (when first param is a string)
     * @returns ID of the new layer
     */
    public addLayer(nameOrLayer: string | ILayer, options: Partial<ILayer> = {}): string {
        let layer: ILayer;
        
        if (typeof nameOrLayer === 'string') {
            // Generate a unique ID for the layer
            const id = `layer_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
            
            // Create the layer object from name and options
            layer = {
                id,
                name: nameOrLayer,
                visible: true,
                locked: false,
                order: this.getNextLayerOrder(),
                keyframes: {},
                ...options
            };
        } else {
            // Use the provided layer object directly
            layer = nameOrLayer;
        }
        
        // Add the layer to the data model
        this.dataModel.addLayer(layer);
        
        return layer.id;
    }

    /**
     * Get the next available layer order value
     * @returns Next layer order number
     */
    private getNextLayerOrder(): number {
        const layers = Object.values(this.dataModel.getLayers());
        if (layers.length === 0) {
            return 0;
        }
        
        // Find the highest order value and add 1
        return Math.max(...layers.map(layer => layer.order)) + 1;
    }

    /**
     * Setup layer resize functionality
     * Handles resizing of the layers panel
     */
    private setupLayersResize(): void {
        // Implementation for layer resize functionality
        if (!this.layersContainerEl || !this.keyframesAreaEl) {
            return;
        }
        
        // Add resize handle between layers and keyframes
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'timeline-resize-handle';
        this.contentContainerEl?.appendChild(resizeHandle);
        
        // Handle mouse events for resizing
        let isDragging = false;
        let startX = 0;
        let startWidth = 0;
        
        resizeHandle.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startWidth = this.layersContainerEl!.offsetWidth;
            document.body.style.cursor = 'ew-resize';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const dx = e.clientX - startX;
            const newWidth = Math.max(100, startWidth + dx); // Minimum width of 100px
            
            this.layersContainerEl!.style.width = `${newWidth}px`;
            this.keyframesAreaEl!.style.left = `${newWidth}px`;
            this.keyframesAreaEl!.style.width = `calc(100% - ${newWidth}px)`;
            
            // Emit resize event
            this.eventEmitter.emit(Events.TIMELINE_RESIZED, {}, this);
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
            document.body.style.cursor = '';
        });
    }

    /**
     * Verify that the layers container and keyframes container are properly aligned
     */
    private verifyAlignment(): void {
        if (!this.layersContainerEl || !this.keyframesContainerEl) {
            return;
        }
        
        // Ensure the heights match for proper scrolling alignment
        const layersHeight = this.layersContainerEl.scrollHeight;
        const keyframesHeight = this.keyframesContainerEl.scrollHeight;
        
        if (layersHeight !== keyframesHeight) {
            // Adjust the container with the smaller height to match the larger one
            const maxHeight = Math.max(layersHeight, keyframesHeight);
            
            if (layersHeight < maxHeight) {
                const spacer = document.createElement('div');
                spacer.style.height = `${maxHeight - layersHeight}px`;
                spacer.className = 'timeline-height-spacer';
                this.layersContainerEl.appendChild(spacer);
            }
            
            if (keyframesHeight < maxHeight) {
                const spacer = document.createElement('div');
                spacer.style.height = `${maxHeight - keyframesHeight}px`;
                spacer.className = 'timeline-height-spacer';
                this.keyframesContainerEl.appendChild(spacer);
            }
        }
    }
    
    /**
     * Verify that at least one layer exists in the timeline, creating one if needed
     * @returns ID of the default layer (first layer)
     */
    private verifyDefaultLayer(): string {
        const layers = Object.values(this.dataModel.getLayers());
        
        // If no layers exist, create a default one
        if (layers.length === 0) {
            return this.addLayer('Layer 1');
        }
        
        // Use the first layer as the default
        return layers[0].id;
    }
}