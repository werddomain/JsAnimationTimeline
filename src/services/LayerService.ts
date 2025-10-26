/**
 * Layer Service for JsAnimationTimeline
 * Handles layer creation, deletion, and manipulation operations
 * Following the Project Development Guidelines
 */

import { EventManager } from '../core/EventManager';
import { StateManager } from '../core/StateManager';
import { ILayer, LayerType, KeyframeType } from '../data/TimelineData';

/**
 * Layer service interface
 */
export interface ILayerService {
  addLayer(name?: string, type?: LayerType): string;
  removeLayer(layerId: string): void;
  renameLayer(layerId: string, newName: string): void;
  toggleLayerVisibility(layerId: string): void;
  toggleLayerLock(layerId: string): void;
  selectLayer(layerId: string, multiSelect?: boolean): void;
  moveLayer(layerId: string, newIndex: number): void;
  duplicateLayer(layerId: string): string;
}

/**
 * Layer Service class that manages layer operations
 */
export class LayerService implements ILayerService {
  private _eventManager: EventManager;
  private _stateManager: StateManager;

  constructor(eventManager: EventManager, stateManager: StateManager) {
    this._eventManager = eventManager;
    this._stateManager = stateManager;
    
    this._setupEventListeners();
    this._initializeState();
  }

  /**
   * Initialize the service state
   */
  private _initializeState(): void {
    // Register layer-related state properties
    this._stateManager.registerProperty('layers', { 
      defaultValue: new Map<string, ILayer>(),
      notify: true 
    });
    this._stateManager.registerProperty('layerOrder', { 
      defaultValue: [],
      notify: true 
    });
    this._stateManager.registerProperty('selectedLayerIds', { 
      defaultValue: new Set<string>(),
      notify: true 
    });
    this._stateManager.registerProperty('nextLayerId', { 
      defaultValue: 1,
      notify: false 
    });
  }

  /**
   * Setup event listeners for layer operations
   */
  private _setupEventListeners(): void {
    this._eventManager.on('layer:add-requested', (data: { type: LayerType, name?: string }) => {
      this.addLayer(data.name, data.type);
    });

    this._eventManager.on('layer:remove-requested', (data: { layerId: string }) => {
      this.removeLayer(data.layerId);
    });

    this._eventManager.on('layer:rename-requested', (data: { layerId: string, name: string }) => {
      this.renameLayer(data.layerId, data.name);
    });

    this._eventManager.on('layer:toggle-visibility', (data: { layerId: string }) => {
      this.toggleLayerVisibility(data.layerId);
    });

    this._eventManager.on('layer:toggle-lock', (data: { layerId: string }) => {
      this.toggleLayerLock(data.layerId);
    });

    this._eventManager.on('layer:select', (data: { layerId: string, multiSelect?: boolean }) => {
      this.selectLayer(data.layerId, data.multiSelect);
    });

    this._eventManager.on('layer:toggle-all-visibility', () => {
      this._toggleAllVisibility();
    });

    this._eventManager.on('layer:toggle-all-lock', () => {
      this._toggleAllLock();
    });
  }

  /**
   * Add a new layer
   */
  public addLayer(name?: string, type: LayerType = LayerType.LAYER): string {
    const layers = this._stateManager.get<Map<string, ILayer>>('layers');
    const layerOrder = this._stateManager.get<string[]>('layerOrder');
    const nextId = this._stateManager.get<number>('nextLayerId');

    const layerId = `layer_${nextId}`;
    const defaultName = type === LayerType.FOLDER ? `Folder ${nextId}` : `Layer ${nextId}`;

    const newLayer: ILayer = {
      id: layerId,
      name: name || defaultName,
      type,
      isVisible: true,
      isLocked: false,
      isSelected: false,
      keyframes: type === LayerType.LAYER ? {} : undefined,
      tweens: type === LayerType.LAYER ? {} : undefined,
      children: type === LayerType.FOLDER ? [] : undefined,
      isExpanded: type === LayerType.FOLDER ? true : undefined
    };

    // Add to layers map
    const newLayers = new Map(layers);
    newLayers.set(layerId, newLayer);

    // Add to layer order (at the top)
    const newLayerOrder = [layerId, ...layerOrder];

    // Update state
    this._stateManager.update({
      layers: newLayers,
      layerOrder: newLayerOrder,
      nextLayerId: nextId + 1
    });

    // Emit events
    this._eventManager.emit('layer:added', { layer: newLayer });
    this._eventManager.emit('data:layers-changed');

    return layerId;
  }

  /**
   * Remove a layer
   */
  public removeLayer(layerId: string): void {
    const layers = this._stateManager.get<Map<string, ILayer>>('layers');
    const layerOrder = this._stateManager.get<string[]>('layerOrder');
    const selectedLayerIds = this._stateManager.get<Set<string>>('selectedLayerIds');

    const layer = layers.get(layerId);
    if (!layer) return;

    // Remove from layers map
    const newLayers = new Map(layers);
    newLayers.delete(layerId);

    // Remove from layer order
    const newLayerOrder = layerOrder.filter(id => id !== layerId);

    // Remove from selection
    const newSelectedLayerIds = new Set(selectedLayerIds);
    newSelectedLayerIds.delete(layerId);

    // Update state
    this._stateManager.update({
      layers: newLayers,
      layerOrder: newLayerOrder,
      selectedLayerIds: newSelectedLayerIds
    });

    // Emit events
    this._eventManager.emit('layer:removed', { layerId, layer });
    this._eventManager.emit('data:layers-changed');
  }

  /**
   * Rename a layer
   */
  public renameLayer(layerId: string, newName: string): void {
    const layers = this._stateManager.get<Map<string, ILayer>>('layers');
    const layer = layers.get(layerId);
    
    if (!layer || !newName.trim()) return;

    const newLayers = new Map(layers);
    const updatedLayer = { ...layer, name: newName.trim() };
    newLayers.set(layerId, updatedLayer);

    this._stateManager.set('layers', newLayers);
    
    this._eventManager.emit('layer:renamed', { layerId, oldName: layer.name, newName: newName.trim() });
    this._eventManager.emit('data:layers-changed');
  }

  /**
   * Toggle layer visibility
   */
  public toggleLayerVisibility(layerId: string): void {
    const layers = this._stateManager.get<Map<string, ILayer>>('layers');
    const layer = layers.get(layerId);
    
    if (!layer) return;

    const newLayers = new Map(layers);
    const updatedLayer = { ...layer, isVisible: !layer.isVisible };
    newLayers.set(layerId, updatedLayer);

    this._stateManager.set('layers', newLayers);
    
    this._eventManager.emit('layer:visibility-changed', { layerId, isVisible: updatedLayer.isVisible });
    this._eventManager.emit('data:layers-changed');
  }

  /**
   * Toggle layer lock
   */
  public toggleLayerLock(layerId: string): void {
    const layers = this._stateManager.get<Map<string, ILayer>>('layers');
    const layer = layers.get(layerId);
    
    if (!layer) return;

    const newLayers = new Map(layers);
    const updatedLayer = { ...layer, isLocked: !layer.isLocked };
    newLayers.set(layerId, updatedLayer);

    this._stateManager.set('layers', newLayers);
    
    this._eventManager.emit('layer:lock-changed', { layerId, isLocked: updatedLayer.isLocked });
    this._eventManager.emit('data:layers-changed');
  }

  /**
   * Select a layer
   */
  public selectLayer(layerId: string, multiSelect: boolean = false): void {
    const layers = this._stateManager.get<Map<string, ILayer>>('layers');
    const selectedLayerIds = this._stateManager.get<Set<string>>('selectedLayerIds');

    if (!layers.has(layerId)) return;

    let newSelectedLayerIds: Set<string>;
    let newLayers = new Map(layers);

    if (multiSelect) {
      // Toggle selection for multi-select
      newSelectedLayerIds = new Set(selectedLayerIds);
      if (newSelectedLayerIds.has(layerId)) {
        newSelectedLayerIds.delete(layerId);
      } else {
        newSelectedLayerIds.add(layerId);
      }
    } else {
      // Single selection - clear others and select this one
      newSelectedLayerIds = new Set([layerId]);
    }

    // Update layer selection state
    for (const [id, layer] of newLayers) {
      const updatedLayer = { ...layer, isSelected: newSelectedLayerIds.has(id) };
      newLayers.set(id, updatedLayer);
    }

    this._stateManager.update({
      layers: newLayers,
      selectedLayerIds: newSelectedLayerIds
    });

    this._eventManager.emit('layer:selection-changed', { 
      selectedLayerIds: Array.from(newSelectedLayerIds),
      multiSelect 
    });
    this._eventManager.emit('data:layers-changed');
  }

  /**
   * Move layer to new position
   */
  public moveLayer(layerId: string, newIndex: number): void {
    const layerOrder = this._stateManager.get<string[]>('layerOrder');
    const currentIndex = layerOrder.indexOf(layerId);
    
    if (currentIndex === -1 || newIndex < 0 || newIndex >= layerOrder.length) return;

    const newLayerOrder = [...layerOrder];
    newLayerOrder.splice(currentIndex, 1);
    newLayerOrder.splice(newIndex, 0, layerId);

    this._stateManager.set('layerOrder', newLayerOrder);
    
    this._eventManager.emit('layer:moved', { layerId, oldIndex: currentIndex, newIndex });
    this._eventManager.emit('data:layers-changed');
  }

  /**
   * Duplicate a layer
   */
  public duplicateLayer(layerId: string): string {
    const layers = this._stateManager.get<Map<string, ILayer>>('layers');
    const layer = layers.get(layerId);
    
    if (!layer) throw new Error(`Layer ${layerId} not found`);

    const newLayerId = this.addLayer(`${layer.name} copy`, layer.type);
    
    // Copy layer properties if it's a regular layer
    if (layer.type === LayerType.LAYER && layer.keyframes) {
      // TODO: Implement keyframe copying when keyframe service is available
    }

    return newLayerId;
  }

  /**
   * Toggle visibility for all layers
   */
  private _toggleAllVisibility(): void {
    const layers = this._stateManager.get<Map<string, ILayer>>('layers');
    const newLayers = new Map(layers);
    
    // Check if all layers are currently visible
    const allVisible = Array.from(layers.values()).every(layer => layer.isVisible);
    const newVisibility = !allVisible;

    // Update all layers
    for (const [id, layer] of newLayers) {
      const updatedLayer = { ...layer, isVisible: newVisibility };
      newLayers.set(id, updatedLayer);
    }

    this._stateManager.set('layers', newLayers);
    
    this._eventManager.emit('layer:all-visibility-changed', { isVisible: newVisibility });
    this._eventManager.emit('data:layers-changed');
  }

  /**
   * Toggle lock for all layers
   */
  private _toggleAllLock(): void {
    const layers = this._stateManager.get<Map<string, ILayer>>('layers');
    const newLayers = new Map(layers);
    
    // Check if all layers are currently locked
    const allLocked = Array.from(layers.values()).every(layer => layer.isLocked);
    const newLockState = !allLocked;

    // Update all layers
    for (const [id, layer] of newLayers) {
      const updatedLayer = { ...layer, isLocked: newLockState };
      newLayers.set(id, updatedLayer);
    }

    this._stateManager.set('layers', newLayers);
    
    this._eventManager.emit('layer:all-lock-changed', { isLocked: newLockState });
    this._eventManager.emit('data:layers-changed');
  }

  /**
   * Get current layers data for read-only access
   */
  public getLayers(): ILayer[] {
    const layers = this._stateManager.get<Map<string, ILayer>>('layers');
    const layerOrder = this._stateManager.get<string[]>('layerOrder');
    
    return layerOrder.map(id => layers.get(id)!).filter(Boolean);
  }

  /**
   * Get selected layer IDs
   */
  public getSelectedLayerIds(): string[] {
    const selectedLayerIds = this._stateManager.get<Set<string>>('selectedLayerIds');
    return Array.from(selectedLayerIds);
  }
}