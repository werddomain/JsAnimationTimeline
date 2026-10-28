import { TimeLineData } from '../../data/TimelineData';
import { ITimeLineData } from '../../data/ITimeLineData';

describe('TimeLineData', () => {
  let timelineData: TimeLineData;

  beforeEach(() => {
    timelineData = new TimeLineData();
  });

  describe('constructor', () => {
    it('should initialize with default data when no argument is provided', () => {
      const data = timelineData.getData();
      
      expect(data.version).toBe('1.0.0');
      expect(data.settings.totalFrames).toBe(100);
      expect(data.settings.frameRate).toBe(24);
      expect(data.settings.frameWidth).toBe(15);
      expect(data.settings.rowHeight).toBe(30);
      expect(data.settings.movePlayheadOnFrameClick).toBe(true);
      expect(data.layers).toEqual([]);
    });

    it('should initialize with provided data', () => {
      const customData: ITimeLineData = {
        version: '2.0.0',
        settings: {
          totalFrames: 200,
          frameRate: 30,
          frameWidth: 20,
          rowHeight: 40
        },
        layers: []
      };
      
      const customTimelineData = new TimeLineData(customData);
      const data = customTimelineData.getData();
      
      expect(data.version).toBe('2.0.0');
      expect(data.settings.totalFrames).toBe(200);
      expect(data.settings.frameRate).toBe(30);
    });
  });

  describe('load', () => {
    it('should replace data with new data', () => {
      const newData: ITimeLineData = {
        version: '1.0.0',
        settings: {
          totalFrames: 50,
          frameRate: 12,
          frameWidth: 15,
          rowHeight: 30
        },
        layers: [
          {
            id: 'layer-1',
            name: 'Test Layer',
            type: 'layer',
            visible: true,
            locked: false,
            keyframes: [],
            tweens: []
          }
        ]
      };
      
      timelineData.load(newData);
      const data = timelineData.getData();
      
      expect(data.settings.totalFrames).toBe(50);
      expect(data.layers.length).toBe(1);
      expect(data.layers[0].name).toBe('Test Layer');
    });
  });

  describe('getData', () => {
    it('should return a readonly copy of the data', () => {
      const data = timelineData.getData();
      
      expect(data).toBeDefined();
      expect(typeof data).toBe('object');
    });
  });

  describe('toJSON', () => {
    it('should serialize data to JSON string', () => {
      const json = timelineData.toJSON();
      
      expect(typeof json).toBe('string');
      
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.settings.totalFrames).toBe(100);
    });

    it('should produce valid JSON that can be reparsed', () => {
      const customData: ITimeLineData = {
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
            keyframes: [{ frame: 1, isEmpty: false }],
            tweens: []
          }
        ]
      };
      
      timelineData.load(customData);
      const json = timelineData.toJSON();
      
      expect(() => JSON.parse(json)).not.toThrow();
      const parsed = JSON.parse(json);
      expect(parsed.layers[0].keyframes[0].frame).toBe(1);
    });
  });

  describe('fromJSON', () => {
    it('should load valid JSON data', () => {
      const jsonData: ITimeLineData = {
        version: '1.0.0',
        settings: {
          totalFrames: 75,
          frameRate: 30,
          frameWidth: 20,
          rowHeight: 35
        },
        layers: [
          {
            id: 'layer-1',
            name: 'Imported Layer',
            type: 'layer',
            visible: true,
            locked: false,
            keyframes: [],
            tweens: []
          }
        ]
      };
      
      timelineData.fromJSON(JSON.stringify(jsonData));
      const data = timelineData.getData();
      
      expect(data.settings.totalFrames).toBe(75);
      expect(data.settings.frameRate).toBe(30);
      expect(data.layers[0].name).toBe('Imported Layer');
    });

    it('should throw error for invalid JSON syntax', () => {
      expect(() => {
        timelineData.fromJSON('{ invalid json }');
      }).toThrow('Invalid JSON');
    });

    it('should throw error for missing version field', () => {
      const invalidData = {
        settings: { totalFrames: 100, frameRate: 24, frameWidth: 15, rowHeight: 30 },
        layers: []
      };
      
      expect(() => {
        timelineData.fromJSON(JSON.stringify(invalidData));
      }).toThrow('missing version field');
    });

    it('should throw error for missing settings field', () => {
      const invalidData = {
        version: '1.0.0',
        layers: []
      };
      
      expect(() => {
        timelineData.fromJSON(JSON.stringify(invalidData));
      }).toThrow('missing settings field');
    });

    it('should throw error for missing layers field', () => {
      const invalidData = {
        version: '1.0.0',
        settings: { totalFrames: 100, frameRate: 24, frameWidth: 15, rowHeight: 30 }
      };
      
      expect(() => {
        timelineData.fromJSON(JSON.stringify(invalidData));
      }).toThrow('missing layers field');
    });

    it('should throw error for invalid totalFrames', () => {
      const invalidData = {
        version: '1.0.0',
        settings: { totalFrames: -1, frameRate: 24, frameWidth: 15, rowHeight: 30 },
        layers: []
      };
      
      expect(() => {
        timelineData.fromJSON(JSON.stringify(invalidData));
      }).toThrow('totalFrames must be a positive number');
    });

    it('should throw error for invalid frameRate', () => {
      const invalidData = {
        version: '1.0.0',
        settings: { totalFrames: 100, frameRate: 0, frameWidth: 15, rowHeight: 30 },
        layers: []
      };
      
      expect(() => {
        timelineData.fromJSON(JSON.stringify(invalidData));
      }).toThrow('frameRate must be a positive number');
    });

    it('should validate layer structure', () => {
      const invalidData = {
        version: '1.0.0',
        settings: { totalFrames: 100, frameRate: 24, frameWidth: 15, rowHeight: 30 },
        layers: [
          { name: 'Missing ID', type: 'layer' }
        ]
      };
      
      expect(() => {
        timelineData.fromJSON(JSON.stringify(invalidData));
      }).toThrow('layer must have a valid id');
    });

    it('should validate nested layer structure in folders', () => {
      const validData: ITimeLineData = {
        version: '1.0.0',
        settings: { totalFrames: 100, frameRate: 24, frameWidth: 15, rowHeight: 30 },
        layers: [
          {
            id: 'folder-1',
            name: 'Folder',
            type: 'folder',
            visible: true,
            locked: false,
            children: [
              {
                id: 'layer-1',
                name: 'Nested Layer',
                type: 'layer',
                visible: true,
                locked: false,
                keyframes: [],
                tweens: []
              }
            ]
          }
        ]
      };
      
      expect(() => {
        timelineData.fromJSON(JSON.stringify(validData));
      }).not.toThrow();
      
      const data = timelineData.getData();
      expect(data.layers[0].children?.[0].name).toBe('Nested Layer');
    });
  });
});
