/**
 * Time Ruler
 * Manages the time ruler display at the top of the timeline
 */
import { EventEmitter } from '../../core/EventEmitter';
import { Component } from '../../core/BaseComponent';
export interface TimeRulerOptions {
    container: HTMLElement;
    eventEmitter: EventEmitter;
    onTimeClick: (time: number) => void;
}
export declare class TimeRuler extends Component {
    private eventEmitter;
    private options;
    private timeScale;
    private duration;
    private currentTime;
    constructor(options: TimeRulerOptions);
    /**
     * Initialize the time ruler
     */
    private init;
    /**
     * Initialize event listeners
     */
    initialize(): void;
    /**
     * Update time ruler settings
     * @param duration Duration in seconds
     * @param timeScale Time scale factor
     */
    update(data: {
        duration?: number;
        timeScale?: number;
        currentTime?: number;
    }): void;
    /**
     * Render the time ruler
     */
    render(): string;
    /**
     * Render the inner content of the ruler
     */
    private renderContent;
    /**
     * Handle click events on the ruler
     * @param e Click event
     */
    private handleClick;
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
     * Update the current time indicator (cursor)
     * @param time Current time in seconds
     */
    updateTimeCursor(time: number): void;
    /**
     * Clean up event listeners
     */
    destroy(): void;
}
