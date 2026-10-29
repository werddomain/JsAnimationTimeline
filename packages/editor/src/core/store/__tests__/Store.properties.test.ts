// packages/editor/src/core/store/__tests__/Store.properties.test.ts
/**
 * Tests du Store sur les cibles et les noms de pistes : cible vivante
 * `{ element }` refusée (document initial et `load`), cibles `selector` et
 * `ref` acceptées, piste inconnue du registre signalée à `onWarning` (par
 * défaut `console.warn`) ou refusée avec `strictProperties`, registre donné
 * respecté, et même contrôle dans `createEditor()`.
 */

import { createManualClock, createPropertyRegistry, ValidationCodes } from '@kazo-ca/timeline-runtime';
import type { ITimelineDocument, LayerTarget, PropertyTracks } from '@kazo-ca/timeline-runtime';
import { deepFreeze } from '../../commands/__tests__/fixtures';
import { createEditor } from '../../editor/createEditor';
import { catchError, cleanBody, createContainer } from '../../editor/__tests__/fixtures';
import { EventBus } from '../../events/EventBus';
import { Store } from '../Store';
import { StoreError } from '../StoreError';
import { UNKNOWN_PROPERTY } from '../unknownTracks';
import type { IUnknownPropertyIssue } from '../unknownTracks';

afterEach(cleanBody);

/** Document d'un calque avec `target` et `tracks` donnés (non figé : un nœud DOM ne doit pas l'être). */
function documentWith(target: LayerTarget | undefined, tracks: PropertyTracks = {}): ITimelineDocument {
  return {
    version: '2.0.0',
    settings: { fps: 24, totalFrames: 10 },
    layers: [{
      id: 'l1', type: 'layer', name: 'Calque', ...(target === undefined ? {} : { target }),
      spans: [{ id: 's1', start: 1, end: 10, kind: 'static', tracks }]
    }]
  };
}

describe('Store live targets', () => {
  it('refuses an { element } target in the initial document', () => {
    // Arrange
    const doc = documentWith({ element: document.createElement('div') });

    // Act
    const error = catchError(() => new Store(new EventBus(), doc));

    // Assert
    expect(error).toBeInstanceOf(StoreError);
    expect((error as StoreError).issues.map((issue) => issue.code)).toEqual([ValidationCodes.LIVE_TARGET]);
  });

  it('refuses an { element } target in load and keeps the current document', () => {
    // Arrange
    const initial = deepFreeze(documentWith({ selector: '#a' }));
    const store = new Store(new EventBus(), initial);

    // Act
    const act = (): void => store.load(documentWith({ element: document.createElement('div') }));

    // Assert
    expect(act).toThrow(StoreError);
    expect(store.document).toBe(initial);
  });

  it('accepts selector and ref targets', () => {
    // Act
    const selector = (): Store => new Store(new EventBus(), deepFreeze(documentWith({ selector: '#a' })));
    const ref = (): Store => new Store(new EventBus(), deepFreeze(documentWith({ ref: 'hero', stage: 'canvas' })));

    // Assert
    expect(selector).not.toThrow();
    expect(ref).not.toThrow();
  });
});

describe('Store unknown track names', () => {
  const tracks: PropertyTracks = { x: [{ frame: 1, value: 1 }], frameIndex: [{ frame: 1, value: 3 }] };

  it('warns through onWarning with the path of the unknown track and keeps the document', () => {
    // Arrange
    const warnings: (readonly IUnknownPropertyIssue[])[] = [];
    const doc = deepFreeze(documentWith({ ref: 'hero' }, tracks));

    // Act
    const store = new Store(new EventBus(), doc, { onWarning: (issues) => warnings.push(issues) });

    // Assert
    expect(store.document).toBe(doc);
    expect(warnings).toEqual([[{
      path: '/layers/0/spans/0/tracks/frameIndex',
      code: UNKNOWN_PROPERTY,
      property: 'frameIndex',
      message: 'Layer "l1": property "frameIndex" is not in the editor registry.'
    }]]);
  });

  it('warns with console.warn by default, on load too', () => {
    // Arrange
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = new Store(new EventBus(), deepFreeze(documentWith(undefined)));

    try {
      // Act
      store.load(deepFreeze(documentWith(undefined, tracks)));

      // Assert
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[0]).toMatch(/frameIndex/);
    } finally {
      warn.mockRestore();
    }
  });

  it('refuses the document with strictProperties', () => {
    // Arrange
    const doc = deepFreeze(documentWith(undefined, tracks));

    // Act
    const error = catchError(() => new Store(new EventBus(), doc, { strictProperties: true }));

    // Assert
    expect(error).toBeInstanceOf(StoreError);
    expect((error as StoreError).issues.map((issue) => issue.code)).toEqual([UNKNOWN_PROPERTY]);
  });

  it('looks names up in the given registry', () => {
    // Arrange
    const registry = createPropertyRegistry([{ name: 'frameIndex', kind: 'value', unit: '', defaultValue: 0 }]);
    const onWarning = jest.fn();

    // Act
    new Store(new EventBus(), deepFreeze(documentWith(undefined, tracks)), { registry, onWarning, strictProperties: true });

    // Assert
    expect(onWarning).not.toHaveBeenCalled();
  });

  it('reports each unknown name once per layer', () => {
    // Arrange
    const doc = deepFreeze<ITimelineDocument>({
      version: '2.0.0',
      settings: { fps: 24, totalFrames: 10 },
      layers: [{
        id: 'l1', type: 'layer', name: 'Calque',
        spans: [
          { id: 's1', start: 1, end: 5, kind: 'static', tracks: { mystery: [{ frame: 1, value: 1 }] } },
          { id: 's2', start: 6, end: 10, kind: 'static', tracks: { mystery: [{ frame: 6, value: 2 }] } }
        ]
      }]
    });
    const onWarning = jest.fn();

    // Act
    new Store(new EventBus(), doc, { onWarning });

    // Assert
    expect(onWarning).toHaveBeenCalledWith([expect.objectContaining({ path: '/layers/0/spans/0/tracks/mystery' })]);
  });
});

describe('createEditor document checks', () => {
  it('refuses a live target before touching the container', () => {
    // Arrange
    const container = createContainer();
    const data = documentWith({ element: document.createElement('div') });

    // Act
    const act = (): unknown => createEditor(container, { data, clock: createManualClock() });

    // Assert
    expect(act).toThrow(StoreError);
    expect(container.childElementCount).toBe(0);
  });

  it('passes strictProperties, onWarning and the registry to the Store', () => {
    // Arrange
    const tracks: PropertyTracks = { volume: [{ frame: 1, value: 1 }] };
    const onWarning = jest.fn();
    const registry = createPropertyRegistry([{ name: 'volume', kind: 'value', unit: '', defaultValue: 1 }]);

    // Act
    const strict = (): unknown => createEditor(createContainer(), {
      data: deepFreeze(documentWith(undefined, tracks)), strictProperties: true, clock: createManualClock()
    });
    createEditor(createContainer(), { data: deepFreeze(documentWith(undefined, tracks)), onWarning, clock: createManualClock() });
    const known = (): unknown => createEditor(createContainer(), {
      data: deepFreeze(documentWith(undefined, tracks)), registry, strictProperties: true, clock: createManualClock()
    });

    // Assert
    expect(strict).toThrow(StoreError);
    expect(onWarning).toHaveBeenCalledTimes(1);
    expect(known).not.toThrow();
  });
});
