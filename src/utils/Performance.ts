/**
 * Performance utilities for optimizing timeline rendering
 */

/**
 * Debounce function - delays execution until after wait period has elapsed since last call
 * @param func Function to debounce
 * @param wait Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | undefined;

  return function (this: any, ...args: Parameters<T>) {
    const context = this;

    clearTimeout(timeout);
    timeout = window.setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

/**
 * Throttle function - limits execution to once per wait period
 * @param func Function to throttle
 * @param wait Wait time in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | undefined;
  let lastRun = 0;

  return function (this: any, ...args: Parameters<T>) {
    const context = this;
    const now = Date.now();

    if (now - lastRun >= wait) {
      func.apply(context, args);
      lastRun = now;
    } else {
      clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        func.apply(context, args);
        lastRun = Date.now();
      }, wait - (now - lastRun));
    }
  };
}

/**
 * RequestAnimationFrame-based smooth animation helper
 * @param callback Function to call on each frame
 * @returns Cancel function
 */
export function rafLoop(callback: (time: number) => void): () => void {
  let rafId: number;
  let running = true;

  function loop(time: number) {
    if (running) {
      callback(time);
      rafId = requestAnimationFrame(loop);
    }
  }

  rafId = requestAnimationFrame(loop);

  return () => {
    running = false;
    cancelAnimationFrame(rafId);
  };
}

/**
 * Calculate visible range for virtual scrolling
 * @param scrollTop Current scroll position
 * @param containerHeight Height of visible container
 * @param itemHeight Height of each item
 * @param totalItems Total number of items
 * @param bufferSize Number of extra items to render above/below
 * @returns Object with startIndex, endIndex, and offset
 */
export function calculateVisibleRange(
  scrollTop: number,
  containerHeight: number,
  itemHeight: number,
  totalItems: number,
  bufferSize: number = 5
): { startIndex: number; endIndex: number; offsetY: number } {
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferSize);
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const endIndex = Math.min(totalItems - 1, startIndex + visibleCount + bufferSize * 2);
  const offsetY = startIndex * itemHeight;

  return { startIndex, endIndex, offsetY };
}

/**
 * Memoization helper for expensive computations
 * @param fn Function to memoize
 * @param keyFn Optional function to generate cache key from arguments
 * @returns Memoized function
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyFn?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>) => {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * Performance measurement utility
 */
export class PerformanceMonitor {
  private measurements: Map<string, number[]> = new Map();

  /**
   * Start measuring a named operation
   * @param name Name of the operation
   */
  public start(name: string): void {
    if (performance && performance.now) {
      if (!this.measurements.has(name)) {
        this.measurements.set(name, []);
      }
      this.measurements.get(name)!.push(performance.now());
    }
  }

  /**
   * End measuring and log the duration
   * @param name Name of the operation
   * @param logToConsole Whether to log to console
   */
  public end(name: string, logToConsole: boolean = false): number | null {
    if (performance && performance.now) {
      const times = this.measurements.get(name);
      if (times && times.length > 0) {
        const startTime = times.pop()!;
        const duration = performance.now() - startTime;
        
        if (logToConsole) {
          console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
        }
        
        return duration;
      }
    }
    return null;
  }

  /**
   * Measure a function execution
   * @param name Name of the operation
   * @param fn Function to measure
   * @returns Result of the function
   */
  public measure<T>(name: string, fn: () => T): T {
    this.start(name);
    const result = fn();
    this.end(name, true);
    return result;
  }

  /**
   * Clear all measurements
   */
  public clear(): void {
    this.measurements.clear();
  }
}
