// filepath: c:\Users\BenoitRobin\JsTimeline\v2-vscode\timeline-animation-editor\src\types\index.ts

export interface Keyframe {
    id: string;
    time: number;
    value: any; // The value at this keyframe, could be position, color, etc.
}

export interface Layer {
    id: string;
    name: string;
    keyframes?: Keyframe[];
    isVisible?: boolean;
    isLocked?: boolean;
}

export interface Group {
    id: string;
    name: string;
    layerIds: string[];
    expanded: boolean;
}

export interface TimelineState {
    currentTime: number;
    timeScale: number;
    duration: number;
    layers: Layer[];
    groups: Group[];
}

// Plugin interface
export interface PluginOptions {
    container: HTMLElement;
    elementId?: string;
}

// Common options used by most plugin constructors
export interface CommonPluginOptions extends PluginOptions {
    eventEmitter: any; // Using any here to avoid circular import with EventEmitter
    timeScale?: number;
    pixelsPerSecond?: number;
}
