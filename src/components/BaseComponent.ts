/**
 * BaseComponent abstract class
 * Provides base functionality for all components in the timeline animation editor
 */
export abstract class BaseComponent {
    protected element: HTMLElement | null = null;
    protected container: HTMLElement;
    protected id: string;
    protected options: any;

    /**
     * Constructor for BaseComponent
     * @param container - The container element to render the component in
     * @param id - Unique identifier for the component
     * @param options - Configuration options for the component
     */
    constructor(container: HTMLElement | string, id: string, options: any = {}) {
        // If container is a string, find the element by ID
        if (typeof container === 'string') {
            const containerElement = document.getElementById(container);
            if (!containerElement) {
                throw new Error(`Container element with id "${container}" not found`);
            }
            this.container = containerElement;
        } else {
            this.container = container;
        }
        
        this.id = id;
        this.options = options;
    }

    /**
     * Initialize the component
     * This should be implemented by subclasses to set up event listeners
     */
    public abstract initialize(): void;

    /**
     * Render the component
     * This should be implemented by subclasses to generate HTML
     * @returns HTML string representation of the component
     */
    public abstract render(): string;

    /**
     * Update the component with new data
     * This should be implemented by subclasses
     * @param data - Data to update the component with
     */
    public abstract update(data?: any): void;

    /**
     * Destroy the component and clean up resources
     * This should be implemented by subclasses to remove event listeners
     */
    public abstract destroy(): void;    /**
     * Mount the component to the DOM
     * Renders the component and updates the DOM
     */    public mount(): void {
        if (!this.container) {
            throw new Error(`Cannot mount component ${this.id} - container is null`);
        }
        
        console.log(`Mounting component ${this.id} to container:`, this.container);
        
        const html = this.render();
        this.container.innerHTML = html;
        this.element = this.container.firstElementChild as HTMLElement;
        
        if (!this.element) {
            throw new Error(`Failed to mount component ${this.id} - element not created`);
        }
        
        console.log(`Component ${this.id} mounted successfully`, this.element);
        
        // Don't automatically call initialize from mount to avoid recursion
        // Subclasses should call initialize separately after mount
    }

    /**
     * Get the component's element
     * @returns The component's DOM element
     */
    public getElement(): HTMLElement | null {
        return this.element;
    }

    /**
     * Get the component's container element
     * @returns The component's container DOM element
     */
    public getContainer(): HTMLElement {
        return this.container;
    }

    /**
     * Get the component's ID
     * @returns The component's ID
     */
    public getId(): string {
        return this.id;
    }
}
