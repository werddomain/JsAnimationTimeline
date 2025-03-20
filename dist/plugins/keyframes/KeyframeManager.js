/* eslint-disable @typescript-eslint/no-inferrable-types */
// src/plugins/keyframes/KeyframeManager.ts
/**
 * Keyframe Manager
 * Manages keyframes and motion tweens on the timeline
 */
import { TimelineConstants } from '../../core/Constants';
import { Component } from '../../core/BaseComponent';
const { EVENTS, CSS_CLASSES, DIMENSIONS, COLORS } = TimelineConstants;
export class KeyframeManager extends Component {
    constructor(options) {
        super(options.container, 'timeline-keyframes-container');
        this.layers = [];
        this.timeScale = 1;
        this.dragKeyframe = null;
        this.dragStartX = 0;
        this.dragStartTime = 0;
        this.canvasElements = new Map();
        // Add a property to store selected tween
        this.selectedTweenId = null;
        this.eventEmitter = options.eventEmitter;
        this.options = options;
        this.init();
    }
    /**
     * Initialize the keyframe manager
     */
    init() {
        this.initialize();
    }
    /**
     * Initialize event listeners
     */
    initialize() {
        const element = this.getElement();
        if (element) {
            element.addEventListener('click', this.handleClick.bind(this));
            element.addEventListener('mousedown', this.handleMouseDown.bind(this));
            element.addEventListener('dblclick', this.handleDoubleClick.bind(this));
        }
        // Setup drag and drop
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }
    /**
     * Update layers and render
     * @param data Updated data
     */
    update(data) {
        if (data.layers !== undefined) {
            this.layers = data.layers;
        }
        if (data.timeScale !== undefined) {
            this.timeScale = data.timeScale;
        }
        const element = this.getElement();
        if (element) {
            element.innerHTML = this.renderContent();
            // After rendering, get canvas elements and draw keyframes
            this.canvasElements.clear();
            this.layers.forEach(layer => {
                const canvas = document.getElementById(`canvas-${layer.id}`);
                if (canvas) {
                    this.canvasElements.set(layer.id, canvas);
                    this.renderLayerKeyframes(layer, canvas);
                }
            });
        }
    }
    /**
     * Render the keyframes container
     */
    render() {
        return `
      <div id="${this.elementId}" class="${CSS_CLASSES.KEYFRAMES}">
        ${this.renderContent()}
      </div>
    `;
    }
    /**
     * Render the inner content
     */
    renderContent() {
        // Calculate total width based on duration and time scale
        const duration = 600; // 10 minutes in seconds - this should be passed in or retrieved
        const totalWidth = duration * this.timeScale * DIMENSIONS.PIXELS_PER_SECOND;
        let html = `<div class="timeline-keyframes-inner" style="width: ${totalWidth}px;">`;
        // Add time markers (vertical guides)
        const interval = this.getTimeInterval();
        for (let time = 0; time <= duration; time += interval) {
            const position = time * this.timeScale * DIMENSIONS.PIXELS_PER_SECOND;
            const isMajor = time % (interval * 5) === 0;
            const markerClass = isMajor ? 'timeline-time-marker-major' : 'timeline-time-marker';
            html += `<div class="${markerClass}" style="left: ${position}px;"></div>`;
        }
        // Render each layer's keyframes
        this.layers.forEach((layer, index) => {
            // Create a row for this layer
            html += `
        <div class="timeline-layer-row ${layer.isSelected ? 'selected' : ''}" 
             style="top: ${index * DIMENSIONS.LAYER_HEIGHT}px;" 
             data-layer-id="${layer.id}">
          <canvas id="canvas-${layer.id}" 
                  class="timeline-keyframes-canvas" 
                  width="${totalWidth}" 
                  height="${DIMENSIONS.LAYER_HEIGHT}"></canvas>
          
          ${this.renderKeyframeElements(layer)}
        </div>
      `;
        });
        html += '</div>';
        return html;
    }
    /**
 * Render keyframes on canvas
 * @param layer Layer data
 * @param canvas Canvas element
 */
    renderLayerKeyframes(layer, canvas) {
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Draw motion tweens first (as background)
        layer.motionTweens.forEach(tween => {
            const startKeyframe = layer.keyframes.find(k => k.id === tween.startKeyframeId);
            const endKeyframe = layer.keyframes.find(k => k.id === tween.endKeyframeId);
            if (startKeyframe && endKeyframe) {
                const startX = this.timeToPixels(startKeyframe.time);
                const endX = this.timeToPixels(endKeyframe.time);
                const centerY = DIMENSIONS.LAYER_HEIGHT / 2;
                // Draw tween line
                ctx.beginPath();
                ctx.moveTo(startX, centerY);
                ctx.lineTo(endX, centerY);
                // Check if this tween is selected
                if (tween.id === this.selectedTweenId) {
                    ctx.strokeStyle = COLORS.KEYFRAME_SELECTED;
                    ctx.lineWidth = 3;
                }
                else {
                    ctx.strokeStyle = COLORS.TWEEN_LINE;
                    ctx.lineWidth = 2;
                }
                ctx.stroke();
                // Add DOM element for the tween to make it clickable
                const tweenEl = document.createElement('div');
                tweenEl.className = 'timeline-motion-tween' + (tween.id === this.selectedTweenId ? ' selected' : '');
                tweenEl.setAttribute('data-tween-id', tween.id);
                tweenEl.setAttribute('data-layer-id', layer.id);
                tweenEl.style.position = 'absolute';
                tweenEl.style.left = `${startX}px`;
                tweenEl.style.width = `${endX - startX}px`;
                tweenEl.style.top = `${centerY - 5}px`;
                tweenEl.style.height = '10px';
                // Add to DOM
                const layerRow = document.querySelector(`[data-layer-id="${layer.id}"]`);
                if (layerRow) {
                    layerRow.appendChild(tweenEl);
                }
            }
        });
    }
    /**
     * Generate HTML for interactive keyframe elements
     * @param layer Layer data
     * @returns HTML string
     */
    renderKeyframeElements(layer) {
        let html = '';
        layer.keyframes.forEach(keyframe => {
            // Check if keyframe is part of a motion tween
            const inTween = layer.motionTweens.some(tween => tween.startKeyframeId === keyframe.id || tween.endKeyframeId === keyframe.id);
            // Position calculation
            const xPos = this.timeToPixels(keyframe.time);
            const yPos = (DIMENSIONS.LAYER_HEIGHT - DIMENSIONS.KEYFRAME_SIZE) / 2;
            // Classes
            const classes = [
                CSS_CLASSES.KEYFRAME,
                keyframe.isSelected ? CSS_CLASSES.SELECTED : '',
                inTween ? 'in-tween' : '',
                layer.locked ? 'locked' : ''
            ].filter(Boolean).join(' ');
            html += `
        <div class="${classes}"
             style="left: ${xPos}px; top: ${yPos}px; width: ${DIMENSIONS.KEYFRAME_SIZE}px; height: ${DIMENSIONS.KEYFRAME_SIZE}px;"
             data-keyframe-id="${keyframe.id}"
             data-layer-id="${layer.id}"
             title="Time: ${this.formatTime(keyframe.time)}">
        </div>
      `;
        });
        return html;
    }
    /**
     * Convert time to pixel position
     * @param time Time in seconds
     * @returns X position in pixels
     */
    timeToPixels(time) {
        return time * this.timeScale * DIMENSIONS.PIXELS_PER_SECOND;
    }
    /**
     * Convert pixel position to time
     * @param pixels X position in pixels
     * @returns Time in seconds
     */
    pixelsToTime(pixels) {
        return pixels / (this.timeScale * DIMENSIONS.PIXELS_PER_SECOND);
    }
    /**
     * Format time as MM:SS.ms
     * @param timeInSeconds Time in seconds
     * @returns Formatted time string
     */
    formatTime(timeInSeconds) {
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        const milliseconds = Math.floor((timeInSeconds % 1) * 100);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
    }
    /**
     * Determine appropriate time interval based on zoom level
     * @returns Time interval in seconds
     */
    getTimeInterval() {
        if (this.timeScale <= 0.2)
            return 60; // 1 minute
        if (this.timeScale <= 0.5)
            return 30; // 30 seconds
        if (this.timeScale <= 1)
            return 10; // 10 seconds
        if (this.timeScale <= 2)
            return 5; // 5 seconds
        if (this.timeScale <= 4)
            return 1; // 1 second
        return 0.5; // 500 milliseconds
    }
    /**
 * Handle click events
 * @param e Mouse event
 */
    handleClick(e) {
        const target = e.target;
        // Check if clicked on a motion tween
        if (target.classList.contains('timeline-motion-tween')) {
            const layerId = target.getAttribute('data-layer-id');
            const tweenId = target.getAttribute('data-tween-id');
            if (layerId && tweenId) {
                this.selectMotionTween(layerId, tweenId);
            }
            return;
        }
        // Check if clicked on a keyframe
        if (target.classList.contains(CSS_CLASSES.KEYFRAME)) {
            const layerId = target.getAttribute('data-layer-id');
            const keyframeId = target.getAttribute('data-keyframe-id');
            if (layerId && keyframeId) {
                const multiSelect = e.ctrlKey || e.metaKey;
                this.options.onKeyframeSelect(layerId, keyframeId, multiSelect);
                // Deselect any selected tween
                this.deselectMotionTween();
            }
        }
    }
    /**
 * Select a motion tween
 */
    selectMotionTween(layerId, tweenId) {
        // Find the layer and tween
        const layer = this.layers.find(l => l.id === layerId);
        const tween = layer === null || layer === void 0 ? void 0 : layer.motionTweens.find(t => t.id === tweenId);
        if (!layer || !tween)
            return;
        // Update selected tween
        this.selectedTweenId = tweenId;
        // Update visual state
        this.updateTweenDisplay();
        // Emit event
        this.eventEmitter.emitTweenSelected(layer, tweenId);
        //this.eventEmitter.emit('motion:tween:selected', layer, tween);
    }
    /**
     * Deselect the motion tween
     */
    deselectMotionTween() {
        if (!this.selectedTweenId)
            return;
        // Reset selected tween
        this.selectedTweenId = null;
        // Update visual state
        this.updateTweenDisplay();
        // Emit event
        this.eventEmitter.emitTweenDeselected();
        //this.eventEmitter.emit('motion:tween:deselected');
    }
    /**
 * Update tween display
 */
    updateTweenDisplay() {
        // Find all tween elements
        const element = this.getElement();
        if (!element)
            return;
        const tweenElements = element.querySelectorAll('.timeline-motion-tween');
        // Update classes
        tweenElements.forEach(tweenEl => {
            const tweenId = tweenEl.getAttribute('data-tween-id');
            if (tweenId === this.selectedTweenId) {
                tweenEl.classList.add('selected');
            }
            else {
                tweenEl.classList.remove('selected');
            }
        });
    }
    /**
     * Handle double click events
     * @param e Mouse event
     */
    handleDoubleClick(e) {
        const target = e.target;
        // Don't add keyframe if clicked on an existing keyframe
        if (target.classList.contains(CSS_CLASSES.KEYFRAME)) {
            return;
        }
        // Get layer row element
        const layerRow = this.findParentWithClass(target, 'timeline-layer-row');
        if (!layerRow)
            return;
        const layerId = layerRow.getAttribute('data-layer-id');
        if (!layerId)
            return;
        // Calculate time from click position
        const rect = layerRow.getBoundingClientRect();
        const x = e.clientX - rect.left + layerRow.scrollLeft;
        const time = this.pixelsToTime(x);
        // Add keyframe at clicked position
        this.options.onKeyframeAdd(layerId, time);
    }
    /**
     * Handle mouse down events
     * @param e Mouse event
     */
    handleMouseDown(e) {
        const target = e.target;
        // Check if clicked on a keyframe
        if (target.classList.contains(CSS_CLASSES.KEYFRAME)) {
            const layerId = target.getAttribute('data-layer-id');
            const keyframeId = target.getAttribute('data-keyframe-id');
            if (layerId && keyframeId) {
                // Find keyframe data
                const layer = this.layers.find(l => l.id === layerId);
                const keyframe = layer === null || layer === void 0 ? void 0 : layer.keyframes.find(k => k.id === keyframeId);
                if (layer && keyframe) {
                    // Check if keyframe is in a motion tween
                    const inTween = layer.motionTweens.some(tween => tween.startKeyframeId === keyframeId || tween.endKeyframeId === keyframeId);
                    // Don't allow dragging if locked or in motion tween
                    if (layer.locked || inTween) {
                        return;
                    }
                    // Start dragging
                    this.dragKeyframe = target;
                    this.dragStartX = e.clientX;
                    this.dragStartTime = keyframe.time;
                    // Add dragging class
                    target.classList.add('dragging');
                    // Prevent text selection during drag
                    e.preventDefault();
                }
            }
        }
    }
    /**
     * Handle mouse move events
     * @param e Mouse event
     */
    handleMouseMove(e) {
        if (!this.dragKeyframe)
            return;
        const deltaX = e.clientX - this.dragStartX;
        const deltaTime = this.pixelsToTime(deltaX);
        const newTime = Math.max(0, this.dragStartTime + deltaTime);
        // Update position visually
        this.dragKeyframe.style.left = `${this.timeToPixels(newTime)}px`;
    }
    /**
     * Handle mouse up events
     * @param e Mouse event
     */
    handleMouseUp(e) {
        if (!this.dragKeyframe)
            return;
        const layerId = this.dragKeyframe.getAttribute('data-layer-id');
        const keyframeId = this.dragKeyframe.getAttribute('data-keyframe-id');
        if (layerId && keyframeId) {
            // Calculate new time
            const deltaX = e.clientX - this.dragStartX;
            const deltaTime = this.pixelsToTime(deltaX);
            const newTime = Math.max(0, this.dragStartTime + deltaTime);
            // Update keyframe position
            this.options.onKeyframeMove(layerId, keyframeId, newTime);
        }
        // Remove dragging class
        this.dragKeyframe.classList.remove('dragging');
        // Reset drag state
        this.dragKeyframe = null;
    }
    /**
     * Create a motion tween between selected keyframes
     * @returns True if successful
     */
    createMotionTween() {
        // Find selected keyframes (should be exactly 2)
        const selectedKeyframes = [];
        this.layers.forEach(layer => {
            layer.keyframes.forEach(keyframe => {
                if (keyframe.isSelected) {
                    selectedKeyframes.push({
                        layerId: layer.id,
                        keyframeId: keyframe.id,
                        time: keyframe.time
                    });
                }
            });
        });
        // Check if we have exactly 2 keyframes selected and they're on the same layer
        if (selectedKeyframes.length !== 2) {
            return false;
        }
        if (selectedKeyframes[0].layerId !== selectedKeyframes[1].layerId) {
            return false;
        }
        // Sort by time
        selectedKeyframes.sort((a, b) => a.time - b.time);
        // Create tween
        this.options.onMotionTweenAdd(selectedKeyframes[0].layerId, selectedKeyframes[0].keyframeId, selectedKeyframes[1].keyframeId);
        return true;
    }
    /**
     * Delete selected keyframes
     * @returns Number of keyframes deleted
     */
    deleteSelectedKeyframes() {
        let count = 0;
        this.layers.forEach(layer => {
            layer.keyframes.forEach(keyframe => {
                if (keyframe.isSelected) {
                    this.options.onKeyframeDelete(layer.id, keyframe.id);
                    count++;
                }
            });
        });
        return count;
    }
    /**
     * Find parent element with specific class
     * @param element Starting element
     * @param className Class to find
     * @returns Parent element or null
     */
    findParentWithClass(element, className) {
        while (element && !element.classList.contains(className)) {
            element = element.parentElement;
        }
        return element;
    }
    /**
     * Clean up event listeners
     */
    destroy() {
        const element = this.getElement();
        if (element) {
            element.removeEventListener('click', this.handleClick.bind(this));
            element.removeEventListener('mousedown', this.handleMouseDown.bind(this));
            element.removeEventListener('dblclick', this.handleDoubleClick.bind(this));
        }
        document.removeEventListener('mousemove', this.handleMouseMove.bind(this));
        document.removeEventListener('mouseup', this.handleMouseUp.bind(this));
    }
} /**
 * Keyframe Manager
 * Manages keyframes and motion tweens on the timeline
 */
//export class KeyframeManager {
//    private container: HTMLElement;
//    private eventEmitter: EventEmitter;
//    private options: KeyframeManagerOptions;
//    private layers: Layer[] = [];
//    private timeScale: number = 1;
//    private dragKeyframe: HTMLElement | null = null;
//    private dragStartX: number = 0;
//    private dragStartTime: number = 0;
//    private canvasElements: Map<string, HTMLCanvasElement> = new Map();
//    constructor(options: KeyframeManagerOptions) {
//        this.container = options.container;
//        this.eventEmitter = options.eventEmitter;
//        this.options = options;
//        this.init();
//    }
//    /**
//     * Initialize the keyframe manager
//     */
//    private init(): void {
//        // Setup event listeners
//        this.container.addEventListener('click', this.handleClick.bind(this));
//        this.container.addEventListener('mousedown', this.handleMouseDown.bind(this));
//        // Setup drag and drop
//        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
//        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
//        // Double click to add keyframe
//        this.container.addEventListener('dblclick', this.handleDoubleClick.bind(this));
//    }
//    /**
//     * Update layers and render
//     * @param layers Array of layers
//     * @param timeScale Current time scale
//     */
//    public updateLayers(layers: Layer[], timeScale: number): void {
//        this.layers = layers;
//        this.timeScale = timeScale;
//        this.render();
//    }
//    /**
//     * Render all layers and keyframes
//     */
//    public render(): void {
//        // Clear the container and create layer rows
//        this.container.innerHTML = '';
//        this.canvasElements.clear();
//        // Create a container for proper scrolling
//        const innerContainer = document.createElement('div');
//        innerContainer.className = 'timeline-keyframes-inner';
//        this.container.appendChild(innerContainer);
//        // Calculate total width based on duration and time scale
//        const duration = 600; // 10 minutes in seconds
//        const totalWidth = duration * this.timeScale * DIMENSIONS.PIXELS_PER_SECOND;
//        innerContainer.style.width = `${totalWidth}px`;
//        // Render each layer's keyframes
//        this.layers.forEach((layer, index) => {
//            const layerRow = document.createElement('div');
//            layerRow.className = 'timeline-layer-row';
//            layerRow.style.height = `${DIMENSIONS.LAYER_HEIGHT}px`;
//            layerRow.style.top = `${index * DIMENSIONS.LAYER_HEIGHT}px`;
//            layerRow.setAttribute('data-layer-id', layer.id);
//            innerContainer.appendChild(layerRow);
//            // Create canvas for this layer
//            const canvas = document.createElement('canvas');
//            canvas.width = totalWidth;
//            canvas.height = DIMENSIONS.LAYER_HEIGHT;
//            canvas.className = 'timeline-keyframes-canvas';
//            layerRow.appendChild(canvas);
//            this.canvasElements.set(layer.id, canvas);
//            // Render keyframes on canvas
//            this.renderLayerKeyframes(layer, canvas);
//            // Add DOM elements for interactive keyframes
//            this.renderKeyframeElements(layer, layerRow);
//        });
//    }
//    /**
//     * Render keyframes on canvas
//     * @param layer Layer data
//     * @param canvas Canvas element
//     */
//    private renderLayerKeyframes(layer: Layer, canvas: HTMLCanvasElement): void {
//        const ctx = canvas.getContext('2d');
//        if (!ctx) return;
//        // Clear canvas
//        ctx.clearRect(0, 0, canvas.width, canvas.height);
//        // Draw motion tweens first (as background)
//        layer.motionTweens.forEach(tween => {
//            const startKeyframe = layer.keyframes.find(k => k.id === tween.startKeyframeId);
//            const endKeyframe = layer.keyframes.find(k => k.id === tween.endKeyframeId);
//            if (startKeyframe && endKeyframe) {
//                const startX = this.timeToPixels(startKeyframe.time);
//                const endX = this.timeToPixels(endKeyframe.time);
//                const centerY = DIMENSIONS.LAYER_HEIGHT / 2;
//                // Draw tween line
//                ctx.beginPath();
//                ctx.moveTo(startX, centerY);
//                ctx.lineTo(endX, centerY);
//                ctx.strokeStyle = COLORS.TWEEN_LINE;
//                ctx.lineWidth = 2;
//                ctx.stroke();
//            }
//        });
//    }
//    /**
//     * Render interactive keyframe DOM elements
//     * @param layer Layer data
//     * @param container Layer row element
//     */
//    private renderKeyframeElements(layer: Layer, container: HTMLElement): void {
//        layer.keyframes.forEach(keyframe => {
//            const keyframeEl = document.createElement('div');
//            keyframeEl.className = `${CSS_CLASSES.KEYFRAME} ${keyframe.isSelected ? CSS_CLASSES.SELECTED : ''}`;
//            keyframeEl.style.left = `${this.timeToPixels(keyframe.time)}px`;
//            keyframeEl.style.top = `${(DIMENSIONS.LAYER_HEIGHT - DIMENSIONS.KEYFRAME_SIZE) / 2}px`;
//            keyframeEl.style.width = `${DIMENSIONS.KEYFRAME_SIZE}px`;
//            keyframeEl.style.height = `${DIMENSIONS.KEYFRAME_SIZE}px`;
//            keyframeEl.setAttribute('data-keyframe-id', keyframe.id);
//            keyframeEl.setAttribute('data-layer-id', layer.id);
//            // Check if keyframe is part of a motion tween
//            const inTween = layer.motionTweens.some(
//                tween => tween.startKeyframeId === keyframe.id || tween.endKeyframeId === keyframe.id
//            );
//            if (inTween) {
//                keyframeEl.classList.add('in-tween');
//            }
//            container.appendChild(keyframeEl);
//        });
//    }
//    /**
//     * Convert time to pixel position
//     * @param time Time in seconds
//     * @returns X position in pixels
//     */
//    private timeToPixels(time: number): number {
//        return time * this.timeScale * DIMENSIONS.PIXELS_PER_SECOND;
//    }
//    /**
//     * Convert pixel position to time
//     * @param pixels X position in pixels
//     * @returns Time in seconds
//     */
//    private pixelsToTime(pixels: number): number {
//        return pixels / (this.timeScale * DIMENSIONS.PIXELS_PER_SECOND);
//    }
//    /**
//     * Handle click events
//     * @param e Mouse event
//     */
//    private handleClick(e: MouseEvent): void {
//        const target = e.target as HTMLElement;
//        // Check if clicked on a keyframe
//        if (target.classList.contains(CSS_CLASSES.KEYFRAME)) {
//            const layerId = target.getAttribute('data-layer-id');
//            const keyframeId = target.getAttribute('data-keyframe-id');
//            if (layerId && keyframeId) {
//                const multiSelect = e.ctrlKey || e.metaKey;
//                this.options.onKeyframeSelect(layerId, keyframeId, multiSelect);
//            }
//        }
//    }
//    /**
//     * Handle double click events
//     * @param e Mouse event
//     */
//    private handleDoubleClick(e: MouseEvent): void {
//        const target = e.target as HTMLElement;
//        // Don't add keyframe if clicked on an existing keyframe
//        if (target.classList.contains(CSS_CLASSES.KEYFRAME)) {
//            return;
//        }
//        // Get layer row element
//        const layerRow = this.findParentWithClass(target, 'timeline-layer-row');
//        if (!layerRow) return;
//        const layerId = layerRow.getAttribute('data-layer-id');
//        if (!layerId) return;
//        // Calculate time from click position
//        const rect = layerRow.getBoundingClientRect();
//        const x = e.clientX - rect.left + layerRow.scrollLeft;
//        const time = this.pixelsToTime(x);
//        // Add keyframe at clicked position
//        this.options.onKeyframeAdd(layerId, time);
//    }
//    /**
//     * Handle mouse down events
//     * @param e Mouse event
//     */
//    private handleMouseDown(e: MouseEvent): void {
//        const target = e.target as HTMLElement;
//        // Check if clicked on a keyframe
//        if (target.classList.contains(CSS_CLASSES.KEYFRAME)) {
//            const layerId = target.getAttribute('data-layer-id');
//            const keyframeId = target.getAttribute('data-keyframe-id');
//            if (layerId && keyframeId) {
//                // Find keyframe data
//                const layer = this.layers.find(l => l.id === layerId);
//                const keyframe = layer?.keyframes.find(k => k.id === keyframeId);
//                if (layer && keyframe) {
//                    // Check if keyframe is in a motion tween
//                    const inTween = layer.motionTweens.some(
//                        tween => tween.startKeyframeId === keyframeId || tween.endKeyframeId === keyframeId
//                    );
//                    // Don't allow dragging if locked or in motion tween
//                    if (layer.locked || inTween) {
//                        return;
//                    }
//                    // Start dragging
//                    this.dragKeyframe = target;
//                    this.dragStartX = e.clientX;
//                    this.dragStartTime = keyframe.time;
//                    // Add dragging class
//                    target.classList.add('dragging');
//                    // Prevent text selection during drag
//                    e.preventDefault();
//                }
//            }
//        }
//    }
//    /**
//     * Handle mouse move events
//     * @param e Mouse event
//     */
//    private handleMouseMove(e: MouseEvent): void {
//        if (!this.dragKeyframe) return;
//        const deltaX = e.clientX - this.dragStartX;
//        const deltaTime = this.pixelsToTime(deltaX);
//        const newTime = Math.max(0, this.dragStartTime + deltaTime);
//        // Update position visually
//        this.dragKeyframe.style.left = `${this.timeToPixels(newTime)}px`;
//    }
//    /**
//     * Handle mouse up events
//     * @param e Mouse event
//     */
//    private handleMouseUp(e: MouseEvent): void {
//        if (!this.dragKeyframe) return;
//        const layerId = this.dragKeyframe.getAttribute('data-layer-id');
//        const keyframeId = this.dragKeyframe.getAttribute('data-keyframe-id');
//        if (layerId && keyframeId) {
//            // Calculate new time
//            const deltaX = e.clientX - this.dragStartX;
//            const deltaTime = this.pixelsToTime(deltaX);
//            const newTime = Math.max(0, this.dragStartTime + deltaTime);
//            // Update keyframe position
//            this.options.onKeyframeMove(layerId, keyframeId, newTime);
//        }
//        // Remove dragging class
//        this.dragKeyframe.classList.remove('dragging');
//        // Reset drag state
//        this.dragKeyframe = null;
//    }
//    /**
//     * Create a motion tween between selected keyframes
//     * @returns True if successful
//     */
//    public createMotionTween(): boolean {
//        // Find selected keyframes (should be exactly 2)
//        const selectedKeyframes: { layerId: string, keyframeId: string, time: number }[] = [];
//        this.layers.forEach(layer => {
//            layer.keyframes.forEach(keyframe => {
//                if (keyframe.isSelected) {
//                    selectedKeyframes.push({
//                        layerId: layer.id,
//                        keyframeId: keyframe.id,
//                        time: keyframe.time
//                    });
//                }
//            });
//        });
//        // Check if we have exactly 2 keyframes selected and they're on the same layer
//        if (selectedKeyframes.length !== 2) {
//            return false;
//        }
//        if (selectedKeyframes[0].layerId !== selectedKeyframes[1].layerId) {
//            return false;
//        }
//        // Sort by time
//        selectedKeyframes.sort((a, b) => a.time - b.time);
//        // Create tween
//        this.options.onMotionTweenAdd(
//            selectedKeyframes[0].layerId,
//            selectedKeyframes[0].keyframeId,
//            selectedKeyframes[1].keyframeId
//        );
//        return true;
//    }
//    /**
//     * Delete selected keyframes
//     * @returns Number of keyframes deleted
//     */
//    public deleteSelectedKeyframes(): number {
//        let count = 0;
//        this.layers.forEach(layer => {
//            layer.keyframes.forEach(keyframe => {
//                if (keyframe.isSelected) {
//                    this.options.onKeyframeDelete(layer.id, keyframe.id);
//                    count++;
//                }
//            });
//        });
//        return count;
//    }
//    /**
//     * Find parent element with specific class
//     * @param element Starting element
//     * @param className Class to find
//     * @returns Parent element or null
//     */
//    private findParentWithClass(element: HTMLElement | null, className: string): HTMLElement | null {
//        while (element && !element.classList.contains(className)) {
//            element = element.parentElement;
//        }
//        return element;
//    }
//}
//# sourceMappingURL=KeyframeManager.js.map