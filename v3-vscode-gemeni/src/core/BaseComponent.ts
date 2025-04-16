/**
 * Base component class that all timeline components will extend
 */
export abstract class BaseComponent {
    protected element: HTMLElement | null = null;
    protected container: HTMLElement;
    protected id: string;

    /**
     * Constructor for BaseComponent
     * @param container The container element where this component will be rendered
     * @param id The id for this component's element
     */
    constructor(container: HTMLElement, id: string) {
        this.container = container;
        this.id = id;
    }

    /**
     * Initialize the component
     * This method should be implemented by subclasses to set up event listeners
     */
    public abstract initialize(): void;

    /**
     * Render the component
     * This method should be implemented by subclasses to return HTML content
     * @returns HTML content as a string
     */
    public abstract render(): string;

    /**
     * Update the component with new data
     * This method should be implemented by subclasses to handle data updates
     * @param data The data to update the component with
     */
    public abstract update(data: any): void;

    /**
     * Clean up the component
     * This method should be implemented by subclasses to remove event listeners
     */
    public abstract destroy(): void;

    /**
     * Get the component's DOM element
     * @returns The component's DOM element
     */
    public getElement(): HTMLElement | null {
        return this.element;
    }

    /**
     * Mount the component to the container
     * This method renders the component and attaches it to the DOM
     */
    public mount(): void {
        this.container.innerHTML = this.render();
        this.element = document.getElementById(this.id);
        this.initialize();
    }

    /**
     * Safely remove event listeners and the component from the DOM
     */
    public unmount(): void {
        this.destroy();
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
    }

    /**
     * Helper method to create a DOM element with attributes and children
     * @param tag The HTML tag name
     * @param attributes The attributes to set on the element
     * @param content The content to add to the element (HTML string or child elements)
     * @returns The created DOM element
     */
    protected createElement(tag: string, attributes: Record<string, string> = {}, content?: string | HTMLElement | HTMLElement[]): HTMLElement {
        const element = document.createElement(tag);
        
        // Set attributes
        Object.entries(attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
        
        // Add content
        if (content) {
            if (typeof content === 'string') {
                element.innerHTML = content;
            } else if (Array.isArray(content)) {
                content.forEach(child => element.appendChild(child));
            } else {
                element.appendChild(content);
            }
        }
        
        return element;
    }
}
