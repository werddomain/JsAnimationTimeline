// packages/editor/src/plugins/toolbar/timeSettings/__tests__/timeSettingsCommands.test.ts
/**
 * Tests des commandes de cadence et de durée : application, annulation et
 * rétablissement, refus des valeurs hors limites et d'une durée plus courte
 * que la fin d'une plage (dossiers compris), valeur inchangée sans entrée
 * d'historique.
 */

import type { ITimelineDocument, LayerNode } from '@kazo-ca/timeline-runtime';
import { createEditor } from '../../../../core/editor/createEditor';
import type { IEditor } from '../../../../core/editor/types';
import { createDoc, layer } from '../../../../model/spans/__tests__/fixtures';
import {
  createSetFpsCommand,
  createSetTotalFramesCommand,
  lastUsedFrame,
  MAX_TOTAL_FRAMES,
  maxTotalFrames,
  TimeSettingsLabels,
  totalFramesError
} from '../timeSettingsCommands';

afterEach(() => {
  document.body.innerHTML = '';
});

/** Document de 60 images : « Héros » jusqu'à 40, « Ombre » (dans un dossier) jusqu'à 48. */
function spanDoc(): ITimelineDocument {
  const nested: LayerNode = {
    id: 'f1',
    type: 'folder',
    name: 'Décor',
    children: [layer('l2', [{ id: 's2', start: 1, end: 48, kind: 'blank' }], { name: 'Ombre' })]
  };
  return createDoc([layer('l1', [{ id: 's1', start: 1, end: 40, kind: 'blank' }], { name: 'Héros' }), nested], 60);
}

function mount(data?: ITimelineDocument): { editor: IEditor; refusals: string[] } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const editor = createEditor(container, { defaultPlugins: false, ...(data === undefined ? {} : { data }) });
  const refusals: string[] = [];
  editor.on('command:refused', (event) => refusals.push(event.reason));
  return { editor, refusals };
}

describe('createSetFpsCommand', () => {
  it('sets the fps, then undo and redo restore each value', () => {
    // Arrange
    const { editor } = mount();

    // Act
    const changed = editor.execute(createSetFpsCommand(30));

    // Assert
    expect(changed).toBe(true);
    expect(editor.document.settings.fps).toBe(30);
    editor.undo();
    expect(editor.document.settings.fps).toBe(24);
    editor.redo();
    expect(editor.document.settings.fps).toBe(30);
  });

  it.each([0, 241, 23.5, Number.NaN])('refuses %p with a clear French message', (fps) => {
    // Arrange
    const { editor, refusals } = mount();

    // Act
    const changed = editor.execute(createSetFpsCommand(fps));

    // Assert
    expect(changed).toBe(false);
    expect(editor.document.settings.fps).toBe(24);
    expect(editor.canUndo).toBe(false);
    expect(refusals).toEqual(['La cadence doit être un nombre entier de 1 à 240 images par seconde.']);
  });

  it('accepts the limits 1 and 240', () => {
    // Arrange
    const { editor } = mount();

    // Act + Assert
    expect(editor.execute(createSetFpsCommand(1))).toBe(true);
    expect(editor.execute(createSetFpsCommand(240))).toBe(true);
    expect(editor.document.settings.fps).toBe(240);
  });

  it('adds no history entry when the value does not change', () => {
    // Arrange
    const { editor } = mount();

    // Act
    const changed = editor.execute(createSetFpsCommand(24));

    // Assert
    expect(changed).toBe(false);
    expect(editor.canUndo).toBe(false);
  });

  it('is labelled for the history', () => {
    // Assert
    expect(createSetFpsCommand(30).label).toBe(TimeSettingsLabels.SET_FPS);
    expect(createSetTotalFramesCommand(30).label).toBe(TimeSettingsLabels.SET_TOTAL_FRAMES);
  });
});

describe('createSetTotalFramesCommand', () => {
  it('lengthens and shortens the timeline, with undo and redo', () => {
    // Arrange
    const { editor } = mount(spanDoc());

    // Act
    editor.execute(createSetTotalFramesCommand(120));
    editor.execute(createSetTotalFramesCommand(48));

    // Assert
    expect(editor.document.settings.totalFrames).toBe(48);
    editor.undo();
    expect(editor.document.settings.totalFrames).toBe(120);
    editor.undo();
    expect(editor.document.settings.totalFrames).toBe(60);
    editor.redo();
    expect(editor.document.settings.totalFrames).toBe(120);
  });

  it.each([0, -5, 12.5, 100_001, 1e21])('refuses %p with a clear French message', (totalFrames) => {
    // Arrange
    const { editor, refusals } = mount();

    // Act
    editor.execute(createSetTotalFramesCommand(totalFrames));

    // Assert
    expect(editor.document.settings.totalFrames).toBe(60);
    expect(refusals).toEqual(['La durée doit être un nombre entier de 1 à 100 000 images.']);
  });

  it('refuses to end before the last span, naming its layer even inside a folder', () => {
    // Arrange
    const { editor, refusals } = mount(spanDoc());

    // Act
    const changed = editor.execute(createSetTotalFramesCommand(47));

    // Assert
    expect(changed).toBe(false);
    expect(editor.document.settings.totalFrames).toBe(60);
    expect(refusals).toEqual([
      "La durée ne peut pas être inférieure à 48 images : une plage du calque « Ombre » se termine à l'image 48."
    ]);
  });

  it('checks again on redo after the spans changed', () => {
    // Arrange
    const shorter = createDoc([layer('l1', [{ id: 's1', start: 1, end: 10, kind: 'blank' }])], 60);
    const command = createSetTotalFramesCommand(20);

    // Act + Assert
    const reduced = command.do(shorter);
    expect(reduced.settings.totalFrames).toBe(20);
    expect(command.undo(reduced).settings.totalFrames).toBe(60);
    expect(() => command.do(spanDoc())).toThrow('se termine');
  });
});

describe('MAX_TOTAL_FRAMES', () => {
  it('accepts the maximum duration and nothing above it', () => {
    // Arrange
    const { editor } = mount();

    // Act + Assert
    expect(MAX_TOTAL_FRAMES).toBe(100_000);
    expect(editor.execute(createSetTotalFramesCommand(MAX_TOTAL_FRAMES))).toBe(true);
    expect(editor.execute(createSetTotalFramesCommand(MAX_TOTAL_FRAMES + 1))).toBe(false);
    expect(editor.document.settings.totalFrames).toBe(MAX_TOTAL_FRAMES);
  });
});

describe('lastUsedFrame', () => {
  it('returns undefined without any span, and the furthest span end otherwise', () => {
    // Assert
    expect(lastUsedFrame(createDoc([]))).toBeUndefined();
    expect(lastUsedFrame(spanDoc())).toEqual({ frame: 48, layerName: 'Ombre' });
    expect(totalFramesError(spanDoc(), 48)).toBeUndefined();
  });
});

describe('maxTotalFrames', () => {
  it('is MAX_TOTAL_FRAMES, or the document duration when it is longer', () => {
    // Assert
    expect(maxTotalFrames(createDoc([], 60))).toBe(MAX_TOTAL_FRAMES);
    expect(maxTotalFrames(createDoc([], 200_000))).toBe(200_000);
    expect(totalFramesError(createDoc([], 200_000), 150_000)).toBeUndefined();
    expect(totalFramesError(createDoc([], 200_000), 200_001)).toBe('La durée doit être un nombre entier de 1 à 200 000 images.');
  });
});
