import { BaseComponent } from './BaseComponent';

/**
 * Plugin dependency information
 */
export interface PluginDependency {
    name: string;
    optional?: boolean;
}

/**
 * Plugin metadata interface
 */
export interface PluginMetadata {
    name: string;
    version: string;
    dependencies?: PluginDependency[];
}

/**
 * Plugin instance type
 */
export type Plugin = BaseComponent & {
    metadata: PluginMetadata;
};

/**
 * Plugin registration options
 */
export interface PluginRegistrationOptions {
    plugin: Plugin;
    metadata: PluginMetadata;
}

/**
 * Manages plugin lifecycle and dependencies
 */
export class PluginManager {
    private static instance: PluginManager;
    private plugins: Map<string, Plugin> = new Map();
    private loadOrder: string[] = [];
    private initialized: boolean = false;

    /**
     * Get the singleton instance of PluginManager
     * @returns The PluginManager instance
     */
    public static getInstance(): PluginManager {
        if (!PluginManager.instance) {
            PluginManager.instance = new PluginManager();
        }
        return PluginManager.instance;
    }

    /**
     * Private constructor to enforce singleton pattern
     */
    private constructor() {}

    /**
     * Register a plugin with the manager
     * @param options Plugin registration options
     * @returns True if registration was successful, false otherwise
     */
    public register(options: PluginRegistrationOptions): boolean {
        const { plugin, metadata } = options;
        
        // If already initialized, don't allow registration
        if (this.initialized) {
            console.error(`Cannot register plugin ${metadata.name}: PluginManager is already initialized`);
            return false;
        }
        
        // If already registered, don't register again
        if (this.plugins.has(metadata.name)) {
            console.error(`Plugin ${metadata.name} is already registered`);
            return false;
        }
        
        // Store metadata in plugin
        plugin.metadata = metadata;
        
        // Store plugin
        this.plugins.set(metadata.name, plugin);
        
        return true;
    }

    /**
     * Initialize all registered plugins
     * @returns True if initialization was successful, false otherwise
     */
    public initialize(): boolean {
        // If already initialized, don't initialize again
        if (this.initialized) {
            console.error('PluginManager is already initialized');
            return false;
        }
        
        // Calculate the load order based on dependencies
        this.calculateLoadOrder();
        
        // Check if all dependencies are satisfied
        const missingDependencies = this.checkDependencies();
        if (missingDependencies.length > 0) {
            console.error('Cannot initialize plugins: missing dependencies', missingDependencies);
            return false;
        }
        
        // Initialize plugins in load order
        this.loadOrder.forEach(pluginName => {
            const plugin = this.plugins.get(pluginName);
            if (plugin) {
                try {
                    plugin.initialize();
                } catch (error) {
                    console.error(`Error initializing plugin ${pluginName}:`, error);
                }
            }
        });
        
        this.initialized = true;
        return true;
    }

    /**
     * Get a plugin by name
     * @param name The name of the plugin to retrieve
     * @returns The plugin or undefined if not found
     */
    public getPlugin<T extends Plugin>(name: string): T | undefined {
        return this.plugins.get(name) as T | undefined;
    }

    /**
     * Get all registered plugins
     * @returns Array of all plugins
     */
    public getPlugins(): Plugin[] {
        return Array.from(this.plugins.values());
    }

    /**
     * Calculate the load order based on dependencies
     */
    private calculateLoadOrder(): void {
        // Clear the load order
        this.loadOrder = [];
        
        // Create a set of all plugin names
        const pluginNames = new Set(this.plugins.keys());
        
        // Create a map of plugin names to their dependencies
        const dependencyMap = new Map<string, string[]>();
        for (const [name, plugin] of this.plugins.entries()) {
            const dependencies = plugin.metadata.dependencies || [];
            dependencyMap.set(name, dependencies
                .filter(dep => !dep.optional)
                .map(dep => dep.name));
        }
        
        // Helper function to check for circular dependencies
        const checkCircular = (name: string, path: string[] = []): boolean => {
            if (path.includes(name)) {
                console.error(`Circular dependency detected: ${path.join(' -> ')} -> ${name}`);
                return true;
            }
            
            const dependencies = dependencyMap.get(name) || [];
            return dependencies.some(dep => checkCircular(dep, [...path, name]));
        };
        
        // Check for circular dependencies
        for (const name of pluginNames) {
            if (checkCircular(name)) {
                // If circular dependencies are found, clear the load order and return
                this.loadOrder = [];
                return;
            }
        }
        
        // Helper function to add a plugin to the load order
        const addToLoadOrder = (name: string, visited: Set<string>): void => {
            // Skip if already visited
            if (visited.has(name)) {
                return;
            }
            
            // Mark as visited
            visited.add(name);
            
            // Process dependencies first
            const dependencies = dependencyMap.get(name) || [];
            for (const dep of dependencies) {
                addToLoadOrder(dep, visited);
            }
            
            // Add to load order if not already added
            if (!this.loadOrder.includes(name)) {
                this.loadOrder.push(name);
            }
        };
        
        // Process each plugin
        const visited = new Set<string>();
        for (const name of pluginNames) {
            addToLoadOrder(name, visited);
        }
    }

    /**
     * Check if all dependencies are satisfied
     * @returns Array of missing dependencies
     */
    private checkDependencies(): { plugin: string, missing: string }[] {
        const missingDependencies: { plugin: string, missing: string }[] = [];
        
        for (const [name, plugin] of this.plugins.entries()) {
            const dependencies = plugin.metadata.dependencies || [];
            
            for (const dependency of dependencies) {
                // Skip optional dependencies
                if (dependency.optional) {
                    continue;
                }
                
                // Check if the dependency exists
                if (!this.plugins.has(dependency.name)) {
                    missingDependencies.push({ plugin: name, missing: dependency.name });
                }
            }
        }
        
        return missingDependencies;
    }

    /**
     * Destroy all plugins and clean up
     */
    public destroy(): void {
        // Destroy plugins in reverse load order
        [...this.loadOrder].reverse().forEach(pluginName => {
            const plugin = this.plugins.get(pluginName);
            if (plugin) {
                try {
                    plugin.destroy();
                } catch (error) {
                    console.error(`Error destroying plugin ${pluginName}:`, error);
                }
            }
        });
        
        // Clear plugin maps
        this.plugins.clear();
        this.loadOrder = [];
        this.initialized = false;
    }
}
