/**
 * KeyframeManager plugin
 * Handles keyframe creation, selection, movement, and tweens
 */

import { BaseComponent } from '../components/BaseComponent';
import { EventEmitter } from '../core/EventEmitter';
import { DataModel, ILayer, IKeyframe } from '../core/DataModel';
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
        
        return keyframes.map(keyframe => {
            const position = keyframe.time * this.timeScale;
            const selectedClass = this.isKeyframeSelected(layer.id, keyframe.id) ? 
                CssClasses.KEYFRAME + ' ' + CssClasses.KEYFRAME_SELECTED : CssClasses.KEYFRAME;
            
            return `
                <div class="${selectedClass}" 
                    data-layer-id="${layer.id}" 
                    data-keyframe-id="${keyframe.id}" 
                    data-time="${keyframe.time}"
                    style="left: ${position}px;">
                </div>
            `;
        }).join('');
    }
    
    /**
     * Render tweens between keyframes for a layer
     * @param layer - Layer to render tweens for
     * @returns HTML string representation of tweens
     */
    private renderTweens(layer: ILayer): string {
        const keyframes = Object.values(layer.keyframes).sort((a, b) => a.time - b.time);
        
        if (keyframes.length < 2) return '';
        
        const tweens = [];
        
        for (let i = 0; i < keyframes.length - 1; i++) {
            const startKeyframe = keyframes[i];
            const endKeyframe = keyframes[i + 1];
            
            const startPosition = startKeyframe.time * this.timeScale;
            const endPosition = endKeyframe.time * this.timeScale;
            const width = endPosition - startPosition;
            
            tweens.push(`
                <div class="${CssClasses.TWEEN}" 
                    data-layer-id="${layer.id}"
                    data-start-id="${startKeyframe.id}"
                    data-end-id="${endKeyframe.id}"
                    style="left: ${startPosition}px; width: ${width}px;">
                </div>
            `);
        }
        
        return tweens.join('');
    }
    
    /**
     * Set up event listeners for keyframe elements
     */
    private setupKeyframeEventListeners(): void {
        if (!this.element) return;
        
        // Add click handler for keyframe rows (layer selection and keyframe creation)
        const keyframeRows = this.element.querySelectorAll(`.${CssClasses.KEYFRAME_ROW}`);
        keyframeRows.forEach(row => {
            row.addEventListener('click', this.handleRowClick);
        });
        
        // Add click handler for keyframes (keyframe selection)
        const keyframeElements = this.element.querySelectorAll(`.${CssClasses.KEYFRAME}`);
        keyframeElements.forEach(keyframeEl => {
            keyframeEl.addEventListener('click', this.handleKeyframeClick);
            keyframeEl.addEventListener('mousedown', this.handleKeyframeMouseDown);
        });
        
        // Global mouse events for drag and drop
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
    }
    
    /**
     * Handle click on keyframe row
     */
    private handleRowClick = (event: Event): void => {
        // Ignore if clicking on a keyframe
        if ((event.target as HTMLElement).classList.contains(CssClasses.KEYFRAME)) {
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
        
        // Create keyframe at this time
        this.createKeyframe(layerId, time);
        
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
     */
    private createKeyframe(layerId: string, time: number): void {
        const keyframeId = `keyframe-${Date.now()}`;
        
        const newKeyframe: IKeyframe = {
            id: keyframeId,
            time,
            value: {} // Default value
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
        this.update();
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
        
        if (layer && keyframe) {
            const keyframeRow = this.element?.querySelector(`.${CssClasses.KEYFRAME_ROW}[data-layer-id="${layerId}"]`);
            
            if (keyframeRow) {
                // Create new keyframe element
                const position = keyframe.time * this.timeScale;
                const keyframeEl = document.createElement('div');
                keyframeEl.className = CssClasses.KEYFRAME;
                
                // Use setAttribute instead of dataset for TypeScript compatibility
                keyframeEl.setAttribute('data-layer-id', layerId);
                keyframeEl.setAttribute('data-keyframe-id', keyframe.id);
                keyframeEl.setAttribute('data-time', `${keyframe.time}`);
                
                keyframeEl.style.left = `${position}px`;
                
                keyframeRow.appendChild(keyframeEl);
                
                // Add event listeners
                keyframeEl.addEventListener('click', this.handleKeyframeClick);
                keyframeEl.addEventListener('mousedown', this.handleKeyframeMouseDown);
                
                // Update tweens
                this.updateTweensForLayer(layerId);
            }
        }
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
}
