// src/core/PluginManager.ts
/**
 * Plugin Manager
 * Manages plugins/components in the timeline control
 */

import { BaseComponent } from './BaseComponent';
import { Components } from './Components';
import { EventEmitter } from './EventEmitter';
import { TimelineControl } from './TimelineControl';

export class PluginManager {
    
    private components: Components;

    /**
     * Get the components
     * @returns Components instance
     */
    public get Components(): Components {
        return this.components;
    }
    private mainControl: TimelineControl
    public get MainControl(): TimelineControl {
        return this.mainControl;
    }
    registerComponents(mainControl: TimelineControl, components: Components) {
        this.components = components;
        this.mainControl = mainControl;

    }
    private plugins: Map<string, BaseComponent> = new Map();
    private eventEmitter: EventEmitter;
    private container: HTMLElement;

    constructor(container: HTMLElement, eventEmitter: EventEmitter) {
        this.container = container;
        this.eventEmitter = eventEmitter;
    }

    /**
     * Register a plugin
     * @param id Plugin ID
     * @param plugin Plugin/component instance
     */
    public register(id: string, plugin: BaseComponent): void {
        this.plugins.set(id, plugin);
        plugin.Registered(this.mainControl);
    }

    /**
     * Get a plugin by ID
     * @param id Plugin ID
     * @returns Plugin instance or undefined
     */
    public get<T extends BaseComponent>(id: string): T | undefined {
        return this.plugins.get(id) as T | undefined;
    }

    /**
     * Check if a plugin exists
     * @param id Plugin ID
     * @returns True if plugin exists
     */
    public has(id: string): boolean {
        return this.plugins.has(id);
    }

    /**
     * Initialize all plugins
     */
    public initializeAll(): void {
        this.plugins.forEach(plugin => {
            plugin.initialize();
        });
    }

    /**
     * Render all plugins to their containers
     */
    public renderAll(): void {
        const fragment = document.createDocumentFragment();
        const placeholderElements: Map<string, HTMLElement> = new Map();

        // First pass - create placeholder elements
        this.plugins.forEach((plugin, id) => {
            const placeholder = document.createElement('div');
            placeholder.id = `plugin-container-${id}`;
            placeholder.dataset.plugin = id;
            fragment.appendChild(placeholder);
            placeholderElements.set(id, placeholder);
        });

        // Append the fragment to the container
        this.container.appendChild(fragment);

        // Second pass - render each plugin to its placeholder
        this.plugins.forEach((plugin, id) => {
            const placeholder = placeholderElements.get(id);
            if (placeholder) {
                placeholder.innerHTML = plugin.render();
            }
        });
    }

    /**
     * Destroy and clean up all plugins
     */
    public destroyAll(): void {
        this.plugins.forEach(plugin => {
            plugin.destroy();
        });

        this.plugins.clear();
    }
}