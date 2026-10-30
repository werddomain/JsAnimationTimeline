// packages/runtime/src/stage/html/__tests__/animationContext.test.ts
import { cloneHtmlAnimationContext } from '../animationContext';

test('saved context is a strict detached JSON value', () => {
  const original = { version: 1, bindings: { a: { fade: { kind: 'style', cssName: 'opacity' } } } };
  const clone = cloneHtmlAnimationContext(original);
  expect(clone).toEqual(original);
  original.bindings.a.fade.cssName = 'color';
  expect(clone.bindings?.a.fade).toEqual({ kind: 'style', cssName: 'opacity' });
  expect(cloneHtmlAnimationContext(JSON.parse(JSON.stringify(clone)))).toEqual(clone);
});

test.each([
  { version: 2 }, { version: 1, unexpected: true }, { version: 1, bindings: [] },
  { version: 1, bindings: { a: { fade: { kind: 'style', cssName: 'opacity; color' } } } },
  { version: 1, gradients: { a: [{}] } }, { version: 1, resolutions: [{}] },
  { version: 1, resolutions: [{ conflictId: 'a', signature: 'b', winnerLayerId: 'c' }, { conflictId: 'a', signature: 'b', winnerLayerId: 'd' }] },
  { version: 1, resolutions: [{ conflictId: 'a', signature: 'b', winnerLayerId: 'c', beforeFirst: ['first-key'] }] },
  { version: 1, callback: () => undefined }, { version: 1, value: NaN }, { version: 1, node: document.createElement('div') },
  JSON.parse('{"version":1,"bindings":{"__proto__":{}}}') as unknown
])('rejects malformed or executable data before use: %p', (input: unknown) => {
  expect(() => cloneHtmlAnimationContext(input)).toThrow();
});

test('does not execute accessors or toJSON while validating', () => {
  const getter = jest.fn(() => ({}));
  const input = Object.defineProperty({ version: 1 }, 'bindings', { get: getter, enumerable: true });
  expect(() => cloneHtmlAnimationContext(input)).toThrow();
  expect(getter).not.toHaveBeenCalled();
  const toJSON = jest.fn(() => ({ version: 1 }));
  expect(() => cloneHtmlAnimationContext({ version: 1, toJSON })).toThrow();
  expect(toJSON).not.toHaveBeenCalled();
});

test('rejects cycles, sparse arrays and non-enumerable fields', () => {
  const cycle: Record<string, unknown> = { version: 1 };
  cycle.bindings = cycle;
  expect(() => cloneHtmlAnimationContext(cycle)).toThrow();
  expect(() => cloneHtmlAnimationContext({ version: 1, resolutions: new Array<unknown>(1) })).toThrow();
  expect(() => cloneHtmlAnimationContext(Object.defineProperty({ version: 1 }, 'bindings', { value: {} }))).toThrow();
});

test('all cloned dictionaries have no inherited entries for valid object and property identifiers', () => {
  const context = cloneHtmlAnimationContext({ version: 1, bindings: {
    toString: { valueOf: { kind: 'style', cssName: 'opacity' } },
    hasOwnProperty: { toString: { kind: 'style', cssName: 'color' } }
  }, gradients: {} });
  expect(Object.getPrototypeOf(context)).toBeNull();
  expect(Object.getPrototypeOf(context.bindings)).toBeNull();
  expect(Object.getPrototypeOf(context.bindings!.toString)).toBeNull();
  expect(context.bindings!.toString.valueOf).toEqual({ kind: 'style', cssName: 'opacity' });
  expect(context.bindings!.hasOwnProperty.toString).toEqual({ kind: 'style', cssName: 'color' });
  expect(context.gradients!.toString).toBeUndefined();
  expect(context.gradients!.valueOf).toBeUndefined();
  expect(context.gradients!.hasOwnProperty).toBeUndefined();
});
