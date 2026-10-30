// packages/runtime/src/stage/object/__tests__/propertyTimelines.test.ts
import type { ILayer } from '../../../model/layer';
import type { TimelinePropertyValue } from '../../../model/propertyTimeline';
import { createHost, docOf, timeAt } from '../../__tests__/fakeStage';
import type { IStage, IStageLayerState } from '../../types';
import { createObjectStage } from '../createObjectStage';

type TypedState = IStageLayerState<object> & {
  readonly propertyValues?: Readonly<Record<string, TimelinePropertyValue>>;
};

function layer(): ILayer {
  return {
    id: 'hero', type: 'layer', name: 'Hero', target: { ref: 'hero', stage: 'objects' }, spans: [],
    propertyTimelines: {
      x: { initialValue: { kind: 'number', value: 42 }, keys: [{ frame: 5, value: { kind: 'number', value: 90 } }] },
      caption: { initialValue: { kind: 'text', value: 'Before' }, keys: [{ frame: 5, value: { kind: 'text', value: 'After' } }] },
      enabled: { initialValue: { kind: 'boolean', value: false }, keys: [{ frame: 5, value: { kind: 'boolean', value: true } }] }
    }
  };
}

function setup() {
  const seen: TypedState[] = [];
  const errors: unknown[] = [];
  const stage = createObjectStage({
    id: 'objects', objects: [{ id: 'hero', label: 'Hero', object: {}, properties: ['x', 'caption', 'enabled'] }],
    apply(_object, _values, state) { seen.push(state); }
  });
  const host = createHost([stage as IStage], errors);
  return { host, seen, errors };
}

describe('typed property timelines through object stages', () => {
  it('delivers typed values with numeric compatibility and no invented numeric values for text or booleans', () => {
    const { host, seen, errors } = setup();
    host.load(docOf([layer()]));
    host.render(timeAt(6));
    const state = seen[seen.length - 1];
    expect(errors).toEqual([]);
    expect(state.active).toBe(true);
    expect(state.values).toEqual({ x: 90 });
    expect(state.propertyValues).toEqual({ x: { kind: 'number', value: 90 }, caption: { kind: 'text', value: 'After' }, enabled: { kind: 'boolean', value: true } });
  });

  it('restores the initial typed state on release', () => {
    const { host, seen } = setup();
    host.load(docOf([layer()]));
    host.render(timeAt(6));
    seen.length = 0;
    host.load(docOf([]));
    expect(seen).toHaveLength(1);
    expect(seen[0].values).toEqual({ x: 42 });
    expect(seen[0].propertyValues).toEqual({ x: { kind: 'number', value: 42 }, caption: { kind: 'text', value: 'Before' }, enabled: { kind: 'boolean', value: false } });
  });

  it('restores typed initial values in an inactive span without a reset callback', () => {
    const { host, seen } = setup();
    host.load(docOf([{ ...layer(), spans: [{ id: 'blank', kind: 'blank', start: 7, end: 10 }] }]));
    host.render(timeAt(8));
    const state = seen[seen.length - 1];
    expect(state.active).toBe(false);
    expect(state.values).toEqual({ x: 42 });
    expect(state.propertyValues?.caption).toEqual({ kind: 'text', value: 'Before' });
  });

  it('restores a dropped typed property before applying the remaining track', () => {
    const { host, seen } = setup();
    const before = layer();
    host.load(docOf([before]));
    host.render(timeAt(6));
    seen.length = 0;
    host.load(docOf([{ ...before, propertyTimelines: { x: before.propertyTimelines!.x } }]));
    expect(seen[0].propertyValues?.caption).toEqual({ kind: 'text', value: 'Before' });
    expect(seen[0].propertyValues?.enabled).toEqual({ kind: 'boolean', value: false });
    expect(seen[0].values.caption).toBeUndefined();
  });

  it('keeps both value projections consistent when a modern document is replaced with legacy tracks', () => {
    const { host, seen } = setup();
    host.load(docOf([layer()]));
    host.load(docOf([{ id: 'hero', type: 'layer', name: 'Hero', target: { ref: 'hero', stage: 'objects' },
      spans: [{ id: 'motion', kind: 'tween', start: 1, end: 10, tracks: { x: [{ frame: 1, value: 0 }, { frame: 10, value: 90 }] } }] }]));
    host.render(timeAt(6));
    const state = seen[seen.length - 1];
    expect(state.values.x).toBe(50);
    expect(state.propertyValues?.x).toEqual({ kind: 'number', value: 50 });
    host.destroy();
    expect(seen[seen.length - 1].values.x).toBe(42);
  });
});
