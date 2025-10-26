/**
 * State Management System for JsAnimationTimeline
 * Centralized state management with change notifications
 * Following the Project Development Guidelines
 */

import { EventManager } from './EventManager';

/**
 * Interface for state change events
 */
export interface IStateChangeEvent<T = any> {
  /** The key that changed */
  key: string;
  /** Previous value */
  oldValue: T;
  /** New value */
  newValue: T;
  /** Timestamp of the change */
  timestamp: number;
}

/**
 * Configuration for state properties
 */
export interface IStatePropertyConfig {
  /** Default value for the property */
  defaultValue?: any;
  /** Validation function */
  validator?: (value: any) => boolean;
  /** Whether changes should emit events */
  notify?: boolean;
}

/**
 * State Manager class that provides centralized state management
 */
export class StateManager {
  private _state: Map<string, any> = new Map();
  private _config: Map<string, IStatePropertyConfig> = new Map();
  private _eventManager: EventManager;

  constructor(eventManager: EventManager) {
    this._eventManager = eventManager;
  }

  /**
   * Register a state property with configuration
   * @param key Property key
   * @param config Property configuration
   */
  public registerProperty(key: string, config: IStatePropertyConfig = {}): void {
    this._config.set(key, {
      defaultValue: undefined,
      validator: () => true,
      notify: true,
      ...config
    });

    // Set default value if provided and not already set
    if (config.defaultValue !== undefined && !this._state.has(key)) {
      this._state.set(key, config.defaultValue);
    }
  }

  /**
   * Set a state value
   * @param key Property key
   * @param value New value
   */
  public set<T = any>(key: string, value: T): void {
    const config = this._config.get(key);
    const oldValue = this._state.get(key);

    // Validate if validator is provided
    if (config?.validator && !config.validator(value)) {
      throw new Error(`Invalid value for state property '${key}': ${value}`);
    }

    // Only proceed if value actually changed
    if (oldValue !== value) {
      this._state.set(key, value);

      // Emit change event if notifications are enabled
      if (config?.notify !== false) {
        const changeEvent: IStateChangeEvent<T> = {
          key,
          oldValue,
          newValue: value,
          timestamp: Date.now()
        };

        this._eventManager.emit('state:change', changeEvent);
        this._eventManager.emit(`state:change:${key}`, changeEvent);
      }
    }
  }

  /**
   * Get a state value
   * @param key Property key
   * @param defaultValue Default value if property doesn't exist
   * @returns Property value
   */
  public get<T = any>(key: string, defaultValue?: T): T {
    if (this._state.has(key)) {
      return this._state.get(key) as T;
    }

    const config = this._config.get(key);
    if (config?.defaultValue !== undefined) {
      return config.defaultValue as T;
    }

    return defaultValue as T;
  }

  /**
   * Check if a property exists
   * @param key Property key
   * @returns True if property exists
   */
  public has(key: string): boolean {
    return this._state.has(key);
  }

  /**
   * Delete a property
   * @param key Property key
   */
  public delete(key: string): void {
    if (this._state.has(key)) {
      const oldValue = this._state.get(key);
      this._state.delete(key);

      const config = this._config.get(key);
      if (config?.notify !== false) {
        const changeEvent: IStateChangeEvent = {
          key,
          oldValue,
          newValue: undefined,
          timestamp: Date.now()
        };

        this._eventManager.emit('state:change', changeEvent);
        this._eventManager.emit(`state:change:${key}`, changeEvent);
      }
    }
  }

  /**
   * Update multiple properties at once
   * @param updates Object with key-value pairs to update
   */
  public update(updates: Record<string, any>): void {
    const changes: IStateChangeEvent[] = [];

    // Collect all changes first
    for (const [key, value] of Object.entries(updates)) {
      const config = this._config.get(key);
      const oldValue = this._state.get(key);

      // Validate if validator is provided
      if (config?.validator && !config.validator(value)) {
        throw new Error(`Invalid value for state property '${key}': ${value}`);
      }

      // Only proceed if value actually changed
      if (oldValue !== value) {
        this._state.set(key, value);

        if (config?.notify !== false) {
          changes.push({
            key,
            oldValue,
            newValue: value,
            timestamp: Date.now()
          });
        }
      }
    }

    // Emit all change events
    for (const change of changes) {
      this._eventManager.emit('state:change', change);
      this._eventManager.emit(`state:change:${change.key}`, change);
    }

    // Emit batch change event if there were changes
    if (changes.length > 0) {
      this._eventManager.emit('state:batch-change', changes);
    }
  }

  /**
   * Get all state as a plain object
   * @returns Object with all state properties
   */
  public getAll(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of this._state) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Clear all state
   */
  public clear(): void {
    const keys = Array.from(this._state.keys());
    this._state.clear();

    // Emit change events for all cleared properties
    for (const key of keys) {
      const config = this._config.get(key);
      if (config?.notify !== false) {
        const changeEvent: IStateChangeEvent = {
          key,
          oldValue: this._state.get(key),
          newValue: undefined,
          timestamp: Date.now()
        };

        this._eventManager.emit('state:change', changeEvent);
        this._eventManager.emit(`state:change:${key}`, changeEvent);
      }
    }
  }

  /**
   * Subscribe to state changes for a specific property
   * @param key Property key to watch
   * @param handler Function to call when property changes
   * @returns Subscription object
   */
  public watch<T = any>(key: string, handler: (change: IStateChangeEvent<T>) => void) {
    return this._eventManager.on(`state:change:${key}`, handler);
  }

  /**
   * Subscribe to any state changes
   * @param handler Function to call when any property changes
   * @returns Subscription object
   */
  public watchAll(handler: (change: IStateChangeEvent) => void) {
    return this._eventManager.on('state:change', handler);
  }

  /**
   * Get debug information about current state
   * @returns Debug information object
   */
  public getDebugInfo(): { propertyCount: number; configuredProperties: string[]; state: Record<string, any> } {
    return {
      propertyCount: this._state.size,
      configuredProperties: Array.from(this._config.keys()),
      state: this.getAll()
    };
  }
}