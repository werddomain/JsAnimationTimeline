import { StateManager } from '../stateManager';
import { EventManager } from '../eventManager';

/**
 * Interface for RulerRenderer configuration
 */
export interface RulerRendererConfig {
    container: HTMLElement;
    frameWidth: number;
    rulerHeight: number;
}

/**
 * RulerRenderer Component
 * 
 * Responsible for rendering and managing the timeline ruler:
 * - Rendering frame numbers in the ruler
 * - Handling ruler scrolling synchronization
 * - Managing ruler visual appearance
 */
export class RulerRenderer {
    private stateManager: StateManager;
    private eventManager: EventManager;
    private container: HTMLElement;
    private frameWidth: number;
    private rulerHeight: number;
    private rulerEl: HTMLElement | null = null;
    private scrollContainer: HTMLElement | null = null;
    private tracksEl: HTMLElement | null = null;

    /**
     * Creates an instance of RulerRenderer
     * 
     * @param stateManager - The state manager for the timeline
     * @param eventManager - The event manager for the timeline
     * @param config - Configuration options for the renderer
     */
    constructor(stateManager: StateManager, eventManager: EventManager, config: RulerRendererConfig) {
        this.stateManager = stateManager;
        this.eventManager = eventManager;
        this.container = config.container;
        this.frameWidth = config.frameWidth;
        this.rulerHeight = config.rulerHeight;
        
        // Register events
        this.registerEvents();
    }

    /**
     * Register events that this component needs to respond to
     */
    private registerEvents(): void {
        // No direct event subscriptions needed for this component
    }

    /**
     * Set references to ruler, tracks, and scroll container elements
     * 
     * @param rulerEl - The ruler element
     * @param tracksEl - The tracks element
     * @param scrollContainer - The scroll container element
     */
    public setElements(rulerEl: HTMLElement | null, tracksEl: HTMLElement | null, scrollContainer: HTMLElement | null): void {
        this.rulerEl = rulerEl;
        this.tracksEl = tracksEl;
        this.scrollContainer = scrollContainer;
    }

    /**
     * Render the ruler with frame numbers
     * 
     * @param playheadFrame - Current playhead frame number
     * @param frameCount - Total number of frames to render
     * @returns HTML string with rendered ruler
     */
    public renderRuler(playheadFrame: number, frameCount: number): string {
        let html = '';
        for (let i = 1; i <= frameCount; i++) {
            const isCurrent = i === playheadFrame;
            html += `
                <div class="timeline-grid__ruler-frame${isCurrent ? ' current' : ''}" style="left:${(i-1)*this.frameWidth}px;width:${this.frameWidth}px">
                    <span class="timeline-grid__ruler-label">${i}</span>
                </div>
            `;
        }
        return html;
    }

    /**
     * Synchronize scrolling between ruler and tracks
     */
    public syncRulerAndTracks(): void {
        if (!this.scrollContainer || !this.rulerEl || !this.tracksEl) return;
        
        // Create a named scroll handler function
        const handleScroll = () => {
            if (!this.rulerEl || !this.tracksEl || !this.scrollContainer) return;
            this.rulerEl.scrollLeft = this.scrollContainer.scrollLeft;
            this.tracksEl.scrollLeft = this.scrollContainer.scrollLeft;
            
            // Emit event for scroll position change
            this.eventManager.emit('rulerScrollChange', { 
                position: this.scrollContainer.scrollLeft 
            });
        };
        
        // Attach the scroll handler
        this.scrollContainer.addEventListener('scroll', handleScroll);
    }

    /**
     * Update frame width
     * 
     * @param frameWidth - New frame width
     */
    public setFrameWidth(frameWidth: number): void {
        this.frameWidth = frameWidth;
    }

    /**
     * Get ruler height
     * 
     * @returns The ruler height
     */
    public getRulerHeight(): number {
        return this.rulerHeight;
    }
}
