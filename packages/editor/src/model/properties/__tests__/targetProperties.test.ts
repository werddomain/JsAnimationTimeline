// packages/editor/src/model/properties/__tests__/targetProperties.test.ts
import type { ITargetInfo } from '@werddomain/timeline-runtime';
import { createRegistry } from '../../spans/__tests__/fixtures';
import { getTargetPropertyNames } from '../targetProperties';

const registry = createRegistry().register({ name: 'volume', kind: 'value', unit: '', defaultValue: 0 });
const target = { ref: 'logo', stage: 'canvas' };

it('uses every registered property when the target or metadata is absent', () => {
  const names = registry.list().map(({ name }) => name);
  expect(getTargetPropertyNames(undefined, { registry })).toEqual(names);
  expect(getTargetPropertyNames(target, { registry })).toEqual(names);
  expect(getTargetPropertyNames(target, {
    registry, describe: () => ({ target, label: 'Logo' }), listTargets: () => []
  })).toEqual(names);
});

it('honors explicit empty metadata and filters named or labeled properties to the registry', () => {
  const describe = (): ITargetInfo => ({ target, label: 'Logo', properties: [] });
  expect(getTargetPropertyNames(target, { registry, describe })).toEqual([]);
  expect(getTargetPropertyNames(target, { registry, describe: () => ({
    target, label: 'Logo', properties: ['x', { name: 'volume', label: 'Volume', unit: 'dB' }, 'unknown', 'x']
  }) })).toEqual(['x', 'volume']);
});

it('falls back to the matching listed target using structural target equality', () => {
  const listTargets = (): readonly ITargetInfo[] => [
    { target: { ref: 'logo', stage: 'other' }, label: 'Other', properties: [] },
    { target: { stage: 'canvas', ref: 'logo' }, label: 'Logo', properties: ['volume'] }
  ];
  expect(getTargetPropertyNames(target, { registry, describe: () => undefined, listTargets })).toEqual(['volume']);
  expect(getTargetPropertyNames(target, {
    registry, describe: () => ({ target, label: 'Logo' }), listTargets
  })).toEqual(['volume']);
});

it('gives explicit describe metadata precedence over list metadata', () => {
  expect(getTargetPropertyNames(target, {
    registry, describe: () => ({ target, label: 'Logo', properties: [] }),
    listTargets: () => [{ target, label: 'Logo', properties: ['x'] }]
  })).toEqual([]);
});
