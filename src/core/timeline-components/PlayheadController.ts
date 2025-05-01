import { StateManager } from '../stateManager';
import { EventManager } from '../eventManager';

/**
 * Interface for PlayheadController configuration
 */
export interface PlayheadControllerConfig {
    container: HTMLElement;
    frameWidth: number;
}

/**
 * PlayheadController Component
 * 
 * Responsible for managing the playhead element and interactions:
 * - Handling playhead dragging
 * - Updating playhead position visually
 * - Managing playhead-related event listeners
 */
export class PlayheadController {
    private stateManager: StateManager;
    private eventManager: EventManager;
    private container: HTMLElement;
    private frameWidth: number;
    private mouseMoveHandler: (e: MouseEvent) => void = () => {};
    private mouseUpHandler: () => void = () => {};
    private tracksEl: HTMLElement | null = null;

    /**
     * Creates an instance of PlayheadController
     * 
     * @param stateManager - The state manager for the timeline
     * @param eventManager - The event manager for the timeline
     * @param config - Configuration options for the controller
     */
    constructor(stateManager: StateManager, eventManager: EventManager, config: PlayheadControllerConfig) {
        this.stateManager = stateManager;
        this.eventManager = eventManager;
        this.container = config.container;
        this.frameWidth = config.frameWidth;
        
        // Register events
        this.registerEvents();
    }    /**
     * Register events that this component needs to respond to
     */
    private registerEvents(): void {
        // Listen to window resize to adjust playhead height
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // Listen directly to playhead move events to update visual selection
        this.eventManager.subscribe('playheadMove', (data) => {
            // Wait a brief moment to ensure DOM has updated
            setTimeout(() => {
                this.updatePlayheadPosition();
            }, 0);
        });
        
        // Listen to control bar height changes
        const resizeObserver = new ResizeObserver((entries) => {
            // When control bar height changes, update playhead
            const playhead = this.container.querySelector('.timeline-grid__playhead') as HTMLElement;
            if (playhead) {
                this.adjustPlayheadHeight(playhead);
            }
        });
        
        // Start observing after a short delay to ensure the elements are rendered
        setTimeout(() => {
            const controlBar = this.container.querySelector('.timeline-grid__control-bar');
            if (controlBar) {
                resizeObserver.observe(controlBar);
            }
        }, 100);
    }
    
    /**
     * Handle window resize events
     */
    private handleResize(): void {
        const playhead = this.container.querySelector('.timeline-grid__playhead') as HTMLElement;
        if (playhead) {
            this.adjustPlayheadHeight(playhead);
        }
    }

    /**
     * Set the tracks element reference
     * 
     * @param tracksEl - The tracks container element
     */
    public setTracksElement(tracksEl: HTMLElement | null): void {
        this.tracksEl = tracksEl;
    }    /**
     * Update just the playhead position element without full rerender
     */
    public updatePlayheadPosition(): void {
        const state = this.stateManager.getState();
        const playheadFrame = state.playhead ? state.playhead.frame : 1;
        const playheadLayer = state.playhead ? state.playhead.layerIdx : 0;
        const playhead = this.container.querySelector('.timeline-grid__playhead') as HTMLElement;
        
        if (playhead) {
            // Update position
            playhead.style.left = `${(playheadFrame - 1) * this.frameWidth}px`;
            
            // Adjust height to prevent covering the control bar
            this.adjustPlayheadHeight(playhead);
            
            // Update selected frame cell and active track row
            if (this.tracksEl) {
                console.log(`Updating selection for frame ${playheadFrame} on layer ${playheadLayer}`);
                
                // Clear all selected states first
                const allFrames = this.tracksEl.querySelectorAll('.timeline-grid__frame-cell.selected');
                Array.from(allFrames).forEach((frame) => frame.classList.remove('selected'));
                
                const allTracks = this.tracksEl.querySelectorAll('.timeline-grid__track-row.active');
                Array.from(allTracks).forEach((track) => track.classList.remove('active'));
                
                // Find and select the current frame with more reliable attribute selectors
                // Try first with the exact selector
                let currentFrame = this.tracksEl.querySelector(
                    `.timeline-grid__frame-cell[data-frame="${playheadFrame}"][data-layer-idx="${playheadLayer}"]`
                ) as HTMLElement | null;
                
                // If the first selector fails, try with a slightly different approach
                if (!currentFrame) {
                    const possibleFrames = this.tracksEl.querySelectorAll('.timeline-grid__frame-cell');
                    for (let i = 0; i < possibleFrames.length; i++) {
                        const frame = possibleFrames[i] as HTMLElement;
                        const dataFrame = frame.getAttribute('data-frame');
                        const dataLayerIdx = frame.getAttribute('data-layer-idx');
                        
                        if (dataFrame === String(playheadFrame) && dataLayerIdx === String(playheadLayer)) {
                            currentFrame = frame;
                            break;
                        }
                    }
                }
                
                if (currentFrame) {
                    console.log('Found frame cell, adding selected class');
                    currentFrame.classList.add('selected');
                    
                    // Select the track row too
                    const trackRow = currentFrame.closest('.timeline-grid__track-row');
                    if (trackRow) {
                        trackRow.classList.add('active');
                    } else {
                        console.log('Could not find parent track row');
                    }
                } else {
                    console.warn(`Could not find frame cell for frame=${playheadFrame}, layer=${playheadLayer}`);
                    
                    // Fallback: try to at least select the track row for the layer
                    const trackRows = this.tracksEl.querySelectorAll('.timeline-grid__track-row');
                    if (trackRows && trackRows.length > playheadLayer) {
                        trackRows[playheadLayer].classList.add('active');
                    }
                }
            }
        }
    }
    
    /**
     * Adjust the playhead height to account for the control bar
     * 
     * @param playhead - The playhead element to adjust
     */
    private adjustPlayheadHeight(playhead: HTMLElement): void {
        const controlBar = this.container.querySelector('.timeline-grid__control-bar') as HTMLElement;
        if (controlBar) {
            const controlBarHeight = controlBar.offsetHeight;
            const scrollContainer = this.container.querySelector('.timeline-grid__scroll-container') as HTMLElement;
            if (scrollContainer) {
                // Set the height to be the full container height minus the control bar height
                const adjustedHeight = `calc(100% - ${controlBarHeight}px)`;
                playhead.style.height = adjustedHeight;
            }
        }
    }

    /**
     * Attach event handlers for playhead dragging
     */
    public attachPlayheadDrag(): void {
        // Clean up any existing event listeners
        document.removeEventListener('mousemove', this.mouseMoveHandler);
        document.removeEventListener('mouseup', this.mouseUpHandler);

        const playhead = this.container.querySelector('.timeline-grid__playhead') as HTMLElement;
        if (!playhead) return;
        
        // Remove existing listeners from the playhead
        const newPlayhead = playhead.cloneNode(true) as HTMLElement;
        if (playhead.parentNode) {
            playhead.parentNode.replaceChild(newPlayhead, playhead);
        }
          // Make playhead narrower so it doesn't interfere with frame clicks
        newPlayhead.classList.add('draggable');
        
        // Adjust the playhead height to not overlap with the control bar
        this.adjustPlayheadHeight(newPlayhead);
        // State variables for drag operation
        let isDragging = false;
        let startX = 0;
        let startFrame = 1;
        
        // Simplified mousedown handler with focused hit area
        newPlayhead.addEventListener('mousedown', (e: MouseEvent) => {
            // Make this a simple flag that we check during frame click handling
            console.log('Playhead mousedown detected');
            
            isDragging = true;
            startX = e.clientX;
            
            const state = this.stateManager.getState();
            startFrame = state.playhead ? state.playhead.frame : 1;
            
            // Visual feedback
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'ew-resize';
            newPlayhead.classList.add('dragging');
            
            // Prevent default to stop text selection, but DO NOT stop propagation
            e.preventDefault();
        });
        
        // Mouse move handler for dragging
        this.mouseMoveHandler = (e: MouseEvent) => {
            if (!isDragging) return;
            
            // Simple delta calculation based on mouse movement
            const dx = e.clientX - startX;
            const frameDelta = Math.round(dx / this.frameWidth);
            const newFrame = Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, startFrame + frameDelta));
            
            // Update the model
            const state = this.stateManager.getState();
            this.stateManager.updatePlayhead({
                layerIdx: state.playhead ? state.playhead.layerIdx : 0,
                frame: newFrame
            });
            
            // Emit event for frame navigation needed
            this.eventManager.emit('playheadDragged', { frame: newFrame });
        };
        
        // Mouse up handler
        this.mouseUpHandler = () => {
            if (!isDragging) return;
            
            isDragging = false;
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
            
            if (newPlayhead) {
                newPlayhead.classList.remove('dragging');
            }
            
            // Emit event for drag end
            this.eventManager.emit('playheadDragEnd', {});
        };
        
        // Attach global event listeners
        document.addEventListener('mousemove', this.mouseMoveHandler);
        document.addEventListener('mouseup', this.mouseUpHandler);
    }

    /**
     * Set the frame width
     * 
     * @param frameWidth - New frame width
     */
    public setFrameWidth(frameWidth: number): void {
        this.frameWidth = frameWidth;
    }    /**
     * Clean up event listeners
     */
    public cleanup(): void {
        document.removeEventListener('mousemove', this.mouseMoveHandler);
        document.removeEventListener('mouseup', this.mouseUpHandler);
        window.removeEventListener('resize', this.handleResize);
    }
}
