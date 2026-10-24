// demo/runtime/src/objectStage/document.ts
/**
 * Animation de la démo « scène sans HTML animé », écrite à la main au format
 * JSON v2 : 48 images à 24 i/s (2 secondes).
 * - « Héros » (scène `canvas`) : position, rotation et numéro d'image du sprite ;
 * - « Musique » (scène `audio`) : volume qui monte puis redescend, silence (plage vide) aux images 41 à 48 ;
 * - « Bandeau » (scène HTML par défaut) : fondu d'entrée.
 */

import type { ITimelineDocument } from '@werddomain/timeline-runtime';

export const CANVAS_STAGE_ID = 'canvas';
export const AUDIO_STAGE_ID = 'audio';

export const OBJECT_STAGE_DOCUMENT: ITimelineDocument = {
  version: '2.0.0',
  settings: { fps: 24, totalFrames: 48 },
  layers: [
    {
      id: 'hero',
      type: 'layer',
      name: 'Héros',
      color: '#e67e22',
      target: { ref: 'hero', stage: CANVAS_STAGE_ID },
      spans: [
        {
          id: 'hero-move',
          start: 1,
          end: 48,
          kind: 'tween',
          tracks: {
            x: [{ frame: 1, value: 0 }, { frame: 48, value: 360 }],
            y: [{ frame: 1, value: 0 }, { frame: 24, value: 60 }, { frame: 48, value: 0 }],
            rotation: [{ frame: 1, value: 0 }, { frame: 48, value: 360 }],
            frameIndex: [{ frame: 1, value: 0 }, { frame: 48, value: 11 }]
          }
        }
      ]
    },
    {
      id: 'music',
      type: 'layer',
      name: 'Musique',
      color: '#27ae60',
      target: { ref: 'music', stage: AUDIO_STAGE_ID },
      spans: [
        {
          id: 'music-volume',
          start: 1,
          end: 40,
          kind: 'tween',
          tracks: { volume: [{ frame: 1, value: 0 }, { frame: 16, value: 1 }, { frame: 40, value: 0.2 }] }
        },
        { id: 'music-silence', start: 41, end: 48, kind: 'blank' }
      ]
    },
    {
      id: 'banner',
      type: 'layer',
      name: 'Bandeau',
      color: '#4a90d9',
      target: { selector: '#banner' },
      spans: [
        {
          id: 'banner-in',
          start: 1,
          end: 24,
          kind: 'tween',
          easing: 'ease-out',
          tracks: { opacity: [{ frame: 1, value: 0 }, { frame: 24, value: 1 }], x: [{ frame: 1, value: 0 }, { frame: 24, value: 200 }] }
        },
        { id: 'banner-hold', start: 25, end: 48, kind: 'static', tracks: { opacity: [{ frame: 25, value: 1 }], x: [{ frame: 25, value: 200 }] } }
      ]
    }
  ]
};
