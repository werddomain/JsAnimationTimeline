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
   */
  public emit(eventName: string, data?: any): void {
    const callbacks = this.listeners.get(eventName);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  /**
   * Clear all listeners
   */
  public clear(): void {
    this.listeners.clear();
  }
}
