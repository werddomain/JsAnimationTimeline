import { BaseComponent } from '@core/BaseComponent';
import { DataModel } from '@core/DataModel';
import { EventEmitter } from '@core/EventEmitter';
import { Events } from '@utils/EventTypes';

/**
 * Options for initializing the ObjectToolbar
 */
export interface ObjectToolbarOptions {
    container: HTMLElement;
    id?: string;
}

/**
 * ObjectToolbar plugin that provides controls for selected objects
 */
export class ObjectToolbar extends BaseComponent {
    private dataModel: DataModel;
    private eventEmitter: EventEmitter;
    
    // Plugin metadata
    public metadata = {
        name: 'ObjectToolbar',
        version: '1.0.0',
        dependencies: [
            { name: 'LayerManager' },
            { name: 'KeyframeManager' }
        ]
    };

    /**
     * Constructor for ObjectToolbar
     * @param options Options for initializing the object toolbar
     */
    constructor(options: ObjectToolbarOptions) {
        super(options.container, options.id || 'timeline-object-toolbar');
        this.dataModel = DataModel.getInstance();
        this.eventEmitter = EventEmitter.getInstance();
    }

    /**
     * Initialize the object toolbar
     */
    public initialize(): void {
        if (!this.element) {
            console.error('ObjectToolbar element not found');
            return;
        }

        // Listen for selection events
        this.eventEmitter.on(Events.LAYER_SELECTED, this.handleLayerSelected, this);
        this.eventEmitter.on(Events.KEYFRAME_SELECTED, this.handleKeyframeSelected, this);

        // Add event listeners for buttons
        // These will be added dynamically when selection changes
    }

    /**
     * Render the object toolbar
     * @returns HTML string for the object toolbar
     */
    public render(): string {
        return `
            <div id="${this.id}" class="timeline-object-toolbar">
                <div class="timeline-object-toolbar-content">
                    <div class="timeline-object-info">No selection</div>
                </div>
            </div>
        `;
    }

    /**
     * Update the object toolbar with new data
     * @param data The data to update with
     */
    public update(data: any): void {
        this.updateToolbar();
    }

    /**
     * Clean up the object toolbar
     */
    public destroy(): void {
        // Remove event listeners
        this.eventEmitter.off(Events.LAYER_SELECTED, this.handleLayerSelected);
        this.eventEmitter.off(Events.KEYFRAME_SELECTED, this.handleKeyframeSelected);
    }

    /**
     * Handle layer selected event
     */
    private handleLayerSelected = (sender: any, data: { layerId: string }): void => {
        this.updateToolbar();
    };

    /**
     * Handle keyframe selected event
     */
    private handleKeyframeSelected = (sender: any, data: { keyframeId: string, layerId: string }): void => {
        this.updateToolbar();
    };

    /**
     * Update the toolbar based on current selection
     */
    private updateToolbar(): void {
        if (!this.element) {
            return;
        }

        const contentEl = this.element.querySelector('.timeline-object-toolbar-content');
        if (!contentEl) {
            return;
        }

        // Check if a keyframe is selected
        const selectedKeyframe = this.dataModel.getSelectedKeyframe();
        if (selectedKeyframe) {
            contentEl.innerHTML = this.renderKeyframeToolbar(selectedKeyframe);
            this.attachKeyframeEventListeners();
            return;
        }

        // Check if a layer is selected
        const selectedLayer = this.dataModel.getSelectedLayer();
        if (selectedLayer) {
            contentEl.innerHTML = this.renderLayerToolbar(selectedLayer);
            this.attachLayerEventListeners();
            return;
        }

        // No selection
        contentEl.innerHTML = '<div class="timeline-object-info">No selection</div>';
    }

    /**
     * Render the toolbar for a selected keyframe
     * @param keyframe The selected keyframe
     * @returns HTML string for the keyframe toolbar
     */
    private renderKeyframeToolbar(keyframe: any): string {
        return `
            <div class="timeline-object-info">
                <span>Keyframe at ${keyframe.time.toFixed(2)}s</span>
                <span>Layer: ${this.getLayerName(keyframe.layerId)}</span>
            </div>
            <div class="timeline-object-actions">
                <button id="timeline-delete-keyframe" class="timeline-button">Delete Keyframe</button>
                <button id="timeline-edit-keyframe" class="timeline-button">Edit Value</button>
                <select id="timeline-keyframe-easing" class="timeline-select">
                    <option value="linear" ${keyframe.easing === 'linear' ? 'selected' : ''}>Linear</option>
                    <option value="ease-in" ${keyframe.easing === 'ease-in' ? 'selected' : ''}>Ease In</option>
                    <option value="ease-out" ${keyframe.easing === 'ease-out' ? 'selected' : ''}>Ease Out</option>
                    <option value="ease-in-out" ${keyframe.easing === 'ease-in-out' ? 'selected' : ''}>Ease In/Out</option>
                </select>
                <input id="timeline-keyframe-time" type="number" class="timeline-input" value="${keyframe.time.toFixed(2)}" step="0.01" />
            </div>
        `;
    }

    /**
     * Render the toolbar for a selected layer
     * @param layer The selected layer
     * @returns HTML string for the layer toolbar
     */
    private renderLayerToolbar(layer: any): string {
        return `
            <div class="timeline-object-info">
                <span>Layer: ${layer.name}</span>
            </div>
            <div class="timeline-object-actions">
                <button id="timeline-delete-layer" class="timeline-button">Delete Layer</button>
                <button id="timeline-rename-layer" class="timeline-button">Rename</button>
                <button id="timeline-add-keyframe-here" class="timeline-button">Add Keyframe</button>
                <label>
                    <input id="timeline-layer-visible" type="checkbox" ${layer.isVisible !== false ? 'checked' : ''} />
                    Visible
                </label>
                <label>
                    <input id="timeline-layer-locked" type="checkbox" ${layer.isLocked ? 'checked' : ''} />
                    Locked
                </label>
            </div>
        `;
    }

    /**
     * Attach event listeners for keyframe toolbar
     */
    private attachKeyframeEventListeners(): void {
        if (!this.element) {
            return;
        }

        const deleteBtn = this.element.querySelector('#timeline-delete-keyframe');
        const editBtn = this.element.querySelector('#timeline-edit-keyframe');
        const easingSelect = this.element.querySelector('#timeline-keyframe-easing');
        const timeInput = this.element.querySelector('#timeline-keyframe-time');

        if (deleteBtn) {
            deleteBtn.addEventListener('click', this.handleDeleteKeyframe);
        }

        if (editBtn) {
            editBtn.addEventListener('click', this.handleEditKeyframe);
        }

        if (easingSelect) {
            easingSelect.addEventListener('change', this.handleEasingChange);
        }

        if (timeInput) {
            timeInput.addEventListener('change', this.handleTimeChange);
        }
    }

    /**
     * Attach event listeners for layer toolbar
     */
    private attachLayerEventListeners(): void {
        if (!this.element) {
            return;
        }

        const deleteBtn = this.element.querySelector('#timeline-delete-layer');
        const renameBtn = this.element.querySelector('#timeline-rename-layer');
        const addKeyframeBtn = this.element.querySelector('#timeline-add-keyframe-here');
        const visibleCheckbox = this.element.querySelector('#timeline-layer-visible');
        const lockedCheckbox = this.element.querySelector('#timeline-layer-locked');

        if (deleteBtn) {
            deleteBtn.addEventListener('click', this.handleDeleteLayer);
        }

        if (renameBtn) {
            renameBtn.addEventListener('click', this.handleRenameLayer);
        }

        if (addKeyframeBtn) {
            addKeyframeBtn.addEventListener('click', this.handleAddKeyframeAtCurrentTime);
        }

        if (visibleCheckbox) {
            visibleCheckbox.addEventListener('change', this.handleVisibilityChange);
        }

        if (lockedCheckbox) {
            lockedCheckbox.addEventListener('change', this.handleLockChange);
        }
    }

    /**
     * Get the name of a layer by ID
     * @param layerId The ID of the layer
     * @returns The name of the layer or "Unknown Layer" if not found
     */
    private getLayerName(layerId: string): string {
        const layer = this.dataModel.getLayer(layerId);
        return layer ? layer.name : 'Unknown Layer';
    }

    /**
     * Handle delete keyframe button click
     */
    private handleDeleteKeyframe = (): void => {
        const keyframe = this.dataModel.getSelectedKeyframe();
        if (keyframe) {
            this.dataModel.removeKeyframe(keyframe.id, this);
        }
    };

    /**
     * Handle edit keyframe button click
     */
    private handleEditKeyframe = (): void => {
        const keyframe = this.dataModel.getSelectedKeyframe();
        if (keyframe) {
            // In a real implementation, this would show a dialog to edit the keyframe value
            console.log('Edit keyframe value:', keyframe.value);
        }
    };

    /**
     * Handle easing change
     */
    private handleEasingChange = (event: Event): void => {
        const select = event.target as HTMLSelectElement;
        const keyframe = this.dataModel.getSelectedKeyframe();
        
        if (keyframe) {
            keyframe.easing = select.value;
            // In a real implementation, this would emit an event to update the keyframe
        }
    };

    /**
     * Handle time change
     */
    private handleTimeChange = (event: Event): void => {
        const input = event.target as HTMLInputElement;
        const keyframe = this.dataModel.getSelectedKeyframe();
        
        if (keyframe) {
            const newTime = parseFloat(input.value);
            this.dataModel.moveKeyframe(keyframe.id, newTime, this);
        }
    };

    /**
     * Handle delete layer button click
     */
    private handleDeleteLayer = (): void => {
        const layer = this.dataModel.getSelectedLayer();
        if (layer) {
            this.dataModel.removeLayer(layer.id, this);
        }
    };

    /**
     * Handle rename layer button click
     */
    private handleRenameLayer = (): void => {
        const layer = this.dataModel.getSelectedLayer();
        if (layer) {
            // In a real implementation, this would show a prompt to rename the layer
            const newName = prompt('Enter new layer name:', layer.name);
            if (newName) {
                this.eventEmitter.emit(Events.LAYER_RENAMED, this, {
                    layerId: layer.id,
                    name: newName
                });
            }
        }
    };

    /**
     * Handle add keyframe at current time button click
     */
    private handleAddKeyframeAtCurrentTime = (): void => {
        const layer = this.dataModel.getSelectedLayer();
        if (layer) {
            const currentTime = this.dataModel.getCurrentTime();
            const keyframeId = `keyframe-${Date.now()}`;
            
            this.dataModel.addKeyframe({
                id: keyframeId,
                layerId: layer.id,
                time: currentTime,
                value: { x: 0, y: 0 } // Default value
            }, this);
        }
    };

    /**
     * Handle visibility change
     */
    private handleVisibilityChange = (event: Event): void => {
        const checkbox = event.target as HTMLInputElement;
        const layer = this.dataModel.getSelectedLayer();
        
        if (layer) {
            layer.isVisible = checkbox.checked;
            // In a real implementation, this would emit an event to update the layer
        }
    };

    /**
     * Handle lock change
     */
    private handleLockChange = (event: Event): void => {
        const checkbox = event.target as HTMLInputElement;
        const layer = this.dataModel.getSelectedLayer();
        
        if (layer) {
            layer.isLocked = checkbox.checked;
            // In a real implementation, this would emit an event to update the layer
        }
    };
}
