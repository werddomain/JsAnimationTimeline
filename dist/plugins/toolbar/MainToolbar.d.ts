/**
 * Main Toolbar
 * Manages the main timeline toolbar UI
 */
import { EventEmitter } from '../../core/EventEmitter';
import { Component } from '../../core/BaseComponent';
export interface MainToolbarOptions {
    container: HTMLElement;
    eventEmitter: EventEmitter;
    onAddKeyframe: () => void;
    onCreateMotionTween: () => void;
    onDeleteKeyframe: () => void;
    onEditKeyframe: () => void;
    onZoomChange: (scale: number) => void;
    onPlay: () => void;
    onPause: () => void;
    onStop: () => void;
    onGoToTime?: (time: number) => void;
}
export interface MainToolbarData {
    isPlaying?: boolean;
    zoomLevel?: number;
}
export declare class MainToolbar extends Component {
    private eventEmitter;
    private options;
    private isPlaying;
    private zoomLevel;
    constructor(options: MainToolbarOptions);
    /**
     * Initialize the toolbar
     */
    private init;
    /**
     * Initialize event listeners
     */
    initialize(): void;
    /**
     * Render the toolbar
     */
    render(): string;
    /**
     * Update the toolbar state
     * @param data The data to update
     */
    update(data: MainToolbarData): void;
    /**
     * Handle toolbar button clicks
     * @param e Click event
     */
    private handleClick;
    /**
     * Handle keyboard events
     * @param e Keyboard event
     */
    private handleKeydown;
    /**
     * Handle input events (for zoom slider)
     * @param e Input event
     */
    private handleInput;
    /**
     * Handle Go To Time button click
     */
    private handleGoToTime;
    /**
     * Parse time string in format MM:SS.ms or SS.ms
     * @param timeStr Time string
     * @returns Time in seconds or null if invalid
     */
    private parseTimeString;
    /**
     * Set the current zoom level on the slider
     * @param scale Zoom scale
     */
    setZoomLevel(scale: number): void;
    /**
     * Clean up event listeners
     */
    destroy(): void;
}
