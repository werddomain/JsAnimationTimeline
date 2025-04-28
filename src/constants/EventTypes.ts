/**
 * Type definitions for all event handlers used in the timeline animation editor
 */

import { ILayer } from '../core/DataModel';

// Base Event interface that all events extend
export interface IEvent<T = any> {
    type: string;
    sender: any;
    data: T;
}

// Time-related event types
export interface ITimeChangedEvent extends IEvent {
    data: {
        time: number;
        previousTime: number;
    };
}

export interface IDurationChangedEvent extends IEvent {
    data: {
        duration: number;
        previousDuration: number;
    };
}

export interface IScaleChangedEvent extends IEvent {
    data: {
        scale: number;
        previousScale: number;
    };
}

export interface ISeekEvent extends IEvent {
    data: {
        time: number;
    };
}

// Layer-related event types
export interface ILayerEvent extends IEvent {
    data: ILayer;
}

export interface ILayerAddedEvent extends ILayerEvent {}
export interface ILayerRemovedEvent extends ILayerEvent {}
export interface ILayerUpdatedEvent extends ILayerEvent {}
export interface ILayerSelectedEvent extends ILayerEvent {}
export interface ILayerDeselectedEvent extends ILayerEvent {}

export interface ILayerMovedEvent extends IEvent {
    data: {
        layer: ILayer;
        oldIndex: number;
        newIndex: number;
    };
}

export interface ILayerRenamedEvent extends IEvent {
    data: {
        layer: ILayer;
        oldName: string;
        newName: string;
    };
}

// Keyframe-related event types
export interface IKeyframeEvent extends IEvent {
    data: {
        layerId: string;
        keyframeId: string;
        time: number;
        value: any;
    };
}

export interface IKeyframeAddedEvent extends IKeyframeEvent {}
export interface IKeyframeRemovedEvent extends IKeyframeEvent {}
export interface IKeyframeUpdatedEvent extends IKeyframeEvent {}
export interface IKeyframeSelectedEvent extends IKeyframeEvent {}
export interface IKeyframeDeselectedEvent extends IKeyframeEvent {}

export interface IKeyframeMovedEvent extends IEvent {
    data: {
        layerId: string;
        keyframeId: string;
        oldTime: number;
        newTime: number;
        value: any;
    };
}

// Group-related event types
export interface IGroupEvent extends IEvent {
    data: {
        groupId: string;
        name: string;
    };
}

export interface IGroupCreatedEvent extends IGroupEvent {}
export interface IGroupRemovedEvent extends IGroupEvent {}
export interface IGroupExpandedEvent extends IGroupEvent {}
export interface IGroupCollapsedEvent extends IGroupEvent {}

// Scroll-related event types
export interface IScrollEvent extends IEvent {
    data: {
        position: number;
    };
}

export interface IScrollHorizontalEvent extends IScrollEvent {}
export interface IScrollVerticalEvent extends IScrollEvent {}

// Type for event handler functions
export type EventHandler<T extends IEvent> = (event: T) => void;
