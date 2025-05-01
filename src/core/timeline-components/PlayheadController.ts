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
    }

    /**
     * Register events that this component needs to respond to
     */
    private registerEvents(): void {
        // This component doesn't need to listen to any events directly
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
            
            // Update selected frame cell and active track row
            if (this.tracksEl) {
                // Clear all selected states first
                const allFrames = this.tracksEl.querySelectorAll('.timeline-grid__frame-cell.selected');
                Array.from(allFrames).forEach((frame) => frame.classList.remove('selected'));
                
                const allTracks = this.tracksEl.querySelectorAll('.timeline-grid__track-row.active');
                Array.from(allTracks).forEach((track) => track.classList.remove('active'));
                
                // Find and select the current frame
                const currentFrame = this.tracksEl.querySelector(
                    `.timeline-grid__frame-cell[data-frame="${playheadFrame}"][data-layer-idx="${playheadLayer}"]`
                );
                
                if (currentFrame) {
                    currentFrame.classList.add('selected');
                    
                    // Select the track row too
                    const trackRow = currentFrame.closest('.timeline-grid__track-row');
                    if (trackRow) {
                        trackRow.classList.add('active');
                    }
                }
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
    }

    /**
     * Clean up event listeners
     */
    public cleanup(): void {
        document.removeEventListener('mousemove', this.mouseMoveHandler);
        document.removeEventListener('mouseup', this.mouseUpHandler);
    }
}
