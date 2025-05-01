import { EventManager } from './eventManager';
import { LayerData } from './layerPanel';

export interface TimelineState {
  layers: LayerData[];
  keyframes: { [layerIdx: number]: Set<number> };
  playhead: { layerIdx: number; frame: number };
  fps: number;
}

export class StateManager {
  private state: TimelineState;
  private eventManager: EventManager;

  constructor(initialState: TimelineState, eventManager: EventManager) {
    this.state = initialState;
    this.eventManager = eventManager;
  }

  getState(): TimelineState {
    return JSON.parse(JSON.stringify(this.state));
  }

  setState(newState: Partial<TimelineState>) {
    this.state = { ...this.state, ...newState };
    this.eventManager.emit('stateChange', this.getState());
  }    
  updatePlayhead(playhead: { layerIdx: number; frame: number }) {
    this.state.playhead = playhead;
    this.eventManager.emit('playheadMove', playhead);
    // We'll emit stateChange after a slight delay to allow direct DOM updates to complete
    setTimeout(() => {
      this.eventManager.emit('stateChange', this.getState());
    }, 10);
  }

  updateFps(fps: number) {
    this.state.fps = fps;
    this.eventManager.emit('fpsChange', fps);
    this.eventManager.emit('stateChange', this.getState());
  }

  updateLayers(layers: LayerData[]) {
    this.state.layers = layers;
    this.eventManager.emit('layerChange', layers);
    this.eventManager.emit('stateChange', this.getState());
  }

  updateKeyframes(keyframes: { [layerIdx: number]: Set<number> }) {
    this.state.keyframes = keyframes;
    this.eventManager.emit('keyframeChange', keyframes);
    this.eventManager.emit('stateChange', this.getState());
  }
}
