// demo/runtime/src/animation.ts
/**
 * Animation de la démo, écrite à la main au format JSON v2 : 48 images à
 * 24 i/s (2 secondes).
 * - « Logo » : translation linéaire de 0 à 300 px sur toute la durée ;
 * - « Rotation du logo » : rotation accélérée (ease-in-out) avec une image
 *   clé de propriété au milieu ;
 * - « Balle » (dans le dossier « Décor ») : fondu d'entrée, masquée des
 *   images 25 à 32 (plage vide), puis réapparition plus bas.
 */

import type { ITimelineDocument } from '@kazo-ca/timeline-runtime';

export const DEMO_ANIMATION: ITimelineDocument = {
  version: '2.0.0',
  settings: { fps: 24, totalFrames: 48 },
  layers: [
    {
      id: 'logo',
      type: 'layer',
      name: 'Logo',
      color: '#4a90d9',
      target: { selector: '#logo' },
      spans: [
        {
          id: 'logo-tween',
          start: 1,
          end: 48,
          kind: 'tween',
          tracks: {
            x: [{ frame: 1, value: 0 }, { frame: 48, value: 300 }]
          }
        }
      ]
    },
    {
      id: 'logo-spin',
      type: 'layer',
      name: 'Rotation du logo',
      target: { selector: '#logo-mark' },
      spans: [
        {
          id: 'spin-tween',
          start: 1,
          end: 48,
          kind: 'tween',
          easing: 'ease-in-out',
          tracks: {
            rotation: [{ frame: 1, value: 0 }, { frame: 24, value: 180 }, { frame: 48, value: 360 }]
          }
        }
      ]
    },
    {
      id: 'decor',
      type: 'folder',
      name: 'Décor',
      children: [
        {
          id: 'ball',
          type: 'layer',
          name: 'Balle',
          color: '#e67e22',
          target: { selector: '#ball' },
          spans: [
            {
              id: 'ball-in',
              start: 1,
              end: 24,
              kind: 'tween',
              easing: 'ease-out',
              tracks: {
                opacity: [{ frame: 1, value: 0 }, { frame: 24, value: 1 }],
                y: [{ frame: 1, value: -40 }, { frame: 24, value: 0 }]
              }
            },
            { id: 'ball-hidden', start: 25, end: 32, kind: 'blank' },
            {
              id: 'ball-back',
              start: 33,
              end: 48,
              kind: 'static',
              tracks: { y: [{ frame: 33, value: 40 }] }
            }
          ]
        }
      ]
    }
  ]
};
