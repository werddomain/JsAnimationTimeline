import { StateManager } from '../stateManager';
import { EventManager } from '../eventManager';

/**
 * Interface for TracksRenderer configuration
 */
export interface TracksRendererConfig {
    container: HTMLElement;
    frameWidth: number;
    rowHeight: number;
}

/**
 * TracksRenderer Component
 * 
 * Responsible for rendering and managing timeline tracks:
 * - Rendering track rows for each layer
 * - Updating active track visual state
 * - Managing track row appearance
 */
export class TracksRenderer {
    private stateManager: StateManager;
    private eventManager: EventManager;
    private container: HTMLElement;
    private frameWidth: number;
    private rowHeight: number;
    private tracksEl: HTMLElement | null = null;
    private keyframeRenderer: (layerIdx: number, frameCount: number) => string;

    /**
     * Creates an instance of TracksRenderer
     * 
     * @param stateManager - The state manager for the timeline
     * @param eventManager - The event manager for the timeline
     * @param config - Configuration options for the renderer
     * @param keyframeRenderer - Function to render keyframes for tracks
     */
    constructor(
        stateManager: StateManager, 
        eventManager: EventManager, 
        config: TracksRendererConfig,
        keyframeRenderer: (layerIdx: number, frameCount: number) => string
    ) {
        this.stateManager = stateManager;
        this.eventManager = eventManager;
        this.container = config.container;
        this.frameWidth = config.frameWidth;
        this.rowHeight = config.rowHeight;
        this.keyframeRenderer = keyframeRenderer;
        
        // Register events
        this.registerEvents();
    }    /**
     * Register events that this component needs to respond to
     */
    private registerEvents(): void {
        // Listen for layer selection changes
        this.eventManager.subscribe('layerSelected', (layerIdx) => {
            this.updateActiveTrackRow(layerIdx);
        });
        
        // Also listen to playhead move events to highlight active track row
        this.eventManager.subscribe('playheadMove', (data) => {
            if (data && typeof data.layerIdx !== 'undefined') {
                setTimeout(() => {
                    this.updateActiveTrackRow(data.layerIdx);
                }, 0);
            }
        });
    }

    /**
     * Set the tracks element reference
     * 
     * @param tracksEl - The tracks container element
     */
    public setTracksElement(tracksEl: HTMLElement | null): void {
        this.tracksEl = tracksEl;
    }

    /**
     * Render track rows for all layers
     * 
     * @param playheadFrame - Current playhead frame
     * @param frameCount - Total number of frames
     * @returns HTML string with rendered track rows
     */
    public renderTracks(playheadFrame: number, frameCount: number): string {
        const state = this.stateManager.getState();
        
        return state.layers.map((layer, idx) => {
            const isActive = state.playhead && state.playhead.layerIdx === idx;
            return `
                <div class="timeline-grid__track-row${isActive ? ' active' : ''}" data-layer="${layer.name}" style="top:${idx*this.rowHeight}px">
                    <span class="timeline-grid__track-color-dot" style="background:${layer.color}"></span>
                    ${this.keyframeRenderer(idx, frameCount)}
                </div>
            `;
        }).join('');
    }

    /**
     * Update the active state of track rows visually without full re-render
     * 
     * @param layerIdx - Index of layer to set as active
     */
    public updateActiveTrackRow(layerIdx: number): void {
        if (!this.tracksEl) return;
        
        // Update active class on track rows
        const allTracks = this.tracksEl.querySelectorAll('.timeline-grid__track-row');
        allTracks.forEach((track, idx) => {
            if (idx === layerIdx) {
                track.classList.add('active');
            } else {
                track.classList.remove('active');
            }
        });
    }

    /**
     * Get the row height
     * 
     * @returns The row height
     */
    public getRowHeight(): number {
        return this.rowHeight;
    }

    /**
     * Set the frame width
     * 
     * @param frameWidth - New frame width
     */
    public setFrameWidth(frameWidth: number): void {
        this.frameWidth = frameWidth;
    }

    /**
     * Get the tracks element
     * 
     * @returns The tracks element
     */
    public getTracksElement(): HTMLElement | null {
        return this.tracksEl;
    }
}
