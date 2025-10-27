import { IJsTimeLineContext } from '../IJsTimeLineContext';

/**
 * EventLogger - Utility for testing and debugging events
 * Logs all events to console with timestamps and formatted payloads
 */
export class EventLogger {
  private context: IJsTimeLineContext;
  private enabled: boolean = false;
  private eventCallbacks: Map<string, (payload: any) => void> = new Map();
  private eventLog: Array<{ timestamp: Date; eventName: string; payload: any }> = [];
  private maxLogSize: number = 100;

  constructor(context: IJsTimeLineContext) {
    this.context = context;
  }

  /**
   * Enable event logging
   */
  public enable(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.attachListeners();
    console.log('%c[EventLogger] Enabled', 'color: green; font-weight: bold');
  }

  /**
   * Disable event logging
   */
  public disable(): void {
    if (!this.enabled) return;
    this.enabled = false;
    this.detachListeners();
    console.log('%c[EventLogger] Disabled', 'color: red; font-weight: bold');
  }

  /**
   * Toggle event logging
   */
  public toggle(): void {
    if (this.enabled) {
      this.disable();
    } else {
      this.enable();
    }
  }

  /**
   * Check if event logging is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get the event log
   */
  public getLog(): Array<{ timestamp: Date; eventName: string; payload: any }> {
    return [...this.eventLog];
  }

  /**
   * Clear the event log
   */
  public clearLog(): void {
    this.eventLog = [];
    console.log('%c[EventLogger] Log cleared', 'color: orange; font-weight: bold');
  }

  /**
   * Attach listeners to all events
   */
  private attachListeners(): void {
    const eventManager = this.context.Core.eventManager;
    if (!eventManager) return;

    // List of all spec-compliant events
    const events = [
      'onObjectAdd',
      'onBeforeObjectDelete',
      'onObjectDelete',
      'onObjectRename',
      'onObjectReorder',
      'onObjectReparent',
      'onObjectVisibilityChange',
      'onObjectLockChange',
      'onLayerSelect',
      'onKeyframeAdd',
      'onBeforeKeyframeDelete',
      'onKeyframeDelete',
      'onKeyframeMove',
      'onSelectionChange',
      'onTweenAdd',
      'onTweenRemove',
      'onTweenUpdate',
      'onPlaybackStart',
      'onPlaybackPause',
      'onFrameEnter',
      'onTimeSeek'
    ];

    // Also listen to legacy events for backward compatibility
    const legacyEvents = [
      'layer:added',
      'folder:added',
      'layer:deleted',
      'layer:renamed',
      'layer:reordered',
      'layer:reparented',
      'layer:visibilityChanged',
      'layer:lockChanged',
      'layer:selected',
      'keyframe:added',
      'keyframe:deleted',
      'frames:deleted',
      'keyframe:moved',
      'selection:changed',
      'tween:added',
      'tween:removed',
      'tween:updated',
      'playback:started',
      'playback:paused',
      'frame:entered',
      'time:seek'
    ];

    const allEvents = [...events, ...legacyEvents];

    for (const eventName of allEvents) {
      const callback = (payload: any) => this.logEvent(eventName, payload);
      this.eventCallbacks.set(eventName, callback);
      eventManager.on(eventName, callback);
    }
  }

  /**
   * Detach all event listeners
   */
  private detachListeners(): void {
    const eventManager = this.context.Core.eventManager;
    if (!eventManager) return;

    for (const [eventName, callback] of this.eventCallbacks.entries()) {
      eventManager.off(eventName, callback);
    }

    this.eventCallbacks.clear();
  }

  /**
   * Log an event to console and internal log
   */
  private logEvent(eventName: string, payload: any): void {
    const timestamp = new Date();
    const timeStr = timestamp.toLocaleTimeString() + '.' + timestamp.getMilliseconds();

    // Add to internal log
    this.eventLog.push({ timestamp, eventName, payload });
    
    // Trim log if too large
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.shift();
    }

    // Format payload for console
    const payloadStr = this.formatPayload(payload);

    // Log to console with styling
    console.groupCollapsed(
      `%c[${timeStr}] %c${eventName}`,
      'color: gray',
      'color: blue; font-weight: bold'
    );
    console.log('Payload:', payload);
    if (payloadStr) {
      console.log(payloadStr);
    }
    console.groupEnd();
  }

  /**
   * Format payload for readable display
   */
  private formatPayload(payload: any): string {
    if (!payload) return '';

    const lines: string[] = [];

    if (typeof payload === 'object') {
      for (const [key, value] of Object.entries(payload)) {
        if (typeof value === 'object') {
          lines.push(`  ${key}: ${JSON.stringify(value, null, 2)}`);
        } else {
          lines.push(`  ${key}: ${value}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Get a summary of logged events
   */
  public getSummary(): { [eventName: string]: number } {
    const summary: { [eventName: string]: number } = {};

    for (const entry of this.eventLog) {
      if (!summary[entry.eventName]) {
        summary[entry.eventName] = 0;
      }
      summary[entry.eventName]++;
    }

    return summary;
  }

  /**
   * Print event summary to console
   */
  public printSummary(): void {
    const summary = this.getSummary();
    console.log('%c[EventLogger] Event Summary:', 'color: purple; font-weight: bold');
    console.table(summary);
  }

  /**
   * Filter log by event name
   */
  public filterLog(eventName: string): Array<{ timestamp: Date; eventName: string; payload: any }> {
    return this.eventLog.filter(entry => entry.eventName === eventName);
  }
}

/**
 * Helper function to attach event logger to a timeline context
 * @param context Timeline context
 * @returns EventLogger instance
 */
export function attachEventLogger(context: IJsTimeLineContext): EventLogger {
  const logger = new EventLogger(context);
  
  // Store in context for easy access (use 'any' to bypass plugin interface requirement)
  if (!context.Plugins) {
    (context as any).Plugins = {};
  }
  (context.Plugins as any).eventLogger = logger;

  return logger;
}
