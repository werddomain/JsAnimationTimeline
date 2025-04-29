import '../styles/main.less';
import { EventManager } from './eventManager';
import { StateManager, TimelineState } from './stateManager';
import { LayerPanel, LayerData } from './layerPanel';
import { TimelineGrid3D } from './timelineGrid';

export class Timeline {
  private container: HTMLElement;
  private eventManager: EventManager;
  private stateManager: StateManager;
  private layerPanel: LayerPanel | null = null;
  private timelineGrid: TimelineGrid3D | null = null;

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error('Timeline container not found');
    this.container = el;

    // Initial state
    const initialLayers: LayerData[] = [
      { name: 'sounds', color: '#000', visible: true, locked: false },
      { name: 'Weather', color: '#3c3', visible: true, locked: false },
      { name: 'Sun', color: '#c3c', visible: true, locked: false },
      { name: 'Chevik', color: '#fc0', visible: true, locked: false },
    ];
    const initialState: TimelineState = {
      layers: initialLayers,
      keyframes: {},
      playhead: { layerIdx: 0, frame: 1 },
      fps: 12.0,
    };
    this.eventManager = new EventManager();
    this.stateManager = new StateManager(initialState, this.eventManager);
    this.render();
    this.initComponents();
  }

  render() {
    this.container.innerHTML = `
      <div class="timeline__layer-panel"></div>
      <div class="timeline__grid"></div>
    `;
  }

  initComponents() {
    const layerPanelEl = this.container.querySelector('.timeline__layer-panel') as HTMLElement;
    const gridEl = this.container.querySelector('.timeline__grid') as HTMLElement;
    if (layerPanelEl) {
      this.layerPanel = new LayerPanel(layerPanelEl, this.stateManager, this.eventManager);
    }
    if (gridEl) {
      this.timelineGrid = new TimelineGrid3D(gridEl, this.stateManager, this.eventManager);
    }
  }

  // --- Public API ---
  public addLayer(name: string, color: string) {
    const layers = this.stateManager.getState().layers.slice();
    layers.unshift({ name, color, visible: true, locked: false });
    this.stateManager.updateLayers(layers);
  }

  public removeLayer(idx: number) {
    const layers = this.stateManager.getState().layers.slice();
    layers.splice(idx, 1);
    this.stateManager.updateLayers(layers);
  }

  public renameLayer(idx: number, name: string) {
    const layers = this.stateManager.getState().layers.slice();
    layers[idx].name = name;
    this.stateManager.updateLayers(layers);
  }

  public reorderLayer(fromIdx: number, toIdx: number) {
    const layers = this.stateManager.getState().layers.slice();
    const [moved] = layers.splice(fromIdx, 1);
    layers.splice(toIdx, 0, moved);
    this.stateManager.updateLayers(layers);
  }

  public setLayerVisibility(idx: number, visible: boolean) {
    const layers = this.stateManager.getState().layers.slice();
    layers[idx].visible = visible;
    this.stateManager.updateLayers(layers);
  }

  public setLayerLock(idx: number, locked: boolean) {
    const layers = this.stateManager.getState().layers.slice();
    layers[idx].locked = locked;
    this.stateManager.updateLayers(layers);
  }

  public addKeyframe(layerIdx: number, frame: number) {
    const state = this.stateManager.getState();
    const keyframes = { ...state.keyframes };
    if (!keyframes[layerIdx]) keyframes[layerIdx] = new Set();
    keyframes[layerIdx].add(frame);
    this.stateManager.updateKeyframes(keyframes);
  }

  public removeKeyframe(layerIdx: number, frame: number) {
    const state = this.stateManager.getState();
    const keyframes = { ...state.keyframes };
    if (keyframes[layerIdx]) keyframes[layerIdx].delete(frame);
    this.stateManager.updateKeyframes(keyframes);
  }

  public setPlayhead(layerIdx: number, frame: number) {
    this.stateManager.updatePlayhead({ layerIdx, frame });
  }

  public setFps(fps: number) {
    this.stateManager.updateFps(fps);
  }

  public importTimeline(data: any) {
    // expects { layers, keyframes, playhead, fps }
    this.stateManager.setState(data);
  }

  public exportTimeline() {
    return this.stateManager.getState();
  }
}

// Example usage (to be called from app.ts or main entry):
// new Timeline('timeline-container');
