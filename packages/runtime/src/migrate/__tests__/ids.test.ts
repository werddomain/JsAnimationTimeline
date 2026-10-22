// packages/runtime/src/migrate/__tests__/ids.test.ts
/**
 * IdAllocator: explicit ids are claimed once, generated ids skip reserved and used ones.
 */

import { IdAllocator } from '../ids';

describe('IdAllocator', () => {
  it('claims an id only once', () => {
    const ids = new IdAllocator([]);
    expect(ids.claim('a')).toBe(true);
    expect(ids.claim('a')).toBe(false);
  });

  it('generates ids that are neither reserved nor used', () => {
    const ids = new IdAllocator(['p1', 'p3']);
    ids.claim('p2');
    expect(ids.generate('p')).toBe('p4');
    expect(ids.generate('p')).toBe('p5');
    expect(ids.claim('p4')).toBe(false);
  });
});
