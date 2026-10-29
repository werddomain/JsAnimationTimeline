// packages/editor/src/plugins/persistence/json/__tests__/writeDocument.test.ts
/**
 * Écriture d'un document en JSON : indentation, aller-retour avec
 * `readDocument`, cibles écrites telles quelles et refus d'une cible vivante.
 */

import type { ITimelineDocument } from '@kazo-ca/timeline-runtime';
import { ValidationCodes } from '@kazo-ca/timeline-runtime';
import { PersistenceError } from '../PersistenceError';
import { readDocument } from '../readDocument';
import { DEFAULT_JSON_SPACE, writeDocument } from '../writeDocument';
import { makeV2Document } from './fixtures';

describe('writeDocument', () => {
  it('writes indented JSON by default', () => {
    // Arrange
    const doc = makeV2Document();

    // Act
    const json = writeDocument(doc);

    // Assert
    expect(DEFAULT_JSON_SPACE).toBe(2);
    expect(json).toBe(JSON.stringify(doc, null, 2));
  });

  it('honours the space option (0 = one line)', () => {
    // Act
    const json = writeDocument(makeV2Document(), { space: 0 });

    // Assert
    expect(json).not.toContain('\n');
  });

  it('round-trips through readDocument with targets untouched', () => {
    // Arrange
    const doc = makeV2Document();

    // Act
    const back = readDocument(writeDocument(doc)).document;

    // Assert
    expect(back).toEqual(doc);
    expect(JSON.parse(writeDocument(doc)).layers[1].target).toEqual({ ref: 'hero', stage: 'canvas' });
  });

  it('refuses a live element target instead of writing it as {}', () => {
    // Arrange
    const doc = {
      ...makeV2Document(),
      layers: [{ id: 'l-live', type: 'layer', name: 'Vivant', target: { element: document.createElement('div') }, spans: [] }]
    } as ITimelineDocument;

    // Act
    let caught: unknown;
    try {
      writeDocument(doc);
    } catch (error) {
      caught = error;
    }

    // Assert
    expect(caught).toBeInstanceOf(PersistenceError);
    const error = caught as PersistenceError;
    expect(error.code).toBe('invalid-document');
    expect(error.issues.map((issue) => issue.code)).toEqual([ValidationCodes.LIVE_TARGET]);
  });
});
