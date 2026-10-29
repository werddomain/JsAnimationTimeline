// packages/editor/src/core/stage/__tests__/EditorStage.options.test.ts
/**
 * Tests de l'option `stage` de `createEditor()` : scène HTML par défaut en
 * mode `frame` qui n'anime ni ne propose jamais l'élément de l'éditeur,
 * `stage: false` (timeline seule), tableau de scènes combinées, propriétés
 * des scènes dans le registre, erreurs de création (root et stage ensemble,
 * ids en double, nom de propriété pris, document initial refusé),
 * `stage:report`, et document de commande refusé par une scène.
 */

import { createManualClock, HTML_STAGE_ID, StageDocumentError, StageReportCodes } from '@kazo-ca/timeline-runtime';
import type { IStageReport, ITimelineDocument } from '@kazo-ca/timeline-runtime';
import { deepFreeze } from '../../commands/__tests__/fixtures';
import { createEditor } from '../../editor/createEditor';
import { catchError, cleanBody, createContainer } from '../../editor/__tests__/fixtures';
import { DISPLAY_FRAME_MS, createFakeStage, createStageDocument, createStageEditor, deleteLayer, setTarget } from './fixtures';

afterEach(cleanBody);

/** Document d'un calque `{ selector: 'div' }` qui déplace x de 0 à 90. */
function divDocument(): ITimelineDocument {
  return deepFreeze<ITimelineDocument>({
    version: '2.0.0',
    settings: { fps: 10, totalFrames: 10 },
    layers: [{
      id: 'l-div', type: 'layer', name: 'Div', target: { selector: 'div' },
      spans: [{ id: 's1', start: 1, end: 10, kind: 'tween', easing: 'linear', tracks: { x: [{ frame: 1, value: 0 }, { frame: 10, value: 90 }] } }]
    }]
  });
}

describe('default HTML stage', () => {
  it('animates page elements with inline styles and never the editor element', () => {
    // Arrange
    const clock = createManualClock();
    const editor = createEditor(createContainer(), { data: divDocument(), defaultPlugins: false, clock });
    const box = document.createElement('div');
    box.id = 'box';
    document.body.appendChild(box);
    editor.refreshTargets();

    // Act
    editor.playback.seek(4);
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(editor.stage.stages.map((stage) => stage.id)).toEqual([HTML_STAGE_ID]);
    expect(box.style.transform).toContain('translateX(30px)');
    expect(editor.container.style.transform).toBe('');
    expect(editor.stage.missingTargets).toEqual([]);
  });

  it('does not offer elements of the editor as targets', () => {
    // Arrange
    const editor = createEditor(createContainer(), { defaultPlugins: false, clock: createManualClock() });
    const inside = document.createElement('span');
    inside.id = 'inside';
    editor.container.appendChild(inside);
    const outside = document.createElement('span');
    outside.id = 'outside';
    document.body.appendChild(outside);

    // Act
    const labels = editor.stage.listTargets().map((info) => info.label);

    // Assert
    expect(labels).toContain('outside');
    expect(labels).not.toContain('inside');
  });

  it('uses options.root as the HTML root', () => {
    // Arrange
    const root = document.createElement('main');
    const inRoot = document.createElement('div');
    root.appendChild(inRoot);
    const outOfRoot = document.createElement('div');
    document.body.append(outOfRoot, root);
    const clock = createManualClock();
    const editor = createEditor(createContainer(), { data: divDocument(), defaultPlugins: false, clock, root });

    // Act
    editor.playback.seek(10);
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(inRoot.style.transform).toContain('translateX(90px)');
    expect(outOfRoot.style.transform).toBe('');
  });

  it('gives the original styles back on destroy', () => {
    // Arrange
    const box = document.createElement('div');
    box.style.transform = 'scale(2)';
    document.body.appendChild(box);
    const clock = createManualClock();
    const editor = createEditor(createContainer(), { data: divDocument(), defaultPlugins: false, clock });
    editor.playback.seek(5);
    clock.advance(DISPLAY_FRAME_MS);
    const animated = box.style.transform;

    // Act
    editor.destroy();

    // Assert
    expect(animated).toContain('translateX');
    expect(box.style.transform).toBe('scale(2)');
  });
});

describe('stage option', () => {
  it('runs the timeline alone with stage: false', () => {
    // Arrange
    const clock = createManualClock();
    const frames: number[] = [];
    const editor = createEditor(createContainer(), { data: createStageDocument(), defaultPlugins: false, clock, stage: false });
    editor.onFrame((sample) => frames.push(sample.layer('l-hero')?.values.x ?? -1));

    // Act
    editor.playback.seek(4);
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(editor.stage.stages).toEqual([]);
    // Timeline seule : rien n'est routé, donc ni cible manquante ni avertissement.
    expect(editor.stage.missingTargets).toEqual([]);
    expect(editor.stage.warnings).toEqual([]);
    expect(frames).toEqual([30]);
  });

  it('routes the layers of an array of stages by target.stage', () => {
    // Arrange
    const canvas = createFakeStage({ id: 'canvas' });
    const audio = createFakeStage({ id: 'audio' });
    const data = deepFreeze<ITimelineDocument>({
      ...createStageDocument('canvas'),
      layers: [
        createStageDocument('canvas').layers[0],
        { ...createStageDocument('audio').layers[1] }
      ]
    });

    // Act
    const editor = createEditor(createContainer(), { data, defaultPlugins: false, clock: createManualClock(), stage: [canvas, audio] });

    // Assert
    expect(editor.stage.stages.map((stage) => stage.id)).toEqual(['canvas', 'audio']);
    expect(canvas.log).toContain('update:l-hero');
    expect(audio.log).toContain('update:l-tree');
  });

  it('adds the stage properties to the frozen editor registry', () => {
    // Arrange
    const stage = createFakeStage({ properties: [{ name: 'volume', kind: 'value', unit: '', defaultValue: 1 }] });

    // Act
    const { editor } = createStageEditor({}, stage);

    // Assert
    expect(editor.registry.has('volume')).toBe(true);
    expect(() => editor.registry.register({ name: 'pan', kind: 'value', unit: '', defaultValue: 0 })).toThrow(/figé/);
  });

  it('refuses root and stage together, duplicate stage ids and a taken property name, leaving the container empty', () => {
    // Arrange
    const container = createContainer();
    const clock = createManualClock();
    const create = (options: Parameters<typeof createEditor>[1]) => (): unknown =>
      createEditor(container, { defaultPlugins: false, clock, ...options });

    // Assert
    expect(create({ root: document, stage: createFakeStage() })).toThrow(/root.*stage/);
    expect(create({ stage: [] })).toThrow(/au moins une scène/);
    expect(create({ stage: [createFakeStage(), createFakeStage()] })).toThrow(/fake/);
    expect(create({ stage: createFakeStage({ properties: [{ name: 'x', kind: 'value', unit: '', defaultValue: 0 }] }) })).toThrow(/"x"/);
    expect(container.childElementCount).toBe(0);
  });

  it('fails creation cleanly when a stage refuses the initial document', () => {
    // Arrange
    const container = createContainer();
    const stage = createFakeStage({ updateError: () => new StageDocumentError('non') });

    // Act
    const error = catchError(() => createEditor(container, {
      data: createStageDocument(), defaultPlugins: false, clock: createManualClock(), stage
    }));

    // Assert
    expect(error).toBeInstanceOf(StageDocumentError);
    expect(container.childElementCount).toBe(0);
    expect(stage.log.slice(-3)).toEqual(['release:l-hero:hero', 'release:l-tree:tree', 'detach']);
  });
});

describe('stage reports and refused documents', () => {
  it('emits stage:report for each new warning and keeps them in stage.warnings', () => {
    // Arrange
    const { editor } = createStageEditor();
    const reports: IStageReport[] = [];
    editor.on('stage:report', (report) => reports.push(report));

    // Act
    editor.execute(setTarget('l-tree', { ref: 'tree', stage: 'nope' }, { ref: 'tree', stage: 'fake' }));

    // Assert
    expect(reports.map((report) => [report.code, report.layerId])).toEqual([[StageReportCodes.UNKNOWN_STAGE, 'l-tree']]);
    expect(editor.stage.warnings).toEqual(reports);
    expect(editor.stage.missingTargets).toEqual(['l-tree']);
  });

  it('sends a command document refused by a stage to onStageError and keeps the stage on the previous one', () => {
    // Arrange
    const errors: unknown[] = [];
    const stage = createFakeStage({ updateError: (doc) => (doc.layers.length === 1 ? new StageDocumentError('refusé') : undefined) });
    const { editor } = createStageEditor({ onStageError: (error) => errors.push(error) }, stage);
    stage.log.length = 0;

    // Act
    editor.execute(deleteLayer('l-tree', editor.document));

    // Assert
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(StageDocumentError);
    expect(editor.document.layers).toHaveLength(1);
    expect(stage.log).toEqual(['release:l-tree:tree', 'update:l-hero', 'resolve:tree', 'update:l-hero,l-tree', 'sync:1:pause', 'render:1']);
  });

  it('writes stage errors with console.error by default and keeps rendering', () => {
    // Arrange
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const stage = createFakeStage();
    const { clock, editor } = createStageEditor({}, stage);
    const render = stage.render;
    stage.render = () => {
      throw new Error('boum');
    };

    try {
      // Act
      clock.advance(DISPLAY_FRAME_MS);
      stage.render = render;
      editor.playback.seek(3);
      clock.advance(DISPLAY_FRAME_MS);

      // Assert
      expect(error).toHaveBeenCalledWith(expect.stringContaining('scène'), expect.any(Error));
      expect(stage.log[stage.log.length - 1]).toBe('render:3');
    } finally {
      error.mockRestore();
    }
  });
});
