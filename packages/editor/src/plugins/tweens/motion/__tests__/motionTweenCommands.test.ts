// packages/editor/src/plugins/tweens/motion/__tests__/motionTweenCommands.test.ts
/**
 * Tests des commandes d'interpolation : faire / annuler / rétablir, refus en
 * `CommandRefusedError`, annulation sur un calque verrouillé après coup,
 * suppression sur plusieurs calques en une seule commande.
 */

import type { ITimelineDocument } from '@kazo-ca/timeline-runtime';
import { CommandRefusedError } from '../../../../core/commands/CommandRefusedError';
import { CompositeCommand } from '../../../../core/commands/CompositeCommand';
import { createDoc, createRegistry, deepFreeze, expectValid, layer, shapeOf, spansOf } from '../../../../model/spans/__tests__/fixtures';
import { MotionTweenCommandLabels, createMotionTweenCommands } from '../motionTweenCommands';

const commands = createMotionTweenCommands(createRegistry());

function sample(): ITimelineDocument {
  return deepFreeze(
    createDoc([
      layer('a', [
        { id: 'a1', start: 1, end: 4, kind: 'static', tracks: { x: [{ frame: 1, value: 0 }] } },
        { id: 'a2', start: 5, end: 8, kind: 'static', tracks: { x: [{ frame: 5, value: 100 }] } }
      ]),
      layer('b', [{ id: 'b1', start: 1, end: 6, kind: 'tween', tracks: { x: [{ frame: 1, value: 1 }, { frame: 6, value: 9 }] } }]),
      layer('c', [{ id: 'c1', start: 1, end: 6, kind: 'tween', tracks: { x: [{ frame: 1, value: 2 }, { frame: 6, value: 8 }] } }])
    ])
  );
}

function lock(doc: ITimelineDocument, id: string): ITimelineDocument {
  return { ...doc, layers: doc.layers.map((node) => (node.id === id ? { ...node, locked: true } : node)) };
}

function refusalOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    if (error instanceof CommandRefusedError) return error.reason;
    throw error;
  }
  return '';
}

describe('createMotionTweenCommands', () => {
  it('creates from a span with an undo / redo round trip', () => {
    // Arrange
    const doc = sample();
    const command = commands.createFromSpan('a', 6);

    // Act
    const done = command.do(doc);
    const undone = command.undo(done);
    const redone = command.do(undone);

    // Assert
    expect(command.label).toBe('Créer une interpolation de mouvement');
    expect(shapeOf(done, 'a')).toEqual(['static 1-4', 'tween 5-8']);
    expect(undone).toEqual(doc);
    expect(redone).toEqual(done);
    expectValid(done);
  });

  it('creates between two keyframes with an undo / redo round trip', () => {
    // Arrange
    const doc = sample();
    const command = commands.createBetween('a', 1, 5);

    // Act
    const done = command.do(doc);
    const undone = command.undo(done);

    // Assert
    expect(shapeOf(done, 'a')).toEqual(['tween 1-4', 'static 5-8']);
    expect(undone).toEqual(doc);
    expect(command.do(undone)).toEqual(done);
  });

  it('removes tweens of several layers as one command, undone as a whole', () => {
    // Arrange
    const doc = sample();
    const command = commands.remove([
      { layerId: 'b', frames: [1] },
      { layerId: 'c', frames: [3] }
    ]);

    // Act
    const done = command.do(doc);
    const undone = command.undo(done);

    // Assert
    expect(command.label).toBe("Supprimer l'interpolation");
    expect(shapeOf(done, 'b')).toEqual(['static 1-6']);
    expect(shapeOf(done, 'c')).toEqual(['static 1-6']);
    expect(spansOf(done, 'b')[0].tracks).toEqual({ x: [{ frame: 1, value: 1 }] });
    expect(undone).toEqual(doc);
    expectValid(done);
  });

  it('refuses the whole removal when one layer is locked', () => {
    // Arrange
    const doc = lock(sample(), 'c');
    const command = commands.remove([
      { layerId: 'b', frames: [1] },
      { layerId: 'c', frames: [1] }
    ]);

    // Assert
    expect(refusalOf(() => command.do(doc))).toBe('Le calque « c » est verrouillé.');
  });

  it('turns every refusal into a CommandRefusedError with the French message', () => {
    // Arrange
    const doc = sample();

    // Assert
    expect(refusalOf(() => commands.createFromSpan('b', 2).do(doc))).toBe('Déjà une interpolation.');
    expect(refusalOf(() => commands.createBetween('a', 5, 1).do(doc))).toBe(
      'La seconde image clé doit suivre la première.'
    );
    expect(refusalOf(() => commands.remove([{ layerId: 'a', frames: [1] }]).do(doc))).toBe('Aucune interpolation à supprimer.');
    expect(refusalOf(() => commands.createFromSpan('zz', 1).do(doc))).toContain('introuvable');
    expect(refusalOf(() => commands.refused('create', 'Sélection ambiguë.').do(doc))).toBe('Sélection ambiguë.');
    expect(commands.refused('remove', 'x').label).toBe(MotionTweenCommandLabels.REMOVE);
  });

  it('refuses redo on a layer locked in the meantime while undo still works', () => {
    // Arrange
    const doc = sample();
    const command = commands.createFromSpan('a', 1);
    const done = command.do(doc);
    const locked = lock(done, 'a');

    // Act
    const undone = command.undo(locked);

    // Assert
    expect(shapeOf(undone, 'a')).toEqual(['static 1-4', 'static 5-8']);
    expect(refusalOf(() => command.do(lock(undone, 'a')))).toBe('Le calque « a » est verrouillé.');
  });

  it('leaves an unknown error untouched', () => {
    // Arrange
    const broken = { ...sample(), layers: null } as unknown as ITimelineDocument;

    // Assert
    expect(() => commands.createFromSpan('a', 1).do(broken)).toThrow(TypeError);
  });

  it('can be grouped in a CompositeCommand', () => {
    // Arrange
    const doc = sample();
    const group = new CompositeCommand('groupe', [commands.createFromSpan('a', 1), commands.remove([{ layerId: 'b', frames: [1] }])]);

    // Act
    const done = group.do(doc);

    // Assert
    expect(shapeOf(done, 'a')).toEqual(['tween 1-4', 'static 5-8']);
    expect(group.undo(done)).toEqual(doc);
  });
});
