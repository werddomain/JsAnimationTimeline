/**
 * TimeRuler plugin
 * Displays time markers and handles time navigation
 */

import { BaseComponent } from '../components/BaseComponent';
import { EventEmitter } from '../core/EventEmitter';
import { DataModel } from '../core/DataModel';
import { Events, CssClasses, Dimensions } from '../constants/Constants';

export interface ITimeRulerOptions {
    container: HTMLElement;
    dataModel: DataModel;
    eventEmitter: EventEmitter;
}

export class TimeRuler extends BaseComponent {
    private dataModel: DataModel;
    private eventEmitter: EventEmitter;
    private rulerContentEl: HTMLElement | null = null;
    private duration: number;
    private timeScale: number;
    
    /**
     * Constructor for TimeRuler
     * @param options - Configuration options
     */
    constructor(options: ITimeRulerOptions) {
        super(options.container, 'timeline-ruler');
        
        this.dataModel = options.dataModel;
        this.eventEmitter = options.eventEmitter;
        
        this.duration = this.dataModel.getDuration();
        this.timeScale = this.dataModel.getTimeScale();
    }
      /**
     * Initialize the TimeRuler component
     */
    public initialize(): void {
        if (!this.element) {
            throw new Error('Cannot initialize TimeRuler - element not created. Make sure to call mount() before initialize().');
        }
        
        // Ensure the content element exists by rendering the component first
        if (!this.element.querySelector(`.${CssClasses.RULER_CONTENT}`)) {
            // If content element doesn't exist yet, update the HTML content
            this.element.innerHTML = this.render();
        }
        
        // Set up event listeners
        this.eventEmitter.on(Events.DURATION_CHANGED, this.handleDurationChanged.bind(this));
        this.eventEmitter.on(Events.SCALE_CHANGED, this.handleScaleChanged.bind(this));
        
        // Add click handler for seeking
        this.element.addEventListener('click', this.handleRulerClick.bind(this));
        
        // Get the ruler content element
        this.rulerContentEl = this.element.querySelector(`.${CssClasses.RULER_CONTENT}`);
        if (!this.rulerContentEl) {
            throw new Error('TimeRuler content element not found. Check if the HTML structure is correct.');
        }
        
        console.log('TimeRuler initialized successfully');
    }
    
    /**
     * Render the TimeRuler component
     * @returns HTML string representation
     */
    public render(): string {
        const width = this.calculateRulerWidth();
        
        return `
            <div class="${CssClasses.RULER_CONTENT}" style="width: ${width}px">
                ${this.generateTimeMarkers()}
            </div>
        `;
    }
    
    /**
     * Update the TimeRuler component
     * @param data - New data for the component
     */
    public update(data?: any): void {
        if (!this.rulerContentEl) return;
        
        const width = this.calculateRulerWidth();
        this.rulerContentEl.style.width = `${width}px`;
        this.rulerContentEl.innerHTML = this.generateTimeMarkers();
    }
    
    /**
     * Destroy the TimeRuler component and clean up resources
     */
    public destroy(): void {
        // Remove event listeners
        this.eventEmitter.off(Events.DURATION_CHANGED, this.handleDurationChanged.bind(this));
        this.eventEmitter.off(Events.SCALE_CHANGED, this.handleScaleChanged.bind(this));
        
        if (this.element) {
            this.element.removeEventListener('click', this.handleRulerClick.bind(this));
        }
    }
    
    /**
     * Calculate the width of the ruler based on duration and time scale
     * @returns Width in pixels
     */
    private calculateRulerWidth(): number {
        return Math.max(100, this.duration * this.timeScale);
    }
    
    /**
     * Generate HTML for time markers
     * @returns HTML string for time markers
     */
    private generateTimeMarkers(): string {
        const markerInterval = this.getMarkerInterval();
        const markers = [];
        
        // Add start marker
        markers.push(`
            <div class="${CssClasses.TIME_MARKER} ${CssClasses.TIME_MARKER_MAJOR}" style="left: 0px">
                <div class="${CssClasses.TIME_LABEL}">0:00</div>
            </div>
        `);
        
        // Add intermediate markers
        for (let time = markerInterval; time < this.duration; time += markerInterval) {
            const isMajor = this.isMajorMarker(time);
            const position = time * this.timeScale;
            
            markers.push(`
                <div class="${CssClasses.TIME_MARKER}${isMajor ? ' ' + CssClasses.TIME_MARKER_MAJOR : ''}" style="left: ${position}px">
                    ${isMajor ? `<div class="${CssClasses.TIME_LABEL}">${this.formatTime(time)}</div>` : ''}
                </div>
            `);
        }
        
        // Add end marker
        const endPosition = this.duration * this.timeScale;
        markers.push(`
            <div class="${CssClasses.TIME_MARKER} ${CssClasses.TIME_MARKER_MAJOR}" style="left: ${endPosition}px">
                <div class="${CssClasses.TIME_LABEL}">${this.formatTime(this.duration)}</div>
            </div>
        `);
        
        return markers.join('');
    }
    
    /**
     * Get the interval between markers based on time scale
     * @returns Interval in seconds
     */
    private getMarkerInterval(): number {
        // Adjust marker interval based on zoom level
        if (this.timeScale > 200) return 0.5; // Show markers every 0.5 seconds when zoomed in
        if (this.timeScale > 100) return 1; // Show markers every second
        if (this.timeScale > 50) return 2; // Show markers every 2 seconds
        if (this.timeScale > 20) return 5; // Show markers every 5 seconds
        return 10; // Show markers every 10 seconds when zoomed out
    }
    
    /**
     * Determine if a marker is a major marker
     * @param time - Time in seconds
     * @returns True if it's a major marker, false otherwise
     */
    private isMajorMarker(time: number): boolean {
        if (this.timeScale > 200) return Number.isInteger(time); // Every integer second is major when zoomed in
        if (this.timeScale > 100) return time % 5 === 0; // Every 5 seconds is major
        if (this.timeScale > 50) return time % 10 === 0; // Every 10 seconds is major
        if (this.timeScale > 20) return time % 30 === 0; // Every 30 seconds is major
        return time % 60 === 0; // Every minute is major when zoomed out
    }
    
    /**
     * Format time in minutes:seconds format
     * @param time - Time in seconds
     * @returns Formatted time string
     */
    private formatTime(time: number): string {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    /**
     * Handle ruler click to seek to a specific time
     * @param event - Click event
     */
    private handleRulerClick(event: MouseEvent): void {
        if (!this.rulerContentEl) return;
        
        // Get the click position relative to the ruler
        const rect = this.rulerContentEl.getBoundingClientRect();
        const scrollLeft = this.element?.parentElement?.scrollLeft || 0;
        const clickX = event.clientX - rect.left + scrollLeft;
        
        // Convert position to time
        const time = clickX / this.timeScale;
        
        // Seek to the time
        this.dataModel.setCurrentTime(time);
        this.eventEmitter.emit(Events.SEEK, { time }, this);
    }
    
    /**
     * Handle duration changed event
     * @param event - Duration changed event
     */
    private handleDurationChanged(event: any): void {
        this.duration = event.data.duration;
        this.update();
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
