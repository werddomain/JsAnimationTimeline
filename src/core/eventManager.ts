// Simple pub/sub event bus for event-driven architecture
export type TimelineEvent =
  | 'playheadMove'
  | 'fpsChange'
  | 'layerChange'
  | 'keyframeChange'
  | 'stateChange'
  | 'layerAdded'
  | 'layerRemoved'
  | 'layerRenamed'
  | 'layerReordered'
  | 'layerVisibilityChanged'
  | 'layerLockChanged'
  | 'layerSelected'
  | 'scrollChange'
  | 'scrollPositionChange'
  | 'contentSizeChange'
  // Add new event types for component interactions
  | 'playbackStarted'
  | 'playbackStopped'
  | 'frameStep'
  | 'frameCountChanged'
  | 'frameWidthChanged'
  | 'playheadDragged'
  | 'playheadDragEnd'
  | 'rulerScrollChange'
  | 'fpsChanged';

export class EventManager {
  private listeners: { [event: string]: Array<(payload?: any) => void> } = {};

  subscribe(event: TimelineEvent, callback: (payload?: any) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  unsubscribe(event: TimelineEvent, callback: (payload?: any) => void) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  emit(event: TimelineEvent, payload?: any) {
    if (!this.listeners[event]) return;
    // if (event === 'layerSelected'){
    //   debugger;
    // }
    for (const cb of this.listeners[event]) cb(payload);
  }
}
