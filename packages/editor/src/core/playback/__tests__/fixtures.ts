// packages/editor/src/core/playback/__tests__/fixtures.ts
/**
 * Fixtures des tests de la lecture : document animé (10 images/s, 20
 * images) avec un calque interpolé, un dossier masqué, une plage vide et une
 * cible `ref` d'une autre scène ; éditeur sur horloge manuelle ; commandes
 * pures qui changent la durée ou la référence du document ; enregistreur des
 * événements de rendu.
 */

import { createManualClock } from '@werddomain/timeline-runtime';
import type { IManualClock, ITimelineDocument } from '@werddomain/timeline-runtime';
import { deepFreeze } from '../../commands/__tests__/fixtures';
import { createCommand } from '../../commands/createCommand';
import type { ICommand } from '../../commands/ICommand';
import { createEditor } from '../../editor/createEditor';
import type { EditorOptions, IEditor } from '../../editor/types';
import { createContainer } from '../../editor/__tests__/fixtures';
import type { IFrameSample } from '../types';

/** Durée d'une image d'affichage simulée (millisecondes). */
export const DISPLAY_FRAME_MS = 16;

/** Document animé de la lecture, figé en profondeur. */
export function createAnimatedDocument(totalFrames = 20): ITimelineDocument {
  return deepFreeze<ITimelineDocument>({
    version: '2.0.0',
    settings: { fps: 10, totalFrames },
    layers: [
      {
        id: 'hero', type: 'layer', name: 'Héros', target: { selector: '#hero' },
        spans: [{
          id: 's-hero', start: 1, end: 11, kind: 'tween', easing: 'linear',
          tracks: { x: [{ frame: 1, value: 0 }, { frame: 11, value: 100 }] }
        }]
      },
      {
        id: 'folder', type: 'folder', name: 'Décor', visible: false,
        children: [
          {
            id: 'tree', type: 'layer', name: 'Arbre', target: { ref: 'tree', stage: 'canvas' },
            spans: [{ id: 's-tree', start: 1, end: 5, kind: 'static', tracks: { opacity: [{ frame: 1, value: 0.5 }] } }]
          }
        ]
      },
      {
        id: 'ghost', type: 'layer', name: 'Fantôme',
        spans: [
          { id: 's-blank', start: 1, end: 3, kind: 'blank' },
          { id: 's-ghost', start: 4, end: 8, kind: 'static', tracks: { y: [{ frame: 4, value: 7 }] } }
        ]
      }
    ]
  });
}

/** Éditeur sans plugin sur une horloge manuelle. */
export interface IPlaybackHarness {
  readonly editor: IEditor;
  readonly clock: IManualClock;
}

/** Crée un éditeur sans plugin par défaut, sur horloge manuelle. */
export function createPlaybackEditor(options: EditorOptions = {}): IPlaybackHarness {
  const clock = createManualClock();
  const editor = createEditor(createContainer(), {
    data: createAnimatedDocument(),
    defaultPlugins: false,
    clock,
    ...options
  });
  return { editor, clock };
}

/** Commande pure : change la durée (undo restaure `previous`). */
export function setTotalFrames(totalFrames: number, previous: number): ICommand {
  return createCommand(
    `Durée ${totalFrames}`,
    (doc) => ({ ...doc, settings: { ...doc.settings, totalFrames } }),
    (doc) => ({ ...doc, settings: { ...doc.settings, totalFrames: previous } })
  );
}

/** Commande pure : nouvelle référence du document, mêmes valeurs. */
export function touchDocument(label: string): ICommand {
  return createCommand(label, (doc) => ({ ...doc }), (doc) => ({ ...doc }));
}

/** Événements de rendu reçus par l'hôte. */
export interface IRenderLog {
  readonly playheads: { frame: number; previous: number }[];
  readonly renders: IFrameSample[];
  readonly states: string[];
}

/** Enregistre `playhead:changed`, `frame:render` et `playback:*`. */
export function recordRenders(editor: IEditor): IRenderLog {
  const log: IRenderLog = { playheads: [], renders: [], states: [] };
  editor.on('playhead:changed', (event) => log.playheads.push({ ...event }));
  editor.on('frame:render', ({ sample }) => log.renders.push(sample));
  editor.on('playback:play', () => log.states.push('play'));
  editor.on('playback:pause', () => log.states.push('pause'));
  editor.on('playback:loop', () => log.states.push('loop'));
  editor.on('playback:complete', () => log.states.push('complete'));
  return log;
}
