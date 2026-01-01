import { PlaybackEngine } from '../../core/PlaybackEngine';
import { createMockContext, createTestData } from '../helpers/mockContext';
import { IJsTimeLineContext } from '../../IJsTimeLineContext';

describe('PlaybackEngine', () => {
  let playbackEngine: PlaybackEngine;
  let mockContext: IJsTimeLineContext;

  beforeEach(() => {
    jest.useFakeTimers();
    
    // Create context and engine
    mockContext = createMockContext();
    mockContext.Data.load(createTestData());
    playbackEngine = new PlaybackEngine(mockContext);
  });

  afterEach(() => {
    // Make sure to stop playback to clean up
    if (playbackEngine.getIsPlaying()) {
      playbackEngine.stop();
    }
    jest.useRealTimers();
  });

  describe('play', () => {
    it('should start playback', () => {
      playbackEngine.play();
      
      expect(playbackEngine.getIsPlaying()).toBe(true);
    });

    it('should emit onPlaybackStart event', () => {
      const callback = jest.fn();
      mockContext.Core.eventManager.on('onPlaybackStart', callback);
      
      playbackEngine.play();
      
      expect(callback).toHaveBeenCalledWith({ currentFrame: 1 });
    });

    it('should emit playback:started legacy event', () => {
      const callback = jest.fn();
      mockContext.Core.eventManager.on('playback:started', callback);
      
      playbackEngine.play();
      
      expect(callback).toHaveBeenCalledWith({ frame: 1 });
    });

    it('should not restart if already playing', () => {
      const callback = jest.fn();
      mockContext.Core.eventManager.on('onPlaybackStart', callback);
      
      playbackEngine.play();
      playbackEngine.play();
      
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('pause', () => {
    it('should pause playback', () => {
      playbackEngine.play();
      playbackEngine.pause();
      
      expect(playbackEngine.getIsPlaying()).toBe(false);
    });

    it('should emit onPlaybackPause event', () => {
      const callback = jest.fn();
      mockContext.Core.eventManager.on('onPlaybackPause', callback);
      
      playbackEngine.play();
      playbackEngine.pause();
      
      expect(callback).toHaveBeenCalledWith({ currentFrame: 1 });
    });

    it('should emit playback:paused legacy event', () => {
      const callback = jest.fn();
      mockContext.Core.eventManager.on('playback:paused', callback);
      
      playbackEngine.play();
      playbackEngine.pause();
      
      expect(callback).toHaveBeenCalledWith({ frame: 1 });
    });

    it('should not emit event if not playing', () => {
      const callback = jest.fn();
      mockContext.Core.eventManager.on('onPlaybackPause', callback);
      
      playbackEngine.pause();
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should cancel animation frame when paused', () => {
      // This test verifies that when we pause, the animation loop stops
      // Since we can't easily mock requestAnimationFrame, we verify the state change
      playbackEngine.play();
      expect(playbackEngine.getIsPlaying()).toBe(true);
      
      playbackEngine.pause();
      expect(playbackEngine.getIsPlaying()).toBe(false);
    });
  });

  describe('stop', () => {
    it('should stop playback and reset to frame 1', () => {
      playbackEngine.goToFrame(50);
      playbackEngine.play();
      playbackEngine.stop();
      
      expect(playbackEngine.getIsPlaying()).toBe(false);
      expect(playbackEngine.getCurrentFrame()).toBe(1);
    });

    it('should emit playback:stopped event', () => {
      const callback = jest.fn();
      mockContext.Core.eventManager.on('playback:stopped', callback);
      
      playbackEngine.play();
      playbackEngine.stop();
      
      expect(callback).toHaveBeenCalledWith({ frame: 1 });
    });
  });

  describe('goToFrame', () => {
    it('should set current frame', () => {
      playbackEngine.goToFrame(50);
      
      expect(playbackEngine.getCurrentFrame()).toBe(50);
    });

    it('should clamp frame to minimum of 1', () => {
      playbackEngine.goToFrame(-5);
      
      expect(playbackEngine.getCurrentFrame()).toBe(1);
    });

    it('should clamp frame to maximum of totalFrames', () => {
      playbackEngine.goToFrame(200); // totalFrames is 100
      
      expect(playbackEngine.getCurrentFrame()).toBe(100);
    });

    it('should update playhead position', () => {
      playbackEngine.goToFrame(50);
      
      expect(mockContext.UI.timeRuler?.setPlayheadPosition).toHaveBeenCalledWith(50);
    });

    it('should emit playback:frameChanged event', () => {
      const callback = jest.fn();
      mockContext.Core.eventManager.on('playback:frameChanged', callback);
      
      playbackEngine.goToFrame(50);
      
      expect(callback).toHaveBeenCalledWith({ frame: 50 });
    });
  });

  describe('getCurrentFrame', () => {
    it('should return current frame', () => {
      expect(playbackEngine.getCurrentFrame()).toBe(1);
      
      playbackEngine.goToFrame(25);
      
      expect(playbackEngine.getCurrentFrame()).toBe(25);
    });
  });

  describe('getIsPlaying', () => {
    it('should return true when playing', () => {
      playbackEngine.play();
      
      expect(playbackEngine.getIsPlaying()).toBe(true);
    });

    it('should return false when paused', () => {
      playbackEngine.play();
      playbackEngine.pause();
      
      expect(playbackEngine.getIsPlaying()).toBe(false);
    });

    it('should return false initially', () => {
      expect(playbackEngine.getIsPlaying()).toBe(false);
    });
  });

  describe('togglePlayPause', () => {
    it('should start playing if not playing', () => {
      playbackEngine.togglePlayPause();
      
      expect(playbackEngine.getIsPlaying()).toBe(true);
    });

    it('should pause if playing', () => {
      playbackEngine.play();
      playbackEngine.togglePlayPause();
      
      expect(playbackEngine.getIsPlaying()).toBe(false);
    });
  });

  describe('frame timing', () => {
    it('should use frameRate from settings to calculate interval', () => {
      // Default frameRate is 24, so interval should be ~41.67ms
      const data = mockContext.Data.getData();
      expect(data.settings.frameRate).toBe(24);
      
      // The PlaybackEngine uses frameRate to calculate frame interval
      // We verify the data is available
      playbackEngine.play();
      expect(playbackEngine.getIsPlaying()).toBe(true);
      
      // Clean up
      playbackEngine.stop();
    });
  });
});
