import { SelectionManager } from '../../core/SelectionManager';
import { createMockContext, createTestData } from '../helpers/mockContext';
import { IJsTimeLineContext } from '../../IJsTimeLineContext';

describe('SelectionManager', () => {
  let selectionManager: SelectionManager;
  let mockContext: IJsTimeLineContext;

  beforeEach(() => {
    mockContext = createMockContext();
    mockContext.Data.load(createTestData());
    selectionManager = new SelectionManager(mockContext);
  });

  describe('selectFrame', () => {
    it('should select a single frame and clear previous selection', () => {
      selectionManager.selectFrame('layer-1:5');
      selectionManager.selectFrame('layer-1:10');
      
      const selected = selectionManager.getSelectedFrames();
      
      expect(selected).toHaveLength(1);
      expect(selected).toContain('layer-1:10');
      expect(selected).not.toContain('layer-1:5');
    });

    it('should emit onKeyframeSelect event', () => {
      const callback = jest.fn();
      mockContext.Core.eventManager.on('onKeyframeSelect', callback);
      
      selectionManager.selectFrame('layer-1:5');
      
      // selectFrame clears selection first (emits with empty), then adds frame (emits again)
      // So we check the last call
      expect(callback).toHaveBeenCalled();
      const lastCall = callback.mock.calls[callback.mock.calls.length - 1];
      expect(lastCall[0].selectedIds).toContain('kf-layer-1-5');
    });
  });

  describe('deselectFrame', () => {
    it('should deselect a specific frame', () => {
      selectionManager.selectFrame('layer-1:5');
      selectionManager.toggleSelection('layer-1:10');
      selectionManager.deselectFrame('layer-1:5');
      
      const selected = selectionManager.getSelectedFrames();
      
      expect(selected).toHaveLength(1);
      expect(selected).toContain('layer-1:10');
    });

    it('should clear lastSelectedFrame if it was deselected', () => {
      selectionManager.selectFrame('layer-1:5');
      selectionManager.deselectFrame('layer-1:5');
      
      expect(selectionManager.getLastSelectedFrame()).toBeNull();
    });
  });

  describe('clearSelection', () => {
    it('should clear all selections', () => {
      selectionManager.selectFrame('layer-1:5');
      selectionManager.toggleSelection('layer-1:10');
      selectionManager.clearSelection();
      
      expect(selectionManager.getSelectedFrames()).toHaveLength(0);
      expect(selectionManager.getLastSelectedFrame()).toBeNull();
    });
  });

  describe('toggleSelection', () => {
    it('should add frame to selection if not selected', () => {
      selectionManager.selectFrame('layer-1:5');
      selectionManager.toggleSelection('layer-1:10');
      
      const selected = selectionManager.getSelectedFrames();
      
      expect(selected).toHaveLength(2);
      expect(selected).toContain('layer-1:5');
      expect(selected).toContain('layer-1:10');
    });

    it('should remove frame from selection if already selected', () => {
      selectionManager.selectFrame('layer-1:5');
      selectionManager.toggleSelection('layer-1:10');
      selectionManager.toggleSelection('layer-1:5');
      
      const selected = selectionManager.getSelectedFrames();
      
      expect(selected).toHaveLength(1);
      expect(selected).toContain('layer-1:10');
    });
  });

  describe('selectRange', () => {
    it('should select all frames in range on the same layer', () => {
      selectionManager.selectRange('layer-1:5', 'layer-1:10');
      
      const selected = selectionManager.getSelectedFrames();
      
      expect(selected).toHaveLength(6);
      expect(selected).toContain('layer-1:5');
      expect(selected).toContain('layer-1:6');
      expect(selected).toContain('layer-1:7');
      expect(selected).toContain('layer-1:8');
      expect(selected).toContain('layer-1:9');
      expect(selected).toContain('layer-1:10');
    });

    it('should work regardless of start/end order', () => {
      selectionManager.selectRange('layer-1:10', 'layer-1:5');
      
      const selected = selectionManager.getSelectedFrames();
      
      expect(selected).toHaveLength(6);
    });

    it('should not select frames across different layers', () => {
      // Mock console.warn
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      selectionManager.selectRange('layer-1:5', 'layer-2:10');
      
      expect(warnSpy).toHaveBeenCalledWith('Range selection only works on the same layer');
      expect(selectionManager.getSelectedFrames()).toHaveLength(0);
      
      warnSpy.mockRestore();
    });
  });

  describe('isSelected', () => {
    it('should return true for selected frames', () => {
      selectionManager.selectFrame('layer-1:5');
      
      expect(selectionManager.isSelected('layer-1:5')).toBe(true);
    });

    it('should return false for non-selected frames', () => {
      selectionManager.selectFrame('layer-1:5');
      
      expect(selectionManager.isSelected('layer-1:10')).toBe(false);
    });
  });

  describe('getLastSelectedFrame', () => {
    it('should return the last selected frame', () => {
      selectionManager.selectFrame('layer-1:5');
      selectionManager.toggleSelection('layer-1:10');
      
      expect(selectionManager.getLastSelectedFrame()).toBe('layer-1:10');
    });
  });

  describe('getSelectionCount', () => {
    it('should return correct count of selected frames', () => {
      expect(selectionManager.getSelectionCount()).toBe(0);
      
      selectionManager.selectFrame('layer-1:5');
      expect(selectionManager.getSelectionCount()).toBe(1);
      
      selectionManager.toggleSelection('layer-1:10');
      expect(selectionManager.getSelectionCount()).toBe(2);
      
      selectionManager.clearSelection();
      expect(selectionManager.getSelectionCount()).toBe(0);
    });
  });
});
