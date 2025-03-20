/**
 * Keyframe Manager
 * Manages keyframes and motion tweens on the timeline
 */
import { Layer } from '../../core/DataModel';
import { EventEmitter } from '../../core/EventEmitter';
import { Component } from '../../core/BaseComponent';
export interface KeyframeManagerOptions {
    container: HTMLElement;
    eventEmitter: EventEmitter;
    onKeyframeSelect: (layerId: string, keyframeId: string, multiSelect: boolean) => void;
    onKeyframeMove: (layerId: string, keyframeId: string, newTime: number) => void;
    onKeyframeAdd: (layerId: string, time: number) => void;
    onKeyframeDelete: (layerId: string, keyframeId: string) => void;
    onMotionTweenAdd: (layerId: string, startKeyframeId: string, endKeyframeId: string) => void;
    onMotionTweenDelete: (layerId: string, tweenId: string) => void;
}
export interface KeyframeManagerData {
    layers: Layer[];
    timeScale: number;
}
export declare class KeyframeManager extends Component {
    private eventEmitter;
    private options;
    private layers;
    private timeScale;
    private dragKeyframe;
    private dragStartX;
    private dragStartTime;
    private canvasElements;
    private selectedTweenId;
    constructor(options: KeyframeManagerOptions);
    /**
     * Initialize the keyframe manager
     */
    private init;
    /**
     * Initialize event listeners
     */
    initialize(): void;
    /**
     * Update layers and render
     * @param data Updated data
     */
    update(data: KeyframeManagerData): void;
    /**
     * Render the keyframes container
     */
    render(): string;
    /**
     * Render the inner content
     */
    private renderContent;
    /**
 * Render keyframes on canvas
 * @param layer Layer data
 * @param canvas Canvas element
 */
    private renderLayerKeyframes;
    /**
     * Generate HTML for interactive keyframe elements
     * @param layer Layer data
     * @returns HTML string
     */
    private renderKeyframeElements;
    /**
     * Convert time to pixel position
     * @param time Time in seconds
     * @returns X position in pixels
     */
    private timeToPixels;
    /**
     * Convert pixel position to time
     * @param pixels X position in pixels
     * @returns Time in seconds
     */
    private pixelsToTime;
    /**
     * Format time as MM:SS.ms
     * @param timeInSeconds Time in seconds
     * @returns Formatted time string
     */
    private formatTime;
    /**
     * Determine appropriate time interval based on zoom level
     * @returns Time interval in seconds
     */
    private getTimeInterval;
    /**
 * Handle click events
 * @param e Mouse event
 */
    private handleClick;
    /**
 * Select a motion tween
 */
    private selectMotionTween;
    /**
     * Deselect the motion tween
     */
    private deselectMotionTween;
    /**
 * Update tween display
 */
    private updateTweenDisplay;
    /**
     * Handle double click events
     * @param e Mouse event
     */
    private handleDoubleClick;
    /**
     * Handle mouse down events
     * @param e Mouse event
     */
    private handleMouseDown;
    /**
     * Handle mouse move events
     * @param e Mouse event
     */
    private handleMouseMove;
    /**
     * Handle mouse up events
     * @param e Mouse event
     */
    private handleMouseUp;
    /**
     * Create a motion tween between selected keyframes
     * @returns True if successful
     */
    createMotionTween(): boolean;
    /**
     * Delete selected keyframes
     * @returns Number of keyframes deleted
     */
    deleteSelectedKeyframes(): number;
    /**
     * Find parent element with specific class
     * @param element Starting element
     * @param className Class to find
     * @returns Parent element or null
     */
    private findParentWithClass;
    /**
     * Clean up event listeners
     */
    destroy(): void;
} /**
 * Keyframe Manager
 * Manages keyframes and motion tweens on the timeline
 */
