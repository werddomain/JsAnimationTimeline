// demo/editor/src/document.ts
import type { ITimelineDocument } from '@kazo-ca/timeline-runtime';

export function htmlDocument(): ITimelineDocument {
  return { version: '2.0.0', settings: { fps: 24, totalFrames: 60 }, layers: [
    { id: 'logo', type: 'layer', name: 'Logo', color: '#d8663f', target: { selector: '#logo' }, spans: [
      { id: 'logo-motion', kind: 'tween', start: 1, end: 60, tracks: { x: [{ frame: 1, value: 0 }, { frame: 60, value: 300 }], opacity: [{ frame: 1, value: 0.3 }, { frame: 60, value: 1 }] } }
    ] },
    { id: 'orb', type: 'layer', name: 'Orbe', color: '#218779', target: { selector: '#orb' }, spans: [
      { id: 'orb-hold', kind: 'static', start: 1, end: 30, tracks: { x: [{ frame: 1, value: 0 }] } },
      { id: 'orb-end', kind: 'static', start: 31, end: 60, tracks: { x: [{ frame: 31, value: 160 }] } }
    ] }
  ] };
}
