import { StateManager } from '../stateManager';
import { EventManager } from '../eventManager';

/**
 * Interface for TimelineConfigManager configuration
 */
export interface TimelineConfigManagerConfig {
    container: HTMLElement;
    frameWidth: number;
    initialFrameCount: number;
}

/**
 * TimelineConfigManager Component
 * 
 * Responsible for managing timeline configuration aspects:
 * - Frame width
 * - Frame count
 * - FPS settings
 */
export class TimelineConfigManager {
    private stateManager: StateManager;
    private eventManager: EventManager;
    private container: HTMLElement;
    private frameWidth: number;
    private frameCount: number;

    /**
     * Creates an instance of TimelineConfigManager
     * 
     * @param stateManager - The state manager for the timeline
     * @param eventManager - The event manager for the timeline
     * @param config - Configuration options for the manager
     */
    constructor(stateManager: StateManager, eventManager: EventManager, config: TimelineConfigManagerConfig) {
        this.stateManager = stateManager;
        this.eventManager = eventManager;
        this.container = config.container;
        this.frameWidth = config.frameWidth;
        this.frameCount = config.initialFrameCount;
        
        // Register events
        this.registerEvents();
    }

    /**
     * Register events that this component needs to respond to
     */
    private registerEvents(): void {
        // Listen for frame count changes from other components
        this.eventManager.subscribe('frameCountChanged', (data) => {
            this.frameCount = data.frameCount;
        });
    }

    /**
     * Attach FPS input handler
     */
    public attachFpsInput(): void {
        const fpsInput = this.container.querySelector('#fps-input') as HTMLInputElement;
        if (fpsInput) {
            fpsInput.onchange = () => {
                const newFps = Math.max(1, Math.min(120, parseFloat(fpsInput.value)));
                this.stateManager.updateFps(newFps);
                
                // Emit event for FPS change
                this.eventManager.emit('fpsChanged', { fps: newFps });
            };
        }
    }

    /**
     * Get the current frame width
     * 
     * @returns The frame width
     */
    public getFrameWidth(): number {
        return this.frameWidth;
    }

    /**
     * Get the current frame count
     * 
     * @returns The frame count
     */
    public getFrameCount(): number {
        return this.frameCount;
    }

    /**
     * Set the frame width
     * 
     * @param frameWidth - New frame width
     */
    public setFrameWidth(frameWidth: number): void {
        this.frameWidth = frameWidth;
        
        // Emit event for frame width change
        this.eventManager.emit('frameWidthChanged', { frameWidth });
    }

    /**
     * Set the frame count
     * 
     * @param frameCount - New frame count
     */
    public setFrameCount(frameCount: number): void {
        this.frameCount = frameCount;
        
        // Emit event for frame count change
        this.eventManager.emit('frameCountChanged', { 
            frameCount,
            previousFrameCount: this.frameCount
        });
    }
}
