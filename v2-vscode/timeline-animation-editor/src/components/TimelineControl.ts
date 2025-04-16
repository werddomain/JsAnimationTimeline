import { PluginManager } from '../core/PluginManager';
import { EventEmitter } from '../core/EventEmitter';
import { DataModel } from '../core/DataModel';
import { CSS_CLASSES, DIMENSIONS } from '../utils/Constants';
import { EVENT_TYPES } from '../utils/EventTypes';
import { TimeRuler } from '../plugins/TimeManagement/TimeRuler';
import { LayerManager } from '../plugins/LayerManagement/LayerManager';
import { KeyframeManager } from '../plugins/KeyframeManagement/KeyframeManager';
import { GroupManager } from '../plugins/GroupManagement/GroupManager';

export class TimelineControl {
    private mainContainer: HTMLElement;
    private toolbarEl!: HTMLElement;
    private contentEl!: HTMLElement;
    private contentContainerEl!: HTMLElement;
    private layersContainerEl!: HTMLElement;
    private keyframesAreaEl!: HTMLElement;
    private rulerEl!: HTMLElement;
    private keyframesContainerEl!: HTMLElement;
    private objectToolbarEl!: HTMLElement;
    private eventEmitter: EventEmitter<string>;
    private pluginManager: PluginManager;
    private timeScale: number = 1;
    private pixelsPerSecond: number = 100;
    
    // Plugins - will be loaded dynamically but typed here for convenience
    private timeRuler: TimeRuler | null = null;
    private layerManager: LayerManager | null = null;
    private keyframeManager: KeyframeManager | null = null;
    private groupManager: GroupManager | null = null;
    
    constructor(containerId: string) {
        this.mainContainer = document.getElementById(containerId) as HTMLElement;
        if (!this.mainContainer) {
            throw new Error(`Container with ID "${containerId}" not found`);
        }
        
        // Set up DOM structure
        this.setupDomStructure();
          // Create event emitter
        this.eventEmitter = new EventEmitter<string>();
        
        // Create plugin manager with a new DataModel
        this.pluginManager = new PluginManager(this.eventEmitter, new DataModel(this.eventEmitter));
        
        // Register plugins
        this.registerPlugins();
        
        // Initialize plugins
        this.initializePlugins();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Set up scroll synchronization
        this.setupScrollSynchronization();
    }
    
    private setupDomStructure(): void {
        this.toolbarEl = this.mainContainer.querySelector('#timeline-toolbar') as HTMLElement;
        this.contentEl = this.mainContainer.querySelector('#timeline-content') as HTMLElement;
        this.contentContainerEl = this.mainContainer.querySelector('#timeline-content-container') as HTMLElement;
        this.layersContainerEl = this.mainContainer.querySelector('#timeline-layers-container') as HTMLElement;
        this.keyframesAreaEl = this.mainContainer.querySelector('#timeline-keyframes-area') as HTMLElement;
        this.rulerEl = this.mainContainer.querySelector('#timeline-ruler') as HTMLElement;
        this.keyframesContainerEl = this.mainContainer.querySelector('#timeline-keyframes-container') as HTMLElement;
        this.objectToolbarEl = this.mainContainer.querySelector('#timeline-object-toolbar') as HTMLElement;
        
        if (!this.toolbarEl || !this.contentEl || !this.contentContainerEl || 
            !this.layersContainerEl || !this.keyframesAreaEl || !this.rulerEl || 
            !this.keyframesContainerEl || !this.objectToolbarEl) {
            throw new Error('Timeline DOM structure is incomplete. Check your HTML.');
        }
    }
      private registerPlugins(): void {
        // Create and register time ruler
        const timeRuler = new TimeRuler({
            container: this.rulerEl,
            eventEmitter: this.eventEmitter,
            timeScale: this.timeScale
        });
        this.pluginManager.loadPlugin(timeRuler);
        
        // Create and register layer manager
        const layerManager = new LayerManager({
            container: this.layersContainerEl,
            eventEmitter: this.eventEmitter
        });
        this.pluginManager.loadPlugin(layerManager);
        
        // Create and register keyframe manager
        const keyframeManager = new KeyframeManager({
            container: this.keyframesContainerEl,
            eventEmitter: this.eventEmitter,
            timeScale: this.timeScale,
            pixelsPerSecond: this.pixelsPerSecond
        });
        this.pluginManager.loadPlugin(keyframeManager);
        
        // Create and register group manager
        const groupManager = new GroupManager({
            container: this.layersContainerEl,
            eventEmitter: this.eventEmitter
        });
        this.pluginManager.loadPlugin(groupManager);
    }
    
    private initializePlugins(): void {
        // Initialize all plugins
        this.pluginManager.initializePlugins();
        
        // Get references to plugin instances
        this.timeRuler = this.pluginManager.getPlugin('timeRuler') as TimeRuler;
        this.layerManager = this.pluginManager.getPlugin('layerManager') as LayerManager;
        this.keyframeManager = this.pluginManager.getPlugin('keyframeManager') as KeyframeManager;
        this.groupManager = this.pluginManager.getPlugin('groupManager') as GroupManager;
    }
    
    private setupEventListeners(): void {
        // Set up toolbar button event listeners
        const addLayerBtn = this.toolbarEl.querySelector('#add-layer-btn');
        if (addLayerBtn) {
            addLayerBtn.addEventListener('click', this.handleAddLayer.bind(this));
        }
        
        const addKeyframeBtn = this.toolbarEl.querySelector('#add-keyframe-btn');
        if (addKeyframeBtn) {
            addKeyframeBtn.addEventListener('click', this.handleAddKeyframe.bind(this));
        }
        
        const zoomInBtn = this.toolbarEl.querySelector('#zoom-in-btn');
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', this.handleZoomIn.bind(this));
        }
        
        const zoomOutBtn = this.toolbarEl.querySelector('#zoom-out-btn');
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', this.handleZoomOut.bind(this));
        }
        
        const playBtn = this.toolbarEl.querySelector('#play-btn');
        if (playBtn) {
            playBtn.addEventListener('click', this.handlePlay.bind(this));
        }
        
        const stopBtn = this.toolbarEl.querySelector('#stop-btn');
        if (stopBtn) {
            stopBtn.addEventListener('click', this.handleStop.bind(this));
        }
    }
    
    private setupScrollSynchronization(): void {
        // Sync vertical scrolling
        this.keyframesContainerEl.addEventListener('scroll', () => {
            this.layersContainerEl.scrollTop = this.keyframesContainerEl.scrollTop;
        });
        
        this.layersContainerEl.addEventListener('scroll', () => {
            this.keyframesContainerEl.scrollTop = this.layersContainerEl.scrollTop;
        });
        
        // Sync horizontal scrolling between ruler and keyframes
        this.keyframesContainerEl.addEventListener('scroll', () => {
            const rulerContent = this.rulerEl.querySelector('.timeline-ruler-content');
            if (rulerContent) {
                (rulerContent as HTMLElement).style.transform = 
                    `translateX(-${this.keyframesContainerEl.scrollLeft}px)`;
            }
        });
    }
    
    private handleAddLayer(): void {
        const layerId = 'layer_' + Date.now();
        const layerName = `Layer ${this.layerManager?.getLayers().length || 0 + 1}`;
        
        // Emit event to create a new layer
        this.eventEmitter.emit(EVENT_TYPES.LAYER_ADDED, {
            layer: {
                id: layerId,
                name: layerName,
                keyframes: []
            }
        });
    }
    
    private handleAddKeyframe(): void {
        // This will add a keyframe at the current time for the selected layer
        const selectedLayerId = this.layerManager?.getSelectedLayerId();
        if (!selectedLayerId) {
            alert('Please select a layer first');
            return;
        }
        
        const currentTime = 0; // Replace with actual current time
        
        // Emit event to create a new keyframe
        this.eventEmitter.emit(EVENT_TYPES.KEYFRAME_ADDED, {
            layerId: selectedLayerId,
            keyframe: {
                id: 'keyframe_' + Date.now(),
                time: currentTime,
                value: {}
            }
        });
    }
    
    private handleZoomIn(): void {
        this.timeScale = Math.min(this.timeScale * 1.2, 10);
        this.updateZoom();
    }
    
    private handleZoomOut(): void {
        this.timeScale = Math.max(this.timeScale / 1.2, 0.1);
        this.updateZoom();
    }
    
    private updateZoom(): void {
        // Update zoom value display
        const zoomValueEl = this.toolbarEl.querySelector('#zoom-value');
        if (zoomValueEl) {
            zoomValueEl.textContent = `${Math.round(this.timeScale * 100)}%`;
        }
        
        // Emit zoom changed event
        this.eventEmitter.emit(EVENT_TYPES.ZOOM_CHANGED, { scale: this.timeScale });
    }
    
    private handlePlay(): void {
        // Handle play button click
        this.eventEmitter.emit(EVENT_TYPES.PLAYBACK_STARTED, {});
    }
    
    private handleStop(): void {
        // Handle stop button click
        this.eventEmitter.emit(EVENT_TYPES.PLAYBACK_STOPPED, {});
    }
    
    public destroy(): void {
        // Clean up event listeners and plugins
        this.pluginManager.destroyPlugins();
    }
}
