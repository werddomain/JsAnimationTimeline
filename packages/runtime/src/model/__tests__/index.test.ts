// packages/runtime/src/model/__tests__/index.test.ts
/**
 * The package entry point re-exports the whole model API.
 */

import * as runtime from '../../index';

describe('runtime entry point', () => {
  it('exports the model values', () => {
    expect(Object.keys(runtime)).toEqual(expect.arrayContaining([
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
    ]));
    expect(runtime.SCHEMA_VERSION).toBe('2.0.0');
  });
});
