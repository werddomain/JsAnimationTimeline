/**
 * Property Editor Component
 * Provides a UI for editing CSS animation properties of selected elements
 */
import { Component } from '../../core/BaseComponent';
import { EventEmitter } from '../../core/EventEmitter';
import { PanelElementData } from '../panel/PanelComponent';
export interface PropertyEditorOptions {
    container: HTMLElement;
    eventEmitter: EventEmitter;
    onPropertyChange: (elementId: string, property: string, value: any) => void;
}
export declare class PropertyEditor extends Component {
    private eventEmitter;
    private options;
    private selectedElement;
    private propertyGroups;
    constructor(options: PropertyEditorOptions);
    /**
     * Initialize property groups
     */
    private initPropertyGroups;
    /**
     * Initialize the property editor
     */
    private init;
    /**
     * Initialize event listeners
     */
    initialize(): void;
    /**
     * Set the selected element
     * @param element Selected element or null
     */
    setSelectedElement(element: PanelElementData | null): void;
    /**
     * Generate HTML for the property editor
     */
    render(): string;
    /**
     * Update the property editor
     */
    update(data: any): void;
    /**
     * Render property groups
     */
    private renderPropertyGroups;
    /**
     * Render properties in a group
     */
    private renderProperties;
    /**
     * Render appropriate input for a property
     */
    private renderInput;
    /**
     * Get property value from selected element or default
     */
    private getPropertyValue;
    /**
     * Handle input events (for ranges and immediate updates)
     */
    private handleInput;
    /**
     * Handle change events
     */
    private handleChange;
    /**
     * Handle click events
     */
    private handleClick;
    /**
     * Find property definition by name
     */
    private findPropertyByName;
    /**
     * Normalize color value to hex format for color inputs
     */
    private normalizeColor;
    /**
     * Find parent element with specific class
     */
    private findParentWithClass;
    /**
     * Clean up event listeners
     */
    destroy(): void;
}
