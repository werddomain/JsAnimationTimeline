/**
 * Timeline Control Data Model
 * Core data structures for the timeline control
 */
export interface Point {
    x: number;
    y: number;
}
export interface Keyframe {
    id: string;
    time: number;
    properties: Record<string, any>;
    isSelected: boolean;
}
export interface MotionTween {
    id: string;
    startKeyframeId: string;
    endKeyframeId: string;
    easingFunction?: string;
    properties: Record<string, any>;
}
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
    [key: string]: any;
}
export declare class TimelineDataModel {
    private layers;
    private currentTime;
    private duration;
    private selectedLayerIds;
    private selectedKeyframeIds;
    private timeScale;
    getLayers(): Layer[];
    addLayer(layer: Omit<Layer, 'id'>): Layer;
    updateLayer(layerId: string, properties: Partial<Layer>): Layer | null;
    removeLayer(layerId: string): boolean;
    selectLayer(layerId: string, multiSelect?: boolean): void;
    addKeyframe(layerId: string, keyframe: Omit<Keyframe, 'id'>): Keyframe | null;
    updateKeyframe(layerId: string, keyframeId: string, properties: Partial<Keyframe>): Keyframe | null;
    removeKeyframe(layerId: string, keyframeId: string): boolean;
    selectKeyframe(layerId: string, keyframeId: string, multiSelect?: boolean): void;
    addMotionTween(layerId: string, tween: Omit<MotionTween, 'id'>): MotionTween | null;
    updateMotionTween(layerId: string, tweenId: string, properties: Partial<MotionTween>): MotionTween | null;
    removeMotionTween(layerId: string, tweenId: string): boolean;
    setCurrentTime(time: number): void;
    getCurrentTime(): number;
    /**
     * Set the duration of the timeline
     * @param duration New duration in seconds
     * @returns true if the duration was changed
     */
    setDuration(duration: number): boolean;
    /**
     * Get the current duration of the timeline
     * @returns Duration in seconds
     */
    getDuration(): number;
    /**
     * Automatically extend the duration if needed
     * @param time Time point to ensure is within duration
     * @param padding Additional padding in seconds to add beyond the time
     * @returns true if the duration was extended
     */
    extendDurationIfNeeded(time: number, padding?: number): boolean;
    /**
     * Get all keyframes at a specific time point
     * @param time Time in seconds
     * @param tolerance Tolerance window in seconds (to capture keyframes near the time)
     * @returns Object with layerId and keyframe pairs
     */
    getKeyframesAtTime(time: number, tolerance?: number): Array<{
        layerId: string;
        keyframe: Keyframe;
    }>;
    /**
     * Get all objects with their current state at a specific time
     * @param time Time in seconds
     * @returns Array of layer objects with their interpolated state at the given time
     */
    getObjectsAtTime(time: number): Array<{
        layer: Layer;
        properties: Record<string, any>;
    }>;
    /**
     * Interpolate between two sets of properties
     * @param start Start properties
     * @param end End properties
     * @param progress Progress value from 0 to 1
     * @param easingFunction Name of easing function to use
     * @returns Interpolated properties
     */
    private interpolateProperties;
    /**
     * Apply easing function to a progress value
     * @param progress Progress value from 0 to 1
     * @param easingFunction Easing function name
     * @returns Eased progress value
     */
    private applyEasing;
    setTimeScale(scale: number): void;
    getTimeScale(): number;
    toJSON(): string;
    fromJSON(json: string): void;
    private generateId;
    private findLayerIndex;
}
