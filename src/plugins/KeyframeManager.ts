/**
 * KeyframeManager plugin
 * Handles keyframe creation, selection, movement, and tweens
 */

import { BaseComponent } from '../components/BaseComponent';
import { EventEmitter } from '../core/EventEmitter';
import { DataModel, ILayer, IKeyframe, KeyframeType, TweenType } from '../core/DataModel';
import { Events, CssClasses } from '../constants/Constants';

export interface IKeyframeManagerOptions {
    container: HTMLElement;
    dataModel: DataModel;
    eventEmitter: EventEmitter;
    timelineControl?: any; // Reference to TimelineControl
}

export class KeyframeManager extends BaseComponent {
    private dataModel: DataModel;
    private eventEmitter: EventEmitter;
    private timelineControl: any; // Reference to TimelineControl
    private dragKeyframe: {
        layerId: string;
        keyframeId: string;
        startX: number;
        startTime: number;
    } | null = null;
    private timeScale: number;
    
    /**
     * Constructor for KeyframeManager
     * @param options - Configuration options
     */    constructor(options: IKeyframeManagerOptions) {
        super(options.container, 'timeline-keyframes-manager');
        
        this.dataModel = options.dataModel;
        this.eventEmitter = options.eventEmitter;
        this.timelineControl = options.timelineControl;
        this.timeScale = this.dataModel.getTimeScale();
    }
    
    /**
     * Initialize the KeyframeManager component
     */
    public initialize(): void {
        // Set up event listeners
        this.eventEmitter.on(Events.LAYER_ADDED, this.handleLayerAdded.bind(this));
        this.eventEmitter.on(Events.LAYER_REMOVED, this.handleLayerRemoved.bind(this));
        this.eventEmitter.on(Events.LAYER_MOVED, this.handleLayerMoved.bind(this));
        this.eventEmitter.on(Events.KEYFRAME_ADDED, this.handleKeyframeAdded.bind(this));
        this.eventEmitter.on(Events.KEYFRAME_REMOVED, this.handleKeyframeRemoved.bind(this));
        this.eventEmitter.on(Events.KEYFRAME_UPDATED, this.handleKeyframeUpdated.bind(this));
        this.eventEmitter.on(Events.KEYFRAME_MOVED, this.handleKeyframeMoved.bind(this));
        this.eventEmitter.on(Events.KEYFRAME_SELECTED, this.handleKeyframeSelected.bind(this));
        this.eventEmitter.on(Events.KEYFRAME_DESELECTED, this.handleKeyframeDeselected.bind(this));
        this.eventEmitter.on(Events.SCALE_CHANGED, this.handleScaleChanged.bind(this));
        
        // Set up stage synchronization
        this.setupStageSynchronization();
    }
    
    /**
     * Render the KeyframeManager component
     * @returns HTML string representation
     */
    public render(): string {
        const layers = this.dataModel.getLayers();
        const layersArray = Object.values(layers).sort((a, b) => a.order - b.order);
        
        return `
            <div class="timeline-keyframes-manager">
                ${layersArray.map(layer => this.renderKeyframeRow(layer)).join('')}
            </div>
        `;
    }
    
    /**
     * Update the KeyframeManager component
     * @param data - New data for the component
     */
    public update(data?: any): void {
        if (!this.element) return;
        
        // Re-render the entire keyframes area
        this.element.innerHTML = this.render();
        
        // Set up event listeners for keyframe elements
        this.setupKeyframeEventListeners();
    }
    
    /**
     * Destroy the KeyframeManager component and clean up resources
     */
    public destroy(): void {
        // Remove event listeners
        this.eventEmitter.off(Events.LAYER_ADDED, this.handleLayerAdded.bind(this));
        this.eventEmitter.off(Events.LAYER_REMOVED, this.handleLayerRemoved.bind(this));
        this.eventEmitter.off(Events.LAYER_MOVED, this.handleLayerMoved.bind(this));
        this.eventEmitter.off(Events.KEYFRAME_ADDED, this.handleKeyframeAdded.bind(this));
        this.eventEmitter.off(Events.KEYFRAME_REMOVED, this.handleKeyframeRemoved.bind(this));
        this.eventEmitter.off(Events.KEYFRAME_UPDATED, this.handleKeyframeUpdated.bind(this));
        this.eventEmitter.off(Events.KEYFRAME_MOVED, this.handleKeyframeMoved.bind(this));
        this.eventEmitter.off(Events.KEYFRAME_SELECTED, this.handleKeyframeSelected.bind(this));
        this.eventEmitter.off(Events.KEYFRAME_DESELECTED, this.handleKeyframeDeselected.bind(this));
        this.eventEmitter.off(Events.SCALE_CHANGED, this.handleScaleChanged.bind(this));
    }
    
    /**
     * Render a keyframe row for a layer
     * @param layer - Layer to render keyframes for
     * @returns HTML string representation of the keyframe row
     */
    private renderKeyframeRow(layer: ILayer): string {
        const selectedClass = this.dataModel.getSelectedLayerIds().includes(layer.id) ? 
            CssClasses.KEYFRAME_ROW + ' ' + CssClasses.LAYER_SELECTED : CssClasses.KEYFRAME_ROW;
        
        return `
            <div class="${selectedClass}" data-layer-id="${layer.id}">
                ${this.renderKeyframes(layer)}
                ${this.renderTweens(layer)}
            </div>
        `;
    }
      /**
     * Render keyframes for a layer
     * @param layer - Layer to render keyframes for
     * @returns HTML string representation of keyframes
     */
    private renderKeyframes(layer: ILayer): string {
        const keyframes = Object.values(layer.keyframes);
        
        // First render the frame grid
        const frameGrid = this.renderFrameGrid(layer);
        
        // Then render the keyframes
        const keyframeElements = keyframes.map(keyframe => {
            const position = keyframe.time * this.timeScale;
            const selected = this.isKeyframeSelected(layer.id, keyframe.id);
            
            // Determine CSS classes based on keyframe type and selection
            let cssClasses = CssClasses.KEYFRAME;
            if (selected) cssClasses += ` ${CssClasses.KEYFRAME_SELECTED}`;
            
            // Add class based on keyframe type
            if (keyframe.type === KeyframeType.SOLID) {
                cssClasses += ` ${CssClasses.KEYFRAME_SOLID}`;
            } else if (keyframe.type === KeyframeType.HOLLOW) {
                cssClasses += ` ${CssClasses.KEYFRAME_HOLLOW}`;
            }
            
            return `
                <div class="${cssClasses}" 
                    data-layer-id="${layer.id}" 
                    data-keyframe-id="${keyframe.id}" 
                    data-time="${keyframe.time}"
                    data-type="${keyframe.type}"
                    style="left: ${position}px;">
                </div>
            `;
        }).join('');
        
        return frameGrid + keyframeElements;
    }
    
    /**
     * Render the frame grid for a layer
     * @param layer - Layer to render frame grid for
     * @returns HTML string representation of the frame grid
     */
    private renderFrameGrid(layer: ILayer): string {
        const duration = this.dataModel.getDuration();
        const fps = this.dataModel.getFps();
        const totalFrames = Math.ceil(duration * fps);
        
        // Sort keyframes by time
        const keyframes = Object.values(layer.keyframes).sort((a, b) => a.time - b.time);
        
        let gridHTML = '<div class="' + CssClasses.FRAME_GRID + '">';
        
        // Create frame placeholders for each frame
        for (let i = 0; i < totalFrames; i++) {
            const frameTime = i / fps;
            const position = frameTime * this.timeScale;
            
            // Determine if this is a standard frame or an empty frame
            let frameClass = CssClasses.FRAME_STANDARD;
            
            // Find the keyframe that affects this frame
            const activeKeyframe = this.findActiveKeyframeForTime(keyframes, frameTime);
            if (!activeKeyframe) {
                frameClass = CssClasses.FRAME_EMPTY;
            }
            
            gridHTML += `
                <div class="${frameClass}" 
                    data-layer-id="${layer.id}" 
                    data-frame="${i}"
                    data-time="${frameTime}"
                    style="left: ${position}px;">
                </div>
            `;
        }
        
        gridHTML += '</div>';
        return gridHTML;
    }
    
    /**
     * Find the keyframe that is active at a given time
     * @param keyframes - Sorted array of keyframes
     * @param time - Time to check
     * @returns The active keyframe or undefined if none is active
     */
    private findActiveKeyframeForTime(keyframes: IKeyframe[], time: number): IKeyframe | undefined {
        // Find the latest keyframe that is before or at the given time
        for (let i = keyframes.length - 1; i >= 0; i--) {
            if (keyframes[i].time <= time) {
                return keyframes[i];
            }
        }
        return undefined;
    }
      /**
     * Render tweens between keyframes for a layer
     * @param layer - Layer to render tweens for
     * @returns HTML string representation of tweens
     */
    private renderTweens(layer: ILayer): string {
        const keyframes = Object.values(layer.keyframes).sort((a, b) => a.time - b.time);
        const tweens = [];
        
        // Look for keyframes that have a nextTween property
        for (const keyframe of keyframes) {
            if (keyframe.nextTween) {
                const tween = keyframe.nextTween;
                const endKeyframe = this.findKeyframeById(tween.endKeyframeId);
                
                if (endKeyframe) {
                    const startPosition = keyframe.time * this.timeScale;
                    const endPosition = endKeyframe.time * this.timeScale;
                    const width = endPosition - startPosition;
                    
                    // Add tween type as a CSS class
                    let tweenClass = CssClasses.TWEEN;
                    if (tween.type === TweenType.MOTION) {
                        tweenClass += ` ${CssClasses.TWEEN_MOTION}`;
                    } else if (tween.type === TweenType.SHAPE) {
                        tweenClass += ` ${CssClasses.TWEEN_SHAPE}`;
                    }
                    
                    tweens.push(`
                        <div class="${tweenClass}" 
                            data-layer-id="${layer.id}"
                            data-tween-id="${tween.id}"
                            data-start-id="${tween.startKeyframeId}"
                            data-end-id="${tween.endKeyframeId}"
                            data-tween-type="${tween.type}"
                            style="left: ${startPosition}px; width: ${width}px;">
                        </div>
                    `);
                }
            }
        }
        
        return tweens.join('');
    }
    
    /**
     * Find a keyframe by ID in any layer
     * @param keyframeId - Keyframe ID to find
     * @returns The keyframe if found, undefined otherwise
     */
    private findKeyframeById(keyframeId: string): IKeyframe | undefined {
        const layers = this.dataModel.getLayers();
        
        for (const layerId in layers) {
            const keyframe = layers[layerId].keyframes[keyframeId];
            if (keyframe) {
                return keyframe;
            }
        }
        
        return undefined;
    }    /**
     * Set up event listeners for keyframe elements
     */
    private setupKeyframeEventListeners(): void {
        if (!this.element) return;
        
        // Add click handler for keyframe rows (layer selection and keyframe creation)
        const keyframeRows = this.element.querySelectorAll(`.${CssClasses.KEYFRAME_ROW}`);
        keyframeRows.forEach(row => {
            row.addEventListener('click', this.handleRowClick);
        });
        
        // Add click handler for standard and empty frames (seek playhead)
        const frameElements = this.element.querySelectorAll(`.${CssClasses.FRAME_STANDARD}, .${CssClasses.FRAME_EMPTY}`);
        frameElements.forEach(frameEl => {
            frameEl.addEventListener('click', this.handleFrameClick);
        });
        
        // Add click handler for keyframes (keyframe selection)
        const keyframeElements = this.element.querySelectorAll(`.${CssClasses.KEYFRAME}`);
        keyframeElements.forEach(keyframeEl => {
            keyframeEl.addEventListener('click', this.handleKeyframeClick);
            keyframeEl.addEventListener('mousedown', this.handleKeyframeMouseDown);
        });
        
        // Add click handler for tweens (tween selection)
        const tweenElements = this.element.querySelectorAll(`.${CssClasses.TWEEN}`);
        tweenElements.forEach(tweenEl => {
            tweenEl.addEventListener('click', this.handleTweenClick);
        });
        
        // Global mouse events for drag and drop
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
        
        // Add context menu handler for keyframes
        const keyframeElementsForContextMenu = this.element.querySelectorAll(`.${CssClasses.KEYFRAME}`);
        keyframeElementsForContextMenu.forEach(keyframeEl => {
            keyframeEl.addEventListener('contextmenu', this.handleKeyframeContextMenu);
        });
    }
      /**
     * Handle click on keyframe row
     */
    private handleRowClick = (event: Event): void => {
        // Ignore if clicking on a keyframe, frame, or tween
        const target = event.target as HTMLElement;
        if (target.classList.contains(CssClasses.KEYFRAME) || 
            target.classList.contains(CssClasses.FRAME_STANDARD) || 
            target.classList.contains(CssClasses.FRAME_EMPTY) || 
            target.classList.contains(CssClasses.TWEEN)) {
            return;
        }
        
        const row = event.currentTarget as HTMLElement;
        if (!row) return;
        
        const layerId = row.getAttribute('data-layer-id');
        if (!layerId) return;
        
        // Get layer
        const layer = this.dataModel.getLayer(layerId);
        if (!layer) return;
        
        // Clicked on a row to create a new keyframe
        const rect = row.getBoundingClientRect();
        const scrollLeft = this.element?.parentElement?.scrollLeft || 0;
        const clickX = (event as MouseEvent).clientX - rect.left + scrollLeft;
        
        // Convert position to time
        const time = clickX / this.timeScale;
        
        // Check if Alt/Option key is pressed to create an empty keyframe
        const isAltPressed = (event as MouseEvent).altKey;
        const keyframeType = isAltPressed ? KeyframeType.HOLLOW : KeyframeType.SOLID;
        
        // Create keyframe at this time with the appropriate type
        this.createKeyframe(layerId, time, keyframeType);
        
        // Stop event propagation
        event.stopPropagation();
    }
    
    /**
     * Handle click on keyframe
     */
    private handleKeyframeClick = (event: Event): void => {
        const keyframeEl = event.currentTarget as HTMLElement;
        if (!keyframeEl) return;
        
        const layerId = keyframeEl.getAttribute('data-layer-id');
        const keyframeId = keyframeEl.getAttribute('data-keyframe-id');
        
        if (!layerId || !keyframeId) return;
        
        // Check if we should add to selection (with Ctrl key)
        const isMultiSelect = (event as MouseEvent).ctrlKey;
        
        if (isMultiSelect) {
            // Toggle selection
            if (this.isKeyframeSelected(layerId, keyframeId)) {
                this.dataModel.deselectKeyframe(layerId, keyframeId);
            } else {
                this.dataModel.selectKeyframe(layerId, keyframeId);
            }
        } else {
            // Clear previous selections
            this.clearAllKeyframeSelections();
            
            // Select this keyframe
            this.dataModel.selectKeyframe(layerId, keyframeId);
        }
        
        // Stop event propagation
        event.stopPropagation();
    }
    
    /**
     * Handle mousedown on keyframe
     */
    private handleKeyframeMouseDown = (event: Event): void => {
        const mouseEvent = event as MouseEvent;
        const keyframeEl = mouseEvent.currentTarget as HTMLElement;
        if (!keyframeEl) return;
        
        const layerId = keyframeEl.getAttribute('data-layer-id');
        const keyframeId = keyframeEl.getAttribute('data-keyframe-id');
        const timeStr = keyframeEl.getAttribute('data-time');
        
        if (!layerId || !keyframeId || !timeStr) return;
        
        const time = parseFloat(timeStr);
        
        // Start drag operation
        this.dragKeyframe = {
            layerId,
            keyframeId,
            startX: mouseEvent.clientX,
            startTime: time
        };
        
        keyframeEl.classList.add('dragging');
        
        // If the keyframe isn't selected, select it
        if (!this.isKeyframeSelected(layerId, keyframeId)) {
            this.clearAllKeyframeSelections();
            this.dataModel.selectKeyframe(layerId, keyframeId);
        }
        
        // Stop event propagation
        event.stopPropagation();
    }
    
    /**
     * Handle mouse move during keyframe drag
     */
    private handleMouseMove = (event: Event): void => {
        const mouseEvent = event as MouseEvent;
        if (!this.dragKeyframe) return;
        
        // Calculate the drag delta in pixels
        const deltaX = mouseEvent.clientX - this.dragKeyframe.startX;
        
        // Convert pixel delta to time delta
        const deltaTime = deltaX / this.timeScale;
        
        // Calculate new time
        const newTime = Math.max(0, this.dragKeyframe.startTime + deltaTime);
        
        // If we're dragging multiple keyframes, move them all
        const selectedKeyframes = this.getSelectedKeyframesForLayer(this.dragKeyframe.layerId);
        
        if (selectedKeyframes.length > 1) {
            // Move all selected keyframes
            selectedKeyframes.forEach(keyframeId => {
                const keyframe = this.dataModel.getKeyframe(this.dragKeyframe!.layerId, keyframeId);
                if (keyframe && keyframeId !== this.dragKeyframe!.keyframeId) {
                    const originalTime = keyframe.time;
                    const newKeyframeTime = Math.max(0, originalTime + deltaTime);
                    
                    // Update the keyframe element's position
                    const keyframeEl = this.element?.querySelector(
                        `.${CssClasses.KEYFRAME}[data-layer-id="${this.dragKeyframe!.layerId}"][data-keyframe-id="${keyframeId}"]`
                    ) as HTMLElement;
                    
                    if (keyframeEl) {
                        const newPosition = newKeyframeTime * this.timeScale;
                        keyframeEl.style.left = `${newPosition}px`;
                    }
                }
            });
        }
        
        // Update the dragged keyframe's position
        const keyframeEl = this.element?.querySelector(
            `.${CssClasses.KEYFRAME}[data-layer-id="${this.dragKeyframe.layerId}"][data-keyframe-id="${this.dragKeyframe.keyframeId}"]`
        ) as HTMLElement;
        
        if (keyframeEl) {
            const newPosition = newTime * this.timeScale;
            keyframeEl.style.left = `${newPosition}px`;
        }
        
        // Update tweens
        this.updateTweensForLayer(this.dragKeyframe.layerId);
    }
    
    /**
     * Handle mouse up after keyframe drag
     */
    private handleMouseUp = (event: Event): void => {
        const mouseEvent = event as MouseEvent;
        if (!this.dragKeyframe) return;
        
        // Calculate the final drag delta in pixels
        const deltaX = mouseEvent.clientX - this.dragKeyframe.startX;
        
        // Convert pixel delta to time delta
        const deltaTime = deltaX / this.timeScale;
        
        // Calculate final time
        const finalTime = Math.max(0, this.dragKeyframe.startTime + deltaTime);
        
        // If we're dragging multiple keyframes, move them all
        const selectedKeyframes = this.getSelectedKeyframesForLayer(this.dragKeyframe.layerId);
        
        if (selectedKeyframes.length > 1) {
            // Move all selected keyframes
            selectedKeyframes.forEach(keyframeId => {
                const keyframe = this.dataModel.getKeyframe(this.dragKeyframe!.layerId, keyframeId);
                if (keyframe && keyframeId !== this.dragKeyframe!.keyframeId) {
                    const originalTime = keyframe.time;
                    const newKeyframeTime = Math.max(0, originalTime + deltaTime);
                    this.dataModel.moveKeyframe(this.dragKeyframe!.layerId, keyframeId, newKeyframeTime);
                }
            });
        }
        
        // Move the dragged keyframe
        this.dataModel.moveKeyframe(this.dragKeyframe.layerId, this.dragKeyframe.keyframeId, finalTime);
        
        // Clean up drag state
        const keyframeEl = this.element?.querySelector(`.${CssClasses.KEYFRAME}.dragging`) as HTMLElement;
        if (keyframeEl) {
            keyframeEl.classList.remove('dragging');
        }
        
        this.dragKeyframe = null;
    }
    
    /**
     * Create a new keyframe at the specified time
     * @param layerId - Layer ID
     * @param time - Time for the new keyframe
     */    private createKeyframe(layerId: string, time: number, type: KeyframeType = KeyframeType.SOLID): void {
        const keyframeId = `keyframe-${Date.now()}`;
          const newKeyframe: IKeyframe = {
            id: keyframeId,
            time,
            value: {}, // Default value
            type: type
        };
        
        this.dataModel.addKeyframe(layerId, newKeyframe);
    }
    
    /**
     * Check if a keyframe is selected
     * @param layerId - Layer ID
     * @param keyframeId - Keyframe ID
     * @returns True if selected, false otherwise
     */
    private isKeyframeSelected(layerId: string, keyframeId: string): boolean {
        const selectedKeyframes = this.dataModel.getSelectedKeyframeIds(layerId);
        return selectedKeyframes.includes(keyframeId);
    }
    
    /**
     * Get selected keyframes for a layer
     * @param layerId - Layer ID
     * @returns Array of selected keyframe IDs
     */
    private getSelectedKeyframesForLayer(layerId: string): string[] {
        return this.dataModel.getSelectedKeyframeIds(layerId);
    }
    
    /**
     * Clear all keyframe selections
     */
    private clearAllKeyframeSelections(): void {
        const layers = this.dataModel.getLayers();
        
        Object.keys(layers).forEach(layerId => {
            const selectedKeyframes = this.dataModel.getSelectedKeyframeIds(layerId);
            
            selectedKeyframes.forEach(keyframeId => {
                this.dataModel.deselectKeyframe(layerId, keyframeId);
            });
        });
    }
    
    /**
     * Update tweens for a layer
     * @param layerId - Layer ID
     */
    private updateTweensForLayer(layerId: string): void {
        if (!this.element) return;
        
        const layer = this.dataModel.getLayer(layerId);
        if (!layer) return;
        
        // Remove existing tweens
        const existingTweens = this.element.querySelectorAll(`.${CssClasses.TWEEN}[data-layer-id="${layerId}"]`);
        existingTweens.forEach(tween => tween.remove());
        
        // Get keyframes sorted by time
        const keyframes = Object.values(layer.keyframes).sort((a, b) => a.time - b.time);
        
        if (keyframes.length < 2) return;
        
        // Create new tweens
        const keyframeRow = this.element.querySelector(`.${CssClasses.KEYFRAME_ROW}[data-layer-id="${layerId}"]`);
        if (!keyframeRow) return;
        
        for (let i = 0; i < keyframes.length - 1; i++) {
            const startKeyframe = keyframes[i];
            const endKeyframe = keyframes[i + 1];
            
            const startPosition = startKeyframe.time * this.timeScale;
            const endPosition = endKeyframe.time * this.timeScale;
            const width = endPosition - startPosition;
            
            const tweenEl = document.createElement('div');
            tweenEl.className = CssClasses.TWEEN;
            
            // Use setAttribute instead of dataset for TypeScript compatibility
            tweenEl.setAttribute('data-layer-id', layerId);
            tweenEl.setAttribute('data-start-id', startKeyframe.id);
            tweenEl.setAttribute('data-end-id', endKeyframe.id);
            
            tweenEl.style.left = `${startPosition}px`;
            tweenEl.style.width = `${width}px`;
            
            keyframeRow.appendChild(tweenEl);
        }
    }
    
    /**
     * Handle layer added event
     * @param event - Layer added event
     */
    private handleLayerAdded(event: any): void {
        console.log('KeyframeManager: Layer added event received:', event.data);
        
        // Force a complete re-render of the keyframes area
        this.update();
        
        // Additional measure - explicitly check if the DOM was updated to include the new layer
        if (this.element) {
            const layerId = event.data.id;
            const existingRow = this.element.querySelector(`.${CssClasses.KEYFRAME_ROW}[data-layer-id="${layerId}"]`);
            
            if (!existingRow) {
                console.warn(`KeyframeManager: Row for new layer ${layerId} not found in DOM after update, forcing second update`);
                // If the DOM wasn't updated for some reason, force another update
                setTimeout(() => this.update(), 0);
            }
        }
    }
    
    /**
     * Handle layer removed event
     * @param event - Layer removed event
     */
    private handleLayerRemoved(event: any): void {
        this.update();
    }
    
    /**
     * Handle layer moved event
     * @param event - Layer moved event
     */
    private handleLayerMoved(event: any): void {
        this.update();
    }
    
    /**
     * Handle keyframe added event
     * @param event - Keyframe added event
     */
    private handleKeyframeAdded(event: any): void {
        const layerId = event.data.layerId;
        
        // Add the new keyframe to DOM
        const layer = this.dataModel.getLayer(layerId);
        const keyframe = this.dataModel.getKeyframe(layerId, event.data.keyframeId);
        
        if (!layer || !keyframe) {
            console.error(`Could not find layer or keyframe for event: ${JSON.stringify(event.data)}`);
            return;
        }
        
        // Do a full update to ensure the keyframe display is complete and accurate
        this.update();
    }
    
    /**
     * Handle keyframe removed event
     * @param event - Keyframe removed event
     */
    private handleKeyframeRemoved(event: any): void {
        const layerId = event.data.layerId;
        const keyframeId = event.data.keyframeId;
        
        // Remove the keyframe from DOM
        const keyframeEl = this.element?.querySelector(`.${CssClasses.KEYFRAME}[data-layer-id="${layerId}"][data-keyframe-id="${keyframeId}"]`);
        
        if (keyframeEl) {
            keyframeEl.remove();
            
            // Update tweens
            this.updateTweensForLayer(layerId);
        }
    }
    
    /**
     * Handle keyframe updated event
     * @param event - Keyframe updated event
     */
    private handleKeyframeUpdated(event: any): void {
        const layerId = event.data.layerId;
        const keyframeId = event.data.keyframeId;
        
        // Update the keyframe in DOM
        const keyframeEl = this.element?.querySelector(
            `.${CssClasses.KEYFRAME}[data-layer-id="${layerId}"][data-keyframe-id="${keyframeId}"]`
        ) as HTMLElement;
        
        if (keyframeEl) {
            const position = event.data.time * this.timeScale;
            keyframeEl.style.left = `${position}px`;
            keyframeEl.setAttribute('data-time', `${event.data.time}`);
            
            // Update tweens
            this.updateTweensForLayer(layerId);
        }
    }
    
    /**
     * Handle keyframe moved event
     * @param event - Keyframe moved event
     */
    private handleKeyframeMoved(event: any): void {
        const layerId = event.data.layerId;
        const keyframeId = event.data.keyframeId;
        
        // Update the keyframe in DOM
        const keyframeEl = this.element?.querySelector(
            `.${CssClasses.KEYFRAME}[data-layer-id="${layerId}"][data-keyframe-id="${keyframeId}"]`
        ) as HTMLElement;
        
        if (keyframeEl) {
            const position = event.data.newTime * this.timeScale;
            keyframeEl.style.left = `${position}px`;
            keyframeEl.setAttribute('data-time', `${event.data.newTime}`);
            
            // Update tweens
            this.updateTweensForLayer(layerId);
        }
    }
    
    /**
     * Handle keyframe selected event
     * @param event - Keyframe selected event
     */
    private handleKeyframeSelected(event: any): void {
        const layerId = event.data.layerId;
        const keyframeId = event.data.keyframeId;
        
        // Update the keyframe in DOM
        const keyframeEl = this.element?.querySelector(`.${CssClasses.KEYFRAME}[data-layer-id="${layerId}"][data-keyframe-id="${keyframeId}"]`);
        
        if (keyframeEl) {
            keyframeEl.classList.add(CssClasses.KEYFRAME_SELECTED);
        }
    }
    
    /**
     * Handle keyframe deselected event
     * @param event - Keyframe deselected event
     */
    private handleKeyframeDeselected(event: any): void {
        const layerId = event.data.layerId;
        const keyframeId = event.data.keyframeId;
        
        // Update the keyframe in DOM
        const keyframeEl = this.element?.querySelector(`.${CssClasses.KEYFRAME}[data-layer-id="${layerId}"][data-keyframe-id="${keyframeId}"]`);
        
        if (keyframeEl) {
            keyframeEl.classList.remove(CssClasses.KEYFRAME_SELECTED);
        }
    }
    
    /**
     * Handle scale changed event
     * @param event - Scale changed event
     */
    private handleScaleChanged(event: any): void {
        this.timeScale = event.data.scale;
        this.update();
    }
      /**
     * Handle click on a frame to seek the playhead
     */
    private handleFrameClick = (event: Event): void => {
        event.stopPropagation();
        
        const target = event.target as HTMLElement;
        const time = parseFloat(target.getAttribute('data-time') || '0');
        
        // Update current time and seek
        this.dataModel.setCurrentTime(time);
        this.eventEmitter.emit(Events.SEEK, { time }, this);
    }
    
    /**
     * Handle click on a tween
     */
    private handleTweenClick = (event: Event): void => {
        event.stopPropagation();
        
        const target = event.target as HTMLElement;
        const layerId = target.getAttribute('data-layer-id') || '';
        const tweenId = target.getAttribute('data-tween-id') || '';
        
        // For now, just select the layer
        this.dataModel.clearLayerSelection();
        this.dataModel.selectLayer(layerId);
        
        // Potentially add tween selection in the future
        console.log(`Tween clicked: ${tweenId}`);
    }
    
    /**
     * Set up stage and timeline synchronization
     */
    private setupStageSynchronization(): void {
        // Listen for stage element selection to update timeline
        this.eventEmitter.on(Events.STAGE_ELEMENT_SELECTED, this.handleStageElementSelected.bind(this));
        
        // We already have keyframe selection handled in handleKeyframeClick
    }
    
    /**
     * Handle stage element selection
     * @param event - Stage element selected event
     */
    private handleStageElementSelected = (event: any): void => {
        const elementId = event.data.elementId;
        if (!elementId) return;
        
        // Find the layer corresponding to this stage element
        const layers = this.dataModel.getLayers();
        let targetLayerId = null;
        
        // Find the layer that corresponds to this stage element
        // In a real implementation, you'd have a mapping between stage elements and layers
        // For this example, we'll assume the layer ID might contain the element ID
        for (const layerId in layers) {
            if (layerId.includes(elementId) || layers[layerId].name.includes(elementId)) {
                targetLayerId = layerId;
                break;
            }
        }
        
        if (targetLayerId) {
            // Clear previous layer selection
            this.dataModel.clearLayerSelection();
            
            // Select the layer
            this.dataModel.selectLayer(targetLayerId);
            
            // Highlight keyframes for this layer
            const keyframeEls = this.element?.querySelectorAll(
                `.${CssClasses.KEYFRAME}[data-layer-id="${targetLayerId}"]`
            );
            
            if (keyframeEls) {
                keyframeEls.forEach(keyframeEl => {
                    keyframeEl.classList.add('stage-selected');
                });
            }
            
            // Emit an event to notify other components about the selection
            this.eventEmitter.emit(Events.LAYER_SELECTED, { layerId: targetLayerId }, this);
        }
    }
    
    /**
     * Handle right-click on keyframe for context menu
     */
    private handleKeyframeContextMenu = (event: Event): void => {
        event.preventDefault();
        const contextEvent = event as MouseEvent;
        const keyframeEl = contextEvent.currentTarget as HTMLElement;
        
        if (!keyframeEl) return;
        
        const layerId = keyframeEl.getAttribute('data-layer-id');
        const keyframeId = keyframeEl.getAttribute('data-keyframe-id');
        const keyframeType = keyframeEl.getAttribute('data-type');
        
        if (!layerId || !keyframeId || !keyframeType) return;
        
        // Get keyframe
        const keyframe = this.dataModel.getKeyframe(layerId, keyframeId);
        if (!keyframe) return;
        
        // Get next and previous keyframes
        const layer = this.dataModel.getLayer(layerId);
        if (!layer) return;
        
        const keyframes = Object.values(layer.keyframes)
            .sort((a, b) => a.time - b.time);
        
        const keyframeIndex = keyframes.findIndex(k => k.id === keyframeId);
        const nextKeyframe = keyframeIndex < keyframes.length - 1 ? keyframes[keyframeIndex + 1] : null;
        
        // Create context menu
        const contextMenu = document.createElement('div');
        contextMenu.className = 'timeline-context-menu';
        contextMenu.style.position = 'absolute';
        contextMenu.style.left = `${contextEvent.clientX}px`;
        contextMenu.style.top = `${contextEvent.clientY}px`;
        contextMenu.style.zIndex = '1000';
        contextMenu.style.backgroundColor = '#fff';
        contextMenu.style.border = '1px solid #ccc';
        contextMenu.style.padding = '5px';
        contextMenu.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        
        // Add menu items
        if (nextKeyframe) {
            // Option to create motion tween
            const motionTweenOption = document.createElement('div');
            motionTweenOption.innerHTML = 'Create Motion Tween';
            motionTweenOption.style.padding = '5px 10px';
            motionTweenOption.style.cursor = 'pointer';
            motionTweenOption.addEventListener('mouseover', () => {
                motionTweenOption.style.backgroundColor = '#f0f0f0';
            });
            motionTweenOption.addEventListener('mouseout', () => {
                motionTweenOption.style.backgroundColor = 'transparent';
            });
            
            motionTweenOption.addEventListener('click', () => {
                this.createTween(layerId, keyframeId, nextKeyframe.id, TweenType.MOTION);
                document.body.removeChild(contextMenu);
            });
            
            contextMenu.appendChild(motionTweenOption);
            
            // Option to create shape tween
            const shapeTweenOption = document.createElement('div');
            shapeTweenOption.innerHTML = 'Create Shape Tween';
            shapeTweenOption.style.padding = '5px 10px';
            shapeTweenOption.style.cursor = 'pointer';
            shapeTweenOption.addEventListener('mouseover', () => {
                shapeTweenOption.style.backgroundColor = '#f0f0f0';
            });
            shapeTweenOption.addEventListener('mouseout', () => {
                shapeTweenOption.style.backgroundColor = 'transparent';
            });
            
            shapeTweenOption.addEventListener('click', () => {
                this.createTween(layerId, keyframeId, nextKeyframe.id, TweenType.SHAPE);
                document.body.removeChild(contextMenu);
            });
            
            contextMenu.appendChild(shapeTweenOption);
        }
        
        // Option to change keyframe type
        const toggleTypeOption = document.createElement('div');
        const newType = keyframe.type === KeyframeType.SOLID ? KeyframeType.HOLLOW : KeyframeType.SOLID;
        toggleTypeOption.innerHTML = `Change to ${newType === KeyframeType.SOLID ? 'Solid' : 'Hollow'} Keyframe`;
        toggleTypeOption.style.padding = '5px 10px';
        toggleTypeOption.style.cursor = 'pointer';
        toggleTypeOption.addEventListener('mouseover', () => {
            toggleTypeOption.style.backgroundColor = '#f0f0f0';
        });
        toggleTypeOption.addEventListener('mouseout', () => {
            toggleTypeOption.style.backgroundColor = 'transparent';
        });
        
        toggleTypeOption.addEventListener('click', () => {
            this.updateKeyframeType(layerId, keyframeId, newType);
            document.body.removeChild(contextMenu);
        });
        
        contextMenu.appendChild(toggleTypeOption);
        
        // Option to delete keyframe
        const deleteOption = document.createElement('div');
        deleteOption.innerHTML = 'Delete Keyframe';
        deleteOption.style.padding = '5px 10px';
        deleteOption.style.cursor = 'pointer';
        deleteOption.style.color = 'red';
        deleteOption.addEventListener('mouseover', () => {
            deleteOption.style.backgroundColor = '#f0f0f0';
        });
        deleteOption.addEventListener('mouseout', () => {
            deleteOption.style.backgroundColor = 'transparent';
        });
        
        deleteOption.addEventListener('click', () => {
            this.dataModel.removeKeyframe(layerId, keyframeId);
            document.body.removeChild(contextMenu);
        });
        
        contextMenu.appendChild(deleteOption);
        
        // Add menu to DOM
        document.body.appendChild(contextMenu);
        
        // Close menu when clicking elsewhere
        const closeContextMenu = () => {
            if (document.body.contains(contextMenu)) {
                document.body.removeChild(contextMenu);
            }
            document.removeEventListener('click', closeContextMenu);
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeContextMenu);
        }, 0);
    }
      /**
     * Create a tween between two keyframes
     */
    private createTween(layerId: string, startKeyframeId: string, endKeyframeId: string, tweenType: TweenType): void {
        // Get the keyframes
        const startKeyframe = this.dataModel.getKeyframe(layerId, startKeyframeId);
        const endKeyframe = this.dataModel.getKeyframe(layerId, endKeyframeId);
        
        if (!startKeyframe || !endKeyframe) {
            console.error('Could not find keyframes for tween creation');
            return;
        }
        
        // Create tween object
        const tweenId = `tween-${Date.now()}`;
        const tween = {
            id: tweenId,
            startKeyframeId,
            endKeyframeId,
            type: tweenType,
            properties: [] // Empty array for properties being tweened
        };
        
        // Update the start keyframe with the tween
        this.dataModel.updateKeyframe(layerId, startKeyframeId, {
            ...startKeyframe,
            nextTween: tween
        });
        
        // Force a re-render to show the new tween
        this.update();
    }
    
    /**
     * Update a keyframe's type
     */
    private updateKeyframeType(layerId: string, keyframeId: string, newType: KeyframeType): void {
        const keyframe = this.dataModel.getKeyframe(layerId, keyframeId);
        
        if (!keyframe) {
            console.error('Could not find keyframe for type update');
            return;
        }
        
        // Update the keyframe with the new type
        this.dataModel.updateKeyframe(layerId, keyframeId, {
            ...keyframe,
            type: newType
        });
        
        // Force a re-render to show the updated keyframe
        this.update();
    }
}
