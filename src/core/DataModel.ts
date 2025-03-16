/* eslint-disable @typescript-eslint/no-inferrable-types */
// src/core/DataModel.ts
/**
 * Timeline Control Data Model
 * Core data structures for the timeline control
 */

// Type for a Point in time or position
export interface Point {
    x: number;
    y: number;
}

// Keyframe interface
export interface Keyframe {
    id: string;
    time: number;
    properties: Record<string, any>;
    isSelected: boolean;
}

// Motion Tween between two keyframes
export interface MotionTween {
    id: string;
    startKeyframeId: string;
    endKeyframeId: string;
    easingFunction?: string;
    properties: Record<string, any>;
}

// Layer (Object) interface
export interface Layer {
    id: string;
    name: string;
    visible: boolean;
    locked: boolean;
    color: string;
    keyframes: Keyframe[];
    motionTweens: MotionTween[];
    isSelected: boolean;
    parentId?: string;
    children?: Layer[];
    isExpanded?: boolean;
    // Allow for extension with additional properties
    [key: string]: any;
}

// Timeline data model
export class TimelineDataModel {
    private layers: Layer[] = [];
    private currentTime: number = 0;
    private duration: number = 600; // 10 minutes in seconds
    private selectedLayerIds: string[] = [];
    private selectedKeyframeIds: string[] = [];
    private timeScale: number = 1; // Zoom factor

    //constructor() {

    //}

    // Layer methods
    public getLayers(): Layer[] {
        return [...this.layers];
    }

    public addLayer(layer: Omit<Layer, 'id'>): Layer {
        const newLayer: Layer = {
            ...layer,
            id: this.generateId('layer'),
            keyframes: [],
            motionTweens: [],
            isSelected: false,
            parentId: layer.parentId,
            children: layer.children,
            isExpanded: layer.isExpanded,
            name: layer.name || 'Layer',
            visible: layer.visible || true,
            locked: layer.locked || false,
            color: layer.color || '#fff'
        };
        this.layers.push(newLayer);
        return newLayer;
    }

    public updateLayer(layerId: string, properties: Partial<Layer>): Layer | null {
        const index = this.findLayerIndex(layerId);
        if (index === -1) return null;

        this.layers[index] = { ...this.layers[index], ...properties };
        return this.layers[index];
    }

    public removeLayer(layerId: string): boolean {
        const index = this.findLayerIndex(layerId);
        if (index === -1) return false;

        this.layers.splice(index, 1);
        return true;
    }

    public selectLayer(layerId: string, multiSelect: boolean = false): void {
        if (!multiSelect) {
            this.selectedLayerIds = [];
            this.layers.forEach(layer => {
                layer.isSelected = false;
            });
        }

        const layer = this.layers.find(l => l.id === layerId);
        if (layer) {
            layer.isSelected = true;
            this.selectedLayerIds.push(layerId);
        }
    }

    // Keyframe methods
    public addKeyframe(layerId: string, keyframe: Omit<Keyframe, 'id'>): Keyframe | null {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer) return null;

        const newKeyframe: Keyframe = {
            ...keyframe,
            id: this.generateId('keyframe'),
            isSelected: false
        };
        layer.keyframes.push(newKeyframe);
        return newKeyframe;
    }

    public updateKeyframe(layerId: string, keyframeId: string, properties: Partial<Keyframe>): Keyframe | null {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer) return null;

        const index = layer.keyframes.findIndex(k => k.id === keyframeId);
        if (index === -1) return null;

        layer.keyframes[index] = { ...layer.keyframes[index], ...properties };
        return layer.keyframes[index];
    }

    public removeKeyframe(layerId: string, keyframeId: string): boolean {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer) return false;

        const index = layer.keyframes.findIndex(k => k.id === keyframeId);
        if (index === -1) return false;

        layer.keyframes.splice(index, 1);
        return true;
    }

    public selectKeyframe(layerId: string, keyframeId: string, multiSelect: boolean = false): void {
        if (!multiSelect) {
            this.selectedKeyframeIds = [];
            this.layers.forEach(layer => {
                layer.keyframes.forEach(keyframe => {
                    keyframe.isSelected = false;
                });
            });
        }

        const layer = this.layers.find(l => l.id === layerId);
        if (!layer) return;

        const keyframe = layer.keyframes.find(k => k.id === keyframeId);
        if (keyframe) {
            keyframe.isSelected = true;
            this.selectedKeyframeIds.push(keyframeId);
        }
    }

    // Motion Tween methods
    public addMotionTween(layerId: string, tween: Omit<MotionTween, 'id'>): MotionTween | null {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer) return null;

        const startKeyframe = layer.keyframes.find(k => k.id === tween.startKeyframeId);
        const endKeyframe = layer.keyframes.find(k => k.id === tween.endKeyframeId);
        if (!startKeyframe || !endKeyframe) return null;

        const newTween: MotionTween = {
            ...tween,
            id: this.generateId('tween')
        };
        layer.motionTweens.push(newTween);
        return newTween;
    }

    public updateMotionTween(layerId: string, tweenId: string, properties: Partial<MotionTween>): MotionTween | null {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer) return null;

        const index = layer.motionTweens.findIndex(t => t.id === tweenId);
        if (index === -1) return null;

        layer.motionTweens[index] = { ...layer.motionTweens[index], ...properties };
        return layer.motionTweens[index];
    }

    public removeMotionTween(layerId: string, tweenId: string): boolean {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer) return false;

        const index = layer.motionTweens.findIndex(t => t.id === tweenId);
        if (index === -1) return false;

        layer.motionTweens.splice(index, 1);
        return true;
    }

    // Time management
    public setCurrentTime(time: number): void {
        this.currentTime = Math.max(0, Math.min(time, this.duration));
    }

    public getCurrentTime(): number {
        return this.currentTime;
    }

    /**
     * Set the duration of the timeline
     * @param duration New duration in seconds
     * @returns true if the duration was changed
     */
    public setDuration(duration: number): boolean {
        const newDuration = Math.max(0, duration);
        if (newDuration === this.duration) {
            return false;
        }

        this.duration = newDuration;
        return true;
    }

    /**
     * Get the current duration of the timeline
     * @returns Duration in seconds
     */
    public getDuration(): number {
        return this.duration;
    }

    /**
     * Automatically extend the duration if needed
     * @param time Time point to ensure is within duration
     * @param padding Additional padding in seconds to add beyond the time
     * @returns true if the duration was extended
     */
    public extendDurationIfNeeded(time: number, padding: number = 10): boolean {
        if (time + padding > this.duration) {
            return this.setDuration(time + padding);
        }
        return false;
    }

    /**
     * Get all keyframes at a specific time point
     * @param time Time in seconds
     * @param tolerance Tolerance window in seconds (to capture keyframes near the time)
     * @returns Object with layerId and keyframe pairs
     */
    public getKeyframesAtTime(time: number, tolerance: number = 0.1): Array<{ layerId: string, keyframe: Keyframe }> {
        const result: Array<{ layerId: string, keyframe: Keyframe }> = [];

        this.layers.forEach(layer => {
            layer.keyframes.forEach(keyframe => {
                if (Math.abs(keyframe.time - time) <= tolerance) {
                    result.push({
                        layerId: layer.id,
                        keyframe: keyframe
                    });
                }
            });
        });

        return result;
    }

    /**
     * Get all objects with their current state at a specific time
     * @param time Time in seconds
     * @returns Array of layer objects with their interpolated state at the given time
     */
    public getObjectsAtTime(time: number): Array<{ layer: Layer, properties: Record<string, any> }> {
        const result: Array<{ layer: Layer, properties: Record<string, any> }> = [];

        this.layers.forEach(layer => {
            // Skip hidden layers
            if (!layer.visible) return;

            // Find relevant keyframes and tweens
            const sortedKeyframes = [...layer.keyframes].sort((a, b) => a.time - b.time);

            // Find the keyframes that bracket the current time
            let prevKeyframe: Keyframe | null = null;
            let nextKeyframe: Keyframe | null = null;

            for (let i = 0; i < sortedKeyframes.length; i++) {
                if (sortedKeyframes[i].time <= time) {
                    prevKeyframe = sortedKeyframes[i];
                } else {
                    nextKeyframe = sortedKeyframes[i];
                    break;
                }
            }

            // If we have exactly at a keyframe time, use its properties
            if (prevKeyframe && Math.abs(prevKeyframe.time - time) < 0.001) {
                result.push({
                    layer,
                    properties: { ...prevKeyframe.properties }
                });
                return;
            }

            // If we have both prev and next keyframes, check if there's a tween
            if (prevKeyframe && nextKeyframe) {
                const tween = layer.motionTweens.find(t =>
                    t.startKeyframeId === prevKeyframe?.id &&
                    t.endKeyframeId === nextKeyframe?.id
                );

                if (tween) {
                    // Calculate interpolated properties
                    const progress = (time - prevKeyframe.time) / (nextKeyframe.time - prevKeyframe.time);
                    const properties = this.interpolateProperties(
                        prevKeyframe.properties,
                        nextKeyframe.properties,
                        progress,
                        tween.easingFunction || 'linear'
                    );

                    result.push({ layer, properties });
                    return;
                }
            }

            // If no tween or missing keyframes, use the most recent keyframe's properties
            if (prevKeyframe) {
                result.push({
                    layer,
                    properties: { ...prevKeyframe.properties }
                });
            } else {
                // No keyframes before current time, use default properties
                result.push({
                    layer,
                    properties: {}
                });
            }
        });

        return result;
    }

    /**
     * Interpolate between two sets of properties
     * @param start Start properties
     * @param end End properties
     * @param progress Progress value from 0 to 1
     * @param easingFunction Name of easing function to use
     * @returns Interpolated properties
     */
    private interpolateProperties(
        start: Record<string, any>,
        end: Record<string, any>,
        progress: number,
        easingFunction: string
    ): Record<string, any> {
        const result: Record<string, any> = {};
        const easedProgress = this.applyEasing(progress, easingFunction);

        // Combine all property keys from both objects
        const allKeys = new Set([...Object.keys(start), ...Object.keys(end)]);

        allKeys.forEach(key => {
            // Skip non-numeric properties
            if (typeof start[key] === 'number' && typeof end[key] === 'number') {
                result[key] = start[key] + (end[key] - start[key]) * easedProgress;
            } else if (key in end) {
                // For non-numeric, just use the end value when we cross 50%
                result[key] = easedProgress >= 0.5 ? end[key] : start[key];
            } else if (key in start) {
                result[key] = start[key];
            }
        });

        return result;
    }

    /**
     * Apply easing function to a progress value
     * @param progress Progress value from 0 to 1
     * @param easingFunction Easing function name
     * @returns Eased progress value
     */
    private applyEasing(progress: number, easingFunction: string): number {
        // Clamp progress between 0 and 1
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
            default:
                return progress;
        }
    }

    public setTimeScale(scale: number): void {
        this.timeScale = Math.max(0.1, scale);
    }

    public getTimeScale(): number {
        return this.timeScale;
    }

    // Export/Import
    public toJSON(): string {
        return JSON.stringify({
            layers: this.layers,
            duration: this.duration,
            currentTime: this.currentTime,
            timeScale: this.timeScale
        });
    }

    public fromJSON(json: string): void {
        try {
            const data = JSON.parse(json);
            this.layers = data.layers || [];
            this.duration = data.duration || 600;
            this.currentTime = data.currentTime || 0;
            this.timeScale = data.timeScale || 1;
        } catch (e) {
            console.error('Failed to parse timeline data:', e);
        }
    }

    // Helper methods
    private generateId(prefix: string): string {
        return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }

    private findLayerIndex(layerId: string): number {
        return this.layers.findIndex(l => l.id === layerId);
    }
}