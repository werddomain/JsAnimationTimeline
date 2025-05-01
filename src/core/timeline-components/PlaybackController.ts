import { StateManager } from '../stateManager';
import { EventManager } from '../eventManager';

/**
 * Interface for PlaybackController configuration
 */
export interface PlaybackControllerConfig {
    container: HTMLElement;
    frameCount: number;
}

/**
 * PlaybackController Component
 * 
 * Responsible for managing timeline playback functionality including:
 * - Play/pause functionality
 * - Stop playback
 * - Step frame forward/backward
 * - Attaching playback control event listeners
 */
export class PlaybackController {
    private stateManager: StateManager;
    private eventManager: EventManager;
    private container: HTMLElement;
    private isPlaying: boolean = false;
    private playInterval: any = null;
    private frameCount: number;

    /**
     * Creates an instance of PlaybackController.
     * 
     * @param stateManager - The state manager for the timeline
     * @param eventManager - The event manager for the timeline
     * @param config - Configuration options for the controller
     */
    constructor(stateManager: StateManager, eventManager: EventManager, config: PlaybackControllerConfig) {
        this.stateManager = stateManager;
        this.eventManager = eventManager;
        this.container = config.container;
        this.frameCount = config.frameCount;
        
        // Register events this component responds to
        this.registerEvents();
    }

    /**
     * Register events that this component needs to respond to
     */
    private registerEvents(): void {
        // This component doesn't need to listen to any events directly
        // It emits events itself through the eventManager
    }

    /**
     * Attach event handlers to playback control buttons
     */
    public attachPlaybackControls(): void {
        const playBtn = this.container.querySelector('#play-btn') as HTMLButtonElement;
        const stopBtn = this.container.querySelector('#stop-btn') as HTMLButtonElement;
        const stepBackBtn = this.container.querySelector('#step-back-btn') as HTMLButtonElement;
        const stepFwdBtn = this.container.querySelector('#step-fwd-btn') as HTMLButtonElement;
        
        if (playBtn) playBtn.onclick = () => this.togglePlay();
        if (stopBtn) stopBtn.onclick = () => this.stopPlayback();
        if (stepBackBtn) stepBackBtn.onclick = () => this.stepFrame(-1);
        if (stepFwdBtn) stepFwdBtn.onclick = () => this.stepFrame(1);
    }

    /**
     * Toggle play/pause state of the timeline
     */
    public togglePlay(): void {
        const state = this.stateManager.getState();
        if (this.isPlaying) {
            this.stopPlayback();
        } else {
            this.isPlaying = true;
            // Emit event to notify other components that playback has started
            this.eventManager.emit('playbackStarted', { playing: true });
            
            this.playInterval = setInterval(() => {
                const state = this.stateManager.getState();
                if (!state.playhead) {
                    this.stopPlayback();
                    return;
                }
                if (state.playhead.frame < this.frameCount) {
                    this.stateManager.updatePlayhead({ 
                        layerIdx: state.playhead.layerIdx, 
                        frame: state.playhead.frame + 1 
                    });
                } else {
                    this.stopPlayback();
                }
            }, 1000 / state.fps);
        }
    }

    /**
     * Stop timeline playback and reset to first frame
     */
    public stopPlayback(): void {
        this.isPlaying = false;
        if (this.playInterval) clearInterval(this.playInterval);
        this.playInterval = null;
        
        const state = this.stateManager.getState();
        this.stateManager.updatePlayhead({ 
            layerIdx: state.playhead ? state.playhead.layerIdx : 0, 
            frame: 1 
        });
        
        // Emit event to notify other components that playback has stopped
        this.eventManager.emit('playbackStopped', { playing: false });
    }

    /**
     * Move the playhead forward or backward by a number of frames
     * 
     * @param dir - Direction to move (-1 for backward, 1 for forward)
     */
    public stepFrame(dir: number): void {
        const state = this.stateManager.getState();
        if (!state.playhead) {
            this.stateManager.updatePlayhead({ layerIdx: 0, frame: 1 });
        } else {
            let newFrame = state.playhead.frame + dir;
            newFrame = Math.max(1, Math.min(this.frameCount, newFrame));
            this.stateManager.updatePlayhead({ 
                layerIdx: state.playhead.layerIdx, 
                frame: newFrame 
            });
        }
        
        // Emit event for frame step
        this.eventManager.emit('frameStep', { direction: dir });
    }

    /**
     * Get the current playing state
     * 
     * @returns The current playing state
     */
    public getIsPlaying(): boolean {
        return this.isPlaying;
    }

    /**
     * Set the total frame count
     * 
     * @param frameCount - The new frame count
     */
    public setFrameCount(frameCount: number): void {
        this.frameCount = frameCount;
    }
    
    /**
     * Update the UI based on current play state
     * Should be called after render() to update UI elements
     */
    public updatePlaybackUI(): void {
        const playBtn = this.container.querySelector('#play-btn') as HTMLButtonElement;
        if (playBtn) {
            playBtn.innerHTML = this.isPlaying ? 
                '<svg width=16 height=16><rect x=3 y=3 width=3 height=10 fill=black/><rect x=10 y=3 width=3 height=10 fill=black/></svg>' : 
                '<svg width=16 height=16><polygon points="3,3 13,8 3,13" fill="black"/></svg>';
        }
    }
}
