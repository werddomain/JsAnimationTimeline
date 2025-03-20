/**
 * Typed Event System for Timeline Control
 */
export interface TimelineEventMap {
}
export type TimelineEventListener<T extends keyof TimelineEventMap> = TimelineEventMap[T];
