/**
 * Plugin Interface for JsAnimationTimeline
 * Defines the contract that all plugins must implement
 * Following the Project Development Guidelines for plugin architecture
 */

import { IJsTimeLineContext } from './IJsTimeLineContext';

/**
 * Base interface that all timeline plugins must implement
 */
export interface IPlugin {
  /**
   * Unique identifier for the plugin
   */
  readonly id: string;

  /**
   * Human-readable name for the plugin
   */
  readonly name: string;

  /**
   * Plugin version
   */
  readonly version: string;

  /**
   * Array of plugin IDs that this plugin depends on
   */
  readonly dependencies: string[];

  /**
   * Initialize the plugin with the timeline context
   * Called once when the plugin is first loaded
   * @param context The timeline context instance
   */
  initialize(context: IJsTimeLineContext): void;

  /**
   * Activate the plugin
   * Called when the plugin should start its functionality
   */
  activate(): void;

  /**
   * Deactivate the plugin
   * Called when the plugin should stop its functionality
   */
  deactivate(): void;

  /**
   * Dispose of the plugin and clean up resources
   * Called when the plugin is being removed
   */
  dispose(): void;

  /**
   * Get the DOM element(s) managed by this plugin, if any
   * @returns The DOM element or null if the plugin doesn't manage DOM
   */
  getElement(): HTMLElement | null;
}

/**
 * Configuration interface for plugin registration
 */
export interface IPluginConfig {
  /** Plugin constructor */
  plugin: new (context: IJsTimeLineContext) => IPlugin;
  /** Optional configuration options */
  config?: Record<string, any>;
  /** Whether to auto-activate the plugin (default: true) */
  autoActivate?: boolean;
}

/**
 * Plugin lifecycle events
 */
export enum PluginLifecycleEvents {
  BEFORE_INITIALIZE = 'plugin:before-initialize',
  AFTER_INITIALIZE = 'plugin:after-initialize',
  BEFORE_ACTIVATE = 'plugin:before-activate',
  AFTER_ACTIVATE = 'plugin:after-activate',
  BEFORE_DEACTIVATE = 'plugin:before-deactivate',
  AFTER_DEACTIVATE = 'plugin:after-deactivate',
  BEFORE_DISPOSE = 'plugin:before-dispose',
  AFTER_DISPOSE = 'plugin:after-dispose',
}

/**
 * Abstract base class for plugins that provides common functionality
 */
export abstract class BasePlugin implements IPlugin {
  public abstract readonly id: string;
  public abstract readonly name: string;
  public abstract readonly version: string;
  public readonly dependencies: string[] = [];

  protected _context: IJsTimeLineContext | null = null;
  protected _isInitialized: boolean = false;
  protected _isActive: boolean = false;

  /**
   * Initialize the plugin with context
   */
  public initialize(context: IJsTimeLineContext): void {
    if (this._isInitialized) {
      throw new Error(`Plugin ${this.id} is already initialized`);
    }
    
    this._context = context;
    this._context.Core.eventManager.emit(PluginLifecycleEvents.BEFORE_INITIALIZE, { plugin: this });
    
    this.onInitialize(context);
    
    this._isInitialized = true;
    this._context.Core.eventManager.emit(PluginLifecycleEvents.AFTER_INITIALIZE, { plugin: this });
  }

  /**
   * Activate the plugin
   */
  public activate(): void {
    if (!this._isInitialized) {
      throw new Error(`Plugin ${this.id} must be initialized before activation`);
    }
    
    if (this._isActive) {
      return;
    }

    this._context!.Core.eventManager.emit(PluginLifecycleEvents.BEFORE_ACTIVATE, { plugin: this });
    
    this.onActivate();
    
    this._isActive = true;
    this._context!.Core.eventManager.emit(PluginLifecycleEvents.AFTER_ACTIVATE, { plugin: this });
  }

  /**
   * Deactivate the plugin
   */
  public deactivate(): void {
    if (!this._isActive) {
      return;
    }

    this._context!.Core.eventManager.emit(PluginLifecycleEvents.BEFORE_DEACTIVATE, { plugin: this });
    
    this.onDeactivate();
    
    this._isActive = false;
    this._context!.Core.eventManager.emit(PluginLifecycleEvents.AFTER_DEACTIVATE, { plugin: this });
  }

  /**
   * Dispose of the plugin
   */
  public dispose(): void {
    if (this._isActive) {
      this.deactivate();
    }

    if (!this._isInitialized) {
      return;
    }

    this._context!.Core.eventManager.emit(PluginLifecycleEvents.BEFORE_DISPOSE, { plugin: this });
    
    this.onDispose();
    
    this._isInitialized = false;
    this._context = null;
    
    // Note: Can't emit AFTER_DISPOSE because context is null
  }

  /**
   * Get plugin element (default implementation returns null)
   */
  public getElement(): HTMLElement | null {
    return null;
  }

  /**
   * Check if plugin is initialized
   */
  public get isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * Check if plugin is active
   */
  public get isActive(): boolean {
    return this._isActive;
  }

  /**
   * Get the timeline context
   */
  protected get context(): IJsTimeLineContext {
    if (!this._context) {
      throw new Error(`Plugin ${this.id} is not initialized`);
    }
    return this._context;
  }

  /**
   * Override this method to implement plugin-specific initialization
   */
  protected abstract onInitialize(context: IJsTimeLineContext): void;

  /**
   * Override this method to implement plugin-specific activation
   */
  protected abstract onActivate(): void;

  /**
   * Override this method to implement plugin-specific deactivation
   */
  protected abstract onDeactivate(): void;

  /**
   * Override this method to implement plugin-specific disposal
   */
  protected abstract onDispose(): void;
}