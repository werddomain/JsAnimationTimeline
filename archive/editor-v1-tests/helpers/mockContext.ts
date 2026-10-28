import { IJsTimeLineContext } from '../../IJsTimeLineContext';
import { TimeLineData } from '../../data/TimelineData';
import { EventManager } from '../../core/EventManager';
import { StateManager } from '../../core/StateManager';
import { ITimeLineData } from '../../data/ITimeLineData';

/**
 * Creates a mock context for testing core managers
 */
export function createMockContext(): IJsTimeLineContext {
  const eventManager = new EventManager();
  const stateManager = new StateManager();
  const timelineData = new TimeLineData();

  return {
    UI: {
      root: document.createElement('div'),
      layoutGrid: document.createElement('div'),
      corner: document.createElement('div'),
      rulerContainer: document.createElement('div'),
      rulerContent: document.createElement('div'),
      playhead: document.createElement('div'),
      layerPanelContainer: document.createElement('div'),
      layerPanelContent: document.createElement('div'),
      gridContainer: document.createElement('div'),
      gridContent: document.createElement('div'),
      layerPanel: {
        render: jest.fn()
      },
      timeRuler: {
        render: jest.fn(),
        setPlayheadPosition: jest.fn()
      },
      timelineGrid: {
        render: jest.fn()
      },
      contextMenu: null,
      tweenPropertiesDialog: null
    },
    Core: {
      eventManager,
      stateManager
    },
    Data: timelineData,
    Plugins: {}
  };
}

/**
 * Creates test data for timeline testing
 */
export function createTestData(): ITimeLineData {
  return {
    version: '1.0.0',
    settings: {
      totalFrames: 100,
      frameRate: 24,
      frameWidth: 15,
      rowHeight: 30
    },
    layers: [
      {
        id: 'layer-1',
        name: 'Layer 1',
        type: 'layer',
        visible: true,
        locked: false,
        keyframes: [
          { frame: 1, isEmpty: false },
          { frame: 10, isEmpty: false },
          { frame: 20, isEmpty: true }
        ],
        tweens: [
          { startFrame: 1, endFrame: 10, type: 'linear' }
        ]
      },
      {
        id: 'folder-1',
        name: 'Folder 1',
        type: 'folder',
        visible: true,
        locked: false,
        children: [
          {
            id: 'layer-2',
            name: 'Layer 2',
            type: 'layer',
            visible: true,
            locked: false,
            keyframes: [
              { frame: 5, isEmpty: false }
            ],
            tweens: []
          }
        ]
      },
      {
        id: 'layer-3',
        name: 'Layer 3',
        type: 'layer',
        visible: false,
        locked: true,
        keyframes: [],
        tweens: []
      }
    ]
  };
}
