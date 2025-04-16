import { BaseComponent } from '@core/BaseComponent';
import { DataModel } from '@core/DataModel';
import { EventEmitter } from '@core/EventEmitter';
import { Events } from '@utils/EventTypes';

/**
 * Options for initializing the TimeRuler
 */
export interface TimeRulerOptions {
    container: HTMLElement;
    id?: string;
}

/**
 * TimeRuler plugin that displays time markers and handles time navigation
 */
export class TimeRuler extends BaseComponent {
    private dataModel: DataModel;
    private eventEmitter: EventEmitter;
    private rulerContentEl: HTMLElement | null = null;
    private isDragging: boolean = false;
    private currentTimeIndicator: HTMLElement | null = null;
    
    // Plugin metadata
    public metadata = {
        name: 'TimeRuler',
        version: '1.0.0'
    };

    /**
     * Constructor for TimeRuler
     * @param options Options for initializing the time ruler
     */
    constructor(options: TimeRulerOptions) {
        super(options.container, options.id || 'timeline-ruler');
        this.dataModel = DataModel.getInstance();
        this.eventEmitter = EventEmitter.getInstance();
    }

    /**
     * Initialize the time ruler
     */
    public initialize(): void {
        if (!this.element) {
            console.error('TimeRuler element not found');
            return;
        }

        // Find the ruler content element
        this.rulerContentEl = this.element.querySelector('.timeline-ruler-content') as HTMLElement;
        if (!this.rulerContentEl) {
            console.error('TimeRuler content element not found');
            return;
        }

        // Add event listeners
        this.rulerContentEl.addEventListener('mousedown', this.handleMouseDown);
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);

        // Add current time indicator
        this.currentTimeIndicator = document.createElement('div');
        this.currentTimeIndicator.className = 'timeline-current-time-indicator';
        this.rulerContentEl.appendChild(this.currentTimeIndicator);

        // Listen for events
        this.eventEmitter.on(Events.TIME_CHANGED, this.handleTimeChanged, this);
        this.eventEmitter.on(Events.TIME_SCALE_CHANGED, this.handleTimeScaleChanged, this);

        // Initial render
        this.renderTimeMarkers();
        this.updateCurrentTimeIndicator();
    }

    /**
     * Render the time ruler
     * @returns HTML string for the time ruler
     */
    public render(): string {
        return `
            <div id="${this.id}" class="timeline-ruler">
                <div class="timeline-ruler-content"></div>
            </div>
        `;
    }

    /**
     * Update the time ruler with new data
     * @param data The data to update with
     */
    public update(data: any): void {
        this.renderTimeMarkers();
        this.updateCurrentTimeIndicator();
    }

    /**
     * Clean up the time ruler
     */
    public destroy(): void {
        if (this.rulerContentEl) {
            this.rulerContentEl.removeEventListener('mousedown', this.handleMouseDown);
        }
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);

        this.eventEmitter.off(Events.TIME_CHANGED, this.handleTimeChanged);
        this.eventEmitter.off(Events.TIME_SCALE_CHANGED, this.handleTimeScaleChanged);
    }

    /**
     * Handle mouse down on the ruler
     * @param event Mouse event
     */
    private handleMouseDown = (event: MouseEvent): void => {
        this.isDragging = true;
        this.updateTimeFromMousePosition(event);
    };

    /**
     * Handle mouse move
     * @param event Mouse event
     */
    private handleMouseMove = (event: MouseEvent): void => {
        if (this.isDragging) {
            this.updateTimeFromMousePosition(event);
        }
    };

    /**
     * Handle mouse up
     */
    private handleMouseUp = (): void => {
        this.isDragging = false;
    };

    /**
     * Update current time based on mouse position
     * @param event Mouse event
     */
    private updateTimeFromMousePosition(event: MouseEvent): void {
        if (!this.rulerContentEl) {
            return;
        }

        // Get ruler bounds
        const rect = this.rulerContentEl.getBoundingClientRect();
        
        // Calculate click position relative to the ruler content
        // Account for horizontal scroll
        const scrollLeft = (this.rulerContentEl.parentElement?.scrollLeft || 0);
        const clickX = event.clientX - rect.left + scrollLeft;
        
        // Convert to time
        const time = this.dataModel.pixelsToTime(clickX);
        
        // Update the data model
        this.dataModel.setCurrentTime(time, this);
    }

    /**
     * Handle time changed event
     */
    private handleTimeChanged = (sender: any, data: { time: number }): void => {
        this.updateCurrentTimeIndicator();
    };

    /**
     * Handle time scale changed event
     */
    private handleTimeScaleChanged = (sender: any, data: { timeScale: number }): void => {
        this.renderTimeMarkers();
        this.updateCurrentTimeIndicator();
    };

    /**
     * Render time markers based on the current time scale
     */
    private renderTimeMarkers(): void {
        if (!this.rulerContentEl) {
            return;
        }

        // Clear existing markers
        const markers = this.rulerContentEl.querySelectorAll('.timeline-time-marker');
        markers.forEach(marker => marker.remove());

        // Calculate total width based on duration, scale, and pixels per second
        const duration = this.dataModel.getDuration();
        const timeScale = this.dataModel.getTimeScale();
        const pixelsPerSecond = this.dataModel.getPixelsPerSecond();
        const totalWidth = duration * timeScale * pixelsPerSecond;

        // Set ruler content width
        this.rulerContentEl.style.width = `${totalWidth}px`;

        // Determine appropriate marker interval based on time scale
        // - For zoomed out views, use larger intervals
        // - For zoomed in views, use smaller intervals
        let majorInterval: number; // Seconds between labeled markers
        let minorCount: number;    // Number of minor markers between major ones
        
        if (timeScale * pixelsPerSecond <= 5) {
            // Very zoomed out
            majorInterval = 60; // 1 minute
            minorCount = 6;     // 10 seconds
        } else if (timeScale * pixelsPerSecond <= 30) {
            // Zoomed out
            majorInterval = 30; // 30 seconds
            minorCount = 6;     // 5 seconds
        } else if (timeScale * pixelsPerSecond <= 60) {
            // Default zoom
            majorInterval = 10; // 10 seconds
            minorCount = 10;    // 1 second
        } else if (timeScale * pixelsPerSecond <= 120) {
            // Zoomed in
            majorInterval = 5;  // 5 seconds
            minorCount = 5;     // 1 second
        } else {
            // Very zoomed in
            majorInterval = 1;  // 1 second
            minorCount = 4;     // 0.25 seconds
        }

        // Create major markers with labels
        for (let time = 0; time <= duration; time += majorInterval) {
            const position = time * timeScale * pixelsPerSecond;
            
            // Create marker
            const marker = document.createElement('div');
            marker.className = 'timeline-time-marker';
            marker.style.left = `${position}px`;
            
            // Create label
            const label = document.createElement('div');
            label.className = 'timeline-time-marker-label';
            
            // Format time (MM:SS)
            const minutes = Math.floor(time / 60);
            const seconds = Math.floor(time % 60);
            label.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            marker.appendChild(label);
            this.rulerContentEl.appendChild(marker);
            
            // Create minor markers between major markers
            if (time < duration) {
                const minorInterval = majorInterval / minorCount;
                for (let i = 1; i < minorCount; i++) {
                    const minorTime = time + (i * minorInterval);
                    if (minorTime <= duration) {
                        const minorPosition = minorTime * timeScale * pixelsPerSecond;
                        
                        const minorMarker = document.createElement('div');
                        minorMarker.className = 'timeline-time-marker';
                        minorMarker.style.left = `${minorPosition}px`;
                        minorMarker.style.height = '50%';
                        minorMarker.style.top = '50%';
                        
                        this.rulerContentEl.appendChild(minorMarker);
                    }
                }
            }
        }
    }

    /**
     * Update the current time indicator position
     */
    private updateCurrentTimeIndicator(): void {
        if (!this.currentTimeIndicator) {
            return;
        }

        const currentTime = this.dataModel.getCurrentTime();
        const timeScale = this.dataModel.getTimeScale();
        const pixelsPerSecond = this.dataModel.getPixelsPerSecond();
        const position = currentTime * timeScale * pixelsPerSecond;

        this.currentTimeIndicator.style.left = `${position}px`;
    }
}
