// src/plugins/time/TimeRuler.ts
/**
 * Time Ruler
 * Manages the time ruler display at the top of the timeline
 */

import { EventEmitter } from '../../core/EventEmitter';
import { TimelineConstants } from '../../core/Constants';
import { Component } from '../../core/BaseComponent';

const { EVENTS, CSS_CLASSES, DIMENSIONS } = TimelineConstants;

export interface TimeRulerOptions {
    container: HTMLElement;
    eventEmitter: EventEmitter;
    onTimeClick: (time: number) => void;
}

export class TimeRuler extends Component {
    private eventEmitter: EventEmitter;
    private options: TimeRulerOptions;
    private timeScale: number = 1;
    private duration: number = 600; // 10 minutes in seconds
    private currentTime: number = 0;

    constructor(options: TimeRulerOptions) {
        super(options.container, 'timeline-ruler');
        this.eventEmitter = options.eventEmitter;
        this.options = options;

        this.init();
    }

    /**
     * Initialize the time ruler
     */
    private init(): void {
        this.initialize();
    }

    /**
     * Initialize event listeners
     */
    public initialize(): void {
        // We'll add event listeners after the component is rendered
        const element = this.getElement();
        if (element) {
            element.addEventListener('click', this.handleClick.bind(this));
        }
    }

    /**
     * Update time ruler settings
     * @param duration Duration in seconds
     * @param timeScale Time scale factor
     */
    public update(data: { duration?: number, timeScale?: number, currentTime?: number }): void {
        if (data.duration !== undefined) {
            this.duration = data.duration;
        }

        if (data.timeScale !== undefined) {
            this.timeScale = data.timeScale;
        }

        if (data.currentTime !== undefined) {
            this.currentTime = data.currentTime;
        }

        // Render the updated component
        const element = this.getElement();
        if (element) {
            element.innerHTML = this.renderContent();

            // Update time cursor
            this.updateTimeCursor(this.currentTime);
        }
    }

    /**
     * Render the time ruler
     */
    public render(): string {
        return `
      <div id="${this.elementId}" class="${CSS_CLASSES.RULER}">
        ${this.renderContent()}
      </div>
    `;
    }

    /**
     * Render the inner content of the ruler
     */
    private renderContent(): string {
        const rulerWidth = this.duration * this.timeScale * DIMENSIONS.PIXELS_PER_SECOND;

        let html = `<div class="timeline-ruler-content" style="width: ${rulerWidth}px;">`;

        // Add time markers
        const interval = this.getTimeInterval();
        for (let time = 0; time <= this.duration; time += interval) {
            const position = time * this.timeScale * DIMENSIONS.PIXELS_PER_SECOND;
            const isMajor = time % (interval * 5) === 0;
            const markerClass = isMajor ? 'timeline-ruler-mark-major' : 'timeline-ruler-mark-minor';

            html += `
        <div class="timeline-ruler-mark ${markerClass}" style="left: ${position}px;">
          ${isMajor ? `<div class="timeline-ruler-mark-label">${this.formatTime(time)}</div>` : ''}
        </div>
      `;
        }

        // Add time cursor
        html += `<div class="timeline-time-cursor" style="left: ${this.currentTime * this.timeScale * DIMENSIONS.PIXELS_PER_SECOND}px;"></div>`;

        html += '</div>';
        return html;
    }

    /**
     * Handle click events on the ruler
     * @param e Click event
     */
    private handleClick(e: MouseEvent): void {
        const element = this.getElement();
        if (!element) return;

        const rect = element.getBoundingClientRect();
        const x = e.clientX - rect.left;

        // Convert x position to time
        const time = x / (this.timeScale * DIMENSIONS.PIXELS_PER_SECOND);

        // Call the callback
        this.options.onTimeClick(time);
    }

    /**
     * Format time as MM:SS.ms
     * @param timeInSeconds Time in seconds
     * @returns Formatted time string
     */
    private formatTime(timeInSeconds: number): string {
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        const milliseconds = Math.floor((timeInSeconds % 1) * 100);

        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
    }

    /**
     * Determine appropriate time interval based on zoom level
     * @returns Time interval in seconds
     */
    private getTimeInterval(): number {
        if (this.timeScale <= 0.2) return 60; // 1 minute
        if (this.timeScale <= 0.5) return 30; // 30 seconds
        if (this.timeScale <= 1) return 10; // 10 seconds
        if (this.timeScale <= 2) return 5; // 5 seconds
        if (this.timeScale <= 4) return 1; // 1 second
        return 0.5; // 500 milliseconds
    }

    /**
     * Update the current time indicator (cursor)
     * @param time Current time in seconds
     */
    public updateTimeCursor(time: number): void {
        this.currentTime = time;

        const element = this.getElement();
        if (!element) return;

        const position = time * this.timeScale * DIMENSIONS.PIXELS_PER_SECOND;

        // Find or create cursor element
        let cursor = element.querySelector('.timeline-time-cursor') as HTMLElement;
        if (!cursor) {
            cursor = document.createElement('div');
            cursor.className = 'timeline-time-cursor';
            element.querySelector('.timeline-ruler-content')?.appendChild(cursor);
        }

        // Update position
        cursor.style.left = `${position}px`;
    }

    /**
     * Clean up event listeners
     */
    public destroy(): void {
        const element = this.getElement();
        if (element) {
            element.removeEventListener('click', this.handleClick.bind(this));
        }
    }
}