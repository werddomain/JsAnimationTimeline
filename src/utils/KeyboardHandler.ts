import { EventEmitter } from '../core/EventEmitter';
import { DataModel, KeyframeType, TweenType } from '../core/DataModel';
import { Events } from '../constants/Constants';

/**
 * KeyboardHandler manages keyboard shortcuts for the timeline
 */
export class KeyboardHandler {
    private eventEmitter: EventEmitter;
    private dataModel: DataModel;
    private timelineElement: HTMLElement;
    private isEnabled: boolean = true;

    /**
     * Create a new KeyboardHandler
     * @param options - Configuration options
     */
    constructor(options: { 
        eventEmitter: EventEmitter;
        dataModel: DataModel;
        timelineElement: HTMLElement;
    }) {
        this.eventEmitter = options.eventEmitter;
        this.dataModel = options.dataModel;
        this.timelineElement = options.timelineElement;
        
        this.initKeyboardEvents();
    }

    /**
     * Initialize keyboard event listeners
     */
    private initKeyboardEvents(): void {
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        // Listen for timeline focus/blur events to enable/disable shortcuts
        this.timelineElement.addEventListener('focus', () => {
            this.isEnabled = true;
        }, true);
        
        this.timelineElement.addEventListener('blur', () => {
            this.isEnabled = false;
        }, true);
    }
    
    /**
     * Handle keydown events
     * @param event - Keyboard event
     */
    private handleKeyDown(event: KeyboardEvent): void {
        // Only handle shortcuts when the timeline has focus
        if (!this.isEnabled && 
            !this.timelineElement.contains(document.activeElement as Node) && 
            document.activeElement !== document.body) {
            return;
        }

        // Prevent default action for these keys when timeline has focus
        if (['F6', 'Space', 'ArrowLeft', 'ArrowRight', 'K', 'T', 'Delete', 'Backspace'].includes(event.key)) {
            event.preventDefault();
        }

        // Process keyboard shortcuts
        switch (event.key) {
            case 'F6':
                this.handleAddKeyframe(event.shiftKey);
                break;
            case 'k':
            case 'K':
                this.handleAddKeyframe(event.shiftKey);
                break;
            case 't':
            case 'T':
                this.handleCreateTween(event.shiftKey ? TweenType.SHAPE : TweenType.MOTION);
                break;
            case ' ':
            case 'Space':
                this.togglePlayback();
                break;
            case 'ArrowLeft':
                this.stepBackward(event.shiftKey, event.ctrlKey);
                break;
            case 'ArrowRight':
                this.stepForward(event.shiftKey, event.ctrlKey);
                break;
            case 'Delete':
            case 'Backspace':
                this.deleteSelectedItems();
                break;
        }
    }
    
    /**
     * Handle adding a keyframe at the current time
     * @param isHollow - Whether to create a hollow keyframe
     */
    private handleAddKeyframe(isHollow: boolean = false): void {
        const selectedLayerIds = this.dataModel.getSelectedLayerIds();
        const currentTime = this.dataModel.getCurrentTime();
        
        if (selectedLayerIds.length === 0) {
            console.warn('No layer selected for keyframe addition');
            return;
        }
        
        // Add a keyframe to each selected layer
        selectedLayerIds.forEach(layerId => {
            const keyframeId = `keyframe-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
            const keyframe = {
                id: keyframeId,
                time: currentTime,
                value: {}, // Default value
                type: isHollow ? KeyframeType.HOLLOW : KeyframeType.SOLID
            };
            
            this.dataModel.addKeyframe(layerId, keyframe);
        });
        
        // Emit event for keyframe added
        this.eventEmitter.emit(Events.KEYFRAME_ADDED, {
            time: currentTime,
            type: isHollow ? KeyframeType.HOLLOW : KeyframeType.SOLID
        });
    }
    
    /**
     * Handle creating a tween between selected keyframes
     * @param tweenType - Type of tween to create
     */
    private handleCreateTween(tweenType: TweenType): void {
        const selectedLayerIds = this.dataModel.getSelectedLayerIds();
        
        if (selectedLayerIds.length !== 1) {
            console.warn('Please select exactly one layer for tween creation');
            return;
        }
        
        const layerId = selectedLayerIds[0];
        const selectedKeyframeIds = this.dataModel.getSelectedKeyframeIds(layerId);
        
        if (selectedKeyframeIds.length !== 2) {
            console.warn('Please select exactly two keyframes for tween creation');
            return;
        }
        
        // Get the keyframes and sort them by time
        const keyframe1 = this.dataModel.getKeyframe(layerId, selectedKeyframeIds[0]);
        const keyframe2 = this.dataModel.getKeyframe(layerId, selectedKeyframeIds[1]);
        
        if (!keyframe1 || !keyframe2) {
            console.error('Failed to get selected keyframes');
            return;
        }
        
        // Sort keyframes by time
        const [startKeyframe, endKeyframe] = keyframe1.time < keyframe2.time ? 
            [keyframe1, keyframe2] : [keyframe2, keyframe1];
        
        // Create tween object
        const tweenId = `tween-${Date.now()}`;
        const tween = {
            id: tweenId,
            startKeyframeId: startKeyframe.id,
            endKeyframeId: endKeyframe.id,
            type: tweenType,
            properties: [] // Empty array for properties being tweened
        };
        
        // Update the start keyframe with the tween
        this.dataModel.updateKeyframe(layerId, startKeyframe.id, {
            ...startKeyframe,
            nextTween: tween
        });
          // Emit event for tween created
        this.eventEmitter.emit(Events.TWEEN_ADDED, {
            tweenId: tweenId,
            layerId: layerId,
            startKeyframeId: startKeyframe.id,
            endKeyframeId: endKeyframe.id,
            tweenType: tweenType
        });
    }
    
    /**
     * Toggle playback state (play/pause)
     */
    private togglePlayback(): void {
        this.eventEmitter.emit(Events.TOGGLE_PLAYBACK, {}, null);
    }
    
    /**
     * Step backward one frame
     * @param shiftKey - If shift is pressed, move 5 frames
     * @param ctrlKey - If ctrl is pressed, move to previous keyframe
     */
    private stepBackward(shiftKey: boolean = false, ctrlKey: boolean = false): void {
        const currentTime = this.dataModel.getCurrentTime();
        const fps = this.dataModel.getFps();
        let newTime: number;
        
        if (ctrlKey) {
            // Find the previous keyframe time
            const prevKeyframeTime = this.findPreviousKeyframeTime(currentTime);
            newTime = prevKeyframeTime !== null ? prevKeyframeTime : 0;
        } else {
            // Calculate step size based on shift key (1 or 5 frames)
            const frameCount = shiftKey ? 5 : 1;
            const frameDuration = 1 / fps;
            newTime = Math.max(0, currentTime - (frameDuration * frameCount));
        }
        
        this.dataModel.setCurrentTime(newTime);
        this.eventEmitter.emit(Events.SEEK, { time: newTime }, null);
    }
    
    /**
     * Step forward one frame
     * @param shiftKey - If shift is pressed, move 5 frames
     * @param ctrlKey - If ctrl is pressed, move to next keyframe
     */
    private stepForward(shiftKey: boolean = false, ctrlKey: boolean = false): void {
        const currentTime = this.dataModel.getCurrentTime();
        const duration = this.dataModel.getDuration();
        const fps = this.dataModel.getFps();
        let newTime: number;
        
        if (ctrlKey) {
            // Find the next keyframe time
            const nextKeyframeTime = this.findNextKeyframeTime(currentTime);
            newTime = nextKeyframeTime !== null ? nextKeyframeTime : duration;
        } else {
            // Calculate step size based on shift key (1 or 5 frames)
            const frameCount = shiftKey ? 5 : 1;
            const frameDuration = 1 / fps;
            newTime = Math.min(duration, currentTime + (frameDuration * frameCount));
        }
        
        this.dataModel.setCurrentTime(newTime);
        this.eventEmitter.emit(Events.SEEK, { time: newTime }, null);
    }
    
    /**
     * Find the time of the previous keyframe
     * @param currentTime - Current timeline position
     * @returns Previous keyframe time or null if none
     */
    private findPreviousKeyframeTime(currentTime: number): number | null {
        const selectedLayerIds = this.dataModel.getSelectedLayerIds();
        if (selectedLayerIds.length === 0) return null;
        
        let prevTime: number | null = null;        // Search through selected layer keyframes
        for (const layerId of selectedLayerIds) {
            const keyframesRecord = this.dataModel.getKeyframes(layerId);
            const keyframes = this.getKeyframesArray(keyframesRecord || {});
            
            for (const keyframe of keyframes) {
                if (keyframe.time < currentTime && (prevTime === null || keyframe.time > prevTime)) {
                    prevTime = keyframe.time;
                }
            }
        }
        
        return prevTime;
    }
    
    /**
     * Find the time of the next keyframe
     * @param currentTime - Current timeline position
     * @returns Next keyframe time or null if none
     */
    private findNextKeyframeTime(currentTime: number): number | null {
        const selectedLayerIds = this.dataModel.getSelectedLayerIds();
        if (selectedLayerIds.length === 0) return null;
        
        let nextTime: number | null = null;
          // Search through selected layer keyframes
        for (const layerId of selectedLayerIds) {
            const keyframesRecord = this.dataModel.getKeyframes(layerId);
            const keyframes = this.getKeyframesArray(keyframesRecord || {});
            
            for (const keyframe of keyframes) {
                if (keyframe.time > currentTime && (nextTime === null || keyframe.time < nextTime)) {
                    nextTime = keyframe.time;
                }
            }
        }
        
        return nextTime;
    }
    
    /**
     * Delete selected keyframes or tweens
     */
    private deleteSelectedItems(): void {
        const selectedLayerIds = this.dataModel.getSelectedLayerIds();
        
        for (const layerId of selectedLayerIds) {
            const selectedKeyframeIds = this.dataModel.getSelectedKeyframeIds(layerId);
            
            // Delete selected keyframes
            for (const keyframeId of selectedKeyframeIds) {
                this.dataModel.removeKeyframe(layerId, keyframeId);
            }
              // Emit individual keyframe removed events
            for (const keyframeId of selectedKeyframeIds) {
                this.eventEmitter.emit(Events.KEYFRAME_REMOVED, {
                    layerId: layerId,
                    keyframeId: keyframeId,
                    time: 0, // We don't have the time info here since the keyframe is already deleted
                    value: null
                });
            }
        }
    }
    
    /**
     * Convert a Record<string, IKeyframe> to an array of IKeyframe
     * @param keyframesRecord - The record to convert
     * @returns Array of keyframes
     */
    private getKeyframesArray(keyframesRecord: Record<string, any> | null): any[] {
        if (!keyframesRecord) return [];
        return Object.values(keyframesRecord);
    }
    
    /**
     * Cleanup and remove event listeners
     */
    public destroy(): void {
        document.removeEventListener('keydown', this.handleKeyDown.bind(this));
        
        this.timelineElement.removeEventListener('focus', () => {
            this.isEnabled = true;
        }, true);
        
        this.timelineElement.removeEventListener('blur', () => {
            this.isEnabled = false;
        }, true);
    }
}
