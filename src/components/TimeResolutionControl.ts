/**
 * TimeResolutionControl component
 * Controls the time resolution (step value) for keyframes
 */

import { BaseComponent } from './BaseComponent';
import { EventEmitter } from '../core/EventEmitter';
import { DataModel } from '../core/DataModel';
import { Events, CssClasses, TimeResolutions } from '../constants/Constants';

export interface ITimeResolutionControlOptions {
    container: HTMLElement;
    dataModel: DataModel;
    eventEmitter: EventEmitter;
}

export class TimeResolutionControl extends BaseComponent {
    private dataModel: DataModel;
    private eventEmitter: EventEmitter;
    private currentResolution: number;
    private controlEl: HTMLElement | null = null;
    private selectorEl: HTMLSelectElement | null = null;
    
    /**
     * Constructor for TimeResolutionControl
     * @param options - Configuration options
     */
    constructor(options: ITimeResolutionControlOptions) {
        super(options.container, CssClasses.TIME_RESOLUTION_CONTROL);
        
        this.dataModel = options.dataModel;        this.eventEmitter = options.eventEmitter;
        
        // Get current resolution from dataModel if available
        if (typeof (this.dataModel as any).getTimeResolution === 'function') {
            this.currentResolution = (this.dataModel as any).getTimeResolution();
        } else {
            this.currentResolution = TimeResolutions.SECOND; // Default to 1 second resolution
        }
    }
    
    /**
     * Initialize the TimeResolutionControl component
     */
    public initialize(): void {
        if (!this.element) {
            throw new Error('Cannot initialize TimeResolutionControl - element not created. Make sure to call mount() before initialize().');
        }
        
        // Add the control DOM
        this.element.innerHTML = this.render();
        
        // Get the control elements
        this.controlEl = this.element;
        this.selectorEl = this.element.querySelector('select') as HTMLSelectElement;
        
        // Add event listener for the select change
        if (this.selectorEl) {
            this.selectorEl.addEventListener('change', this.handleResolutionChange.bind(this));
        }
        
        // Listen for resolution change events
        this.eventEmitter.on(Events.RESOLUTION_CHANGED, this.updateDisplay.bind(this));
        
        // Set initial resolution and update display
        this.setResolution(this.currentResolution);
    }
    
    /**
     * Render the TimeResolutionControl component
     * @returns HTML string representation
     */
    public render(): string {
        return `
            <div class="resolution-control-wrapper">
                <label for="time-resolution-select">Time Resolution:</label>
                <select id="time-resolution-select">
                    <option value="${TimeResolutions.MILLISECOND}">1ms (1/1000s)</option>
                    <option value="${TimeResolutions.CENTISECOND}">10ms (1/100s)</option>
                    <option value="${TimeResolutions.DECISECOND}">100ms (1/10s)</option>
                    <option value="${TimeResolutions.SECOND}" selected>1 second</option>
                    <option value="${TimeResolutions.FIVE_SECONDS}">5 seconds</option>
                    <option value="${TimeResolutions.TEN_SECONDS}">10 seconds</option>
                    <option value="${TimeResolutions.THIRTY_SECONDS}">30 seconds</option>
                    <option value="${TimeResolutions.MINUTE}">1 minute</option>
                </select>
            </div>
        `;
    }
    
    /**
     * Handle resolution change from dropdown
     * @param event - Change event
     */
    private handleResolutionChange(event: Event): void {
        const value = parseFloat((event.target as HTMLSelectElement).value);
        this.setResolution(value);
    }
    
    /**
     * Set the current time resolution
     * @param resolution - Resolution value in seconds
     */
    public setResolution(resolution: number): void {
        this.currentResolution = resolution;
          // Update the data model
        if (this.dataModel && typeof (this.dataModel as any).setTimeResolution === 'function') {
            (this.dataModel as any).setTimeResolution(resolution);
        }
        
        // Update the display
        this.updateDisplay();
        
        // Emit resolution changed event
        this.eventEmitter.emit(Events.RESOLUTION_CHANGED, { resolution }, this);
    }
    
    /**
     * Get the current time resolution
     * @returns Current resolution in seconds
     */
    public getResolution(): number {
        return this.currentResolution;
    }
    
    /**
     * Update the TimeResolutionControl component
     * @param data - Data to update the component with
     */
    public update(data?: any): void {
        if (data && typeof data.resolution === 'number') {
            this.setResolution(data.resolution);
        }
        this.updateDisplay();
    }
    
    /**
     * Update the display based on the current resolution
     */
    private updateDisplay(): void {
        if (this.selectorEl) {
            this.selectorEl.value = this.currentResolution.toString();
        }
    }
    
    /**
     * Destroy the component and clean up
     */
    public destroy(): void {
        // Remove event listeners
        if (this.selectorEl) {
            this.selectorEl.removeEventListener('change', this.handleResolutionChange.bind(this));
        }
        
        this.eventEmitter.off(Events.RESOLUTION_CHANGED, this.updateDisplay.bind(this));
    }
}
