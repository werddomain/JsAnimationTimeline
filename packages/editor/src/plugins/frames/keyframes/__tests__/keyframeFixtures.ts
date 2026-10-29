// packages/editor/src/plugins/frames/keyframes/__tests__/keyframeFixtures.ts
/**
 * Fixtures des tests de `frames.keyframes` : un éditeur monté avec la mise en
 * page, l'epic `frames` et les raccourcis (grille à 15 px par image, lignes
 * de 30 px, `getBoundingClientRect` simulé), et les gestes de pointeur et de
 * clavier.
 */

import type { ITimelineDocument } from '@kazo-ca/timeline-runtime';
import type { EditorPlugin, IEditorContext } from '../../../../core/context/IEditorContext';
import { createEditor } from '../../../../core/editor/createEditor';
import type { IEditor } from '../../../../core/editor/types';
import { LayersPlugin } from '../../../layers/LayersPlugin';
import { createShortcutsPlugin } from '../../../interaction/shortcuts';
import { LayoutPlugin } from '../../../layout/LayoutPlugin';
import { cleanBody, createContainer, createManualScheduler } from '../../../layout/__tests__/layoutFixtures';
import { FramesPlugin } from '../../FramesPlugin';
import type { IFramesSelectionService } from '../../selection/types';
import type { IFramesKeyframesService } from '../types';

export { cleanBody };

export const GRID_LEFT = 100;
export const GRID_TOP = 50;
export const FRAME = 15;
export const ROW = 30;

export interface IKeyframesHarness {
  readonly editor: IEditor;
  readonly ctx: IEditorContext;
  readonly selection: IFramesSelectionService;
  readonly keyframes: IFramesKeyframesService;
  readonly grid: HTMLElement;
  /** Messages de `command:refused`. */
  readonly refused: string[];
}

export interface IHarnessOptions {
  readonly withLayers?: boolean;
}

function mockRect(element: HTMLElement): void {
  element.getBoundingClientRect = () => ({
    left: GRID_LEFT,
    top: GRID_TOP,
    right: GRID_LEFT,
    bottom: GRID_TOP,
    width: 0,
    height: 0,
    x: GRID_LEFT,
    y: GRID_TOP,
    toJSON: () => ({})
  });
}

/** Monte l'éditeur sur `data` ; `withLayers` ajoute l'epic `layers` (service `layers.selection`). */
export function setupKeyframes(data: ITimelineDocument, options: IHarnessOptions = {}): IKeyframesHarness {
  const scheduler = createManualScheduler();
  let captured: IEditorContext | undefined;
  const spy: EditorPlugin = {
    id: 'test.spy',
    dependencies: [],
    init: (ctx) => void (captured = ctx),
    destroy: () => undefined
  };
  const editor = createEditor(createContainer(), {
    data,
    defaultPlugins: [
      new LayoutPlugin({ scrollSync: { scheduler } }),
      ...(options.withLayers === true ? [new LayersPlugin()] : []),
      new FramesPlugin(),
      createShortcutsPlugin()
    ],
    plugins: [spy]
  });
  const selection = editor.getService('frames.selection');
  const keyframes = editor.getService('frames.keyframes');
  const grid = editor.getService('frames.grid')?.element();
  if (captured === undefined || selection === undefined || keyframes === undefined || grid === undefined) {
    throw new Error('montage incomplet');
  }
  mockRect(grid);
  const refused: string[] = [];
  editor.on('command:refused', (event) => refused.push(event.reason));
  return { editor, ctx: captured, selection, keyframes, grid, refused };
}

export interface IPointer {
  readonly pointerId?: number;
  readonly button?: number;
  readonly ctrl?: boolean;
  readonly shift?: boolean;
  readonly pointerType?: string;
  /** Boutons enfoncés ; par défaut 1 pendant un mouvement, 0 sinon. */
  readonly buttons?: number;
}

/** Événement de pointeur sur l'image `frame` de la ligne `rowIndex` (jsdom n'a pas de PointerEvent). */
export function pointer(type: string, rowIndex: number, frame: number, init: IPointer = {}): MouseEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: GRID_LEFT + (frame - 1) * FRAME + 3,
    clientY: GRID_TOP + rowIndex * ROW + 3,
    button: init.button ?? 0,
    buttons: init.buttons ?? (type === 'pointermove' ? 1 : 0),
    ctrlKey: init.ctrl ?? false,
    shiftKey: init.shift ?? false
  });
  Object.defineProperty(event, 'pointerId', { value: init.pointerId ?? 1 });
  Object.defineProperty(event, 'pointerType', { value: init.pointerType ?? 'mouse' });
  return event;
}

/** Appui sur la grille. */
export function pressCell(grid: HTMLElement, rowIndex: number, frame: number, init: IPointer = {}): void {
  grid.dispatchEvent(pointer('pointerdown', rowIndex, frame, init));
}

/** Mouvement, relâchement ou annulation, reçus par le document. */
export function moveTo(type: 'pointermove' | 'pointerup' | 'pointercancel', rowIndex: number, frame: number, init: IPointer = {}): void {
  document.dispatchEvent(pointer(type, rowIndex, frame, init));
}

/** Frappe sur un élément de l'éditeur ; retourne l'événement pour lire `defaultPrevented`. */
export function pressKey(target: HTMLElement, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}
