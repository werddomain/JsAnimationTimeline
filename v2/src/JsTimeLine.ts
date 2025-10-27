// Import the styles directly
import './styles/JsTimeLine.less';
import { IJsTimeLineContext } from './IJsTimeLineContext';
import { TimeLineData } from './data/TimeLineData';
import { EventManager } from './core/EventManager';
import { StateManager } from './core/StateManager';
import { LayerPanel } from './ui/LayerPanel';
import { TimeRuler } from './ui/TimeRuler';
import { TimelineGrid } from './ui/TimelineGrid';
import { ITimeLineData } from './data/ITimeLineData';

export class JsTimeLine {
  private container: HTMLElement;
  private _context!: IJsTimeLineContext;

  constructor(elementId: string) {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with id '${elementId}' not found.`);
    }
    this.container = element;
    this.container.classList.add('JsTimeLine');
    
    // Build the three-part DOM structure
    this.buildLayout();

    // Initialize the context
    this.initializeContext();

    // Load test data and render
    this.loadTestData();

    console.log('JsTimeLine control instantiated.');
  }

  private buildLayout(): void {
    // Clear existing content
    this.container.innerHTML = '';

    // Create main layout grid
    const layoutGrid = document.createElement('div');
    layoutGrid.className = 'timeline-layout-grid';

    // Top-left empty corner
    const corner = document.createElement('div');
    corner.className = 'timeline-corner';

    // Top: Time Ruler (fixed height, scrolls horizontally)
    const rulerContainer = document.createElement('div');
    rulerContainer.className = 'timeline-ruler';
    
    const rulerContent = document.createElement('div');
    rulerContent.className = 'timeline-ruler-content';
    
    const playhead = document.createElement('div');
    playhead.className = 'timeline-playhead';
    
    rulerContainer.appendChild(rulerContent);
    rulerContainer.appendChild(playhead);

    // Left: Layer Panel (fixed width, scrolls vertically)
    const layerPanelContainer = document.createElement('div');
    layerPanelContainer.className = 'timeline-layer-panel';
    
    const layerPanelContent = document.createElement('div');
    layerPanelContent.className = 'timeline-layer-content';
    
    layerPanelContainer.appendChild(layerPanelContent);

    // Main: Timeline Grid (scrolls in both directions)
    const gridContainer = document.createElement('div');
    gridContainer.className = 'timeline-grid-container';
    
    const gridContent = document.createElement('div');
    gridContent.className = 'timeline-grid-content';
    
    gridContainer.appendChild(gridContent);

    // Assemble the layout
    layoutGrid.appendChild(corner);
    layoutGrid.appendChild(rulerContainer);
    layoutGrid.appendChild(layerPanelContainer);
    layoutGrid.appendChild(gridContainer);

    this.container.appendChild(layoutGrid);

    // Initialize temporary context for UI references
    this._context = {
      UI: {
        root: this.container,
        layoutGrid,
        corner,
        rulerContainer,
        rulerContent,
        playhead,
        layerPanelContainer,
        layerPanelContent,
        gridContainer,
        gridContent
      },
      Core: {
        eventManager: null as any,
        stateManager: null as any
      },
      Data: null as any,
      Plugins: {}
    };
  }

  private initializeContext(): void {
    // Instantiate core services
    const eventManager = new EventManager();
    const stateManager = new StateManager();
    const timeLineData = new TimeLineData();

    // Update context with core services
    this._context.Core.eventManager = eventManager;
    this._context.Core.stateManager = stateManager;
    this._context.Data = timeLineData;

    // Instantiate UI components
    const layerPanel = new LayerPanel(this._context);
    this._context.UI.layerPanel = layerPanel;

    const timeRuler = new TimeRuler(this._context);
    this._context.UI.timeRuler = timeRuler;

    const timelineGrid = new TimelineGrid(this._context);
    this._context.UI.timelineGrid = timelineGrid;

    // Setup scroll synchronization
    this.setupScrollSync();

    console.log('Context initialized');
  }

  /**
   * Setup scroll synchronization between grid, ruler, and layer panel
   */
  private setupScrollSync(): void {
    const gridContainer = this._context.UI.gridContainer;
    const rulerContent = this._context.UI.rulerContent;
    const layerPanelContent = this._context.UI.layerPanelContent;

    gridContainer.addEventListener('scroll', () => {
      // Synchronize horizontal scroll with ruler
      const scrollLeft = gridContainer.scrollLeft;
      rulerContent.style.transform = `translateX(-${scrollLeft}px)`;

      // Synchronize vertical scroll with layer panel
      const scrollTop = gridContainer.scrollTop;
      layerPanelContent.style.transform = `translateY(-${scrollTop}px)`;

      // Emit scroll event for other components that may need to react
      this._context.Core.eventManager.emit('timeline:scroll', {
        scrollLeft,
        scrollTop
      });
    });
  }

  /**
   * Load test data and render the UI
   */
  private loadTestData(): void {
    // Create test data based on spec example
    const testData: ITimeLineData = {
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
          name: 'Background',
          type: 'layer',
          visible: true,
          locked: false,
          keyframes: [
            { frame: 1, isEmpty: false },
            { frame: 20, isEmpty: false },
            { frame: 50, isEmpty: true }
          ],
          tweens: [
            { startFrame: 1, endFrame: 20, type: 'linear' }
          ]
        },
        {
          id: 'folder-1',
          name: 'Character',
          type: 'folder',
          visible: true,
          locked: false,
          children: [
            {
              id: 'layer-2',
              name: 'Head',
              type: 'layer',
              visible: true,
              locked: false,
              keyframes: [
                { frame: 1, isEmpty: false },
                { frame: 15, isEmpty: false }
              ],
              tweens: [
                { startFrame: 1, endFrame: 15, type: 'ease' }
              ]
            },
            {
              id: 'layer-3',
              name: 'Body',
              type: 'layer',
              visible: true,
              locked: false,
              keyframes: [
                { frame: 1, isEmpty: false },
                { frame: 30, isEmpty: false }
              ],
              tweens: []
            }
          ]
        },
        {
          id: 'layer-4',
          name: 'Foreground',
          type: 'layer',
          visible: false,
          locked: true,
          keyframes: [
            { frame: 10, isEmpty: false }
          ],
          tweens: []
        }
      ]
    };

    // Load the test data
    this._context.Data.load(testData);

    // Render the layer panel
    if (this._context.UI.layerPanel) {
      this._context.UI.layerPanel.render();
    }

    // Render the time ruler
    if (this._context.UI.timeRuler) {
      this._context.UI.timeRuler.render();
      // Set initial playhead position at frame 1
      this._context.UI.timeRuler.setPlayheadPosition(1);
    }

    // Render the timeline grid
    if (this._context.UI.timelineGrid) {
      this._context.UI.timelineGrid.render();
    }
  }

  /**
   * Get the context (for plugin access)
   */
  public getContext(): IJsTimeLineContext {
    return this._context;
  }
}
