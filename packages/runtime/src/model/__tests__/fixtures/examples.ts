// packages/runtime/src/model/__tests__/fixtures/examples.ts
/**
 * Typed copies of `schema/examples/*.json`. The type annotations prove that
 * the JSON documents are assignable to ITimelineDocument; a test checks that
 * each copy deep-equals its JSON file.
 */

import type { ITimelineDocument } from '../../document';
import type { ExampleName } from './schema';

const minimal: ITimelineDocument = {
  version: '2.0.0',
  settings: { fps: 24, totalFrames: 24 },
  layers: [
    {
      id: 'layer-1',
      type: 'layer',
      name: 'Layer 1',
      spans: [{ id: 'span-1', start: 1, end: 24, kind: 'static' }]
    }
  ]
};

const tweenAndStatic: ITimelineDocument = {
  version: '2.0.0',
  settings: { fps: 24, totalFrames: 120 },
  layers: [
    {
      id: 'l1',
      type: 'layer',
      name: 'Logo',
      color: '#4a90d9',
      icon: 'element',
      visible: true,
      locked: false,
      target: { selector: '#logo' },
      spans: [
        {
          id: 's1',
          start: 1,
          end: 48,
          kind: 'tween',
          easing: 'ease-in-out',
          tracks: {
            x: [{ frame: 1, value: 0 }, { frame: 48, value: 300 }],
            opacity: [{ frame: 1, value: 0 }, { frame: 12, value: 1 }]
          }
        },
        { id: 's2', start: 49, end: 120, kind: 'static', tracks: { x: [{ frame: 49, value: 300 }] } }
      ]
    },
    {
      id: 'f1',
      type: 'folder',
      name: 'Personnage',
      color: '#e67e22',
      children: [
        {
          id: 'l2',
          type: 'layer',
          name: 'Tête',
          target: { selector: '.character .head' },
          spans: [
            { id: 's3', start: 1, end: 24, kind: 'blank' },
            {
              id: 's4',
              start: 25,
              end: 120,
              kind: 'tween',
              tracks: { rotation: [{ frame: 25, value: 0 }, { frame: 120, value: 360 }] }
            }
          ]
        }
      ]
    }
  ]
};

const folders: ITimelineDocument = {
  version: '2.0.0',
  settings: { fps: 30, totalFrames: 60 },
  layers: [
    {
      id: 'scene',
      type: 'folder',
      name: 'Scene',
      collapsed: false,
      children: [
        {
          id: 'background',
          type: 'folder',
          name: 'Background',
          color: '#2ECC71',
          locked: true,
          collapsed: true,
          children: [
            {
              id: 'sky',
              type: 'layer',
              name: 'Sky',
              icon: 'https://example.com/icons/sky.svg',
              target: { selector: '#sky' },
              spans: [
                { id: 'sky-static', start: 1, end: 60, kind: 'static', tracks: { opacity: [{ frame: 1, value: 0.8 }] } }
              ]
            }
          ]
        },
        {
          id: 'ball',
          type: 'layer',
          name: 'Ball',
          icon: 'icon-ball',
          visible: false,
          target: { selector: '#ball' },
          spans: [
            { id: 'ball-hidden', start: 1, end: 9, kind: 'blank' },
            {
              id: 'ball-bounce',
              start: 10,
              end: 40,
              kind: 'tween',
              easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
              tracks: {
                y: [{ frame: 10, value: 0 }, { frame: 25, value: -120.5 }, { frame: 40, value: 0 }],
                scaleX: [{ frame: 10, value: 1 }, { frame: 40, value: 1.2 }]
              }
            },
            { id: 'ball-rest', start: 41, end: 60, kind: 'static' }
          ]
        }
      ]
    },
    { id: 'empty-folder', type: 'folder', name: 'Empty folder', children: [] },
    { id: 'empty-layer', type: 'layer', name: 'Layer without spans', spans: [] }
  ]
};

export const TYPED_EXAMPLES: Readonly<Record<ExampleName, ITimelineDocument>> = {
  'minimal': minimal,
  'tween-and-static': tweenAndStatic,
  'folders': folders
};
