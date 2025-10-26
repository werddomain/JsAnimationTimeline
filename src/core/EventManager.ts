/**
 * Event Management System for JsAnimationTimeline
 * Provides publish/subscribe functionality for loose coupling between components
 * Following the Project Development Guidelines
 */

/**
 * Type definition for event handler functions
 */
export type EventHandler<T = any> = (data: T) => void;

/**
 * Interface for event subscription objects
 */
export interface IEventSubscription {
  /** Unique identifier for the subscription */
  id: string;
  /** Event name */
  event: string;
  /** Handler function */
  handler: EventHandler;
  /** Whether this is a one-time subscription */
  once: boolean;
}

/**
 * Event Manager class that handles event emission and subscription
 */
export class EventManager {
  private _events: Map<string, IEventSubscription[]> = new Map();
  private _subscriptionCounter: number = 0;

  /**
   * Subscribe to an event
   * @param event Event name to listen for
   * @param handler Function to call when event is emitted
   * @param once Whether to auto-unsubscribe after first call
   * @returns Subscription object that can be used to unsubscribe
   */
  public on<T = any>(event: string, handler: EventHandler<T>, once: boolean = false): IEventSubscription {
    const subscription: IEventSubscription = {
      id: `sub_${++this._subscriptionCounter}`,
      event,
      handler: handler as EventHandler,
      once
    };

    if (!this._events.has(event)) {
      this._events.set(event, []);
    }

    this._events.get(event)!.push(subscription);

    return subscription;
  }

  /**
   * Subscribe to an event for one-time execution
   * @param event Event name to listen for
   * @param handler Function to call when event is emitted
   * @returns Subscription object
   */
  public once<T = any>(event: string, handler: EventHandler<T>): IEventSubscription {
    return this.on(event, handler, true);
  }

  /**
   * Unsubscribe from an event
   * @param subscription Subscription object returned from on() or once()
   */
  public off(subscription: IEventSubscription): void {
    const handlers = this._events.get(subscription.event);
    if (!handlers) {
      return;
    }

    const index = handlers.findIndex(s => s.id === subscription.id);
    if (index !== -1) {
      handlers.splice(index, 1);
    }

    // Clean up empty event arrays
    if (handlers.length === 0) {
      this._events.delete(subscription.event);
    }
  }

  /**
   * Unsubscribe all handlers for a specific event
   * @param event Event name to clear
   */
  public offAll(event: string): void {
    this._events.delete(event);
  }

  /**
   * Emit an event to all subscribers
   * @param event Event name to emit
   * @param data Data to pass to event handlers
   */
  public emit<T = any>(event: string, data?: T): void {
    const handlers = this._events.get(event);
    if (!handlers) {
      return;
    }

    // Create a copy of handlers to avoid issues if handlers modify the array
    const handlersCopy = [...handlers];
    const oneTimeSubscriptions: string[] = [];

    for (const subscription of handlersCopy) {
      try {
        subscription.handler(data);
      } catch (error) {
        console.error(`Error in event handler for '${event}':`, error);
      }

      if (subscription.once) {
        oneTimeSubscriptions.push(subscription.id);
      }
    }

    // Remove one-time subscriptions
    if (oneTimeSubscriptions.length > 0) {
      for (const subscriptionId of oneTimeSubscriptions) {
        const subscription = handlersCopy.find(s => s.id === subscriptionId);
        if (subscription) {
          this.off(subscription);
        }
      }
    }
  }

  /**
   * Get the number of subscribers for an event
   * @param event Event name
   * @returns Number of subscribers
   */
  public getSubscriberCount(event: string): number {
    const handlers = this._events.get(event);
    return handlers ? handlers.length : 0;
  }

  /**
   * Get all event names that have subscribers
   * @returns Array of event names
   */
  public getEventNames(): string[] {
    return Array.from(this._events.keys());
  }

  /**
   * Clear all event subscriptions
   */
  public clear(): void {
    this._events.clear();
  }

  /**
   * Get debug information about current subscriptions
   * @returns Object with debug information
   */
  public getDebugInfo(): { totalEvents: number; totalSubscriptions: number; events: Record<string, number> } {
    const events: Record<string, number> = {};
    let totalSubscriptions = 0;

    for (const [eventName, handlers] of this._events) {
      events[eventName] = handlers.length;
      totalSubscriptions += handlers.length;
    }

    return {
      totalEvents: this._events.size,
      totalSubscriptions,
      events
    };
  }
}