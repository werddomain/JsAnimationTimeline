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
    private lastUpdatedLayer: number = -1;
    private updateDebounceTimer: any = null;
    parentContainer: HTMLElement | null = null;
    private isDragging: boolean = false; // Track if dragging is active

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
     */    private registerEvents(): void {
        // Listen for layer selection changes
        this.eventManager.subscribe('layerSelected', (layerIdx) => {
            console.log('TracksRenderer: Received layerSelected event for layer', layerIdx);
            this.debouncedUpdateActiveTrackRow(layerIdx);
        });
        
        // Also listen to playhead move events to highlight active track row
        this.eventManager.subscribe('playheadMove', (data) => {
            if (data && typeof data.layerIdx !== 'undefined') {
                console.log('TracksRenderer: Received playheadMove event for layer', data.layerIdx);
                this.debouncedUpdateActiveTrackRow(data.layerIdx);
            }
        });
        
        // Listen for layer rename events to update track data attributes
        this.eventManager.subscribe('layerRenamed', (data) => {
            if (data && data.oldName && data.newName && data.idx !== undefined) {
                console.log(`TracksRenderer: Layer renamed from "${data.oldName}" to "${data.newName}"`);
                this.handleLayerRenamed(data.idx, data.oldName, data.newName);
            }
        });
        
        // Listen for layer reordering events to update track positions
        this.eventManager.subscribe('layerReordered', (layers) => {
            console.log('TracksRenderer: Received layerReordered event');
            // Store the active layer to maintain selection after reordering
            const state = this.stateManager.getState();
            const activeLayerIdx = state.playhead ? state.playhead.layerIdx : -1;
            
            // Force track update on next render cycle to ensure DOM is updated
            setTimeout(() => {
                this.maintainActiveStateAfterReordering(activeLayerIdx);
            }, 0);
        });
        
        // Use MutationObserver to detect when the jstimeline container gets the is-dragging class
        setTimeout(() => {
            const timelineContainer = document.querySelector('.jstimeline');
            if (timelineContainer) {
                console.log('TracksRenderer: Setting up MutationObserver for jstimeline container');
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                            const hasIsDragging = timelineContainer.classList.contains('is-dragging');                            if (hasIsDragging !== this.isDragging) {
                                console.log(`TracksRenderer: is-dragging class ${hasIsDragging ? 'added to' : 'removed from'} jstimeline`);
                                this.isDragging = hasIsDragging;
                                // Re-render to update the row spacing
                                const state = this.stateManager.getState();
                                if (state.playhead) {
                                    this.updateTracksOnly(state.playhead.frame || 1, 100);
                                }
                            }
                        }
                    });
                });
                observer.observe(timelineContainer, { attributes: true });
            }
        }, 100); // Small delay to ensure DOM is ready
            // Listen for drag start/end events to adjust track spacing accordingly
        document.addEventListener('dragstart', () => {
            console.log('TracksRenderer: Drag operation started');
            this.isDragging = true;
            // Request a re-render to apply the increased spacing
            const state = this.stateManager.getState();
            if (state.playhead) {
                this.updateTracksOnly(state.playhead.frame || 1, 100); // Default to 100 frames if not specified
            }
        });
        
        document.addEventListener('dragend', () => {
            console.log('TracksRenderer: Drag operation ended');
            this.isDragging = false;
            // Request a re-render to restore normal spacing
            const state = this.stateManager.getState();
            if (state.playhead) {
                this.updateTracksOnly(state.playhead.frame || 1, 100); // Default to 100 frames if not specified
            }
        });
    }
    
    /**
     * Debounces multiple calls to updateActiveTrackRow within a short time frame
     */
    private debouncedUpdateActiveTrackRow(layerIdx: number): void {
        // Skip if we're already updating this layer
        if (this.lastUpdatedLayer === layerIdx) {
            console.log('TracksRenderer: Skipping duplicate update for layer', layerIdx);
            return;
        }
        
        // Remember this layer
        this.lastUpdatedLayer = layerIdx;
        
        // Clear previous timer if exists
        if (this.updateDebounceTimer) {
            clearTimeout(this.updateDebounceTimer);
        }
        
        // Set a debounce timer
        this.updateDebounceTimer = setTimeout(() => {
            this.updateActiveTrackRow(layerIdx);
            // Reset after update
            this.lastUpdatedLayer = -1;
            this.updateDebounceTimer = null;
        }, 10);
    }

    /**
     * Set the tracks element reference
     * 
     * @param tracksEl - The tracks container element
     */
    public setTracksElement(tracksEl: HTMLElement | null, container: HTMLElement | null): void {
        this.tracksEl = tracksEl;
        this.parentContainer = container;
    }

    private resetTracksElement(): void {
        if (this.parentContainer) {
            this.tracksEl = this.parentContainer.querySelector('.timeline-grid__tracks');
            if (!this.tracksEl) {
                console.log('TracksRenderer: tracksEl is null, cannot reset tracks element');
                return;
            }

        }
    }
    /**
     * Render track rows for all layers
     * 
     * @param playheadFrame - Current playhead frame
     * @param frameCount - Total number of frames
     * @returns HTML string with rendered track rows
     */    public renderTracks(playheadFrame: number, frameCount: number): string {
        const state = this.stateManager.getState();
        
        // Add a spacing factor to account for the margins in layer panel items
        // Use different spacing based on whether we're dragging or not
        // Match the CSS variable --drag-item-spacing (5px) in drag-layer.less for dragging
        // Match the margin-top + margin-bottom (1px + 1px = 2px) in main.less for normal state
        const spacingFactor = this.isDragging ? 10 : 2; // 10px (5px top + 5px bottom) during drag, 2px (1px + 1px) normally
        
        return state.layers.map((layer, idx) => {
            const isActive = state.playhead && state.playhead.layerIdx === idx;
            // Apply additional spacing between rows by adjusting the top position
            return `
                <div class="timeline-grid__track-row${isActive ? ' active' : ''}" data-layer="${layer.name}" style="top:${idx*this.rowHeight + idx*spacingFactor}px">
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
        this.resetTracksElement();
        if (!this.tracksEl) {
            console.log('TracksRenderer: tracksEl is null, cannot update active track row');
            return;
        }
        
        console.log('TracksRenderer: updating active track row for layer', layerIdx);
        
        // Update active class on track rows immediately
        const allTracks = this.tracksEl.querySelectorAll('.timeline-grid__track-row');
        
        if (!allTracks || allTracks.length === 0) {
            console.log('TracksRenderer: No track rows found in the DOM');
            return;
        }
        
        // Keep track of whether we successfully updated any track
        let trackUpdated = false;
        
        // Use forEach with an index to match against layerIdx
        allTracks.forEach((track, idx) => {
            if (idx === layerIdx) {
                track.classList.add('active');
                trackUpdated = true;
            } else {
                track.classList.remove('active');
            }
        });
        
        // If we couldn't update the track by index, try by data attribute
        if (!trackUpdated && allTracks.length > 0) {
            const state = this.stateManager.getState();
            if (state.layers[layerIdx]) {
                const layerName = state.layers[layerIdx].name;
                
                // Find the track row by layer name data attribute
                allTracks.forEach((track) => {
                    if (track.getAttribute('data-layer') === layerName) {
                        track.classList.add('active');
                        trackUpdated = true;
                    }
                });
            }
        }
    }

    /**
     * Handle layer rename events and update track elements accordingly
     * 
     * @param layerIdx - Index of the renamed layer
     * @param oldName - Previous name of the layer
     * @param newName - New name of the layer  
     */
    private handleLayerRenamed(layerIdx: number, oldName: string, newName: string): void {
        this.resetTracksElement();
        if (!this.tracksEl) {
            console.log('TracksRenderer: tracksEl is null, cannot update track data attributes');
            return;
        }
        
        // Find the track row by either index or old name
        let trackElement: Element | null = null;
        const allTracks = this.tracksEl.querySelectorAll('.timeline-grid__track-row');
        
        // First try by index
        if (allTracks[layerIdx]) {
            trackElement = allTracks[layerIdx];
            console.log('TracksRenderer: Found track element by index', layerIdx);
        } 
        
        // If not found, try by name attribute
        if (!trackElement) {
            allTracks.forEach(track => {
                if (track.getAttribute('data-layer') === oldName) {
                    trackElement = track;
                    console.log('TracksRenderer: Found track element by name', oldName);
                }
            });
        }
        
        // Update the track element if found
        if (trackElement) {
            trackElement.setAttribute('data-layer', newName);
            console.log('TracksRenderer: Updated track data-layer attribute to', newName);
        } else {
            console.log('TracksRenderer: Could not find track element for layer', layerIdx);
        }
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
    }    /**
     * Get the tracks element
     * 
     * @returns The tracks element
     */
    public getTracksElement(): HTMLElement | null {
        return this.tracksEl;
    }

    /**
     * Ensure the active state is correctly set after layer reordering
     * 
     * @param activeLayerIdx - Index of currently active layer 
     */
    public maintainActiveStateAfterReordering(activeLayerIdx: number): void {
        this.resetTracksElement();
        const state = this.stateManager.getState();
        
        if (state.playhead && typeof state.playhead.layerIdx !== 'undefined') {
            // Use the playhead's layer index as the active layer
            this.updateActiveTrackRow(state.playhead.layerIdx);
        } else if (activeLayerIdx >= 0) {
            // Fallback to provided layer index
            this.updateActiveTrackRow(activeLayerIdx);
        }
    }

    /**
     * Updates only the tracks content without affecting other elements like ruler and playhead
     * 
     * @param playheadFrame - Current playhead frame
     * @param frameCount - Total number of frames
     */
    public updateTracksOnly(playheadFrame: number, frameCount: number): void {
        // Find the tracks element (not the container) and update only its content
        const tracksEl = this.parentContainer ? 
            this.parentContainer.querySelector('.timeline-grid__tracks') : null;
            
        if (tracksEl) {
            console.log('TracksRenderer: Updating only tracks content');
            tracksEl.innerHTML = this.renderTracks(playheadFrame, frameCount);
        } else {
            console.warn('TracksRenderer: Could not find tracks element to update');
        }
    }
}
