/**
 * Interface for cancellable events
 * Listeners can call preventDefault() to cancel the operation
 */
export interface ICancellableEvent {
  eventName: string;
  data: any;
  defaultPrevented: boolean;
  preventDefault(): void;
}

/**
 * EventManager handles all event subscriptions and emissions
 * Supports both regular and cancellable events
 */
export class EventManager {
  private listeners: Map<string, Set<Function>> = new Map();

  /**
   * Subscribe to an event
   * @param eventName Name of the event
   * @param callback Function to call when event is triggered
   */
  public on(eventName: string, callback: Function): void {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName)!.add(callback);
  }

  /**
   * Unsubscribe from an event
   * @param eventName Name of the event
   * @param callback Function to remove
   */
  public off(eventName: string, callback: Function): void {
    const callbacks = this.listeners.get(eventName);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  /**
   * Trigger an event
   * @param eventName Name of the event
   * @param data Data to pass to listeners
   * @returns The event object (for cancellable events)
   */
  public emit(eventName: string, data?: any): any {
    const callbacks = this.listeners.get(eventName);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
    return data;
  }

  /**
   * Emit a cancellable event
   * Listeners can call event.preventDefault() to cancel the operation
   * @param eventName Name of the event
   * @param data Data to pass to listeners
   * @returns The cancellable event object
   */
  public emitCancellable(eventName: string, data?: any): ICancellableEvent {
    const event: ICancellableEvent = {
      eventName,
      data,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      }
    };

    const callbacks = this.listeners.get(eventName);
    if (callbacks) {
      callbacks.forEach(callback => callback(event));
    }

    return event;
  }

  /**
   * Clear all listeners
   */
  public clear(): void {
    this.listeners.clear();
  }
}
