// packages/editor/src/plugins/playback/livePreview/__tests__/livePreviewFixtures.ts
/**
 * Fixtures des tests de `playback.livePreview` : éditeur sur la fausse scène
 * (qui consigne `sync` / `render`), horloge et ordonnanceur manuels, règle
 * placée à l'écran, et glisser de la tête de lecture au pointeur.
 */

import { createManualClock } from '@werddomain/timeline-runtime';
import type { IManualClock } from '@werddomain/timeline-runtime';
import type { EditorPlugin } from '../../../../core/context/IEditorContext';
import { createEditor } from '../../../../core/editor/createEditor';
import type { IEditor } from '../../../../core/editor/types';
import { createFakeStage, createStageDocument } from '../../../../core/stage/__tests__/fixtures';
import type { IFakeStage } from '../../../../core/stage/__tests__/fixtures';
import { createShortcutsPlugin } from '../../../interaction/shortcuts';
import { createManualScheduler, placeAt } from '../../../layout/__tests__/layoutFixtures';
import { LayoutPlugin } from '../../../layout/LayoutPlugin';
import { ToolbarMainPlugin } from '../../../toolbar/main/ToolbarMainPlugin';
import { LivePreviewPlugin } from '../LivePreviewPlugin';
import type { ILivePreviewApi, ILivePreviewOptions } from '../types';

/** Durée d'une image d'affichage pour l'horloge manuelle, en millisecondes. */
export const DISPLAY_FRAME_MS = 16;

/** Position de la règle à l'écran (`placeAt`) et largeur d'une image. */
const RULER_LEFT = 100;
const FRAME_WIDTH = 15;

export interface IPreviewHarness {
  readonly editor: IEditor;
  readonly stage: IFakeStage;
  readonly clock: IManualClock;
  readonly preview: () => ILivePreviewApi;
  /** Rendus reçus par la scène (`render:<image>`), sans les `sync`. */
  readonly renders: () => string[];
  /** Commence un glisser sur l'image `frame`, puis une image d'affichage. */
  readonly down: (frame: number) => void;
  /** Déplace le pointeur sur l'image `frame` (bouton enfoncé), puis une image d'affichage. */
  readonly move: (frame: number) => void;
  /** Comme `move`, sans laisser passer l'image d'affichage (le relâchement arrive dans la même tâche). */
  readonly moveQuiet: (frame: number) => void;
  /** Relâche le pointeur. */
  readonly up: () => void;
}

function epic(id: string, children: readonly EditorPlugin[]): EditorPlugin {
  return { id, dependencies: [], children, init: () => {}, destroy: () => {} };
}

function pointer(type: string, frame: number, buttons: number): MouseEvent {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: RULER_LEFT + FRAME_WIDTH * (frame - 1) + 1,
    button: 0,
    buttons
  });
}

/** Éditeurs montés, détruits par `cleanPreviews` (un test peut s'arrêter en plein glisser). */
const mountedEditors: IEditor[] = [];

/** Détruit les éditeurs montés puis retire les conteneurs (à appeler dans `afterEach`). */
export function cleanPreviews(): void {
  mountedEditors.splice(0).forEach((editor) => {
    if (!editor.isDestroyed) editor.destroy();
  });
  document.body.innerHTML = '';
}

/** Variantes de la coquille montée autour du plugin. */
export interface IPreviewShell {
  /** `false` : sans `toolbar.main` (éditeur sans barre d'outils). */
  readonly withToolbar?: boolean;
}

/** Monte l'éditeur avec la coquille, les raccourcis, la barre d'outils et `playback.livePreview`. */
export function mountPreview(options: ILivePreviewOptions = {}, shell: IPreviewShell = {}): IPreviewHarness {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const clock = createManualClock();
  const stage = createFakeStage();
  const editor = createEditor(container, {
    data: createStageDocument(),
    stage,
    clock,
    defaultPlugins: [
      new LayoutPlugin({ scrollSync: { scheduler: createManualScheduler() }, ruler: { frameWidth: FRAME_WIDTH } }),
      createShortcutsPlugin(),
      ...(shell.withToolbar === false ? [] : [epic('toolbar', [new ToolbarMainPlugin()])]),
      epic('playback', [new LivePreviewPlugin(options)])
    ]
  });
  mountedEditors.push(editor);
  const ruler = editor.container.querySelector<HTMLElement>('[data-zone="ruler"]') as HTMLElement;
  placeAt(ruler, RULER_LEFT);
  clock.advance(DISPLAY_FRAME_MS);
  stage.log.length = 0;
  return {
    editor,
    stage,
    clock,
    preview: () => editor.getService('playback.livePreview') as ILivePreviewApi,
    renders: () => stage.log.filter((entry) => entry.startsWith('render:')),
    down: (frame) => {
      ruler.dispatchEvent(pointer('pointerdown', frame, 1));
      clock.advance(DISPLAY_FRAME_MS);
    },
    move: (frame) => {
      document.dispatchEvent(pointer('pointermove', frame, 1));
      clock.advance(DISPLAY_FRAME_MS);
    },
    moveQuiet: (frame) => {
      document.dispatchEvent(pointer('pointermove', frame, 1));
    },
    up: () => document.dispatchEvent(pointer('pointerup', 1, 0))
  };
}
