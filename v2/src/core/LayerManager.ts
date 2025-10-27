import { IJsTimeLineContext } from '../IJsTimeLineContext';
import { ILayer, ITimeLineData } from '../data/ITimeLineData';

/**
 * LayerManager - Manages layer and folder operations
 */
export class LayerManager {
  private context: IJsTimeLineContext;

  constructor(context: IJsTimeLineContext) {
    this.context = context;
  }

  /**
   * Generate a unique ID for a new layer/folder
   */
  private generateId(): string {
    return `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Find a layer by ID in the layer hierarchy
   */
  private findLayerById(layers: readonly ILayer[], id: string): ILayer | null {
    for (const layer of layers) {
      if (layer.id === id) {
        return layer as ILayer;
      }
      if (layer.type === 'folder' && layer.children) {
        const found = this.findLayerById(layer.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Find parent array containing a layer
   */
  private findParentArray(layers: ILayer[], targetId: string): ILayer[] | null {
    for (const layer of layers) {
      if (layer.id === targetId) {
        return layers;
      }
      if (layer.type === 'folder' && layer.children) {
        const found = this.findParentArray(layer.children as ILayer[], targetId);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Add a new layer to the timeline
   */
  public addLayer(name?: string, parentId?: string): ILayer {
    const data = this.context.Data.getData();
    const layers = [...data.layers] as ILayer[];

    const newLayer: ILayer = {
      id: this.generateId(),
      name: name || `Layer ${layers.length + 1}`,
      type: 'layer',
      visible: true,
      locked: false,
      keyframes: [],
      tweens: []
    };

    if (parentId) {
      // Add to specific folder
      const parent = this.findLayerById(layers, parentId);
      if (parent && parent.type === 'folder') {
        if (!parent.children) {
          parent.children = [];
        }
        (parent.children as ILayer[]).push(newLayer);
      } else {
        // Parent not found or not a folder, add to root
        layers.push(newLayer);
      }
    } else {
      // Add to root level
      layers.push(newLayer);
    }

    // Update data
    const updatedData: ITimeLineData = {
      ...data,
      layers
    };
    this.context.Data.load(updatedData);

    // Emit event
    this.context.Core.eventManager.emit('layer:added', { layer: newLayer });

    return newLayer;
  }

  /**
   * Add a new folder to the timeline
   */
  public addFolder(name?: string, parentId?: string): ILayer {
    const data = this.context.Data.getData();
    const layers = [...data.layers] as ILayer[];

    const newFolder: ILayer = {
      id: this.generateId(),
      name: name || `Folder ${layers.length + 1}`,
      type: 'folder',
      visible: true,
      locked: false,
      children: []
    };

    if (parentId) {
      // Add to specific folder
      const parent = this.findLayerById(layers, parentId);
      if (parent && parent.type === 'folder') {
        if (!parent.children) {
          parent.children = [];
        }
        (parent.children as ILayer[]).push(newFolder);
      } else {
        // Parent not found or not a folder, add to root
        layers.push(newFolder);
      }
    } else {
      // Add to root level
      layers.push(newFolder);
    }

    // Update data
    const updatedData: ITimeLineData = {
      ...data,
      layers
    };
    this.context.Data.load(updatedData);

    // Emit event
    this.context.Core.eventManager.emit('folder:added', { folder: newFolder });

    return newFolder;
  }

  /**
   * Delete a layer or folder from the timeline
   */
  public deleteObject(id: string): boolean {
    const data = this.context.Data.getData();
    const layers = [...data.layers] as ILayer[];

    const parentArray = this.findParentArray(layers, id);
    if (!parentArray) return false;

    const index = parentArray.findIndex(layer => layer.id === id);
    if (index === -1) return false;

    const deletedObject = parentArray[index];
    parentArray.splice(index, 1);

    // Update data
    const updatedData: ITimeLineData = {
      ...data,
      layers
    };
    this.context.Data.load(updatedData);

    // Emit event
    this.context.Core.eventManager.emit('layer:deleted', { 
      id, 
      object: deletedObject 
    });

    return true;
  }

  /**
   * Rename a layer or folder
   */
  public renameObject(id: string, newName: string): boolean {
    const data = this.context.Data.getData();
    const layers = [...data.layers] as ILayer[];

    const layer = this.findLayerById(layers, id);
    if (!layer) return false;

    const oldName = layer.name;
    layer.name = newName;

    // Update data
    const updatedData: ITimeLineData = {
      ...data,
      layers
    };
    this.context.Data.load(updatedData);

    // Emit event
    this.context.Core.eventManager.emit('layer:renamed', { 
      id, 
      oldName, 
      newName 
    });

    return true;
  }

  /**
   * Reorder a layer within its parent
   */
  public reorderObject(id: string, newIndex: number): boolean {
    const data = this.context.Data.getData();
    const layers = [...data.layers] as ILayer[];

    const parentArray = this.findParentArray(layers, id);
    if (!parentArray) return false;

    const oldIndex = parentArray.findIndex(layer => layer.id === id);
    if (oldIndex === -1) return false;

    // Remove from old position
    const [movedLayer] = parentArray.splice(oldIndex, 1);

    // Insert at new position
    const insertIndex = Math.min(newIndex, parentArray.length);
    parentArray.splice(insertIndex, 0, movedLayer);

    // Update data
    const updatedData: ITimeLineData = {
      ...data,
      layers
    };
    this.context.Data.load(updatedData);

    // Emit event
    this.context.Core.eventManager.emit('layer:reordered', { 
      id, 
      oldIndex, 
      newIndex: insertIndex 
    });

    return true;
  }

  /**
   * Move a layer to a different parent (reparenting)
   */
  public reparentObject(id: string, newParentId: string | null): boolean {
    const data = this.context.Data.getData();
    const layers = [...data.layers] as ILayer[];

    // Find and remove from current parent
    const oldParentArray = this.findParentArray(layers, id);
    if (!oldParentArray) return false;

    const oldIndex = oldParentArray.findIndex(layer => layer.id === id);
    if (oldIndex === -1) return false;

    const [movedLayer] = oldParentArray.splice(oldIndex, 1);

    // Add to new parent
    if (newParentId) {
      const newParent = this.findLayerById(layers, newParentId);
      if (!newParent || newParent.type !== 'folder') return false;

      if (!newParent.children) {
        newParent.children = [];
      }
      (newParent.children as ILayer[]).push(movedLayer);
    } else {
      // Move to root level
      layers.push(movedLayer);
    }

    // Update data
    const updatedData: ITimeLineData = {
      ...data,
      layers
    };
    this.context.Data.load(updatedData);

    // Emit event
    this.context.Core.eventManager.emit('layer:reparented', { 
      id, 
      newParentId 
    });

    return true;
  }

  /**
   * Toggle layer visibility
   */
  public toggleVisibility(id: string): boolean {
    const data = this.context.Data.getData();
    const layers = [...data.layers] as ILayer[];

    const layer = this.findLayerById(layers, id);
    if (!layer) return false;

    layer.visible = !layer.visible;

    // Update data
    const updatedData: ITimeLineData = {
      ...data,
      layers
    };
    this.context.Data.load(updatedData);

    // Emit event
    this.context.Core.eventManager.emit('layer:visibilityChanged', { 
      id, 
      visible: layer.visible 
    });

    return true;
  }

  /**
   * Toggle layer lock state
   */
  public toggleLock(id: string): boolean {
    const data = this.context.Data.getData();
    const layers = [...data.layers] as ILayer[];

    const layer = this.findLayerById(layers, id);
    if (!layer) return false;

    layer.locked = !layer.locked;

    // Update data
    const updatedData: ITimeLineData = {
      ...data,
      layers
    };
    this.context.Data.load(updatedData);

    // Emit event
    this.context.Core.eventManager.emit('layer:lockChanged', { 
      id, 
      locked: layer.locked 
    });

    return true;
  }
}
