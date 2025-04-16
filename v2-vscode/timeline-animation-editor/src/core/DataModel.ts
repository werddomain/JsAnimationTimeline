// filepath: c:\Users\BenoitRobin\JsTimeline\v2-vscode\timeline-animation-editor\src\core\DataModel.ts
import { Layer, Keyframe, Group, TimelineState } from '../types';
import { DEFAULT_VALUES } from '../utils/Constants';
import { EventEmitter } from './EventEmitter';
import { EVENT_TYPES } from '../utils/EventTypes';

export class DataModel {
    private layers: Layer[] = [];
    private keyframes: Map<string, Keyframe[]> = new Map();
    private groups: Group[] = [];
    private currentTime: number = 0;
    private duration: number = DEFAULT_VALUES.DEFAULT_DURATION;
    private timeScale: number = DEFAULT_VALUES.DEFAULT_TIME_SCALE;
    private eventEmitter: EventEmitter<string>;

    constructor(eventEmitter: EventEmitter<string>) {
        this.eventEmitter = eventEmitter;
    }

    // Layer methods
    public addLayer(layer: Layer): void {
        this.layers.push(layer);
        this.keyframes.set(layer.id, layer.keyframes || []);
        this.eventEmitter.emit(EVENT_TYPES.LAYER_ADDED, { layer });
        this.eventEmitter.emit(EVENT_TYPES.DATA_CHANGED, null);
    }

    public removeLayer(layerId: string): void {
        this.layers = this.layers.filter(layer => layer.id !== layerId);
        this.keyframes.delete(layerId);
        
        // Also remove layer from any groups
        for (const group of this.groups) {
            group.layerIds = group.layerIds.filter(id => id !== layerId);
        }
        
        this.eventEmitter.emit(EVENT_TYPES.LAYER_REMOVED, { layerId });
        this.eventEmitter.emit(EVENT_TYPES.DATA_CHANGED, null);
    }

    public renameLayer(layerId: string, newName: string): void {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer) {
            layer.name = newName;
            this.eventEmitter.emit(EVENT_TYPES.LAYER_RENAMED, { layerId, newName });
            this.eventEmitter.emit(EVENT_TYPES.DATA_CHANGED, null);
        }
    }

    public getLayers(): Layer[] {
        return [...this.layers];
    }

    public getLayer(layerId: string): Layer | undefined {
        return this.layers.find(layer => layer.id === layerId);
    }

    // Keyframe methods
    public addKeyframe(layerId: string, keyframe: Keyframe): void {
        if (!this.keyframes.has(layerId)) {
            this.keyframes.set(layerId, []);
        }
        
        this.keyframes.get(layerId)!.push(keyframe);
        
        // Also update the layer object for consistency
        const layer = this.layers.find(l => l.id === layerId);
        if (layer) {
            if (!layer.keyframes) {
                layer.keyframes = [];
            }
            layer.keyframes.push(keyframe);
        }
        
        this.eventEmitter.emit(EVENT_TYPES.KEYFRAME_ADDED, { layerId, keyframe });
        this.eventEmitter.emit(EVENT_TYPES.DATA_CHANGED, null);
    }

    public removeKeyframe(layerId: string, keyframeId: string): void {
        if (!this.keyframes.has(layerId)) return;
        
        this.keyframes.set(
            layerId,
            this.keyframes.get(layerId)!.filter(k => k.id !== keyframeId)
        );
        
        // Also update the layer object for consistency
        const layer = this.layers.find(l => l.id === layerId);
        if (layer && layer.keyframes) {
            layer.keyframes = layer.keyframes.filter(k => k.id !== keyframeId);
        }
        
        this.eventEmitter.emit(EVENT_TYPES.KEYFRAME_REMOVED, { layerId, keyframeId });
        this.eventEmitter.emit(EVENT_TYPES.DATA_CHANGED, null);
    }

    public updateKeyframeTime(layerId: string, keyframeId: string, newTime: number): void {
        if (!this.keyframes.has(layerId)) return;
        
        const keyframes = this.keyframes.get(layerId)!;
        const keyframe = keyframes.find(k => k.id === keyframeId);
        
        if (keyframe) {
            keyframe.time = newTime;
            
            // Also update the layer object for consistency
            const layer = this.layers.find(l => l.id === layerId);
            if (layer && layer.keyframes) {
                const layerKeyframe = layer.keyframes.find(k => k.id === keyframeId);
                if (layerKeyframe) {
                    layerKeyframe.time = newTime;
                }
            }
            
            this.eventEmitter.emit(EVENT_TYPES.KEYFRAME_MOVED, { layerId, keyframeId, newTime });
            this.eventEmitter.emit(EVENT_TYPES.DATA_CHANGED, null);
        }
    }

    public getKeyframes(layerId: string): Keyframe[] {
        return this.keyframes.has(layerId) ? [...this.keyframes.get(layerId)!] : [];
    }

    public getAllKeyframes(): Keyframe[] {
        let allKeyframes: Keyframe[] = [];
        this.keyframes.forEach(keyframesArray => {
            allKeyframes = allKeyframes.concat(keyframesArray);
        });
        return allKeyframes;
    }

    // Group methods
    public addGroup(group: Group): void {
        this.groups.push(group);
        this.eventEmitter.emit(EVENT_TYPES.GROUP_CREATED, { group });
        this.eventEmitter.emit(EVENT_TYPES.DATA_CHANGED, null);
    }

    public removeGroup(groupId: string): void {
        this.groups = this.groups.filter(group => group.id !== groupId);
        this.eventEmitter.emit(EVENT_TYPES.GROUP_REMOVED, { groupId });
        this.eventEmitter.emit(EVENT_TYPES.DATA_CHANGED, null);
    }

    public renameGroup(groupId: string, newName: string): void {
        const group = this.groups.find(g => g.id === groupId);
        if (group) {
            group.name = newName;
            this.eventEmitter.emit(EVENT_TYPES.GROUP_RENAMED, { groupId, newName });
            this.eventEmitter.emit(EVENT_TYPES.DATA_CHANGED, null);
        }
    }

    public getGroups(): Group[] {
        return [...this.groups];
    }

    public addLayerToGroup(groupId: string, layerId: string): void {
        const group = this.groups.find(g => g.id === groupId);
        if (group && !group.layerIds.includes(layerId)) {
            group.layerIds.push(layerId);
            this.eventEmitter.emit(EVENT_TYPES.LAYER_ADDED_TO_GROUP, { groupId, layerId });
            this.eventEmitter.emit(EVENT_TYPES.DATA_CHANGED, null);
        }
    }

    public removeLayerFromGroup(groupId: string, layerId: string): void {
        const group = this.groups.find(g => g.id === groupId);
        if (group) {
            group.layerIds = group.layerIds.filter(id => id !== layerId);
            this.eventEmitter.emit(EVENT_TYPES.LAYER_REMOVED_FROM_GROUP, { groupId, layerId });
            this.eventEmitter.emit(EVENT_TYPES.DATA_CHANGED, null);
        }
    }

    // Timeline state methods
    public setCurrentTime(time: number): void {
        this.currentTime = Math.max(0, Math.min(time, this.duration));
        this.eventEmitter.emit(EVENT_TYPES.TIME_UPDATED, { time: this.currentTime });
    }

    public getCurrentTime(): number {
        return this.currentTime;
    }

    public setDuration(duration: number): void {
        this.duration = Math.max(1, duration); // Minimum duration of 1 second
        this.eventEmitter.emit(EVENT_TYPES.DURATION_CHANGED, { duration: this.duration });
        this.eventEmitter.emit(EVENT_TYPES.DATA_CHANGED, null);
    }

    public getDuration(): number {
        return this.duration;
    }

    public setTimeScale(scale: number): void {
        this.timeScale = Math.max(
            DEFAULT_VALUES.MIN_TIME_SCALE, 
            Math.min(DEFAULT_VALUES.MAX_TIME_SCALE, scale)
        );
        this.eventEmitter.emit(EVENT_TYPES.ZOOM_CHANGED, { scale: this.timeScale });
    }

    public getTimeScale(): number {
        return this.timeScale;
    }

    // State management
    public getState(): TimelineState {
        return {
            currentTime: this.currentTime,
            timeScale: this.timeScale,
            duration: this.duration,
            layers: this.layers,
            groups: this.groups
        };
    }

    public setState(state: TimelineState): void {
        this.currentTime = state.currentTime || 0;
        this.timeScale = state.timeScale || DEFAULT_VALUES.DEFAULT_TIME_SCALE;
        this.duration = state.duration || DEFAULT_VALUES.DEFAULT_DURATION;
        this.layers = state.layers || [];
        this.groups = state.groups || [];
        
        // Rebuild keyframes map
        this.keyframes.clear();
        for (const layer of this.layers) {
            this.keyframes.set(layer.id, layer.keyframes || []);
        }
        
        this.eventEmitter.emit(EVENT_TYPES.DATA_LOADED, { state });
    }

    public clear(): void {
        this.layers = [];
        this.keyframes.clear();
        this.groups = [];
        this.currentTime = 0;
        this.eventEmitter.emit(EVENT_TYPES.DATA_RESET, null);
    }
}
