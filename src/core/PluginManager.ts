/**
 * PluginManager class
 * Manages plugin lifecycle and dependencies
 */

import { BaseComponent } from '../components/BaseComponent';
import { EventEmitter } from './EventEmitter';
import { Events, PluginDependencies, PluginIds } from '../constants/Constants';

// Plugin interface
export interface IPlugin {
    id: string;
    plugin: BaseComponent;
    dependencies: string[];
    initialized: boolean;
}

export class PluginManager {
    private plugins: Map<string, IPlugin> = new Map();
    private eventEmitter: EventEmitter;
    
    /**
     * Constructor for PluginManager
     * @param eventEmitter - EventEmitter instance for plugin communication
     */
    constructor(eventEmitter: EventEmitter) {
        this.eventEmitter = eventEmitter;
    }
    
    /**
     * Register a plugin with the manager
     * @param id - Unique identifier for the plugin
     * @param plugin - Plugin instance
     * @param dependencies - Plugin dependencies (default is empty array)
     */
    public register(id: string, plugin: BaseComponent, dependencies: string[] = []): void {
        if (this.plugins.has(id)) {
            throw new Error(`Plugin with ID ${id} is already registered`);
        }
        
        this.plugins.set(id, {
            id,
            plugin,
            dependencies,
            initialized: false
        });
    }
    
    /**
     * Unregister a plugin from the manager
     * @param id - Plugin ID
     */
    public unregister(id: string): void {
        const plugin = this.plugins.get(id);
        
        if (!plugin) {
            return; // Nothing to unregister
        }
        
        // Check if any other plugins depend on this one
        this.plugins.forEach((p) => {
            if (p.dependencies.includes(id)) {
                throw new Error(`Cannot unregister plugin ${id} because plugin ${p.id} depends on it`);
            }
        });
        
        // Destroy the plugin
        plugin.plugin.destroy();
        this.plugins.delete(id);
    }
    
    /**
     * Get a plugin by ID
     * @param id - Plugin ID
     * @returns Plugin instance if found, undefined otherwise
     */
    public getPlugin(id: string): BaseComponent | undefined {
        const plugin = this.plugins.get(id);
        return plugin ? plugin.plugin : undefined;
    }
    
    /**
     * Initialize all registered plugins in the correct order
     * Resolves dependencies and ensures plugins are initialized only once
     */
    public initializeAll(): void {
        const initializedPlugins: Set<string> = new Set();
        
        // Helper function to initialize a plugin and its dependencies
        const initializePlugin = (id: string): void => {
            if (initializedPlugins.has(id)) {
                return; // Already initialized
            }
            
            const plugin = this.plugins.get(id);
            
            if (!plugin) {
                throw new Error(`Plugin with ID ${id} not found`);
            }
            
            // Initialize dependencies first
            for (const depId of plugin.dependencies) {
                if (!this.plugins.has(depId)) {
                    throw new Error(`Plugin ${id} depends on plugin ${depId}, but it is not registered`);
                }
                
                initializePlugin(depId);
            }
            
            // Initialize the plugin
            plugin.plugin.initialize();
            plugin.initialized = true;
            initializedPlugins.add(id);
        };
        
        // Initialize all plugins
        this.plugins.forEach((_, id) => {
            initializePlugin(id);
        });
    }
    
    /**
     * Destroy all plugins in reverse initialization order
     */
    public destroyAll(): void {
        // Create a reversed list of plugin IDs based on dependencies
        const pluginIds = Array.from(this.plugins.keys());
        const dependencyMap = new Map<string, string[]>();
        
        // Build a map of plugins to the plugins that depend on them
        pluginIds.forEach((id) => {
            const plugin = this.plugins.get(id)!;
            
            for (const depId of plugin.dependencies) {
                if (!dependencyMap.has(depId)) {
                    dependencyMap.set(depId, []);
                }
                
                dependencyMap.get(depId)!.push(id);
            }
        });
        
        // Helper function to get all plugins that depend on a given plugin
        const getDependents = (id: string): string[] => {
            return dependencyMap.get(id) || [];
        };
        
        // Sort plugins based on dependencies (plugins with more dependents come first)
        pluginIds.sort((a, b) => {
            const aDependents = getDependents(a).length;
            const bDependents = getDependents(b).length;
            return bDependents - aDependents;
        });
        
        // Destroy plugins in order
        pluginIds.forEach((id) => {
            const plugin = this.plugins.get(id);
            
            if (plugin && plugin.initialized) {
                plugin.plugin.destroy();
                plugin.initialized = false;
            }
        });
        
        // Clear the map
        this.plugins.clear();
    }
    
    /**
     * Get all registered plugins
     * @returns Map of plugin IDs to plugin instances
     */
    public getAllPlugins(): Map<string, IPlugin> {
        return this.plugins;
    }
    
    /**
     * Check if a plugin is registered
     * @param id - Plugin ID
     * @returns True if the plugin is registered, false otherwise
     */
    public hasPlugin(id: string): boolean {
        return this.plugins.has(id);
    }
    
    /**
     * Check if a plugin is initialized
     * @param id - Plugin ID
     * @returns True if the plugin is initialized, false otherwise
     */
    public isInitialized(id: string): boolean {
        const plugin = this.plugins.get(id);
        return plugin ? plugin.initialized : false;
    }
}
