// filepath: c:\Users\BenoitRobin\JsTimeline\v2-vscode\timeline-animation-editor\src\plugins\LayerManagement\LayerManager.ts
import { BaseComponent } from '../../components/base/BaseComponent';
import { EventEmitter } from '../../core/EventEmitter';
import { CSS_CLASSES } from '../../utils/Constants';
import { EVENT_TYPES } from '../../utils/EventTypes';
import { Layer } from '../../types';

interface LayerManagerOptions {
    container: HTMLElement;
    eventEmitter: EventEmitter<string>;
}

export class LayerManager extends BaseComponent {
    private eventEmitter: EventEmitter<string>;
    private layers: Layer[] = [];
    private selectedLayerId: string | null = null;
    public name = 'layerManager';
    public dependencies = []; // No dependencies
    
    constructor(options: LayerManagerOptions) {
        super(options.container, 'layer-manager');
        this.eventEmitter = options.eventEmitter;
    }

public initialize(): void {
        this.render();
        this.setupEventListeners();
        
        // Listen for layer-related events
        this.eventEmitter.on(EVENT_TYPES.LAYER_ADDED, this, this.handleLayerAdded);
        this.eventEmitter.on(EVENT_TYPES.LAYER_REMOVED, this, this.handleLayerRemoved);
        this.eventEmitter.on(EVENT_TYPES.LAYER_RENAMED, this, this.handleLayerRenamed);
    }

public render(): string {
        const html = `
            <div class="layer-manager">
                <div class="layer-tools">
                    <div class="layer-tools-header">Layers</div>
                </div>
                <div class="layer-list">
                    ${this.renderLayers()}
                </div>
            </div>
        `;
        this.container.innerHTML = html;
        return html;
    }

    private renderLayers(): string {
        if (this.layers.length === 0) {
            return '<div class="no-layers-message">No layers. Click "Add Layer" to create one.</div>';
        }
        
        return this.layers.map((layer, index) => `
            <div class="layer-item ${this.selectedLayerId === layer.id ? 'selected' : ''}" 
                 data-layer-id="${layer.id}" 
                 data-index="${index}">
                <div class="layer-name">${layer.name}</div>
                <div class="layer-controls">
                    <button class="rename-layer-btn" data-layer-id="${layer.id}">Rename</button>
                    <button class="delete-layer-btn" data-layer-id="${layer.id}">Delete</button>
                </div>
            </div>
        `).join('');
    }

    public update(data: { layers: Layer[] }): void {
        this.layers = data.layers;
        this.render();
    }

    public selectLayer(layerId: string): void {
        this.selectedLayerId = layerId;
        
        // Highlight the selected layer
        const layerElements = this.container.querySelectorAll('.layer-item');
        layerElements.forEach(el => {
            if ((el as HTMLElement).dataset.layerId === layerId) {
                el.classList.add('selected');
            } else {
                el.classList.remove('selected');
            }
        });
        
        // Emit layer selection event
        this.eventEmitter.emit(EVENT_TYPES.LAYER_SELECTED, { layerId });
    }

    private setupEventListeners(): void {
        // Layer selection
        this.container.addEventListener('click', (event) => {
            const target = event.target as HTMLElement;
            const layerItem = target.closest('.layer-item') as HTMLElement;
            
            if (layerItem) {
                const layerId = layerItem.dataset.layerId;
                if (layerId) {
                    this.selectLayer(layerId);
                }
            }
        });
        
        // Add layer button
        this.container.addEventListener('click', (event) => {
            const target = event.target as HTMLElement;
            if (target.classList.contains('add-layer-btn')) {
                this.addLayer();
            }
        });
        
        // Delete layer button
        this.container.addEventListener('click', (event) => {
            const target = event.target as HTMLElement;
            if (target.classList.contains('delete-layer-btn')) {
                const layerId = target.dataset.layerId;
                if (layerId) {
                    this.deleteLayer(layerId);
                }
            }
        });
        
        // Rename layer button
        this.container.addEventListener('click', (event) => {
            const target = event.target as HTMLElement;
            if (target.classList.contains('rename-layer-btn')) {
                const layerId = target.dataset.layerId;
                if (layerId) {
                    this.promptRenameLayer(layerId);
                }
            }
        });
        
        // Layer reordering using drag and drop
        this.setupDragAndDrop();
    }
    
    private addLayer(): void {
        const layerId = 'layer_' + Date.now();
        const layerName = `Layer ${this.layers.length + 1}`;
        
        const newLayer: Layer = {
            id: layerId,
            name: layerName,
            keyframes: []
        };
        
        this.layers.push(newLayer);
        this.eventEmitter.emit(EVENT_TYPES.LAYER_ADDED, { layer: newLayer });
        this.render();
        
        // Select the new layer
        this.selectLayer(layerId);
    }
    
    private deleteLayer(layerId: string): void {
        this.layers = this.layers.filter(layer => layer.id !== layerId);
        this.eventEmitter.emit(EVENT_TYPES.LAYER_REMOVED, { layerId });
        this.render();
        
        // If the deleted layer was selected, select another one or null
        if (this.selectedLayerId === layerId) {
            this.selectedLayerId = this.layers.length > 0 ? this.layers[0].id : null;
            if (this.selectedLayerId) {
                this.selectLayer(this.selectedLayerId);
            }
        }
    }
    
    private promptRenameLayer(layerId: string): void {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer) return;
        
        const newName = prompt(`Rename layer "${layer.name}" to:`, layer.name);
        if (newName !== null && newName.trim() !== '') {
            this.renameLayer(layerId, newName);
        }
    }
    
    private renameLayer(layerId: string, newName: string): void {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer) {
            layer.name = newName;
            this.eventEmitter.emit(EVENT_TYPES.LAYER_RENAMED, { layerId, newName });
            this.render();
        }
    }
      private setupDragAndDrop(): void {
        // Implementation of drag-and-drop for layer reordering would go here
        // Using the HTML5 Drag and Drop API
    }
    
    // Add getter methods for layers and selectedLayerId
    public getLayers(): Layer[] {
        return this.layers;
    }
    
    public getSelectedLayerId(): string | null {
        return this.selectedLayerId;
    }
    
    private handleLayerAdded(data: { layer: Layer }): void {
        if (!this.layers.some(l => l.id === data.layer.id)) {
            this.layers.push(data.layer);
            this.render();
        }
    }
    
    private handleLayerRemoved(data: { layerId: string }): void {
        this.layers = this.layers.filter(layer => layer.id !== data.layerId);
        this.render();
    }
    
    private handleLayerRenamed(data: { layerId: string, newName: string }): void {
        const layer = this.layers.find(l => l.id === data.layerId);
        if (layer) {
            layer.name = data.newName;
            this.render();
        }
    }

public destroy(): void {
        // Clean up event listeners
        this.eventEmitter.off(EVENT_TYPES.LAYER_ADDED, this.handleLayerAdded);
        this.eventEmitter.off(EVENT_TYPES.LAYER_REMOVED, this.handleLayerRemoved);
        this.eventEmitter.off(EVENT_TYPES.LAYER_RENAMED, this.handleLayerRenamed);
    }
}
