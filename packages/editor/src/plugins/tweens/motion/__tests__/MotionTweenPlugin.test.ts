// packages/editor/src/plugins/tweens/motion/__tests__/MotionTweenPlugin.test.ts
/**
 * Tests de `tweens.motion` : création et suppression depuis la sélection et
 * par API, accord de canCreate / canRemove avec l'exécution, événements de
 * disponibilité (seulement sur changement), événements créé / supprimé,
 * refus par `command:refused`, registre de l'éditeur, historique et
 * destruction.
 */

import { createPropertyRegistry, validateDocument } from '@werddomain/timeline-runtime';
import type { ILayer, ITimelineDocument, LayerNode, PropertyRegistry } from '@werddomain/timeline-runtime';
import type { IEditorContext } from '../../../../core/context/IEditorContext';
import { MotionTweenPlugin } from '../MotionTweenPlugin';
import { createEditor } from '../../../../core/editor/createEditor';
import type { IEditor } from '../../../../core/editor/types';
import type { CommandRefusedEvent } from '../../../../core/commands/commandEvents';
import { LayoutPlugin } from '../../../layout/LayoutPlugin';
import { cleanBody, createContainer, createManualScheduler } from '../../../layout/__tests__/layoutFixtures';
import { createShortcutsPlugin } from '../../../interaction/shortcuts';
import { FramesPlugin } from '../../../frames/FramesPlugin';
import type { IFramesSelectionService } from '../../../frames/selection/types';
import { TweensPlugin } from '../../TweensPlugin';
import type { IMotionTweenService, MotionAvailabilityChangedEvent, MotionTweenEvent } from '../types';

afterEach(cleanBody);

function layer(id: string, extra: Partial<ILayer> = {}): ILayer {
  return { id, type: 'layer', name: id, spans: [], ...extra };
}

function doc(layers: readonly LayerNode[]): ITimelineDocument {
  return { version: '2.0.0', settings: { fps: 24, totalFrames: 40 }, layers };
}

function sample(): ITimelineDocument {
  return doc([
    layer('a', {
      spans: [
        { id: 'a1', start: 1, end: 4, kind: 'static', tracks: { x: [{ frame: 1, value: 0 }] } },
        { id: 'a2', start: 5, end: 8, kind: 'static', tracks: { x: [{ frame: 5, value: 100 }] } },
        { id: 'a3', start: 9, end: 12, kind: 'blank' }
      ]
    }),
    layer('b', { spans: [{ id: 'b1', start: 1, end: 6, kind: 'tween', tracks: { x: [{ frame: 1, value: 1 }, { frame: 6, value: 9 }] } }] }),
    layer('c', { spans: [{ id: 'c1', start: 1, end: 6, kind: 'tween', tracks: { x: [{ frame: 1, value: 2 }, { frame: 6, value: 8 }] } }] })
  ]);
}

interface IHarness {
  readonly editor: IEditor;
  readonly selection: IFramesSelectionService;
  readonly motion: IMotionTweenService;
  readonly availability: MotionAvailabilityChangedEvent[];
  readonly created: MotionTweenEvent[];
  readonly removed: MotionTweenEvent[];
  readonly refused: CommandRefusedEvent[];
}

function setup(data: ITimelineDocument = sample(), registry?: PropertyRegistry): IHarness {
  const editor = createEditor(createContainer(), {
    data,
    ...(registry === undefined ? {} : { registry }),
    defaultPlugins: [new LayoutPlugin({ scrollSync: { scheduler: createManualScheduler() } }), new FramesPlugin(), createShortcutsPlugin(), new TweensPlugin()]
  });
  const selection = editor.getService('frames.selection');
  const motion = editor.getService('tweens.motion');
  if (selection === undefined || motion === undefined) throw new Error('montage incomplet');
  const availability: MotionAvailabilityChangedEvent[] = [];
  const created: MotionTweenEvent[] = [];
  const removed: MotionTweenEvent[] = [];
  const refused: CommandRefusedEvent[] = [];
  editor.on('tweens:motionAvailabilityChanged', (event) => availability.push(event));
  editor.on('tweens:motionCreated', (event) => created.push(event));
  editor.on('tweens:motionRemoved', (event) => removed.push(event));
  editor.on('command:refused', (event) => refused.push(event));
  return { editor, selection, motion, availability, created, removed, refused };
}

const cells = (rowId: string, ...frames: number[]) => frames.map((frame) => ({ rowId, frame }));

function shape(editor: IEditor, id: string): string[] {
  const node = editor.document.layers.find((candidate) => candidate.id === id);
  return node !== undefined && 'spans' in node ? node.spans.map((span) => `${span.kind} ${span.start}-${span.end}`) : [];
}

describe('tweens.motion create', () => {
  it('creates a tween from the keyframe selected alone and emits motionCreated', () => {
    // Arrange
    const { editor, selection, motion, created } = setup();
    selection.set(cells('a', 5));

    // Act
    const done = motion.create();

    // Assert
    expect(done).toBe(true);
    expect(shape(editor, 'a')).toEqual(['static 1-4', 'tween 5-8', 'blank 9-12']);
    expect(created).toEqual([{ layerId: 'a', spanId: 'a2', start: 5, end: 8 }]);
    expect(editor.canUndo).toBe(true);
    expect(validateDocument(editor.document)).toEqual([]);
  });

  it('creates a tween between two selected keyframes in one history entry', () => {
    // Arrange
    const { editor, selection, motion, created } = setup();
    selection.set(cells('a', 1, 2, 5));

    // Act
    motion.create();

    // Assert
    expect(shape(editor, 'a')).toEqual(['tween 1-4', 'static 5-8', 'blank 9-12']);
    expect(created).toEqual([{ layerId: 'a', spanId: 'a1', start: 1, end: 4 }]);
    expect(editor.undo()).toBe(true);
    expect(shape(editor, 'a')).toEqual(['static 1-4', 'static 5-8', 'blank 9-12']);
    expect(editor.canUndo).toBe(false);
    expect(editor.redo()).toBe(true);
    expect(shape(editor, 'a')).toEqual(['tween 1-4', 'static 5-8', 'blank 9-12']);
  });

  it('creates through the API without any selection', () => {
    // Arrange
    const { editor, motion, created } = setup();

    // Act
    const done = motion.createAt('a', 1, 5);
    const single = motion.createAt('a', 6);

    // Assert
    expect(done).toBe(true);
    expect(single).toBe(true);
    expect(shape(editor, 'a')).toEqual(['tween 1-4', 'tween 5-8', 'blank 9-12']);
    expect(created.map((event) => event.spanId)).toEqual(['a1', 'a2']);
  });

  it('refuses through command:refused with the French message and no created event', () => {
    // Arrange
    const { editor, selection, motion, created, refused } = setup();
    const before = editor.document;
    selection.set(cells('a', 9));

    // Act
    const done = motion.create();

    // Assert
    expect(done).toBe(false);
    expect(refused).toHaveLength(1);
    expect(refused[0].reason).toBe('Une plage vide ne peut pas être interpolée.');
    expect(created).toEqual([]);
    expect(editor.document).toBe(before);
    expect(editor.canUndo).toBe(false);
  });

  it('refuses an empty selection, several layers and a locked layer', () => {
    // Arrange
    const locked = doc([layer('a', { locked: true, spans: [{ id: 'a1', start: 1, end: 4, kind: 'static' }] }), layer('b', { spans: [{ id: 'b1', start: 1, end: 4, kind: 'static' }] })]);
    const { selection, motion, refused } = setup(locked);

    // Act
    motion.create();
    selection.set([...cells('a', 1), ...cells('b', 1)]);
    motion.create();
    selection.set(cells('a', 1));
    motion.create();

    // Assert
    expect(refused.map((event) => event.reason)).toEqual([
      'Aucune image clé à interpoler.',
      "Sélectionnez des images d'un seul calque.",
      'Le calque « a » est verrouillé.'
    ]);
  });
});

describe('tweens.motion canCreate after create', () => {
  it('disables canCreate once the selection is a tween, and a second create is refused', () => {
    // Arrange
    const { selection, motion, created, refused } = setup();
    selection.set(cells('a', 1, 5));
    motion.create();

    // Act
    const verdict = motion.canCreate();
    const again = motion.create();

    // Assert
    expect(verdict).toEqual({ enabled: false, reason: 'Déjà une interpolation.' });
    expect(again).toBe(false);
    expect(created).toHaveLength(1);
    expect(refused.map((event) => event.reason)).toEqual(['Déjà une interpolation.']);
  });

  it('disables canCreate after a two-keyframe create, and a second create is refused', () => {
    // Arrange: keyframes 1 and 5 of layer a become the tween [1, 4].
    const { selection, motion, created, refused } = setup();
    selection.set(cells('a', 1, 5));
    expect(motion.create()).toBe(true);
    selection.set(cells('a', 1, 5));

    // Act
    const verdict = motion.canCreate();
    const again = motion.create();

    // Assert
    expect(verdict).toEqual({ enabled: false, reason: 'Déjà une interpolation.' });
    expect(again).toBe(false);
    expect(created).toHaveLength(1);
    expect(refused.map((event) => event.reason)).toEqual(['Déjà une interpolation.']);
  });
});

describe('tweens.motion remove', () => {
  it('removes the tweens touched on several layers as one history entry', () => {
    // Arrange
    const { editor, selection, motion, removed } = setup();
    selection.set([...cells('b', 3), ...cells('c', 1, 2)]);

    // Act
    const done = motion.remove();

    // Assert
    expect(done).toBe(true);
    expect(shape(editor, 'b')).toEqual(['static 1-6']);
    expect(shape(editor, 'c')).toEqual(['static 1-6']);
    expect(removed).toEqual([
      { layerId: 'b', spanId: 'b1', start: 1, end: 6 },
      { layerId: 'c', spanId: 'c1', start: 1, end: 6 }
    ]);
    expect(editor.undo()).toBe(true);
    expect(shape(editor, 'b')).toEqual(['tween 1-6']);
    expect(shape(editor, 'c')).toEqual(['tween 1-6']);
    expect(editor.canUndo).toBe(false);
  });

  it('removes through the API and reports the tween with tweenAt', () => {
    // Arrange
    const { motion, removed } = setup();

    // Act
    const before = motion.tweenAt('b', 3);
    const done = motion.removeAt('b', 3);

    // Assert
    expect(before?.id).toBe('b1');
    expect(done).toBe(true);
    expect(motion.tweenAt('b', 3)).toBeUndefined();
    expect(motion.tweenAt('a', 2)).toBeUndefined();
    expect(motion.tweenAt('zz', 2)).toBeUndefined();
    expect(removed).toHaveLength(1);
  });

  it('refuses when no tween is selected, or a layer is locked, without removed events', () => {
    // Arrange
    const withLock = doc([layer('b', { locked: true, spans: [{ id: 'b1', start: 1, end: 6, kind: 'tween' }] }), layer('a', { spans: [{ id: 'a1', start: 1, end: 4, kind: 'static' }] })]);
    const { selection, motion, refused, removed } = setup(withLock);

    // Act
    selection.set(cells('a', 1));
    motion.remove();
    selection.set(cells('b', 1));
    motion.remove();
    const viaApi = motion.removeAt('a', 1);

    // Assert
    expect(viaApi).toBe(false);
    expect(refused.map((event) => event.reason)).toEqual([
      'Aucune interpolation à supprimer.',
      'Le calque « b » est verrouillé.',
      'Aucune interpolation à supprimer.'
    ]);
    expect(removed).toEqual([]);
  });
});

describe('tweens.motion availability', () => {
  it('canCreate and canRemove give the same verdict as the commands, with the reason', () => {
    // Arrange
    const { selection, motion, refused } = setup();
    const scenarios = [
      cells('a', 5),
      cells('a', 1, 5),
      cells('a', 9),
      cells('b', 1),
      cells('a', 20),
      [...cells('a', 1), ...cells('b', 1)],
      []
    ];

    scenarios.forEach((selected) => {
      // Act
      selection.set(selected);
      const verdict = motion.canCreate();
      const before = refused.length;
      const done = motion.create();

      // Assert
      expect(verdict.enabled).toBe(done);
      if (done) expect(verdict.reason).toBeUndefined();
      else expect(verdict.reason).toBe(refused[before].reason);
    });
  });

  it('canRemove matches execution, locked layers included', () => {
    // Arrange
    const withLock = doc([layer('b', { locked: true, spans: [{ id: 'b1', start: 1, end: 6, kind: 'tween' }] }), layer('c', { spans: [{ id: 'c1', start: 1, end: 6, kind: 'tween' }] })]);
    const { selection, motion } = setup(withLock);

    // Act
    selection.set(cells('b', 1));
    const lockedVerdict = motion.canRemove();
    selection.set([...cells('c', 1)]);
    const openVerdict = motion.canRemove();

    // Assert
    expect(lockedVerdict).toEqual({ enabled: false, reason: 'Le calque « b » est verrouillé.' });
    expect(openVerdict).toEqual({ enabled: true });
    expect(motion.remove()).toBe(true);
  });

  it('emits the availability only when it changes', () => {
    // Arrange
    const { selection, motion, availability } = setup();

    // Act
    selection.set(cells('a', 5));
    selection.set(cells('a', 5, 6));
    selection.set(cells('b', 2));
    selection.clear();
    motion.createAt('a', 5);

    // Assert
    expect(availability.map((event) => [event.canCreate.enabled, event.canRemove.enabled])).toEqual([
      [true, false],
      [false, true],
      [false, false]
    ]);
    expect(availability[0].canRemove).toEqual({ enabled: false, reason: 'Aucune interpolation à supprimer.' });
  });

  it('follows the document: undo and load recompute the availability', () => {
    // Arrange
    const { editor, selection, motion, availability } = setup();
    selection.set(cells('a', 5));
    motion.create();
    const afterCreate = availability.length;

    // Act
    editor.undo();
    const afterUndo = availability.length;
    editor.load(doc([layer('a', { spans: [{ id: 'z', start: 1, end: 3, kind: 'static' }] })]));

    // Assert
    expect(availability[afterCreate - 1].canRemove.enabled).toBe(true);
    expect(afterUndo).toBe(afterCreate + 1);
    expect(availability[afterUndo - 1]).toEqual({
      canCreate: { enabled: true },
      canRemove: { enabled: false, reason: 'Aucune interpolation à supprimer.' }
    });
    expect(motion.canCreate().enabled).toBe(false);
  });
});

describe('tweens.motion registry and lifecycle', () => {
  it('evaluates with the editor registry (a custom property), not the default one', () => {
    // Arrange
    const registry = createPropertyRegistry([{ name: 'glow', kind: 'value', unit: '', defaultValue: 5 }]);
    const custom = doc([
      layer('a', {
        spans: [
          { id: 'a1', start: 1, end: 4, kind: 'static', tracks: { glow: [{ frame: 1, value: 1 }] } },
          { id: 'a2', start: 5, end: 8, kind: 'static', tracks: { glow: [{ frame: 5, value: 9 }] } }
        ]
      })
    ]);
    const { editor, motion } = setup(custom, registry);

    // Act
    const done = motion.createAt('a', 1, 5);

    // Assert
    expect(done).toBe(true);
    const tween = editor.document.layers[0];
    expect('spans' in tween && tween.spans[0].tracks).toEqual({ glow: [{ frame: 1, value: 1 }, { frame: 4, value: 9 }] });
  });

  it('removes its service and every listener on destroy', () => {
    // Arrange
    const unsubscribe = jest.fn();
    const unprovide = jest.fn();
    const ctx = {
      document: sample(),
      registry: createPropertyRegistry(),
      events: { on: jest.fn(() => unsubscribe), emit: jest.fn() },
      services: {
        provide: jest.fn(() => unprovide),
        require: jest.fn(() => ({ cells: () => [] }))
      }
    } as unknown as IEditorContext;
    const plugin = new MotionTweenPlugin();
    plugin.init(ctx);

    // Act
    plugin.destroy();
    plugin.destroy();

    // Assert
    expect(ctx.events.on).toHaveBeenCalledTimes(3);
    expect(unsubscribe).toHaveBeenCalledTimes(3);
    expect(unprovide).toHaveBeenCalledTimes(1);
  });

  it('throws a clear error when the service is used after destroy', () => {
    // Arrange
    const { editor, motion } = setup();
    editor.destroy();

    // Assert
    expect(() => motion.canCreate()).toThrow('tweens.motion');
  });
});
