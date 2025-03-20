// src/core/PluginManager.ts
/**
 * Plugin Manager
 * Manages plugins/components in the timeline control
 */
export class PluginManager {
    /**
     * Get the components
     * @returns Components instance
     */
    get Components() {
        return this.components;
    }
    get MainControl() {
        return this.mainControl;
    }
    registerComponents(mainControl, components) {
        this.components = components;
        this.mainControl = mainControl;
    }
    constructor(container, eventEmitter) {
        this.plugins = new Map();
        this.container = container;
        this.eventEmitter = eventEmitter;
    }
    /**
     * Register a plugin
     * @param id Plugin ID
     * @param plugin Plugin/component instance
     */
    register(id, plugin) {
        this.plugins.set(id, plugin);
        plugin.Registered(this.mainControl);
    }
    /**
     * Get a plugin by ID
     * @param id Plugin ID
     * @returns Plugin instance or undefined
     */
    get(id) {
        return this.plugins.get(id);
    }
    /**
     * Check if a plugin exists
     * @param id Plugin ID
     * @returns True if plugin exists
     */
    has(id) {
        return this.plugins.has(id);
    }
    /**
     * Initialize all plugins
     */
    initializeAll() {
        this.plugins.forEach(plugin => {
            plugin.initialize();
        });
    }
    /**
     * Render all plugins to their containers
     */
    renderAll() {
        const fragment = document.createDocumentFragment();
        const placeholderElements = new Map();
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
    destroyAll() {
        this.plugins.forEach(plugin => {
            plugin.destroy();
        });
        this.plugins.clear();
    }
}
//# sourceMappingURL=PluginManager.js.map