// packages/editor/src/core/stage/__tests__/EditorStage.hold.test.ts
/**
 * Tests de `ctx.stage.hold()` : retenue du rendu des scènes (glisser de la
 * tête de lecture sur une scène lente). Pendant une retenue, hors lecture,
 * les scènes ne reçoivent ni `sync` ni `render`, mais `playhead:changed`,
 * `frame:render` et les chargements de document continuent. `flush()` et le
 * dernier `release()` rattrapent une seule fois l'image courante. La lecture
 * passe outre les retenues, et l'arrêt de la lecture rend l'image d'arrêt.
 */

import { cleanBody } from '../../editor/__tests__/fixtures';
import type { IFakeStage } from './fixtures';
import type { IStageReport } from '@werddomain/timeline-runtime';
import { DISPLAY_FRAME_MS, createFakeStage, createStageEditor, deleteLayer, setTarget } from './fixtures';

afterEach(cleanBody);

/** Éditeur sur la fausse scène, après le premier rendu, journal vidé. */
function setup(): ReturnType<typeof createStageEditor> {
  const harness = createStageEditor();
  harness.clock.advance(DISPLAY_FRAME_MS);
  harness.stage.log.length = 0;
  return harness;
}

function renders(stage: IFakeStage): string[] {
  return stage.log.filter((entry) => entry.startsWith('render:') || entry.startsWith('sync:'));
}

describe('ctx.stage.hold: holding back stage renders', () => {
  it('skips stage sync and render while held, but keeps playhead:changed and frame:render', () => {
    // Arrange
    const { editor, stage, clock } = setup();
    const events: string[] = [];
    editor.on('playhead:changed', ({ frame }) => events.push(`playhead:${frame}`));
    editor.on('frame:render', ({ sample }) => events.push(`frame:${sample.time.integerFrame}`));
    const hold = editor.stage.hold();

    // Act
    editor.playback.seek(3);
    clock.advance(DISPLAY_FRAME_MS);
    editor.playback.seek(5);
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(hold.active).toBe(true);
    expect(renders(stage)).toEqual([]);
    expect(events).toEqual(['playhead:3', 'frame:3', 'playhead:5', 'frame:5']);
  });

  it('catches up once at the current frame on release, then renders normally', () => {
    // Arrange
    const { editor, stage, clock } = setup();
    const hold = editor.stage.hold();
    editor.playback.seek(4);
    clock.advance(DISPLAY_FRAME_MS);

    // Act
    hold.release();
    const atRelease = renders(stage);
    editor.playback.seek(6);
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(hold.active).toBe(false);
    expect(atRelease).toEqual(['sync:4:pause', 'render:4']);
    expect(renders(stage)).toEqual(['sync:4:pause', 'render:4', 'sync:6:pause', 'render:6']);
  });

  it('flushes the current frame once, and a second flush with nothing new does nothing', () => {
    // Arrange
    const { editor, stage, clock } = setup();
    const hold = editor.stage.hold();
    editor.playback.seek(2);
    clock.advance(DISPLAY_FRAME_MS);

    // Act
    hold.flush();
    hold.flush();

    // Assert
    expect(hold.active).toBe(true);
    expect(renders(stage)).toEqual(['sync:2:pause', 'render:2']);
  });

  it('does nothing on release or flush when nothing was skipped', () => {
    // Arrange
    const { editor, stage } = setup();
    const hold = editor.stage.hold();

    // Act
    hold.flush();
    hold.release();

    // Assert
    expect(renders(stage)).toEqual([]);
  });

  it('renders only when the last of several holds is released', () => {
    // Arrange
    const { editor, stage, clock } = setup();
    const first = editor.stage.hold();
    const second = editor.stage.hold();
    editor.playback.seek(7);
    clock.advance(DISPLAY_FRAME_MS);

    // Act
    first.release();
    const afterFirst = renders(stage).length;
    second.release();

    // Assert
    expect(afterFirst).toBe(0);
    expect(renders(stage)).toEqual(['sync:7:pause', 'render:7']);
  });

  it('makes release idempotent per hold, and flush after release a no-op', () => {
    // Arrange
    const { editor, stage, clock } = setup();
    const first = editor.stage.hold();
    const second = editor.stage.hold();
    editor.playback.seek(3);
    clock.advance(DISPLAY_FRAME_MS);

    // Act
    first.release();
    first.release();
    first.flush();

    // Assert
    expect(second.active).toBe(true);
    expect(renders(stage)).toEqual([]);
    second.release();
    expect(renders(stage)).toEqual(['sync:3:pause', 'render:3']);
  });
});

describe('ctx.stage.hold: documents', () => {
  it('still loads a document while held, skipping only its render', () => {
    // Arrange
    const { editor, stage } = setup();
    const original = editor.document;
    const hold = editor.stage.hold();
    const targetsChanged: string[][] = [];
    editor.on('stage:targetsChanged', ({ missingTargets }) => targetsChanged.push([...missingTargets]));

    // Act
    editor.execute(deleteLayer('l-hero', original));

    // Assert
    expect(stage.log.some((entry) => entry.startsWith('update:'))).toBe(true);
    expect(stage.log).toContain('release:l-hero:hero');
    expect(renders(stage)).toEqual([]);
    hold.release();
    expect(renders(stage)).toEqual(['render:1']);
    expect(targetsChanged).toEqual([]);
  });
});

describe('ctx.stage.hold: reports', () => {
  it('announces a warning at load time while held, and not again on release', () => {
    // Arrange
    const { editor, stage } = setup();
    const reports: IStageReport[] = [];
    const missing: string[][] = [];
    editor.on('stage:report', (report) => reports.push(report));
    editor.on('stage:targetsChanged', ({ missingTargets }) => missing.push([...missingTargets]));
    const hold = editor.stage.hold();

    // Act
    editor.execute(setTarget('l-tree', { ref: 'tree', stage: 'nope' }, { ref: 'tree', stage: 'fake' }));
    const atLoad = reports.length;
    hold.release();

    // Assert
    expect(atLoad).toBe(1);
    expect(reports).toHaveLength(1);
    expect(missing).toEqual([['l-tree']]);
    expect(renders(stage)).toEqual(['render:1']);
  });
});

describe('ctx.stage.hold: playback', () => {
  it('ignores holds while playing', () => {
    // Arrange
    const { editor, stage, clock } = setup();
    editor.stage.hold();

    // Act
    editor.playback.play();
    clock.advance(DISPLAY_FRAME_MS);
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(renders(stage).filter((entry) => entry.startsWith('render:')).length).toBeGreaterThanOrEqual(2);
    expect(renders(stage)[0]).toBe('sync:1:play');
  });

  it('leaves the stage on the stop frame when playback stops while a hold is open', () => {
    // Arrange
    const { editor, stage, clock } = setup();
    editor.stage.hold();
    editor.playback.play();
    clock.advance(DISPLAY_FRAME_MS);
    clock.advance(200);
    stage.log.length = 0;

    // Act
    editor.playback.pause();
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    const stopFrame = editor.playback.frame;
    expect(renders(stage)).toEqual([`sync:${stopFrame}:pause`, `render:${stopFrame}`]);
  });
});

describe('ctx.stage.hold: lifecycle', () => {
  it('drops every hold on destroy without a catch-up render', () => {
    // Arrange
    const { editor, stage, clock } = setup();
    const hold = editor.stage.hold();
    editor.playback.seek(5);
    clock.advance(DISPLAY_FRAME_MS);
    const stageFacade = editor.stage;
    stage.log.length = 0;

    // Act
    editor.destroy();
    hold.release();
    hold.flush();

    // Assert
    expect(renders(stage)).toEqual([]);
    expect(hold.active).toBe(false);
    const late = stageFacade.hold();
    expect(late.active).toBe(false);
    expect(() => late.release()).not.toThrow();
    expect(() => late.flush()).not.toThrow();
  });

  it('gives inert-but-valid holds with stage: false', () => {
    // Arrange
    const { editor } = createStageEditor({ stage: false }, createFakeStage());

    // Act
    const hold = editor.stage.hold();

    // Assert
    expect(() => hold.flush()).not.toThrow();
    hold.release();
    expect(hold.active).toBe(false);
  });
});

describe('ctx.stage.hold: review follow-ups', () => {
  it('does not render the stop frame twice when the hold is released after a stop', () => {
    // Arrange
    const { editor, stage, clock } = setup();
    const hold = editor.stage.hold();
    editor.playback.seek(3);
    clock.advance(DISPLAY_FRAME_MS);
    editor.playback.play();
    clock.advance(DISPLAY_FRAME_MS);
    editor.playback.pause();
    clock.advance(DISPLAY_FRAME_MS);
    const afterStop = stage.log.length;

    // Act
    hold.release();

    // Assert
    expect(stage.log.length).toBe(afterStop);
  });

  it('ignores a flush called during a load (from a stage:report handler) and keeps the render held', () => {
    // Arrange
    const { editor, stage } = setup();
    const hold = editor.stage.hold();
    editor.on('stage:report', () => hold.flush());

    // Act
    editor.execute(setTarget('l-tree', { ref: 'tree', stage: 'nope' }, { ref: 'tree', stage: 'fake' }));

    // Assert
    expect(renders(stage)).toEqual([]);
    expect(editor.stage.missingTargets).toEqual(['l-tree']);
    hold.release();
    expect(renders(stage)).toEqual(['render:1']);
  });

  it('renders a document loaded while held once the hold is released, even after a stop', () => {
    // Arrange
    const { editor, stage, clock } = setup();
    const hold = editor.stage.hold();
    editor.execute(deleteLayer('l-hero', editor.document));
    editor.playback.play();
    clock.advance(DISPLAY_FRAME_MS);
    editor.playback.pause();
    clock.advance(DISPLAY_FRAME_MS);
    stage.log.length = 0;

    // Act
    hold.release();

    // Assert
    expect(renders(stage)).toEqual([]);
    expect(stage.lastStates.map((state) => state.layerId)).toEqual(['l-tree']);
  });
});


describe('ctx.playback.now: the editor clock', () => {
  it('reads the clock given to createEditor, for pacing (not wall time)', () => {
    // Arrange
    const { editor, clock } = setup();
    const start = editor.playback.now();

    // Act
    clock.advance(250);

    // Assert
    expect(editor.playback.now()).toBe(start + 250);
    expect(editor.playback.now()).toBe(clock.now());
  });

  it('stays readable after destroy', () => {
    // Arrange
    const { editor } = setup();
    const playback = editor.playback;

    // Act
    editor.destroy();

    // Assert
    expect(() => playback.now()).not.toThrow();
  });
});
