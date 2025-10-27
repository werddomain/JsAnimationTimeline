// Timeline data interfaces based on spec Section 7.1

export interface ITimeLineSettings {
  totalFrames: number;
  frameRate: number;
  frameWidth?: number;  // Width of each frame in pixels (optional, default 15)
  rowHeight?: number;   // Height of each layer row in pixels (optional, default 30)
  layerPanelWidth?: number;  // Width of layer panel in pixels (optional, default 250)
  rulerHeight?: number;      // Height of time ruler in pixels (optional, default 40)
}

export interface IKeyframe {
  frame: number;        // Frame number where the keyframe is located
  isEmpty?: boolean;    // True for hollow circle keyframes, false/undefined for solid
}

export interface ITween {
  startFrame: number;   // Starting frame of the tween
  endFrame: number;     // Ending frame of the tween
  type?: string;        // Tween type (e.g., 'linear', 'ease', etc.)
}

export interface ILayer {
  id: string;           // Unique identifier for the layer
  name: string;         // Display name of the layer
  type: 'layer' | 'folder';  // Layer type
  visible?: boolean;    // Layer visibility (default true)
  locked?: boolean;     // Layer locked state (default false)
  keyframes?: IKeyframe[];   // Array of keyframes (only for 'layer' type)
  tweens?: ITween[];         // Array of tweens (only for 'layer' type)
  children?: ILayer[];       // Child layers (only for 'folder' type) - recursive structure
}

export interface ITimeLineData {
  version: string;      // Data format version
  settings: ITimeLineSettings;
  layers: ILayer[];     // Root layers array (can contain folders with nested children)
}
