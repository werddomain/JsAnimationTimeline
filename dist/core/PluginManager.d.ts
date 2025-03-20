/**
 * Plugin Manager
 * Manages plugins/components in the timeline control
 */
import { BaseComponent } from './BaseComponent';
import { Components } from './Components';
import { EventEmitter } from './EventEmitter';
import { TimelineControl } from './TimelineControl';
export declare class PluginManager {
    private components;
    /**
     * Get the components
     * @returns Components instance
     */
    get Components(): Components;
    private mainControl;
    get MainControl(): TimelineControl;
    registerComponents(mainControl: TimelineControl, components: Components): void;
    private plugins;
    private eventEmitter;
    private container;
    constructor(container: HTMLElement, eventEmitter: EventEmitter);
    /**
     * Register a plugin
     * @param id Plugin ID
     * @param plugin Plugin/component instance
     */
    register(id: string, plugin: BaseComponent): void;
    /**
     * Get a plugin by ID
     * @param id Plugin ID
     * @returns Plugin instance or undefined
     */
    get<T extends BaseComponent>(id: string): T | undefined;
    /**
     * Check if a plugin exists
     * @param id Plugin ID
     * @returns True if plugin exists
     */
    has(id: string): boolean;
    /**
     * Initialize all plugins
     */
    initializeAll(): void;
    /**
     * Render all plugins to their containers
     */
    renderAll(): void;
    /**
     * Destroy and clean up all plugins
     */
    destroyAll(): void;
}
