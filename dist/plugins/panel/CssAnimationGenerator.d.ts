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
export declare class CssAnimationGenerator {
    private static readonly DEFAULT_OPTIONS;
    /**
     * Generate CSS animation for a motion tween
     */
    static generateFromTween(layer: Layer, tween: MotionTween, options?: AnimationOptions): {
        css: string;
        animationName: string;
    };
    /**
     * Generate CSS animation from two keyframes
     */
    static generateFromKeyframes(startKeyframe: Keyframe, endKeyframe: Keyframe, options?: AnimationOptions): {
        css: string;
        animationName: string;
    };
    /**
     * Generate animation preview at specific progress point
     */
    static generatePreviewAtProgress(layer: Layer, tween: MotionTween, progress: number): Record<string, any>;
    /**
     * Generate full CSS animation from multiple keyframes
     */
    static generateFromMultipleKeyframes(keyframes: Keyframe[], options?: AnimationOptions): {
        css: string;
        animationName: string;
    };
    /**
     * Export full CSS animation for a layer
     */
    static exportLayerAnimation(layer: Layer, options?: AnimationOptions): {
        css: string;
        animationName: string;
    };
    /**
     * Generate CSS string for a keyframe at a specific progress point
     */
    private static generateKeyframeCSS;
    /**
     * Convert a property key-value pair to CSS syntax
     */
    private static convertPropertyToCss;
    /**
     * Convert a transform property to CSS syntax
     */
    private static convertTransformPropertyToCss;
    /**
     * Convert a filter property to CSS syntax
     */
    private static convertFilterPropertyToCss;
    /**
     * Format a value with appropriate units
     */
    private static formatValue;
    /**
     * Convert camelCase to dash-case for CSS properties
     */
    private static camelToDash;
    /**
     * Apply easing function to a progress value
     */
    private static applyEasing;
    /**
     * Check if a value is a color
     */
    private static isColorValue;
    /**
     * Parse a color string to RGB components
     */
    private static parseColor;
    /**
     * Interpolate between two colors
     */
    private static interpolateColor;
}
