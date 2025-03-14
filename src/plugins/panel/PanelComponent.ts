// src/plugins/panel/PanelComponent.ts
/**
 * Panel Component
 * Provides a visual canvas where divs are linked to timeline layers
 */

import { Component } from '../../core/BaseComponent';
import { EventEmitter } from '../../core/EventEmitter';
import { TimelineConstants } from '../../core/Constants';
import { Layer } from '../../core/DataModel';

const { EVENTS, CSS_CLASSES } = TimelineConstants;

export interface PanelComponentOptions {
    container: HTMLElement;
    eventEmitter: EventEmitter;
    onLayerAdd: (name: string, color: string) => string; // Returns the new layer ID
    onElementSelect: (elementId: string) => void;
}

// Add properties field to PanelElementData interface
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
    properties?: Record<string, any>; // Added properties field
}

export interface PanelData {
    layers?: Layer[];
    elements?: PanelElementData[];
    currentTime?: number;
    selectedElementId?: string | null;
}

export class PanelComponent extends Component {
    private eventEmitter: EventEmitter;
    private options: PanelComponentOptions;
    private elements: PanelElementData[] = [];
    private layers: Layer[] = [];
    private currentTime: number = 0;
    private selectedElementId: string | null = null;
    private dragElement: HTMLElement | null = null;
    private dragStartX: number = 0;
    private dragStartY: number = 0;
    private dragStartPos = { x: 0, y: 0 };
    private resizeElement: HTMLElement | null = null;
    private resizeStartWidth: number = 0;
    private resizeStartHeight: number = 0;
    private resizeStartX: number = 0;
    private resizeStartY: number = 0;
    private resizeDirection: string = '';

    constructor(options: PanelComponentOptions) {
        super(options.container, 'timeline-panel');
        this.eventEmitter = options.eventEmitter;
        this.options = options;

        this.init();
    }

    /**
     * Initialize the panel
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
            element.addEventListener('mousedown', this.handleMouseDown.bind(this));

            // Add global handlers for drag and resize
            document.addEventListener('mousemove', this.handleMouseMove.bind(this));
            document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        }

        // Listen for timeline events
        this.eventEmitter.on(EVENTS.TIME_CHANGE, (time: number) => {
            this.currentTime = time;
            this.updateElementsAtTime(time);
        });

        this.eventEmitter.on(EVENTS.LAYER_SELECTED, (layerId: string) => {
            // Find element with this layer ID and select it
            const element = this.elements.find(e => e.layerId === layerId);
            if (element) {
                this.selectElement(element.id);
            }
        });
    }

    /**
     * Generate HTML for the panel
     */
    public render(): string {
        return `
      <div id="${this.elementId}" class="timeline-panel">
        <div class="timeline-panel-header">
          <h3>Visual Panel</h3>
          <button class="timeline-panel-add-btn" title="Add new element">+</button>
        </div>
        <div class="timeline-panel-content">
          ${this.renderElements()}
        </div>
      </div>
    `;
    }

    /**
     * Render all panel elements
     */
    /**
 * Render all panel elements with CSS properties
 */
    private renderElements(): string {
        if (this.elements.length === 0) {
            return '<div class="timeline-panel-empty">No elements. Click "+" to add a new element.</div>';
        }

        return this.elements.map(element => {
            const layer = this.layers.find(l => l.id === element.layerId);
            const color = layer ? layer.color : '#CCCCCC';
            const isSelected = element.id === this.selectedElementId;

            // Create style attribute with base properties
            let styleAttr = `
      left: ${element.x}px;
      top: ${element.y}px;
      width: ${element.width}px;
      height: ${element.height}px;
      transform: rotate(${element.rotation}deg);
      opacity: ${element.opacity};
      z-index: ${element.zIndex};
      background-color: ${color};
      ${this.applyElementProperties(element)}
    `;

            // Create wrapping container for element content
            const contentStyle = element.properties ?
                `style="${this.applyElementProperties(element)}"` : '';
            const contentHtml = element.content || '';
            const contentContainer = `<div class="timeline-panel-element-content" ${contentStyle}>${contentHtml}</div>`;

            return `
      <div class="timeline-panel-element ${isSelected ? 'selected' : ''}"
           data-id="${element.id}"
           data-layer-id="${element.layerId}"
           style="${styleAttr}">
        ${contentContainer}
        
        ${isSelected ? this.renderResizeHandles() : ''}
      </div>
    `;
        }).join('');
    }

    /**
     * Render resize handles for selected element
     */
    private renderResizeHandles(): string {
        return `
      <div class="timeline-panel-resize-handle top-left" data-direction="top-left"></div>
      <div class="timeline-panel-resize-handle top" data-direction="top"></div>
      <div class="timeline-panel-resize-handle top-right" data-direction="top-right"></div>
      <div class="timeline-panel-resize-handle right" data-direction="right"></div>
      <div class="timeline-panel-resize-handle bottom-right" data-direction="bottom-right"></div>
      <div class="timeline-panel-resize-handle bottom" data-direction="bottom"></div>
      <div class="timeline-panel-resize-handle bottom-left" data-direction="bottom-left"></div>
      <div class="timeline-panel-resize-handle left" data-direction="left"></div>
      <div class="timeline-panel-element-toolbar">
        <button class="timeline-panel-element-btn" data-action="edit" title="Edit Content">✏️</button>
        <button class="timeline-panel-element-btn" data-action="delete" title="Delete Element">🗑️</button>
      </div>
    `;
    }

    /**
     * Update component data
     */
    public update(data: PanelData): void {
        let needsUpdate = false;

        if (data.layers !== undefined) {
            this.layers = data.layers;
            needsUpdate = true;
        }

        if (data.elements !== undefined) {
            this.elements = data.elements;
            needsUpdate = true;
        }

        if (data.currentTime !== undefined) {
            this.currentTime = data.currentTime;
            this.updateElementsAtTime(data.currentTime);
            needsUpdate = true;
        }

        if (data.selectedElementId !== undefined) {
            this.selectedElementId = data.selectedElementId;
            needsUpdate = true;
        }

        if (needsUpdate) {
            const element = this.getElement();
            if (element) {
                const content = element.querySelector('.timeline-panel-content');
                if (content) {
                    content.innerHTML = this.renderElements();
                }
            }
        }
    }

    /**
     * Handle panel clicks
     */
    private handleClick(e: MouseEvent): void {
        const target = e.target as HTMLElement;

        // Handle add button click
        if (target.classList.contains('timeline-panel-add-btn')) {
            this.addNewElement();
            return;
        }

        // Handle element toolbar button clicks
        if (target.classList.contains('timeline-panel-element-btn')) {
            const action = target.getAttribute('data-action');
            const elementEl = this.findParentWithClass(target, 'timeline-panel-element');
            if (!elementEl) return;

            const elementId = elementEl.getAttribute('data-id');
            if (!elementId) return;

            if (action === 'edit') {
                this.editElementContent(elementId);
            } else if (action === 'delete') {
                this.deleteElement(elementId);
            }

            return;
        }

        // Handle element selection
        const elementEl = this.findParentWithClass(target, 'timeline-panel-element');
        if (elementEl && !target.classList.contains('timeline-panel-resize-handle')) {
            const elementId = elementEl.getAttribute('data-id');
            if (elementId) {
                this.selectElement(elementId);
            }
        }
    }

    /**
     * Handle mouse down events
     */
    private handleMouseDown(e: MouseEvent): void {
        const target = e.target as HTMLElement;

        // Check if clicked on resize handle
        if (target.classList.contains('timeline-panel-resize-handle')) {
            const elementEl = this.findParentWithClass(target, 'timeline-panel-element');
            if (!elementEl) return;

            this.resizeElement = elementEl;
            this.resizeDirection = target.getAttribute('data-direction') || '';

            // Get initial dimensions
            const element = this.findElementById(elementEl.getAttribute('data-id') || '');
            if (!element) return;

            this.resizeStartWidth = element.width;
            this.resizeStartHeight = element.height;
            this.resizeStartX = e.clientX;
            this.resizeStartY = e.clientY;

            e.preventDefault();
            return;
        }

        // Check if clicked on an element (for dragging)
        const elementEl = this.findParentWithClass(target, 'timeline-panel-element');
        if (elementEl && !target.classList.contains('timeline-panel-element-btn')) {
            // Only if not clicking on a button
            this.dragElement = elementEl;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;

            const element = this.findElementById(elementEl.getAttribute('data-id') || '');
            if (element) {
                this.dragStartPos = { x: element.x, y: element.y };
            }

            e.preventDefault();
        }
    }

    /**
     * Handle mouse move events
     */
    private handleMouseMove(e: MouseEvent): void {
        // Handle resizing
        if (this.resizeElement) {
            const elementId = this.resizeElement.getAttribute('data-id') || '';
            const element = this.findElementById(elementId);
            if (!element) return;

            const deltaX = e.clientX - this.resizeStartX;
            const deltaY = e.clientY - this.resizeStartY;

            let newWidth = this.resizeStartWidth;
            let newHeight = this.resizeStartHeight;
            let newX = element.x;
            let newY = element.y;

            // Apply resize based on direction
            if (this.resizeDirection.includes('right')) {
                newWidth = Math.max(20, this.resizeStartWidth + deltaX);
            }
            if (this.resizeDirection.includes('bottom')) {
                newHeight = Math.max(20, this.resizeStartHeight + deltaY);
            }
            if (this.resizeDirection.includes('left')) {
                const widthChange = this.resizeStartWidth - Math.max(20, this.resizeStartWidth - deltaX);
                newWidth = this.resizeStartWidth - widthChange;
                newX = element.x + widthChange;
            }
            if (this.resizeDirection.includes('top')) {
                const heightChange = this.resizeStartHeight - Math.max(20, this.resizeStartHeight - deltaY);
                newHeight = this.resizeStartHeight - heightChange;
                newY = element.y + heightChange;
            }

            // Update element visually
            this.resizeElement.style.width = `${newWidth}px`;
            this.resizeElement.style.height = `${newHeight}px`;
            this.resizeElement.style.left = `${newX}px`;
            this.resizeElement.style.top = `${newY}px`;

            return;
        }

        // Handle dragging
        if (this.dragElement) {
            const deltaX = e.clientX - this.dragStartX;
            const deltaY = e.clientY - this.dragStartY;

            const newX = this.dragStartPos.x + deltaX;
            const newY = this.dragStartPos.y + deltaY;

            // Update element visually
            this.dragElement.style.left = `${newX}px`;
            this.dragElement.style.top = `${newY}px`;
        }
    }

    /**
     * Handle mouse up events
     */
    private handleMouseUp(e: MouseEvent): void {
        // Finish resizing
        if (this.resizeElement) {
            const elementId = this.resizeElement.getAttribute('data-id') || '';
            const element = this.findElementById(elementId);
            if (element) {
                // Update data model with new size and position
                element.width = parseInt(this.resizeElement.style.width);
                element.height = parseInt(this.resizeElement.style.height);
                element.x = parseInt(this.resizeElement.style.left);
                element.y = parseInt(this.resizeElement.style.top);

                // Update keyframe at current time
                this.updateElementKeyframe(element);
            }

            this.resizeElement = null;
            return;
        }

        // Finish dragging
        if (this.dragElement) {
            const elementId = this.dragElement.getAttribute('data-id') || '';
            const element = this.findElementById(elementId);
            if (element) {
                // Update data model with new position
                element.x = parseInt(this.dragElement.style.left);
                element.y = parseInt(this.dragElement.style.top);

                // Update keyframe at current time
                this.updateElementKeyframe(element);
            }

            this.dragElement = null;
        }
    }

    /**
     * Add a new element to the panel
     */
    private addNewElement(): void {
        // Generate a color for the new element
        const color = this.getNextColor();
        const name = `Element ${this.elements.length + 1}`;

        // Create a new layer for this element
        const layerId = this.options.onLayerAdd(name, color);

        // Get panel dimensions
        const element = this.getElement();
        if (!element) return;

        const content = element.querySelector('.timeline-panel-content');
        if (!content) return;

        const rect = content.getBoundingClientRect();

        // Create new element data
        const elementData: PanelElementData = {
            id: `panel-element-${Date.now()}`,
            layerId,
            x: rect.width / 2 - 50,
            y: rect.height / 2 - 50,
            width: 100,
            height: 100,
            rotation: 0,
            opacity: 1,
            zIndex: this.elements.length + 1
        };

        // Add to elements array
        this.elements.push(elementData);

        // Update keyframe
        this.updateElementKeyframe(elementData);

        // Update display
        this.update({});

        // Select the new element
        this.selectElement(elementData.id);
    }

    /**
     * Select an element
     */
    private selectElement(elementId: string): void {
        this.selectedElementId = elementId;

        // Find associated layer
        const element = this.findElementById(elementId);
        if (element) {
            this.options.onElementSelect(element.layerId);

            // Emit selection event for property editor
            this.eventEmitter.emit('panel:element:selected', element);
        }

        // Update display
        this.update({});
    }

    // When no element is selected
    /**
     * Handle clicks outside elements
     */
    private handleOutsideClick(e: MouseEvent): void {
        const panelContent = this.getElement()?.querySelector('.timeline-panel-content');
        if (panelContent && e.target === panelContent) {
            this.selectedElementId = null;
            this.eventEmitter.emit('panel:element:deselected');
            this.update({});
        }
    }

    // Add method to handle property changes
    /**
     * Update element property
     */
    public updateElementProperty(elementId: string, property: string, value: any): void {
        const element = this.findElementById(elementId);
        if (!element) return;

        // Initialize properties object if needed
        if (!element.properties) {
            element.properties = {};
        }

        // Check if it's a built-in property
        const builtInProps = ['x', 'y', 'width', 'height', 'rotation', 'opacity', 'zIndex'];
        if (builtInProps.includes(property)) {
            (element as any)[property] = value;
        } else {
            // It's a custom property
            element.properties[property] = value;
        }

        // Update element in DOM
        this.update({});

        // Update keyframe
        this.updateElementKeyframe(element);
    }

    // Method to apply CSS properties to element content
    /**
     * Apply CSS properties to the element's rendered HTML
     */
    private applyElementProperties(element: PanelElementData): string {
        if (!element.properties) return '';

        let styles = '';

        // Apply CSS properties
        for (const [key, value] of Object.entries(element.properties)) {
            // Skip undefined or null values
            if (value === undefined || value === null) continue;

            // Handle special properties
            switch (key) {
                // Transform properties
                case 'scaleX':
                case 'scaleY':
                case 'translateX':
                case 'translateY':
                case 'skewX':
                case 'skewY':
                    // These will be combined into a transform property
                    break;

                // Filter properties
                case 'blur':
                case 'brightness':
                case 'contrast':
                case 'grayscale':
                case 'hueRotate':
                case 'invert':
                case 'saturate':
                case 'sepia':
                    // These will be combined into a filter property
                    break;

                // Box shadow properties
                case 'boxShadowX':
                case 'boxShadowY':
                case 'boxShadowBlur':
                case 'boxShadowSpread':
                case 'boxShadowColor':
                    // These will be combined into a box-shadow property
                    break;

                // Text shadow properties
                case 'textShadowX':
                case 'textShadowY':
                case 'textShadowBlur':
                case 'textShadowColor':
                    // These will be combined into a text-shadow property
                    break;

                // Regular CSS properties
                default:
                    styles += `${this.camelToDash(key)}: ${value}${this.getPropertyUnit(key)}; `;
            }
        }

        // Add transform property if any transform values exist
        const transforms = [];
        if (element.properties.translateX) transforms.push(`translateX(${element.properties.translateX}px)`);
        if (element.properties.translateY) transforms.push(`translateY(${element.properties.translateY}px)`);
        if (element.properties.scaleX) transforms.push(`scaleX(${element.properties.scaleX})`);
        if (element.properties.scaleY) transforms.push(`scaleY(${element.properties.scaleY})`);
        if (element.properties.skewX) transforms.push(`skewX(${element.properties.skewX}deg)`);
        if (element.properties.skewY) transforms.push(`skewY(${element.properties.skewY}deg)`);

        if (transforms.length > 0) {
            styles += `transform: ${transforms.join(' ')}; `;
        }

        // Add filter property if any filter values exist
        const filters = [];
        if (element.properties.blur) filters.push(`blur(${element.properties.blur}px)`);
        if (element.properties.brightness) filters.push(`brightness(${element.properties.brightness}%)`);
        if (element.properties.contrast) filters.push(`contrast(${element.properties.contrast}%)`);
        if (element.properties.grayscale) filters.push(`grayscale(${element.properties.grayscale}%)`);
        if (element.properties.hueRotate) filters.push(`hue-rotate(${element.properties.hueRotate}deg)`);
        if (element.properties.invert) filters.push(`invert(${element.properties.invert}%)`);
        if (element.properties.saturate) filters.push(`saturate(${element.properties.saturate}%)`);
        if (element.properties.sepia) filters.push(`sepia(${element.properties.sepia}%)`);

        if (filters.length > 0) {
            styles += `filter: ${filters.join(' ')}; `;
        }

        // Add box-shadow property if any box-shadow values exist
        if (element.properties.boxShadowColor) {
            const x = element.properties.boxShadowX || 0;
            const y = element.properties.boxShadowY || 0;
            const blur = element.properties.boxShadowBlur || 0;
            const spread = element.properties.boxShadowSpread || 0;
            const color = element.properties.boxShadowColor;

            styles += `box-shadow: ${x}px ${y}px ${blur}px ${spread}px ${color}; `;
        }

        // Add text-shadow property if any text-shadow values exist
        if (element.properties.textShadowColor) {
            const x = element.properties.textShadowX || 0;
            const y = element.properties.textShadowY || 0;
            const blur = element.properties.textShadowBlur || 0;
            const color = element.properties.textShadowColor;

            styles += `text-shadow: ${x}px ${y}px ${blur}px ${color}; `;
        }

        return styles;
    }
    // Utility method to convert camelCase to dash-case for CSS properties
    /**
     * Convert camelCase to dash-case
     */
    private camelToDash(str: string): string {
        return str.replace(/([A-Z])/g, '-$1').toLowerCase();
    }

    // Utility method to get appropriate unit for a property
    /**
     * Get the appropriate unit for a property
     */
    private getPropertyUnit(property: string): string {
        // Properties that need px units
        const pxProperties = [
            'fontSize', 'borderWidth', 'borderRadius', 'letterSpacing',
            'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
            'marginTop', 'marginRight', 'marginBottom', 'marginLeft'
        ];

        if (pxProperties.includes(property)) {
            return 'px';
        }

        // Properties that need % units
        const percentProperties = [
            'width', 'height', 'maxWidth', 'maxHeight'
        ];

        if (percentProperties.includes(property) &&
            typeof this.properties[property] === 'number' &&
            this.properties[property] <= 1) {
            return '%';
        }

        return '';
    }
    /**
     * Edit element content
     */
    private editElementContent(elementId: string): void {
        const element = this.findElementById(elementId);
        if (!element) return;

        // In a real implementation, this would open a content editor dialog
        // For simplicity, we'll use a prompt
        const content = prompt('Enter element content (HTML):', element.content || '');
        if (content !== null) {
            element.content = content;
            this.updateElementKeyframe(element);
            this.update({});
        }
    }

    /**
     * Delete an element
     */
    private deleteElement(elementId: string): void {
        const index = this.elements.findIndex(e => e.id === elementId);
        if (index === -1) return;

        this.elements.splice(index, 1);

        if (this.selectedElementId === elementId) {
            this.selectedElementId = null;
        }

        this.update({});
    }

    /**
     * Update element keyframe at current time
     */
    private updateElementKeyframe(element: PanelElementData): void {
        // This would trigger an update to the timeline model
        // For now, we'll just update our local data

        // In a real implementation, this would add/update a keyframe in the timeline
        // For the associated layer at the current time with the element properties
        console.log(`Updated keyframe for ${element.id} at time ${this.currentTime}`);

        // Emit an event that the timeline could listen to
        this.eventEmitter.emit('panel:element:updated', element, this.currentTime);
    }

    /**
     * Update elements based on keyframes at the current time
     */
    private updateElementsAtTime(time: number): void {
        // In a real implementation, this would get properties from keyframes
        // at the current time and update the elements accordingly

        // For now, we'll keep it simple - no animation yet
        // This is where the connection to the timeline keyframes would happen
    }

    /**
     * Find element by ID
     */
    private findElementById(id: string): PanelElementData | undefined {
        return this.elements.find(e => e.id === id);
    }

    /**
     * Get the next color for a new element
     */
    private getNextColor(): string {
        const colors = TimelineConstants.COLORS.LAYER_DEFAULTS;
        return colors[this.elements.length % colors.length];
    }

    /**
     * Find parent element with specific class
     */
    private findParentWithClass(element: HTMLElement | null, className: string): HTMLElement | null {
        while (element && !element.classList.contains(className)) {
            element = element.parentElement;
        }
        return element;
    }

    /**
     * Get all elements
     * @returns Array of panel elements
     */
    public getElements(): PanelElementData[] {
        return [...this.elements];
    }

    /**
     * Add a new element with specified properties
     * @param elementData Element data
     * @returns The new element's ID
     */
    public addElement(elementData: Omit<PanelElementData, 'id'>): string {
        const id = `panel-element-${Date.now()}-${this.elements.length}`;

        const newElement: PanelElementData = {
            ...elementData,
            id
        };

        this.elements.push(newElement);
        this.update({});

        return id;
    }

    /**
     * Update an element with new properties
     * @param elementId Element ID
     * @param properties New properties
     * @returns True if element was updated
     */
    public updateElement(elementId: string, properties: Partial<PanelElementData>): boolean {
        const element = this.findElementById(elementId);
        if (!element) return false;

        // Update properties
        Object.assign(element, properties);

        // Update display
        this.update({});

        return true;
    }
    /**
   * Clean up event listeners
   */
    public destroy(): void {
        const element = this.getElement();
        if (element) {
            element.removeEventListener('click', this.handleClick.bind(this));
            element.removeEventListener('mousedown', this.handleMouseDown.bind(this));
        }

        document.removeEventListener('mousemove', this.handleMouseMove.bind(this));
        document.removeEventListener('mouseup', this.handleMouseUp.bind(this));
    }
}