// packages/editor/src/core/store/__tests__/Store.test.ts
/**
 * Tests du Store : validation du document initial et de `load`, événements
 * `document:loaded` / `history:changed`, historique vidé par `load`, pile de
 * commandes unique et absence d'écriture publique du document.
 */

import type { ITimelineDocument } from '@werddomain/timeline-runtime';
import { EventBus } from '../../events/EventBus';
import { createDocument, createHarness, deepFreeze, recordEvents, setFps } from '../../commands/__tests__/fixtures';
import { Store } from '../Store';
import { StoreError } from '../StoreError';

/** Document invalide : id dupliqué et plage qui dépasse la durée. */
function createInvalidDocument(): ITimelineDocument {
  return deepFreeze<ITimelineDocument>({
    version: '2.0.0',
    settings: { fps: 24, totalFrames: 10 },
    layers: [
      { id: 'dup', type: 'layer', name: 'A', spans: [{ id: 'dup', start: 1, end: 20, kind: 'static' }] }
    ]
  });
}

describe('Store construction', () => {
  it('exposes the initial document by reference', () => {
    // Arrange
    const initial = createDocument();

    // Act
    const store = new Store(new EventBus(), initial);

    // Assert
    expect(store.document).toBe(initial);
  });

  it('rejects an invalid initial document with a StoreError listing the issues', () => {
    // Arrange
    const invalid = createInvalidDocument();

    // Act
    const act = (): Store => new Store(new EventBus(), invalid);

    // Assert
    expect(act).toThrow(StoreError);
    expect(act).toThrow(/Document invalide \(2 problème\(s\)\)/);
  });

  it('offers no public way to write the document', () => {
    // Arrange
    const store = new Store(new EventBus(), createDocument());

    // Act
    const write = (): void => {
      // @ts-expect-error `document` est en lecture seule
      store.document = createDocument(60);
    };

    // Assert
    expect(write).toThrow(TypeError);
    expect(store.document.settings.fps).toBe(24);
  });
});

describe('StoreError', () => {
  it('lists every issue with its path and code in a French message', () => {
    // Arrange
    const issues = [
      { path: '/layers/0/id', code: 'duplicate-id' as const, message: 'Id "a" is already used at /layers/1/id.' }
    ];

    // Act
    const error = new StoreError(issues);

    // Assert
    expect(error).toBeInstanceOf(StoreError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('StoreError');
    expect(error.issues).toEqual(issues);
    expect(Object.isFrozen(error.issues)).toBe(true);
    expect(error.message).toBe(
      'Document invalide (1 problème(s)) :\n- /layers/0/id : Id "a" is already used at /layers/1/id. (duplicate-id)'
    );
  });
});

describe('Store load', () => {
  it('replaces the document, clears the history and emits history:changed then document:loaded', () => {
    // Arrange
    const { bus, store, stack } = createHarness();
    stack.execute(setFps(30, 24));
    const previous = store.document;
    const next = createDocument(60);
    const events = recordEvents(bus, ['history:changed', 'document:loaded', 'document:changed']);

    // Act
    store.load(next);

    // Assert
    expect(store.document).toBe(next);
    expect(stack.canUndo).toBe(false);
    expect(events).toEqual([
      {
        name: 'history:changed',
        payload: { canUndo: false, canRedo: false, undoLabel: undefined, redoLabel: undefined }
      },
      { name: 'document:loaded', payload: { document: next, previous } }
    ]);
  });

  it('lets document:loaded handlers see the new document and the cleared history', () => {
    // Arrange
    const { bus, store, stack } = createHarness();
    stack.execute(setFps(30, 24));
    const next = createDocument(60);
    const seen: Array<[number, boolean]> = [];
    bus.on('document:loaded', () => seen.push([store.document.settings.fps, stack.canUndo]));

    // Act
    store.load(next);

    // Assert
    expect(seen).toEqual([[60, false]]);
  });

  it('rejects an invalid document without changing anything', () => {
    // Arrange
    const { bus, store, stack } = createHarness();
    stack.execute(setFps(30, 24));
    const before = store.document;
    const events = recordEvents(bus, ['history:changed', 'document:loaded']);

    // Act / Assert
    expect(() => store.load(createInvalidDocument())).toThrow(StoreError);
    expect(store.document).toBe(before);
    expect(stack.canUndo).toBe(true);
    expect(events).toEqual([]);
  });

  it('abandons a group in progress', () => {
    // Arrange
    const { store, stack } = createHarness();
    stack.beginGroup('Glisser');
    stack.execute(setFps(30, 24));

    // Act
    store.load(createDocument(12));

    // Assert
    expect(stack.isGrouping).toBe(false);
    expect(stack.canUndo).toBe(false);
  });

  it('emits only document:loaded when no command stack was created', () => {
    // Arrange
    const bus = new EventBus();
    const store = new Store(bus, createDocument());
    const events = recordEvents(bus, ['history:changed', 'document:loaded']);

    // Act
    store.load(createDocument(30));

    // Assert
    expect(events.map((event) => event.name)).toEqual(['document:loaded']);
  });
});

describe('Store createCommandStack', () => {
  it('creates a stack that writes the store document', () => {
    // Arrange
    const store = new Store(new EventBus(), createDocument());

    // Act
    const stack = store.createCommandStack({ limit: 5 });
    stack.execute(setFps(30, 24));

    // Assert
    expect(store.document.settings.fps).toBe(30);
  });

  it('creates the command stack only once', () => {
    // Arrange
    const store = new Store(new EventBus(), createDocument());
    store.createCommandStack();

    // Act / Assert
    expect(() => store.createCommandStack()).toThrow(/déjà été créée/);
  });

  it('never mutates the documents it holds', () => {
    // Arrange
    const { store, stack } = createHarness();
    const original = store.document;

    // Act
    stack.execute(setFps(30, 24));
    stack.undo();
    stack.redo();

    // Assert
    expect(Object.isFrozen(original)).toBe(true);
    expect(original).toEqual(createDocument());
  });
});
