/**
 * Layer Manager
 * Manages the layer data and UI interactions
 */
import { Layer } from '../../core/DataModel';
import { EventEmitter } from '../../core/EventEmitter';
import { Component } from '../../core/BaseComponent';
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
export declare class LayerManager extends Component {
    private eventEmitter;
    private layers;
    private dragLayer;
    private dragIndex;
    private options;
    private colorPickerElement;
    constructor(options: LayerManagerOptions);
    /**
     * Initialize the layer manager
     */
    private init;
    /**
     * Initialize event listeners
     */
    initialize(): void;
    /**
     * Update the layers array
     * @param layers Updated layers array
     */
    update(layers: Layer[]): void;
    /**
     * Generate the HTML for this component
     */
    render(): string;
    private renderLayer;
    /**
     * Render the layers content
     */
    private renderContent;
    private isGroup;
    private getLayerIndex;
    private getLayersWithIndentation;
    private addLayerWithChildren;
    private getChildLayers;
    /**
     * Create a new layer
     * @param name Layer name
     * @returns The new layer object
     */
    createLayer(name?: string): Partial<Layer>;
    /**
     * Handle container click events
     * @param e Mouse event
     */
    private handleClick;
    private showAddToGroupDialog;
    private removeFromGroup;
    /**
     * Handle double click events (for editing layer name)
     * @param e Mouse event
     */
    private handleDoubleClick;
    /**
     * Handle mouse down events (for drag and drop)
     * @param e Mouse event
     */
    private handleMouseDown;
    /**
     * Handle mouse move events (for drag and drop)
     * @param e Mouse event
     */
    private handleMouseMove;
    /**
     * Handle mouse up events (for drag and drop)
     * @param e Mouse event
     */
    private handleMouseUp;
    /**
     * Handle clicks outside the color picker
     * @param e Mouse event
     */
    private handleOutsideClick;
    /**
     * Prompt user to edit layer name
     * @param layerEl Layer element
     * @param layerId Layer ID
     */
    private promptLayerNameEdit;
    /**
     * Prompt user to change layer color
     * @param layerId Layer ID
     * @param targetElement The element that was clicked
     */
    private promptColorChange;
    /**
     * Find parent element with specific class
     * @param element Starting element
     * @param className Class to find
     * @returns Parent element or null
     */
    private findParentWithClass;
    /**
     * Clean up event listeners
     */
    destroy(): void;
}
