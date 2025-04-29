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
  | 'layerLockChanged';

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
    for (const cb of this.listeners[event]) cb(payload);
  }
}
