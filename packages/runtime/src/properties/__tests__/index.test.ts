// packages/runtime/src/properties/__tests__/index.test.ts
/**
 * The package entry point re-exports the property registry API.
 */

import * as runtime from '../../index';
import * as properties from '../index';

describe('properties entry point', () => {
  it('exports the registry values', () => {
    expect(Object.keys(properties).sort()).toEqual([
      'BUILTIN_PROPERTIES',
      'BUILTIN_PROPERTY_NAMES',
      'CSS_VALUE_PRECISION',
      'PropertyRegistry',
      'TRANSFORM_STEPS',
      'assertValidDescriptor',
      'clampValue',
      'composeTransform',
      'computeCssDeclarations',
      'createPropertyRegistry',
      'cssNameToCamelCase',
      'defaultPropertyRegistry',
      'formatCssValue',
      'interpolateValue',
      'lerp',
      'registerProperty',
      'roundCssNumber'
    ]);
  });

  it('is re-exported by the package', () => {
    expect(Object.keys(runtime)).toEqual(expect.arrayContaining(Object.keys(properties)));
    expect(runtime.defaultPropertyRegistry).toBe(properties.defaultPropertyRegistry);
  });
});
