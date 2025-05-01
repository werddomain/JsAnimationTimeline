import { StateManager } from '../stateManager';
import { EventManager } from '../eventManager';

/**
 * Interface for FrameNavigator configuration
 */
export interface FrameNavigatorConfig {
    container: HTMLElement;
    frameCount: number;
    frameWidth: number;
}

/**
 * FrameNavigator Component
 * 
 * Responsible for handling frame navigation, seeking, and viewport visibility including:
 * - Seeking to specific frames
 * - Ensuring frames are visible in the viewport
 * - Managing goto frame and time inputs
 */
export class FrameNavigator {
    private stateManager: StateManager;
    private eventManager: EventManager;
    private container: HTMLElement;
    private frameCount: number;
    private frameWidth: number;
    private scrollContainer: HTMLElement | null = null;
    private suppressSync: boolean = false;

    /**
     * Creates an instance of FrameNavigator
     * 
     * @param stateManager - The state manager for the timeline
     * @param eventManager - The event manager for the timeline
     * @param config - Configuration options for the navigator
     */
    constructor(stateManager: StateManager, eventManager: EventManager, config: FrameNavigatorConfig) {
        this.stateManager = stateManager;
        this.eventManager = eventManager;
        this.container = config.container;
        this.frameCount = config.frameCount;
        this.frameWidth = config.frameWidth;
        
        // Register events this component responds to
        this.registerEvents();
    }

    /**
     * Register events that this component needs to respond to
     */
    private registerEvents(): void {
        // Listen for frame count changes
        this.eventManager.subscribe('frameCountChanged', (data) => {
            this.frameCount = data.frameCount;
        });
    }

    /**
     * Set the scroll container reference
     * 
     * @param scrollContainer - The scroll container element
     */
    public setScrollContainer(scrollContainer: HTMLElement | null): void {
        this.scrollContainer = scrollContainer;
    }

    /**
     * Attach event handlers to the goto frame inputs and button
     */
    public attachGotoFrame(): void {
        const frameInput = this.container.querySelector('#goto-frame') as HTMLInputElement;
        const btn = this.container.querySelector('#goto-frame-btn') as HTMLButtonElement;
        
        if (frameInput && btn) {
            btn.onclick = () => {
                const frame = Math.max(1, Math.min(this.frameCount, parseInt(frameInput.value, 10)));
                this.seekToFrame(frame);
            };
            
            frameInput.onkeydown = (e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                    const frame = Math.max(1, Math.min(this.frameCount, parseInt(frameInput.value, 10)));
                    this.seekToFrame(frame);
                }
            };
        }
    }

    /**
     * Sync frame number with time display
     */
    public attachGotoTimeSync(): void {
        const frameInput = this.container.querySelector('#goto-frame') as HTMLInputElement;
        const timeInput = this.container.querySelector('#goto-time') as HTMLInputElement;
        
        if (!frameInput || !timeInput) return;
        
        frameInput.oninput = () => {
            if (this.suppressSync) return;
            this.suppressSync = true;
            
            const frame = Math.max(1, Math.min(this.frameCount, parseInt(frameInput.value, 10)));
            const state = this.stateManager.getState();
            timeInput.value = ((frame - 1) / state.fps).toFixed(2);
            
            this.suppressSync = false;
        };
        
        timeInput.oninput = () => {
            if (this.suppressSync) return;
            this.suppressSync = true;
            
            const time = Math.max(0, parseFloat(timeInput.value));
            const state = this.stateManager.getState();
            const frame = Math.round(time * state.fps) + 1;
            frameInput.value = String(Math.max(1, Math.min(this.frameCount, frame)));
            
            this.suppressSync = false;
        };
    }

    /**
     * Seek to a specific frame and update the UI
     * 
     * @param frame - Frame number to seek to
     */
    public seekToFrame(frame: number): void {
        const state = this.stateManager.getState();
        const layerIdx = state.playhead ? state.playhead.layerIdx : 0;
        
        // Update the state
        this.stateManager.updatePlayhead({ layerIdx, frame });
        
        // Ensure the frame is visible in the scroll view
        this.ensureFrameVisible(frame);
        
        // Emit event for external listeners
        this.eventManager.emit('playheadMove', { layerIdx, frame });
    }

    /**
     * Ensure a frame is visible within the scroll container's viewport
     * 
     * @param frame - Frame number to ensure is visible
     */
    public ensureFrameVisible(frame: number): void {
        if (!this.scrollContainer) return;
        
        const frameX = (frame - 1) * this.frameWidth;
        const scrollLeft = this.scrollContainer.scrollLeft;
        const containerWidth = this.scrollContainer.clientWidth;
        
        // If the frame is outside the visible area, scroll to make it visible
        if (frameX < scrollLeft || frameX > scrollLeft + containerWidth - this.frameWidth) {
            // If near left edge, align to left with some padding
            if (frameX < scrollLeft + containerWidth / 4) {
                this.scrollContainer.scrollLeft = Math.max(0, frameX - this.frameWidth * 2);
            } 
            // If near right edge, align to right with some padding
            else if (frameX > scrollLeft + containerWidth * 3/4) {
                this.scrollContainer.scrollLeft = frameX - containerWidth + this.frameWidth * 3;
            }
        }
    }

    /**
     * Update frame count
     * 
     * @param frameCount - New frame count
     */
    public setFrameCount(frameCount: number): void {
        this.frameCount = frameCount;
    }

    /**
     * Update frame width
     * 
     * @param frameWidth - New frame width
     */
    public setFrameWidth(frameWidth: number): void {
        this.frameWidth = frameWidth;
    }
}
