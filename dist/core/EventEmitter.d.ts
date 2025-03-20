/**
 * Event Emitter with Strongly-Typed Events
 * Provides individual, typed methods for each event in the TimelineEventMap
 */
import { TimelineEventMap, TimelineEventListener } from './EventTypes';
import { Layer, Keyframe, MotionTween } from './DataModel';
import { PanelElementData } from '../plugins/panel/PanelComponent';
export declare class EventEmitter {
    private events;
    /**
     * Base method to subscribe to an event with type-safe callback
     * @param eventName Name of the event
     * @param callback Callback function
     * @returns Unsubscribe function
     */
    on<T extends keyof TimelineEventMap>(eventName: T, callback: TimelineEventListener<T>): () => void;
    /**
     * Subscribe to an event once with type-safe callback
     * @param eventName Name of the event
     * @param callback Callback function
     * @returns Unsubscribe function
     */
    once<T extends keyof TimelineEventMap>(eventName: T, callback: TimelineEventListener<T>): () => void;
    /**
     * Base method to emit an event (internal use only)
     * @param eventName Name of the event
     * @param args Arguments to pass to the callbacks
     */
    private emitBase;
    /**
     * Remove all event listeners
     * @param eventName Optional event name to remove listeners for
     */
    removeAllListeners(eventName?: keyof TimelineEventMap): void;
    /**
     * Get the number of listeners for an event
     * @param eventName Name of the event
     * @returns Number of listeners
     */
    listenerCount(eventName: keyof TimelineEventMap): number;
    emitPlay(): void;
    emitPause(): void;
    emitStop(): void;
    emitTimeChange(time: number): void;
    emitDurationChange(duration: number): void;
    emitLayerAdded(layer: Layer): void;
    emitLayerUpdated(layer: Layer): void;
    emitLayerRemoved(layerId: string): void;
    emitLayerSelected(layerId: string, isMultiSelect: boolean): void;
    emitLayerMoved(layerId: string, newIndex: number): void;
    emitLayerVisibilityChanged(layerId: string, visible: boolean): void;
    emitLayerGroupToggle(layerId: string, isExpanded: boolean): void;
    emitLayerGroupRemoved(layerId: string): void;
    emitLayerLockChanged(layerId: string, locked: boolean): void;
    emitLayerColorChanged(layerId: string, color: string): void;
    emitLayerNameChanged(layerId: string, name: string): void;
    emitKeyframeAdded(layerId: string, keyframe: Keyframe): void;
    emitKeyframeUpdated(layerId: string, keyframe: Keyframe): void;
    emitKeyframeRemoved(layerId: string, keyframeId: string): void;
    emitKeyframeSelected(layerId: string, keyframeId: string, isMultiSelect: boolean): void;
    emitKeyframeMoved(layerId: string, keyframeId: string, newTime: number): void;
    emitKeyframeUserCreated(layerId: string, time: number): void;
    emitTweenAdded(layerId: string, tween: MotionTween): void;
    emitTweenUpdated(layerId: string, tween: MotionTween): void;
    emitTweenRemoved(layerId: string, tweenId: string): void;
    emitTweenSelected(layer: Layer, tweenId: string): void;
    emitTweenDeselected(): void;
    emitTweenUserCreated(layerId: string, startKeyframeId: string, endKeyframeId: string): void;
    emitZoomChanged(scale: number): void;
    emitResize(width: number, height: number): void;
    emitDataImported(): void;
    emitDataExported(data: string): void;
    emitSeekToTime(time: number): void;
    emitPanelElementSelected(element: PanelElementData): void;
    emitPanelElementDeselected(): void;
    emitPanelElementUpdated(element: PanelElementData, time: number, keyframeProperties: Record<string, any>): void;
    emitPropertyChanged(elementId: string, propertyName: string, value: any): void;
    emitEditModeChanged(mode: string): void;
    emitSelectionChanged(selectedItems: Array<any>): void;
    emitUndo(): void;
    emitRedo(): void;
    emitGroupCreated(groupId: string, childIds: string[]): void;
    emitGroupDeleted(groupId: string, preserveChildren: boolean): void;
    emitGroupUpdated(groupId: string, properties: any): void;
    emitGroupToggle(groupId: string, isExpanded: boolean): void;
    emitStateSaved(stateId: string): void;
    emitStateLoaded(stateId: string): void;
    emitError(error: Error | string, source?: string): void;
    emitNotification(message: string, type?: 'info' | 'warning' | 'error' | 'success'): void;
}
