// packages/editor/src/core/playback/__tests__/PlaybackController.test.ts
/**
 * Tests de la lecture de l'éditeur (par `createEditor()` sur horloge
 * manuelle) : premier rendu demandé à la création, déplacements et commandes
 * regroupés en un seul rendu par image d'affichage, ordre
 * `playhead:changed` puis `frame:render`, lecture image par image avec
 * l'image fractionnaire, boucle et fin, durée changée par une commande et par
 * son annulation, `load`, `onFrame`, et arrêt complet à la destruction.
 */

import { captureContext, cleanBody } from '../../editor/__tests__/fixtures';
import {
  DISPLAY_FRAME_MS,
  createAnimatedDocument,
  createPlaybackEditor,
  recordRenders,
  setTotalFrames,
  touchDocument
} from './fixtures';

afterEach(cleanBody);

describe('editor playback: grouped rendering', () => {
  it('requests the first render when the editor is created', () => {
    // Arrange
    const { editor, clock } = createPlaybackEditor();
    const log = recordRenders(editor);

    // Act
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(log.renders).toHaveLength(1);
    expect(log.renders[0]?.time.integerFrame).toBe(1);
    expect(log.playheads).toEqual([]);
  });

  it('renders nothing on a display frame when nothing changed', () => {
    // Arrange
    const { editor, clock } = createPlaybackEditor();
    clock.advance(DISPLAY_FRAME_MS);
    const log = recordRenders(editor);

    // Act
    clock.advance(DISPLAY_FRAME_MS);
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(log.renders).toHaveLength(0);
    expect(clock.pendingFrames).toBe(0);
  });

  it('merges several seeks and commands into one evaluation per display frame', () => {
    // Arrange
    const { editor, clock } = createPlaybackEditor();
    clock.advance(DISPLAY_FRAME_MS);
    const log = recordRenders(editor);

    // Act
    editor.playback.seek(3);
    editor.execute(touchDocument('a'));
    editor.playback.seek(6);
    editor.execute(touchDocument('b'));
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(log.playheads).toEqual([{ frame: 6, previous: 1 }]);
    expect(log.renders).toHaveLength(1);
    expect(log.renders[0]?.time.integerFrame).toBe(6);
    expect(log.renders[0]?.layer('hero')?.values).toEqual({ x: 50 });
  });

  it('updates frame and time at once while the render waits for the display frame', () => {
    // Arrange
    const { editor, clock } = createPlaybackEditor();
    const log = recordRenders(editor);

    // Act
    editor.playback.seek(4);

    // Assert
    expect(editor.playback.frame).toBe(4);
    expect(editor.playback.time).toEqual({ timeMs: 300, frame: 4, integerFrame: 4 });
    expect(log.renders).toHaveLength(0);
    clock.advance(DISPLAY_FRAME_MS);
    expect(log.renders).toHaveLength(1);
  });

  it('emits playhead:changed before frame:render', () => {
    // Arrange
    const { editor, clock } = createPlaybackEditor();
    clock.advance(DISPLAY_FRAME_MS);
    const order: string[] = [];
    editor.on('playhead:changed', () => order.push('playhead'));
    editor.on('frame:render', () => order.push('render'));

    // Act
    editor.playback.seek(2);
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(order).toEqual(['playhead', 'render']);
  });

  it('re-renders after undo and redo of a command', () => {
    // Arrange
    const { editor, clock } = createPlaybackEditor();
    editor.execute(touchDocument('a'));
    clock.advance(DISPLAY_FRAME_MS);
    const log = recordRenders(editor);

    // Act
    editor.undo();
    clock.advance(DISPLAY_FRAME_MS);
    editor.redo();
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(log.renders).toHaveLength(2);
  });

  it('keeps the frame when the duration changes, clamps it, and restores it on undo', () => {
    // Arrange
    const { editor, clock } = createPlaybackEditor();
    editor.playback.seek(15);
    clock.advance(DISPLAY_FRAME_MS);
    const log = recordRenders(editor);

    // Act
    editor.execute(setTotalFrames(10, 20));
    clock.advance(DISPLAY_FRAME_MS);
    const afterShrink = editor.playback.frame;
    editor.undo();
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(afterShrink).toBe(10);
    expect(editor.playback.totalFrames).toBe(20);
    expect(editor.playback.frame).toBe(10);
    expect(editor.document.settings.totalFrames).toBe(20);
    expect(log.playheads).toEqual([{ frame: 10, previous: 15 }]);
    expect(log.renders).toHaveLength(2);
  });

  it('follows a loaded document', () => {
    // Arrange
    const { editor, clock } = createPlaybackEditor();
    clock.advance(DISPLAY_FRAME_MS);
    const log = recordRenders(editor);

    // Act
    editor.load(createAnimatedDocument(40));
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(editor.playback.totalFrames).toBe(40);
    expect(log.renders).toHaveLength(1);
  });
});

describe('editor playback: playing', () => {
  it('renders once per clock frame with the fractional frame, and the playhead only on integer changes', () => {
    // Arrange
    const { editor, clock } = createPlaybackEditor();
    clock.advance(DISPLAY_FRAME_MS);
    const log = recordRenders(editor);

    // Act
    editor.playback.play();
    clock.advance(50);
    clock.advance(50);
    clock.advance(50);

    // Assert
    expect(log.states).toEqual(['play']);
    expect(log.renders.map((sample) => sample.time.frame)).toEqual([1.5, 2, 2.5]);
    expect(log.renders[0]?.layer('hero')?.values.x).toBeCloseTo(5);
    expect(log.playheads).toEqual([{ frame: 2, previous: 1 }]);
    expect(editor.playback.playing).toBe(true);
  });

  it('does not render twice when a command lands during playback', () => {
    // Arrange
    const { editor, clock } = createPlaybackEditor();
    clock.advance(DISPLAY_FRAME_MS);
    editor.playback.play();
    const log = recordRenders(editor);

    // Act
    editor.execute(touchDocument('pendant la lecture'));
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(log.renders).toHaveLength(1);
    expect(clock.pendingFrames).toBe(1);
  });

  it('pauses, toggles and changes speed through the facade', () => {
    // Arrange
    const { editor, clock } = createPlaybackEditor();
    const log = recordRenders(editor);

    // Act
    editor.playback.toggle();
    editor.playback.speed = 2;
    clock.advance(100);
    editor.playback.toggle();

    // Assert
    expect(log.states).toEqual(['play', 'pause']);
    expect(editor.playback.speed).toBe(2);
    expect(editor.playback.frame).toBe(3);
    expect(editor.playback.playing).toBe(false);
  });

  it('emits playback:complete at the end without loop', () => {
    // Arrange
    const { editor, clock } = createPlaybackEditor();
    editor.playback.seek(20);
    clock.advance(DISPLAY_FRAME_MS);
    const log = recordRenders(editor);

    // Act
    editor.playback.play();
    clock.advance(200);

    // Assert
    expect(log.states).toEqual(['play', 'complete']);
    expect(editor.playback.playing).toBe(false);
    expect(log.renders[log.renders.length - 1]?.time.integerFrame).toBe(20);
  });

  it('emits playback:loop and restarts at frame 1 with loop', () => {
    // Arrange
    const { editor, clock } = createPlaybackEditor();
    editor.playback.seek(20);
    editor.playback.loop = true;
    clock.advance(DISPLAY_FRAME_MS);
    const log = recordRenders(editor);

    // Act
    editor.playback.play();
    clock.advance(150);

    // Assert
    expect(editor.playback.loop).toBe(true);
    expect(log.states).toEqual(['play', 'loop']);
    expect(editor.playback.playing).toBe(true);
    expect(log.playheads).toEqual([{ frame: 1, previous: 20 }]);
  });
});

describe('editor playback: onFrame and destroy', () => {
  it('calls onFrame once per rendered frame until unsubscribed', () => {
    // Arrange
    const { editor, clock } = createPlaybackEditor();
    const frames: number[] = [];
    const stop = editor.onFrame((sample) => frames.push(sample.time.integerFrame));

    // Act
    clock.advance(DISPLAY_FRAME_MS);
    editor.playback.seek(5);
    clock.advance(DISPLAY_FRAME_MS);
    stop();
    editor.playback.seek(7);
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(frames).toEqual([1, 5]);
  });

  it('cancels the pending render, stops playback and refuses actions after destroy', () => {
    // Arrange
    const { editor, clock } = createPlaybackEditor();
    const playback = editor.playback;
    playback.play();
    const log = recordRenders(editor);

    // Act
    editor.destroy();
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(clock.pendingFrames).toBe(0);
    expect(log.renders).toHaveLength(0);
    expect(playback.playing).toBe(false);
    expect(() => playback.play()).toThrow(/détruit/);
    expect(() => playback.seek(2)).toThrow(/détruit/);
    expect(() => (playback.loop = true)).toThrow(/détruit/);
    expect(() => playback.sample()).toThrow(/détruit/);
    expect(() => editor.sample()).toThrow(/détruit/);
    expect(() => editor.onFrame(() => undefined)).toThrow(/détruit/);
    expect(playback.frame).toBe(1);
  });
});

describe('editor playback: events reserved to the core', () => {
  it('refuses that a plugin emits a playback event', () => {
    // Arrange
    const { plugin, context } = captureContext();
    createPlaybackEditor({ plugins: [plugin] });
    const sample = context().playback.sample();
    const emit = context().events.emit as (name: string, payload: unknown) => void;

    // Act
    const fakeRender = (): void => emit('frame:render', { sample });
    const fakePlay = (): void => emit('playback:play', {});

    // Assert
    expect(fakeRender).toThrow(/événement du noyau/);
    expect(fakePlay).toThrow(/événement du noyau/);
  });
});
