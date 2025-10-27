import { IJsTimeLineContext } from '../IJsTimeLineContext';

export class TimeRuler {
  private context: IJsTimeLineContext;
  private isDragging: boolean = false;

  constructor(context: IJsTimeLineContext) {
    this.context = context;
    this.setupPlayheadDragging();
  }

  /**
   * Render the time ruler with ticks and labels
   */
  public render(): void {
    const data = this.context.Data.getData();
    const container = this.context.UI.rulerContent;
    const settings = data.settings;

    // Clear existing content
    container.innerHTML = '';

    const totalFrames = settings.totalFrames;
    const frameWidth = settings.frameWidth || 15;
    const labelInterval = this.calculateLabelInterval(frameWidth);

    // Set the width of the ruler content to accommodate all frames
    container.style.width = `${totalFrames * frameWidth}px`;

    // Create ruler ticks and labels
    for (let frame = 1; frame <= totalFrames; frame++) {
      const tick = this.createTick(frame, frameWidth, labelInterval);
      container.appendChild(tick);
    }
  }

  /**
   * Calculate the interval for showing frame labels based on frame width
   * @param frameWidth Width of each frame in pixels
   * @returns Interval for showing labels
   */
  private calculateLabelInterval(frameWidth: number): number {
    // Show labels less frequently if frames are narrow
    if (frameWidth < 10) {
      return 10;
    } else if (frameWidth < 15) {
      return 5;
    } else {
      return 5; // Default: show every 5th frame
    }
  }

  /**
   * Create a tick element for a frame
   * @param frame Frame number
   * @param frameWidth Width of each frame
   * @param labelInterval Interval for showing labels
   * @returns The tick element
   */
  private createTick(frame: number, frameWidth: number, labelInterval: number): HTMLElement {
    const tick = document.createElement('div');
    tick.className = 'ruler-tick';
    tick.style.left = `${(frame - 1) * frameWidth}px`;
    tick.style.width = `${frameWidth}px`;

    // Add label at intervals and at frame 1
    const showLabel = frame === 1 || frame % labelInterval === 0;
    
    if (showLabel) {
      tick.classList.add('ruler-tick-labeled');
      const label = document.createElement('span');
      label.className = 'ruler-label';
      label.textContent = frame.toString();
      tick.appendChild(label);
    }

    // Make every 5th tick slightly taller
    if (frame % 5 === 0) {
      tick.classList.add('ruler-tick-major');
    }

    return tick;
  }

  /**
   * Update the playhead position
   * @param frame Frame number to position the playhead at
   */
  public setPlayheadPosition(frame: number): void {
    const settings = this.context.Data.getData().settings;
    const frameWidth = settings.frameWidth || 15;
    const playhead = this.context.UI.playhead;

    if (playhead) {
      playhead.style.left = `${(frame - 1) * frameWidth}px`;
      // Emit event for other components to react
      this.context.Core.eventManager.emit('playhead:moved', { frame });
    }
  }

  /**
   * Setup playhead dragging functionality
   */
  private setupPlayheadDragging(): void {
    const playhead = this.context.UI.playhead;
    const gridContainer = this.context.UI.gridContainer;

    if (!playhead || !gridContainer) return;

    playhead.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      this.isDragging = true;
      document.body.style.cursor = 'ew-resize';
    });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isDragging) return;

      const rect = gridContainer.getBoundingClientRect();
      const scrollLeft = gridContainer.scrollLeft;
      const mouseX = e.clientX - rect.left + scrollLeft;
      
      const settings = this.context.Data.getData().settings;
      const frameWidth = settings.frameWidth || 15;
      const totalFrames = settings.totalFrames;
      
      // Calculate which frame the mouse is over
      const frame = Math.max(1, Math.min(totalFrames, Math.round(mouseX / frameWidth) + 1));
      
      this.setPlayheadPosition(frame);
    });

    document.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        document.body.style.cursor = '';
      }
    });

    // Also allow clicking on the ruler to jump to a frame
    const rulerContainer = this.context.UI.rulerContainer;
    rulerContainer.addEventListener('click', (e: MouseEvent) => {
      if (this.isDragging) return; // Ignore if currently dragging

      const rect = gridContainer.getBoundingClientRect();
      const scrollLeft = gridContainer.scrollLeft;
      const mouseX = e.clientX - rect.left + scrollLeft;
      
      const settings = this.context.Data.getData().settings;
      const frameWidth = settings.frameWidth || 15;
      const totalFrames = settings.totalFrames;
      
      const frame = Math.max(1, Math.min(totalFrames, Math.round(mouseX / frameWidth) + 1));
      
      this.setPlayheadPosition(frame);
    });
  }
}
