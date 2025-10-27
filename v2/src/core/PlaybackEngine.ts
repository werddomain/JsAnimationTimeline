import { IJsTimeLineContext } from '../IJsTimeLineContext';

/**
 * PlaybackEngine - Manages timeline playback with frame-accurate timing
 */
export class PlaybackEngine {
  private context: IJsTimeLineContext;
  private currentFrame: number = 1;
  private isPlaying: boolean = false;
  private animationFrameId: number | null = null;
  private lastFrameTime: number = 0;
  private frameInterval: number = 0;

  constructor(context: IJsTimeLineContext) {
    this.context = context;
    this.updateFrameInterval();
  }

  /**
   * Calculate frame interval based on FPS from settings
   */
  private updateFrameInterval(): void {
    const settings = this.context.Data.getData()?.settings;
    const fps = settings?.frameRate ?? 24;
    this.frameInterval = 1000 / fps; // milliseconds per frame
  }

  /**
   * Start playback from current frame
   */
  public play(): void {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.lastFrameTime = performance.now();
    this.updateFrameInterval();
    
    // Emit playback started event
    this.context.Core.eventManager.emit('playback:started', { frame: this.currentFrame });
    
    this.animate();
  }

  /**
   * Animation loop using requestAnimationFrame
   */
  private animate(): void {
    if (!this.isPlaying) return;

    const currentTime = performance.now();
    const elapsed = currentTime - this.lastFrameTime;

    // Check if enough time has passed for the next frame
    if (elapsed >= this.frameInterval) {
      this.lastFrameTime = currentTime - (elapsed % this.frameInterval);
      this.advanceFrame();
    }

    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  /**
   * Advance to the next frame
   */
  private advanceFrame(): void {
    const settings = this.context.Data.getData()?.settings;
    const totalFrames = settings?.totalFrames ?? 100;

    this.currentFrame++;

    // Loop back to frame 1 when reaching the end
    if (this.currentFrame > totalFrames) {
      this.currentFrame = 1;
      this.context.Core.eventManager.emit('playback:loop', { frame: this.currentFrame });
    }

    // Update playhead position
    if (this.context.UI.timeRuler) {
      this.context.UI.timeRuler.setPlayheadPosition(this.currentFrame);
    }

    // Emit frame enter event
    this.context.Core.eventManager.emit('playback:frameEnter', { frame: this.currentFrame });
  }

  /**
   * Pause playback at current frame
   */
  public pause(): void {
    if (!this.isPlaying) return;

    this.isPlaying = false;
    
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.context.Core.eventManager.emit('playback:paused', { frame: this.currentFrame });
  }

  /**
   * Stop playback and reset to frame 1
   */
  public stop(): void {
    this.pause();
    this.goToFrame(1);
    this.context.Core.eventManager.emit('playback:stopped', { frame: this.currentFrame });
  }

  /**
   * Jump to a specific frame
   */
  public goToFrame(frame: number): void {
    const settings = this.context.Data.getData()?.settings;
    const totalFrames = settings?.totalFrames ?? 100;

    // Clamp frame to valid range
    this.currentFrame = Math.max(1, Math.min(totalFrames, frame));

    // Update playhead position
    if (this.context.UI.timeRuler) {
      this.context.UI.timeRuler.setPlayheadPosition(this.currentFrame);
    }

    this.context.Core.eventManager.emit('playback:frameChanged', { frame: this.currentFrame });
  }

  /**
   * Get current frame number
   */
  public getCurrentFrame(): number {
    return this.currentFrame;
  }

  /**
   * Check if currently playing
   */
  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Toggle play/pause
   */
  public togglePlayPause(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }
}
