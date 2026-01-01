import { KeyframeManager } from '../../core/KeyframeManager';
import { createMockContext, createTestData } from '../helpers/mockContext';
import { IJsTimeLineContext } from '../../IJsTimeLineContext';

describe('KeyframeManager', () => {
  let keyframeManager: KeyframeManager;
  let mockContext: IJsTimeLineContext;

  beforeEach(() => {
    mockContext = createMockContext();
    mockContext.Data.load(createTestData());
    keyframeManager = new KeyframeManager(mockContext);
  });

  describe('insertKeyframe', () => {
    it('should insert a content keyframe', () => {
      keyframeManager.insertKeyframe('layer-1', 5);
      
      const data = mockContext.Data.getData();
      const layer = data.layers.find(l => l.id === 'layer-1');
      const keyframe = layer?.keyframes?.find(kf => kf.frame === 5);
      
      expect(keyframe).toBeDefined();
      expect(keyframe?.isEmpty).toBe(false);
    });

    it('should emit onKeyframeAdd event', () => {
      const callback = jest.fn();
      mockContext.Core.eventManager.on('onKeyframeAdd', callback);
      
      keyframeManager.insertKeyframe('layer-1', 5);
      
      expect(callback).toHaveBeenCalledWith({
        id: 'kf-layer-1-5',
        layerId: 'layer-1',
        frame: 5,
        type: 'content'
      });
    });

    it('should not insert duplicate keyframe', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      keyframeManager.insertKeyframe('layer-1', 1); // Frame 1 already exists
      
      expect(warnSpy).toHaveBeenCalledWith('Keyframe already exists at frame 1');
      warnSpy.mockRestore();
    });

    it('should sort keyframes by frame number', () => {
      keyframeManager.insertKeyframe('layer-1', 5);
      keyframeManager.insertKeyframe('layer-1', 15);
      keyframeManager.insertKeyframe('layer-1', 3);
      
      const data = mockContext.Data.getData();
      const layer = data.layers.find(l => l.id === 'layer-1');
      const frames = layer?.keyframes?.map(kf => kf.frame);
      
      expect(frames).toEqual([1, 3, 5, 10, 15, 20]);
    });

    it('should handle non-existent layer', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      keyframeManager.insertKeyframe('non-existent', 5);
      
      expect(errorSpy).toHaveBeenCalledWith('Layer non-existent not found');
      errorSpy.mockRestore();
    });

    it('should call UI refresh', () => {
      keyframeManager.insertKeyframe('layer-1', 5);
      
      expect(mockContext.UI.timelineGrid?.render).toHaveBeenCalled();
    });
  });

  describe('insertBlankKeyframe', () => {
    it('should insert a blank keyframe with isEmpty=true', () => {
      keyframeManager.insertBlankKeyframe('layer-1', 5);
      
      const data = mockContext.Data.getData();
      const layer = data.layers.find(l => l.id === 'layer-1');
      const keyframe = layer?.keyframes?.find(kf => kf.frame === 5);
      
      expect(keyframe).toBeDefined();
      expect(keyframe?.isEmpty).toBe(true);
    });

    it('should emit onKeyframeAdd event with blank type', () => {
      const callback = jest.fn();
      mockContext.Core.eventManager.on('onKeyframeAdd', callback);
      
      keyframeManager.insertBlankKeyframe('layer-1', 5);
      
      expect(callback).toHaveBeenCalledWith({
        id: 'kf-layer-1-5',
        layerId: 'layer-1',
        frame: 5,
        type: 'blank'
      });
    });
  });

  describe('insertFrame', () => {
    it('should shift keyframes after the inserted frame', () => {
      const data = mockContext.Data.getData();
      const layerBefore = data.layers.find(l => l.id === 'layer-1');
      const framesBefore = layerBefore?.keyframes?.map(kf => kf.frame);
      expect(framesBefore).toEqual([1, 10, 20]);
      
      keyframeManager.insertFrame('layer-1', 5);
      
      const dataAfter = mockContext.Data.getData();
      const layerAfter = dataAfter.layers.find(l => l.id === 'layer-1');
      const framesAfter = layerAfter?.keyframes?.map(kf => kf.frame);
      
      expect(framesAfter).toEqual([1, 11, 21]);
    });

    it('should shift tweens after the inserted frame', () => {
      keyframeManager.insertFrame('layer-1', 5);
      
      const data = mockContext.Data.getData();
      const layer = data.layers.find(l => l.id === 'layer-1');
      const tween = layer?.tweens?.[0];
      
      expect(tween?.startFrame).toBe(1);
      expect(tween?.endFrame).toBe(11);
    });

    it('should emit frame:inserted event', () => {
      const callback = jest.fn();
      mockContext.Core.eventManager.on('frame:inserted', callback);
      
      keyframeManager.insertFrame('layer-1', 5);
      
      expect(callback).toHaveBeenCalledWith({ layerId: 'layer-1', frame: 5 });
    });
  });

  describe('deleteFrames', () => {
    it('should delete keyframes in the specified range', () => {
      const result = keyframeManager.deleteFrames('layer-1', 10, 10);
      
      expect(result).toBe(true);
      
      const data = mockContext.Data.getData();
      const layer = data.layers.find(l => l.id === 'layer-1');
      const keyframe = layer?.keyframes?.find(kf => kf.frame === 10);
      
      expect(keyframe).toBeUndefined();
    });

    it('should shift remaining keyframes after deletion', () => {
      keyframeManager.deleteFrames('layer-1', 10, 10);
      
      const data = mockContext.Data.getData();
      const layer = data.layers.find(l => l.id === 'layer-1');
      const frames = layer?.keyframes?.map(kf => kf.frame);
      
      // Original frames: 1, 10, 20 -> After deleting 10: 1, 19 (20 shifts to 19)
      expect(frames).toEqual([1, 19]);
    });

    it('should emit onKeyframeDelete event', () => {
      const callback = jest.fn();
      mockContext.Core.eventManager.on('onKeyframeDelete', callback);
      
      keyframeManager.deleteFrames('layer-1', 10, 10);
      
      expect(callback).toHaveBeenCalledWith({
        ids: ['kf-layer-1-10']
      });
    });

    it('should allow cancellation through onBeforeKeyframeDelete event', () => {
      mockContext.Core.eventManager.on('onBeforeKeyframeDelete', (event: { preventDefault: () => void }) => {
        event.preventDefault();
      });
      
      const result = keyframeManager.deleteFrames('layer-1', 10, 10);
      
      expect(result).toBe(false);
      
      const data = mockContext.Data.getData();
      const layer = data.layers.find(l => l.id === 'layer-1');
      const keyframe = layer?.keyframes?.find(kf => kf.frame === 10);
      
      expect(keyframe).toBeDefined();
    });
  });

  describe('deleteKeyframe', () => {
    it('should delete a specific keyframe', () => {
      const result = keyframeManager.deleteKeyframe('layer-1', 10);
      
      expect(result).toBe(true);
      
      const data = mockContext.Data.getData();
      const layer = data.layers.find(l => l.id === 'layer-1');
      const keyframe = layer?.keyframes?.find(kf => kf.frame === 10);
      
      expect(keyframe).toBeUndefined();
    });

    it('should return false for non-existent layer', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = keyframeManager.deleteKeyframe('non-existent', 10);
      
      expect(result).toBe(false);
      errorSpy.mockRestore();
    });
  });

  describe('moveKeyframes', () => {
    it('should move keyframes to a new position', () => {
      const result = keyframeManager.moveKeyframes(['layer-1:10'], 'layer-1', 25);
      
      expect(result).toBe(true);
      
      const data = mockContext.Data.getData();
      const layer = data.layers.find(l => l.id === 'layer-1');
      const oldKeyframe = layer?.keyframes?.find(kf => kf.frame === 10);
      const newKeyframe = layer?.keyframes?.find(kf => kf.frame === 25);
      
      expect(oldKeyframe).toBeUndefined();
      expect(newKeyframe).toBeDefined();
    });

    it('should move keyframes to a different layer', () => {
      const result = keyframeManager.moveKeyframes(['layer-1:10'], 'layer-2', 10);
      
      expect(result).toBe(true);
      
      const data = mockContext.Data.getData();
      const sourceLayer = data.layers.find(l => l.id === 'layer-1');
      const folder = data.layers.find(l => l.id === 'folder-1');
      const targetLayer = folder?.children?.find(l => l.id === 'layer-2');
      
      expect(sourceLayer?.keyframes?.find(kf => kf.frame === 10)).toBeUndefined();
      expect(targetLayer?.keyframes?.find(kf => kf.frame === 10)).toBeDefined();
    });

    it('should emit onKeyframeMove event', () => {
      const callback = jest.fn();
      mockContext.Core.eventManager.on('onKeyframeMove', callback);
      
      keyframeManager.moveKeyframes(['layer-1:10'], 'layer-1', 25);
      
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        moves: expect.arrayContaining([
          expect.objectContaining({
            id: 'kf-layer-1-10',
            oldFrame: 10,
            newFrame: 25
          })
        ])
      }));
    });

    it('should return false for empty frameIds array', () => {
      const result = keyframeManager.moveKeyframes([], 'layer-1', 25);
      
      expect(result).toBe(false);
    });
  });

  describe('copyKeyframes', () => {
    it('should copy keyframes to state manager clipboard', () => {
      keyframeManager.copyKeyframes(['layer-1:1', 'layer-1:10']);
      
      const clipboard = mockContext.Core.stateManager.get('clipboard_keyframes');
      
      expect(clipboard).toHaveLength(2);
      expect(clipboard[0]).toMatchObject({ layerId: 'layer-1', frame: 1 });
      expect(clipboard[1]).toMatchObject({ layerId: 'layer-1', frame: 10 });
    });

    it('should emit keyframes:copied event', () => {
      const callback = jest.fn();
      mockContext.Core.eventManager.on('keyframes:copied', callback);
      
      keyframeManager.copyKeyframes(['layer-1:1']);
      
      expect(callback).toHaveBeenCalledWith({ count: 1 });
    });

    it('should warn when no keyframes are selected', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      keyframeManager.copyKeyframes([]);
      
      expect(warnSpy).toHaveBeenCalledWith('No keyframes selected to copy');
      warnSpy.mockRestore();
    });
  });

  describe('pasteKeyframes', () => {
    it('should paste keyframes from clipboard', () => {
      keyframeManager.copyKeyframes(['layer-1:1']);
      keyframeManager.pasteKeyframes('layer-3', 5);
      
      const data = mockContext.Data.getData();
      const layer = data.layers.find(l => l.id === 'layer-3');
      const keyframe = layer?.keyframes?.find(kf => kf.frame === 5);
      
      expect(keyframe).toBeDefined();
    });

    it('should emit keyframes:pasted event', () => {
      keyframeManager.copyKeyframes(['layer-1:1']);
      
      const callback = jest.fn();
      mockContext.Core.eventManager.on('keyframes:pasted', callback);
      
      keyframeManager.pasteKeyframes('layer-3', 5);
      
      expect(callback).toHaveBeenCalledWith({
        targetLayerId: 'layer-3',
        targetFrame: 5,
        count: 1
      });
    });

    it('should warn when clipboard is empty', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      keyframeManager.pasteKeyframes('layer-3', 5);
      
      expect(warnSpy).toHaveBeenCalledWith('No keyframes in clipboard');
      warnSpy.mockRestore();
    });

    it('should skip pasting at conflicting positions', () => {
      keyframeManager.copyKeyframes(['layer-1:1']);
      
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      keyframeManager.pasteKeyframes('layer-1', 10); // Frame 10 already has a keyframe
      
      expect(warnSpy).toHaveBeenCalledWith('Skipping frame 10 - conflict detected');
      warnSpy.mockRestore();
    });
  });
});
