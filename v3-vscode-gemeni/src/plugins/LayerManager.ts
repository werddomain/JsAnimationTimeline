import { BaseComponent } from '@core/BaseComponent';
import { DataModel } from '@core/DataModel';
import { EventEmitter } from '@core/EventEmitter';
import { Events, LayerData } from '@utils/EventTypes';

/**
 * Options for initializing the LayerManager
 */
export interface LayerManagerOptions {
    container: HTMLElement;
    id?: string;
}

/**
 * LayerManager plugin that manages the list of layers/objects
 */
export class LayerManager extends BaseComponent {
    private dataModel: DataModel;
    private eventEmitter: EventEmitter;
    
    // Plugin metadata
    public metadata = {
        name: 'LayerManager',
        version: '1.0.0'
    };

    /**
     * Constructor for LayerManager
     * @param options Options for initializing the layer manager
     */
    constructor(options: LayerManagerOptions) {
        super(options.container, options.id || 'timeline-layers-container');
        this.dataModel = DataModel.getInstance();
        this.eventEmitter = EventEmitter.getInstance();
    }

    /**
     * Initialize the layer manager
     */
    public initialize(): void {
        if (!this.element) {
            console.error('LayerManager element not found');
            return;
        }

        // Listen for events
        this.eventEmitter.on(Events.LAYER_ADDED, this.handleLayerAdded, this);
        this.eventEmitter.on(Events.LAYER_REMOVED, this.handleLayerRemoved, this);
        this.eventEmitter.on(Events.LAYER_SELECTED, this.handleLayerSelected, this);
        this.eventEmitter.on(Events.LAYER_RENAMED, this.handleLayerRenamed, this);
        this.eventEmitter.on(Events.LAYER_REORDERED, this.handleLayerReordered, this);

        // Add click event to handle layer selection
        this.element.addEventListener('click', this.handleClick);
    }

    /**
     * Render the layer manager
     * @returns HTML string for the layer manager
     */
    public render(): string {
        return `
            <div id="${this.id}" class="timeline-layers-container"></div>
        `;
    }

    /**
     * Update the layer manager with new data
     * @param data The data to update with
     */
    public update(data: any): void {
        this.renderLayers();
    }

    /**
     * Clean up the layer manager
     */
    public destroy(): void {
        if (this.element) {
            this.element.removeEventListener('click', this.handleClick);
        }

        // Remove event listeners
        this.eventEmitter.off(Events.LAYER_ADDED, this.handleLayerAdded);
        this.eventEmitter.off(Events.LAYER_REMOVED, this.handleLayerRemoved);
        this.eventEmitter.off(Events.LAYER_SELECTED, this.handleLayerSelected);
        this.eventEmitter.off(Events.LAYER_RENAMED, this.handleLayerRenamed);
        this.eventEmitter.off(Events.LAYER_REORDERED, this.handleLayerReordered);
    }

    /**
     * Handle layer added event
     */
    private handleLayerAdded = (sender: any, data: { layer: LayerData }): void => {
        this.renderLayers();
    };

    /**
     * Handle layer removed event
     */
    private handleLayerRemoved = (sender: any, data: { layerId: string }): void => {
        this.renderLayers();
    };

    /**
     * Handle layer selected event
     */
    private handleLayerSelected = (sender: any, data: { layerId: string }): void => {
        this.updateLayerSelection(data.layerId);
    };

    /**
     * Handle layer renamed event
     */
    private handleLayerRenamed = (sender: any, data: { layerId: string, name: string }): void => {
        const layerEl = this.element?.querySelector(`[data-layer-id="${data.layerId}"]`);
        if (layerEl) {
            const nameEl = layerEl.querySelector('.timeline-layer-name');
            if (nameEl) {
                nameEl.textContent = data.name;
            }
        }
    };

    /**
     * Handle layer reordered event
     */
    private handleLayerReordered = (sender: any, data: { layerId: string, newIndex: number }): void => {
        this.renderLayers();
    };

    /**
     * Handle click on the layer manager
     */
    private handleClick = (event: MouseEvent): void => {
        const target = event.target as HTMLElement;
        const layerEl = target.closest('.timeline-layer') as HTMLElement;
        
        if (layerEl && this.element?.contains(layerEl)) {
            const layerId = layerEl.dataset.layerId;
            if (layerId) {
                this.dataModel.selectLayer(layerId, this);
            }
        }
    };

    /**
     * Update the layer selection in the UI
     * @param layerId The ID of the selected layer
     */
    private updateLayerSelection(layerId: string): void {
        if (!this.element) {
            return;
        }

        // Remove selected class from all layers
        const selectedLayers = this.element.querySelectorAll('.timeline-layer.selected');
        selectedLayers.forEach(layer => {
            layer.classList.remove('selected');
        });

        // Add selected class to the selected layer
        const selectedLayer = this.element.querySelector(`[data-layer-id="${layerId}"]`);
        if (selectedLayer) {
            selectedLayer.classList.add('selected');
        }
    }

    /**
     * Render all layers
     */
    private renderLayers(): void {
        if (!this.element) {
            return;
        }

        // Get layers from data model
        const layers = this.dataModel.getLayers();
        const selectedLayer = this.dataModel.getSelectedLayer();

        // Clear existing layers
        this.element.innerHTML = '';

        // Render each layer
        layers.forEach(layer => {
            const layerEl = document.createElement('div');
            layerEl.className = 'timeline-layer';
            layerEl.dataset.layerId = layer.id;
            
            // Mark selected layer
            if (selectedLayer && layer.id === selectedLayer.id) {
                layerEl.classList.add('selected');
            }
            
            // Add visibility toggle
            const visibilityToggle = document.createElement('span');
            visibilityToggle.className = 'timeline-layer-visibility';
            visibilityToggle.innerHTML = layer.isVisible !== false ? '👁️' : '👁️‍🗨️';
            visibilityToggle.title = layer.isVisible !== false ? 'Hide Layer' : 'Show Layer';
            
            // Add lock toggle
            const lockToggle = document.createElement('span');
            lockToggle.className = 'timeline-layer-lock';
            lockToggle.innerHTML = layer.isLocked ? '🔒' : '🔓';
            lockToggle.title = layer.isLocked ? 'Unlock Layer' : 'Lock Layer';
            
            // Add layer name
            const nameEl = document.createElement('span');
            nameEl.className = 'timeline-layer-name';
            nameEl.textContent = layer.name;
            
            // Add elements to layer
            layerEl.appendChild(visibilityToggle);
            layerEl.appendChild(lockToggle);
            layerEl.appendChild(nameEl);
              // Add layer to container
            if (this.element) {
                this.element.appendChild(layerEl);
            }
        });
    }

    /**
     * Add a new layer
     * @param name The name of the layer
     * @returns The added layer data
     */
    public addLayer(name: string): LayerData {
        const layerId = `layer-${Date.now()}`;
        return this.dataModel.addLayer({
            id: layerId,
            name: name
        }, this);
    }

    /**
     * Remove a layer
     * @param layerId The ID of the layer to remove
     */
    public removeLayer(layerId: string): void {
        this.dataModel.removeLayer(layerId, this);
    }

    /**
     * Rename a layer
     * @param layerId The ID of the layer to rename
     * @param name The new name for the layer
     */
    public renameLayer(layerId: string, name: string): void {
        const layer = this.dataModel.getLayer(layerId);
        if (layer) {
            layer.name = name;
            this.eventEmitter.emit(Events.LAYER_RENAMED, this, { layerId, name });
        }
    }

    /**
     * Reorder a layer
     * @param layerId The ID of the layer to reorder
     * @param newIndex The new index for the layer
     */
    public reorderLayer(layerId: string, newIndex: number): void {
        // Implementation would depend on how layer order is stored
        // For now, we just emit the event
        this.eventEmitter.emit(Events.LAYER_REORDERED, this, { layerId, newIndex });
    }
}
