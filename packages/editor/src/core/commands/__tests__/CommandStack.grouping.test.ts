// packages/editor/src/core/commands/__tests__/CommandStack.grouping.test.ts
/**
 * Tests du regroupement de la CommandStack (glisser-déposer) : une seule
 * entrée à `endGroup`, `cancelGroup` qui restaure le document, groupe vide,
 * imbrication interdite, undo / redo interdits et historique indisponible
 * (`canUndo` / `canRedo` faux, `history:changed`) pendant un regroupement.
 */

import { createCommand } from '../createCommand';
import type { ICommand } from '../ICommand';
import { createHarness, layerName, recordEvents, renameLayer, renameUnlessLocked, setFps } from './fixtures';

describe('CommandStack grouping', () => {
  it('applies grouped commands immediately and records them as one entry on endGroup', () => {
    // Arrange
    const { bus, store, stack } = createHarness();
    const original = store.document;
    const history = recordEvents(bus, ['history:changed']);

    // Act
    stack.beginGroup('Glisser');
    stack.execute(setFps(25, 24));
    stack.execute(setFps(26, 25));
    const duringDrag = store.document.settings.fps;
    const historyDuringDrag = history.length;
    const pushed = stack.endGroup();

    // Assert
    expect(duringDrag).toBe(26);
    expect(historyDuringDrag).toBe(1);
    expect(pushed).toBe(true);
    expect(stack.isGrouping).toBe(false);
    expect(stack.undoLabel).toBe('Glisser');
    expect(history.map((event) => event.payload)).toEqual([
      { canUndo: false, canRedo: false, undoLabel: undefined, redoLabel: undefined },
      { canUndo: true, canRedo: false, undoLabel: 'Glisser', redoLabel: undefined }
    ]);
    expect(stack.undo()).toBe(true);
    expect(store.document).toEqual(original);
    expect(stack.canUndo).toBe(false);
  });

  it('redoes a whole group as a CompositeCommand', () => {
    // Arrange
    const { bus, store, stack } = createHarness();
    stack.beginGroup('Glisser');
    stack.execute(setFps(25, 24));
    stack.execute(renameLayer('l1', 'Titre', 'Logo'));
    stack.endGroup();
    stack.undo();
    const changes = recordEvents(bus, ['document:changed']);

    // Act
    stack.redo();

    // Assert
    expect(store.document.settings.fps).toBe(25);
    expect(layerName(store.document, 'l1')).toBe('Titre');
    expect(changes).toHaveLength(1);
    expect(changes[0].payload.label).toBe('Glisser');
  });

  it('emits document:changed with cause execute for every grouped command', () => {
    // Arrange
    const { bus, stack } = createHarness();
    const changes = recordEvents(bus, ['document:changed']);

    // Act
    stack.beginGroup('Glisser');
    stack.execute(setFps(25, 24));
    stack.execute(setFps(26, 25));
    stack.endGroup();

    // Assert
    expect(changes.map((event) => [event.payload.cause, event.payload.label])).toEqual([
      ['execute', 'Fps 25'],
      ['execute', 'Fps 26']
    ]);
  });

  it('reverts every grouped command on cancelGroup and records nothing', () => {
    // Arrange
    const { bus, store, stack } = createHarness();
    stack.execute(renameLayer('l1', 'Titre', 'Logo'));
    const beforeGroup = store.document;
    stack.beginGroup('Glisser');
    stack.execute(setFps(25, 24));
    stack.execute(setFps(26, 25));
    const dragged = store.document;
    const events = recordEvents(bus, ['document:changed', 'history:changed']);

    // Act
    stack.cancelGroup();

    // Assert
    expect(store.document).toBe(beforeGroup);
    expect(stack.isGrouping).toBe(false);
    expect(stack.undoLabel).toBe('Renommer l1 en Titre');
    expect(events).toEqual([
      {
        name: 'document:changed',
        payload: { document: beforeGroup, previous: dragged, cause: 'group-cancel', label: 'Glisser' }
      },
      {
        name: 'history:changed',
        payload: { canUndo: true, canRedo: false, undoLabel: 'Renommer l1 en Titre', redoLabel: undefined }
      }
    ]);
  });

  it('keeps the redo stack when a group is cancelled', () => {
    // Arrange
    const { stack } = createHarness();
    stack.execute(setFps(30, 24));
    stack.undo();

    // Act
    stack.beginGroup('Glisser');
    stack.execute(setFps(25, 24));
    stack.cancelGroup();

    // Assert
    expect(stack.redoLabel).toBe('Fps 30');
  });

  it('clears the redo stack when a group is recorded', () => {
    // Arrange
    const { stack } = createHarness();
    stack.execute(setFps(30, 24));
    stack.undo();

    // Act
    stack.beginGroup('Glisser');
    stack.execute(setFps(25, 24));
    stack.endGroup();

    // Assert
    expect(stack.canRedo).toBe(false);
  });

  it('pushes nothing for an empty group, nor for a group of refused or no-op commands', () => {
    // Arrange
    const { bus, store, stack } = createHarness();
    const before = store.document;
    const changes = recordEvents(bus, ['document:changed']);
    const history = recordEvents(bus, ['history:changed']);

    // Act
    stack.beginGroup('Vide');
    const emptyPushed = stack.endGroup();
    stack.beginGroup('Refusé');
    stack.execute(renameUnlessLocked('l2', 'X', 'Fond'));
    const refusedPushed = stack.endGroup();
    stack.beginGroup('Annulé');
    stack.cancelGroup();

    // Assert
    expect(emptyPushed).toBe(false);
    expect(refusedPushed).toBe(false);
    expect(store.document).toBe(before);
    expect(stack.canUndo).toBe(false);
    expect(changes).toEqual([]);
    expect(history).toHaveLength(6);
    expect(history.every((event) => !event.payload.canUndo && !event.payload.canRedo)).toBe(true);
  });

  it('throws on a nested beginGroup and keeps the current group', () => {
    // Arrange
    const { stack } = createHarness();
    stack.beginGroup('Glisser');

    // Act / Assert
    expect(() => stack.beginGroup('Autre')).toThrow(/« Glisser » est déjà en cours/);
    expect(stack.isGrouping).toBe(true);
  });

  it('throws on undo or redo while grouping', () => {
    // Arrange
    const { stack } = createHarness();
    stack.execute(setFps(30, 24));
    stack.beginGroup('Glisser');

    // Act / Assert
    expect(() => stack.undo()).toThrow(/interdit pendant le regroupement/);
    expect(() => stack.redo()).toThrow(/interdit pendant le regroupement/);
  });

  it('reports undo and redo as unavailable while grouping, then restores them', () => {
    // Arrange
    const { bus, stack } = createHarness();
    stack.execute(setFps(30, 24));
    stack.execute(setFps(31, 30));
    stack.undo();
    const history = recordEvents(bus, ['history:changed']);

    // Act
    stack.beginGroup('Glisser');
    const during = [stack.canUndo, stack.canRedo, stack.undoLabel, stack.redoLabel];
    stack.cancelGroup();
    const after = [stack.canUndo, stack.canRedo, stack.undoLabel, stack.redoLabel];

    // Assert
    expect(during).toEqual([false, false, undefined, undefined]);
    expect(after).toEqual([true, true, 'Fps 30', 'Fps 31']);
    expect(history.map((event) => event.payload)).toEqual([
      { canUndo: false, canRedo: false, undoLabel: undefined, redoLabel: undefined },
      { canUndo: true, canRedo: true, undoLabel: 'Fps 30', redoLabel: 'Fps 31' }
    ]);
  });

  it('lets a guarded undo shortcut be a no-op while grouping', () => {
    // Arrange
    const { store, stack } = createHarness();
    stack.execute(setFps(30, 24));
    stack.beginGroup('Glisser');
    stack.execute(setFps(25, 30));
    const dragged = store.document;
    const onUndoShortcut = (): boolean => (stack.canUndo ? stack.undo() : false);

    // Act
    const undone = onUndoShortcut();

    // Assert
    expect(undone).toBe(false);
    expect(store.document).toBe(dragged);
    expect(stack.isGrouping).toBe(true);
  });

  it('throws on endGroup or cancelGroup without a group', () => {
    // Arrange
    const { stack } = createHarness();

    // Act / Assert
    expect(() => stack.endGroup()).toThrow(/sans regroupement en cours/);
    expect(() => stack.cancelGroup()).toThrow(/sans regroupement en cours/);
  });

  it('undoes a recorded group by undoing its commands in reverse order', () => {
    // Arrange
    const { stack } = createHarness();
    const calls: string[] = [];
    const traced = (name: string, fps: number, previousFps: number): ICommand => {
      const inner = setFps(fps, previousFps);
      return createCommand(
        name,
        (doc) => {
          calls.push(`do ${name}`);
          return inner.do(doc);
        },
        (doc) => {
          calls.push(`undo ${name}`);
          return inner.undo(doc);
        }
      );
    };
    stack.beginGroup('Glisser');
    stack.execute(traced('a', 25, 24));
    stack.execute(traced('b', 26, 25));
    stack.endGroup();

    // Act
    stack.undo();
    stack.redo();

    // Assert
    expect(calls).toEqual(['do a', 'do b', 'undo b', 'undo a', 'do a', 'do b']);
  });

  it('abandons the current group on clear without touching the document', () => {
    // Arrange
    const { store, stack } = createHarness();
    stack.beginGroup('Glisser');
    stack.execute(setFps(25, 24));
    const dragged = store.document;

    // Act
    stack.clear();

    // Assert
    expect(stack.isGrouping).toBe(false);
    expect(stack.canUndo).toBe(false);
    expect(store.document).toBe(dragged);
  });
});
