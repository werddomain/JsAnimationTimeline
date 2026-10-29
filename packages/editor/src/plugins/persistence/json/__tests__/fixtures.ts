// packages/editor/src/plugins/persistence/json/__tests__/fixtures.ts
/**
 * Documents de test du plugin `persistence.json` : un document v2 avec les
 * deux formes de cible sérialisables (`{ selector }`, `{ ref, stage }`) et un
 * calque sans cible, et un document v1 minimal à migrer.
 */

import type { ITimelineDocument } from '@kazo-ca/timeline-runtime';

/** Document v2 valide : cibles sélecteur, référence avec scène, référence sans scène. */
export function makeV2Document(): ITimelineDocument {
  return {
    version: '2.0.0',
    settings: { fps: 24, totalFrames: 48 },
    layers: [
      {
        id: 'l-box',
        type: 'layer',
        name: 'Boîte',
        target: { selector: '#box' },
        spans: [
          {
            id: 's-box',
            start: 1,
            end: 48,
            kind: 'tween',
            tracks: { x: [{ frame: 1, value: 0 }, { frame: 48, value: 320 }] }
          }
        ]
      },
      {
        id: 'l-hero',
        type: 'layer',
        name: 'Héros',
        target: { ref: 'hero', stage: 'canvas' },
        spans: [{ id: 's-hero', start: 1, end: 48, kind: 'static', tracks: { frameIndex: [{ frame: 1, value: 3 }] } }]
      },
      { id: 'l-sound', type: 'layer', name: 'Son', target: { ref: 'music' }, spans: [] },
      { id: 'l-empty', type: 'layer', name: 'Vide', spans: [] }
    ]
  };
}

/** Document v1 minimal : un calque, deux images clés pleines et une interpolation. */
export function makeV1Document(): Record<string, unknown> {
  return {
    version: '1.0.0',
    settings: { totalFrames: 20, frameRate: 24, frameWidth: 15 },
    layers: [
      {
        id: 'v1-layer',
        name: 'Calque v1',
        type: 'layer',
        keyframes: [{ frame: 1 }, { frame: 10 }],
        tweens: [{ startFrame: 1, endFrame: 10, type: 'linear' }]
      }
    ]
  };
}
