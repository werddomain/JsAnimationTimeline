// packages/editor/src/core/stage/__tests__/EditorStage.reentrancy.test.ts
/**
 * Tests des cas limites des scènes dans l'éditeur : commande exécutée par une
 * scène pendant un chargement (document chargé juste après), avertissements
 * du document initial émis de nouveau pour les plugins avant `editor:ready`,
 * éditeur détruit depuis `update`, `load` refusé par une scène, et scène
 * relâchée quand un plugin échoue au démarrage.
 */

import { createManualClock, StageDocumentError, StageReportCodes } from '@werddomain/timeline-runtime';
import type { IStageReport } from '@werddomain/timeline-runtime';
import type { IEditor } from '../../editor/types';
import { createEditor } from '../../editor/createEditor';
import { catchError, cleanBody, createContainer } from '../../editor/__tests__/fixtures';
import { createFakeStage, createStageDocument, createStageEditor, deleteLayer, setTarget } from './fixtures';

afterEach(cleanBody);

describe('editor stage: edge cases', () => {
  it('loads a document announced while the stage loads another one right after it', () => {
    // Arrange
    const stage = createFakeStage();
    const { editor } = createStageEditor({}, stage);
    const update = stage.update?.bind(stage);
    let fired = false;
    stage.update = (doc, layers) => {
      update?.(doc, layers);
      if (!fired && layers.length === 2 && doc.layers[0]?.type === 'layer' && 'target' in doc.layers[0]) {
        const target = doc.layers[0].target;
        if (target !== undefined && 'ref' in target && target.ref === 'sun') {
          fired = true;
          editor.execute(deleteLayer('l-tree', doc));
        }
      }
    };
    stage.log.length = 0;

    // Act
    editor.execute(setTarget('l-hero', { ref: 'sun', stage: 'fake' }, { ref: 'hero', stage: 'fake' }));

    // Assert
    expect(editor.document.layers).toHaveLength(1);
    expect(stage.log).toEqual(['release:l-hero:hero', 'resolve:sun', 'update:l-hero,l-tree', 'release:l-tree:tree', 'update:l-hero']);
  });

  it('re-emits initial unrouted warnings to plugins before their editor:ready handler', () => {
    // Arrange
    const order: string[] = [];
    const data = { ...createStageDocument(), layers: [{ ...createStageDocument().layers[0], target: { ref: 'hero', stage: 'nope' } }] };

    // Act
    createEditor(createContainer(), {
      data, defaultPlugins: false, clock: createManualClock(), stage: createFakeStage(),
      plugins: [{
        id: 'test.reports',
        dependencies: [],
        init: (ctx) => {
          ctx.events.on('stage:report', (report: IStageReport) => order.push(`report:${report.code}`));
          ctx.events.on('editor:ready', () => order.push('ready'));
        },
        destroy: () => undefined
      }]
    });

    // Assert
    expect(order).toEqual([`report:${StageReportCodes.UNKNOWN_STAGE}`, 'ready']);
  });

  it('stops cleanly when a stage destroys the editor from update', () => {
    // Arrange
    const stage = createFakeStage();
    let editorRef: IEditor | undefined;
    const update = stage.update?.bind(stage);
    stage.update = (doc, layers) => {
      update?.(doc, layers);
      if (layers.length === 1) editorRef?.destroy();
    };
    const { editor } = createStageEditor({}, stage);
    editorRef = editor;

    // Act
    editor.execute(deleteLayer('l-tree', editor.document));

    // Assert
    expect(editor.isDestroyed).toBe(true);
    expect(stage.log.slice(-2)).toEqual(['release:l-hero:hero', 'detach']);
  });

  it('sends a loaded document refused by a stage to onStageError', () => {
    // Arrange
    const errors: unknown[] = [];
    const stage = createFakeStage({ updateError: (doc) => (doc.settings.totalFrames === 20 ? new StageDocumentError('non') : undefined) });
    const { editor } = createStageEditor({ onStageError: (error) => errors.push(error) }, stage);

    // Act
    editor.load({ ...createStageDocument(), settings: { fps: 10, totalFrames: 20 } });

    // Assert
    expect(errors).toEqual([expect.any(StageDocumentError)]);
    expect(editor.document.settings.totalFrames).toBe(20);
  });

  it('releases and detaches the stage when a plugin fails to start', () => {
    // Arrange
    const container = createContainer();
    const stage = createFakeStage();

    // Act
    const error = catchError(() => createEditor(container, {
      data: createStageDocument(), defaultPlugins: false, clock: createManualClock(), stage,
      plugins: [{ id: 'test.broken', dependencies: [], init: () => { throw new Error('init'); }, destroy: () => undefined }]
    }));

    // Assert
    expect(error).toBeInstanceOf(Error);
    expect(container.childElementCount).toBe(0);
    expect(stage.log.slice(-3)).toEqual(['release:l-hero:hero', 'release:l-tree:tree', 'detach']);
  });
});
