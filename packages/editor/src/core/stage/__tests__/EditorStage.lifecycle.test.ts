// packages/editor/src/core/stage/__tests__/EditorStage.lifecycle.test.ts
/**
 * Tests du cycle de vie des scènes dans l'éditeur, avec une fausse scène qui
 * consigne ses appels : chargement initial, rendu regroupé (`sync` puis
 * `render` une fois par image d'affichage), changement de cible annulé puis
 * rétabli, suppression d'un calque annulée, `refreshTargets`, et destruction
 * (chaque calque relâché, puis la scène détachée, objets intacts).
 */

import { cleanBody } from '../../editor/__tests__/fixtures';
import {
  DISPLAY_FRAME_MS,
  createFakeStage,
  createStageDocument,
  createStageEditor,
  deleteLayer,
  setTarget
} from './fixtures';

afterEach(cleanBody);

describe('editor stage: loading and rendering', () => {
  it('attaches, resolves and updates the stage when the editor is created, then renders on the first frame', () => {
    // Arrange
    const { stage, clock } = createStageEditor();
    const atCreation = stage.log.slice();

    // Act
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(atCreation).toEqual(['attach', 'resolve:hero', 'resolve:tree', 'update:l-hero,l-tree']);
    expect(stage.log.slice(atCreation.length)).toEqual(['sync:1:pause', 'render:1']);
  });

  it('merges several seeks into one sync and one render per display frame, with the evaluated values', () => {
    // Arrange
    const { editor, stage, clock } = createStageEditor();
    clock.advance(DISPLAY_FRAME_MS);
    stage.log.length = 0;

    // Act
    editor.playback.seek(2);
    editor.playback.seek(3);
    editor.playback.seek(4);
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(stage.log).toEqual(['sync:4:pause', 'render:4']);
    expect(stage.lastStates.map((state) => ({ id: state.layerId, values: state.values, active: state.active }))).toEqual([
      { id: 'l-hero', values: { x: 30 }, active: true },
      { id: 'l-tree', values: { y: 5 }, active: true }
    ]);
    expect(stage.lastStates[0]?.object).toBe(stage.objects.get('hero'));
  });

  it('renders every playback frame and syncs only when the play state changes', () => {
    // Arrange
    const { editor, stage, clock } = createStageEditor();
    clock.advance(DISPLAY_FRAME_MS);
    stage.log.length = 0;

    // Act
    editor.playback.play();
    clock.advance(100);
    clock.advance(100);
    editor.playback.pause();
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(stage.log).toEqual(['sync:2:play', 'render:2', 'render:3', 'sync:3:pause', 'render:3']);
  });

  it('renders after a command that changes values, without resolving again', () => {
    // Arrange
    const { editor, stage, clock } = createStageEditor();
    clock.advance(DISPLAY_FRAME_MS);
    stage.log.length = 0;

    // Act
    editor.load(createStageDocument());
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(stage.log).toEqual(['update:l-hero,l-tree', 'render:1', 'sync:1:pause', 'render:1']);
  });
});

describe('editor stage: commands, undo and redo', () => {
  it('releases the old object and resolves the new one when a target changes, back and forth with undo and redo', () => {
    // Arrange
    const { editor, stage } = createStageEditor();
    stage.log.length = 0;
    const command = setTarget('l-hero', { ref: 'sun', stage: 'fake' }, { ref: 'hero', stage: 'fake' });

    // Act
    editor.execute(command);
    const afterExecute = stage.log.splice(0);
    editor.undo();
    const afterUndo = stage.log.splice(0);
    editor.redo();

    // Assert
    expect(afterExecute).toEqual(['release:l-hero:hero', 'resolve:sun', 'update:l-hero,l-tree', 'render:1']);
    expect(afterUndo).toEqual(['release:l-hero:sun', 'resolve:hero', 'update:l-hero,l-tree', 'render:1']);
    expect(stage.log).toEqual(['release:l-hero:hero', 'resolve:sun', 'update:l-hero,l-tree', 'render:1']);
  });

  it('releases a deleted layer and resolves it again on undo', () => {
    // Arrange
    const { editor, stage } = createStageEditor();
    stage.log.length = 0;

    // Act
    editor.execute(deleteLayer('l-tree', editor.document));
    const afterDelete = stage.log.splice(0);
    editor.undo();

    // Assert
    expect(afterDelete).toEqual(['release:l-tree:tree', 'update:l-hero', 'render:1']);
    expect(stage.log).toEqual(['resolve:tree', 'update:l-hero,l-tree', 'render:1']);
    expect(editor.stage.missingTargets).toEqual([]);
  });
});

describe('editor stage: targets', () => {
  it('retries a failed resolution on editor.refreshTargets and on targets.subscribe', () => {
    // Arrange
    const stage = createFakeStage({ missing: ['tree', 'hero'] });
    const { editor } = createStageEditor({}, stage);
    const missingAtStart = editor.stage.missingTargets;

    // Act
    stage.objects.set('tree', { name: 'tree' });
    editor.refreshTargets('l-tree');
    const afterRefresh = editor.stage.missingTargets;
    stage.objects.set('hero', { name: 'hero' });
    stage.notifyTargets();

    // Assert
    expect(missingAtStart).toEqual(['l-hero', 'l-tree']);
    expect(afterRefresh).toEqual(['l-hero']);
    expect(editor.stage.missingTargets).toEqual([]);
  });

  it('lists and describes the targets of every stage', () => {
    // Arrange
    const { editor } = createStageEditor();

    // Act
    const listed = editor.stage.listTargets();
    const described = editor.stage.describe({ ref: 'tree', stage: 'fake' });

    // Assert
    expect(listed.map((info) => info.label)).toEqual(['HERO', 'TREE', 'SUN']);
    expect(described?.label).toBe('TREE');
    expect(editor.stage.describe({ ref: 'tree', stage: 'nope' })).toBeUndefined();
    expect(editor.stage.stages.map((s) => s.id)).toEqual(['fake']);
  });

  it('gives plugins the same stage facade', () => {
    // Arrange
    let pluginStage: unknown;
    const { editor } = createStageEditor({
      plugins: [{ id: 'test.stage', dependencies: [], init: (ctx) => void (pluginStage = ctx.stage), destroy: () => undefined }]
    });

    // Assert
    expect(pluginStage).toBe(editor.stage);
  });
});

describe('editor stage: destroy', () => {
  it('releases every layer then detaches the stage, without touching its objects', () => {
    // Arrange
    const { editor, stage, clock } = createStageEditor();
    const hero = stage.objects.get('hero');
    stage.log.length = 0;

    // Act
    editor.destroy();
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(stage.log).toEqual(['release:l-hero:hero', 'release:l-tree:tree', 'detach']);
    expect(stage.objects.get('hero')).toBe(hero);
    expect(() => editor.refreshTargets()).toThrow(/détruit/);
  });

  it('refuses stage.refreshTargets from a plugin after destroy but keeps reads', () => {
    // Arrange
    const { editor } = createStageEditor();
    const facade = editor.stage;

    // Act
    editor.destroy();

    // Assert
    expect(() => facade.refreshTargets()).toThrow(/détruit/);
    expect(facade.missingTargets).toEqual([]);
  });
});
