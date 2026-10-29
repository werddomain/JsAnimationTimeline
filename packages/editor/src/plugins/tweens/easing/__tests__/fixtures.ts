// packages/editor/src/plugins/tweens/easing/__tests__/fixtures.ts
import type { Easing, ITimelineDocument } from '@kazo-ca/timeline-runtime';
export function fixture(easing?: Easing): ITimelineDocument {
  return { version: '2.0.0', settings: { fps: 24, totalFrames: 20 }, layers: [{
    id: 'a', type: 'layer', name: 'Objet', target: { selector: '#object' }, spans: [
      { id: 't', start: 1, end: 11, kind: 'tween', ...(easing === undefined ? {} : { easing }), tracks: {
        x: [{ frame: 1, value: 0 }, { frame: 6, value: 60 }, { frame: 11, value: 100 }],
        opacity: [{ frame: 1, value: 0.2 }, { frame: 11, value: 1 }]
      } },
      { id: 's', start: 12, end: 15, kind: 'static' }, { id: 'b', start: 16, end: 20, kind: 'blank' }
    ]
  }] };
}


