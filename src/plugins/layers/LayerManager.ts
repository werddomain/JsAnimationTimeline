/* eslint-disable @typescript-eslint/no-inferrable-types */
// src/plugins/layers/LayerManager.ts
/**
 * Layer Manager
 * Manages the layer data and UI interactions
 */

import { Layer } from '../../core/DataModel';
import { EventEmitter } from '../../core/EventEmitter';
import { TimelineConstants } from '../../core/Constants';
import { Component } from '../../core/BaseComponent';

const { EVENTS, CSS_CLASSES, COLORS } = TimelineConstants;

export interface LayerManagerOptions {
    container: HTMLElement;
    eventEmitter: EventEmitter;
    onLayerSelect: (layerId: string, multiSelect: boolean) => void;
    onLayerMove: (layerId: string, targetIndex: number) => void;
    onLayerNameChange: (layerId: string, newName: string) => void;
    onLayerVisibilityToggle: (layerId: string) => void;
    onLayerLockToggle: (layerId: string) => void;
    onLayerColorChange: (layerId: string, newColor: string) => void;
    onLayerDelete: (layerId: string) => void;
}

export class LayerManager extends Component {
    private eventEmitter: EventEmitter;
    private layers: Layer[] = [];
    private dragLayer: HTMLElement | null = null;
    private dragIndex: number = -1;
    private options: LayerManagerOptions;
    private colorPickerElement: HTMLElement | null = null;

    constructor(options: LayerManagerOptions) {
        super(options.container, 'timeline-layers-container');
        this.eventEmitter = options.eventEmitter;
        this.options = options;

        this.init();
    }

    /**
     * Initialize the layer manager
     */
    private init(): void {
        this.initialize();
    }

    /**
     * Initialize event listeners
     */
    public initialize(): void {
        const element = this.getElement();
        if (element) {
            element.addEventListener('click', this.handleClick.bind(this));
            element.addEventListener('dblclick', this.handleDoubleClick.bind(this));
            element.addEventListener('mousedown', this.handleMouseDown.bind(this));
        }

        // Setup drag and drop
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));

        // Handle clicks outside the color picker
        document.addEventListener('click', this.handleOutsideClick.bind(this));
    }

    /**
     * Update the layers array
     * @param layers Updated layers array
     */
    public update(layers: Layer[]): void {
        if (layers) {
            this.layers = layers;
        }

        // Apply the rendered HTML to the container
        const element = this.getElement();
        if (element) {
            element.innerHTML = this.renderContent();
        }
    }

    /**
     * Generate the HTML for this component
     */
    public render(): string {
        return `
      <div id="${this.elementId}" class="${CSS_CLASSES.LAYERS}">
        ${this.renderContent()}
      </div>
    `;
    }
    // Add a method to render a single layer with proper indentation
    private renderLayer(layer: Layer, indentLevel: number = 0): string {
        const selectedClass = layer.isSelected ? CSS_CLASSES.SELECTED : '';
        const visibilityIcon = layer.visible ? 'eye' : 'eye-slash';
        const lockIcon = layer.locked ? 'lock' : 'unlock';
        const isGroup = this.isGroup(layer);
        const isExpanded = layer.isExpanded !== false; // Default to expanded

        // Calculate indentation
        const indentPadding = indentLevel * 15; // 15px per level

        return `
        <div class="${CSS_CLASSES.LAYER} ${selectedClass} ${layer.locked ? 'locked' : ''} ${!layer.visible ? 'hidden' : ''} ${isGroup ? 'layer-group' : ''}" 
             data-id="${layer.id}" 
             data-index="${this.getLayerIndex(layer)}"
             style="border-left-color: ${layer.color}; padding-left: ${indentPadding}px;">
            <div class="timeline-layer-header">
                <span class="timeline-layer-drag-handle">≡</span>
                ${isGroup ? `
                    <span class="timeline-layer-toggle" data-action="toggle-group">
                        ${isExpanded ? '▼' : '►'}
                    </span>
                ` : ''}
                <span class="timeline-layer-name">${layer.name}</span>
                <div class="timeline-layer-controls">
                    <button class="timeline-layer-btn" data-action="toggle-visibility" title="${layer.visible ? 'Hide' : 'Show'} Layer">
                        <i class="icon ${visibilityIcon}">${layer.visible ? '👁️' : '👁️‍🗨️'}</i>
                    </button>
                    <button class="timeline-layer-btn" data-action="toggle-lock" title="${layer.locked ? 'Unlock' : 'Lock'} Layer">
                        <i class="icon ${lockIcon}">${layer.locked ? '🔒' : '🔓'}</i>
                    </button>
                    <button class="timeline-layer-btn" data-action="edit-name" title="Edit Name">
                        <i class="icon edit">✏️</i>
                    </button>
                    <button class="timeline-layer-btn" data-action="change-color" title="Change Color">
                        <span class="color-swatch" style="background-color: ${layer.color};"></span>
                    </button>
                    ${isGroup ? `
                        <button class="timeline-layer-btn" data-action="add-to-group" title="Add Layer to Group">
                            <i class="icon">➕</i>
                        </button>
                    ` : `
                        <button class="timeline-layer-btn" data-action="remove-from-group" title="Remove from Group" ${layer.parentId ? '' : 'disabled'}>
                            <i class="icon">➖</i>
                        </button>
                    `}
                </div>
            </div>
        </div>
    `;
    }

    /**
     * Render the layers content
     */
    private renderContent(): string {
        if (this.layers.length === 0) {
            return '<div class="timeline-empty-state">No objects. Click "New Object" to add one.</div>';
        }

        let html = '';

        // Get layers with proper indentation
        const layersWithIndent = this.getLayersWithIndentation();

        // Render each layer
        layersWithIndent.forEach(({ layer, indentLevel }) => {
            html += this.renderLayer(layer, indentLevel);
        });

        return html;
    }
    // Check if a layer is a group
    private isGroup(layer: Layer): boolean {
        return this.layers.some(l => l.parentId === layer.id);
    }

    // Get the index of a layer
    private getLayerIndex(layer: Layer): number {
        return this.layers.findIndex(l => l.id === layer.id);
    }

    // Get layers with proper indentation
    private getLayersWithIndentation(): { layer: Layer, indentLevel: number }[] {
        const result: { layer: Layer, indentLevel: number }[] = [];

        // Get top-level layers (those without a parent)
        const topLevelLayers = this.layers.filter(layer => !layer.parentId);

        // Process each top-level layer and its children recursively
        topLevelLayers.forEach(layer => {
            this.addLayerWithChildren(layer, 0, result);
        });

        return result;
    }

    // Add a layer and its children to the result array
    private addLayerWithChildren(
        layer: Layer,
        indentLevel: number,
        result: { layer: Layer, indentLevel: number }[]
    ): void {
        // Add the layer itself
        result.push({ layer, indentLevel });

        // If this is a group and it's expanded, add its children
        if (this.isGroup(layer) && layer.isExpanded !== false) {
            const children = this.getChildLayers(layer.id);

            // Process each child
            children.forEach(child => {
                this.addLayerWithChildren(child, indentLevel + 1, result);
            });
        }
    }

    // Get all child layers of a group
    private getChildLayers(groupId: string): Layer[] {
        return this.layers.filter(layer => layer.parentId === groupId);
    }
    /**
     * Create a new layer
     * @param name Layer name
     * @returns The new layer object
     */
    public createLayer(name: string = 'New Layer'): Partial<Layer> {
        const colorIndex = this.layers.length % COLORS.LAYER_DEFAULTS.length;

        return {
            name,
            visible: true,
            locked: false,
            color: COLORS.LAYER_DEFAULTS[colorIndex],
            keyframes: [],
            motionTweens: [],
            isSelected: false
        };
    }

    /**
     * Handle container click events
     * @param e Mouse event
     */
    private handleClick(e: MouseEvent): void {
        const target = e.target as HTMLElement;
        const layerEl = this.findParentWithClass(target, CSS_CLASSES.LAYER);

        if (!layerEl) return;

        const layerId = layerEl.getAttribute('data-id');
        if (!layerId) return;
        if (target.closest('.timeline-layer-toggle')) {
            const layer = this.layers.find(l => l.id === layerId);
            if (layer) {
                layer.isExpanded = !layer.isExpanded;
                this.update(this.layers);

                // Notify about group expansion toggle
                this.eventEmitter.emitLayerGroupToggle(layerId, layer.isExpanded);
                //this.eventEmitter.emit('layer:group:toggle', layerId, layer.isExpanded);
            }
            return;
        }
        // Check if clicked on a control button
        if (target.closest('.timeline-layer-btn')) {
            const button = target.closest('.timeline-layer-btn');
            const action = button?.getAttribute('data-action');

            switch (action) {
                case 'toggle-visibility':
                    this.options.onLayerVisibilityToggle(layerId);
                    break;
                case 'toggle-lock':
                    this.options.onLayerLockToggle(layerId);
                    break;
                case 'edit-name':
                    this.promptLayerNameEdit(layerEl, layerId);
                    break;
                case 'change-color':
                    this.promptColorChange(layerId, target);
                    break;
                case 'add-to-group':
                    this.showAddToGroupDialog(layerId);
                    return;

                case 'remove-from-group':
                    this.removeFromGroup(layerId);
                    return;
            }
            return;
        }

        // Check if clicked on group toggle
        if (target.closest('.timeline-layer-toggle')) {
            const layer = this.layers.find(l => l.id === layerId);
            if (layer) {
                layer.isExpanded = !layer.isExpanded;
                this.update(this.layers);
            }
            return;
        }

        // Otherwise select the layer
        const multiSelect = e.ctrlKey || e.metaKey;
        this.options.onLayerSelect(layerId, multiSelect);
    }

    // Show a dialog to add a layer to a group
    private showAddToGroupDialog(groupId: string): void {
        // This would show a UI to select layers to add to the group
        // For simplicity, we'll just show an alert for now
        alert('In a real implementation, this would show a dialog to select layers to add to this group.');

        // You could create a popup with checkboxes for each layer that's not already in a group
        // and then call addLayerToGroup for each selected layer
    }

    // Remove a layer from its group
    private removeFromGroup(layerId: string): void {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer || !layer.parentId) return;

        // Notify about removing from group
        this.eventEmitter.emitLayerGroupRemoved(layerId);
        //this.eventEmitter.emit('layer:group:remove', layerId);
    }
    /**
     * Handle double click events (for editing layer name)
     * @param e Mouse event
     */
    private handleDoubleClick(e: MouseEvent): void {
        const target = e.target as HTMLElement;
        const layerEl = this.findParentWithClass(target, CSS_CLASSES.LAYER);

        if (!layerEl) return;

        const layerId = layerEl.getAttribute('data-id');
        if (!layerId) return;

        // Only proceed if clicked on layer name
        if (target.closest('.timeline-layer-name')) {
            this.promptLayerNameEdit(layerEl, layerId);
        }
    }

    /**
     * Handle mouse down events (for drag and drop)
     * @param e Mouse event
     */
    private handleMouseDown(e: MouseEvent): void {
        const target = e.target as HTMLElement;

        // Only start drag if clicked on drag handle
        if (!target.closest('.timeline-layer-drag-handle')) return;

        const layerEl = this.findParentWithClass(target, CSS_CLASSES.LAYER);
        if (!layerEl) return;

        const index = parseInt(layerEl.getAttribute('data-index') || '-1');
        if (index === -1) return;

        this.dragLayer = layerEl;
        this.dragIndex = index;
        layerEl.classList.add('dragging');

        // Prevent text selection during drag
        e.preventDefault();
    }

    /**
     * Handle mouse move events (for drag and drop)
     * @param e Mouse event
     */
    private handleMouseMove(e: MouseEvent): void {
        if (!this.dragLayer) return;

        const element = this.getElement();
        if (!element) return;

        // Update position of dragged element
        const containerRect = element.getBoundingClientRect();
        const y = e.clientY - containerRect.top;
        this.dragLayer.style.transform = `translateY(${y - this.dragIndex * TimelineConstants.DIMENSIONS.LAYER_HEIGHT}px)`;

        // Determine target position
        const targetIndex = Math.floor(y / TimelineConstants.DIMENSIONS.LAYER_HEIGHT);

        // Update visual feedback
        const layers = element.querySelectorAll(`.${CSS_CLASSES.LAYER}`);
        layers.forEach((layer, index) => {
            if (layer === this.dragLayer) return;

            if (this.dragIndex < targetIndex && index > this.dragIndex && index <= targetIndex) {
                (layer as HTMLElement).style.transform = 'translateY(-100%)';
            } else if (this.dragIndex > targetIndex && index < this.dragIndex && index >= targetIndex) {
                (layer as HTMLElement).style.transform = 'translateY(100%)';
            } else {
                (layer as HTMLElement).style.transform = '';
            }
        });
    }

    /**
     * Handle mouse up events (for drag and drop)
     * @param e Mouse event
     */
    private handleMouseUp(e: MouseEvent): void {
        if (!this.dragLayer) return;

        const element = this.getElement();
        if (!element) return;

        // Calculate final position
        const containerRect = element.getBoundingClientRect();
        const y = e.clientY - containerRect.top;
        const targetIndex = Math.max(0, Math.min(this.layers.length - 1, Math.floor(y / TimelineConstants.DIMENSIONS.LAYER_HEIGHT)));

        // Reset styling
        this.dragLayer.classList.remove('dragging');
        this.dragLayer.style.transform = '';

        const layers = element.querySelectorAll(`.${CSS_CLASSES.LAYER}`);
        layers.forEach(layer => {
            (layer as HTMLElement).style.transform = '';
        });

        // Only trigger move if position changed
        if (targetIndex !== this.dragIndex) {
            const layerId = this.dragLayer.getAttribute('data-id');
            if (layerId) {
                this.options.onLayerMove(layerId, targetIndex);
            }
        }

        // Reset drag state
        this.dragLayer = null;
        this.dragIndex = -1;
    }

    /**
     * Handle clicks outside the color picker
     * @param e Mouse event
     */
    private handleOutsideClick(e: MouseEvent): void {
        if (this.colorPickerElement && !this.colorPickerElement.contains(e.target as Node)) {
            this.colorPickerElement.remove();
            this.colorPickerElement = null;
        }
    }

    /**
     * Prompt user to edit layer name
     * @param layerEl Layer element
     * @param layerId Layer ID
     */
    private promptLayerNameEdit(layerEl: HTMLElement, layerId: string): void {
        const nameEl = layerEl.querySelector('.timeline-layer-name') as HTMLElement;
        if (!nameEl) return;

        const currentName = nameEl.textContent || '';
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.className = 'timeline-layer-name-input';

        // Replace name element with input
        nameEl.replaceWith(input);
        input.focus();
        input.select();

        // Handle input blur and enter key
        const finishEdit = () => {
            const newName = input.value.trim() || 'Unnamed Layer';
            this.options.onLayerNameChange(layerId, newName);

            // Create new name element
            const newNameEl = document.createElement('span');
            newNameEl.className = 'timeline-layer-name';
            newNameEl.textContent = newName;

            // Replace input with name element
            input.replaceWith(newNameEl);
        };

        input.addEventListener('blur', finishEdit);
        input.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                finishEdit();
            } else if (e.key === 'Escape') {
                input.value = currentName;
                finishEdit();
            }
        });
    }

    /**
     * Prompt user to change layer color
     * @param layerId Layer ID
     * @param targetElement The element that was clicked
     */
    private promptColorChange(layerId: string, targetElement: HTMLElement): void {
        // Remove any existing color picker
        if (this.colorPickerElement) {
            this.colorPickerElement.remove();
            this.colorPickerElement = null;
        }

        // Create color picker
        const colorPicker = document.createElement('div');
        colorPicker.className = 'timeline-color-picker';

        // Add color swatches
        COLORS.LAYER_DEFAULTS.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'timeline-color-swatch';
            swatch.style.backgroundColor = color;
            swatch.addEventListener('click', (e) => {
                e.stopPropagation();
                this.options.onLayerColorChange(layerId, color);
                colorPicker.remove();
                this.colorPickerElement = null;
            });
            colorPicker.appendChild(swatch);
        });

        // Position the color picker near the target
        const rect = targetElement.getBoundingClientRect();
        colorPicker.style.position = 'absolute';
        colorPicker.style.top = `${rect.bottom + 5}px`;
        colorPicker.style.left = `${rect.left}px`;

        // Add to document
        document.body.appendChild(colorPicker);
        this.colorPickerElement = colorPicker;
    }

    /**
     * Find parent element with specific class
     * @param element Starting element
     * @param className Class to find
     * @returns Parent element or null
     */
    private findParentWithClass(element: HTMLElement | null, className: string): HTMLElement | null {
        while (element && !element.classList.contains(className)) {
            element = element.parentElement;
        }
        return element;
    }

    /**
     * Clean up event listeners
     */
    public destroy(): void {
        const element = this.getElement();
        if (element) {
            element.removeEventListener('click', this.handleClick.bind(this));
            element.removeEventListener('dblclick', this.handleDoubleClick.bind(this));
            element.removeEventListener('mousedown', this.handleMouseDown.bind(this));
        }

        document.removeEventListener('mousemove', this.handleMouseMove.bind(this));
        document.removeEventListener('mouseup', this.handleMouseUp.bind(this));
        document.removeEventListener('click', this.handleOutsideClick.bind(this));

        if (this.colorPickerElement) {
            this.colorPickerElement.remove();
            this.colorPickerElement = null;
        }
    }
}