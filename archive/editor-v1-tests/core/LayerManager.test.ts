import { LayerManager } from '../../core/LayerManager';
import { createMockContext, createTestData } from '../helpers/mockContext';
import { IJsTimeLineContext } from '../../IJsTimeLineContext';

describe('LayerManager', () => {
  let layerManager: LayerManager;
  let mockContext: IJsTimeLineContext;

  beforeEach(() => {
    mockContext = createMockContext();
    mockContext.Data.load(createTestData());
    layerManager = new LayerManager(mockContext);
  });

  describe('addLayer', () => {
    it('should add a layer to the root level', () => {
      const layer = layerManager.addLayer('New Layer');
      
      expect(layer).toBeDefined();
      expect(layer.name).toBe('New Layer');
      expect(layer.type).toBe('layer');
      expect(layer.visible).toBe(true);
      expect(layer.locked).toBe(false);
    });

    it('should generate a unique ID', () => {
      const layer1 = layerManager.addLayer('Layer A');
      const layer2 = layerManager.addLayer('Layer B');
      
      expect(layer1.id).not.toBe(layer2.id);
    });

    it('should emit onObjectAdd event', () => {
      const callback = jest.fn();
      mockContext.Core.eventManager.on('onObjectAdd', callback);
      
      const layer = layerManager.addLayer('New Layer');
      
      expect(callback).toHaveBeenCalledWith({
        id: layer.id,
        type: 'layer',
        parentId: null
      });
    });

    it('should add layer to a specific folder', () => {
      const layer = layerManager.addLayer('Nested Layer', 'folder-1');
      
      const data = mockContext.Data.getData();
      const folder = data.layers.find(l => l.id === 'folder-1');
      
      expect(folder?.children).toContainEqual(expect.objectContaining({ id: layer.id }));
    });
  });

  describe('addFolder', () => {
    it('should add a folder to the root level', () => {
      const folder = layerManager.addFolder('New Folder');
      
      expect(folder).toBeDefined();
      expect(folder.name).toBe('New Folder');
      expect(folder.type).toBe('folder');
      expect(folder.children).toEqual([]);
    });

    it('should emit onObjectAdd event with folder type', () => {
      const callback = jest.fn();
      mockContext.Core.eventManager.on('onObjectAdd', callback);
      
      const folder = layerManager.addFolder('New Folder');
      
      expect(callback).toHaveBeenCalledWith({
        id: folder.id,
        type: 'folder',
        parentId: null
      });
    });
  });

  describe('deleteObject', () => {
    it('should delete a layer from root level', () => {
      const result = layerManager.deleteObject('layer-1');
      
      expect(result).toBe(true);
      
      const data = mockContext.Data.getData();
      expect(data.layers.find(l => l.id === 'layer-1')).toBeUndefined();
    });

    it('should delete a nested layer from a folder', () => {
      const result = layerManager.deleteObject('layer-2');
      
      expect(result).toBe(true);
      
      const data = mockContext.Data.getData();
      const folder = data.layers.find(l => l.id === 'folder-1');
      expect(folder?.children?.find(l => l.id === 'layer-2')).toBeUndefined();
    });

    it('should return false for non-existent layer', () => {
      const result = layerManager.deleteObject('non-existent');
      
      expect(result).toBe(false);
    });

    it('should emit onObjectDelete event', () => {
      const callback = jest.fn();
      mockContext.Core.eventManager.on('onObjectDelete', callback);
      
      layerManager.deleteObject('layer-1');
      
      expect(callback).toHaveBeenCalledWith({ ids: ['layer-1'] });
    });

    it('should allow cancellation through onBeforeObjectDelete event', () => {
      mockContext.Core.eventManager.on('onBeforeObjectDelete', (event: { preventDefault: () => void }) => {
        event.preventDefault();
      });
      
      const result = layerManager.deleteObject('layer-1');
      
      expect(result).toBe(false);
      
      const data = mockContext.Data.getData();
      expect(data.layers.find(l => l.id === 'layer-1')).toBeDefined();
    });
  });

  describe('renameObject', () => {
    it('should rename a layer', () => {
      const result = layerManager.renameObject('layer-1', 'Renamed Layer');
      
      expect(result).toBe(true);
      
      const data = mockContext.Data.getData();
      const layer = data.layers.find(l => l.id === 'layer-1');
      expect(layer?.name).toBe('Renamed Layer');
    });

    it('should emit onObjectRename event', () => {
      const callback = jest.fn();
      mockContext.Core.eventManager.on('onObjectRename', callback);
      
      layerManager.renameObject('layer-1', 'New Name');
      
      expect(callback).toHaveBeenCalledWith({
        id: 'layer-1',
        oldName: 'Layer 1',
        newName: 'New Name'
      });
    });

    it('should return false for non-existent layer', () => {
      const result = layerManager.renameObject('non-existent', 'New Name');
      
      expect(result).toBe(false);
    });
  });

  describe('reorderObject', () => {
    it('should reorder layer within parent', () => {
      const result = layerManager.reorderObject('layer-3', 0);
      
      expect(result).toBe(true);
      
      const data = mockContext.Data.getData();
      expect(data.layers[0].id).toBe('layer-3');
    });

    it('should emit onObjectReorder event', () => {
      const callback = jest.fn();
      mockContext.Core.eventManager.on('onObjectReorder', callback);
      
      layerManager.reorderObject('layer-3', 0);
      
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        id: 'layer-3',
        oldIndex: 2,
        newIndex: 0
      }));
    });
  });

  describe('reparentObject', () => {
    it('should move layer to a folder', () => {
      const result = layerManager.reparentObject('layer-1', 'folder-1');
      
      expect(result).toBe(true);
      
      const data = mockContext.Data.getData();
      const folder = data.layers.find(l => l.id === 'folder-1');
      expect(folder?.children?.find(l => l.id === 'layer-1')).toBeDefined();
    });

    it('should move layer to root (null parent)', () => {
      const result = layerManager.reparentObject('layer-2', null);
      
      expect(result).toBe(true);
      
      const data = mockContext.Data.getData();
      expect(data.layers.find(l => l.id === 'layer-2')).toBeDefined();
      
      // Should no longer be in folder
      const folder = data.layers.find(l => l.id === 'folder-1');
      expect(folder?.children?.find(l => l.id === 'layer-2')).toBeUndefined();
    });

    it('should emit onObjectReparent event', () => {
      const callback = jest.fn();
      mockContext.Core.eventManager.on('onObjectReparent', callback);
      
      layerManager.reparentObject('layer-1', 'folder-1');
      
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        id: 'layer-1',
        newParentId: 'folder-1'
      }));
    });
  });

  describe('toggleVisibility', () => {
    it('should toggle visibility from visible to hidden', () => {
      const result = layerManager.toggleVisibility('layer-1');
      
      expect(result).toBe(true);
      
      const data = mockContext.Data.getData();
      const layer = data.layers.find(l => l.id === 'layer-1');
      expect(layer?.visible).toBe(false);
    });

    it('should toggle visibility from hidden to visible', () => {
      const result = layerManager.toggleVisibility('layer-3');
      
      expect(result).toBe(true);
      
      const data = mockContext.Data.getData();
      const layer = data.layers.find(l => l.id === 'layer-3');
      expect(layer?.visible).toBe(true);
    });

    it('should emit onObjectVisibilityChange event', () => {
      const callback = jest.fn();
      mockContext.Core.eventManager.on('onObjectVisibilityChange', callback);
      
      layerManager.toggleVisibility('layer-1');
      
      expect(callback).toHaveBeenCalledWith({
        id: 'layer-1',
        isVisible: false
      });
    });
  });

  describe('toggleLock', () => {
    it('should toggle lock from unlocked to locked', () => {
      const result = layerManager.toggleLock('layer-1');
      
      expect(result).toBe(true);
      
      const data = mockContext.Data.getData();
      const layer = data.layers.find(l => l.id === 'layer-1');
      expect(layer?.locked).toBe(true);
    });

    it('should toggle lock from locked to unlocked', () => {
      const result = layerManager.toggleLock('layer-3');
      
      expect(result).toBe(true);
      
      const data = mockContext.Data.getData();
      const layer = data.layers.find(l => l.id === 'layer-3');
      expect(layer?.locked).toBe(false);
    });

    it('should emit onObjectLockChange event', () => {
      const callback = jest.fn();
      mockContext.Core.eventManager.on('onObjectLockChange', callback);
      
      layerManager.toggleLock('layer-1');
      
      expect(callback).toHaveBeenCalledWith({
        id: 'layer-1',
        isLocked: true
      });
    });
  });
});
