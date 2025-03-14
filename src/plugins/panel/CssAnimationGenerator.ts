// src/plugins/panel/CssAnimationGenerator.ts
/**
 * CSS Animation Generator
 * Generates CSS animations from keyframes and motion tweens
 */

import { Keyframe, MotionTween, Layer } from '../../core/DataModel';

export interface AnimationOptions {
    name?: string;
    duration?: number;
    timingFunction?: string;
    iterationCount?: number | 'infinite';
    direction?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
    fillMode?: 'none' | 'forwards' | 'backwards' | 'both';
}

export class CssAnimationGenerator {
    private static readonly DEFAULT_OPTIONS: AnimationOptions = {
        duration: 1,
        timingFunction: 'linear',
        iterationCount: 1,
        direction: 'normal',
        fillMode: 'forwards'
    };

    /**
     * Generate CSS animation for a motion tween
     */
    public static generateFromTween(
        layer: Layer,
        tween: MotionTween,
        options: AnimationOptions = {}
    ): { css: string, animationName: string } {
        // Find start and end keyframes
        const startKeyframe = layer.keyframes.find(k => k.id === tween.startKeyframeId);
        const endKeyframe = layer.keyframes.find(k => k.id === tween.endKeyframeId);

        if (!startKeyframe || !endKeyframe) {
            throw new Error('Cannot generate animation: keyframes not found');
        }

        return this.generateFromKeyframes(startKeyframe, endKeyframe, options);
    }

    /**
     * Generate CSS animation from two keyframes
     */
    public static generateFromKeyframes(
        startKeyframe: Keyframe,
        endKeyframe: Keyframe,
        options: AnimationOptions = {}
    ): { css: string, animationName: string } {
        // Combine options with defaults
        const finalOptions = { ...this.DEFAULT_OPTIONS, ...options };

        // Generate unique animation name if not provided
        const animationName = finalOptions.name || `animation_${Date.now()}`;

        // Generate keyframes CSS
        let keyframesCSS = `@keyframes ${animationName} {\n`;
        keyframesCSS += this.generateKeyframeCSS(startKeyframe, 0);
        keyframesCSS += this.generateKeyframeCSS(endKeyframe, 100);
        keyframesCSS += '}\n\n';

        // Generate animation CSS
        let animationCSS = `.${animationName} {\n`;
        animationCSS += `  animation-name: ${animationName};\n`;
        animationCSS += `  animation-duration: ${finalOptions.duration}s;\n`;
        animationCSS += `  animation-timing-function: ${finalOptions.timingFunction};\n`;
        animationCSS += `  animation-iteration-count: ${finalOptions.iterationCount};\n`;
        animationCSS += `  animation-direction: ${finalOptions.direction};\n`;
        animationCSS += `  animation-fill-mode: ${finalOptions.fillMode};\n`;
        animationCSS += '}\n';

        return {
            css: keyframesCSS + animationCSS,
            animationName
        };
    }

    /**
     * Generate animation preview at specific progress point
     */
    public static generatePreviewAtProgress(
        layer: Layer,
        tween: MotionTween,
        progress: number // 0 to 1
    ): Record<string, any> {
        // Find start and end keyframes
        const startKeyframe = layer.keyframes.find(k => k.id === tween.startKeyframeId);
        const endKeyframe = layer.keyframes.find(k => k.id === tween.endKeyframeId);

        if (!startKeyframe || !endKeyframe) {
            throw new Error('Cannot generate preview: keyframes not found');
        }

        // Interpolate properties based on progress
        const properties: Record<string, any> = {};

        // Combine all property keys from both keyframes
        const allKeys = new Set([
            ...Object.keys(startKeyframe.properties || {}),
            ...Object.keys(endKeyframe.properties || {})
        ]);

        // Apply easing function to progress
        const easedProgress = this.applyEasing(progress, tween.easingFunction || 'linear');

        // Interpolate each property
        allKeys.forEach(key => {
            const startValue = startKeyframe.properties?.[key];
            const endValue = endKeyframe.properties?.[key];

            // Skip if property doesn't exist in either keyframe
            if (startValue === undefined && endValue === undefined) {
                return;
            }

            // If property only exists in one keyframe, use that value
            if (startValue === undefined) {
                properties[key] = endValue;
                return;
            }

            if (endValue === undefined) {
                properties[key] = startValue;
                return;
            }

            // Interpolate based on value type
            if (typeof startValue === 'number' && typeof endValue === 'number') {
                // Number interpolation
                properties[key] = startValue + (endValue - startValue) * easedProgress;
            } else if (typeof startValue === 'string' && typeof endValue === 'string') {
                // Check for color values
                if (this.isColorValue(startValue) && this.isColorValue(endValue)) {
                    properties[key] = this.interpolateColor(startValue, endValue, easedProgress);
                } else {
                    // For non-numeric, non-color strings, use the appropriate value based on progress
                    properties[key] = easedProgress < 0.5 ? startValue : endValue;
                }
            } else {
                // For mixed types or objects, use the appropriate value based on progress
                properties[key] = easedProgress < 0.5 ? startValue : endValue;
            }
        });

        return properties;
    }

    /**
     * Generate full CSS animation from multiple keyframes
     */
    public static generateFromMultipleKeyframes(
        keyframes: Keyframe[],
        options: AnimationOptions = {}
    ): { css: string, animationName: string } {
        if (keyframes.length < 2) {
            throw new Error('Cannot generate animation: at least 2 keyframes are required');
        }

        // Sort keyframes by time
        const sortedKeyframes = [...keyframes].sort((a, b) => a.time - b.time);

        // Calculate time range
        const startTime = sortedKeyframes[0].time;
        const endTime = sortedKeyframes[sortedKeyframes.length - 1].time;
        const timeRange = endTime - startTime;

        // Combine options with defaults
        const finalOptions = { ...this.DEFAULT_OPTIONS, ...options };

        // Generate unique animation name if not provided
        const animationName = finalOptions.name || `animation_${Date.now()}`;

        // Generate keyframes CSS
        let keyframesCSS = `@keyframes ${animationName} {\n`;

        sortedKeyframes.forEach(keyframe => {
            // Calculate progress percentage
            const progress = ((keyframe.time - startTime) / timeRange) * 100;
            keyframesCSS += this.generateKeyframeCSS(keyframe, progress);
        });

        keyframesCSS += '}\n\n';

        // Generate animation CSS
        let animationCSS = `.${animationName} {\n`;
        animationCSS += `  animation-name: ${animationName};\n`;
        animationCSS += `  animation-duration: ${finalOptions.duration}s;\n`;
        animationCSS += `  animation-timing-function: ${finalOptions.timingFunction};\n`;
        animationCSS += `  animation-iteration-count: ${finalOptions.iterationCount};\n`;
        animationCSS += `  animation-direction: ${finalOptions.direction};\n`;
        animationCSS += `  animation-fill-mode: ${finalOptions.fillMode};\n`;
        animationCSS += '}\n';

        return {
            css: keyframesCSS + animationCSS,
            animationName
        };
    }

    /**
     * Export full CSS animation for a layer
     */
    public static exportLayerAnimation(
        layer: Layer,
        options: AnimationOptions = {}
    ): { css: string, animationName: string } {
        const keyframes = [...layer.keyframes].sort((a, b) => a.time - b.time);

        if (keyframes.length < 2) {
            throw new Error('Cannot export animation: at least 2 keyframes are required');
        }

        // Generate unique animation name based on layer
        const animationName = options.name || `${layer.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;

        // Generate animation with the layer name
        return this.generateFromMultipleKeyframes(keyframes, {
            ...options,
            name: animationName
        });
    }

    /**
     * Generate CSS string for a keyframe at a specific progress point
     */
    private static generateKeyframeCSS(keyframe: Keyframe, progress: number): string {
        const properties = keyframe.properties || {};

        let css = `  ${progress}% {\n`;

        // Add each property to the CSS
        Object.entries(properties).forEach(([key, value]) => {
            css += `    ${this.convertPropertyToCss(key, value)};\n`;
        });

        css += '  }\n';
        return css;
    }

    /**
     * Convert a property key-value pair to CSS syntax
     */
    private static convertPropertyToCss(key: string, value: any): string {
        // Handle special transformation properties
        if (['scaleX', 'scaleY', 'translateX', 'translateY', 'skewX', 'skewY'].includes(key)) {
            return this.convertTransformPropertyToCss(key, value);
        }

        // Handle filter properties
        if (['blur', 'brightness', 'contrast', 'grayscale', 'hueRotate', 'invert', 'saturate', 'sepia'].includes(key)) {
            return this.convertFilterPropertyToCss(key, value);
        }

        // Handle standard properties
        return `${this.camelToDash(key)}: ${this.formatValue(key, value)}`;
    }

    /**
     * Convert a transform property to CSS syntax
     */
    private static convertTransformPropertyToCss(key: string, value: any): string {
        // Build a transform function based on the property
        let transformFunction: string;

        switch (key) {
            case 'scaleX':
                transformFunction = `scaleX(${value})`;
                break;
            case 'scaleY':
                transformFunction = `scaleY(${value})`;
                break;
            case 'translateX':
                transformFunction = `translateX(${value}px)`;
                break;
            case 'translateY':
                transformFunction = `translateY(${value}px)`;
                break;
            case 'skewX':
                transformFunction = `skewX(${value}deg)`;
                break;
            case 'skewY':
                transformFunction = `skewY(${value}deg)`;
                break;
            default:
                transformFunction = '';
        }

        return `transform: ${transformFunction}`;
    }

    /**
     * Convert a filter property to CSS syntax
     */
    private static convertFilterPropertyToCss(key: string, value: any): string {
        // Build a filter function based on the property
        let filterFunction: string;

        switch (key) {
            case 'blur':
                filterFunction = `blur(${value}px)`;
                break;
            case 'brightness':
                filterFunction = `brightness(${value}%)`;
                break;
            case 'contrast':
                filterFunction = `contrast(${value}%)`;
                break;
            case 'grayscale':
                filterFunction = `grayscale(${value}%)`;
                break;
            case 'hueRotate':
                filterFunction = `hue-rotate(${value}deg)`;
                break;
            case 'invert':
                filterFunction = `invert(${value}%)`;
                break;
            case 'saturate':
                filterFunction = `saturate(${value}%)`;
                break;
            case 'sepia':
                filterFunction = `sepia(${value}%)`;
                break;
            default:
                filterFunction = '';
        }

        return `filter: ${filterFunction}`;
    }

    /**
     * Format a value with appropriate units
     */
    private static formatValue(key: string, value: any): string {
        // Handle numeric values with units
        if (typeof value === 'number') {
            // Properties that need px units
            const pxProperties = [
                'width', 'height', 'top', 'left', 'right', 'bottom',
                'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
                'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
                'fontSize', 'lineHeight', 'borderWidth', 'borderRadius', 'letterSpacing'
            ];

            // Check if the property needs pixels
            const needsPx = pxProperties.some(prop => key === prop || key.startsWith(prop));

            if (needsPx) {
                return `${value}px`;
            }

            // Properties that need deg units
            const degProperties = ['rotate', 'rotation'];

            if (degProperties.includes(key)) {
                return `${value}deg`;
            }

            // Return as-is for other numeric values
            return value.toString();
        }

        // Return as-is for non-numeric values
        return value;
    }

    /**
     * Convert camelCase to dash-case for CSS properties
     */
    private static camelToDash(str: string): string {
        return str.replace(/([A-Z])/g, '-$1').toLowerCase();
    }

    /**
     * Apply easing function to a progress value
     */
    private static applyEasing(progress: number, easingFunction: string): number {
        // Ensure progress is within 0-1 range
        progress = Math.max(0, Math.min(1, progress));

        switch (easingFunction) {
            case 'linear':
                return progress;
            case 'easeInQuad':
                return progress * progress;
            case 'easeOutQuad':
                return progress * (2 - progress);
            case 'easeInOutQuad':
                return progress < 0.5
                    ? 2 * progress * progress
                    : -1 + (4 - 2 * progress) * progress;
            case 'easeInCubic':
                return progress ** 3;
            case 'easeOutCubic':
                return (--progress) ** 3 + 1;
            case 'easeInOutCubic':
                return progress < 0.5
                    ? 4 * progress ** 3
                    : (progress - 1) * (2 * progress - 2) * (2 * progress - 2) + 1;
            case 'easeInQuart':
                return progress ** 4;
            case 'easeOutQuart':
                return 1 - (--progress) ** 4;
            case 'easeInOutQuart':
                return progress < 0.5
                    ? 8 * progress ** 4
                    : 1 - 8 * (--progress) ** 4;
            case 'easeInQuint':
                return progress ** 5;
            case 'easeOutQuint':
                return 1 + (--progress) ** 5;
            case 'easeInOutQuint':
                return progress < 0.5
                    ? 16 * progress ** 5
                    : 1 + 16 * (--progress) ** 5;
            default:
                return progress;
        }
    }

    /**
     * Check if a value is a color
     */
    private static isColorValue(value: string): boolean {
        // Check for hex colors
        if (/^#([0-9A-F]{3}){1,2}$/i.test(value)) {
            return true;
        }

        // Check for rgb/rgba colors
        if (/^rgba?\(/i.test(value)) {
            return true;
        }

        // Check for named colors
        const namedColors = [
            'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple',
            'pink', 'brown', 'gray', 'cyan', 'magenta', 'lime', 'olive', 'navy',
            'teal', 'aqua', 'silver', 'maroon', 'fuchsia'
        ];

        return namedColors.includes(value.toLowerCase());
    }

    /**
     * Parse a color string to RGB components
     */
    private static parseColor(color: string): { r: number, g: number, b: number, a: number } {
        // Default values
        let r = 0, g = 0, b = 0, a = 1;

        // Handle hex colors
        if (color.startsWith('#')) {
            // Expand shorthand hex (#RGB) to full hex (#RRGGBB)
            const hex = color.length === 4
                ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
                : color;

            r = parseInt(hex.slice(1, 3), 16);
            g = parseInt(hex.slice(3, 5), 16);
            b = parseInt(hex.slice(5, 7), 16);
        }
        // Handle rgb/rgba colors
        else if (color.startsWith('rgb')) {
            const values = color.match(/\d+/g);
            if (values) {
                r = parseInt(values[0], 10);
                g = parseInt(values[1], 10);
                b = parseInt(values[2], 10);

                // Parse alpha if present
                if (values.length > 3) {
                    a = parseFloat(values[3]);
                }
            }
        }
        // Handle other color formats or defaults
        else {
            console.warn(`Color format not supported for interpolation: ${color}`);
        }

        return { r, g, b, a };
    }

    /**
     * Interpolate between two colors
     */
    private static interpolateColor(color1: string, color2: string, progress: number): string {
        const rgb1 = this.parseColor(color1);
        const rgb2 = this.parseColor(color2);

        // Interpolate each component
        const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * progress);
        const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * progress);
        const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * progress);
        const a = rgb1.a + (rgb2.a - rgb1.a) * progress;

        // Return as rgba
        return a < 1
            ? `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`
            : `rgb(${r}, ${g}, ${b})`;
    }
}