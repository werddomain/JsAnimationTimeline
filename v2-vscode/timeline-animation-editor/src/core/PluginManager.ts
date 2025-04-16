// filepath: c:\Users\BenoitRobin\JsTimeline\v2-vscode\timeline-animation-editor\src\core\PluginManager.ts
import { EventEmitter } from './EventEmitter';
import { DataModel } from './DataModel';
import { BaseComponent } from '../components/base/BaseComponent';
import { EVENT_TYPES } from '../utils/EventTypes';

interface PluginDependency {
    name: string;
    optional: boolean;
}

interface Plugin extends BaseComponent {
    name: string;
    dependencies: PluginDependency[];
}

export class PluginManager {
    private plugins: Map<string, Plugin> = new Map();
    private eventEmitter: EventEmitter<string>;
    private dataModel: DataModel;

    constructor(eventEmitter: EventEmitter<string>, dataModel: DataModel) {
        this.eventEmitter = eventEmitter;
        this.dataModel = dataModel;
    }

    public loadPlugin(plugin: Plugin): void {
        if (this.plugins.has(plugin.name)) {
            throw new Error(`Plugin ${plugin.name} is already loaded.`);
        }
        
        // Check if all required dependencies are met
        for (const dep of plugin.dependencies || []) {
            if (!dep.optional && !this.plugins.has(dep.name)) {
                throw new Error(`Cannot load plugin ${plugin.name}. Required dependency ${dep.name} is not loaded.`);
            }
        }
        
        this.plugins.set(plugin.name, plugin);
    }

    public unloadPlugin(pluginName: string): void {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            throw new Error(`Plugin ${pluginName} is not loaded.`);
        }
        
        // Check if other plugins depend on this one
        for (const [name, p] of this.plugins.entries()) {
            if (name === pluginName) continue;
            
            const dependsOnThis = (p.dependencies || []).some(
                dep => dep.name === pluginName && !dep.optional
            );
            
            if (dependsOnThis) {
                throw new Error(`Cannot unload plugin ${pluginName}. Plugin ${name} depends on it.`);
            }
        }
        
        plugin.destroy();
        this.plugins.delete(pluginName);
    }

    public getPlugin<T extends Plugin>(pluginName: string): T | undefined {
        return this.plugins.get(pluginName) as T | undefined;
    }

    public initializePlugins(): void {
        // Initialize plugins in dependency order
        const initialized = new Set<string>();
        const toInitialize = Array.from(this.plugins.keys());
        
        while (toInitialize.length > 0) {
            const pluginName = toInitialize.shift()!;
            const plugin = this.plugins.get(pluginName)!;
            
            // Check if all dependencies are initialized
            const allDepsInitialized = (plugin.dependencies || [])
                .filter(dep => !dep.optional)
                .every(dep => initialized.has(dep.name));
                
            if (allDepsInitialized) {
                plugin.initialize();
                initialized.add(pluginName);
            } else {
                // Put back at the end of the queue
                toInitialize.push(pluginName);
            }
            
            // Prevent infinite loop if there's a circular dependency
            if (toInitialize.length === 1 && !allDepsInitialized) {
                throw new Error(`Circular dependency detected for plugin ${pluginName}`);
            }
        }
    }

    public destroyPlugins(): void {
        this.plugins.forEach(plugin => {
            plugin.destroy();
        });
        this.plugins.clear();
    }
    
    public loadPlugins(): void {
        // This method would load all available plugins in the correct order
        // based on their dependencies
    }
}