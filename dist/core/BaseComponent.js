// src/core/BaseComponent.ts
/**
 * Base Component Interface
 * Defines the contract for all timeline plugins/components
 */
/**
 * Base abstract class for timeline components
 * Provides common functionality
 */
export class Component {
    get MainControl() {
        return this.mainControl;
    }
    constructor(container, id) {
        this.container = container;
        this.elementId = id;
    }
    Registered(mainControl) {
        this.mainControl = mainControl;
    }
    /**
     * Initialize event listeners and other setup
     * Should be implemented by derived classes
     */
    initialize() {
        // Default implementation does nothing
    }
    /**
     * Clean up event listeners and resources
     * Should be implemented by derived classes
     */
    destroy() {
        // Default implementation does nothing
    }
    /**
     * Get the element ID for this component
     */
    getElementId() {
        return this.elementId;
    }
    /**
     * Get the DOM element for this component
     * @returns HTMLElement or null if not found
     */
    getElement() {
        return document.getElementById(this.elementId);
    }
    /**
     * Apply the rendered HTML to the container
     * @param html HTML string to apply
     */
    applyHTML(html) {
        this.container.innerHTML = html;
    }
}
//# sourceMappingURL=BaseComponent.js.map