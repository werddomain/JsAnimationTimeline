import { IJsTimeLineContext } from '../IJsTimeLineContext';

export class TimeRuler {
  private context: IJsTimeLineContext;

  constructor(context: IJsTimeLineContext) {
    this.context = context;
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
    }
  }
}
