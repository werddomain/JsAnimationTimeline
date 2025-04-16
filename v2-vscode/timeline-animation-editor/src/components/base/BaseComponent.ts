export abstract class BaseComponent {
    protected container: HTMLElement;
    protected elementId: string;

    constructor(container: HTMLElement, elementId: string) {
        this.container = container;
        this.elementId = elementId;
    }

    public abstract initialize(): void;
    public abstract render(): string;
    public abstract update(data: any): void;
    public abstract destroy(): void;
}