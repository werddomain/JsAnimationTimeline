// Properly structured KeyframeManager.ts file
import { BaseComponent } from '../../components/base/BaseComponent';
import { EventEmitter } from '../../core/EventEmitter';
import { CSS_CLASSES, DIMENSIONS } from '../../utils/Constants';
import { EVENT_TYPES } from '../../utils/EventTypes';
import { Keyframe, Layer } from '../../types';

interface KeyframeManagerOptions {
    container: HTMLElement;
    eventEmitter: EventEmitter<string>;
    timeScale?: number;
    pixelsPerSecond?: number;
}

export class KeyframeManager extends BaseComponent {
    private eventEmitter: EventEmitter<string>;
    private layers: Layer[] = [];
    private selectedKeyframeId: string | null = null;
    private selectedLayerId: string | null = null;
    private timeScale: number;
    private pixelsPerSecond: number;
    private isDragging: boolean = false;
    private dragStartX: number = 0;
    private dragKeyframeId: string | null = null;
    private cursorIndicator: HTMLElement | null = null;
    private timeTooltip: HTMLElement | null = null;
    public name = 'keyframeManager';
    public dependencies = [
        { name: 'layerManager', optional: false },
        { name: 'timeRuler', optional: false }
    ];

    constructor(options: KeyframeManagerOptions) {
        super(options.container, 'keyframe-manager');
        this.eventEmitter = options.eventEmitter;
        this.timeScale = options.timeScale || 1;
        this.pixelsPerSecond = options.pixelsPerSecond || 100;
    }

    public initialize(): void {
        this.render();
        this.setupEventListeners();
        // Listen for layer and time events
        this.eventEmitter.on(EVENT_TYPES.LAYER_ADDED, this, this.handleLayerAdded);
        this.eventEmitter.on(EVENT_TYPES.LAYER_REMOVED, this, this.handleLayerRemoved);
        this.eventEmitter.on(EVENT_TYPES.LAYER_SELECTED, this, this.handleLayerSelected);
        this.eventEmitter.on(EVENT_TYPES.TIME_UPDATED, this, this.handleTimeUpdated);
        this.eventEmitter.on(EVENT_TYPES.ZOOM_CHANGED, this, this.handleZoomChanged);
    }

    public render(): string {
        const html = `
            <div class="keyframe-manager">
                ${this.renderKeyframeContainer()}
            </div>
        `;
        this.container.innerHTML = html;
        return html;
    }

    private renderKeyframeContainer(): string {
        return this.layers.map(layer => `
            <div class="layer-keyframes" data-layer-id="${layer.id}">
                ${this.renderKeyframesForLayer(layer)}
            </div>
        `).join('');
    }

    private renderKeyframesForLayer(layer: Layer): string {
        if (!layer.keyframes || layer.keyframes.length === 0) {
            return '';
        }
        
        return layer.keyframes.map(keyframe => {
            const position = this.calculateKeyframePosition(keyframe.time);
            const isSelected = keyframe.id === this.selectedKeyframeId;
            
            return `
                <div class="keyframe ${isSelected ? 'selected' : ''}" 
                     data-keyframe-id="${keyframe.id}"
                     data-time="${keyframe.time}"
                     style="left: ${position}px;">
                </div>
            `;
        }).join('');
    }

    private calculateKeyframePosition(time: number): number {
        return time * this.timeScale * this.pixelsPerSecond;
    }

    public update(data: { layers: Layer[] }): void {
        this.layers = data.layers;
        this.render();
    }

    private setupEventListeners(): void {
        // Create keyframe on double-click
        this.container.addEventListener('dblclick', this.handleDoubleClick.bind(this));
        
        // Select keyframe on click
        this.container.addEventListener('click', this.handleClick.bind(this));
        
        // Drag keyframe
        this.container.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        
        // Add cursor position indicator
        this.container.addEventListener('mousemove', this.handleCursorPosition.bind(this));
        this.container.addEventListener('mouseleave', this.removeCursorIndicator.bind(this));
    }
    
    private handleCursorPosition(event: MouseEvent): void {
        if (this.isDragging) return; // Don't show cursor during drag operations
        
        const target = event.target as HTMLElement;
        const layerKeyframes = target.closest('.layer-keyframes') as HTMLElement;
        
        if (layerKeyframes) {
            const rect = layerKeyframes.getBoundingClientRect();
            const cursorX = event.clientX - rect.left;
            
            // Remove existing cursor indicators
            this.removeCursorIndicator();
            
            // Create cursor indicator
            this.cursorIndicator = document.createElement('div');
            this.cursorIndicator.className = 'keyframe-cursor-indicator';
            this.cursorIndicator.style.left = `${cursorX}px`;
            this.cursorIndicator.style.height = `${rect.height}px`;
            layerKeyframes.appendChild(this.cursorIndicator);
            
            // Show cursor time tooltip
            const time = cursorX / (this.timeScale * this.pixelsPerSecond);
            this.timeTooltip = document.createElement('div');
            this.timeTooltip.className = 'keyframe-time-tooltip';
            this.timeTooltip.textContent = this.formatTime(time);
            this.timeTooltip.style.left = `${cursorX}px`;
            layerKeyframes.appendChild(this.timeTooltip);
        }
    }
    
    private removeCursorIndicator(): void {
        if (this.cursorIndicator) {
            this.cursorIndicator.remove();
            this.cursorIndicator = null;
        }
        
        if (this.timeTooltip) {
            this.timeTooltip.remove();
            this.timeTooltip = null;
        }
    }
    
    private formatTime(seconds: number): string {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        const milliseconds = Math.floor((seconds % 1) * 100);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
    }
    
    private handleDoubleClick(event: MouseEvent): void {
        if (this.selectedLayerId === null) {
            alert('Please select a layer first');
            return;
        }
        
        const target = event.target as HTMLElement;
        const layerKeyframes = target.closest('.layer-keyframes') as HTMLElement;
        
        if (layerKeyframes) {
            const layerId = layerKeyframes.dataset.layerId;
            if (layerId === this.selectedLayerId) {
                const rect = layerKeyframes.getBoundingClientRect();
                const clickX = event.clientX - rect.left;
                
                // Calculate time from position
                const time = clickX / (this.timeScale * this.pixelsPerSecond);
                
                this.createKeyframe(layerId, time);
            }
        }
    }
    
    private handleClick(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        if (target.classList.contains('keyframe')) {
            const keyframeId = target.dataset.keyframeId;
            if (keyframeId) {
                this.selectKeyframe(keyframeId);
            }
        }
    }
    
    private handleMouseDown(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        if (target.classList.contains('keyframe')) {
            this.isDragging = true;
            this.dragStartX = event.clientX;
            this.dragKeyframeId = target.dataset.keyframeId || null;
            
            // Prevent text selection during drag
            event.preventDefault();
        }
    }
    
    private handleMouseMove(event: MouseEvent): void {
        if (!this.isDragging || this.dragKeyframeId === null) return;
        
        const deltaX = event.clientX - this.dragStartX;
        const keyframeEl = this.container.querySelector(`[data-keyframe-id="${this.dragKeyframeId}"]`) as HTMLElement;
        
        if (keyframeEl) {
            // Update the visual position during drag
            const currentLeft = parseInt(keyframeEl.style.left || '0', 10);
            keyframeEl.style.left = `${currentLeft + deltaX}px`;
            this.dragStartX = event.clientX;
        }
    }
    
    private handleMouseUp(event: MouseEvent): void {
        if (!this.isDragging || this.dragKeyframeId === null) return;
        
        const keyframeEl = this.container.querySelector(`[data-keyframe-id="${this.dragKeyframeId}"]`) as HTMLElement;
        
        if (keyframeEl) {
            const newLeft = parseInt(keyframeEl.style.left || '0', 10);
            const newTime = newLeft / (this.timeScale * this.pixelsPerSecond);
            
            // Update the keyframe time in the data model
            this.updateKeyframeTime(this.dragKeyframeId, newTime);
        }
        
        this.isDragging = false;
        this.dragKeyframeId = null;
    }
    
    private createKeyframe(layerId: string, time: number): void {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer) return;
        
        const keyframeId = 'keyframe_' + Date.now();
        const newKeyframe: Keyframe = {
            id: keyframeId,
            time,
            value: {} // Default empty value
        };
        
        // Add keyframe to the layer
        if (!layer.keyframes) {
            layer.keyframes = [];
        }
        
        layer.keyframes.push(newKeyframe);
        
        // Emit event
        this.eventEmitter.emit(EVENT_TYPES.KEYFRAME_ADDED, { 
            layerId, 
            keyframe: newKeyframe 
        });
        
        this.render();
        this.selectKeyframe(keyframeId);
    }
    
    private selectKeyframe(keyframeId: string): void {
        this.selectedKeyframeId = keyframeId;
        
        // Update UI to show the selected keyframe
        const keyframeElements = this.container.querySelectorAll('.keyframe');
        keyframeElements.forEach(el => {
            if ((el as HTMLElement).dataset.keyframeId === keyframeId) {
                el.classList.add('selected');
            } else {
                el.classList.remove('selected');
            }
        });
        
        // Find the keyframe data
        let selectedKeyframe: Keyframe | null = null;
        let keyframeLayerId: string | null = null;
        
        for (const layer of this.layers) {
            const keyframe = layer.keyframes?.find(k => k.id === keyframeId);
            if (keyframe) {
                selectedKeyframe = keyframe;
                keyframeLayerId = layer.id;
                break;
            }
        }
        
        // Emit an event with the selected keyframe data
        if (selectedKeyframe && keyframeLayerId) {
            this.eventEmitter.emit(EVENT_TYPES.KEYFRAME_SELECTED, {
                keyframe: selectedKeyframe,
                layerId: keyframeLayerId
            });
        }
    }
    
    private updateKeyframeTime(keyframeId: string, newTime: number): void {
        // Find and update the keyframe in the data model
        for (const layer of this.layers) {
            const keyframeIndex = layer.keyframes?.findIndex(k => k.id === keyframeId) ?? -1;
            
            if (keyframeIndex !== -1 && layer.keyframes) {
                const keyframe = layer.keyframes[keyframeIndex];
                keyframe.time = newTime;
                
                // Emit event
                this.eventEmitter.emit(EVENT_TYPES.KEYFRAME_MOVED, {
                    layerId: layer.id,
                    keyframeId,
                    newTime
                });
                
                break;
            }
        }
        
        this.render();
    }
    
    private handleLayerAdded(data: { layer: Layer }): void {
        if (!this.layers.some(l => l.id === data.layer.id)) {
            this.layers.push(data.layer);
            this.render();
        }
    }
    
    private handleLayerRemoved(data: { layerId: string }): void {
        this.layers = this.layers.filter(layer => layer.id !== data.layerId);
        this.render();
    }
    
    private handleLayerSelected(data: { layerId: string }): void {
        this.selectedLayerId = data.layerId;
    }
    
    private handleTimeUpdated(data: { time: number }): void {
        // Handle time updates if needed
    }
    
    private handleZoomChanged(data: { scale: number }): void {
        this.timeScale = data.scale;
        this.render();
    }

    public destroy(): void {
        // Clean up event listeners
        this.container.removeEventListener('dblclick', this.handleDoubleClick.bind(this));
        this.container.removeEventListener('click', this.handleClick.bind(this));
        this.container.removeEventListener('mousedown', this.handleMouseDown.bind(this));
        this.container.removeEventListener('mousemove', this.handleCursorPosition.bind(this));
        this.container.removeEventListener('mouseleave', this.removeCursorIndicator.bind(this));
        document.removeEventListener('mousemove', this.handleMouseMove.bind(this));
        document.removeEventListener('mouseup', this.handleMouseUp.bind(this));
        
        this.eventEmitter.off(EVENT_TYPES.LAYER_ADDED, this.handleLayerAdded);
        this.eventEmitter.off(EVENT_TYPES.LAYER_REMOVED, this.handleLayerRemoved);
        this.eventEmitter.off(EVENT_TYPES.LAYER_SELECTED, this.handleLayerSelected);
        this.eventEmitter.off(EVENT_TYPES.TIME_UPDATED, this.handleTimeUpdated);
        this.eventEmitter.off(EVENT_TYPES.ZOOM_CHANGED, this.handleZoomChanged);
    }
}
