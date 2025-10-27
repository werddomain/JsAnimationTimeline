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
   * Serialize timeline data to JSON string
   * @returns JSON string representation of timeline data
   */
  public toJSON(): string {
    return JSON.stringify(this._data, null, 2);
  }

  /**
   * Load timeline data from JSON string
   * @param json JSON string to parse
   * @throws Error if JSON is invalid or version incompatible
   */
  public fromJSON(json: string): void {
    try {
      const data = JSON.parse(json) as ITimeLineData;
      
      // Validate required fields
      if (!data.version) {
        throw new Error('Invalid timeline data: missing version field');
      }
      
      if (!data.settings) {
        throw new Error('Invalid timeline data: missing settings field');
      }
      
      if (!data.layers) {
        throw new Error('Invalid timeline data: missing layers field');
      }
      
      // Check version compatibility (major version must match)
      const currentMajor = this._data.version.split('.')[0];
      const loadedMajor = data.version.split('.')[0];
      
      if (currentMajor !== loadedMajor) {
        console.warn(`Version mismatch: current ${this._data.version}, loaded ${data.version}. Migration may be needed.`);
      }
      
      // Validate settings
      if (typeof data.settings.totalFrames !== 'number' || data.settings.totalFrames < 1) {
        throw new Error('Invalid timeline data: totalFrames must be a positive number');
      }
      
      if (typeof data.settings.frameRate !== 'number' || data.settings.frameRate < 1) {
        throw new Error('Invalid timeline data: frameRate must be a positive number');
      }
      
      if (typeof data.settings.frameWidth !== 'number' || data.settings.frameWidth < 1) {
        throw new Error('Invalid timeline data: frameWidth must be a positive number');
      }
      
      if (typeof data.settings.rowHeight !== 'number' || data.settings.rowHeight < 1) {
        throw new Error('Invalid timeline data: rowHeight must be a positive number');
      }
      
      // Validate layers structure
      this.validateLayersStructure(data.layers);
      
      // Load validated data
      this._data = data;
      
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Validate layers structure recursively
   * @param layers Array of layers to validate
   * @throws Error if structure is invalid
   */
  private validateLayersStructure(layers: readonly ILayer[]): void {
    if (!Array.isArray(layers)) {
      throw new Error('Invalid timeline data: layers must be an array');
    }
    
    for (const layer of layers) {
      if (!layer.id || typeof layer.id !== 'string') {
        throw new Error('Invalid timeline data: layer must have a valid id');
      }
      
      if (!layer.name || typeof layer.name !== 'string') {
        throw new Error('Invalid timeline data: layer must have a valid name');
      }
      
      if (typeof layer.type !== 'string' || !['layer', 'folder'].includes(layer.type)) {
        throw new Error('Invalid timeline data: layer type must be "layer" or "folder"');
      }
      
      if (layer.type === 'layer') {
        if (layer.keyframes && !Array.isArray(layer.keyframes)) {
          throw new Error('Invalid timeline data: keyframes must be an array');
        }
        
        if (layer.tweens && !Array.isArray(layer.tweens)) {
          throw new Error('Invalid timeline data: tweens must be an array');
        }
      }
      
      // Recursively validate children if folder
      if (layer.children && Array.isArray(layer.children)) {
        this.validateLayersStructure(layer.children);
      }
    }
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
