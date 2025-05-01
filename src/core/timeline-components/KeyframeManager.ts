import { StateManager } from '../stateManager';
import { EventManager } from '../eventManager';

/**
 * Interface for KeyframeManager configuration
 */
export interface KeyframeManagerConfig {
    container: HTMLElement;
    frameWidth: number;
    tracksElement?: HTMLElement | null;
}

/**
 * KeyframeManager Component
 * 
 * Responsible for managing keyframe operations and rendering:
 * - Adding and removing keyframes
 * - Rendering keyframe indicators
 * - Handling keyframe selection
 */
export class KeyframeManager {
    private stateManager: StateManager;
    private eventManager: EventManager;
    private container: HTMLElement;
    private frameWidth: number;
    private tracksEl: HTMLElement | null = null;

    /**
     * Creates an instance of KeyframeManager
     * 
     * @param stateManager - The state manager for the timeline
     * @param eventManager - The event manager for the timeline
     * @param config - Configuration options for the manager
     */
    constructor(stateManager: StateManager, eventManager: EventManager, config: KeyframeManagerConfig) {
        this.stateManager = stateManager;
        this.eventManager = eventManager;
        this.container = config.container;
        this.frameWidth = config.frameWidth;
        this.tracksEl = config.tracksElement || null;
        
        // Register events
        this.registerEvents();
    }

    /**
     * Register events that this component needs to respond to
     */
    private registerEvents(): void {
        // No direct event subscriptions needed for this component
        // It primarily responds to user interactions
    }

    /**
     * Set the tracks element reference
     * 
     * @param element - The tracks container element
     */
    public setTracksElement(element: HTMLElement | null): void {
        this.tracksEl = element;
    }

    /**
     * Toggle keyframe at the specified layer and frame
     * 
     * @param layerIdx - Layer index
     * @param frame - Frame number
     */
    public toggleKeyframe(layerIdx: number, frame: number): void {
        const state = this.stateManager.getState();
        const keyframes = { ...state.keyframes };
        
        if (!keyframes[layerIdx]) keyframes[layerIdx] = new Set();
        
        if (keyframes[layerIdx].has(frame)) {
            keyframes[layerIdx].delete(frame);
            this.eventManager.emit('keyframeChange', { type: 'removed', layerIdx, frame });
        } else {
            keyframes[layerIdx].add(frame);
            this.eventManager.emit('keyframeChange', { type: 'added', layerIdx, frame });
        }
        
        this.stateManager.updateKeyframes(keyframes);
    }

    /**
     * Render track frames with keyframe indicators
     * 
     * @param layerIdx - Layer index
     * @param frameCount - Total number of frames
     * @returns HTML string with rendered frames
     */
    public renderTrackFrames(layerIdx: number, frameCount: number): string {
        const state = this.stateManager.getState();
        let html = '';
        const keyframes = state.keyframes[layerIdx] || new Set();
        
        for (let i = 1; i <= frameCount; i++) {
            const selected = state.playhead && state.playhead.layerIdx === layerIdx && state.playhead.frame === i;
            const isKeyframe = keyframes.has(i);
            
            html += `<div class="timeline-grid__frame-cell${selected ? ' selected' : ''}${isKeyframe ? ' keyframe' : ''}" data-frame="${i}" data-layer-idx="${layerIdx}" style="left:${(i-1)*this.frameWidth}px;width:${this.frameWidth}px">
                ${isKeyframe ? '<span class=\'timeline-grid__keyframe-dot\'></span>' : ''}
            </div>`;
        }
        
        return html;
    }

    /**
     * Attach frame selection and keyframe toggling event handlers
     */
    public attachFrameSelection(): void {
        if (!this.tracksEl) return;
        
        // Remove any existing click handlers before attaching a new one
        const newTracksEl = this.tracksEl.cloneNode(true) as HTMLElement;
        if (this.tracksEl.parentNode) {
            this.tracksEl.parentNode.replaceChild(newTracksEl, this.tracksEl);
        }
        this.tracksEl = newTracksEl;
        
        this.tracksEl.addEventListener('click', (e) => {
            console.log('Frame cell clicked:', e.target);
            const target = e.target as HTMLElement;
            
            // Check for clicks directly on frame cells or their children
            const frameCell = target.closest('.timeline-grid__frame-cell');
            if (frameCell) {
                const frame = parseInt(frameCell.getAttribute('data-frame') || '0', 10);
                const layerIdx = parseInt(frameCell.getAttribute('data-layer-idx') || '0', 10);
                
                console.log('Frame cell handler - Frame:', frame, 'Layer:', layerIdx);
                
                if (e.shiftKey) {
                    // Toggle keyframe
                    this.toggleKeyframe(layerIdx, frame);
                } else {                    // First, remove 'selected' class from all frame cells and 'active' from all track rows
                    if (this.tracksEl) {
                        const allFrames = this.tracksEl.querySelectorAll('.timeline-grid__frame-cell');
                        Array.from(allFrames).forEach((frame) => frame.classList.remove('selected'));
                        
                        const allTracks = this.tracksEl.querySelectorAll('.timeline-grid__track-row');
                        Array.from(allTracks).forEach((track) => track.classList.remove('active'));
                        
                        // Add 'selected' class to the clicked frame immediately
                        frameCell.classList.add('selected');
                        
                        // Find and add 'active' class to the parent track row
                        const trackRow = frameCell.closest('.timeline-grid__track-row');
                        if (trackRow) {
                            trackRow.classList.add('active');
                        }
                    }
                    
                    // Update the state
                    this.stateManager.updatePlayhead({ layerIdx, frame });
                }
            }
        });
    }

    /**
     * Update the frame width
     * 
     * @param frameWidth - New frame width
     */
    public setFrameWidth(frameWidth: number): void {
        this.frameWidth = frameWidth;
    }
}
