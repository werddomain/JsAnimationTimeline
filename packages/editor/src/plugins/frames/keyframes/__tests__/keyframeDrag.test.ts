// packages/editor/src/plugins/frames/keyframes/__tests__/keyframeDrag.test.ts
/**
 * Tests du glisser des images clés : déplacement du document et de la
 * sélection, fantôme valide ou invalide, abandon (Échap, annulation du
 * pointeur, changement du document, destruction) et gestes ignorés.
 */

import type { ILayer, ITimelineDocument } from '@kazo-ca/timeline-runtime';
import { createSpanCommands } from '../../../../model/spans';
import { createDoc, layer, shapeOf } from '../../../../model/spans/__tests__/fixtures';
import { FRAMES_KEYFRAMES_CLASSES } from '../keyframeGhost';
import { cleanBody, moveTo, pressCell, pressKey, setupKeyframes } from './keyframeFixtures';
import type { IKeyframesHarness } from './keyframeFixtures';

afterEach(cleanBody);

const three = (id: string, extra: Partial<ILayer> = {}): ILayer =>
  layer(
    id,
    [
      { id: `${id}1`, start: 1, end: 3, kind: 'static' },
      { id: `${id}2`, start: 4, end: 6, kind: 'static' },
      { id: `${id}3`, start: 7, end: 9, kind: 'static' }
    ],
    extra
  );

const data = (): ITimelineDocument => createDoc([three('p'), three('q'), three('lock', { locked: true }), three('r')], 40);

function shape(h: IKeyframesHarness, id: string): string[] {
  return shapeOf(h.editor.toJSON(), id);
}

function cellsOf(h: IKeyframesHarness): string[] {
  return h.selection.cells().map((cell) => `${cell.rowId}:${cell.frame}`);
}

function markers(h: IKeyframesHarness): HTMLElement[] {
  return Array.from(h.grid.querySelectorAll<HTMLElement>(`.${FRAMES_KEYFRAMES_CLASSES.marker}`));
}

/** Sélectionne p:4, appuie dessus et glisse jusqu'à l'image `frame` sans relâcher. */
function dragP(h: IKeyframesHarness, frame: number): void {
  h.selection.select({ rowId: 'p', frame: 4 });
  pressCell(h.grid, 0, 4);
  moveTo('pointermove', 0, frame);
}

/** Interpolation 1-10 de `t` avec des images clés de propriété en 5 et 8. */
const tweenDoc = (): ITimelineDocument =>
  createDoc(
    [
      layer('t', [
        {
          id: 't1',
          start: 1,
          end: 10,
          kind: 'tween',
          tracks: {
            x: [
              { frame: 1, value: 0 },
              { frame: 5, value: 5 },
              { frame: 8, value: 8 }
            ]
          }
        }
      ])
    ],
    40
  );

describe('frames.keyframes drag', () => {
  it('moves the selected keyframe and the selection, in one history entry', () => {
    // Arrange
    const h = setupKeyframes(data());
    dragP(h, 5);

    // Act
    moveTo('pointerup', 0, 5);

    // Assert
    expect(shape(h, 'p')).toEqual(['static 1-4', 'static 5-6', 'static 7-9']);
    expect(cellsOf(h)).toEqual(['p:5']);
    h.editor.undo();
    expect(h.editor.toJSON()).toEqual(data());
    expect(h.ctx.commands.canUndo).toBe(false);
  });

  it('moves the keyframes of several rows together and keeps the whole selection', () => {
    // Arrange
    const h = setupKeyframes(data());
    h.selection.set([{ rowId: 'p', frame: 4 }, { rowId: 'q', frame: 4 }, { rowId: 'q', frame: 5 }]);
    pressCell(h.grid, 0, 4);

    // Act
    moveTo('pointermove', 0, 6);
    moveTo('pointerup', 0, 6);

    // Assert
    expect(shape(h, 'p')).toEqual(['static 1-5', 'static 6-6', 'static 7-9']);
    expect(shape(h, 'q')).toEqual(['static 1-5', 'static 6-6', 'static 7-9']);
    expect(cellsOf(h)).toEqual(['p:6', 'q:6', 'q:7']);
    expect(h.ctx.commands.undoLabel).toBe("Déplacer l'image clé");
  });

  it('drags a keyframe pressed without a prior selection', () => {
    // Arrange
    const h = setupKeyframes(data());
    pressCell(h.grid, 1, 7);

    // Act
    moveTo('pointermove', 1, 8);
    moveTo('pointerup', 1, 8);

    // Assert
    expect(shape(h, 'q')).toEqual(['static 1-3', 'static 4-7', 'static 8-9']);
    expect(cellsOf(h)).toEqual(['q:8']);
  });

  it('draws a valid ghost on the destination while dragging, then clears it on release', () => {
    // Arrange
    const h = setupKeyframes(data());
    dragP(h, 5);
    const left = h.editor.getService('layout.ruler')?.frameLeft(5);

    // Act
    const drawn = markers(h);

    // Assert
    expect(drawn).toHaveLength(1);
    expect(drawn[0].classList.contains(FRAMES_KEYFRAMES_CLASSES.valid)).toBe(true);
    expect(drawn[0].style.left).toBe(`${left}px`);
    expect(drawn[0].style.top).toBe('0px');
    moveTo('pointerup', 0, 5);
    expect(markers(h)).toHaveLength(0);
  });

  it('draws an invalid ghost when the move would be refused and changes nothing on release', () => {
    // Arrange
    const h = setupKeyframes(data());
    dragP(h, 8);

    // Act
    const drawn = markers(h);
    moveTo('pointerup', 0, 8);

    // Assert
    expect(drawn).toHaveLength(1);
    expect(drawn[0].classList.contains(FRAMES_KEYFRAMES_CLASSES.invalid)).toBe(true);
    expect(h.refused).toHaveLength(1);
    expect(h.editor.toJSON()).toEqual(data());
    expect(cellsOf(h)).toEqual(['p:4']);
  });

  it('turns a valid ghost invalid when the pointer goes too far', () => {
    // Arrange
    const h = setupKeyframes(data());
    dragP(h, 5);

    // Act
    moveTo('pointermove', 0, 9);

    // Assert
    expect(markers(h)[0].classList.contains(FRAMES_KEYFRAMES_CLASSES.invalid)).toBe(true);
    expect(markers(h)[0].classList.contains(FRAMES_KEYFRAMES_CLASSES.valid)).toBe(false);
  });

  it('redraws the ghost when the grid renders again', () => {
    // Arrange
    const h = setupKeyframes(data());
    dragP(h, 5);

    // Act
    h.editor.getService('frames.grid')?.refresh();

    // Assert
    expect(markers(h)).toHaveLength(1);
  });

  it('aborts on Escape: stops the key, clears the ghost and ignores the release', () => {
    // Arrange
    const h = setupKeyframes(data());
    dragP(h, 5);

    // Act
    const escape = pressKey(document.body, 'Escape');
    moveTo('pointerup', 0, 5);

    // Assert
    expect(escape.defaultPrevented).toBe(true);
    expect(markers(h)).toHaveLength(0);
    expect(h.editor.toJSON()).toEqual(data());
    expect(cellsOf(h)).toEqual(['p:4']);
  });

  it('keeps a multiple selection after Escape and a release on the start frame', () => {
    // Arrange
    const h = setupKeyframes(data());
    h.selection.set([
      { rowId: 'p', frame: 4 },
      { rowId: 'q', frame: 4 }
    ]);
    pressCell(h.grid, 0, 4);
    moveTo('pointermove', 0, 6);

    // Act : Échap, puis relâchement sur l'image de départ.
    pressKey(document.body, 'Escape');
    moveTo('pointerup', 0, 4);

    // Assert : pas de clic qui réduit la sélection, document inchangé.
    expect(cellsOf(h)).toEqual(['p:4', 'q:4']);
    expect(h.editor.toJSON()).toEqual(data());
    expect(h.editor.playback.frame).toBe(1);
  });

  it('leaves Escape alone when no drag is active', () => {
    // Arrange
    const h = setupKeyframes(data());
    h.selection.select({ rowId: 'p', frame: 4 });

    // Act
    const escape = pressKey(document.body, 'Escape');

    // Assert
    expect(escape.defaultPrevented).toBe(false);
  });

  it('aborts on pointercancel', () => {
    // Arrange
    const h = setupKeyframes(data());
    dragP(h, 5);

    // Act
    moveTo('pointercancel', 0, 5);
    moveTo('pointerup', 0, 5);

    // Assert
    expect(markers(h)).toHaveLength(0);
    expect(h.editor.toJSON()).toEqual(data());
  });

  it('does nothing when released on the pressed frame or after coming back to it', () => {
    // Arrange
    const h = setupKeyframes(data());
    dragP(h, 5);

    // Act
    moveTo('pointermove', 0, 4);
    moveTo('pointerup', 0, 4);

    // Assert
    expect(markers(h)).toHaveLength(0);
    expect(h.editor.toJSON()).toEqual(data());
    expect(h.ctx.commands.canUndo).toBe(false);
    expect(h.refused).toEqual([]);
  });

  it('aborts when the document is changed from outside during the drag', () => {
    // Arrange
    const h = setupKeyframes(data());
    dragP(h, 5);
    const outside = createSpanCommands(h.ctx.registry).insertKeyframe('r', 2);

    // Act
    h.ctx.commands.execute(outside);
    moveTo('pointerup', 0, 5);

    // Assert
    expect(markers(h)).toHaveLength(0);
    expect(shape(h, 'p')).toEqual(['static 1-3', 'static 4-6', 'static 7-9']);
    expect(shape(h, 'r')).toEqual(['static 1-1', 'static 2-3', 'static 4-6', 'static 7-9']);
  });

  it('aborts when another document is loaded', () => {
    // Arrange
    const h = setupKeyframes(data());
    dragP(h, 5);

    // Act
    h.editor.load(data());
    moveTo('pointerup', 0, 5);

    // Assert
    expect(markers(h)).toHaveLength(0);
    expect(h.editor.toJSON()).toEqual(data());
  });

  it('removes every document listener when destroyed in the middle of a drag', () => {
    // Arrange
    const h = setupKeyframes(data());
    dragP(h, 5);
    const remove = jest.spyOn(document, 'removeEventListener');

    // Act
    h.editor.destroy();
    const removed = remove.mock.calls.map((call) => call[0]);
    const escape = pressKey(document.body, 'Escape');
    moveTo('pointermove', 0, 6);
    moveTo('pointerup', 0, 6);
    remove.mockRestore();

    // Assert
    expect(removed).toEqual(expect.arrayContaining(['pointermove', 'pointerup', 'pointercancel', 'keydown']));
    expect(escape.defaultPrevented).toBe(false);
  });

  it('ignores the events of another pointer', () => {
    // Arrange
    const h = setupKeyframes(data());
    dragP(h, 5);

    // Act
    moveTo('pointerup', 0, 5, { pointerId: 2 });

    // Assert
    expect(h.editor.toJSON()).toEqual(data());
    moveTo('pointerup', 0, 5);
    expect(shape(h, 'p')).toEqual(['static 1-4', 'static 5-6', 'static 7-9']);
  });
});

describe('frames.keyframes drag start conditions', () => {
  function pressAndDrag(h: IKeyframesHarness, rowIndex: number, frame: number, init = {}): void {
    pressCell(h.grid, rowIndex, frame, init);
    moveTo('pointermove', rowIndex, frame + 1, init);
    moveTo('pointerup', rowIndex, frame + 1, init);
  }

  it.each([
    ['Ctrl', { ctrl: true }],
    ['Shift', { shift: true }],
    ['a touch pointer', { pointerType: 'touch' }],
    ['the secondary button', { button: 2 }]
  ])('does not start with %s', (_name, init) => {
    // Arrange
    const h = setupKeyframes(data());
    h.selection.select({ rowId: 'p', frame: 4 });

    // Act
    pressAndDrag(h, 0, 4, init);

    // Assert
    expect(shape(h, 'p')).toEqual(['static 1-3', 'static 4-6', 'static 7-9']);
    expect(markers(h)).toHaveLength(0);
  });

  it('does not start on a selected frame that is not a keyframe', () => {
    // Arrange
    const h = setupKeyframes(data());
    h.selection.select({ rowId: 'p', frame: 5 });

    // Act
    pressAndDrag(h, 0, 5);

    // Assert
    expect(h.editor.toJSON()).toEqual(data());
  });

  it('does not start on a locked row', () => {
    // Arrange
    const h = setupKeyframes(data());
    h.selection.select({ rowId: 'lock', frame: 4 });

    // Act
    pressAndDrag(h, 2, 4);

    // Assert
    expect(h.editor.toJSON()).toEqual(data());
    expect(h.refused).toEqual([]);
  });

  it('does not move the keyframes of a locked row dragged with an unlocked one', () => {
    // Arrange
    const h = setupKeyframes(data());
    h.selection.set([{ rowId: 'p', frame: 4 }, { rowId: 'lock', frame: 4 }]);

    // Act
    pressAndDrag(h, 0, 4);

    // Assert
    expect(shape(h, 'p')).toEqual(['static 1-4', 'static 5-6', 'static 7-9']);
    expect(shape(h, 'lock')).toEqual(['static 1-3', 'static 4-6', 'static 7-9']);
  });

  it('refuses to drop a property keyframe on an unselected one (it would be replaced)', () => {
    // Arrange
    const h = setupKeyframes(tweenDoc());
    h.selection.select({ rowId: 't', frame: 5 });
    pressCell(h.grid, 0, 5);
    moveTo('pointermove', 0, 8);

    // Act
    const drawn = markers(h);
    moveTo('pointerup', 0, 8);

    // Assert
    expect(drawn[0]?.classList.contains(FRAMES_KEYFRAMES_CLASSES.invalid)).toBe(true);
    expect(h.editor.toJSON()).toEqual(tweenDoc());
    expect(h.keyframes.move(3)).toBe(false);
  });

  it('aborts when a move arrives without any button pressed (release lost outside the window)', () => {
    // Arrange
    const h = setupKeyframes(data());
    dragP(h, 5);

    // Act
    moveTo('pointermove', 0, 6, { buttons: 0 });
    const ghost = markers(h).length;
    moveTo('pointerup', 0, 6);

    // Assert
    expect(ghost).toBe(0);
    expect(h.editor.toJSON()).toEqual(data());
  });

  it('keeps F5 from reloading the page during a drag, without acting', () => {
    // Arrange
    const h = setupKeyframes(data());
    dragP(h, 5);

    // Act
    const event = pressKey(h.grid, 'F5');

    // Assert
    expect(event.defaultPrevented).toBe(true);
    expect(h.editor.toJSON()).toEqual(data());
  });

  it('announces a drop refused because it would replace a property keyframe', () => {
    // Arrange
    const h = setupKeyframes(tweenDoc());
    h.selection.select({ rowId: 't', frame: 5 });
    pressCell(h.grid, 0, 5);
    moveTo('pointermove', 0, 8);

    // Act
    moveTo('pointerup', 0, 8);

    // Assert
    expect(h.refused).toHaveLength(1);
    expect(h.editor.toJSON()).toEqual(tweenDoc());
  });

  it('keeps a multiple selection after a drag that comes back to its start frame', () => {
    // Arrange
    const h = setupKeyframes(data());
    h.selection.set([
      { rowId: 'p', frame: 4 },
      { rowId: 'q', frame: 4 }
    ]);
    pressCell(h.grid, 0, 4);
    moveTo('pointermove', 0, 6);

    // Act
    moveTo('pointermove', 0, 4);
    moveTo('pointerup', 0, 4);

    // Assert : le relâchement sur l'image de départ n'est plus un clic qui réduit la sélection.
    expect(cellsOf(h)).toEqual(['p:4', 'q:4']);
    expect(h.editor.toJSON()).toEqual(data());
  });
});
