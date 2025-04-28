/**
 * DataModel class
 * Central data storage for timeline state including layers, keyframes, etc.
 */

import { EventEmitter } from './EventEmitter';
import { Events } from '../constants/Constants';

// Scene interface
export interface IScene {
    id: string;
    name: string;
    layers: Record<string, ILayer>;
}

// Layer interface
export interface ILayer {
    id: string;
    name: string;
    visible: boolean;
    locked: boolean;
    groupId?: string;
    order: number;
    keyframes: Record<string, IKeyframe>;
    color?: string;
    isGroup?: boolean;
    children?: string[];
    parent?: string | null;
}

// Keyframe types enum
export enum KeyframeType {
    SOLID = 'solid',    // Keyframe with content
    HOLLOW = 'hollow'   // Empty keyframe
}

// Tween types enum
export enum TweenType {
    MOTION = 'motion',  // Motion tween (position, rotation, etc.)
    SHAPE = 'shape'     // Shape tween (morphing)
}

// Keyframe interface
export interface IKeyframe {
    id: string;
    time: number;
    value: any; // The actual value at this keyframe (could be position, scale, color, etc.)
    type: KeyframeType;
    easing?: string; // Optional easing function for tweens
    nextTween?: ITween; // Optional reference to a tween that starts at this keyframe
}

// Tween interface
export interface ITween {
    id: string;
    type: TweenType;
    startKeyframeId: string;
    endKeyframeId: string;
    properties: string[]; // Properties being tweened
}

// Timeline options interface
export interface ITimelineOptions {
    duration: number;
    timeScale: number;
    startTime: number;
    fps: number;
}

// Timeline state interface
export interface ITimelineState {
    currentTime: number;
    duration: number;
    timeScale: number;
    fps: number;
    scenes: Record<string, IScene>;
    currentSceneId: string | null;
    layers: Record<string, ILayer>;
    selectedLayerIds: string[];
    selectedKeyframeIds: Record<string, string[]>; // layer ID -> keyframe IDs
    tweens: Record<string, ITween>; // tween ID -> tween
    playheadPosition: number; // Current playhead position in pixels
    selectedStageElementIds: string[]; // IDs of selected elements on the stage
}

export class DataModel extends EventEmitter {
    private state: ITimelineState;
    
    /**
     * Constructor for DataModel
     * @param options - Configuration options for the timeline
     */    constructor(options?: Partial<ITimelineOptions>) {
        super();        // Initialize with default state
        this.state = {
            currentTime: options?.startTime || 0,
            duration: options?.duration || 10,
            timeScale: options?.timeScale || 100, // pixels per second
            fps: options?.fps || 30,
            scenes: {},
            currentSceneId: null,
            layers: {},
            selectedLayerIds: [],
            selectedKeyframeIds: {},
            tweens: {},
            playheadPosition: 0,
            selectedStageElementIds: []
        };
          // Create default scene
        const defaultSceneId = 'scene-1';
        this.addScene({
            id: defaultSceneId,
            name: 'Main Scene',
            layers: {}
        });
        this.setCurrentScene(defaultSceneId);
        
        // Note: We don't create a default layer here anymore
        // Default layer creation is handled by TimelineControl.verifyDefaultLayer
    }
    
    /**
     * Get the current time
     * @returns Current time in seconds
     */
    public getCurrentTime(): number {
        return this.state.currentTime;
    }
    
    /**
     * Set the current time and emit TIME_CHANGED event
     * @param time - New current time in seconds
     */
    public setCurrentTime(time: number): void {
        const previousTime = this.state.currentTime;
        this.state.currentTime = Math.max(0, Math.min(time, this.state.duration));
        
        this.emit(Events.TIME_CHANGED, {
            time: this.state.currentTime,
            previousTime
        });
    }
    
    /**
     * Get the timeline duration
     * @returns Duration in seconds
     */
    public getDuration(): number {
        return this.state.duration;
    }
    
    /**
     * Set the timeline duration and emit DURATION_CHANGED event
     * @param duration - New duration in seconds
     */
    public setDuration(duration: number): void {
        const previousDuration = this.state.duration;
        this.state.duration = Math.max(1, duration);
        
        this.emit(Events.DURATION_CHANGED, {
            duration: this.state.duration,
            previousDuration
        });
    }
    
    /**
     * Get the time scale
     * @returns Time scale in pixels per second
     */
    public getTimeScale(): number {
        return this.state.timeScale;
    }
    
    /**
     * Set the time scale and emit SCALE_CHANGED event
     * @param scale - New time scale in pixels per second
     */
    public setTimeScale(scale: number): void {
        const previousScale = this.state.timeScale;
        this.state.timeScale = Math.max(10, Math.min(scale, 500));
        
        this.emit(Events.SCALE_CHANGED, {
            scale: this.state.timeScale,
            previousScale
        });
    }
    
    /**
     * Get the current frame rate
     * @returns Frame rate in frames per second
     */
    public getFps(): number {
        return this.state.fps;
    }
    
    /**
     * Set the frame rate
     * @param fps - Frame rate in frames per second
     */
    public setFps(fps: number): void {
        this.state.fps = Math.max(1, Math.min(fps, 120)); // Limit to 1-120 FPS
    }
    
    /**
     * Get all layers
     * @returns Record of layer IDs to layer objects
     */
    public getLayers(): Record<string, ILayer> {
        return this.state.layers;
    }
    
    /**
     * Get a specific layer
     * @param id - Layer ID
     * @returns Layer object if found, undefined otherwise
     */
    public getLayer(id: string): ILayer | undefined {
        return this.state.layers[id];
    }
      /**
     * Add a new layer and emit LAYER_ADDED event
     * @param layer - Layer to add
     */
    public addLayer(layer: ILayer): void {
        // Ensure the layer has a unique ID
        if (this.state.layers[layer.id]) {
            throw new Error(`Layer with ID ${layer.id} already exists`);
        }
        
        // Add the layer
        this.state.layers[layer.id] = {
            ...layer,
            keyframes: layer.keyframes || {}
        };
        
        // Also update the current scene's layers if a scene is selected
        if (this.state.currentSceneId) {
            const currentScene = this.state.scenes[this.state.currentSceneId];
            currentScene.layers[layer.id] = this.state.layers[layer.id];
        }
        
        this.emit(Events.LAYER_ADDED, layer);
    }
      /**
     * Update a layer and emit LAYER_UPDATED event
     * @param id - Layer ID
     * @param updates - Layer updates
     */
    public updateLayer(id: string, updates: Partial<ILayer>): void {
        const layer = this.state.layers[id];
        
        if (!layer) {
            throw new Error(`Layer with ID ${id} not found`);
        }
        
        // Update the layer
        this.state.layers[id] = {
            ...layer,
            ...updates
        };
        
        // Also update the current scene's layers if a scene is selected
        if (this.state.currentSceneId) {
            const currentScene = this.state.scenes[this.state.currentSceneId];
            currentScene.layers[id] = this.state.layers[id];
        }
        
        this.emit(Events.LAYER_UPDATED, this.state.layers[id]);
    }
      /**
     * Remove a layer and emit LAYER_REMOVED event
     * @param id - Layer ID
     */
    public removeLayer(id: string): void {
        const layer = this.state.layers[id];
        
        if (!layer) {
            return; // Nothing to remove
        }
        
        // Remove layer from selected layers
        this.deselectLayer(id);
        
        // Remove the layer
        delete this.state.layers[id];
        
        // Also update the current scene's layers if a scene is selected
        if (this.state.currentSceneId) {
            const currentScene = this.state.scenes[this.state.currentSceneId];
            delete currentScene.layers[id];
        }
        
        this.emit(Events.LAYER_REMOVED, layer);
    }
    
    /**
     * Get selected layer IDs
     * @returns Array of selected layer IDs
     */
    public getSelectedLayerIds(): string[] {
        return this.state.selectedLayerIds;
    }
    
    /**
     * Select a layer and emit LAYER_SELECTED event
     * @param id - Layer ID
     */
    public selectLayer(id: string): void {
        const layer = this.state.layers[id];
        
        if (!layer) {
            throw new Error(`Layer with ID ${id} not found`);
        }
        
        if (!this.state.selectedLayerIds.includes(id)) {
            this.state.selectedLayerIds.push(id);
            this.emit(Events.LAYER_SELECTED, layer);
        }
    }
    
    /**
     * Deselect a layer and emit LAYER_DESELECTED event
     * @param id - Layer ID
     */
    public deselectLayer(id: string): void {
        const layer = this.state.layers[id];
        
        if (!layer) {
            return; // Nothing to deselect
        }
        
        const index = this.state.selectedLayerIds.indexOf(id);
        if (index !== -1) {
            this.state.selectedLayerIds.splice(index, 1);
            this.emit(Events.LAYER_DESELECTED, layer);
        }
    }
    
    /**
     * Get keyframes for a layer
     * @param layerId - Layer ID
     * @returns Record of keyframe IDs to keyframe objects
     */
    public getKeyframes(layerId: string): Record<string, IKeyframe> | undefined {
        const layer = this.state.layers[layerId];
        return layer ? layer.keyframes : undefined;
    }
    
    /**
     * Get a specific keyframe
     * @param layerId - Layer ID
     * @param keyframeId - Keyframe ID
     * @returns Keyframe object if found, undefined otherwise
     */
    public getKeyframe(layerId: string, keyframeId: string): IKeyframe | undefined {
        const layer = this.state.layers[layerId];
        return layer ? layer.keyframes[keyframeId] : undefined;
    }
      /**
     * Add a keyframe to a layer and emit KEYFRAME_ADDED event
     * @param layerId - Layer ID
     * @param keyframe - Keyframe to add
     */
    public addKeyframe(layerId: string, keyframe: IKeyframe): void {
        const layer = this.state.layers[layerId];
        
        if (!layer) {
            throw new Error(`Layer with ID ${layerId} not found`);
        }
        
        // Ensure the keyframe has a unique ID
        if (layer.keyframes[keyframe.id]) {
            throw new Error(`Keyframe with ID ${keyframe.id} already exists in layer ${layerId}`);
        }
        
        // Set default keyframe type if not provided
        if (!keyframe.type) {
            keyframe.type = keyframe.value ? KeyframeType.SOLID : KeyframeType.HOLLOW;
        }
        
        // Add the keyframe
        layer.keyframes[keyframe.id] = keyframe;
        
        this.emit(Events.KEYFRAME_ADDED, {
            layerId,
            keyframeId: keyframe.id,
            time: keyframe.time,
            value: keyframe.value,
            type: keyframe.type
        });
    }
      /**
     * Update a keyframe and emit KEYFRAME_UPDATED event
     * @param layerId - Layer ID
     * @param keyframeId - Keyframe ID
     * @param updates - Keyframe updates
     */
    public updateKeyframe(layerId: string, keyframeId: string, updates: Partial<IKeyframe>): void {
        const layer = this.state.layers[layerId];
        
        if (!layer) {
            throw new Error(`Layer with ID ${layerId} not found`);
        }
        
        const keyframe = layer.keyframes[keyframeId];
        
        if (!keyframe) {
            throw new Error(`Keyframe with ID ${keyframeId} not found in layer ${layerId}`);
        }
        
        // Update the keyframe
        layer.keyframes[keyframeId] = {
            ...keyframe,
            ...updates
        };
        
        // Update keyframe type if value changes
        if (updates.value !== undefined && updates.type === undefined) {
            layer.keyframes[keyframeId].type = updates.value ? KeyframeType.SOLID : KeyframeType.HOLLOW;
        }
        
        this.emit(Events.KEYFRAME_UPDATED, {
            layerId,
            keyframeId,
            time: layer.keyframes[keyframeId].time,
            value: layer.keyframes[keyframeId].value,
            type: layer.keyframes[keyframeId].type
        });
    }
    
    /**
     * Remove a keyframe and emit KEYFRAME_REMOVED event
     * @param layerId - Layer ID
     * @param keyframeId - Keyframe ID
     */
    public removeKeyframe(layerId: string, keyframeId: string): void {
        const layer = this.state.layers[layerId];
        
        if (!layer) {
            throw new Error(`Layer with ID ${layerId} not found`);
        }
        
        const keyframe = layer.keyframes[keyframeId];
        
        if (!keyframe) {
            return; // Nothing to remove
        }
        
        // Remove keyframe from selected keyframes
        this.deselectKeyframe(layerId, keyframeId);
        
        // Remove the keyframe
        delete layer.keyframes[keyframeId];
        
        this.emit(Events.KEYFRAME_REMOVED, {
            layerId,
            keyframeId,
            time: keyframe.time,
            value: keyframe.value
        });
    }
    
    /**
     * Get selected keyframe IDs for a layer
     * @param layerId - Layer ID
     * @returns Array of selected keyframe IDs
     */
    public getSelectedKeyframeIds(layerId: string): string[] {
        return this.state.selectedKeyframeIds[layerId] || [];
    }
    
    /**
     * Select a keyframe and emit KEYFRAME_SELECTED event
     * @param layerId - Layer ID
     * @param keyframeId - Keyframe ID
     */
    public selectKeyframe(layerId: string, keyframeId: string): void {
        const layer = this.state.layers[layerId];
        
        if (!layer) {
            throw new Error(`Layer with ID ${layerId} not found`);
        }
        
        const keyframe = layer.keyframes[keyframeId];
        
        if (!keyframe) {
            throw new Error(`Keyframe with ID ${keyframeId} not found in layer ${layerId}`);
        }
        
        if (!this.state.selectedKeyframeIds[layerId]) {
            this.state.selectedKeyframeIds[layerId] = [];
        }
        
        if (!this.state.selectedKeyframeIds[layerId].includes(keyframeId)) {
            this.state.selectedKeyframeIds[layerId].push(keyframeId);
            
            this.emit(Events.KEYFRAME_SELECTED, {
                layerId,
                keyframeId,
                time: keyframe.time,
                value: keyframe.value
            });
        }
    }
    
    /**
     * Deselect a keyframe and emit KEYFRAME_DESELECTED event
     * @param layerId - Layer ID
     * @param keyframeId - Keyframe ID
     */
    public deselectKeyframe(layerId: string, keyframeId: string): void {
        const layer = this.state.layers[layerId];
        
        if (!layer) {
            return; // Nothing to deselect
        }
        
        const keyframe = layer.keyframes[keyframeId];
        
        if (!keyframe) {
            return; // Nothing to deselect
        }
        
        const selectedKeyframes = this.state.selectedKeyframeIds[layerId];
        
        if (selectedKeyframes) {
            const index = selectedKeyframes.indexOf(keyframeId);
            
            if (index !== -1) {
                selectedKeyframes.splice(index, 1);
                
                this.emit(Events.KEYFRAME_DESELECTED, {
                    layerId,
                    keyframeId,
                    time: keyframe.time,
                    value: keyframe.value
                });
            }
        }
    }
      /**
     * Get all scenes
     * @returns Record of scene IDs to scene objects
     */
    public getScenes(): Record<string, IScene> {
        return this.state.scenes;
    }
    
    /**
     * Get a specific scene
     * @param id - Scene ID
     * @returns Scene object if found, undefined otherwise
     */
    public getScene(id: string): IScene | undefined {
        return this.state.scenes[id];
    }
    
    /**
     * Get the current scene
     * @returns Current scene if set, undefined otherwise
     */
    public getCurrentScene(): IScene | undefined {
        return this.state.currentSceneId ? this.state.scenes[this.state.currentSceneId] : undefined;
    }
    
    /**
     * Set the current scene and emit SCENE_SELECTED event
     * @param id - Scene ID
     */
    public setCurrentScene(id: string): void {
        const scene = this.state.scenes[id];
        
        if (!scene) {
            throw new Error(`Scene with ID ${id} not found`);
        }
        
        const previousSceneId = this.state.currentSceneId;
        this.state.currentSceneId = id;
        
        // Update layers to reflect the current scene
        this.state.layers = { ...scene.layers };
        
        this.emit(Events.SCENE_SELECTED, {
            id,
            name: scene.name,
            previousSceneId
        });
    }
    
    /**
     * Add a new scene and emit SCENE_ADDED event
     * @param scene - Scene to add
     */
    public addScene(scene: IScene): void {
        // Ensure the scene has a unique ID
        if (this.state.scenes[scene.id]) {
            throw new Error(`Scene with ID ${scene.id} already exists`);
        }
        
        // Add the scene
        this.state.scenes[scene.id] = {
            ...scene,
            layers: scene.layers || {}
        };
        
        this.emit(Events.SCENE_ADDED, scene);
    }
    
    /**
     * Remove a scene and emit SCENE_REMOVED event
     * @param id - Scene ID
     */
    public removeScene(id: string): void {
        const scene = this.state.scenes[id];
        
        if (!scene) {
            return; // Nothing to remove
        }
        
        // Cannot remove the current scene
        if (this.state.currentSceneId === id) {
            throw new Error(`Cannot remove the current scene. Switch to another scene first.`);
        }
        
        // Remove the scene
        delete this.state.scenes[id];
        
        this.emit(Events.SCENE_REMOVED, scene);
    }
    
    /**
     * Rename a scene and emit SCENE_RENAMED event
     * @param id - Scene ID
     * @param name - New scene name
     */
    public renameScene(id: string, name: string): void {
        const scene = this.state.scenes[id];
        
        if (!scene) {
            throw new Error(`Scene with ID ${id} not found`);
        }
        
        // Update the scene name
        scene.name = name;
        
        this.emit(Events.SCENE_RENAMED, {
            id,
            name
        });
    }

    /**
     * Get the entire timeline state
     * @returns Complete timeline state
     */
    public getState(): ITimelineState {
        return this.state;
    }
    
    /**
     * Set the entire timeline state
     * @param state - New timeline state
     */
    public setState(state: Partial<ITimelineState>): void {
        this.state = {
            ...this.state,
            ...state
        };
    }
    
    /**
     * Move a layer to a new position and emit LAYER_MOVED event
     * @param id - Layer ID
     * @param newOrder - New order for the layer
     */
    public moveLayer(id: string, newOrder: number): void {
        const layer = this.state.layers[id];
        
        if (!layer) {
            throw new Error(`Layer with ID ${id} not found`);
        }
        
        const oldOrder = layer.order;
        
        // Update the layer
        layer.order = newOrder;
        
        this.emit(Events.LAYER_MOVED, {
            layer,
            oldIndex: oldOrder,
            newIndex: newOrder
        });
    }
    
    /**
     * Rename a layer and emit LAYER_RENAMED event
     * @param id - Layer ID
     * @param newName - New name for the layer
     */    public renameLayer(id: string, newName: string): void {
        const layer = this.state.layers[id];
        
        if (!layer) {
            throw new Error(`Layer with ID ${id} not found`);
        }
        
        const oldName = layer.name;
        
        // Update the layer
        layer.name = newName;
        
        this.emit(Events.LAYER_RENAMED, {
            layer,
            oldName,
            newName
        });
    }
    
    /**
     * Set layer visibility and emit LAYER_UPDATED event
     * @param id - Layer ID
     * @param visible - Visibility state
     */
    public setLayerVisibility(id: string, visible: boolean): void {
        const layer = this.state.layers[id];
        
        if (!layer) {
            throw new Error(`Layer with ID ${id} not found`);
        }
        
        // Update the layer
        layer.visible = visible;
        
        this.emit(Events.LAYER_UPDATED, layer);
    }
    
    /**
     * Set layer locked state and emit LAYER_UPDATED event
     * @param id - Layer ID
     * @param locked - Lock state
     */
    public setLayerLocked(id: string, locked: boolean): void {
        const layer = this.state.layers[id];
        
        if (!layer) {
            throw new Error(`Layer with ID ${id} not found`);
        }
        
        // Update the layer
        layer.locked = locked;
        
        this.emit(Events.LAYER_UPDATED, layer);
    }
    
    /**
     * Set layer parent and emit LAYER_UPDATED event
     * @param id - Layer ID
     * @param parentId - Parent layer ID, null if no parent
     */
    public setLayerParent(id: string, parentId: string | null): void {
        const layer = this.state.layers[id];
        
        if (!layer) {
            throw new Error(`Layer with ID ${id} not found`);
        }
        
        // If we're removing from a parent
        if (layer.parent && layer.parent !== parentId) {
            const oldParent = this.state.layers[layer.parent];
            if (oldParent && oldParent.children) {
                const index = oldParent.children.indexOf(id);
                if (index !== -1) {
                    oldParent.children.splice(index, 1);
                }
            }
        }
        
        // If we're adding to a parent
        if (parentId) {
            const parent = this.state.layers[parentId];
            if (parent) {
                if (!parent.children) {
                    parent.children = [];
                }
                if (!parent.children.includes(id)) {
                    parent.children.push(id);
                }
            }
        }
        
        // Update the layer
        layer.parent = parentId;
        
        this.emit(Events.LAYER_UPDATED, layer);
    }
    
    /**
     * Get total count of layers
     * @returns Number of layers
     */
    public getLayerCount(): number {
        return Object.keys(this.state.layers).length;
    }
    
    /**
     * Check if a layer is selected
     * @param id - Layer ID
     * @returns True if the layer is selected
     */
    public isLayerSelected(id: string): boolean {
        return this.state.selectedLayerIds.includes(id);
    }
    
    /**
     * Clear all layer selections
     */
    public clearLayerSelection(): void {
        const selectedLayers = [...this.state.selectedLayerIds];
        selectedLayers.forEach(layerId => this.deselectLayer(layerId));
    }
    
    /**
     * Move a keyframe to a new time and emit KEYFRAME_MOVED event
     * @param layerId - Layer ID
     * @param keyframeId - Keyframe ID
     * @param newTime - New time for the keyframe
     */
    public moveKeyframe(layerId: string, keyframeId: string, newTime: number): void {
        const layer = this.state.layers[layerId];
        
        if (!layer) {
            throw new Error(`Layer with ID ${layerId} not found`);
        }
        
        const keyframe = layer.keyframes[keyframeId];
        
        if (!keyframe) {
            throw new Error(`Keyframe with ID ${keyframeId} not found in layer ${layerId}`);
        }
        
        const oldTime = keyframe.time;
        
        // Update the keyframe
        keyframe.time = newTime;
        
        this.emit(Events.KEYFRAME_MOVED, {
            layerId,
            keyframeId,
            oldTime,
            newTime,
            value: keyframe.value
        });
    }
    
    /**
     * Get playhead position
     * @returns Playhead position in pixels
     */
    public getPlayheadPosition(): number {
        return this.state.playheadPosition;
    }
    
    /**
     * Set playhead position and emit PLAYHEAD_MOVED event
     * @param position - New playhead position in pixels
     */
    public setPlayheadPosition(position: number): void {
        const previousPosition = this.state.playheadPosition;
        this.state.playheadPosition = Math.max(0, position);
        
        // Calculate the time based on position and timeScale
        const time = this.state.playheadPosition / this.state.timeScale;
        this.setCurrentTime(time);
        
        this.emit(Events.PLAYHEAD_MOVED, {
            position: this.state.playheadPosition,
            previousPosition,
            time
        });
    }
    
    /**
     * Get all tweens
     * @returns Record of tween IDs to tween objects
     */
    public getTweens(): Record<string, ITween> {
        return this.state.tweens;
    }
    
    /**
     * Get a specific tween
     * @param id - Tween ID
     * @returns Tween object if found, undefined otherwise
     */
    public getTween(id: string): ITween | undefined {
        return this.state.tweens[id];
    }
    
    /**
     * Add a tween and emit TWEEN_ADDED event
     * @param tween - Tween to add
     */
    public addTween(tween: ITween): void {
        // Ensure the tween has a unique ID
        if (this.state.tweens[tween.id]) {
            throw new Error(`Tween with ID ${tween.id} already exists`);
        }
        
        // Add the tween
        this.state.tweens[tween.id] = tween;
        
        // Update the start keyframe to reference this tween
        const startKeyframe = this.findKeyframeById(tween.startKeyframeId);
        if (startKeyframe) {
            startKeyframe.nextTween = tween;
        }
        
        this.emit(Events.TWEEN_ADDED, {
            tweenId: tween.id,
            type: tween.type,
            startKeyframeId: tween.startKeyframeId,
            endKeyframeId: tween.endKeyframeId
        });
    }
    
    /**
     * Update a tween and emit TWEEN_UPDATED event
     * @param id - Tween ID
     * @param updates - Tween updates
     */
    public updateTween(id: string, updates: Partial<ITween>): void {
        const tween = this.state.tweens[id];
        
        if (!tween) {
            throw new Error(`Tween with ID ${id} not found`);
        }
        
        // Update the tween
        this.state.tweens[id] = {
            ...tween,
            ...updates
        };
        
        this.emit(Events.TWEEN_UPDATED, {
            tweenId: id,
            type: this.state.tweens[id].type,
            startKeyframeId: this.state.tweens[id].startKeyframeId,
            endKeyframeId: this.state.tweens[id].endKeyframeId
        });
    }
    
    /**
     * Remove a tween and emit TWEEN_REMOVED event
     * @param id - Tween ID
     */
    public removeTween(id: string): void {
        const tween = this.state.tweens[id];
        
        if (!tween) {
            return; // Nothing to remove
        }
        
        // Remove tween reference from the start keyframe
        const startKeyframe = this.findKeyframeById(tween.startKeyframeId);
        if (startKeyframe && startKeyframe.nextTween?.id === id) {
            startKeyframe.nextTween = undefined;
        }
        
        // Remove the tween
        delete this.state.tweens[id];
        
        this.emit(Events.TWEEN_REMOVED, {
            tweenId: id,
            startKeyframeId: tween.startKeyframeId,
            endKeyframeId: tween.endKeyframeId
        });
    }
    
    /**
     * Helper method to find a keyframe by ID across all layers
     * @param keyframeId - Keyframe ID to find
     * @returns Keyframe object if found, undefined otherwise
     * @private
     */
    private findKeyframeById(keyframeId: string): IKeyframe | undefined {
        for (const layerId in this.state.layers) {
            const keyframe = this.state.layers[layerId].keyframes[keyframeId];
            if (keyframe) {
                return keyframe;
            }
        }
        return undefined;
    }
    
    /**
     * Get selected stage element IDs
     * @returns Array of selected stage element IDs
     */
    public getSelectedStageElementIds(): string[] {
        return this.state.selectedStageElementIds;
    }
    
    /**
     * Select a stage element and emit STAGE_ELEMENT_SELECTED event
     * @param id - Stage element ID
     */
    public selectStageElement(id: string): void {
        if (!this.state.selectedStageElementIds.includes(id)) {
            this.state.selectedStageElementIds.push(id);
            this.emit(Events.STAGE_ELEMENT_SELECTED, { elementId: id });
        }
    }
    
    /**
     * Deselect a stage element
     * @param id - Stage element ID
     */
    public deselectStageElement(id: string): void {
        const index = this.state.selectedStageElementIds.indexOf(id);
        if (index !== -1) {
            this.state.selectedStageElementIds.splice(index, 1);
        }
    }
}
