/**
 * Plugin Management System for JsAnimationTimeline
 * Responsible for loading, initializing, and managing the lifecycle of plugins
 * Following the Project Development Guidelines for plugin architecture
 */

import { IPlugin, IPluginConfig, PluginLifecycleEvents } from '../interfaces/IPlugin';
import { IJsTimeLineContext } from '../interfaces/IJsTimeLineContext';
import { EventManager } from './EventManager';

/**
 * Plugin Manager class that handles plugin registration, initialization and lifecycle
 */
export class PluginManager {
  private _plugins: Map<string, IPlugin> = new Map();
  private _pluginConfigs: Map<string, IPluginConfig> = new Map();
  private _context: IJsTimeLineContext | null = null;
  private _eventManager: EventManager;

  constructor(eventManager: EventManager) {
    this._eventManager = eventManager;
  }

  /**
   * Initialize the plugin manager with timeline context
   * @param context Timeline context
   */
  public initialize(context: IJsTimeLineContext): void {
    this._context = context;
  }

  /**
   * Register a plugin for later initialization
   * @param config Plugin configuration
   */
  public registerPlugin(config: IPluginConfig): void {
    const pluginInstance = new config.plugin(this._context!);
    
    if (this._plugins.has(pluginInstance.id)) {
      throw new Error(`Plugin with id '${pluginInstance.id}' is already registered`);
    }

    this._pluginConfigs.set(pluginInstance.id, config);
    
    // Check dependencies
    this._validateDependencies(pluginInstance);
    
    this._plugins.set(pluginInstance.id, pluginInstance);
    
    this._eventManager.emit('plugin:registered', { 
      plugin: pluginInstance, 
      config 
    });
  }

  /**
   * Initialize all registered plugins
   */
  public initializePlugins(): void {
    if (!this._context) {
      throw new Error('PluginManager must be initialized with context before initializing plugins');
    }

    // Sort plugins by dependencies
    const sortedPlugins = this._sortPluginsByDependencies();
    
    for (const plugin of sortedPlugins) {
      try {
        plugin.initialize(this._context);
        
        const config = this._pluginConfigs.get(plugin.id);
        if (config?.autoActivate !== false) {
          plugin.activate();
        }
      } catch (error) {
        console.error(`Failed to initialize plugin '${plugin.id}':`, error);
      }
    }
  }

  /**
   * Get a plugin by ID
   * @param id Plugin ID
   * @returns Plugin instance or undefined
   */
  public getPlugin<T extends IPlugin = IPlugin>(id: string): T | undefined {
    return this._plugins.get(id) as T;
  }

  /**
   * Get all registered plugins
   * @returns Array of plugin instances
   */
  public getAllPlugins(): IPlugin[] {
    return Array.from(this._plugins.values());
  }

  /**
   * Get all active plugins
   * @returns Array of active plugin instances
   */
  public getActivePlugins(): IPlugin[] {
    return Array.from(this._plugins.values()).filter(plugin => 
      'isActive' in plugin && (plugin as any).isActive
    );
  }

  /**
   * Activate a plugin
   * @param id Plugin ID
   */
  public activatePlugin(id: string): void {
    const plugin = this._plugins.get(id);
    if (!plugin) {
      throw new Error(`Plugin '${id}' not found`);
    }

    plugin.activate();
  }

  /**
   * Deactivate a plugin
   * @param id Plugin ID
   */
  public deactivatePlugin(id: string): void {
    const plugin = this._plugins.get(id);
    if (!plugin) {
      throw new Error(`Plugin '${id}' not found`);
    }

    plugin.deactivate();
  }

  /**
   * Unregister and dispose a plugin
   * @param id Plugin ID
   */
  public unregisterPlugin(id: string): void {
    const plugin = this._plugins.get(id);
    if (!plugin) {
      return;
    }

    plugin.dispose();
    this._plugins.delete(id);
    this._pluginConfigs.delete(id);

    this._eventManager.emit('plugin:unregistered', { plugin });
  }

  /**
   * Dispose all plugins and clear registry
   */
  public dispose(): void {
    for (const plugin of this._plugins.values()) {
      try {
        plugin.dispose();
      } catch (error) {
        console.error(`Error disposing plugin '${plugin.id}':`, error);
      }
    }

    this._plugins.clear();
    this._pluginConfigs.clear();
    this._context = null;
  }

  /**
   * Check if a plugin is registered
   * @param id Plugin ID
   * @returns True if plugin is registered
   */
  public hasPlugin(id: string): boolean {
    return this._plugins.has(id);
  }

  /**
   * Load plugins from global window.JsTimelinePlugins array
   */
  public loadGlobalPlugins(): void {
    const globalPlugins = (window as any).JsTimelinePlugins;
    if (!Array.isArray(globalPlugins)) {
      return;
    }

    for (const PluginClass of globalPlugins) {
      try {
        this.registerPlugin({
          plugin: PluginClass,
          autoActivate: true
        });
      } catch (error) {
        console.error('Failed to load global plugin:', error);
      }
    }
  }

  /**
   * Validate plugin dependencies
   * @param plugin Plugin to validate
   */
  private _validateDependencies(plugin: IPlugin): void {
    for (const dependencyId of plugin.dependencies) {
      if (!this._plugins.has(dependencyId)) {
        throw new Error(`Plugin '${plugin.id}' depends on '${dependencyId}' which is not registered`);
      }
    }
  }

  /**
   * Sort plugins by their dependencies (topological sort)
   * @returns Array of plugins sorted by dependencies
   */
  private _sortPluginsByDependencies(): IPlugin[] {
    const plugins = Array.from(this._plugins.values());
    const sorted: IPlugin[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (plugin: IPlugin): void => {
      if (visiting.has(plugin.id)) {
        throw new Error(`Circular dependency detected involving plugin '${plugin.id}'`);
      }
      
      if (visited.has(plugin.id)) {
        return;
      }

      visiting.add(plugin.id);

      // Visit dependencies first
      for (const depId of plugin.dependencies) {
        const dependency = this._plugins.get(depId);
        if (dependency) {
          visit(dependency);
        }
      }

      visiting.delete(plugin.id);
      visited.add(plugin.id);
      sorted.push(plugin);
    };

    for (const plugin of plugins) {
      if (!visited.has(plugin.id)) {
        visit(plugin);
      }
    }

    return sorted;
  }

  /**
   * Get debug information about registered plugins
   * @returns Debug information object
   */
  public getDebugInfo(): { 
    totalPlugins: number; 
    activePlugins: number; 
    plugins: Array<{ id: string; name: string; isActive: boolean; dependencies: string[] }> 
  } {
    const plugins = Array.from(this._plugins.values()).map(plugin => ({
      id: plugin.id,
      name: plugin.name,
      isActive: 'isActive' in plugin ? (plugin as any).isActive : false,
      dependencies: plugin.dependencies
    }));

    return {
      totalPlugins: this._plugins.size,
      activePlugins: plugins.filter(p => p.isActive).length,
      plugins
    };
  }
}