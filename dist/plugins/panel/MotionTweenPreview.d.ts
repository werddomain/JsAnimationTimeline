/**
 * Motion Tween Preview Component
 * Provides a preview of CSS animations generated from motion tweens
 */
import { Component } from '../../core/BaseComponent';
import { EventEmitter } from '../../core/EventEmitter';
import { Layer, MotionTween } from '../../core/DataModel';
export interface MotionTweenPreviewOptions {
    container: HTMLElement;
    eventEmitter: EventEmitter;
}
export declare class MotionTweenPreview extends Component {
    private eventEmitter;
    private options;
    private currentLayer;
    private currentTween;
    private previewElement;
    private styleElement;
    private animationName;
    private isPlaying;
    private exportableCSS;
    constructor(options: MotionTweenPreviewOptions);
    /**
     * Initialize the preview component
     */
    private init;
    /**
     * Initialize event listeners
     */
    initialize(): void;
    /**
     * Set the current tween for preview
     */
    setTween(layer: Layer, tween: MotionTween): void;
    /**
     * Clear the current preview
     */
    clearPreview(): void;
    /**
     * Create a preview for the current tween
     */
    private createPreview;
    /**
     * Update the preview at a specific time
     */
    private updatePreviewAtTime;
    /**
     * Convert camelCase to dash-case
     */
    private camelToDash;
    /**
     * Format a value for CSS
     */
    private formatCssValue;
    /**
     * Play the animation
     */
    private playAnimation;
    /**
     * Pause the animation
     */
    private pauseAnimation;
    /**
     * Update the play button state
     */
    private updatePlayButton;
    /**
     * Export the CSS animation
     */
    private exportAnimation;
    /**
     * Handle click events
     */
    private handleClick;
    /**
     * Generate HTML for the preview component
     */
    render(): string;
    /**
     * Escape HTML in CSS for safe display
     */
    private escapeCss;
    /**
     * Format time as MM:SS.ms
     */
    private formatTime;
    /**
     * Update the preview component
     */
    update(data: any): void;
    /**
     * Clean up event listeners
     */
    destroy(): void;
}
