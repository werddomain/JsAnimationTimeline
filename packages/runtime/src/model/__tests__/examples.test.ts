// packages/runtime/src/model/__tests__/examples.test.ts
/**
 * The example documents of `schema/examples/` are consistent: they match
 * their typed copies (hence ITimelineDocument) and break no invariant.
 */

import { validateDocument } from '../validate';
import { TYPED_EXAMPLES } from './fixtures/examples';
import { EXAMPLE_NAMES, readExample } from './fixtures/schema';

describe('schema/examples', () => {
  it.each(EXAMPLE_NAMES)('%s deep-equals its typed ITimelineDocument copy', (name) => {
    expect(readExample(name)).toEqual(TYPED_EXAMPLES[name]);
  });

  it.each(EXAMPLE_NAMES)('%s passes validateDocument', (name) => {
    expect(validateDocument(TYPED_EXAMPLES[name])).toEqual([]);
  });
});
