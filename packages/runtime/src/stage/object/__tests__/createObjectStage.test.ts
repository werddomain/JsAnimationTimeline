// packages/runtime/src/stage/object/__tests__/createObjectStage.test.ts
/**
 * `createObjectStage` : routage avec et sans `unscoped`, resolve, release et
 * reset, valeurs reçues par `apply` à l'image N, un seul `endFrame` par image,
 * valeurs par défaut sans `reset`, list et describe, ajout et retrait d'objets.
 */

import { evaluateLayer } from '../../../evaluate/evaluateLayer';
import type { ILayer } from '../../../model/layer';
import type { LayerTarget } from '../../../model/target';
import { createPropertyRegistry } from '../../../properties/PropertyRegistry';
import { floorInterpolator } from '../../../properties/interpolators';
import type { PropertyDescriptor, PropertyValues } from '../../../properties/types';
import { StageHost } from '../../StageHost';
import { buildStageRegistry } from '../../registry';
import { docOf, refLayer, timeAt } from '../../__tests__/fakeStage';
import type { IStage, IStageLayerState } from '../../types';
import { createObjectStage } from '../createObjectStage';
import type { IObjectStageOptions } from '../types';

interface ISprite {
  name: string;
  log: string[];
}

const FRAME_INDEX: PropertyDescriptor = {
  name: 'frameIndex',
  kind: 'value',
  unit: '',
  label: 'Image du sprite',
  defaultValue: 0,
  min: 0,
  interpolate: floorInterpolator
};

const TRACKS = {
  x: [{ frame: 1, value: 0 }, { frame: 10, value: 90 }],
  frameIndex: [{ frame: 1, value: 0 }, { frame: 10, value: 9 }]
};

interface IApplied {
  readonly name: string;
  readonly values: PropertyValues;
  readonly active: boolean;
}

function setUp(overrides: Partial<IObjectStageOptions<ISprite>> = {}) {
  const hero: ISprite = { name: 'hero', log: [] };
  const villain: ISprite = { name: 'villain', log: [] };
  const applied: IApplied[] = [];
  const endFrames: Array<{ frame: number; count: number }> = [];
  const stage = createObjectStage<ISprite>({
    id: 'canvas',
    unscoped: true,
    properties: [FRAME_INDEX],
    objects: [
      { id: 'hero', label: 'Héros', icon: 'sprite', group: 'Acteurs', object: hero, properties: ['x', 'y', 'frameIndex'] },
      { id: 'villain', label: 'Méchant', object: villain }
    ],
    apply(sprite, values, state) {
      sprite.log.push('apply');
      applied.push({ name: sprite.name, values, active: state.active });
    },
    endFrame(time, states) {
      endFrames.push({ frame: time.frame, count: states.length });
    },
    ...overrides
  });
  const registry = buildStageRegistry(createPropertyRegistry(), [stage as IStage]);
  const errors: unknown[] = [];
  const host = new StageHost({
    stages: [stage as IStage],
    registry,
    onError: (error) => errors.push(error),
    now: () => ({ time: timeAt(1), state: { playing: false, speed: 1 } })
  });
  return { stage, host, hero, villain, applied, endFrames, errors, registry };
}

describe('createObjectStage routing', () => {
  it('accepts { ref, stage } and, when unscoped, { ref } alone', () => {
    const { stage } = setUp();
    expect(stage.accepts({ ref: 'hero', stage: 'canvas' })).toBe(true);
    expect(stage.accepts({ ref: 'hero' })).toBe(true);
    expect(stage.accepts({ ref: 'hero', stage: 'audio' })).toBe(false);
    expect(stage.accepts({ selector: '#hero' })).toBe(false);
  });

  it('refuses { ref } without stage when not unscoped', () => {
    const { stage } = setUp({ unscoped: false });
    expect(stage.accepts({ ref: 'hero', stage: 'canvas' })).toBe(true);
    expect(stage.accepts({ ref: 'hero' })).toBe(false);
  });

  it('exposes its properties to the registry', () => {
    const { stage } = setUp();
    expect(stage.properties).toEqual([FRAME_INDEX]);
  });
});

describe('createObjectStage resolve', () => {
  it('resolves a ref to its object and an unknown ref to null', () => {
    const { stage, hero } = setUp();
    expect(stage.resolve({ ref: 'hero' })).toBe(hero);
    expect(stage.resolve({ ref: 'ghost' })).toBeNull();
    expect(stage.resolve({ selector: '#hero' })).toBeNull();
  });

  it('uses a custom resolve with the current objects', () => {
    const seen: Array<ReadonlyMap<string, ISprite>> = [];
    const made: ISprite = { name: 'made', log: [] };
    const { stage, hero } = setUp({
      resolve(target: LayerTarget, objects) {
        seen.push(objects);
        return 'ref' in target && target.ref === 'made' ? made : (objects.get('hero') ?? null);
      }
    });
    expect(stage.resolve({ ref: 'made' })).toBe(made);
    expect(stage.resolve({ ref: 'anything' })).toBe(hero);
    expect(seen[0].has('villain')).toBe(true);
  });

  it('reports a layer on an unknown object in missingTargets', () => {
    const { host } = setUp();
    host.load(docOf([refLayer('l1', 'hero'), refLayer('l2', 'ghost')]));
    expect(host.missingTargets).toEqual(['l2']);
  });
});

describe('createObjectStage render', () => {
  it('hands apply the values evaluated at frame N', () => {
    const { host, applied, registry } = setUp();
    const layer = refLayer('l1', 'hero', 'canvas', TRACKS);
    host.load(docOf([layer]));
    applied.length = 0;
    host.render(timeAt(5));
    const expected = evaluateLayer(layer, 5, { registry }).values;
    expect(applied).toHaveLength(1);
    expect(applied[0].values.x).toBeCloseTo(expected.x, 6);
    expect(applied[0].values.frameIndex).toBe(4);
    expect(applied[0].active).toBe(true);
  });

  it('completes the values with the defaults of the object properties', () => {
    const { host, applied } = setUp();
    host.load(docOf([refLayer('l1', 'hero', 'canvas', { x: [{ frame: 1, value: 7 }] })]));
    applied.length = 0;
    host.render(timeAt(3));
    expect(applied[0].values).toEqual({ x: 7, y: 0, frameIndex: 0 });
  });

  it('calls endFrame once per frame, after every apply', () => {
    const order: string[] = [];
    const { host } = setUp({
      apply: (sprite) => order.push(`apply ${sprite.name}`),
      endFrame: (_time, states) => order.push(`end ${states.length}`)
    });
    host.load(docOf([refLayer('l1', 'hero'), refLayer('l2', 'villain')]));
    order.length = 0;
    host.render(timeAt(2));
    host.render(timeAt(3));
    expect(order).toEqual(['apply hero', 'apply villain', 'end 2', 'apply hero', 'apply villain', 'end 2']);
  });

  it('gives endFrame the time and the prepared states', () => {
    const { host, endFrames } = setUp();
    host.load(docOf([refLayer('l1', 'hero')]));
    endFrames.length = 0;
    host.render(timeAt(4));
    expect(endFrames).toEqual([{ frame: 4, count: 1 }]);
  });

  it('works without endFrame', () => {
    const { host, applied } = setUp({ endFrame: undefined });
    host.load(docOf([refLayer('l1', 'hero')]));
    applied.length = 0;
    host.render(timeAt(2));
    expect(applied).toHaveLength(1);
  });
});

describe('createObjectStage inactive layers and release', () => {
  const blankAfter = (): ILayer => ({
    id: 'l1',
    type: 'layer',
    name: 'l1',
    target: { ref: 'hero', stage: 'canvas' },
    spans: [
      { id: 's1', start: 1, end: 4, kind: 'tween', tracks: { x: [{ frame: 1, value: 0 }, { frame: 4, value: 30 }] } },
      { id: 's2', start: 5, end: 10, kind: 'blank' }
    ]
  });

  it('gives apply the default values of an inactive layer when there is no reset', () => {
    const { host, applied } = setUp();
    host.load(docOf([blankAfter()]));
    applied.length = 0;
    host.render(timeAt(7));
    expect(applied[0].active).toBe(false);
    expect(applied[0].values).toEqual({ x: 0, y: 0, frameIndex: 0 });
  });

  it('calls reset before apply for an inactive layer, with the evaluated values', () => {
    const calls: string[] = [];
    const { host } = setUp({
      reset: (sprite) => calls.push(`reset ${sprite.name}`),
      apply: (sprite, values, state) => calls.push(`apply ${sprite.name} ${state.active} x=${values.x}`)
    });
    host.load(docOf([blankAfter()]));
    calls.length = 0;
    host.render(timeAt(3));
    host.render(timeAt(7));
    expect(calls).toEqual(['apply hero true x=20', 'reset hero', 'apply hero false x=30']);
  });

  it('resets the object when its layer is released', () => {
    const resets: string[] = [];
    const { host } = setUp({ reset: (sprite) => resets.push(sprite.name) });
    host.load(docOf([refLayer('l1', 'hero'), refLayer('l2', 'villain')]));
    host.load(docOf([refLayer('l2', 'villain')]));
    expect(resets).toEqual(['hero']);
    host.destroy();
    expect(resets).toEqual(['hero', 'villain']);
  });

  it('applies the defaults on release when there is no reset', () => {
    const { host, applied } = setUp();
    host.load(docOf([refLayer('l1', 'hero', 'canvas', TRACKS)]));
    host.render(timeAt(6));
    applied.length = 0;
    host.load(docOf([]));
    expect(applied).toEqual([{ name: 'hero', values: { x: 0, y: 0, frameIndex: 0 }, active: false }]);
  });

  it('uses the stage properties when an object declares none', () => {
    const { host, applied } = setUp();
    host.load(docOf([refLayer('l1', 'villain', 'canvas', { x: [{ frame: 1, value: 2 }] })]));
    applied.length = 0;
    host.render(timeAt(2));
    expect(applied[0].values).toEqual({ x: 2, frameIndex: 0 });
  });
});

describe('createObjectStage targets', () => {
  it('lists the objects as scoped targets', () => {
    const { stage } = setUp();
    expect(stage.targets?.list()).toEqual([
      {
        target: { ref: 'hero', stage: 'canvas' },
        label: 'Héros',
        icon: 'sprite',
        group: 'Acteurs',
        properties: ['x', 'y', 'frameIndex']
      },
      { target: { ref: 'villain', stage: 'canvas' }, label: 'Méchant' }
    ]);
  });

  it('describes a known target, scoped or not, and nothing else', () => {
    const { stage } = setUp();
    expect(stage.targets?.describe?.({ ref: 'hero' })?.label).toBe('Héros');
    expect(stage.targets?.describe?.({ ref: 'hero', stage: 'canvas' })?.icon).toBe('sprite');
    expect(stage.targets?.describe?.({ ref: 'ghost' })).toBeUndefined();
    expect(stage.targets?.describe?.({ ref: 'hero', stage: 'audio' })).toBeUndefined();
    expect(stage.targets?.describe?.({ selector: 'div' })).toBeUndefined();
  });

  it('adds and removes objects, notifying the subscribers until they unsubscribe', () => {
    const { stage } = setUp();
    const onChange = jest.fn();
    const unsubscribe = stage.targets?.subscribe?.(onChange) ?? (() => undefined);
    stage.add({ id: 'boss', label: 'Boss', object: { name: 'boss', log: [] } });
    expect(stage.targets?.list().map((info) => info.label)).toEqual(['Héros', 'Méchant', 'Boss']);
    expect(stage.resolve({ ref: 'boss' })?.name).toBe('boss');
    expect(stage.remove('boss')).toBe(true);
    expect(stage.remove('boss')).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(2);
    unsubscribe();
    stage.add({ id: 'again', label: 'Again', object: { name: 'again', log: [] } });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('retries a failed resolution when an object is added', () => {
    const { stage, host } = setUp();
    host.load(docOf([refLayer('l1', 'boss')]));
    expect(host.missingTargets).toEqual(['l1']);
    stage.add({ id: 'boss', label: 'Boss', object: { name: 'boss', log: [] } });
    expect(host.missingTargets).toEqual([]);
  });

  it('rejects an empty or duplicate id', () => {
    const { stage } = setUp();
    const object = { name: 'x', log: [] };
    expect(() => stage.add({ id: '', label: 'Vide', object })).toThrow(/non-empty/);
    expect(() => stage.add({ id: 'hero', label: 'Doublon', object })).toThrow(/"hero"/);
    expect(() => createObjectStage<ISprite>({ id: 'c', apply: () => undefined, objects: [{ id: 'a', label: 'A', object }, { id: 'a', label: 'B', object }] })).toThrow(/"a"/);
  });
});

describe('createObjectStage sync', () => {
  it('forwards sync to the option', () => {
    const sync = jest.fn();
    const { host } = setUp({ sync });
    host.load(docOf([refLayer('l1', 'hero')]));
    host.sync(timeAt(2), { playing: true, speed: 1 });
    expect(sync).toHaveBeenLastCalledWith(timeAt(2), { playing: true, speed: 1 });
  });

  it('has no sync without the option', () => {
    const { stage } = setUp();
    expect(stage.sync).toBeUndefined();
  });
});

describe('createObjectStage types', () => {
  it('apply receives the state of the layer', () => {
    const states: Array<IStageLayerState<ISprite>> = [];
    const { host } = setUp({ apply: (_sprite, _values, state) => states.push(state) });
    host.load(docOf([refLayer('l1', 'hero')]));
    states.length = 0;
    host.render(timeAt(2));
    expect(states[0]).toMatchObject({ layerId: 'l1', active: true, editorVisible: true, target: { ref: 'hero' } });
  });
});
