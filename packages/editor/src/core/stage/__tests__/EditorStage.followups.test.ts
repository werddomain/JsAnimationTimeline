// packages/editor/src/core/stage/__tests__/EditorStage.followups.test.ts
/**
 * Tests des suivis de C7 : conteneur `<div>` de l'éditeur jamais animé ni
 * proposé (les autres enfants restent des cibles), `stage:report` limité aux
 * avertissements nouveaux (aucun pendant une série de commandes, aucun
 * doublon à `editor:ready`), document en attente chargé même si `onStageError`
 * lève, et œil des calques lu dans le dernier document accepté.
 */

import { createManualClock, StageDocumentError, StageReportCodes } from '@werddomain/timeline-runtime';
import type { IStageReport, ITimelineDocument } from '@werddomain/timeline-runtime';
import { deepFreeze } from '../../commands/__tests__/fixtures';
import { createCommand } from '../../commands/createCommand';
import { createEditor } from '../../editor/createEditor';
import { cleanBody, createContainer } from '../../editor/__tests__/fixtures';
import { createEditorHtmlStage } from '../editorHtmlStage';
import { DISPLAY_FRAME_MS, createFakeStage, createStageDocument, createStageEditor, deleteLayer, setTarget } from './fixtures';

afterEach(cleanBody);

/** Calque `{ selector: 'div' }` qui déplace x de 0 à 90. */
function divDocument(): ITimelineDocument {
  return deepFreeze<ITimelineDocument>({
    version: '2.0.0',
    settings: { fps: 10, totalFrames: 10 },
    layers: [{
      id: 'l-div', type: 'layer', name: 'Div', target: { selector: 'div' },
      spans: [{
        id: 's1', start: 1, end: 10, kind: 'tween', easing: 'linear',
        tracks: { x: [{ frame: 1, value: 0 }, { frame: 10, value: 90 }] }
      }]
    }]
  });
}

const touch = createCommand('Toucher', (doc) => ({ ...doc }), (doc) => ({ ...doc }));

describe('editor HTML stage: the editor container', () => {
  it('never animates a <div> container but animates its other children', () => {
    // Arrange
    const host = document.createElement('div');
    host.id = 'host';
    host.setAttribute('data-timeline-target', 'host');
    const scene = document.createElement('div');
    scene.id = 'scene';
    host.appendChild(scene);
    document.body.appendChild(host);
    const clock = createManualClock();
    const editor = createEditor(host, { data: divDocument(), defaultPlugins: false, clock });

    // Act
    editor.playback.seek(4);
    clock.advance(DISPLAY_FRAME_MS);
    const labels = editor.stage.listTargets().map((info) => info.label);

    // Assert
    expect(host.style.transform).toBe('');
    expect(editor.container.style.transform).toBe('');
    expect(scene.style.transform).toContain('translateX(30px)');
    expect(labels).toContain('scene');
    expect(labels).not.toContain('host');
  });

  it('describes and resolves nothing for a selector that only matches the editor', () => {
    // Arrange
    const host = document.createElement('div');
    host.id = 'only';
    document.body.appendChild(host);
    const stage = createEditorHtmlStage(host);

    // Act
    const described = stage.targets.describe?.({ selector: '#only' });

    // Assert
    expect(described).toBeUndefined();
    expect(stage.resolve({ selector: '#only' })).toBeNull();
    expect(stage.resolve({ selector: '[[' })).toBeNull();
    expect(stage.mode).toBe('frame');
  });
});

describe('stage:report only announces new warnings', () => {
  it('emits nothing for warnings that persist across commands, undo and redo', () => {
    // Arrange
    const { editor } = createStageEditor();
    editor.execute(setTarget('l-tree', { ref: 'tree', stage: 'nope' }, { ref: 'tree', stage: 'fake' }));
    const reports: IStageReport[] = [];
    editor.on('stage:report', (report) => reports.push(report));

    // Act
    for (let index = 0; index < 5; index += 1) editor.execute(touch);
    editor.undo();
    editor.redo();
    editor.execute(setTarget('l-hero', { ref: 'hero', stage: 'other' }, { ref: 'hero', stage: 'fake' }));

    // Assert
    expect(reports.map((report) => [report.code, report.layerId, report.stageId])).toEqual([
      [StageReportCodes.UNKNOWN_STAGE, 'l-hero', 'other']
    ]);
  });

  it('announces a warning again after it went away and came back', () => {
    // Arrange
    const { editor } = createStageEditor();
    const reports: IStageReport[] = [];
    editor.on('stage:report', (report) => reports.push(report));

    // Act
    editor.execute(setTarget('l-tree', { ref: 'tree', stage: 'nope' }, { ref: 'tree', stage: 'fake' }));
    editor.undo();
    editor.redo();

    // Assert
    expect(reports).toHaveLength(2);
  });

  it('replays the initial warnings once at editor:ready, even when a plugin edits during init', () => {
    // Arrange
    const received: string[] = [];
    const data = deepFreeze<ITimelineDocument>({
      ...createStageDocument(),
      layers: createStageDocument().layers.map((node) =>
        (node.id === 'l-hero' && node.type === 'layer' ? { ...node, target: { ref: 'hero', stage: 'nope' } } : node))
    });

    // Act
    createEditor(createContainer(), {
      data, defaultPlugins: false, clock: createManualClock(), stage: createFakeStage(),
      plugins: [{
        id: 'test.reports',
        dependencies: [],
        init: (ctx) => {
          ctx.events.on('stage:report', (report: IStageReport) => received.push(`${report.code}:${report.layerId ?? ''}`));
          ctx.commands.execute(touch);
        },
        destroy: () => undefined
      }]
    });

    // Assert
    expect(received).toEqual([`${StageReportCodes.UNKNOWN_STAGE}:l-hero`]);
  });
});

describe('stage:targetsChanged', () => {
  it('announces missing targets when they change, not on unrelated commands', () => {
    // Arrange
    const stage = createFakeStage({ missing: ['tree'] });
    const { editor } = createStageEditor({}, stage);
    const announced: (readonly string[])[] = [];
    editor.on('stage:targetsChanged', ({ missingTargets }) => announced.push(missingTargets));

    // Act
    editor.execute(touch);
    stage.objects.set('tree', { name: 'tree' });
    editor.refreshTargets();
    editor.execute(setTarget('l-hero', { ref: 'hero', stage: 'nope' }, { ref: 'hero', stage: 'fake' }));

    // Assert
    expect(announced).toEqual([[], ['l-hero']]);
  });

  it('announces after a stage signals new targets through subscribe', async () => {
    // Arrange
    const stage = createFakeStage({ missing: ['tree'] });
    const { editor } = createStageEditor({}, stage);
    const announced: (readonly string[])[] = [];
    editor.on('stage:targetsChanged', ({ missingTargets }) => announced.push(missingTargets));

    // Act
    stage.objects.set('tree', { name: 'tree' });
    stage.notifyTargets();
    await Promise.resolve();

    // Assert
    expect(announced).toEqual([[]]);
  });
});

describe('stage loads: ordering and visibility', () => {
  it('loads a queued document even when onStageError throws', () => {
    // Arrange
    const isRefused = (doc: ITimelineDocument): boolean => doc.layers.length === 2 && doc.layers[1]?.name === 'refusé';
    const stage = createFakeStage({ updateError: (doc) => (isRefused(doc) ? new StageDocumentError('non') : undefined) });
    const busErrors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const throwing = (): void => {
      throw new Error('gestionnaire');
    };
    const { editor } = createStageEditor({ onStageError: throwing }, stage);
    const update = stage.update?.bind(stage);
    let queued = false;
    stage.update = (doc, layers) => {
      if (!queued && isRefused(doc)) {
        queued = true;
        editor.execute(deleteLayer('l-tree', doc));
      }
      update?.(doc, layers);
    };
    const rename = createCommand(
      'Refusé',
      (doc) => ({ ...doc, layers: [doc.layers[0], { ...doc.layers[1], name: 'refusé' }] }),
      (doc) => doc
    );
    stage.log.length = 0;

    try {
      // Act
      editor.execute(rename);

      // Assert
      expect(editor.document.layers).toHaveLength(1);
      expect(stage.log).toContain('update:l-hero');
    } finally {
      busErrors.mockRestore();
    }
  });

  it('reads the layer eye from the last document the stages accepted', () => {
    // Arrange
    const stage = createFakeStage({
      updateError: (doc) => (doc.layers[0]?.visible === false ? new StageDocumentError('non') : undefined)
    });
    const { editor, clock } = createStageEditor({ onStageError: () => undefined }, stage);
    const hide = createCommand(
      'Masquer',
      (doc) => ({ ...doc, layers: [{ ...doc.layers[0], visible: false }, doc.layers[1]] }),
      (doc) => doc
    );

    // Act
    editor.execute(hide);
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(editor.document.layers[0]?.visible).toBe(false);
    expect(stage.lastStates.find((state) => state.layerId === 'l-hero')?.editorVisible).toBe(true);
  });
});

describe('C7 follow-ups, integrator review', () => {
  it('emits one stage:report for a throwing render, not one per command', () => {
    // Arrange
    const stage = createFakeStage();
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    stage.render = () => {
      throw new Error('rendu');
    };
    const { editor, clock } = createStageEditor({}, stage);
    const reports: IStageReport[] = [];
    editor.on('stage:report', (report) => reports.push(report));

    try {
      // Act
      clock.advance(DISPLAY_FRAME_MS);
      for (let index = 0; index < 10; index += 1) {
        editor.execute(touch);
        clock.advance(DISPLAY_FRAME_MS);
      }

      // Assert
      expect(reports.map((report) => report.code)).toEqual([StageReportCodes.STAGE_ERROR]);
    } finally {
      errors.mockRestore();
    }
  });

  it('never resolves nor lists an ancestor of the editor container', () => {
    // Arrange
    const app = document.createElement('div');
    app.id = 'app';
    const host = document.createElement('div');
    host.id = 'timeline';
    const box = document.createElement('div');
    box.className = 'box';
    app.append(host, box);
    document.body.appendChild(app);
    const stage = createEditorHtmlStage(host);

    // Act
    const resolved = stage.resolve({ selector: 'div' });
    const labels = stage.targets.list().map((info) => info.label);

    // Assert
    expect(resolved).toBe(box);
    expect(labels).not.toContain('app');
    expect(labels).not.toContain('timeline');
    expect(stage.targets.describe?.({ selector: '#app' })).toBeUndefined();
  });

  it('announces targetsChanged once per change through the StageHost hook, without a second subscription', () => {
    // Arrange
    const stage = createFakeStage({ missing: ['tree'] });
    let subscriptions = 0;
    const targets = stage.targets as { subscribe: (onChange: () => void) => () => void };
    const subscribe = targets.subscribe;
    targets.subscribe = (onChange) => {
      subscriptions += 1;
      return subscribe(onChange);
    };
    const { editor } = createStageEditor({}, stage);
    const announced: (readonly string[])[] = [];
    editor.on('stage:targetsChanged', ({ missingTargets }) => announced.push(missingTargets));

    // Act
    stage.objects.set('tree', { name: 'tree' });
    stage.notifyTargets();

    // Assert
    expect(subscriptions).toBe(1);
    expect(announced).toEqual([[]]);
  });

  it('gives every targetsChanged listener the same list when one of them refreshes targets', () => {
    // Arrange
    const stage = createFakeStage({ missing: ['tree', 'hero'] });
    const { editor } = createStageEditor({}, stage);
    const seen: string[] = [];
    editor.on('stage:targetsChanged', ({ missingTargets }) => {
      seen.push(`a:${missingTargets.join(',')}`);
      if (missingTargets.includes('l-hero')) {
        stage.objects.set('hero', { name: 'hero' });
        editor.refreshTargets();
      }
    });
    editor.on('stage:targetsChanged', ({ missingTargets }) => seen.push(`b:${missingTargets.join(',')}`));

    // Act
    stage.objects.set('tree', { name: 'tree' });
    editor.refreshTargets('l-tree');

    // Assert
    expect(seen).toEqual(['a:l-hero', 'b:l-hero', 'a:', 'b:']);
  });

  it('still releases and detaches when a stage unsubscribe throws during destroy', () => {
    // Arrange
    const stage = createFakeStage();
    const targets = stage.targets as { subscribe: (onChange: () => void) => () => void };
    targets.subscribe = () => () => {
      throw new Error('désabonnement');
    };
    const { editor } = createStageEditor({ onStageError: () => undefined }, stage);
    stage.log.length = 0;

    // Act
    editor.destroy();

    // Assert
    expect(stage.log).toEqual(['release:l-hero:hero', 'release:l-tree:tree', 'detach']);
    expect(editor.isDestroyed).toBe(true);
  });
});
