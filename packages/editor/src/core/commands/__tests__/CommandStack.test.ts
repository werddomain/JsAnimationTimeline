// packages/editor/src/core/commands/__tests__/CommandStack.test.ts
/**
 * Tests de la CommandStack hors regroupement : exécution, annuler /
 * rétablir, no-op, refus (CommandRefusedError), veto par `command:before`,
 * propagation des autres erreurs, plafond, libellés et charges utiles de
 * `history:changed`.
 */

import { CANCELLED_REASON } from '../commandEvents';
import { CommandRefusedError } from '../CommandRefusedError';
import { DEFAULT_HISTORY_LIMIT } from '../CommandStack';
import { createCommand } from '../createCommand';
import {
  createDocument,
  createHarness,
  layerName,
  NOOP_COMMAND,
  recordEvents,
  renameLayer,
  renameUnlessLocked,
  setFps
} from './fixtures';

describe('CommandStack execute', () => {
  it('applies the command, records it and emits document:changed then history:changed', () => {
    // Arrange
    const { bus, store, stack } = createHarness();
    const previous = store.document;
    const events = recordEvents(bus, ['document:changed', 'history:changed']);
    const command = setFps(30, 24);

    // Act
    const changed = stack.execute(command);

    // Assert
    expect(changed).toBe(true);
    expect(store.document.settings.fps).toBe(30);
    expect(events).toEqual([
      {
        name: 'document:changed',
        payload: { document: store.document, previous, cause: 'execute', label: 'Fps 30' }
      },
      {
        name: 'history:changed',
        payload: { canUndo: true, canRedo: false, undoLabel: 'Fps 30', redoLabel: undefined }
      }
    ]);
  });

  it('emits the cancellable command:before with the command and the current document', () => {
    // Arrange
    const { bus, store, stack } = createHarness();
    const seen: unknown[] = [];
    bus.onCancellable('command:before', (event) => seen.push(event.payload));
    const command = setFps(30, 24);
    const before = store.document;

    // Act
    stack.execute(command);

    // Assert
    expect(seen).toEqual([{ command, document: before }]);
  });

  it('records nothing and emits nothing when do returns the same document', () => {
    // Arrange
    const { bus, store, stack } = createHarness();
    const before = store.document;
    const events = recordEvents(bus, ['document:changed', 'history:changed', 'command:refused']);

    // Act
    const changed = stack.execute(NOOP_COMMAND);

    // Assert
    expect(changed).toBe(false);
    expect(store.document).toBe(before);
    expect(stack.canUndo).toBe(false);
    expect(events).toEqual([]);
  });

  it('refuses a command that throws CommandRefusedError without touching the history', () => {
    // Arrange
    const { bus, store, stack } = createHarness();
    stack.execute(setFps(30, 24));
    const before = store.document;
    const events = recordEvents(bus, ['command:refused', 'document:changed', 'history:changed']);
    const command = renameUnlessLocked('l2', 'Titre', 'Fond');

    // Act
    const changed = stack.execute(command);

    // Assert
    expect(changed).toBe(false);
    expect(store.document).toBe(before);
    expect(stack.undoLabel).toBe('Fps 30');
    expect(events).toEqual([{ name: 'command:refused', payload: { command, reason: 'calque verrouillé' } }]);
  });

  it('refuses a command vetoed by a command:before handler without calling do', () => {
    // Arrange
    const { bus, store, stack } = createHarness();
    const before = store.document;
    const doFn = jest.fn(() => createDocument(60));
    const command = createCommand('Veto', doFn, (doc) => doc);
    bus.onCancellable('command:before', (event) => event.cancel());
    const refused = recordEvents(bus, ['command:refused']);

    // Act
    const changed = stack.execute(command);

    // Assert
    expect(changed).toBe(false);
    expect(doFn).not.toHaveBeenCalled();
    expect(store.document).toBe(before);
    expect(refused).toEqual([{ name: 'command:refused', payload: { command, reason: CANCELLED_REASON } }]);
  });

  it('treats a throwing command:before handler as a veto (fail-closed)', () => {
    // Arrange
    const { bus, store, stack, onError } = createHarness();
    const before = store.document;
    const failure = new Error('validation en panne');
    bus.onCancellable('command:before', () => {
      throw failure;
    });
    const refused = recordEvents(bus, ['command:refused']);

    // Act
    const changed = stack.execute(setFps(30, 24));

    // Assert
    expect(changed).toBe(false);
    expect(store.document).toBe(before);
    expect(stack.canUndo).toBe(false);
    expect(onError).toHaveBeenCalledWith(failure, 'command:before');
    expect(refused).toHaveLength(1);
    expect(refused[0].payload.reason).toBe(CANCELLED_REASON);
  });

  it('propagates any other error with the document and the history unchanged', () => {
    // Arrange
    const { bus, store, stack } = createHarness();
    stack.execute(setFps(30, 24));
    const before = store.document;
    const events = recordEvents(bus, ['command:refused', 'document:changed', 'history:changed']);
    const broken = createCommand(
      'Cassée',
      () => {
        throw new TypeError('bogue');
      },
      (doc) => doc
    );

    // Act / Assert
    expect(() => stack.execute(broken)).toThrow(TypeError);
    expect(store.document).toBe(before);
    expect(stack.undoLabel).toBe('Fps 30');
    expect(events).toEqual([]);
  });
});

describe('CommandStack undo and redo', () => {
  it('undoes then redoes with the matching causes and labels', () => {
    // Arrange
    const { bus, store, stack } = createHarness();
    const original = store.document;
    stack.execute(renameLayer('l1', 'Titre', 'Logo'));
    const renamed = store.document;
    const events = recordEvents(bus, ['document:changed', 'history:changed']);

    // Act
    const undone = stack.undo();
    const afterUndo = store.document;
    const redone = stack.redo();

    // Assert
    expect(undone).toBe(true);
    expect(redone).toBe(true);
    expect(afterUndo).toEqual(original);
    expect(layerName(store.document, 'l1')).toBe('Titre');
    expect(events.map((event) => event.payload)).toEqual([
      { document: afterUndo, previous: renamed, cause: 'undo', label: 'Renommer l1 en Titre' },
      { canUndo: false, canRedo: true, undoLabel: undefined, redoLabel: 'Renommer l1 en Titre' },
      { document: store.document, previous: afterUndo, cause: 'redo', label: 'Renommer l1 en Titre' },
      { canUndo: true, canRedo: false, undoLabel: 'Renommer l1 en Titre', redoLabel: undefined }
    ]);
  });

  it('returns false when there is nothing to undo or redo', () => {
    // Arrange
    const { bus, stack } = createHarness();
    const events = recordEvents(bus, ['history:changed', 'document:changed']);

    // Act / Assert
    expect(stack.undo()).toBe(false);
    expect(stack.redo()).toBe(false);
    expect(events).toEqual([]);
  });

  it('exposes the undo and redo labels of the next entries', () => {
    // Arrange
    const { stack } = createHarness();
    stack.execute(setFps(30, 24));
    stack.execute(setFps(60, 30));

    // Act
    stack.undo();

    // Assert
    expect(stack.canUndo).toBe(true);
    expect(stack.canRedo).toBe(true);
    expect(stack.undoLabel).toBe('Fps 30');
    expect(stack.redoLabel).toBe('Fps 60');
  });

  it('clears the redo stack when a new command is executed', () => {
    // Arrange
    const { stack } = createHarness();
    stack.execute(setFps(30, 24));
    stack.undo();

    // Act
    stack.execute(renameLayer('l1', 'Titre', 'Logo'));

    // Assert
    expect(stack.canRedo).toBe(false);
    expect(stack.redoLabel).toBeUndefined();
    expect(stack.redo()).toBe(false);
  });

  it('keeps the entry in place when its undo refuses', () => {
    // Arrange
    const { bus, store, stack } = createHarness();
    const lockAfterwards = createCommand(
      'Verrouiller puis refuser',
      (doc) => ({ ...doc, settings: { ...doc.settings, fps: 12 } }),
      () => {
        throw new CommandRefusedError('Verrouiller puis refuser', 'verrou');
      }
    );
    stack.execute(lockAfterwards);
    const before = store.document;
    const refused = recordEvents(bus, ['command:refused']);

    // Act
    const undone = stack.undo();

    // Assert
    expect(undone).toBe(false);
    expect(store.document).toBe(before);
    expect(stack.undoLabel).toBe('Verrouiller puis refuser');
    expect(refused).toHaveLength(1);
  });

  it('keeps the entry in place when its redo refuses', () => {
    // Arrange
    const { store, stack } = createHarness();
    let allowed = true;
    const command = createCommand(
      'Une seule fois',
      (doc) => {
        if (!allowed) throw new CommandRefusedError('Une seule fois', 'déjà fait');
        return { ...doc, settings: { ...doc.settings, fps: 12 } };
      },
      (doc) => ({ ...doc, settings: { ...doc.settings, fps: 24 } })
    );
    stack.execute(command);
    stack.undo();
    allowed = false;
    const before = store.document;

    // Act
    const redone = stack.redo();

    // Assert
    expect(redone).toBe(false);
    expect(store.document).toBe(before);
    expect(stack.redoLabel).toBe('Une seule fois');
  });

  it('skips document:changed when undo returns the same document', () => {
    // Arrange
    const { bus, stack } = createHarness();
    stack.execute(createCommand('Sans retour', (doc) => ({ ...doc }), (doc) => doc));
    const events = recordEvents(bus, ['document:changed', 'history:changed']);

    // Act
    const undone = stack.undo();

    // Assert
    expect(undone).toBe(true);
    expect(events.map((event) => event.name)).toEqual(['history:changed']);
  });
});

describe('CommandStack limit and clear', () => {
  it('defaults the history limit to 100 entries', () => {
    // Arrange
    const { stack } = createHarness();

    // Act
    for (let fps = 1; fps <= DEFAULT_HISTORY_LIMIT + 5; fps += 1) stack.execute(setFps(fps, fps - 1));
    let undone = 0;
    while (stack.undo()) undone += 1;

    // Assert
    expect(DEFAULT_HISTORY_LIMIT).toBe(100);
    expect(undone).toBe(DEFAULT_HISTORY_LIMIT);
  });

  it('drops the oldest entries beyond the limit', () => {
    // Arrange
    const { store, stack } = createHarness({ limit: 2 });

    // Act
    stack.execute(setFps(30, 24));
    stack.execute(setFps(40, 30));
    stack.execute(setFps(50, 40));
    const undone = [stack.undo(), stack.undo(), stack.undo()];

    // Assert
    expect(undone).toEqual([true, true, false]);
    expect(store.document.settings.fps).toBe(30);
    expect(stack.redoLabel).toBe('Fps 40');
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects the invalid limit %p', (limit) => {
    // Act / Assert
    expect(() => createHarness({ limit })).toThrow(RangeError);
  });

  it('clears both stacks and emits history:changed', () => {
    // Arrange
    const { bus, store, stack } = createHarness();
    stack.execute(setFps(30, 24));
    stack.execute(setFps(40, 30));
    stack.undo();
    const document = store.document;
    const events = recordEvents(bus, ['history:changed', 'document:changed']);

    // Act
    stack.clear();

    // Assert
    expect(stack.canUndo).toBe(false);
    expect(stack.canRedo).toBe(false);
    expect(store.document).toBe(document);
    expect(events).toEqual([
      {
        name: 'history:changed',
        payload: { canUndo: false, canRedo: false, undoLabel: undefined, redoLabel: undefined }
      }
    ]);
  });
});
