// packages/runtime/src/playback/__tests__/fixtures.ts
import type { ITimelineDocument } from '../../model/document';
import type { ILayer } from '../../model/layer';
import type { IPropertyTimeline, TimelinePropertyValue } from '../../model/propertyTimeline';
import type { IPlaybackDocument } from '../types';

export const numberValue = (value: number): TimelinePropertyValue => ({ kind: 'number', value });
export function timeline(initial: number, frame: number, value: number): IPropertyTimeline {
  return { initialValue: numberValue(initial), keys: [{ frame, value: numberValue(value) }] };
}
export function documentWith(properties: Readonly<Record<string, IPropertyTimeline>>, totalFrames = 100): ITimelineDocument {
  return { version: '2.0.0', settings: { fps: 20, totalFrames }, layers: [
    { id: 'object', name: 'Generic object', type: 'layer', target: { ref: 'synth', stage: 'audio' }, spans: [], propertyTimelines: properties }
  ] };
}
export const layerOf = (doc: ITimelineDocument): ILayer => doc.layers[0] as ILayer;
export function parsedFixture(): IPlaybackDocument {
  return {
    version: 1, sampling: 'frames', fps: 20, totalFrames: 2,
    objects: { object: { name: 'Object', target: { ref: 'object' } } },
    frames: {
      '1': { object: { active: true, values: { gain: numberValue(1) } } },
      '2': { object: { active: true, values: { gain: numberValue(2) } } }
    }
  };
}
