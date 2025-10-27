import { ITimeLineData, ITimeLineSettings, ILayer } from './ITimeLineData';

export class TimeLineData {
  private _data: ITimeLineData;

  constructor(defaultData?: ITimeLineData) {
    // Initialize with default empty data or provided data
    this._data = defaultData || this.getDefaultData();
  }

  /**
   * Load new timeline data
   * @param data The timeline data to load
   */
  public load(data: ITimeLineData): void {
    this._data = data;
  }

  /**
   * Get the current timeline data (read-only)
   * @returns A readonly copy of the timeline data
   */
  public getData(): Readonly<ITimeLineData> {
    return this._data;
  }

  /**
   * Get default empty timeline data
   * @returns Default timeline data structure
   */
  private getDefaultData(): ITimeLineData {
    return {
      version: '1.0.0',
      settings: {
        totalFrames: 100,
        frameRate: 24,
        frameWidth: 15,
        rowHeight: 30
      },
      layers: []
    };
  }
}
