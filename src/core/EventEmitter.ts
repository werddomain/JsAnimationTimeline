/* eslint-disable @typescript-eslint/ban-types */
// src/core/EventEmitter.ts
/**
 * Event Emitter with Strongly-Typed Events
 * Provides individual, typed methods for each event in the TimelineEventMap
 */

import { TimelineEventMap, TimelineEventListener } from './EventTypes';
import { TimelineConstants } from './Constants';
import { Layer, Keyframe, MotionTween } from './DataModel';
import { PanelElementData } from '../plugins/panel/PanelComponent';

const { EVENTS } = TimelineConstants;

export class EventEmitter {

    private events: Map<string, Function[]> = new Map();

    /**
     * Base method to subscribe to an event with type-safe callback
     * @param eventName Name of the event
     * @param callback Callback function
     * @returns Unsubscribe function
     */
    public on<T extends keyof TimelineEventMap>(
        eventName: T,
        callback: TimelineEventListener<T>
    ): () => void {
        if (!this.events.has(eventName as string)) {
            this.events.set(eventName as string, []);
        }

        const callbacks = this.events.get(eventName as string)!;
        callbacks.push(callback as Function);

        // Return unsubscribe function
        return () => {
            const index = callbacks.indexOf(callback as Function);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        };
    }

    /**
     * Subscribe to an event once with type-safe callback
     * @param eventName Name of the event
     * @param callback Callback function
     * @returns Unsubscribe function
     */
    public once<T extends keyof TimelineEventMap>(
        eventName: T,
        callback: TimelineEventListener<T>
    ): () => void {
        const unsubscribe = this.on(eventName, ((...args: any[]) => {
            unsubscribe();
            (callback as Function)(...args);
        }) as TimelineEventListener<T>);

        return unsubscribe;
    }

    /**
     * Base method to emit an event (internal use only)
     * @param eventName Name of the event
     * @param args Arguments to pass to the callbacks
     */
    private emitBase(eventName: string, ...args: any[]): void {
        const callbacks = this.events.get(eventName);
        if (!callbacks) return;

        // Create a copy to avoid issues if callbacks modify the array
        [...callbacks].forEach(callback => {
            try {
                callback(...args);
            } catch (error) {
                console.error(`Error in ${eventName} event handler:`, error);
            }
        });
    }

    /**
     * Remove all event listeners
     * @param eventName Optional event name to remove listeners for
     */
    public removeAllListeners(eventName?: keyof TimelineEventMap): void {
        if (eventName) {
            this.events.delete(eventName as string);
        } else {
            this.events.clear();
        }
    }

    /**
     * Get the number of listeners for an event
     * @param eventName Name of the event
     * @returns Number of listeners
     */
    public listenerCount(eventName: keyof TimelineEventMap): number {
        const callbacks = this.events.get(eventName as string);
        return callbacks ? callbacks.length : 0;
    }

    // Individual, strongly-typed emit methods for each event

    // Playback events
    public emitPlay(): void {
        this.emitBase(EVENTS.PLAY);
    }

    public emitPause(): void {
        this.emitBase(EVENTS.PAUSE);
    }

    public emitStop(): void {
        this.emitBase(EVENTS.STOP);
    }

    public emitTimeChange(time: number): void {
        this.emitBase(EVENTS.TIME_CHANGE, time);
    }

    public emitDurationChange(duration: number): void {
        this.emitBase(EVENTS.DURATION_CHANGE, duration);
    }

    // Layer events
    public emitLayerAdded(layer: Layer): void {
        this.emitBase(EVENTS.LAYER_ADDED, layer);
    }

    public emitLayerUpdated(layer: Layer): void {
        this.emitBase(EVENTS.LAYER_UPDATED, layer);
    }

    public emitLayerRemoved(layerId: string): void {
        this.emitBase(EVENTS.LAYER_REMOVED, layerId);
    }

    public emitLayerSelected(layerId: string, isMultiSelect: boolean): void {
        this.emitBase(EVENTS.LAYER_SELECTED, layerId, isMultiSelect);
    }

    public emitLayerMoved(layerId: string, newIndex: number): void {
        this.emitBase(EVENTS.LAYER_MOVED, layerId, newIndex);
    }

    public emitLayerVisibilityChanged(layerId: string, visible: boolean): void {
        this.emitBase(EVENTS.LAYER_VISIBILITY_CHANGED, layerId, visible);
    }

    public emitLayerGroupToggle(layerId: string, isExpanded: boolean): void {
        this.emitBase(EVENTS.LAYER_GROUP_TOGGLE, layerId, isExpanded);
    }

    public emitLayerGroupRemoved(layerId: string): void {
        this.emitBase(EVENTS.LAYER_GROUP_REMOVED, layerId);
    }

    public emitLayerLockChanged(layerId: string, locked: boolean): void {
        this.emitBase(EVENTS.LAYER_LOCK_CHANGED, layerId, locked);
    }

    public emitLayerColorChanged(layerId: string, color: string): void {
        this.emitBase(EVENTS.LAYER_COLOR_CHANGED, layerId, color);
    }

    public emitLayerNameChanged(layerId: string, name: string): void {
        this.emitBase(EVENTS.LAYER_NAME_CHANGED, layerId, name);
    }

    // Keyframe events
    public emitKeyframeAdded(layerId: string, keyframe: Keyframe): void {
        this.emitBase(EVENTS.KEYFRAME_ADDED, layerId, keyframe);
    }

    public emitKeyframeUpdated(layerId: string, keyframe: Keyframe): void {
        this.emitBase(EVENTS.KEYFRAME_UPDATED, layerId, keyframe);
    }

    public emitKeyframeRemoved(layerId: string, keyframeId: string): void {
        this.emitBase(EVENTS.KEYFRAME_REMOVED, layerId, keyframeId);
    }

    public emitKeyframeSelected(layerId: string, keyframeId: string, isMultiSelect: boolean): void {
        this.emitBase(EVENTS.KEYFRAME_SELECTED, layerId, keyframeId, isMultiSelect);
    }

    public emitKeyframeMoved(layerId: string, keyframeId: string, newTime: number): void {
        this.emitBase(EVENTS.KEYFRAME_MOVED, layerId, keyframeId, newTime);
    }

    public emitKeyframeUserCreated(layerId: string, time: number): void {
        this.emitBase(EVENTS.KEYFRAME_USER_CREATED, layerId, time);
    }

    // Motion tween events
    public emitTweenAdded(layerId: string, tween: MotionTween): void {
        this.emitBase(EVENTS.TWEEN_ADDED, layerId, tween);
    }

    public emitTweenUpdated(layerId: string, tween: MotionTween): void {
        this.emitBase(EVENTS.TWEEN_UPDATED, layerId, tween);
    }

    public emitTweenRemoved(layerId: string, tweenId: string): void {
        this.emitBase(EVENTS.TWEEN_REMOVED, layerId, tweenId);
    }

    public emitTweenSelected(layer: Layer, tweenId: string): void {
        this.emitBase(EVENTS.TWEEN_SELECTED, layer, tweenId);
    }

    public emitTweenDeselected(): void {
        this.emitBase(EVENTS.TWEEN_DESELECTED);
    }

    public emitTweenUserCreated(layerId: string, startKeyframeId: string, endKeyframeId: string): void {
        this.emitBase(EVENTS.TWEEN_USER_CREATED, layerId, startKeyframeId, endKeyframeId);
    }

    // UI events
    public emitZoomChanged(scale: number): void {
        this.emitBase(EVENTS.ZOOM_CHANGED, scale);
    }

    public emitResize(width: number, height: number): void {
        this.emitBase(EVENTS.RESIZE, width, height);
    }

    public emitDataImported(): void {
        this.emitBase(EVENTS.DATA_IMPORTED);
    }

    public emitDataExported(data: string): void {
        this.emitBase(EVENTS.DATA_EXPORTED, data);
    }

    public emitSeekToTime(time: number): void {
        this.emitBase(EVENTS.SEEK_TO_TIME, time);
    }

    // Panel events
    public emitPanelElementSelected(element: PanelElementData): void {
        this.emitBase(EVENTS.PANEL_ELEMENT_SELECTED, element);
    }

    public emitPanelElementDeselected(): void {
        this.emitBase(EVENTS.PANEL_ELEMENT_DESELECTED);
    }

    public emitPanelElementUpdated(element: PanelElementData, time: number, keyframeProperties: Record<string, any>): void {
        this.emitBase(EVENTS.PANEL_ELEMENT_UPDATED, element, time, keyframeProperties);
    }

    // Property events
    public emitPropertyChanged(elementId: string, propertyName: string, value: any): void {
        this.emitBase(EVENTS.PROPERTY_CHANGED, elementId, propertyName, value);
    }

    // Timeline editor events
    public emitEditModeChanged(mode: string): void {
        this.emitBase(EVENTS.EDIT_MODE_CHANGED, mode);
    }

    public emitSelectionChanged(selectedItems: Array<any>): void {
        this.emitBase(EVENTS.SELECTION_CHANGED, selectedItems);
    }

    public emitUndo(): void {
        this.emitBase(EVENTS.UNDO);
    }

    public emitRedo(): void {
        this.emitBase(EVENTS.REDO);
    }

    // Group events
    public emitGroupCreated(groupId: string, childIds: string[]): void {
        this.emitBase(EVENTS.GROUP_CREATED, groupId, childIds);
    }

    public emitGroupDeleted(groupId: string, preserveChildren: boolean): void {
        this.emitBase(EVENTS.GROUP_DELETED, groupId, preserveChildren);
    }

    public emitGroupUpdated(groupId: string, properties: any): void {
        this.emitBase(EVENTS.GROUP_UPDATED, groupId, properties);
    }
    public emitGroupToggle(groupId: string, isExpanded: boolean): void {
        this.emitBase(EVENTS.LAYER_GROUP_TOGGLE, groupId, isExpanded);
    }

    // Timeline state events
    public emitStateSaved(stateId: string): void {
        this.emitBase(EVENTS.STATE_SAVED, stateId);
    }

    public emitStateLoaded(stateId: string): void {
        this.emitBase(EVENTS.STATE_LOADED, stateId);
    }

    // Error and notification events
    public emitError(error: Error | string, source?: string): void {
        this.emitBase(EVENTS.ERROR, error, source);
    }

    public emitNotification(message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info'): void {
        this.emitBase(EVENTS.NOTIFICATION, message, type);
    }
}