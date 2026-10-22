// packages/editor/src/core/store/__tests__/index.test.ts
/**
 * Vérifie l'API publique des modules store et commands (valeurs exportées
 * et événements visibles dans TimelineEventMap via leurs index).
 */

import * as commands from '../../commands';
import * as store from '..';
import type { TimelineEventMap } from '../../events/TimelineEventMap';
import type { EventName } from '../../events/EventBus';

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

function assertType<T extends true>(value: T): T {
  return value;
}

type CoreNames =
  | 'document:loaded'
  | 'document:changed'
  | 'command:before'
  | 'command:refused'
  | 'history:changed';

describe('store and commands public API', () => {
  it('exports the runtime values of the store module', () => {
    // Assert
    expect(Object.keys(store).sort()).toEqual(['Store', 'StoreError']);
  });

  it('exports the runtime values of the commands module', () => {
    // Assert
    expect(Object.keys(commands).sort()).toEqual([
      'CANCELLED_REASON',
      'CommandRefusedError',
      'CompositeCommand',
      'DEFAULT_HISTORY_LIMIT',
      'createCommand'
    ]);
    expect(commands.CANCELLED_REASON).toBe('cancelled');
  });

  it('adds the store and command events to TimelineEventMap', () => {
    // Assert
    assertType<Equals<Extract<EventName<TimelineEventMap>, CoreNames>, CoreNames>>(true);
    assertType<Equals<TimelineEventMap['document:changed'], store.DocumentChangedEvent>>(true);
    assertType<Equals<TimelineEventMap['history:changed'], commands.HistoryChangedEvent>>(true);
    assertType<Equals<store.DocumentChangeCause, 'execute' | 'undo' | 'redo' | 'group-cancel'>>(true);
    expect(true).toBe(true);
  });

  it('exposes CommandStack as a type only, obtained through Store.createCommandStack', () => {
    // Assert
    assertType<Equals<ReturnType<store.Store['createCommandStack']>, commands.CommandStack>>(true);
    expect('CommandStack' in commands).toBe(false);
  });
});
