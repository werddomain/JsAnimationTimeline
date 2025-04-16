import { EventEmitter } from './EventEmitter';
import { Events, LayerData, KeyframeData, GroupData } from '@utils/EventTypes';

/**
 * Central data storage for timeline state
 */
export class DataModel {
    private static instance: DataModel;
    
    // Timeline state
    private currentTime: number = 0;
    private timeScale: number = 1;
    private duration: number = 60; // Default duration in seconds
    private pixelsPerSecond: number = 50;
    
    // Collection data
    private layers: Map<string, LayerData> = new Map();
    private keyframes: Map<string, KeyframeData> = new Map();
    private groups: Map<string, GroupData> = new Map();
    private layerOrder: string[] = [];
    
    // Selected entities
    private selectedLayerId: string | null = null;
    private selectedKeyframeId: string | null = null;
    
    // Event emitter reference
    private eventEmitter: EventEmitter;

    /**
     * Get the singleton instance of DataModel
     * @returns The DataModel instance
     */
    public static getInstance(): DataModel {
        if (!DataModel.instance) {
            DataModel.instance = new DataModel();
        }
        return DataModel.instance;
    }

    /**
     * Private constructor to enforce singleton pattern
     */
    private constructor() {
        this.eventEmitter = EventEmitter.getInstance();
    }

    /**
     * Get the current time
     * @returns The current time in seconds
     */
    public getCurrentTime(): number {
        return this.currentTime;
    }

    /**
     * Set the current time
     * @param time The new time in seconds
     */
    public setCurrentTime(time: number, sender: any): void {
        // Clamp time to duration
        const clampedTime = Math.max(0, Math.min(time, this.duration));
        
        if (this.currentTime !== clampedTime) {
            this.currentTime = clampedTime;
            this.eventEmitter.emit(Events.TIME_CHANGED, sender, { time: this.currentTime });
        }
    }

    /**
     * Get the time scale
     * @returns The time scale factor
     */
    public getTimeScale(): number {
        return this.timeScale;
    }

    /**
     * Set the time scale
     * @param scale The new time scale factor
     * @param sender The component setting the time scale
     */
    public setTimeScale(scale: number, sender: any): void {
        // Ensure scale is positive
        const validScale = Math.max(0.1, scale);
        
        if (this.timeScale !== validScale) {
            this.timeScale = validScale;
            this.eventEmitter.emit(Events.TIME_SCALE_CHANGED, sender, { timeScale: this.timeScale });
        }
    }

    /**
     * Get the timeline duration
     * @returns The duration in seconds
     */
    public getDuration(): number {
        return this.duration;
    }

    /**
     * Set the timeline duration
     * @param duration The new duration in seconds
     */
    public setDuration(duration: number): void {
        this.duration = Math.max(1, duration);
        // Clamp current time if needed
        if (this.currentTime > this.duration) {
            this.setCurrentTime(this.duration, this);
        }
    }

    /**
     * Get the pixels per second setting
     * @returns The pixels per second value
     */
    public getPixelsPerSecond(): number {
        return this.pixelsPerSecond;
    }

    /**
     * Set the pixels per second
     * @param pps The new pixels per second value
     */
    public setPixelsPerSecond(pps: number): void {
        this.pixelsPerSecond = Math.max(10, pps);
    }

    /**
     * Calculate time position in pixels
     * @param time The time in seconds
     * @returns The position in pixels
     */
    public timeToPixels(time: number): number {
        return time * this.timeScale * this.pixelsPerSecond;
    }

    /**
     * Convert pixel position to time
     * @param pixels The position in pixels
     * @returns The time in seconds
     */
    public pixelsToTime(pixels: number): number {
        return pixels / (this.timeScale * this.pixelsPerSecond);
    }

    /**
     * Add a layer to the timeline
     * @param layer The layer data to add
     * @param sender The component adding the layer
     * @returns The added layer data
     */
    public addLayer(layer: LayerData, sender: any): LayerData {
        this.layers.set(layer.id, layer);
        this.layerOrder.push(layer.id);
        this.eventEmitter.emit(Events.LAYER_ADDED, sender, { layer });
        return layer;
    }

    /**
     * Remove a layer from the timeline
     * @param layerId The ID of the layer to remove
     * @param sender The component removing the layer
     */
    public removeLayer(layerId: string, sender: any): void {
        if (this.layers.has(layerId)) {
            // Remove layer
            this.layers.delete(layerId);
            this.layerOrder = this.layerOrder.filter(id => id !== layerId);
            
            // Remove associated keyframes
            const keyframesToRemove: string[] = [];
            this.keyframes.forEach((keyframe, id) => {
                if (keyframe.layerId === layerId) {
                    keyframesToRemove.push(id);
                }
            });
            
            keyframesToRemove.forEach(id => {
                this.keyframes.delete(id);
            });
            
            // Clear selection if needed
            if (this.selectedLayerId === layerId) {
                this.selectedLayerId = null;
            }
            
            // Emit event
            this.eventEmitter.emit(Events.LAYER_REMOVED, sender, { layerId });
        }
    }

    /**
     * Get all layers
     * @returns Array of layer data objects
     */
    public getLayers(): LayerData[] {
        // Return layers in order
        return this.layerOrder.map(id => this.layers.get(id)!);
    }

    /**
     * Get a layer by ID
     * @param layerId The ID of the layer to retrieve
     * @returns The layer data or undefined if not found
     */
    public getLayer(layerId: string): LayerData | undefined {
        return this.layers.get(layerId);
    }

    /**
     * Select a layer
     * @param layerId The ID of the layer to select
     * @param sender The component selecting the layer
     */
    public selectLayer(layerId: string | null, sender: any): void {
        if (this.selectedLayerId !== layerId) {
            this.selectedLayerId = layerId;
            if (layerId) {
                this.eventEmitter.emit(Events.LAYER_SELECTED, sender, { layerId });
            }
        }
    }

    /**
     * Get the currently selected layer
     * @returns The selected layer data or null if none selected
     */
    public getSelectedLayer(): LayerData | null {
        return this.selectedLayerId ? this.layers.get(this.selectedLayerId) || null : null;
    }

    /**
     * Add a keyframe to the timeline
     * @param keyframe The keyframe data to add
     * @param sender The component adding the keyframe
     * @returns The added keyframe data
     */
    public addKeyframe(keyframe: KeyframeData, sender: any): KeyframeData {
        this.keyframes.set(keyframe.id, keyframe);
        this.eventEmitter.emit(Events.KEYFRAME_ADDED, sender, { keyframe });
        return keyframe;
    }

    /**
     * Remove a keyframe from the timeline
     * @param keyframeId The ID of the keyframe to remove
     * @param sender The component removing the keyframe
     */
    public removeKeyframe(keyframeId: string, sender: any): void {
        const keyframe = this.keyframes.get(keyframeId);
        if (keyframe) {
            const layerId = keyframe.layerId;
            this.keyframes.delete(keyframeId);
            
            // Clear selection if needed
            if (this.selectedKeyframeId === keyframeId) {
                this.selectedKeyframeId = null;
            }
            
            // Emit event
            this.eventEmitter.emit(Events.KEYFRAME_REMOVED, sender, { 
                keyframeId, 
                layerId 
            });
        }
    }

    /**
     * Move a keyframe to a new time
     * @param keyframeId The ID of the keyframe to move
     * @param newTime The new time for the keyframe
     * @param sender The component moving the keyframe
     */
    public moveKeyframe(keyframeId: string, newTime: number, sender: any): void {
        const keyframe = this.keyframes.get(keyframeId);
        if (keyframe) {
            // Clamp time to duration
            const clampedTime = Math.max(0, Math.min(newTime, this.duration));
            keyframe.time = clampedTime;
            
            // Emit event
            this.eventEmitter.emit(Events.KEYFRAME_MOVED, sender, {
                keyframeId,
                layerId: keyframe.layerId,
                newTime: clampedTime
            });
        }
    }

    /**
     * Get all keyframes
     * @returns Array of keyframe data objects
     */
    public getKeyframes(): KeyframeData[] {
        return Array.from(this.keyframes.values());
    }

    /**
     * Get keyframes for a specific layer
     * @param layerId The ID of the layer
     * @returns Array of keyframe data objects for the layer
     */
    public getKeyframesForLayer(layerId: string): KeyframeData[] {
        return this.getKeyframes().filter(kf => kf.layerId === layerId);
    }

    /**
     * Select a keyframe
     * @param keyframeId The ID of the keyframe to select
     * @param sender The component selecting the keyframe
     */
    public selectKeyframe(keyframeId: string | null, sender: any): void {
        if (this.selectedKeyframeId !== keyframeId) {
            this.selectedKeyframeId = keyframeId;
            
            if (keyframeId) {
                const keyframe = this.keyframes.get(keyframeId);
                if (keyframe) {
                    this.eventEmitter.emit(Events.KEYFRAME_SELECTED, sender, {
                        keyframeId,
                        layerId: keyframe.layerId
                    });
                }
            }
        }
    }

    /**
     * Get the currently selected keyframe
     * @returns The selected keyframe data or null if none selected
     */
    public getSelectedKeyframe(): KeyframeData | null {
        return this.selectedKeyframeId ? this.keyframes.get(this.selectedKeyframeId) || null : null;
    }

    /**
     * Add a group to the timeline
     * @param group The group data to add
     * @param sender The component adding the group
     * @returns The added group data
     */
    public addGroup(group: GroupData, sender: any): GroupData {
        this.groups.set(group.id, group);
        this.eventEmitter.emit(Events.GROUP_ADDED, sender, { group });
        return group;
    }

    /**
     * Remove a group from the timeline
     * @param groupId The ID of the group to remove
     * @param sender The component removing the group
     */
    public removeGroup(groupId: string, sender: any): void {
        if (this.groups.has(groupId)) {
            this.groups.delete(groupId);
            
            // Update layers that were in this group
            this.layers.forEach(layer => {
                if (layer.groupId === groupId) {
                    layer.groupId = undefined;
                }
            });
            
            // Emit event
            this.eventEmitter.emit(Events.GROUP_REMOVED, sender, { groupId });
        }
    }

    /**
     * Get all groups
     * @returns Array of group data objects
     */
    public getGroups(): GroupData[] {
        return Array.from(this.groups.values());
    }
}
