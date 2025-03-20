/* eslint-disable @typescript-eslint/no-inferrable-types */
// src/core/DataModel.ts
/**
 * Timeline Control Data Model
 * Core data structures for the timeline control
 */
// Timeline data model
export class TimelineDataModel {
    constructor() {
        this.layers = [];
        this.currentTime = 0;
        this.duration = 600; // 10 minutes in seconds
        this.selectedLayerIds = [];
        this.selectedKeyframeIds = [];
        this.timeScale = 1; // Zoom factor
    }
    //constructor() {
    //}
    // Layer methods
    getLayers() {
        return [...this.layers];
    }
    addLayer(layer) {
        const newLayer = {
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
    updateLayer(layerId, properties) {
        const index = this.findLayerIndex(layerId);
        if (index === -1)
            return null;
        this.layers[index] = { ...this.layers[index], ...properties };
        return this.layers[index];
    }
    removeLayer(layerId) {
        const index = this.findLayerIndex(layerId);
        if (index === -1)
            return false;
        this.layers.splice(index, 1);
        return true;
    }
    selectLayer(layerId, multiSelect = false) {
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
    addKeyframe(layerId, keyframe) {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer)
            return null;
        const newKeyframe = {
            ...keyframe,
            id: this.generateId('keyframe'),
            isSelected: false
        };
        layer.keyframes.push(newKeyframe);
        return newKeyframe;
    }
    updateKeyframe(layerId, keyframeId, properties) {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer)
            return null;
        const index = layer.keyframes.findIndex(k => k.id === keyframeId);
        if (index === -1)
            return null;
        layer.keyframes[index] = { ...layer.keyframes[index], ...properties };
        return layer.keyframes[index];
    }
    removeKeyframe(layerId, keyframeId) {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer)
            return false;
        const index = layer.keyframes.findIndex(k => k.id === keyframeId);
        if (index === -1)
            return false;
        layer.keyframes.splice(index, 1);
        return true;
    }
    selectKeyframe(layerId, keyframeId, multiSelect = false) {
        if (!multiSelect) {
            this.selectedKeyframeIds = [];
            this.layers.forEach(layer => {
                layer.keyframes.forEach(keyframe => {
                    keyframe.isSelected = false;
                });
            });
        }
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer)
            return;
        const keyframe = layer.keyframes.find(k => k.id === keyframeId);
        if (keyframe) {
            keyframe.isSelected = true;
            this.selectedKeyframeIds.push(keyframeId);
        }
    }
    // Motion Tween methods
    addMotionTween(layerId, tween) {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer)
            return null;
        const startKeyframe = layer.keyframes.find(k => k.id === tween.startKeyframeId);
        const endKeyframe = layer.keyframes.find(k => k.id === tween.endKeyframeId);
        if (!startKeyframe || !endKeyframe)
            return null;
        const newTween = {
            ...tween,
            id: this.generateId('tween')
        };
        layer.motionTweens.push(newTween);
        return newTween;
    }
    updateMotionTween(layerId, tweenId, properties) {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer)
            return null;
        const index = layer.motionTweens.findIndex(t => t.id === tweenId);
        if (index === -1)
            return null;
        layer.motionTweens[index] = { ...layer.motionTweens[index], ...properties };
        return layer.motionTweens[index];
    }
    removeMotionTween(layerId, tweenId) {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer)
            return false;
        const index = layer.motionTweens.findIndex(t => t.id === tweenId);
        if (index === -1)
            return false;
        layer.motionTweens.splice(index, 1);
        return true;
    }
    // Time management
    setCurrentTime(time) {
        this.currentTime = Math.max(0, Math.min(time, this.duration));
    }
    getCurrentTime() {
        return this.currentTime;
    }
    /**
     * Set the duration of the timeline
     * @param duration New duration in seconds
     * @returns true if the duration was changed
     */
    setDuration(duration) {
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
    getDuration() {
        return this.duration;
    }
    /**
     * Automatically extend the duration if needed
     * @param time Time point to ensure is within duration
     * @param padding Additional padding in seconds to add beyond the time
     * @returns true if the duration was extended
     */
    extendDurationIfNeeded(time, padding = 10) {
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
    getKeyframesAtTime(time, tolerance = 0.1) {
        const result = [];
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
    getObjectsAtTime(time) {
        const result = [];
        this.layers.forEach(layer => {
            // Skip hidden layers
            if (!layer.visible)
                return;
            // Find relevant keyframes and tweens
            const sortedKeyframes = [...layer.keyframes].sort((a, b) => a.time - b.time);
            // Find the keyframes that bracket the current time
            let prevKeyframe = null;
            let nextKeyframe = null;
            for (let i = 0; i < sortedKeyframes.length; i++) {
                if (sortedKeyframes[i].time <= time) {
                    prevKeyframe = sortedKeyframes[i];
                }
                else {
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
                const tween = layer.motionTweens.find(t => t.startKeyframeId === (prevKeyframe === null || prevKeyframe === void 0 ? void 0 : prevKeyframe.id) &&
                    t.endKeyframeId === (nextKeyframe === null || nextKeyframe === void 0 ? void 0 : nextKeyframe.id));
                if (tween) {
                    // Calculate interpolated properties
                    const progress = (time - prevKeyframe.time) / (nextKeyframe.time - prevKeyframe.time);
                    const properties = this.interpolateProperties(prevKeyframe.properties, nextKeyframe.properties, progress, tween.easingFunction || 'linear');
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
            }
            else {
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
    interpolateProperties(start, end, progress, easingFunction) {
        const result = {};
        const easedProgress = this.applyEasing(progress, easingFunction);
        // Combine all property keys from both objects
        const allKeys = new Set([...Object.keys(start), ...Object.keys(end)]);
        allKeys.forEach(key => {
            // Skip non-numeric properties
            if (typeof start[key] === 'number' && typeof end[key] === 'number') {
                result[key] = start[key] + (end[key] - start[key]) * easedProgress;
            }
            else if (key in end) {
                // For non-numeric, just use the end value when we cross 50%
                result[key] = easedProgress >= 0.5 ? end[key] : start[key];
            }
            else if (key in start) {
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
    applyEasing(progress, easingFunction) {
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
    setTimeScale(scale) {
        this.timeScale = Math.max(0.1, scale);
    }
    getTimeScale() {
        return this.timeScale;
    }
    // Export/Import
    toJSON() {
        return JSON.stringify({
            layers: this.layers,
            duration: this.duration,
            currentTime: this.currentTime,
            timeScale: this.timeScale
        });
    }
    fromJSON(json) {
        try {
            const data = JSON.parse(json);
            this.layers = data.layers || [];
            this.duration = data.duration || 600;
            this.currentTime = data.currentTime || 0;
            this.timeScale = data.timeScale || 1;
        }
        catch (e) {
            console.error('Failed to parse timeline data:', e);
        }
    }
    // Helper methods
    generateId(prefix) {
        return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }
    findLayerIndex(layerId) {
        return this.layers.findIndex(l => l.id === layerId);
    }
}
//# sourceMappingURL=DataModel.js.map