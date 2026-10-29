// packages/editor/src/plugins/frames/selection/__tests__/FramesSelectionPlugin.test.ts
/**
 * Tests de `frames.selection` : clic, Ctrl, Maj sur la grille, tête de
 * lecture, dessin de la sélection, images clés sélectionnées, nettoyage sur
 * changement de document, service, événement et destruction.
 */

import type { ILayer, ITimelineDocument, LayerNode } from '@kazo-ca/timeline-runtime';
import { createCommand } from '../../../../core/commands/createCommand';
import { createEditor } from '../../../../core/editor/createEditor';
import type { IEditor } from '../../../../core/editor/types';
import { LayoutPlugin } from '../../../layout/LayoutPlugin';
import { cleanBody, createContainer, createManualScheduler, makeScrollable } from '../../../layout/__tests__/layoutFixtures';
import type { IManualScheduler } from '../../../layout/__tests__/layoutFixtures';
import { createShortcutsPlugin } from '../../../interaction/shortcuts';
import { FramesPlugin } from '../../FramesPlugin';
import type { FramesSelectionChangedEvent, IFramesSelectionService } from '../types';

afterEach(cleanBody);

const GRID_LEFT = 100;
const GRID_TOP = 50;
const FRAME = 15;
const ROW = 30;

function layer(id: string, extra: Partial<ILayer> = {}): ILayer {
  return { id, type: 'layer', name: id, spans: [], ...extra };
}

function doc(layers: readonly LayerNode[], totalFrames = 40): ITimelineDocument {
  return { version: '2.0.0', settings: { fps: 24, totalFrames }, layers };
}

const animated = layer('a', {
  spans: [
    { id: 's1', start: 1, end: 4, kind: 'static' },
    {
      id: 's2',
      start: 5,
      end: 10,
      kind: 'tween',
      tracks: {
        x: [
          { frame: 5, value: 0 },
          { frame: 8, value: 4 }
        ]
      }
    },
    { id: 's3', start: 11, end: 12, kind: 'blank' }
  ]
});

const sample = doc([animated, { id: 'f', type: 'folder', name: 'f', children: [layer('b')] }, layer('c')]);

interface IHarness {
  readonly editor: IEditor;
  readonly scheduler: IManualScheduler;
  readonly selection: IFramesSelectionService;
  readonly grid: HTMLElement;
  readonly frames: HTMLElement;
  readonly events: FramesSelectionChangedEvent[];
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

function setup(data: ITimelineDocument = sample): IHarness {
  const scheduler = createManualScheduler();
  const editor = createEditor(createContainer(), {
    data,
    defaultPlugins: [new LayoutPlugin({ scrollSync: { scheduler } }), new FramesPlugin(), createShortcutsPlugin()]
  });
  const selection = editor.getService('frames.selection');
  const grid = editor.getService('frames.grid')?.element();
  const frames = editor.container.querySelector<HTMLElement>('[data-zone="frames"]');
  if (selection === undefined || grid === undefined || frames === null) throw new Error('montage incomplet');
  mockRect(grid);
  const events: FramesSelectionChangedEvent[] = [];
  editor.on('frames:selectionChanged', (event) => events.push(event));
  return { editor, scheduler, selection, grid, frames, events };
}

interface IClick {
  readonly ctrl?: boolean;
  readonly meta?: boolean;
  readonly shift?: boolean;
  readonly button?: number;
  readonly pointerType?: string;
  readonly pointerId?: number;
}

/** Appui (ou, avec `type`, autre événement de pointeur) sur l'image `frame` de la ligne `rowIndex`. */
function press(grid: HTMLElement, rowIndex: number, frame: number, click: IClick = {}, type = 'pointerdown'): boolean {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: GRID_LEFT + (frame - 1) * FRAME + 3,
    clientY: GRID_TOP + rowIndex * ROW + 3,
    button: click.button ?? 0,
    ctrlKey: click.ctrl ?? false,
    metaKey: click.meta ?? false,
    shiftKey: click.shift ?? false
  });
  // jsdom n'a pas de PointerEvent : les champs du pointeur sont ajoutés à la main.
  Object.defineProperty(event, 'pointerId', { value: click.pointerId ?? 1 });
  Object.defineProperty(event, 'pointerType', { value: click.pointerType ?? 'mouse' });
  return grid.dispatchEvent(event);
}

/** Clic complet (appui puis relâchement au même endroit). */
function click(grid: HTMLElement, rowIndex: number, frame: number, modifiers: IClick = {}): void {
  press(grid, rowIndex, frame, modifiers);
  press(grid, rowIndex, frame, modifiers, 'pointerup');
}

function keys(selection: IFramesSelectionService): string[] {
  return selection.cells().map((cell) => `${cell.rowId}:${cell.frame}`);
}

function runs(grid: HTMLElement): string[][] {
  return Array.from(grid.querySelectorAll<HTMLElement>('.jt-frame-selection__run')).map((run) => [
    run.dataset.rowId ?? '',
    run.style.left,
    run.style.top,
    run.style.width
  ]);
}

describe('frames.selection clicks', () => {
  it('selects only the clicked frame, moves the playhead there and draws it', () => {
    // Arrange
    const { editor, grid, selection, events } = setup();

    // Act
    press(grid, 0, 6);
    const frameWhilePressed = editor.playback.frame;
    press(grid, 0, 6, {}, 'pointerup');

    // Assert : la tête de lecture ne bouge qu'au relâchement.
    expect(frameWhilePressed).toBe(1);
    expect(keys(selection)).toEqual(['a:6']);
    expect(selection.anchor()).toEqual({ rowId: 'a', frame: 6 });
    expect(editor.playback.frame).toBe(6);
    expect(runs(grid)).toEqual([['a', '75px', '0px', '15px']]);
    expect(events).toEqual([{ cells: [{ rowId: 'a', frame: 6 }], previous: [], anchor: { rowId: 'a', frame: 6 } }]);
  });

  it('toggles frames with Ctrl or Cmd', () => {
    // Arrange
    const { grid, selection } = setup();
    press(grid, 0, 2);

    // Act
    press(grid, 3, 4, { ctrl: true });
    press(grid, 0, 3, { meta: true });
    press(grid, 0, 2, { ctrl: true });

    // Assert
    expect(keys(selection)).toEqual(['a:3', 'c:4']);
  });

  it('selects the rectangle from the anchor with Shift, across rows but not folders', () => {
    // Arrange
    const { grid, selection } = setup();
    press(grid, 3, 3);

    // Act : de c:3 à b:4 (b est la ligne 2, dans le dossier ouvert).
    press(grid, 2, 4, { shift: true });

    // Assert
    expect(keys(selection)).toEqual(['b:3', 'b:4', 'c:3', 'c:4']);
    expect(selection.anchor()).toEqual({ rowId: 'c', frame: 3 });
    expect(runs(grid).map((run) => run[0])).toEqual(['b', 'c']);
  });

  it('adds the rectangle with Ctrl+Shift', () => {
    // Arrange
    const { grid, selection } = setup();
    press(grid, 0, 9);
    press(grid, 3, 1, { ctrl: true });

    // Act
    press(grid, 3, 2, { ctrl: true, shift: true });

    // Assert
    expect(keys(selection)).toEqual(['a:9', 'c:1', 'c:2']);
  });

  it('clears the selection on a folder row and ignores other buttons', () => {
    // Arrange
    const { grid, selection } = setup();
    press(grid, 0, 2);

    // Act
    press(grid, 0, 5, { button: 2 });
    const afterRightClick = keys(selection);
    press(grid, 1, 5);

    // Assert
    expect(afterRightClick).toEqual(['a:2']);
    expect(keys(selection)).toEqual([]);
    expect(runs(grid)).toEqual([]);
  });

  it('keeps a multiple selection when pressing one of its frames, and reduces it on release there', () => {
    // Arrange
    const { grid, selection } = setup();
    selection.set([
      { rowId: 'a', frame: 2 },
      { rowId: 'a', frame: 3 }
    ]);

    // Act
    press(grid, 0, 3);
    const whilePressed = keys(selection);
    press(grid, 0, 3, {}, 'pointerup');

    // Assert
    expect(whilePressed).toEqual(['a:2', 'a:3']);
    expect(keys(selection)).toEqual(['a:3']);
  });

  it('keeps the multiple selection when released on another frame (a drag)', () => {
    // Arrange
    const { grid, selection } = setup();
    selection.set([
      { rowId: 'a', frame: 2 },
      { rowId: 'a', frame: 3 }
    ]);

    // Act
    press(grid, 0, 3);
    press(grid, 0, 7, {}, 'pointerup');

    // Assert
    expect(keys(selection)).toEqual(['a:2', 'a:3']);
  });

  it('does not move the playhead when the click selects nothing there', () => {
    // Arrange
    const { editor, grid } = setup();
    click(grid, 0, 2);
    click(grid, 0, 8, { ctrl: true });

    // Act : Ctrl+clic qui retire l'image 8, puis clic sur un dossier.
    click(grid, 0, 8, { ctrl: true });
    const afterDeselect = editor.playback.frame;
    click(grid, 1, 12);

    // Assert
    expect(afterDeselect).toBe(8);
    expect(editor.playback.frame).toBe(8);
  });

  it('neither moves the playhead nor scrolls while pressing an edge frame of a multiple selection', () => {
    // Arrange : la zone montre les images 1 à 41, la 41 coupée par le bord droit.
    const { editor, grid, frames, scheduler, selection } = setup(doc([layer('a')], 100));
    makeScrollable(frames, { scrollWidth: 1500, scrollHeight: 300, clientWidth: 41 * FRAME - 5, clientHeight: 300 });
    scheduler.flush();
    selection.set([38, 39, 40, 41].map((frame) => ({ rowId: 'a', frame })));

    // Act
    press(grid, 0, 41);
    scheduler.flush();
    const during = { frame: editor.playback.frame, scrollLeft: frames.scrollLeft, cells: keys(selection) };
    press(grid, 0, 41, {}, 'pointerup');

    // Assert
    expect(during).toEqual({ frame: 1, scrollLeft: 0, cells: ['a:38', 'a:39', 'a:40', 'a:41'] });
    expect(keys(selection)).toEqual(['a:41']);
    expect(editor.playback.frame).toBe(41);
  });

  it('selects on a tap for touch, not on the press', () => {
    // Arrange
    const { grid, selection } = setup();

    // Act
    press(grid, 0, 4, { pointerType: 'touch' });
    const whilePressed = keys(selection);
    press(grid, 0, 4, { pointerType: 'touch' }, 'pointerup');

    // Assert
    expect(whilePressed).toEqual([]);
    expect(keys(selection)).toEqual(['a:4']);
  });

  it('does nothing on release after a pointercancel', () => {
    // Arrange
    const { editor, grid, selection } = setup();
    selection.set([
      { rowId: 'a', frame: 2 },
      { rowId: 'a', frame: 3 }
    ]);

    // Act
    press(grid, 0, 3);
    press(grid, 0, 3, {}, 'pointercancel');
    press(grid, 0, 3, {}, 'pointerup');

    // Assert
    expect(keys(selection)).toEqual(['a:2', 'a:3']);
    expect(editor.playback.frame).toBe(1);
  });

  it('ignores the release and the cancel of another pointer', () => {
    // Arrange
    const { grid, selection } = setup();
    selection.set([
      { rowId: 'a', frame: 2 },
      { rowId: 'a', frame: 3 }
    ]);

    // Act
    press(grid, 0, 3);
    press(grid, 0, 3, { pointerId: 2 }, 'pointercancel');
    press(grid, 0, 3, { pointerId: 2 }, 'pointerup');
    const afterOtherPointer = keys(selection);
    press(grid, 0, 3, {}, 'pointerup');

    // Assert
    expect(afterOtherPointer).toEqual(['a:2', 'a:3']);
    expect(keys(selection)).toEqual(['a:3']);
  });

  it('does nothing on release after the grid lost the pointer capture', () => {
    // Arrange
    const { grid, selection } = setup();
    selection.set([
      { rowId: 'a', frame: 2 },
      { rowId: 'a', frame: 3 }
    ]);

    // Act
    press(grid, 0, 3);
    press(grid, 0, 3, {}, 'lostpointercapture');
    press(grid, 0, 3, {}, 'pointerup');

    // Assert
    expect(keys(selection)).toEqual(['a:2', 'a:3']);
  });

  it('forgets a pending release when another document is loaded', () => {
    // Arrange
    const { editor, grid, selection } = setup();
    selection.set([
      { rowId: 'a', frame: 2 },
      { rowId: 'a', frame: 3 }
    ]);
    press(grid, 0, 3);

    // Act
    editor.load(sample);
    press(grid, 0, 3, {}, 'pointerup');

    // Assert
    expect(keys(selection)).toEqual([]);
    expect(editor.playback.frame).toBe(1);
  });

  it('prevents the native text selection on Shift+click', () => {
    // Arrange
    const { grid } = setup();
    press(grid, 0, 2);

    // Act
    const notCancelled = press(grid, 0, 5, { shift: true });

    // Assert
    expect(notCancelled).toBe(false);
  });

  it('ignores a press outside the cells', () => {
    // Arrange
    const { grid, selection, events } = setup();

    // Act
    grid.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: GRID_LEFT - 5, clientY: GRID_TOP }));

    // Assert
    expect(keys(selection)).toEqual([]);
    expect(events).toEqual([]);
  });
});

describe('frames.selection keyframes', () => {
  it('lists the selected cells that hold a keyframe, with their kind and span', () => {
    // Arrange
    const { selection } = setup();

    // Act
    selection.set([
      { rowId: 'a', frame: 1 },
      { rowId: 'a', frame: 3 },
      { rowId: 'a', frame: 4 },
      { rowId: 'a', frame: 5 },
      { rowId: 'a', frame: 8 },
      { rowId: 'a', frame: 11 },
      { rowId: 'c', frame: 1 }
    ]);

    // Assert : a:4 est une fin de plage, pas une image clé ; c n'a pas de plage.
    expect(selection.keyframes()).toEqual([
      { rowId: 'a', frame: 1, kind: 'keyframe', spanId: 's1' },
      { rowId: 'a', frame: 5, kind: 'keyframe', spanId: 's2' },
      { rowId: 'a', frame: 8, kind: 'propertyKeyframe', spanId: 's2' },
      { rowId: 'a', frame: 11, kind: 'blankKeyframe', spanId: 's3' }
    ]);
  });
});

describe('frames.selection document changes', () => {
  it('clears the selection when another document is loaded', () => {
    // Arrange
    const { editor, selection } = setup();
    selection.set([{ rowId: 'a', frame: 2 }]);

    // Act
    editor.load(sample);

    // Assert
    expect(keys(selection)).toEqual([]);
    expect(selection.anchor()).toBeUndefined();
  });

  it('drops the frames of a removed layer, or past a shorter duration', () => {
    // Arrange
    const { editor, selection, events } = setup();
    selection.set([
      { rowId: 'a', frame: 2 },
      { rowId: 'b', frame: 3 },
      { rowId: 'c', frame: 30 }
    ]);
    const before = editor.document;

    // Act
    editor.execute(
      createCommand(
        'Réduire',
        () => doc([animated, layer('c')], 20),
        () => before
      )
    );

    // Assert
    expect(keys(selection)).toEqual(['a:2']);
    expect(selection.anchor()).toBeUndefined();
    expect(events[events.length - 1]?.previous.length).toBe(3);
  });

  it('keeps the selection drawn after the grid redraws for a scroll', () => {
    // Arrange
    const long = doc([layer('a')], 1000);
    const { editor, grid, frames, scheduler, selection } = setup(long);
    makeScrollable(frames, { scrollWidth: 15000, scrollHeight: 300, clientWidth: 300, clientHeight: 300 });
    scheduler.flush();
    selection.set([
      { rowId: 'a', frame: 2 },
      { rowId: 'a', frame: 500 }
    ]);

    // Act
    editor.getService('layout.scrollSync')?.scrollTo({ left: 499 * FRAME });

    // Assert : seule l'image 500 est dans la fenêtre dessinée.
    expect(runs(grid)).toEqual([['a', `${499 * FRAME}px`, '0px', '15px']]);
  });
});

describe('frames.selection service', () => {
  it('selects, toggles, extends and clears through the service', () => {
    // Arrange
    const { selection } = setup();

    // Act / Assert
    selection.select({ rowId: 'c', frame: 2 });
    expect(keys(selection)).toEqual(['c:2']);
    selection.toggle({ rowId: 'a', frame: 7 });
    expect(selection.isSelected('a', 7)).toBe(true);
    selection.selectRange({ rowId: 'a', frame: 8 });
    expect(keys(selection)).toEqual(['a:7', 'a:8']);
    selection.selectRange({ rowId: 'a', frame: 9 }, true);
    expect(keys(selection)).toEqual(['a:7', 'a:8', 'a:9']);
    selection.clear();
    expect(keys(selection)).toEqual([]);
    expect(selection.anchor()).toBeUndefined();
  });

  it('emits nothing when the selection does not change', () => {
    // Arrange
    const { selection, events } = setup();
    selection.select({ rowId: 'a', frame: 2 });

    // Act
    selection.select({ rowId: 'a', frame: 2 });
    selection.toggle({ rowId: 'f', frame: 2 });
    selection.clear();
    selection.clear();

    // Assert
    expect(events).toHaveLength(2);
  });

  it('removes its drawing on destroy', () => {
    // Arrange
    const { editor, frames, selection } = setup();
    selection.select({ rowId: 'a', frame: 2 });

    // Act
    editor.destroy();

    // Assert
    expect(frames.querySelector('.jt-frame-selection')).toBeNull();
  });
});
