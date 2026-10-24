// packages/editor/src/plugins/persistence/json/__tests__/readDocument.test.ts
/**
 * Lecture d'un document : JSON, migration v1, validation sans cible vivante,
 * cibles transmises telles quelles et copie de l'objet de l'appelant.
 */

import { ValidationCodes } from '@werddomain/timeline-runtime';
import { PersistenceError } from '../PersistenceError';
import { parseJson, readDocument } from '../readDocument';
import { makeV1Document, makeV2Document } from './fixtures';

function catchError(action: () => unknown): PersistenceError {
  try {
    action();
  } catch (error) {
    if (error instanceof PersistenceError) return error;
    throw error;
  }
  throw new Error('aucune erreur levée');
}

describe('parseJson', () => {
  it('parses JSON text', () => {
    // Act
    const value = parseJson('{"a":1}');

    // Assert
    expect(value).toEqual({ a: 1 });
  });

  it('throws an invalid-json PersistenceError for malformed text', () => {
    // Act
    const error = catchError(() => parseJson('{ pas du json'));

    // Assert
    expect(error.code).toBe('invalid-json');
    expect(error.message).toMatch(/^Le fichier n'est pas du JSON valide/);
    expect(error.issues).toEqual([]);
  });
});

describe('readDocument', () => {
  it('reads a v2 JSON text without migrating it', () => {
    // Arrange
    const source = makeV2Document();

    // Act
    const result = readDocument(JSON.stringify(source));

    // Assert
    expect(result.document).toEqual(source);
    expect(result.migrated).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  it('passes selector and ref targets through untouched', () => {
    // Act
    const { document } = readDocument(JSON.stringify(makeV2Document()));

    // Assert
    const targets = document.layers.map((node) => (node.type === 'layer' ? node.target : undefined));
    expect(targets).toEqual([{ selector: '#box' }, { ref: 'hero', stage: 'canvas' }, { ref: 'music' }, undefined]);
  });

  it('copies a v2 object given by the caller instead of keeping it', () => {
    // Arrange
    const source = makeV2Document();

    // Act
    const result = readDocument(source);

    // Assert
    expect(result.document).toEqual(source);
    expect(result.document).not.toBe(source);
    expect(result.document.layers[0]).not.toBe(source.layers[0]);
  });

  it('migrates a v1 document and reports the migrator warnings', () => {
    // Arrange
    const v1 = makeV1Document();
    (v1['settings'] as Record<string, unknown>)['frameRate'] = 29.97;

    // Act
    const result = readDocument(JSON.stringify(v1));

    // Assert
    expect(result.migrated).toBe(true);
    expect(result.document.version).toBe('2.0.0');
    expect(result.document.settings).toEqual({ fps: 30, totalFrames: 20 });
    expect(result.document.layers.map((node) => node.id)).toEqual(['v1-layer']);
    expect(result.warnings.map((warning) => warning.code)).toEqual(['fps-adjusted']);
    expect(Object.isFrozen(result.warnings)).toBe(true);
  });

  it('migrates a v1 object without modifying it', () => {
    // Arrange
    const v1 = makeV1Document();
    const before = JSON.stringify(v1);

    // Act
    const result = readDocument(v1);

    // Assert
    expect(result.migrated).toBe(true);
    expect(JSON.stringify(v1)).toBe(before);
  });

  it.each([
    ['a version 3 document', { version: '3.0.0', settings: {}, layers: [] }, 'unsupported-version'],
    ['a value that is not an object', [1, 2], 'not-an-object'],
    ['a v1 document without totalFrames', { version: '1.0.0', settings: {}, layers: [] }, 'invalid-settings']
  ])('throws unsupported-document for %s', (_label, input, migrationCode) => {
    // Act
    const error = catchError(() => readDocument(JSON.stringify(input)));

    // Assert
    expect(error.code).toBe('unsupported-document');
    expect(error.migrationCode).toBe(migrationCode);
  });

  it('throws invalid-document with the validation issues of a broken v2 document', () => {
    // Arrange
    const broken = { ...makeV2Document(), settings: { fps: 0, totalFrames: 48 } };

    // Act
    const error = catchError(() => readDocument(JSON.stringify(broken)));

    // Assert
    expect(error.code).toBe('invalid-document');
    expect(error.issues.map((issue) => [issue.path, issue.code])).toEqual([
      ['/settings/fps', ValidationCodes.OUT_OF_RANGE]
    ]);
    expect(error.message).toContain('/settings/fps');
  });

  it('refuses a live element target (allowLiveTargets: false)', () => {
    // Arrange
    const doc = makeV2Document();
    const live = {
      ...doc,
      layers: [{ id: 'l-live', type: 'layer', name: 'Vivant', target: { element: document.createElement('div') }, spans: [] }]
    };

    // Act
    const error = catchError(() => readDocument(live));

    // Assert
    expect(error.code).toBe('invalid-document');
    expect(error.issues.map((issue) => issue.code)).toEqual([ValidationCodes.LIVE_TARGET]);
  });

  it('refuses a track named __proto__ written in a JSON file', () => {
    // Arrange
    const text = JSON.stringify(makeV2Document()).replace('"x":', '"__proto__":');

    // Act
    const error = catchError(() => readDocument(text));

    // Assert
    expect(error.code).toBe('invalid-document');
    expect(error.issues.map((issue) => issue.code)).toContain(ValidationCodes.INVALID_PROPERTY_NAME);
  });

  it('rethrows an unexpected error from the migrator', () => {
    // Arrange: un getter qui lève pendant la lecture de `version`.
    const hostile = Object.defineProperty({}, 'version', {
      enumerable: true,
      get: () => {
        throw new RangeError('boom');
      }
    });

    // Act / Assert
    expect(() => readDocument(hostile)).toThrow(RangeError);
  });
});
