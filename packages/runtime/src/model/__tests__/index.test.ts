// packages/runtime/src/model/__tests__/index.test.ts
/**
 * The model barrel exposes the whole model API, and the package entry point
 * re-exports all of it.
 */

import * as runtime from '../../index';
import * as model from '../index';

describe('runtime entry point', () => {
  it('exports the model values', () => {
    expect(Object.keys(model).sort()).toEqual([
      'CUBIC_BEZIER_PATTERN',
      'DEFAULT_COLLAPSED',
      'DEFAULT_EASING',
      'DEFAULT_LOCKED',
      'DEFAULT_VISIBLE',
      'EASING_PRESETS',
      'SCHEMA_VERSION',
      'ValidationCodes',
      'findNodeById',
      'flattenLayers',
      'isEasingPreset',
      'isElementTarget',
      'isFolder',
      'isLayer',
      'isSelectorTarget',
      'parseEasing',
      'resolveCollapsed',
      'resolveEasing',
      'resolveLocked',
      'resolveTracks',
      'resolveVisible',
      'validateDocument',
      'walkLayers'
    ]);
    expect(Object.keys(runtime)).toEqual(expect.arrayContaining(Object.keys(model)));
    expect(runtime.SCHEMA_VERSION).toBe('2.0.0');
  });
});
