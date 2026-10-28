import { TweenManager } from '../../core/TweenManager';
import { createMockContext, createTestData } from '../helpers/mockContext';
import { IJsTimeLineContext } from '../../IJsTimeLineContext';

describe('TweenManager', () => {
  let tweenManager: TweenManager;
  let mockContext: IJsTimeLineContext;

  beforeEach(() => {
    mockContext = createMockContext();
    mockContext.Data.load(createTestData());
    tweenManager = new TweenManager(mockContext);
  });

  describe('createMotionTween', () => {
    it('should create a motion tween between two keyframes', () => {
      const result = tweenManager.createMotionTween('layer-1', 10, 20);
      
      expect(result).toBe(true);
      
      const data = mockContext.Data.getData();
      const layer = data.layers.find(l => l.id === 'layer-1');
      const tween = layer?.tweens?.find(tw => tw.startFrame === 10 && tw.endFrame === 20);
      
      expect(tween).toBeDefined();
      expect(tween?.type).toBe('linear');
    });

    it('should emit onTweenAdd event', () => {
      const callback = jest.fn();
      mockContext.Core.eventManager.on('onTweenAdd', callback);
      
      tweenManager.createMotionTween('layer-1', 10, 20);
      
      expect(callback).toHaveBeenCalledWith({
        layerId: 'layer-1',
        startFrame: 10,
        endFrame: 20,
        type: 'motion'
      });
    });

    it('should fail if start frame is not a keyframe', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = tweenManager.createMotionTween('layer-1', 5, 10); // Frame 5 is not a keyframe
      
      expect(result).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith('Both start and end must be keyframes');
      errorSpy.mockRestore();
    });

    it('should fail if end frame is not a keyframe', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = tweenManager.createMotionTween('layer-1', 1, 5); // Frame 5 is not a keyframe
      
      expect(result).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith('Both start and end must be keyframes');
      errorSpy.mockRestore();
    });

    it('should fail if start frame is after end frame', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = tweenManager.createMotionTween('layer-1', 20, 10);
      
      expect(result).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith('Start frame must be before end frame');
      errorSpy.mockRestore();
    });

    it('should fail if tween overlaps with existing tween', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Existing tween is from 1 to 10, so starting at frame 5 would overlap
      const result = tweenManager.createMotionTween('layer-1', 1, 10);
      
      expect(result).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith('Tween overlaps with existing tween');
      warnSpy.mockRestore();
    });

    it('should fail for non-existent layer', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = tweenManager.createMotionTween('non-existent', 1, 10);
      
      expect(result).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith('Layer non-existent not found');
      errorSpy.mockRestore();
    });

    it('should use custom tween type when provided', () => {
      const result = tweenManager.createMotionTween('layer-1', 10, 20, 'ease-in');
      
      expect(result).toBe(true);
      
      const data = mockContext.Data.getData();
      const layer = data.layers.find(l => l.id === 'layer-1');
      const tween = layer?.tweens?.find(tw => tw.startFrame === 10 && tw.endFrame === 20);
      
      expect(tween?.type).toBe('ease-in');
    });

    it('should sort tweens by start frame', () => {
      // Create tween from 10-20 first
      tweenManager.createMotionTween('layer-1', 10, 20);
      
      const data = mockContext.Data.getData();
      const layer = data.layers.find(l => l.id === 'layer-1');
      const tweenStartFrames = layer?.tweens?.map(tw => tw.startFrame);
      
      // Should be sorted: 1 (existing), 10
      expect(tweenStartFrames).toEqual([1, 10]);
    });

    it('should refresh UI after creating tween', () => {
      tweenManager.createMotionTween('layer-1', 10, 20);
      
      expect(mockContext.UI.timelineGrid?.render).toHaveBeenCalled();
    });
  });

  describe('removeTween', () => {
    it('should remove an existing tween', () => {
      const result = tweenManager.removeTween('layer-1', 1, 10);
      
      expect(result).toBe(true);
      
      const data = mockContext.Data.getData();
      const layer = data.layers.find(l => l.id === 'layer-1');
      
      expect(layer?.tweens).toHaveLength(0);
    });

    it('should emit onTweenRemove event', () => {
      const callback = jest.fn();
      mockContext.Core.eventManager.on('onTweenRemove', callback);
      
      tweenManager.removeTween('layer-1', 1, 10);
      
      expect(callback).toHaveBeenCalledWith({
        layerId: 'layer-1',
        startFrame: 1,
        endFrame: 10
      });
    });

    it('should return false for non-existent tween', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const result = tweenManager.removeTween('layer-1', 50, 60);
      
      expect(result).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith('Tween not found');
      warnSpy.mockRestore();
    });

    it('should return false for non-existent layer', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = tweenManager.removeTween('non-existent', 1, 10);
      
      expect(result).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith('Layer or tweens not found');
      errorSpy.mockRestore();
    });
  });

  describe('updateTween', () => {
    it('should update an existing tween', () => {
      const oldTween = { startFrame: 1, endFrame: 10, type: 'linear' };
      const newTween = { startFrame: 1, endFrame: 15, type: 'ease-out' };
      
      const result = tweenManager.updateTween('layer-1', oldTween, newTween);
      
      expect(result).toBe(true);
      
      const data = mockContext.Data.getData();
      const layer = data.layers.find(l => l.id === 'layer-1');
      const tween = layer?.tweens?.[0];
      
      expect(tween?.endFrame).toBe(15);
      expect(tween?.type).toBe('ease-out');
    });

    it('should emit onTweenUpdate event', () => {
      const callback = jest.fn();
      mockContext.Core.eventManager.on('onTweenUpdate', callback);
      
      const oldTween = { startFrame: 1, endFrame: 10, type: 'linear' };
      const newTween = { startFrame: 1, endFrame: 15, type: 'ease-out' };
      
      tweenManager.updateTween('layer-1', oldTween, newTween);
      
      expect(callback).toHaveBeenCalledWith({
        layerId: 'layer-1',
        oldTween,
        newTween
      });
    });

    it('should return false for non-existent tween', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const oldTween = { startFrame: 50, endFrame: 60, type: 'linear' };
      const newTween = { startFrame: 50, endFrame: 70, type: 'ease' };
      
      const result = tweenManager.updateTween('layer-1', oldTween, newTween);
      
      expect(result).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith('Tween not found');
      warnSpy.mockRestore();
    });
  });

  describe('getTweenAtFrame', () => {
    it('should return tween that contains the specified frame', () => {
      const tween = tweenManager.getTweenAtFrame('layer-1', 5);
      
      expect(tween).toBeDefined();
      expect(tween?.startFrame).toBe(1);
      expect(tween?.endFrame).toBe(10);
    });

    it('should return null for frame outside any tween', () => {
      const tween = tweenManager.getTweenAtFrame('layer-1', 50);
      
      expect(tween).toBeNull();
    });

    it('should return null for frame at tween start (exclusive)', () => {
      // Tween is 1-10, frame 1 is the starting keyframe, not part of the tween "in-between"
      const tween = tweenManager.getTweenAtFrame('layer-1', 1);
      
      expect(tween).toBeNull();
    });

    it('should return tween for frame at tween end (inclusive)', () => {
      const tween = tweenManager.getTweenAtFrame('layer-1', 10);
      
      expect(tween).toBeDefined();
    });

    it('should return null for non-existent layer', () => {
      const tween = tweenManager.getTweenAtFrame('non-existent', 5);
      
      expect(tween).toBeNull();
    });
  });

  describe('isFrameInTween', () => {
    it('should return true for frame inside a tween', () => {
      const result = tweenManager.isFrameInTween('layer-1', 5);
      
      expect(result).toBe(true);
    });

    it('should return false for frame outside any tween', () => {
      const result = tweenManager.isFrameInTween('layer-1', 50);
      
      expect(result).toBe(false);
    });
  });
});
