import { BaseComponent } from '@core/BaseComponent';
import { DataModel } from '@core/DataModel';
import { EventEmitter } from '@core/EventEmitter';
import { Events, KeyframeData } from '@utils/EventTypes';

/**
 * Options for initializing the KeyframeManager
 */
export interface KeyframeManagerOptions {
    container: HTMLElement;
    id?: string;
}

/**
 * KeyframeManager plugin that handles keyframe creation, selection, and movement
 */
export class KeyframeManager extends BaseComponent {
    private dataModel: DataModel;
    private eventEmitter: EventEmitter;
    private isDragging: boolean = false;
    private draggedKeyframeId: string | null = null;
    private dragStartX: number = 0;
    private dragStartTime: number = 0;
    
    // Plugin metadata
    public metadata = {
        name: 'KeyframeManager',
        version: '1.0.0',
        dependencies: [
            { name: 'LayerManager' }
        ]
    };

    /**
     * Constructor for KeyframeManager
     * @param options Options for initializing the keyframe manager
     */
    constructor(options: KeyframeManagerOptions) {
        super(options.container, options.id || 'timeline-keyframes-container');
        this.dataModel = DataModel.getInstance();
        this.eventEmitter = EventEmitter.getInstance();
    }

    /**
     * Initialize the keyframe manager
     */
    public initialize(): void {
        if (!this.element) {
            console.error('KeyframeManager element not found');
            return;
        }

        // Listen for events
        this.eventEmitter.on(Events.KEYFRAME_ADDED, this.handleKeyframeAdded, this);
        this.eventEmitter.on(Events.KEYFRAME_REMOVED, this.handleKeyframeRemoved, this);
        this.eventEmitter.on(Events.KEYFRAME_MOVED, this.handleKeyframeMoved, this);
        this.eventEmitter.on(Events.KEYFRAME_SELECTED, this.handleKeyframeSelected, this);
        this.eventEmitter.on(Events.LAYER_ADDED, this.handleLayerAdded, this);
        this.eventEmitter.on(Events.LAYER_REMOVED, this.handleLayerRemoved, this);
        this.eventEmitter.on(Events.TIME_SCALE_CHANGED, this.handleTimeScaleChanged, this);

        // Add click event to handle background click (adding keyframes)
        this.element.addEventListener('click', this.handleClick);
        
        // Add event listeners for keyframe dragging
        this.element.addEventListener('mousedown', this.handleMouseDown);
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
        
        // Add double click event for editing keyframes
        this.element.addEventListener('dblclick', this.handleDoubleClick);
        
        // Initial render
        this.renderKeyframes();
        this.renderGrid();
    }

    /**
     * Render the keyframe manager
     * @returns HTML string for the keyframe manager
     */
    public render(): string {
        return `
            <div id="${this.id}" class="timeline-keyframes-container"></div>
        `;
    }

    /**
     * Update the keyframe manager with new data
     * @param data The data to update with
     */
    public update(data: any): void {
        this.renderKeyframes();
        this.renderGrid();
    }

    /**
     * Clean up the keyframe manager
     */
    public destroy(): void {
        if (this.element) {
            this.element.removeEventListener('click', this.handleClick);
            this.element.removeEventListener('mousedown', this.handleMouseDown);
            this.element.removeEventListener('dblclick', this.handleDoubleClick);
        }
        
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);

        // Remove event listeners
        this.eventEmitter.off(Events.KEYFRAME_ADDED, this.handleKeyframeAdded);
        this.eventEmitter.off(Events.KEYFRAME_REMOVED, this.handleKeyframeRemoved);
        this.eventEmitter.off(Events.KEYFRAME_MOVED, this.handleKeyframeMoved);
        this.eventEmitter.off(Events.KEYFRAME_SELECTED, this.handleKeyframeSelected);
        this.eventEmitter.off(Events.LAYER_ADDED, this.handleLayerAdded);
        this.eventEmitter.off(Events.LAYER_REMOVED, this.handleLayerRemoved);
        this.eventEmitter.off(Events.TIME_SCALE_CHANGED, this.handleTimeScaleChanged);
    }

    /**
     * Handle keyframe added event
     */
    private handleKeyframeAdded = (sender: any, data: { keyframe: KeyframeData }): void => {
        this.renderKeyframes();
    };

    /**
     * Handle keyframe removed event
     */
    private handleKeyframeRemoved = (sender: any, data: { keyframeId: string, layerId: string }): void => {
        this.renderKeyframes();
    };

    /**
     * Handle keyframe moved event
     */
    private handleKeyframeMoved = (sender: any, data: { keyframeId: string, layerId: string, newTime: number }): void => {
        this.renderKeyframes();
    };

    /**
     * Handle keyframe selected event
     */
    private handleKeyframeSelected = (sender: any, data: { keyframeId: string, layerId: string }): void => {
        this.updateKeyframeSelection(data.keyframeId);
    };

    /**
     * Handle layer added event
     */
    private handleLayerAdded = (sender: any, data: any): void => {
        this.renderKeyframes();
    };

    /**
     * Handle layer removed event
     */
    private handleLayerRemoved = (sender: any, data: any): void => {
        this.renderKeyframes();
    };

    /**
     * Handle time scale changed event
     */
    private handleTimeScaleChanged = (sender: any, data: { timeScale: number }): void => {
        this.renderKeyframes();
        this.renderGrid();
    };

    /**
     * Handle click on the keyframe container
     */
    private handleClick = (event: MouseEvent): void => {
        const target = event.target as HTMLElement;
        
        // If clicked on a keyframe, select it
        if (target.classList.contains('timeline-keyframe')) {
            const keyframeId = target.dataset.keyframeId;
            if (keyframeId) {
                this.dataModel.selectKeyframe(keyframeId, this);
            }
            return;
        }
        
        // If clicked on background, get the layer and time, then add a keyframe
        const selectedLayer = this.dataModel.getSelectedLayer();
        if (selectedLayer && this.element) {
            // Calculate time from pixel position
            const rect = this.element.getBoundingClientRect();
            const clickX = event.clientX - rect.left + this.element.scrollLeft;
            const time = this.dataModel.pixelsToTime(clickX);
            
            // Check if we clicked on a layer row
            const layerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--layer-height'));
            const clickY = event.clientY - rect.top + this.element.scrollTop;
            const layerIndex = Math.floor(clickY / layerHeight);
            const layers = this.dataModel.getLayers();
            
            if (layerIndex >= 0 && layerIndex < layers.length) {
                const layer = layers[layerIndex];
                this.dataModel.selectLayer(layer.id, this);
                
                // Create a new keyframe
                const keyframeId = `keyframe-${Date.now()}`;
                this.dataModel.addKeyframe({
                    id: keyframeId,
                    layerId: layer.id,
                    time: time,
                    value: { x: 0, y: 0 } // Default value
                }, this);
            }
        }
    };

    /**
     * Handle mouse down on keyframes for dragging
     */
    private handleMouseDown = (event: MouseEvent): void => {
        const target = event.target as HTMLElement;
        
        // Only handle keyframe elements
        if (!target.classList.contains('timeline-keyframe')) {
            return;
        }
        
        const keyframeId = target.dataset.keyframeId;
        if (keyframeId) {
            this.isDragging = true;
            this.draggedKeyframeId = keyframeId;
            this.dragStartX = event.clientX;
            
            // Get current time of the keyframe
            const keyframe = this.dataModel.getKeyframes().find(kf => kf.id === keyframeId);
            if (keyframe) {
                this.dragStartTime = keyframe.time;
            }
            
            // Select the keyframe
            this.dataModel.selectKeyframe(keyframeId, this);
            
            // Prevent event propagation to avoid triggering click
            event.stopPropagation();
        }
    };

    /**
     * Handle mouse move for dragging keyframes
     */
    private handleMouseMove = (event: MouseEvent): void => {
        if (!this.isDragging || !this.draggedKeyframeId || !this.element) {
            return;
        }
        
        // Calculate the delta X in pixels
        const deltaX = event.clientX - this.dragStartX;
        
        // Convert to time delta
        const timeDelta = this.dataModel.pixelsToTime(deltaX);
        
        // Calculate new time
        const newTime = this.dragStartTime + timeDelta;
        
        // Move the keyframe
        this.dataModel.moveKeyframe(this.draggedKeyframeId, newTime, this);
    };

    /**
     * Handle mouse up for dragging keyframes
     */
    private handleMouseUp = (): void => {
        this.isDragging = false;
        this.draggedKeyframeId = null;
    };

    /**
     * Handle double click on keyframes (for editing)
     */
    private handleDoubleClick = (event: MouseEvent): void => {
        const target = event.target as HTMLElement;
        
        // Only handle keyframe elements
        if (!target.classList.contains('timeline-keyframe')) {
            return;
        }
        
        const keyframeId = target.dataset.keyframeId;
        if (keyframeId) {
            const keyframe = this.dataModel.getKeyframes().find(kf => kf.id === keyframeId);
            if (keyframe) {
                // For now, we'll just log the keyframe data
                // In a real implementation, we would show a dialog to edit the keyframe
                console.log('Edit keyframe:', keyframe);
                
                // Prevent event propagation
                event.stopPropagation();
            }
        }
    };

    /**
     * Update the keyframe selection in the UI
     * @param keyframeId The ID of the selected keyframe
     */
    private updateKeyframeSelection(keyframeId: string): void {
        if (!this.element) {
            return;
        }

        // Remove selected class from all keyframes
        const selectedKeyframes = this.element.querySelectorAll('.timeline-keyframe.selected');
        selectedKeyframes.forEach(keyframe => {
            keyframe.classList.remove('selected');
        });

        // Add selected class to the selected keyframe
        const selectedKeyframe = this.element.querySelector(`[data-keyframe-id="${keyframeId}"]`);
        if (selectedKeyframe) {
            selectedKeyframe.classList.add('selected');
        }
    }

    /**
     * Render the grid background
     */
    private renderGrid(): void {
        if (!this.element) {
            return;
        }
        
        // Clear existing grid
        const existingGrid = this.element.querySelectorAll('.timeline-vertical-grid, .timeline-horizontal-grid');
        existingGrid.forEach(grid => grid.remove());
        
        // Get dimensions
        const duration = this.dataModel.getDuration();
        const timeScale = this.dataModel.getTimeScale();
        const pixelsPerSecond = this.dataModel.getPixelsPerSecond();
        const totalWidth = duration * timeScale * pixelsPerSecond;
        
        // Set container width
        this.element.style.width = `${totalWidth}px`;
        
        // Create vertical grid lines (time markers)
        // Use the same interval logic as in TimeRuler
        let majorInterval: number;
        
        if (timeScale * pixelsPerSecond <= 5) {
            majorInterval = 60; // 1 minute
        } else if (timeScale * pixelsPerSecond <= 30) {
            majorInterval = 30; // 30 seconds
        } else if (timeScale * pixelsPerSecond <= 60) {
            majorInterval = 10; // 10 seconds
        } else if (timeScale * pixelsPerSecond <= 120) {
            majorInterval = 5;  // 5 seconds
        } else {
            majorInterval = 1;  // 1 second
        }
        
        // Create vertical grid lines
        for (let time = 0; time <= duration; time += majorInterval) {
            const position = time * timeScale * pixelsPerSecond;
            
            const gridLine = document.createElement('div');
            gridLine.className = 'timeline-vertical-grid';
            gridLine.style.left = `${position}px`;
            
            this.element.appendChild(gridLine);
        }
        
        // Create horizontal grid lines (layer dividers)
        const layers = this.dataModel.getLayers();
        const layerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--layer-height'));
        
        for (let i = 0; i <= layers.length; i++) {
            const position = i * layerHeight;
            
            const gridLine = document.createElement('div');
            gridLine.className = 'timeline-horizontal-grid';
            gridLine.style.top = `${position}px`;
            gridLine.style.width = '100%';
            gridLine.style.height = '1px';
            gridLine.style.position = 'absolute';
            gridLine.style.backgroundColor = 'var(--timeline-grid-color)';
            gridLine.style.opacity = '0.5';
            
            this.element.appendChild(gridLine);
        }
    }

    /**
     * Render all keyframes
     */
    private renderKeyframes(): void {
        if (!this.element) {
            return;
        }        // Clear existing keyframes and tween lines
        const existingElements = this.element.querySelectorAll('.timeline-keyframe, .timeline-tween-line');
        existingElements.forEach(element => element.remove());

        // Get data
        const keyframes = this.dataModel.getKeyframes();
        const layers = this.dataModel.getLayers();
        const selectedKeyframe = this.dataModel.getSelectedKeyframe();
        const timeScale = this.dataModel.getTimeScale();
        const pixelsPerSecond = this.dataModel.getPixelsPerSecond();
        const layerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--layer-height'));

        // Create a lookup for layer indices
        const layerIndices = new Map<string, number>();
        layers.forEach((layer, index) => {
            layerIndices.set(layer.id, index);
        });

        // Render each keyframe
        keyframes.forEach(keyframe => {
            const layerIndex = layerIndices.get(keyframe.layerId);
            
            if (layerIndex !== undefined) {
                // Calculate position
                const xPos = keyframe.time * timeScale * pixelsPerSecond;
                const yPos = (layerIndex * layerHeight) + (layerHeight / 2);
                
                // Create keyframe element
                const keyframeEl = document.createElement('div');
                keyframeEl.className = 'timeline-keyframe';
                keyframeEl.dataset.keyframeId = keyframe.id;
                keyframeEl.dataset.layerId = keyframe.layerId;
                keyframeEl.style.left = `${xPos}px`;
                keyframeEl.style.top = `${yPos}px`;
                
                // Mark selected keyframe
                if (selectedKeyframe && keyframe.id === selectedKeyframe.id) {
                    keyframeEl.classList.add('selected');
                }
                  // Add keyframe to container
                if (this.element) {
                    this.element.appendChild(keyframeEl);
                    
                    // If this is not the first keyframe for this layer, draw a tween line
                    // Find the previous keyframe for this layer
                    const previousKeyframes = keyframes
                        .filter(kf => kf.layerId === keyframe.layerId && kf.time < keyframe.time)
                        .sort((a, b) => b.time - a.time);
                    
                    if (previousKeyframes.length > 0) {
                        const prevKeyframe = previousKeyframes[0];
                        const prevXPos = prevKeyframe.time * timeScale * pixelsPerSecond;
                        
                        // Create tween line
                        const tweenLine = document.createElement('div');
                        tweenLine.className = 'timeline-tween-line';
                        tweenLine.style.position = 'absolute';
                        tweenLine.style.height = '2px';
                        tweenLine.style.backgroundColor = 'var(--timeline-keyframe-color)';
                        tweenLine.style.opacity = '0.7';
                        tweenLine.style.top = `${yPos}px`;
                        tweenLine.style.left = `${prevXPos}px`;
                        tweenLine.style.width = `${xPos - prevXPos}px`;
                        
                        this.element.appendChild(tweenLine);
                    }
                }
            }
        });
    }

    /**
     * Add a new keyframe
     * @param layerId The ID of the layer to add the keyframe to
     * @param time The time for the keyframe
     * @param value The value for the keyframe
     * @returns The added keyframe data
     */
    public addKeyframe(layerId: string, time: number, value: any): KeyframeData {
        const keyframeId = `keyframe-${Date.now()}`;
        return this.dataModel.addKeyframe({
            id: keyframeId,
            layerId,
            time,
            value
        }, this);
    }

    /**
     * Remove a keyframe
     * @param keyframeId The ID of the keyframe to remove
     */
    public removeKeyframe(keyframeId: string): void {
        this.dataModel.removeKeyframe(keyframeId, this);
    }

    /**
     * Move a keyframe
     * @param keyframeId The ID of the keyframe to move
     * @param newTime The new time for the keyframe
     */
    public moveKeyframe(keyframeId: string, newTime: number): void {
        this.dataModel.moveKeyframe(keyframeId, newTime, this);
    }
}
