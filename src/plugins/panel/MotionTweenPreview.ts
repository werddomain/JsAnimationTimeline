// src/plugins/panel/MotionTweenPreview.ts
/**
 * Motion Tween Preview Component
 * Provides a preview of CSS animations generated from motion tweens
 */

import { Component } from '../../core/BaseComponent';
import { EventEmitter } from '../../core/EventEmitter';
import { Layer, MotionTween } from '../../core/DataModel';
import { CssAnimationGenerator } from './CssAnimationGenerator';

export interface MotionTweenPreviewOptions {
    container: HTMLElement;
    eventEmitter: EventEmitter;
}

export class MotionTweenPreview extends Component {
    private eventEmitter: EventEmitter;
    private options: MotionTweenPreviewOptions;
    private currentLayer: Layer | null = null;
    private currentTween: MotionTween | null = null;
    private previewElement: HTMLElement | null = null;
    private styleElement: HTMLStyleElement | null = null;
    private animationName: string = '';
    private isPlaying: boolean = false;
    private exportableCSS: string = '';

    constructor(options: MotionTweenPreviewOptions) {
        super(options.container, 'timeline-motion-tween-preview');
        this.eventEmitter = options.eventEmitter;
        this.options = options;

        this.init();
    }

    /**
     * Initialize the preview component
     */
    private init(): void {
        this.initialize();

        // Listen for tween selection events
        this.eventEmitter.on('motion:tween:selected', (layer: Layer, tween: MotionTween) => {
            this.setTween(layer, tween);
        });

        this.eventEmitter.on('motion:tween:deselected', () => {
            this.clearPreview();
        });

        // Listen for time change events to update preview
        this.eventEmitter.on('time:changed', (time: number) => {
            this.updatePreviewAtTime(time);
        });
    }

    /**
     * Initialize event listeners
     */
    public initialize(): void {
        const element = this.getElement();
        if (element) {
            element.addEventListener('click', this.handleClick.bind(this));
        }
    }

    /**
     * Set the current tween for preview
     */
    public setTween(layer: Layer, tween: MotionTween): void {
        this.currentLayer = layer;
        this.currentTween = tween;

        // Create the preview
        this.createPreview();

        // Update UI
        this.update({});
    }

    /**
     * Clear the current preview
     */
    public clearPreview(): void {
        this.currentLayer = null;
        this.currentTween = null;
        this.exportableCSS = '';

        // Update UI
        this.update({});

        // Remove any style elements
        if (this.styleElement && this.styleElement.parentNode) {
            this.styleElement.parentNode.removeChild(this.styleElement);
            this.styleElement = null;
        }
    }

    /**
     * Create a preview for the current tween
     */
    private createPreview(): void {
        if (!this.currentLayer || !this.currentTween) return;

        try {
            // Generate CSS animation
            const result = CssAnimationGenerator.generateFromTween(this.currentLayer, this.currentTween, {
                duration: 2,
                timingFunction: this.currentTween.easingFunction || 'linear',
                iterationCount: 'infinite',
                direction: 'alternate'
            });

            this.animationName = result.animationName;
            this.exportableCSS = result.css;

            // Add the style to the document head
            if (this.styleElement) {
                document.head.removeChild(this.styleElement);
            }

            this.styleElement = document.createElement('style');
            this.styleElement.textContent = result.css;
            document.head.appendChild(this.styleElement);
        } catch (error) {
            console.error('Error creating preview:', error);
        }
    }

    /**
     * Update the preview at a specific time
     */
    private updatePreviewAtTime(time: number): void {
        if (!this.currentLayer || !this.currentTween || this.isPlaying) return;

        const element = this.getElement();
        if (!element) return;

        // Find preview container
        const previewContainer = element.querySelector('.timeline-motion-tween-preview-content');
        if (!previewContainer) return;

        // Find start and end keyframes
        const startKeyframe = this.currentLayer.keyframes.find(k => k.id === this.currentTween?.startKeyframeId);
        const endKeyframe = this.currentLayer.keyframes.find(k => k.id === this.currentTween?.endKeyframeId);

        if (!startKeyframe || !endKeyframe) return;

        // Only update if time is within the tween range
        if (time < startKeyframe.time || time > endKeyframe.time) return;

        // Calculate progress (0 to 1)
        const totalTime = endKeyframe.time - startKeyframe.time;
        const elapsed = time - startKeyframe.time;
        const progress = totalTime > 0 ? elapsed / totalTime : 0;

        try {
            // Generate properties at the current time
            const properties = CssAnimationGenerator.generatePreviewAtProgress(
                this.currentLayer,
                this.currentTween,
                progress
            );

            // Update preview element styles
            const previewElement = previewContainer.querySelector('.timeline-motion-tween-preview-element');
            if (previewElement) {
                // Apply each property
                Object.entries(properties).forEach(([key, value]) => {
                    const cssKey = this.camelToDash(key);
                    (previewElement as HTMLElement).style.setProperty(cssKey, this.formatCssValue(key, value));
                });
            }
        } catch (error) {
            console.error('Error updating preview:', error);
        }
    }

    /**
     * Convert camelCase to dash-case
     */
    private camelToDash(str: string): string {
        return str.replace(/([A-Z])/g, '-$1').toLowerCase();
    }

    /**
     * Format a value for CSS
     */
    private formatCssValue(key: string, value: any): string {
        if (typeof value === 'number') {
            // Add px unit for certain properties
            const pxProperties = [
                'width', 'height', 'top', 'left', 'right', 'bottom',
                'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
                'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
                'fontSize', 'lineHeight', 'borderWidth', 'borderRadius', 'letterSpacing'
            ];

            if (pxProperties.some(prop => key === prop || key.startsWith(prop))) {
                return `${value}px`;
            }

            // Add deg unit for rotation properties
            if (key === 'rotation' || key === 'rotate') {
                return `${value}deg`;
            }
        }

        return value.toString();
    }

    /**
     * Play the animation
     */
    private playAnimation(): void {
        if (!this.currentLayer || !this.currentTween) return;

        const element = this.getElement();
        if (!element) return;

        // Find preview container
        const previewContainer = element.querySelector('.timeline-motion-tween-preview-content');
        if (!previewContainer) return;

        // Find or create preview element
        let previewElement = previewContainer.querySelector('.timeline-motion-tween-preview-element');
        if (!previewElement) {
            previewElement = document.createElement('div');
            previewElement.className = 'timeline-motion-tween-preview-element';
            previewContainer.appendChild(previewElement);
        }

        // Start the animation
        (previewElement as HTMLElement).className = `timeline-motion-tween-preview-element ${this.animationName}`;
        this.isPlaying = true;

        // Update UI
        this.updatePlayButton(true);
    }

    /**
     * Pause the animation
     */
    private pauseAnimation(): void {
        const element = this.getElement();
        if (!element) return;

        // Find preview element
        const previewElement = element.querySelector('.timeline-motion-tween-preview-element');
        if (!previewElement) return;

        // Remove animation class
        (previewElement as HTMLElement).className = 'timeline-motion-tween-preview-element';
        this.isPlaying = false;

        // Update UI
        this.updatePlayButton(false);
    }

    /**
     * Update the play button state
     */
    private updatePlayButton(isPlaying: boolean): void {
        const element = this.getElement();
        if (!element) return;

        const playButton = element.querySelector('[data-action="play-animation"]') as HTMLElement;
        const pauseButton = element.querySelector('[data-action="pause-animation"]') as HTMLElement;

        if (playButton && pauseButton) {
            playButton.style.display = isPlaying ? 'none' : 'block';
            pauseButton.style.display = isPlaying ? 'block' : 'none';
        }
    }

    /**
     * Export the CSS animation
     */
    private exportAnimation(): void {
        if (!this.exportableCSS) return;

        // Create a Blob with the CSS content
        const blob = new Blob([this.exportableCSS], { type: 'text/css' });

        // Create a download link
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${this.animationName}.css`;

        // Trigger the download
        document.body.appendChild(a);
        a.click();

        // Clean up
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    }

    /**
     * Handle click events
     */
    private handleClick(e: MouseEvent): void {
        const target = e.target as HTMLElement;
        if (!target) return;

        // Check for button clicks
        const button = target.closest('[data-action]') as HTMLElement;
        if (!button) return;

        const action = button.getAttribute('data-action');
        switch (action) {
            case 'play-animation':
                this.playAnimation();
                break;
            case 'pause-animation':
                this.pauseAnimation();
                break;
            case 'export-animation':
                this.exportAnimation();
                break;
        }
    }

    /**
     * Generate HTML for the preview component
     */
    public render(): string {
        // If no tween is selected, show empty state
        if (!this.currentLayer || !this.currentTween) {
            return `
        <div id="${this.elementId}" class="timeline-motion-tween-preview">
          <div class="timeline-motion-tween-preview-header">
            <h3>Animation Preview</h3>
          </div>
          <div class="timeline-motion-tween-preview-empty">
            Select a motion tween to preview animation
          </div>
        </div>
      `;
        }

        // Get keyframe information
        const startKeyframe = this.currentLayer.keyframes.find(k => k.id === this.currentTween?.startKeyframeId);
        const endKeyframe = this.currentLayer.keyframes.find(k => k.id === this.currentTween?.endKeyframeId);

        return `
      <div id="${this.elementId}" class="timeline-motion-tween-preview">
        <div class="timeline-motion-tween-preview-header">
          <h3>Animation Preview</h3>
          <div class="timeline-motion-tween-preview-info">
            <div class="timeline-motion-tween-preview-layer">${this.currentLayer.name}</div>
            <div class="timeline-motion-tween-preview-time">
              ${startKeyframe ? this.formatTime(startKeyframe.time) : '00:00'} - 
              ${endKeyframe ? this.formatTime(endKeyframe.time) : '00:00'}
            </div>
          </div>
        </div>
        
        <div class="timeline-motion-tween-preview-content">
          <!-- Preview element will be added here -->
          <div class="timeline-motion-tween-preview-element"></div>
        </div>
        
        <div class="timeline-motion-tween-preview-controls">
          <button class="timeline-btn" data-action="play-animation" title="Play Animation">
            <span class="timeline-icon">▶️</span>
            <span>Play</span>
          </button>
          <button class="timeline-btn" data-action="pause-animation" title="Pause Animation" style="display: none;">
            <span class="timeline-icon">⏸️</span>
            <span>Pause</span>
          </button>
          <button class="timeline-btn" data-action="export-animation" title="Export CSS Animation">
            <span class="timeline-icon">📁</span>
            <span>Export CSS</span>
          </button>
        </div>
        
        <div class="timeline-motion-tween-preview-css">
          <h4>Generated CSS</h4>
          <pre><code>${this.escapeCss(this.exportableCSS)}</code></pre>
        </div>
      </div>
    `;
    }

    /**
     * Escape HTML in CSS for safe display
     */
    private escapeCss(css: string): string {
        return css
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Format time as MM:SS.ms
     */
    private formatTime(seconds: number): string {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        const milliseconds = Math.floor((seconds % 1) * 100);

        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
    }

    /**
     * Update the preview component
     */
    public update(data: any): void {
        const element = this.getElement();
        if (element) {
            element.innerHTML = this.render();
        }
    }

    /**
     * Clean up event listeners
     */
    public destroy(): void {
        // Clean up style element
        if (this.styleElement && this.styleElement.parentNode) {
            this.styleElement.parentNode.removeChild(this.styleElement);
        }

        const element = this.getElement();
        if (element) {
            element.removeEventListener('click', this.handleClick.bind(this));
        }
    }
}