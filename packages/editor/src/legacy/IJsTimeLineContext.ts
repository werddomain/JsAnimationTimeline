import { TimeLineData } from './data/TimelineData';
import { EventManager } from './core/EventManager';
import { StateManager } from './core/StateManager';
import { PlaybackEngine } from './core/PlaybackEngine';
import { LayerManager } from './core/LayerManager';
import { SelectionManager } from './core/SelectionManager';
import { KeyframeManager } from './core/KeyframeManager';
import { TweenManager } from './core/TweenManager';
import { IPlugin } from './plugins/IPlugin';

export interface IJsTimeLineContext {
  // UI References
  UI: {
    root: HTMLElement;
    layoutGrid: HTMLElement;
    corner: HTMLElement;
    rulerContainer: HTMLElement;
    rulerContent: HTMLElement;
    playhead: HTMLElement;
    layerPanelContainer: HTMLElement;
    layerPanelContent: HTMLElement;
    gridContainer: HTMLElement;
    gridContent: HTMLElement;
    layerPanel?: any;  // Will be LayerPanel instance
    timeRuler?: any;   // Will be TimeRuler instance
    timelineGrid?: any; // Will be TimelineGrid instance
    contextMenu?: any; // Will be ContextMenu instance
    tweenPropertiesDialog?: any; // Will be TweenPropertiesDialog instance
  };

  // Core Services
  Core: {
    eventManager: EventManager;
    stateManager: StateManager;
    playbackEngine?: PlaybackEngine;
    layerManager?: LayerManager;
    selectionManager?: SelectionManager;
    keyframeManager?: KeyframeManager;
    tweenManager?: TweenManager;
  };

  // Data Management
  Data: TimeLineData;

  // Plugins
  Plugins: { [key: string]: IPlugin };
}
