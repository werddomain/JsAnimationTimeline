// src/core/BaseComponent.ts
/**
 * Base Component Interface
 * Defines the contract for all timeline plugins/components
 */

import { TimelineControl } from "./TimelineControl";

export interface BaseComponent {
    
    Registered(mainControl: TimelineControl);

    /**
     * Generate the HTML for this component
     * @returns HTML string
     */
    render(): string;

    /**
     * Update the component with new data
     * @param data Component-specific data
     */
    update(data: any): void;

    /**
     * Initialize the component
     */
    initialize(): void;

    /**
     * Cleanup the component
     */
    destroy(): void;

    /**
     * Get the element ID for this component
     * Important for finding the component's DOM element after it's rendered
     * @returns Element ID string
     */
    getElementId(): string;
}

/**
 * Base abstract class for timeline components
 * Provides common functionality
 */
export abstract class Component implements BaseComponent {
    protected elementId: string;
    protected container: HTMLElement;
    private mainControl: TimelineControl
    public get MainControl(): TimelineControl {
        return this.mainControl;
    }
    constructor(container: HTMLElement, id: string) {
        this.container = container;
        this.elementId = id;
        

    }

    Registered(mainControl: TimelineControl): void {
        this.mainControl = mainControl;
    }


    /**
     * Generate the HTML for this component
     * Must be implemented by derived classes
     */
    abstract render(): string;

    /**
     * Update the component with new data
     * Should be implemented by derived classes
     */
    abstract update(data: any): void;

    /**
     * Initialize event listeners and other setup
     * Should be implemented by derived classes
     */
    initialize(): void {
        // Default implementation does nothing
    }

    /**
     * Clean up event listeners and resources
     * Should be implemented by derived classes
     */
    destroy(): void {
        // Default implementation does nothing
    }

    /**
     * Get the element ID for this component
     */
    getElementId(): string {
        return this.elementId;
    }

    /**
     * Get the DOM element for this component
     * @returns HTMLElement or null if not found
     */
    protected getElement(): HTMLElement | null {
        return document.getElementById(this.elementId);
    }

    /**
     * Apply the rendered HTML to the container
     * @param html HTML string to apply
     */
    protected applyHTML(html: string): void {
        this.container.innerHTML = html;
    }
}