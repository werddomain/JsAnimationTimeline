/**
 * Panel Component
 * Provides a visual canvas where divs are linked to timeline layers
 */
import { Component } from '../../core/BaseComponent';
import { EventEmitter } from '../../core/EventEmitter';
import { Layer } from '../../core/DataModel';
export interface PanelComponentOptions {
    container: HTMLElement;
    eventEmitter: EventEmitter;
    onLayerAdd: (name: string, color: string) => string;
    onElementSelect: (elementId: string) => void;
}
export interface PanelElementData {
    id: string;
    layerId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    opacity: number;
    zIndex: number;
    content?: string;
    properties?: Record<string, any>;
    modifiedProperties?: Set<string>;
}
export interface PanelData {
    layers?: Layer[];
    elements?: PanelElementData[];
    currentTime?: number;
    selectedElementId?: string | null;
}
export declare class PanelComponent extends Component {
    private eventEmitter;
    private options;
    private elements;
    private layers;
    private currentTime;
    private selectedElementId;
    private dragElement;
    private dragStartX;
    private dragStartY;
    private dragStartPos;
    private resizeElement;
    private resizeStartWidth;
    private resizeStartHeight;
    private resizeStartX;
    private resizeStartY;
    private resizeDirection;
    constructor(options: PanelComponentOptions);
    /**
     * Initialize the panel
     */
    private init;
    /**
     * Initialize event listeners
     */
    initialize(): void;
    /**
     * Generate HTML for the panel
     */
    render(): string;
    /**
     * Render all panel elements
     */
    /**
 * Render all panel elements with CSS properties
 */
    private renderElements;
    /**
     * Render resize handles for selected element
     */
    private renderResizeHandles;
    /**
     * Update component data
     */
    update(data: PanelData): void;
    /**
     * Handle panel clicks
     */
    private handleClick;
    /**
     * Handle mouse down events
     */
    private handleMouseDown;
    /**
     * Handle mouse move events
     */
    private handleMouseMove;
    /**
     * Handle mouse up events
     */
    private handleMouseUp;
    /**
     * Add a new element to the panel
     */
    private addNewElement;
    /**
     * Select an element
     */
    private selectElement;
    /**
     * Handle clicks outside elements
     */
    private handleOutsideClick;
    /**
     * Update element property
     */
    updateElementProperty(elementId: string, property: string, value: any): void;
    /**
     * Apply CSS properties to the element's rendered HTML
     */
    private applyElementProperties;
    /**
     * Convert camelCase to dash-case
     */
    private camelToDash;
    /**
     * Get the appropriate unit for a property
     */
    private getPropertyUnit;
    /**
     * Edit element content
     */
    private editElementContent;
    /**
     * Delete an element
     */
    private deleteElement;
    /**
     * Update element keyframe at current time
     */
    private updateElementKeyframe;
    /**
     * Update elements based on keyframes at the current time
     */
    private updateElementsAtTime;
    /**
     * Find element by ID
     */
    private findElementById;
    /**
     * Get the next color for a new element
     */
    private getNextColor;
    /**
     * Find parent element with specific class
     */
    private findParentWithClass;
    /**
     * Get all elements
     * @returns Array of panel elements
     */
    getElements(): PanelElementData[];
    /**
     * Add a new element with specified properties
     * @param elementData Element data
     * @returns The new element's ID
     */
    addElement(elementData: Omit<PanelElementData, 'id'>): string;
    /**
     * Update an element with new properties
     * @param elementId Element ID
     * @param properties New properties
     * @returns True if element was updated
     */
    updateElement(elementId: string, properties: Partial<PanelElementData>): boolean;
    /**
   * Clean up event listeners
   */
    destroy(): void;
}
