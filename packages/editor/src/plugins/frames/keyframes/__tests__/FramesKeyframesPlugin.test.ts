// packages/editor/src/plugins/frames/keyframes/__tests__/FramesKeyframesPlugin.test.ts
/**
 * Tests de `frames.keyframes` : les raccourcis F5 / F6 / F7 sur plusieurs
 * lignes, une seule entrée d'historique, tout ou rien, repli sur la tête de
 * lecture, service et destruction.
 */

import type { ILayer, ITimelineDocument } from '@werddomain/timeline-runtime';
import { SpanCommandLabels } from '../../../../model/spans';
import { createDoc, layer, shapeOf } from '../../../../model/spans/__tests__/fixtures';
import { cleanBody, pressKey, setupKeyframes } from './keyframeFixtures';
import type { IKeyframesHarness } from './keyframeFixtures';

// Le document de test contient une propriété inconnue du registre : le Store s'en plaint dans la console.
beforeEach(() => void jest.spyOn(console, 'warn').mockImplementation(() => undefined));

afterEach(() => {
  jest.restoreAllMocks();
  cleanBody();
});

const long = (id: string, extra: Partial<ILayer> = {}): ILayer =>
  layer(id, [{ id: `${id}1`, start: 1, end: 10, kind: 'static' }], extra);

const split = (id: string): ILayer =>
  layer(id, [
    { id: `${id}1`, start: 1, end: 4, kind: 'static' },
    { id: `${id}2`, start: 5, end: 10, kind: 'static' }
  ]);

/** Interpolation dont la propriété est inconnue du registre : l'évaluation (F6) échoue, donc K1 refuse. */
const brokenTween = (): ILayer =>
  layer('tw', [
    {
      id: 'tw1',
      start: 1,
      end: 10,
      kind: 'tween',
      tracks: { unknownProperty: [{ frame: 1, value: 0 }, { frame: 10, value: 5 }] }
    }
  ]);

const data = (): ITimelineDocument =>
  createDoc(
    [long('a'), long('b'), long('lock', { locked: true }), brokenTween(), { id: 'f', type: 'folder', name: 'f', children: [long('c')] }, split('s'), split('t')],
    40
  );

function shape(h: IKeyframesHarness, id: string): string[] {
  return shapeOf(h.editor.toJSON(), id);
}

function press(h: IKeyframesHarness, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  return pressKey(h.grid, key, init);
}

describe('frames.keyframes shortcuts', () => {
  it('inserts a keyframe on every selected row with F6 and undoes it in one step', () => {
    // Arrange
    const h = setupKeyframes(data());
    h.selection.set([{ rowId: 'a', frame: 3 }, { rowId: 'b', frame: 5 }]);

    // Act
    const event = press(h, 'F6');

    // Assert
    expect(event.defaultPrevented).toBe(true);
    expect(shape(h, 'a')).toEqual(['static 1-2', 'static 3-10']);
    expect(shape(h, 'b')).toEqual(['static 1-4', 'static 5-10']);
    expect(h.editor.getService('frames.keyframes')).toBe(h.keyframes);
    expect(h.ctx.commands.undoLabel).toBe(SpanCommandLabels.INSERT_KEYFRAME);
    h.editor.undo();
    expect(h.editor.toJSON()).toEqual(data());
    expect(h.ctx.commands.canUndo).toBe(false);
  });

  it('inserts a blank keyframe with F7', () => {
    // Arrange
    const h = setupKeyframes(data());
    h.selection.set([{ rowId: 'a', frame: 3 }, { rowId: 'b', frame: 5 }]);

    // Act
    press(h, 'F7');

    // Assert
    expect(shape(h, 'a')).toEqual(['static 1-2', 'blank 3-10']);
    expect(shape(h, 'b')).toEqual(['static 1-4', 'blank 5-10']);
    expect(h.ctx.commands.undoLabel).toBe(SpanCommandLabels.INSERT_BLANK_KEYFRAME);
  });

  it('deletes keyframes with Shift+F6', () => {
    // Arrange
    const h = setupKeyframes(data());
    h.selection.set([{ rowId: 's', frame: 5 }, { rowId: 't', frame: 5 }]);

    // Act
    press(h, 'F6', { shiftKey: true });

    // Assert
    expect(shape(h, 's')).toEqual(['static 1-10']);
    expect(shape(h, 't')).toEqual(['static 1-10']);
    expect(h.ctx.commands.undoLabel).toBe(SpanCommandLabels.DELETE_KEYFRAME);
  });

  it('inserts a frame with F5 on several selected frames of one row, from right to left', () => {
    // Arrange
    const h = setupKeyframes(data());
    h.selection.set([{ rowId: 'a', frame: 2 }, { rowId: 'a', frame: 6 }, { rowId: 'b', frame: 3 }]);

    // Act
    press(h, 'F5');

    // Assert
    expect(shape(h, 'a')).toEqual(['static 1-12']);
    expect(shape(h, 'b')).toEqual(['static 1-11']);
    h.editor.undo();
    expect(h.editor.toJSON()).toEqual(data());
  });

  it('removes a frame with Shift+F5', () => {
    // Arrange
    const h = setupKeyframes(data());
    h.selection.set([{ rowId: 'a', frame: 2 }, { rowId: 'b', frame: 3 }]);

    // Act
    press(h, 'F5', { shiftKey: true });

    // Assert
    expect(shape(h, 'a')).toEqual(['static 1-9']);
    expect(shape(h, 'b')).toEqual(['static 1-9']);
    expect(h.ctx.commands.undoLabel).toBe(SpanCommandLabels.REMOVE_FRAME);
  });

  it('preserves document and history when frame removal is vetoed', () => {
    const h = setupKeyframes(data());
    h.selection.set([{ rowId: 'a', frame: 2 }]);
    expect(h.keyframes.insertFrame()).toBe(true);
    expect(h.editor.undo()).toBe(true);
    const before = h.editor.toJSON();
    const history = [h.ctx.commands.canUndo, h.ctx.commands.canRedo, h.ctx.commands.undoLabel, h.ctx.commands.redoLabel];
    const seen: string[] = [];
    h.ctx.events.onCancellable('command:before', (event) => {
      seen.push(event.payload.command.label);
      event.cancel();
    });

    expect(h.keyframes.removeFrame()).toBe(false);
    expect(seen).toEqual([SpanCommandLabels.REMOVE_FRAME]);
    expect(h.refused).toEqual(['cancelled']);
    expect(h.editor.toJSON()).toEqual(before);
    expect([h.ctx.commands.canUndo, h.ctx.commands.canRedo, h.ctx.commands.undoLabel, h.ctx.commands.redoLabel]).toEqual(history);
  });

  it('applies the whole action or nothing when a command is refused', () => {
    // Arrange
    const h = setupKeyframes(data());
    h.selection.set([{ rowId: 'a', frame: 3 }, { rowId: 'tw', frame: 4 }]);

    // Act
    const event = press(h, 'F6');

    // Assert
    expect(event.defaultPrevented).toBe(true);
    expect(h.editor.toJSON()).toEqual(data());
    expect(h.refused).toHaveLength(1);
    expect(h.ctx.commands.canUndo).toBe(false);
  });

  it('skips locked rows when another row can be edited', () => {
    // Arrange
    const h = setupKeyframes(data());
    h.selection.set([{ rowId: 'lock', frame: 3 }, { rowId: 'a', frame: 3 }]);

    // Act
    press(h, 'F6');

    // Assert
    expect(shape(h, 'lock')).toEqual(['static 1-10']);
    expect(shape(h, 'a')).toEqual(['static 1-2', 'static 3-10']);
    expect(h.refused).toEqual([]);
  });

  it('shows the locked refusal when every selected row is locked', () => {
    // Arrange
    const h = setupKeyframes(data());
    h.selection.set([{ rowId: 'lock', frame: 3 }]);

    // Act
    press(h, 'F6');

    // Assert
    expect(h.refused).toEqual([expect.stringContaining('verrouillé')]);
    expect(h.editor.toJSON()).toEqual(data());
  });

  it('prevents the browser reload of F5 even without any target', () => {
    // Arrange
    const h = setupKeyframes(data());

    // Act
    const event = press(h, 'F5');

    // Assert
    expect(event.defaultPrevented).toBe(true);
    expect(h.editor.toJSON()).toEqual(data());
    expect(h.refused).toEqual([]);
  });

  it('uses the playhead on the selected layers when no frame is selected', () => {
    // Arrange
    const h = setupKeyframes(data(), { withLayers: true });
    const layers = h.editor.getService('layers.selection');
    layers?.select(['a', 'f', 'b']);
    h.ctx.playback.seek(4);

    // Act
    press(h, 'F6');

    // Assert
    expect(shape(h, 'a')).toEqual(['static 1-3', 'static 4-10']);
    expect(shape(h, 'b')).toEqual(['static 1-3', 'static 4-10']);
    expect(shape(h, 'c')).toEqual(['static 1-10']);
  });

  it('does nothing without frame selection when layers.selection is absent', () => {
    // Arrange
    const h = setupKeyframes(data());
    h.ctx.playback.seek(4);

    // Act
    const changed = h.keyframes.insertKeyframe();

    // Assert
    expect(changed).toBe(false);
    expect(h.editor.toJSON()).toEqual(data());
  });

  it('ignores the shortcuts while a history group is open, without letting F5 reload', () => {
    // Arrange
    const h = setupKeyframes(data());
    h.selection.set([{ rowId: 'a', frame: 3 }]);
    h.ctx.commands.beginGroup('Groupe');

    // Act
    const event = press(h, 'F6');
    h.ctx.commands.cancelGroup();

    // Assert
    expect(event.defaultPrevented).toBe(true);
    expect(shape(h, 'a')).toEqual(['static 1-10']);
  });

  it('registers its five shortcuts with French labels', () => {
    // Arrange
    const h = setupKeyframes(data());

    // Act
    const list = h.editor.getService('interaction.shortcuts')?.list() ?? [];
    const mine = list.filter((shortcut) => shortcut.id.startsWith('frames.keyframes.'));

    // Assert
    expect(mine.map((shortcut) => [shortcut.id, shortcut.label, shortcut.keys[0]])).toEqual([
      ['frames.keyframes.insertFrame', 'Insérer une image', 'F5'],
      ['frames.keyframes.removeFrame', 'Supprimer une image', 'Shift+F5'],
      ['frames.keyframes.insertKeyframe', 'Insérer une image clé', 'F6'],
      ['frames.keyframes.deleteKeyframe', "Effacer l'image clé", 'Shift+F6'],
      ['frames.keyframes.insertBlankKeyframe', 'Insérer une image clé vide', 'F7']
    ]);
  });
});

describe('frames.keyframes service', () => {
  it('returns true when the document changed and false otherwise', () => {
    // Arrange
    const h = setupKeyframes(data());
    h.selection.set([{ rowId: 'a', frame: 3 }]);

    // Act
    const first = h.keyframes.insertKeyframe();
    const second = h.keyframes.insertKeyframe();

    // Assert
    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it('moves the selected keyframes and the selection with move(offset)', () => {
    // Arrange
    const h = setupKeyframes(data());
    h.selection.set([{ rowId: 's', frame: 5 }, { rowId: 't', frame: 5 }]);

    // Act
    const changed = h.keyframes.move(2);

    // Assert
    expect(changed).toBe(true);
    expect(shape(h, 's')).toEqual(['static 1-6', 'static 7-10']);
    expect(shape(h, 't')).toEqual(['static 1-6', 'static 7-10']);
    expect(h.selection.cells()).toEqual([{ rowId: 's', frame: 7 }, { rowId: 't', frame: 7 }]);
    h.editor.undo();
    expect(h.editor.toJSON()).toEqual(data());
  });

  it('ignores an offset of 0 and reports a refused move through command:refused', () => {
    // Arrange
    const h = setupKeyframes(data());
    h.selection.set([{ rowId: 's', frame: 5 }]);

    // Act
    const none = h.keyframes.move(0);
    const refusedMove = h.keyframes.move(-100);

    // Assert
    expect(none).toBe(false);
    expect(refusedMove).toBe(false);
    expect(h.refused).toHaveLength(1);
    expect(h.editor.toJSON()).toEqual(data());
  });
});

describe('frames.keyframes F5 past the end of a layer', () => {
  const short = (): ITimelineDocument => createDoc([layer('a', [{ id: 'a1', start: 1, end: 5, kind: 'static' }])], 10);

  it('extends the layer once to the rightmost selected frame', () => {
    // Arrange
    const h = setupKeyframes(short());
    h.selection.set([8, 9, 10].map((frame) => ({ rowId: 'a', frame })));

    // Act
    press(h, 'F5');

    // Assert
    expect(shape(h, 'a')).toEqual(['static 1-10']);
    expect(h.editor.document.settings.totalFrames).toBe(10);
  });

  it('inserts one frame per selected frame inside the span and extends once past the end', () => {
    // Arrange : images 4 à 8 sur une plage 1-5 (4 et 5 dans la plage, 6 à 8 après).
    const h = setupKeyframes(short());
    h.selection.set([4, 5, 6, 7, 8].map((frame) => ({ rowId: 'a', frame })));

    // Act
    press(h, 'F5');

    // Assert : prolongée jusqu'à 8, puis deux images insérées dans la plage.
    expect(shape(h, 'a')).toEqual(['static 1-10']);
    expect(h.editor.document.settings.totalFrames).toBe(10);
  });
});

describe('frames.keyframes refused moves', () => {
  it('announces a move refused because every selected keyframe is on a locked row', () => {
    // Arrange
    const h = setupKeyframes(data());
    h.selection.set([{ rowId: 'lock', frame: 1 }]);
    h.refused.length = 0;

    // Act
    const moved = h.keyframes.move(2);

    // Assert
    expect(moved).toBe(false);
    expect(h.refused).toHaveLength(1);
    expect(h.editor.toJSON()).toEqual(data());
  });
});
