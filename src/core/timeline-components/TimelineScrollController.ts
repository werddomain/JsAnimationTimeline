import { EventManager } from '../eventManager';
import { VirtualScrollbar } from '../virtualScrollbar';

/**
 * Interface for TimelineScrollController configuration
 */
export interface TimelineScrollControllerConfig {
    container: HTMLElement;
    frameWidth: number;
    initialFrameCount: number;
}

/**
 * TimelineScrollController Component
 * 
 * Responsible for managing scrolling behaviors and frame extension:
 * - Handling scroll events
 * - Managing scroll synchronization
 * - Extending frames when scrolling near the edge
 */
export class TimelineScrollController {
    private eventManager: EventManager;
    private container: HTMLElement;
    private frameWidth: number;
    private frameCount: number;
    private scrollContainer: HTMLElement | null = null;
    private scrollTimeout: any = null;
    private scrollHandler: any = null;
    private isPlaying: boolean = false;

    /**
     * Creates an instance of TimelineScrollController
     * 
     * @param eventManager - The event manager for the timeline
     * @param config - Configuration options for the controller
     */
    constructor(eventManager: EventManager, config: TimelineScrollControllerConfig) {
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
        // Listen for playback state changes to avoid scroll operations during playback
        this.eventManager.subscribe('playbackStarted', () => {
            this.isPlaying = true;
        });
        
        this.eventManager.subscribe('playbackStopped', () => {
            this.isPlaying = false;
        });
    }    /**
     * Set the scroll container reference
     * 
     * @param scrollContainer - The scroll container element
     */
    public setScrollContainer(scrollContainer: HTMLElement | null): void {
        this.scrollContainer = scrollContainer;
        
        // Don't create virtual scrollbar here as it's managed by the TimelineGrid3D class
    }    /**
     * Attach the scroll handler
     */
    public attachScrollHandler(): void {
        if (!this.scrollContainer) return;
        
        // Remove existing handler if any
        if (this.scrollHandler) {
            this.scrollContainer.removeEventListener('scroll', this.scrollHandler);
        }
        
        // Create new scroll handler
        this.scrollHandler = () => {
            if (!this.scrollContainer) return;
            if (this.isPlaying) return;
            
            // Emit scroll position change event for virtual scrollbar to use
            const { scrollLeft, scrollWidth, clientWidth } = this.scrollContainer;
            this.eventManager.emit('scrollPositionChange', { position: scrollLeft });
            
            // Check if we need to extend frames
            if (this.scrollTimeout) clearTimeout(this.scrollTimeout);
            this.scrollTimeout = setTimeout(() => {
                const { scrollLeft, scrollWidth, clientWidth } = this.scrollContainer!;
                if (scrollLeft + clientWidth > scrollWidth - 200) {
                    const rightVisibleFrame = Math.ceil((scrollLeft + clientWidth) / this.frameWidth);
                    this.extendFramesAndRestoreScroll(rightVisibleFrame, clientWidth);
                }
            }, 150);
        };
        
        // Attach the handler
        this.scrollContainer.addEventListener('scroll', this.scrollHandler);
        
        // Subscribe to scroll change events from the virtual scrollbar
        this.eventManager.subscribe('scrollChange', (data) => {
            if (this.scrollContainer) {
                this.scrollContainer.scrollLeft = data.position;
            }
        });
    }

    /**
     * Extend frames when scrolling near the edge
     * 
     * @param rightVisibleFrame - The rightmost visible frame number
     * @param clientWidth - The client width of the scroll container
     */
    public extendFramesAndRestoreScroll(rightVisibleFrame: number, clientWidth: number): void {
        // Calculate the offset from the right edge
        const offsetFromRight = clientWidth - ((rightVisibleFrame) * this.frameWidth - (this.scrollContainer ? this.scrollContainer.scrollLeft : 0));
        
        // Store the old frame count before extending
        const oldFrameCount = this.frameCount;
        
        // Add more frames (at least 30 or enough to fill double the viewport width)
        const minFramesToAdd = 30;
        const framesToFillDoubleViewport = Math.ceil((clientWidth * 2) / this.frameWidth) - oldFrameCount;
        const framesToAdd = Math.max(minFramesToAdd, framesToFillDoubleViewport > 0 ? framesToFillDoubleViewport : 0);
        
        this.frameCount += framesToAdd;
        
        // Emit event for frame count change
        this.eventManager.emit('frameCountChanged', { 
            frameCount: this.frameCount,
            previousFrameCount: oldFrameCount
        });
        
        // After render, restore scroll so the rightmost visible frame is still at the same position
        if (this.scrollContainer) {
            // Set scroll position with slight delay to ensure DOM is updated
            setTimeout(() => {
                if (this.scrollContainer) {
                    this.scrollContainer.scrollLeft = rightVisibleFrame * this.frameWidth - clientWidth + offsetFromRight;
                    console.log('Extended frames:', oldFrameCount, 'to', this.frameCount, 'Scroll position:', this.scrollContainer.scrollLeft);
                }
            }, 0);
        }
    }

    /**
     * Extend frames by a specific count
     * 
     * @param count - Number of frames to add
     */
    public extendFrames(count: number): void {
        this.frameCount += count;
        
        // Emit event for frame count change
        this.eventManager.emit('frameCountChanged', { 
            frameCount: this.frameCount,
            previousFrameCount: this.frameCount - count
        });
    }

    /**
     * Get the current frame count
     * 
     * @returns The current frame count
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
    }    /**
     * Clean up resources
     */
    public cleanup(): void {
        if (this.scrollContainer && this.scrollHandler) {
            this.scrollContainer.removeEventListener('scroll', this.scrollHandler);
        }
        
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }
    }
}
